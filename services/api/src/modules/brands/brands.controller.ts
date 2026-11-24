import { Request, Response } from "express";
import { sendSuccess } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import * as brandsService from "./brands.service";

export const getAllBrands = asyncHandler(async (_req: Request, res: Response) => {
  const result = await brandsService.getAllBrands();
  return sendSuccess(res, "Brands fetched successfully", result);
});

export default {
  getAllBrands
};
