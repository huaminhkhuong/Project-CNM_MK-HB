import { NextFunction, Request, Response, Router } from "express";
import fs from "fs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";

import { env } from "../../config/env";
import { AppError } from "../../errors/app-error";
import { authenticate, authorize, optionalAuthenticate, ROLES } from "../../middlewares/auth.middleware";
import {
  activateWarranty,
  getAdminWarrantyRequests,
  getEligibleWarrantyItems,
  getMyWarrantyNotifications,
  getMyWarrantyRequests,
  getMyWarranties,
  lookupWarranty,
  submitWarrantyRequest,
  updateAdminWarrantyRequest
} from "./warranties.controller";

export const warrantiesRouter = Router();

const ALLOWED_WARRANTY_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "application/pdf": ".pdf"
};

const warrantyMediaStorage = multer.diskStorage({
  destination: (_req: Request, _file: { originalname: string }, cb: (error: Error | null, destination: string) => void) => {
    const uploadsDir = path.join(__dirname, "../../../uploads/warranty-requests");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (_req: Request, file: { mimetype?: string; originalname: string }, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeExt = ALLOWED_WARRANTY_MIME_TO_EXT[String(file.mimetype || "").toLowerCase()] || ".bin";
    cb(null, `warranty-${uniqueSuffix}${safeExt}`);
  }
});

const uploadWarrantyMediaFile = multer({
  storage: warrantyMediaStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req: Request, file: { mimetype: string }, cb: (error: Error | null, acceptFile?: boolean) => void) => {
    const mime = String(file.mimetype || "").toLowerCase();
    if (Object.prototype.hasOwnProperty.call(ALLOWED_WARRANTY_MIME_TO_EXT, mime)) {
      cb(null, true);
      return;
    }
    cb(new AppError("Chỉ chấp nhận ảnh (JPG/PNG/GIF/WEBP), video (MP4/WEBM/MOV) hoặc PDF minh chứng", 400));
  }
});

const uploadWarrantyMediaMiddleware = uploadWarrantyMediaFile.array("media", 5);
const memoryRateLimits = new Map<string, number[]>();

function getClientKey(req: Request) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)[0];
  return forwarded || req.ip || req.socket.remoteAddress || "unknown";
}

function createGuestRateLimit(prefix: string, max: number, windowMs: number) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.userId) {
      next();
      return;
    }

    const key = `${prefix}:${getClientKey(req)}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    const hits = (memoryRateLimits.get(key) || []).filter((timestamp) => timestamp > windowStart);

    if (hits.length >= max) {
      next(new AppError("Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.", 429));
      return;
    }

    hits.push(now);
    memoryRateLimits.set(key, hits);
    next();
  };
}

function cleanupUploadedWarrantyFiles(req: Request) {
  const files = (req as any).files;
  if (!Array.isArray(files)) return;
  for (const file of files) {
    if (file?.path) {
      fs.unlink(file.path, () => {});
    }
  }
}

function basicAntiSpam(req: Request, _res: Response, next: NextFunction) {
  const honeypot = String(req.body?.website || "").trim();
  if (honeypot) {
    cleanupUploadedWarrantyFiles(req);
    next(new AppError("Không thể xử lý yêu cầu này", 400));
    return;
  }

  const startedAt = Number(req.body?.startedAt || 0);
  if (startedAt && Date.now() - startedAt < 1500) {
    cleanupUploadedWarrantyFiles(req);
    next(new AppError("Biểu mẫu được gửi quá nhanh. Vui lòng thử lại.", 400));
    return;
  }

  next();
}

function handleWarrantyUpload(req: Request, res: Response, next: NextFunction) {
  uploadWarrantyMediaMiddleware(req, res, (error: any) => {
    if (!error) {
      next();
      return;
    }
    if (error?.code === "LIMIT_FILE_SIZE") {
      next(new AppError("Mỗi tệp minh chứng phải nhỏ hơn hoặc bằng 10MB", 400));
      return;
    }
    next(error);
  });
}

warrantiesRouter.get("/lookup/:code", optionalAuthenticate, createGuestRateLimit("guest-warranty-lookup", 20, 60 * 1000), lookupWarranty);
warrantiesRouter.get("/lookup", optionalAuthenticate, createGuestRateLimit("guest-warranty-lookup", 20, 60 * 1000), lookupWarranty);
warrantiesRouter.post(
  "/request",
  optionalAuthenticate,
  createGuestRateLimit("guest-warranty-request", 5, 15 * 60 * 1000),
  handleWarrantyUpload,
  basicAntiSpam,
  submitWarrantyRequest
);

warrantiesRouter.use(authenticate);
warrantiesRouter.get("/eligible", getEligibleWarrantyItems);
warrantiesRouter.get("/my", getMyWarranties);
warrantiesRouter.get("/requests/my", getMyWarrantyRequests);
warrantiesRouter.get("/notifications/my", getMyWarrantyNotifications);
warrantiesRouter.post("/activate", activateWarranty);
warrantiesRouter.get("/admin/requests", authorize([ROLES.ADMIN, ROLES.TECH_STAFF, ROLES.SALES_STAFF]), getAdminWarrantyRequests);
warrantiesRouter.patch(
  "/admin/requests/:requestId",
  authorize([ROLES.ADMIN, ROLES.TECH_STAFF]),
  handleWarrantyUpload,
  updateAdminWarrantyRequest
);
