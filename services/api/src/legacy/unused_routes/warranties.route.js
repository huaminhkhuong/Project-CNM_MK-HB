const express = require("express");

const controller = require("./warranties.controller");
const { verifyToken } = require("../../middlewares/auth.middleware");
const { validateActivateWarranty } = require("./warranties.validation.middleware");

const router = express.Router();

router.use(verifyToken);
router.get("/eligible", controller.getEligibleItems);
router.get("/my", controller.getMyWarranties);
router.post("/activate", validateActivateWarranty, controller.activateWarranty);

module.exports = router;
