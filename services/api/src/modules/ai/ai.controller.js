const { sendSuccess } = require("../../utils/api-response");
const asyncHandler = require("../../utils/async-handler");
const aiService = require("./ai.service");

const chat = asyncHandler(async (req, res) => {
  const result = await aiService.askTechnicalAdvisor(req.body || {});
  if (req.user?.id) {
    await aiService.saveUserAiChat(req.user.id, req.body?.message, result);
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
