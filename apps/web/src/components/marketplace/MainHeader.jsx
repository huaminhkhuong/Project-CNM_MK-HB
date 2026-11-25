import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { SearchBar } from "./SearchBar";
import { ThemeToggle } from "../common/ThemeToggle";
import { useCart } from "../../hooks/useCart";
import { NotificationBell } from "../notifications/NotificationBell";

export function MainHeader() {
  const { authState } = useAuth();
  const location = useLocation();
  const normalizedRole = String(authState?.user?.role || "").trim().toUpperCase();
  const [scrolled, setScrolled] = useState(false);
  const [bump, setBump] = useState(false);
  const { totalCount: cartCount, reloadCart } = useCart();

  useEffect(() => {
    reloadCart();
  }, [authState?.accessToken, location.pathname, reloadCart]);

  useEffect(() => {
    if (cartCount > 0) {
      setBump(true);
      const timer = setTimeout(() => setBump(false), 300);
      return () => clearTimeout(timer);
    }
  }, [cartCount]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { href: "/pc-builder",  label: "Lắp ráp PC",  icon: "⚙️" },
    { href: "/products",    label: "Linh kiện",    icon: "🖥️" },
    { href: "/compare",     label: "So sánh",      icon: "⚖️" },
    { href: "/ai-chat",     label: "AI Tư Vấn",   icon: "✨" },
    { href: "/warranties",  label: "Bảo hành",    icon: "🛡️" },
  ];

  const workspaceLink =
    normalizedRole === "ADMIN"
      ? { href: "/admin/dashboard", label: "Quản trị" }
      : normalizedRole === "SALES_STAFF"
        ? { href: "/staff/orders", label: "Bàn xử lý" }
        : normalizedRole === "TECH_STAFF"
          ? { href: "/tech/tickets", label: "Kỹ thuật" }
          : null;

  return (
    <header
      className="market-header"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        height: 64,
        background: scrolled
          ? "rgba(8, 13, 26, 0.88)"
          : "rgba(8, 13, 26, 0.70)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        borderBottom: scrolled
          ? "1px solid rgba(59, 130, 246, 0.2)"
          : "1px solid rgba(255, 255, 255, 0.06)",
        boxShadow: scrolled
          ? "0 4px 24px rgba(0, 0, 0, 0.4), 0 1px 0 rgba(59, 130, 246, 0.15)"
          : "0 1px 0 rgba(255, 255, 255, 0.04)",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          height: "100%",
          padding: "0 20px",
          gap: 16,
        }}
      >
        {/* ── Logo ── */}
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            flexShrink: 0,
            transition: "opacity 0.2s",
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #f5a623 0%, #f97316 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 4px 14px rgba(245, 166, 35, 0.45), 0 0 0 1px rgba(245,166,35,0.2)",
              transition: "box-shadow 0.3s ease",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <span
            style={{
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              background: "linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              whiteSpace: "nowrap",
              fontFamily: "'Be Vietnam Pro', sans-serif",
            }}
          >
            PC Mall
          </span>
        </Link>

        {/* ── Navigation ── */}
        <nav style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          {navLinks.map((link) => {
            const isActive = location.pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                to={link.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: 20,
                  color: isActive ? "#ffffff" : "rgba(203, 213, 225, 0.9)",
                  background: isActive
                    ? "linear-gradient(135deg, rgba(37, 99, 235, 0.7), rgba(59, 130, 246, 0.5))"
                    : "transparent",
                  border: isActive
                    ? "1px solid rgba(59, 130, 246, 0.5)"
                    : "1px solid transparent",
                  textDecoration: "none",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 13.5,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  transition: "all 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: isActive ? "0 0 16px rgba(59, 130, 246, 0.25)" : "none",
                  letterSpacing: isActive ? "-0.01em" : "0",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.07)";
                    e.currentTarget.style.color = "#ffffff";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "rgba(203, 213, 225, 0.9)";
                    e.currentTarget.style.borderColor = "transparent";
                  }
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>{link.icon}</span>
                <span style={{ whiteSpace: "nowrap" }}>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* ── Spacer ── */}
        <div style={{ flex: 1, minWidth: 8 }} />

        {/* ── Right Actions ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {/* Search */}
          <div style={{ width: 200, flexShrink: 0 }}>
            <SearchBar />
          </div>

          {/* Theme Toggle */}
          <ThemeToggle showLabel={false} />

          {/* Workspace Link */}
          {workspaceLink && (
            <Link
              to={workspaceLink.href}
              style={{
                color: "#f5a623",
                fontWeight: 700,
                fontSize: 12,
                textDecoration: "none",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: "6px 14px",
                border: "1px solid rgba(245, 166, 35, 0.35)",
                background: "rgba(245, 166, 35, 0.08)",
                borderRadius: 20,
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all 0.22s ease",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(245, 166, 35, 0.18)";
                e.currentTarget.style.boxShadow = "0 0 14px rgba(245,166,35,0.25)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(245, 166, 35, 0.08)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {workspaceLink.label}
            </Link>
          )}

          {/* In-app Notifications */}
          <NotificationBell />

          {/* Cart */}
          <Link
            id="header-cart-link"
            data-testid="header-cart-link"
            to="/cart"
            title="Giỏ hàng"
            aria-label="Giỏ hàng"
            style={{
              position: "relative",
              width: 38,
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#ffffff",
              textDecoration: "none",
              flexShrink: 0,
              transition: "all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(59, 130, 246, 0.2)";
              e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.4)";
              e.currentTarget.style.transform = "scale(1.08)";
              e.currentTarget.style.boxShadow = "0 0 14px rgba(59,130,246,0.3)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            {cartCount > 0 && (
              <span
                id="header-cart-badge"
                data-testid="header-cart-badge"
                className="header-cart-badge"
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  background: "#ef4444",
                  color: "#ffffff",
                  fontSize: "10px",
                  fontWeight: 700,
                  minWidth: 18,
                  height: 18,
                  lineHeight: "18px",
                  borderRadius: 9,
                  textAlign: "center",
                  padding: "0 4px",
                  boxShadow: "0 2px 6px rgba(239, 68, 68, 0.5)",
                  pointerEvents: "none",
                  transform: bump ? "scale(1.3)" : "scale(1)",
                  transition: "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              >
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
