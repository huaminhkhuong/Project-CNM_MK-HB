import * as express from "express";

import { verifyToken, requireRole, ROLES  } from "../../middlewares/auth.middleware";
import * as controller from "./staff.controller";

const router = express.Router();

router.use(verifyToken, requireRole(ROLES.ADMIN, ROLES.SALES_STAFF));

router.get("/orders", controller.getProcessingOrders);
router.get("/orders/:orderId", controller.getStaffOrderDetail);
router.patch("/orders/:orderId/status", controller.updateStaffOrderStatus);
router.post("/orders/:orderId/shipment", controller.createShipment);
router.patch("/orders/:orderId/consultation-note", controller.updateConsultationNote);

export default router;
