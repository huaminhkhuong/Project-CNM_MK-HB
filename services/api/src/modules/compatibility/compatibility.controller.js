const { sendSuccess } = require("../../utils/api-response");
const asyncHandler = require("../../utils/async-handler");
const compatibilityService = require("./compatibility.service");

const checkBuildCompatibility = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  const userRole = req.user?.role;
  const result = await compatibilityService.checkBuildCompatibility(userId, req.params.buildId, userRole);
  return sendSuccess(res, "Build compatibility checked successfully", result);
});

module.exports = {
  checkBuildCompatibility
};
