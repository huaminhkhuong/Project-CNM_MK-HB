export const ORDER_STATUS_META = {
  PENDING: { label: "Chờ xác nhận", tone: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  PAID: { label: "Đã thanh toán", tone: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
  PROCESSING: { label: "Đang xử lý", tone: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  SHIPPED: { label: "Đang giao", tone: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe" },
  DELIVERED: { label: "Đã giao", tone: "#0f766e", bg: "#f0fdfa", border: "#99f6e4" },
  COMPLETED: { label: "Hoàn thành", tone: "#047857", bg: "#ecfdf5", border: "#86efac" },
  CANCELED: { label: "Đã hủy", tone: "#b91c1c", bg: "#fef2f2", border: "#fecaca" }
};

export const PAYMENT_STATUS_META = {
  UNPAID: { label: "Chưa thanh toán", tone: "#b45309" },
  PENDING_GATEWAY: { label: "Đang chờ cổng thanh toán", tone: "#1d4ed8" },
  AWAITING_ADMIN_CONFIRMATION: { label: "Chờ admin xác nhận", tone: "#1d4ed8" },
  PENDING_VERIFICATION: { label: "Chờ admin xác nhận", tone: "#1d4ed8" },
  PAID: { label: "Đã thanh toán", tone: "#047857" },
  REJECTED: { label: "Thanh toán bị từ chối", tone: "#b91c1c" },
  FAILED: { label: "Thanh toán thất bại", tone: "#b91c1c" },
  EXPIRED: { label: "Hết hạn thanh toán (Đã hoàn kho)", tone: "#dc2626" },
  CANCELED: { label: "Đã hủy thanh toán", tone: "#64748b" },
  PAYMENT_CANCELLED: { label: "Đã hủy thanh toán", tone: "#64748b" }
};

export function getOrderStatusLabel(status) {
  return ORDER_STATUS_META[String(status || "").toUpperCase()]?.label || status || "Chưa cập nhật";
}

export function getOrderStatusMeta(status) {
  return ORDER_STATUS_META[String(status || "").toUpperCase()] || {
    label: status || "Chưa cập nhật",
    tone: "#64748b",
    bg: "#f8fafc",
    border: "#e2e8f0"
  };
}

export function canCustomerCancelOrder(order) {
  return String(order?.status || "").toUpperCase() === "PENDING";
}

export function canCustomerPayOrder(order) {
  const status = String(order?.status || "").toUpperCase();
  const paymentStatus = String(order?.paymentStatus || order?.payment_status || "").toUpperCase();
  const method = String(order?.paymentMethod || order?.payment_method || "").toUpperCase();
  return status === "PENDING" && method === "VNPAY" && paymentStatus !== "PAID";
}

export function canCustomerConfirmReceived(order) {
  return String(order?.status || "").toUpperCase() === "DELIVERED";
}
