import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import axios from "axios";

import { getMyTickets } from "../../services/ticket.service";
import { useAuth } from "../../hooks/useAuth";
import { routeConfig } from "../../routes/routeConfig";

function getErrorMessage(error, fallbackMessage) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallbackMessage;
  }

  return error.message || fallbackMessage;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("vi-VN") : "Chưa cập nhật";
}

function getTicketPreview(ticket) {
  const firstMsg = Array.isArray(ticket?.messages) && ticket.messages.length > 0 ? ticket.messages[0]?.message : "";
  const text = String(ticket?.description || firstMsg || "Chưa có mô tả chi tiết.").trim();
  return text.length > 150 ? `${text.slice(0, 150)}...` : text;
}

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

const HELP_CONTENT = [
  { icon: "🛡️", title: "Bảo hành", desc: "Tra cứu thời hạn, gửi minh chứng và theo dõi xử lý.", to: routeConfig.public.warranties },
  { icon: "💳", title: "Thanh toán", desc: "Hỗ trợ COD, VNPay, QR Banking và trạng thái giao dịch.", to: routeConfig.public.orders },
  { icon: "🚚", title: "Giao hàng", desc: "Theo dõi vận đơn, thời gian giao và thông tin người nhận.", to: routeConfig.public.orders },
  { icon: "🤖", title: "AI tư vấn", desc: "Hỏi cấu hình PC, nâng cấp linh kiện và tương thích.", to: routeConfig.public.aiChat },
  { icon: "🧰", title: "Lỗi thường gặp", desc: "Màn hình xanh, không nhận RAM, nguồn yếu, nhiệt độ cao.", to: routeConfig.public.help }
];

const SUPPORT_CATEGORIES = ["Kỹ thuật", "Bảo hành", "Thanh toán", "Đơn hàng", "Build PC"];

const FAQS = [
  {
    question: "PC Mall phản hồi ticket trong bao lâu?",
    answer: "Ticket mới thường được tiếp nhận trong giờ làm việc. Các ticket ưu tiên cao hoặc liên quan đơn hàng đang giao sẽ được đẩy lên trước."
  },
  {
    question: "Tôi nên gửi thông tin gì khi báo lỗi linh kiện?",
    answer: "Bạn nên gửi mã đơn hàng, serial nếu có, ảnh/video lỗi, cấu hình đang sử dụng và các bước đã thử để kỹ thuật viên kiểm tra nhanh hơn."
  },
  {
    question: "Ticket đã giải quyết rồi có phản hồi tiếp được không?",
    answer: "Có. Bạn có thể mở chi tiết ticket và gửi thêm phản hồi nếu lỗi vẫn còn hoặc cần bổ sung thông tin."
  },
  {
    question: "Tôi có thể hỏi về build PC ở đây không?",
    answer: "Có. Chọn nhóm Build PC khi tạo ticket hoặc dùng AI tư vấn để nhận gợi ý cấu hình nhanh trước."
  }
];

function getStatusMeta(status) {
  return STATUS_META[String(status || "").toUpperCase()] || { label: status || "Chưa cập nhật", color: "#64748b", bg: "#f8fafc" };
}

function getPriorityMeta(priority) {
  return PRIORITY_META[String(priority || "").toUpperCase()] || { label: priority || "Chưa rõ", color: "#64748b", bg: "#f8fafc" };
}

export function TicketListPage() {
  const { authState, isAuthenticated } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeFaq, setActiveFaq] = useState(0);

  useEffect(() => {
    async function loadTickets() {
      try {
        setLoading(true);
        setErrorMessage("");
        const response = await getMyTickets();
        setTickets(response?.data || []);
      } catch (error) {
        setErrorMessage(getErrorMessage(error, "Không thể tải danh sách ticket"));
      } finally {
        setLoading(false);
      }
    }

    if (isAuthenticated) {
      loadTickets();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const stats = useMemo(() => {
    return tickets.reduce(
      (acc, ticket) => {
        const status = String(ticket.status || "").toUpperCase();
        if (status === "OPEN") acc.open += 1;
        if (status === "IN_PROGRESS") acc.processing += 1;
        if (status === "RESOLVED" || status === "CLOSED") acc.resolved += 1;
        if ((ticket.messages || []).some((message) => Number(message.sender?.id) !== Number(authState?.user?.id))) {
          acc.newReplies += 1;
        }
        return acc;
      },
      { open: 0, processing: 0, resolved: 0, newReplies: 0 }
    );
  }, [authState?.user?.id, tickets]);

  if (!isAuthenticated) {
    return <Navigate to={routeConfig.public.login} replace />;
  }

  return (
    <div className="support-center">
      <style>{supportStyles}</style>

      <section className="support-hero">
        <div>
          <span className="support-eyebrow">PC Mall Support Center</span>
          <h1>Trung tâm hỗ trợ khách hàng</h1>
          <p>Gửi yêu cầu, theo dõi ticket, trao đổi với kỹ thuật viên và tìm nhanh hướng dẫn cho đơn hàng, bảo hành, thanh toán hoặc build PC.</p>
          <div className="support-hero__actions">
            <Link to={routeConfig.public.ticketCreate} className="support-btn support-btn--primary">Tạo ticket mới</Link>
            <Link to={routeConfig.public.aiChat} className="support-btn">Hỏi AI tư vấn</Link>
          </div>
        </div>
        <div className="support-hero__panel">
          <strong>Xin chào, {authState?.user?.fullName || authState?.user?.email || "bạn"}</strong>
          <span>Đội hỗ trợ PC Mall sẵn sàng xử lý lỗi kỹ thuật, đơn hàng và bảo hành.</span>
        </div>
      </section>

      <section className="support-actions" aria-label="Thao tác nhanh">
        <Link to={routeConfig.public.ticketCreate} className="support-action">
          <span>🎫</span>
          <strong>Tạo ticket</strong>
          <small>Báo lỗi hoặc yêu cầu hỗ trợ</small>
        </Link>
        <Link to={routeConfig.public.orders} className="support-action">
          <span>📦</span>
          <strong>Tra cứu đơn hàng</strong>
          <small>Theo dõi thanh toán và giao hàng</small>
        </Link>
        <Link to={routeConfig.public.warranties} className="support-action">
          <span>🛡️</span>
          <strong>Bảo hành điện tử</strong>
          <small>Kiểm tra sản phẩm còn bảo hành</small>
        </Link>
        <Link to={routeConfig.public.pcBuilder} className="support-action">
          <span>🧩</span>
          <strong>Build PC</strong>
          <small>Lưu cấu hình và kiểm tra tương thích</small>
        </Link>
      </section>

      <section className="support-stats" aria-label="Thống kê hỗ trợ">
        <div><span>Ticket đang mở</span><strong>{stats.open}</strong></div>
        <div><span>Đang xử lý</span><strong>{stats.processing}</strong></div>
        <div><span>Đã giải quyết</span><strong>{stats.resolved}</strong></div>
        <div><span>Phản hồi mới</span><strong>{stats.newReplies}</strong></div>
      </section>

      {errorMessage ? <div className="support-alert support-alert--danger">{errorMessage}</div> : null}

      <section className="support-grid">
        <div className="support-main">
          <div className="support-section-head">
            <div>
              <span>Ticket của bạn</span>
              <h2>Lịch sử hỗ trợ</h2>
            </div>
            <Link to={routeConfig.public.ticketCreate} className="support-btn support-btn--primary">Gửi yêu cầu</Link>
          </div>

          {loading ? (
            <div className="support-loading">
              <span />
              <strong>Đang tải danh sách ticket...</strong>
            </div>
          ) : tickets.length === 0 ? (
            <div className="support-empty">
              <svg viewBox="0 0 180 140" aria-hidden="true">
                <rect x="30" y="32" width="120" height="84" rx="18" fill="#eff6ff" />
                <path d="M54 56h72M54 74h48M54 92h60" stroke="#2563eb" strokeWidth="7" strokeLinecap="round" />
                <circle cx="132" cy="38" r="16" fill="#0f172a" />
                <path d="M126 38h12M132 32v12" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
              </svg>
              <h3>Bạn chưa có ticket nào</h3>
              <p>Khi gặp sự cố kỹ thuật, thanh toán, bảo hành hoặc cần tư vấn build PC, hãy tạo ticket để đội ngũ PC Mall theo dõi đầy đủ.</p>
              <Link to={routeConfig.public.ticketCreate} className="support-btn support-btn--primary">Tạo ticket đầu tiên</Link>
            </div>
          ) : (
            <div className="ticket-cards">
              {tickets.map((ticket) => {
                const statusMeta = getStatusMeta(ticket.status);
                const priorityMeta = getPriorityMeta(ticket.priority);
                const lastMessage = ticket.messages?.[ticket.messages.length - 1];
                return (
                  <article className="ticket-card" key={ticket.id}>
                    <div className="ticket-card__top">
                      <div>
                        <span>Ticket #{ticket.id}</span>
                        <h3>{ticket.title}</h3>
                      </div>
                      <div className="ticket-card__badges">
                        <strong style={{ color: statusMeta.color, background: statusMeta.bg }}>{statusMeta.label}</strong>
                        <strong style={{ color: priorityMeta.color, background: priorityMeta.bg }}>Ưu tiên {priorityMeta.label}</strong>
                      </div>
                    </div>
                    <p>{getTicketPreview(ticket)}</p>
                    <div className="ticket-card__meta">
                      <span>Cập nhật: {formatDate(ticket.updatedAt || lastMessage?.createdAt || ticket.createdAt)}</span>
                      <span>Kỹ thuật: {ticket.assignee?.fullName || "Chưa phân công"}</span>
                    </div>
                    <div className="ticket-card__actions">
                      <Link to={routeConfig.public.ticketDetail.replace(":ticketId", String(ticket.id))} className="support-btn support-btn--primary">Xem chi tiết</Link>
                      <Link to={routeConfig.public.ticketDetail.replace(":ticketId", String(ticket.id))} className="support-btn">Phản hồi</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="support-side">
          <section className="support-card">
            <h2>Danh mục hỗ trợ</h2>
            <div className="support-categories">
              {SUPPORT_CATEGORIES.map((category) => (
                <Link key={category} to={`${routeConfig.public.ticketCreate}?category=${encodeURIComponent(category)}`}>{category}</Link>
              ))}
            </div>
          </section>

          <section className="support-card">
            <h2>Nội dung nổi bật</h2>
            <div className="help-list">
              {HELP_CONTENT.map((item) => (
                <Link to={item.to} key={item.title} className="help-item">
                  <span>{item.icon}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.desc}</small>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <section className="support-faq">
        <div className="support-section-head">
          <div>
            <span>FAQ</span>
            <h2>Câu hỏi thường gặp</h2>
          </div>
        </div>
        <div className="faq-list">
          {FAQS.map((item, index) => (
            <button type="button" className={`faq-item ${activeFaq === index ? "is-open" : ""}`} key={item.question} onClick={() => setActiveFaq(activeFaq === index ? -1 : index)}>
              <div>
                <strong>{item.question}</strong>
                <span>{activeFaq === index ? "−" : "+"}</span>
              </div>
              {activeFaq === index ? <p>{item.answer}</p> : null}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

const supportStyles = `
.support-center {
  display: grid;
  gap: 22px;
}

.support-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
  align-items: end;
  padding: 30px;
  border-radius: 28px;
  color: #fff;
  background:
    radial-gradient(circle at top right, rgba(96, 165, 250, 0.36), transparent 36%),
    linear-gradient(135deg, #0f172a 0%, #1e3a8a 58%, #2563eb 100%);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
}

.support-eyebrow,
.support-section-head span {
  color: #bfdbfe;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.support-hero h1 {
  margin: 8px 0 10px;
  font-size: clamp(32px, 5vw, 50px);
  line-height: 1.05;
}

.support-hero p {
  max-width: 780px;
  margin: 0;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.7;
}

.support-hero__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 20px;
}

.support-hero__panel {
  display: grid;
  gap: 8px;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  background: rgba(15, 23, 42, 0.34);
}

.support-hero__panel span {
  color: rgba(255, 255, 255, 0.74);
  line-height: 1.6;
}

.support-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 16px;
  border: 1px solid #dbe4f0;
  border-radius: 12px;
  color: #0f172a;
  background: #fff;
  font-weight: 900;
  text-decoration: none;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.support-btn:hover,
.support-action:hover,
.ticket-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 34px rgba(37, 99, 235, 0.14);
}

.support-btn--primary {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(135deg, #0f172a, #2563eb);
}

.support-actions,
.support-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.support-action,
.support-stats div,
.support-card,
.support-main,
.support-faq {
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.07);
}

.support-action {
  display: grid;
  gap: 5px;
  padding: 18px;
  color: inherit;
  text-decoration: none;
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.support-action span {
  font-size: 26px;
}

.support-action small,
.support-stats span,
.ticket-card__meta,
.help-item small,
.support-empty p,
.faq-item p {
  color: #64748b;
}

.support-stats div {
  padding: 18px;
}

.support-stats strong {
  display: block;
  margin-top: 10px;
  color: #0f172a;
  font-size: 32px;
}

.support-alert {
  padding: 15px 18px;
  border-radius: 16px;
  font-weight: 800;
}

.support-alert--danger {
  color: #b91c1c;
  border: 1px solid #fecaca;
  background: #fef2f2;
}

.support-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 18px;
  align-items: start;
}

.support-main,
.support-card,
.support-faq {
  padding: 20px;
}

.support-section-head {
  display: flex;
  gap: 14px;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.support-section-head span {
  color: #2563eb;
}

.support-section-head h2,
.support-card h2 {
  margin: 4px 0 0;
  color: #0f172a;
}

.support-side {
  display: grid;
  gap: 18px;
}

.ticket-cards,
.help-list,
.faq-list {
  display: grid;
  gap: 12px;
}

.ticket-card {
  display: grid;
  gap: 12px;
  padding: 18px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: linear-gradient(180deg, #fff, #f8fbff);
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.ticket-card__top {
  display: flex;
  gap: 14px;
  justify-content: space-between;
  align-items: flex-start;
}

.ticket-card__top span {
  color: #64748b;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

.ticket-card h3 {
  margin: 4px 0 0;
  color: #0f172a;
  font-size: 22px;
}

.ticket-card p {
  margin: 0;
  color: #475569;
  line-height: 1.7;
}

.ticket-card__badges {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.ticket-card__badges strong {
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
}

.ticket-card__meta,
.ticket-card__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.ticket-card__actions {
  justify-content: flex-end;
}

.support-categories {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.support-categories a {
  padding: 8px 12px;
  border-radius: 999px;
  color: #1d4ed8;
  background: #eff6ff;
  font-weight: 800;
  text-decoration: none;
}

.help-item {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 12px;
  border-radius: 16px;
  color: inherit;
  background: #f8fafc;
  text-decoration: none;
}

.help-item span {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: #eff6ff;
  font-size: 22px;
}

.help-item strong,
.help-item small {
  display: block;
}

.support-loading,
.support-empty {
  display: grid;
  gap: 12px;
  justify-items: center;
  padding: 30px;
  text-align: center;
}

.support-loading span {
  width: 30px;
  height: 30px;
  border: 3px solid #bfdbfe;
  border-top-color: #2563eb;
  border-radius: 999px;
  animation: support-spin 800ms linear infinite;
}

.support-empty svg {
  width: 180px;
  max-width: 70vw;
}

.support-empty h3 {
  margin: 0;
  color: #0f172a;
  font-size: 24px;
}

.faq-item {
  width: 100%;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.faq-item div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.faq-item strong {
  color: #0f172a;
}

.faq-item span {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  color: #fff;
  background: #2563eb;
}

.faq-item p {
  margin: 10px 0 0;
  line-height: 1.7;
}

@keyframes support-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1100px) {
  .support-hero,
  .support-grid {
    grid-template-columns: 1fr;
  }

  .support-actions,
  .support-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .support-hero {
    padding: 24px;
  }

  .support-actions,
  .support-stats {
    grid-template-columns: 1fr;
  }

  .support-section-head,
  .ticket-card__top,
  .ticket-card__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .support-btn {
    width: 100%;
  }
}
`;
