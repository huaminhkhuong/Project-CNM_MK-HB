import { prisma } from "../../config/prisma";
import { AppError } from "../../errors/app-error";

export interface CartItemLike {
  productId?: number | null;
  product_id?: number | null;
  categoryId?: number | null;
  category_id?: number | null;
  unitPrice: number;
  quantity: number;
  lineTotal?: number;
}

export interface CouponValidationResult {
  valid: boolean;
  message?: string;
  coupon?: {
    id: number;
    code: string;
    name: string;
    description: string | null;
    discountType: string;
    discountValue: number;
    maxDiscountAmount: number | null;
    minOrderValue: number;
    targetType: string;
    targetIds: number[] | null;
    endDate: Date;
  };
  discountAmount: number;
  eligibleAmount: number;
  finalAmount?: number;
}

/**
 * Lấy danh sách các mã giảm giá đang hoạt động và còn hạn sử dụng
 */
export async function listAvailableCoupons(userId?: number | null) {
  const now = new Date();

  const coupons = await prisma.coupon.findMany({
    where: {
      is_active: true,
      start_date: { lte: now },
      end_date: { gte: now }
    },
    orderBy: {
      discount_value: "desc"
    }
  });

  const availableCoupons = [];

  for (const coupon of coupons) {
    // Kiểm tra giới hạn lượt dùng toàn sàn
    if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
      continue;
    }

    let userUsedCount = 0;
    if (userId) {
      userUsedCount = await prisma.couponUsage.count({
        where: {
          coupon_id: coupon.id,
          user_id: Number(userId)
        }
      });

      if (coupon.usage_limit_per_user !== null && userUsedCount >= coupon.usage_limit_per_user) {
        continue;
      }
    }

    let targetIds: number[] | null = null;
    if (coupon.target_ids) {
      try {
        targetIds = JSON.parse(coupon.target_ids);
      } catch {
        targetIds = null;
      }
    }

    availableCoupons.push({
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      description: coupon.description,
      discountType: coupon.discount_type,
      discountValue: Number(coupon.discount_value),
      maxDiscountAmount: coupon.max_discount_amount ? Number(coupon.max_discount_amount) : null,
      minOrderValue: Number(coupon.min_order_value || 0),
      targetType: coupon.target_type,
      targetIds,
      usageLimit: coupon.usage_limit,
      usedCount: coupon.used_count,
      usageLimitPerUser: coupon.usage_limit_per_user,
      userRemainingUses: coupon.usage_limit_per_user ? Math.max(0, coupon.usage_limit_per_user - userUsedCount) : null,
      startDate: coupon.start_date,
      endDate: coupon.end_date
    });
  }

  return availableCoupons;
}

/**
 * Kiểm tra tính hợp lệ và tính toán số tiền giảm giá của Coupon
 */
export async function validateAndCalculateCoupon(params: {
  code: string;
  userId?: number | null;
  items: CartItemLike[];
  totalAmount?: number;
  shippingFee?: number;
}): Promise<CouponValidationResult> {
  const { code, userId, items } = params;
  const cleanCode = String(code || "").trim().toUpperCase();

  if (!cleanCode) {
    throw new AppError("Mã giảm giá không được để trống", 400);
  }

  const coupon = await prisma.coupon.findUnique({
    where: { code: cleanCode }
  });

  if (!coupon || !coupon.is_active) {
    throw new AppError("Mã giảm giá không tồn tại hoặc đã ngừng hoạt động", 404);
  }

  const now = new Date();
  if (coupon.start_date > now) {
    throw new AppError("Chương trình khuyến mãi của mã giảm giá này chưa bắt đầu", 400);
  }
  if (coupon.end_date < now) {
    throw new AppError("Mã giảm giá đã hết hạn sử dụng", 400);
  }

  // Giới hạn lượt dùng toàn hệ thống
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
    throw new AppError("Mã giảm giá đã hết lượt sử dụng", 400);
  }

  // Giới hạn lượt dùng của từng người dùng
  if (userId && coupon.usage_limit_per_user !== null) {
    const userUsedCount = await prisma.couponUsage.count({
      where: {
        coupon_id: coupon.id,
        user_id: Number(userId)
      }
    });

    if (userUsedCount >= coupon.usage_limit_per_user) {
      throw new AppError(
        `Bạn đã sử dụng tối đa ${coupon.usage_limit_per_user} lần cho mã giảm giá này`,
        400
      );
    }
  }

  // Tính tổng tiền đơn hàng nếu chưa truyền vào
  const subtotal = params.totalAmount !== undefined
    ? Number(params.totalAmount)
    : items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 1), 0);

  let targetIds: number[] = [];
  if (coupon.target_ids) {
    try {
      targetIds = JSON.parse(coupon.target_ids);
    } catch {
      targetIds = [];
    }
  }

  // Xác định phạm vi áp dụng (tổng đơn / danh mục linh kiện / sản phẩm cụ thể)
  let eligibleAmount = 0;

  if (coupon.target_type === "ALL") {
    eligibleAmount = subtotal;
  } else if (coupon.target_type === "CATEGORY") {
    // Lọc các linh kiện thuộc danh mục chỉ định
    const eligibleItems = items.filter((item) => {
      const catId = item.categoryId ?? item.category_id;
      return catId !== null && catId !== undefined && targetIds.includes(Number(catId));
    });

    if (eligibleItems.length === 0) {
      throw new AppError(
        `Mã giảm giá chỉ áp dụng cho nhóm linh kiện chuyên biệt (Danh mục ID: ${targetIds.join(", ")})`,
        400
      );
    }

    eligibleAmount = eligibleItems.reduce(
      (sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 1),
      0
    );
  } else if (coupon.target_type === "PRODUCT") {
    // Lọc sản phẩm cụ thể
    const eligibleItems = items.filter((item) => {
      const prodId = item.productId ?? item.product_id;
      return prodId !== null && prodId !== undefined && targetIds.includes(Number(prodId));
    });

    if (eligibleItems.length === 0) {
      throw new AppError("Mã giảm giá chỉ áp dụng cho một số sản phẩm linh kiện được chỉ định", 400);
    }

    eligibleAmount = eligibleItems.reduce(
      (sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 1),
      0
    );
  }

  const minOrderValue = Number(coupon.min_order_value || 0);
  if (eligibleAmount < minOrderValue) {
    const formattedMin = minOrderValue.toLocaleString("vi-VN");
    throw new AppError(
      `Đơn hàng chưa đạt giá trị tối thiểu ${formattedMin} đ để áp dụng mã này (hiện tại: ${eligibleAmount.toLocaleString("vi-VN")} đ)`,
      400
    );
  }

  // Tính số tiền giảm giá
  let discountAmount = 0;
  const discountVal = Number(coupon.discount_value);

  if (coupon.discount_type === "FIXED_AMOUNT") {
    discountAmount = Math.min(discountVal, eligibleAmount);
  } else if (coupon.discount_type === "PERCENTAGE") {
    const rawDiscount = (eligibleAmount * discountVal) / 100;
    if (coupon.max_discount_amount) {
      discountAmount = Math.min(rawDiscount, Number(coupon.max_discount_amount));
    } else {
      discountAmount = rawDiscount;
    }
  }

  discountAmount = Math.round(discountAmount);
  const shippingFee = Number(params.shippingFee || 0);
  const finalAmount = Math.max(0, subtotal - discountAmount + shippingFee);

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      description: coupon.description,
      discountType: coupon.discount_type,
      discountValue: discountVal,
      maxDiscountAmount: coupon.max_discount_amount ? Number(coupon.max_discount_amount) : null,
      minOrderValue,
      targetType: coupon.target_type,
      targetIds,
      endDate: coupon.end_date
    },
    discountAmount,
    eligibleAmount,
    finalAmount
  };
}
