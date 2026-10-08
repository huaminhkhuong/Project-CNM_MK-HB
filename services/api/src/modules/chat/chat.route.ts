import { Router } from "express";

import { ROLES } from "../../constants/roles";
import { authenticate, authorize } from "../../middlewares/auth.middleware";
import {
  acceptSession,
  closeSession,
  createSession,
  getQueue,
  getQueueStats,
  getSession,
  handleAiConsultation,
  sendMessage
} from "./chat.controller";

export const chatRouter = Router();

// Customer (public)
chatRouter.post("/session", createSession);
chatRouter.get("/session/:id", getSession);
chatRouter.post("/session/:id/message", sendMessage);
chatRouter.post("/ai-consultation", handleAiConsultation);

// Staff (protected)
chatRouter.get("/queue/stats", authenticate, authorize([ROLES.ADMIN, ROLES.SALES_STAFF]), getQueueStats);
chatRouter.get("/queue", authenticate, authorize([ROLES.ADMIN, ROLES.SALES_STAFF]), getQueue);
chatRouter.post(
  "/session/:id/accept",
  authenticate,
  authorize([ROLES.ADMIN, ROLES.SALES_STAFF]),
  acceptSession
);
chatRouter.post(
  "/session/:id/close",
  authenticate,
  authorize([ROLES.ADMIN, ROLES.SALES_STAFF]),
  closeSession
);
