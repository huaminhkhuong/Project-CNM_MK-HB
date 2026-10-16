import { Request, Response } from "express";

import { prisma } from "../../config/prisma";
import { ROLES } from "../../constants/roles";
import { AppError } from "../../errors/app-error";
import { asyncHandler } from "../../utils/async-handler";
import {
  completeDeliveredOrder,
  ensurePaymentProofColumn,
  getOrderById,
  getOrdersByUser,
  listOrders,
  markOrderPaymentCancelled,
  markOrderPaid,
  normalizeOrderRecord,
  saveOrderPaymentProof,
  updateOrderStatus
} from "./orders.repository";
import { checkoutSchema, updateOrderStatusSchema } from "./orders.validator";
import { generateVnpayUrl, verifyVnpayReturn } from "../../utils/vnpay";
import { validateCoupon } from "../coupons/coupons.service";
import { generateMomoUrl, verifyMomoSignature } from "../../utils/momo";
import { env } from "../../config/env";
import jwt from "jsonwebtoken";
import { sendEmailAsync } from "../../services/email.service";
import { buildOrderConfirmEmail } from "../../templates/email-order-confirm";
import { buildPaymentResultEmail } from "../../templates/email-payment-result";

import { createWarrantyRecordsForDeliveredOrder } from "../warranties/warranty-sync.service";
import { publishOrderEvent, subscribeOrderEvents } from "../../services/order-events";

type UploadedPaymentProofFile = {
  filename: string;
};

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const currentUser = req.user;
  const payload = checkoutSchema.parse(req.body);
  const directItems = Array.isArray(payload.items) && payload.items.length > 0 ? payload.items : null;

  const result = await prisma.$transaction(async (tx: any) => {
    let cartId: number | null = null;
    let orderSourceItems: Array<{
      product_variant_id: number;
      product_id: number | null;
      sku_snapshot: string | null;
      name_snapshot: string | null;
      unitPrice: number;
      quantity: number;
    }> = [];

    if (directItems) {
      const variantIds = [...new Set(directItems.map((item) => Number(item.productVariantId || 0)).filter((value) => value > 0))];
      if (variantIds.length !== directItems.length) {
        throw new AppError("Invalid product variant in direct checkout", 400);
      }

      const variants = await tx.productSku.findMany({
        where: { id: { in: variantIds } },
        include: {
          Product: true
        }
      });

      if (variants.length !== variantIds.length) {
        throw new AppError("One or more product variants were not found", 404);
      }

      const variantMap = new Map<number, any>(variants.map((variant: any) => [variant.id, variant]));

      orderSourceItems = directItems.map((item) => {
        const variantId = Number(item.productVariantId);
        const variant = variantMap.get(variantId);
        if (!variant || !variant.is_active) {
          throw new AppError(`Product variant ${variantId} is unavailable`, 400);
        }

        if (item.productId && Number(item.productId) !== Number(variant.product_id)) {
          throw new AppError("Product and variant do not match", 400);
        }

        const quantity = Number(item.quantity || 1);
        if (Number(variant.stock || 0) < quantity) {
          throw new AppError(`Vượt quá tồn kho cho sản phẩm ${variant.Product?.name || variant.sku || variantId}`, 400);
        }

        return {
          product_variant_id: variant.id,
          product_id: variant.product_id,
          sku_snapshot: variant.sku,
          name_snapshot: variant.Product?.name || variant.sku,
          unitPrice: Number(variant.price),
          quantity
        };
      });
    } else {
      let cart = await tx.cart.findFirst({ where: { user_id: Number(currentUser.userId) } });

      if (!cart) {
        cart = await tx.cart.create({ data: { user_id: Number(currentUser.userId) } });
      }

      cartId = cart.id;

      const cartWithItems = await tx.cart.findUnique({
        where: { id: cart.id },
        include: {
          CartItem: {
            include: {
              ProductSku: {
                include: {
                  Product: true
                }
              }
            }
          }
        }
      });

      if (!cartWithItems || cartWithItems.CartItem.length === 0) {
        throw new AppError("Cart is empty", 400);
      }

      orderSourceItems = cartWithItems.CartItem.map((item: any) => ({
        product_variant_id: item.product_variant_id,
        product_id: item.ProductSku.product_id,
        sku_snapshot: item.ProductSku.sku,
        name_snapshot: item.ProductSku.Product?.name || item.ProductSku.sku,
        unitPrice: Number(item.ProductSku.price),
        quantity: item.quantity
      }));
    }

    if (payload.addressId) {
      const address = await tx.address.findFirst({
        where: {
          id: payload.addressId,
          user_id: Number(currentUser.userId)
        }
      });

      if (!address) {
        throw new AppError("Shipping address not found", 404);
      }
    }

    let total = 0;
    for (const item of orderSourceItems) {
      total += Number(item.unitPrice) * Number(item.quantity);
    }

    const shippingFee = Number(payload.shippingFee || 0);
    let discountAmount = 0;
    let appliedCouponCode: string | null = null;

    if (payload.couponCode) {
      const couponResult = await validateCoupon(payload.couponCode, total);
      discountAmount = Number(couponResult.discountAmount || 0);
      appliedCouponCode = couponResult.code;

      // Tăng lượt sử dụng coupon một cách an toàn
      await tx.$executeRawUnsafe(
        `UPDATE coupons SET used_count = used_count + 1 WHERE code = ?`,
        couponResult.code
      );
    }

    const finalAmount = Math.max(0, total - discountAmount + shippingFee);
    const orderNote = appliedCouponCode 
      ? `[Mã giảm giá: ${appliedCouponCode} - Giảm ${discountAmount.toLocaleString("vi-VN")}đ] ${payload.note || ""}`.trim()
      : payload.note;
    
    const order = await tx.order.create({
      data: {
        user_id: Number(currentUser.userId),
        address_id: payload.addressId,
        total_price: total, // Just backward compat
        total_amount: total,
        shipping_fee: shippingFee,
        final_amount: finalAmount,
        payment_method: payload.paymentMethod,
        shipping_address: payload.shippingAddress,
        payment_status: payload.paymentMethod === "COD" ? "UNPAID" : "PENDING_GATEWAY",
        status: "PENDING",
        note: orderNote,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    for (const item of orderSourceItems) {
      const unitPrice = Number(item.unitPrice);
      const lineTotal = unitPrice * item.quantity;

      await tx.orderItem.create({
        data: {
          order_id: order.id,
          product_variant_id: item.product_variant_id,
          product_id: item.product_id,
          sku_snapshot: item.sku_snapshot,
          name_snapshot: item.name_snapshot,
          unit_price: unitPrice,
          quantity: item.quantity,
          line_total: lineTotal,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      const updateResult = await tx.productSku.updateMany({
        where: {
          id: item.product_variant_id,
          stock: { gte: item.quantity }
        },
        data: {
          stock: {
            decrement: item.quantity
          }
        }
      });

      if (updateResult.count === 0) {
        throw new AppError(`Sản phẩm "${item.name_snapshot}" không đủ số lượng tồn kho`, 400);
      }
    }

    if (!directItems && cartId) {
      await tx.cartItem.deleteMany({
        where: { cart_id: cartId }
      });
    }

    const createdOrder = await tx.order.findUnique({
      where: { id: order.id },
      include: { OrderItem: true }
    });

    return createdOrder;
  });

  const normalizedOrder = await normalizeOrderRecord(result);

  // 📧 Email: Gửi xác nhận đặt hàng cho khách (bất đồng bộ - không block response)
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(currentUser.userId) },
      select: { email: true, full_name: true }
    });
    if (user?.email && result) {
      const { buildOrderConfirmEmail: buildConfirm } = require("../../templates/email-order-confirm");
      const { sendEmailAsync: sendAsync } = require("../../services/email.service");
      const items = (result as any).OrderItem?.map((item: any) => ({
        name: item.name_snapshot || item.sku_snapshot || "Sản phẩm",
        sku: item.sku_snapshot,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
        lineTotal: Number(item.line_total)
      })) || [];
      const { subject, html } = buildConfirm({
        customerName: (user as any).full_name || (user as any).name || user.email,
        customerEmail: user.email,
        orderId: result.id,
        orderDate: (result as any).created_at || new Date(),
        items,
        totalAmount: Number((result as any).total_amount || (result as any).total_price || 0),
        shippingFee: Number((result as any).shipping_fee || 0),
        finalAmount: Number((result as any).final_amount || (result as any).total_amount || 0),
        paymentMethod: (result as any).payment_method || "COD",
        shippingAddress: (result as any).shipping_address
      });
      sendAsync({ to: user.email, subject, html });
    }
  } catch (emailErr) {
    // Email errors never block order creation
    console.warn("[Email] Order confirm email failed:", (emailErr as Error).message);
  }

  res.status(201).json({
    success: true,
    data: normalizedOrder
  });
});

export const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const orders = await getOrdersByUser(req.user.userId);

  res.status(200).json({
    success: true,
    data: await Promise.all(orders.map((order) => normalizeOrderRecord(order)))
  });
});

export const streamOrderEvents = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.query.token || "");
  if (!token) {
    throw new AppError("Unauthorized", 401);
  }

  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as { userId?: string; sub?: string };
    const userId = payload.userId || payload.sub;
    if (!userId) {
      throw new Error("Token does not include user id");
    }
    subscribeOrderEvents(userId, res);
  } catch (_error) {
    throw new AppError("Invalid or expired token", 401);
  }
});

export const getOrderDetail = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const order = await getOrderById(req.params.id);

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  const canAccess =
    order.user_id === Number(req.user.userId) ||
    req.user.role === ROLES.ADMIN ||
    req.user.role === ROLES.SALES;

  if (!canAccess) {
    throw new AppError("Forbidden", 403);
  }

  res.status(200).json({
    success: true,
    data: await normalizeOrderRecord(order)
  });
});

export const getAllOrders = asyncHandler(async (_req: Request, res: Response) => {
  const orders = await listOrders();

  res.status(200).json({
    success: true,
    data: await Promise.all(orders.map((order) => normalizeOrderRecord(order)))
  });
});

export const patchOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const payload = updateOrderStatusSchema.parse(req.body);

  const current = await getOrderById(req.params.id);
  if (!current) {
    throw new AppError("Order not found", 404);
  }

  const result = await prisma.$transaction(async (tx: any) => {
    // Note: trackingCode is not in the schema, using note field as workaround
    if ((payload.status === "PROCESSING" || payload.status === "SHIPPED")) {
      // Shipment tracking can be managed via Shipment model instead
    }

    return await tx.order.update({
      where: { id: Number(req.params.id) },
        data: { status: payload.status, updated_at: new Date() }
    });
  });

  // Return full order to show new trackingCode or details
  const finalOrder = await getOrderById(req.params.id);
  if (finalOrder?.user_id) {
    publishOrderEvent(finalOrder.user_id, {
      orderId: finalOrder.id,
      status: finalOrder.status,
      paymentStatus: finalOrder.payment_status
    });
  }

  res.status(200).json({
    success: true,
    data: await normalizeOrderRecord(finalOrder)
  });
});

export const confirmOrderReceived = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const order = await getOrderById(req.params.id);
  if (!order || order.user_id !== Number(req.user.userId)) {
    throw new AppError("Order not found", 404);
  }

  if (order.status !== "DELIVERED") {
    throw new AppError("Only delivered orders can be confirmed as received", 400);
  }

  const result = await completeDeliveredOrder(req.params.id, req.user.userId);
  if (result.count === 0) {
    throw new AppError("Order status was changed. Please reload and try again.", 409);
  }

  const updatedOrder = await getOrderById(req.params.id);
  await createWarrantyRecordsForDeliveredOrder(req.params.id);
  publishOrderEvent(req.user.userId, {
    orderId: updatedOrder?.id || req.params.id,
    status: updatedOrder?.status || "COMPLETED",
    paymentStatus: updatedOrder?.payment_status
  });

  res.status(200).json({
    success: true,
    message: "Order received confirmed",
    data: await normalizeOrderRecord(updatedOrder)
  });
});

export const payOrderMock = asyncHandler(async (req: Request, res: Response) => {
  const current = await getOrderById(req.params.id);
  if (!current) {
    throw new AppError("Order not found", 404);
  }

  const paid = await markOrderPaid(req.params.id);

  res.status(200).json({
    success: true,
    data: await normalizeOrderRecord(paid),
    message: "Payment confirmed (mock)"
  });
});

export const createVnpayUrl = asyncHandler(async (req: Request, res: Response) => {
  const order = await getOrderById(req.params.id);
  if (!order || order.user_id !== Number(req.user?.userId)) {
    throw new AppError("Order not found", 404);
  }

  if (order.payment_status === "PAID") {
    throw new AppError("Order already paid", 400);
  }

  const tmnCode = env.vnpayTmnCode || process.env?.VNPAY_TMN_CODE;
  const secretKey = env.vnpayHashSecret || process.env?.VNPAY_HASH_SECRET;
  const frontendUrl = env.frontendUrl || process.env.FRONTEND_URL || "http://localhost:5173";
  const shouldUseMockPayment = env.paymentMockMode || (!tmnCode && !process.env.VNPAY_TMN_CODE);

  if (shouldUseMockPayment) {
    const payAmount = Number(order.final_amount || order.total_amount || 0);
    const mockUrl = `${frontendUrl}/payment/mock?orderId=${order.id}&amount=${payAmount}`;
    res.status(200).json({
      success: true,
      data: { paymentUrl: mockUrl, isMock: true }
    });
    return;
  }

  const ipAddr = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1") as string;
  const url = generateVnpayUrl(
    ipAddr,
    String(order.id),
    Number(order.final_amount || order.total_amount || 0),
    `Thanh toan don hang #${order.id}`
  );

  res.status(200).json({
    success: true,
    data: { paymentUrl: url }
  });
});

export const createMomoUrl = asyncHandler(async (req: Request, res: Response) => {
  const order = await getOrderById(req.params.id);
  if (!order || order.user_id !== Number(req.user?.userId)) {
    throw new AppError("Order not found", 404);
  }

  if (order.payment_status === "PAID") {
    throw new AppError("Order already paid", 400);
  }

  const amount = Number(order.final_amount || order.total_amount || 0);
  const orderInfo = `Thanh toan don hang PC Mall #${order.id}`;

  try {
    const { payUrl, requestId } = await generateMomoUrl(String(order.id), amount, orderInfo);
    res.status(200).json({
      success: true,
      data: { paymentUrl: payUrl, requestId, provider: "MOMO" }
    });
  } catch (error) {
    // Fallback to Mock Payment Mode if MoMo sandbox is unreachable
    const frontendUrl = env.frontendUrl || process.env.FRONTEND_URL || "http://localhost:5173";
    const mockUrl = `${frontendUrl}/payment/mock?orderId=${order.id}&amount=${amount}&provider=MOMO`;
    res.status(200).json({
      success: true,
      data: { paymentUrl: mockUrl, isMock: true, provider: "MOMO" }
    });
  }
});

export const confirmMockPayment = asyncHandler(async (req: Request, res: Response) => {
  const order = await getOrderById(req.params.id);
  if (!order || order.user_id !== Number(req.user?.userId)) {
    throw new AppError("Order not found", 404);
  }

  await markOrderPaid(req.params.id);

  res.status(200).json({
    success: true,
    message: "Payment confirmed (mock)",
    data: { orderId: req.params.id }
  });
});

export const cancelMockPayment = asyncHandler(async (req: Request, res: Response) => {
  const order = await getOrderById(req.params.id);
  if (!order || order.user_id !== Number(req.user?.userId)) {
    throw new AppError("Order not found", 404);
  }

  if (order.payment_status === "PAID") {
    throw new AppError("Order already paid", 400);
  }

  await markOrderPaymentCancelled(req.params.id);

  res.status(200).json({
    success: true,
    message: "Payment cancelled (mock)",
    data: { orderId: req.params.id, paymentStatus: "PAYMENT_CANCELLED" }
  });
});

export const uploadPaymentProof = asyncHandler(async (req: Request, res: Response) => {
  const file = (req as Request & { file?: UploadedPaymentProofFile }).file;
  const order = await getOrderById(req.params.id);

  if (!order || order.user_id !== Number(req.user?.userId)) {
    throw new AppError("Order not found", 404);
  }

  if (order.payment_method !== "BANK_TRANSFER") {
    throw new AppError("Payment proof upload is only available for QR Banking orders", 400);
  }

  if (order.payment_status === "PAID") {
    throw new AppError("Order already paid", 400);
  }

  if (!file) {
    throw new AppError("Payment proof image is required", 400);
  }

  const proofUrl = `/uploads/payment-proofs/${file.filename}`;
  await saveOrderPaymentProof(req.params.id, proofUrl);

  const updatedOrder = await getOrderById(req.params.id);
  if (updatedOrder?.user_id) {
    publishOrderEvent(updatedOrder.user_id, {
      orderId: updatedOrder.id,
      status: updatedOrder.status,
      paymentStatus: updatedOrder.payment_status
    });
  }

  res.status(200).json({
    success: true,
    message: "Payment proof uploaded successfully",
    data: {
      ...(await normalizeOrderRecord(updatedOrder)),
      paymentProof: proofUrl,
      paymentStatus: "AWAITING_ADMIN_CONFIRMATION"
    }
  });
});

export const approvePaymentProof = asyncHandler(async (req: Request, res: Response) => {
  const order = await getOrderById(req.params.id);

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  if (order.payment_method !== "BANK_TRANSFER") {
    throw new AppError("Payment approval is only available for QR Banking orders", 400);
  }

  await ensurePaymentProofColumn();

  const approved = Boolean(req.body?.approved);
  if (approved) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE orders
        SET payment_status = 'PAID',
            status = 'PROCESSING',
            updated_at = NOW()
        WHERE id = ?
      `,
      Number(req.params.id)
    );
  } else {
    await prisma.$executeRawUnsafe(
      `
        UPDATE orders
        SET payment_status = 'REJECTED',
            status = 'PENDING',
            updated_at = NOW()
        WHERE id = ?
      `,
      Number(req.params.id)
    );
  }

  const updatedOrder = await getOrderById(req.params.id);
  if (updatedOrder?.user_id) {
    publishOrderEvent(updatedOrder.user_id, {
      orderId: updatedOrder.id,
      status: updatedOrder.status,
      paymentStatus: updatedOrder.payment_status
    });
  }

  // 📧 Email: Thông báo kết quả duyệt thanh toán
  try {
    const customer = await prisma.user.findUnique({
      where: { id: Number(updatedOrder?.user_id) },
      select: { email: true, full_name: true }
    });
    if (customer?.email && updatedOrder) {
      const { buildPaymentResultEmail: buildResult } = require("../../templates/email-payment-result");
      const { sendEmailAsync: sendAsync } = require("../../services/email.service");
      const { subject, html } = buildResult({
        customerName: (customer as any).full_name || (customer as any).name || customer.email,
        customerEmail: customer.email,
        orderId: updatedOrder.id,
        approved,
        rejectionReason: !approved ? (req.body?.reason || "Ảnh hóa đơn không hợp lệ hoặc không rõ ràng.") : undefined,
        finalAmount: Number((updatedOrder as any).final_amount || (updatedOrder as any).total_amount || 0),
        reviewedAt: new Date()
      });
      sendAsync({ to: customer.email, subject, html });
    }
  } catch (emailErr) {
    console.warn("[Email] Payment result email failed:", (emailErr as Error).message);
  }

  res.status(200).json({
    success: true,
    message: approved ? "Payment approved" : "Payment rejected",
    data: await normalizeOrderRecord(updatedOrder)
  });
});

export const vnpayReturn = asyncHandler(async (req: Request, res: Response) => {
  const vnp_Params = req.query;
  const isSecure = verifyVnpayReturn(vnp_Params);

  if (isSecure) {
    const responseCode = vnp_Params["vnp_ResponseCode"];
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/payment/result?success=${responseCode === "00"}&orderId=${vnp_Params["vnp_TxnRef"]}`);
  } else {
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/payment/result?success=false&reason=invalid_signature`);
  }
});

export const vnpayIpn = asyncHandler(async (req: Request, res: Response) => {
  const vnp_Params = req.query;
  const isSecure = verifyVnpayReturn(vnp_Params);

  if (!isSecure) {
    console.error("[VNPay IPN] Invalid checksum for params:", vnp_Params);
    res.status(200).json({ RspCode: "97", Message: "Invalid checksum" });
    return;
  }

  const orderId = vnp_Params["vnp_TxnRef"] as string;
  const responseCode = vnp_Params["vnp_ResponseCode"];
  const vnpTxnNo = vnp_Params["vnp_TransactionNo"] as string;

  console.log(`[VNPay IPN] Order: ${orderId}, Code: ${responseCode}, TxnNo: ${vnpTxnNo}`);

  if (responseCode === "00") {
    const order = await getOrderById(orderId);
    if (!order) {
      console.error(`[VNPay IPN] Order not found: ${orderId}`);
      res.status(200).json({ RspCode: "01", Message: "Order not found" });
      return;
    }

    if (order.payment_status === "PAID") {
      console.log(`[VNPay IPN] Order already paid: ${orderId}, idempotent`);
      res.status(200).json({ RspCode: "00", Message: "Confirm Success (Already Paid)" });
      return;
    }

    await markOrderPaid(orderId);
    const updatedOrder = await getOrderById(orderId);
    if (updatedOrder?.user_id) {
      publishOrderEvent(updatedOrder.user_id, {
        orderId: updatedOrder.id,
        status: updatedOrder.status,
        paymentStatus: updatedOrder.payment_status
      });

      // 📧 Email: Gửi email kết quả thanh toán thành công
      try {
        const customer = await prisma.user.findUnique({
          where: { id: Number(updatedOrder.user_id) },
          select: { email: true, full_name: true }
        });
        if (customer?.email) {
          const { buildPaymentResultEmail: buildResult } = require("../../templates/email-payment-result");
          const { sendEmailAsync: sendAsync } = require("../../services/email.service");
          const { subject, html } = buildResult({
            customerName: (customer as any).full_name || (customer as any).name || customer.email,
            customerEmail: customer.email,
            orderId: updatedOrder.id,
            approved: true,
            finalAmount: Number((updatedOrder as any).final_amount || (updatedOrder as any).total_amount || 0),
            reviewedAt: new Date()
          });
          sendAsync({ to: customer.email, subject, html });
        }
      } catch (e) {
        console.warn("[VNPay IPN Email Error]", (e as Error).message);
      }
    }
    console.log(`[VNPay IPN] Order marked as paid: ${orderId}`);
  }

  res.status(200).json({ RspCode: "00", Message: "Confirm Success" });
});

export const momoIpn = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.body || req.query;
  const isSecure = verifyMomoSignature(payload);

  if (!isSecure) {
    console.error("[MoMo IPN] Signature verification failed:", payload);
    res.status(400).json({ message: "Invalid MoMo signature", resultCode: 97 });
    return;
  }

  const { orderId, resultCode, transId } = payload;
  console.log(`[MoMo IPN] Order: ${orderId}, ResultCode: ${resultCode}, TransId: ${transId}`);

  if (Number(resultCode) === 0) {
    const order = await getOrderById(orderId);
    if (!order) {
      res.status(404).json({ message: "Order not found", resultCode: 1 });
      return;
    }

    if (order.payment_status === "PAID") {
      res.status(200).json({ message: "Already paid", resultCode: 0 });
      return;
    }

    await markOrderPaid(orderId);
    const updatedOrder = await getOrderById(orderId);
    if (updatedOrder?.user_id) {
      publishOrderEvent(updatedOrder.user_id, {
        orderId: updatedOrder.id,
        status: updatedOrder.status,
        paymentStatus: updatedOrder.payment_status
      });

      // 📧 Email notification for MoMo Payment
      try {
        const customer = await prisma.user.findUnique({
          where: { id: Number(updatedOrder.user_id) },
          select: { email: true, full_name: true }
        });
        if (customer?.email) {
          const { buildPaymentResultEmail: buildResult } = require("../../templates/email-payment-result");
          const { sendEmailAsync: sendAsync } = require("../../services/email.service");
          const { subject, html } = buildResult({
            customerName: (customer as any).full_name || (customer as any).name || customer.email,
            customerEmail: customer.email,
            orderId: updatedOrder.id,
            approved: true,
            finalAmount: Number((updatedOrder as any).final_amount || (updatedOrder as any).total_amount || 0),
            reviewedAt: new Date()
          });
          sendAsync({ to: customer.email, subject, html });
        }
      } catch (e) {
        console.warn("[MoMo IPN Email Error]", (e as Error).message);
      }
    }
  }

  res.status(204).send();
});

export const cancelMyOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const orderId = req.params.id;
  const userId = req.user.userId;

  const result = await prisma.$transaction(async (tx: any) => {
    const order = await tx.order.findUnique({
      where: { id: parseInt(orderId) },
      include: { OrderItem: true }
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    if (order.user_id !== Number(userId)) {
      throw new AppError("Forbidden: You can only cancel your own orders", 403);
    }

    if (order.status !== "PENDING") {
      throw new AppError(`Cannot cancel order in ${order.status} status. Only PENDING orders can be canceled.`, 400);
    }

    // Update order status
    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELED" }
    });

    // Restore stock
    for (const item of order.OrderItem) {
      await tx.productSku.update({
        where: { id: item.product_variant_id },
        data: {
          stock: {
            increment: item.quantity
          }
        }
      });
    }

    return updatedOrder;
  });

  res.status(200).json({
    success: true,
    data: result,
    message: "Order canceled successfully"
  });

  publishOrderEvent(userId, {
    orderId,
    status: "CANCELED",
    paymentStatus: result.payment_status
  });
});
