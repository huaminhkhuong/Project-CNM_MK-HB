const { sendSuccess } = require("../../utils/api-response");
const asyncHandler = require("../../utils/async-handler");
const { aiRuleService } = require("./ai-rule.service");

function ensureAdminUser(req, res) {
  const role = String(req.user?.role || "").trim().toUpperCase();
  if (role !== "ADMIN") {
    res.status(403).json({
      success: false,
      message: "Truy cập bị từ chối: Chỉ có Quản trị viên (Admin) mới có quyền truy cập và thao tác cấu hình AI."
    });
    return false;
  }
  return true;
}

const getRules = asyncHandler(async (req, res) => {
  if (!ensureAdminUser(req, res)) return;
  const rules = aiRuleService.getAllRules(req.query || {});
  return sendSuccess(res, "Danh sách quy tắc lọc AI retrieved successfully", {
    rules,
    total: rules.length
  });
});

const getRule = asyncHandler(async (req, res) => {
  if (!ensureAdminUser(req, res)) return;
  const rule = aiRuleService.getRuleById(req.params.id);
  if (!rule) {
    return res.status(404).json({ success: false, message: "Quy tắc không tồn tại" });
  }
  return sendSuccess(res, "Chi tiết quy tắc retrieved successfully", rule);
});

const createRule = asyncHandler(async (req, res) => {
  if (!ensureAdminUser(req, res)) return;
  const newRule = aiRuleService.createRule(req.body || {});
  return sendSuccess(res, "Tạo quy tắc lọc AI thành công", newRule, 201);
});

const updateRule = asyncHandler(async (req, res) => {
  if (!ensureAdminUser(req, res)) return;
  const updated = aiRuleService.updateRule(req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({ success: false, message: "Quy tắc không tồn tại" });
  }
  return sendSuccess(res, "Cập nhật quy tắc lọc AI thành công", updated);
});

const deleteRule = asyncHandler(async (req, res) => {
  if (!ensureAdminUser(req, res)) return;
  const success = aiRuleService.deleteRule(req.params.id);
  if (!success) {
    return res.status(404).json({ success: false, message: "Quy tắc không tồn tại" });
  }
  return sendSuccess(res, "Xóa quy tắc lọc AI thành công");
});

const toggleRule = asyncHandler(async (req, res) => {
  if (!ensureAdminUser(req, res)) return;
  const rule = aiRuleService.toggleRule(req.params.id);
  if (!rule) {
    return res.status(404).json({ success: false, message: "Quy tắc không tồn tại" });
  }
  return sendSuccess(res, `Đã ${rule.isActive ? "kích hoạt" : "vô hiệu hóa"} quy tắc thành công`, rule);
});

const getPrompts = asyncHandler(async (req, res) => {
  if (!ensureAdminUser(req, res)) return;
  const prompts = aiRuleService.getPrompts();
  return sendSuccess(res, "Danh sách cấu hình prompt retrieved successfully", prompts);
});

const updatePrompt = asyncHandler(async (req, res) => {
  if (!ensureAdminUser(req, res)) return;
  const updated = aiRuleService.updatePrompt(req.params.scope, req.body || {});
  return sendSuccess(res, "Cập nhật cấu hình prompt thành công", updated);
});

const testFilter = asyncHandler(async (req, res) => {
  if (!ensureAdminUser(req, res)) return;
  const { scope = "GENERAL_CHAT", text = "", budget = 0 } = req.body || {};
  const result = aiRuleService.evaluateInput(scope, text, { budget: Number(budget) });
  return sendSuccess(res, "Đánh giá thử nghiệm bộ lọc hoàn tất", result);
});

const getSystemConfig = asyncHandler(async (req, res) => {
  if (!ensureAdminUser(req, res)) return;
  const config = aiRuleService.getSystemConfig();
  const estimation = aiRuleService.getTokenEstimation();
  return sendSuccess(res, "Cấu hình hệ thống AI retrieved successfully", { config, estimation });
});

const updateSystemConfig = asyncHandler(async (req, res) => {
  if (!ensureAdminUser(req, res)) return;
  const updated = aiRuleService.updateSystemConfig(req.body || {});
  const estimation = aiRuleService.getTokenEstimation();
  return sendSuccess(res, "Cập nhật cấu hình hệ thống AI thành công", { config: updated, estimation });
});

module.exports = {
  getRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
  getPrompts,
  updatePrompt,
  testFilter,
  getSystemConfig,
  updateSystemConfig
};
