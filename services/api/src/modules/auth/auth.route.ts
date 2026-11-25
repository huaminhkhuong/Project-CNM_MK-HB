import { Router } from "express";

import { authenticate } from "../../middlewares/auth.middleware";
import {
  login,
  logout,
  me,
  register,
  checkEmail,
  refresh,
  googleMock,
  getMyAddresses,
  createMyAddress,
  updateCurrentProfile,
  changePassword,
  updateMyAddress,
  deleteMyAddress
} from "./auth.controller";

export const authRouter = Router();

authRouter.post("/register", register);
authRouter.get("/check-email", checkEmail);
authRouter.post("/login", login);
authRouter.post("/logout", logout);
authRouter.post("/refresh", refresh);
authRouter.post("/google-mock", googleMock);
authRouter.get("/me", authenticate, me);
authRouter.patch("/me", authenticate, updateCurrentProfile);
authRouter.patch("/me/password", authenticate, changePassword);
authRouter.get("/me/addresses", authenticate, getMyAddresses);
authRouter.post("/me/addresses", authenticate, createMyAddress);
authRouter.patch("/me/addresses/:addressId", authenticate, updateMyAddress);
authRouter.delete("/me/addresses/:addressId", authenticate, deleteMyAddress);
