import { Request, Response } from "express";
import { sendSuccess } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import * as compatibilityService from "./compatibility.service";

export const checkBuildCompatibility = asyncHandler(async (req: Request, res: Response) => {
  const result = await compatibilityService.checkBuildCompatibility(req.user!.id, req.params.buildId);
  return sendSuccess(res, "Build compatibility checked successfully", result);
});

export default {
  checkBuildCompatibility
};
