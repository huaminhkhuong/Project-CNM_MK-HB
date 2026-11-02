import { getDbPool } from "../../config/database";

export async function initCouponsTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coupons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      description VARCHAR(255) NULL,
      discount_type ENUM('PERCENT', 'FIXED') NOT NULL DEFAULT 'FIXED',
      discount_value DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      min_order_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      max_discount_amount DECIMAL(12, 2) NULL,
      usage_limit INT NULL DEFAULT NULL,
      used_count INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      expires_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    INSERT INTO coupons (code, description, discount_type, discount_value, min_order_amount, max_discount_amount, is_active)
    VALUES 
      ('PCMALL50K', 'Giảm 50.000đ cho đơn hàng từ 500.000đ', 'FIXED', 50000, 500000, 50000, 1),
      ('PCMALL10', 'Giảm 10% tối đa 500.000đ cho đơn hàng từ 2.000.000đ', 'PERCENT', 10, 2000000, 500000, 1),
      ('VIPBUILD', 'Giảm 1.000.000đ cho bộ máy PC từ 20.000.000đ', 'FIXED', 1000000, 20000000, 1000000, 1)
    ON DUPLICATE KEY UPDATE description = VALUES(description);
  `);
}

export async function validateCoupon(code: string, orderAmount: number) {
  const pool = getDbPool();
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalizedCode) {
    throw new Error("Mã giảm giá không hợp lệ");
  }

  const [rows]: any = await pool.query(
    `SELECT * FROM coupons WHERE code = ? AND is_active = 1 LIMIT 1`,
    [normalizedCode]
  );

  const coupon = rows[0];
  if (!coupon) {
    throw new Error("Mã giảm giá không tồn tại hoặc đã hết hạn");
  }

  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    throw new Error("Mã giảm giá đã hết thời gian sử dụng");
  }

  if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
    throw new Error("Mã giảm giá đã hết lượt sử dụng");
  }

  const minAmount = Number(coupon.min_order_amount || 0);
  if (orderAmount < minAmount) {
    throw new Error(`Đơn hàng tối thiểu phải từ ${minAmount.toLocaleString("vi-VN")}đ để áp dụng mã này`);
  }

  let discountAmount = 0;
  if (coupon.discount_type === "PERCENT") {
    discountAmount = Math.round((orderAmount * Number(coupon.discount_value)) / 100);
    if (coupon.max_discount_amount && discountAmount > Number(coupon.max_discount_amount)) {
      discountAmount = Number(coupon.max_discount_amount);
    }
  } else {
    discountAmount = Number(coupon.discount_value);
  }

  return {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description,
    discountType: coupon.discount_type,
    discountValue: Number(coupon.discount_value),
    discountAmount: Math.min(discountAmount, orderAmount),
    finalAmount: Math.max(0, orderAmount - discountAmount)
  };
}

export async function getActiveCoupons() {
  const pool = getDbPool();
  const [rows]: any = await pool.query(
    `SELECT id, code, description, discount_type as discountType, discount_value as discountValue, min_order_amount as minOrderAmount, max_discount_amount as maxDiscountAmount, expires_at as expiresAt FROM coupons WHERE is_active = 1 ORDER BY min_order_amount ASC`
  );
  return rows;
}
