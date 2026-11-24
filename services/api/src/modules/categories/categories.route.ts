import { Router } from "express";
import * as controller from "./categories.controller";

export const categoriesRouter = Router();

categoriesRouter.get("/", controller.getAllCategories);
categoriesRouter.get("/tree", controller.getCategoryTree);

export default categoriesRouter;
