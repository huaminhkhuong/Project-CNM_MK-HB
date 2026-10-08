const express = require("express");

const { verifyToken, optionalAuthenticate } = require("../../middlewares/auth.middleware");
const controller = require("./ai.controller");

const router = express.Router();

router.post("/chat", optionalAuthenticate, controller.chat);
router.get("/history", verifyToken, controller.getHistory);
router.delete("/history", verifyToken, controller.clearHistory);
router.post("/builds/:buildId/advice", verifyToken, controller.getBuildAdvice);

module.exports = router;
