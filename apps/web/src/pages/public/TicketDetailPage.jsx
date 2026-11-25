import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import axios from "axios";

import { addTicketMessage, getTicketDetail } from "../../services/ticket.service";
import { useAuth } from "../../hooks/useAuth";
import { useSocket } from "../../hooks/useSocket";
import { routeConfig } from "../../routes/routeConfig";
import {
  extractAttachmentMentions,
  getAttachmentUrl,
  isImageAttachment,
  isVideoAttachment,
  stripAttachmentMarker,
  downloadAttachment
} from "../../utils/ticketTech";

const STATUS_META = {
  OPEN: { label: "Đang mở", color: "#2563eb", bg: "#eff6ff" },
  IN_PROGRESS: { label: "Đang xử lý", color: "#b45309", bg: "#fffbeb" },
  RESOLVED: { label: "Đã giải quyết", color: "#047857", bg: "#ecfdf5" },
  CLOSED: { label: "Đã đóng", color: "#64748b", bg: "#f8fafc" }
};

const PRIORITY_META = {
  LOW: { label: "Thấp", color: "#64748b", bg: "#f8fafc" },
  MEDIUM: { label: "Trung bình", color: "#2563eb", bg: "#eff6ff" },
  HIGH: { label: "Cao", color: "#b45309", bg: "#fffbeb" },
  URGENT: { label: "Khẩn cấp", color: "#dc2626", bg: "#fef2f2" }
};

const ALLOWED_ATTACHMENTS = ["image/jpeg", "image/png", "image/gif", "video/mp4", "video/webm", "video/quicktime", "application/pdf"];
const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;

function getErrorMessage(error, fallbackMessage) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallbackMessage;
  }

  return error.message || fallbackMessage;
}

function getStatusMeta(status) {
  return STATUS_META[String(status || "").toUpperCase()] || { label: status || "Chưa cập nhật", color: "#64748b", bg: "#f8fafc" };
}

function getPriorityMeta(priority) {
  return PRIORITY_META[String(priority || "").toUpperCase()] || { label: priority || "Chưa rõ", color: "#64748b", bg: "#f8fafc" };
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("vi-VN") : "Chưa cập nhật";
}

function formatFileSize(size) {
  if (!size) return "0 KB";
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.ceil(size / 1024)} KB`;
}

function validateAttachments(files) {
  const accepted = [];
  const errors = [];

  files.forEach((file) => {
    if (!ALLOWED_ATTACHMENTS.includes(file.type)) {
      errors.push(`${file.name}: chỉ hỗ trợ JPG, PNG, GIF, MP4, WEBM, MOV hoặc PDF.`);
      return;
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      errors.push(`${file.name}: dung lượng tối đa 20MB.`);
      return;
    }
    accepted.push(file);
  });

  return { accepted, errors };
}

function isStaffSender(message) {
  const role = String(message.sender?.role || message.sender?.Role?.name || "").toUpperCase();
  return ["ADMIN", "TECH_STAFF", "TECHNICIAN", "SALES_STAFF", "SALES"].includes(role);
}

function canManageTicketReply(role) {
  return ["ADMIN", "TECH_STAFF", "TECHNICIAN", "SALES_STAFF", "SALES"].includes(String(role || "").toUpperCase());
}

function TicketAttachmentCard({ attachment }) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const attachmentUrl = getAttachmentUrl(attachment);
  const canPreviewImage = isImageAttachment(attachment) && attachmentUrl && !previewFailed;
  const canPreviewVideo = isVideoAttachment(attachment) && attachmentUrl && !previewFailed;

  return (
    <article className="ticket-attachment-card" aria-disabled={!attachmentUrl}>
      <a
        className="ticket-attachment-card__preview"
        href={attachmentUrl || undefined}
        target={attachmentUrl ? "_blank" : undefined}
        rel={attachmentUrl ? "noreferrer" : undefined}
        onClick={(event) => {
          if (!attachmentUrl) event.preventDefault();
        }}
      >
        {canPreviewImage ? (
          <img src={attachmentUrl} alt={attachment.name} loading="lazy" onError={() => setPreviewFailed(true)} />
        ) : canPreviewVideo ? (
          <video src={attachmentUrl} controls onError={() => setPreviewFailed(true)} />
        ) : (
          <span>{attachmentUrl ? "FILE" : "INFO"}</span>
        )}
      </a>
      <div className="ticket-attachment-card__body">
        <strong>{attachment.name}</strong>
        <small>{attachment.sizeLabel || (attachmentUrl ? "Tệp đính kèm" : "Chưa có file để xem")}</small>
        <div className="ticket-attachment-card__actions">
          {attachmentUrl ? (
            <>
              <a href={attachmentUrl} target="_blank" rel="noreferrer">Xem tệp</a>
              <button type="button" onClick={() => downloadAttachment(attachment)}>Tải xuống</button>
            </>
          ) : (
            <span>Chỉ có thông tin tệp</span>
          )}
        </div>
      </div>
    </article>
  );
}

function TicketAttachmentList({ attachments = [] }) {
  if (!attachments.length) return null;

  return (
    <div className="ticket-attachment-list">
      {attachments.map((attachment) => (
        <TicketAttachmentCard key={attachment.id} attachment={attachment} />
      ))}
    </div>
  );
}

export function TicketDetailPage() {
  const { ticketId } = useParams();
  const { authState, isAuthenticated } = useAuth();
  const { joinRoom, leaveRoom, on } = useSocket();
  const [ticket, setTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [replyVisibility, setReplyVisibility] = useState("PUBLIC");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const messageCountRef = useRef(0);

  const loadTicket = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setSyncing(true);
      } else {
        setLoading(true);
      }
      if (!silent) setErrorMessage("");

      const response = await getTicketDetail(ticketId);
      const nextTicket = response?.data || null;
      const nextMessages = nextTicket?.messages || [];
      const previousMessageCount = messageCountRef.current;
      const latestMessage = nextMessages[nextMessages.length - 1];
      const latestFromCurrentUser = Number(latestMessage?.sender?.id) === Number(authState?.user?.id);

      if (silent && nextMessages.length > previousMessageCount && !latestFromCurrentUser) {
        setSuccessMessage("Có phản hồi mới từ nhân viên hỗ trợ. Hội thoại đã được cập nhật.");
      }

      messageCountRef.current = nextMessages.length;
      setTicket(nextTicket);
      setLastSyncedAt(new Date());
    } catch (error) {
      if (!silent) {
        setErrorMessage(getErrorMessage(error, "Không thể tải chi tiết ticket"));
      }
    } finally {
      if (silent) {
        setSyncing(false);
      } else {
        setLoading(false);
      }
    }
  }, [authState?.user?.id, ticketId]);

  useEffect(() => {
    if (isAuthenticated) {
      loadTicket();
    }
  }, [isAuthenticated, loadTicket]);

  useEffect(() => {
    if (!isAuthenticated || !ticketId) return undefined;

    const syncLatest = () => {
      if (document.visibilityState === "visible" && !submitting) {
        loadTicket({ silent: true });
      }
    };

    const timer = window.setInterval(syncLatest, 5000);
    window.addEventListener("focus", syncLatest);
    document.addEventListener("visibilitychange", syncLatest);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", syncLatest);
      document.removeEventListener("visibilitychange", syncLatest);
    };
  }, [isAuthenticated, loadTicket, submitting, ticketId]);

  useEffect(() => {
    if (!isAuthenticated || !ticketId) return undefined;

    joinRoom("join_ticket", ticketId);

    const unsubNewMsg = on("ticket:new_message", (payload) => {
      if (String(payload?.ticketId) !== String(ticketId)) return;
      loadTicket({ silent: true });
    });

    const unsubStatusChanged = on("ticket:status_changed", (updatedTicket) => {
      if (String(updatedTicket?.id) === String(ticketId)) {
        loadTicket({ silent: true });
      }
    });

    return () => {
      if (typeof unsubNewMsg === "function") unsubNewMsg();
      if (typeof unsubStatusChanged === "function") unsubStatusChanged();
      leaveRoom("leave_ticket", ticketId);
    };
  }, [isAuthenticated, joinRoom, leaveRoom, loadTicket, on, ticketId]);

  if (!isAuthenticated) {
    return <Navigate to={routeConfig.public.login} replace />;
  }

  function handleAttachmentChange(event) {
    const files = Array.from(event.target.files || []);
    const { accepted, errors } = validateAttachments(files);
    setAttachments(accepted);
    setErrorMessage(errors.join(" "));
  }

  async function handleReply() {
    if (!replyMessage.trim() && attachments.length === 0) {
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");
      const message = replyMessage.trim() || (isStaffUser && replyVisibility === "INTERNAL" ? "Ghi chú nội bộ." : "Khách hàng đã gửi tệp đính kèm.");
      let payload = {
        message,
        visibility: isStaffUser && replyVisibility === "INTERNAL" ? "INTERNAL" : "PUBLIC"
      };

      if (attachments.length) {
        const formData = new FormData();
        formData.append("message", message);
        formData.append("visibility", payload.visibility);
        attachments.forEach((file) => formData.append("attachments", file));
        payload = formData;
      }

      const response = await addTicketMessage(ticketId, payload);
      const nextTicket = response?.data || null;
      messageCountRef.current = nextTicket?.messages?.length || 0;
      setTicket(nextTicket);
      setLastSyncedAt(new Date());
      setReplyMessage("");
      setAttachments([]);
      setReplyVisibility("PUBLIC");
      setSuccessMessage("Đã gửi phản hồi vào ticket");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể gửi phản hồi"));
    } finally {
      setSubmitting(false);
    }
  }

  const statusMeta = getStatusMeta(ticket?.status);
  const priorityMeta = getPriorityMeta(ticket?.priority);
  const isClosed = ["CLOSED"].includes(String(ticket?.status || "").toUpperCase());
  const ticketDescription = stripAttachmentMarker(ticket?.description);
  const ticketAttachments = extractAttachmentMentions(ticket?.description);
  const isStaffUser = canManageTicketReply(authState?.user?.role);
  const visibleMessages = ticket?.messages || [];

  return (
    <div className="ticket-detail">
      <style>{ticketDetailStyles}</style>

      <Link to={routeConfig.public.tickets} className="ticket-back">← Quay lại Support Center</Link>

      {errorMessage ? <div className="ticket-alert ticket-alert--danger">{errorMessage}</div> : null}
      {successMessage ? <div className="ticket-alert ticket-alert--success">{successMessage}</div> : null}

      {loading ? (
        <section className="ticket-loading"><span /> <strong>Đang tải ticket...</strong></section>
      ) : !ticket ? (
        <section className="ticket-empty">
          <h2>Không tìm thấy ticket</h2>
          <p>Ticket có thể đã bị xóa hoặc bạn không có quyền xem nội dung này.</p>
          <Link to={routeConfig.public.tickets}>Về danh sách ticket</Link>
        </section>
      ) : (
        <>
          <section className="ticket-detail__hero">
            <div className="ticket-hero__content">
              <div className="ticket-hero__eyebrow">Support Center · Ticket #{ticket.id}</div>
              <h1>{ticket.title}</h1>
              <p>{ticketDescription || "Thông tin ticket, trao đổi và phản hồi được sắp xếp theo timeline."}</p>
              <TicketAttachmentList attachments={ticketAttachments} />
            </div>
            <aside className="ticket-hero__summary">
              <div className="ticket-chip" style={{ color: statusMeta.color, background: statusMeta.bg }}>{statusMeta.label}</div>
              <div className="ticket-chip" style={{ color: priorityMeta.color, background: priorityMeta.bg }}>Ưu tiên {priorityMeta.label}</div>
              <div className="ticket-hero__meta">
                <span>Người gửi</span>
                <strong>{ticket.reporter?.fullName || ticket.reporter?.email || authState?.user?.fullName || authState?.user?.email}</strong>
              </div>
              <div className="ticket-hero__meta">
                <span>Kỹ thuật phụ trách</span>
                <strong>{ticket.assignee?.fullName || "Chưa phân công"}</strong>
              </div>
              <div className="ticket-hero__meta">
                <span>Cập nhật gần nhất</span>
                <strong>{formatDate(ticket.updatedAt || ticket.createdAt)}</strong>
              </div>
            </aside>
          </section>

          <section className="ticket-detail__grid">
            <div className="ticket-conversation">
              <div className="ticket-section-head">
                <div>
                  <span>Conversation Timeline</span>
                  <h2>Lịch sử trao đổi</h2>
                </div>
                <div className={`ticket-live-sync${syncing ? " is-syncing" : ""}`}>
                  <i />
                  {syncing ? "Đang cập nhật..." : lastSyncedAt ? `Tự cập nhật ${lastSyncedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "Tự cập nhật"}
                </div>
              </div>
              <div className="conversation-timeline">
                {visibleMessages.length === 0 ? (
                  <div className="conversation-empty">Chưa có tin nhắn trao đổi. Bạn có thể bổ sung thông tin ở khung bên dưới.</div>
                ) : (
                  visibleMessages.map((message) => {
                    const isMine = Number(message.sender?.id) === Number(authState?.user?.id);
                    const isStaff = isStaffSender(message);
                    const isInternal = String(message.visibility || "PUBLIC").toUpperCase() === "INTERNAL";
                    return (
                      <article key={message.id} className={`conversation-message ${isMine ? "is-customer" : ""} ${isStaff ? "is-staff" : ""}`}>
                        <div className="conversation-avatar">{isStaff ? "PC" : "KH"}</div>
                        <div className="conversation-bubble">
                          <div className="conversation-bubble__meta">
                            <strong>{message.sender?.fullName || message.sender?.email || "Hệ thống"}</strong>
                            <span>{isStaff ? "Phản hồi hỗ trợ" : "Khách hàng"}</span>
                          </div>
                          {isInternal ? <div className="conversation-badge conversation-badge--internal">Ghi chú nội bộ</div> : null}
                          {stripAttachmentMarker(message.message) ? <p>{stripAttachmentMarker(message.message)}</p> : null}
                          <TicketAttachmentList attachments={extractAttachmentMentions(message.message)} />
                          <time>{formatDate(message.createdAt)}</time>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>

            <aside className="ticket-support-panel">
              <h2>Hướng dẫn hỗ trợ nhanh</h2>
              <ul>
                <li>Gửi ảnh lỗi rõ nét, serial hoặc hóa đơn nếu liên quan bảo hành.</li>
                <li>Với lỗi kỹ thuật, ghi rõ cấu hình PC và bước tái hiện lỗi.</li>
                <li>Theo dõi phản hồi mới tại trang Support Center.</li>
              </ul>
              <Link to={routeConfig.public.aiChat}>Hỏi AI tư vấn cấu hình</Link>
            </aside>
          </section>

          <section className="ticket-reply">
            <div className="ticket-section-head">
              <span>Reply</span>
              <h2>Trả lời ticket</h2>
            </div>
            {isClosed ? (
              <p className="ticket-muted">Ticket đã đóng, bạn không thể gửi thêm phản hồi.</p>
            ) : (
              <>
                {isStaffUser ? (
                  <div className="reply-visibility-toggle" role="tablist" aria-label="Chế độ phản hồi">
                    <button type="button" className={replyVisibility === "PUBLIC" ? "is-active" : ""} onClick={() => setReplyVisibility("PUBLIC")}>
                      Phản hồi công khai
                    </button>
                    <button type="button" className={replyVisibility === "INTERNAL" ? "is-active" : ""} onClick={() => setReplyVisibility("INTERNAL")}>
                      Ghi chú nội bộ
                    </button>
                  </div>
                ) : (
                  <div className="reply-visibility-note">Phản hồi của bạn sẽ hiển thị trong lịch sử trao đổi và được nhân viên phụ trách theo dõi.</div>
                )}

                <textarea value={replyMessage} onChange={(event) => setReplyMessage(event.target.value)} rows={5} placeholder={isStaffUser && replyVisibility === "INTERNAL" ? "Ghi chú nội bộ dành cho đội hỗ trợ..." : "Bổ sung thông tin, cập nhật tình trạng sự cố hoặc trao đổi thêm với nhân viên kỹ thuật..."} />
                <div className="reply-upload">
                  <div>
                    <strong>Tệp đính kèm</strong>
                    <p>Ảnh lỗi, video hoặc hóa đơn. JPG, PNG, GIF, MP4, WEBM, MOV, PDF. Tối đa 20MB/tệp.</p>
                  </div>
                  <label>
                    <input type="file" multiple accept=".jpg,.jpeg,.png,.gif,.mp4,.webm,.mov,.pdf,image/*,video/*,application/pdf" onChange={handleAttachmentChange} />
                    <span>Chọn tệp</span>
                  </label>
                </div>
                {attachments.length > 0 ? (
                  <div className="reply-files">
                    {attachments.map((file) => (
                      <div key={`${file.name}-${file.size}`}>
                        <span>{file.type.startsWith("video/") ? "🎬" : file.type === "application/pdf" ? "🧾" : "🖼️"}</span>
                        <strong>{file.name}</strong>
                        <small>{formatFileSize(file.size)}</small>
                      </div>
                    ))}
                  </div>
                ) : null}
                <button type="button" onClick={handleReply} disabled={submitting}>
                  {submitting ? "Đang gửi..." : isStaffUser && replyVisibility === "INTERNAL" ? "Gửi ghi chú" : "Gửi phản hồi"}
                </button>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

const ticketDetailStyles = `
.ticket-detail {
  display: grid;
  gap: 20px;
}

.ticket-back {
  color: #2563eb;
  font-weight: 800;
  text-decoration: none;
}

.ticket-alert,
.ticket-loading,
.ticket-empty,
.ticket-detail__hero,
.ticket-conversation,
.ticket-support-panel,
.ticket-reply {
  border: 1px solid #e2e8f0;
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
}

.ticket-alert {
  padding: 14px 16px;
  font-weight: 800;
}

.ticket-alert--danger {
  color: #b91c1c;
  border-color: #fecaca;
  background: #fef2f2;
}

.ticket-alert--success {
  color: #047857;
  border-color: #86efac;
  background: #ecfdf5;
}

.ticket-loading,
.ticket-empty {
  display: grid;
  gap: 12px;
  justify-items: center;
  padding: 30px;
  text-align: center;
}

.ticket-loading span {
  width: 30px;
  height: 30px;
  border: 3px solid #bfdbfe;
  border-top-color: #2563eb;
  border-radius: 999px;
  animation: ticket-spin 800ms linear infinite;
}

.ticket-empty a,
.ticket-support-panel a,
.ticket-reply button,
.reply-upload label span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 16px;
  border: 0;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(135deg, #0f172a, #2563eb);
  font: inherit;
  font-weight: 900;
  text-decoration: none;
  cursor: pointer;
}

.ticket-detail__hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 22px;
  padding: 24px;
  overflow: hidden;
  background:
    radial-gradient(circle at top right, rgba(96, 165, 250, 0.22), transparent 34%),
    linear-gradient(135deg, #fff, #f8fbff);
}

.ticket-hero__content {
  display: grid;
  gap: 12px;
}

.ticket-hero__summary {
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #fff;
}

.ticket-chip {
  justify-self: start;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 900;
}

.ticket-hero__meta {
  display: grid;
  gap: 4px;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
}

.ticket-hero__meta span {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.ticket-hero__meta strong {
  color: #0f172a;
}

.ticket-hero__eyebrow,
.ticket-detail__hero span,
.ticket-section-head span {
  color: #2563eb;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ticket-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.ticket-live-sync {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.ticket-live-sync i {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.13);
}

.ticket-live-sync.is-syncing i {
  background: #2563eb;
  animation: ticket-pulse 900ms ease-in-out infinite;
}

.ticket-detail__hero h1 {
  margin: 8px 0 10px;
  color: #0f172a;
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.08;
}

.ticket-detail__hero p {
  margin: 0;
  color: #475569;
  line-height: 1.75;
  white-space: pre-wrap;
}

.ticket-detail__hero aside {
  display: grid;
  align-content: start;
  gap: 9px;
  padding: 16px;
  border-radius: 18px;
  background: #fff;
}

.ticket-detail__hero aside strong {
  justify-self: start;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 13px;
}

.ticket-detail__hero aside small,
.ticket-muted,
.conversation-empty {
  color: #64748b;
}

.ticket-detail__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 18px;
  align-items: start;
}

.ticket-conversation,
.ticket-support-panel,
.ticket-reply {
  padding: 20px;
}

.ticket-section-head h2,
.ticket-support-panel h2 {
  margin: 4px 0 0;
  color: #0f172a;
}

.conversation-timeline {
  position: relative;
  display: grid;
  gap: 16px;
  margin-top: 16px;
}

.conversation-timeline::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 20px;
  width: 2px;
  background: #dbeafe;
}

.conversation-message {
  position: relative;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 12px;
}

.conversation-avatar {
  z-index: 1;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  color: #fff;
  background: #2563eb;
  font-size: 12px;
  font-weight: 900;
}

.conversation-message.is-staff .conversation-avatar {
  background: #0f172a;
}

.conversation-bubble {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #f8fafc;
}

.conversation-message.is-staff .conversation-bubble {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.conversation-bubble__meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.conversation-bubble__meta strong {
  color: #0f172a;
}

.conversation-bubble__meta span,
.conversation-bubble time {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.conversation-badge {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.02em;
}

.conversation-badge--internal {
  background: #fff7ed;
  color: #b45309;
}

.conversation-bubble p {
  margin: 0;
  color: #334155;
  line-height: 1.7;
  white-space: pre-wrap;
}

.ticket-attachment-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.ticket-attachment-card {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  padding: 12px;
  border: 1px solid #dbe4f0;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  color: inherit;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}

.conversation-bubble .ticket-attachment-card {
  background: #fff;
}

.ticket-attachment-card:hover {
  border-color: #93c5fd;
  box-shadow: 0 14px 30px rgba(37, 99, 235, 0.12);
  transform: translateY(-1px);
}

.ticket-attachment-card[aria-disabled="true"] {
  cursor: default;
  opacity: 0.76;
}

.ticket-attachment-card__preview {
  display: grid;
  place-items: center;
  width: 96px;
  height: 78px;
  overflow: hidden;
  border-radius: 14px;
  background: linear-gradient(135deg, #eff6ff, #f8fafc);
  color: #2563eb;
  font-size: 12px;
  font-weight: 900;
  text-decoration: none;
  padding: 4px;
  box-sizing: border-box;
}

.ticket-attachment-card__preview img,
.ticket-attachment-card__preview video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.ticket-attachment-card strong {
  display: block;
  overflow: hidden;
  color: #0f172a;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticket-attachment-card small {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.ticket-attachment-card__body {
  min-width: 0;
}

.ticket-attachment-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.ticket-attachment-card__actions a,
.ticket-attachment-card__actions button,
.ticket-attachment-card__actions span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 7px 12px;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 12px;
  font-family: inherit;
  font-weight: 900;
  text-decoration: none;
  cursor: pointer;
}

.ticket-attachment-card__actions a:hover,
.ticket-attachment-card__actions button:hover {
  background: #2563eb;
  color: #fff;
}

.ticket-support-panel ul {
  display: grid;
  gap: 10px;
  margin: 12px 0 16px;
  padding-left: 20px;
  color: #475569;
  line-height: 1.6;
}

.ticket-reply {
  display: grid;
  gap: 14px;
}

.reply-visibility-toggle {
  display: inline-flex;
  gap: 8px;
  padding: 6px;
  border: 1px solid #dbeafe;
  border-radius: 16px;
  background: #eff6ff;
}

.reply-visibility-toggle button {
  min-height: 38px;
  padding: 0 14px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #1d4ed8;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.reply-visibility-toggle button.is-active {
  background: linear-gradient(135deg, #0f172a, #2563eb);
  color: #fff;
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.16);
}

.reply-visibility-note {
  padding: 12px 14px;
  border: 1px solid #dbeafe;
  border-radius: 16px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.6;
}

.ticket-reply textarea {
  width: 100%;
  min-height: 160px;
  padding: 16px;
  border: 1px solid #dbe4f0;
  border-radius: 18px;
  background: linear-gradient(180deg, #f8fbff, #f8fafc);
  font: inherit;
  resize: vertical;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.reply-upload {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border: 1px dashed #93c5fd;
  border-radius: 18px;
  background: #eff6ff;
}

.reply-upload p {
  margin: 5px 0 0;
  color: #64748b;
}

.reply-upload input {
  display: none;
}

.reply-files {
  display: grid;
  gap: 8px;
}

.reply-files div {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #f8fafc;
}

.reply-files strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reply-files small {
  color: #64748b;
}

.ticket-reply button {
  justify-self: end;
}

.ticket-reply button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

@keyframes ticket-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes ticket-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.35);
    opacity: 0.55;
  }
}

@media (max-width: 950px) {
  .ticket-detail__hero,
  .ticket-detail__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .ticket-detail__hero {
    padding: 20px;
  }

  .reply-upload {
    flex-direction: column;
    align-items: stretch;
  }

  .reply-upload label span,
  .ticket-reply button,
  .ticket-support-panel a {
    width: 100%;
  }

  .conversation-bubble__meta {
    display: grid;
  }
}
`;
