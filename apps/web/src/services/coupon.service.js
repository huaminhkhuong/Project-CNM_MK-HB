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
