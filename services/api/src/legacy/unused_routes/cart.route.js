const express = require("express");

const { verifyToken } = require("../../middlewares/auth.middleware");
const controller = require("./cart.controller");

const router = express.Router();

router.get("/", verifyToken, controller.getCart);
router.post("/items", verifyToken, controller.addItem);
router.patch("/items/:itemId", verifyToken, controller.updateItemQuantity);
router.delete("/items/:itemId", verifyToken, controller.removeItem);

module.exports = router;
