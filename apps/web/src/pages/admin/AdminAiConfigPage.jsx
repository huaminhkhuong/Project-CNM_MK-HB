import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  AdminAlerts,
  AdminBtn,
  AdminCard,
  AdminField,
  AdminForm,
  AdminMetric,
  AdminMetrics,
  AdminPage,
  AdminPageHead,
  AdminWorkspace,
  useAdminToast
} from "../../components/admin/AdminUi";
import {
  createAdminAiRule,
  deleteAdminAiRule,
  getAdminAiPrompts,
  getAdminAiRules,
  getAdminAiSystemConfig,
  testAdminAiFilter,
  toggleAdminAiRule,
  updateAdminAiPrompt,
  updateAdminAiRule,
  updateAdminAiSystemConfig
} from "../../services/ai.service";

const SCOPES = [
  { id: "ALL", label: "Tất cả phạm vi" },
  { id: "GENERAL_CHAT", label: "1. AI Chat Tư Vấn Chung", color: "#2563eb" },
  { id: "BUILDER_SUGGEST", label: "2. AI Đề Xuất Build PC (32 linh kiện)", color: "#7c3aed" },
  { id: "BUILDER_AUDIT_CHAT", label: "3. AI Giám Định & Chat Build PC", color: "#d97706" }
];

const ACTIONS = [
  { id: "ALL", label: "Tất cả hành động" },
  { id: "DIRECT_REPLY", label: "⚡ Tự trả lời ngay (0ms, 0$)", color: "#059669" },
  { id: "BLOCK", label: "🛡️ Chặn / Từ chối (Guardrail)", color: "#dc2626" },
  { id: "SYSTEM_INJECT", label: "💉 Tiêm chỉ thị Prompt cho AI", color: "#2563eb" }
];

const MATCH_TYPES = [
  { id: "contains", label: "Chứa từ khóa (contains - phân tách bằng dấu phẩy)" },
  { id: "regex", label: "Biểu thức chính quy (Regular Expression)" },
  { id: "exact", label: "Khớp chính xác từng chữ (exact)" },
  { id: "budget_threshold", label: "Ngưỡng ngân sách (ví dụ: < 5000000 hoặc > 200000000)" }
];

export function AdminAiConfigPage() {
  const { authState, isAuthenticated } = useAuth();
  const role = String(authState?.user?.role || "").toUpperCase();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  const [activeTab, setActiveTab] = useState("rules"); // "rules" | "prompts" | "test"
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Data States
  const [rules, setRules] = useState([]);
  const [prompts, setPrompts] = useState({});

  // Filter States for Rules Table
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [searchKeyword, setSearchKeyword] = useState("");

  // Modal State for Rule Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleFormData, setRuleFormData] = useState({
    name: "",
    scope: "GENERAL_CHAT",
    matchType: "contains",
    pattern: "",
    action: "DIRECT_REPLY",
    directReply: "",
    blockReason: "",
    promptInjection: "",
    priority: 50,
    isActive: true
  });

  // Prompt Form States
  const [savingPromptScope, setSavingPromptScope] = useState(null);

  // Test Simulator State
  const [testScope, setTestScope] = useState("GENERAL_CHAT");
  const [testText, setTestText] = useState("");
  const [testBudget, setTestBudget] = useState(15000000);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  // System AI Config & Token Estimation States
  const [systemConfig, setSystemConfig] = useState({
    provider: "gemini",
    model: "gemini-1.5-flash",
    temperature: 0.4,
    maxTokens: 2048,
    maxCatalogProducts: 35,
    retrievalMode: "keyword_and_category",
    apiKeyMasked: "",
    apiKey: ""
  });
  const [tokenEstimation, setTokenEstimation] = useState(null);
  const [savingSystemConfig, setSavingSystemConfig] = useState(false);

  useAdminToast(successMessage, () => setSuccessMessage(""));

  // Load Rules, Prompts, and Central System Config on mount
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setErrorMessage("");
      const [rulesRes, promptsRes, sysRes] = await Promise.all([
        getAdminAiRules(),
        getAdminAiPrompts(),
        getAdminAiSystemConfig()
      ]);
      setRules(rulesRes?.data?.rules || rulesRes?.rules || []);
      setPrompts(promptsRes?.data || promptsRes || {});
      const sysData = sysRes?.data || sysRes || {};
      if (sysData.config) {
        setSystemConfig((prev) => ({ ...prev, ...sysData.config }));
      }
      if (sysData.estimation) {
        setTokenEstimation(sysData.estimation);
      }
    } catch (err) {
      setErrorMessage("Không thể tải cấu hình AI: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSystemConfig(e) {
    if (e) e.preventDefault();
    try {
      setSavingSystemConfig(true);
      setErrorMessage("");
      const res = await updateAdminAiSystemConfig(systemConfig);
      const data = res?.data || res || {};
      if (data.config) {
        setSystemConfig((prev) => ({ ...prev, ...data.config, apiKey: "" }));
      }
      if (data.estimation) {
        setTokenEstimation(data.estimation);
      }
      setSuccessMessage("Đã lưu và cập nhật cấu hình hệ thống AI thành công!");
    } catch (err) {
      setErrorMessage("Lỗi khi lưu cấu hình AI: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingSystemConfig(false);
    }
  }

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (scopeFilter !== "ALL" && r.scope !== scopeFilter && r.scope !== "GLOBAL") return false;
      if (actionFilter !== "ALL" && r.action !== actionFilter) return false;
      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase();
        const n = String(r.name || "").toLowerCase();
        const p = String(r.pattern || "").toLowerCase();
        if (!n.includes(q) && !p.includes(q)) return false;
      }
      return true;
    });
  }, [rules, scopeFilter, actionFilter, searchKeyword]);

  // Statistics
  const totalHitCount = useMemo(() => {
    return rules.reduce((sum, r) => sum + (r.hitCount || 0), 0);
  }, [rules]);

  const directReplyCount = useMemo(() => {
    return rules.filter((r) => r.action === "DIRECT_REPLY").length;
  }, [rules]);

  const blockCount = useMemo(() => {
    return rules.filter((r) => r.action === "BLOCK").length;
  }, [rules]);

  // Handle Toggle Rule
  async function handleToggleRule(rule) {
    try {
      const res = await toggleAdminAiRule(rule.id);
      const updated = res?.data || res;
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, isActive: updated.isActive } : r)));
      setSuccessMessage(`Đã ${updated.isActive ? "bật" : "tắt"} quy tắc "${rule.name}"`);
    } catch (err) {
      setErrorMessage("Lỗi khi thay đổi trạng thái: " + (err.response?.data?.message || err.message));
    }
  }

  // Handle Delete Rule
  async function handleDeleteRule(rule) {
    if (!confirm(`Bạn có chắc muốn xóa vĩnh viễn quy tắc "${rule.name}"?`)) return;
    try {
      await deleteAdminAiRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      setSuccessMessage(`Đã xóa quy tắc "${rule.name}" thành công`);
    } catch (err) {
      setErrorMessage("Lỗi khi xóa quy tắc: " + (err.response?.data?.message || err.message));
    }
  }

  // Open Create Modal
  function handleOpenCreateModal() {
    setEditingRule(null);
    setRuleFormData({
      name: "",
      scope: scopeFilter !== "ALL" ? scopeFilter : "GENERAL_CHAT",
      matchType: "contains",
      pattern: "",
      action: "DIRECT_REPLY",
      directReply: "",
      blockReason: "",
      promptInjection: "",
      priority: 50,
      isActive: true
    });
    setIsModalOpen(true);
  }

  // Open Edit Modal
  function handleOpenEditModal(rule) {
    setEditingRule(rule);
    setRuleFormData({
      name: rule.name || "",
      scope: rule.scope || "GENERAL_CHAT",
      matchType: rule.matchType || "contains",
      pattern: rule.pattern || "",
      action: rule.action || "DIRECT_REPLY",
      directReply: rule.directReply || "",
      blockReason: rule.blockReason || "",
      promptInjection: rule.promptInjection || "",
      priority: rule.priority || 50,
      isActive: rule.isActive !== false
    });
    setIsModalOpen(true);
  }

  // Save Rule (Create or Update)
  async function handleSaveRule(e) {
    e.preventDefault();
    if (!ruleFormData.name.trim() || !ruleFormData.pattern.trim()) {
      alert("Vui lòng điền đầy đủ Tên quy tắc và Mẫu khớp");
      return;
    }

    try {
      if (editingRule) {
        const res = await updateAdminAiRule(editingRule.id, ruleFormData);
        const updated = res?.data || res;
        setRules((prev) => prev.map((r) => (r.id === editingRule.id ? updated : r)));
        setSuccessMessage(`Cập nhật quy tắc "${updated.name}" thành công`);
      } else {
        const res = await createAdminAiRule(ruleFormData);
        const created = res?.data || res;
        setRules((prev) => [created, ...prev]);
        setSuccessMessage(`Tạo quy tắc mới "${created.name}" thành công`);
      }
      setIsModalOpen(false);
    } catch (err) {
      setErrorMessage("Lỗi khi lưu quy tắc: " + (err.response?.data?.message || err.message));
    }
  }

  // Save Prompt Config for a specific scope
  async function handleSavePrompt(scope) {
    const config = prompts[scope];
    if (!config) return;
    try {
      setSavingPromptScope(scope);
      await updateAdminAiPrompt(scope, config);
      setSuccessMessage(`Đã lưu cấu hình Prompt cho [${config.name || scope}] thành công!`);
    } catch (err) {
      setErrorMessage("Lỗi khi lưu cấu hình prompt: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingPromptScope(null);
    }
  }

  // Run Test Filter Simulation
  async function handleRunTest(e) {
    e.preventDefault();
    try {
      setIsTesting(true);
      setTestResult(null);
      const res = await testAdminAiFilter({
        scope: testScope,
        text: testText,
        budget: testBudget
      });
      setTestResult(res?.data || res);
    } catch (err) {
      setErrorMessage("Lỗi kiểm thử: " + (err.response?.data?.message || err.message));
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <AdminPage>
      <AdminPageHead
        eyebrow="AI Management Center"
        title="Quản Trị Lọc Dữ Liệu Đầu Vào & AI Customization"
        description="Kiểm soát đầu vào cho 3 chức năng: Chat Tư Vấn, Đề Xuất Cấu Hình 32 Linh Kiện, và Giám Định Build PC. Tối ưu chi phí Token bằng bộ lọc 2 tầng (Tự trả lời / Chặn / Tiêm Prompt)."
        actions={
          activeTab === "rules" ? (
            <AdminBtn variant="primary" onClick={handleOpenCreateModal}>
              ➕ Thêm Quy Tắc Lọc Mới
            </AdminBtn>
          ) : null
        }
      />

      <AdminAlerts errorMessage={errorMessage} successMessage={successMessage} />

      {/* Metrics Tổng Quan */}
      <AdminMetrics>
        <AdminMetric
          label="Tổng quy tắc đang chạy"
          value={rules.length}
          hint={`${rules.filter((r) => r.isActive).length} quy tắc đang bật`}
          tone="default"
        />
        <AdminMetric
          label="Quy tắc tự trả lời (0ms, 0$)"
          value={directReplyCount}
          hint="Bypass LLM API cho FAQ & chính sách"
          tone="success"
        />
        <AdminMetric
          label="Quy tắc Chặn / Bảo vệ"
          value={blockCount}
          hint="Chặn off-topic, ngân sách ảo"
          tone="danger"
        />
        <AdminMetric
          label="Lượt bắt trúng (Tiết kiệm Token)"
          value={totalHitCount}
          hint="Lượt câu hỏi không cần gọi LLM"
          tone="primary"
        />
      </AdminMetrics>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: 10, margin: "20px 0 24px", borderBottom: "2px solid #e2e8f0", paddingBottom: 12 }}>
        <button
          type="button"
          onClick={() => setActiveTab("rules")}
          style={{
            padding: "10px 20px",
            background: activeTab === "rules" ? "#2563eb" : "#f1f5f9",
            color: activeTab === "rules" ? "#fff" : "#334155",
            border: "none",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            transition: "all 0.15s"
          }}
        >
          ⚙️ 1. Quy Tắc Lọc Đầu Vào & FAQ ({rules.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("prompts")}
          style={{
            padding: "10px 20px",
            background: activeTab === "prompts" ? "#2563eb" : "#f1f5f9",
            color: activeTab === "prompts" ? "#fff" : "#334155",
            border: "none",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            transition: "all 0.15s"
          }}
        >
          🧠 2. Tùy Biến Prompt & Tham Số AI (3 Chức Năng)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("test")}
          style={{
            padding: "10px 20px",
            background: activeTab === "test" ? "#2563eb" : "#f1f5f9",
            color: activeTab === "test" ? "#fff" : "#334155",
            border: "none",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            transition: "all 0.15s"
          }}
        >
          🧪 3. Công Cụ Kiểm Thử Bộ Lọc (Simulator)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("system")}
          style={{
            padding: "10px 20px",
            background: activeTab === "system" ? "#2563eb" : "#f1f5f9",
            color: activeTab === "system" ? "#fff" : "#334155",
            border: "none",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            transition: "all 0.15s"
          }}
        >
          ⚙️ 4. Cấu Hình Hệ Thống & Token
        </button>
      </div>

      {/* ==================== TAB 1: QUY TẮC LỌC ==================== */}
      {activeTab === "rules" && (
        <AdminWorkspace>
          <AdminCard title="Danh Sách Quy Tắc Lọc Đầu Vào & Tự Động Phản Hồi">
            {/* Bộ Lọc Thanh Công Cụ */}
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 12, marginBottom: 18 }}>
              <input
                type="text"
                placeholder="🔍 Tìm theo tên quy tắc hoặc từ khóa/pattern..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                style={{
                  padding: "9px 14px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13
                }}
              />

              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
                style={{
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                {SCOPES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>

              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                style={{
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                {ACTIONS.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
            </div>

            {/* Bảng Danh Sách Rules */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                    <th style={{ padding: "12px 14px" }}>Quy Tắc & Pattern</th>
                    <th style={{ padding: "12px 14px" }}>Phạm Vi (Scope)</th>
                    <th style={{ padding: "12px 14px" }}>Hành Động</th>
                    <th style={{ padding: "12px 14px", textAlign: "center" }}>Ưu Tiên</th>
                    <th style={{ padding: "12px 14px", textAlign: "center" }}>Bắt Trúng</th>
                    <th style={{ padding: "12px 14px", textAlign: "center" }}>Trạng Thái</th>
                    <th style={{ padding: "12px 14px", textAlign: "right" }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: 30, color: "#64748b" }}>
                        Không tìm thấy quy tắc nào khớp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : null}

                  {filteredRules.map((rule) => {
                    const scopeItem = SCOPES.find((s) => s.id === rule.scope) || { label: rule.scope, color: "#475569" };
                    const actionItem = ACTIONS.find((a) => a.id === rule.action) || { label: rule.action, color: "#475569" };

                    return (
                      <tr key={rule.id} style={{ borderBottom: "1px solid #f1f5f9", background: rule.isActive ? "transparent" : "#fbfbfb" }}>
                        <td style={{ padding: "12px 14px" }}>
                          <strong style={{ display: "block", color: rule.isActive ? "#0f172a" : "#94a3b8" }}>{rule.name}</strong>
                          <code style={{ fontSize: 11, background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, color: "#475569" }}>
                            [{rule.matchType}] {rule.pattern}
                          </code>
                        </td>

                        <td style={{ padding: "12px 14px" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background: `${scopeItem.color}15`,
                            color: scopeItem.color,
                            border: `1px solid ${scopeItem.color}40`
                          }}>
                            {scopeItem.label.split(". ")[1] || scopeItem.label}
                          </span>
                        </td>

                        <td style={{ padding: "12px 14px" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background: `${actionItem.color}15`,
                            color: actionItem.color,
                            border: `1px solid ${actionItem.color}40`
                          }}>
                            {actionItem.label.split(" ")[0]} {actionItem.label.split(" ")[1] || ""}
                          </span>
                        </td>

                        <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 700, color: "#334155" }}>
                          {rule.priority || 50}
                        </td>

                        <td style={{ padding: "12px 14px", textAlign: "center" }}>
                          <span style={{
                            background: rule.hitCount > 0 ? "#eff6ff" : "#f1f5f9",
                            color: rule.hitCount > 0 ? "#1d4ed8" : "#94a3b8",
                            fontWeight: 800,
                            padding: "3px 8px",
                            borderRadius: 12,
                            fontSize: 11
                          }}>
                            {rule.hitCount || 0}
                          </span>
                        </td>

                        <td style={{ padding: "12px 14px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleToggleRule(rule)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 20,
                              border: "none",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              background: rule.isActive ? "#ecfdf5" : "#fef2f2",
                              color: rule.isActive ? "#059669" : "#dc2626"
                            }}
                          >
                            {rule.isActive ? "● BẬT" : "○ TẮT"}
                          </button>
                        </td>

                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(rule)}
                              style={{
                                padding: "4px 8px",
                                background: "#f8fafc",
                                border: "1px solid #cbd5e1",
                                borderRadius: 6,
                                cursor: "pointer",
                                fontSize: 12
                              }}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRule(rule)}
                              style={{
                                padding: "4px 8px",
                                background: "#fff1f2",
                                border: "1px solid #fecaca",
                                color: "#e11d48",
                                borderRadius: 6,
                                cursor: "pointer",
                                fontSize: 12
                              }}
                            >
                              Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </AdminCard>
        </AdminWorkspace>
      )}

      {/* ==================== TAB 2: TÙY BIẾN PROMPT CHO 3 CHỨC NĂNG ==================== */}
      {activeTab === "prompts" && (
        <AdminWorkspace>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
            {["GENERAL_CHAT", "BUILDER_SUGGEST", "BUILDER_AUDIT_CHAT"].map((scopeKey) => {
              const promptData = prompts[scopeKey] || {};
              const scopeInfo = SCOPES.find((s) => s.id === scopeKey) || {};

              return (
                <AdminCard
                  key={scopeKey}
                  title={`${scopeInfo.label || scopeKey}`}
                >
                  <div style={{ display: "grid", gap: 16 }}>
                    <AdminField label="Tên chức năng & Định danh">
                      <input
                        type="text"
                        value={promptData.name || ""}
                        onChange={(e) => {
                          setPrompts((prev) => ({
                            ...prev,
                            [scopeKey]: { ...prev[scopeKey], name: e.target.value }
                          }));
                        }}
                        style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                      />
                    </AdminField>

                    <AdminField label="System Prompt (Chỉ thị tối cao hướng dẫn hành vi của AI)">
                      <textarea
                        rows={6}
                        value={promptData.systemPrompt || ""}
                        onChange={(e) => {
                          setPrompts((prev) => ({
                            ...prev,
                            [scopeKey]: { ...prev[scopeKey], systemPrompt: e.target.value }
                          }));
                        }}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          fontFamily: "monospace",
                          fontSize: 13,
                          lineHeight: 1.5
                        }}
                      />
                    </AdminField>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                      <AdminField label="AI Model Engine">
                        <select
                          value={promptData.model || "gemini-1.5-flash"}
                          onChange={(e) => {
                            setPrompts((prev) => ({
                              ...prev,
                              [scopeKey]: { ...prev[scopeKey], model: e.target.value }
                            }));
                          }}
                          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                        >
                          <option value="gemini-1.5-flash">Gemini 1.5 Flash (Tốc độ cao, tối ưu chi phí)</option>
                          <option value="gemini-1.5-pro">Gemini 1.5 Pro (Suy luận sâu, logic phức tạp)</option>
                          <option value="mock">Mock Engine (Dành cho thử nghiệm offline)</option>
                        </select>
                      </AdminField>

                      <AdminField label={`Nhiệt độ (Temperature: ${promptData.temperature ?? 0.3})`}>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={promptData.temperature ?? 0.3}
                          onChange={(e) => {
                            setPrompts((prev) => ({
                              ...prev,
                              [scopeKey]: { ...prev[scopeKey], temperature: parseFloat(e.target.value) }
                            }));
                          }}
                        />
                      </AdminField>

                      <AdminField label="Giới hạn Token (Max Tokens)">
                        <input
                          type="number"
                          value={promptData.maxTokens || 1024}
                          onChange={(e) => {
                            setPrompts((prev) => ({
                              ...prev,
                              [scopeKey]: { ...prev[scopeKey], maxTokens: parseInt(e.target.value, 10) }
                            }));
                          }}
                          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                        />
                      </AdminField>
                    </div>

                    <div style={{ textAlign: "right", marginTop: 8 }}>
                      <AdminBtn
                        variant="primary"
                        onClick={() => handleSavePrompt(scopeKey)}
                        disabled={savingPromptScope === scopeKey}
                      >
                        {savingPromptScope === scopeKey ? "Đang lưu..." : "💾 Lưu Cấu Hình Prompt Này"}
                      </AdminBtn>
                    </div>
                  </div>
                </AdminCard>
              );
            })}
          </div>
        </AdminWorkspace>
      )}

      {/* ==================== TAB 3: TEST SIMULATOR ==================== */}
      {activeTab === "test" && (
        <AdminWorkspace>
          <AdminCard title="🧪 Công Cụ Kiểm Thử Bộ Lọc Đầu Vào Trực Quan">
            <p style={{ color: "#64748b", fontSize: 13, marginTop: 0 }}>
              Mô phỏng chính xác cách hệ thống tiếp nhận và phân luồng câu hỏi trước khi quyết định Tự Trả Lời (Local 0ms) hay Chuyển Tiếp Cho AI Engine.
            </p>

            <form onSubmit={handleRunTest} style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <AdminField label="Chọn Chức Năng Cần Kiểm Thử">
                  <select
                    value={testScope}
                    onChange={(e) => setTestScope(e.target.value)}
                    style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontWeight: 700 }}
                  >
                    <option value="GENERAL_CHAT">1. AI Chat Tư Vấn Chung</option>
                    <option value="BUILDER_SUGGEST">2. AI Đề Xuất Cấu Hình (32 linh kiện)</option>
                    <option value="BUILDER_AUDIT_CHAT">3. AI Giám Định & Chat Build PC</option>
                  </select>
                </AdminField>

                <AdminField label="Ngân sách giả lập (VNĐ)">
                  <input
                    type="number"
                    step="500000"
                    value={testBudget}
                    onChange={(e) => setTestBudget(Number(e.target.value))}
                    style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                </AdminField>
              </div>

              <AdminField label="Nội dung câu hỏi hoặc yêu cầu kiểm thử">
                <textarea
                  rows={3}
                  placeholder="Nhập thử: 'Chính sách bảo hành thế nào', 'Nguồn có nổ không', 'Nấu canh bí đỏ', hoặc 'Build PC gaming 3 triệu'..."
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
                />
              </AdminField>

              <div>
                <AdminBtn
                  variant="primary"
                  type="submit"
                  disabled={isTesting || (!testText.trim() && testScope !== "BUILDER_SUGGEST")}
                >
                  {isTesting ? "Đang kiểm tra..." : "🚀 Chạy Kiểm Thử Bộ Lọc"}
                </AdminBtn>
              </div>
            </form>

            {/* Kết Quả Mô Phỏng */}
            {testResult && (
              <div style={{
                marginTop: 24,
                padding: 20,
                borderRadius: 12,
                background: testResult.handled
                  ? testResult.action === "BLOCK"
                    ? "#fef2f2"
                    : "#ecfdf5"
                  : "#eff6ff",
                border: "2px solid " + (testResult.handled ? (testResult.action === "BLOCK" ? "#fca5a5" : "#6ee7b7") : "#93c5fd")
              }}>
                <h4 style={{ margin: "0 0 10px", fontSize: 16 }}>
                  {testResult.handled ? (
                    testResult.action === "BLOCK" ? (
                      <span style={{ color: "#dc2626" }}>🛡️ ĐÃ BỊ CHẶN BỞI BỘ LỌC (BLOCK)</span>
                    ) : (
                      <span style={{ color: "#059669" }}>⚡ TỰ TRẢ LỜI NGAY TẠI CHỖ (DIRECT REPLY - 0ms, 0$ TOKEN)</span>
                    )
                  ) : (
                    <span style={{ color: "#1d4ed8" }}>🤖 VƯỢT QUA BỘ LỌC TẦNG 1 ➔ CHUYỂN TIẾP CHO AI LLM API</span>
                  )}
                </h4>

                <div style={{ display: "grid", gap: 8, fontSize: 13.5 }}>
                  <div>
                    <strong>Quy tắc bắt trúng:</strong>{" "}
                    {testResult.ruleName ? (
                      <span style={{ fontWeight: 700, color: "#0f172a" }}>{testResult.ruleName} (ID: {testResult.ruleId})</span>
                    ) : (
                      <span style={{ color: "#64748b" }}>Không khớp quy tắc tĩnh nào ➔ Cần trí tuệ nhân tạo suy luận</span>
                    )}
                  </div>

                  <div>
                    <strong>Mô hình phụ trách:</strong> <code>{testResult.model}</code>
                  </div>

                  {testResult.reply ? (
                    <div style={{ marginTop: 10, background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <strong>Nội dung phản hồi cho khách:</strong>
                      <p style={{ margin: "6px 0 0", whiteSpace: "pre-line", color: "#334155" }}>{testResult.reply}</p>
                    </div>
                  ) : null}

                  {testResult.promptInjections && testResult.promptInjections.length > 0 ? (
                    <div style={{ marginTop: 10, background: "#fffbeb", padding: 14, borderRadius: 8, border: "1px solid #fde68a" }}>
                      <strong>Chỉ thị đặc biệt được tiêm vào System Prompt:</strong>
                      <ul style={{ margin: "6px 0 0", paddingLeft: 20, color: "#92400e" }}>
                        {testResult.promptInjections.map((inj, idx) => (
                          <li key={idx}>{inj}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </AdminCard>
        </AdminWorkspace>
      )}

      {/* ==================== TAB 4: SYSTEM CONFIG & TOKEN ANALYSIS ==================== */}
      {activeTab === "system" && (
        <AdminWorkspace>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20 }}>
            {/* Cột 1: Cấu hình tập trung */}
            <AdminCard title="⚙️ Cấu Hình Tập Trung Hệ Thống AI & Nhà Cung Cấp">
              <p style={{ color: "#64748b", fontSize: 13, marginTop: 0 }}>
                Quản lý tập trung toàn bộ tham số kỹ thuật, nhà cung cấp LLM, độ sáng tạo và mức giới hạn token của hệ thống PC Mall.
              </p>

              <form onSubmit={handleSaveSystemConfig} style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <AdminField label="Nhà Cung Cấp LLM (Provider)">
                    <select
                      value={systemConfig.provider}
                      onChange={(e) => setSystemConfig((prev) => ({ ...prev, provider: e.target.value }))}
                      style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                    >
                      <option value="gemini">Google Gemini (Khuyên dùng - Flash 1.5/2.0)</option>
                      <option value="groq">Groq Llama 3 (Tốc độ cực nhanh)</option>
                      <option value="openai">OpenAI (GPT-4o, GPT-4o-mini)</option>
                      <option value="ollama">Ollama Local (Chạy máy chủ nội bộ)</option>
                    </select>
                  </AdminField>

                  <AdminField label="Mô Hình (Model Name)">
                    <input
                      type="text"
                      value={systemConfig.model}
                      onChange={(e) => setSystemConfig((prev) => ({ ...prev, model: e.target.value }))}
                      placeholder="gemini-1.5-flash, llama-3.3-70b-versatile..."
                      style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                    />
                  </AdminField>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <AdminField label={`Độ Sáng Tạo (Temperature: ${systemConfig.temperature})`}>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={systemConfig.temperature}
                      onChange={(e) => setSystemConfig((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                    />
                    <small style={{ color: "#64748b", fontSize: 11 }}>0.2 - 0.4: Chính xác, trung thực (Khuyên dùng cho linh kiện)</small>
                  </AdminField>

                  <AdminField label="Giới Hạn Token Đầu Ra (Max Output Tokens)">
                    <select
                      value={systemConfig.maxTokens}
                      onChange={(e) => setSystemConfig((prev) => ({ ...prev, maxTokens: parseInt(e.target.value, 10) }))}
                      style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                    >
                      <option value={1024}>1024 tokens (~750 từ tiếng Việt)</option>
                      <option value={1536}>1536 tokens (~1150 từ tiếng Việt)</option>
                      <option value={2048}>2048 tokens (~1500 từ tiếng Việt - Chuẩn)</option>
                      <option value={4096}>4096 tokens (~3000 từ tiếng Việt - Chuyên sâu)</option>
                    </select>
                  </AdminField>
                </div>

                <AdminField label="Số Lượng Sản Phẩm Kho Hàng Gửi Kèm (Max Grounded Products)">
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input
                      type="number"
                      min={10}
                      max={100}
                      step={5}
                      value={systemConfig.maxCatalogProducts}
                      onChange={(e) => setSystemConfig((prev) => ({ ...prev, maxCatalogProducts: parseInt(e.target.value, 10) || 35 }))}
                      style={{ width: 120, padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                    />
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      sản phẩm (Khuyên dùng: 25 - 35 để chống hiện tượng "Lost-in-the-middle")
                    </span>
                  </div>
                </AdminField>

                {/* API KEY BẢO VỆ NHẠY CẢM */}
                <div style={{ background: "#f8fafc", padding: 14, borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <AdminField label="Khóa API Cung Cấp Dịch Vụ (Bảo Mật Cao)">
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input
                        type="password"
                        placeholder={systemConfig.apiKeyMasked || "Chưa thiết lập API Key"}
                        value={systemConfig.apiKey}
                        onChange={(e) => setSystemConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                        style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                      />
                      <span style={{ fontSize: 12, color: systemConfig.hasApiKey ? "#059669" : "#dc2626", fontWeight: 700 }}>
                        {systemConfig.hasApiKey ? "🟢 Đã kết nối" : "🔴 Chưa có Key"}
                      </span>
                    </div>
                    <small style={{ color: "#64748b", fontSize: 11, display: "block", marginTop: 4 }}>
                      🔒 Khóa API được mã hóa và che mờ trên màn hình. Chỉ nhập vào ô trên khi bạn muốn thay đổi khóa mới.
                    </small>
                  </AdminField>
                </div>

                <div style={{ textAlign: "right", marginTop: 10 }}>
                  <AdminBtn variant="primary" type="submit" disabled={savingSystemConfig}>
                    {savingSystemConfig ? "Đang lưu..." : "💾 Lưu & Đồng Bộ Hệ Thống AI"}
                  </AdminBtn>
                </div>
              </form>
            </AdminCard>

            {/* Cột 2: Dự toán Token */}
            <AdminCard title="📊 Bảng Phân Tích & Dự Toán Token (100 Sản Phẩm)">
              <p style={{ color: "#64748b", fontSize: 13, marginTop: 0 }}>
                Đánh giá chi phí token và hiệu năng giữa các phương thức đóng gói dữ liệu kho hàng gửi vào LLM API.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: 14, borderRadius: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <strong style={{ color: "#166534", fontSize: 14 }}>✅ Định Dạng Dòng Nén (Đang áp dụng)</strong>
                    <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                      Khuyên dùng
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                    <div>• <strong>Token / sản phẩm:</strong> ~28 tokens (Mã, Tên, Giá, Tồn, Specs)</div>
                    <div>• <strong>Gửi 100 sản phẩm:</strong> ~2.800 tokens sản phẩm</div>
                    <div>• <strong>Tổng Input Tokens (kèm Prompt):</strong> <strong>~3.750 tokens</strong></div>
                    <div>• <strong>Chi phí (1.000 câu hỏi):</strong> ~$0.0003 / câu (~8 VNĐ)</div>
                  </div>
                </div>

                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: 14, borderRadius: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <strong style={{ color: "#991b1b", fontSize: 14 }}>❌ Định Dạng Raw JSON Phân Cấp</strong>
                    <span style={{ background: "#fee2e2", color: "#b91c1c", padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                      Không khuyến khích
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                    <div>• <strong>Token / sản phẩm:</strong> ~95 tokens (ngoặc nhọn, key-value rườm rà)</div>
                    <div>• <strong>Gửi 100 sản phẩm:</strong> ~9.500 tokens sản phẩm</div>
                    <div>• <strong>Tổng Input Tokens:</strong> <strong>~10.500 - 12.000 tokens</strong></div>
                    <div>• <strong>Nhược điểm:</strong> Tốn gấp 3.5 lần token và gây hiện tượng Lost-in-the-middle.</div>
                  </div>
                </div>

                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: 14, borderRadius: 12 }}>
                  <strong style={{ color: "#1e40af", fontSize: 13.5, display: "block", marginBottom: 4 }}>
                    💡 Cấu Hình Đầu Ra Hiện Tại
                  </strong>
                  <div style={{ fontSize: 13, color: "#1e3a8a", lineHeight: 1.5 }}>
                    <div>• <strong>Giới hạn sinh ra (Max Output):</strong> <strong>{systemConfig.maxTokens} tokens</strong></div>
                    <div>• <strong>Tương đương:</strong> ~{Math.round(systemConfig.maxTokens * 0.75)} từ tiếng Việt</div>
                    <div>• Đủ để trình bày phân tích chuyên sâu, so sánh bảng biểu và danh sách đề xuất sản phẩm thật.</div>
                  </div>
                </div>
              </div>
            </AdminCard>
          </div>
        </AdminWorkspace>
      )}

      {/* ==================== MODAL THÊM / SỬA QUY TẮC ==================== */}
      {isModalOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: 16,
            width: "100%",
            maxWidth: 680,
            maxHeight: "90vh",
            overflowY: "auto",
            padding: 24,
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)"
          }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18, color: "#0f172a" }}>
              {editingRule ? `✏️ Chỉnh Sửa Quy Tắc: ${editingRule.name}` : "➕ Thêm Quy Tắc Lọc Đầu Vào Mới"}
            </h3>

            <form onSubmit={handleSaveRule} style={{ display: "grid", gap: 14 }}>
              <AdminField label="Tên quy tắc">
                <input
                  type="text"
                  placeholder="Ví dụ: Chính sách bảo hành, Chặn câu hỏi nấu ăn..."
                  value={ruleFormData.name}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, name: e.target.value })}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  required
                />
              </AdminField>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <AdminField label="Phạm vi áp dụng (Scope)">
                  <select
                    value={ruleFormData.scope}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, scope: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  >
                    <option value="GENERAL_CHAT">1. AI Chat Tư Vấn Chung</option>
                    <option value="BUILDER_SUGGEST">2. AI Đề Xuất Build PC (32 linh kiện)</option>
                    <option value="BUILDER_AUDIT_CHAT">3. AI Giám Định & Chat Build PC</option>
                    <option value="GLOBAL">Toàn bộ hệ thống</option>
                  </select>
                </AdminField>

                <AdminField label="Kiểu so khớp (Match Type)">
                  <select
                    value={ruleFormData.matchType}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, matchType: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  >
                    {MATCH_TYPES.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </AdminField>
              </div>

              <AdminField label="Mẫu khớp (Pattern / Từ khóa / Regex / Ngưỡng ngân sách)">
                <input
                  type="text"
                  placeholder="Ví dụ: bao hanh,doi tra  HOẶC  < 5000000  HOẶC  ^(chao|hi)\\b"
                  value={ruleFormData.pattern}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, pattern: e.target.value })}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontFamily: "monospace" }}
                  required
                />
              </AdminField>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <AdminField label="Hành động khi khớp (Action)">
                  <select
                    value={ruleFormData.action}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, action: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontWeight: 700 }}
                  >
                    <option value="DIRECT_REPLY">⚡ Tự trả lời ngay (DIRECT_REPLY - 0ms, 0$ token)</option>
                    <option value="BLOCK">🛡️ Chặn câu hỏi (BLOCK - Không phục vụ)</option>
                    <option value="SYSTEM_INJECT">💉 Tiêm chỉ thị vào Prompt (SYSTEM_INJECT)</option>
                  </select>
                </AdminField>

                <AdminField label="Độ ưu tiên (1 - 100, số lớn ưu tiên trước)">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={ruleFormData.priority}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, priority: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                </AdminField>
              </div>

              {ruleFormData.action === "DIRECT_REPLY" && (
                <AdminField label="Nội dung câu trả lời tự động (Hệ thống xuất trực tiếp cho người dùng)">
                  <textarea
                    rows={4}
                    placeholder="Nhập nội dung câu trả lời chuẩn xác. Hỗ trợ định dạng markdown..."
                    value={ruleFormData.directReply}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, directReply: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                    required
                  />
                </AdminField>
              )}

              {ruleFormData.action === "BLOCK" && (
                <AdminField label="Lý do từ chối (Hiển thị cảnh báo cho người dùng)">
                  <textarea
                    rows={3}
                    placeholder="Ví dụ: Rất tiếc, hệ thống chỉ hỗ trợ tư vấn máy tính và linh kiện..."
                    value={ruleFormData.blockReason}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, blockReason: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                    required
                  />
                </AdminField>
              )}

              {ruleFormData.action === "SYSTEM_INJECT" && (
                <AdminField label="Chỉ thị đặc biệt tiêm vào System Prompt của AI">
                  <textarea
                    rows={3}
                    placeholder="Ví dụ: Bắt buộc chỉ ra phần trăm nghẽn và đề xuất linh kiện thay thế..."
                    value={ruleFormData.promptInjection}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, promptInjection: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                    required
                  />
                </AdminField>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: "8px 16px",
                    background: "#f1f5f9",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                >
                  Hủy
                </button>
                <AdminBtn variant="primary" type="submit">
                  {editingRule ? "Lưu Thay Đổi" : "Tạo Quy Tắc"}
                </AdminBtn>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
