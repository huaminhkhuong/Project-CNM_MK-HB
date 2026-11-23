import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";

import { OrderStatusBadge } from "../../components/marketplace/OrderStatusBadge";
import { useAuth } from "../../hooks/useAuth";
import { addItemToCart } from "../../services/cart.service";
import { cancelMyOrder, confirmOrderReceived, createVnpayUrl, getOrderDetail } from "../../services/order.service";
import { subscribeToOrderEvents } from "../../services/order-events.service";
import { routeConfig } from "../../routes/routeConfig";
import {
  PAYMENT_STATUS_META,
  canCustomerCancelOrder,
  canCustomerConfirmReceived,
  canCustomerPayOrder,
  canCustomerPayVietQr,
  getOrderStatusLabel
} from "../../utils/orderStatus";
import { resolveProductImage } from "../../utils/productImage";
import { BANK_ACCOUNT_CONFIG, generateOrderTransferNote, generateSePayQrUrl, generateVietQrUrl } from "../../config/bank-account";
import { getPublicStoreInfo } from "../../services/store-info.service";

/* ── Inline SVG Icons (Crisp E-Commerce Set) ─────────────────────────────── */
const ArrowLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const PrinterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

const ReceiptIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
    <path d="M8 7h8M8 11h8M8 15h5" />
  </svg>
);

const ShieldCheckIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const PackageIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="m16.5 9.4-9-5.19" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const TruckIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" rx="1" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const StarCheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const MapPinIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const StoreIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
    <path d="M2 7h20" />
    <path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />
  </svg>
);

const QrIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="6" height="6" rx="1" />
    <rect x="15" y="3" width="6" height="6" rx="1" />
    <rect x="3" y="15" width="6" height="6" rx="1" />
    <path d="M15 15h2v2h-2zM19 15h2M15 19h6M11 3v6M3 11h6M11 15v6" />
  </svg>
);

const CartRefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </svg>
);

const HeadsetIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
  </svg>
);

const XCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6M9 9l6 6" />
  </svg>
);

const BankIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18" />
    <path d="M5 21V10M9 21V10M15 21V10M19 21V10" />
    <path d="M2 10l10-7 10 7H2z" />
  </svg>
);

/* ── Data Normalizers & Helpers ──────────────────────────────────────────── */
function getErrorMessage(error, fallbackMessage) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallbackMessage;
  }
  return error?.message || fallbackMessage;
}

function normalizeResponse(response) {
  return response?.data?.data || response?.data || response;
}

function parseSerialNumbers(item) {
  if (Array.isArray(item?.serialNumbers) && item.serialNumbers.length > 0) {
    return item.serialNumbers.filter(Boolean);
  }
  if (Array.isArray(item?.OrderItemSerial) && item.OrderItemSerial.length > 0) {
    return item.OrderItemSerial.map((s) => s?.serial_number).filter(Boolean);
  }
  if (typeof item?.serial_numbers === "string" && item.serial_numbers.trim()) {
    try {
      const parsed = JSON.parse(item.serial_numbers);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      return item.serial_numbers.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function mapDbOrderToUi(dbOrder) {
  if (!dbOrder) return null;

  const shipment = dbOrder.shipment || null;

  return {
    id: dbOrder.id,
    status: dbOrder.status,
    paymentMethod: dbOrder.payment_method || dbOrder.paymentMethod,
    paymentStatus: dbOrder.payment_status || dbOrder.paymentStatus,
    paymentProof: dbOrder.payment_proof || dbOrder.paymentProof,
    transactionCode: dbOrder.transactionCode || dbOrder.transaction_code || null,
    shippingAddress: dbOrder.shipping_address || dbOrder.shippingAddress,
    createdAt: dbOrder.created_at || dbOrder.createdAt,
    updatedAt: dbOrder.updated_at || dbOrder.updatedAt || null,
    note: dbOrder.note,
    customer: dbOrder.customer || dbOrder.User || null,
    trackingCode: shipment?.trackingCode || dbOrder.tracking_code || dbOrder.trackingCode,
    shipmentStatus: shipment?.status || null,
    shipmentCarrier: shipment?.carrier || null,
    totalAmount: dbOrder.total_amount || dbOrder.totalAmount,
    shippingFee: dbOrder.shipping_fee || dbOrder.shippingFee || 0,
    discountAmount: dbOrder.discount_amount || dbOrder.discountAmount || 0,
    couponCode: dbOrder.coupon_code || dbOrder.couponCode || null,
    finalAmount: dbOrder.final_amount || dbOrder.finalAmount || dbOrder.total_amount || dbOrder.totalAmount || 0,
    items: (dbOrder.OrderItem || dbOrder.items || []).map((item) => ({
      id: item.id,
      productId: item.product_id || item.productId || item.ProductSku?.product_id || null,
      productVariantId: item.product_variant_id || item.productVariantId || item.ProductSku?.id || null,
      productName: item.name_snapshot || item.nameSnapshot || item.productName || item.product?.name || "Sản phẩm",
      sku: item.sku_snapshot || item.skuSnapshot || item.sku,
      quantity: item.quantity,
      unitPrice: item.unit_price || item.unitPrice,
      lineTotal: item.line_total || item.lineTotal,
      imageUrl: item.ProductSku?.image_url || item.ProductSku?.imageUrl || item.imageUrl || item.product?.imageUrl || null,
      serialNumbers: parseSerialNumbers(item)
    }))
  };
}

function getPaymentMethodLabel(method) {
  const normalized = String(method || "").toUpperCase();
  if (normalized === "BANK_TRANSFER") return "Chuyển khoản VietQR (SePay)";
  if (normalized === "VNPAY") return "Cổng thanh toán VNPay";
  return "Thanh toán khi nhận hàng (COD)";
}

function getPaymentStatusMeta(status, method) {
  const normalized = String(status || "").toUpperCase();
  if (String(method || "").toUpperCase() === "BANK_TRANSFER" && ["PENDING_GATEWAY", "UNPAID", ""].includes(normalized)) {
    return { label: "Chờ chuyển khoản VietQR", tone: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" };
  }
  if (normalized === "AWAITING_ADMIN_CONFIRMATION" || normalized === "PENDING_VERIFICATION") {
    return { label: "Chờ xác nhận thanh toán", tone: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" };
  }
  if (normalized === "PAID") {
    return { label: "Đã thanh toán", tone: "#047857", bg: "#ecfdf5", border: "#a7f3d0" };
  }
  const base = PAYMENT_STATUS_META[normalized] || { label: status || "Chưa thanh toán", tone: "#64748b" };
  return {
    ...base,
    bg: normalized === "FAILED" || normalized === "EXPIRED" || normalized === "REJECTED" ? "#fef2f2" : "#f8fafc",
    border: normalized === "FAILED" || normalized === "EXPIRED" || normalized === "REJECTED" ? "#fecaca" : "#e2e8f0"
  };
}

function parseRecipientFromShippingAddress(shippingAddress, fallbackUser) {
  const parts = String(shippingAddress || "")
    .split(" - ")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    name: parts[0] || fallbackUser?.fullName || fallbackUser?.full_name || fallbackUser?.email || "Chưa có dữ liệu",
    phone: parts[1] || fallbackUser?.phone || "Chưa có dữ liệu",
    address: parts.slice(2).join(" - ") || shippingAddress || "Chưa có dữ liệu"
  };
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function formatBankAccountDisplay(accountNumber) {
  const digits = String(accountNumber || "").replace(/\s+/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatDate(dateValue) {
  if (!dateValue) return "—";
  try {
    return new Date(dateValue).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch {
    return String(dateValue);
  }
}

function getShipmentStatusLabel(status) {
  const labels = {
    CREATED: "Đã tạo vận đơn",
    READY_TO_SHIP: "Sẵn sàng bàn giao",
    IN_TRANSIT: "Đang vận chuyển",
    DELIVERED: "Đã giao thành công",
    FAILED: "Giao thất bại",
    RETURNED: "Đã hoàn hàng",
    CANCELED: "Đã hủy vận đơn"
  };
  return labels[String(status || "").toUpperCase()] || status || "Đang cập nhật";
}

function getOrderHeroSummary(order) {
  const status = String(order?.status || "").toUpperCase();
  const payStatus = String(order?.paymentStatus || "").toUpperCase();
  const method = String(order?.paymentMethod || "").toUpperCase();

  if (status === "CANCELED") {
    return {
      accent: "#dc2626",
      softBg: "#fef2f2",
      headline: "Đơn hàng đã bị hủy",
      subline:
        payStatus === "EXPIRED"
          ? "Phiên thanh toán đã quá hạn giữ hàng nên hệ thống tự động hủy đơn và hoàn kho."
          : "Đơn hàng này đã dừng xử lý. Bạn có thể đặt lại sản phẩm bất cứ lúc nào."
    };
  }

  if (status === "COMPLETED") {
    return {
      accent: "#059669",
      softBg: "#ecfdf5",
      headline: "Đơn hàng đã hoàn tất",
      subline: "Cảm ơn bạn đã tin tưởng mua sắm linh kiện chính hãng tại PC Mall."
    };
  }

  if (status === "DELIVERED") {
    return {
      accent: "#0f766e",
      softBg: "#f0fdfa",
      headline: "Đơn hàng đã được giao thành công",
      subline: "Hãy kiểm tra kỹ linh kiện và bấm Xác nhận đã nhận hàng để kích hoạt trọn vẹn bảo hành."
    };
  }

  if (status === "SHIPPED") {
    return {
      accent: "#6d28d9",
      softBg: "#f5f3ff",
      headline: "Đơn hàng đang trên đường giao tới bạn",
      subline: order?.trackingCode
        ? `Đơn vị vận chuyển đang giao kiện hàng với mã vận đơn ${order.trackingCode}.`
        : "Kiện hàng đã rời kho PC Mall và đang được luân chuyển tới địa chỉ nhận."
    };
  }

  if (status === "PROCESSING" || status === "PAID") {
    return {
      accent: "#2563eb",
      softBg: "#eff6ff",
      headline: "Kho PC Mall đang chuẩn bị & đóng gói linh kiện",
      subline:
        payStatus === "PAID"
          ? "Thanh toán đã được xác nhận tự động. Kỹ thuật viên đang kiểm tra tem S/N và đóng gói đơn hàng."
          : "Đơn hàng đã được xác nhận và đang trong quy trình đóng gói xuất kho."
    };
  }

  if (method !== "COD" && payStatus !== "PAID") {
    const isFailed = ["FAILED", "PAYMENT_CANCELLED", "REJECTED"].includes(payStatus);
    return {
      accent: isFailed ? "#dc2626" : "#d97706",
      softBg: isFailed ? "#fef2f2" : "#fffbeb",
      headline: isFailed ? "Thanh toán chưa hoàn tất — Cần thanh toán lại" : "Đơn hàng đang chờ bạn hoàn tất thanh toán",
      subline:
        method === "BANK_TRANSFER"
          ? "Quét mã VietQR bên dưới — hệ thống tự động đối soát qua SePay và duyệt đơn trong 2–5 giây."
          : "Đơn hàng được giữ tồn kho trong 30 phút. Hoàn tất thanh toán VNPay để kho lập tức xử lý."
    };
  }

  return {
    accent: "#d97706",
    softBg: "#fffbeb",
    headline: "Đơn hàng đã được tiếp nhận, chờ xác nhận",
    subline: "Bộ phận bán hàng PC Mall sẽ xác nhận và chuyển sang đóng gói trong thời gian sớm nhất."
  };
}

function buildOrderSteps(order) {
  const status = String(order?.status || "").toUpperCase();
  const payStatus = String(order?.paymentStatus || "").toUpperCase();
  const method = String(order?.paymentMethod || "").toUpperCase();

  let activeIndex = 1;
  if (status === "PENDING") {
    activeIndex = 1;
  } else if (status === "PAID" || status === "PROCESSING") {
    activeIndex = 2;
  } else if (status === "SHIPPED") {
    activeIndex = 3;
  } else if (status === "DELIVERED") {
    activeIndex = 4;
  } else if (status === "COMPLETED") {
    activeIndex = 5;
  }

  const paymentStepSub =
    payStatus === "PAID"
      ? method === "BANK_TRANSFER"
        ? "Đã nhận qua SePay"
        : "Đã thanh toán"
      : method === "COD"
        ? activeIndex >= 2
          ? "Đã xác nhận COD"
          : "Chờ xác nhận"
        : "Chờ thanh toán";

  const rawSteps = [
    {
      key: "placed",
      label: "Đặt hàng",
      sub: order?.createdAt ? formatDate(order.createdAt) : "Đã tiếp nhận",
      icon: ReceiptIcon
    },
    {
      key: "confirmed",
      label: method === "COD" ? "Xác nhận đơn" : "Thanh toán",
      sub: paymentStepSub,
      icon: ShieldCheckIcon
    },
    {
      key: "packing",
      label: "Đóng gói xuất kho",
      sub: activeIndex > 2 ? "Đã xuất kho" : activeIndex === 2 ? "Đang chuẩn bị" : "Chờ xử lý",
      icon: PackageIcon
    },
    {
      key: "shipping",
      label: "Đang vận chuyển",
      sub: order?.trackingCode ? order.trackingCode : activeIndex > 3 ? "Đã giao ĐVVC" : "Chờ bàn giao",
      icon: TruckIcon
    },
    {
      key: "completed",
      label: "Hoàn tất",
      sub: status === "COMPLETED" ? "Đã nhận hàng" : status === "DELIVERED" ? "Chờ xác nhận" : "Nhận & bảo hành",
      icon: StarCheckIcon
    }
  ];

  return {
    activeIndex,
    progressPercent: Math.min(100, Math.max(0, (Math.min(activeIndex, 4) / 4) * 100)),
    steps: rawSteps.map((step, index) => ({
      ...step,
      state:
        status === "COMPLETED"
          ? "done"
          : index < activeIndex
            ? "done"
            : index === activeIndex
              ? "current"
              : "upcoming"
    }))
  };
}

export function OrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, authState } = useAuth();
  const user = authState?.user;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedField, setCopiedField] = useState("");
  const [storeInfo, setStoreInfo] = useState({
    bankName: BANK_ACCOUNT_CONFIG.bankName,
    bankAccountNumber: BANK_ACCOUNT_CONFIG.accountNumber,
    bankAccountHolder: BANK_ACCOUNT_CONFIG.accountHolder,
    storeHotline: BANK_ACCOUNT_CONFIG.hotline,
    storeTaxId: BANK_ACCOUNT_CONFIG.taxId,
    storeAddress: BANK_ACCOUNT_CONFIG.address,
    transferNotePrefix: BANK_ACCOUNT_CONFIG.transferNote
  });

  useEffect(() => {
    let mounted = true;
    getPublicStoreInfo()
      .then((info) => {
        if (mounted && info) {
          setStoreInfo(info);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const reloadOrder = useCallback(
    async ({ silent = true } = {}) => {
      if (!orderId) return;
      if (!silent) {
        setLoading(true);
      }
      const response = await getOrderDetail(orderId);
      const rawData = normalizeResponse(response);
      setOrder(mapDbOrderToUi(rawData));
      if (!silent) {
        setLoading(false);
      }
    },
    [orderId]
  );

  useEffect(() => {
    if (!isAuthenticated || !orderId) {
      setLoading(false);
      return undefined;
    }

    async function loadOrder() {
      try {
        setErrorMessage("");
        await reloadOrder({ silent: false });
      } catch (error) {
        setErrorMessage(getErrorMessage(error, "Không thể tải chi tiết đơn hàng"));
        setLoading(false);
      }
    }

    loadOrder();
    return undefined;
  }, [isAuthenticated, orderId, reloadOrder]);

  useEffect(() => {
    if (!isAuthenticated || !orderId) return undefined;

    const intervalId = window.setInterval(() => {
      reloadOrder({ silent: true }).catch(() => {});
    }, 8000);

    const unsubscribe = subscribeToOrderEvents((event) => {
      if (!event?.orderId || String(event.orderId) === String(orderId)) {
        reloadOrder({ silent: true }).catch(() => {});
      }
    });

    return () => {
      window.clearInterval(intervalId);
      unsubscribe();
    };
  }, [isAuthenticated, orderId, reloadOrder]);

  async function handlePrintInvoice() {
    window.print();
  }

  async function handleCancelOrder() {
    if (!confirm(`Hủy đơn hàng #${orderId}?`)) return;
    try {
      setActionLoading(true);
      setErrorMessage("");
      await cancelMyOrder(orderId);
      setSuccessMessage("Đã hủy đơn hàng thành công.");
      await reloadOrder();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể hủy đơn hàng"));
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePayOrder() {
    try {
      setActionLoading(true);
      setErrorMessage("");
      const urlRes = await createVnpayUrl(orderId, { amount: Number(order?.finalAmount || 0) });
      const urlData = urlRes?.data?.data || urlRes?.data || urlRes;
      if (urlData?.paymentUrl) {
        window.location.href = urlData.paymentUrl;
        return;
      }
      throw new Error("Không lấy được liên kết thanh toán");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể thanh toán"));
      setActionLoading(false);
    }
  }

  async function handleConfirmReceived() {
    if (!confirm(`Xác nhận bạn đã nhận đủ hàng cho đơn #${orderId}?`)) return;
    try {
      setActionLoading(true);
      setErrorMessage("");
      await confirmOrderReceived(orderId);
      setSuccessMessage("Đã xác nhận nhận hàng. Đơn hàng đã hoàn tất.");
      await reloadOrder({ silent: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể xác nhận nhận hàng"));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReorder() {
    const items = Array.isArray(order?.items) ? order.items : [];
    const reorderable = items.filter((item) => item.productVariantId || item.productId);
    if (reorderable.length === 0) {
      navigate(routeConfig.public.catalog);
      return;
    }

    try {
      setActionLoading(true);
      setErrorMessage("");
      let addedCount = 0;
      for (const item of reorderable) {
        try {
          await addItemToCart({
            ...(item.productId ? { productId: Number(item.productId) } : {}),
            ...(item.productVariantId ? { productVariantId: Number(item.productVariantId) } : {}),
            quantity: Math.max(1, Number(item.quantity || 1))
          });
          addedCount += 1;
        } catch {
          // Skip out of stock items
        }
      }
      if (addedCount > 0) {
        navigate(routeConfig.public.cart);
      } else {
        setErrorMessage("Các sản phẩm trong đơn hàng này hiện đã hết hàng hoặc ngừng kinh doanh.");
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCopyText(field, value) {
    if (!value) return;
    const text = String(value);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopiedField(field);
    window.setTimeout(() => {
      setCopiedField((prev) => (prev === field ? "" : prev));
    }, 2000);
  }

  const itemCount = useMemo(
    () => (order?.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [order]
  );
  const recipient = useMemo(
    () => parseRecipientFromShippingAddress(order?.shippingAddress, order?.customer || user),
    [order, user]
  );
  const paymentStatusMeta = getPaymentStatusMeta(order?.paymentStatus, order?.paymentMethod);
  const normalizedPaymentStatus = String(order?.paymentStatus || "").toUpperCase();
  const normalizedOrderStatus = String(order?.status || "").toUpperCase();
  const bankName = storeInfo.bankName || BANK_ACCOUNT_CONFIG.bankName;
  const bankAccountNumber = storeInfo.bankAccountNumber || BANK_ACCOUNT_CONFIG.accountNumber;
  const bankAccountHolder = storeInfo.bankAccountHolder || BANK_ACCOUNT_CONFIG.accountHolder;
  const customerPhoneForTransfer =
    user?.phone || (recipient?.phone && recipient.phone !== "Chưa có dữ liệu" ? recipient.phone : "");
  const transferMemo = generateOrderTransferNote(
    order?.id,
    customerPhoneForTransfer,
    storeInfo.transferNotePrefix || BANK_ACCOUNT_CONFIG.transferNote
  );
  const sepayQrUrl = useMemo(
    () =>
      generateSePayQrUrl({
        bankName,
        accountNumber: bankAccountNumber,
        amount: Math.round(Number(order?.finalAmount || 0)),
        memo: transferMemo
      }),
    [bankName, bankAccountNumber, order?.finalAmount, transferMemo]
  );
  const vietQrUrl = useMemo(
    () =>
      generateVietQrUrl({
        bankName,
        accountNumber: bankAccountNumber,
        accountHolder: bankAccountHolder,
        amount: Math.round(Number(order?.finalAmount || 0)),
        memo: transferMemo
      }),
    [bankName, bankAccountNumber, bankAccountHolder, order?.finalAmount, transferMemo]
  );
  const showVietQrBox =
    order?.paymentMethod === "BANK_TRANSFER" &&
    normalizedOrderStatus !== "CANCELED" &&
    normalizedPaymentStatus !== "PAID" &&
    normalizedPaymentStatus !== "EXPIRED";
  const canConfirmReceived = canCustomerConfirmReceived(order);
  const canCancel = canCustomerCancelOrder(order);
  const canPayVietQr = canCustomerPayVietQr(order);
  const canPayVnpay = canCustomerPayOrder(order);
  const heroSummary = useMemo(() => getOrderHeroSummary(order), [order]);
  const timeline = useMemo(() => buildOrderSteps(order), [order]);

  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: 560, margin: "48px auto", padding: 36, borderRadius: 24, background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 12px 32px rgba(15, 23, 42, 0.06)", textAlign: "center", display: "grid", gap: 14 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Chi tiết đơn hàng</h1>
        <p style={{ margin: 0, color: "#64748b", fontSize: 14.5 }}>Bạn cần đăng nhập để theo dõi trạng thái và lịch sử đơn hàng của mình.</p>
        <div style={{ marginTop: 8 }}>
          <Link
            to={routeConfig.public.login}
            style={{ display: "inline-flex", alignItems: "center", padding: "12px 24px", borderRadius: 12, background: "#2563eb", color: "#fff", fontWeight: 800, textDecoration: "none", fontSize: 14 }}
          >
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 20 }}>
        <style>{`
          @keyframes odShimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          .od-skel {
            border-radius: 18px;
            background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
            background-size: 200% 100%;
            animation: odShimmer 1.4s ease infinite;
          }
        `}</style>
        <div className="od-skel" style={{ height: 48, width: "40%" }} />
        <div className="od-skel" style={{ height: 180 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1.55fr 0.95fr", gap: 22 }}>
          <div className="od-skel" style={{ height: 340 }} />
          <div className="od-skel" style={{ height: 340 }} />
        </div>
      </div>
    );
  }

  if (errorMessage && !order) {
    return (
      <div style={{ maxWidth: 640, margin: "32px auto", display: "grid", gap: 16 }}>
        <div style={{ padding: 20, borderRadius: 18, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontWeight: 600 }}>
          {errorMessage}
        </div>
        <div>
          <button
            type="button"
            onClick={() => navigate(routeConfig.public.orders)}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 12, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", cursor: "pointer", fontWeight: 700 }}
          >
            <ArrowLeftIcon /> Quay lại danh sách đơn hàng
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const shippingFeeNumber = Number(order.shippingFee || 0);
  const discountNumber = Number(order.discountAmount || 0);

  return (
    <div className="od-page">
      <style>{`
        .od-page {
          max-width: 1220px;
          margin: 0 auto;
          display: grid;
          gap: 20px;
          padding-bottom: 36px;
        }
        /* Top Breadcrumb & Toolbar */
        .od-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }
        .od-topbar__left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .od-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 12px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          color: #334155;
          font-size: 13.5px;
          font-weight: 750;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.18s ease;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.03);
        }
        .od-back-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
          transform: translateX(-2px);
        }
        .od-crumb {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #64748b;
          font-weight: 600;
        }
        .od-crumb a {
          color: #64748b;
          text-decoration: none;
        }
        .od-crumb a:hover {
          color: #2563eb;
        }
        .od-crumb__current {
          color: #0f172a;
          font-weight: 800;
        }
        .od-topbar__right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .od-code-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 12px;
          border-radius: 11px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #0f172a;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.18s ease;
        }
        .od-code-pill:hover {
          border-color: #93c5fd;
          background: #eff6ff;
          color: #1d4ed8;
        }
        .od-code-pill.copied {
          background: #ecfdf5;
          border-color: #86efac;
          color: #047857;
        }
        .od-print-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 15px;
          border-radius: 11px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #0f172a;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
          transition: all 0.18s ease;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.03);
        }
        .od-print-btn:hover {
          background: #0f172a;
          color: #ffffff;
          border-color: #0f172a;
        }

        /* Hero Tracker Card */
        .od-hero-card {
          position: relative;
          border-radius: 24px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.08);
          overflow: hidden;
        }
        .od-hero-accent {
          height: 4px;
          width: 100%;
          background: var(--hero-accent, #2563eb);
        }
        .od-hero-head {
          padding: 24px 28px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
          border-bottom: 1px solid #f1f5f9;
          background: linear-gradient(180deg, var(--hero-soft-bg, #f8fafc) 0%, #ffffff 100%);
        }
        .od-hero-status-wrap {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          min-width: 0;
          flex: 1 1 360px;
        }
        .od-hero-icon {
          width: 48px;
          height: 48px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          background: var(--hero-accent, #2563eb);
          color: #ffffff;
          flex-shrink: 0;
          box-shadow: 0 10px 22px -6px color-mix(in srgb, var(--hero-accent, #2563eb) 50%, transparent);
        }
        .od-hero-eyebrow {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 6px;
        }
        .od-hero-date {
          font-size: 12.5px;
          color: #64748b;
          font-weight: 600;
        }
        .od-hero-title {
          margin: 0;
          font-size: 21px;
          font-weight: 850;
          color: #0f172a;
          letter-spacing: -0.02em;
          line-height: 1.3;
        }
        .od-hero-sub {
          margin: 5px 0 0;
          font-size: 13.5px;
          color: #475569;
          line-height: 1.5;
          font-weight: 500;
        }
        .od-hero-cta {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          flex-shrink: 0;
        }

        /* 5-Step E-Commerce Tracking Stepper */
        @keyframes odStepPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.32); }
          50% { box-shadow: 0 0 0 8px rgba(37, 99, 235, 0); }
        }
        .od-stepper-wrap {
          padding: 26px 28px 28px;
          background: #ffffff;
        }
        .od-stepper {
          position: relative;
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
        }
        .od-stepper-rail {
          position: absolute;
          top: 22px;
          left: 10%;
          right: 10%;
          height: 3px;
          background: #e2e8f0;
          border-radius: 999px;
          z-index: 0;
        }
        .od-stepper-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #10b981 0%, #2563eb 100%);
          transition: width 0.45s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .od-step {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 10px;
        }
        .od-step-dot {
          width: 44px;
          height: 44px;
          border-radius: 15px;
          display: grid;
          place-items: center;
          border: 2px solid #e2e8f0;
          background: #ffffff;
          color: #94a3b8;
          transition: all 0.25s ease;
        }
        .od-step.done .od-step-dot {
          border-color: #10b981;
          background: linear-gradient(135deg, #059669, #10b981);
          color: #ffffff;
          box-shadow: 0 8px 18px -4px rgba(16, 185, 129, 0.38);
        }
        .od-step.current .od-step-dot {
          border-color: #2563eb;
          background: #2563eb;
          color: #ffffff;
          animation: odStepPulse 2.2s ease-in-out infinite;
        }
        .od-step-label {
          font-size: 13px;
          font-weight: 800;
          color: #94a3b8;
          line-height: 1.3;
        }
        .od-step.done .od-step-label,
        .od-step.current .od-step-label {
          color: #0f172a;
        }
        .od-step-sub {
          font-size: 11.5px;
          color: #64748b;
          font-weight: 600;
          line-height: 1.35;
          max-width: 150px;
          word-break: break-word;
        }
        .od-step.current .od-step-sub {
          color: #2563eb;
          font-weight: 700;
        }

        /* Main 2-Column Workspace */
        .od-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.58fr) minmax(320px, 0.92fr);
          gap: 22px;
          align-items: start;
        }
        .od-col-main {
          display: grid;
          gap: 20px;
          min-width: 0;
        }
        .od-col-side {
          display: grid;
          gap: 18px;
          position: sticky;
          top: 24px;
        }

        /* Shared Card Surface */
        .od-card {
          border-radius: 22px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 8px 24px -10px rgba(15, 23, 42, 0.06);
          overflow: hidden;
        }
        .od-card-head {
          padding: 18px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          border-bottom: 1px solid #f1f5f9;
        }
        .od-card-title {
          margin: 0;
          font-size: 16px;
          font-weight: 850;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 9px;
          letter-spacing: -0.01em;
        }

        /* Official Store Badge & Product Rows */
        .od-store-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 8px;
          background: linear-gradient(135deg, #1e3a8a, #2563eb);
          color: #ffffff;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.02em;
        }
        .od-item-list {
          display: grid;
        }
        .od-item-row {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 20px 24px;
          border-bottom: 1px solid #f1f5f9;
          transition: background 0.16s ease;
        }
        .od-item-row:last-child {
          border-bottom: none;
        }
        .od-item-row:hover {
          background: #fafcff;
        }
        .od-item-thumb {
          width: 78px;
          height: 78px;
          border-radius: 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          overflow: hidden;
          padding: 6px;
        }
        .od-item-thumb img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .od-item-info {
          flex: 1;
          min-width: 0;
          display: flex;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .od-item-name {
          font-size: 15.5px;
          font-weight: 800;
          color: #0f172a;
          text-decoration: none;
          line-height: 1.4;
          display: inline-block;
        }
        .od-item-name:hover {
          color: #2563eb;
        }
        .od-item-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 7px;
        }
        .od-sku-chip {
          padding: 3px 9px;
          border-radius: 7px;
          background: #f1f5f9;
          color: #475569;
          font-size: 11.5px;
          font-weight: 700;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        .od-qty-chip {
          padding: 3px 9px;
          border-radius: 7px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 11.5px;
          font-weight: 800;
        }
        .od-sn-row {
          margin-top: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .od-sn-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 9px;
          border-radius: 7px;
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          color: #0369a1;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11.5px;
          font-weight: 700;
          text-decoration: none;
          transition: all 0.15s ease;
        }
        .od-sn-chip:hover {
          background: #e0f2fe;
          border-color: #38bdf8;
        }
        .od-item-price-col {
          text-align: right;
          flex-shrink: 0;
        }
        .od-item-total {
          font-size: 16.5px;
          font-weight: 850;
          color: #0f172a;
          font-variant-numeric: tabular-nums;
        }
        .od-item-unit {
          font-size: 12.5px;
          color: #64748b;
          margin-top: 3px;
          font-variant-numeric: tabular-nums;
        }

        /* Integrated Invoice Footer inside Product Card */
        .od-invoice-footer {
          padding: 20px 24px 22px;
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
          border-top: 1px solid #e2e8f0;
          display: grid;
          gap: 10px;
        }
        .od-invoice-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          font-size: 13.5px;
          color: #475569;
          font-weight: 600;
        }
        .od-invoice-row--discount {
          color: #059669;
          font-weight: 750;
        }
        .od-invoice-grand {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          padding-top: 14px;
          margin-top: 4px;
          border-top: 1.5px dashed #cbd5e1;
        }
        .od-invoice-grand-label {
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
        }
        .od-invoice-grand-amount {
          font-size: 24px;
          font-weight: 900;
          color: #2563eb;
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }

        /* Verified SePay Receipt Card (Paid State) */
        .od-receipt-paid {
          border-radius: 22px;
          overflow: hidden;
          border: 1px solid rgba(16, 185, 129, 0.28);
          background: #ffffff;
          box-shadow: 0 12px 30px -12px rgba(5, 150, 105, 0.16);
        }
        .od-receipt-paid__head {
          padding: 18px 24px;
          background: linear-gradient(135deg, #064e3b 0%, #047857 55%, #059669 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .od-receipt-paid__title-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .od-receipt-paid__icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.24);
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }
        .od-receipt-paid__badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.28);
          color: #ecfdf5;
          font-size: 11.5px;
          font-weight: 800;
          white-space: nowrap;
        }
        .od-receipt-paid__grid {
          padding: 20px 24px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%);
        }
        .od-receipt-tile {
          padding: 13px 15px;
          border-radius: 14px;
          background: #ffffff;
          border: 1px solid #d1fae5;
          display: grid;
          gap: 5px;
          min-width: 0;
        }
        .od-receipt-tile--wide {
          grid-column: span 3;
        }
        .od-receipt-tile__label {
          font-size: 11px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: #64748b;
        }
        .od-receipt-tile__value {
          font-size: 14.5px;
          font-weight: 800;
          color: #0f172a;
          word-break: break-all;
        }
        .od-tx-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .od-tx-code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 13.5px;
          font-weight: 800;
          color: #065f46;
          letter-spacing: 0.02em;
        }

        /* Live VietQR Unpaid Card */
        .od-vietqr-pay {
          border-radius: 22px;
          overflow: hidden;
          border: 1px solid rgba(37, 99, 235, 0.24);
          background: #ffffff;
          box-shadow: 0 14px 36px -14px rgba(37, 99, 235, 0.18);
        }
        .od-vietqr-pay__head {
          padding: 18px 24px;
          background: linear-gradient(135deg, #0b1120 0%, #172554 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .od-vietqr-pay__body {
          padding: 22px 24px;
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr);
          gap: 24px;
          align-items: center;
        }
        .od-qr-frame {
          padding: 12px;
          border-radius: 18px;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
          display: grid;
          justify-items: center;
          gap: 8px;
        }
        .od-qr-frame img {
          width: 100%;
          border-radius: 10px;
          display: block;
        }
        .od-transfer-rows {
          display: grid;
          gap: 10px;
        }
        .od-transfer-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          font-size: 13.5px;
          flex-wrap: wrap;
        }
        .od-copy-mini {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #1e293b;
          font-size: 11.5px;
          font-weight: 750;
          cursor: pointer;
          transition: all 0.16s ease;
        }
        .od-copy-mini:hover {
          border-color: #2563eb;
          color: #2563eb;
          background: #eff6ff;
        }
        .od-copy-mini.copied {
          background: #dcfce7;
          border-color: #86efac;
          color: #166534;
        }

        /* Address Card with Marketplace Envelope Stripe */
        .od-envelope-stripe {
          height: 4px;
          width: 100%;
          background: repeating-linear-gradient(
            -45deg,
            #2563eb 0px,
            #2563eb 14px,
            #ffffff 14px,
            #ffffff 22px,
            #ef4444 22px,
            #ef4444 36px,
            #ffffff 36px,
            #ffffff 44px
          );
          opacity: 0.78;
        }
        .od-address-body {
          padding: 20px 22px;
          display: grid;
          gap: 12px;
        }
        .od-recipient-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }
        .od-recipient-name {
          font-size: 15.5px;
          font-weight: 850;
          color: #0f172a;
        }
        .od-recipient-phone {
          padding: 3px 10px;
          border-radius: 999px;
          background: #f1f5f9;
          color: #334155;
          font-size: 12.5px;
          font-weight: 750;
          font-variant-numeric: tabular-nums;
        }
        .od-address-text {
          font-size: 13.5px;
          color: #475569;
          line-height: 1.6;
          font-weight: 500;
        }
        .od-note-box {
          padding: 10px 13px;
          border-radius: 12px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #92400e;
          font-size: 12.5px;
          line-height: 1.5;
          font-weight: 600;
        }

        /* Metadata Snapshot List */
        .od-meta-list {
          padding: 16px 22px 20px;
          display: grid;
          gap: 12px;
        }
        .od-meta-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-size: 13px;
          padding-bottom: 10px;
          border-bottom: 1px solid #f1f5f9;
        }
        .od-meta-row:last-child {
          padding-bottom: 0;
          border-bottom: none;
        }
        .od-meta-key {
          color: #64748b;
          font-weight: 600;
        }
        .od-meta-val {
          color: #0f172a;
          font-weight: 750;
          text-align: right;
        }
        .od-pay-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 999px;
          margin-right: 6px;
        }

        /* Action Buttons */
        .od-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px 18px;
          border-radius: 12px;
          font-size: 13.5px;
          font-weight: 800;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.18s ease;
          border: 1px solid transparent;
        }
        .od-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .od-btn--primary {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #ffffff;
          box-shadow: 0 8px 18px -6px rgba(37, 99, 235, 0.45);
        }
        .od-btn--primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 12px 22px -6px rgba(37, 99, 235, 0.55);
        }
        .od-btn--success {
          background: linear-gradient(135deg, #059669, #10b981);
          color: #ffffff;
          box-shadow: 0 8px 18px -6px rgba(5, 150, 105, 0.45);
        }
        .od-btn--success:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        .od-btn--secondary {
          background: #f8fafc;
          border-color: #e2e8f0;
          color: #0f172a;
          justify-content: flex-start;
        }
        .od-btn--secondary:hover:not(:disabled) {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1d4ed8;
        }
        .od-btn--danger {
          background: #ffffff;
          border-color: #fecaca;
          color: #dc2626;
          justify-content: center;
        }
        .od-btn--danger:hover:not(:disabled) {
          background: #fef2f2;
          border-color: #f87171;
        }
        .od-actions-body {
          padding: 18px 22px 20px;
          display: grid;
          gap: 10px;
        }
        .od-hotline-bar {
          margin-top: 4px;
          padding: 12px 14px;
          border-radius: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          font-size: 12.5px;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }

        /* Shipment Tracking Banner */
        .od-shipment-card {
          border-radius: 22px;
          padding: 20px 24px;
          background: linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%);
          border: 1px solid #ddd6fe;
          display: grid;
          gap: 12px;
        }
        .od-shipment-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }
        .od-shipment-code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 20px;
          font-weight: 900;
          color: #4c1d95;
          letter-spacing: 0.03em;
        }

        /* Print Rules */
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 11.5pt !important;
          }
          nav, header, footer, .no-print, button {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .od-page {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .od-grid {
            grid-template-columns: 1fr !important;
          }
          .od-card, .od-receipt-paid {
            box-shadow: none !important;
            border-color: #cbd5e1 !important;
          }
        }
        @media screen {
          .print-only {
            display: none;
          }
        }

        /* Responsive Breakpoints */
        @media (max-width: 1024px) {
          .od-grid {
            grid-template-columns: 1fr;
          }
          .od-col-side {
            position: static;
          }
        }
        @media (max-width: 768px) {
          .od-hero-head,
          .od-stepper-wrap,
          .od-card-head,
          .od-item-row,
          .od-invoice-footer {
            padding-left: 18px;
            padding-right: 18px;
          }
          .od-stepper {
            grid-template-columns: 1fr;
            gap: 14px;
          }
          .od-stepper-rail {
            display: none;
          }
          .od-step {
            flex-direction: row;
            text-align: left;
            align-items: center;
          }
          .od-step-sub {
            max-width: none;
          }
          .od-receipt-paid__grid {
            grid-template-columns: 1fr;
          }
          .od-receipt-tile--wide {
            grid-column: span 1;
          }
          .od-vietqr-pay__body {
            grid-template-columns: 1fr;
            justify-items: center;
          }
          .od-transfer-rows {
            width: 100%;
          }
        }
      `}</style>

      {/* Print-Only Retail Invoice Header */}
      <div className="print-only" style={{ borderBottom: "2px solid #0f172a", paddingBottom: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: "-0.5px" }}>
              {storeInfo.storeName || "PC MALL VIỆT NAM"}
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#475569" }}>
              Hệ thống bán lẻ Linh kiện Máy tính & Dịch vụ PC Chuyên nghiệp
              <br />
              Trụ sở: {storeInfo.storeAddress || BANK_ACCOUNT_CONFIG.address} | Hotline:{" "}
              {storeInfo.storeHotline || BANK_ACCOUNT_CONFIG.hotline} | MST:{" "}
              {storeInfo.storeTaxId || BANK_ACCOUNT_CONFIG.taxId}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1e293b" }}>HÓA ĐƠN BÁN LẺ</h2>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Mã đơn: <strong>#{order.id}</strong>
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>Ngày tạo: {formatDate(order.createdAt)}</div>
          </div>
        </div>
      </div>

      {/* Top Marketplace Breadcrumb & Utility Bar */}
      <div className="od-topbar no-print">
        <div className="od-topbar__left">
          <Link to={routeConfig.public.orders} className="od-back-btn">
            <ArrowLeftIcon /> Đơn hàng của tôi
          </Link>
          <div className="od-crumb" aria-label="Đường dẫn">
            <Link to={routeConfig.public.root}>Trang chủ</Link>
            <span>/</span>
            <Link to={routeConfig.public.orders}>Đơn hàng</Link>
            <span>/</span>
            <span className="od-crumb__current">#{order.id}</span>
          </div>
        </div>

        <div className="od-topbar__right">
          <button
            type="button"
            className={`od-code-pill ${copiedField === "orderId" ? "copied" : ""}`}
            onClick={() => handleCopyText("orderId", `#${order.id}`)}
            title="Sao chép mã đơn hàng"
          >
            <span>Mã đơn: #{order.id}</span>
            {copiedField === "orderId" ? <CheckIcon size={14} /> : <CopyIcon />}
          </button>
          <button type="button" className="od-print-btn" onClick={handlePrintInvoice}>
            <PrinterIcon /> In hóa đơn (PDF)
          </button>
        </div>
      </div>

      {/* Toast Feedback Messages */}
      {successMessage ? (
        <div className="no-print" style={{ padding: "14px 18px", borderRadius: 14, background: "#ecfdf5", border: "1px solid #86efac", color: "#047857", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <CheckIcon size={17} /> {successMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="no-print" style={{ padding: "14px 18px", borderRadius: 14, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontWeight: 700, fontSize: 14 }}>
          {errorMessage}
        </div>
      ) : null}

      {/* Hero Order Status Banner + 5-Step Tracking Stepper */}
      <section
        className="od-hero-card no-print"
        style={{ "--hero-accent": heroSummary.accent, "--hero-soft-bg": heroSummary.softBg }}
      >
        <div className="od-hero-accent" />

        <div className="od-hero-head">
          <div className="od-hero-status-wrap">
            <div className="od-hero-icon">
              {normalizedOrderStatus === "CANCELED" ? (
                <XCircleIcon />
              ) : normalizedOrderStatus === "SHIPPED" ? (
                <TruckIcon size={22} />
              ) : normalizedOrderStatus === "COMPLETED" || normalizedOrderStatus === "DELIVERED" ? (
                <CheckIcon size={22} />
              ) : (
                <PackageIcon />
              )}
            </div>
            <div>
              <div className="od-hero-eyebrow">
                <OrderStatusBadge status={order.status} paymentMethod={order.paymentMethod} paymentStatus={order.paymentStatus} />
                <span className="od-hero-date">Đặt lúc {formatDate(order.createdAt)}</span>
              </div>
              <h1 className="od-hero-title">{heroSummary.headline}</h1>
              <p className="od-hero-sub">{heroSummary.subline}</p>
            </div>
          </div>

          <div className="od-hero-cta">
            {canPayVietQr ? (
              <Link
                to={routeConfig.public.paymentVietQr.replace(":orderId", String(order.id))}
                className="od-btn od-btn--primary"
              >
                <QrIcon /> Quét VietQR thanh toán
              </Link>
            ) : null}
            {canPayVnpay ? (
              <button type="button" disabled={actionLoading} onClick={handlePayOrder} className="od-btn od-btn--primary">
                {actionLoading
                  ? "Đang mở VNPay..."
                  : ["FAILED", "PAYMENT_CANCELLED"].includes(normalizedPaymentStatus)
                    ? "Thanh toán lại VNPay"
                    : "Thanh toán VNPay ngay"}
              </button>
            ) : null}
            {canConfirmReceived ? (
              <button type="button" disabled={actionLoading} onClick={handleConfirmReceived} className="od-btn od-btn--success">
                <CheckIcon /> {actionLoading ? "Đang xác nhận..." : "Đã nhận được hàng"}
              </button>
            ) : null}
            {!canPayVietQr && !canPayVnpay && !canConfirmReceived ? (
              <button type="button" disabled={actionLoading} onClick={handleReorder} className="od-btn od-btn--primary">
                <CartRefreshIcon /> Mua lại đơn này
              </button>
            ) : null}
          </div>
        </div>

        {/* 5-Step Progress Track (Hidden when CANCELED) */}
        {normalizedOrderStatus !== "CANCELED" ? (
          <div className="od-stepper-wrap">
            <div className="od-stepper" role="list" aria-label="Tiến trình xử lý đơn hàng">
              <div className="od-stepper-rail" aria-hidden="true">
                <div className="od-stepper-fill" style={{ width: `${timeline.progressPercent}%` }} />
              </div>
              {timeline.steps.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.key} className={`od-step ${step.state}`} role="listitem">
                    <div className="od-step-dot">
                      {step.state === "done" ? <CheckIcon size={18} /> : <Icon />}
                    </div>
                    <div>
                      <div className="od-step-label">{step.label}</div>
                      <div className="od-step-sub">{step.sub}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      {/* Main 2-Column Marketplace Layout */}
      <div className="od-grid">
        {/* LEFT COLUMN: Products + Invoice, Payment Receipt/QR, Shipment */}
        <div className="od-col-main">
          {/* 1. Official Store Product List + Integrated Invoice Breakdown */}
          <section className="od-card">
            <div className="od-card-head">
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="od-store-badge">
                  <StoreIcon /> PC Mall Official
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>Linh kiện chính hãng 100%</span>
              </div>
              <span style={{ padding: "4px 11px", borderRadius: 999, background: "#f1f5f9", color: "#334155", fontSize: 12.5, fontWeight: 800 }}>
                {itemCount} sản phẩm
              </span>
            </div>

            <div className="od-item-list">
              {(order.items || []).map((item) => {
                const productLink = item.productId
                  ? routeConfig.public.productDetail.replace(":idOrSlug", String(item.productId))
                  : null;

                return (
                  <div key={item.id} className="od-item-row">
                    <div className="od-item-thumb">
                      {item.imageUrl ? (
                        <img
                          src={resolveProductImage({ image_url: item.imageUrl, name: item.productName })}
                          alt={item.productName}
                        />
                      ) : (
                        <PackageIcon />
                      )}
                    </div>

                    <div className="od-item-info">
                      <div style={{ flex: 1, minWidth: 180 }}>
                        {productLink ? (
                          <Link to={productLink} className="od-item-name">
                            {item.productName}
                          </Link>
                        ) : (
                          <div className="od-item-name">{item.productName}</div>
                        )}

                        <div className="od-item-meta">
                          {item.sku ? <span className="od-sku-chip">SKU: {item.sku}</span> : null}
                          <span className="od-qty-chip">SL: ×{item.quantity}</span>
                        </div>

                        {item.serialNumbers && item.serialNumbers.length > 0 ? (
                          <div className="od-sn-row">
                            <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              S/N bảo hành:
                            </span>
                            {item.serialNumbers.map((sn, sIdx) => (
                              <Link
                                key={sIdx}
                                to={`/warranties?lookup=${encodeURIComponent(sn)}`}
                                title="Tra cứu bảo hành điện tử theo Serial Number"
                                className="od-sn-chip"
                              >
                                <ShieldCheckIcon size={12} /> {sn}
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="od-item-price-col">
                        <div className="od-item-total">{formatCurrency(item.lineTotal)} đ</div>
                        <div className="od-item-unit">
                          {formatCurrency(item.unitPrice)} đ × {item.quantity}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Integrated Invoice Financial Summary */}
            <div className="od-invoice-footer">
              <div className="od-invoice-row">
                <span>Tổng tiền hàng ({itemCount} sản phẩm)</span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>
                  {formatCurrency(order.totalAmount)} đ
                </span>
              </div>

              {discountNumber > 0 ? (
                <div className="od-invoice-row od-invoice-row--discount">
                  <span>
                    Voucher giảm giá {order.couponCode ? `(${order.couponCode})` : ""}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>-{formatCurrency(discountNumber)} đ</span>
                </div>
              ) : null}

              <div className="od-invoice-row">
                <span>Phí vận chuyển & đóng gói</span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: shippingFeeNumber === 0 ? "#059669" : "#0f172a", fontWeight: 750 }}>
                  {shippingFeeNumber === 0 ? "Miễn phí" : `${formatCurrency(shippingFeeNumber)} đ`}
                </span>
              </div>

              <div className="od-invoice-grand">
                <div>
                  <div className="od-invoice-grand-label">
                    {normalizedPaymentStatus === "PAID" ? "Tổng đã thanh toán" : "Tổng thanh toán"}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, fontWeight: 600 }}>
                    {getPaymentMethodLabel(order.paymentMethod)} ·{" "}
                    <span style={{ color: paymentStatusMeta.tone, fontWeight: 800 }}>{paymentStatusMeta.label}</span>
                  </div>
                </div>
                <div className="od-invoice-grand-amount">{formatCurrency(order.finalAmount)} đ</div>
              </div>
            </div>
          </section>

          {/* 2. Verified SePay Digital Receipt (When Paid via VietQR) */}
          {order.paymentMethod === "BANK_TRANSFER" && normalizedPaymentStatus === "PAID" ? (
            <section className="od-receipt-paid">
              <div className="od-receipt-paid__head">
                <div className="od-receipt-paid__title-wrap">
                  <div className="od-receipt-paid__icon">
                    <ShieldCheckIcon size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 850, letterSpacing: "-0.01em" }}>
                      Biên lai thanh toán tự động (SePay VietQR)
                    </div>
                    <div style={{ fontSize: 12.5, color: "#d1fae5", marginTop: 2, fontWeight: 500 }}>
                      Tiền đã vào tài khoản thụ hưởng và được hệ thống xác nhận tức thì
                    </div>
                  </div>
                </div>
                <span className="od-receipt-paid__badge">
                  <CheckIcon size={13} /> Đã đối soát thành công
                </span>
              </div>

              <div className="od-receipt-paid__grid">
                <div className="od-receipt-tile">
                  <span className="od-receipt-tile__label">Ngân hàng nhận</span>
                  <span className="od-receipt-tile__value">{bankName}</span>
                </div>
                <div className="od-receipt-tile">
                  <span className="od-receipt-tile__label">Số tiền ghi nhận</span>
                  <span className="od-receipt-tile__value" style={{ color: "#059669" }}>
                    {formatCurrency(order.finalAmount)} đ
                  </span>
                </div>
                <div className="od-receipt-tile">
                  <span className="od-receipt-tile__label">Nội dung đối soát</span>
                  <span className="od-receipt-tile__value" style={{ fontFamily: "ui-monospace, monospace", fontSize: 13.5 }}>
                    {transferMemo}
                  </span>
                </div>

                {order.transactionCode ? (
                  <div className="od-receipt-tile od-receipt-tile--wide">
                    <span className="od-receipt-tile__label">Mã giao dịch ngân hàng (FT / Reference)</span>
                    <div className="od-tx-row">
                      <span className="od-tx-code">{order.transactionCode}</span>
                      <button
                        type="button"
                        className={`od-copy-mini no-print ${copiedField === "txCode" ? "copied" : ""}`}
                        onClick={() => handleCopyText("txCode", order.transactionCode)}
                      >
                        {copiedField === "txCode" ? <CheckIcon size={13} /> : <CopyIcon />}
                        {copiedField === "txCode" ? "Đã chép" : "Sao chép mã GD"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* 3. Live VietQR Payment Box (When Unpaid via VietQR) */}
          {showVietQrBox ? (
            <section className="od-vietqr-pay no-print">
              <div className="od-vietqr-pay__head">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.12)", display: "grid", placeItems: "center", color: "#93c5fd" }}>
                    <BankIcon />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 850 }}>Quét mã VietQR để hoàn tất thanh toán</div>
                    <div style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 2 }}>
                      Hệ thống tự động đối soát tiền vào qua SePay trong 2–5 giây — không cần gửi biên lai
                    </div>
                  </div>
                </div>
                <Link
                  to={routeConfig.public.paymentVietQr.replace(":orderId", String(order.id))}
                  style={{ padding: "8px 14px", borderRadius: 10, background: "#2563eb", color: "#ffffff", fontSize: 12.5, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" }}
                >
                  Mở toàn màn hình QR →
                </Link>
              </div>

              <div className="od-vietqr-pay__body">
                <div className="od-qr-frame">
                  <img
                    src={sepayQrUrl}
                    alt={`Mã VietQR thanh toán đơn hàng #${order.id}`}
                    onError={(e) => {
                      if (e.currentTarget.src !== vietQrUrl) {
                        e.currentTarget.src = vietQrUrl;
                      } else {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = BANK_ACCOUNT_CONFIG.qrCodeImage;
                      }
                    }}
                  />
                  <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600, textAlign: "center" }}>
                    Hỗ trợ mọi App ngân hàng VietQR / Napas 247
                  </span>
                </div>

                <div className="od-transfer-rows">
                  <div className="od-transfer-row">
                    <span style={{ color: "#64748b", fontWeight: 600 }}>Ngân hàng</span>
                    <strong style={{ color: "#0f172a" }}>{bankName}</strong>
                  </div>
                  <div className="od-transfer-row">
                    <span style={{ color: "#64748b", fontWeight: 600 }}>Số tài khoản</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ color: "#0f172a", fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em" }}>
                        {formatBankAccountDisplay(bankAccountNumber)}
                      </strong>
                      <button
                        type="button"
                        className={`od-copy-mini ${copiedField === "accountNumber" ? "copied" : ""}`}
                        onClick={() => handleCopyText("accountNumber", bankAccountNumber)}
                      >
                        {copiedField === "accountNumber" ? <CheckIcon size={12} /> : <CopyIcon />}
                        {copiedField === "accountNumber" ? "Đã chép" : "Sao chép"}
                      </button>
                    </div>
                  </div>
                  <div className="od-transfer-row">
                    <span style={{ color: "#64748b", fontWeight: 600 }}>Chủ tài khoản</span>
                    <strong style={{ color: "#0f172a" }}>{bankAccountHolder}</strong>
                  </div>
                  <div className="od-transfer-row">
                    <span style={{ color: "#64748b", fontWeight: 600 }}>Số tiền chuyển</span>
                    <strong style={{ color: "#dc2626", fontSize: 15.5, fontVariantNumeric: "tabular-nums" }}>
                      {formatCurrency(order.finalAmount)} đ
                    </strong>
                  </div>
                  <div className="od-transfer-row" style={{ background: "#fffbeb", borderColor: "#fde68a" }}>
                    <span style={{ color: "#92400e", fontWeight: 700 }}>Nội dung bắt buộc</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong style={{ fontFamily: "ui-monospace, monospace", color: "#b45309", fontSize: 14 }}>
                        {transferMemo}
                      </strong>
                      <button
                        type="button"
                        className={`od-copy-mini ${copiedField === "transferMemo" ? "copied" : ""}`}
                        onClick={() => handleCopyText("transferMemo", transferMemo)}
                      >
                        {copiedField === "transferMemo" ? <CheckIcon size={12} /> : <CopyIcon />}
                        {copiedField === "transferMemo" ? "Đã chép" : "Sao chép"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {/* 4. Shipment Tracking Banner (If Tracking Code Assigned) */}
          {order.trackingCode ? (
            <section className="od-shipment-card">
              <div className="od-shipment-top">
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 14, background: "linear-gradient(135deg, #6d28d9, #4f46e5)", color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 8px 18px -4px rgba(109, 40, 217, 0.4)" }}>
                    <TruckIcon size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: "#6d28d9", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Mã vận đơn {order.shipmentCarrier ? `· ${order.shipmentCarrier}` : ""}
                    </div>
                    <div className="od-shipment-code">{order.trackingCode}</div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ padding: "5px 12px", borderRadius: 999, background: "#ffffff", border: "1px solid #c4b5fd", color: "#5b21b6", fontSize: 12.5, fontWeight: 800 }}>
                    {getShipmentStatusLabel(order.shipmentStatus || "IN_TRANSIT")}
                  </span>
                  <button
                    type="button"
                    className={`od-copy-mini no-print ${copiedField === "trackingCode" ? "copied" : ""}`}
                    onClick={() => handleCopyText("trackingCode", order.trackingCode)}
                  >
                    {copiedField === "trackingCode" ? <CheckIcon size={12} /> : <CopyIcon />}
                    {copiedField === "trackingCode" ? "Đã chép" : "Sao chép"}
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        {/* RIGHT STICKY SIDEBAR: Address, Metadata Snapshot, Quick Actions */}
        <aside className="od-col-side">
          {/* 1. Shipping Address Card with Classic E-Commerce Envelope Stripe */}
          <section className="od-card">
            <div className="od-envelope-stripe" />
            <div className="od-card-head" style={{ padding: "15px 22px" }}>
              <h2 className="od-card-title">
                <span style={{ color: "#2563eb", display: "grid" }}><MapPinIcon /></span>
                Địa chỉ nhận hàng
              </h2>
            </div>
            <div className="od-address-body">
              <div className="od-recipient-row">
                <span className="od-recipient-name">{recipient.name}</span>
                <span className="od-recipient-phone">{recipient.phone}</span>
              </div>
              <div className="od-address-text">{recipient.address}</div>
              {order.note ? (
                <div className="od-note-box">
                  <strong>Ghi chú giao hàng:</strong> {order.note}
                </div>
              ) : null}
            </div>
          </section>

          {/* 2. Order Metadata Snapshot (100% Vietnamese, Clean Key-Value Table) */}
          <section className="od-card">
            <div className="od-card-head" style={{ padding: "15px 22px" }}>
              <h2 className="od-card-title">
                <span style={{ color: "#0f172a", display: "grid" }}><ReceiptIcon /></span>
                Thông tin đơn hàng
              </h2>
            </div>
            <div className="od-meta-list">
              <div className="od-meta-row">
                <span className="od-meta-key">Mã đơn hàng</span>
                <span className="od-meta-val" style={{ fontFamily: "ui-monospace, monospace" }}>#{order.id}</span>
              </div>
              <div className="od-meta-row">
                <span className="od-meta-key">Trạng thái đơn</span>
                <span className="od-meta-val">{getOrderStatusLabel(order.status)}</span>
              </div>
              <div className="od-meta-row">
                <span className="od-meta-key">Thời gian đặt</span>
                <span className="od-meta-val">{formatDate(order.createdAt)}</span>
              </div>
              <div className="od-meta-row">
                <span className="od-meta-key">Phương thức</span>
                <span className="od-meta-val">{getPaymentMethodLabel(order.paymentMethod)}</span>
              </div>
              <div className="od-meta-row">
                <span className="od-meta-key">Thanh toán</span>
                <span className="od-meta-val" style={{ color: paymentStatusMeta.tone }}>
                  <span className="od-pay-dot" style={{ background: paymentStatusMeta.tone }} />
                  {paymentStatusMeta.label}
                </span>
              </div>
            </div>
          </section>

          {/* 3. Quick Actions & Support Panel */}
          <section className="od-card no-print">
            <div className="od-card-head" style={{ padding: "15px 22px" }}>
              <h2 className="od-card-title">Thao tác & Hỗ trợ</h2>
            </div>
            <div className="od-actions-body">
              {canConfirmReceived ? (
                <button type="button" disabled={actionLoading} onClick={handleConfirmReceived} className="od-btn od-btn--success">
                  <CheckIcon /> {actionLoading ? "Đang xác nhận..." : "Xác nhận đã nhận hàng"}
                </button>
              ) : null}

              <button type="button" disabled={actionLoading} onClick={handleReorder} className="od-btn od-btn--secondary">
                <CartRefreshIcon /> Mua lại sản phẩm trong đơn
              </button>

              <button type="button" onClick={handlePrintInvoice} className="od-btn od-btn--secondary">
                <PrinterIcon /> Xuất hóa đơn bán lẻ (PDF)
              </button>

              <Link to={routeConfig.public.warranties} className="od-btn od-btn--secondary">
                <ShieldCheckIcon size={16} /> Tra cứu bảo hành điện tử
              </Link>

              <Link to={routeConfig.public.ticketCreate} className="od-btn od-btn--secondary">
                <HeadsetIcon /> Gửi yêu cầu hỗ trợ đơn hàng
              </Link>

              {canCancel ? (
                <button type="button" disabled={actionLoading} onClick={handleCancelOrder} className="od-btn od-btn--danger">
                  Hủy đơn hàng #{order.id}
                </button>
              ) : null}

              <div className="od-hotline-bar">
                <span>Cần hỗ trợ gấp?</span>
                <strong style={{ color: "#0f172a" }}>{storeInfo.storeHotline || BANK_ACCOUNT_CONFIG.hotline}</strong>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
