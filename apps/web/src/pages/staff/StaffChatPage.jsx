import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

import { useAuth } from "../../hooks/useAuth";
import { useSocket } from "../../hooks/useSocket";
import { usePcBuilder } from "../../hooks/usePcBuilder";
import {
  acceptChatSession,
  closeChatSession,
  getChatQueue,
  getChatSession,
  sendChatMessage
} from "../../services/chat.service";

const QUICK_REPLIES = [
  "Chào bạn, PC Mall rất vui được hỗ trợ bạn.",
  "Bạn cho mình biết ngân sách và nhu cầu sử dụng để mình tư vấn sát hơn nhé.",
  "Mình đã chuẩn bị gợi ý cấu hình và sản phẩm phù hợp, bạn xem giúp mình.",
  "Nếu bạn muốn chốt nhanh, mình có thể gửi link sản phẩm và hỗ trợ lên đơn ngay."
];

const STATUS_FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "waiting_staff", label: "Yêu cầu mới" },
  { value: "assigned", label: "Đang xử lý" },
  { value: "waiting_customer", label: "Chờ khách" }
];

const NOTE_STORAGE_PREFIX = "pcmall_staff_chat_note_";

function getErrorMessage(error, fallback) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback;
  }
  return error?.message || fallback;
}

function getEnvelopeData(response, fallback) {
  if (response && typeof response === "object" && "data" in response) {
    return response.data ?? fallback;
  }
  return response ?? fallback;
}

function formatTime(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  });
}

function getStatusMeta(status) {
  const normalized = String(status || "").toLowerCase();
  if (["waiting", "waiting_staff", "open"].includes(normalized)) {
    return { tone: "warning", label: "Yêu cầu mới" };
  }
  if (["assigned", "active"].includes(normalized)) {
    return { tone: "info", label: "Đang xử lý" };
  }
  if (normalized === "waiting_customer") {
    return { tone: "success", label: "Chờ khách phản hồi" };
  }
  if (normalized === "resolved") {
    return { tone: "neutral", label: "Đã giải quyết" };
  }
  return { tone: "neutral", label: "Đã đóng" };
}

function getConversationTypeLabel(type) {
  return type === "SALES_CONSULTATION" ? "Tư vấn bán hàng" : "Hỗ trợ trực tiếp";
}

function getLastMessageText(session) {
  const last = session?.messages?.[session.messages.length - 1];
  if (session?.lastMessage) return session.lastMessage;
  if (session?.preview) return session.preview;
  if (last?.text) return last.text;
  return "Khách đang chờ nhân viên phản hồi.";
}

function Spinner() {
  return <span className="sales-chat-spinner" aria-hidden="true" />;
}

export default function StaffChatPage() {
  const { authState } = useAuth();
  const staffName = authState?.user?.fullName || authState?.user?.email || "Nhân viên bán hàng";
  const { joinRoom, leaveRoom, on } = useSocket();
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [productTitle, setProductTitle] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [productSuggestionError, setProductSuggestionError] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const messagesContainerRef = useRef(null);

  const {
    activeBuild,
    totalPrice,
    actions: { clearAll, refreshCurrentBuild }
  } = usePcBuilder("Tư vấn khách hàng");

  const waitingCount = useMemo(
    () => sessions.filter((session) => ["waiting", "waiting_staff", "open"].includes(String(session.status || "").toLowerCase())).length,
    [sessions]
  );

  const filteredSessions = useMemo(() => {
    if (statusFilter === "all") return sessions;
    return sessions.filter((session) => {
      const status = String(session.status || "").toLowerCase();
      if (statusFilter === "waiting_staff") return ["waiting", "waiting_staff", "open"].includes(status);
      if (statusFilter === "assigned") return ["assigned", "active"].includes(status);
      return status === statusFilter;
    });
  }, [sessions, statusFilter]);

  const selectedSummary = useMemo(() => {
    const components = activeBuild?.components || {};
    return {
      count: Object.keys(components).length,
      total: Number(totalPrice || 0)
    };
  }, [activeBuild, totalPrice]);

  const loadQueue = useCallback(async () => {
    try {
      const response = await getChatQueue();
      const list = getEnvelopeData(response, []);
      setSessions(Array.isArray(list) ? list : []);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể tải hàng đợi tư vấn."));
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Khởi đầu: load queue một lần khi vào trang
  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // 🔌 Socket.io: Đăng ký nhận thông báo real-time cho nhân viên bán hàng & tham gia routing pool
  useEffect(() => {
    // Tham gia room hàng đợi nhân viên kèm thông tin danh tính nhân viên
    joinRoom("join_staff_queue", {
      staffId: authState?.user?.id,
      staffName: staffName,
      role: authState?.user?.role || "SALES_STAFF"
    });

    // Khi session được phân phối tự động trực tiếp cho nhân viên này (Round-robin / Least-busy)
    on("staff:session_assigned", (assignedSession) => {
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.sessionId !== assignedSession.sessionId && s.id !== assignedSession.id);
        return [assignedSession, ...filtered];
      });
      // Nếu chưa chọn phiên nào hoặc đang rảnh, tự động mở phiên được giao
      setActiveSession((current) => current ? current : assignedSession);
      setSuccessMessage(`Bạn vừa được hệ thống tự động phân phối phiên tư vấn của ${assignedSession.customerName || "khách hàng"}!`);
    });

    // Khi có session mới từ khách hàng
    on("queue:new_session", (newSession) => {
      setSessions((prev) => {
        // Tránh duplicate
        const exists = prev.some((s) => s.sessionId === newSession.sessionId || s.id === newSession.id);
        if (exists) return prev;
        return [newSession, ...prev];
      });
    });

    // Khi queue cập nhật (có tin nhắn mới, status thay đổi)
    on("queue:updated", ({ sessionId, status }) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.sessionId === sessionId ? { ...s, status: status || s.status } : s
        )
      );
    });

    return () => {
      leaveRoom("leave_staff_queue");
    };
  }, [joinRoom, leaveRoom, on, authState?.user?.id, authState?.user?.role, staffName]);

  // 🔌 Socket.io: Lắng nghe tin nhắn real-time trong session đang xem
  useEffect(() => {
    if (!activeSession?.sessionId) return;

    // Tham gia room của session này
    joinRoom("join_chat", activeSession.sessionId);

    // Nhận tin nhắn mới ngay tức thì
    on("chat:new_message", (message) => {
      setActiveSession((prev) => {
        if (!prev) return prev;
        const alreadyExists = prev.messages?.some(
          (m) => String(m.id) === String(message.id)
        );
        if (alreadyExists) return prev;
        return {
          ...prev,
          messages: [...(prev.messages || []), message]
        };
      });
    });

    // Khi session được cập nhật (nhân viên khác nhận, status thay đổi)
    on("chat:session_updated", (updatedSession) => {
      setActiveSession(updatedSession);
    });

    // Khi session bị đóng
    on("chat:session_closed", () => {
      setActiveSession((prev) =>
        prev ? { ...prev, status: "closed" } : prev
      );
      setSuccessMessage("Phên tư vấn đã được kết thúc.");
    });

    // Cleanup: rời room khi đổi session
    return () => {
      leaveRoom("leave_chat", activeSession.sessionId);
    };
  }, [activeSession?.sessionId, joinRoom, leaveRoom, on]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceToBottom = container.scrollHeight - (container.scrollTop + container.clientHeight);
    if (distanceToBottom < 120 || actionLoading === "send") {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [activeSession?.messages, actionLoading]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = window.setTimeout(() => setSuccessMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    if (!activeSession?.sessionId) {
      setCustomerNote("");
      return;
    }
    setCustomerNote(window.localStorage.getItem(`${NOTE_STORAGE_PREFIX}${activeSession.sessionId}`) || "");
  }, [activeSession?.sessionId]);

  useEffect(() => {
    if (!activeSession?.sessionId) return;
    window.localStorage.setItem(`${NOTE_STORAGE_PREFIX}${activeSession.sessionId}`, customerNote);
  }, [activeSession?.sessionId, customerNote]);

  useEffect(() => {
    const handleFocus = () => {
      refreshCurrentBuild?.();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshCurrentBuild]);

  async function handleSelectSession(session) {
    setErrorMessage("");
    const status = String(session.status || "").toLowerCase();
    if (["waiting", "waiting_staff", "open"].includes(status)) {
      try {
        setActionLoading("accept");
        const response = await acceptChatSession(session.sessionId, { staffName });
        const accepted = getEnvelopeData(response, null);
        setActiveSession(accepted);
        setSuccessMessage(`Đã nhận phiên tư vấn của ${accepted.customerName}.`);
        await loadQueue();
      } catch (error) {
        setErrorMessage(getErrorMessage(error, "Không thể nhận phiên tư vấn."));
      } finally {
        setActionLoading("");
      }
      return;
    }

    try {
      const response = await getChatSession(session.sessionId);
      setActiveSession(getEnvelopeData(response, session));
    } catch {
      setActiveSession(session);
    }
  }

  async function handleSendMessage(buildData = null) {
    if (!activeSession?.sessionId) return;
    const trimmed = String(message || "").trim();
    if (!trimmed && !buildData) return;

    try {
      setActionLoading("send");
      await sendChatMessage(activeSession.sessionId, {
        sender: "staff",
        text: buildData ? "Nhân viên đã gửi đề xuất cấu hình/sản phẩm." : trimmed,
        buildData: buildData || undefined
      });
      setMessage("");
      const response = await getChatSession(activeSession.sessionId);
      setActiveSession(getEnvelopeData(response, null));
      await loadQueue();
      setSuccessMessage("Đã gửi phản hồi cho khách.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể gửi tin nhắn."));
    } finally {
      setActionLoading("");
    }
  }

  async function handleSendProductSuggestion() {
    const title = String(productTitle || "").trim();
    const url = String(productUrl || "").trim();
    if (!title && !url) {
      setProductSuggestionError("Vui lòng chọn sản phẩm hoặc nhập tên/link trước khi gửi.");
      return;
    }
    setProductSuggestionError("");

    try {
      setActionLoading("link");
      await handleSendMessage({
        productSuggestion: {
          title: title || "Sản phẩm PC Mall đề xuất",
          url
        }
      });
      setProductTitle("");
      setProductUrl("");
    } finally {
      setActionLoading("");
    }
  }

  async function handleCloseSession() {
    if (!activeSession?.sessionId) return;
    if (!window.confirm("Kết thúc phiên tư vấn này?")) return;

    try {
      setActionLoading("close");
      await closeChatSession(activeSession.sessionId);
      setActiveSession(null);
      setSuccessMessage("Đã kết thúc phiên tư vấn.");
      await loadQueue();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể kết thúc phiên."));
    } finally {
      setActionLoading("");
    }
  }

  async function handleShareBuild() {
    const refreshedBuild = await refreshCurrentBuild?.();
    const buildToSend = refreshedBuild?.components ? refreshedBuild : activeBuild;
    const components = buildToSend?.components || {};
    if (Object.keys(components).length === 0) {
      setErrorMessage("Chưa có linh kiện trong cấu hình tư vấn. Mở PC Builder để chọn.");
      return;
    }
    handleSendMessage(buildToSend);
  }

  return (
    <div className="sales-chat-page">
      <style>{`
        .sales-chat-page {
          width: min(1440px, calc(100% - 32px));
          margin: 0 auto;
          padding: 28px 0 40px;
          color: #0f172a;
        }
        .sales-chat-hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding: 28px 30px;
          margin-bottom: 24px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 28px;
          background:
            radial-gradient(circle at top right, rgba(59, 130, 246, 0.22), transparent 32%),
            linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);
          box-shadow: 0 28px 60px rgba(15, 23, 42, 0.18);
          color: #f8fafc;
        }
        .sales-chat-hero h1 {
          margin: 0;
          font-size: clamp(1.85rem, 3vw, 2.55rem);
          line-height: 1.08;
        }
        .sales-chat-hero p {
          margin: 12px 0 0;
          max-width: 720px;
          color: rgba(226, 232, 240, 0.92);
          line-height: 1.65;
        }
        .sales-chat-eyebrow {
          margin: 0 0 10px;
          color: rgba(191, 219, 254, 0.95);
          font-size: 0.8rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .sales-chat-hero-actions {
          display: grid;
          gap: 12px;
          min-width: 250px;
          justify-items: end;
        }
        .sales-chat-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          border-radius: 999px;
          background: rgba(254, 240, 138, 0.16);
          border: 1px solid rgba(253, 224, 71, 0.35);
          color: #fde68a;
          font-weight: 700;
        }
        .sales-chat-shell {
          display: grid;
          grid-template-columns: 320px minmax(0, 1fr) 320px;
          gap: 24px;
          align-items: start;
        }
        .sales-chat-card {
          background: #fff;
          border: 1px solid #dbe4f0;
          border-radius: 24px;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.07);
        }
        .sales-chat-queue,
        .sales-chat-tools {
          padding: 22px;
        }
        .sales-chat-panel-title {
          margin: 0 0 4px;
          font-size: 1.25rem;
          font-weight: 800;
        }
        .sales-chat-panel-copy {
          margin: 0;
          color: #64748b;
          line-height: 1.6;
        }
        .sales-chat-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin: 18px 0 18px;
        }
        .sales-chat-tab,
        .sales-chat-btn,
        .sales-chat-queue-item,
        .sales-chat-chip {
          transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, background-color 180ms ease, color 180ms ease;
        }
        .sales-chat-tab {
          border: 1px solid #dbe4f0;
          border-radius: 999px;
          background: #f8fafc;
          color: #475569;
          font-weight: 700;
          padding: 10px 14px;
          cursor: pointer;
        }
        .sales-chat-tab:hover,
        .sales-chat-btn:hover,
        .sales-chat-chip:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 20px rgba(59, 130, 246, 0.12);
        }
        .sales-chat-tab:active,
        .sales-chat-btn:active,
        .sales-chat-chip:active,
        .sales-chat-queue-item:active {
          transform: scale(0.98);
        }
        .sales-chat-tab--active {
          border-color: #bfdbfe;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          color: #1d4ed8;
        }
        .sales-chat-queue-list {
          display: grid;
          gap: 12px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }
        .sales-chat-queue-item {
          padding: 16px;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          background: #fff;
          cursor: pointer;
          text-align: left;
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.03);
        }
        .sales-chat-queue-item:hover {
          transform: translateY(-1px);
          box-shadow: 0 18px 28px rgba(15, 23, 42, 0.08);
          border-color: #bfdbfe;
        }
        .sales-chat-queue-item--active {
          border-color: #93c5fd;
          background: linear-gradient(135deg, #eff6ff 0%, #f8fbff 100%);
          box-shadow: 0 22px 36px rgba(59, 130, 246, 0.14);
        }
        .sales-chat-queue-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }
        .sales-chat-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 0.78rem;
          font-weight: 700;
        }
        .sales-chat-status--warning {
          background: #fff7ed;
          color: #c2410c;
        }
        .sales-chat-status--info {
          background: #eff6ff;
          color: #1d4ed8;
        }
        .sales-chat-status--success {
          background: #ecfdf3;
          color: #15803d;
        }
        .sales-chat-status--neutral {
          background: #f1f5f9;
          color: #475569;
        }
        .sales-chat-unread {
          min-width: 22px;
          height: 22px;
          padding: 0 7px;
          border-radius: 999px;
          background: #ef4444;
          color: #fff;
          font-size: 0.75rem;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .sales-chat-queue-name {
          margin: 0;
          font-size: 1rem;
          font-weight: 800;
          color: #0f172a;
        }
        .sales-chat-queue-preview {
          margin: 8px 0 10px;
          color: #475569;
          line-height: 1.55;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .sales-chat-queue-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          color: #64748b;
          font-size: 0.9rem;
        }
        .sales-chat-main {
          min-width: 0;
          display: flex;
          flex-direction: column;
          min-height: 860px;
          overflow: hidden;
        }
        .sales-chat-main-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 22px 24px 18px;
          border-bottom: 1px solid #e2e8f0;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
        }
        .sales-chat-customer {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }
        .sales-chat-avatar {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%);
          color: #fff;
          display: grid;
          place-items: center;
          font-weight: 800;
          font-size: 1.1rem;
          box-shadow: 0 18px 26px rgba(29, 78, 216, 0.28);
          flex-shrink: 0;
        }
        .sales-chat-main-head h3 {
          margin: 0;
          font-size: 1.35rem;
          font-weight: 800;
        }
        .sales-chat-main-head p {
          margin: 6px 0 0;
          color: #64748b;
          line-height: 1.5;
        }
        .sales-chat-online {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #16a34a;
          font-weight: 700;
          font-size: 0.9rem;
        }
        .sales-chat-online::before {
          content: "";
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.16);
        }
        .sales-chat-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .sales-chat-btn {
          border: 1px solid transparent;
          border-radius: 16px;
          padding: 13px 18px;
          font-weight: 800;
          font-size: 0.98rem;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          text-decoration: none;
          white-space: nowrap;
        }
        .sales-chat-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        .sales-chat-btn--primary {
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
          color: #fff;
          box-shadow: 0 14px 28px rgba(37, 99, 235, 0.22);
        }
        .sales-chat-btn--success {
          background: linear-gradient(135deg, #059669 0%, #10b981 100%);
          color: #fff;
          box-shadow: 0 14px 28px rgba(5, 150, 105, 0.2);
        }
        .sales-chat-btn--secondary {
          background: #fff;
          border-color: #dbe4f0;
          color: #0f172a;
        }
        .sales-chat-btn--danger {
          background: #fff5f5;
          border-color: #fecaca;
          color: #dc2626;
        }
        .sales-chat-alert {
          margin-bottom: 16px;
          padding: 14px 18px;
          border-radius: 18px;
          font-weight: 700;
          animation: salesChatFadeUp 180ms ease;
        }
        .sales-chat-alert--error {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #be123c;
        }
        .sales-chat-alert--success {
          background: #ecfdf3;
          border: 1px solid #bbf7d0;
          color: #15803d;
        }
        .sales-chat-quick {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          padding: 18px 24px 0;
        }
        .sales-chat-chip {
          padding: 11px 14px;
          border-radius: 999px;
          border: 1px solid #dbe4f0;
          background: #f8fafc;
          color: #334155;
          font-weight: 700;
          cursor: pointer;
        }
        .sales-chat-messages {
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding: 20px 24px;
          display: grid;
          gap: 14px;
          background:
            radial-gradient(circle at top, rgba(219, 234, 254, 0.35), transparent 32%),
            linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
        }
        .sales-chat-system {
          justify-self: center;
          max-width: 78%;
          border-radius: 16px;
          padding: 12px 16px;
          background: #eff6ff;
          color: #334155;
          font-weight: 600;
          white-space: pre-wrap;
          animation: salesChatFadeUp 180ms ease;
        }
        .sales-chat-briefing-card {
          justify-self: center;
          max-width: 95%;
          width: 100%;
          border-radius: 18px;
          background: #ffffff;
          border: 1.5px solid #93c5fd;
          box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.12), 0 8px 10px -6px rgba(59, 130, 246, 0.08);
          overflow: hidden;
          margin-bottom: 8px;
          animation: salesChatFadeUp 180ms ease;
        }
        .sales-chat-briefing-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 18px;
          background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
          color: #ffffff;
        }
        .sales-chat-briefing-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.22);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .sales-chat-briefing-title {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.3px;
        }
        .sales-chat-briefing-content {
          padding: 16px 20px;
          font-size: 13.5px;
          line-height: 1.65;
          color: #1e293b;
          white-space: pre-wrap;
          font-family: inherit;
          background: #f8fafc;
        }
        .sales-chat-row {
          display: flex;
          animation: salesChatFadeUp 180ms ease;
        }
        .sales-chat-row--staff {
          justify-content: flex-end;
        }
        .sales-chat-bubble {
          max-width: min(72%, 620px);
          border-radius: 22px;
          padding: 14px 16px 12px;
          background: #fff;
          border: 1px solid #dbe4f0;
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.05);
        }
        .sales-chat-row--staff .sales-chat-bubble {
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
          border-color: transparent;
          color: #fff;
          box-shadow: 0 18px 34px rgba(37, 99, 235, 0.18);
        }
        .sales-chat-bubble p {
          margin: 0;
          line-height: 1.65;
          white-space: pre-wrap;
        }
        .sales-chat-bubble time {
          display: inline-flex;
          margin-top: 10px;
          font-size: 0.8rem;
          color: #94a3b8;
        }
        .sales-chat-row--staff .sales-chat-bubble time {
          color: rgba(219, 234, 254, 0.88);
        }
        .sales-chat-build-card {
          margin-top: 12px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.18);
        }
        .sales-chat-row:not(.sales-chat-row--staff) .sales-chat-build-card {
          background: #f8fafc;
          border-color: #dbe4f0;
        }
        .sales-chat-build-card strong {
          display: block;
          margin-bottom: 10px;
        }
        .sales-chat-build-line {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 6px;
        }
        .sales-chat-build-total {
          margin-top: 10px;
          font-weight: 800;
        }
        .sales-chat-build-card a {
          color: inherit;
          font-weight: 800;
        }
        .sales-chat-compose {
          position: sticky;
          bottom: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
          padding: 18px 24px 24px;
          border-top: 1px solid #e2e8f0;
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(12px);
        }
        .sales-chat-compose input,
        .sales-chat-input,
        .sales-chat-textarea {
          width: 100%;
          border: 1px solid #dbe4f0;
          border-radius: 16px;
          padding: 14px 16px;
          font: inherit;
          color: #0f172a;
          background: #fff;
          outline: none;
          transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
        }
        .sales-chat-textarea {
          min-height: 112px;
          resize: vertical;
        }
        .sales-chat-compose input:focus,
        .sales-chat-input:focus,
        .sales-chat-textarea:focus {
          border-color: #60a5fa;
          box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.16);
        }
        .sales-chat-tools {
          display: grid;
          gap: 18px;
        }
        .sales-chat-tool-card {
          padding: 20px;
          border: 1px solid #dbe4f0;
          border-radius: 22px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          box-shadow: 0 12px 26px rgba(15, 23, 42, 0.04);
        }
        .sales-chat-tool-card:hover {
          box-shadow: 0 18px 34px rgba(15, 23, 42, 0.08);
        }
        .sales-chat-tool-card h3,
        .sales-chat-tool-card h4 {
          margin: 0 0 6px;
        }
        .sales-chat-tool-card p,
        .sales-chat-tool-card small {
          color: #64748b;
          line-height: 1.6;
        }
        .sales-chat-build-summary {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }
        .sales-chat-build-total-value {
          font-size: 2rem;
          font-weight: 900;
          color: #1d4ed8;
        }
        .sales-chat-tool-actions {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }
        .sales-chat-inline-error {
          margin: 0;
          padding: 10px 12px;
          border-radius: 14px;
          background: #fff1f2;
          color: #be123c;
          border: 1px solid #fecdd3;
          font-weight: 700;
          line-height: 1.45;
        }
        .sales-chat-mini-list {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }
        .sales-chat-mini-item {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 11px 12px;
          border-radius: 14px;
          background: #f8fafc;
          color: #334155;
          font-weight: 700;
        }
        .sales-chat-empty {
          display: grid;
          place-items: center;
          text-align: center;
          min-height: 720px;
          padding: 48px 24px;
          color: #475569;
        }
        .sales-chat-empty-illustration {
          width: 84px;
          height: 84px;
          margin-bottom: 18px;
          border-radius: 28px;
          background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%);
          color: #1d4ed8;
          display: grid;
          place-items: center;
          font-size: 2rem;
          box-shadow: inset 0 0 0 1px #bfdbfe;
        }
        .sales-chat-empty h3 {
          margin: 0 0 10px;
          font-size: 1.35rem;
        }
        .sales-chat-empty p {
          margin: 0;
          max-width: 420px;
          line-height: 1.7;
        }
        .sales-chat-spinner {
          width: 15px;
          height: 15px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.35);
          border-top-color: currentColor;
          display: inline-block;
          animation: salesChatSpin 0.8s linear infinite;
        }
        .sales-chat-btn--secondary .sales-chat-spinner,
        .sales-chat-btn--danger .sales-chat-spinner {
          border-color: rgba(15, 23, 42, 0.18);
        }
        @keyframes salesChatSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes salesChatFadeUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (max-width: 1220px) {
          .sales-chat-shell {
            grid-template-columns: 300px minmax(0, 1fr);
          }
          .sales-chat-tools {
            grid-column: 1 / -1;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 920px) {
          .sales-chat-page {
            width: min(100%, calc(100% - 24px));
          }
          .sales-chat-hero {
            flex-direction: column;
          }
          .sales-chat-hero-actions {
            width: 100%;
            justify-items: start;
          }
          .sales-chat-shell {
            grid-template-columns: 1fr;
          }
          .sales-chat-tools {
            grid-template-columns: 1fr;
          }
          .sales-chat-main {
            min-height: 700px;
          }
        }
      `}</style>

      <section className="sales-chat-hero">
        <div>
          <p className="sales-chat-eyebrow">Sales Consultation Center</p>
          <h1>Trung tâm tư vấn bán hàng PC Mall</h1>
          <p>
            Nhận yêu cầu từ AI Chat, tiếp tục tư vấn với khách hàng, gửi cấu hình PC, sản phẩm đề xuất và hỗ trợ
            chốt đơn trong một workspace tập trung.
          </p>
        </div>
        <div className="sales-chat-hero-actions">
          <span className="sales-chat-badge">{waitingCount} yêu cầu mới</span>
          <Link to="/pc-builder" target="_blank" rel="noreferrer" className="sales-chat-btn sales-chat-btn--secondary">
            Mở PC Builder
          </Link>
        </div>
      </section>

      {errorMessage ? <div className="sales-chat-alert sales-chat-alert--error">{errorMessage}</div> : null}
      {successMessage ? <div className="sales-chat-alert sales-chat-alert--success">{successMessage}</div> : null}

      <div className="sales-chat-shell">
        <aside className="sales-chat-card sales-chat-queue">
          <h2 className="sales-chat-panel-title">Hàng đợi tư vấn</h2>
          <p className="sales-chat-panel-copy">Chọn phiên cần tiếp nhận hoặc tiếp tục hỗ trợ khách hàng đang trao đổi.</p>

          <div className="sales-chat-tabs">
            {STATUS_FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={statusFilter === item.value ? "sales-chat-tab sales-chat-tab--active" : "sales-chat-tab"}
                onClick={() => setStatusFilter(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="sales-chat-queue-list">
            {loading ? (
              <div className="sales-chat-empty" style={{ minHeight: 240 }}>
                <div className="sales-chat-empty-illustration">⏳</div>
                <h3>Đang tải phiên tư vấn</h3>
                <p>Hệ thống đang đồng bộ hàng đợi tư vấn bán hàng.</p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="sales-chat-empty" style={{ minHeight: 240 }}>
                <div className="sales-chat-empty-illustration">🧾</div>
                <h3>Chưa có yêu cầu phù hợp</h3>
                <p>Hãy giữ tab mở, khách từ AI Chat sẽ xuất hiện tại đây để nhân viên tiếp nhận.</p>
              </div>
            ) : (
              filteredSessions.map((session) => {
                const isActive = activeSession?.sessionId === session.sessionId;
                const statusMeta = getStatusMeta(session.status);
                const lastMessage = getLastMessageText(session);
                const unread = ["waiting", "waiting_staff", "open"].includes(String(session.status || "").toLowerCase()) ? 1 : 0;

                return (
                  <button
                    key={session.sessionId}
                    type="button"
                    className={`sales-chat-queue-item${isActive ? " sales-chat-queue-item--active" : ""}`}
                    onClick={() => handleSelectSession(session)}
                    disabled={Boolean(actionLoading)}
                  >
                    <div className="sales-chat-queue-top">
                      <span className={`sales-chat-status sales-chat-status--${statusMeta.tone}`}>{statusMeta.label}</span>
                      {unread ? <span className="sales-chat-unread">{unread}</span> : null}
                    </div>
                    <p className="sales-chat-queue-name">{session.customerName}</p>
                    <p className="sales-chat-queue-preview">{lastMessage}</p>
                    <div className="sales-chat-queue-meta">
                      <span>{getConversationTypeLabel(session.conversationType)}</span>
                      <span>{formatDateTime(session.updatedAt || session.createdAt)}</span>
                      {session.staffName ? <span>NV: {session.staffName}</span> : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main className="sales-chat-card sales-chat-main">
          {!activeSession ? (
            <div className="sales-chat-empty">
              <div className="sales-chat-empty-illustration">💬</div>
              <h3>Chọn một phiên tư vấn để bắt đầu</h3>
              <p>
                Khách hàng sẽ vào đây sau khi bấm “Gặp nhân viên bán hàng” từ trang AI Tư Vấn. Bạn có thể tiếp nhận và
                phản hồi ngay trong cùng màn hình.
              </p>
            </div>
          ) : (
            <>
              <div className="sales-chat-main-head">
                <div className="sales-chat-customer">
                  <div className="sales-chat-avatar">
                    {String(activeSession.customerName || "?").trim().charAt(0).toUpperCase() || "K"}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3>{activeSession.customerName}</h3>
                    <p>
                      Phiên {activeSession.sessionId.slice(0, 8)} · {getConversationTypeLabel(activeSession.conversationType)} ·{" "}
                      {getStatusMeta(activeSession.status).label}
                    </p>
                    <span className="sales-chat-online">Đang kết nối</span>
                  </div>
                </div>
                <div className="sales-chat-actions">
                  <button
                    type="button"
                    className="sales-chat-btn sales-chat-btn--primary"
                    onClick={handleShareBuild}
                    disabled={Boolean(actionLoading)}
                  >
                    {actionLoading === "send" ? <Spinner /> : null}
                    Gửi cấu hình PC
                  </button>
                  <button
                    type="button"
                    className="sales-chat-btn sales-chat-btn--danger"
                    onClick={handleCloseSession}
                    disabled={Boolean(actionLoading)}
                  >
                    {actionLoading === "close" ? <Spinner /> : null}
                    Kết thúc phiên
                  </button>
                </div>
              </div>

              <div className="sales-chat-quick">
                {QUICK_REPLIES.map((text) => (
                  <button key={text} type="button" className="sales-chat-chip" onClick={() => setMessage(text)}>
                    {text}
                  </button>
                ))}
              </div>

              <div ref={messagesContainerRef} className="sales-chat-messages">
                {(activeSession.messages || []).map((m) => {
                  if (m.sender === "system") {
                    const isBriefing = m.buildData?.isHandoffSummary || String(m.text || "").includes("TÓM TẮT NGỮ CẢNH TƯ VẤN (AI ➔ NHÂN VIÊN BÁN HÀNG)");
                    if (isBriefing) {
                      return (
                        <div key={m.id} className="sales-chat-briefing-card">
                          <div className="sales-chat-briefing-header">
                            <span className="sales-chat-briefing-badge">🤖 AI ➔ HUMAN HANDOFF</span>
                            <span className="sales-chat-briefing-title">HỒ SƠ TÓM TẮT NGỮ CẢNH TƯ VẤN TỪ AI CHATBOT</span>
                          </div>
                          <div className="sales-chat-briefing-content">
                            {m.text}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={m.id} className="sales-chat-system">
                        {m.text}
                      </div>
                    );
                  }

                  const isStaff = m.sender === "staff";
                  return (
                    <div key={m.id} className={`sales-chat-row${isStaff ? " sales-chat-row--staff" : ""}`}>
                      <div className="sales-chat-bubble">
                        <p>{m.text}</p>
                        {m.buildData?.components ? (
                          <div className="sales-chat-build-card">
                            <strong>Đề xuất cấu hình</strong>
                            {Object.entries(m.buildData.components).map(([type, item]) => (
                              <div key={type} className="sales-chat-build-line">
                                <span>{type.toUpperCase()}</span>
                                <span>{Number(item?.variant?.price || item?.price || 0).toLocaleString("vi-VN")} đ</span>
                              </div>
                            ))}
                            <div className="sales-chat-build-total">
                              Tổng: {Number(m.buildData.totalPrice || 0).toLocaleString("vi-VN")} đ
                            </div>
                          </div>
                        ) : null}
                        {m.buildData?.productSuggestion ? (
                          <div className="sales-chat-build-card">
                            <strong>Gợi ý sản phẩm</strong>
                            <p>{m.buildData.productSuggestion.title}</p>
                            {m.buildData.productSuggestion.url ? (
                              <a href={m.buildData.productSuggestion.url} target="_blank" rel="noreferrer">
                                Mở link sản phẩm
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                        <time>{formatTime(m.timestamp)}</time>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="sales-chat-compose">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  placeholder="Nhập tin nhắn tư vấn cho khách hàng..."
                  disabled={activeSession.status === "resolved" || Boolean(actionLoading)}
                />
                <button
                  type="button"
                  className="sales-chat-btn sales-chat-btn--success"
                  onClick={() => handleSendMessage()}
                  disabled={!message.trim() || Boolean(actionLoading)}
                >
                  {actionLoading === "send" ? <Spinner /> : null}
                  Gửi
                </button>
              </div>
            </>
          )}
        </main>

        <aside className="sales-chat-tools">
          <section className="sales-chat-tool-card">
            <h3>Cấu hình PC đang soạn</h3>
            <p>Tổng hợp nhanh cấu hình đang được nhân viên chuẩn bị để gửi cho khách.</p>
            <div className="sales-chat-build-summary">
              <span className="sales-chat-build-total-value">{selectedSummary.total.toLocaleString("vi-VN")} đ</span>
              <small>{selectedSummary.count} linh kiện đã chọn</small>
            </div>
            <div className="sales-chat-tool-actions">
              <Link to="/pc-builder" target="_blank" rel="noreferrer" className="sales-chat-btn sales-chat-btn--secondary">
                Mở PC Builder
              </Link>
              <button type="button" className="sales-chat-btn sales-chat-btn--secondary" onClick={clearAll}>
                Xóa nháp
              </button>
            </div>
          </section>

          <section className="sales-chat-tool-card">
            <h3>Gửi sản phẩm đề xuất</h3>
            <p>Nhập tên sản phẩm hoặc link cần gửi cho khách ngay trong cuộc trò chuyện.</p>
            <div className="sales-chat-tool-actions">
              <input
                className="sales-chat-input"
                value={productTitle}
                onChange={(event) => setProductTitle(event.target.value)}
                placeholder="Tên sản phẩm hoặc cấu hình"
              />
              <input
                className="sales-chat-input"
                value={productUrl}
                onChange={(event) => setProductUrl(event.target.value)}
                placeholder="Link sản phẩm PC Mall"
              />
              {productSuggestionError ? <p className="sales-chat-inline-error">{productSuggestionError}</p> : null}
              <button
                type="button"
                className="sales-chat-btn sales-chat-btn--primary"
                onClick={handleSendProductSuggestion}
                disabled={!activeSession || Boolean(actionLoading)}
              >
                {actionLoading === "link" ? <Spinner /> : null}
                Gửi link sản phẩm
              </button>
            </div>
          </section>

          <section className="sales-chat-tool-card">
            <h3>Quick replies</h3>
            <p>Dùng các mẫu phản hồi ngắn để trả lời nhanh trong ca trực.</p>
            <div className="sales-chat-mini-list">
              {QUICK_REPLIES.slice(0, 3).map((reply) => (
                <button key={reply} type="button" className="sales-chat-chip" onClick={() => setMessage(reply)}>
                  {reply}
                </button>
              ))}
            </div>
          </section>

          <section className="sales-chat-tool-card">
            <h3>Ghi chú khách hàng</h3>
            <p>Ghi chú cục bộ để nhớ sở thích, khung giờ liên hệ và các lưu ý trong phiên này.</p>
            <textarea
              className="sales-chat-textarea"
              value={customerNote}
              onChange={(event) => setCustomerNote(event.target.value)}
              placeholder="Ví dụ: Khách ưu tiên gaming, ngân sách 20 triệu, thích case trắng..."
            />
          </section>

          <section className="sales-chat-tool-card">
            <h4>Điều hướng nhanh</h4>
            <p>Mở màn xử lý đơn ngay khi khách chốt để tiếp tục thao tác không gián đoạn.</p>
            <Link to="/staff/orders" className="sales-chat-btn sales-chat-btn--success">
              Xử lý đơn hàng →
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
