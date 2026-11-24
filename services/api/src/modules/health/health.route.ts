import { Router } from "express";
import * as controller from "./health.controller";

export const healthRouter = Router();

healthRouter.get("/", controller.getApiHealth);
healthRouter.get("/db", controller.getDatabaseHealth);

export default healthRouter;
