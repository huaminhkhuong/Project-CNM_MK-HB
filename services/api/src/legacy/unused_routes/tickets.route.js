const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");

const { verifyToken, requireRole, ROLES } = require("../../middlewares/auth.middleware");
const controller = require("./tickets.controller");
const {
  validateCreateTicket,
  validateUpdateTicket,
  validateAddTicketMessage
} = require("./tickets.validation.middleware");

const router = express.Router();

const ticketUploadDir = path.resolve(__dirname, "../../../uploads/tickets");
fs.mkdirSync(ticketUploadDir, { recursive: true });

const allowedAttachmentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf"
]);

const ticketAttachmentUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ticketUploadDir),
    filename: (_req, file, cb) => {
      const safeName = String(file.originalname || "ticket-file")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120);
      const ext = path.extname(safeName) || "";
      const base = path.basename(safeName, ext) || "ticket-file";
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${base}${ext}`);
    }
  }),
  limits: {
    files: 5,
    fileSize: 20 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedAttachmentTypes.has(file.mimetype)) {
      return cb(new Error("Unsupported ticket attachment type"));
    }
    return cb(null, true);
  }
});

function buildUploadedAttachmentMarker(req) {
  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) return "";

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const attachments = files.map((file) => ({
    name: file.originalname,
    size: file.size,
    sizeLabel: file.size >= 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(file.size / 1024)} KB`,
    mimeType: file.mimetype,
    url: `/uploads/tickets/${file.filename}`,
    fileUrl: `${baseUrl}/uploads/tickets/${file.filename}`
  }));

  return `\n\n[ATTACHMENTS_JSON: ${JSON.stringify(attachments)}]`;
}

function appendCreateAttachments(req, _res, next) {
  req.body.description = `${String(req.body?.description || "").trim()}${buildUploadedAttachmentMarker(req)}`;
  return next();
}

function appendMessageAttachments(req, _res, next) {
  req.body.message = `${String(req.body?.message || "").trim()}${buildUploadedAttachmentMarker(req)}`;
  return next();
}

router.use(verifyToken);

router.post("/", ticketAttachmentUpload.array("attachments", 5), appendCreateAttachments, validateCreateTicket, controller.createTicket);
router.get("/my", controller.getMyTickets);
router.get("/stats", requireRole(ROLES.ADMIN, ROLES.SALES_STAFF, ROLES.TECH_STAFF), controller.getTicketStats);
router.get("/", requireRole(ROLES.ADMIN, ROLES.SALES_STAFF, ROLES.TECH_STAFF), controller.getAllTickets);
router.get("/:ticketId", controller.getTicketDetail);
router.post("/:ticketId/messages", ticketAttachmentUpload.array("attachments", 5), appendMessageAttachments, validateAddTicketMessage, controller.addTicketMessage);
router.patch("/:ticketId", requireRole(ROLES.ADMIN, ROLES.SALES_STAFF, ROLES.TECH_STAFF), validateUpdateTicket, controller.updateTicket);

module.exports = router;

