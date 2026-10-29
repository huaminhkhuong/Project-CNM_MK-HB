import { Router } from "express";
import * as pcBuilderController from "./pc-builder.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { createRateLimiter } from "../../middlewares/rate-limiter.middleware";

const router = Router();

const publicAiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: "⚠️ Bạn đã gửi quá nhiều yêu cầu tư vấn AI trong thời gian ngắn. Vui lòng chờ 1 phút trước khi thử lại."
});

const publicBuilderLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: "⚠️ Thao tác kiểm tra tương thích quá nhanh. Vui lòng thử lại sau ít giây."
});

/**
 * Routes for PC Builder module.
 * Organized by accessibility (Public vs Protected).
 */

// -- Public Routes --
router.post("/suggest-build", publicBuilderLimiter, pcBuilderController.suggestBuild);
router.post("/suggest", publicBuilderLimiter, pcBuilderController.suggestBuild);
router.post("/check-compatibility", publicBuilderLimiter, pcBuilderController.checkRawCompatibility);
router.get("/shared/:shareToken", pcBuilderController.getSharedBuild);
router.post("/ai-advice", publicAiLimiter, pcBuilderController.getAiAdvice);

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
