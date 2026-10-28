/**
 * RealtimeToast — Global toast notification system for Socket.io events
 * Mount this at root level to get notifications across all pages.
 * 
 * Usage: <RealtimeToast /> in RootApp.jsx
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../hooks/useAuth";

const TOAST_DURATION = 5000; // ms

const ICONS = {
  chat: "💬",
  ticket: "🎫",
  success: "✅",
  warning: "⚠️",
  info: "🔔",
  error: "❌"
};

let toastId = 0;

function Toast({ toast, onDismiss, onNavigate }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className="rt-toast"
      data-type={toast.type || "info"}
      role="alert"
      aria-live="polite"
      onClick={() => {
        onDismiss(toast.id);
        if (toast.link && onNavigate) onNavigate(toast.link);
      }}
      style={{ cursor: toast.link ? "pointer" : "default" }}
    >
      <span className="rt-toast-icon">{ICONS[toast.type] || ICONS.info}</span>
      <div className="rt-toast-body">
        <strong className="rt-toast-title">{toast.title}</strong>
        {toast.message && <p className="rt-toast-msg">{toast.message}</p>}
      </div>
      <button
        className="rt-toast-close"
        onClick={(e) => { e.stopPropagation(); onDismiss(toast.id); }}
        aria-label="Đóng thông báo"
      >
        ×
      </button>
      <div className="rt-toast-progress" style={{ animationDuration: `${TOAST_DURATION}ms` }} />
    </div>
  );
}

export function RealtimeToast() {
  const [toasts, setToasts] = useState([]);
  const { authState } = useAuth();
  const { joinRoom, on } = useSocket();
  const navigate = useNavigate();

  const addToast = useCallback((toast) => {
    setToasts((prev) => [
      ...prev,
      { id: ++toastId, ...toast }
    ]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const role = authState?.user?.role?.toUpperCase();
  const currentUserId = authState?.user?.id || authState?.user?.userId;

  useEffect(() => {
    // 🔔 Nhận thông báo in-app realtime cho tất cả người dùng đăng nhập
    if (currentUserId) {
      joinRoom("join_user", currentUserId);

      on("notification:new", (data) => {
        const typeMap = {
          ORDER: "info",
          WARRANTY: "success",
          TICKET: "ticket",
          SYSTEM: "info"
        };
        addToast({
          type: typeMap[data?.type] || "info",
          title: data?.title || "Thông báo mới",
          message: data?.message || "Bạn vừa nhận được một thông báo mới.",
          link: data?.link
        });
      });
    }

    if (!role) return;

    // Nhân viên bán hàng: nhận thông báo chat mới
    if (role === "SALES_STAFF" || role === "ADMIN") {
      joinRoom("join_staff_queue");

      on("queue:new_session", (data) => {
        addToast({
          type: "chat",
          title: "Yêu cầu tư vấn mới!",
          message: `Khách hàng ${data?.customerName || "mới"} đang chờ hỗ trợ.`
        });
      });
    }

    // Kỹ thuật viên: nhận thông báo ticket mới
    if (role === "TECH_STAFF" || role === "ADMIN") {
      joinRoom("join_tech_queue");

      on("tickets:new_ticket", (data) => {
        addToast({
          type: "ticket",
          title: "Ticket mới!",
          message: data?.title ? `"${data.title}"` : "Có ticket hỗ trợ mới cần xử lý."
        });
      });

      on("tickets:queue_updated", (data) => {
        if (data?.status === "RESOLVED" || data?.status === "CLOSED") {
          addToast({
            type: "success",
            title: "Ticket đã xử lý",
            message: `Ticket #${data.ticketId} đã được đóng.`
          });
        }
      });
    }

    // Khách hàng: nhận thông báo khi có phản hồi
    if (role === "CUSTOMER") {
      on("chat:new_message", (data) => {
        if (data?.sender === "staff") {
          addToast({
            type: "chat",
            title: "Nhân viên vừa phản hồi!",
            message: data?.text?.slice(0, 80) || "Bạn có tin nhắn mới."
          });
        }
      });
    }
  }, [role, currentUserId, joinRoom, on, addToast]);

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        .rt-container {
          position: fixed;
          bottom: 28px;
          right: 28px;
          z-index: 99999;
          display: flex;
          flex-direction: column-reverse;
          gap: 12px;
          pointer-events: none;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }
        .rt-toast {
          pointer-events: all;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          min-width: 300px;
          max-width: 420px;
          padding: 16px 16px 20px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(148, 163, 184, 0.18);
          box-shadow:
            0 8px 32px rgba(15, 23, 42, 0.14),
            0 2px 8px rgba(15, 23, 42, 0.08);
          cursor: pointer;
          position: relative;
          overflow: hidden;
          animation: rtSlideIn 300ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          transition: transform 200ms ease, box-shadow 200ms ease;
        }
        .rt-toast:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18), 0 4px 12px rgba(15, 23, 42, 0.1);
        }
        .rt-toast[data-type="chat"] { border-left: 4px solid #3b82f6; }
        .rt-toast[data-type="ticket"] { border-left: 4px solid #8b5cf6; }
        .rt-toast[data-type="success"] { border-left: 4px solid #22c55e; }
        .rt-toast[data-type="warning"] { border-left: 4px solid #f59e0b; }
        .rt-toast[data-type="error"] { border-left: 4px solid #ef4444; }
        .rt-toast[data-type="info"] { border-left: 4px solid #64748b; }
        .rt-toast-icon {
          font-size: 1.5rem;
          line-height: 1;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .rt-toast-body {
          flex: 1;
          min-width: 0;
        }
        .rt-toast-title {
          display: block;
          font-size: 0.95rem;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.3;
          margin-bottom: 4px;
        }
        .rt-toast-msg {
          margin: 0;
          font-size: 0.85rem;
          color: #475569;
          line-height: 1.5;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .rt-toast-close {
          position: absolute;
          top: 10px;
          right: 12px;
          background: none;
          border: none;
          font-size: 1.2rem;
          line-height: 1;
          color: #94a3b8;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 6px;
          transition: background 150ms ease, color 150ms ease;
        }
        .rt-toast-close:hover {
          background: #f1f5f9;
          color: #0f172a;
        }
        .rt-toast-progress {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          width: 100%;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          border-radius: 0 0 20px 20px;
          transform-origin: left;
          animation: rtProgress linear forwards;
        }
        @keyframes rtSlideIn {
          from {
            opacity: 0;
            transform: translateX(100%) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        @keyframes rtProgress {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
        @media (max-width: 480px) {
          .rt-container {
            bottom: 16px;
            right: 16px;
            left: 16px;
          }
          .rt-toast {
            min-width: 0;
            max-width: 100%;
          }
        }
      `}</style>
      <div className="rt-container" role="region" aria-label="Thông báo real-time">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissToast} onNavigate={navigate} />
        ))}
      </div>
    </>
  );
}

export default RealtimeToast;
