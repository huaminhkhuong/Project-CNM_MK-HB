import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { AnnouncementBar } from "./AnnouncementBar";

const ACCOUNT_LINKS = [
  { to: "/profile",           label: "Hồ sơ cá nhân",   icon: "👤", color: "#3b82f6" },
  { to: "/orders",            label: "Đơn hàng của tôi", icon: "📦", color: "#f5a623" },
  { to: "/profile#addresses", label: "Địa chỉ giao hàng",icon: "📍", color: "#10b981" },
  { to: "/warranties",        label: "Bảo hành của tôi", icon: "🛡️", color: "#8b5cf6" },
  { to: "/tickets",           label: "Ticket hỗ trợ",    icon: "🎫", color: "#06b6d4" },
];



function getUserDisplayName(user) {
  return user?.fullName || user?.name || user?.email || "khách hàng";
}

function getAvatarInitial(user) {
  return (getUserDisplayName(user).trim().charAt(0) || "U").toUpperCase();
}

export function TopBar() {
  const { authState, isAuthenticated, logout } = useAuth();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const accountRef  = useRef(null);
  const normalizedRole = String(authState?.user?.role || "").trim().toUpperCase();
  const displayName    = useMemo(() => getUserDisplayName(authState?.user), [authState?.user]);
  const avatarInitial  = useMemo(() => getAvatarInitial(authState?.user), [authState?.user]);

  const workspaceLinks = [];
  if (normalizedRole === "ADMIN") {
    workspaceLinks.push(
      { href: "/admin/dashboard", label: "Quản trị", color: "#ef4444" },
      { href: "/staff/orders",    label: "Bán hàng",  color: "#f5a623" },
      { href: "/tech/tickets",    label: "Kỹ thuật",  color: "#10b981" },
    );
  } else if (normalizedRole === "SALES_STAFF") {
    workspaceLinks.push({ href: "/staff/orders", label: "Xử lý đơn", color: "#f5a623" });
  } else if (normalizedRole === "TECH_STAFF") {
    workspaceLinks.push({ href: "/tech/tickets", label: "Ticket KT",  color: "#10b981" });
  }

  useEffect(() => {
    const onOutside = (e) => { if (!accountRef.current?.contains(e.target)) setIsAccountOpen(false); };
    const onEscape  = (e) => { if (e.key === "Escape") setIsAccountOpen(false); };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <div style={{
      background: "rgba(5, 8, 18, 0.95)",
      borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      position: "relative",
      zIndex: 101,
    }}>
      <div style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: "0 20px",
        height: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}>

        {/* ── Left: Announcement Bar (Promotions & Warranties) [UX-003] ── */}
        <AnnouncementBar />

        {/* ── Right: Links & Account ── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexShrink: 0,
        }}>

          {/* Workspace quick links (staff/admin) */}
          {workspaceLinks.length > 0 && (
            <div className="topbar-workspace-links" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {workspaceLinks.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  style={{
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: item.color,
                    background: `${item.color}18`,
                    border: `1px solid ${item.color}35`,
                    borderRadius: 9999,
                    textDecoration: "none",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    transition: "all 0.18s ease",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = `${item.color}30`;
                    e.currentTarget.style.boxShadow = `0 0 10px ${item.color}30`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = `${item.color}18`;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}

          {/* Divider */}
          {workspaceLinks.length > 0 && (
            <span className="topbar-divider" style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
          )}

          {/* Quick links */}
          <div className="topbar-quick-links" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {[
              { to: "/tickets", label: "Hỗ trợ" },
              { to: "/orders",  label: "Đơn hàng" },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "rgba(148, 163, 184, 0.85)",
                  textDecoration: "none",
                  padding: "3px 8px",
                  borderRadius: 6,
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#ffffff"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(148,163,184,0.85)"; e.currentTarget.style.background = "transparent"; }}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Divider */}
          <span className="topbar-divider" style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />

          {/* Account section */}
          {isAuthenticated ? (
            <div ref={accountRef} style={{ position: "relative", zIndex: 200 }}>
              {/* Account Trigger */}
              <button
                type="button"
                onClick={() => setIsAccountOpen((v) => !v)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "3px 10px 3px 4px",
                  background: isAccountOpen
                    ? "rgba(245, 166, 35, 0.12)"
                    : "rgba(255, 255, 255, 0.05)",
                  border: isAccountOpen
                    ? "1px solid rgba(245, 166, 35, 0.4)"
                    : "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 9999,
                  color: "#ffffff",
                  font: "inherit",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  height: 28,
                }}
                onMouseEnter={e => {
                  if (!isAccountOpen) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)";
                  }
                }}
                onMouseLeave={e => {
                  if (!isAccountOpen) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  }
                }}
                aria-haspopup="menu"
                aria-expanded={isAccountOpen}
              >
                {/* Avatar */}
                <span style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #f5a623, #f97316)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 900,
                  color: "#0f172a",
                  flexShrink: 0,
                  boxShadow: "0 0 8px rgba(245,166,35,0.3)",
                }}>
                  {avatarInitial}
                </span>
                <span className="topbar-account-name" style={{
                  maxWidth: 120,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "rgba(226, 232, 240, 0.9)",
                }}>
                  {displayName}
                </span>
                {/* Chevron */}
                <svg
                  width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke="#f5a623" strokeWidth="2.5" strokeLinecap="round"
                  style={{
                    transform: isAccountOpen ? "rotate(180deg)" : "rotate(0)",
                    transition: "transform 0.2s ease",
                    flexShrink: 0,
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Account Dropdown */}
              {isAccountOpen && (
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  width: 280,
                  background: "rgba(10, 14, 28, 0.98)",
                  backdropFilter: "blur(24px) saturate(160%)",
                  WebkitBackdropFilter: "blur(24px) saturate(160%)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 16,
                  boxShadow: "0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
                  overflow: "hidden",
                  animation: "v2-scaleIn 0.18s cubic-bezier(0.34, 1.56, 0.64, 1) both",
                }}
                  role="menu"
                >
                  {/* Profile Header */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "44px 1fr",
                    gap: 12,
                    alignItems: "center",
                    padding: "16px",
                    background: "linear-gradient(135deg, rgba(37,99,235,0.25), rgba(245,166,35,0.15))",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                  }}>
                    <span style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: "linear-gradient(135deg, #f5a623, #f97316)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, fontWeight: 900, color: "#0f172a",
                      boxShadow: "0 4px 14px rgba(245,166,35,0.35)",
                    }}>
                      {avatarInitial}
                    </span>
                    <div>
                      <div style={{
                        fontWeight: 800, fontSize: 14, color: "#ffffff",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {displayName}
                      </div>
                      <div style={{
                        fontSize: 11, color: "rgba(148,163,184,0.8)", marginTop: 2,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {authState?.user?.email || "Tài khoản PC Mall"}
                      </div>
                    </div>
                  </div>

                  {/* Menu Links */}
                  <div style={{ padding: "6px" }}>
                    {ACCOUNT_LINKS.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        role="menuitem"
                        onClick={() => setIsAccountOpen(false)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "9px 10px",
                          borderRadius: 10,
                          color: "rgba(203, 213, 225, 0.9)",
                          textDecoration: "none",
                          fontSize: 13,
                          fontWeight: 600,
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                          e.currentTarget.style.color = "#ffffff";
                          e.currentTarget.style.paddingLeft = "14px";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "rgba(203,213,225,0.9)";
                          e.currentTarget.style.paddingLeft = "10px";
                        }}
                      >
                        <span style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: `${item.color}18`,
                          display: "flex", alignItems: "center",
                          justifyContent: "center", fontSize: 14, flexShrink: 0,
                        }}>
                          {item.icon}
                        </span>
                        {item.label}
                        <svg style={{ marginLeft: "auto", opacity: 0.3, flexShrink: 0 }}
                          width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </Link>
                    ))}
                  </div>

                  {/* Logout */}
                  <div style={{ padding: "6px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setIsAccountOpen(false); logout(); }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "9px 10px",
                        borderRadius: 10,
                        background: "transparent",
                        border: "none",
                        color: "rgba(248, 113, 113, 0.85)",
                        font: "inherit",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                        e.currentTarget.style.color = "#f87171";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "rgba(248,113,113,0.85)";
                      }}
                    >
                      <span style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: "rgba(239,68,68,0.12)",
                        display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 14, flexShrink: 0,
                      }}>
                        🚪
                      </span>
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Guest: Login / Register */
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Link
                to="/login"
                style={{
                  fontSize: 12, fontWeight: 600,
                  color: "rgba(148,163,184,0.85)",
                  textDecoration: "none",
                  padding: "3px 10px",
                  borderRadius: 6,
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(148,163,184,0.85)"; e.currentTarget.style.background = "transparent"; }}
              >
                Đăng nhập
              </Link>
              <Link
                to="/register"
                style={{
                  fontSize: 12, fontWeight: 800,
                  color: "#0f172a",
                  background: "linear-gradient(135deg, #f5a623, #f97316)",
                  textDecoration: "none",
                  padding: "3px 12px",
                  borderRadius: 9999,
                  transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  boxShadow: "0 2px 8px rgba(245,166,35,0.3)",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "scale(1.06)";
                  e.currentTarget.style.boxShadow = "0 4px 14px rgba(245,166,35,0.45)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(245,166,35,0.3)";
                }}
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
