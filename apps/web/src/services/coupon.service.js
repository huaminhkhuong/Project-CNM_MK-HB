import { httpClient } from "./http";

/**
 * Lấy danh sách các voucher khả dụng
 */
export async function getAvailableCoupons() {
  const response = await httpClient.get("/coupons");
  return response.data;
}

/**
 * Kiểm tra tính hợp lệ và tính toán giảm giá của voucher
 */
export async function validateCoupon(payload) {
  const response = await httpClient.post("/coupons/validate", payload);
  return response.data;
}

/**
 * Admin: Lấy toàn bộ danh sách mã giảm giá
 */
export async function getAdminCoupons() {
  const response = await httpClient.get("/coupons/admin");
  return response.data;
}

/**
 * Admin: Tạo mã giảm giá mới
 */
export async function createAdminCoupon(payload) {
  const response = await httpClient.post("/coupons/admin", payload);
  return response.data;
}

/**
 * Admin: Cập nhật / bật tắt mã giảm giá
 */
export async function updateAdminCoupon(couponId, payload) {
  const response = await httpClient.put(`/coupons/admin/${couponId}`, payload);
  return response.data;
}
