import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminAlerts, AdminPage, useAdminToast } from "../../components/admin/AdminUi";
import { getAdminAuditLogs, getAdminSystemOverview, updateAdminSystemSettings } from "../../services/admin-system.service";
import { invalidateStoreInfoCache } from "../../services/store-info.service";
import { formatAdminDateTime, formatAdminNumber, getAdminEnvelopeData, getAdminErrorMessage } from "../../utils/adminUi";
import "../../styles/admin-ai-studio.css";
import "../../styles/admin-system-studio.css";

const FIELD_LABELS = {
  store_name: "Tên cửa hàng",
  support_email: "Email hỗ trợ",
  support_phone: "Số điện thoại hỗ trợ",
  online_payment_mode: "Thanh toán online",
  shipping_mode: "Vận chuyển",
  free_shipping_threshold: "Ngưỡng miễn phí ship (VNĐ)",
  default_shipping_fee: "Phí giao hàng tiêu chuẩn (VNĐ)",
  maintenance_mode: "Chế độ bảo trì",
  bank_name: "Ngân hàng nhận chuyển khoản",
  bank_account_number: "Số tài khoản ngân hàng",
  bank_account_holder: "Tên chủ tài khoản",
  store_hotline: "Hotline tổng đài tư vấn",
  store_tax_id: "Mã số thuế doanh nghiệp",
  store_address: "Địa chỉ trụ sở / Showroom chính"
};

const SETTING_GROUPS = {
  store: ["store_name", "support_email", "support_phone", "store_hotline", "store_tax_id", "store_address"],
  bank: ["bank_name", "bank_account_number", "bank_account_holder"],
  ops: ["online_payment_mode", "shipping_mode", "free_shipping_threshold", "default_shipping_fee", "maintenance_mode"]
};

const SELECT_OPTIONS = {
  online_payment_mode: [
    { value: "sandbox", label: "VNPay Sandbox thật (sandbox)" },
    { value: "mock", label: "Cổng mô phỏng dự phòng Offline (mock)" },
    { value: "live", label: "Sản xuất thực tế (live)" }
  ],
  shipping_mode: [
    { value: "mock", label: "Mô phỏng vận chuyển (mock)" },
    { value: "live", label: "Đối tác vận chuyển thật (live)" }
  ],
  maintenance_mode: [
    { value: "off", label: "Tắt bảo trì — Hoạt động bình thường (off)" },
    { value: "on", label: "Bật bảo trì — Tạm khóa đặt hàng (on)" }
  ]
};

const INITIAL_FORM = {
  store_name: "",
  support_email: "",
  support_phone: "",
  online_payment_mode: "sandbox",
  shipping_mode: "mock",
  free_shipping_threshold: "5000000",
  default_shipping_fee: "30000",
  maintenance_mode: "off",
  bank_name: "",
  bank_account_number: "",
  bank_account_holder: "",
  store_hotline: "",
  store_tax_id: "",
  store_address: ""
};

function getSettingDisplayValue(key, value) {
  const options = SELECT_OPTIONS[key];
  if (!options) return String(value ?? "");
  const matched = options.find((opt) => opt.value === String(value ?? "").trim().toLowerCase());
  return matched ? matched.label : String(value ?? "");
}

function getSettingGroup(key) {
  if (SETTING_GROUPS.bank.includes(key)) return "bank";
  if (SETTING_GROUPS.ops.includes(key)) return "ops";
  return "store";
}

function normalizeSettings(items = []) {
  return items.reduce((acc, item) => {
    acc[item.key] = item.value ?? "";
    return acc;
  }, {});
}

function getAuditActionStyle(action = "") {
  const a = String(action).toUpperCase();
  if (a.includes("DELETE") || a.includes("REMOVE") || a.includes("CANCEL") || a.includes("BLOCK")) {
    return { dot: "#ef4444", bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" };
  }
  if (a.includes("CREATE") || a.includes("ADD") || a.includes("APPROVE") || a.includes("CONFIRM")) {
    return { dot: "#10b981", bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" };
  }
  if (a.includes("UPDATE") || a.includes("EDIT") || a.includes("SET") || a.includes("STATUS")) {
    return { dot: "#2563eb", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
  }
  return { dot: "#64748b", bg: "#f1f5f9", color: "#334155", border: "#cbd5e1" };
}

function getRolePillStyle(role = "") {
  const r = String(role || "HỆ THỐNG").toUpperCase();
  if (r === "ADMIN") return { bg: "#eef2ff", color: "#3730a3", border: "#c7d2fe" };
  if (r === "STAFF") return { bg: "#ecfeff", color: "#0e7490", border: "#a5f3fc" };
  if (r === "TECH") return { bg: "#fffbeb", color: "#b45309", border: "#fde68a" };
  return { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" };
}

export function AdminSystemPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [overview, setOverview] = useState(null);
  const [initialSavedState, setInitialSavedState] = useState(INITIAL_FORM);
  const [formState, setFormState] = useState(INITIAL_FORM);

  // Registry & Audit filters + server-side pagination
  const [registrySearch, setRegistrySearch] = useState("");
  const [registryGroup, setRegistryGroup] = useState("all");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditRoleFilter, setAuditRoleFilter] = useState("ALL");
  const [auditPage, setAuditPage] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLogsData, setAuditLogsData] = useState({
    items: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 }
  });

  useAdminToast(successMessage, () => setSuccessMessage(""));

  const loadAuditLogs = useCallback(async (page = 1, role = "ALL", search = "") => {
    try {
      setAuditLoading(true);
      const response = await getAdminAuditLogs({
        page,
        limit: 20,
        role: role !== "ALL" ? role : undefined,
        search: search.trim() || undefined
      });
      const payload = getAdminEnvelopeData(response, null);
      if (payload && Array.isArray(payload.items)) {
        setAuditLogsData({
          items: payload.items,
          pagination: payload.pagination || { page, limit: 20, total: payload.items.length, totalPages: 1 }
        });
      }
    } catch {
      // Fallback to overview auditLogs if endpoint temporarily unavailable
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const loadOverview = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setErrorMessage("");
      const response = await getAdminSystemOverview();
      const payload = getAdminEnvelopeData(response, null);
      setOverview(payload);
      const merged = { ...INITIAL_FORM, ...normalizeSettings(payload?.settings || []) };
      setFormState(merged);
      setInitialSavedState(merged);
      if (isManualRefresh) {
        setSuccessMessage("Đã làm mới trạng thái hệ thống và nhật ký thao tác.");
      }
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể tải dữ liệu hệ thống."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOverview(false);
  }, [loadOverview]);

  useEffect(() => {
    loadAuditLogs(auditPage, auditRoleFilter, auditSearch);
  }, [auditPage, auditRoleFilter, auditSearch, loadAuditLogs]);

  const settingsList = useMemo(() => overview?.settings || [], [overview]);
  const metrics = overview?.metrics || {};
  const health = overview?.health || {};
  const auditLogs = auditLogsData.items.length > 0 || auditLogsData.pagination.total > 0
    ? auditLogsData.items
    : (overview?.auditLogs || []);
  const auditPagination = auditLogsData.pagination;

  const isDirty = useMemo(() => {
    return Object.keys(INITIAL_FORM).some(
      (k) => String(formState[k] ?? "") !== String(initialSavedState[k] ?? "")
    );
  }, [formState, initialSavedState]);

  const filteredSettings = useMemo(() => {
    const q = registrySearch.trim().toLowerCase();
    return settingsList.filter((item) => {
      if (registryGroup !== "all" && getSettingGroup(item.key) !== registryGroup) return false;
      if (!q) return true;
      const label = String(FIELD_LABELS[item.key] || "").toLowerCase();
      return (
        label.includes(q) ||
        String(item.key || "").toLowerCase().includes(q) ||
        String(item.value || "").toLowerCase().includes(q)
      );
    });
  }, [settingsList, registrySearch, registryGroup]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter((log) => {
      const role = String(log.actorRole || "SYSTEM").toUpperCase();
      if (auditRoleFilter !== "ALL") {
        if (auditRoleFilter === "SALES_STAFF") {
          if (role !== "SALES_STAFF" && role !== "SALES" && role !== "STAFF") return false;
        } else if (auditRoleFilter === "TECH_STAFF") {
          if (role !== "TECH_STAFF" && role !== "TECH" && role !== "TECHNICIAN") return false;
        } else if (role !== auditRoleFilter) {
          return false;
        }
      }
      if (!q) return true;
      return (
        String(log.action || "").toLowerCase().includes(q) ||
        String(log.description || "").toLowerCase().includes(q) ||
        String(log.entityType || "").toLowerCase().includes(q)
      );
    });
  }, [auditLogs, auditSearch, auditRoleFilter]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave(event) {
    event.preventDefault();
    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");
      const response = await updateAdminSystemSettings(formState);
      invalidateStoreInfoCache();
      const payload = getAdminEnvelopeData(response, null);
      setOverview((prev) => ({ ...prev, settings: payload }));
      const nextSaved = { ...INITIAL_FORM, ...normalizeSettings(payload || []) };
      setFormState(nextSaved);
      setInitialSavedState(nextSaved);
      setSuccessMessage("Đã lưu và đồng bộ toàn bộ cấu hình hệ thống thành công!");
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể cập nhật cấu hình."));
    } finally {
      setSaving(false);
    }
  }

  const apiUp = health?.api?.status === "UP";
  const dbUp = health?.database?.status === "UP";
  const allHealthy = apiUp && dbUp;
  const maintenanceOn = String(formState.maintenance_mode).toLowerCase() === "on";

  function renderField(key, isFull = false) {
    const label = FIELD_LABELS[key] || key;
    return (
      <div key={key} className={`sys-field${isFull ? " sys-field--full" : ""}`}>
        <div className="sys-field-label-row">
          <label htmlFor={key} className="sys-field-label">{label}</label>
          <span className="sys-field-key">{key}</span>
        </div>
        {SELECT_OPTIONS[key] ? (
          <select id={key} name={key} value={formState[key] || ""} onChange={handleChange} className="sys-input">
            {SELECT_OPTIONS[key].map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={key}
            name={key}
            value={formState[key] || ""}
            onChange={handleChange}
            className="sys-input"
            placeholder={`Nhập ${label.toLowerCase()}...`}
          />
        )}
      </div>
    );
  }

  return (
    <AdminPage>
      <div className="sys-console-shell">
        {/* ==================== EXECUTIVE SYSTEM TELEMETRY HERO ==================== */}
        <section className="sys-hero">
          <div className="ai-studio-hero-top">
            <div>
              <div className="ai-studio-hero-badges">
                <span
                  className="ai-studio-live-pill"
                  style={
                    !allHealthy
                      ? { background: "rgba(239,68,68,0.16)", borderColor: "rgba(248,113,113,0.4)", color: "#fca5a5" }
                      : maintenanceOn
                      ? { background: "rgba(245,158,11,0.16)", borderColor: "rgba(251,191,36,0.4)", color: "#fcd34d" }
                      : undefined
                  }
                >
                  <span
                    className="ai-studio-live-dot"
                    style={!allHealthy ? { background: "#f87171" } : maintenanceOn ? { background: "#fbbf24" } : undefined}
                  />
                  {!allHealthy
                    ? "System Degraded • Cần Kiểm Tra"
                    : maintenanceOn
                    ? "Maintenance Mode Active"
                    : "System Operational • All Services Up"}
                </span>
                <span className="ai-studio-tech-pill">
                  Payment: {String(formState.online_payment_mode || "sandbox").toUpperCase()}
                </span>
                <span className="ai-studio-tech-pill">
                  Shipping: {String(formState.shipping_mode || "mock").toUpperCase()}
                </span>
              </div>
              <h1 className="ai-studio-hero-title">Trung Tâm Vận Hành & Cấu Hình Hệ Thống</h1>
              <p className="ai-studio-hero-desc">
                Giám sát trực tuyến trạng thái API, cơ sở dữ liệu MySQL 8.0, quản lý cấu hình cửa hàng, thông số tài khoản ngân hàng VietQR, chế độ Sandbox/Mock và nhật ký kiểm toán thao tác.
              </p>
            </div>

            <button
              type="button"
              className="sys-refresh-btn"
              onClick={() => loadOverview(true)}
              disabled={refreshing || loading}
            >
              <svg className={refreshing ? "ai-studio-spin" : ""} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              <span>{refreshing ? "Đang kiểm tra..." : "Làm Mới Trạng Thái"}</span>
            </button>
          </div>

          {/* 6 Embedded Glass Telemetry Tiles */}
          <div className="sys-hero-kpi-grid">
            <div className="sys-kpi-tile" style={{ "--sys-accent": apiUp ? "#10b981" : "#ef4444" }}>
              <div className="sys-kpi-top">
                <span className="sys-kpi-label">API Server</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={apiUp ? "#34d399" : "#f87171"} strokeWidth="2.3"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              </div>
              <div className={`sys-kpi-val ${apiUp ? "is-up" : "is-down"}`}>{health?.api?.status || "—"}</div>
              <div className="sys-kpi-sub">Express + Socket.io :4000</div>
            </div>

            <div className="sys-kpi-tile" style={{ "--sys-accent": dbUp ? "#10b981" : "#ef4444" }}>
              <div className="sys-kpi-top">
                <span className="sys-kpi-label">Cơ Sở Dữ Liệu</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dbUp ? "#34d399" : "#f87171"} strokeWidth="2.3"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>
              </div>
              <div className={`sys-kpi-val ${dbUp ? "is-up" : "is-down"}`}>{health?.database?.status || "—"}</div>
              <div className="sys-kpi-sub">MySQL 8.0 • Prisma Pool</div>
            </div>

            <div className="sys-kpi-tile" style={{ "--sys-accent": "#38bdf8" }}>
              <div className="sys-kpi-top">
                <span className="sys-kpi-label">Người Dùng</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </div>
              <div className="sys-kpi-val">{formatAdminNumber(metrics.users)}</div>
              <div className="sys-kpi-sub">Tài khoản đăng ký</div>
            </div>

            <div className="sys-kpi-tile" style={{ "--sys-accent": "#a78bfa" }}>
              <div className="sys-kpi-top">
                <span className="sys-kpi-label">Sản Phẩm</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
              </div>
              <div className="sys-kpi-val">{formatAdminNumber(metrics.products)}</div>
              <div className="sys-kpi-sub">Linh kiện trong kho</div>
            </div>

            <div className="sys-kpi-tile" style={{ "--sys-accent": "#22d3ee" }}>
              <div className="sys-kpi-top">
                <span className="sys-kpi-label">Đơn Hàng</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
              </div>
              <div className="sys-kpi-val">{formatAdminNumber(metrics.orders)}</div>
              <div className="sys-kpi-sub">Tổng giao dịch hệ thống</div>
            </div>

            <div className="sys-kpi-tile" style={{ "--sys-accent": "#fbbf24" }}>
              <div className="sys-kpi-top">
                <span className="sys-kpi-label">Ticket KT</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
              </div>
              <div className="sys-kpi-val">{formatAdminNumber(metrics.tickets)}</div>
              <div className="sys-kpi-sub">Yêu cầu kỹ thuật & BH</div>
            </div>
          </div>
        </section>

        <AdminAlerts errorMessage={errorMessage} successMessage={successMessage} />

        {loading ? (
          <div className="ai-studio-panel" style={{ padding: "52px 24px", textAlign: "center", color: "#64748b", fontSize: 14 }}>
            Đang nạp dữ liệu giám sát hệ thống và cấu hình…
          </div>
        ) : (
          <>
            {/* ==================== SPLIT WORKSPACE: FORM + LIVE REGISTRY ==================== */}
            <div className="sys-workspace-grid">
              {/* LEFT: GROUPED CONFIGURATION STUDIO */}
              <section className="ai-studio-panel">
                <div className="ai-studio-panel-head">
                  <div className="ai-studio-panel-title-wrap">
                    <span className="ai-studio-panel-icon" style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #dbeafe" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </span>
                    <div>
                      <h3 className="ai-studio-panel-title">Cấu Hình Vận Hành Tập Trung</h3>
                      <p className="ai-studio-panel-sub">Chia nhóm rõ ràng theo thương hiệu, tài khoản thanh toán VietQR và chế độ Demo/Sandbox</p>
                    </div>
                  </div>
                </div>

                <div className="ai-studio-panel-body">
                  <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    {/* SECTION 1: THÔNG TIN CỬA HÀNG & LIÊN HỆ */}
                    <div className="sys-form-section">
                      <div className="sys-section-head">
                        <div className="sys-section-head-title">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                          <span>1. Nhận Diện Thương Hiệu & Thông Tin Liên Hệ</span>
                        </div>
                        <span className="sys-section-head-sub">Hiển thị trên hóa đơn, footer & email</span>
                      </div>
                      <div className="sys-field-grid">
                        {renderField("store_name")}
                        {renderField("support_email")}
                        {renderField("support_phone")}
                        {renderField("store_hotline")}
                        {renderField("store_tax_id")}
                        {renderField("store_address")}
                      </div>
                    </div>

                    {/* SECTION 2: TÀI KHOẢN NGÂN HÀNG VIETQR */}
                    <div className="sys-form-section sys-form-section--bank">
                      <div className="sys-section-head">
                        <div className="sys-section-head-title">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f766e" strokeWidth="2.2"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                          <span>2. Tài Khoản Ngân Hàng Nhận Chuyển Khoản (VietQR)</span>
                        </div>
                        <span className="sys-section-head-sub">Đồng bộ tự động tới trang Checkout</span>
                      </div>
                      <div className="sys-field-grid sys-field-grid--three">
                        {renderField("bank_name")}
                        {renderField("bank_account_number")}
                        {renderField("bank_account_holder")}
                      </div>
                    </div>

                    {/* SECTION 3: CHẾ ĐỘ SANDBOX / MOCK / BẢO TRÌ */}
                    <div className="sys-form-section sys-form-section--ops">
                      <div className="sys-section-head">
                        <div className="sys-section-head-title">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                          <span>3. Chế Độ Vận Hành, Cổng Thanh Toán & Bảo Trì</span>
                        </div>
                        <span className="sys-section-head-sub">Thiết lập chế độ demo / production</span>
                      </div>
                      <div className="sys-field-grid sys-field-grid--three">
                        {renderField("online_payment_mode")}
                        {renderField("shipping_mode")}
                        {renderField("maintenance_mode")}
                        {renderField("free_shipping_threshold")}
                        {renderField("default_shipping_fee")}
                      </div>
                      {maintenanceOn && (
                        <div style={{
                          padding: "10px 12px",
                          borderRadius: 10,
                          background: "#fffbeb",
                          border: "1px solid #fde68a",
                          color: "#92400e",
                          fontSize: 12.5,
                          fontWeight: 600
                        }}>
                          Lưu ý: Chế độ bảo trì đang chọn <strong>BẬT (on)</strong>. Sau khi lưu, người dùng phổ thông có thể bị hạn chế tạo đơn hàng mới.
                        </div>
                      )}
                    </div>

                    {/* FOOTER ACTION BAR */}
                    <div className="sys-form-footer">
                      <div>
                        {isDirty ? (
                          <span className="sys-dirty-badge">● Có thay đổi chưa lưu</span>
                        ) : (
                          <span className="sys-clean-badge">✓ Đã đồng bộ với cơ sở dữ liệu</span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          type="button"
                          className="sys-reset-btn"
                          disabled={!isDirty || saving}
                          onClick={() => setFormState(initialSavedState)}
                        >
                          Hoàn tác
                        </button>
                        <button type="submit" className="sys-save-btn" disabled={saving}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                          <span>{saving ? "Đang lưu cấu hình..." : "Lưu & Áp Dụng Cấu Hình"}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </section>

              {/* RIGHT: LIVE SYSTEM_SETTINGS REGISTRY INSPECTOR */}
              <section className="ai-studio-panel">
                <div className="ai-studio-panel-head">
                  <div className="ai-studio-panel-title-wrap">
                    <span className="ai-studio-panel-icon" style={{ background: "#f5f3ff", color: "#6d28d9", border: "1px solid #ede9fe" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                    </span>
                    <div>
                      <h3 className="ai-studio-panel-title">
                        Bản Ghi <code>system_settings</code>{" "}
                        <span style={{ fontSize: 11.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#f1f5f9", color: "#475569" }}>
                          {filteredSettings.length}/{settingsList.length}
                        </span>
                      </h3>
                      <p className="ai-studio-panel-sub">Giá trị trực tiếp đang được nạp từ MySQL</p>
                    </div>
                  </div>
                </div>

                <div className="ai-studio-panel-body">
                  {/* Search + Group Pills */}
                  <div style={{ position: "relative", marginBottom: 12 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.3" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="text"
                      className="sys-input"
                      style={{ paddingLeft: 34, paddingTop: 8, paddingBottom: 8, fontSize: 12.5 }}
                      placeholder="Lọc nhanh theo tên, key hoặc giá trị..."
                      value={registrySearch}
                      onChange={(e) => setRegistrySearch(e.target.value)}
                    />
                  </div>

                  <div className="sys-filter-pills">
                    {[
                      { id: "all", label: "Tất cả" },
                      { id: "store", label: "Thương hiệu" },
                      { id: "bank", label: "Ngân hàng" },
                      { id: "ops", label: "Vận hành" }
                    ].map((pill) => (
                      <button
                        key={pill.id}
                        type="button"
                        className={`sys-pill-btn${registryGroup === pill.id ? " is-active" : ""}`}
                        onClick={() => setRegistryGroup(pill.id)}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>

                  <div className="sys-registry-list">
                    {filteredSettings.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "32px 16px", color: "#94a3b8", fontSize: 13 }}>
                        Không tìm thấy bản ghi cấu hình nào khớp bộ lọc.
                      </div>
                    ) : (
                      filteredSettings.map((item) => {
                        const displayVal = getSettingDisplayValue(item.key, item.value);
                        return (
                          <div key={item.key} className="sys-registry-card">
                            <div className="sys-registry-head">
                              <span className="sys-registry-title">{FIELD_LABELS[item.key] || item.key}</span>
                              <span className="sys-registry-key">{item.key}</span>
                            </div>
                            <div className="sys-registry-val-row">
                              <span className="sys-registry-val">{displayVal || "—"}</span>
                              {displayVal && (
                                <button
                                  type="button"
                                  className="sys-copy-mini"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(String(item.value ?? ""));
                                    setSuccessMessage(`Đã sao chép "${FIELD_LABELS[item.key] || item.key}"`);
                                  }}
                                >
                                  Sao chép
                                </button>
                              )}
                            </div>
                            {item.description && <div className="sys-registry-desc">{item.description}</div>}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* ==================== EXECUTIVE AUDIT LOG TIMELINE ==================== */}
            <section className="ai-studio-panel">
              <div className="ai-studio-panel-head">
                <div className="ai-studio-panel-title-wrap">
                  <span className="ai-studio-panel-icon" style={{ background: "#ecfdf5", color: "#059669", border: "1px solid #bbf7d0" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="10" /></svg>
                  </span>
                  <div>
                    <h3 className="ai-studio-panel-title">
                      Nhật Ký Kiểm Toán Thao Tác (Audit Logs){" "}
                      <span style={{ fontSize: 11.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8" }}>
                        {auditPagination.total || filteredAuditLogs.length} sự kiện
                      </span>
                    </h3>
                    <p className="ai-studio-panel-sub">Theo dõi thời gian thực các thao tác quản trị của Admin, Nhân viên bán hàng và Kỹ thuật viên</p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div className="sys-filter-pills" style={{ marginBottom: 0 }}>
                    {[
                      { value: "ALL", label: "Tất cả vai trò" },
                      { value: "ADMIN", label: "ADMIN" },
                      { value: "SALES_STAFF", label: "SALES_STAFF" },
                      { value: "TECH_STAFF", label: "TECH_STAFF" },
                      { value: "SYSTEM", label: "SYSTEM" }
                    ].map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        className={`sys-pill-btn${auditRoleFilter === r.value ? " is-active" : ""}`}
                        onClick={() => {
                          setAuditRoleFilter(r.value);
                          setAuditPage(1);
                        }}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ position: "relative" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.3" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="text"
                      className="ai-doc-search"
                      placeholder="Tìm action hoặc mô tả..."
                      value={auditSearch}
                      onChange={(e) => {
                        setAuditSearch(e.target.value);
                        setAuditPage(1);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="ai-studio-panel-body">
                {filteredAuditLogs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "36px 20px", color: "#94a3b8", fontSize: 13 }}>
                    {auditLogs.length === 0
                      ? "Chưa có bản ghi nhật ký thao tác (Audit Log) nào."
                      : "Không có sự kiện nào khớp điều kiện tìm kiếm."}
                  </div>
                ) : (
                  <div className="sys-audit-timeline">
                    {filteredAuditLogs.map((log) => {
                      const actStyle = getAuditActionStyle(log.action);
                      const roleStyle = getRolePillStyle(log.actorRole);
                      return (
                        <div key={log.id} className="sys-audit-row">
                          <span className="sys-audit-dot" style={{ background: actStyle.dot }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span
                                className="sys-audit-action-pill"
                                style={{
                                  background: actStyle.bg,
                                  color: actStyle.color,
                                  border: `1px solid ${actStyle.border}`
                                }}
                              >
                                {log.action}
                              </span>
                              <span
                                className="sys-role-pill"
                                style={{
                                  background: roleStyle.bg,
                                  color: roleStyle.color,
                                  border: `1px solid ${roleStyle.border}`
                                }}
                              >
                                {log.actorRole || "HỆ THỐNG"}
                              </span>
                            </div>
                            <div style={{ marginTop: 6, fontSize: 13, color: "#1e293b", lineHeight: 1.5 }}>
                              {log.description || "Không có mô tả chi tiết."}
                            </div>
                            <div className="sys-audit-meta">
                              <span>
                                Đối tượng: <strong style={{ color: "#334155" }}>{log.entityType || "system"}{log.entityId ? ` #${log.entityId}` : ""}</strong>
                              </span>
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                            {formatAdminDateTime(log.createdAt)}
                          </div>
                      </div>
                      );
                    })}
                  </div>
                )}

                {auditPagination.totalPages > 1 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingTop: 14, borderTop: "1px solid #e2e8f0", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600 }}>
                      Trang <strong>{auditPagination.page}</strong> / {auditPagination.totalPages} (Tổng {auditPagination.total} bản ghi)
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="sys-pill-btn"
                        disabled={auditLoading || auditPage <= 1}
                        onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                      >
                        ← Trang trước
                      </button>
                      <button
                        type="button"
                        className="sys-pill-btn"
                        disabled={auditLoading || auditPage >= auditPagination.totalPages}
                        onClick={() => setAuditPage((p) => Math.min(auditPagination.totalPages, p + 1))}
                      >
                        Trang sau →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </AdminPage>
  );
}
