import { Router } from "express";

import { ROLES } from "../../constants/roles";
import { authenticate, authorize, optionalAuthenticate } from "../../middlewares/auth.middleware";
import {
  acceptSession,
  closeSession,
  createSession,
  getQueue,
  getQueueStats,
  getSession,
  handleAiConsultation,
  handoffToHuman,
  sendMessage
} from "./chat.controller";

export const chatRouter = Router();

// Customer (public)
// optionalAuthenticate: attaches req.user if token present — does NOT block anonymous access
chatRouter.post("/session", optionalAuthenticate, createSession);
chatRouter.get("/session/:id", getSession);
chatRouter.post("/session/:id/message", optionalAuthenticate, sendMessage);
chatRouter.post("/session/:id/handoff", optionalAuthenticate, handoffToHuman);
chatRouter.post("/ai-consultation", optionalAuthenticate, handleAiConsultation);

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
