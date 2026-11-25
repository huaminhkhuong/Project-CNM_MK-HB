import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useSocket } from "../../hooks/useSocket";
import {
  getMyNotifications,
  getMyUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from "../../services/notification.service";

function formatRelativeTime(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Vừa xong";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} giờ trước`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} ngày trước`;

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

const TYPE_CONFIG = {
  ORDER: {
    icon: "📦",
    label: "Đơn hàng",
    badgeBg: "rgba(245, 166, 35, 0.15)",
    badgeColor: "#f5a623",
    borderColor: "rgba(245, 166, 35, 0.3)"
  },
  WARRANTY: {
    icon: "🛡️",
    label: "Bảo hành",
    badgeBg: "rgba(16, 185, 129, 0.15)",
    badgeColor: "#10b981",
    borderColor: "rgba(16, 185, 129, 0.3)"
  },
  TICKET: {
    icon: "🎫",
    label: "Ticket KT",
    badgeBg: "rgba(139, 92, 246, 0.15)",
    badgeColor: "#8b5cf6",
    borderColor: "rgba(139, 92, 246, 0.3)"
  },
  SYSTEM: {
    icon: "🔔",
    label: "Hệ thống",
    badgeBg: "rgba(59, 130, 246, 0.15)",
    badgeColor: "#3b82f6",
    borderColor: "rgba(59, 130, 246, 0.3)"
  }
};

export function NotificationBell() {
  const { authState, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { joinRoom, on } = useSocket();

  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [animatingBell, setAnimatingBell] = useState(false);

  const containerRef = useRef(null);
  const userId = authState?.user?.id || authState?.user?.userId;

  // Lấy unread count khi khởi động
  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setUnreadCount(0);
      setNotifications([]);
      return;
    }

    let active = true;
    getMyUnreadCount()
      .then((count) => {
        if (active) setUnreadCount(count);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [isAuthenticated, userId]);

  // Tham gia phòng Socket cá nhân & lắng nghe notification mới
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    // Join personal user room in Socket.io
    joinRoom("join_user", userId);

    const handleNewNotification = (newNotif) => {
      // Tăng unread count
      setUnreadCount((prev) => prev + 1);

      // Hiệu ứng rung chuông
      setAnimatingBell(true);
      setTimeout(() => setAnimatingBell(false), 1200);

      // Thêm vào đầu danh sách
      setNotifications((prev) => [newNotif, ...prev]);
    };

    on("notification:new", handleNewNotification);
  }, [isAuthenticated, userId, joinRoom, on]);

  // Load danh sách thông báo khi mở dropdown hoặc đổi tab
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await getMyNotifications({
        limit: 25,
        type: activeTab === "ALL" ? undefined : activeTab
      });
      if (res?.data) {
        setNotifications(res.data);
      }
    } catch (err) {
      console.warn("Không thể tải danh sách thông báo:", err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, activeTab]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Đóng dropdown khi click ra ngoài hoặc bấm Escape
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // Xử lý click vào 1 thông báo
  const handleItemClick = async (notif) => {
    try {
      if (!notif.isRead) {
        await markNotificationAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((item) => (item.id === notif.id ? { ...item, isRead: true } : item))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.warn("Lỗi đánh dấu đã đọc:", err);
    }

    setIsOpen(false);

    if (notif.link) {
      navigate(notif.link);
    }
  };

  // Đánh dấu tất cả là đã đọc
  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn("Lỗi đánh dấu tất cả đã đọc:", err);
    }
  };

  const filteredNotifications = useMemo(() => {
    if (activeTab === "ALL") return notifications;
    return notifications.filter((n) => n.type === activeTab);
  }, [notifications, activeTab]);

  if (!isAuthenticated) return null;

  return (
    <div ref={containerRef} style={{ position: "relative", zIndex: 110 }}>
      {/* ── Bell Trigger Button ── */}
      <button
        type="button"
        title="Thông báo"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          position: "relative",
          width: 38,
          height: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 10,
          background: isOpen ? "rgba(59, 130, 246, 0.22)" : "rgba(255, 255, 255, 0.06)",
          border: isOpen ? "1px solid rgba(59, 130, 246, 0.5)" : "1px solid rgba(255, 255, 255, 0.1)",
          color: isOpen ? "#60a5fa" : "#ffffff",
          cursor: "pointer",
          flexShrink: 0,
          transition: "all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
          animation: animatingBell ? "cnm-bell-ring 0.8s ease" : "none"
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.background = "rgba(59, 130, 246, 0.16)";
            e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.35)";
            e.currentTarget.style.transform = "scale(1.06)";
            e.currentTarget.style.boxShadow = "0 0 12px rgba(59,130,246,0.25)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "none";
          }
        }}
        aria-label="Thông báo"
        aria-expanded={isOpen}
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "linear-gradient(135deg, #ef4444, #f97316)",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: 800,
              minWidth: 18,
              height: 18,
              lineHeight: "18px",
              borderRadius: 9,
              textAlign: "center",
              padding: "0 4px",
              boxShadow: "0 2px 8px rgba(239, 68, 68, 0.55)",
              pointerEvents: "none"
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown Popover ── */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: 380,
            maxWidth: "calc(100vw - 32px)",
            background: "rgba(10, 15, 30, 0.96)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: 18,
            boxShadow:
              "0 24px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(59, 130, 246, 0.15)",
            overflow: "hidden",
            animation: "cnm-popover-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) both"
          }}
          role="region"
          aria-label="Trung tâm thông báo"
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 18px 12px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              background: "linear-gradient(180deg, rgba(30, 41, 59, 0.5) 0%, transparent 100%)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#ffffff" }}>
                Thông báo
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: "rgba(239, 68, 68, 0.2)",
                    color: "#f87171",
                    border: "1px solid rgba(239, 68, 68, 0.35)",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 9999
                  }}
                >
                  {unreadCount} mới
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#60a5fa",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 8px",
                  borderRadius: 6,
                  transition: "all 0.18s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(59, 130, 246, 0.15)";
                  e.currentTarget.style.color = "#93c5fd";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#60a5fa";
                }}
              >
                <span>✓</span> Đã đọc tất cả
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div
            style={{
              display: "flex",
              gap: 6,
              padding: "10px 14px 6px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
              overflowX: "auto"
            }}
          >
            {[
              { id: "ALL", label: "Tất cả" },
              { id: "ORDER", label: "📦 Đơn hàng" },
              { id: "WARRANTY", label: "🛡️ Bảo hành" },
              { id: "TICKET", label: "🎫 Ticket" }
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 9999,
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    background: active ? "rgba(59, 130, 246, 0.25)" : "rgba(255, 255, 255, 0.04)",
                    border: active ? "1px solid rgba(59, 130, 246, 0.5)" : "1px solid rgba(255, 255, 255, 0.06)",
                    color: active ? "#ffffff" : "rgba(148, 163, 184, 0.85)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.18s ease"
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                      e.currentTarget.style.color = "#ffffff";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                      e.currentTarget.style.color = "rgba(148, 163, 184, 0.85)";
                    }
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* List items */}
          <div
            style={{
              maxHeight: 380,
              overflowY: "auto",
              padding: "6px"
            }}
          >
            {loading && notifications.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "40px 20px",
                  color: "#94a3b8",
                  fontSize: 13
                }}
              >
                <span>Đang tải thông báo...</span>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "44px 20px",
                  color: "rgba(148, 163, 184, 0.85)"
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
                  Chưa có thông báo nào
                </div>
                <p style={{ fontSize: 12, margin: "6px 0 0", color: "#64748b" }}>
                  Các cập nhật trạng thái đơn hàng, bảo hành & ticket hỗ trợ sẽ hiển thị tại đây.
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const conf = TYPE_CONFIG[item.type] || TYPE_CONFIG.SYSTEM;
                const isUnread = !item.isRead;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: isUnread ? "rgba(59, 130, 246, 0.08)" : "transparent",
                      border: isUnread
                        ? "1px solid rgba(59, 130, 246, 0.2)"
                        : "1px solid transparent",
                      marginBottom: 4,
                      cursor: "pointer",
                      transition: "all 0.16s ease",
                      position: "relative"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isUnread
                        ? "rgba(59, 130, 246, 0.16)"
                        : "rgba(255, 255, 255, 0.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isUnread
                        ? "rgba(59, 130, 246, 0.08)"
                        : "transparent";
                    }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: conf.badgeBg,
                        border: `1px solid ${conf.borderColor}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        flexShrink: 0
                      }}
                    >
                      {conf.icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          marginBottom: 4
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: isUnread ? 800 : 600,
                            color: isUnread ? "#ffffff" : "rgba(226, 232, 240, 0.9)",
                            lineHeight: 1.3
                          }}
                        >
                          {item.title}
                        </span>
                        {isUnread && (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "#3b82f6",
                              boxShadow: "0 0 8px #3b82f6",
                              flexShrink: 0
                            }}
                          />
                        )}
                      </div>

                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          color: "rgba(148, 163, 184, 0.85)",
                          lineHeight: 1.45,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden"
                        }}
                      >
                        {item.message}
                      </p>

                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 11,
                          color: "#64748b",
                          display: "flex",
                          alignItems: "center",
                          gap: 6
                        }}
                      >
                        <span style={{ color: conf.badgeColor, fontWeight: 600 }}>
                          {conf.label}
                        </span>
                        <span>•</span>
                        <span>{formatRelativeTime(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "10px 14px",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              background: "rgba(5, 8, 18, 0.5)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate("/orders");
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(148, 163, 184, 0.9)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: 6,
                transition: "color 0.15s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(148, 163, 184, 0.9)")}
            >
              Xem đơn hàng →
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate("/warranties");
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#10b981",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: 6,
                transition: "color 0.15s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#34d399")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#10b981")}
            >
              Tra cứu bảo hành →
            </button>
          </div>
        </div>
      )}

      {/* Animation Styles */}
      <style>{`
        @keyframes cnm-bell-ring {
          0% { transform: rotate(0); }
          15% { transform: rotate(14deg); }
          30% { transform: rotate(-14deg); }
          45% { transform: rotate(10deg); }
          60% { transform: rotate(-8deg); }
          75% { transform: rotate(4deg); }
          100% { transform: rotate(0); }
        }
        @keyframes cnm-popover-in {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

export default NotificationBell;
