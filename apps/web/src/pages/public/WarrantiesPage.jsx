import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";

import { useAuth } from "../../hooks/useAuth";
import { resolveProductImage } from "../../utils/productImage";
import {
  getMyWarranties,
  getMyWarrantyNotifications,
  getMyWarrantyRequests,
  lookupWarranty,
  submitWarrantyRequest
} from "../../services/warranty.service";

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/api\/?$/, "");

const WARRANTY_META = {
  ACTIVE: { label: "Còn bảo hành", tone: "#047857", bg: "#ecfdf5", border: "#bbf7d0" },
  EXPIRED: { label: "Hết hạn", tone: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
  RECEIVED: { label: "Đã tiếp nhận", tone: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  INSPECTING: { label: "Đang kiểm tra", tone: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  REPAIRING: { label: "Đang sửa", tone: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  WAITING_PARTS: { label: "Chờ linh kiện", tone: "#c2410c", bg: "#fff7ed", border: "#fdba74" },
  REPLACEMENT: { label: "Đổi mới", tone: "#0f766e", bg: "#ecfeff", border: "#99f6e4" },
  COMPLETED: { label: "Hoàn tất", tone: "#047857", bg: "#ecfdf5", border: "#bbf7d0" }
};

const TIMELINE_STEP_LABELS = {
  RECEIVED: "Đã tiếp nhận",
  INSPECTING: "Đang kiểm tra",
  REPAIRING: "Đang sửa",
  WAITING_PARTS: "Chờ linh kiện",
  REPLACEMENT: "Đổi mới",
  COMPLETED: "Hoàn tất"
};

function getErrorMessage(error, fallbackMessage) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallbackMessage;
  }
  return error?.message || fallbackMessage;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("vi-VN") : "—";
}

function isWarrantyExpired(warranty) {
  const status = String(warranty?.status || "").toUpperCase();
  const expiresAt = warranty?.endDate || warranty?.expiresAt ? new Date(warranty.endDate || warranty.expiresAt) : null;
  return status === "EXPIRED" || (expiresAt && expiresAt.getTime() < Date.now());
}

function hasOpenWarrantyRequest(warranty) {
  const requestStatus = String(warranty?.latestRequest?.status || warranty?.request?.status || "").toUpperCase();
  return Boolean(requestStatus && requestStatus !== "COMPLETED");
}

function getAttachmentSource(attachment) {
  return String(attachment?.source || "CUSTOMER").toUpperCase();
}

function isStaffAttachment(attachment) {
  return ["STAFF", "TECH", "TECHNICIAN"].includes(getAttachmentSource(attachment));
}

function AttachmentGroup({ title, attachments = [] }) {
  if (!attachments.length) return null;
  return (
    <section className="warranty-attachment-group">
      <div className="warranty-attachment-group__head">
        <strong>{title}</strong>
        <span>{attachments.length} tệp</span>
      </div>
      <div className="warranty-attachments">
        {attachments.map((attachment) => (
          <article key={attachment.id}>
            <AttachmentPreview
              file={{
                name: attachment.fileUrl.split("/").pop(),
                type: attachment.mimeType,
                previewUrl: attachment.fileUrl
              }}
            />
          </article>
        ))}
      </div>
    </section>
  );
}

function getStatusMeta(status) {
  return WARRANTY_META[String(status || "ACTIVE").toUpperCase()] || WARRANTY_META.ACTIVE;
}

function StatusBadge({ status }) {
  const meta = getStatusMeta(status);
  return (
    <span
      style={{
        display: "inline-flex",
        padding: "7px 12px",
        borderRadius: 999,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        color: meta.tone,
        fontSize: 12,
        fontWeight: 900
      }}
    >
      {meta.label}
    </span>
  );
}

function Timeline({ timeline = [] }) {
  return (
    <div className="warranty-timeline">
      {timeline.map((step) => (
        <article key={`${step.key}-${step.timestamp || "pending"}`} className={`warranty-step${step.done ? " warranty-step--done" : ""}`}>
          <div className="warranty-step__dot" />
          <div>
            <strong>{TIMELINE_STEP_LABELS[String(step.key || "").toUpperCase()] || step.label || "Đang chờ xử lý"}</strong>
            <small>{step.timestamp ? new Date(step.timestamp).toLocaleString("vi-VN") : "Đang chờ xử lý"}</small>
            {step.note ? <p>{step.note}</p> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function AttachmentPreview({ file }) {
  const isVideo = String(file.type || "").startsWith("video/");
  const isImage = String(file.type || "").startsWith("image/");
  const rawPreviewUrl = file.previewUrl || "";
  const previewUrl = rawPreviewUrl && !rawPreviewUrl.startsWith("blob:") && !rawPreviewUrl.startsWith("http://") && !rawPreviewUrl.startsWith("https://")
    ? `${API_ORIGIN}${rawPreviewUrl.startsWith("/") ? rawPreviewUrl : `/${rawPreviewUrl}`}`
    : rawPreviewUrl || null;

  if (isImage && previewUrl) {
    return <img src={previewUrl} alt={file.name} />;
  }

  if (isVideo && previewUrl) {
    return <video src={previewUrl} controls muted />;
  }

  return (
    <div className="warranty-attachment__file">
      <strong>{file.name}</strong>
      <span>{file.type || "Tệp đính kèm"}</span>
    </div>
  );
}

function ProductCard({ warranty, onRequest, onTrack, isSelected = false }) {
  const currentStatus = warranty.latestRequest?.status || warranty.status;
  const isExpired = isWarrantyExpired(warranty);
  const hasOpenRequest = hasOpenWarrantyRequest(warranty);
  const canRequest = !isExpired && !hasOpenRequest;
  const requestLabel = isExpired ? "Hết hạn bảo hành" : hasOpenRequest ? "Đang xử lý yêu cầu" : "Yêu cầu bảo hành";
  return (
    <article className={`warranty-product-card${isSelected ? " warranty-product-card--selected" : ""}`}>
      <div className="warranty-product-card__media">
        <img
          src={resolveProductImage({
            image_url: warranty.imageUrl,
            category_name: warranty.categoryName,
            name: warranty.item?.productName
          })}
          alt={warranty.item?.productName || "Sản phẩm"}
        />
      </div>

      <div className="warranty-product-card__body">
        <div className="warranty-product-card__heading">
          <div>
            <h3>{warranty.item?.productName || "Sản phẩm"}</h3>
            <p>
              Serial: <strong>{warranty.serialNumber || warranty.item?.sku || "—"}</strong>
            </p>
          </div>
          <StatusBadge status={currentStatus} />
        </div>

        <div className="warranty-product-card__meta">
          <div>
            <span>Thời gian còn lại</span>
            <strong>{warranty.remainingDays ?? 0} ngày</strong>
          </div>
          <div>
              <span>Ngày hết hạn</span>
            <strong>{formatDate(warranty.endDate || warranty.expiresAt)}</strong>
          </div>
          <div>
              <span>Đơn hàng</span>
            <strong>{warranty.orderNumber || `#${warranty.orderId || "—"}`}</strong>
          </div>
          <div>
              <span>Mã bảo hành</span>
            <strong>{warranty.warrantyCode}</strong>
          </div>
        </div>

        <div className="warranty-product-card__actions">
          {hasOpenRequest ? (
            <button type="button" className={`warranty-btn${isSelected ? " warranty-btn--active" : ""}`} onClick={() => onTrack(warranty)}>
              {isSelected ? "Đang xem tiến trình" : "Xem tiến trình xử lý"}
            </button>
          ) : (
            <button type="button" className="warranty-btn" onClick={() => onRequest(warranty)} disabled={!canRequest}>
              {requestLabel}
            </button>
          )}
          {!hasOpenRequest ? (
            <button type="button" className={`warranty-btn warranty-btn--light${isSelected ? " warranty-btn--active-light" : ""}`} onClick={() => onTrack(warranty)}>
              {isSelected ? "Đang theo dõi" : "Theo dõi tiến trình"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function createInitialForm(user = null, lookupValue = "") {
  return {
    warrantyId: "",
    lookupValue,
    customerName: user?.fullName || "",
    customerPhone: user?.phone || "",
    customerEmail: user?.email || "",
    productName: "",
    serialNumber: "",
    orderId: "",
    severity: "MEDIUM",
    issueDescription: "",
    extraNote: "",
    media: [],
    website: "",
    startedAt: Date.now()
  };
}

export function WarrantiesPage() {
  const { authState, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const [warranties, setWarranties] = useState([]);
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lookupCode, setLookupCode] = useState(searchParams.get("lookup") || "");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [selectedWarranty, setSelectedWarranty] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [requestForm, setRequestForm] = useState(createInitialForm(authState?.user, searchParams.get("lookup") || ""));
  const lastNotificationIdRef = useRef(null);

  useEffect(() => {
    return () => {
      requestForm.media.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, [requestForm.media]);

  async function loadDashboard(showSpinner = true) {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      if (showSpinner) setLoading(true);
      const [warrantyResp, requestResp, notificationResp] = await Promise.all([
        getMyWarranties(),
        getMyWarrantyRequests(),
        getMyWarrantyNotifications()
      ]);

      const nextWarranties = warrantyResp?.data || [];
      const nextRequests = requestResp?.data || [];
      const nextNotifications = notificationResp?.data || [];
      setWarranties(nextWarranties);
      setRequests(nextRequests);
      setNotifications(nextNotifications);

      if (nextNotifications[0]?.id && lastNotificationIdRef.current && nextNotifications[0].id !== lastNotificationIdRef.current) {
        setMessage({ type: "info", text: nextNotifications[0].message || nextNotifications[0].title });
      }
      lastNotificationIdRef.current = nextNotifications[0]?.id || lastNotificationIdRef.current;
    } catch {
      setMessage({ type: "error", text: "Không thể tải dữ liệu bảo hành tài khoản." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const interval = setInterval(() => {
      loadDashboard(false);
    }, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    if (authState?.user) {
      setRequestForm((prev) => ({
        ...prev,
        customerName: prev.customerName || authState.user.fullName || "",
        customerPhone: prev.customerPhone || authState.user.phone || "",
        customerEmail: prev.customerEmail || authState.user.email || ""
      }));
    }
  }, [authState?.user]);

  const stats = useMemo(() => {
    const active = warranties.filter((item) => String(item.status).toUpperCase() === "ACTIVE").length;
    const expiring = warranties.filter((item) => (item.remainingDays ?? 9999) <= 30).length;
    const inProgress = requests.filter((item) => !["COMPLETED"].includes(String(item.status).toUpperCase())).length;

    return {
      total: warranties.length,
      active,
      expiring,
      requests: requests.length,
      inProgress
    };
  }, [requests, warranties]);

  function revokeMedia(list) {
    list.forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
  }

  function resetRequestForm(nextLookupValue = "") {
    setRequestForm((prev) => {
      revokeMedia(prev.media);
      return createInitialForm(authState?.user, nextLookupValue);
    });
  }

  function handleOpenRequest(warranty) {
    if (isWarrantyExpired(warranty)) {
      setMessage({ type: "error", text: "Sản phẩm đã hết hạn hoặc không còn hiệu lực bảo hành." });
      return;
    }

    if (hasOpenWarrantyRequest(warranty)) {
      setSelectedWarranty(warranty);
      setMessage({ type: "info", text: "Sản phẩm này đã có yêu cầu bảo hành đang được xử lý. Vui lòng theo dõi tiến trình hiện tại." });
      return;
    }

    setSelectedWarranty(warranty);
    setRequestForm((prev) => ({
      ...createInitialForm(authState?.user, warranty.warrantyCode),
      warrantyId: warranty.id,
      lookupValue: warranty.warrantyCode,
      customerName: authState?.user?.fullName || prev.customerName,
      customerPhone: authState?.user?.phone || prev.customerPhone,
      customerEmail: authState?.user?.email || prev.customerEmail,
      productName: warranty.item?.productName || "",
      serialNumber: warranty.serialNumber || warranty.item?.sku || "",
      orderId: warranty.orderId || "",
      severity: "MEDIUM",
      issueDescription: "",
      extraNote: "",
      media: [],
      website: "",
      startedAt: Date.now()
    }));
  }

  function handleUseLookupResult() {
    if (!lookupResult?.id) return;
    handleOpenRequest(lookupResult);
  }

  function handleFiles(files) {
    const nextFiles = Array.from(files || [])
      .slice(0, 5)
      .map((file) => ({
        file,
        name: file.name,
        type: file.type,
        previewUrl: file.type.startsWith("image/") || file.type.startsWith("video/") ? URL.createObjectURL(file) : null
      }));

    setRequestForm((prev) => {
      revokeMedia(prev.media);
      return { ...prev, media: nextFiles };
    });
  }

  async function runLookupQuery(codeToLookup) {
    const cleanCode = String(codeToLookup || "").trim();
    if (!cleanCode) return;

    try {
      setLookupLoading(true);
      setLookupError("");
      setLookupResult(null);
      const response = await lookupWarranty(cleanCode);
      setLookupResult(response.data);
    } catch (error) {
      setLookupError(getErrorMessage(error, "Không tìm thấy thông tin bảo hành. Vui lòng kiểm tra mã đơn hàng, serial hoặc số điện thoại."));
    } finally {
      setLookupLoading(false);
    }
  }

  useEffect(() => {
    const queryLookup = searchParams.get("lookup");
    if (queryLookup && queryLookup.trim()) {
      setLookupCode(queryLookup.trim());
      runLookupQuery(queryLookup.trim());
    }
  }, [searchParams]);

  async function handleLookup(event) {
    event.preventDefault();
    await runLookupQuery(lookupCode);
  }

  async function handleSubmitRequest(event) {
    event.preventDefault();
    try {
      setSubmitting(true);
      setMessage({ type: "", text: "" });
      await submitWarrantyRequest({
        ...requestForm,
        media: requestForm.media.map((item) => item.file)
      });
      setMessage({ type: "success", text: "Đã gửi yêu cầu bảo hành. Bộ phận kỹ thuật sẽ tiếp nhận và cập nhật tiến trình xử lý." });
      setSelectedWarranty(null);
      resetRequestForm(requestForm.lookupValue);
      if (isAuthenticated) {
        await loadDashboard(false);
      }
    } catch (error) {
      setMessage({ type: "error", text: getErrorMessage(error, "Không thể gửi yêu cầu bảo hành.") });
    } finally {
      setSubmitting(false);
    }
  }

  const selectedRequest = selectedWarranty ? requests.find((item) => item.warrantyId === selectedWarranty.id) || null : null;
  const activeTimeline = selectedRequest?.timeline || selectedWarranty?.request?.timeline || selectedWarranty?.timeline || [];
  const hasRequestContext = Boolean(requestForm.warrantyId);
  const selectedHasOpenRequest = Boolean(selectedWarranty && hasOpenWarrantyRequest(selectedWarranty));

  return (
    <div className="warranty-page">
      <style>{`
        .warranty-page { min-height: 100vh; background: linear-gradient(180deg, #f8fbff 0%, #f8fafc 48%, #ffffff 100%); padding: 30px 20px 80px; }
        .warranty-shell { max-width: 1440px; margin: 0 auto; display: grid; gap: 24px; }
        .warranty-hero { padding: 30px 32px; border-radius: 30px; background: linear-gradient(135deg, #0f172a, #1e3a8a); color: #fff; display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 24px; align-items: stretch; }
        .warranty-hero__actions { display: grid; gap: 12px; align-content: end; }
        .warranty-grid { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 24px; align-items: start; }
        .warranty-card { background: rgba(255,255,255,0.92); border: 1px solid #e2e8f0; border-radius: 24px; box-shadow: 0 18px 48px rgba(15,23,42,0.06); }
        .warranty-card__body { padding: 24px; }
        .warranty-stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
        .warranty-stat { padding: 18px; border-radius: 20px; background: #fff; border: 1px solid #e2e8f0; }
        .warranty-input, .warranty-select { width: 100%; min-height: 48px; border-radius: 14px; border: 1px solid #dbe4ef; background: #f8fafc; padding: 0 14px; box-sizing: border-box; outline: none; font-weight: 650; }
        .warranty-textarea { width: 100%; min-height: 118px; border-radius: 14px; border: 1px solid #dbe4ef; background: #f8fafc; padding: 14px; box-sizing: border-box; outline: none; resize: vertical; font-weight: 650; font-family: inherit; }
        .warranty-btn { min-height: 46px; border-radius: 14px; border: none; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; font-weight: 900; cursor: pointer; padding: 0 16px; }
        .warranty-btn:disabled { cursor: not-allowed; opacity: .62; box-shadow: none; }
        .warranty-btn--active { background: linear-gradient(135deg, #047857, #0f766e); box-shadow: 0 0 0 3px rgba(16, 185, 129, .18); }
        .warranty-btn--light { background: #fff; color: #0f172a; border: 1px solid #dbe4ef; }
        .warranty-btn--active-light { border-color: #2563eb; color: #1d4ed8; background: #eff6ff; box-shadow: 0 0 0 3px rgba(37, 99, 235, .10); }
        .warranty-product-list { display: grid; gap: 16px; }
        .warranty-product-card { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 18px; padding: 18px; border: 1px solid #e2e8f0; border-radius: 22px; background: #fff; }
        .warranty-product-card--selected { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, .12), 0 18px 40px rgba(37, 99, 235, .10); }
        .warranty-product-card__media { min-height: 170px; border-radius: 20px; overflow: hidden; display: grid; place-items: center; background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); }
        .warranty-product-card__media img { width: 100%; height: 170px; object-fit: contain; padding: 16px; }
        .warranty-product-card__body { display: grid; gap: 14px; }
        .warranty-product-card__heading { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
        .warranty-product-card__heading h3 { margin: 0; font-size: 20px; color: #0f172a; }
        .warranty-product-card__heading p { margin: 8px 0 0; color: #64748b; }
        .warranty-product-card__meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .warranty-product-card__meta div, .warranty-request-summary, .warranty-notification { padding: 14px; border-radius: 16px; background: #f8fafc; }
        .warranty-product-card__meta span, .warranty-request-summary span { display: block; color: #64748b; font-size: 12px; font-weight: 800; }
        .warranty-product-card__meta strong, .warranty-request-summary strong { display: block; margin-top: 6px; color: #0f172a; font-size: 14px; }
        .warranty-product-card__actions { display: flex; flex-wrap: wrap; gap: 10px; }
        .warranty-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .warranty-form-grid--full { grid-column: 1 / -1; }
        .warranty-timeline { display: grid; gap: 12px; }
        .warranty-step { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 12px; align-items: start; color: #94a3b8; }
        .warranty-step__dot { width: 14px; height: 14px; margin-top: 3px; border-radius: 999px; background: #dbe4ef; box-shadow: 0 0 0 5px #f8fafc; }
        .warranty-step--done { color: #0f172a; }
        .warranty-step--done .warranty-step__dot { background: linear-gradient(135deg, #22c55e, #14b8a6); }
        .warranty-step strong { display: block; }
        .warranty-step small { display: block; margin-top: 4px; color: #64748b; }
        .warranty-step p { margin: 6px 0 0; color: #475569; line-height: 1.55; }
        .warranty-attachments { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .warranty-attachments article { overflow: hidden; border: 1px solid #e2e8f0; border-radius: 16px; background: #fff; }
        .warranty-attachments img, .warranty-attachments video { width: 100%; height: 120px; object-fit: cover; }
        .warranty-attachment-group { display: grid; gap: 12px; }
        .warranty-attachment-group__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .warranty-attachment-group__head strong { color: #0f172a; font-size: 18px; }
        .warranty-attachment-group__head span { padding: 6px 10px; border-radius: 999px; background: #eff6ff; color: #1d4ed8; font-size: 12px; font-weight: 900; }
        .warranty-attachment__file { display: grid; gap: 6px; min-height: 120px; align-content: center; justify-items: center; padding: 14px; text-align: center; color: #475569; background: #f8fafc; }
        .warranty-notification-list { display: grid; gap: 12px; }
        .warranty-notification strong { display: block; color: #0f172a; }
        .warranty-notification p { margin: 6px 0 0; color: #475569; line-height: 1.55; }
        .warranty-quick-lookup { display: grid; gap: 12px; }
        .warranty-request-context { display: grid; gap: 10px; padding: 14px; border-radius: 16px; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e3a8a; line-height: 1.55; }
        .warranty-request-context strong { color: #172554; overflow-wrap: anywhere; }
        .warranty-request-context__meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .warranty-request-context__meta div { padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,.72); color: #475569; font-size: 12px; font-weight: 800; }
        .warranty-request-context__meta span { display: block; margin-top: 4px; color: #0f172a; font-size: 13px; overflow-wrap: anywhere; }
        .warranty-request-empty { display: grid; gap: 12px; padding: 16px; border-radius: 18px; background: #f8fafc; border: 1px dashed #cbd5e1; color: #475569; line-height: 1.6; }
        .warranty-request-empty__title { color: #0f172a; font-size: 16px; font-weight: 900; }
        .warranty-request-empty ol { margin: 0; padding-left: 20px; }
        .warranty-request-empty li + li { margin-top: 6px; }
        .warranty-request-form--empty > div:first-child { display: none; }
        .warranty-file-input { width: 100%; box-sizing: border-box; padding: 12px; border-radius: 14px; border: 1px dashed #cbd5e1; background: #f8fafc; color: #475569; font-weight: 800; }
        .warranty-hidden-field { display: none !important; }
        @media (max-width: 1180px) {
          .warranty-hero, .warranty-grid { grid-template-columns: 1fr; }
          .warranty-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (max-width: 860px) {
          .warranty-product-card, .warranty-product-card__meta, .warranty-form-grid, .warranty-attachments, .warranty-stats { grid-template-columns: 1fr; }
          .warranty-request-context__meta { grid-template-columns: 1fr; }
        }
        @media (max-width: 620px) {
          .warranty-page { padding: 16px 12px 60px; }
          .warranty-hero, .warranty-card__body { padding: 20px; }
        }
      `}</style>

      <div className="warranty-shell">
        <section className="warranty-hero">
          <div>
            <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.12em", color: "#93c5fd", fontWeight: 900 }}>PC Mall Warranty Center</div>
            <h1 style={{ margin: "10px 0 10px", fontSize: 42, lineHeight: 1.04 }}>Dashboard bảo hành điện tử theo workflow bán lẻ công nghệ</h1>
            <p style={{ margin: 0, color: "#cbd5e1", maxWidth: 820, lineHeight: 1.75 }}>
              Tự động lấy sản phẩm còn bảo hành sau khi đơn hàng giao thành công, tra cứu nhanh bằng mã đơn, serial hoặc số điện thoại, gửi yêu cầu với ảnh/video minh chứng và theo dõi toàn bộ tiến trình xử lý.
            </p>
          </div>
          <div className="warranty-hero__actions">
            {!isAuthenticated ? (
              <Link to="/login" className="warranty-btn" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                Đăng nhập để quản lý tập trung
              </Link>
            ) : null}
          </div>
        </section>

        {isAuthenticated ? (
          <section className="warranty-stats">
            <div className="warranty-stat"><div style={{ color: "#64748b", fontWeight: 800 }}>Tổng bảo hành</div><strong style={{ fontSize: 30 }}>{stats.total}</strong></div>
            <div className="warranty-stat"><div style={{ color: "#64748b", fontWeight: 800 }}>Còn hiệu lực</div><strong style={{ fontSize: 30, color: "#047857" }}>{stats.active}</strong></div>
            <div className="warranty-stat"><div style={{ color: "#64748b", fontWeight: 800 }}>Sắp hết hạn</div><strong style={{ fontSize: 30, color: "#b45309" }}>{stats.expiring}</strong></div>
            <div className="warranty-stat"><div style={{ color: "#64748b", fontWeight: 800 }}>Yêu cầu đã gửi</div><strong style={{ fontSize: 30, color: "#1d4ed8" }}>{stats.requests}</strong></div>
            <div className="warranty-stat"><div style={{ color: "#64748b", fontWeight: 800 }}>Đang xử lý</div><strong style={{ fontSize: 30, color: "#7c3aed" }}>{stats.inProgress}</strong></div>
          </section>
        ) : null}

        {message.text ? (
          <div
            style={{
              padding: 16,
              borderRadius: 18,
              background: message.type === "success" ? "#ecfdf5" : message.type === "error" ? "#fef2f2" : "#eff6ff",
              border: `1px solid ${message.type === "success" ? "#bbf7d0" : message.type === "error" ? "#fecaca" : "#bfdbfe"}`,
              color: message.type === "success" ? "#047857" : message.type === "error" ? "#b91c1c" : "#1d4ed8",
              fontWeight: 800
            }}
          >
            {message.text}
          </div>
        ) : null}

        <div className="warranty-grid">
          <main style={{ display: "grid", gap: 24 }}>
            <section className="warranty-card">
              <div className="warranty-card__body">
                <h2 style={{ margin: "0 0 18px", fontSize: 26 }}>Sản phẩm còn bảo hành</h2>
                {loading ? (
                  <div style={{ color: "#64748b" }}>Đang tải dữ liệu bảo hành...</div>
                ) : isAuthenticated ? (
                  warranties.length > 0 ? (
                    <div className="warranty-product-list">
                      {warranties.map((warranty) => (
                        <ProductCard key={warranty.id} warranty={warranty} onRequest={handleOpenRequest} onTrack={setSelectedWarranty} isSelected={selectedWarranty?.id === warranty.id} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: 34, textAlign: "center", background: "#f8fafc", borderRadius: 18, color: "#64748b" }}>
                      Chưa có sản phẩm bảo hành khả dụng. Khi đơn hàng chuyển sang trạng thái đã giao, hệ thống sẽ tự kích hoạt bảo hành điện tử ngay lập tức.
                    </div>
                  )
                ) : (
                  <div style={{ padding: 20, color: "#64748b", lineHeight: 1.7 }}>
                    Khách vãng lai vẫn có thể tra cứu nhanh ở cột bên phải bằng mã đơn hàng, serial hoặc số điện thoại.
                  </div>
                )}
              </div>
            </section>

            {(selectedWarranty || selectedRequest) ? (
              <section className="warranty-card">
                <div className="warranty-card__body">
                  <h2 style={{ margin: "0 0 18px", fontSize: 26 }}>Theo dõi tiến trình</h2>
                  {selectedWarranty ? (
                    <div className="warranty-request-summary" style={{ marginBottom: 16 }}>
                      <span>Sản phẩm đang theo dõi</span>
                      <strong>{selectedWarranty.item?.productName}</strong>
                      <div style={{ marginTop: 6, color: "#475569" }}>
                        Mã bảo hành: {selectedWarranty.warrantyCode} · Serial: {selectedWarranty.serialNumber || selectedWarranty.item?.sku || "—"}
                      </div>
                    </div>
                  ) : null}
                  <Timeline timeline={activeTimeline} />

                  {selectedRequest ? (
                    <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
                      <div className="warranty-request-summary">
                        <span>Yêu cầu hiện tại</span>
                        <strong>{selectedRequest.statusLabel}</strong>
                        <div style={{ marginTop: 6, color: "#475569" }}>{selectedRequest.issueDescription}</div>
                      </div>
                      <AttachmentGroup
                      title="Minh chứng khách hàng gửi"
                        attachments={(selectedRequest.attachments || []).filter((attachment) => !isStaffAttachment(attachment))}
                      />
                      <AttachmentGroup
                      title="Ảnh/video kỹ thuật xử lý"
                        attachments={(selectedRequest.attachments || []).filter(isStaffAttachment)}
                      />
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}
          </main>

          <aside style={{ display: "grid", gap: 24 }}>
            <section className="warranty-card">
              <div className="warranty-card__body">
                <h2 style={{ margin: "0 0 14px", fontSize: 24 }}>Tra cứu nhanh</h2>
                <form className="warranty-quick-lookup" onSubmit={handleLookup}>
                  <input
                    className="warranty-input"
                    value={lookupCode}
                    onChange={(event) => setLookupCode(event.target.value)}
                    placeholder="Mã đơn, serial, số điện thoại, mã bảo hành..."
                  />
                  <button className="warranty-btn" disabled={lookupLoading}>
                    {lookupLoading ? "Đang tra cứu..." : "Kiểm tra bảo hành"}
                  </button>
                </form>

                {lookupResult ? (
                  <div style={{ marginTop: 18, display: "grid", gap: 12, padding: 16, borderRadius: 18, background: "#f8fbff", border: "1px solid #dbeafe" }}>
                    <strong style={{ fontSize: 18, color: "#0f172a" }}>{lookupResult.productName || lookupResult.item?.productName}</strong>
                    <StatusBadge status={lookupResult.status} />
                    <div style={{ color: "#475569" }}>Mã bảo hành: {lookupResult.warrantyCode}</div>
                    <div style={{ color: "#475569" }}>Serial: {lookupResult.serialNumber || lookupResult.sku || lookupResult.item?.sku || "Chưa có"}</div>
                    <div style={{ color: "#475569" }}>Đơn hàng: {lookupResult.orderNumber || `#${lookupResult.orderId || "Chưa liên kết"}`}</div>
                    <div style={{ color: "#475569" }}>Hết hạn: {formatDate(lookupResult.endDate || lookupResult.expiresAt)}</div>
                    {lookupResult.request ? (
                      <div className="warranty-request-summary">
                        <span>Hồ sơ bảo hành gần nhất</span>
                        <strong>{lookupResult.request.statusLabel || getStatusMeta(lookupResult.request.status).label}</strong>
                        {lookupResult.request.issueDescription ? <div style={{ marginTop: 6, color: "#475569" }}>{lookupResult.request.issueDescription}</div> : null}
                      </div>
                    ) : null}
                    {isWarrantyExpired(lookupResult) ? (
                      <button type="button" className="warranty-btn" disabled>
                        Hết hạn bảo hành
                      </button>
                    ) : hasOpenWarrantyRequest(lookupResult) ? (
                      <div style={{ color: "#1d4ed8", fontWeight: 900 }}>
                        Sản phẩm đang có hồ sơ bảo hành được xử lý.
                      </div>
                    ) : (
                      <button type="button" className="warranty-btn" onClick={handleUseLookupResult}>
                        Gửi yêu cầu cho sản phẩm này
                      </button>
                    )}
                  </div>
                ) : null}
                {lookupError ? <div style={{ marginTop: 14, color: "#b91c1c", fontWeight: 800 }}>{lookupError}</div> : null}
              </div>
            </section>

            {!selectedHasOpenRequest ? (
            <section className="warranty-card">
              <div className="warranty-card__body">
                <h2 style={{ margin: "0 0 14px", fontSize: 24 }}>Gửi yêu cầu bảo hành</h2>
                <form className={`warranty-request-form${hasRequestContext ? "" : " warranty-request-form--empty"}`} onSubmit={handleSubmitRequest} style={{ display: "grid", gap: 12 }}>
                  {selectedHasOpenRequest ? (
                    <div className="warranty-request-empty">
                      <div className="warranty-request-empty__title">Sản phẩm đang có yêu cầu bảo hành</div>
                      <div>Hồ sơ của sản phẩm này đã được tiếp nhận và đang trong quy trình xử lý. Bạn không cần gửi thêm yêu cầu mới.</div>
                      <button type="button" className="warranty-btn warranty-btn--light" onClick={() => setSelectedWarranty(selectedWarranty)}>
                        Theo dõi tiến trình hiện tại
                      </button>
                    </div>
                  ) : selectedWarranty ? (
                    <div style={{ padding: 14, borderRadius: 16, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", fontWeight: 800, lineHeight: 1.55 }}>
                      Đang tạo yêu cầu cho {selectedWarranty.item?.productName || selectedWarranty.productName || "sản phẩm đã mua"} · Đơn hàng {selectedWarranty.orderNumber || `#${selectedWarranty.orderId}`} · Mã bảo hành {selectedWarranty.warrantyCode}
                    </div>
                  ) : (
                    <div style={{ padding: 14, borderRadius: 16, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontWeight: 800, lineHeight: 1.55 }}>
                      Để hồ sơ có đủ mã đơn, email, serial, ảnh sản phẩm và hạn bảo hành, hãy bấm "Yêu cầu bảo hành" trên sản phẩm đã mua hoặc tra cứu mã bảo hành rồi chọn "Gửi yêu cầu cho sản phẩm này".
                    </div>
                  )}
                  {!hasRequestContext && !selectedHasOpenRequest ? (
                    <div className="warranty-request-empty">
                      <div className="warranty-request-empty__title">Chọn đúng sản phẩm trước khi gửi yêu cầu</div>
                      <div>Form bảo hành chỉ mở khi hệ thống đã xác định được sản phẩm, mã bảo hành, đơn hàng và thời hạn còn hiệu lực.</div>
                      <ol>
                        <li>Bấm <strong>Yêu cầu bảo hành</strong> trên sản phẩm còn bảo hành.</li>
                        <li>Hoặc tra cứu mã bảo hành rồi chọn <strong>Gửi yêu cầu cho sản phẩm này</strong>.</li>
                      </ol>
                    </div>
                  ) : null}
                  <div className="warranty-form-grid" style={{ display: hasRequestContext ? "grid" : "none" }}>
                    <input
                      className="warranty-input"
                      value={requestForm.lookupValue}
                      onChange={(event) => setRequestForm((prev) => ({ ...prev, lookupValue: event.target.value }))}
                      placeholder="Mã bảo hành / mã đơn / serial"
                    />
                    <select
                      className="warranty-select"
                      value={requestForm.severity}
                      onChange={(event) => setRequestForm((prev) => ({ ...prev, severity: event.target.value }))}
                    >
                      <option value="LOW">Lỗi nhẹ</option>
                      <option value="MEDIUM">Lỗi trung bình</option>
                      <option value="HIGH">Lỗi nặng</option>
                      <option value="CRITICAL">Khẩn cấp</option>
                    </select>
                    <input className="warranty-input" value={requestForm.customerName} onChange={(event) => setRequestForm((prev) => ({ ...prev, customerName: event.target.value }))} placeholder="Họ tên" />
                    <input className="warranty-input" value={requestForm.customerPhone} onChange={(event) => setRequestForm((prev) => ({ ...prev, customerPhone: event.target.value }))} placeholder="Số điện thoại" />
                    <input className="warranty-input" value={requestForm.customerEmail} onChange={(event) => setRequestForm((prev) => ({ ...prev, customerEmail: event.target.value }))} placeholder="Email" />
                    <input className="warranty-input" value={requestForm.productName} onChange={(event) => setRequestForm((prev) => ({ ...prev, productName: event.target.value }))} placeholder="Tên sản phẩm" />
                    <input className="warranty-input" value={requestForm.serialNumber} onChange={(event) => setRequestForm((prev) => ({ ...prev, serialNumber: event.target.value }))} placeholder="Serial / SKU" />
                    <input className="warranty-input" value={requestForm.orderId} onChange={(event) => setRequestForm((prev) => ({ ...prev, orderId: event.target.value }))} placeholder="Mã đơn hàng" />
                    <div className="warranty-form-grid--full">
                      <textarea
                        className="warranty-textarea"
                        value={requestForm.issueDescription}
                        onChange={(event) => setRequestForm((prev) => ({ ...prev, issueDescription: event.target.value }))}
                        placeholder="Mô tả lỗi, tình trạng sản phẩm, thời điểm phát sinh..."
                      />
                    </div>
                    <div className="warranty-form-grid--full">
                      <textarea
                        className="warranty-textarea"
                        value={requestForm.extraNote}
                        onChange={(event) => setRequestForm((prev) => ({ ...prev, extraNote: event.target.value }))}
                        placeholder="Ghi chú thêm cho kỹ thuật viên..."
                      />
                    </div>
                    <input className="warranty-hidden-field" tabIndex={-1} autoComplete="off" value={requestForm.website} onChange={(event) => setRequestForm((prev) => ({ ...prev, website: event.target.value }))} />
                    <input type="hidden" value={requestForm.startedAt} readOnly />
                    <div className="warranty-form-grid--full">
                      <input className="warranty-file-input" type="file" multiple accept="image/*,video/*,application/pdf" onChange={(event) => handleFiles(event.target.files)} />
                    </div>
                  </div>

                  {hasRequestContext && requestForm.media.length ? (
                    <div className="warranty-attachments">
                      {requestForm.media.map((item) => (
                        <article key={item.name}>
                          <AttachmentPreview file={item} />
                        </article>
                      ))}
                    </div>
                  ) : null}

                  <button className="warranty-btn" disabled={submitting || !hasRequestContext} style={{ display: hasRequestContext ? "block" : "none" }}>
                    {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
                  </button>
                </form>
              </div>
            </section>
            ) : null}

            {isAuthenticated ? (
              <section className="warranty-card">
                <div className="warranty-card__body">
                  <h2 style={{ margin: "0 0 14px", fontSize: 24 }}>Thông báo bảo hành</h2>
                  {notifications.length ? (
                    <div className="warranty-notification-list">
                      {notifications.map((notification) => (
                        <article key={notification.id} className="warranty-notification">
                          <strong>{notification.title}</strong>
                          <p>{notification.message}</p>
                          <small style={{ color: "#64748b" }}>{new Date(notification.createdAt).toLocaleString("vi-VN")}</small>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: "#64748b" }}>Chưa có thông báo bảo hành mới.</div>
                  )}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

