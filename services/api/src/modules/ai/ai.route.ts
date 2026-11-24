import { Router } from "express";
import multer from "multer";
import * as path from "path";

import { verifyToken, optionalAuthenticate, requireRole, ROLES  } from "../../middlewares/auth.middleware";
import { aiRateLimiter } from "../../middlewares/rate-limiter.middleware";
import * as controller from "./ai.controller";
import * as ruleController from "./ai-rule.controller";
import aiDocumentController from "./ai-document.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ([".pdf", ".md", ".txt"].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file định dạng .pdf, .md, .txt"));
    }
  }
});

const router = Router();

// Public / User AI Chat Routes
router.post("/chat", aiRateLimiter, optionalAuthenticate, controller.chat);
router.get("/history", verifyToken, controller.getHistory);
router.delete("/history", verifyToken, controller.clearHistory);
router.post("/builds/:buildId/advice", aiRateLimiter, verifyToken, controller.getBuildAdvice);

// Public / User PC Builder Dynamic Questions
router.get("/builder/questions", aiRateLimiter, aiDocumentController.getBuilderQuestions);
router.post("/builder/questions", aiRateLimiter, aiDocumentController.getBuilderQuestions);

// Admin AI Management: Rules, Filters & Prompt Customization
router.get("/admin/rules", verifyToken, requireRole(ROLES.ADMIN), ruleController.getRules);
router.get("/admin/rules/:id", verifyToken, requireRole(ROLES.ADMIN), ruleController.getRule);
router.post("/admin/rules", verifyToken, requireRole(ROLES.ADMIN), ruleController.createRule);
router.put("/admin/rules/:id", verifyToken, requireRole(ROLES.ADMIN), ruleController.updateRule);
router.delete("/admin/rules/:id", verifyToken, requireRole(ROLES.ADMIN), ruleController.deleteRule);
router.patch("/admin/rules/:id/toggle", verifyToken, requireRole(ROLES.ADMIN), ruleController.toggleRule);
router.get("/admin/prompts", verifyToken, requireRole(ROLES.ADMIN), ruleController.getPrompts);
router.put("/admin/prompts/:scope", verifyToken, requireRole(ROLES.ADMIN), ruleController.updatePrompt);
router.post("/admin/test-filter", verifyToken, requireRole(ROLES.ADMIN), ruleController.testFilter);
router.get("/admin/system-config", verifyToken, requireRole(ROLES.ADMIN), ruleController.getSystemConfig);
router.put("/admin/system-config", verifyToken, requireRole(ROLES.ADMIN), ruleController.updateSystemConfig);

// Admin RAG Knowledge & Vector Document Management
router.get("/admin/documents", verifyToken, requireRole(ROLES.ADMIN), aiDocumentController.listDocuments);
router.post("/admin/documents/upload", verifyToken, requireRole(ROLES.ADMIN), upload.single("file"), aiDocumentController.uploadDocument);
router.delete("/admin/documents/:filename", verifyToken, requireRole(ROLES.ADMIN), aiDocumentController.deleteDocument);
router.get("/admin/documents/:filename/chunks", verifyToken, requireRole(ROLES.ADMIN), aiDocumentController.previewChunks);
router.post("/admin/documents/reindex", verifyToken, requireRole(ROLES.ADMIN), aiDocumentController.reindex);
router.get("/admin/documents/reindex-status", verifyToken, requireRole(ROLES.ADMIN), aiDocumentController.getReindexStatus);
router.get("/admin/embedding-models", verifyToken, requireRole(ROLES.ADMIN), aiDocumentController.getEmbeddingModels);

export default router;
