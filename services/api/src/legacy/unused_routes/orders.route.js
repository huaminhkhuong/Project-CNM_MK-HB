const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { verifyToken, requireRole, ROLES } = require("../../middlewares/auth.middleware");
const controller = require("./orders.controller");

const router = express.Router();

// Configure multer for file upload to disk
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, "../../../uploads/payment-proofs");
    // Ensure uploads directory exists on first upload
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

router.post("/checkout", verifyToken, controller.createOrderFromCart);
router.get("/my", verifyToken, controller.getMyOrders);
router.get("/", verifyToken, requireRole(ROLES.ADMIN, ROLES.SALES_STAFF), controller.getAllOrders);
router.get("/:orderId", verifyToken, controller.getOrderDetail);
router.patch("/:orderId/status", verifyToken, requireRole(ROLES.ADMIN, ROLES.SALES_STAFF), controller.updateOrderStatus);
router.post("/:orderId/pay", verifyToken, requireRole(ROLES.ADMIN, ROLES.SALES_STAFF), controller.markOrderPaid);
router.patch("/:orderId/cancel", verifyToken, controller.cancelOrder);
router.post("/:orderId/payment-proof", verifyToken, upload.single('paymentProof'), controller.uploadPaymentProof);
router.patch("/:orderId/payment-proof/approve", verifyToken, requireRole(ROLES.ADMIN, ROLES.SALES_STAFF), controller.approvePaymentProof);

module.exports = router;
