import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

import {
  getTechWarrantyRequests,
  updateTechWarrantyRequest
} from "../../services/warranty.service";
import { resolveProductImage } from "../../utils/productImage";
import "../../styles/admin-ai-studio.css";
import "../../styles/admin-catalog-studio.css";

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả" },
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
  REPLACEMENT: { label: "Đổi mới", tone: "success", action: "Đề xuất đổi mới hoặc thay thế sản phẩm 1:1." },
  COMPLETED: { label: "Hoàn tất", tone: "success", action: "Yêu cầu đã hoàn tất và sẵn sàng bàn giao cho khách." }
};

const SEVERITY_META = {
  LOW: { label: "Nhẹ", tone: "success" },
  MEDIUM: { label: "Trung bình", tone: "info" },
  HIGH: { label: "Nghiêm trọng", tone: "warning" },
  CRITICAL: { label: "Khẩn cấp", tone: "danger" }
};

const TECH_NOTE_PRESETS = [
  "Đã tiếp nhận sản phẩm, kiểm tra ngoại quan nguyên vẹn tem bảo hành.",
  "Đang chạy bài test tải nặng & chẩn đoán lỗi phần cứng chuyên sâu.",
  "Xác nhận lỗi nhà sản xuất, tiến hành quy trình đổi mới 1:1 cho khách.",
  "Đã hoàn tất sửa chữa & test ổn định, mời khách nhận lại sản phẩm."
];

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
  const [zoomImageUrl, setZoomImageUrl] = useState(null);
  const [formState, setFormState] = useState({
    status: "INSPECTING",
    technicianNote: "",
    media: []
  });
  const fileInputRef = useRef(null);

  const loadRequests = useCallback(
    async ({ silent = false } = {}) => {
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
      } catch (error) {
        setMessage({ type: "error", text: getErrorMessage(error, "Không thể tải danh sách yêu cầu bảo hành.") });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [keyword, statusFilter]
  );

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
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [selectedRequest?.id, selectedRequest?.status]);

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
  const currentSeverityMeta = selectedRequest ? getSeverityMeta(selectedRequest.severity) : SEVERITY_META.MEDIUM;
  const currentStepIndex = STATUS_FLOW.findIndex((step) => step.value === currentStatus);
  const customerAttachments = selectedRequest?.attachments?.filter(isCustomerAttachment) || [];
  const staffAttachments = selectedRequest?.attachments?.filter(isStaffAttachment) || [];

  function renderAttachmentList(attachments, emptyText) {
    if (!attachments.length) {
      return <div className="rma-empty">{emptyText}</div>;
    }

    return (
      <div className="rma-att-list">
        {attachments.map((attachment) => {
          const fileUrl = getAttachmentUrl(attachment);
          const isImage = String(attachment.mimeType || "").startsWith("image/");
          return (
            <article key={attachment.id || fileUrl} className="rma-att-item">
              {isImage ? (
                <img
                  className="rma-att-thumb"
                  src={fileUrl}
                  alt={getFileLabel(attachment)}
                  style={{ cursor: "zoom-in" }}
                  onClick={() => setZoomImageUrl(fileUrl)}
                />
              ) : (
                <div className="rma-att-thumb rma-att-thumb--file">FILE</div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ display: "block", fontSize: 13, color: "#0f172a", wordBreak: "break-word" }}>
                  {getFileLabel(attachment)}
                </strong>
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  {isImage ? (
                    <button type="button" className="cat-warranty-chip" onClick={() => setZoomImageUrl(fileUrl)}>
                      Phóng to
                    </button>
                  ) : null}
                  <a href={fileUrl} target="_blank" rel="noreferrer" className="cat-warranty-chip" style={{ textDecoration: "none" }}>
                    Xem tệp
                  </a>
                  <a href={fileUrl} download className="cat-warranty-chip" style={{ textDecoration: "none" }}>
                    Tải xuống
                  </a>
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
      setMessage({ type: "success", text: `Đã cập nhật tiến trình bảo hành sang: ${getStatusMeta(nextStatus).label}.` });
      setFormState((prev) => ({ ...prev, technicianNote: "", media: [] }));
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setMessage({ type: "error", text: getErrorMessage(error, "Không thể cập nhật yêu cầu bảo hành.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rma-shell">
      <style>{`
        .rma-shell { width: 100%; display: flex; flex-direction: column; gap: 20px; }
        .rma-kpi-btn { text-align: left; cursor: pointer; font-family: inherit; width: 100%; }
        .rma-workspace { display: grid; grid-template-columns: 375px minmax(0, 1fr); gap: 20px; align-items: start; }
        .rma-queue { position: sticky; top: 82px; border-radius: 18px; border: 1px solid #e2e8f0; background: #ffffff; box-shadow: 0 12px 30px -22px rgba(15, 23, 42, 0.25); overflow: hidden; display: flex; flex-direction: column; }
        .rma-queue-head { padding: 18px 18px 14px; border-bottom: 1px solid #f1f5f9; background: #fafcff; display: flex; flex-direction: column; gap: 11px; }
        .rma-queue-head h2 { margin: 0; font-size: 16px; font-weight: 800; color: #0f172a; }
        .rma-queue-head p { margin: 2px 0 0; font-size: 12px; color: #64748b; }
        .rma-pills-bar { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: thin; }
        .rma-filter-pill { padding: 5px 10px; border-radius: 999px; border: 1px solid #e2e8f0; background: #ffffff; color: #475569; font-size: 11.5px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 0.14s ease; }
        .rma-filter-pill:hover { border-color: #cbd5e1; color: #0f172a; }
        .rma-filter-pill.is-active { background: #0f172a; border-color: #0f172a; color: #ffffff; }
        .rma-queue-list { padding: 14px; display: flex; flex-direction: column; gap: 10px; max-height: calc(100vh - 300px); overflow-y: auto; }
        .rma-req-card { position: relative; width: 100%; text-align: left; padding: 13px 14px; border-radius: 13px; border: 1px solid #e2e8f0; background: #ffffff; display: flex; flex-direction: column; gap: 6px; cursor: pointer; transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease; }
        .rma-req-card:hover { border-color: #93c5fd; transform: translateY(-1px); box-shadow: 0 10px 20px -14px rgba(37, 99, 235, 0.25); }
        .rma-req-card.is-active { border-color: #2563eb; background: linear-gradient(180deg, #ffffff 0%, #f5f9ff 100%); box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.14); }
        .rma-req-card.is-active::before { content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3.5px; border-radius: 0 4px 4px 0; background: #2563eb; }
        .rma-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
        .rma-pill { display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 750; white-space: nowrap; }
        .rma-pill--info { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
        .rma-pill--warning { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
        .rma-pill--danger { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        .rma-pill--success { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
        .rma-detail-stack { min-width: 0; display: flex; flex-direction: column; gap: 16px; }
        .rma-card { border-radius: 16px; border: 1px solid #e2e8f0; background: #ffffff; padding: 20px 22px; box-shadow: 0 10px 24px -22px rgba(15, 23, 42, 0.22); display: flex; flex-direction: column; gap: 16px; min-width: 0; }
        .rma-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
        .rma-card-head h3 { margin: 0; font-size: 15.5px; font-weight: 800; color: #0f172a; }
        .rma-card-head p { margin: 3px 0 0; font-size: 12.5px; color: #64748b; }
        .rma-product-header { display: grid; grid-template-columns: 190px minmax(0, 1fr); gap: 20px; align-items: start; }
        .rma-product-img { width: 100%; height: 190px; border-radius: 16px; border: 1px solid #e2e8f0; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); display: grid; place-items: center; overflow: hidden; padding: 14px; box-sizing: border-box; }
        .rma-product-img img { width: 100%; height: 100%; object-fit: contain; }
        .rma-product-title { margin: 6px 0 0; font-size: 24px; font-weight: 850; color: #0f172a; line-height: 1.2; letter-spacing: -0.02em; }
        .rma-meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .rma-meta-tile { padding: 11px 13px; border-radius: 11px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .rma-meta-tile span { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
        .rma-meta-tile strong { font-size: 13.5px; font-weight: 700; color: #0f172a; overflow-wrap: anywhere; line-height: 1.45; }
        .rma-pipeline-card { border-radius: 18px; padding: 20px 22px; background: radial-gradient(500px 200px at 90% 0%, rgba(56, 189, 248, 0.14), transparent 65%), linear-gradient(135deg, #0b1220 0%, #16233d 60%, #1e293b 100%); border: 1px solid rgba(148, 163, 184, 0.2); color: #f8fafc; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 16px 34px -22px rgba(9, 15, 30, 0.55); }
        .rma-pipeline-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
        .rma-step { padding: 11px; border-radius: 12px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); display: flex; flex-direction: column; gap: 5px; min-width: 0; }
        .rma-step.is-done { background: rgba(16, 185, 129, 0.11); border-color: rgba(52, 211, 153, 0.36); }
        .rma-step.is-current { background: rgba(56, 189, 248, 0.16); border-color: rgba(56, 189, 248, 0.6); box-shadow: 0 8px 20px -12px rgba(56, 189, 248, 0.65); }
        .rma-step.is-pending { opacity: 0.5; }
        .rma-step-dot { width: 24px; height: 24px; border-radius: 999px; display: grid; place-items: center; font-size: 11px; font-weight: 800; background: rgba(255, 255, 255, 0.12); color: #e2e8f0; }
        .rma-step.is-done .rma-step-dot { background: #10b981; color: #ffffff; }
        .rma-step.is-current .rma-step-dot { background: #38bdf8; color: #090f1e; }
        .rma-step strong { font-size: 12px; color: #ffffff; line-height: 1.25; }
        .rma-step p { margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.38; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .rma-step small { font-size: 10px; color: #64748b; margin-top: auto; }
        .rma-two-col { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
        .rma-att-list { display: flex; flex-direction: column; gap: 9px; }
        .rma-att-item { display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; }
        .rma-att-thumb { width: 54px; height: 54px; border-radius: 10px; object-fit: cover; border: 1px solid #cbd5e1; background: #ffffff; flex-shrink: 0; }
        .rma-att-thumb--file { display: grid; place-items: center; background: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 800; }
        .rma-status-chips { display: flex; gap: 7px; flex-wrap: wrap; }
        .rma-status-chip { padding: 7px 12px; border-radius: 10px; border: 1px solid #cbd5e1; background: #ffffff; color: #334155; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.14s ease; }
        .rma-status-chip:hover { border-color: #2563eb; color: #1d4ed8; }
        .rma-status-chip.is-selected { background: linear-gradient(135deg, #2563eb, #4f46e5); border-color: transparent; color: #ffffff; box-shadow: 0 6px 14px -6px rgba(37, 99, 235, 0.55); }
        .rma-empty { padding: 26px 18px; border-radius: 12px; background: #f8fafc; border: 1px dashed #cbd5e1; text-align: center; color: #64748b; font-size: 13px; }
        .rma-alert { padding: 12px 16px; border-radius: 12px; font-size: 13px; font-weight: 700; }
        .rma-alert--error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        .rma-alert--success { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
        @media (max-width: 1280px) {
          .rma-workspace { grid-template-columns: 330px minmax(0, 1fr); }
          .rma-pipeline-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .rma-two-col { grid-template-columns: 1fr; }
        }
        @media (max-width: 960px) {
          .rma-workspace, .rma-product-header, .rma-meta-grid { grid-template-columns: 1fr; }
          .rma-queue { position: static; }
          .rma-queue-list { max-height: 400px; }
          .rma-pipeline-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>

      {/* ==================== EXECUTIVE WARRANTY & RMA HERO ==================== */}
      <section className="ai-studio-hero">
        <div className="ai-studio-hero-top">
          <div>
            <div className="ai-studio-hero-badges">
              <span className="ai-studio-live-pill">
                <span className="ai-studio-live-dot" />
                Warranty &amp; RMA Operations
              </span>
              <span className="ai-studio-tech-pill">Bảo hành điện tử Serial 1:1 • Tự động đồng bộ 20s</span>
            </div>
            <h1 className="ai-studio-hero-title">Trung Tâm Xử Lý Bảo Hành &amp; RMA</h1>
            <p className="ai-studio-hero-desc">
              Tiếp nhận hồ sơ bảo hành linh kiện, đối chiếu Serial Number chính hãng, cập nhật tiến trình kiểm tra / sửa chữa / đổi mới và đồng bộ tức thì về dashboard khách hàng.
            </p>
          </div>

          <button
            type="button"
            className="ai-studio-hero-cta"
            onClick={() => loadRequests({ silent: true })}
            disabled={refreshing}
          >
            <svg className={refreshing ? "ai-studio-spin" : ""} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            <span>{refreshing ? "Đang đồng bộ..." : "Làm Mới Hồ Sơ"}</span>
          </button>
        </div>

        <div className="ai-studio-kpi-grid">
          <button type="button" className="ai-studio-kpi rma-kpi-btn" style={{ "--kpi-accent": "#38bdf8" }} onClick={() => setStatusFilter("")}>
            <div className="ai-studio-kpi-head">
              <span className="ai-studio-kpi-label">Tổng yêu cầu</span>
              <span className="ai-studio-kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </span>
            </div>
            <div className="ai-studio-kpi-value">{stats.total}</div>
            <div className="ai-studio-kpi-hint">Tất cả hồ sơ bảo hành RMA</div>
          </button>

          <div className="ai-studio-kpi" style={{ "--kpi-accent": "#fbbf24" }}>
            <div className="ai-studio-kpi-head">
              <span className="ai-studio-kpi-label">Đang cần xử lý</span>
              <span className="ai-studio-kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </span>
            </div>
            <div className="ai-studio-kpi-value" style={{ color: stats.active > 0 ? "#fcd34d" : "#6ee7b7" }}>
              {stats.active}
            </div>
            <div className="ai-studio-kpi-hint">Tiếp nhận, kiểm tra, sửa chữa, chờ LK</div>
          </div>

          <div className="ai-studio-kpi" style={{ "--kpi-accent": "#f87171" }}>
            <div className="ai-studio-kpi-head">
              <span className="ai-studio-kpi-label">Mức khẩn cấp</span>
              <span className="ai-studio-kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </span>
            </div>
            <div className="ai-studio-kpi-value" style={{ color: stats.urgent > 0 ? "#fca5a5" : "#94a3b8" }}>
              {stats.urgent}
            </div>
            <div className="ai-studio-kpi-hint">Ưu tiên kiểm tra &amp; xử lý ngay</div>
          </div>

          <button type="button" className="ai-studio-kpi rma-kpi-btn" style={{ "--kpi-accent": "#34d399" }} onClick={() => setStatusFilter("COMPLETED")}>
            <div className="ai-studio-kpi-head">
              <span className="ai-studio-kpi-label">Đã hoàn tất</span>
              <span className="ai-studio-kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="20 6 9 17 4 12" /></svg>
              </span>
            </div>
            <div className="ai-studio-kpi-value" style={{ color: "#6ee7b7" }}>{stats.completed}</div>
            <div className="ai-studio-kpi-hint">Sẵn sàng bàn giao trả khách</div>
          </button>
        </div>
      </section>

      {message.text ? (
        <div className={`rma-alert ${message.type === "error" ? "rma-alert--error" : "rma-alert--success"}`}>
          {message.text}
        </div>
      ) : null}

      {/* ==================== MASTER-DETAIL WARRANTY WORKSPACE ==================== */}
      <div className="rma-workspace">
        {/* Left Queue */}
        <aside className="rma-queue">
          <div className="rma-queue-head">
            <div className="rma-row">
              <div>
                <h2>Danh Sách Yêu Cầu</h2>
                <p>Lọc theo trạng thái và chọn hồ sơ xử lý.</p>
              </div>
              <span className="rma-pill rma-pill--info">{requests.length} hồ sơ</span>
            </div>

            <div className="cat-search-wrap" style={{ width: "100%", minWidth: 0 }}>
              <svg className="cat-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="cat-input cat-input--search"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Tìm sản phẩm, serial, mã BH, khách hàng..."
              />
            </div>

            <div className="rma-pills-bar" role="tablist" aria-label="Lọc trạng thái bảo hành">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value || "all"}
                  type="button"
                  className={`rma-filter-pill${statusFilter === opt.value ? " is-active" : ""}`}
                  onClick={() => setStatusFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rma-queue-list">
            {loading ? (
              <div className="rma-empty">Đang tải danh sách yêu cầu bảo hành...</div>
            ) : requests.length === 0 ? (
              <div className="rma-empty">Không có yêu cầu bảo hành nào khớp bộ lọc hiện tại.</div>
            ) : (
              requests.map((request) => {
                const statusMeta = getStatusMeta(request.status);
                const severityMeta = getSeverityMeta(request.severity);
                const isActive = request.id === selectedRequestId;
                return (
                  <button
                    key={request.id}
                    type="button"
                    className={`rma-req-card${isActive ? " is-active" : ""}`}
                    onClick={() => setSelectedRequestId(request.id)}
                  >
                    <div className="rma-row">
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11.5, fontWeight: 800, color: "#0f172a", background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "2px 7px", borderRadius: 6 }}>
                        #{request.id}
                      </span>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <span className={`rma-pill rma-pill--${statusMeta.tone}`}>{statusMeta.label}</span>
                        <span className={`rma-pill rma-pill--${severityMeta.tone}`}>{severityMeta.label}</span>
                      </div>
                    </div>

                    <strong style={{ color: "#0f172a", fontSize: 14, lineHeight: 1.35 }}>
                      {getDisplayProductName(request)}
                    </strong>
                    <div style={{ color: "#475569", fontSize: 12.5, fontWeight: 600 }}>
                      Khách: {request.customerName || request.customerEmail || "Khách vãng lai"}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 11.5, wordBreak: "break-all" }}>
                      S/N: <code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: 4 }}>{request.serialNumber || "Chưa có"}</code>
                      {request.orderId ? ` · Đơn #${request.orderId}` : ""}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 11, paddingTop: 5, borderTop: "1px solid #f1f5f9" }}>
                      {formatDateTime(request.createdAt)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Detail Stack */}
        <main className="rma-detail-stack">
          {!selectedRequest ? (
            <div className="rma-card">
              <div className="rma-empty">
                <strong style={{ display: "block", color: "#0f172a", fontSize: 15, marginBottom: 4 }}>Chưa chọn hồ sơ bảo hành</strong>
                Chọn một yêu cầu ở cột bên trái để xem chi tiết sản phẩm, timeline và cập nhật tiến trình.
              </div>
            </div>
          ) : (
            <>
              {/* Product & Customer Summary */}
              <section className="rma-card">
                <div className="rma-product-header">
                  <div className="rma-product-img">
                    {hasLinkedProduct(selectedRequest) ? (
                      <img
                        src={getProductImage(selectedRequest)}
                        alt={selectedRequest.productName || "Sản phẩm bảo hành"}
                        onError={(event) => {
                          event.currentTarget.src = resolveProductImage({
                            category_name: selectedRequest.categoryName,
                            name: selectedRequest.productName
                          });
                        }}
                      />
                    ) : (
                      <div style={{ textAlign: "center", color: "#64748b" }}>
                        <strong style={{ display: "block", fontSize: 22, color: "#0f172a" }}>RMA</strong>
                        <span style={{ fontSize: 12 }}>Hồ sơ thủ công</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
                    <div className="rma-row" style={{ alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                          <span className="cat-prod-slug" style={{ marginTop: 0 }}>
                            YÊU CẦU #{selectedRequest.id}
                            {selectedRequest.warrantyCode ? ` · ${selectedRequest.warrantyCode}` : ""}
                          </span>
                          <span className={`rma-pill rma-pill--${currentSeverityMeta.tone}`}>
                            Mức độ: {currentSeverityMeta.label}
                          </span>
                        </div>
                        <h2 className="rma-product-title">{getDisplayProductName(selectedRequest)}</h2>
                        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>{currentStatusMeta.action}</p>
                      </div>
                      <span className={`rma-pill rma-pill--${currentStatusMeta.tone}`} style={{ padding: "5px 12px", fontSize: 12 }}>
                        {currentStatusMeta.label}
                      </span>
                    </div>

                    {!hasLinkedProduct(selectedRequest) && (
                      <div style={{ padding: "10px 13px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 12.5 }}>
                        Gợi ý: Nếu cần xác minh bảo hành chính hãng, hãy yêu cầu khách bổ sung Serial hoặc mã đơn hàng.
                      </div>
                    )}

                    <div className="rma-meta-grid">
                      <div className="rma-meta-tile">
                        <span>Khách hàng</span>
                        <strong>{selectedRequest.customerName || "Khách vãng lai"}</strong>
                      </div>
                      <div className="rma-meta-tile">
                        <span>Số điện thoại</span>
                        <strong>{selectedRequest.customerPhone || "Chưa có"}</strong>
                      </div>
                      <div className="rma-meta-tile">
                        <span>Email</span>
                        <strong>{selectedRequest.customerEmail || "Chưa có"}</strong>
                      </div>
                      <div className="rma-meta-tile">
                        <span>Serial / SKU</span>
                        <strong style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>
                          {selectedRequest.serialNumber || "Chưa có"}
                        </strong>
                      </div>
                      <div className="rma-meta-tile">
                        <span>Đơn hàng liên kết</span>
                        <strong>{selectedRequest.orderId ? `#${selectedRequest.orderId}` : "Chưa liên kết đơn"}</strong>
                      </div>
                      <div className="rma-meta-tile">
                        <span>Hạn bảo hành</span>
                        <strong>{formatDateTime(selectedRequest.warrantyExpiresAt)}</strong>
                      </div>
                      <div className="rma-meta-tile">
                        <span>Giá trị tham chiếu</span>
                        <strong style={{ color: "#1d4ed8" }}>{formatCurrency(selectedRequest.price)}</strong>
                      </div>
                      <div className="rma-meta-tile">
                        <span>Cập nhật gần nhất</span>
                        <strong>{formatDateTime(selectedRequest.updatedAt)}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Issue description */}
                <div style={{ padding: "14px 16px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b", marginBottom: 5 }}>
                    Mô tả lỗi từ khách hàng
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 650, color: "#0f172a", lineHeight: 1.6 }}>
                    {selectedRequest.issueDescription || "Khách chưa mô tả chi tiết."}
                  </div>
                  {selectedRequest.extraNote && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e2e8f0", fontSize: 13, color: "#475569" }}>
                      <strong>Ghi chú bổ sung:</strong> {selectedRequest.extraNote}
                    </div>
                  )}
                </div>
              </section>

              {/* Obsidian 6-Step RMA Pipeline */}
              <section className="rma-pipeline-card">
                <div className="rma-row">
                  <div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#7dd3fc" }}>
                      RMA Lifecycle Tracker
                    </span>
                    <h3 style={{ margin: "3px 0 0", fontSize: 16, fontWeight: 800, color: "#ffffff" }}>
                      Tiến Trình Xử Lý Bảo Hành (6 Chặng)
                    </h3>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1" }}>
                    Bước {Math.max(1, currentStepIndex + 1)} / {STATUS_FLOW.length}
                  </span>
                </div>

                <div className="rma-pipeline-grid">
                  {STATUS_FLOW.map((step, index) => {
                    const isDone = index < currentStepIndex || currentStatus === "COMPLETED";
                    const isCurrent = index === currentStepIndex && currentStatus !== "COMPLETED";
                    const timestamp = getTimelineTimestamp(selectedRequest, step.value);
                    const note = getTimelineNote(selectedRequest, step.value);
                    const cls = isCurrent ? "is-current" : isDone ? "is-done" : "is-pending";

                    return (
                      <article key={step.value} className={`rma-step ${cls}`}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span className="rma-step-dot">{isDone ? "✓" : step.step}</span>
                          <strong>{step.label}</strong>
                        </div>
                        <p title={note || STATUS_META[step.value].action}>{note || STATUS_META[step.value].action}</p>
                        <small>{timestamp ? formatDateTime(timestamp) : "Chưa có mốc"}</small>
                      </article>
                    );
                  })}
                </div>
              </section>

              {/* Executive Progress Update Form */}
              <section className="rma-card">
                <div className="rma-card-head">
                  <div>
                    <h3>Cập Nhật Tiến Trình &amp; Đồng Bộ Khách Hàng</h3>
                    <p>Chọn chặng xử lý tiếp theo, ghi chú kết quả kiểm tra và đính kèm ảnh/video minh chứng kỹ thuật.</p>
                  </div>
                  <span className={`rma-pill rma-pill--${currentStatusMeta.tone}`}>
                    Hiện tại: {currentStatusMeta.label}
                  </span>
                </div>

                <form onSubmit={handleUpdateRequest} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
                      Chọn trạng thái cập nhật (1-chạm):
                    </label>
                    <div className="rma-status-chips">
                      {STATUS_FLOW.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`rma-status-chip${formState.status === opt.value ? " is-selected" : ""}`}
                          onClick={() => setFormState((prev) => ({ ...prev, status: opt.value }))}
                        >
                          {opt.step}. {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                      Ghi chú kỹ thuật gửi khách hàng:
                    </label>
                    <div className="cat-warranty-presets" style={{ marginTop: 0, marginBottom: 8 }}>
                      {TECH_NOTE_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className="cat-warranty-chip"
                          onClick={() => setFormState((prev) => ({ ...prev, technicianNote: preset }))}
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                    <textarea
                      className="cat-input"
                      style={{ minHeight: 105, resize: "vertical", fontFamily: "inherit" }}
                      value={formState.technicianNote}
                      onChange={(event) => setFormState((prev) => ({ ...prev, technicianNote: event.target.value }))}
                      placeholder="Nhập chi tiết kiểm tra, linh kiện thay thế hoặc lịch hẹn trả sản phẩm..."
                    />
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: 12, background: "#f8fafc", border: "1px dashed #cbd5e1", display: "flex", flexDirection: "column", gap: 9 }}>
                    <div className="rma-row">
                      <div>
                        <strong style={{ fontSize: 13, color: "#0f172a" }}>Ảnh / Video minh chứng kỹ thuật</strong>
                        <div style={{ fontSize: 11.5, color: "#64748b" }}>Hỗ trợ ảnh, video hoặc biên bản PDF (tối đa 5 tệp).</div>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*,application/pdf"
                        multiple
                        style={{ display: "none" }}
                        onChange={(event) => handleFiles(event.target.files)}
                      />
                      <button
                        type="button"
                        className="ai-action-btn ai-action-btn--ghost"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Chọn tệp đính kèm {formState.media.length > 0 ? `(${formState.media.length})` : ""}
                      </button>
                    </div>

                    {formState.media.length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {formState.media.map((file) => (
                          <span key={`${file.name}-${file.size}`} className="rma-pill rma-pill--info">
                            {file.name}
                          </span>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setFormState((prev) => ({ ...prev, media: [] }));
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          style={{ border: "none", background: "transparent", color: "#dc2626", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        >
                          ✕ Xóa tệp
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="submit"
                      className="cat-btn-dark"
                      style={{ background: "linear-gradient(135deg, #2563eb, #4f46e5)", padding: "11px 22px" }}
                      disabled={saving}
                    >
                      {saving ? "Đang lưu tiến trình..." : "Lưu Tiến Trình Bảo Hành"}
                    </button>
                  </div>
                </form>
              </section>

              {/* Notes & Notifications */}
              <div className="rma-two-col">
                <section className="rma-card">
                  <div className="rma-card-head">
                    <div>
                      <h3>Ghi Chú Kỹ Thuật Gần Nhất</h3>
                      <p>Nhật ký chẩn đoán đã lưu trên hồ sơ.</p>
                    </div>
                  </div>
                  <div className="rma-meta-tile">
                    <strong>{selectedRequest.lastStaffNote || "Chưa có ghi chú kỹ thuật."}</strong>
                  </div>
                </section>

                <section className="rma-card">
                  <div className="rma-card-head">
                    <div>
                      <h3>Thông Báo / Email Gửi Khách</h3>
                      <p>Nội dung đồng bộ gần nhất tới tài khoản khách hàng.</p>
                    </div>
                  </div>
                  <div className="rma-meta-tile">
                    <strong>{selectedRequest.lastEmailMock || "Chưa có thông báo gửi khách."}</strong>
                  </div>
                </section>
              </div>

              {/* Customer & Tech Attachments Side-by-Side */}
              <div className="rma-two-col">
                <section className="rma-card">
                  <div className="rma-card-head">
                    <div>
                      <h3>Minh Chứng Khách Hàng Gửi</h3>
                      <p>Ảnh lỗi, video hoặc hóa đơn từ người mua.</p>
                    </div>
                    <span className="rma-pill rma-pill--info">{customerAttachments.length} tệp</span>
                  </div>
                  {renderAttachmentList(customerAttachments, "Khách chưa gửi ảnh, video hoặc hóa đơn cho yêu cầu này.")}
                </section>

                <section className="rma-card">
                  <div className="rma-card-head">
                    <div>
                      <h3>Ảnh / Video Kỹ Thuật Xử Lý</h3>
                      <p>Bằng chứng nghiệm thu và tình trạng thiết bị sau xử lý.</p>
                    </div>
                    <span className="rma-pill rma-pill--success">{staffAttachments.length} tệp</span>
                  </div>
                  {renderAttachmentList(staffAttachments, "Chưa có ảnh/video xử lý từ đội ngũ kỹ thuật.")}
                </section>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Fullscreen Image Lightbox */}
      {zoomImageUrl && (
        <div
          className="ai-modal-backdrop"
          style={{ zIndex: 10000, cursor: "zoom-out" }}
          onClick={() => setZoomImageUrl(null)}
        >
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoomImageUrl(null)}
              style={{
                position: "absolute",
                top: -14,
                right: -14,
                background: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: 34,
                height: 34,
                fontSize: 18,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(0,0,0,0.4)"
              }}
              title="Đóng"
            >
              ✕
            </button>
            <img
              src={zoomImageUrl}
              alt="Minh chứng bảo hành"
              style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 16, objectFit: "contain", background: "#fff" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
