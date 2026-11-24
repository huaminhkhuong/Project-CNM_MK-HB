import { useEffect, useMemo, useState } from "react";

import { AdminAlerts, AdminPage, useAdminToast } from "../../components/admin/AdminUi";
import { approvePaymentProof } from "../../services/order.service";
import { httpClient } from "../../services/http";
import { formatAdminNumber, getAdminErrorMessage } from "../../utils/adminUi";
import "../../styles/admin-ai-studio.css";
import "../../styles/admin-catalog-studio.css";

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/api\/?$/, "");

const QUICK_REJECTION_REASONS = [
  "Ảnh biên lai mờ, không rõ mã giao dịch",
  "Số tiền chuyển khoản không khớp giá trị đơn hàng",
  "Sai nội dung chuyển khoản / không tìm thấy giao dịch"
];

function resolveUploadUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

function getRawPaymentStatus(order) {
  return String(order?.payment_status || order?.paymentStatus || "").toUpperCase();
}

function isAwaitingApproval(order) {
  const status = getRawPaymentStatus(order);
  return status === "AWAITING_ADMIN_CONFIRMATION" || status === "PENDING_VERIFICATION";
}

function getPaymentStatusMeta(order) {
  const status = getRawPaymentStatus(order);
  if (status === "PAID") {
    return { label: "Đã thanh toán", bg: "#ecfdf5", color: "#047857", border: "#a7f3d0", dot: "#10b981" };
  }
  if (status === "REJECTED") {
    return { label: "Đã từ chối", bg: "#fef2f2", color: "#b91c1c", border: "#fecaca", dot: "#ef4444" };
  }
  if (isAwaitingApproval(order)) {
    return { label: "Chờ admin xác nhận", bg: "#fffbeb", color: "#b45309", border: "#fde68a", dot: "#f59e0b" };
  }
  if (status === "PENDING_GATEWAY" || status === "PENDING") {
    return { label: "Chờ tải minh chứng", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", dot: "#3b82f6" };
  }
  if (status === "EXPIRED") {
    return { label: "Hết hạn thanh toán", bg: "#f1f5f9", color: "#475569", border: "#cbd5e1", dot: "#94a3b8" };
  }
  return { label: status || "Chưa cập nhật", bg: "#f1f5f9", color: "#475569", border: "#cbd5e1", dot: "#94a3b8" };
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("vi-VN");
}

export function AdminPaymentApprovalPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [zoomUrl, setZoomUrl] = useState(null);

  useAdminToast(successMessage, () => setSuccessMessage(""));

  useEffect(() => {
    loadPendingPayments();
  }, []);

  async function loadPendingPayments() {
    try {
      setLoading(true);
      setErrorMessage("");
      const response = await httpClient.get("/orders");
      const allOrders = response.data?.data || response.data || [];
      const bankTransferOrders = allOrders.filter(
        (order) => order.payment_method === "BANK_TRANSFER" || order.paymentMethod === "BANK_TRANSFER"
      );
      setOrders(bankTransferOrders);
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể tải danh sách thanh toán."));
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(orderId, approved) {
    if (!approved && !rejectionReason.trim()) {
      alert("Vui lòng nhập lý do từ chối minh chứng thanh toán.");
      return;
    }
    if (!confirm(approved ? "Xác nhận duyệt thanh toán cho đơn hàng này?" : "Xác nhận từ chối minh chứng thanh toán này?")) return;

    try {
      setActionLoading(true);
      setErrorMessage("");
      setSuccessMessage("");
      await approvePaymentProof(orderId, {
        approved,
        rejectionReason: approved ? null : rejectionReason.trim() || "Minh chứng thanh toán không hợp lệ"
      });
      setSuccessMessage(approved ? `Đã duyệt thanh toán cho đơn #${orderId} thành công!` : `Đã từ chối minh chứng đơn #${orderId}.`);
      await loadPendingPayments();
      setSelectedOrder(null);
      setRejectionReason("");
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể xử lý thanh toán."));
    } finally {
      setActionLoading(false);
    }
  }

  const stats = useMemo(() => {
    const pending = orders.filter(isAwaitingApproval);
    const paid = orders.filter((o) => getRawPaymentStatus(o) === "PAID");
    const rejected = orders.filter((o) => getRawPaymentStatus(o) === "REJECTED");
    const paidAmount = paid.reduce((sum, o) => sum + Number(o.final_amount || o.finalAmount || 0), 0);
    return {
      total: orders.length,
      pendingCount: pending.length,
      paidCount: paid.length,
      rejectedCount: rejected.length,
      paidAmount
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    return orders.filter((order) => {
      const status = getRawPaymentStatus(order);
      if (statusFilter === "PENDING" && !isAwaitingApproval(order)) return false;
      if (statusFilter === "PAID" && status !== "PAID") return false;
      if (statusFilter === "REJECTED" && status !== "REJECTED") return false;
      if (statusFilter === "OTHER" && (isAwaitingApproval(order) || status === "PAID" || status === "REJECTED")) return false;
      if (!q) return true;
      const customer = String(order.customer?.fullName || order.user?.fullName || order.user?.full_name || "").toLowerCase();
      return `#${order.id}`.includes(q) || String(order.id).includes(q) || customer.includes(q);
    });
  }, [orders, statusFilter, searchKeyword]);

  const selectedProofUrl = selectedOrder
    ? resolveUploadUrl(
        selectedOrder.payment_proof ||
          selectedOrder.paymentProof ||
          selectedOrder.proof_image_url ||
          selectedOrder.proofImageUrl
      )
    : "";

  return (
    <AdminPage>
      <div className="cat-studio-shell">
        {/* ==================== EXECUTIVE PAYMENT APPROVAL HERO ==================== */}
        <section className="ai-studio-hero">
          <div className="ai-studio-hero-top">
            <div>
              <div className="ai-studio-hero-badges">
                <span
                  className="ai-studio-live-pill"
                  style={
                    stats.pendingCount > 0
                      ? { background: "rgba(245,158,11,0.18)", borderColor: "rgba(251,191,36,0.45)", color: "#fcd34d" }
                      : undefined
                  }
                >
                  <span
                    className="ai-studio-live-dot"
                    style={stats.pendingCount > 0 ? { background: "#fbbf24" } : undefined}
                  />
                  {stats.pendingCount > 0
                    ? `${stats.pendingCount} Minh Chứng Chờ Duyệt`
                    : "VietQR & Bank Transfer Verification"}
                </span>
                <span className="ai-studio-tech-pill">SePay Auto-VietQR + Kiểm Duyệt Thủ Công</span>
              </div>
              <h1 className="ai-studio-hero-title">Trung Tâm Kiểm Duyệt Thanh Toán Chuyển Khoản</h1>
              <p className="ai-studio-hero-desc">
                Đối soát biên lai chuyển khoản ngân hàng từ khách hàng, phóng to kiểm tra mã giao dịch và phê duyệt hoặc từ chối thanh toán kèm lý do minh bạch.
              </p>
            </div>

            <button
              type="button"
              className="ai-studio-hero-cta"
              onClick={loadPendingPayments}
              disabled={loading}
            >
              <svg className={loading ? "ai-studio-spin" : ""} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              <span>{loading ? "Đang tải..." : "Làm Mới Giao Dịch"}</span>
            </button>
          </div>

          <div className="ai-studio-kpi-grid">
            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#38bdf8" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Tổng đơn chuyển khoản</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value">{formatAdminNumber(stats.total)}</div>
              <div className="ai-studio-kpi-hint">Phương thức BANK_TRANSFER</div>
            </div>

            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#fbbf24" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Chờ xác nhận</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value" style={{ color: stats.pendingCount > 0 ? "#fcd34d" : "#6ee7b7" }}>
                {formatAdminNumber(stats.pendingCount)}
              </div>
              <div className="ai-studio-kpi-hint">Cần Admin đối soát biên lai</div>
            </div>

            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#34d399" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Đã thanh toán</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value" style={{ color: "#6ee7b7" }}>{formatAdminNumber(stats.paidCount)}</div>
              <div className="ai-studio-kpi-hint">Tổng thu: {formatCurrency(stats.paidAmount)} đ</div>
            </div>

            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#f87171" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Đã từ chối</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value">{formatAdminNumber(stats.rejectedCount)}</div>
              <div className="ai-studio-kpi-hint">Minh chứng không hợp lệ</div>
            </div>
          </div>
        </section>

        <AdminAlerts errorMessage={errorMessage} successMessage={successMessage} />

        {/* ==================== ELEVATED PAYMENT APPROVAL TABLE ==================== */}
        <section className="ai-studio-panel">
          <div className="ai-studio-panel-head">
            <div className="ai-studio-panel-title-wrap">
              <span className="ai-studio-panel-icon" style={{ background: "#ecfdf5", color: "#059669", border: "1px solid #bbf7d0" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
              </span>
              <div>
                <h3 className="ai-studio-panel-title">
                  Danh Sách Giao Dịch Chuyển Khoản{" "}
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", marginLeft: 4 }}>
                    {filteredOrders.length} đơn
                  </span>
                </h3>
                <p className="ai-studio-panel-sub">Nhấp "Xem chi tiết" để kiểm tra ảnh biên lai chuyển khoản và phê duyệt</p>
              </div>
            </div>
          </div>

          <div className="cat-toolbar">
            <div className="cat-search-wrap">
              <svg className="cat-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="cat-input cat-input--search"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm theo mã đơn (#877) hoặc tên khách hàng..."
              />
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { id: "ALL", label: `Tất cả (${stats.total})` },
                { id: "PENDING", label: `Chờ xác nhận (${stats.pendingCount})` },
                { id: "PAID", label: `Đã thanh toán (${stats.paidCount})` },
                { id: "REJECTED", label: `Đã từ chối (${stats.rejectedCount})` },
                { id: "OTHER", label: "Chờ tải / Hết hạn" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 999,
                    border: statusFilter === tab.id ? "1px solid #0f172a" : "1px solid #e2e8f0",
                    background: statusFilter === tab.id ? "#0f172a" : "#ffffff",
                    color: statusFilter === tab.id ? "#ffffff" : "#475569",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "56px 24px", textAlign: "center", color: "#64748b", fontSize: 13.5 }}>
              Đang tải danh sách giao dịch chuyển khoản...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div style={{ padding: "56px 24px", textAlign: "center", color: "#64748b" }}>
              <div style={{
                width: 52,
                height: 52,
                margin: "0 auto 12px",
                borderRadius: 14,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#94a3b8"
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
              </div>
              <strong style={{ display: "block", fontSize: 15, color: "#0f172a", marginBottom: 4 }}>
                Không có thanh toán nào trong mục này
              </strong>
              <span style={{ fontSize: 13 }}>Tất cả các đơn hàng chuyển khoản tương ứng đã được xử lý gọn gàng.</span>
            </div>
          ) : (
            <div className="cat-table-scroll">
              <table className="cat-table">
                <thead>
                  <tr>
                    <th>Mã Đơn</th>
                    <th>Khách Hàng</th>
                    <th>Số Tiền Thanh Toán</th>
                    <th>Trạng Thái</th>
                    <th>Thời Gian Tạo</th>
                    <th style={{ textAlign: "right" }}>Hành Động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const meta = getPaymentStatusMeta(order);
                    const awaiting = isAwaitingApproval(order);
                    const customerName = order.customer?.fullName || order.user?.fullName || order.user?.full_name || "Khách vãng lai";
                    return (
                      <tr key={order.id}>
                        <td>
                          <span style={{
                            fontFamily: "ui-monospace, monospace",
                            fontSize: 13,
                            fontWeight: 800,
                            color: "#0f172a",
                            background: "#f1f5f9",
                            padding: "4px 9px",
                            borderRadius: 7,
                            border: "1px solid #e2e8f0"
                          }}>
                            #{order.id}
                          </span>
                        </td>

                        <td>
                          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13.5 }}>{customerName}</div>
                          {(order.customer?.email || order.user?.email) && (
                            <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 1 }}>
                              {order.customer?.email || order.user?.email}
                            </div>
                          )}
                        </td>

                        <td style={{ whiteSpace: "nowrap" }}>
                          <strong style={{ fontSize: 14.5, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                            {formatCurrency(order.final_amount || order.finalAmount)} đ
                          </strong>
                        </td>

                        <td>
                          <span
                            className="cat-status-pill"
                            style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.dot }} />
                            <span>{meta.label}</span>
                          </span>
                        </td>

                        <td style={{ fontSize: 12.5, color: "#475569", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                          {formatDateTime(order.created_at || order.createdAt)}
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => {
                              setSelectedOrder(order);
                              setRejectionReason("");
                            }}
                            className={awaiting ? "cat-btn-dark" : "ai-action-btn ai-action-btn--ghost"}
                            style={
                              awaiting
                                ? { background: "linear-gradient(135deg, #2563eb, #4f46e5)", padding: "7px 14px", fontSize: 12.5 }
                                : undefined
                            }
                          >
                            {awaiting ? "Kiểm duyệt ngay" : "Xem chi tiết"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ==================== LUXURY PAYMENT PROOF VERIFICATION MODAL ==================== */}
        {selectedOrder && (
          <div className="ai-modal-backdrop" onClick={() => setSelectedOrder(null)}>
            <div className="ai-chunk-modal" style={{ maxWidth: 660 }} onClick={(e) => e.stopPropagation()}>
              <div className="ai-chunk-modal-head">
                <div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: "rgba(56,189,248,0.18)", color: "#7dd3fc", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    Bank Transfer Verification
                  </span>
                  <h3 style={{ margin: "6px 0 0", fontSize: 19, fontWeight: 800, color: "#ffffff" }}>
                    Chi Tiết Thanh Toán Đơn #{selectedOrder.id}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    borderRadius: 10,
                    width: 34,
                    height: 34,
                    cursor: "pointer",
                    fontSize: 15,
                    color: "#e2e8f0"
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
                {/* 2x2 Summary Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ padding: "11px 14px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Khách hàng</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 3 }}>
                      {selectedOrder.customer?.fullName || selectedOrder.user?.fullName || selectedOrder.user?.full_name || "—"}
                    </div>
                  </div>
                  <div style={{ padding: "11px 14px", borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase" }}>Số tiền chuyển khoản</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#1d4ed8", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                      {formatCurrency(selectedOrder.final_amount || selectedOrder.finalAmount)} đ
                    </div>
                  </div>
                  <div style={{ padding: "11px 14px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Thời gian tạo</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginTop: 3 }}>
                      {formatDateTime(selectedOrder.created_at || selectedOrder.createdAt)}
                    </div>
                  </div>
                  <div style={{ padding: "11px 14px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Trạng thái</div>
                    {(() => {
                      const m = getPaymentStatusMeta(selectedOrder);
                      return (
                        <span className="cat-status-pill" style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.dot }} />
                          <span>{m.label}</span>
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Proof Image Viewer */}
                {selectedProofUrl ? (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <strong style={{ fontSize: 13.5, color: "#0f172a" }}>Ảnh biên lai chuyển khoản</strong>
                      <button
                        type="button"
                        className="ai-action-btn ai-action-btn--ghost"
                        style={{ padding: "4px 10px", fontSize: 11.5 }}
                        onClick={() => setZoomUrl(selectedProofUrl)}
                      >
                        Phóng to toàn màn hình ↗
                      </button>
                    </div>
                    <div
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 14,
                        overflow: "hidden",
                        cursor: "zoom-in",
                        position: "relative",
                        background: "#0f172a"
                      }}
                      onClick={() => setZoomUrl(selectedProofUrl)}
                    >
                      <img
                        src={selectedProofUrl}
                        alt="Bằng chứng thanh toán"
                        style={{ width: "100%", maxHeight: 340, objectFit: "contain", display: "block" }}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "16px 18px", background: "#fffbeb", borderRadius: 12, border: "1px solid #fde68a", color: "#92400e" }}>
                    <strong style={{ display: "block", fontSize: 13.5 }}>Chưa có ảnh minh chứng chuyển khoản</strong>
                    <span style={{ fontSize: 12.5 }}>Khách hàng chưa tải lên biên lai cho đơn hàng này.</span>
                  </div>
                )}

                {/* Approval / Rejection Controls */}
                {isAwaitingApproval(selectedOrder) && (
                  <div style={{ padding: 16, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                        Lý do từ chối (bắt buộc nếu từ chối minh chứng):
                      </label>
                      <input
                        type="text"
                        className="cat-input"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Nhập lý do cụ thể gửi tới khách hàng..."
                      />
                      <div className="cat-warranty-presets">
                        {QUICK_REJECTION_REASONS.map((reason) => (
                          <button
                            key={reason}
                            type="button"
                            className="cat-warranty-chip"
                            onClick={() => setRejectionReason(reason)}
                          >
                            {reason}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => handleApprove(selectedOrder.id, true)}
                        disabled={actionLoading}
                        style={{
                          flex: 1,
                          padding: "11px 18px",
                          borderRadius: 11,
                          border: "none",
                          background: "linear-gradient(135deg, #059669, #10b981)",
                          color: "#ffffff",
                          fontWeight: 800,
                          fontSize: 13.5,
                          cursor: actionLoading ? "not-allowed" : "pointer"
                        }}
                      >
                        {actionLoading ? "Đang xử lý..." : "✓ Duyệt Thanh Toán"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApprove(selectedOrder.id, false)}
                        disabled={actionLoading}
                        style={{
                          flex: 1,
                          padding: "11px 18px",
                          borderRadius: 11,
                          border: "1px solid #fca5a5",
                          background: "#fef2f2",
                          color: "#b91c1c",
                          fontWeight: 800,
                          fontSize: 13.5,
                          cursor: actionLoading ? "not-allowed" : "pointer"
                        }}
                      >
                        {actionLoading ? "Đang xử lý..." : "✕ Từ Chối Minh Chứng"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Fullscreen Zoom Preview Lightbox */}
        {zoomUrl && (
          <div
            className="ai-modal-backdrop"
            style={{ zIndex: 10000, cursor: "zoom-out" }}
            onClick={() => setZoomUrl(null)}
          >
            <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setZoomUrl(null)}
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
                src={zoomUrl}
                alt="Biên lai phóng to"
                style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 16, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)", objectFit: "contain", background: "#fff" }}
              />
            </div>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
