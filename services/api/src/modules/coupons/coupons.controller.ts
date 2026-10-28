import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { AppError } from "../../errors/app-error";
import { prisma } from "../../config/prisma";
import {
  listAvailableCoupons,
  validateAndCalculateCoupon,
  CartItemLike
} from "./coupons.service";

/**
 * GET /api/coupons
 * Danh sách voucher khả dụng cho người dùng hiện tại
 */
export const getAvailableCoupons = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId ? Number(req.user.userId) : null;
  const coupons = await listAvailableCoupons(userId);

  res.status(200).json({
    success: true,
    data: coupons
  });
});

/**
 * POST /api/coupons/validate
 * Kiểm tra tính hợp lệ của mã giảm giá với giỏ hàng hiện tại
 */
export const validateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { code, items, totalAmount, shippingFee } = req.body || {};
  const userId = req.user?.userId ? Number(req.user.userId) : null;

  if (!code) {
    throw new AppError("Vui lòng cung cấp mã giảm giá cần kiểm tra", 400);
  }

  let cartItems: CartItemLike[] = [];

  if (Array.isArray(items) && items.length > 0) {
    cartItems = items.map((item: any) => ({
      productId: Number(item.productId || item.product_id || item.product?.id || 0),
      categoryId: Number(item.categoryId || item.category_id || item.product?.category_id || item.product?.categoryId || 0),
      unitPrice: Number(item.unitPrice || item.price || 0),
      quantity: Number(item.quantity || 1),
      lineTotal: Number(item.lineTotal || (item.unitPrice || item.price || 0) * (item.quantity || 1))
    }));
  } else if (userId) {
    // Tự động load cart của user nếu client không gửi danh sách items
    const cart = await prisma.cart.findFirst({
      where: { user_id: Number(userId) },
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

    if (cart?.CartItem) {
      cartItems = cart.CartItem.map((ci: any) => ({
        productId: ci.ProductSku?.product_id,
        categoryId: ci.ProductSku?.Product?.category_id,
        unitPrice: Number(ci.ProductSku?.price || 0),
        quantity: ci.quantity,
        lineTotal: Number(ci.ProductSku?.price || 0) * ci.quantity
      }));
    }
  }

  const result = await validateAndCalculateCoupon({
    code: String(code),
    userId: userId ? Number(userId) : null,
    items: cartItems,
    totalAmount: totalAmount !== undefined ? Number(totalAmount) : undefined,
    shippingFee: shippingFee !== undefined ? Number(shippingFee) : 0
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * GET /api/coupons/admin
 * Admin xem danh sách tất cả voucher (bao gồm cả mã hết hạn, ngừng kích hoạt)
 */
export const adminListCoupons = asyncHandler(async (_req: Request, res: Response) => {
  const coupons = await prisma.coupon.findMany({
    orderBy: { created_at: "desc" },
    include: {
      _count: {
        select: { CouponUsage: true }
      }
    }
  });

  res.status(200).json({
    success: true,
    data: coupons
  });
});

/**
 * POST /api/coupons/admin
 * Admin tạo voucher mới
 */
export const adminCreateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const {
    code,
    name,
    description,
    discount_type,
    discount_value,
    max_discount_amount,
    min_order_value,
    target_type,
    target_ids,
    usage_limit,
    usage_limit_per_user,
    start_date,
    end_date,
    is_active
  } = req.body || {};

  if (!code || !name || discount_value === undefined || !start_date || !end_date) {
    throw new AppError("Vui lòng điền đầy đủ các thông tin bắt buộc của Voucher", 400);
  }

  const cleanCode = String(code).trim().toUpperCase();

  const existing = await prisma.coupon.findUnique({
    where: { code: cleanCode }
  });
  if (existing) {
    throw new AppError(`Mã voucher '${cleanCode}' đã tồn tại trong hệ thống`, 409);
  }

  const newCoupon = await prisma.coupon.create({
    data: {
      code: cleanCode,
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      discount_type: discount_type === "PERCENTAGE" ? "PERCENTAGE" : "FIXED_AMOUNT",
      discount_value: Number(discount_value),
      max_discount_amount: max_discount_amount ? Number(max_discount_amount) : null,
      min_order_value: min_order_value ? Number(min_order_value) : 0,
      target_type: ["CATEGORY", "PRODUCT"].includes(target_type) ? target_type : "ALL",
      target_ids: target_ids ? (typeof target_ids === "string" ? target_ids : JSON.stringify(target_ids)) : null,
      usage_limit: usage_limit ? Number(usage_limit) : null,
      usage_limit_per_user: usage_limit_per_user ? Number(usage_limit_per_user) : 1,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      is_active: is_active !== undefined ? Boolean(is_active) : true
    }
  });

  res.status(201).json({
    success: true,
    message: "Tạo mã giảm giá thành công",
    data: newCoupon
  });
});

/**
 * PUT /api/coupons/admin/:id
 * Admin chỉnh sửa voucher
 */
export const adminUpdateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const couponId = Number(id);

  const existing = await prisma.coupon.findUnique({ where: { id: couponId } });
  if (!existing) {
    throw new AppError("Không tìm thấy mã giảm giá cần cập nhật", 404);
  }

  const payload = req.body || {};
  const updated = await prisma.coupon.update({
    where: { id: couponId },
    data: {
      ...(payload.name ? { name: String(payload.name).trim() } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.discount_type ? { discount_type: payload.discount_type } : {}),
      ...(payload.discount_value !== undefined ? { discount_value: Number(payload.discount_value) } : {}),
      ...(payload.max_discount_amount !== undefined ? { max_discount_amount: payload.max_discount_amount ? Number(payload.max_discount_amount) : null } : {}),
      ...(payload.min_order_value !== undefined ? { min_order_value: Number(payload.min_order_value) } : {}),
      ...(payload.target_type ? { target_type: payload.target_type } : {}),
      ...(payload.target_ids !== undefined ? { target_ids: typeof payload.target_ids === "string" ? payload.target_ids : JSON.stringify(payload.target_ids) } : {}),
      ...(payload.usage_limit !== undefined ? { usage_limit: payload.usage_limit ? Number(payload.usage_limit) : null } : {}),
      ...(payload.usage_limit_per_user !== undefined ? { usage_limit_per_user: Number(payload.usage_limit_per_user) } : {}),
      ...(payload.start_date ? { start_date: new Date(payload.start_date) } : {}),
      ...(payload.end_date ? { end_date: new Date(payload.end_date) } : {}),
      ...(payload.is_active !== undefined ? { is_active: Boolean(payload.is_active) } : {})
    }
  });

  res.status(200).json({
    success: true,
    message: "Cập nhật mã giảm giá thành công",
    data: updated
  });
});
