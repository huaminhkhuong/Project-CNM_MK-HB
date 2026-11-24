import * as express from "express";

import * as controller from "./payments.controller";
import { verifyToken  } from "../../middlewares/auth.middleware";
import { validateCreatePayment, validateConfirmPayment  } from "./payments.validation.middleware";

const router = express.Router();

router.post("/", verifyToken, validateCreatePayment, controller.createPayment);
router.get("/:paymentId", verifyToken, controller.getPaymentStatus);
router.post("/:paymentId/confirm", verifyToken, validateConfirmPayment, controller.confirmPayment);
router.get("/:paymentId/callback", controller.handleMockCallback);

export default router;
