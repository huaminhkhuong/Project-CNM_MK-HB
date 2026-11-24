import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AdminAlerts, AdminPage, useAdminToast } from "../../components/admin/AdminUi";
import {
  changeAdminCompatibilityRuleStatus,
  createAdminCompatibilityRule,
  getAdminCompatibilityRules,
  updateAdminCompatibilityRule
} from "../../services/admin-compatibility.service";
import { formatAdminNumber, getAdminErrorMessage, normalizeAdminList } from "../../utils/adminUi";
import "../../styles/admin-ai-studio.css";
import "../../styles/admin-catalog-studio.css";

const COMPONENT_OPTIONS = ["CPU", "MAINBOARD", "RAM", "GPU", "STORAGE", "SSD", "HDD", "PSU", "CASE", "COOLING"];
const RULE_TYPE_OPTIONS = [
  { value: "ATTRIBUTE_MATCH", label: "Khớp thuộc tính (ATTRIBUTE_MATCH)" },
  { value: "ATTRIBUTE_NOT_MATCH", label: "Loại trừ xung đột (ATTRIBUTE_NOT_MATCH)" }
];

const QUICK_RULE_PRESETS = [
  {
    label: "CPU ↔ Mainboard (Socket)",
    name: "Khớp chuẩn Socket CPU & Mainboard",
    sourceComponentType: "CPU",
    targetComponentType: "MAINBOARD",
    ruleType: "ATTRIBUTE_MATCH",
    sourceAttributeKey: "socket",
    targetAttributeKey: "socket",
    description: "CPU và Bo mạch chủ phải sử dụng cùng chuẩn Socket (LGA1700, AM5, AM4...)."
  },
  {
    label: "RAM ↔ Mainboard (DDR)",
    name: "Khớp chuẩn RAM DDR4/DDR5 & Mainboard",
    sourceComponentType: "RAM",
    targetComponentType: "MAINBOARD",
    ruleType: "ATTRIBUTE_MATCH",
    sourceAttributeKey: "ram_type",
    targetAttributeKey: "ram_type",
    description: "Chuẩn thế hệ RAM (DDR4/DDR5) phải trùng khớp với khe cắm trên Mainboard."
  },
  {
    label: "SSD M.2 ↔ Mainboard",
    name: "Tương thích giao tiếp SSD M.2 NVMe & Mainboard",
    sourceComponentType: "SSD",
    targetComponentType: "MAINBOARD",
    ruleType: "ATTRIBUTE_MATCH",
    sourceAttributeKey: "interface",
    targetAttributeKey: "m2_slot",
    description: "Kiểm tra giao tiếp khe cắm M.2 NVMe giữa ổ cứng SSD và bo mạch chủ."
  },
  {
    label: "Case ↔ Mainboard (Form)",
    name: "Khớp kích thước vỏ Case & chuẩn Mainboard",
    sourceComponentType: "CASE",
    targetComponentType: "MAINBOARD",
    ruleType: "ATTRIBUTE_MATCH",
    sourceAttributeKey: "form_factor",
    targetAttributeKey: "form_factor",
    description: "Vỏ máy tính phải hỗ trợ chuẩn kích thước bo mạch chủ (ATX, Micro-ATX, Mini-ITX)."
  }
];

function createInitialFormState() {
  return {
    name: "",
    sourceComponentType: "CPU",
    targetComponentType: "MAINBOARD",
    ruleType: "ATTRIBUTE_MATCH",
    sourceAttributeKey: "socket",
    targetAttributeKey: "socket",
    description: ""
  };
}

function normalizeRule(rule) {
  return {
    id: rule?.id,
    name: rule?.name || rule?.description || "Rule",
    sourceComponentType: String(rule?.sourceComponentType || rule?.source_component_type || "").toUpperCase(),
    targetComponentType: String(rule?.targetComponentType || rule?.target_component_type || "").toUpperCase(),
    ruleType: String(rule?.ruleType || rule?.rule_type || "ATTRIBUTE_MATCH").toUpperCase(),
    sourceAttributeKey: rule?.sourceAttributeKey || rule?.source_attribute_key || "",
    targetAttributeKey: rule?.targetAttributeKey || rule?.target_attribute_key || "",
    description: rule?.description || "",
    status: String(rule?.status || "ACTIVE").toUpperCase()
  };
}

function validateForm(values) {
  const errors = {};
  if (!String(values.name || "").trim()) errors.name = "Vui lòng nhập tên quy tắc tương thích.";
  if (!String(values.ruleType || "").trim()) errors.ruleType = "Vui lòng chọn loại quy tắc.";
  if (!String(values.sourceAttributeKey || "").trim()) errors.sourceAttributeKey = "Vui lòng nhập khóa thuộc tính nguồn.";
  if (!String(values.targetAttributeKey || "").trim()) errors.targetAttributeKey = "Vui lòng nhập khóa thuộc tính đích.";
  return errors;
}

function getComponentBadgeStyle(type) {
  switch (String(type || "").toUpperCase()) {
    case "CPU": return { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
    case "MAINBOARD": return { bg: "#eef2ff", color: "#4338ca", border: "#c7d2fe" };
    case "RAM": return { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" };
    case "GPU": return { bg: "#faf5ff", color: "#7e22ce", border: "#e9d5ff" };
    case "SSD":
    case "HDD":
    case "STORAGE": return { bg: "#ecfeff", color: "#0e7490", border: "#a5f3fc" };
    case "PSU": return { bg: "#fffbeb", color: "#b45309", border: "#fde68a" };
    case "CASE": return { bg: "#f1f5f9", color: "#334155", border: "#cbd5e1" };
    case "COOLING": return { bg: "#f0f9ff", color: "#0369a1", border: "#bae6fd" };
    default: return { bg: "#f8fafc", color: "#475569", border: "#e2e8f0" };
  }
}

function getRuleTypeLabel(ruleType) {
  return String(ruleType).toUpperCase() === "ATTRIBUTE_NOT_MATCH" ? "Loại trừ xung đột" : "Khớp thuộc tính";
}

export function AdminCompatibilityRulesPage() {
  const [rules, setRules] = useState([]);
  const [formValues, setFormValues] = useState(createInitialFormState());
  const [formErrors, setFormErrors] = useState({});
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [componentFilter, setComponentFilter] = useState("ALL");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useAdminToast(successMessage, () => setSuccessMessage(""));

  const stats = useMemo(() => {
    const active = rules.filter((r) => r.status === "ACTIVE").length;
    const inactive = rules.length - active;
    const pairs = new Set(rules.map((r) => `${r.sourceComponentType}->${r.targetComponentType}`)).size;
    return { total: rules.length, active, inactive, pairs };
  }, [rules]);

  const sortedRules = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    return [...rules]
      .filter((r) => {
        if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
        if (
          componentFilter !== "ALL" &&
          r.sourceComponentType !== componentFilter &&
          r.targetComponentType !== componentFilter
        ) {
          return false;
        }
        if (!q) return true;
        return [
          `#${r.id}`,
          r.name,
          r.sourceComponentType,
          r.targetComponentType,
          r.sourceAttributeKey,
          r.targetAttributeKey,
          r.description
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  }, [rules, searchKeyword, statusFilter, componentFilter]);

  useEffect(() => {
    async function loadRules() {
      try {
        setLoading(true);
        const response = await getAdminCompatibilityRules();
        setRules(normalizeAdminList(response).map(normalizeRule));
      } catch (error) {
        setErrorMessage(getAdminErrorMessage(error, "Không thể tải danh sách luật tương thích."));
      } finally {
        setLoading(false);
      }
    }
    loadRules();
  }, []);

  function resetForm() {
    setFormValues(createInitialFormState());
    setFormErrors({});
    setEditingRuleId(null);
  }

  function openCreateDrawer() {
    resetForm();
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
    resetForm();
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function applyPreset(preset) {
    setFormValues({
      name: preset.name,
      sourceComponentType: preset.sourceComponentType,
      targetComponentType: preset.targetComponentType,
      ruleType: preset.ruleType,
      sourceAttributeKey: preset.sourceAttributeKey,
      targetAttributeKey: preset.targetAttributeKey,
      description: preset.description
    });
    setFormErrors({});
  }

  function handleEditRule(rule) {
    setEditingRuleId(rule.id);
    setFormValues({
      name: rule.name,
      sourceComponentType: rule.sourceComponentType,
      targetComponentType: rule.targetComponentType,
      ruleType: rule.ruleType,
      sourceAttributeKey: rule.sourceAttributeKey,
      targetAttributeKey: rule.targetAttributeKey,
      description: rule.description
    });
    setFormErrors({});
    setIsDrawerOpen(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateForm(formValues);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      setSubmitting(true);
      setErrorMessage("");
      const payload = {
        name: formValues.name.trim(),
        sourceComponentType: formValues.sourceComponentType,
        targetComponentType: formValues.targetComponentType,
        ruleType: formValues.ruleType,
        sourceAttributeKey: formValues.sourceAttributeKey.trim(),
        targetAttributeKey: formValues.targetAttributeKey.trim(),
        description: String(formValues.description || "").trim()
      };
      const response = editingRuleId
        ? await updateAdminCompatibilityRule(editingRuleId, payload)
        : await createAdminCompatibilityRule(payload);
      const saved = normalizeRule(response?.data || response);
      setRules((prev) => (editingRuleId ? prev.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...prev]));
      setSuccessMessage(editingRuleId ? `Đã cập nhật Rule #${saved.id} thành công.` : `Đã khởi tạo Rule #${saved.id} mới thành công.`);
      closeDrawer();
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể lưu luật tương thích."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(rule) {
    const nextStatus = rule.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      setStatusLoadingId(rule.id);
      setErrorMessage("");
      const response = await changeAdminCompatibilityRuleStatus(rule.id, nextStatus);
      const updated = normalizeRule(response?.data || response);
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setSuccessMessage(
        nextStatus === "ACTIVE"
          ? `Đã kích hoạt lại Rule #${rule.id} trên Smart PC Builder.`
          : `Đã tạm tắt Rule #${rule.id}.`
      );
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể đổi trạng thái quy tắc."));
    } finally {
      setStatusLoadingId(null);
    }
  }

  const hasFilters = Boolean(searchKeyword.trim() || statusFilter !== "ALL" || componentFilter !== "ALL");

  return (
    <AdminPage>
      <div className="cat-studio-shell">
        {/* ==================== EXECUTIVE COMPATIBILITY ENGINE HERO ==================== */}
        <section className="ai-studio-hero">
          <div className="ai-studio-hero-top">
            <div>
              <div className="ai-studio-hero-badges">
                <span className="ai-studio-live-pill">
                  <span className="ai-studio-live-dot" />
                  PC Builder Rule Engine
                </span>
                <span className="ai-studio-tech-pill">Socket • DDR • M.2 • PSU • Form Factor</span>
              </div>
              <h1 className="ai-studio-hero-title">Trung Tâm Luật Tương Thích Linh Kiện</h1>
              <p className="ai-studio-hero-desc">
                Định nghĩa và kiểm soát ma trận quy tắc đối chiếu phần cứng giữa các cặp linh kiện nguồn → đích, áp dụng kiểm tra tức thì khi khách hàng xây dựng cấu hình trên Smart PC Builder.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Link
                to="/pc-builder"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "10px 15px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#f8fafc",
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: "none",
                  backdropFilter: "blur(8px)"
                }}
              >
                Mở PC Builder ↗
              </Link>
              <Link
                to="/tech/compatibility"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "10px 15px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#f8fafc",
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: "none",
                  backdropFilter: "blur(8px)"
                }}
              >
                Xem (Tech)
              </Link>
              <button type="button" className="ai-studio-hero-cta" onClick={openCreateDrawer}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                <span>Thêm Rule Mới</span>
              </button>
            </div>
          </div>

          <div className="ai-studio-kpi-grid">
            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#38bdf8" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Tổng luật tương thích</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value">{formatAdminNumber(stats.total)}</div>
              <div className="ai-studio-kpi-hint">Quy tắc được định nghĩa</div>
            </div>

            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#34d399" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Đang áp dụng</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value" style={{ color: "#6ee7b7" }}>{formatAdminNumber(stats.active)}</div>
              <div className="ai-studio-kpi-hint">Tự động chặn lỗi trên PC Builder</div>
            </div>

            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#fbbf24" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Đang tạm tắt</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10" /><line x1="10" y1="15" x2="10" y2="9" /><line x1="14" y1="15" x2="14" y2="9" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value" style={{ color: stats.inactive > 0 ? "#fcd34d" : "#94a3b8" }}>
                {formatAdminNumber(stats.inactive)}
              </div>
              <div className="ai-studio-kpi-hint">Bỏ qua khi kiểm tra cấu hình</div>
            </div>

            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#a78bfa" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Cặp linh kiện</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value">{formatAdminNumber(stats.pairs)}</div>
              <div className="ai-studio-kpi-hint">Nhóm liên kết phần cứng</div>
            </div>
          </div>
        </section>

        <AdminAlerts errorMessage={errorMessage} successMessage={successMessage} />

        {/* ==================== FULL-WIDTH COMPATIBILITY RULES MATRIX ==================== */}
        <section className="ai-studio-panel">
          <div className="ai-studio-panel-head">
            <div className="ai-studio-panel-title-wrap">
              <span className="ai-studio-panel-icon" style={{ background: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
              </span>
              <div>
                <h3 className="ai-studio-panel-title">
                  Danh Sách Luật Tương Thích{" "}
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", marginLeft: 4 }}>
                    {formatAdminNumber(sortedRules.length)} quy tắc
                  </span>
                </h3>
                <p className="ai-studio-panel-sub">Bật/tắt tức thì hoặc chỉnh sửa khóa đối chiếu thuộc tính áp dụng cho trình dựng PC Builder</p>
              </div>
            </div>

            <button type="button" className="ai-action-btn ai-action-btn--ghost" onClick={openCreateDrawer}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
              <span>Tạo Rule</span>
            </button>
          </div>

          <div className="cat-toolbar">
            <div className="cat-search-wrap">
              <svg className="cat-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="cat-input cat-input--search"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm theo #ID, tên quy tắc, linh kiện (CPU, RAM, SSD) hoặc khóa thuộc tính..."
              />
            </div>

            <select
              className="cat-select"
              style={{ flex: "0 1 180px" }}
              value={componentFilter}
              onChange={(e) => setComponentFilter(e.target.value)}
            >
              <option value="ALL">Tất cả linh kiện</option>
              {COMPONENT_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { id: "ALL", label: "Tất cả" },
                { id: "ACTIVE", label: `Đang bật (${stats.active})` },
                { id: "INACTIVE", label: `Tạm tắt (${stats.inactive})` }
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setStatusFilter(pill.id)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 999,
                    border: statusFilter === pill.id ? "1px solid #0f172a" : "1px solid #e2e8f0",
                    background: statusFilter === pill.id ? "#0f172a" : "#ffffff",
                    color: statusFilter === pill.id ? "#ffffff" : "#475569",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {hasFilters && (
              <button
                type="button"
                className="cat-btn-clear"
                onClick={() => {
                  setSearchKeyword("");
                  setStatusFilter("ALL");
                  setComponentFilter("ALL");
                }}
              >
                Xóa lọc
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: "56px 24px", textAlign: "center", color: "#64748b", fontSize: 13.5 }}>
              Đang tải ma trận luật tương thích...
            </div>
          ) : sortedRules.length === 0 ? (
            <div style={{ padding: "56px 24px", textAlign: "center", color: "#64748b" }}>
              <strong style={{ display: "block", fontSize: 15, color: "#0f172a", marginBottom: 4 }}>
                Không tìm thấy luật tương thích phù hợp
              </strong>
              <span style={{ fontSize: 13 }}>Thử xóa bộ lọc hoặc bấm "Thêm Rule Mới" để khởi tạo quy tắc mới.</span>
            </div>
          ) : (
            <div className="cat-table-scroll">
              <table className="cat-table">
                <thead>
                  <tr>
                    <th>Quy Tắc &amp; Mô Tả</th>
                    <th>Cặp Linh Kiện</th>
                    <th>Khóa Đối Chiếu</th>
                    <th>Trạng Thái</th>
                    <th style={{ textAlign: "right" }}>Tác Vụ</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRules.map((rule) => {
                    const srcStyle = getComponentBadgeStyle(rule.sourceComponentType);
                    const tgtStyle = getComponentBadgeStyle(rule.targetComponentType);
                    const isActive = rule.status === "ACTIVE";
                    const isNotMatch = rule.ruleType === "ATTRIBUTE_NOT_MATCH";

                    return (
                      <tr key={rule.id}>
                        <td style={{ maxWidth: 420 }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                            <span style={{
                              fontFamily: "ui-monospace, monospace",
                              fontSize: 11.5,
                              fontWeight: 800,
                              padding: "2px 7px",
                              borderRadius: 6,
                              background: "#f1f5f9",
                              color: "#334155",
                              border: "1px solid #e2e8f0",
                              flexShrink: 0,
                              marginTop: 1
                            }}>
                              #{rule.id}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div className="cat-prod-title">{rule.name}</div>
                              <div style={{ fontSize: 12, color: "#64748b", marginTop: 3, lineHeight: 1.45 }}>
                                {rule.description || "Không có mô tả bổ sung."}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={{ whiteSpace: "nowrap" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{
                              padding: "3px 9px",
                              borderRadius: 7,
                              fontSize: 11.5,
                              fontWeight: 800,
                              background: srcStyle.bg,
                              color: srcStyle.color,
                              border: `1px solid ${srcStyle.border}`
                            }}>
                              {rule.sourceComponentType}
                            </span>
                            <span style={{ color: "#94a3b8", fontWeight: 800, fontSize: 13 }}>→</span>
                            <span style={{
                              padding: "3px 9px",
                              borderRadius: 7,
                              fontSize: 11.5,
                              fontWeight: 800,
                              background: tgtStyle.bg,
                              color: tgtStyle.color,
                              border: `1px solid ${tgtStyle.border}`
                            }}>
                              {rule.targetComponentType}
                            </span>
                          </div>
                          <div style={{ marginTop: 5 }}>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: isNotMatch ? "#b91c1c" : "#475569",
                              background: isNotMatch ? "#fef2f2" : "#f8fafc",
                              border: `1px solid ${isNotMatch ? "#fecaca" : "#e2e8f0"}`,
                              padding: "1px 7px",
                              borderRadius: 5
                            }}>
                              {getRuleTypeLabel(rule.ruleType)}
                            </span>
                          </div>
                        </td>

                        <td style={{ whiteSpace: "nowrap" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <code className="cat-prod-slug" style={{ marginTop: 0 }}>{rule.sourceAttributeKey}</code>
                            <span style={{ color: isNotMatch ? "#dc2626" : "#2563eb", fontWeight: 900, fontSize: 13 }}>
                              {isNotMatch ? "≠" : "⇄"}
                            </span>
                            <code className="cat-prod-slug" style={{ marginTop: 0 }}>{rule.targetAttributeKey}</code>
                          </div>
                        </td>

                        <td>
                          <span className={`cat-status-pill ${isActive ? "is-active" : "is-hidden"}`}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: isActive ? "#10b981" : "#94a3b8" }} />
                            <span>{isActive ? "Đang áp dụng" : "Tạm tắt"}</span>
                          </span>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <div className="cat-row-actions">
                            <button
                              type="button"
                              className="ai-action-btn ai-action-btn--ghost"
                              onClick={() => handleEditRule(rule)}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="ai-action-btn ai-action-btn--ghost"
                              disabled={statusLoadingId === rule.id}
                              onClick={() => handleToggleStatus(rule)}
                              style={
                                isActive
                                  ? { color: "#b45309", borderColor: "#fde68a", background: "#fffbeb" }
                                  : { color: "#047857", borderColor: "#a7f3d0", background: "#ecfdf5" }
                              }
                            >
                              {statusLoadingId === rule.id ? "..." : isActive ? "Tắt" : "Bật"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ==================== SLIDE-OVER RULE EDITOR DRAWER ==================== */}
        {isDrawerOpen && (
          <div
            className="cat-drawer-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget && !submitting) closeDrawer();
            }}
          >
            <div className="cat-drawer">
              <div className="cat-drawer-head">
                <div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#7dd3fc" }}>
                    {editingRuleId ? `Chỉnh sửa quy tắc #${editingRuleId}` : "Khởi tạo quy tắc mới"}
                  </span>
                  <h3 style={{ margin: "3px 0 0", fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
                    {editingRuleId ? "Cập Nhật Luật Tương Thích" : "Thêm Luật Tương Thích Mới"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.1)",
                    color: "#e2e8f0",
                    cursor: "pointer",
                    fontSize: 15
                  }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                <div className="cat-drawer-body">
                  {/* Quick Rule Presets */}
                  {!editingRuleId && (
                    <div style={{ padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#475569", marginBottom: 7 }}>
                        Mẫu quy tắc phổ biến (1-chạm):
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {QUICK_RULE_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            className="cat-warranty-chip"
                            onClick={() => applyPreset(preset)}
                          >
                            + {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Live Visual Formula Preview */}
                  <div style={{
                    padding: "11px 14px",
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                    color: "#f8fafc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    flexWrap: "wrap",
                    fontSize: 12.5,
                    fontWeight: 700
                  }}>
                    <span style={{ color: "#38bdf8" }}>{formValues.sourceComponentType}</span>
                    <code style={{ background: "rgba(255,255,255,0.12)", padding: "2px 7px", borderRadius: 5, fontSize: 11.5 }}>
                      {formValues.sourceAttributeKey || "source_key"}
                    </code>
                    <span style={{ color: formValues.ruleType === "ATTRIBUTE_NOT_MATCH" ? "#f87171" : "#34d399", fontSize: 15 }}>
                      {formValues.ruleType === "ATTRIBUTE_NOT_MATCH" ? "≠" : "⇄"}
                    </span>
                    <span style={{ color: "#a78bfa" }}>{formValues.targetComponentType}</span>
                    <code style={{ background: "rgba(255,255,255,0.12)", padding: "2px 7px", borderRadius: 5, fontSize: 11.5 }}>
                      {formValues.targetAttributeKey || "target_key"}
                    </code>
                  </div>

                  <div className="sys-field">
                    <label htmlFor="name" className="sys-field-label">Tên luật tương thích *</label>
                    <input
                      id="name"
                      name="name"
                      className="cat-input"
                      value={formValues.name}
                      onChange={handleFormChange}
                      placeholder="VD: Tương thích Socket CPU & Mainboard"
                    />
                    {formErrors.name && <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{formErrors.name}</span>}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="sys-field">
                      <label htmlFor="sourceComponentType" className="sys-field-label">Linh kiện nguồn *</label>
                      <select
                        id="sourceComponentType"
                        name="sourceComponentType"
                        className="cat-input"
                        value={formValues.sourceComponentType}
                        onChange={handleFormChange}
                      >
                        {COMPONENT_OPTIONS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className="sys-field">
                      <label htmlFor="targetComponentType" className="sys-field-label">Linh kiện đích *</label>
                      <select
                        id="targetComponentType"
                        name="targetComponentType"
                        className="cat-input"
                        value={formValues.targetComponentType}
                        onChange={handleFormChange}
                      >
                        {COMPONENT_OPTIONS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="sys-field">
                    <label htmlFor="ruleType" className="sys-field-label">Loại quy tắc đối chiếu *</label>
                    <select
                      id="ruleType"
                      name="ruleType"
                      className="cat-input"
                      value={formValues.ruleType}
                      onChange={handleFormChange}
                    >
                      {RULE_TYPE_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    {formErrors.ruleType && <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{formErrors.ruleType}</span>}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="sys-field">
                      <label htmlFor="sourceAttributeKey" className="sys-field-label">Source Attribute Key *</label>
                      <input
                        id="sourceAttributeKey"
                        name="sourceAttributeKey"
                        className="cat-input"
                        style={{ fontFamily: "ui-monospace, monospace" }}
                        value={formValues.sourceAttributeKey}
                        onChange={handleFormChange}
                        placeholder="VD: socket"
                      />
                      {formErrors.sourceAttributeKey && <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{formErrors.sourceAttributeKey}</span>}
                    </div>

                    <div className="sys-field">
                      <label htmlFor="targetAttributeKey" className="sys-field-label">Target Attribute Key *</label>
                      <input
                        id="targetAttributeKey"
                        name="targetAttributeKey"
                        className="cat-input"
                        style={{ fontFamily: "ui-monospace, monospace" }}
                        value={formValues.targetAttributeKey}
                        onChange={handleFormChange}
                        placeholder="VD: socket"
                      />
                      {formErrors.targetAttributeKey && <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{formErrors.targetAttributeKey}</span>}
                    </div>
                  </div>

                  <div className="sys-field">
                    <label htmlFor="description" className="sys-field-label">Mô tả kỹ thuật / thông điệp giải thích</label>
                    <textarea
                      id="description"
                      name="description"
                      className="cat-input"
                      rows={4}
                      value={formValues.description}
                      onChange={handleFormChange}
                      placeholder="Giải thích lý do tương thích hoặc cảnh báo cho khách hàng..."
                    />
                  </div>
                </div>

                <div className="cat-drawer-foot">
                  <button type="button" className="cat-btn-clear" onClick={closeDrawer} disabled={submitting}>
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="cat-btn-dark"
                    style={{ background: "linear-gradient(135deg, #2563eb, #4f46e5)" }}
                    disabled={submitting}
                  >
                    {submitting ? "Đang lưu..." : editingRuleId ? "Lưu Cập Nhật Rule" : "Tạo Luật Tương Thích"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
