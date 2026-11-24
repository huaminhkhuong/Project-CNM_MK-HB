import * as express from "express";

import * as controller from "./shipments.controller";
import { verifyToken, requireRole, ROLES  } from "../../middlewares/auth.middleware";
import { validateCreateShipment, validateUpdateShipmentStatus  } from "./shipments.validation.middleware";

const router = express.Router();

router.get("/order/:orderId", verifyToken, controller.getShipmentByOrder);
router.post("/", verifyToken, requireRole(ROLES.ADMIN, ROLES.SALES_STAFF), validateCreateShipment, controller.createShipment);
router.patch("/:shipmentId/status", verifyToken, requireRole(ROLES.ADMIN, ROLES.SALES_STAFF), validateUpdateShipmentStatus, controller.updateShipmentStatus);

export default router;
