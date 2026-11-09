import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";

import { NotificationBell } from "../components/notifications/NotificationBell";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../hooks/useSocket";
import { getTicketStats } from "../services/ticket.service";

const TECH_NAV_ITEMS = [
  { to: "/tech/tickets", label: "Ticket kỹ thuật", icon: "🎫", showQueueBadge: true },
  { to: "/tech/compatibility", label: "Luật tương thích", icon: "🔗" },
  { to: "/tech/warranties", label: "Xử lý bảo hành", icon: "🛠️" }
];

const ROLE_LABELS = {
  ADMIN: "Quản trị viên",
  TECH_STAFF: "Nhân viên kỹ thuật",
  TECHNICIAN: "Nhân viên kỹ thuật"
};

function getStatsData(response) {
  if (response && typeof response === "object" && "data" in response) {
    return response.data ?? null;
  }
  return response ?? null;
}

export function TechLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { authState, isAuthenticated, logout } = useAuth();
  const { joinRoom, on } = useSocket();
  const [queueCount, setQueueCount] = useState(0);
  const role = String(authState?.user?.role || "").toUpperCase();
  const techName = authState?.user?.fullName || authState?.user?.email || "Nhân viên kỹ thuật";
  const roleLabel = ROLE_LABELS[role] || role || "Kỹ thuật";
  const canAccess = ["ADMIN", "TECH_STAFF", "TECHNICIAN"].includes(role);

  const loadStats = useCallback(async () => {
    try {
      const response = await getTicketStats();
      const stats = getStatsData(response);
      setQueueCount(Number(stats?.unassigned || stats?.waiting || 0));
    } catch {
      setQueueCount(0);
    }
  }, []);

  useEffect(() => {
    if (!canAccess) return undefined;

    loadStats();
    const interval = setInterval(loadStats, 15000);
    return () => clearInterval(interval);
  }, [canAccess, loadStats]);

  useEffect(() => {
    if (!canAccess) return undefined;
    joinRoom("join_tech_queue");
    const unsubNew = on("tickets:new_ticket", () => loadStats());
    const unsubUpdate = on("tickets:queue_updated", () => loadStats());
    return () => {
      if (typeof unsubNew === "function") unsubNew();
      if (typeof unsubUpdate === "function") unsubUpdate();
    };
  }, [canAccess, joinRoom, on, loadStats]);

  async function handleLogout() {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      navigate("/login", { replace: true });
    }
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="tech-shell">
      <header className="tech-topbar">
        <div className="tech-topbar__inner">
          <Link to="/" className="tech-brand">
            <span className="tech-brand__mark">PC</span>
            <span>
              <span className="tech-brand__name">PC Mall</span>
              <span className="tech-brand__sub">Khu vực kỹ thuật</span>
            </span>
          </Link>

          <nav className="tech-nav" aria-label="Tech staff navigation">
            {TECH_NAV_ITEMS.map((item) => {
              const isActive = !item.external && location.pathname.startsWith(item.to);
              const badge = item.showQueueBadge && queueCount > 0 ? queueCount : 0;

              if (item.external) {
                return (
                  <a key={item.to} href={item.to} className="tech-nav__link">
                    <span className="tech-nav__icon" aria-hidden>
                      {item.icon}
                    </span>
                    {item.label}
                  </a>
                );
              }

              return (
                <Link key={item.to} to={item.to} className={`tech-nav__link${isActive ? " tech-nav__link--active" : ""}`}>
                  <span className="tech-nav__icon" aria-hidden>
                    {item.icon}
                  </span>
                  {item.label}
                  {badge > 0 ? <span className="tech-nav__badge">{badge}</span> : null}
                </Link>
              );
            })}
          </nav>

          <div className="tech-account">
            <NotificationBell />
            <div>
              <div className="tech-account__name">{techName}</div>
              <div className="tech-account__role">{roleLabel}</div>
            </div>
            {role === "ADMIN" ? (
              <Link className="tech-account__link" to="/admin/dashboard">
                Admin
              </Link>
            ) : null}
            <Link className="tech-account__link" to="/">
              Cửa hàng
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="tech-account__link"
              style={{
                cursor: "pointer",
                background: "#fef2f2",
                color: "#b91c1c",
                border: "1px solid #fecaca",
                fontWeight: 800
              }}
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <main className="tech-content">
        <Outlet />
      </main>
    </div>
  );
}
