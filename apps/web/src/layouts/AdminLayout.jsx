import { Navigate, Link, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

const ADMIN_NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Tổng quan", icon: "📊" },
  { to: "/admin/ai-config", label: "Quản trị AI & Lọc", icon: "🧠" },
  { to: "/admin/system", label: "Hệ thống", icon: "⚙️" },
  { to: "/admin/products", label: "Sản phẩm", icon: "🏷️" },
  { to: "/admin/attributes", label: "Thuộc tính", icon: "✨" },
  { to: "/admin/skus", label: "SKU", icon: "📦" },
  { to: "/admin/users", label: "Người dùng", icon: "👥" },
  { to: "/admin/payment-approval", label: "Duyệt thanh toán", icon: "💳" },
  { to: "/admin/compatibility-rules", label: "Tương thích", icon: "🔗" },
  { to: "/staff/orders", label: "Đơn hàng", icon: "🛒", external: true }
];

export function AdminLayout() {
  const location = useLocation();
  const { authState, isAuthenticated } = useAuth();
  const role = String(authState?.user?.role || "").toUpperCase();
  const adminName = authState?.user?.fullName || authState?.user?.email || "Quản trị viên";
  const canAccess = role === "ADMIN";

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar__inner">
          <Link to="/admin/dashboard" className="admin-brand">
            <span className="admin-brand__mark">ADM</span>
            <span>
              <span className="admin-brand__name">PC Mall Admin</span>
              <span className="admin-brand__sub">Trung tâm điều hành</span>
            </span>
          </Link>

          <nav className="admin-nav" aria-label="Admin navigation">
            {ADMIN_NAV_ITEMS.map((item) => {
              const isActive = !item.external && location.pathname.startsWith(item.to);
              const className = `admin-nav__link${isActive ? " admin-nav__link--active" : ""}`;

              if (item.external) {
                return (
                  <a key={item.to} href={item.to} className={className}>
                    <span className="admin-nav__icon" aria-hidden>
                      {item.icon}
                    </span>
                    {item.label}
                  </a>
                );
              }

              return (
                <Link key={item.to} to={item.to} className={className}>
                  <span className="admin-nav__icon" aria-hidden>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="admin-account">
            <div className="admin-account__meta">
              <div className="admin-account__name">{adminName}</div>
              <div className="admin-account__role">Quản trị viên</div>
            </div>
            <Link to="/" className="admin-account__link">
              Cửa hàng
            </Link>
          </div>
        </div>
      </header>

      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}
