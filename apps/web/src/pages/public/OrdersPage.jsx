import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

import { OrderStatusBadge } from "../../components/marketplace/OrderStatusBadge";
import { useAuth } from "../../hooks/useAuth";
import { addItemToCart } from "../../services/cart.service";
import { cancelMyOrder, confirmOrderReceived, createVnpayUrl, getMyOrders } from "../../services/order.service";
import { subscribeToOrderEvents } from "../../services/order-events.service";
import { routeConfig } from "../../routes/routeConfig";
import {
  PAYMENT_STATUS_META,
  canCustomerCancelOrder,
  canCustomerConfirmReceived,
  canCustomerPayOrder,
  canCustomerPayVietQr
} from "../../utils/orderStatus";
import { resolveProductImage } from "../../utils/productImage";

/* ── Crisp SVG Icons (Unified with OrderDetailPage) ──────────────────────── */
const SearchIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const StoreIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <path d="M2 7h20" />
  </svg>
);

const PackageIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m16.5 9.4-9-5.19" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const TruckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" rx="1" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const QrIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="6" height="6" rx="1" />
    <rect x="15" y="3" width="6" height="6" rx="1" />
    <rect x="3" y="15" width="6" height="6" rx="1" />
    <path d="M15 15h2v2h-2zM19 15h2M15 19h6M11 3v6M3 11h6M11 15v6" />
  </svg>
);

const CartIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </svg>
);

const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const LockIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

/* ── Data Normalizers & Helpers ──────────────────────────────────────────── */
function getErrorMessage(error, fallbackMessage) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallbackMessage;
  }
  return error?.message || fallbackMessage;
}

function normalizeOrdersResponse(response) {
  return response?.data || response;
}

function mapOrderItemToUi(item) {
  return {
    id: item.id,
    productId: item.product_id || item.productId || item.ProductSku?.product_id || item.product?.id || null,
    productVariantId: item.product_variant_id || item.productVariantId || item.ProductSku?.id || null,
    product_name:
      item.product_name ||
      item.name_snapshot ||
      item.nameSnapshot ||
      item.productName ||
      item.product?.name ||
      item.ProductSku?.Product?.name ||
      "Sản phẩm",
    name:
      item.name ||
      item.name_snapshot ||
      item.nameSnapshot ||
      item.productName ||
      item.product?.name ||
      item.ProductSku?.Product?.name ||
      "Sản phẩm",
    sku: item.sku || item.sku_snapshot || item.skuSnapshot || item.ProductSku?.sku,
    quantity: Number(item.quantity || 0),
    price: Number(item.price || item.unit_price || item.unitPrice || 0),
    unit_price: Number(item.unit_price || item.unitPrice || item.price || 0),
    line_total: Number(item.line_total || item.lineTotal || Number(item.unit_price || item.price || 0) * Number(item.quantity || 1)),
    image_url:
      item.image_url ||
      item.imageUrl ||
      item.ProductSku?.image_url ||
      item.ProductSku?.imageUrl ||
      item.product?.imageUrl ||
      null
  };
}

function mapOrderToUi(order) {
  if (!order) return order;
  const items = (order.items || order.OrderItem || []).map(mapOrderItemToUi);
  const totalItems = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return {
    ...order,
    paymentMethod: order.paymentMethod || order.payment_method,
    paymentStatus: order.paymentStatus || order.payment_status,
    shippingAddress: order.shippingAddress || order.shipping_address,
    createdAt: order.createdAt || order.created_at,
    totalAmount: order.totalAmount || order.total_amount || order.total_price,
    shippingFee: order.shippingFee || order.shipping_fee || 0,
    finalAmount: order.finalAmount || order.final_amount || order.total_amount || order.total_price || 0,
    items,
    totalItems,
    shipment: order.shipment || (Array.isArray(order.Shipment) ? order.Shipment[0] : null)
  };
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("vi-VN");
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

function normalizeStatus(status) {
  return String(status || "").toUpperCase();
}

function normalizePaymentMethod(method) {
  return String(method || "COD").toUpperCase();
}

function isDeliveredStatus(status) {
  return normalizeStatus(status) === "DELIVERED";
}

function getPaymentMethodLabel(method) {
  const normalized = normalizePaymentMethod(method);
  if (normalized === "VNPAY") return "VNPay";
  if (normalized === "BANK_TRANSFER" || normalized === "QR_BANKING") return "VietQR (SePay)";
  return "Thanh toán COD";
}

function getPaymentStatusMeta(status, method) {
  const normalized = normalizeStatus(status);
  if (normalizePaymentMethod(method) === "BANK_TRANSFER" && ["PENDING_GATEWAY", "UNPAID", ""].includes(normalized)) {
    return { label: "Chờ chuyển khoản VietQR", tone: "#1d4ed8" };
  }
  return (
    PAYMENT_STATUS_META[normalized] || {
      label: status || "Chưa thanh toán",
      tone: "#64748b"
    }
  );
}

function getCustomerName(authState) {
  const user = authState?.user || {};
  return user.fullName || user.full_name || user.name || user.email || "bạn";
}

function getOrderSearchText(order) {
  const itemText = (order.items || [])
    .map((item) => [item.product_name, item.name, item.sku].filter(Boolean).join(" "))
    .join(" ");
  return [
    order.id,
    `#${order.id}`,
    order.shippingAddress,
    order.receiverName,
    order.receiverPhone,
    order.shipment?.trackingCode,
    order.paymentMethod,
    order.paymentStatus,
    itemText
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isAwaitingOnlinePayment(order) {
  const status = normalizeStatus(order?.status);
  const method = normalizePaymentMethod(order?.paymentMethod);
  const payStatus = normalizeStatus(order?.paymentStatus);
  return status === "PENDING" && method !== "COD" && payStatus !== "PAID";
}

function getOrderAccentColor(order) {
  const status = normalizeStatus(order?.status);
  const payStatus = normalizeStatus(order?.paymentStatus);
  if (status === "CANCELED") return "#dc2626";
  if (status === "COMPLETED") return "#059669";
  if (status === "DELIVERED") return "#0f766e";
  if (status === "SHIPPED") return "#6d28d9";
  if (status === "PROCESSING" || status === "PAID") return "#2563eb";
  if (isAwaitingOnlinePayment(order) && ["FAILED", "PAYMENT_CANCELLED", "REJECTED"].includes(payStatus)) {
    return "#dc2626";
  }
  return "#d97706";
}

function getTrackingText(order) {
  const status = normalizeStatus(order.status);
  const method = normalizePaymentMethod(order.paymentMethod);
  const payStatus = normalizeStatus(order.paymentStatus);

  if (order.shipment?.trackingCode) {
    return `Đang vận chuyển · Mã vận đơn ${order.shipment.trackingCode}`;
  }
  if (status === "PENDING") {
    if (method !== "COD" && payStatus !== "PAID") {
      if (payStatus === "FAILED" || payStatus === "PAYMENT_CANCELLED") {
        return "Giao dịch thanh toán chưa hoàn tất — giữ tồn kho trong 30 phút, bạn có thể thanh toán lại hoặc hủy đơn.";
      }
      if (method === "BANK_TRANSFER") {
        return `Chờ chuyển khoản VietQR (cú pháp PCMALL${order.id}) — tự động đối soát qua SePay trong 2–5 giây.`;
      }
      return "Đang chờ hoàn tất thanh toán trực tuyến trước khi kho PC Mall đóng gói.";
    }
    return "Đơn hàng đã tiếp nhận, đang chờ bộ phận bán hàng xác nhận.";
  }
  if (status === "PROCESSING" || status === "PAID") {
    return payStatus === "PAID"
      ? "Đã xác nhận thanh toán tự động — Kho PC Mall đang chuẩn bị & đóng gói linh kiện."
      : "Đơn hàng đang được chuẩn bị và đóng gói xuất kho.";
  }
  if (status === "SHIPPED") return "Đơn hàng đã bàn giao đơn vị vận chuyển và đang trên đường tới bạn.";
  if (status === "DELIVERED") return "Đơn hàng đã giao thành công — hãy kiểm tra linh kiện và xác nhận đã nhận hàng.";
  if (status === "COMPLETED") return "Đơn hàng đã hoàn tất · Hỗ trợ bảo hành điện tử chính hãng PC Mall.";
  if (status === "CANCELED") {
    return payStatus === "EXPIRED"
      ? "Đơn hàng tự động hủy do quá thời hạn thanh toán."
      : "Đơn hàng đã hủy. Bạn có thể bấm Mua lại bất cứ lúc nào.";
  }
  return "Trạng thái vận chuyển sẽ được cập nhật sớm.";
}

function getProgressStep(order) {
  const normalized = normalizeStatus(order?.status);
  if (normalized === "COMPLETED") return 4;
  if (normalized === "DELIVERED") return 4;
  if (normalized === "SHIPPED") return 3;
  if (normalized === "PROCESSING" || normalized === "PAID") return 2;
  if (normalized === "CANCELED") return 0;
  if (isAwaitingOnlinePayment(order)) return 1;
  return 1;
}

const FILTER_TABS = [
  { id: "ALL", label: "Tất cả" },
  { id: "PENDING", label: "Chờ xác nhận" },
  { id: "PROCESSING", label: "Đang xử lý" },
  { id: "SHIPPED", label: "Đang giao" },
  { id: "DELIVERED", label: "Đã giao" },
  { id: "COMPLETED", label: "Hoàn tất" },
  { id: "CANCELED", label: "Đã hủy" }
];

const PROGRESS_STEPS = ["Đặt hàng", "Xử lý", "Vận chuyển", "Hoàn tất"];

function InlineOrderProgress({ order }) {
  const status = normalizeStatus(order?.status);
  const payStatus = normalizeStatus(order?.paymentStatus);
  const activeStep = getProgressStep(order);
  const trackingText = getTrackingText(order);

  const isAlertState =
    status === "CANCELED" ||
    (isAwaitingOnlinePayment(order) && ["FAILED", "PAYMENT_CANCELLED", "REJECTED"].includes(payStatus));

  if (isAlertState) {
    return (
      <div className="ord-strip ord-strip--danger">
        <span className="ord-strip__dot ord-strip__dot--danger" />
        <span className="ord-strip__text">{trackingText}</span>
      </div>
    );
  }

  const isDoneAll = status === "COMPLETED";

  return (
    <div className={`ord-strip ${isDoneAll ? "ord-strip--success" : ""}`}>
      <div className="ord-strip__status">
        <span className="ord-strip__icon">
          {status === "SHIPPED" ? <TruckIcon /> : <ShieldCheckIcon />}
        </span>
        <span className="ord-strip__text">{trackingText}</span>
      </div>

      <div className="ord-mini-stepper" aria-label="Tiến độ xử lý đơn hàng">
        {PROGRESS_STEPS.map((label, idx) => {
          const stepNum = idx + 1;
          const isDone = isDoneAll || stepNum < activeStep;
          const isCurrent = !isDoneAll && stepNum === activeStep;
          return (
            <div key={label} className={`ord-mini-step ${isDone ? "is-done" : ""} ${isCurrent ? "is-current" : ""}`}>
              <span className="ord-mini-step__dot">{isDone ? <CheckIcon size={10} /> : stepNum}</span>
              <span className="ord-mini-step__label">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyOrdersState({ hasFilters, onResetFilters }) {
  return (
    <div className="ord-empty">
      <div className="ord-empty__art" aria-hidden="true">
        <svg viewBox="0 0 140 110" width="128" height="100">
          <rect x="20" y="26" width="100" height="66" rx="16" fill="#eff6ff" />
          <path d="M44 44h52l-6 38H50l-6-38Z" fill="#ffffff" stroke="#2563eb" strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M58 44c0-14 24-14 24 0" fill="none" stroke="#0f172a" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="106" cy="28" r="13" fill="#10b981" />
          <path d="M101 28h10M106 23v10" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
      <h2>{hasFilters ? "Không tìm thấy đơn hàng phù hợp" : "Bạn chưa có đơn hàng nào"}</h2>
      <p>
        {hasFilters
          ? "Hãy thử thay đổi bộ lọc trạng thái, phương thức thanh toán hoặc từ khóa tìm kiếm."
          : "Khám phá linh kiện PC chính hãng tại PC Mall và theo dõi toàn bộ đơn hàng của bạn ngay tại đây."}
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {hasFilters ? (
          <button type="button" onClick={onResetFilters} className="ord-btn ord-btn--secondary">
            Đặt lại bộ lọc
          </button>
        ) : null}
        <Link to={routeConfig.public.catalog} className="ord-btn ord-btn--primary">
          Khám phá linh kiện PC
        </Link>
      </div>
    </div>
  );
}

export function OrdersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { authState, isAuthenticated } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [actionOrderId, setActionOrderId] = useState(null);
  const [copiedOrderId, setCopiedOrderId] = useState(null);

  const createdOrderId = useMemo(() => location.state?.createdOrderId || null, [location.state]);
  const buildsMigrated = useMemo(() => location.state?.buildsMigrated || 0, [location.state]);

  const loadOrders = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setErrorMessage("");
      const response = await getMyOrders();
      const normalized = normalizeOrdersResponse(response);
      setOrders(Array.isArray(normalized) ? normalized.map(mapOrderToUi) : []);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể tải lịch sử đơn hàng"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    loadOrders();
  }, [isAuthenticated, loadOrders]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const intervalId = window.setInterval(() => {
      loadOrders({ silent: true });
    }, 8000);

    const unsubscribe = subscribeToOrderEvents(() => {
      loadOrders({ silent: true });
    });

    return () => {
      window.clearInterval(intervalId);
      unsubscribe();
    };
  }, [isAuthenticated, loadOrders]);

  const stats = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        const status = normalizeStatus(order.status);
        acc.total += 1;
        if (status !== "CANCELED") {
          acc.totalSpent += Number(order.finalAmount || 0);
        }
        if (status === "PENDING") acc.pending += 1;
        if (status === "PROCESSING" || status === "PAID") acc.processing += 1;
        if (status === "SHIPPED") acc.shipped += 1;
        if (isDeliveredStatus(status)) acc.delivered += 1;
        if (status === "COMPLETED") acc.completed += 1;
        if (status === "CANCELED") acc.canceled += 1;
        if (["PENDING", "PROCESSING", "PAID", "SHIPPED", "DELIVERED"].includes(status)) {
          acc.active += 1;
        }
        if (normalizePaymentMethod(order.paymentMethod) === "VNPAY") {
          acc.hasVnpay = true;
        }
        return acc;
      },
      {
        total: 0,
        active: 0,
        totalSpent: 0,
        pending: 0,
        processing: 0,
        shipped: 0,
        delivered: 0,
        completed: 0,
        canceled: 0,
        hasVnpay: false
      }
    );
  }, [orders]);

  const paymentFilterOptions = useMemo(() => {
    const base = [
      { id: "ALL", label: "Tất cả" },
      { id: "BANK_TRANSFER", label: "VietQR (SePay)" },
      { id: "COD", label: "COD" }
    ];
    if (stats.hasVnpay) {
      base.push({ id: "VNPAY", label: "VNPay" });
    }
    return base;
  }, [stats.hasVnpay]);

  const filteredOrders = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    return orders.filter((order) => {
      const status = normalizeStatus(order.status);
      const method = normalizePaymentMethod(order.paymentMethod);
      const matchesStatus =
        statusFilter === "ALL" ||
        status === statusFilter ||
        (statusFilter === "PROCESSING" && (status === "PROCESSING" || status === "PAID")) ||
        (statusFilter === "DELIVERED" && status === "DELIVERED");
      const matchesPayment =
        paymentFilter === "ALL" ||
        method === paymentFilter ||
        (paymentFilter === "BANK_TRANSFER" && method === "QR_BANKING");
      const matchesSearch = !keyword || getOrderSearchText(order).includes(keyword);
      return matchesStatus && matchesPayment && matchesSearch;
    });
  }, [orders, paymentFilter, searchKeyword, statusFilter]);

  const tabCounts = useMemo(
    () => ({
      ALL: stats.total,
      PENDING: stats.pending,
      PROCESSING: stats.processing,
      SHIPPED: stats.shipped,
      DELIVERED: stats.delivered,
      COMPLETED: stats.completed,
      CANCELED: stats.canceled
    }),
    [stats]
  );

  async function handleCopyOrderId(orderId) {
    const text = `#${orderId}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedOrderId(orderId);
    window.setTimeout(() => {
      setCopiedOrderId((prev) => (prev === orderId ? null : prev));
    }, 1800);
  }

  async function handleCancelOrder(orderId) {
    if (!confirm(`Bạn chắc chắn muốn hủy đơn hàng #${orderId}?`)) return;
    try {
      setActionOrderId(orderId);
      setErrorMessage("");
      await cancelMyOrder(orderId);
      setSuccessMessage(`Đã hủy đơn hàng #${orderId} thành công.`);
      await loadOrders();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể hủy đơn hàng"));
    } finally {
      setActionOrderId(null);
    }
  }

  async function handlePayOrder(order) {
    try {
      setActionOrderId(order.id);
      setErrorMessage("");
      const amount = Number(order.finalAmount || order.final_amount || 0);
      const urlRes = await createVnpayUrl(order.id, { amount });
      const urlData = urlRes?.data?.data || urlRes?.data || urlRes;
      if (urlData?.paymentUrl) {
        window.location.href = urlData.paymentUrl;
        return;
      }
      throw new Error("Không lấy được liên kết thanh toán");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể mở cổng thanh toán"));
      setActionOrderId(null);
    }
  }

  async function handleConfirmReceived(orderId) {
    if (!confirm(`Xác nhận bạn đã nhận đủ hàng cho đơn #${orderId}?`)) return;
    try {
      setActionOrderId(orderId);
      setErrorMessage("");
      await confirmOrderReceived(orderId);
      setSuccessMessage(`Đã xác nhận nhận hàng cho đơn #${orderId}.`);
      await loadOrders({ silent: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể xác nhận nhận hàng"));
    } finally {
      setActionOrderId(null);
    }
  }

  async function handleReorder(order) {
    const items = Array.isArray(order?.items) ? order.items : [];
    const reorderable = items.filter((item) => item.productVariantId || item.productId);
    if (reorderable.length === 0) {
      navigate(routeConfig.public.catalog);
      return;
    }

    try {
      setActionOrderId(order.id);
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
          // Skip out-of-stock or inactive items
        }
      }
      if (addedCount > 0) {
        navigate(routeConfig.public.cart);
      } else {
        setErrorMessage("Các sản phẩm trong đơn hàng này hiện đã hết hàng hoặc ngừng kinh doanh.");
      }
    } finally {
      setActionOrderId(null);
    }
  }

  function handleResetFilters() {
    setStatusFilter("ALL");
    setPaymentFilter("ALL");
    setSearchKeyword("");
  }

  if (!isAuthenticated) {
    return (
      <div className="ord-page">
        <style>{ordersStyles}</style>
        <section className="ord-auth-card">
          <span className="ord-auth-card__icon">
            <LockIcon />
          </span>
          <h1>Đơn hàng của tôi</h1>
          <p>Đăng nhập để xem toàn bộ lịch sử mua sắm, trạng thái giao nhận và tra cứu bảo hành linh kiện.</p>
          <Link to={routeConfig.public.login} className="ord-btn ord-btn--primary">
            Đăng nhập ngay
          </Link>
        </section>
      </div>
    );
  }

  const hasFilters = Boolean(searchKeyword.trim() || paymentFilter !== "ALL" || statusFilter !== "ALL");

  return (
    <div className="ord-page">
      <style>{ordersStyles}</style>

      {/* Top Breadcrumb */}
      <div className="ord-crumb" aria-label="Đường dẫn">
        <Link to={routeConfig.public.root}>Trang chủ</Link>
        <span>/</span>
        <span className="ord-crumb__current">Đơn hàng của tôi</span>
      </div>

      {/* Compact Executive Marketplace Header */}
      <section className="ord-header-card">
        <div className="ord-header-card__left">
          <span className="ord-header-card__eyebrow">PC Mall Member</span>
          <h1 className="ord-header-card__title">Đơn hàng của tôi</h1>
          <p className="ord-header-card__sub">
            Xin chào <strong>{getCustomerName(authState)}</strong> — theo dõi trạng thái xử lý, thanh toán VietQR tự động và bảo hành điện tử.
          </p>
        </div>

        <div className="ord-header-card__metrics">
          <div className="ord-metric-box">
            <span className="ord-metric-box__label">Tổng đơn hàng</span>
            <strong className="ord-metric-box__value">{stats.total}</strong>
            <span className="ord-metric-box__hint">
              {stats.active > 0 ? `${stats.active} đơn đang xử lý` : "Tất cả đã hoàn tất"}
            </span>
          </div>
          <div className="ord-metric-box ord-metric-box--accent">
            <span className="ord-metric-box__label">Tổng chi tiêu</span>
            <strong className="ord-metric-box__value">{formatCurrency(stats.totalSpent)} đ</strong>
            <span className="ord-metric-box__hint">Không tính đơn đã hủy</span>
          </div>
        </div>
      </section>

      {/* Contextual Alerts */}
      {createdOrderId ? (
        <div className="ord-alert ord-alert--success">
          <CheckIcon size={16} />
          <span>
            Đơn hàng mới <strong>#{createdOrderId}</strong> đã được tạo thành công.
          </span>
        </div>
      ) : null}

      {buildsMigrated > 0 ? (
        <div className="ord-alert ord-alert--info">
          <span>
            Đã đồng bộ <strong>{buildsMigrated}</strong> cấu hình PC từ chế độ khách lên tài khoản. Xem tại{" "}
            <Link to={routeConfig.public.pcBuilder}>PC Builder</Link>.
          </span>
        </div>
      ) : null}

      {successMessage ? (
        <div className="ord-alert ord-alert--success">
          <CheckIcon size={16} />
          <span>{successMessage}</span>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="ord-alert ord-alert--danger">
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {/* Unified Marketplace Navigation & Filter Surface (Shopee / Tiki Pattern) */}
      <section className="ord-controls-card">
        <nav className="ord-tabs" aria-label="Lọc trạng thái đơn hàng">
          {FILTER_TABS.map((tab) => {
            const count = tabCounts[tab.id] || 0;
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`ord-tab ${isActive ? "is-active" : ""}`}
              >
                <span>{tab.label}</span>
                {count > 0 || tab.id === "ALL" ? (
                  <span className={`ord-tab__count ${isActive ? "is-active" : ""}`}>{count}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="ord-search-bar">
          <label className="ord-search-input">
            <span className="ord-search-input__icon">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="Tìm theo mã đơn hàng (#812), tên linh kiện, SKU, mã vận đơn..."
            />
            {searchKeyword ? (
              <button
                type="button"
                className="ord-search-input__clear"
                onClick={() => setSearchKeyword("")}
                aria-label="Xóa từ khóa tìm kiếm"
              >
                ×
              </button>
            ) : null}
          </label>

          <div className="ord-pay-pills" role="group" aria-label="Lọc phương thức thanh toán">
            {paymentFilterOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPaymentFilter(opt.id)}
                className={`ord-pay-pill ${paymentFilter === opt.id ? "is-active" : ""}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Order Cards Feed */}
      {loading ? (
        <section className="ord-skeleton-list" aria-label="Đang tải danh sách đơn hàng">
          {[1, 2, 3].map((n) => (
            <div className="ord-skel-card" key={n}>
              <div className="ord-skel" style={{ height: 22, width: "36%" }} />
              <div className="ord-skel" style={{ height: 74, width: "100%" }} />
              <div className="ord-skel" style={{ height: 38, width: "52%", justifySelf: "end" }} />
            </div>
          ))}
        </section>
      ) : filteredOrders.length === 0 ? (
        <EmptyOrdersState hasFilters={hasFilters} onResetFilters={handleResetFilters} />
      ) : (
        <section className="ord-list">
          {filteredOrders.map((order) => {
            const isBusy = actionOrderId === order.id;
            const paymentMeta = getPaymentStatusMeta(order.paymentStatus, order.paymentMethod);
            const detailUrl = routeConfig.public.orderDetail.replace(":orderId", String(order.id));
            const items = order.items || [];
            const previewItems = items.slice(0, 2);
            const hiddenCount = Math.max(0, items.length - previewItems.length);
            const accentColor = getOrderAccentColor(order);
            const payVietQr = canCustomerPayVietQr(order);
            const payVnpay = canCustomerPayOrder(order);
            const confirmReceived = canCustomerConfirmReceived(order);
            const canCancel = canCustomerCancelOrder(order);
            const hasPrimaryOverride = payVietQr || payVnpay || confirmReceived;

            return (
              <article
                className={`ord-card ${createdOrderId === order.id ? "is-new" : ""}`}
                style={{ "--ord-accent": accentColor }}
                key={order.id}
              >
                {/* Card Header */}
                <header className="ord-card__head">
                  <div className="ord-card__head-left">
                    <span className="ord-store-tag">
                      <StoreIcon /> PC Mall Official
                    </span>
                    <Link to={detailUrl} className="ord-card__id-link">
                      Đơn hàng #{order.id}
                    </Link>
                    <button
                      type="button"
                      className={`ord-copy-id ${copiedOrderId === order.id ? "copied" : ""}`}
                      onClick={() => handleCopyOrderId(order.id)}
                      title="Sao chép mã đơn hàng"
                    >
                      {copiedOrderId === order.id ? <CheckIcon size={12} /> : <CopyIcon />}
                    </button>
                    <span className="ord-card__date">{formatDate(order.createdAt)}</span>
                  </div>

                  <div className="ord-card__head-right">
                    <OrderStatusBadge
                      status={order.status}
                      paymentMethod={order.paymentMethod}
                      paymentStatus={order.paymentStatus}
                    />
                  </div>
                </header>

                {/* Product List Preview */}
                <div className="ord-card__items">
                  {previewItems.length > 0 ? (
                    previewItems.map((item) => (
                      <Link
                        to={detailUrl}
                        className="ord-item-row"
                        key={item.id || `${item.name}-${item.sku}`}
                      >
                        <div className="ord-item-thumb">
                          {item.image_url ? (
                            <img src={resolveProductImage(item)} alt={item.product_name || item.name} />
                          ) : (
                            <PackageIcon size={22} />
                          )}
                        </div>

                        <div className="ord-item-body">
                          <div className="ord-item-name">{item.product_name || item.name}</div>
                          <div className="ord-item-tags">
                            {item.sku ? <span className="ord-sku-chip">SKU: {item.sku}</span> : null}
                            <span className="ord-qty-chip">×{item.quantity || 1}</span>
                          </div>
                        </div>

                        <div className="ord-item-price">
                          <strong>{formatCurrency(item.line_total || item.unit_price * (item.quantity || 1))} đ</strong>
                          {item.quantity > 1 ? (
                            <span>
                              {formatCurrency(item.unit_price || item.price)} đ × {item.quantity}
                            </span>
                          ) : null}
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="ord-item-empty">Chưa có dữ liệu sản phẩm trong đơn.</div>
                  )}

                  {hiddenCount > 0 ? (
                    <Link to={detailUrl} className="ord-more-items">
                      <span>Xem thêm {hiddenCount} sản phẩm khác trong đơn hàng này</span>
                      <ChevronRightIcon />
                    </Link>
                  ) : null}
                </div>

                {/* Compact Tracking & Mini Stepper Strip */}
                <InlineOrderProgress order={order} />

                {/* Card Footer: Payment Summary + Action Group */}
                <footer className="ord-card__foot">
                  <div className="ord-card__pay-meta">
                    <span className="ord-pay-status-chip" style={{ color: paymentMeta.tone }}>
                      <span className="ord-pay-dot" style={{ background: paymentMeta.tone }} />
                      {paymentMeta.label}
                    </span>
                    <span className="ord-meta-sep">·</span>
                    <span className="ord-meta-muted">{getPaymentMethodLabel(order.paymentMethod)}</span>
                    <span className="ord-meta-sep">·</span>
                    <span className="ord-meta-muted">{order.totalItems || items.length || 0} sản phẩm</span>
                  </div>

                  <div className="ord-card__foot-right">
                    <div className="ord-card__total">
                      <span>Thành tiền:</span>
                      <strong>{formatCurrency(order.finalAmount)} đ</strong>
                    </div>

                    <div className="ord-card__actions">
                      {canCancel ? (
                        <button
                          type="button"
                          className="ord-btn ord-btn--danger"
                          disabled={isBusy}
                          onClick={() => handleCancelOrder(order.id)}
                        >
                          {isBusy ? "Đang hủy..." : "Hủy đơn"}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        className="ord-btn ord-btn--secondary"
                        disabled={isBusy}
                        onClick={() => handleReorder(order)}
                      >
                        <CartIcon /> {isBusy ? "Đang thêm..." : "Mua lại"}
                      </button>

                      {payVietQr ? (
                        <Link
                          to={routeConfig.public.paymentVietQr.replace(":orderId", String(order.id))}
                          className="ord-btn ord-btn--primary"
                        >
                          <QrIcon /> Quét QR thanh toán
                        </Link>
                      ) : null}

                      {payVnpay ? (
                        <button
                          type="button"
                          className="ord-btn ord-btn--primary"
                          disabled={isBusy}
                          onClick={() => handlePayOrder(order)}
                        >
                          {isBusy
                            ? "Đang mở..."
                            : ["FAILED", "PAYMENT_CANCELLED"].includes(normalizeStatus(order.paymentStatus))
                              ? "Thanh toán lại VNPay"
                              : "Thanh toán VNPay"}
                        </button>
                      ) : null}

                      {confirmReceived ? (
                        <button
                          type="button"
                          className="ord-btn ord-btn--success"
                          disabled={isBusy}
                          onClick={() => handleConfirmReceived(order.id)}
                        >
                          <CheckIcon /> {isBusy ? "Đang xác nhận..." : "Đã nhận được hàng"}
                        </button>
                      ) : null}

                      <Link
                        to={detailUrl}
                        className={`ord-btn ${hasPrimaryOverride ? "ord-btn--ghost" : "ord-btn--primary"}`}
                      >
                        Xem chi tiết <ChevronRightIcon />
                      </Link>
                    </div>
                  </div>
                </footer>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

const ordersStyles = `
.ord-page {
  max-width: 1220px;
  margin: 0 auto;
  display: grid;
  gap: 18px;
  padding-bottom: 40px;
}

/* Breadcrumb */
.ord-crumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #64748b;
  font-weight: 600;
}
.ord-crumb a {
  color: #64748b;
  text-decoration: none;
}
.ord-crumb a:hover {
  color: #2563eb;
}
.ord-crumb__current {
  color: #0f172a;
  font-weight: 800;
}

/* Executive Compact Header Card */
.ord-header-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 24px;
  align-items: center;
  padding: 26px 30px;
  border-radius: 24px;
  color: #f8fafc;
  background:
    radial-gradient(circle at 92% 14%, rgba(59, 130, 246, 0.34) 0%, transparent 45%),
    radial-gradient(circle at 8% 92%, rgba(16, 185, 129, 0.16) 0%, transparent 42%),
    linear-gradient(135deg, #0b1120 0%, #132240 55%, #0f172a 100%);
  box-shadow: 0 20px 44px -16px rgba(15, 23, 42, 0.28);
  overflow: hidden;
}
.ord-header-card__eyebrow {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.18);
  border: 1px solid rgba(147, 197, 253, 0.28);
  color: #93c5fd;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 10px;
}
.ord-header-card__title {
  margin: 0;
  font-size: clamp(26px, 3.2vw, 34px);
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: #ffffff;
}
.ord-header-card__sub {
  margin: 8px 0 0;
  font-size: 14px;
  color: #cbd5e1;
  line-height: 1.5;
  max-width: 600px;
}
.ord-header-card__sub strong {
  color: #ffffff;
}
.ord-header-card__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(168px, 1fr));
  gap: 12px;
}
.ord-metric-box {
  padding: 15px 18px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  display: grid;
  gap: 4px;
}
.ord-metric-box--accent {
  background: linear-gradient(145deg, rgba(37, 99, 235, 0.24), rgba(255, 255, 255, 0.06));
  border-color: rgba(147, 197, 253, 0.26);
}
.ord-metric-box__label {
  font-size: 11px;
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
}
.ord-metric-box__value {
  font-size: 22px;
  font-weight: 900;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.ord-metric-box__hint {
  font-size: 11.5px;
  color: #94a3b8;
  font-weight: 500;
}

/* Alerts */
.ord-alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 700;
}
.ord-alert a {
  color: inherit;
  text-decoration: underline;
}
.ord-alert--success {
  background: #ecfdf5;
  border: 1px solid #86efac;
  color: #047857;
}
.ord-alert--info {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1d4ed8;
}
.ord-alert--danger {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
}

/* Unified Controls Card (Tabs + Search + Payment Pills) */
.ord-controls-card {
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 8px 24px -10px rgba(15, 23, 42, 0.06);
  overflow: hidden;
}
.ord-tabs {
  display: flex;
  align-items: stretch;
  overflow-x: auto;
  border-bottom: 1px solid #e2e8f0;
  padding: 0 12px;
  scrollbar-width: none;
}
.ord-tabs::-webkit-scrollbar {
  display: none;
}
.ord-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 15px 16px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 14px;
  font-weight: 750;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.18s ease;
}
.ord-tab:hover {
  color: #0f172a;
}
.ord-tab.is-active {
  color: #2563eb;
}
.ord-tab.is-active::after {
  content: "";
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 0;
  height: 3px;
  border-radius: 999px 999px 0 0;
  background: #2563eb;
}
.ord-tab__count {
  min-width: 20px;
  padding: 2px 7px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #475569;
  font-size: 11.5px;
  font-weight: 800;
}
.ord-tab__count.is-active {
  background: #eff6ff;
  color: #2563eb;
}

.ord-search-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 18px;
  background: #f8fafc;
  flex-wrap: wrap;
}
.ord-search-input {
  flex: 1 1 320px;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #dbe4f0;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.ord-search-input:focus-within {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}
.ord-search-input__icon {
  color: #94a3b8;
  display: grid;
}
.ord-search-input input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: #0f172a;
  font-size: 13.5px;
  font-weight: 600;
}
.ord-search-input__clear {
  border: none;
  background: #e2e8f0;
  color: #475569;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 800;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.ord-pay-pills {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.ord-pay-pill {
  padding: 8px 13px;
  border-radius: 10px;
  border: 1px solid #dbe4f0;
  background: #ffffff;
  color: #475569;
  font-size: 12.5px;
  font-weight: 750;
  cursor: pointer;
  transition: all 0.16s ease;
}
.ord-pay-pill:hover {
  border-color: #93c5fd;
  color: #1d4ed8;
}
.ord-pay-pill.is-active {
  background: #0f172a;
  border-color: #0f172a;
  color: #ffffff;
}

/* Order Cards List */
.ord-list {
  display: grid;
  gap: 16px;
}
.ord-card {
  position: relative;
  border-radius: 22px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 26px -12px rgba(15, 23, 42, 0.08);
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.ord-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--ord-accent, #2563eb);
  opacity: 0.85;
}
.ord-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 16px 36px -14px rgba(15, 23, 42, 0.12);
}
.ord-card.is-new {
  border-color: #60a5fa;
  box-shadow: 0 18px 40px -12px rgba(37, 99, 235, 0.2);
}

.ord-card__head {
  padding: 16px 22px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  border-bottom: 1px solid #f1f5f9;
}
.ord-card__head-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.ord-store-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 7px;
  background: linear-gradient(135deg, #1e3a8a, #2563eb);
  color: #ffffff;
  font-size: 11px;
  font-weight: 800;
}
.ord-card__id-link {
  font-size: 15.5px;
  font-weight: 850;
  color: #0f172a;
  text-decoration: none;
  letter-spacing: -0.01em;
}
.ord-card__id-link:hover {
  color: #2563eb;
}
.ord-copy-id {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
}
.ord-copy-id:hover {
  border-color: #93c5fd;
  color: #2563eb;
  background: #eff6ff;
}
.ord-copy-id.copied {
  border-color: #86efac;
  background: #ecfdf5;
  color: #059669;
}
.ord-card__date {
  font-size: 12.5px;
  color: #64748b;
  font-weight: 600;
}
.ord-card__head-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Product Rows inside Card */
.ord-card__items {
  display: grid;
}
.ord-item-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 22px;
  text-decoration: none;
  border-bottom: 1px solid #f1f5f9;
  transition: background 0.15s ease;
}
.ord-item-row:last-child {
  border-bottom: none;
}
.ord-item-row:hover {
  background: #fafcff;
}
.ord-item-thumb {
  width: 72px;
  height: 72px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: grid;
  place-items: center;
  padding: 5px;
  flex-shrink: 0;
  overflow: hidden;
  color: #94a3b8;
}
.ord-item-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.ord-item-body {
  flex: 1;
  min-width: 0;
}
.ord-item-name {
  font-size: 15px;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ord-item-tags {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  margin-top: 6px;
}
.ord-sku-chip {
  padding: 2px 8px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #475569;
  font-size: 11.5px;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.ord-qty-chip {
  padding: 2px 8px;
  border-radius: 6px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 11.5px;
  font-weight: 800;
}
.ord-item-price {
  text-align: right;
  flex-shrink: 0;
  display: grid;
  gap: 2px;
}
.ord-item-price strong {
  font-size: 15.5px;
  font-weight: 850;
  color: #0f172a;
  font-variant-numeric: tabular-nums;
}
.ord-item-price span {
  font-size: 12px;
  color: #64748b;
  font-variant-numeric: tabular-nums;
}
.ord-item-empty {
  padding: 18px 22px;
  color: #64748b;
  font-size: 13.5px;
  font-weight: 600;
}
.ord-more-items {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 22px;
  background: #f8fafc;
  border-top: 1px dashed #e2e8f0;
  color: #2563eb;
  font-size: 12.5px;
  font-weight: 750;
  text-decoration: none;
}
.ord-more-items:hover {
  background: #eff6ff;
}

/* Compact Inline Progress Strip */
.ord-strip {
  padding: 12px 22px;
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.ord-strip--success {
  background: #f0fdf4;
  border-top-color: #dcfce7;
}
.ord-strip--danger {
  background: #fef2f2;
  border-top-color: #fee2e2;
  justify-content: flex-start;
  gap: 10px;
}
.ord-strip__status {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  flex: 1 1 300px;
}
.ord-strip__icon {
  color: #2563eb;
  display: grid;
  flex-shrink: 0;
}
.ord-strip--success .ord-strip__icon {
  color: #059669;
}
.ord-strip__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
}
.ord-strip__dot--danger {
  background: #dc2626;
  box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.16);
}
.ord-strip__text {
  font-size: 13px;
  font-weight: 650;
  color: #334155;
  line-height: 1.45;
}
.ord-strip--danger .ord-strip__text {
  color: #991b1b;
}

.ord-mini-stepper {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.ord-mini-step {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 700;
  color: #94a3b8;
}
.ord-mini-step__dot {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 1.5px solid #cbd5e1;
  background: #ffffff;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 800;
  display: grid;
  place-items: center;
}
.ord-mini-step.is-done {
  color: #047857;
}
.ord-mini-step.is-done .ord-mini-step__dot {
  border-color: #10b981;
  background: #10b981;
  color: #ffffff;
}
.ord-mini-step.is-current {
  color: #1d4ed8;
}
.ord-mini-step.is-current .ord-mini-step__dot {
  border-color: #2563eb;
  background: #2563eb;
  color: #ffffff;
}

/* Card Footer */
.ord-card__foot {
  padding: 16px 22px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border-top: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.ord-card__pay-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12.5px;
}
.ord-pay-status-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 800;
}
.ord-pay-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
}
.ord-meta-sep {
  color: #cbd5e1;
}
.ord-meta-muted {
  color: #64748b;
  font-weight: 650;
}

.ord-card__foot-right {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  margin-left: auto;
}
.ord-card__total {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.ord-card__total span {
  font-size: 13px;
  color: #64748b;
  font-weight: 700;
}
.ord-card__total strong {
  font-size: 20px;
  font-weight: 900;
  color: #2563eb;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.ord-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* Buttons */
.ord-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 15px;
  border-radius: 11px;
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.16s ease;
}
.ord-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.ord-btn--primary {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #ffffff;
  box-shadow: 0 6px 16px -6px rgba(37, 99, 235, 0.45);
}
.ord-btn--primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px -6px rgba(37, 99, 235, 0.55);
}
.ord-btn--success {
  background: linear-gradient(135deg, #059669, #10b981);
  color: #ffffff;
}
.ord-btn--secondary {
  background: #ffffff;
  border-color: #dbe4f0;
  color: #1e293b;
}
.ord-btn--secondary:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #93c5fd;
  color: #1d4ed8;
}
.ord-btn--ghost {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}
.ord-btn--ghost:hover:not(:disabled) {
  background: #dbeafe;
}
.ord-btn--danger {
  background: #ffffff;
  border-color: #fecaca;
  color: #dc2626;
}
.ord-btn--danger:hover:not(:disabled) {
  background: #fef2f2;
  border-color: #f87171;
}

/* Skeleton Loader */
@keyframes ordShimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.ord-skeleton-list {
  display: grid;
  gap: 16px;
}
.ord-skel-card {
  padding: 22px;
  border-radius: 22px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  display: grid;
  gap: 14px;
}
.ord-skel {
  border-radius: 12px;
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: ordShimmer 1.4s ease infinite;
}

/* Empty & Auth States */
.ord-empty,
.ord-auth-card {
  padding: 44px 28px;
  border-radius: 24px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.06);
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 12px;
}
.ord-empty h2,
.ord-auth-card h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 900;
  color: #0f172a;
}
.ord-empty p,
.ord-auth-card p {
  margin: 0;
  max-width: 460px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.55;
}
.ord-auth-card__icon {
  width: 60px;
  height: 60px;
  border-radius: 18px;
  background: #eff6ff;
  color: #2563eb;
  display: grid;
  place-items: center;
}

/* Responsive */
@media (max-width: 960px) {
  .ord-header-card {
    grid-template-columns: 1fr;
    padding: 22px;
  }
  .ord-card__foot-right {
    margin-left: 0;
    width: 100%;
    justify-content: space-between;
  }
}

@media (max-width: 680px) {
  .ord-header-card__metrics {
    grid-template-columns: 1fr;
  }
  .ord-card__head,
  .ord-item-row,
  .ord-strip,
  .ord-card__foot {
    padding-left: 16px;
    padding-right: 16px;
  }
  .ord-item-row {
    align-items: flex-start;
  }
  .ord-item-thumb {
    width: 60px;
    height: 60px;
  }
  .ord-mini-stepper {
    display: none;
  }
  .ord-card__foot-right {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .ord-card__total {
    justify-content: space-between;
  }
  .ord-card__actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
`;
