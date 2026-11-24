import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { resolveProductImage } from "../../utils/productImage";

import {
  createStaffShipment,
  getStaffOrderDetail,
  getStaffOrders,
  updateStaffConsultationNote,
  updateStaffOrderStatus,
  getStaffOrderSerials,
  assignStaffOrderSerials,
  autoGenerateStaffOrderSerials
} from "../../services/staff.service";
import { approvePaymentProof } from "../../services/order.service";
import "../../styles/admin-ai-studio.css";
import "../../styles/admin-catalog-studio.css";

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/api\/?$/, "");

function resolveUploadUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

const STORAGE_KEY = "pcmall_staff_selected_order";

const STATUS_META = {
  PENDING: { label: "Chờ xử lý", tone: "warning" },
  PROCESSING: { label: "Đang xử lý", tone: "info" },
  SHIPPED: { label: "Đang giao", tone: "shipping" },
  DELIVERED: { label: "Đã giao", tone: "success" },
  COMPLETED: { label: "Hoàn thành", tone: "success" },
  CANCELED: { label: "Đã hủy", tone: "danger" }
};

const ORDER_STATUS_OPTIONS = ["", "PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELED"];
const ORDER_FLOW = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"];

const SHIPPING_CARRIERS = [
  { id: "GHTK", label: "GHTK (Giao Hàng Tiết Kiệm)" },
  { id: "VNPOST", label: "VNPost (Bưu Điện Việt Nam)" },
  { id: "JT", label: "J&T Express" }
];

const NOTE_TEMPLATES = [
  "Đã gọi xác nhận đơn với khách, khách đồng ý giao trong 2-3 ngày.",
  "Khách yêu cầu giao cuối tuần, ưu tiên khung giờ 9h-12h.",
  "Đã tư vấn nâng cấp linh kiện, khách giữ nguyên cấu hình hiện tại.",
  "Đơn thanh toán online, đã xác nhận giao dịch trước khi xuất kho."
];

const CANCEL_REASON_PRESETS = [
  "Khách hàng liên hệ yêu cầu hủy đơn",
  "Không liên hệ được khách hàng sau 3 lần gọi xác nhận",
  "Sản phẩm tạm hết hàng trong kho"
];

function buildMockTrackingCode(orderId, carrier = "GHTK") {
  const prefix = String(carrier || "GHTK")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  const stamp = Date.now().toString().slice(-6);
  return `${prefix}-MOCK-${orderId}-${stamp}`;
}

function getErrorMessage(error, fallback) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback;
  }
  return error?.message || fallback;
}

function getEnvelopeData(response, fallbackValue) {
  if (response && typeof response === "object" && "data" in response) {
    return response.data ?? fallbackValue;
  }
  return response ?? fallbackValue;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function normalizeApiDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);

  const raw = String(value).trim();
  if (!raw) return null;

  const isoLike = raw.includes("T") ? raw : raw.replace(" ", "T");
  const wallTime = isoLike.replace(/([zZ]|[+\-]\d{2}:\d{2})$/, "");
  return new Date(wallTime);
}

function formatDate(value) {
  if (!value) return "Không rõ";
  const parsed = normalizeApiDate(value);
  if (!parsed || Number.isNaN(parsed.getTime())) return "Không rõ";
  return parsed.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatShortDate(value) {
  if (!value) return "Không rõ";
  const parsed = normalizeApiDate(value);
  if (!parsed || Number.isNaN(parsed.getTime())) return "Không rõ";
  return parsed.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function getStatusMeta(status) {
  return STATUS_META[status] || { label: status || "Không rõ", tone: "neutral" };
}

function getOrderAmount(order) {
  return Number(order?.finalAmount || order?.totalAmount || 0);
}

function getLineAmount(item) {
  return Number(item?.lineTotal || item?.totalPrice || item?.price || 0);
}

function getItemUnitPrice(item) {
  return Number(item?.price || item?.unitPrice || 0);
}

function getItemThumbnail(item) {
  return resolveProductImage({
    name: item?.productName || item?.name || "Sản phẩm",
    sku: item?.sku || item?.skuCode || "",
    imageUrl: item?.imageUrl || item?.image_url || item?.thumbnail || item?.productImage || item?.image || null,
    image_url: item?.imageUrl || item?.image_url || item?.thumbnail || item?.productImage || item?.image || null,
    category_name: item?.categoryName || item?.category_name || item?.product?.category_name || item?.product?.categoryName || undefined,
    brand_name: item?.brandName || item?.brand_name || item?.product?.brand_name || item?.product?.brandName || undefined
  });
}

function getPaymentTone(paymentStatus) {
  const normalized = String(paymentStatus || "").toUpperCase();
  if (normalized === "PAID") return "success";
  if (["PENDING", "PENDING_GATEWAY", "AWAITING_ADMIN_CONFIRMATION", "PENDING_VERIFICATION"].includes(normalized)) {
    return "warning";
  }
  if (["REJECTED", "EXPIRED", "PAYMENT_CANCELLED", "FAILED"].includes(normalized)) {
    return "danger";
  }
  return "neutral";
}

function getPaymentLabel(paymentStatus) {
  const normalized = String(paymentStatus || "").toUpperCase();
  if (normalized === "PAID") return "Đã thanh toán";
  if (normalized === "AWAITING_ADMIN_CONFIRMATION" || normalized === "PENDING_VERIFICATION") {
    return "Chờ duyệt minh chứng";
  }
  if (normalized === "PENDING_GATEWAY" || normalized === "PENDING") return "Chờ thanh toán";
  if (normalized === "REJECTED") return "Từ chối minh chứng";
  if (normalized === "EXPIRED") return "Hết hạn TT";
  if (normalized === "PAYMENT_CANCELLED") return "Đã hủy TT";
  return "Chưa thanh toán";
}

function getTodayTotalValue(orders) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  return orders.reduce((sum, order) => {
    if (!order?.createdAt) return sum;
    const createdAt = new Date(order.createdAt);
    if (createdAt.getFullYear() === y && createdAt.getMonth() === m && createdAt.getDate() === d) {
      return sum + getOrderAmount(order);
    }
    return sum;
  }, 0);
}

function OrderListSkeleton() {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          style={{
            height: 106,
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            background: "linear-gradient(90deg, #f8fafc 25%, #f1f5f9 50%, #f8fafc 75%)",
            backgroundSize: "200% 100%",
            animation: "staffOrderPulse 1.4s ease-in-out infinite"
          }}
        />
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          style={{
            height: index === 0 ? 140 : 124,
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            background: "linear-gradient(90deg, #f8fafc 25%, #f1f5f9 50%, #f8fafc 75%)",
            backgroundSize: "200% 100%",
            animation: "staffOrderPulse 1.4s ease-in-out infinite"
          }}
        />
      ))}
    </div>
  );
}

function InfoGrid({ rows }) {
  return (
    <div className="oms-info-grid">
      {rows.map((row) => (
        <div key={row.label} className={`oms-info-tile${row.full ? " is-full" : ""}`}>
          <span className="oms-info-label">{row.label}</span>
          <strong className={`oms-info-value${row.wrap ? " staff-wrap-anywhere" : ""}`}>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}

function StaffOrderQueue({
  loading,
  filteredOrders,
  keyword,
  setKeyword,
  statusFilter,
  setStatusFilter,
  selectedOrderId,
  setSelectedOrderId
}) {
  return (
    <aside className="oms-queue-panel">
      <div className="oms-queue-head">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <h3>Danh Sách Đơn Hàng</h3>
            <p>Tìm kiếm, lọc nhanh theo trạng thái và chọn đơn xử lý.</p>
          </div>
          <span className="oms-count-pill">{filteredOrders.length}</span>
        </div>

        <div className="cat-search-wrap" style={{ marginTop: 12, width: "100%", minWidth: 0 }}>
          <svg className="cat-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="cat-input cat-input--search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm #mã đơn, khách hàng, SĐT, vận đơn..."
            aria-label="Tìm đơn hàng"
          />
        </div>

        <div className="oms-status-pills" role="tablist" aria-label="Lọc trạng thái đơn hàng">
          {ORDER_STATUS_OPTIONS.map((status) => (
            <button
              key={status || "all"}
              type="button"
              className={`oms-pill-btn${statusFilter === status ? " is-active" : ""}`}
              onClick={() => setStatusFilter(status)}
            >
              {status ? getStatusMeta(status).label : "Tất cả"}
            </button>
          ))}
        </div>
      </div>

      <div className="oms-queue-list">
        {loading ? (
          <OrderListSkeleton />
        ) : filteredOrders.length === 0 ? (
          <div className="oms-empty-box">
            <strong style={{ display: "block", marginBottom: 4, color: "#0f172a" }}>Không có đơn hàng phù hợp</strong>
            <span>Thử đổi bộ lọc trạng thái hoặc xóa từ khóa tìm kiếm.</span>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isActive = order.id === selectedOrderId;
            const statusMeta = getStatusMeta(order.status);
            return (
              <button
                key={order.id}
                type="button"
                className={`oms-order-card${isActive ? " is-active" : ""}`}
                onClick={() => setSelectedOrderId(order.id)}
              >
                <div className="oms-order-card__top">
                  <span className="oms-order-id">#{order.id}</span>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <span className={`staff-badge staff-badge--${statusMeta.tone}`}>{statusMeta.label}</span>
                    <span className={`staff-badge staff-badge--${getPaymentTone(order.paymentStatus)}`}>
                      {getPaymentLabel(order.paymentStatus)}
                    </span>
                  </div>
                </div>

                <div className="oms-order-customer">{order.customer?.fullName || "Khách hàng"}</div>
                <div className="oms-order-sub staff-wrap-anywhere">
                  {order.customer?.email || order.customer?.phone || "Không có thông tin liên hệ"}
                </div>

                <div className="oms-order-foot">
                  <span className="oms-order-meta">
                    {order.paymentMethod || "COD"} · {formatShortDate(order.createdAt)}
                  </span>
                  <span className="oms-order-amount">{formatCurrency(getOrderAmount(order))} đ</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

function StaffOrderHeader({ selectedOrder, selectedStatusMeta, customer, actionButtons }) {
  return (
    <header className="oms-detail-header">
      <div className="oms-detail-header__top">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className={`staff-badge staff-badge--${selectedStatusMeta.tone}`}>{selectedStatusMeta.label}</span>
            <span className={`staff-badge staff-badge--${getPaymentTone(selectedOrder.paymentStatus)}`}>
              {getPaymentLabel(selectedOrder.paymentStatus)}
            </span>
            <span className="oms-method-chip">{selectedOrder.paymentMethod || "COD"}</span>
          </div>
          <h2>Đơn hàng #{selectedOrder.id}</h2>
          <p>
            Tạo lúc {formatDate(selectedOrder.createdAt)} · Khách hàng <strong>{customer.fullName || "Không rõ"}</strong>
          </p>
        </div>

        <div className="oms-detail-total-box">
          <span className="oms-detail-total-label">Tổng thanh toán</span>
          <strong className="oms-detail-total-value">{formatCurrency(getOrderAmount(selectedOrder))} đ</strong>
        </div>
      </div>

      <div className="oms-detail-actions">{actionButtons}</div>
    </header>
  );
}

function StaffOrderTimeline({ orderTimeline }) {
  return (
    <section className="oms-card">
      <div className="oms-section-head">
        <div>
          <h3>Tiến Độ Xử Lý Đơn Hàng</h3>
          <p>Theo dõi từng mốc trạng thái vận hành nội bộ từ tiếp nhận đến hoàn tất.</p>
        </div>
      </div>
      <div className="oms-stepper">
        {orderTimeline.map((step, index) => (
          <article key={step.status} className={`oms-step${step.isDone ? " is-done" : ""}`}>
            <div className="oms-step__badge">{step.isDone ? "✓" : index + 1}</div>
            <strong>{step.meta.label}</strong>
            <small>{step.timestamp ? formatDate(step.timestamp) : "Đang chờ cập nhật"}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function StaffCustomerInfo({ selectedOrder, customer, selectedStatusMeta }) {
  return (
    <section className="oms-card">
      <div className="oms-section-head">
        <div>
          <h3>Thông Tin Khách Hàng &amp; Giao Nhận</h3>
          <p>Liên hệ người nhận và địa chỉ giao hàng của đơn.</p>
        </div>
      </div>
      <InfoGrid
        rows={[
          { label: "Họ tên khách hàng", value: customer.fullName || "Không rõ" },
          { label: "Số điện thoại", value: customer.phone || "Không rõ" },
          { label: "Email liên hệ", value: customer.email || "Không rõ", wrap: true },
          { label: "Trạng thái hiện tại", value: selectedStatusMeta.label },
          { label: "Địa chỉ giao hàng", value: selectedOrder.shippingAddress || "Chưa có địa chỉ giao hàng", wrap: true, full: true },
          { label: "Ghi chú đơn hàng", value: selectedOrder.note || "Chưa có ghi chú", wrap: true, full: true }
        ]}
      />
    </section>
  );
}

function StaffOrderItemsTable({ selectedOrder }) {
  return (
    <section className="oms-card">
      <div className="oms-section-head">
        <div>
          <h3>Danh Sách Linh Kiện &amp; Sản Phẩm ({(selectedOrder.items || []).length})</h3>
          <p>Kiểm tra cấu hình, mã SKU, số lượng và đơn giá trước khi xuất kho.</p>
        </div>
      </div>

      {(selectedOrder.items || []).length === 0 ? (
        <div className="oms-empty-box">Đơn hàng chưa có dòng sản phẩm.</div>
      ) : (
        <div className="oms-items-list">
          {(selectedOrder.items || []).map((item) => (
            <article key={item.id || `${item.productName}-${item.sku}`} className="oms-item-row">
              <div className="oms-item-thumb">
                {getItemThumbnail(item) ? (
                  <img src={getItemThumbnail(item)} alt={item.productName || "Sản phẩm"} loading="lazy" />
                ) : (
                  <span>PC Mall</span>
                )}
              </div>
              <div className="oms-item-info">
                <strong>{item.productName || "Sản phẩm"}</strong>
                <span className="cat-prod-slug" style={{ marginTop: 4 }}>SKU: {item.sku || "Không rõ"}</span>
              </div>
              <div className="oms-item-metric">
                <span>SL</span>
                <strong>×{item.quantity || 0}</strong>
              </div>
              <div className="oms-item-metric">
                <span>Đơn giá</span>
                <strong>{formatCurrency(getItemUnitPrice(item))} đ</strong>
              </div>
              <div className="oms-item-metric is-total">
                <span>Thành tiền</span>
                <strong>{formatCurrency(getLineAmount(item))} đ</strong>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function StaffSerialNumbersManager({
  orderSerialsInfo,
  serialsLoading,
  serialsSaving,
  serialsError,
  serialInputs,
  setSerialInputs,
  handleSaveSerials,
  handleAutoGenerateSerials,
  selectedOrder
}) {
  const isCanceled = selectedOrder?.status === "CANCELED";
  const isDeliveredOrCompleted = selectedOrder?.status === "DELIVERED" || selectedOrder?.status === "COMPLETED";

  const handleInputChange = (orderItemId, slotIndex, value) => {
    setSerialInputs((prev) => {
      const currentList = [...(prev[orderItemId] || [])];
      currentList[slotIndex] = value;
      return { ...prev, [orderItemId]: currentList };
    });
  };

  const isComplete = Boolean(orderSerialsInfo?.isFullyAssigned);
  const totalRequired = orderSerialsInfo?.totalRequiredSerials || 0;
  const totalAssigned = orderSerialsInfo?.totalAssignedSerials || 0;

  return (
    <section className="oms-card" style={{ borderColor: isComplete ? "#a7f3d0" : "#fde68a" }}>
      <div className="oms-section-head" style={{ flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <h3>Quản Trị Serial Number / IMEI Xuất Kho</h3>
            <span className={`staff-badge ${isComplete ? "staff-badge--success" : "staff-badge--warning"}`}>
              {isComplete ? `✓ Đã gán đủ ${totalAssigned}/${totalRequired} S/N` : `Chưa đủ (${totalAssigned}/${totalRequired} S/N)`}
            </span>
          </div>
          <p>Gán Serial Number thực tế trên vỏ hộp &amp; linh kiện để kích hoạt bảo hành điện tử chính hãng 1:1.</p>
        </div>

        {!isCanceled && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="ai-action-btn ai-action-btn--ghost"
              onClick={handleAutoGenerateSerials}
              disabled={serialsSaving || serialsLoading}
              title="Tự động sinh mã Serial Number thực tế mẫu cho demo kho"
            >
              Tự động điền S/N mẫu
            </button>
            <button
              type="button"
              className="cat-btn-dark"
              style={{ background: "linear-gradient(135deg, #2563eb, #4f46e5)", padding: "8px 14px", fontSize: 12.5 }}
              onClick={handleSaveSerials}
              disabled={serialsSaving || serialsLoading}
            >
              {serialsSaving ? "Đang lưu..." : "Lưu Serial Number"}
            </button>
          </div>
        )}
      </div>

      {serialsError ? <div className="oms-alert oms-alert--error">{serialsError}</div> : null}

      {!isComplete && !isCanceled && selectedOrder?.status === "PROCESSING" ? (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 12.5, fontWeight: 700 }}>
          Bắt buộc: Cần gán đủ Serial Number cho toàn bộ linh kiện trước khi bấm "Chuyển sang giao hàng".
        </div>
      ) : null}

      {serialsLoading ? (
        <div style={{ padding: 20, textAlign: "center", color: "#64748b", fontSize: 13 }}>Đang tải danh sách Serial Number...</div>
      ) : (orderSerialsInfo?.items || []).length === 0 ? (
        <div className="oms-empty-box">Đơn hàng không có linh kiện cần gán Serial Number.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {(orderSerialsInfo?.items || []).map((item) => {
            const assigned = item.assignedSerials || [];
            const required = item.requiredQuantity || 1;
            const currentInputs = serialInputs[item.orderItemId] || [];

            return (
              <div
                key={item.orderItemId}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "#f8fafc",
                  border: item.isComplete ? "1px solid #cbd5e1" : "1px solid #fde047"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <div>
                    <strong style={{ fontSize: 13.5, color: "#0f172a" }}>{item.productName}</strong>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      SKU: <code style={{ background: "#e2e8f0", padding: "1px 6px", borderRadius: 5 }}>{item.sku}</code> · SL: <strong>{required}</strong>
                    </div>
                  </div>
                  <span className={`staff-badge ${item.isComplete ? "staff-badge--success" : "staff-badge--warning"}`}>
                    {item.isComplete ? `Đủ ${assigned.length}/${required}` : `Thiếu (${assigned.length}/${required})`}
                  </span>
                </div>

                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                  {Array.from({ length: required }).map((_, slotIdx) => {
                    const assignedRecord = assigned[slotIdx];
                    const val = currentInputs[slotIdx] !== undefined ? currentInputs[slotIdx] : assignedRecord?.serialNumber || "";
                    const isAssigned = Boolean(assignedRecord?.serialNumber);

                    return (
                      <div key={slotIdx} style={{ display: "grid", gap: 4 }}>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: "#475569", display: "flex", justifyContent: "space-between" }}>
                          <span>Serial / IMEI #{slotIdx + 1}</span>
                          {assignedRecord?.warrantyId ? (
                            <span style={{ color: "#059669" }}>Đã kích hoạt BH</span>
                          ) : isAssigned ? (
                            <span style={{ color: "#2563eb" }}>Đã gán</span>
                          ) : null}
                        </label>
                        <input
                          type="text"
                          className="cat-input"
                          placeholder={`Nhập/Quét S/N #${slotIdx + 1}`}
                          value={val}
                          disabled={isCanceled || isDeliveredOrCompleted}
                          onChange={(e) => handleInputChange(item.orderItemId, slotIdx, e.target.value)}
                          style={{
                            fontFamily: "ui-monospace, monospace",
                            fontWeight: 700,
                            borderColor: val ? "#3b82f6" : "#cbd5e1"
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StaffPaymentPanel({ selectedOrder, onApprovePaymentProof, actionLoading, onZoomProof }) {
  const paymentProofRaw =
    selectedOrder.paymentProof ||
    selectedOrder.payment_proof ||
    selectedOrder.proofImageUrl ||
    selectedOrder.proof_image_url ||
    "";
  const paymentProofUrl = resolveUploadUrl(paymentProofRaw);
  const normalizedPaymentStatus = String(selectedOrder.paymentStatus || selectedOrder.payment_status || "").toUpperCase();
  const isBankTransfer = String(selectedOrder.paymentMethod || selectedOrder.payment_method || "").toUpperCase() === "BANK_TRANSFER";
  const canVerifyProof =
    isBankTransfer &&
    selectedOrder.status !== "CANCELED" &&
    (normalizedPaymentStatus === "AWAITING_ADMIN_CONFIRMATION" ||
      normalizedPaymentStatus === "PENDING_VERIFICATION" ||
      Boolean(paymentProofUrl && normalizedPaymentStatus !== "PAID"));

  const rows = [
    { label: "Phương thức", value: selectedOrder.paymentMethod || "COD" },
    {
      label: "Trạng thái thanh toán",
      value: (
        <span className={`staff-badge staff-badge--${getPaymentTone(selectedOrder.paymentStatus)}`}>
          {getPaymentLabel(selectedOrder.paymentStatus)}
        </span>
      )
    },
    { label: "Tạm tính linh kiện", value: `${formatCurrency(selectedOrder.totalAmount || getOrderAmount(selectedOrder))} đ` },
    { label: "Phí vận chuyển", value: `${formatCurrency(selectedOrder.shippingFee)} đ` }
  ];

  if (Number(selectedOrder.discountAmount || 0) > 0 || selectedOrder.couponCode) {
    rows.push({
      label: `Giảm giá${selectedOrder.couponCode ? ` (${selectedOrder.couponCode})` : ""}`,
      value: `-${formatCurrency(selectedOrder.discountAmount || 0)} đ`
    });
  }

  rows.push(
    { label: "Tổng thanh toán", value: `${formatCurrency(getOrderAmount(selectedOrder))} đ` },
    { label: "Mã giao dịch", value: selectedOrder.transactionCode || selectedOrder.paymentTransactionId || "—", wrap: true, full: true }
  );

  return (
    <section className="oms-card">
      <div className="oms-section-head">
        <div>
          <h3>Thanh Toán &amp; Minh Chứng</h3>
          <p>Chi tiết công nợ, mã giảm giá và kiểm duyệt biên lai chuyển khoản.</p>
        </div>
      </div>
      <InfoGrid rows={rows} />

      {isBankTransfer ? (
        <div style={{ padding: 14, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 13.5, color: "#0f172a" }}>Biên lai / Minh chứng chuyển khoản VietQR</strong>
            {paymentProofUrl ? (
              <button
                type="button"
                className="ai-action-btn ai-action-btn--ghost"
                style={{ padding: "4px 10px", fontSize: 11.5 }}
                onClick={() => onZoomProof?.(paymentProofUrl)}
              >
                Phóng to toàn màn hình ↗
              </button>
            ) : null}
          </div>

          {paymentProofUrl ? (
            <div
              onClick={() => onZoomProof?.(paymentProofUrl)}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 12,
                overflow: "hidden",
                cursor: "zoom-in",
                background: "#0f172a",
                maxHeight: 280,
                display: "grid",
                placeItems: "center"
              }}
              title="Nhấp để phóng to biên lai"
            >
              <img
                src={paymentProofUrl}
                alt="Minh chứng chuyển khoản"
                style={{ width: "100%", maxHeight: 260, objectFit: "contain", display: "block" }}
              />
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", padding: "10px 14px", borderRadius: 10 }}>
              Khách hàng chưa tải lên ảnh biên lai chuyển khoản cho đơn hàng này.
            </div>
          )}

          {canVerifyProof ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="oms-btn oms-btn--success"
                disabled={Boolean(actionLoading)}
                onClick={() => onApprovePaymentProof?.(true)}
                style={{ flex: 1 }}
              >
                {actionLoading === "approve_payment" ? "Đang duyệt..." : "✓ Duyệt thanh toán & Chuyển xử lý"}
              </button>
              <button
                type="button"
                className="oms-btn oms-btn--danger"
                disabled={Boolean(actionLoading)}
                onClick={() => onApprovePaymentProof?.(false)}
                style={{ flex: 1 }}
              >
                {actionLoading === "reject_payment" ? "Đang từ chối..." : "✕ Từ chối biên lai"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function StaffShipmentPanel({
  selectedOrder,
  shippingCarrier,
  setShippingCarrier,
  trackingCode,
  setTrackingCode,
  trackingError,
  handleGenerateTracking
}) {
  return (
    <section className="oms-card">
      <div className="oms-section-head">
        <div>
          <h3>Vận Đơn Giao Hàng</h3>
          <p>Chọn hãng vận chuyển và cập nhật mã vận đơn trước khi xuất kho.</p>
        </div>
      </div>

      <InfoGrid
        rows={[
          { label: "Trạng thái vận đơn", value: selectedOrder.shipment?.status || "Chưa tạo vận đơn" },
          { label: "Mã vận đơn hiện tại", value: selectedOrder.shipment?.trackingCode || "Chưa có", wrap: true }
        ]}
      />

      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <label htmlFor="staff-carrier" style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
            Đơn vị vận chuyển
          </label>
          <select id="staff-carrier" className="cat-input" value={shippingCarrier} onChange={(event) => setShippingCarrier(event.target.value)}>
            {SHIPPING_CARRIERS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="staff-tracking" style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
            Mã vận đơn
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="staff-tracking"
              className="cat-input"
              style={{ fontFamily: "ui-monospace, monospace" }}
              value={trackingCode}
              onChange={(event) => setTrackingCode(event.target.value)}
              placeholder="VD: GHTK-2026-..."
            />
            <button type="button" className="ai-action-btn ai-action-btn--ghost" style={{ whiteSpace: "nowrap" }} onClick={handleGenerateTracking}>
              Tạo mã demo
            </button>
          </div>
        </div>
      </div>

      {trackingError ? <div className="oms-alert oms-alert--error">{trackingError}</div> : null}
    </section>
  );
}

function StaffInternalNotes({ consultationNote, setConsultationNote, applyNoteTemplate, handleSaveNote, actionLoading }) {
  return (
    <section className="oms-card">
      <div className="oms-section-head">
        <div>
          <h3>Ghi Chú Vận Hành Nội Bộ</h3>
          <p>Lưu lịch hẹn giao, ghi chú tư vấn và dặn dò đóng gói.</p>
        </div>
      </div>

      <div className="cat-warranty-presets" style={{ marginTop: 0 }}>
        {NOTE_TEMPLATES.map((text) => (
          <button key={text} type="button" className="cat-warranty-chip" onClick={() => applyNoteTemplate(text)}>
            + {text}
          </button>
        ))}
      </div>

      <textarea
        className="cat-input"
        style={{ minHeight: 112, resize: "vertical", fontFamily: "inherit" }}
        value={consultationNote}
        onChange={(event) => setConsultationNote(event.target.value)}
        rows={5}
        placeholder="Nhập ghi chú xử lý đơn hàng..."
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="button" className="cat-btn-dark" onClick={handleSaveNote} disabled={Boolean(actionLoading)}>
          {actionLoading === "note" ? "Đang lưu..." : "Lưu ghi chú"}
        </button>
      </div>
    </section>
  );
}

export function StaffOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [statsOrders, setStatsOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [keyword, setKeyword] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? Number(stored) : null;
  });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [trackingCode, setTrackingCode] = useState("");
  const [shippingCarrier, setShippingCarrier] = useState("GHTK");
  const [consultationNote, setConsultationNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [trackingError, setTrackingError] = useState("");
  const [orderSerialsInfo, setOrderSerialsInfo] = useState(null);
  const [serialInputs, setSerialInputs] = useState({});
  const [serialsLoading, setSerialsLoading] = useState(false);
  const [serialsSaving, setSerialsSaving] = useState(false);
  const [serialsError, setSerialsError] = useState("");
  const [zoomProofUrl, setZoomProofUrl] = useState(null);

  useEffect(() => {
    loadOrders();
    loadStatsOrders();
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedOrderId) {
      setSelectedOrder(null);
      setOrderSerialsInfo(null);
      setSerialInputs({});
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, String(selectedOrderId));
    loadOrderDetail(selectedOrderId);
  }, [selectedOrderId]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = window.setTimeout(() => setSuccessMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const filteredOrders = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return orders;

    const matched = orders.filter((order) => {
      const customer = order.customer || {};
      const searchable = [
        `#${order.id}`,
        order.id,
        order.status,
        order.shippingAddress,
        customer.fullName,
        customer.email,
        customer.phone,
        order.paymentMethod,
        order.shipment?.trackingCode
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });

    const numericQuery = Number(query.replace(/^#/, ""));
    if (Number.isInteger(numericQuery) && numericQuery > 0) {
      return matched.sort((a, b) => {
        const aExact = Number(a.id) === numericQuery ? 1 : 0;
        const bExact = Number(b.id) === numericQuery ? 1 : 0;
        return bExact - aExact;
      });
    }

    return matched;
  }, [keyword, orders]);

  useEffect(() => {
    if (!filteredOrders.length) return;

    const query = keyword.trim();
    if (!query) {
      if (!selectedOrderId || !filteredOrders.some((order) => order.id === selectedOrderId)) {
        setSelectedOrderId(filteredOrders[0].id);
      }
      return;
    }

    const numericQuery = Number(query.replace(/^#/, ""));
    if (Number.isInteger(numericQuery) && numericQuery > 0) {
      const exactOrder = filteredOrders.find((order) => Number(order.id) === numericQuery);
      if (exactOrder && exactOrder.id !== selectedOrderId) {
        setSelectedOrderId(exactOrder.id);
        return;
      }
    }

    if (!filteredOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(filteredOrders[0].id);
    }
  }, [filteredOrders, keyword, selectedOrderId]);

  const stats = useMemo(() => {
    const source = statsOrders.length ? statsOrders : orders;
    return {
      pending: source.filter((order) => order.status === "PENDING").length,
      processing: source.filter((order) => order.status === "PROCESSING").length,
      shipped: source.filter((order) => order.status === "SHIPPED").length,
      todayValue: getTodayTotalValue(source)
    };
  }, [orders, statsOrders]);

  async function loadStatsOrders() {
    try {
      const response = await getStaffOrders();
      const list = getEnvelopeData(response, []);
      setStatsOrders(Array.isArray(list) ? list : []);
    } catch {
      setStatsOrders([]);
    }
  }

  async function loadOrders(nextStatusFilter = statusFilter) {
    try {
      setLoading(true);
      setErrorMessage("");
      const response = await getStaffOrders(nextStatusFilter ? { status: nextStatusFilter } : {});
      const list = getEnvelopeData(response, []);
      const normalizedList = Array.isArray(list) ? list : [];
      setOrders(normalizedList);

      if (normalizedList.length === 0) {
        setSelectedOrderId(null);
        setSelectedOrder(null);
        return;
      }

      if (!normalizedList.some((item) => item.id === selectedOrderId)) {
        setSelectedOrderId(normalizedList[0].id);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể tải danh sách đơn hàng."));
    } finally {
      setLoading(false);
    }
  }

  async function loadOrderSerials(orderId) {
    if (!orderId) {
      setOrderSerialsInfo(null);
      setSerialInputs({});
      return;
    }
    try {
      setSerialsLoading(true);
      setSerialsError("");
      const response = await getStaffOrderSerials(orderId);
      const info = getEnvelopeData(response, null);
      setOrderSerialsInfo(info);

      const initial = {};
      (info?.items || []).forEach((item) => {
        const assigned = (item.assignedSerials || []).map((s) => s.serialNumber);
        const slots = [];
        for (let i = 0; i < item.requiredQuantity; i++) {
          slots.push(assigned[i] || "");
        }
        initial[item.orderItemId] = slots;
      });
      setSerialInputs(initial);
    } catch (err) {
      setSerialsError(getErrorMessage(err, "Không thể tải thông tin Serial Number."));
    } finally {
      setSerialsLoading(false);
    }
  }

  async function handleSaveSerials() {
    if (!selectedOrder?.id) return;
    try {
      setSerialsSaving(true);
      setSerialsError("");
      const assignments = Object.entries(serialInputs).map(([itemId, serials]) => ({
        orderItemId: Number(itemId),
        serials: (serials || []).map((s) => String(s || "").trim()).filter(Boolean)
      }));

      const response = await assignStaffOrderSerials(selectedOrder.id, assignments);
      const info = getEnvelopeData(response, null);
      setOrderSerialsInfo(info);
      setSuccessMessage("Đã lưu Serial Number thành công!");
      await loadOrderDetail(selectedOrder.id);
    } catch (err) {
      setSerialsError(getErrorMessage(err, "Không thể lưu Serial Number."));
    } finally {
      setSerialsSaving(false);
    }
  }

  async function handleAutoGenerateSerials() {
    if (!selectedOrder?.id) return;
    try {
      setSerialsSaving(true);
      setSerialsError("");
      const response = await autoGenerateStaffOrderSerials(selectedOrder.id);
      const info = getEnvelopeData(response, null);
      setOrderSerialsInfo(info);

      const initial = {};
      (info?.items || []).forEach((item) => {
        initial[item.orderItemId] = (item.assignedSerials || []).map((s) => s.serialNumber);
      });
      setSerialInputs(initial);
      setSuccessMessage("Đã tự động tạo và gán Serial Number mẫu thành công!");
      await loadOrderDetail(selectedOrder.id);
    } catch (err) {
      setSerialsError(getErrorMessage(err, "Không thể tự động tạo Serial Number."));
    } finally {
      setSerialsSaving(false);
    }
  }

  async function loadOrderDetail(orderId) {
    try {
      setDetailLoading(true);
      setErrorMessage("");
      const response = await getStaffOrderDetail(orderId);
      const order = getEnvelopeData(response, null);
      setSelectedOrder(order);
      setTrackingCode(order?.shipment?.trackingCode || "");
      setConsultationNote(order?.note || "");
      setTrackingError("");
      loadOrderSerials(orderId);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể tải chi tiết đơn hàng."));
    } finally {
      setDetailLoading(false);
    }
  }

  function applyOrderUpdate(order) {
    setSelectedOrder(order);
    setOrders((prev) => prev.map((item) => (item.id === order.id ? { ...item, ...order } : item)));
    setStatsOrders((prev) => prev.map((item) => (item.id === order.id ? { ...item, ...order } : item)));
    setTrackingCode(order?.shipment?.trackingCode || "");
    setConsultationNote(order?.note || "");
    setTrackingError("");
    if (order?.id) {
      loadOrderSerials(order.id);
    }
  }

  async function refreshCurrentOrder() {
    if (selectedOrderId) {
      await Promise.all([loadOrderDetail(selectedOrderId), loadOrders(), loadStatsOrders()]);
    } else {
      await Promise.all([loadOrders(), loadStatsOrders()]);
    }
  }

  async function handleMoveToProcessing() {
    if (!selectedOrder) return;
    try {
      setActionLoading("processing");
      setErrorMessage("");
      const response = await updateStaffOrderStatus(selectedOrder.id, "PROCESSING");
      const order = getEnvelopeData(response, null);
      applyOrderUpdate(order);
      setSuccessMessage(`Đơn #${selectedOrder.id} đã chuyển sang Đang xử lý.`);
      await Promise.all([loadOrders("PROCESSING"), loadStatsOrders()]);
      setStatusFilter("PROCESSING");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể chuyển đơn sang Đang xử lý."));
    } finally {
      setActionLoading("");
    }
  }

  async function handleShipOrder() {
    if (!selectedOrder) return;

    if (orderSerialsInfo && !orderSerialsInfo.isFullyAssigned) {
      setErrorMessage(
        `Không thể xuất kho: Đơn hàng chưa được gán đủ Serial Number cho các linh kiện (${orderSerialsInfo.totalAssignedSerials || 0}/${orderSerialsInfo.totalRequiredSerials || 0} S/N). Vui lòng gán S/N trước khi chuyển sang Đang giao.`
      );
      return;
    }

    const normalizedTracking = trackingCode.trim();
    if (!normalizedTracking) {
      setTrackingError("Vui lòng nhập mã vận đơn trước khi chuyển sang Đang giao.");
      return;
    }

    try {
      setActionLoading("ship");
      setErrorMessage("");
      setTrackingError("");
      await createStaffShipment(selectedOrder.id, {
        trackingCode: normalizedTracking,
        carrier: shippingCarrier,
        status: "IN_TRANSIT"
      });
      const response = await updateStaffOrderStatus(selectedOrder.id, "SHIPPED");
      const order = getEnvelopeData(response, null);
      applyOrderUpdate(order);
      setSuccessMessage(`Đơn #${selectedOrder.id} đã chuyển sang Đang giao.`);
      await Promise.all([loadOrders("SHIPPED"), loadStatsOrders()]);
      setStatusFilter("SHIPPED");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể cập nhật vận đơn."));
    } finally {
      setActionLoading("");
    }
  }

  async function handleMarkDelivered() {
    if (!selectedOrder) return;

    const normalizedTracking = (selectedOrder.shipment?.trackingCode || trackingCode || "").trim();
    if (!normalizedTracking) {
      setTrackingError("Đơn chưa có mã vận đơn để xác nhận hoàn tất.");
      return;
    }

    try {
      setActionLoading("delivered");
      setErrorMessage("");
      setTrackingError("");
      const response = await updateStaffOrderStatus(selectedOrder.id, "DELIVERED");
      const order = getEnvelopeData(response, null);
      applyOrderUpdate(order);
      setSuccessMessage(`Đơn #${selectedOrder.id} đã được xác nhận đã giao. Khách hàng sẽ xác nhận hoàn tất.`);
      await Promise.all([loadOrders("DELIVERED"), loadStatsOrders()]);
      setStatusFilter("DELIVERED");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể chuyển đơn sang Đã giao."));
    } finally {
      setActionLoading("");
    }
  }

  async function handleSaveNote() {
    if (!selectedOrder) return;
    try {
      setActionLoading("note");
      setErrorMessage("");
      const response = await updateStaffConsultationNote(selectedOrder.id, consultationNote);
      const order = getEnvelopeData(response, null);
      applyOrderUpdate(order);
      setSuccessMessage("Đã lưu ghi chú xử lý.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể lưu ghi chú."));
    } finally {
      setActionLoading("");
    }
  }

  async function handleApprovePaymentProof(approved) {
    if (!selectedOrder?.id) return;
    const confirmMsg = approved
      ? `Xác nhận duyệt biên lai chuyển khoản cho đơn #${selectedOrder.id} và chuyển đơn sang Đang xử lý?`
      : `Xác nhận từ chối biên lai chuyển khoản của đơn #${selectedOrder.id}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setActionLoading(approved ? "approve_payment" : "reject_payment");
      setErrorMessage("");
      await approvePaymentProof(selectedOrder.id, {
        approved,
        reason: approved ? null : "Biên lai chuyển khoản không hợp lệ hoặc không rõ ràng."
      });
      setSuccessMessage(
        approved
          ? `Đã duyệt thanh toán đơn #${selectedOrder.id}! Đơn đã chuyển sang Đang xử lý.`
          : `Đã từ chối biên lai thanh toán của đơn #${selectedOrder.id}.`
      );
      const targetFilter = approved ? "PROCESSING" : statusFilter;
      await Promise.all([loadOrderDetail(selectedOrder.id), loadOrders(targetFilter), loadStatsOrders()]);
      if (approved) setStatusFilter("PROCESSING");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể cập nhật trạng thái duyệt biên lai."));
    } finally {
      setActionLoading("");
    }
  }

  async function handleCancelOrder() {
    if (!selectedOrder) return;

    const normalizedReason = cancelReason.trim();
    if (!normalizedReason) {
      setErrorMessage("Cần nhập lý do hủy đơn.");
      return;
    }

    try {
      setActionLoading("cancel");
      setErrorMessage("");
      const response = await updateStaffOrderStatus(selectedOrder.id, "CANCELED", { reason: normalizedReason });
      const order = getEnvelopeData(response, null);
      applyOrderUpdate(order);
      setSuccessMessage(`Đơn #${selectedOrder.id} đã được hủy.`);
      setShowCancelDialog(false);
      setCancelReason("");
      await Promise.all([loadOrders("CANCELED"), loadStatsOrders()]);
      setStatusFilter("CANCELED");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể hủy đơn."));
    } finally {
      setActionLoading("");
    }
  }

  const selectedStatusMeta = getStatusMeta(selectedOrder?.status);
  const customer = selectedOrder?.customer || {};
  const canMoveToProcessing = selectedOrder?.status === "PENDING";
  const canShip = selectedOrder?.status === "PROCESSING";
  const canMarkDelivered = selectedOrder?.status === "SHIPPED";
  const canCancel = selectedOrder?.status === "PENDING" || selectedOrder?.status === "PROCESSING";
  const currentFlowIndex = ORDER_FLOW.indexOf(selectedOrder?.status);

  const actionHelp = {
    processing: canMoveToProcessing ? "Xác nhận đơn và chuyển sang bước xử lý." : "Chỉ đơn chờ xử lý mới có thể xác nhận.",
    ship: canShip ? "Nhập mã vận đơn và chuyển đơn sang đang giao." : "Đơn phải ở trạng thái Đang xử lý trước khi giao hàng.",
    delivered: canMarkDelivered ? "Xác nhận đơn vị vận chuyển đã giao hàng." : "Đơn phải ở trạng thái Đang giao trước khi xác nhận đã giao.",
    cancel: canCancel ? "Hủy đơn trước khi xuất kho và tự động hoàn trả tồn kho." : "Chỉ đơn chờ xử lý hoặc đang xử lý mới được hủy."
  };

  function handleGenerateTracking() {
    if (!selectedOrder?.id) return;
    setTrackingCode(buildMockTrackingCode(selectedOrder.id, shippingCarrier));
    setTrackingError("");
    setSuccessMessage("Đã tạo mã vận đơn demo.");
  }

  function applyNoteTemplate(text) {
    setConsultationNote((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
  }

  function renderActionButton({ key, enabled, label, loadingLabel, onClick, className, title }) {
    return (
      <button
        key={key}
        type="button"
        className={className}
        onClick={onClick}
        disabled={!enabled || Boolean(actionLoading)}
        title={title}
      >
        {actionLoading === key ? loadingLabel : label}
      </button>
    );
  }

  const orderTimeline = ORDER_FLOW.map((status, index) => {
    const isDone = currentFlowIndex >= index;
    const timestamp =
      index === 0
        ? selectedOrder?.createdAt
        : isDone
          ? selectedOrder?.updatedAt || selectedOrder?.shipment?.updatedAt || null
          : null;

    return { status, meta: getStatusMeta(status), isDone, timestamp };
  });

  const actionButtons = [
    renderActionButton({
      key: "processing",
      enabled: canMoveToProcessing,
      label: "✓ Xác nhận xử lý",
      loadingLabel: "Đang cập nhật...",
      onClick: handleMoveToProcessing,
      className: "oms-btn oms-btn--primary",
      title: actionHelp.processing
    }),
    renderActionButton({
      key: "ship",
      enabled: canShip,
      label: "Chuyển giao hàng",
      loadingLabel: "Đang cập nhật...",
      onClick: handleShipOrder,
      className: "oms-btn oms-btn--shipping",
      title: actionHelp.ship
    }),
    renderActionButton({
      key: "delivered",
      enabled: canMarkDelivered,
      label: "Xác nhận đã giao",
      loadingLabel: "Đang cập nhật...",
      onClick: handleMarkDelivered,
      className: "oms-btn oms-btn--success",
      title: actionHelp.delivered
    }),
    renderActionButton({
      key: "cancel",
      enabled: canCancel,
      label: "Hủy đơn",
      loadingLabel: "Đang xử lý...",
      onClick: () => setShowCancelDialog(true),
      className: "oms-btn oms-btn--danger",
      title: actionHelp.cancel
    })
  ];

  return (
    <div className="oms-shell">
      <style>{`
        @keyframes staffOrderPulse { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .oms-shell { width: 100%; display: flex; flex-direction: column; gap: 20px; }
        .oms-hero-kpi-btn { text-align: left; cursor: pointer; font-family: inherit; width: 100%; }
        .oms-layout { display: grid; grid-template-columns: 380px minmax(0, 1fr); gap: 20px; align-items: start; }
        .oms-queue-panel { position: sticky; top: 82px; border-radius: 18px; border: 1px solid #e2e8f0; background: #ffffff; box-shadow: 0 12px 30px -22px rgba(15, 23, 42, 0.28); overflow: hidden; display: flex; flex-direction: column; }
        .oms-queue-head { padding: 18px 18px 14px; border-bottom: 1px solid #f1f5f9; background: #fafcff; }
        .oms-queue-head h3 { margin: 0; font-size: 16px; font-weight: 800; color: #0f172a; }
        .oms-queue-head p { margin: 3px 0 0; font-size: 12px; color: #64748b; }
        .oms-count-pill { padding: 3px 10px; border-radius: 999px; background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; font-size: 12px; font-weight: 800; font-variant-numeric: tabular-nums; }
        .oms-status-pills { display: flex; gap: 6px; overflow-x: auto; padding: 11px 0 2px; scrollbar-width: thin; }
        .oms-pill-btn { padding: 6px 11px; border-radius: 999px; border: 1px solid #e2e8f0; background: #ffffff; color: #475569; font-size: 11.5px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 0.14s ease; }
        .oms-pill-btn:hover { border-color: #cbd5e1; color: #0f172a; }
        .oms-pill-btn.is-active { background: #0f172a; border-color: #0f172a; color: #ffffff; }
        .oms-queue-list { padding: 14px; display: flex; flex-direction: column; gap: 10px; max-height: calc(100vh - 290px); overflow-y: auto; }
        .oms-order-card { position: relative; width: 100%; text-align: left; padding: 13px 14px; border-radius: 13px; border: 1px solid #e2e8f0; background: #ffffff; display: flex; flex-direction: column; gap: 6px; cursor: pointer; transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease; }
        .oms-order-card:hover { border-color: #93c5fd; transform: translateY(-1px); box-shadow: 0 10px 20px -14px rgba(37, 99, 235, 0.3); }
        .oms-order-card.is-active { border-color: #2563eb; background: linear-gradient(180deg, #ffffff 0%, #f5f9ff 100%); box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.14); }
        .oms-order-card.is-active::before { content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3.5px; border-radius: 0 4px 4px 0; background: #2563eb; }
        .oms-order-card__top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .oms-order-id { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; font-weight: 800; color: #0f172a; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 8px; border-radius: 6px; }
        .oms-order-customer { font-size: 13.5px; font-weight: 750; color: #0f172a; }
        .oms-order-sub { font-size: 12px; color: #64748b; }
        .oms-order-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding-top: 6px; border-top: 1px solid #f1f5f9; margin-top: 2px; }
        .oms-order-meta { font-size: 11.5px; color: #64748b; font-weight: 600; }
        .oms-order-amount { font-size: 14.5px; font-weight: 800; color: #1d4ed8; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .staff-badge { display: inline-flex; align-items: center; justify-content: center; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 750; white-space: nowrap; }
        .staff-badge--warning { color: #b45309; background: #fffbeb; border: 1px solid #fde68a; }
        .staff-badge--info { color: #1d4ed8; background: #eff6ff; border: 1px solid #bfdbfe; }
        .staff-badge--shipping { color: #6d28d9; background: #f5f3ff; border: 1px solid #ddd6fe; }
        .staff-badge--success { color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; }
        .staff-badge--danger { color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; }
        .staff-badge--neutral { color: #475569; background: #f1f5f9; border: 1px solid #cbd5e1; }
        .oms-method-chip { font-family: ui-monospace, monospace; font-size: 11px; font-weight: 700; color: #334155; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 8px; border-radius: 6px; }
        .oms-detail-pane { min-width: 0; display: flex; flex-direction: column; gap: 16px; }
        .oms-detail-header { border-radius: 18px; border: 1px solid #e2e8f0; background: #ffffff; padding: 20px 22px; box-shadow: 0 12px 30px -22px rgba(15, 23, 42, 0.25); display: flex; flex-direction: column; gap: 16px; }
        .oms-detail-header__top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
        .oms-detail-header h2 { margin: 8px 0 0; font-size: 24px; font-weight: 850; color: #0f172a; letter-spacing: -0.02em; }
        .oms-detail-header p { margin: 4px 0 0; font-size: 13px; color: #64748b; }
        .oms-detail-total-box { text-align: right; padding: 10px 16px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; }
        .oms-detail-total-label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
        .oms-detail-total-value { display: block; margin-top: 2px; font-size: 24px; font-weight: 850; color: #1d4ed8; font-variant-numeric: tabular-nums; }
        .oms-detail-actions { display: flex; gap: 9px; flex-wrap: wrap; padding-top: 14px; border-top: 1px solid #f1f5f9; }
        .oms-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 16px; border-radius: 10px; border: 1px solid transparent; font-size: 13px; font-weight: 750; cursor: pointer; transition: all 0.15s ease; }
        .oms-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .oms-btn:disabled { opacity: 0.42; cursor: not-allowed; filter: grayscale(0.25); }
        .oms-btn--primary { background: linear-gradient(135deg, #2563eb, #4f46e5); color: #ffffff; box-shadow: 0 8px 18px -8px rgba(37, 99, 235, 0.55); }
        .oms-btn--shipping { background: linear-gradient(135deg, #0d9488, #0f766e); color: #ffffff; }
        .oms-btn--success { background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; }
        .oms-btn--danger { background: #fef2f2; color: #b91c1c; border-color: #fca5a5; }
        .oms-btn--danger-fill { background: #dc2626; color: #ffffff; }
        .oms-card { border-radius: 16px; border: 1px solid #e2e8f0; background: #ffffff; padding: 18px 20px; box-shadow: 0 10px 24px -22px rgba(15, 23, 42, 0.22); display: flex; flex-direction: column; gap: 14px; min-width: 0; }
        .oms-section-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .oms-section-head h3 { margin: 0; font-size: 15.5px; font-weight: 800; color: #0f172a; }
        .oms-section-head p { margin: 3px 0 0; font-size: 12.5px; color: #64748b; }
        .oms-stepper { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
        .oms-step { padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .oms-step.is-done { background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%); border-color: #93c5fd; }
        .oms-step__badge { width: 28px; height: 28px; border-radius: 999px; display: grid; place-items: center; font-size: 12px; font-weight: 800; background: #e2e8f0; color: #475569; }
        .oms-step.is-done .oms-step__badge { background: linear-gradient(135deg, #2563eb, #4f46e5); color: #ffffff; }
        .oms-step strong { font-size: 13px; color: #0f172a; }
        .oms-step small { font-size: 11px; color: #64748b; line-height: 1.35; }
        .oms-info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .oms-info-tile { padding: 11px 13px; border-radius: 11px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .oms-info-tile.is-full { grid-column: 1 / -1; }
        .oms-info-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
        .oms-info-value { font-size: 13.5px; font-weight: 700; color: #0f172a; line-height: 1.45; }
        .oms-items-list { display: flex; flex-direction: column; gap: 10px; }
        .oms-item-row { display: grid; grid-template-columns: 56px minmax(0, 1fr) 64px 124px 128px; gap: 12px; align-items: center; padding: 12px 14px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; }
        .oms-item-thumb { width: 52px; height: 52px; border-radius: 10px; border: 1px solid #e2e8f0; background: #ffffff; display: grid; place-items: center; overflow: hidden; }
        .oms-item-thumb img { width: 100%; height: 100%; object-fit: contain; }
        .oms-item-thumb span { font-size: 10px; font-weight: 800; color: #94a3b8; }
        .oms-item-info { min-width: 0; }
        .oms-item-info strong { display: block; font-size: 13.5px; font-weight: 750; color: #0f172a; line-height: 1.35; }
        .oms-item-metric { text-align: right; display: flex; flex-direction: column; gap: 2px; }
        .oms-item-metric span { font-size: 11px; color: #64748b; font-weight: 600; }
        .oms-item-metric strong { font-size: 13.5px; color: #0f172a; font-variant-numeric: tabular-nums; }
        .oms-item-metric.is-total strong { color: #1d4ed8; }
        .oms-bottom-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
        .oms-empty-box { padding: 30px 20px; border-radius: 12px; background: #f8fafc; border: 1px dashed #cbd5e1; text-align: center; color: #64748b; font-size: 13px; }
        .oms-alert { padding: 12px 16px; border-radius: 12px; font-size: 13px; font-weight: 700; }
        .oms-alert--error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        .oms-alert--success { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
        .staff-wrap-anywhere { overflow-wrap: anywhere; word-break: break-word; }
        @media (max-width: 1240px) {
          .oms-layout { grid-template-columns: 330px minmax(0, 1fr); }
          .oms-stepper { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .oms-bottom-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 940px) {
          .oms-layout, .oms-info-grid, .oms-stepper { grid-template-columns: 1fr; }
          .oms-queue-panel { position: static; }
          .oms-queue-list { max-height: 420px; }
          .oms-item-row { grid-template-columns: 52px minmax(0, 1fr); }
          .oms-item-metric { text-align: left; }
        }
      `}</style>

      {/* ==================== EXECUTIVE SALES OMS HERO ==================== */}
      <section className="ai-studio-hero">
        <div className="ai-studio-hero-top">
          <div>
            <div className="ai-studio-hero-badges">
              <span className="ai-studio-live-pill">
                <span className="ai-studio-live-dot" />
                Sales OMS • Order Fulfillment
              </span>
              <span className="ai-studio-tech-pill">Serial 1:1 • VietQR • Vận đơn</span>
            </div>
            <h1 className="ai-studio-hero-title">Trung Tâm Vận Hành Đơn Hàng</h1>
            <p className="ai-studio-hero-desc">
              Theo dõi đơn hàng chờ xác nhận, gán Serial Number xuất kho, duyệt minh chứng chuyển khoản, cấp mã vận đơn và cập nhật tiến độ giao hàng theo thời gian thực.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link
              to="/staff/chat"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 15px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.08)",
                color: "#f8fafc",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                backdropFilter: "blur(8px)"
              }}
            >
              Ticket tư vấn ↗
            </Link>
            <button
              type="button"
              className="ai-studio-hero-cta"
              onClick={refreshCurrentOrder}
              disabled={Boolean(actionLoading) || loading}
            >
              <svg className={loading ? "ai-studio-spin" : ""} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              <span>Làm Mới Dữ Liệu</span>
            </button>
          </div>
        </div>

        <div className="ai-studio-kpi-grid">
          <button
            type="button"
            className="ai-studio-kpi oms-hero-kpi-btn"
            style={{ "--kpi-accent": "#fbbf24" }}
            onClick={() => setStatusFilter("PENDING")}
          >
            <div className="ai-studio-kpi-head">
              <span className="ai-studio-kpi-label">Đơn chờ xử lý</span>
              <span className="ai-studio-kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </span>
            </div>
            <div className="ai-studio-kpi-value" style={{ color: stats.pending > 0 ? "#fcd34d" : "#ffffff" }}>
              {stats.pending}
            </div>
            <div className="ai-studio-kpi-hint">Cần xác nhận và phân luồng</div>
          </button>

          <button
            type="button"
            className="ai-studio-kpi oms-hero-kpi-btn"
            style={{ "--kpi-accent": "#38bdf8" }}
            onClick={() => setStatusFilter("PROCESSING")}
          >
            <div className="ai-studio-kpi-head">
              <span className="ai-studio-kpi-label">Đang xử lý kho</span>
              <span className="ai-studio-kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
              </span>
            </div>
            <div className="ai-studio-kpi-value">{stats.processing}</div>
            <div className="ai-studio-kpi-hint">Đang gán Serial &amp; đóng gói</div>
          </button>

          <button
            type="button"
            className="ai-studio-kpi oms-hero-kpi-btn"
            style={{ "--kpi-accent": "#a78bfa" }}
            onClick={() => setStatusFilter("SHIPPED")}
          >
            <div className="ai-studio-kpi-head">
              <span className="ai-studio-kpi-label">Đang vận chuyển</span>
              <span className="ai-studio-kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
              </span>
            </div>
            <div className="ai-studio-kpi-value">{stats.shipped}</div>
            <div className="ai-studio-kpi-hint">Đã cấp mã vận đơn giao khách</div>
          </button>

          <div className="ai-studio-kpi" style={{ "--kpi-accent": "#34d399" }}>
            <div className="ai-studio-kpi-head">
              <span className="ai-studio-kpi-label">Giá trị hôm nay</span>
              <span className="ai-studio-kpi-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
              </span>
            </div>
            <div className="ai-studio-kpi-value" style={{ color: "#6ee7b7", fontSize: 21 }}>
              {formatCurrency(stats.todayValue)} đ
            </div>
            <div className="ai-studio-kpi-hint">Tổng giá trị đơn tạo trong ngày</div>
          </div>
        </div>
      </section>

      {errorMessage ? <div className="oms-alert oms-alert--error">{errorMessage}</div> : null}
      {successMessage ? <div className="oms-alert oms-alert--success">{successMessage}</div> : null}

      {/* ==================== MASTER-DETAIL OMS WORKSPACE ==================== */}
      <div className="oms-layout">
        <StaffOrderQueue
          loading={loading}
          filteredOrders={filteredOrders}
          keyword={keyword}
          setKeyword={setKeyword}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          selectedOrderId={selectedOrderId}
          setSelectedOrderId={setSelectedOrderId}
        />

        <main className="oms-detail-pane">
          {detailLoading ? (
            <DetailSkeleton />
          ) : !selectedOrder ? (
            <div className="oms-card">
              <div className="oms-empty-box">
                <strong style={{ display: "block", marginBottom: 6, color: "#0f172a", fontSize: 15 }}>Chưa chọn đơn hàng</strong>
                <span>Chọn một đơn hàng ở cột bên trái để xem chi tiết, gán Serial và cập nhật giao vận.</span>
              </div>
            </div>
          ) : (
            <>
              <StaffOrderHeader
                selectedOrder={selectedOrder}
                selectedStatusMeta={selectedStatusMeta}
                customer={customer}
                actionButtons={actionButtons}
              />

              <StaffOrderTimeline orderTimeline={orderTimeline} />

              <StaffCustomerInfo
                selectedOrder={selectedOrder}
                customer={customer}
                selectedStatusMeta={selectedStatusMeta}
              />

              <StaffOrderItemsTable selectedOrder={selectedOrder} />

              <StaffSerialNumbersManager
                orderSerialsInfo={orderSerialsInfo}
                serialsLoading={serialsLoading}
                serialsSaving={serialsSaving}
                serialsError={serialsError}
                serialInputs={serialInputs}
                setSerialInputs={setSerialInputs}
                handleSaveSerials={handleSaveSerials}
                handleAutoGenerateSerials={handleAutoGenerateSerials}
                selectedOrder={selectedOrder}
              />

              <StaffPaymentPanel
                selectedOrder={selectedOrder}
                onApprovePaymentProof={handleApprovePaymentProof}
                actionLoading={actionLoading}
                onZoomProof={setZoomProofUrl}
              />

              <div className="oms-bottom-grid">
                <StaffShipmentPanel
                  selectedOrder={selectedOrder}
                  shippingCarrier={shippingCarrier}
                  setShippingCarrier={setShippingCarrier}
                  trackingCode={trackingCode}
                  setTrackingCode={setTrackingCode}
                  trackingError={trackingError}
                  handleGenerateTracking={handleGenerateTracking}
                />
                <StaffInternalNotes
                  consultationNote={consultationNote}
                  setConsultationNote={setConsultationNote}
                  applyNoteTemplate={applyNoteTemplate}
                  handleSaveNote={handleSaveNote}
                  actionLoading={actionLoading}
                />
              </div>
            </>
          )}
        </main>
      </div>

      {/* ==================== LUXURY CANCEL ORDER MODAL ==================== */}
      {showCancelDialog ? (
        <div className="ai-modal-backdrop" onClick={() => setShowCancelDialog(false)}>
          <div className="ai-chunk-modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="ai-chunk-modal-head">
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: "rgba(248,113,113,0.2)", color: "#fca5a5", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Hủy đơn hàng
                </span>
                <h3 style={{ margin: "6px 0 0", fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
                  Xác Nhận Hủy Đơn #{selectedOrder?.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelDialog(false)}
                style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.1)", color: "#e2e8f0", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
                Nhập lý do hủy đơn. Tồn kho SKU, lượt dùng mã giảm giá và Serial Number đã gán (nếu có) sẽ được hệ thống tự động hoàn trả.
              </p>

              <div className="cat-warranty-presets" style={{ marginTop: 0 }}>
                {CANCEL_REASON_PRESETS.map((reason) => (
                  <button key={reason} type="button" className="cat-warranty-chip" onClick={() => setCancelReason(reason)}>
                    {reason}
                  </button>
                ))}
              </div>

              <textarea
                className="cat-input"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={4}
                placeholder="Nhập lý do hủy đơn chi tiết..."
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="cat-btn-clear"
                  onClick={() => {
                    setShowCancelDialog(false);
                    setCancelReason("");
                  }}
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  className="oms-btn oms-btn--danger-fill"
                  onClick={handleCancelOrder}
                  disabled={Boolean(actionLoading)}
                >
                  {actionLoading === "cancel" ? "Đang xử lý..." : "Xác nhận hủy đơn"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ==================== FULLSCREEN PROOF LIGHTBOX ==================== */}
      {zoomProofUrl ? (
        <div
          className="ai-modal-backdrop"
          onClick={() => setZoomProofUrl(null)}
          style={{ zIndex: 10000, cursor: "zoom-out" }}
        >
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoomProofUrl(null)}
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
              src={zoomProofUrl}
              alt="Biên lai phóng to"
              style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 16, objectFit: "contain", background: "#fff" }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
