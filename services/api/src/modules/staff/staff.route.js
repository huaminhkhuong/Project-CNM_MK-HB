const express = require("express");

const { verifyToken, requireRole, ROLES } = require("../../middlewares/auth.middleware");
const controller = require("./staff.controller");

const router = express.Router();

router.use(verifyToken, requireRole(ROLES.ADMIN, ROLES.SALES_STAFF));

router.get("/orders", controller.getProcessingOrders);
router.get("/orders/:orderId", controller.getStaffOrderDetail);
router.patch("/orders/:orderId/status", controller.updateStaffOrderStatus);
router.post("/orders/:orderId/shipment", controller.createShipment);
router.patch("/orders/:orderId/consultation-note", controller.updateConsultationNote);

// Serial numbers & Fulfillment routes
router.get("/orders/:orderId/serials", controller.getOrderSerials);
router.post("/orders/:orderId/serials", controller.assignOrderSerials);
router.post("/orders/:orderId/serials/auto-generate", controller.autoGenerateMockSerials);

module.exports = router;
