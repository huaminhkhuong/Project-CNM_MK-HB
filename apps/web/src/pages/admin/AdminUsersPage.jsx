import { useEffect, useMemo, useState } from "react";

import {
  AdminAlerts,
  AdminBadge,
  AdminBtn,
  AdminCard,
  AdminEmpty,
  AdminPage,
  AdminPageHead,
  AdminTableWrap,
  useAdminToast
} from "../../components/admin/AdminUi";
import { useAuth } from "../../hooks/useAuth";
import { changeAdminUserRole, changeAdminUserStatus, getAdminUsers } from "../../services/admin-users.service";
import {
  formatAdminDateTime,
  getAdminErrorMessage,
  getRoleMeta,
  getStatusMeta,
  normalizeAdminList
} from "../../utils/adminUi";

const STATUS_OPTIONS = ["ACTIVE", "BLOCKED", "INACTIVE"];
const ROLE_OPTIONS = ["CUSTOMER", "SALES_STAFF", "TECH_STAFF", "ADMIN"];

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

export function AdminUsersPage() {
  const { authState } = useAuth();
  const currentUserId = Number(authState?.user?.id || authState?.user?.userId || 0);
  const [users, setUsers] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [statusLoadingId, setStatusLoadingId] = useState(null);
  const [roleLoadingId, setRoleLoadingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useAdminToast(successMessage, () => setSuccessMessage(""));

  const filteredUsers = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (!q) return true;
      return [u.fullName, u.email, u.role].join(" ").toLowerCase().includes(q);
    });
  }, [searchKeyword, roleFilter, users]);

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
      setSuccessMessage(`Đã đổi trạng thái sang ${getStatusMeta(nextStatus).label}.`);
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

  const roleStats = useMemo(() => {
    const counts = {};
    users.forEach((u) => {
      counts[u.role] = (counts[u.role] || 0) + 1;
    });
    return counts;
  }, [users]);

  return (
    <AdminPage>
      <AdminPageHead
        eyebrow="Quản trị người dùng"
        title="Tài khoản & phân quyền"
        description="Theo dõi vai trò CUSTOMER, SALES_STAFF, TECH_STAFF, ADMIN và khóa/mở tài khoản khi cần."
      />

      <AdminAlerts errorMessage={errorMessage} successMessage={successMessage} />

      <section className="admin-metrics">
        <div className="admin-metric">
          <span>Tổng tài khoản</span>
          <strong>{users.length}</strong>
        </div>
        {Object.entries(roleStats).map(([role, count]) => (
          <div key={role} className="admin-metric">
            <span>{getRoleMeta(role).label}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </section>

      <AdminCard>
        <div className="admin-panel-head">
          <div className="admin-section-title">
            <h3>Danh sách người dùng</h3>
            <p>Tìm theo họ tên hoặc email, đổi trạng thái trực tiếp trên bảng.</p>
          </div>
          <form onSubmit={handleSearchSubmit} className="admin-search-row">
            <select
              className="admin-input"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{ minWidth: 150 }}
            >
              <option value="ALL">Tất cả vai trò</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {getRoleMeta(role).label} ({role})
                </option>
              ))}
            </select>
            <input
              className="admin-input"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo tên hoặc email"
            />
            <AdminBtn type="submit" variant="dark">
              Tìm kiếm
            </AdminBtn>
          </form>
        </div>

        {loading ? (
          <AdminEmpty>Đang tải…</AdminEmpty>
        ) : filteredUsers.length === 0 ? (
          <AdminEmpty>Không tìm thấy người dùng phù hợp.</AdminEmpty>
        ) : (
          <AdminTableWrap>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Email</th>
                  <th>Vai trò & Phân quyền</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th>Khóa / Mở khóa</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const roleMeta = getRoleMeta(user.role);
                  const statusMeta = getStatusMeta(user.status);
                  const isSelf = Number(user.id) === currentUserId;
                  return (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.fullName || "Chưa cập nhật"}</strong>
                        {isSelf ? (
                          <span style={{ marginLeft: 8 }}>
                            <AdminBadge tone="primary">Bạn</AdminBadge>
                          </span>
                        ) : null}
                      </td>
                      <td>{user.email || "—"}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <AdminBadge tone={roleMeta.tone}>{roleMeta.label}</AdminBadge>
                          <select
                            className="admin-input"
                            value={user.role}
                            onChange={(e) => handleChangeRole(user, e.target.value)}
                            disabled={roleLoadingId === user.id || isSelf}
                            title={isSelf ? "Không thể tự thay đổi quyền của chính mình" : "Đổi vai trò"}
                            style={{ minWidth: 135, padding: "4px 8px", fontSize: 12 }}
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>
                                {getRoleMeta(r).label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td>
                        <AdminBadge tone={statusMeta.tone}>{statusMeta.label}</AdminBadge>
                      </td>
                      <td>{formatAdminDateTime(user.createdAt)}</td>
                      <td>
                        <select
                          className="admin-input"
                          value={user.status}
                          onChange={(e) => handleChangeStatus(user, e.target.value)}
                          disabled={statusLoadingId === user.id || isSelf}
                          title={isSelf ? "Không thể tự khóa tài khoản của chính mình" : "Đổi trạng thái"}
                          style={{ minWidth: 140 }}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {getStatusMeta(status).label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </AdminTableWrap>
        )}
      </AdminCard>
    </AdminPage>
  );
}
