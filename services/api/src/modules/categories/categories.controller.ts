import { Request, Response } from "express";
import { sendSuccess } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import * as categoriesService from "./categories.service";

export const getAllCategories = asyncHandler(async (_req: Request, res: Response) => {
  const result = await categoriesService.getAllCategories();
  return sendSuccess(res, "Categories fetched successfully", result);
});

export const getCategoryTree = asyncHandler(async (_req: Request, res: Response) => {
  const result = await categoriesService.getCategoryTree();
  return sendSuccess(res, "Category tree fetched successfully", result);
});

export default {
  getAllCategories,
  getCategoryTree
};
