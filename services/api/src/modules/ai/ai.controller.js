const { sendSuccess } = require("../../utils/api-response");
const asyncHandler = require("../../utils/async-handler");
const aiService = require("./ai.service");
const { aiQueryCache } = require("./ai-cache.service");
const { aiFeedbackService } = require("./ai-feedback.service");

/**
 * Kiểm tra câu hỏi có mang ngữ cảnh cá nhân hóa của tài khoản hay không.
 * Nếu có ngữ cảnh riêng (buildId, buildContext, orderId, warrantyId, hoặc hỏi về dàn PC / đơn hàng / bảo hành riêng),
 * hệ thống sẽ KHÔNG dùng chung cache toàn cục để tránh rò rỉ hoặc trả sai cấu hình giữa các user.
 */
function isPersonalizedQuery(message, req, userId) {
  // 1. Kiểm tra payload chứa bối cảnh cấu hình phần cứng hoặc thực thể nghiệp vụ riêng
  if (
    req.body?.buildContext ||
    req.body?.buildId ||
    req.body?.activeBuild ||
    req.body?.orderId ||
    req.body?.ticketId ||
    req.body?.warrantyId ||
    req.body?.serialNumber ||
    req.body?.hardwareContext
  ) {
    return true;
  }

  // 2. Kiểm tra từ khóa ngữ cảnh cá nhân / sở hữu trong câu hỏi (Tiếng Việt & Tiếng Anh)
  const personalPattern = /(của tôi|máy tôi|máy của tôi|máy của em|máy em|dàn pc của tôi|dàn pc của em|cấu hình của tôi|cấu hình của em|đơn hàng|đơn của tôi|bảo hành của tôi|bảo hành|tài khoản của tôi|giỏ hàng của tôi|my build|my pc|my order|my warranty|my cart|đã mua|tôi đã đặt|vừa đặt|đã thanh toán)/i;
  if (personalPattern.test(message)) {
    return true;
  }

  return false;
}

const chat = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || req.user?.id || req.body?.userId;
  const userMessage = String(req.body?.message || "").trim();
  const isPersonal = isPersonalizedQuery(userMessage, req, userId);

  // 1. Kiểm tra AI In-Memory LRU Cache cho câu hỏi tri thức chung (không áp dụng cho câu hỏi cá nhân)
  const cacheKey = aiQueryCache.normalizeKey(userMessage);
  const canUseCache = Boolean(cacheKey && !req.body?.skipCache && !isPersonal);

  if (canUseCache) {
    const cachedResult = aiQueryCache.get(cacheKey);
    if (cachedResult) {
      if (userId) {
        await aiService.saveUserAiChat(userId, userMessage, cachedResult);
      }
      return sendSuccess(res, "AI technical advice retrieved from cache (0ms)", {
        ...cachedResult,
        cached: true
      });
    }
  }

  // 2. Không trúng cache hoặc câu hỏi riêng tư -> suy luận mới qua RAG + LLM Orchestration
  const result = await aiService.askTechnicalAdvisor({ ...(req.body || {}), userId });

  // 3. Chỉ lưu vào cache chung (TTL 30 phút) nếu là câu hỏi tri thức chung hợp lệ
  if (canUseCache && result && !result.isBlocked) {
    aiQueryCache.set(cacheKey, result);
  }

  if (userId) {
    await aiService.saveUserAiChat(userId, userMessage, result);
  }

  return sendSuccess(res, "AI technical advice generated successfully", {
    ...result,
    cached: false
  });
});

const getHistory = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  const history = await aiService.getUserAiChatHistory(userId);
  return sendSuccess(res, "Chat history retrieved successfully", history);
});

const clearHistory = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  await aiService.clearUserAiChatHistory(userId);
  return sendSuccess(res, "Chat history cleared successfully");
});

const getBuildAdvice = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  const result = await aiService.askBuildAdvisor(userId, req.params.buildId, req.body || {});
  return sendSuccess(res, "AI build advice generated successfully", result);
});

// ─── AI User Feedback Actions ────────────────────────────────────────────────

const submitFeedback = asyncHandler(async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  const { query, response, rating, reason, category } = req.body || {};

  const entry = aiFeedbackService.recordFeedback({
    userId,
    query,
    response,
    rating: Number(rating) === 1 ? 1 : -1,
    reason,
    category
  });

  return sendSuccess(res, "Đã ghi nhận đánh giá phản hồi AI thành công", entry);
});

const getFeedbackStats = asyncHandler(async (_req, res) => {
  const stats = aiFeedbackService.getStats();
  const recent = aiFeedbackService.getRecent(20);
  return sendSuccess(res, "AI feedback stats retrieved successfully", {
    stats,
    recent
  });
});

const getCacheStats = asyncHandler(async (_req, res) => {
  const stats = aiQueryCache.getStats();
  return sendSuccess(res, "AI query cache stats retrieved successfully", stats);
});

module.exports = {
  chat,
  getHistory,
  clearHistory,
  getBuildAdvice,
  submitFeedback,
  getFeedbackStats,
  getCacheStats
};
