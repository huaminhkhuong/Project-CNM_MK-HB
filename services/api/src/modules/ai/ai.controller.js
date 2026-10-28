const { sendSuccess } = require("../../utils/api-response");
const asyncHandler = require("../../utils/async-handler");
const aiService = require("./ai.service");

const chat = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body?.userId;
  const result = await aiService.askTechnicalAdvisor({ ...(req.body || {}), userId });
  if (userId) {
    await aiService.saveUserAiChat(userId, req.body?.message, result);
  }
  return sendSuccess(res, "AI technical advice generated successfully", result);
});

const getHistory = asyncHandler(async (req, res) => {
  const history = await aiService.getUserAiChatHistory(req.user.id);
  return sendSuccess(res, "Chat history retrieved successfully", history);
});

const clearHistory = asyncHandler(async (req, res) => {
  await aiService.clearUserAiChatHistory(req.user.id);
  return sendSuccess(res, "Chat history cleared successfully");
});

const getBuildAdvice = asyncHandler(async (req, res) => {
  const result = await aiService.askBuildAdvisor(req.user.id, req.params.buildId, req.body || {});
  return sendSuccess(res, "AI build advice generated successfully", result);
});

module.exports = {
  chat,
  getHistory,
  clearHistory,
  getBuildAdvice
};
