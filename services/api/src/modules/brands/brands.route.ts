import { Router } from "express";
import * as controller from "./brands.controller";

export const brandsRouter = Router();

brandsRouter.get("/", controller.getAllBrands);

export default brandsRouter;
