const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const controller = require("./payments.controller");
const { verifyToken } = require("../../middlewares/auth.middleware");
const { validateCreatePayment, validateConfirmPayment } = require("./payments.validation.middleware");

const router = express.Router();

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
    cb(null, "proof-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file hình ảnh (JPG, PNG, GIF, WEBP)"));
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
    if (err) return next(err);
    req.file =
      req.files?.proof_image?.[0] ||
      req.files?.paymentProof?.[0] ||
      req.files?.file?.[0] ||
      null;
    next();
  });
};

router.post("/", verifyToken, validateCreatePayment, controller.createPayment);
router.get("/:paymentId", verifyToken, controller.getPaymentStatus);
router.post("/:paymentId/confirm", verifyToken, validateConfirmPayment, controller.confirmPayment);
router.get("/:paymentId/callback", controller.handleMockCallback);

// Upload payment proof receipt endpoints
router.post("/:orderId/proof", verifyToken, proofUploadMiddleware, controller.uploadPaymentProof);
router.post("/:orderId/payment-proof", verifyToken, proofUploadMiddleware, controller.uploadPaymentProof);

module.exports = router;
