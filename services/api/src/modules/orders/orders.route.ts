import { NextFunction, Request, Response, Router } from "express";
import fs from "fs";
import multer from "multer";
import path from "path";

import { ROLES } from "../../constants/roles";
import { AppError } from "../../errors/app-error";
import { authenticate, authorize } from "../../middlewares/auth.middleware";
import {
  checkout,
  getAllOrders,
  getMyOrders,
  getOrderDetail,
  patchOrderStatus,
  payOrderMock,
  createVnpayUrl,
  createMomoUrl,
  vnpayReturn,
  vnpayIpn,
  momoIpn,
  cancelMyOrder,
  confirmMockPayment,
  cancelMockPayment,
  uploadPaymentProof,
  approvePaymentProof,
  confirmOrderReceived,
  streamOrderEvents,
  cleanupExpiredOrders
} from "./orders.controller";

export const ordersRouter = Router();

const paymentProofStorage = multer.diskStorage({
  destination: (_req: Request, _file: { originalname: string }, cb: (error: Error | null, destination: string) => void) => {
    const uploadsDir = path.join(__dirname, "../../../uploads/payment-proofs");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (_req: Request, file: { originalname: string }, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `paymentProof-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const uploadPaymentProofFile = multer({
  storage: paymentProofStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: Request, file: { mimetype: string }, cb: (error: Error | null, acceptFile?: boolean) => void) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new AppError("Only JPG, PNG, and GIF files are allowed", 400));
  }
});

const uploadPaymentProofMiddleware = uploadPaymentProofFile.single("paymentProof");

ordersRouter.get("/vnpay/return", vnpayReturn);
ordersRouter.get("/vnpay/ipn", vnpayIpn);
ordersRouter.post("/momo/ipn", momoIpn);
ordersRouter.get("/momo/ipn", momoIpn);
ordersRouter.get("/events", streamOrderEvents);

ordersRouter.use(authenticate);

ordersRouter.post("/checkout", checkout);
ordersRouter.get("/my", getMyOrders);
ordersRouter.get("/:id", getOrderDetail);
ordersRouter.post("/:id/vnpay-url", createVnpayUrl);
ordersRouter.post("/:id/momo-url", createMomoUrl);
ordersRouter.post("/:id/mock-pay", confirmMockPayment);
ordersRouter.post("/:id/mock-cancel", cancelMockPayment);
ordersRouter.post("/:id/payment-proof", (req: Request, res: Response, next: NextFunction) => {
  uploadPaymentProofMiddleware(req, res, (error: any) => {
    if (!error) {
      next();
      return;
    }
    if (error?.code === "LIMIT_FILE_SIZE") {
      next(new AppError("Payment proof image must be 5MB or smaller", 400));
      return;
    }
    next(error);
  });
}, uploadPaymentProof);
ordersRouter.post("/:id/confirm-received", confirmOrderReceived);
ordersRouter.post("/:id/cancel", cancelMyOrder);

ordersRouter.get("/", authorize([ROLES.ADMIN, ROLES.SALES]), getAllOrders);
ordersRouter.post("/cleanup-expired", authorize([ROLES.ADMIN, ROLES.SALES]), cleanupExpiredOrders);
ordersRouter.patch("/:id/status", authorize([ROLES.ADMIN, ROLES.SALES]), patchOrderStatus);
ordersRouter.patch("/:id/payment-proof/approve", authorize([ROLES.ADMIN, ROLES.SALES]), approvePaymentProof);
ordersRouter.post("/:id/pay", authorize([ROLES.ADMIN, ROLES.SALES]), payOrderMock);

