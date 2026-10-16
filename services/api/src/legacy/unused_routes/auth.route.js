const express = require("express");

const controller = require("./auth.controller");
const usersController = require("../users/users.controller");
const { verifyToken } = require("../../middlewares/auth.middleware");
const {
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  validateChangePassword,
  validateAddress
} = require("./auth.validation.middleware");

const router = express.Router();

router.post("/register", validateRegister, controller.register);
router.post("/login", validateLogin, controller.login);
router.get("/me", verifyToken, controller.getCurrentProfile);
router.patch("/me", verifyToken, validateUpdateProfile, controller.updateCurrentProfile);
router.patch("/me/password", verifyToken, validateChangePassword, controller.changePassword);
router.get("/me/addresses", verifyToken, controller.getMyAddresses);
router.post("/me/addresses", verifyToken, validateAddress, controller.createMyAddress);
router.patch("/me/addresses/:addressId", verifyToken, validateAddress, controller.updateMyAddress);
router.delete("/me/addresses/:addressId", verifyToken, controller.deleteMyAddress);
router.get("/legacy-me", verifyToken, usersController.getProfile);

module.exports = router;
