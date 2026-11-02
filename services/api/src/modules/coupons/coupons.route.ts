import { Router } from "express";
import { authenticate, optionalAuthenticate, authorize, ROLES } from "../../middlewares/auth.middleware";
import {
  getAvailableCoupons,
  validateCoupon,
  adminListCoupons,
  adminCreateCoupon,
  adminUpdateCoupon
} from "./coupons.controller";

export const couponsRouter = Router();

// Public / Customer routes (with optional authentication)
couponsRouter.get("/", optionalAuthenticate, getAvailableCoupons);
couponsRouter.post("/validate", optionalAuthenticate, validateCoupon);

// Admin routes
couponsRouter.get("/admin", authenticate, authorize([ROLES.ADMIN]), adminListCoupons);
couponsRouter.post("/admin", authenticate, authorize([ROLES.ADMIN]), adminCreateCoupon);
couponsRouter.put("/admin/:id", authenticate, authorize([ROLES.ADMIN]), adminUpdateCoupon);
