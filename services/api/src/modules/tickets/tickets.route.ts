import fs from "fs";
import multer from "multer";
import path from "path";
import { NextFunction, Request, Response, Router } from "express";

import { AppError } from "../../errors/app-error";
import { authenticate, authorize } from "../../middlewares/auth.middleware";
import {
  getAllTickets,
  getMyTickets,
  getTicketDetail,
  getTicketStats,
  patchTicket,
  postTicketMessage,
  postMyTicket,
  ticketManageRoles,
  ticketReadRoles
} from "./tickets.controller";

export const ticketsRouter = Router();

ticketsRouter.use(authenticate);

const ticketUploadDir = path.resolve(__dirname, "../../../uploads/tickets");
fs.mkdirSync(ticketUploadDir, { recursive: true });

const ALLOWED_TICKET_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "application/pdf": ".pdf"
};

const ticketAttachmentUpload = multer({
  storage: multer.diskStorage({
    destination: (_req: Request, _file: any, cb: (error: Error | null, destination: string) => void) => cb(null, ticketUploadDir),
    filename: (_req: Request, file: any, cb: (error: Error | null, filename: string) => void) => {
      const safeName = String(file.originalname || "ticket-file")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120);
      const rawExt = path.extname(safeName) || "";
      const base = path.basename(safeName, rawExt) || "ticket-file";
      const safeExt = ALLOWED_TICKET_MIME_TO_EXT[String(file.mimetype || "").toLowerCase()] || ".bin";
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${base}${safeExt}`);
    }
  }),
  limits: {
    files: 5,
    fileSize: 20 * 1024 * 1024
  },
  fileFilter: (_req: Request, file: any, cb: (error: Error | null, acceptFile?: boolean) => void) => {
    const mime = String(file.mimetype || "").toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_TICKET_MIME_TO_EXT, mime)) {
      return cb(new AppError("Chỉ hỗ trợ định dạng JPG, PNG, GIF, MP4, WEBM, MOV hoặc PDF", 400));
    }
    return cb(null, true);
  }
});

const uploadTicketAttachmentsMiddleware = ticketAttachmentUpload.array("attachments", 5);

function handleTicketAttachmentUpload(req: Request, res: Response, next: NextFunction) {
  uploadTicketAttachmentsMiddleware(req, res, (error: any) => {
    if (!error) {
      next();
      return;
    }
    if (error?.code === "LIMIT_FILE_SIZE") {
      next(new AppError("Mỗi tệp đính kèm phải nhỏ hơn hoặc bằng 20MB", 400));
      return;
    }
    if (error instanceof multer.MulterError) {
      next(new AppError(error.message || "Tải tệp đính kèm thất bại", 400));
      return;
    }
    next(error);
  });
}

function getUploadedFiles(req: Request) {
  const files = (req as any).files;
  return Array.isArray(files) ? files : [];
}

function buildUploadedAttachmentMarker(req: Request) {
  const files = getUploadedFiles(req);
  if (!files.length) return "";

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const attachments = files.map((file: any) => {
    const uploadedFile = file;
    return {
      name: uploadedFile.originalname,
      size: uploadedFile.size,
      sizeLabel:
        uploadedFile.size >= 1024 * 1024
          ? `${(uploadedFile.size / 1024 / 1024).toFixed(1)} MB`
          : `${Math.ceil(uploadedFile.size / 1024)} KB`,
      mimeType: uploadedFile.mimetype,
      url: `/uploads/tickets/${uploadedFile.filename}`,
      fileUrl: `${baseUrl}/uploads/tickets/${uploadedFile.filename}`
    };
  });

  return `\n\n[ATTACHMENTS_JSON: ${JSON.stringify(attachments)}]`;
}

function appendCreateAttachments(req: Request, _res: Response, next: NextFunction) {
  req.body.description = `${String(req.body?.description || "").trim()}${buildUploadedAttachmentMarker(req)}`;
  next();
}

function appendMessageAttachments(req: Request, _res: Response, next: NextFunction) {
  req.body.message = `${String(req.body?.message || "").trim()}${buildUploadedAttachmentMarker(req)}`;
  next();
}

ticketsRouter.post("/", handleTicketAttachmentUpload, appendCreateAttachments, postMyTicket);
ticketsRouter.get("/my", getMyTickets);
ticketsRouter.get("/stats", authorize(ticketReadRoles), getTicketStats);
ticketsRouter.get("/", authorize(ticketReadRoles), getAllTickets);
ticketsRouter.post("/:id/messages", handleTicketAttachmentUpload, appendMessageAttachments, postTicketMessage);
ticketsRouter.get("/:id", getTicketDetail);
ticketsRouter.patch("/:id", authorize(ticketManageRoles), patchTicket);
