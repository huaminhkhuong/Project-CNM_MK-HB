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
  { id: "GHTK", label: "GHTK" },
  { id: "VNPOST", label: "VNPost" },
  { id: "JT", label: "J&T Express" }
];

const NOTE_TEMPLATES = [
  "Đã gọi xác nhận đơn với khách, khách đồng ý giao trong 2-3 ngày.",
  "Khách yêu cầu giao cuối tuần, ưu tiên khung giờ 9h-12h.",
  "Đã tư vấn nâng cấp linh kiện, khách giữ nguyên cấu hình hiện tại.",
  "Đơn thanh toán online, đã xác nhận giao dịch trước khi xuất kho."
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
  if (normalized === "PENDING") return "warning";
  return "neutral";
}

function getPaymentLabel(paymentStatus) {
  const normalized = String(paymentStatus || "").toUpperCase();
  if (normalized === "PAID") return "Đã thanh toán";
  if (normalized === "PENDING") return "Chờ thanh toán";
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
    <div style={{ display: "grid", gap: 12 }}>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          style={{
            height: 112,
            borderRadius: 18,
            border: "1px solid #e2e8f0",
            background: "linear-gradient(90deg, #f8fafc 25%, #eef2ff 50%, #f8fafc 75%)",
            backgroundSize: "200% 100%",
            animation: "staffOrderPulse 1.5s ease-in-out infinite"
          }}
        />
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          style={{
            height: index === 0 ? 148 : 128,
            borderRadius: 24,
            border: "1px solid #e2e8f0",
            background: "linear-gradient(90deg, #f8fafc 25%, #eef2ff 50%, #f8fafc 75%)",
            backgroundSize: "200% 100%",
            animation: "staffOrderPulse 1.5s ease-in-out infinite"
          }}
        />
      ))}
    </div>
  );
}

function InfoList({ rows }) {
  return (
    <div className="staff-info-list">
      {rows.map((row) => (
        <div key={row.label} className={`staff-info-row${row.full ? " is-full" : ""}`}>
          <span>{row.label}</span>
          <strong className={row.wrap ? "staff-wrap-anywhere" : ""}>{row.value}</strong>
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
    <aside className="staff-orders-panel staff-orders-panel--sticky">
      <div className="staff-orders-panel__body">
        <div className="staff-orders-panel__stickyArea">
          <div className="staff-orders-panel__head">
            <div>
              <h2>Danh sách đơn hàng</h2>
              <p>Tìm kiếm, lọc trạng thái và chọn đơn để thao tác.</p>
            </div>
          </div>

          <div className="staff-orders-toolbar">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm mã đơn, khách hàng, email, vận đơn..."
              aria-label="Tìm đơn hàng"
            />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Lọc trạng thái đơn hàng">
              {ORDER_STATUS_OPTIONS.map((status) => (
                <option key={status || "all"} value={status}>
                  {status ? getStatusMeta(status).label : "Tất cả trạng thái"}
                </option>
              ))}
            </select>
          </div>

          <div className="staff-orders-tabs">
            {ORDER_STATUS_OPTIONS.map((status) => (
              <button
                key={status || "all"}
                type="button"
                className={statusFilter === status ? "is-active" : ""}
                onClick={() => setStatusFilter(status)}
              >
                {status ? getStatusMeta(status).label : "Tất cả"}
              </button>
            ))}
          </div>
        </div>

        <div className="staff-orders-list">
          {loading ? (
            <OrderListSkeleton />
          ) : filteredOrders.length === 0 ? (
            <div className="staff-orders-empty">
              <strong style={{ display: "block", marginBottom: 8, color: "#0f172a" }}>Chưa có đơn phù hợp</strong>
              Thử đổi bộ lọc trạng thái hoặc từ khóa tìm kiếm.
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isActive = order.id === selectedOrderId;
              const statusMeta = getStatusMeta(order.status);
              return (
                <button
                  key={order.id}
                  type="button"
                  className={`staff-order-card${isActive ? " staff-order-card--active" : ""}`}
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  <div className="staff-order-card__row">
                    <span className={`staff-badge staff-badge--${statusMeta.tone}`}>{statusMeta.label}</span>
                    <span className={`staff-badge staff-badge--${getPaymentTone(order.paymentStatus)}`}>{getPaymentLabel(order.paymentStatus)}</span>
                  </div>
                  <div className="staff-order-card__title">Đơn #{order.id}</div>
                  <div className="staff-order-card__customer">{order.customer?.fullName || "Khách hàng"}</div>
                  <div className="staff-order-card__meta">{order.paymentMethod || "COD"} · {formatShortDate(order.createdAt)}</div>
                  <div className="staff-order-card__row">
                    <span className="staff-order-card__meta staff-wrap-anywhere">{order.customer?.email || "Không có email"}</span>
                    <span className="staff-order-card__amount">{formatCurrency(getOrderAmount(order))} đ</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}

function StaffOrderHeader({ selectedOrder, selectedStatusMeta, customer, actionButtons }) {
  return (
    <header className="staff-detail-header">
      <div className="staff-detail-header__top">
        <div>
          <span className={`staff-badge staff-badge--${selectedStatusMeta.tone}`}>{selectedStatusMeta.label}</span>
          <h2>Đơn hàng #{selectedOrder.id}</h2>
          <p>Tạo lúc {formatDate(selectedOrder.createdAt)} · Khách {customer.fullName || "Không rõ"}</p>
        </div>
        <div className="staff-detail-header__summary">
          <div className="staff-detail-header__summaryLabel">Tổng thanh toán</div>
          <div className="staff-detail-header__summaryValue">{formatCurrency(getOrderAmount(selectedOrder))} đ</div>
        </div>
      </div>
      <div className="staff-detail-header__actions">{actionButtons}</div>
    </header>
  );
}

function StaffOrderTimeline({ orderTimeline }) {
  return (
    <section className="staff-card">
      <div className="staff-orders-section__head">
        <div>
          <h3>Lịch sử xử lý</h3>
          <p>Trạng thái đơn theo quy trình vận hành nội bộ.</p>
        </div>
      </div>
      <div className="staff-stepper">
        {orderTimeline.map((step, index) => (
          <article key={step.status} className={`staff-step${step.isDone ? " staff-step--done" : ""}`}>
            <div className="staff-step__index">{index + 1}</div>
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
    <section className="staff-card">
      <div className="staff-orders-section__head">
        <div>
          <h3>Thông tin khách hàng</h3>
          <p>Thông tin liên hệ và địa chỉ giao hàng của đơn.</p>
        </div>
      </div>
      <InfoList
        rows={[
          { label: "Tên khách", value: customer.fullName || "Không rõ" },
          { label: "Email", value: customer.email || "Không rõ", wrap: true },
          { label: "Số điện thoại", value: customer.phone || "Không rõ" },
          { label: "Địa chỉ giao hàng", value: selectedOrder.shippingAddress || "Chưa có địa chỉ giao hàng", wrap: true, full: true },
          { label: "Trạng thái đơn", value: selectedStatusMeta.label },
          { label: "Ghi chú hiện tại", value: selectedOrder.note || "Chưa có ghi chú", wrap: true, full: true }
        ]}
      />
    </section>
  );
}

function StaffOrderItemsTable({ selectedOrder }) {
  return (
    <section className="staff-card">
      <div className="staff-orders-section__head">
        <div>
          <h3>Danh sách sản phẩm</h3>
          <p>Kiểm tra lại cấu hình, số lượng và giá trị trước khi giao.</p>
        </div>
      </div>

      {(selectedOrder.items || []).length === 0 ? (
        <div className="staff-orders-empty">Đơn hàng chưa có dòng sản phẩm.</div>
      ) : (
        <div className="staff-items-table">
          <div className="staff-items-table__head">
            <span />
            <span>Sản phẩm</span>
            <span>SL</span>
            <span>Đơn giá</span>
            <span>Thành tiền</span>
          </div>
          <div className="staff-order-items">
            {(selectedOrder.items || []).map((item) => (
              <article key={item.id || `${item.productName}-${item.sku}`} className="staff-order-item">
                <div className="staff-order-thumb">
                  {getItemThumbnail(item) ? <img src={getItemThumbnail(item)} alt={item.productName || "Sản phẩm"} loading="lazy" /> : <span>PC Mall</span>}
                </div>
                <div className="staff-order-item__name">
                  <strong>{item.productName || "Sản phẩm"}</strong>
                  <span>SKU: {item.sku || "Không rõ"}</span>
                </div>
                <div className="staff-order-item__metric">
                  <span className="staff-order-item__mobileLabel">SL</span>
                  <strong>{item.quantity || 0}</strong>
                </div>
                <div className="staff-order-item__metric">
                  <span className="staff-order-item__mobileLabel">Đơn giá</span>
                  <strong>{formatCurrency(getItemUnitPrice(item))} đ</strong>
                </div>
                <div className="staff-order-item__metric">
                  <span className="staff-order-item__mobileLabel">Thành tiền</span>
                  <strong>{formatCurrency(getLineAmount(item))} đ</strong>
                </div>
              </article>
            ))}
          </div>
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
      return {
        ...prev,
        [orderItemId]: currentList
      };
    });
  };

  const isComplete = Boolean(orderSerialsInfo?.isFullyAssigned);
  const totalRequired = orderSerialsInfo?.totalRequiredSerials || 0;
  const totalAssigned = orderSerialsInfo?.totalAssignedSerials || 0;

  return (
    <section className="staff-card staff-serials-manager" style={{ border: isComplete ? "1px solid #bbf7d0" : "1px solid #fde68a" }}>
      <div className="staff-orders-section__head" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Quản trị Serial Number / IMEI xuất kho</h3>
            <span
              className={`staff-badge ${isComplete ? "staff-badge--success" : "staff-badge--warning"}`}
              style={{ fontSize: 13, padding: "3px 12px" }}
            >
              {isComplete ? `✅ Đã gán đủ ${totalAssigned}/${totalRequired} S/N` : `⚠️ Chưa đủ (${totalAssigned}/${totalRequired} S/N)`}
            </span>
          </div>
          <p style={{ margin: "4px 0 0", color: "#64748b" }}>
            Gán Serial Number thực tế in trên vỏ hộp & thân linh kiện để đồng bộ bảo hành điện tử chính hãng 1:1 khi xuất kho.
          </p>
        </div>

        {!isCanceled && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="staff-btn staff-btn--secondary"
              onClick={handleAutoGenerateSerials}
              disabled={serialsSaving || serialsLoading}
              title="Tự động sinh mã Serial Number thực tế mẫu cho demo kho"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
            >
              🎲 Tự động điền S/N mẫu
            </button>
            <button
              type="button"
              className="staff-btn staff-btn--primary"
              onClick={handleSaveSerials}
              disabled={serialsSaving || serialsLoading}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
            >
              {serialsSaving ? "Đang lưu..." : "💾 Lưu Serial Number"}
            </button>
          </div>
        )}
      </div>

      {serialsError ? (
        <div className="staff-orders-alert staff-orders-alert--error" style={{ fontSize: 14 }}>
          {serialsError}
        </div>
      ) : null}

      {!isComplete && !isCanceled && selectedOrder?.status === "PROCESSING" ? (
        <div style={{ padding: "10px 14px", borderRadius: 12, background: "#fffbeb", border: "1px solid #fef08a", color: "#854d0e", fontSize: 13, fontWeight: 700 }}>
          ⚠️ Bắt buộc: Nhân viên kho cần gán đủ Serial Number cho tất cả linh kiện trước khi bấm "Chuyển sang giao hàng (SHIPPED)".
        </div>
      ) : null}

      {serialsLoading ? (
        <div style={{ padding: 20, textAlign: "center", color: "#64748b" }}>Đang tải danh sách Serial Number...</div>
      ) : (orderSerialsInfo?.items || []).length === 0 ? (
        <div className="staff-orders-empty">Đơn hàng không có linh kiện cần gán Serial Number.</div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {(orderSerialsInfo?.items || []).map((item) => {
            const assigned = item.assignedSerials || [];
            const required = item.requiredQuantity || 1;
            const currentInputs = serialInputs[item.orderItemId] || [];

            return (
              <div
                key={item.orderItemId}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: "#f8fafc",
                  border: item.isComplete ? "1px solid #cbd5e1" : "1px solid #fde047"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                  <div>
                    <strong style={{ fontSize: 15, color: "#0f172a" }}>{item.productName}</strong>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                      SKU: <code style={{ background: "#e2e8f0", padding: "1px 6px", borderRadius: 4 }}>{item.sku}</code> • Số lượng: <strong>{required} cái</strong>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      padding: "4px 10px",
                      borderRadius: 8,
                      background: item.isComplete ? "#dcfce7" : "#fef9c3",
                      color: item.isComplete ? "#166534" : "#854d0e"
                    }}
                  >
                    {item.isComplete ? `Đã đủ ${assigned.length}/${required}` : `Chưa đủ (${assigned.length}/${required})`}
                  </span>
                </div>

                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                  {Array.from({ length: required }).map((_, slotIdx) => {
                    const assignedRecord = assigned[slotIdx];
                    const val = currentInputs[slotIdx] !== undefined ? currentInputs[slotIdx] : (assignedRecord?.serialNumber || "");
                    const isAssigned = Boolean(assignedRecord?.serialNumber);

                    return (
                      <div key={slotIdx} style={{ display: "grid", gap: 4 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "flex", justifyContent: "space-between" }}>
                          <span>🏷️ Serial / IMEI #{slotIdx + 1}</span>
                          {assignedRecord?.warrantyId ? (
                            <span style={{ color: "#059669", fontSize: 11 }}>Đã kích hoạt BH</span>
                          ) : isAssigned ? (
                            <span style={{ color: "#2563eb", fontSize: 11 }}>Đã gán</span>
                          ) : null}
                        </label>
                        <input
                          type="text"
                          className="staff-orders-field"
                          placeholder={`Nhập/Quét S/N #${slotIdx + 1}`}
                          value={val}
                          disabled={isCanceled || isDeliveredOrCompleted}
                          onChange={(e) => handleInputChange(item.orderItemId, slotIdx, e.target.value)}
                          style={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            background: val ? "#ffffff" : "#f1f5f9",
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

function StaffPaymentPanel({ selectedOrder }) {
  return (
    <section className="staff-card">
      <div className="staff-orders-section__head">
        <div>
          <h3>Thanh toán</h3>
          <p>Trạng thái chi phí và giao dịch.</p>
        </div>
      </div>
      <InfoList
        rows={[
          { label: "Phương thức", value: selectedOrder.paymentMethod || "COD" },
          { label: "Trạng thái thanh toán", value: <span className={`staff-badge staff-badge--${getPaymentTone(selectedOrder.paymentStatus)}`}>{getPaymentLabel(selectedOrder.paymentStatus)}</span> },
          { label: "Phí vận chuyển", value: `${formatCurrency(selectedOrder.shippingFee)} đ` },
          { label: "Tổng tiền", value: `${formatCurrency(getOrderAmount(selectedOrder))} đ` },
          { label: "Mã giao dịch", value: selectedOrder.transactionCode || selectedOrder.paymentTransactionId || "—", wrap: true, full: true }
        ]}
      />
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
    <section className="staff-card">
      <div className="staff-orders-section__head">
        <div>
          <h3>Vận đơn</h3>
          <p>Nhập mã vận đơn và cập nhật giao hàng đúng bước.</p>
        </div>
      </div>
      <InfoList
        rows={[
          { label: "Trạng thái vận đơn", value: selectedOrder.shipment?.status || "Chưa tạo vận đơn" },
          { label: "Mã vận đơn hiện tại", value: selectedOrder.shipment?.trackingCode || "Chưa có", wrap: true }
        ]}
      />
      <div className="staff-field-stack">
        <label htmlFor="staff-carrier" className="staff-field-label">Đơn vị vận chuyển</label>
        <select id="staff-carrier" className="staff-orders-field" value={shippingCarrier} onChange={(event) => setShippingCarrier(event.target.value)}>
          {SHIPPING_CARRIERS.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
        <input
          className="staff-orders-field"
          value={trackingCode}
          onChange={(event) => setTrackingCode(event.target.value)}
          placeholder="Nhập mã vận đơn"
        />
      </div>
      {trackingError ? <div className="staff-orders-alert staff-orders-alert--error">{trackingError}</div> : null}
      <div className="staff-inline-actions">
        <button type="button" className="staff-btn staff-btn--secondary" onClick={handleGenerateTracking}>
          Tạo mã demo
        </button>
      </div>
    </section>
  );
}

function StaffInternalNotes({ consultationNote, setConsultationNote, applyNoteTemplate, handleSaveNote, actionLoading }) {
  return (
    <section className="staff-card">
      <div className="staff-orders-section__head">
        <div>
          <h3>Ghi chú nội bộ</h3>
          <p>Ghi chú tư vấn, hẹn giao và lưu ý đặc biệt cho đơn hàng.</p>
        </div>
      </div>
      <div className="staff-note-templates">
        {NOTE_TEMPLATES.map((text) => (
          <button key={text} type="button" onClick={() => applyNoteTemplate(text)}>
            {text}
          </button>
        ))}
      </div>
      <textarea
        className="staff-orders-textarea"
        value={consultationNote}
        onChange={(event) => setConsultationNote(event.target.value)}
        rows={6}
        placeholder="Nhập ghi chú xử lý đơn hàng"
      />
      <button type="button" className="staff-btn staff-btn--dark" onClick={handleSaveNote} disabled={Boolean(actionLoading)}>
        {actionLoading === "note" ? "Đang lưu..." : "Lưu ghi chú"}
      </button>
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

    const numericQuery = Number(query);
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

    const numericQuery = Number(query);
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
    if (!selectedOrderId) return;
    await Promise.all([loadOrderDetail(selectedOrderId), loadOrders(), loadStatsOrders()]);
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

    // Strict validation: Require serial numbers for all hardware items before shipping
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
  const canCancel = selectedOrder?.status === "PENDING";
  const currentFlowIndex = ORDER_FLOW.indexOf(selectedOrder?.status);

  const actionHelp = {
    processing: canMoveToProcessing ? "Xác nhận đơn và chuyển sang bước xử lý." : "Chỉ đơn chờ xử lý mới có thể xác nhận.",
    ship: canShip ? "Nhập mã vận đơn và chuyển đơn sang đang giao." : "Đơn phải ở trạng thái Đang xử lý trước khi giao hàng.",
    delivered: canMarkDelivered ? "Xác nhận đơn vị vận chuyển đã giao hàng. Khách hàng sẽ bấm xác nhận đã nhận hàng để hoàn tất." : "Đơn phải ở trạng thái Đang giao trước khi xác nhận đã giao.",
    cancel: canCancel ? "Hủy đơn khi đơn vẫn còn ở trạng thái chờ xử lý." : "Chỉ đơn chờ xử lý mới được hủy."
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

    return {
      status,
      meta: getStatusMeta(status),
      isDone,
      timestamp
    };
  });

  const actionButtons = [
    renderActionButton({
      key: "processing",
      enabled: canMoveToProcessing,
      label: "Xác nhận xử lý",
      loadingLabel: "Đang cập nhật...",
      onClick: handleMoveToProcessing,
      className: "staff-btn staff-btn--primary",
      title: actionHelp.processing
    }),
    renderActionButton({
      key: "ship",
      enabled: canShip,
      label: "Chuyển sang giao hàng",
      loadingLabel: "Đang cập nhật...",
      onClick: handleShipOrder,
      className: "staff-btn staff-btn--shipping",
      title: actionHelp.ship
    }),
    renderActionButton({
      key: "delivered",
      enabled: canMarkDelivered,
      label: "Xác nhận đã giao",
      loadingLabel: "Đang cập nhật...",
      onClick: handleMarkDelivered,
      className: "staff-btn staff-btn--success",
      title: actionHelp.delivered
    }),
    renderActionButton({
      key: "cancel",
      enabled: canCancel,
      label: "Hủy đơn",
      loadingLabel: "Đang xử lý...",
      onClick: () => setShowCancelDialog(true),
      className: "staff-btn staff-btn--danger",
      title: actionHelp.cancel
    })
  ];

  return (
    <div className="staff-orders-dashboard">
      <style>{`
        @keyframes staffOrderPulse { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .staff-orders-dashboard { width: min(1440px, calc(100% - 32px)); margin: 0 auto; display: grid; gap: 24px; padding: 24px 0 40px; }
        .staff-orders-hero { display: flex; justify-content: space-between; gap: 24px; align-items: center; padding: 28px 30px; border-radius: 28px; background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%); color: #fff; box-shadow: 0 22px 44px rgba(15, 23, 42, 0.16); }
        .staff-orders-hero__copy { max-width: 760px; }
        .staff-orders-hero__copy p { margin: 10px 0 0; color: #cbd5e1; line-height: 1.7; }
        .staff-orders-hero__actions { display: flex; flex-wrap: wrap; gap: 12px; justify-content: flex-end; }
        .staff-orders-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
        .staff-orders-stat { padding: 20px; border-radius: 22px; border: 1px solid #dbe4ef; background: #fff; box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06); display: grid; gap: 8px; }
        .staff-orders-stat__top { display: flex; justify-content: space-between; align-items: center; gap: 12px; color: #64748b; font-size: 13px; font-weight: 800; }
        .staff-orders-stat strong { font-size: 34px; color: #0f172a; line-height: 1; }
        .staff-orders-stat small { color: #64748b; }
        .staff-orders-layout { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 24px; align-items: start; }
        .staff-orders-panel, .staff-orders-detail { min-width: 0; border-radius: 24px; border: 1px solid #dbe4ef; background: rgba(255,255,255,0.94); box-shadow: 0 18px 42px rgba(15, 23, 42, 0.06); }
        .staff-orders-panel--sticky { position: sticky; top: 18px; }
        .staff-orders-panel__body, .staff-orders-detail__body { padding: 22px; display: grid; gap: 18px; min-width: 0; }
        .staff-orders-panel__stickyArea { display: grid; gap: 12px; position: sticky; top: 0; background: rgba(255,255,255,0.96); z-index: 2; }
        .staff-orders-panel__head, .staff-orders-section__head { display: flex; justify-content: space-between; gap: 16px; align-items: start; }
        .staff-orders-panel__head h2, .staff-orders-section__head h2, .staff-orders-section__head h3 { margin: 0; color: #0f172a; }
        .staff-orders-panel__head p, .staff-orders-section__head p { margin: 6px 0 0; color: #64748b; line-height: 1.6; }
        .staff-orders-toolbar { display: grid; gap: 12px; }
        .staff-orders-toolbar input, .staff-orders-toolbar select, .staff-orders-field, .staff-orders-textarea { width: 100%; box-sizing: border-box; border: 1px solid #dbe4ef; border-radius: 14px; background: #f8fafc; color: #0f172a; }
        .staff-orders-toolbar input, .staff-orders-toolbar select, .staff-orders-field { min-height: 46px; padding: 0 14px; font-weight: 650; }
        .staff-orders-tabs { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px; }
        .staff-orders-tabs button { border: 1px solid #dbe4ef; background: #fff; color: #475569; border-radius: 999px; min-height: 38px; padding: 0 14px; font-weight: 800; cursor: pointer; white-space: nowrap; }
        .staff-orders-tabs button.is-active { color: #1d4ed8; border-color: #93c5fd; background: #eff6ff; }
        .staff-orders-list { display: grid; gap: 12px; max-height: calc(100vh - 360px); overflow-y: auto; padding-right: 4px; }
        .staff-order-card { width: 100%; text-align: left; border: 1px solid #e2e8f0; border-radius: 18px; background: #fff; padding: 16px; display: grid; gap: 10px; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .staff-order-card:hover { transform: translateY(-1px); box-shadow: 0 14px 28px rgba(37, 99, 235, 0.10); }
        .staff-order-card--active { border-color: #60a5fa; box-shadow: 0 18px 30px rgba(37, 99, 235, 0.12); background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); }
        .staff-order-card__row { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; min-width: 0; }
        .staff-order-card__title { font-size: 16px; font-weight: 900; color: #0f172a; }
        .staff-order-card__customer { color: #0f172a; font-weight: 800; }
        .staff-order-card__meta { color: #64748b; font-size: 13px; min-width: 0; }
        .staff-order-card__amount { color: #1d4ed8; font-size: 18px; font-weight: 900; white-space: nowrap; }
        .staff-badge { display: inline-flex; align-items: center; justify-content: center; min-height: 28px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 900; white-space: nowrap; }
        .staff-badge--warning { color: #b45309; background: #fff7ed; }
        .staff-badge--info { color: #1d4ed8; background: #eff6ff; }
        .staff-badge--shipping { color: #6d28d9; background: #f5f3ff; }
        .staff-badge--success { color: #047857; background: #ecfdf5; }
        .staff-badge--danger { color: #b91c1c; background: #fef2f2; }
        .staff-badge--neutral { color: #475569; background: #f8fafc; }
        .staff-orders-empty { padding: 32px 20px; border-radius: 18px; background: #f8fafc; text-align: center; color: #64748b; }
        .staff-orders-alert { padding: 14px 16px; border-radius: 16px; font-weight: 800; }
        .staff-orders-alert--error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        .staff-orders-alert--success { background: #ecfdf5; color: #047857; border: 1px solid #bbf7d0; }
        .staff-detail-header { position: sticky; top: 0; z-index: 3; display: grid; gap: 18px; padding: 24px; border-bottom: 1px solid #e2e8f0; background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); }
        .staff-detail-header__top { display: flex; justify-content: space-between; gap: 18px; align-items: start; flex-wrap: wrap; }
        .staff-detail-header__top h2 { margin: 8px 0 0; font-size: 30px; color: #0f172a; }
        .staff-detail-header__top p { margin: 8px 0 0; color: #64748b; }
        .staff-detail-header__summary { text-align: right; }
        .staff-detail-header__summaryLabel { color: #64748b; font-size: 13px; font-weight: 800; }
        .staff-detail-header__summaryValue { margin-top: 6px; color: #1d4ed8; font-size: 30px; font-weight: 900; }
        .staff-detail-header__actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .staff-btn { min-height: 44px; border-radius: 14px; border: 1px solid transparent; cursor: pointer; padding: 0 16px; font-weight: 900; transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease; }
        .staff-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .staff-btn:disabled { cursor: not-allowed; opacity: .55; }
        .staff-btn--primary { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; box-shadow: 0 14px 26px rgba(37, 99, 235, 0.18); }
        .staff-btn--secondary { background: #fff; color: #0f172a; border-color: #dbe4ef; }
        .staff-btn--shipping { background: #0f766e; color: #fff; }
        .staff-btn--success { background: #059669; color: #fff; }
        .staff-btn--danger { background: #fff; color: #b91c1c; border-color: #fecaca; }
        .staff-btn--danger-fill { background: #dc2626; color: #fff; }
        .staff-btn--dark { background: #0f172a; color: #fff; }
        .staff-detail-grid { display: grid; gap: 20px; min-width: 0; }
        .staff-card { width: 100%; min-width: 0; border: 1px solid #e2e8f0; border-radius: 22px; background: #fff; padding: 20px; display: grid; gap: 16px; }
        .staff-info-list { display: grid; gap: 10px; min-width: 0; }
        .staff-info-row { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 12px; align-items: start; padding: 14px 16px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; min-width: 0; }
        .staff-info-row.is-full { grid-template-columns: 180px minmax(0, 1fr); }
        .staff-info-row span { color: #64748b; font-size: 12px; font-weight: 800; }
        .staff-info-row strong { color: #0f172a; font-size: 15px; line-height: 1.55; min-width: 0; }
        .staff-workspace-section { display: grid; gap: 20px; min-width: 0; }
        .staff-stepper { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
        .staff-step { padding: 14px; border-radius: 16px; border: 1px solid #e2e8f0; background: #fff; display: grid; gap: 8px; min-width: 0; }
        .staff-step--done { background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%); border-color: #bfdbfe; }
        .staff-step__index { width: 34px; height: 34px; border-radius: 999px; display: grid; place-items: center; font-weight: 900; background: #e2e8f0; color: #0f172a; }
        .staff-step--done .staff-step__index { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; }
        .staff-step strong { color: #0f172a; }
        .staff-step small { color: #64748b; line-height: 1.5; }
        .staff-items-table { display: grid; gap: 12px; min-width: 0; }
        .staff-items-table__head { display: grid; grid-template-columns: 72px minmax(0, 1fr) 72px 132px 132px; gap: 14px; padding: 0 16px; color: #64748b; font-size: 12px; font-weight: 800; }
        .staff-order-items { display: grid; gap: 12px; min-width: 0; }
        .staff-order-item { display: grid; grid-template-columns: 72px minmax(0, 1fr) 72px 132px 132px; gap: 14px; align-items: center; padding: 14px 16px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; min-width: 0; }
        .staff-order-item > * { min-width: 0; }
        .staff-order-thumb { width: 64px; height: 64px; border-radius: 14px; border: 1px solid #dbe4ef; background: #fff; display: grid; place-items: center; overflow: hidden; }
        .staff-order-thumb img { width: 100%; height: 100%; object-fit: contain; }
        .staff-order-thumb span { color: #94a3b8; font-size: 11px; font-weight: 900; }
        .staff-order-item__name strong { display: block; color: #0f172a; font-size: 15px; line-height: 1.45; word-break: normal; overflow-wrap: normal; }
        .staff-order-item__name span { display: block; margin-top: 4px; color: #64748b; font-size: 13px; }
        .staff-order-item__metric { display: grid; gap: 4px; justify-items: end; text-align: right; }
        .staff-order-item__metric strong { color: #0f172a; font-size: 15px; }
        .staff-order-item__mobileLabel { display: none; color: #64748b; font-size: 12px; font-weight: 800; }
        .staff-wrap-anywhere { overflow-wrap: anywhere; word-break: break-word; }
        .staff-field-stack { display: grid; gap: 12px; min-width: 0; }
        .staff-field-label { font-size: 13px; font-weight: 800; color: #475569; }
        .staff-orders-field { min-height: 46px; padding: 0 14px; font-weight: 650; }
        .staff-note-templates { display: flex; flex-wrap: wrap; gap: 10px; }
        .staff-note-templates button { padding: 10px 14px; border-radius: 999px; border: 1px solid #dbe4ef; background: #fff; color: #334155; cursor: pointer; font-weight: 700; line-height: 1.4; }
        .staff-orders-textarea { min-height: 138px; padding: 14px; border-radius: 14px; border: 1px solid #dbe4ef; background: #f8fafc; resize: vertical; font: inherit; }
        .staff-inline-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .staff-modal { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.44); display: grid; place-items: center; z-index: 70; padding: 20px; }
        .staff-modal__panel { width: min(560px, 100%); border-radius: 24px; background: #fff; padding: 24px; border: 1px solid #e2e8f0; box-shadow: 0 26px 60px rgba(15, 23, 42, 0.24); display: grid; gap: 16px; }
        .staff-modal__panel h2 { margin: 0; color: #0f172a; }
        .staff-modal__panel p { margin: 0; color: #64748b; line-height: 1.6; }
        .staff-modal__actions { display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap; }
        @media (max-width: 1279px) {
          .staff-orders-dashboard { width: min(100%, calc(100% - 24px)); }
          .staff-orders-layout { grid-template-columns: 320px minmax(0, 1fr); }
          .staff-orders-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .staff-stepper { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .staff-items-table__head, .staff-order-item { grid-template-columns: 72px minmax(0, 1fr) 72px 110px 110px; }
        }
        @media (max-width: 920px) {
          .staff-orders-hero, .staff-detail-header__top { display: grid; grid-template-columns: 1fr; }
          .staff-orders-layout, .staff-orders-stats, .staff-stepper { grid-template-columns: 1fr; }
          .staff-orders-panel--sticky, .staff-detail-header { position: static; }
          .staff-orders-list { max-height: none; }
          .staff-info-row { grid-template-columns: 1fr; }
          .staff-items-table__head { display: none; }
          .staff-order-item { grid-template-columns: 72px minmax(0, 1fr); }
          .staff-order-item__metric { justify-items: start; text-align: left; }
          .staff-order-item__mobileLabel { display: inline; }
        }
      `}</style>

      <div className="staff-orders-hero">
        <div className="staff-orders-hero__copy">
          <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.12em", color: "#93c5fd", fontWeight: 900 }}>Sales OMS</div>
          <h1 style={{ margin: "10px 0 0", fontSize: 34, lineHeight: 1.08 }}>Trung tâm vận hành đơn hàng</h1>
          <p>Theo dõi đơn chờ xử lý, cập nhật giao vận, xác nhận hoàn tất và lưu ghi chú tư vấn trong một dashboard vận hành gọn, rõ tầng thông tin.</p>
        </div>
        <div className="staff-orders-hero__actions">
          <Link to="/staff/chat" className="staff-btn staff-btn--secondary" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            Ticket tư vấn
          </Link>
          <button type="button" className="staff-btn staff-btn--secondary" onClick={refreshCurrentOrder} disabled={Boolean(actionLoading)}>
            Làm mới dữ liệu
          </button>
        </div>
      </div>

      <section className="staff-orders-stats" aria-label="Tổng quan OMS">
        <article className="staff-orders-stat">
          <div className="staff-orders-stat__top"><span>Đơn chờ xử lý</span><span>⏳</span></div>
          <strong>{stats.pending}</strong>
          <small>Cần xác nhận và phân luồng xử lý.</small>
        </article>
        <article className="staff-orders-stat">
          <div className="staff-orders-stat__top"><span>Đang xử lý</span><span>🧾</span></div>
          <strong>{stats.processing}</strong>
          <small>Đơn đã xác nhận, đang chuẩn bị giao.</small>
        </article>
        <article className="staff-orders-stat">
          <div className="staff-orders-stat__top"><span>Đang giao</span><span>🚚</span></div>
          <strong>{stats.shipped}</strong>
          <small>Đơn đã có vận đơn và đang trên đường.</small>
        </article>
        <article className="staff-orders-stat">
          <div className="staff-orders-stat__top"><span>Tổng giá trị hôm nay</span><span>₫</span></div>
          <strong>{formatCurrency(stats.todayValue)}</strong>
          <small>Tổng giá trị đơn tạo trong ngày hiện tại.</small>
        </article>
      </section>

      {errorMessage ? <div className="staff-orders-alert staff-orders-alert--error">{errorMessage}</div> : null}
      {successMessage ? <div className="staff-orders-alert staff-orders-alert--success">{successMessage}</div> : null}

      <div className="staff-orders-layout">
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

        <main className="staff-orders-detail">
          {detailLoading ? (
            <div className="staff-orders-detail__body">
              <DetailSkeleton />
            </div>
          ) : !selectedOrder ? (
            <div className="staff-orders-detail__body">
              <div className="staff-orders-empty">
                <strong style={{ display: "block", marginBottom: 8, color: "#0f172a" }}>Chưa chọn đơn hàng</strong>
                Chọn một đơn ở cột bên trái để xem chi tiết và thao tác.
              </div>
            </div>
          ) : (
            <div className="staff-orders-detail__body">
              <StaffOrderHeader
                selectedOrder={selectedOrder}
                selectedStatusMeta={selectedStatusMeta}
                customer={customer}
                actionButtons={actionButtons}
              />

              <div className="staff-workspace-section">
                <StaffOrderTimeline orderTimeline={orderTimeline} />
                <StaffCustomerInfo selectedOrder={selectedOrder} customer={customer} selectedStatusMeta={selectedStatusMeta} />
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
                <StaffPaymentPanel selectedOrder={selectedOrder} />
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
            </div>
          )}
        </main>
      </div>

      {showCancelDialog ? (
        <div className="staff-modal">
          <div className="staff-modal__panel">
            <h2>Hủy đơn #{selectedOrder?.id}</h2>
            <p>Nhập lý do hủy đơn. Hành động này chỉ áp dụng cho đơn đang chờ xử lý.</p>
            <textarea
              className="staff-orders-textarea"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              rows={4}
              placeholder="Lý do hủy đơn"
            />
            <div className="staff-modal__actions">
              <button type="button" className="staff-btn staff-btn--danger-fill" onClick={handleCancelOrder} disabled={Boolean(actionLoading)}>
                {actionLoading === "cancel" ? "Đang xử lý..." : "Xác nhận hủy"}
              </button>
              <button
                type="button"
                className="staff-btn staff-btn--secondary"
                onClick={() => {
                  setShowCancelDialog(false);
                  setCancelReason("");
                }}
              >
                Quay lại
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
