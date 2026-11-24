import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import * as controller from "./compatibility.controller";

export const compatibilityRouter = Router();

compatibilityRouter.get("/builds/:buildId", authenticate, controller.checkBuildCompatibility);

export default compatibilityRouter;
