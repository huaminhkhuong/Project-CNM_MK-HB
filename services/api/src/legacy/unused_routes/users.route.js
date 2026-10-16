const express = require("express");

const { verifyToken } = require("../../middlewares/auth.middleware");
const controller = require("./users.controller");

const router = express.Router();

router.get("/me", verifyToken, controller.getProfile);

module.exports = router;
