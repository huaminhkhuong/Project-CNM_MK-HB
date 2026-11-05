const express = require("express");

const { verifyToken, optionalAuthenticate, requireRole, ROLES } = require("../../middlewares/auth.middleware");
const controller = require("./ai.controller");
const ruleController = require("./ai-rule.controller");

const router = express.Router();

// Public / User AI Chat Routes
router.post("/chat", optionalAuthenticate, controller.chat);
router.get("/history", verifyToken, controller.getHistory);
router.delete("/history", verifyToken, controller.clearHistory);
router.post("/builds/:buildId/advice", verifyToken, controller.getBuildAdvice);

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

module.exports = router;
