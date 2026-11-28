const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const controller = require("./payments.controller");
const { verifyToken } = require("../../middlewares/auth.middleware");
const { createError } = require("../../utils/service-helpers");
const { validateCreatePayment, validateConfirmPayment } = require("./payments.validation.middleware");

const router = express.Router();

const ALLOWED_PROOF_MIME_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp"
};

// Multer storage for payment receipts
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.resolve(__dirname, "../../../uploads/payment-proofs");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const safeExt = ALLOWED_PROOF_MIME_TO_EXT[String(file.mimetype || "").toLowerCase()] || ".jpg";
    cb(null, "proof-" + uniqueSuffix + safeExt);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const mime = String(file.mimetype || "").toLowerCase();
    if (Object.prototype.hasOwnProperty.call(ALLOWED_PROOF_MIME_TO_EXT, mime)) {
      cb(null, true);
    } else {
      cb(createError("Chỉ chấp nhận file hình ảnh (JPG, PNG, GIF, WEBP)", 400));
    }
  }
});

// Middleware supporting proof_image, paymentProof, or file field names
const proofUploadMiddleware = (req, res, next) => {
  upload.fields([
    { name: "proof_image", maxCount: 1 },
    { name: "paymentProof", maxCount: 1 },
    { name: "file", maxCount: 1 }
  ])(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(createError("Kích thước ảnh biên lai không được vượt quá 5MB", 400));
      }
      if (err instanceof multer.MulterError) {
        return next(createError(err.message || "Tải ảnh biên lai thất bại", 400));
      }
      return next(err);
    }
    req.file =
      req.files?.proof_image?.[0] ||
      req.files?.paymentProof?.[0] ||
      req.files?.file?.[0] ||
      null;
    next();
  });
};

// SePay Auto-VietQR real-money payment endpoints (must be registered BEFORE /:paymentId)
router.post("/sepay/webhook", controller.handleSepayWebhook);
router.get("/sepay/order/:orderId", verifyToken, controller.getSepayOrderPaymentInfo);

router.post("/", verifyToken, validateCreatePayment, controller.createPayment);
router.get("/:paymentId", verifyToken, controller.getPaymentStatus);
router.post("/:paymentId/confirm", verifyToken, validateConfirmPayment, controller.confirmPayment);
router.get("/:paymentId/callback", controller.handleMockCallback);

// Upload payment proof receipt endpoints
router.post("/:orderId/proof", verifyToken, proofUploadMiddleware, controller.uploadPaymentProof);
router.post("/:orderId/payment-proof", verifyToken, proofUploadMiddleware, controller.uploadPaymentProof);

module.exports = router;
