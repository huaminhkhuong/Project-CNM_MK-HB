import { useEffect, useMemo, useState } from "react";

import { AdminAlerts, AdminPage, useAdminToast } from "../../components/admin/AdminUi";
import { useAuth } from "../../hooks/useAuth";
import { changeAdminUserRole, changeAdminUserStatus, getAdminUsers } from "../../services/admin-users.service";
import {
  formatAdminDateTime,
  formatAdminNumber,
  getAdminErrorMessage,
  getRoleMeta,
  getStatusMeta,
  normalizeAdminList
} from "../../utils/adminUi";
import "../../styles/admin-ai-studio.css";
import "../../styles/admin-catalog-studio.css";

const STATUS_OPTIONS = ["ACTIVE", "BLOCKED", "INACTIVE"];
const ROLE_OPTIONS = ["CUSTOMER", "SALES_STAFF", "TECH_STAFF", "ADMIN"];
const PAGE_SIZE = 25;

function normalizeUser(user) {
  return {
    id: user?.id,
    fullName: user?.fullName || user?.full_name || user?.name || "",
    email: user?.email || "",
    role: String(user?.role || "CUSTOMER").toUpperCase(),
    status: String(user?.status || "ACTIVE").toUpperCase(),
    createdAt: user?.createdAt || user?.created_at || null
  };
}

function getInitials(name, email) {
  const src = String(name || email || "U").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function getRoleBadgeColors(role) {
  switch (String(role).toUpperCase()) {
    case "ADMIN": return { bg: "#eef2ff", color: "#3730a3", border: "#c7d2fe", avatar: "linear-gradient(135deg, #4f46e5, #7c3aed)" };
    case "SALES_STAFF": return { bg: "#ecfeff", color: "#0e7490", border: "#a5f3fc", avatar: "linear-gradient(135deg, #0891b2, #2563eb)" };
    case "TECH_STAFF": return { bg: "#fffbeb", color: "#b45309", border: "#fde68a", avatar: "linear-gradient(135deg, #d97706, #ea580c)" };
    default: return { bg: "#f1f5f9", color: "#334155", border: "#cbd5e1", avatar: "linear-gradient(135deg, #334155, #0f172a)" };
  }
}

export function AdminUsersPage() {
  const { authState } = useAuth();
  const currentUserId = Number(authState?.user?.id || authState?.user?.userId || 0);
  const [users, setUsers] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL"); // ALL | CUSTOMER | SALES_STAFF | TECH_STAFF | ADMIN | LOCKED
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusLoadingId, setStatusLoadingId] = useState(null);
  const [roleLoadingId, setRoleLoadingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useAdminToast(successMessage, () => setSuccessMessage(""));

  const stats = useMemo(() => {
    const customers = users.filter((u) => u.role === "CUSTOMER").length;
    const internal = users.filter((u) => u.role !== "CUSTOMER").length;
    const locked = users.filter((u) => u.status !== "ACTIVE").length;
    return { total: users.length, customers, internal, locked };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter === "LOCKED" && u.status === "ACTIVE") return false;
      if (roleFilter !== "ALL" && roleFilter !== "LOCKED" && u.role !== roleFilter) return false;
      if (!q) return true;
      return [u.fullName, u.email, u.role].join(" ").toLowerCase().includes(q);
    });
  }, [searchKeyword, roleFilter, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, safePage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword, roleFilter]);

  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true);
        setErrorMessage("");
        const response = await getAdminUsers({ keyword: searchKeyword || undefined, page: 1, limit: 200 });
        setUsers(normalizeAdminList(response).map(normalizeUser));
      } catch (error) {
        setErrorMessage(getAdminErrorMessage(error, "Không thể tải danh sách người dùng."));
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, [searchKeyword]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    setSearchKeyword(keyword);
  }

  async function handleChangeStatus(user, nextStatus) {
    if (!nextStatus || nextStatus === user.status) return;
    if (Number(user.id) === currentUserId && nextStatus !== "ACTIVE") {
      setErrorMessage("Không thể tự khóa hoặc vô hiệu hóa tài khoản Quản trị viên đang đăng nhập.");
      return;
    }
    try {
      setStatusLoadingId(user.id);
      setErrorMessage("");
      const response = await changeAdminUserStatus(user.id, nextStatus);
      const updated = normalizeUser(response?.data || response);
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSuccessMessage(`Đã đổi trạng thái "${user.email}" sang ${getStatusMeta(nextStatus).label}.`);
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể cập nhật trạng thái."));
    } finally {
      setStatusLoadingId(null);
    }
  }

  async function handleChangeRole(user, nextRole) {
    if (!nextRole || nextRole === user.role) return;
    if (Number(user.id) === currentUserId && nextRole !== "ADMIN") {
      setErrorMessage("Không thể tự hạ quyền tài khoản Quản trị viên đang đăng nhập.");
      return;
    }
    try {
      setRoleLoadingId(user.id);
      setErrorMessage("");
      const response = await changeAdminUserRole(user.id, nextRole);
      const updated = normalizeUser(response?.data || response);
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSuccessMessage(`Đã đổi vai trò tài khoản ${user.email} sang ${getRoleMeta(nextRole).label}.`);
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể cập nhật vai trò."));
    } finally {
      setRoleLoadingId(null);
    }
  }

  return (
    <AdminPage>
      <div className="cat-studio-shell">
        {/* ==================== EXECUTIVE IDENTITY & RBAC HERO ==================== */}
        <section className="ai-studio-hero">
          <div className="ai-studio-hero-top">
            <div>
              <div className="ai-studio-hero-badges">
                <span className="ai-studio-live-pill">
                  <span className="ai-studio-live-dot" />
                  RBAC Identity &amp; Access Control
                </span>
                <span className="ai-studio-tech-pill">4 Vai Trò • Bảo vệ tự khóa Admin</span>
              </div>
              <h1 className="ai-studio-hero-title">Quản Trị Tài Khoản &amp; Phân Quyền RBAC</h1>
              <p className="ai-studio-hero-desc">
                Quản lý tập trung tài khoản Khách hàng, Nhân viên bán hàng, Kỹ thuật viên và Quản trị viên; phân quyền trực tiếp và khóa/mở khóa tài khoản tức thì có kiểm tra bảo mật đăng nhập.
              </p>
            </div>
          </div>

          <div className="ai-studio-kpi-grid">
            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#38bdf8" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Tổng tài khoản</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value">{formatAdminNumber(stats.total)}</div>
              <div className="ai-studio-kpi-hint">Tài khoản trong hệ thống</div>
            </div>

            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#34d399" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Khách hàng</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value" style={{ color: "#6ee7b7" }}>{formatAdminNumber(stats.customers)}</div>
              <div className="ai-studio-kpi-hint">Vai trò CUSTOMER</div>
            </div>

            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#a78bfa" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Nhân sự nội bộ</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value">{formatAdminNumber(stats.internal)}</div>
              <div className="ai-studio-kpi-hint">Admin, Sales &amp; Tech Staff</div>
            </div>

            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#f87171" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Đang bị khóa</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value" style={{ color: stats.locked > 0 ? "#fca5a5" : "#6ee7b7" }}>
                {formatAdminNumber(stats.locked)}
              </div>
              <div className="ai-studio-kpi-hint">Bị chặn đăng nhập (BLOCKED/INACTIVE)</div>
            </div>
          </div>
        </section>

        <AdminAlerts errorMessage={errorMessage} successMessage={successMessage} />

        {/* ==================== FULL-WIDTH USERS TABLE ==================== */}
        <section className="ai-studio-panel">
          <div className="ai-studio-panel-head">
            <div className="ai-studio-panel-title-wrap">
              <span className="ai-studio-panel-icon" style={{ background: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </span>
              <div>
                <h3 className="ai-studio-panel-title">
                  Danh Sách Người Dùng{" "}
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", marginLeft: 4 }}>
                    {formatAdminNumber(filteredUsers.length)} tài khoản
                  </span>
                </h3>
                <p className="ai-studio-panel-sub">Lọc nhanh theo vai trò, tìm theo tên hoặc email và cập nhật phân quyền / trạng thái khóa trực tiếp</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSearchSubmit} className="cat-toolbar">
            <div className="cat-search-wrap">
              <svg className="cat-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="cat-input cat-input--search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm theo họ tên hoặc địa chỉ email..."
              />
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { id: "ALL", label: "Tất cả" },
                { id: "CUSTOMER", label: "Khách hàng" },
                { id: "SALES_STAFF", label: "NV Bán hàng" },
                { id: "TECH_STAFF", label: "NV Kỹ thuật" },
                { id: "ADMIN", label: "Quản trị" },
                { id: "LOCKED", label: `Bị khóa (${stats.locked})` }
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setRoleFilter(pill.id)}
                  style={{
                    padding: "7px 11px",
                    borderRadius: 999,
                    border: roleFilter === pill.id ? "1px solid #0f172a" : "1px solid #e2e8f0",
                    background: roleFilter === pill.id ? "#0f172a" : "#ffffff",
                    color: roleFilter === pill.id ? "#ffffff" : "#475569",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <button type="submit" className="cat-btn-dark">Tìm kiếm</button>
            {(keyword || searchKeyword || roleFilter !== "ALL") && (
              <button
                type="button"
                className="cat-btn-clear"
                onClick={() => {
                  setKeyword("");
                  setSearchKeyword("");
                  setRoleFilter("ALL");
                }}
              >
                Xóa lọc
              </button>
            )}
          </form>

          {loading ? (
            <div style={{ textAlign: "center", padding: "56px 24px", color: "#64748b", fontSize: 13.5 }}>
              Đang tải danh sách người dùng...
            </div>
          ) : paginatedUsers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 24px", color: "#64748b" }}>
              <strong style={{ display: "block", fontSize: 15, color: "#0f172a", marginBottom: 4 }}>
                Không tìm thấy tài khoản nào phù hợp
              </strong>
              <span style={{ fontSize: 13 }}>Thử đổi vai trò hoặc xóa từ khóa tìm kiếm.</span>
            </div>
          ) : (
            <>
              <div className="cat-table-scroll">
                <table className="cat-table">
                  <thead>
                    <tr>
                      <th>Người Dùng &amp; Email</th>
                      <th>Vai Trò &amp; Phân Quyền</th>
                      <th>Trạng Thái</th>
                      <th>Ngày Tham Gia</th>
                      <th style={{ textAlign: "right" }}>Khóa / Mở Khóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((user) => {
                      const roleMeta = getRoleMeta(user.role);
                      const statusMeta = getStatusMeta(user.status);
                      const roleColors = getRoleBadgeColors(user.role);
                      const isSelf = Number(user.id) === currentUserId;
                      const isActive = user.status === "ACTIVE";

                      return (
                        <tr key={user.id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                              <div style={{
                                width: 38,
                                height: 38,
                                borderRadius: "50%",
                                background: roleColors.avatar,
                                color: "#ffffff",
                                fontSize: 12.5,
                                fontWeight: 800,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0
                              }}>
                                {getInitials(user.fullName, user.email)}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                  <strong style={{ fontSize: 13.5, color: "#0f172a" }}>
                                    {user.fullName || "Chưa cập nhật"}
                                  </strong>
                                  {isSelf && (
                                    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", letterSpacing: "0.04em" }}>
                                      BẠN
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 12, color: "#64748b", marginTop: 1, wordBreak: "break-all" }}>
                                  {user.email || "—"}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td style={{ whiteSpace: "nowrap" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <span style={{
                                padding: "4px 10px",
                                borderRadius: 999,
                                fontSize: 11.5,
                                fontWeight: 700,
                                background: roleColors.bg,
                                color: roleColors.color,
                                border: `1px solid ${roleColors.border}`,
                                whiteSpace: "nowrap"
                              }}>
                                {roleMeta.label}
                              </span>
                              <select
                                className="cat-input"
                                value={user.role}
                                onChange={(e) => handleChangeRole(user, e.target.value)}
                                disabled={roleLoadingId === user.id || isSelf}
                                title={isSelf ? "Không thể tự thay đổi quyền của chính mình" : "Đổi vai trò"}
                                style={{ width: 145, padding: "5px 9px", fontSize: 12, opacity: isSelf ? 0.55 : 1 }}
                              >
                                {ROLE_OPTIONS.map((r) => (
                                  <option key={r} value={r}>{getRoleMeta(r).label}</option>
                                ))}
                              </select>
                            </div>
                          </td>

                          <td>
                            <span
                              className={`cat-status-pill ${isActive ? "is-active" : "is-hidden"}`}
                              style={
                                user.status === "BLOCKED"
                                  ? { background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" }
                                  : undefined
                              }
                            >
                              <span style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: isActive ? "#10b981" : user.status === "BLOCKED" ? "#ef4444" : "#94a3b8"
                              }} />
                              <span>{statusMeta.label}</span>
                            </span>
                          </td>

                          <td style={{ fontSize: 12.5, color: "#475569", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                            {formatAdminDateTime(user.createdAt)}
                          </td>

                          <td style={{ textAlign: "right" }}>
                            <select
                              className="cat-input"
                              value={user.status}
                              onChange={(e) => handleChangeStatus(user, e.target.value)}
                              disabled={statusLoadingId === user.id || isSelf}
                              title={isSelf ? "Không thể tự khóa tài khoản của chính mình" : "Đổi trạng thái khóa / mở khóa"}
                              style={{
                                width: 142,
                                padding: "6px 10px",
                                fontSize: 12.5,
                                fontWeight: 600,
                                opacity: isSelf ? 0.55 : 1,
                                borderColor: user.status === "BLOCKED" ? "#fca5a5" : "#cbd5e1"
                              }}
                            >
                              {STATUS_OPTIONS.map((st) => (
                                <option key={st} value={st}>{getStatusMeta(st).label}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="cat-pagination">
                <span>
                  Trang <strong style={{ color: "#0f172a" }}>{safePage}</strong> /{" "}
                  <strong style={{ color: "#0f172a" }}>{totalPages}</strong> • Tổng{" "}
                  <strong style={{ color: "#0f172a" }}>{formatAdminNumber(filteredUsers.length)}</strong> tài khoản
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="ai-action-btn ai-action-btn--ghost"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    style={{ opacity: safePage <= 1 ? 0.45 : 1 }}
                  >
                    ← Trang trước
                  </button>
                  <button
                    type="button"
                    className="ai-action-btn ai-action-btn--ghost"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    style={{ opacity: safePage >= totalPages ? 0.45 : 1 }}
                  >
                    Trang sau →
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </AdminPage>
  );
}
