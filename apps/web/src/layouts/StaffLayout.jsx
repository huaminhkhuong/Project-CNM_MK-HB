import { useEffect, useState } from "react";
import { Navigate, Link, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { getChatQueueStats } from "../services/chat.service";
import { NotificationBell } from "../components/notifications/NotificationBell";

const STAFF_NAV_ITEMS = [
  {
    to: "/staff/orders",
    label: "Đơn hàng",
    icon: "📦"
  },
  {
    to: "/staff/chat",
    label: "Tư vấn khách",
    icon: "💬",
    showQueueBadge: true
  }
];

const ROLE_LABELS = {
  ADMIN: "Quản trị viên",
  SALES_STAFF: "Nhân viên kinh doanh",
  SALES: "Nhân viên kinh doanh"
};

function getStatsData(response) {
  if (response && typeof response === "object" && "data" in response) {
    return response.data ?? null;
  }
  return response ?? null;
}

export function StaffLayout() {
  const location = useLocation();
  const { authState, isAuthenticated, logout } = useAuth();
  const [chatWaiting, setChatWaiting] = useState(0);
  const role = String(authState?.user?.role || "").toUpperCase();
  const staffName = authState?.user?.fullName || authState?.user?.email || "Nhân viên";
  const roleLabel = ROLE_LABELS[role] || role || "Nhân viên";
  const canAccess = ["ADMIN", "SALES_STAFF", "SALES"].includes(role);

  useEffect(() => {
    if (!canAccess) return undefined;

    async function loadStats() {
      try {
        const response = await getChatQueueStats();
        const stats = getStatsData(response);
        setChatWaiting(Number(stats?.waiting || 0));
      } catch {
        setChatWaiting(0);
      }
    }

    loadStats();
    const interval = setInterval(loadStats, 12000);
    return () => clearInterval(interval);
  }, [canAccess]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="staff-shell">
      <header className="staff-topbar">
        <div className="staff-topbar__inner">
          <Link to="/" className="staff-brand">
            <span className="staff-brand__mark">PC</span>
            <span>
              <span className="staff-brand__name">PC Mall</span>
              <span className="staff-brand__sub">Khu vực kinh doanh</span>
            </span>
          </Link>

          <nav className="staff-nav" aria-label="Sales staff navigation">
            {STAFF_NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.to;
              const badge = item.showQueueBadge && chatWaiting > 0 ? chatWaiting : 0;

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`staff-nav__link${isActive ? " staff-nav__link--active" : ""}`}
                >
                  <span className="staff-nav__icon" aria-hidden>
                    {item.icon}
                  </span>
                  {item.label}
                  {badge > 0 ? <span className="staff-nav__badge">{badge}</span> : null}
                </Link>
              );
            })}
          </nav>

          <div className="staff-account">
            <NotificationBell />
            <div>
              <div className="staff-account__name">{staffName}</div>
              <div className="staff-account__role">{roleLabel}</div>
            </div>
            {role === "ADMIN" ? (
              <Link className="staff-account__link" to="/admin/dashboard">
                Admin
              </Link>
            ) : null}
            <Link className="staff-account__link" to="/">
              Cửa hàng
            </Link>
            <button
              type="button"
              className="staff-account__link"
              onClick={logout}
              style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer" }}
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <main className="staff-content">
        <Outlet />
      </main>
    </div>
  );
}
