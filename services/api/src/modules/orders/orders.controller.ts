import crypto from "crypto";
import { Request, Response } from "express";

import { prisma } from "../../config/prisma";
import { ROLES } from "../../constants/roles";
import { AppError } from "../../errors/app-error";
import { asyncHandler } from "../../utils/async-handler";
import {
  completeDeliveredOrder,
  createOrderPaymentRecord,
  getOrderById,
  getOrdersByUser,
  listOrders,
  markOrderPaymentCancelled,
  markOrderPaymentFailed,
  markOrderPaid,
  normalizeOrderRecord,
  saveOrderPaymentProof,
  syncGatewayPaymentOnRedirect,
  updateOrderPaymentProofDecision,
  updateOrderStatus
} from "./orders.repository";
import { checkoutSchema, updateOrderStatusSchema } from "./orders.validator";
import { generateVnpayUrl, verifyVnpayReturn } from "../../utils/vnpay";
import { generateMomoUrl, isMomoConfigured, verifyMomoSignature } from "../../utils/momo";
import { env } from "../../config/env";
import jwt from "jsonwebtoken";
import { sendEmailAsync } from "../../services/email.service";
import { buildOrderConfirmEmail } from "../../templates/email-order-confirm";
import { buildPaymentResultEmail } from "../../templates/email-payment-result";

import { createWarrantyRecordsForDeliveredOrder } from "../warranties/warranty-sync.service";
import { publishOrderEvent, subscribeOrderEvents } from "../../services/order-events";
import { validateAndCalculateCoupon } from "../coupons/coupons.service";
import { sendOrderStatusNotification } from "../notifications/notifications.service";
import { isTokenBlacklisted } from "../../services/token-blacklist.service";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { recordAuditLog } = require("../../services/audit-log.service");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { isMockPaymentEnabled } = require("../../services/payment-mode.service");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ORDER_STATUS_TRANSITIONS } = require("./orders.common");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { calculateServerShippingFee } = require("./shipping-fee.service");

const SSE_TICKET_TTL_MS = 30_000;
const sseTicketStore = new Map<string, { userId: string; expiresAt: number }>();

function pruneExpiredSseTickets() {
  const now = Date.now();
  for (const [ticket, entry] of sseTicketStore.entries()) {
    if (entry.expiresAt <= now) {
      sseTicketStore.delete(ticket);
    }
  }
}

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
          category_id: variant.Product?.category_id,
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
        category_id: item.ProductSku.Product?.category_id,
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

    // Authoritative server-side shipping fee (completely ignores client-supplied shippingFee)
    const shippingFee = await calculateServerShippingFee(total, {
      shippingMethod: (payload as any).shippingMethod
    });

    let discountAmount = 0;
    let appliedCoupon: any = null;

    if (payload.couponCode) {
      const normalizedCouponCode = String(payload.couponCode).trim().toUpperCase();
      // Row-level lock on coupon inside transaction prevents concurrent double-spend race
      const lockedCoupons = (await tx.$queryRawUnsafe(
        `SELECT id, usage_limit, used_count, usage_limit_per_user FROM coupons WHERE code = ? FOR UPDATE`,
        normalizedCouponCode
      )) as Array<{ id: number; usage_limit: number | null; used_count: number; usage_limit_per_user: number | null }>;

      const couponResult = await validateAndCalculateCoupon({
        code: normalizedCouponCode,
        userId: Number(currentUser.userId),
        items: orderSourceItems.map((item) => ({
          productId: item.product_id,
          categoryId: (item as any).category_id,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.unitPrice * item.quantity
        })),
        totalAmount: total,
        shippingFee
      });

      const lockedCoupon = lockedCoupons[0];
      if (lockedCoupon) {
        if (lockedCoupon.usage_limit !== null && Number(lockedCoupon.used_count) >= Number(lockedCoupon.usage_limit)) {
          throw new AppError("Mã giảm giá đã hết lượt sử dụng", 400);
        }
        if (lockedCoupon.usage_limit_per_user !== null) {
          const userUsageRows = (await tx.$queryRawUnsafe(
            `SELECT COUNT(*) AS cnt FROM coupon_usages WHERE coupon_id = ? AND user_id = ?`,
            lockedCoupon.id,
            Number(currentUser.userId)
          )) as Array<{ cnt: number | bigint }>;
          if (Number(userUsageRows[0]?.cnt || 0) >= Number(lockedCoupon.usage_limit_per_user)) {
            throw new AppError("Bạn đã dùng hết số lần áp dụng mã giảm giá này", 400);
          }
        }
      }

      discountAmount = couponResult.discountAmount;
      appliedCoupon = couponResult.coupon;
    }

    const finalAmount = Math.max(0, total - discountAmount + shippingFee);

    
    const order = await tx.order.create({
      data: {
        user_id: Number(currentUser.userId),
        address_id: payload.addressId,
        total_price: total, // Just backward compat
        total_amount: total,
        shipping_fee: shippingFee,
        discount_amount: discountAmount,
        coupon_id: appliedCoupon ? appliedCoupon.id : null,
        coupon_code: appliedCoupon ? appliedCoupon.code : null,
        final_amount: finalAmount,
        payment_method: payload.paymentMethod,
        shipping_address: payload.shippingAddress,
        payment_status: payload.paymentMethod === "COD" ? "UNPAID" : "PENDING_GATEWAY",
        status: "PENDING",
        note: payload.note || null,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    await createOrderPaymentRecord(tx, order, {
      note: "Initial payment record created on checkout"
    });

    if (appliedCoupon && discountAmount > 0) {
      const couponAffected = await tx.$executeRawUnsafe(
        `UPDATE coupons SET used_count = used_count + 1 WHERE id = ? AND (usage_limit IS NULL OR used_count < usage_limit)`,
        appliedCoupon.id
      );
      if (Number(couponAffected) === 0) {
        throw new AppError("Mã giảm giá đã hết lượt sử dụng", 400);
      }

      await tx.couponUsage.create({
        data: {
          coupon_id: appliedCoupon.id,
          user_id: Number(currentUser.userId),
          order_id: order.id,
          discount_amount: discountAmount
        }
      });
    }

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

  const createdMethod = String((result as any)?.payment_method || "COD").toUpperCase();
  const createdPaymentStatus = String((result as any)?.payment_status || (createdMethod === "COD" ? "UNPAID" : "PENDING_GATEWAY")).toUpperCase();

  if (result?.id && currentUser.userId) {
    sendOrderStatusNotification({
      userId: Number(currentUser.userId),
      orderId: result.id,
      status: "PENDING",
      paymentMethod: createdMethod,
      paymentStatus: createdPaymentStatus
    }).catch((err: Error) => console.warn("[Notification] Order created notification failed:", err.message));
  }

  // 📧 Email: Chỉ gửi xác nhận đặt hàng thành công ngay lập tức với đơn COD.
  // Với đơn VNPay / VietQR, email xác nhận chỉ gửi sau khi thanh toán thực sự thành công.
  if (createdMethod === "COD") {
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
          paymentMethod: createdMethod,
          shippingAddress: (result as any).shipping_address
        });
        sendAsync({ to: user.email, subject, html });
      }
    } catch (emailErr) {
      // Email errors never block order creation
      console.warn("[Email] Order confirm email failed:", (emailErr as Error).message);
    }
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

export const createOrderEventsTicket = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.userId) {
    throw new AppError("Unauthorized", 401);
  }
  pruneExpiredSseTickets();
  const ticket = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + SSE_TICKET_TTL_MS;
  sseTicketStore.set(ticket, { userId: String(req.user.userId), expiresAt });

  res.status(201).json({
    success: true,
    data: {
      ticket,
      expiresInMs: SSE_TICKET_TTL_MS
    }
  });
});

export const streamOrderEvents = asyncHandler(async (req: Request, res: Response) => {
  const ticket = String(req.query.ticket || "").trim();
  if (!ticket) {
    throw new AppError("Unauthorized: one-time SSE ticket required", 401);
  }

  pruneExpiredSseTickets();
  const entry = sseTicketStore.get(ticket);
  sseTicketStore.delete(ticket); // Consume one-time ticket immediately

  if (!entry || entry.expiresAt <= Date.now()) {
    throw new AppError("Invalid or expired SSE ticket", 401);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: Number(entry.userId) },
    select: { status: true }
  });
  if (dbUser && String(dbUser.status || "ACTIVE").toUpperCase() !== "ACTIVE") {
    throw new AppError("Tài khoản đã bị khóa", 403);
  }

  subscribeOrderEvents(entry.userId, res);
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
  const orderId = Number(req.params.id);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw new AppError("Invalid order id", 400);
  }

  await prisma.$transaction(async (tx: any) => {
    const lockedRows = (await tx.$queryRawUnsafe(
      `SELECT id, status, coupon_id, user_id, payment_status FROM orders WHERE id = ? FOR UPDATE`,
      orderId
    )) as Array<{ id: number; status: string; coupon_id: number | null; user_id: number | null; payment_status: string | null }>;

    const lockedOrder = lockedRows[0];
    if (!lockedOrder) {
      throw new AppError("Order not found", 404);
    }

    const currentStatus = String(lockedOrder.status || "PENDING").toUpperCase();
    const nextStatus = String(payload.status || "").toUpperCase();
    const allowedNextStatuses: string[] = ORDER_STATUS_TRANSITIONS[currentStatus] || [];

    if (currentStatus !== nextStatus && !allowedNextStatuses.includes(nextStatus)) {
      throw new AppError(`Cannot change order status from ${currentStatus} to ${nextStatus}`, 400);
    }

    if (nextStatus === "SHIPPED" || nextStatus === "DELIVERED") {
      const shipment = await tx.shipment.findFirst({
        where: { order_id: orderId },
        orderBy: { id: "desc" }
      });
      if (!shipment || !String(shipment.tracking_code || "").trim()) {
        throw new AppError(`Cannot mark order as ${nextStatus} without a shipment tracking code`, 400);
      }

      if (nextStatus === "SHIPPED") {
        const itemsCountRows = (await tx.$queryRawUnsafe(
          `SELECT COALESCE(SUM(quantity), 0) AS totalRequired FROM order_items WHERE order_id = ?`,
          orderId
        )) as Array<{ totalRequired: number | bigint }>;
        const serialsCountRows = (await tx.$queryRawUnsafe(
          `SELECT COUNT(*) AS totalAssigned FROM order_item_serials WHERE order_id = ?`,
          orderId
        )) as Array<{ totalAssigned: number | bigint }>;

        const totalRequired = Number(itemsCountRows[0]?.totalRequired || 0);
        const totalAssigned = Number(serialsCountRows[0]?.totalAssigned || 0);
        if (totalRequired > 0 && totalAssigned < totalRequired) {
          throw new AppError(
            `Vui lòng gán đủ Serial Number cho tất cả linh kiện trước khi xuất kho / giao hàng (${totalAssigned}/${totalRequired} S/N đã gán).`,
            400
          );
        }
      }

      await tx.shipment.updateMany({
        where: { order_id: orderId },
        data: { status: nextStatus === "SHIPPED" ? "IN_TRANSIT" : "DELIVERED" }
      });
    }

    // Atomically restore inventory ONCE when transitioning to CANCELED from a non-canceled status
    if (nextStatus === "CANCELED" && currentStatus !== "CANCELED") {
      const orderItems = await tx.orderItem.findMany({
        where: { order_id: orderId },
        select: { product_variant_id: true, quantity: true }
      });

      for (const item of orderItems) {
        const variantId = item.product_variant_id;
        const quantity = Number(item.quantity || 0);
        if (variantId && quantity > 0) {
          await tx.productSku.update({
            where: { id: variantId },
            data: { stock: { increment: quantity } }
          });
        }
      }

      await tx.shipment.updateMany({
        where: { order_id: orderId },
        data: { status: "CANCELED" }
      });

      await tx.orderItemSerial.deleteMany({ where: { order_id: orderId } }).catch(() => {});
      await tx.orderItem.updateMany({ where: { order_id: orderId }, data: { serial_numbers: null } }).catch(() => {});

      if (lockedOrder.coupon_id) {
        const deletedUsage = await tx.couponUsage.deleteMany({ where: { order_id: orderId } });
        if (deletedUsage.count > 0) {
          await tx.$executeRawUnsafe(
            `UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE id = ?`,
            lockedOrder.coupon_id
          );
        }
      }

      await tx.payment.updateMany({
        where: {
          order_id: orderId,
          status: { in: ["PENDING_GATEWAY", "UNPAID", "AWAITING_ADMIN_CONFIRMATION"] }
        },
        data: { status: "CANCELED", updated_at: new Date() }
      }).catch(() => {});
    }

    return await tx.order.update({
      where: { id: orderId },
      data: { status: nextStatus, updated_at: new Date() }
    });
  });

  // Return full order to show new trackingCode or details
  if (payload.status === "DELIVERED" || payload.status === "COMPLETED") {
    await createWarrantyRecordsForDeliveredOrder(orderId).catch((err: Error) =>
      console.warn("[WarrantySync] Failed to sync warranties on patchOrderStatus:", err.message)
    );
  }
  const finalOrder = await getOrderById(orderId);
  await recordAuditLog({
    actorUserId: req.user?.userId,
    actorRole: req.user?.role,
    action: "ORDER_STATUS_UPDATED",
    entityType: "ORDER",
    entityId: orderId,
    description: `Updated order #${orderId} status to ${payload.status}`,
    metadata: {
      nextStatus: payload.status
    }
  });
  if (finalOrder?.user_id) {
    publishOrderEvent(finalOrder.user_id, {
      orderId: finalOrder.id,
      status: finalOrder.status,
      paymentStatus: finalOrder.payment_status
    });
    sendOrderStatusNotification({
      userId: Number(finalOrder.user_id),
      orderId: finalOrder.id,
      status: String(finalOrder.status || payload.status)
    }).catch((err: Error) => console.warn("[Notification] Order status notification failed:", err.message));
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
  sendOrderStatusNotification({
    userId: Number(req.user.userId),
    orderId: updatedOrder?.id || req.params.id,
    status: "COMPLETED"
  }).catch((err: Error) => console.warn("[Notification] Confirm received notification failed:", err.message));

  res.status(200).json({
    success: true,
    message: "Order received confirmed",
    data: await normalizeOrderRecord(updatedOrder)
  });
});

async function assertMockPaymentAllowed() {
  const mockEnabled = await isMockPaymentEnabled();
  if (!mockEnabled) {
    throw new AppError("Mock payment is disabled", 403);
  }
}

export const payOrderMock = asyncHandler(async (req: Request, res: Response) => {
  const current = await getOrderById(req.params.id);
  if (!current) {
    throw new AppError("Order not found", 404);
  }

  if (String(current.status || "").toUpperCase() === "CANCELED") {
    throw new AppError("Cannot mark a canceled order as paid", 400);
  }

  const paid = await markOrderPaid(req.params.id, {
    transactionCode: `ADMIN-PAID-${current.id}-${Date.now()}`,
    note: "Manually marked paid by staff/admin"
  });

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

  if (String(order.payment_method || "").toUpperCase() !== "VNPAY") {
    throw new AppError("Order payment method must be VNPAY", 400);
  }

  if (String(order.status || "").toUpperCase() === "CANCELED") {
    throw new AppError("Cannot pay for a canceled order", 400);
  }

  if (String(order.payment_status || "").toUpperCase() === "PAID") {
    throw new AppError("Order already paid", 400);
  }

  const tmnCode = env.vnpayTmnCode || process.env?.VNPAY_TMN_CODE;
  const hashSecret = env.vnpayHashSecret || process.env?.VNPAY_HASH_SECRET;
  const frontendUrl = env.frontendUrl || process.env.FRONTEND_URL || "http://localhost:5173";
  const shouldUseMockPayment = (await isMockPaymentEnabled()) || !tmnCode || !hashSecret;

  if (shouldUseMockPayment) {
    const payAmount = Number(order.final_amount || order.total_amount || 0);
    const mockUrl = `${frontendUrl}/payment/mock?orderId=${order.id}&amount=${payAmount}`;
    await syncGatewayPaymentOnRedirect(order, {
      redirectUrl: mockUrl,
      provider: "VNPAY_SANDBOX_MOCK",
      note: "Mock VNPay URL generated"
    });
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
    `Thanh toan don hang ${order.id}`
  );

  await syncGatewayPaymentOnRedirect(order, {
    redirectUrl: url,
    provider: "VNPAY_SANDBOX",
    note: "VNPay sandbox URL generated"
  });

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

  if (String(order.status || "").toUpperCase() === "CANCELED") {
    throw new AppError("Cannot pay for a canceled order", 400);
  }

  if (String(order.payment_status || "").toUpperCase() === "PAID") {
    throw new AppError("Order already paid", 400);
  }

  const amount = Number(order.final_amount || order.total_amount || 0);
  const orderInfo = `Thanh toan don hang PC Mall #${order.id}`;

  try {
    const { payUrl, requestId } = await generateMomoUrl(String(order.id), amount, orderInfo);
    await syncGatewayPaymentOnRedirect(order, {
      redirectUrl: payUrl,
      provider: "MOMO_SANDBOX",
      note: "MoMo sandbox URL generated"
    });
    res.status(200).json({
      success: true,
      data: { paymentUrl: payUrl, requestId, provider: "MOMO" }
    });
  } catch (error) {
    // Fallback to Mock Payment Mode if MoMo sandbox is unreachable
    const frontendUrl = env.frontendUrl || process.env.FRONTEND_URL || "http://localhost:5173";
    const mockUrl = `${frontendUrl}/payment/mock?orderId=${order.id}&amount=${amount}&provider=MOMO`;
    await syncGatewayPaymentOnRedirect(order, {
      redirectUrl: mockUrl,
      provider: "MOMO_SANDBOX_MOCK",
      note: "Mock MoMo URL generated"
    });
    res.status(200).json({
      success: true,
      data: { paymentUrl: mockUrl, isMock: true, provider: "MOMO" }
    });
  }
});

export const confirmMockPayment = asyncHandler(async (req: Request, res: Response) => {
  await assertMockPaymentAllowed();

  const order = await getOrderById(req.params.id);
  if (!order || order.user_id !== Number(req.user?.userId)) {
    throw new AppError("Order not found", 404);
  }

  if (String(order.status || "").toUpperCase() !== "PENDING") {
    throw new AppError("Order is not pending", 400);
  }

  if (String(order.payment_status || "").toUpperCase() === "PAID") {
    throw new AppError("Order already paid", 400);
  }

  await markOrderPaid(req.params.id, {
    transactionCode: `MOCKTXN-${order.id}-${Date.now()}`,
    provider: "VNPAY_SANDBOX_MOCK",
    note: "Mock payment confirmed"
  });

  if (order.user_id) {
    publishOrderEvent(order.user_id, {
      orderId: order.id,
      status: "PROCESSING",
      paymentStatus: "PAID"
    });
  }

  sendOrderStatusNotification({
    userId: Number(order.user_id),
    orderId: order.id,
    status: "PROCESSING",
    paymentMethod: order.payment_method,
    paymentStatus: "PAID"
  }).catch(() => {});

  res.status(200).json({
    success: true,
    message: "Payment confirmed (mock)",
    data: { orderId: req.params.id }
  });
});

export const cancelMockPayment = asyncHandler(async (req: Request, res: Response) => {
  await assertMockPaymentAllowed();

  const order = await getOrderById(req.params.id);
  if (!order || order.user_id !== Number(req.user?.userId)) {
    throw new AppError("Order not found", 404);
  }

  if (String(order.status || "").toUpperCase() !== "PENDING") {
    throw new AppError("Order is not pending", 400);
  }

  if (String(order.payment_status || "").toUpperCase() === "PAID") {
    throw new AppError("Order already paid", 400);
  }

  await markOrderPaymentCancelled(req.params.id, "Cancelled by user on mock payment page");
  if (order.user_id) {
    publishOrderEvent(order.user_id, {
      orderId: order.id,
      status: order.status,
      paymentStatus: "PAYMENT_CANCELLED"
    });
    sendOrderStatusNotification({
      userId: Number(order.user_id),
      orderId: order.id,
      status: "PENDING",
      paymentMethod: order.payment_method,
      paymentStatus: "PAYMENT_CANCELLED",
      reason: "Bạn đã hủy giao dịch thanh toán"
    }).catch(() => {});
  }

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

  if (String(order.status || "").toUpperCase() === "CANCELED") {
    throw new AppError("Cannot upload payment proof for a canceled order", 400);
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

  if (String(order.status || "").toUpperCase() === "CANCELED") {
    throw new AppError("Cannot approve or reject payment for a canceled order", 400);
  }

  const approved = Boolean(req.body?.approved);
  const currentOrderStatus = String(order.status || "").toUpperCase();
  const currentPaymentStatus = String(order.payment_status || "").toUpperCase();
  if (!approved && (currentPaymentStatus === "PAID" || ["SHIPPED", "DELIVERED", "COMPLETED"].includes(currentOrderStatus))) {
    throw new AppError("Không thể từ chối chứng từ của đơn hàng đã thanh toán hoặc đã giao hàng", 409);
  }
  const rejectionReason = String(
    req.body?.reason || req.body?.rejectionReason || "Ảnh hóa đơn không hợp lệ hoặc không rõ ràng."
  ).trim();

  await updateOrderPaymentProofDecision(req.params.id, approved, {
    reason: approved ? null : rejectionReason
  });

  await recordAuditLog({
    actorUserId: req.user?.userId,
    actorRole: req.user?.role,
    action: approved ? "PAYMENT_PROOF_APPROVED" : "PAYMENT_PROOF_REJECTED",
    entityType: "ORDER",
    entityId: req.params.id,
    description: approved
      ? `Approved payment proof for order #${req.params.id}`
      : `Rejected payment proof for order #${req.params.id}`,
    metadata: {
      approved,
      reason: approved ? null : rejectionReason
    }
  });

  const updatedOrder = await getOrderById(req.params.id);
  if (updatedOrder?.user_id) {
    publishOrderEvent(updatedOrder.user_id, {
      orderId: updatedOrder.id,
      status: updatedOrder.status,
      paymentStatus: updatedOrder.payment_status
    });
    sendOrderStatusNotification({
      userId: Number(updatedOrder.user_id),
      orderId: updatedOrder.id,
      status: approved ? "PROCESSING" : "PENDING",
      paymentMethod: "BANK_TRANSFER",
      paymentStatus: approved ? "PAID" : "REJECTED",
      reason: !approved ? rejectionReason : undefined
    }).catch((err: Error) => console.warn("[Notification] Payment approval notification failed:", err.message));
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
        rejectionReason: !approved ? rejectionReason : undefined,
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

function getVnpayFailureReason(responseCode: string): string {
  const map: Record<string, string> = {
    "07": "Giao dịch bị nghi ngờ gian lận",
    "09": "Thẻ/Tài khoản chưa đăng ký dịch vụ InternetBanking",
    "10": "Xác thực thông tin thẻ/tài khoản quá 3 lần",
    "11": "Đã hết hạn chờ thanh toán",
    "12": "Thẻ/Tài khoản bị khóa",
    "13": "Sai mật khẩu xác thực OTP",
    "24": "Bạn đã hủy giao dịch",
    "51": "Tài khoản không đủ số dư",
    "65": "Tài khoản vượt quá hạn mức giao dịch trong ngày",
    "75": "Ngân hàng thanh toán đang bảo trì",
    "79": "Nhập sai mật khẩu thanh toán quá số lần quy định"
  };
  return map[responseCode] || (responseCode ? `Mã lỗi VNPay ${responseCode}` : "Giao dịch không thành công");
}

async function processVnpayCallback(vnp_Params: Record<string, any>) {
  const isSecure = verifyVnpayReturn(vnp_Params);
  const rawOrderId = String(vnp_Params["vnp_TxnRef"] || "").trim();

  if (!isSecure) {
    return {
      ok: false,
      rspCode: "97",
      rspMessage: "Invalid checksum",
      reason: "invalid_signature",
      orderId: rawOrderId
    };
  }

  const parsedOrderId = parseInt(rawOrderId, 10);
  if (!Number.isInteger(parsedOrderId) || parsedOrderId <= 0) {
    return {
      ok: false,
      rspCode: "01",
      rspMessage: "Order not found",
      reason: "order_not_found",
      orderId: rawOrderId
    };
  }

  const order = await getOrderById(parsedOrderId);
  if (!order) {
    return {
      ok: false,
      rspCode: "01",
      rspMessage: "Order not found",
      reason: "order_not_found",
      orderId: rawOrderId
    };
  }

  const vnpAmountRaw = Number(vnp_Params["vnp_Amount"]);
  const vnpAmountVnd = Math.round(vnpAmountRaw / 100);
  const expectedAmountVnd = Math.round(Number(order.final_amount ?? order.total_amount ?? 0));
  if (!Number.isFinite(vnpAmountRaw) || vnpAmountVnd !== expectedAmountVnd) {
    return {
      ok: false,
      rspCode: "04",
      rspMessage: "Invalid amount",
      reason: "invalid_amount",
      orderId: String(order.id)
    };
  }

  const normalizedOrderStatus = String(order.status || "").toUpperCase();
  const normalizedPaymentStatus = String(order.payment_status || "").toUpperCase();
  if (normalizedOrderStatus === "CANCELED" || normalizedPaymentStatus === "EXPIRED") {
    return {
      ok: false,
      rspCode: "02",
      rspMessage: "Order already canceled or expired",
      reason: "order_canceled",
      orderId: String(order.id)
    };
  }

  const responseCode = String(vnp_Params["vnp_ResponseCode"] || "").trim();
  const vnpTxnNo = String(vnp_Params["vnp_TransactionNo"] || "").trim();

  if (responseCode === "00") {
    if (normalizedPaymentStatus === "PAID") {
      return {
        ok: true,
        alreadyPaid: true,
        rspCode: "00",
        rspMessage: "Confirm Success (Already Paid)",
        reason: "",
        orderId: String(order.id)
      };
    }

    await markOrderPaid(order.id, {
      transactionCode: vnpTxnNo || `VNPAY-${order.id}-${Date.now()}`,
      provider: "VNPAY_SANDBOX",
      note: "Confirmed via VNPay"
    });

    const updatedOrder = await getOrderById(order.id);
    if (updatedOrder?.user_id) {
      publishOrderEvent(updatedOrder.user_id, {
        orderId: updatedOrder.id,
        status: updatedOrder.status,
        paymentStatus: updatedOrder.payment_status
      });
      sendOrderStatusNotification({
        userId: Number(updatedOrder.user_id),
        orderId: updatedOrder.id,
        status: "PROCESSING",
        paymentMethod: "VNPAY",
        paymentStatus: "PAID"
      }).catch((err: Error) => console.warn("[Notification] VNPay payment notification failed:", err.message));

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
        console.warn("[VNPay Callback Email Error]", (e as Error).message);
      }
    }

    return {
      ok: true,
      alreadyPaid: false,
      rspCode: "00",
      rspMessage: "Confirm Success",
      reason: "",
      orderId: String(order.id)
    };
  }

  if (normalizedPaymentStatus !== "PAID") {
    await markOrderPaymentFailed(order.id, {
      transactionCode: vnpTxnNo || null,
      provider: "VNPAY_SANDBOX",
      note: `VNPay failed with code ${responseCode || "UNKNOWN"}`
    });
    if (order.user_id) {
      publishOrderEvent(order.user_id, {
        orderId: order.id,
        status: order.status,
        paymentStatus: "FAILED"
      });
      if (normalizedPaymentStatus !== "FAILED") {
        sendOrderStatusNotification({
          userId: Number(order.user_id),
          orderId: order.id,
          status: "PENDING",
          paymentMethod: "VNPAY",
          paymentStatus: "FAILED",
          reason: getVnpayFailureReason(responseCode)
        }).catch((err: Error) => console.warn("[Notification] VNPay failure notification failed:", err.message));
      }
    }
  }

  return {
    ok: false,
    rspCode: "00",
    rspMessage: "Confirm Success",
    reason: `vnpay_${responseCode || "failed"}`,
    orderId: String(order.id)
  };
}

export const vnpayReturn = asyncHandler(async (req: Request, res: Response) => {
  const result = await processVnpayCallback(req.query as Record<string, any>);
  const frontendBase = (env.frontendUrl || process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");

  if (result.ok) {
    res.redirect(`${frontendBase}/payment/result?success=true&orderId=${encodeURIComponent(result.orderId)}`);
    return;
  }

  const params = new URLSearchParams({ success: "false" });
  if (result.orderId) {
    params.set("orderId", result.orderId);
  }
  if (result.reason) {
    params.set("reason", result.reason);
  }
  res.redirect(`${frontendBase}/payment/result?${params.toString()}`);
});

export const vnpayIpn = asyncHandler(async (req: Request, res: Response) => {
  const result = await processVnpayCallback(req.query as Record<string, any>);
  if (!result.ok && result.rspCode !== "00") {
    console.error(`[VNPay IPN] Rejected (${result.rspCode} - ${result.rspMessage}) for order:`, result.orderId);
  } else {
    console.log(`[VNPay IPN] Processed (${result.rspCode} - ${result.rspMessage}) for order:`, result.orderId);
  }
  res.status(200).json({ RspCode: result.rspCode, Message: result.rspMessage });
});

export const momoIpn = asyncHandler(async (req: Request, res: Response) => {
  if (!isMomoConfigured()) {
    res.status(503).json({ message: "MoMo payment gateway is not configured", resultCode: 99 });
    return;
  }

  const payload = req.body && Object.keys(req.body).length > 0 ? req.body : req.query;
  const isSecure = verifyMomoSignature(payload);

  if (!isSecure) {
    console.error("[MoMo IPN] Signature verification failed");
    res.status(400).json({ message: "Invalid MoMo signature", resultCode: 97 });
    return;
  }

  const { orderId, resultCode, transId, amount } = payload;
  const numericOrderId = Number(orderId);
  if (!Number.isInteger(numericOrderId) || numericOrderId <= 0) {
    res.status(400).json({ message: "Invalid orderId", resultCode: 1 });
    return;
  }
  console.log(`[MoMo IPN] Order: ${numericOrderId}, ResultCode: ${resultCode}, TransId: ${transId}`);

  if (Number(resultCode) === 0) {
    const checkOutcome = await prisma.$transaction(async (tx: any) => {
      const rows = (await tx.$queryRawUnsafe(
        `SELECT id, status, payment_status, payment_method, final_amount, total_amount FROM orders WHERE id = ? FOR UPDATE`,
        numericOrderId
      )) as Array<{
        id: number;
        status: string;
        payment_status: string;
        payment_method: string;
        final_amount: number | string;
        total_amount: number | string;
      }>;
      const lockedOrder = rows[0];
      if (!lockedOrder) return { state: "NOT_FOUND" as const };
      if (String(lockedOrder.payment_method || "").toUpperCase() !== "MOMO") {
        return { state: "WRONG_METHOD" as const };
      }
      if (String(lockedOrder.status || "").toUpperCase() === "CANCELED") {
        return { state: "CANCELED" as const };
      }
      const expectedAmount = Math.round(Number(lockedOrder.final_amount || lockedOrder.total_amount || 0));
      const paidAmount = Math.round(Number(amount || 0));
      if (!Number.isFinite(paidAmount) || paidAmount !== expectedAmount) {
        return { state: "AMOUNT_MISMATCH" as const };
      }
      if (String(lockedOrder.payment_status || "").toUpperCase() === "PAID") {
        return { state: "ALREADY_PAID" as const };
      }
      return { state: "READY" as const };
    });

    if (checkOutcome.state === "NOT_FOUND") {
      res.status(404).json({ message: "Order not found", resultCode: 1 });
      return;
    }
    if (checkOutcome.state === "WRONG_METHOD") {
      res.status(400).json({ message: "Order payment method is not MOMO", resultCode: 2 });
      return;
    }
    if (checkOutcome.state === "CANCELED") {
      res.status(409).json({ message: "Order is canceled", resultCode: 3 });
      return;
    }
    if (checkOutcome.state === "AMOUNT_MISMATCH") {
      res.status(400).json({ message: "Invalid payment amount", resultCode: 4 });
      return;
    }
    if (checkOutcome.state === "ALREADY_PAID") {
      res.status(200).json({ message: "Already paid", resultCode: 0 });
      return;
    }

    await markOrderPaid(numericOrderId, {
      transactionCode: transId ? String(transId) : undefined,
      provider: "MOMO_SANDBOX",
      note: "Confirmed via MoMo IPN"
    });
    const updatedOrder = await getOrderById(numericOrderId);
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

  const numericOrderId = Number(req.params.id);
  if (!Number.isInteger(numericOrderId) || numericOrderId <= 0) {
    throw new AppError("Invalid order id", 400);
  }
  const userId = req.user.userId;

  const result = await prisma.$transaction(async (tx: any) => {
    // Serialize concurrent cancellation attempts with FOR UPDATE row lock
    const lockedRows = (await tx.$queryRawUnsafe(
      `SELECT id, user_id, status, coupon_id, payment_status FROM orders WHERE id = ? FOR UPDATE`,
      numericOrderId
    )) as Array<{ id: number; user_id: number; status: string; coupon_id: number | null; payment_status: string | null }>;

    const order = lockedRows[0];
    if (!order) {
      throw new AppError("Order not found", 404);
    }

    if (Number(order.user_id) !== Number(userId)) {
      throw new AppError("Forbidden: You can only cancel your own orders", 403);
    }

    if (String(order.status || "").toUpperCase() !== "PENDING") {
      throw new AppError(`Cannot cancel order in ${order.status} status. Only PENDING orders can be canceled.`, 400);
    }

    // Update order status
    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELED", updated_at: new Date() }
    });

    const orderItems = await tx.orderItem.findMany({
      where: { order_id: order.id },
      select: { product_variant_id: true, quantity: true }
    });

    // Restore stock atomically once
    for (const item of orderItems) {
      const variantId = item.product_variant_id;
      const quantity = Number(item.quantity || 0);
      if (variantId && quantity > 0) {
        await tx.productSku.update({
          where: { id: variantId },
          data: {
            stock: {
              increment: quantity
            }
          }
        });
      }
    }

    await tx.shipment.updateMany({
      where: { order_id: order.id },
      data: { status: "CANCELED" }
    });

    if (order.coupon_id) {
      const deletedUsage = await tx.couponUsage.deleteMany({
        where: { order_id: order.id }
      });
      if (deletedUsage.count > 0) {
        await tx.$executeRawUnsafe(
          `UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE id = ?`,
          order.coupon_id
        );
      }
    }

    await tx.payment.updateMany({
      where: {
        order_id: order.id,
        status: { in: ["PENDING_GATEWAY", "UNPAID", "AWAITING_ADMIN_CONFIRMATION"] }
      },
      data: { status: "CANCELED", updated_at: new Date() }
    }).catch(() => {});

    return updatedOrder;
  });

  res.status(200).json({
    success: true,
    data: result,
    message: "Order canceled successfully"
  });

  publishOrderEvent(userId, {
    orderId: String(numericOrderId),
    status: "CANCELED",
    paymentStatus: result.payment_status
  });
  sendOrderStatusNotification({
    userId: Number(userId),
    orderId: numericOrderId,
    status: "CANCELED"
  }).catch(() => {});
});

export const cleanupExpiredOrders = asyncHandler(async (req: Request, res: Response) => {
  const timeoutMinutes = req.query.timeoutMinutes ? Number(req.query.timeoutMinutes) : undefined;
  const { processPaymentTimeouts } = await import("../../workers/payment-timeout.worker");
  const result = await processPaymentTimeouts(timeoutMinutes);
  res.status(200).json({
    success: true,
    message: "Expired orders cleanup completed",
    data: result
  });
});

