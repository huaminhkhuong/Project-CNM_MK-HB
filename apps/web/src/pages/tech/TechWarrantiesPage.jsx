import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

import {
  getTechWarrantyRequests,
  updateTechWarrantyRequest
} from "../../services/warranty.service";
import { resolveProductImage } from "../../utils/productImage";

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "RECEIVED", label: "Đã tiếp nhận" },
  { value: "INSPECTING", label: "Đang kiểm tra" },
  { value: "REPAIRING", label: "Đang sửa chữa" },
  { value: "WAITING_PARTS", label: "Chờ linh kiện" },
  { value: "REPLACEMENT", label: "Đổi mới" },
  { value: "COMPLETED", label: "Hoàn tất" }
];

const STATUS_FLOW = STATUS_OPTIONS.filter((item) => item.value).map((item, index) => ({
  ...item,
  step: index + 1
}));

const STATUS_META = {
  RECEIVED: { label: "Đã tiếp nhận", tone: "info", action: "Ghi nhận yêu cầu và kiểm tra thông tin ban đầu." },
  INSPECTING: { label: "Đang kiểm tra", tone: "warning", action: "Kỹ thuật đang kiểm tra lỗi và tình trạng sản phẩm." },
  REPAIRING: { label: "Đang sửa chữa", tone: "warning", action: "Sản phẩm đang được xử lý hoặc sửa chữa." },
  WAITING_PARTS: { label: "Chờ linh kiện", tone: "danger", action: "Đang chờ linh kiện thay thế hoặc phản hồi từ hãng." },
  REPLACEMENT: { label: "Đổi mới", tone: "success", action: "Đề xuất đổi mới hoặc thay thế sản phẩm." },
  COMPLETED: { label: "Hoàn tất", tone: "success", action: "Yêu cầu đã hoàn tất và chờ khách nhận lại sản phẩm." }
};

const SEVERITY_META = {
  LOW: { label: "Nhẹ", tone: "success" },
  MEDIUM: { label: "Trung bình", tone: "info" },
  HIGH: { label: "Nghiêm trọng", tone: "warning" },
  CRITICAL: { label: "Khẩn cấp", tone: "danger" }
};

function getEnvelopeData(response, fallback) {
  if (response && typeof response === "object" && "data" in response) {
    return response.data ?? fallback;
  }
  return response ?? fallback;
}

function getErrorMessage(error, fallback) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback;
  }
  return error?.message || fallback;
}

function normalizeStatus(status) {
  const normalized = String(status || "RECEIVED").toUpperCase();
  return STATUS_META[normalized] ? normalized : "RECEIVED";
}

function getStatusMeta(status) {
  return STATUS_META[normalizeStatus(status)];
}

function getNextStatus(status) {
  const current = normalizeStatus(status);
  const currentIndex = STATUS_FLOW.findIndex((item) => item.value === current);
  if (currentIndex < 0) return "INSPECTING";
  return STATUS_FLOW[Math.min(currentIndex + 1, STATUS_FLOW.length - 1)]?.value || current;
}

function getSeverityMeta(severity) {
  return SEVERITY_META[String(severity || "MEDIUM").toUpperCase()] || SEVERITY_META.MEDIUM;
}

function formatDateTime(value) {
  if (!value) return "Chưa cập nhật";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

function getTimelineTimestamp(request, statusKey) {
  const event = (request.timeline || []).find((item) => String(item.key || item.status || "").toUpperCase() === statusKey);
  return event?.timestamp || event?.createdAt || null;
}

function getTimelineNote(request, statusKey) {
  const event = (request.timeline || []).find((item) => String(item.key || item.status || "").toUpperCase() === statusKey);
  return event?.note || "";
}

function getAttachmentUrl(attachment) {
  const raw = String(attachment?.fileUrl || attachment?.url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/uploads/")) {
    return typeof window !== "undefined" ? `${window.location.origin}${raw}` : raw;
  }
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `/${raw.replace(/^\/+/, "")}`;
}

function getFileLabel(attachment) {
  const name = String(attachment?.name || attachment?.fileUrl || "Tệp đính kèm");
  return name.split("/").pop();
}

function getAttachmentSource(attachment) {
  return String(attachment?.source || "CUSTOMER").toUpperCase();
}

function isStaffAttachment(attachment) {
  return ["STAFF", "TECH", "TECHNICIAN"].includes(getAttachmentSource(attachment));
}

function isCustomerAttachment(attachment) {
  return !isStaffAttachment(attachment);
}

function getProductImage(request) {
  return resolveProductImage({
    image_url: request?.imageUrl,
    imageUrl: request?.productImage,
    thumbnail: request?.thumbnail,
    category_name: request?.categoryName,
    name: request?.productName
  });
}

function hasLinkedProduct(request) {
  const productName = String(request?.productName || "").trim().toLowerCase();
  return Boolean(
    request?.imageUrl ||
      request?.productImage ||
      request?.categoryName ||
      request?.orderId ||
      request?.serialNumber ||
      (productName && productName !== "sản phẩm")
  );
}

function getDisplayProductName(request) {
  return hasLinkedProduct(request) ? request?.productName || "Sản phẩm bảo hành" : "Hồ sơ bảo hành thủ công";
}

export function TechWarrantiesPage() {
  const [requests, setRequests] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [formState, setFormState] = useState({
    status: "INSPECTING",
    technicianNote: "",
    media: []
  });

  const loadRequests = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const response = await getTechWarrantyRequests({
        status: statusFilter || undefined,
        keyword: keyword.trim() || undefined
      });
      const nextRequests = getEnvelopeData(response, []);
      const normalizedRequests = Array.isArray(nextRequests) ? nextRequests : [];

      setRequests(normalizedRequests);
      setSelectedRequestId((current) => {
        if (normalizedRequests.length === 0) return null;
        return normalizedRequests.some((item) => item.id === current) ? current : normalizedRequests[0].id;
      });

      if (silent) {
        setMessage({ type: "success", text: `Đã làm mới ${normalizedRequests.length} yêu cầu bảo hành.` });
      }
    } catch (error) {
      setMessage({ type: "error", text: getErrorMessage(error, "Không thể tải danh sách yêu cầu bảo hành.") });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [keyword, statusFilter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadRequests({ silent: true });
    }, 20000);
    return () => clearInterval(interval);
  }, [loadRequests]);

  useEffect(() => {
    if (!message.text) return undefined;
    const timer = setTimeout(() => setMessage({ type: "", text: "" }), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  const selectedRequest = useMemo(
    () => requests.find((item) => item.id === selectedRequestId) || null,
    [requests, selectedRequestId]
  );

  useEffect(() => {
    if (!selectedRequest) return;
    setFormState({
      status: getNextStatus(selectedRequest.status),
      technicianNote: "",
      media: []
    });
  }, [selectedRequest]);

  const stats = useMemo(() => {
    const openStatuses = ["RECEIVED", "INSPECTING", "REPAIRING", "WAITING_PARTS", "REPLACEMENT"];
    return {
      total: requests.length,
      active: requests.filter((item) => openStatuses.includes(normalizeStatus(item.status))).length,
      urgent: requests.filter((item) => String(item.severity || "").toUpperCase() === "CRITICAL").length,
      completed: requests.filter((item) => normalizeStatus(item.status) === "COMPLETED").length
    };
  }, [requests]);

  const currentStatus = selectedRequest ? normalizeStatus(selectedRequest.status) : "RECEIVED";
  const currentStatusMeta = getStatusMeta(currentStatus);
  const currentStepIndex = STATUS_FLOW.findIndex((step) => step.value === currentStatus);
  const customerAttachments = selectedRequest?.attachments?.filter(isCustomerAttachment) || [];
  const staffAttachments = selectedRequest?.attachments?.filter(isStaffAttachment) || [];

  function renderAttachmentList(attachments, emptyText) {
    if (!attachments.length) {
      return <div className="tech-warranty-empty">{emptyText}</div>;
    }

    return (
      <div className="tech-warranty-attachments">
        {attachments.map((attachment) => {
          const fileUrl = getAttachmentUrl(attachment);
          const isImage = String(attachment.mimeType || "").startsWith("image/");
          return (
            <article key={attachment.id || fileUrl} className="tech-warranty-attachment">
              {isImage ? (
                <img className="tech-warranty-attachment__thumb" src={fileUrl} alt={getFileLabel(attachment)} />
              ) : (
                <div className="tech-warranty-attachment__thumb" style={{ display: "grid", placeItems: "center", color: "#2563eb", fontWeight: 900 }}>FILE</div>
              )}
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: "block", color: "#0f172a" }}>{getFileLabel(attachment)}</strong>
                <div className="tech-warranty-row" style={{ justifyContent: "flex-start", marginTop: 8 }}>
                  <a href={fileUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontWeight: 900, textDecoration: "none" }}>Xem tệp</a>
                  <a href={fileUrl} download style={{ color: "#2563eb", fontWeight: 900, textDecoration: "none" }}>Tải xuống</a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  function handleFiles(files) {
    setFormState((prev) => ({
      ...prev,
      media: Array.from(files || []).slice(0, 5)
    }));
  }

  async function handleUpdateRequest(event) {
    event.preventDefault();
    if (!selectedRequest) return;

    try {
      setSaving(true);
      setMessage({ type: "", text: "" });
      const nextStatus = normalizeStatus(formState.status);
      const response = await updateTechWarrantyRequest(selectedRequest.id, {
        status: nextStatus,
        technicianNote: formState.technicianNote,
        media: formState.media
      });
      const updated = getEnvelopeData(response, null);
      if (updated?.id) {
        setRequests((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      }
      setMessage({ type: "success", text: `Đã cập nhật trạng thái: ${getStatusMeta(nextStatus).label}.` });
      setFormState((prev) => ({ ...prev, technicianNote: "", media: [] }));
    } catch (error) {
      setMessage({ type: "error", text: getErrorMessage(error, "Không thể cập nhật yêu cầu bảo hành.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tech-warranty-page">
      <style>{`
        .tech-warranty-page { display: grid; gap: 24px; max-width: 1640px; margin: 0 auto; padding: 0 22px 48px; }
        .tech-warranty-hero { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 20px; padding: 28px; border-radius: 28px; background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%); color: #fff; box-shadow: 0 24px 48px rgba(15, 23, 42, 0.16); }
        .tech-warranty-hero h1 { margin: 10px 0; font-size: 34px; line-height: 1.08; }
        .tech-warranty-hero p { margin: 0; color: #cbd5e1; line-height: 1.7; }
        .tech-warranty-hero__card { padding: 18px; border-radius: 22px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.16); }
        .tech-warranty-stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
        .tech-warranty-stat, .tech-warranty-panel { background: #fff; border: 1px solid #dbe4ef; border-radius: 22px; box-shadow: 0 18px 42px rgba(15, 23, 42, 0.06); }
        .tech-warranty-stat { display: flex; align-items: center; justify-content: space-between; min-height: 92px; padding: 18px 20px; }
        .tech-warranty-stat span { display: block; color: #64748b; font-size: 13px; font-weight: 800; }
        .tech-warranty-stat strong { display: block; margin-top: 6px; color: #0f172a; font-size: 32px; line-height: 1; }
        .tech-warranty-stat__icon { width: 46px; height: 46px; border-radius: 16px; display: grid; place-items: center; background: #eff6ff; color: #2563eb; font-weight: 900; }
        .tech-warranty-workspace { display: grid; grid-template-columns: 380px minmax(0, 1fr); gap: 24px; align-items: start; }
        .tech-warranty-workspace > * { min-width: 0; }
        .tech-warranty-workspace > aside:first-child { position: sticky; top: 92px; }
        .tech-warranty-workspace > main { min-width: 0; overflow: hidden; }
        .tech-warranty-workspace > aside:last-child { grid-column: 2; }
        .tech-warranty-panel__body { padding: 22px; display: grid; gap: 16px; }
        .tech-warranty-section-title { margin: 0; color: #0f172a; font-size: 22px; }
        .tech-warranty-muted { color: #64748b; line-height: 1.55; }
        .tech-warranty-filters { display: grid; gap: 10px; }
        .tech-warranty-input, .tech-warranty-select, .tech-warranty-textarea { width: 100%; box-sizing: border-box; border-radius: 14px; border: 1px solid #dbe4ef; background: #f8fafc; color: #0f172a; }
        .tech-warranty-input, .tech-warranty-select { min-height: 46px; padding: 0 14px; font-weight: 650; }
        .tech-warranty-textarea { min-height: 130px; padding: 14px; resize: vertical; font: inherit; }
        .tech-warranty-request-list { display: grid; gap: 12px; max-height: 760px; overflow-y: auto; padding-right: 4px; }
        .tech-warranty-request-card { display: grid; gap: 10px; padding: 16px; text-align: left; border: 1px solid #e2e8f0; background: #fff; border-radius: 18px; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .tech-warranty-request-card:hover { transform: translateY(-1px); box-shadow: 0 14px 26px rgba(37, 99, 235, 0.10); }
        .tech-warranty-request-card--active { border-color: #60a5fa; box-shadow: 0 16px 30px rgba(59, 130, 246, 0.14); background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); }
        .tech-warranty-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .tech-warranty-pill { display: inline-flex; align-items: center; justify-content: center; min-height: 28px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 900; white-space: nowrap; }
        .tech-warranty-pill--info { background: #eff6ff; color: #1d4ed8; }
        .tech-warranty-pill--warning { background: #fff7ed; color: #b45309; }
        .tech-warranty-pill--danger { background: #fef2f2; color: #b91c1c; }
        .tech-warranty-pill--success { background: #ecfdf5; color: #047857; }
        .tech-warranty-product { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 24px; align-items: start; }
        .tech-warranty-product > * { min-width: 0; }
        .tech-warranty-product__image { min-height: 240px; border-radius: 22px; background: linear-gradient(180deg, #fff 0%, #f8fbff 100%); display: grid; place-items: center; overflow: hidden; border: 1px solid #e2e8f0; }
        .tech-warranty-product__image img { width: 100%; height: 220px; object-fit: contain; padding: 18px; }
        .tech-warranty-product__placeholder { width: 100%; height: 100%; min-height: 240px; display: grid; place-items: center; padding: 22px; text-align: center; background: linear-gradient(135deg, #f8fafc, #eef2ff); color: #475569; }
        .tech-warranty-product__placeholder strong { display: block; margin-top: 10px; color: #0f172a; font-size: 18px; }
        .tech-warranty-product__placeholder span { display: block; margin-top: 6px; font-size: 13px; line-height: 1.5; }
        .tech-warranty-product__title { margin: 0; font-size: 28px; line-height: 1.15; color: #0f172a; }
        .tech-warranty-status-board { display: grid; grid-template-columns: repeat(6, minmax(120px, 1fr)); gap: 10px; padding: 12px; border-radius: 22px; background: linear-gradient(135deg, #172554, #1d4ed8); overflow-x: auto; }
        .tech-warranty-step { min-height: 124px; padding: 14px; border-radius: 17px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.10); color: rgba(255,255,255,0.72); }
        .tech-warranty-step--done { background: linear-gradient(135deg, #059669, #14b8a6); color: #fff; border-color: rgba(167, 243, 208, 0.6); }
        .tech-warranty-step--current { background: linear-gradient(135deg, #2563eb, #4f46e5); color: #fff; border-color: rgba(191, 219, 254, 0.9); box-shadow: 0 16px 30px rgba(37, 99, 235, 0.26); }
        .tech-warranty-step__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
        .tech-warranty-step__number { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 999px; background: rgba(255,255,255,0.20); font-weight: 950; }
        .tech-warranty-step--done .tech-warranty-step__number { background: #d1fae5; color: #047857; }
        .tech-warranty-step--current .tech-warranty-step__number { background: #fff; color: #2563eb; }
        .tech-warranty-meta-grid { display: grid; grid-template-columns: repeat(2, minmax(220px, 1fr)); gap: 12px; }
        .tech-warranty-meta-card { padding: 14px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; min-width: 0; }
        .tech-warranty-meta-card span { display: block; font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: .03em; }
        .tech-warranty-meta-card strong { display: block; margin-top: 6px; color: #0f172a; overflow-wrap: anywhere; }
        .tech-warranty-attachments { display: grid; gap: 12px; }
        .tech-warranty-attachment { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; }
        .tech-warranty-attachment__thumb { width: 56px; height: 56px; border-radius: 14px; background: #eff6ff; object-fit: cover; flex: 0 0 auto; }
        .tech-warranty-actions { display: grid; gap: 12px; }
        .tech-warranty-button { min-height: 46px; border: none; border-radius: 14px; cursor: pointer; font-weight: 900; transition: transform .16s ease, box-shadow .16s ease; }
        .tech-warranty-button:hover { transform: translateY(-1px); box-shadow: 0 12px 24px rgba(37, 99, 235, 0.16); }
        .tech-warranty-button:active { transform: scale(.98); }
        .tech-warranty-button:disabled { cursor: not-allowed; opacity: .65; transform: none; box-shadow: none; }
        .tech-warranty-button--primary { color: #fff; background: linear-gradient(135deg, #2563eb, #1d4ed8); }
        .tech-warranty-button--secondary { color: #0f172a; background: #fff; border: 1px solid #dbe4ef; }
        .tech-warranty-empty { padding: 32px; border-radius: 18px; background: #f8fafc; color: #64748b; text-align: center; border: 1px dashed #cbd5e1; }
        .tech-warranty-alert { padding: 14px 16px; border-radius: 16px; font-weight: 800; }
        .tech-warranty-alert--error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        .tech-warranty-alert--success { background: #ecfdf5; color: #047857; border: 1px solid #bbf7d0; }
        .tech-warranty-soft-note { padding: 12px 14px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; line-height: 1.55; }
        .tech-warranty-update-grid { display: grid; grid-template-columns: minmax(260px, 320px) minmax(0, 1fr); gap: 14px; align-items: start; }
        .tech-warranty-update-grid > * { min-width: 0; }
        .tech-warranty-update-note, .tech-warranty-update-upload { grid-column: 1 / -1; }
        .tech-warranty-file-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
        @media (max-width: 1360px) {
          .tech-warranty-workspace { grid-template-columns: 340px minmax(0, 1fr); }
          .tech-warranty-workspace > aside:last-child { grid-column: 1 / -1; }
          .tech-warranty-hero { grid-template-columns: 1fr; }
          .tech-warranty-update-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 980px) {
          .tech-warranty-workspace, .tech-warranty-product { grid-template-columns: 1fr; }
          .tech-warranty-workspace > aside:first-child { position: static; }
          .tech-warranty-workspace > aside:last-child { grid-column: auto; }
          .tech-warranty-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 720px) {
          .tech-warranty-page { padding: 0 12px 36px; }
          .tech-warranty-stat-grid, .tech-warranty-meta-grid { grid-template-columns: 1fr; }
          .tech-warranty-hero h1 { font-size: 28px; }
          .tech-warranty-product__title { font-size: 24px; }
        }
      `}</style>

      <section className="tech-warranty-hero">
        <div>
          <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.12em", color: "#93c5fd", fontWeight: 900 }}>
            Warranty operations
          </div>
          <h1>Trung tâm xử lý bảo hành</h1>
          <p>
            Theo dõi yêu cầu bảo hành, kiểm tra sản phẩm, cập nhật tiến trình và đồng bộ trạng thái về dashboard của khách hàng.
          </p>
        </div>
        <div className="tech-warranty-hero__card">
          <span style={{ color: "#bfdbfe", fontWeight: 800 }}>Đang cần xử lý</span>
          <strong style={{ display: "block", marginTop: 8, color: "#fff", fontSize: 34 }}>{stats.active}</strong>
          <p style={{ marginTop: 10 }}>Ưu tiên các yêu cầu khẩn cấp, chờ linh kiện hoặc đang kiểm tra.</p>
        </div>
      </section>

      <section className="tech-warranty-stat-grid">
        <article className="tech-warranty-stat"><div><span>Tổng yêu cầu</span><strong>{stats.total}</strong></div><div className="tech-warranty-stat__icon">ALL</div></article>
        <article className="tech-warranty-stat"><div><span>Đang xử lý</span><strong>{stats.active}</strong></div><div className="tech-warranty-stat__icon">RUN</div></article>
        <article className="tech-warranty-stat"><div><span>Khẩn cấp</span><strong>{stats.urgent}</strong></div><div className="tech-warranty-stat__icon">!</div></article>
        <article className="tech-warranty-stat"><div><span>Hoàn tất</span><strong>{stats.completed}</strong></div><div className="tech-warranty-stat__icon">OK</div></article>
      </section>

      {message.text ? (
        <div className={`tech-warranty-alert ${message.type === "error" ? "tech-warranty-alert--error" : "tech-warranty-alert--success"}`}>
          {message.text}
        </div>
      ) : null}

      <div className="tech-warranty-workspace">
        <aside className="tech-warranty-panel">
          <div className="tech-warranty-panel__body">
            <div className="tech-warranty-row">
              <div>
                <h2 className="tech-warranty-section-title">Danh sách yêu cầu</h2>
                <p className="tech-warranty-muted" style={{ margin: "6px 0 0" }}>Lọc theo trạng thái và chọn hồ sơ cần xử lý.</p>
              </div>
              <button
                type="button"
                className="tech-warranty-button tech-warranty-button--secondary"
                style={{ minHeight: 38, padding: "0 12px" }}
                onClick={() => loadRequests({ silent: true })}
                disabled={refreshing}
              >
                {refreshing ? "Đang tải..." : "Làm mới"}
              </button>
            </div>

            <div className="tech-warranty-filters">
              <input
                className="tech-warranty-input"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Tìm sản phẩm, serial, khách hàng..."
              />
              <select className="tech-warranty-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="tech-warranty-request-list">
              {loading ? (
                <div className="tech-warranty-empty">Đang tải yêu cầu bảo hành...</div>
              ) : requests.length === 0 ? (
                <div className="tech-warranty-empty">Chưa có yêu cầu phù hợp bộ lọc hiện tại.</div>
              ) : (
                requests.map((request) => {
                  const statusMeta = getStatusMeta(request.status);
                  const severityMeta = getSeverityMeta(request.severity);
                  return (
                    <button
                      key={request.id}
                      type="button"
                      className={`tech-warranty-request-card${request.id === selectedRequestId ? " tech-warranty-request-card--active" : ""}`}
                      onClick={() => setSelectedRequestId(request.id)}
                    >
                      <div className="tech-warranty-row">
                        <span className={`tech-warranty-pill tech-warranty-pill--${statusMeta.tone}`}>{statusMeta.label}</span>
                        <span className={`tech-warranty-pill tech-warranty-pill--${severityMeta.tone}`}>{severityMeta.label}</span>
                      </div>
                      <strong style={{ color: "#0f172a", fontSize: 16 }}>{getDisplayProductName(request)}</strong>
                      <div style={{ color: "#475569", fontSize: 14 }}>Khách: {request.customerName || request.customerEmail || "Khách vãng lai"}</div>
                      <div style={{ color: "#64748b", fontSize: 13 }}>Serial: {request.serialNumber || "Chưa có"} · Đơn: {request.orderId ? `#${request.orderId}` : "Chưa liên kết"}</div>
                      <div style={{ color: "#64748b", fontSize: 13 }}>{formatDateTime(request.createdAt)}</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        <main className="tech-warranty-panel">
          <div className="tech-warranty-panel__body">
            {!selectedRequest ? (
              <div className="tech-warranty-empty">Chọn một yêu cầu để xem chi tiết bảo hành, trạng thái và timeline xử lý.</div>
            ) : (
              <>
                <section className="tech-warranty-product">
                  <div className="tech-warranty-product__image">
                    {hasLinkedProduct(selectedRequest) ? (
                      <img
                        src={getProductImage(selectedRequest)}
                        alt={selectedRequest.productName || "Sản phẩm bảo hành"}
                        onError={(event) => {
                          event.currentTarget.src = resolveProductImage({ category_name: selectedRequest.categoryName, name: selectedRequest.productName });
                        }}
                      />
                    ) : (
                      <div className="tech-warranty-product__placeholder">
                        <div>
                          <div style={{ fontSize: 42 }}>PC</div>
                          <strong>Hồ sơ thủ công</strong>
                          <span>Chưa có ảnh sản phẩm vì khách chưa cung cấp serial hoặc mã đơn liên quan.</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "grid", gap: 14 }}>
                    <div className="tech-warranty-row">
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: "#2563eb", fontSize: 13, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase" }}>
                          Yêu cầu #{selectedRequest.id} {selectedRequest.warrantyCode ? `· ${selectedRequest.warrantyCode}` : ""}
                        </div>
                        <h2 className="tech-warranty-product__title">{getDisplayProductName(selectedRequest)}</h2>
                        <p className="tech-warranty-muted" style={{ margin: "6px 0 0" }}>{currentStatusMeta.action}</p>
                      </div>
                      <span className={`tech-warranty-pill tech-warranty-pill--${currentStatusMeta.tone}`}>{currentStatusMeta.label}</span>
                    </div>

                    {!hasLinkedProduct(selectedRequest) ? (
                      <div className="tech-warranty-soft-note">
                        Gợi ý xử lý: nếu cần xác minh bảo hành chính xác, hãy yêu cầu khách bổ sung serial hoặc mã đơn trong phần phản hồi.
                      </div>
                    ) : null}

                    <div className="tech-warranty-meta-grid">
                      <article className="tech-warranty-meta-card"><span>Khách hàng</span><strong>{selectedRequest.customerName || "Khách vãng lai"}</strong></article>
                      <article className="tech-warranty-meta-card"><span>Số điện thoại</span><strong>{selectedRequest.customerPhone || "Chưa có"}</strong></article>
                      <article className="tech-warranty-meta-card"><span>Email</span><strong>{selectedRequest.customerEmail || "Chưa có"}</strong></article>
                      <article className="tech-warranty-meta-card"><span>Serial / SKU</span><strong>{selectedRequest.serialNumber || "Chưa có"}</strong></article>
                      <article className="tech-warranty-meta-card"><span>Đơn hàng</span><strong>{selectedRequest.orderId ? `#${selectedRequest.orderId}` : "Chưa liên kết đơn"}</strong></article>
                      <article className="tech-warranty-meta-card"><span>Hạn bảo hành</span><strong>{formatDateTime(selectedRequest.warrantyExpiresAt)}</strong></article>
                      <article className="tech-warranty-meta-card"><span>Giá trị tham chiếu</span><strong>{formatCurrency(selectedRequest.price)}</strong></article>
                      <article className="tech-warranty-meta-card"><span>Cập nhật gần nhất</span><strong>{formatDateTime(selectedRequest.updatedAt)}</strong></article>
                    </div>

                    <article className="tech-warranty-meta-card">
                      <span>Mô tả lỗi</span>
                      <strong style={{ fontSize: 15, lineHeight: 1.65 }}>{selectedRequest.issueDescription || "Khách chưa mô tả chi tiết."}</strong>
                      {selectedRequest.extraNote ? (
                        <div style={{ marginTop: 10, color: "#475569", lineHeight: 1.65 }}>Ghi chú thêm: {selectedRequest.extraNote}</div>
                      ) : null}
                    </article>
                  </div>
                </section>

                <section>
                  <h3 style={{ margin: "0 0 12px", color: "#0f172a" }}>Trạng thái xử lý</h3>
                  <div className="tech-warranty-status-board">
                    {STATUS_FLOW.map((step, index) => {
                      const isDone = index < currentStepIndex || currentStatus === "COMPLETED";
                      const isCurrent = index === currentStepIndex && currentStatus !== "COMPLETED";
                      const timestamp = getTimelineTimestamp(selectedRequest, step.value);
                      const note = getTimelineNote(selectedRequest, step.value);
                      return (
                        <article
                          key={step.value}
                          className={`tech-warranty-step${isDone ? " tech-warranty-step--done" : ""}${isCurrent ? " tech-warranty-step--current" : ""}`}
                        >
                          <div className="tech-warranty-step__head">
                            <span className="tech-warranty-step__number">{isDone ? "✓" : step.step}</span>
                            <span className="tech-warranty-pill" style={{ background: "rgba(255,255,255,.86)", color: isDone ? "#047857" : isCurrent ? "#2563eb" : "#64748b" }}>
                              {isDone ? "Hoàn tất" : isCurrent ? "Đang xử lý" : "Chưa tới"}
                            </span>
                          </div>
                          <strong style={{ display: "block", marginBottom: 8 }}>{step.label}</strong>
                          <div style={{ fontSize: 13, lineHeight: 1.45 }}>{note || STATUS_META[step.value].action}</div>
                          <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800 }}>{formatDateTime(timestamp)}</div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="tech-warranty-meta-grid">
                  <article className="tech-warranty-meta-card">
                    <span>Ghi chú kỹ thuật gần nhất</span>
                    <strong style={{ lineHeight: 1.65 }}>{selectedRequest.lastStaffNote || "Chưa có ghi chú kỹ thuật."}</strong>
                  </article>
                  <article className="tech-warranty-meta-card">
                    <span>Email mock / thông báo</span>
                    <strong style={{ lineHeight: 1.65 }}>{selectedRequest.lastEmailMock || "Chưa có thông báo gửi khách."}</strong>
                  </article>
                </section>

                <section style={{ display: "grid", gap: 18 }}>
                  <div style={{ display: "grid", gap: 12 }}>
                    <div className="tech-warranty-row">
                      <h3 style={{ margin: 0, color: "#0f172a" }}>Minh chứng khách hàng gửi</h3>
                      <span className="tech-warranty-pill">{customerAttachments.length} tệp</span>
                    </div>
                    {renderAttachmentList(customerAttachments, "Khách chưa gửi ảnh, video hoặc hóa đơn cho yêu cầu này.")}
                  </div>

                  <div style={{ display: "grid", gap: 12 }}>
                    <div className="tech-warranty-row">
                      <h3 style={{ margin: 0, color: "#0f172a" }}>Ảnh/video kỹ thuật xử lý</h3>
                      <span className="tech-warranty-pill" style={{ background: "#ecfdf5", color: "#047857" }}>{staffAttachments.length} tệp</span>
                    </div>
                    {renderAttachmentList(staffAttachments, "Chưa có ảnh/video xử lý từ kỹ thuật.")}
                  </div>
                </section>
              </>
            )}
          </div>
        </main>

        <aside className="tech-warranty-panel">
          <div className="tech-warranty-panel__body">
            <div>
              <h2 className="tech-warranty-section-title">Cập nhật tiến trình</h2>
              <p className="tech-warranty-muted" style={{ margin: "6px 0 0" }}>
                Trạng thái sẽ đồng bộ về dashboard bảo hành của khách hàng.
              </p>
            </div>

            {!selectedRequest ? (
              <div className="tech-warranty-empty">Chọn yêu cầu từ danh sách để cập nhật trạng thái.</div>
            ) : (
              <form className="tech-warranty-actions" onSubmit={handleUpdateRequest}>
                <div className="tech-warranty-update-grid">
                <article className={`tech-warranty-meta-card`} style={{ borderColor: "#bfdbfe", background: "#eff6ff" }}>
                  <span>Trạng thái hiện tại</span>
                  <strong>{currentStatusMeta.label}</strong>
                  <p className="tech-warranty-muted" style={{ margin: "8px 0 0" }}>{currentStatusMeta.action}</p>
                </article>

                <label>
                  <span style={{ display: "block", marginBottom: 8, color: "#475569", fontWeight: 900 }}>Chuyển trạng thái</span>
                  <select className="tech-warranty-select" value={formState.status} onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value }))}>
                    {STATUS_OPTIONS.filter((option) => option.value).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <textarea
                  className="tech-warranty-textarea tech-warranty-update-note"
                  value={formState.technicianNote}
                  onChange={(event) => setFormState((prev) => ({ ...prev, technicianNote: event.target.value }))}
                  placeholder="Ghi chú kỹ thuật: đã kiểm tra gì, cần thay linh kiện nào, hướng xử lý hoặc lịch hẹn trả sản phẩm..."
                />

                <div className="tech-warranty-meta-card tech-warranty-update-upload">
                  <span>Ảnh/video xử lý</span>
                  <div className="tech-warranty-file-row">
                    <input type="file" accept="image/*,video/*,application/pdf" multiple onChange={(event) => handleFiles(event.target.files)} />
                  </div>
                  {formState.media.length ? (
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {formState.media.map((file) => (
                        <div key={`${file.name}-${file.size}`} style={{ color: "#475569", fontSize: 14 }}>{file.name}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="tech-warranty-muted" style={{ marginTop: 8 }}>Có thể đính kèm tối đa 5 tệp xử lý.</div>
                  )}
                </div>
                </div>

                <button className="tech-warranty-button tech-warranty-button--primary" disabled={saving}>
                  {saving ? "Đang cập nhật..." : "Lưu tiến trình bảo hành"}
                </button>
              </form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
