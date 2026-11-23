import { getOrderStatusMeta } from "../../utils/orderStatus";

export function OrderStatusBadge({ status, paymentMethod, paymentStatus }) {
  const normalizedStatus = String(status || "").toUpperCase();
  const normalizedMethod = String(paymentMethod || "").toUpperCase();
  const normalizedPayStatus = String(paymentStatus || "").toUpperCase();

  let meta = getOrderStatusMeta(status);

  if (normalizedStatus === "PENDING" && normalizedMethod && normalizedMethod !== "COD" && normalizedPayStatus !== "PAID") {
    if (["FAILED", "PAYMENT_CANCELLED", "REJECTED"].includes(normalizedPayStatus)) {
      meta = {
        label: "Chờ thanh toán lại",
        tone: "#b91c1c",
        bg: "#fef2f2",
        border: "#fecaca"
      };
    } else if (["AWAITING_ADMIN_CONFIRMATION", "PENDING_VERIFICATION"].includes(normalizedPayStatus)) {
      meta = {
        label: "Chờ duyệt thanh toán",
        tone: "#1d4ed8",
        bg: "#eff6ff",
        border: "#bfdbfe"
      };
    } else {
      meta = {
        label: "Chờ thanh toán",
        tone: "#b45309",
        bg: "#fffbeb",
        border: "#fde68a"
      };
    }
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 800,
        color: meta.tone,
        background: meta.bg,
        border: `1px solid ${meta.border}`
      }}
    >
      {meta.label}
    </span>
  );
}
