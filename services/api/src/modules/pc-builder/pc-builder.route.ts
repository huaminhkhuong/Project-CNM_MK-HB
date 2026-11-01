import { Router } from "express";
import * as pcBuilderController from "./pc-builder.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { createRateLimiter } from "../../middlewares/rate-limiter.middleware";

const router = Router();

const publicAiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: "⚠️ Bạn đã gửi quá nhiều yêu cầu AI trong thời gian ngắn (Tối đa 10 lượt/phút). Vui lòng chờ 1 phút trước khi thử lại."
});

/**
 * Routes for PC Builder module.
 * Organized by accessibility (Public vs Protected).
 */

// -- Public Routes (Rate Limited: 10 requests / minute) --
router.post("/suggest-build", publicAiLimiter, pcBuilderController.suggestBuild);
router.post("/suggest", publicAiLimiter, pcBuilderController.suggestBuild);
router.post("/check-compatibility", publicAiLimiter, pcBuilderController.checkRawCompatibility);
router.get("/shared/:shareToken", pcBuilderController.getSharedBuild);
router.post("/ai-advice", publicAiLimiter, pcBuilderController.getAiAdvice);
router.post("/ai-suggest-stream", publicAiLimiter, pcBuilderController.streamAiSuggestBuild);
router.post("/ai-audit-stream", publicAiLimiter, pcBuilderController.streamAiAuditBuild);
router.post("/ai-chat-stream", publicAiLimiter, pcBuilderController.streamAiChatBuild);
router.get("/rules", pcBuilderController.getRules);

// -- Protected Routes (Require Authentication) --
router.use(authenticate);

router.get("/my-builds", pcBuilderController.getMyBuilds);
router.post("/", pcBuilderController.createBuild);
router.get("/current", pcBuilderController.getCurrentBuild);
router.get("/:buildId", pcBuilderController.getBuildDetail);
router.post("/:buildId/items", pcBuilderController.addBuildItem);
router.delete("/:buildId/items/:componentType", pcBuilderController.removeBuildItem);
router.patch("/:buildId/save", pcBuilderController.saveBuild);
router.post("/:buildId/publish", pcBuilderController.publishBuild);
router.post("/:buildId/clone", pcBuilderController.cloneBuild);

export default router;
