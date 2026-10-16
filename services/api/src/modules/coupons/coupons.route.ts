import { Request, Response, Router } from "express";
import { initCouponsTable, validateCoupon, getActiveCoupons } from "./coupons.service";

export const couponsRouter = Router();

// Auto initialize coupons table on load (skip in test environment)
if (process.env.NODE_ENV !== "test") {
  initCouponsTable().catch(err => console.warn("[Coupons] Init warning:", err.message));
}

couponsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const coupons = await getActiveCoupons();
    return res.json({ success: true, data: coupons });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Lỗi lấy danh sách mã giảm giá" });
  }
});

couponsRouter.post("/validate", async (req: Request, res: Response) => {
  try {
    const { code, orderAmount } = req.body || {};
    const result = await validateCoupon(String(code || ""), Number(orderAmount || 0));
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Mã giảm giá không hợp lệ" });
  }
});
