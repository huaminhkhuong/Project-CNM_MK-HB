import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

import { OrderStatusBadge } from "../../components/marketplace/OrderStatusBadge";
import { useAuth } from "../../hooks/useAuth";
import { addItemToCart } from "../../services/cart.service";
import { cancelMyOrder, confirmOrderReceived, createVnpayUrl, getMyOrders } from "../../services/order.service";
import { subscribeToOrderEvents } from "../../services/order-events.service";
import { routeConfig } from "../../routes/routeConfig";
import { PAYMENT_STATUS_META, canCustomerCancelOrder, canCustomerConfirmReceived, canCustomerPayOrder } from "../../utils/orderStatus";
import { resolveProductImage } from "../../utils/productImage";

function getErrorMessage(error, fallbackMessage) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallbackMessage;
  }
  return error.message || fallbackMessage;
}

function normalizeOrdersResponse(response) {
  return response?.data || response;
}

function mapOrderItemToUi(item) {
  return {
    id: item.id,
    productId: item.product_id || item.productId || item.ProductSku?.product_id || item.product?.id || null,
    productVariantId: item.product_variant_id || item.productVariantId || item.ProductSku?.id || null,
    product_name: item.product_name || item.name_snapshot || item.nameSnapshot || item.productName || item.product?.name || item.ProductSku?.Product?.name || "Sản phẩm",
    name: item.name || item.name_snapshot || item.nameSnapshot || item.productName || item.product?.name || item.ProductSku?.Product?.name || "Sản phẩm",
    sku: item.sku || item.sku_snapshot || item.skuSnapshot || item.ProductSku?.sku,
    quantity: Number(item.quantity || 0),
    price: Number(item.price || item.unit_price || item.unitPrice || 0),
    unit_price: Number(item.unit_price || item.unitPrice || item.price || 0),
    line_total: Number(item.line_total || item.lineTotal || 0),
    image_url: item.image_url || item.imageUrl || item.ProductSku?.image_url || item.ProductSku?.imageUrl || item.product?.imageUrl || null
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

function getPaymentStatusMeta(status) {
  return PAYMENT_STATUS_META[String(status || "").toUpperCase()] || {
    label: status || "Chưa thanh toán",
    tone: "#64748b"
  };
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
  if (normalized === "BANK_TRANSFER" || normalized === "QR_BANKING") return "QR Banking";
  if (normalized === "COD") return "COD";
  return method || "COD";
}

function getCustomerName(authState) {
  const user = authState?.user || {};
  return user.fullName || user.name || user.email || "bạn";
}

function getOrderSearchText(order) {
  const itemText = (order.items || [])
    .map((item) => [item.product_name, item.name, item.sku].filter(Boolean).join(" "))
    .join(" ");
  return [
    order.id,
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

function getTrackingText(order) {
  const status = normalizeStatus(order.status);
  if (order.shipment?.trackingCode) return `Mã vận đơn ${order.shipment.trackingCode}`;
  if (status === "PENDING") return "Đơn hàng đang chờ xác nhận từ cửa hàng.";
  if (status === "PROCESSING" || status === "PAID") return "Đơn hàng đang được chuẩn bị và đóng gói.";
  if (status === "SHIPPED") return "Đơn hàng đang trên đường giao đến bạn.";
  if (status === "DELIVERED") return "Đơn hàng đã giao thành công. Vui lòng xác nhận khi bạn đã nhận đủ hàng.";
  if (status === "COMPLETED") return "Đơn hàng đã hoàn tất.";
  if (status === "CANCELED") return "Đơn hàng đã được hủy.";
  return "Trạng thái vận chuyển sẽ được cập nhật sớm.";
}

function getProgressStep(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "COMPLETED") return 4;
  if (normalized === "DELIVERED") return 3;
  if (normalized === "SHIPPED") return 3;
  if (normalized === "PROCESSING" || normalized === "PAID") return 2;
  if (normalized === "CANCELED") return 0;
  return 1;
}

const FILTER_TABS = [
  { id: "ALL", label: "Tất cả", icon: "📦" },
  { id: "PENDING", label: "Chờ xác nhận", icon: "⏳" },
  { id: "PROCESSING", label: "Đang xử lý", icon: "⚙️" },
  { id: "SHIPPED", label: "Đang giao", icon: "🚚" },
  { id: "DELIVERED", label: "Đã giao", icon: "✅" },
  { id: "COMPLETED", label: "Hoàn tất", icon: "✓" },
  { id: "CANCELED", label: "Đã hủy", icon: "✕" }
];

const PAYMENT_FILTERS = [
  { id: "ALL", label: "Tất cả thanh toán" },
  { id: "COD", label: "COD" },
  { id: "VNPAY", label: "VNPay" },
  { id: "BANK_TRANSFER", label: "QR Banking" }
];

const PROGRESS_STEPS = ["Xác nhận", "Xử lý", "Vận chuyển", "Hoàn tất"];

function OrderProgress({ status }) {
  const normalized = normalizeStatus(status);
  const activeStep = getProgressStep(status);

  if (normalized === "CANCELED") {
    return (
      <div className="order-tracking order-tracking--cancelled">
        <span className="order-tracking__dot" />
        <div>
          <strong>Đơn hàng đã hủy</strong>
          <p>Đơn này không tiếp tục xử lý. Bạn có thể mua lại sản phẩm khi cần.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="order-progress" aria-label="Tiến trình đơn hàng">
      {PROGRESS_STEPS.map((step, index) => {
        const isActive = index + 1 <= activeStep;
        return (
          <div className={`order-progress__step ${isActive ? "is-active" : ""}`} key={step}>
            <span className="order-progress__marker">{isActive ? "✓" : index + 1}</span>
            <span>{step}</span>
          </div>
        );
      })}
    </div>
  );
}

function EmptyOrdersState({ hasFilters }) {
  return (
    <div className="orders-empty">
      <div className="orders-empty__art" aria-hidden="true">
        <svg viewBox="0 0 180 140" role="img">
          <rect x="28" y="38" width="124" height="78" rx="18" fill="#eff6ff" />
          <path d="M55 58h70l-8 50H63L55 58Z" fill="#ffffff" stroke="#2563eb" strokeWidth="4" />
          <path d="M73 58c0-18 34-18 34 0" fill="none" stroke="#111827" strokeWidth="6" strokeLinecap="round" />
          <circle cx="132" cy="38" r="16" fill="#f59e0b" />
          <path d="M126 38h12M132 32v12" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>
      <div>
        <h2>{hasFilters ? "Không tìm thấy đơn phù hợp" : "Bạn chưa có đơn hàng nào"}</h2>
        <p>{hasFilters ? "Thử đổi từ khóa, trạng thái hoặc phương thức thanh toán để xem thêm đơn hàng." : "Khám phá linh kiện PC, lưu cấu hình và đặt hàng để theo dõi mọi thứ tại đây."}</p>
      </div>
      <Link to={routeConfig.public.catalog} className="orders-empty__cta">
        Tiếp tục mua sắm
      </Link>
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
        if (status === "PENDING") acc.pending += 1;
        if (status === "PROCESSING" || status === "PAID") acc.processing += 1;
        if (status === "SHIPPED") acc.shipped += 1;
        if (isDeliveredStatus(status)) acc.delivered += 1;
        if (status === "COMPLETED") acc.completed += 1;
        if (status === "CANCELED") acc.canceled += 1;
        return acc;
      },
      { total: 0, pending: 0, processing: 0, shipped: 0, delivered: 0, completed: 0, canceled: 0 }
    );
  }, [orders]);

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
          // Skip out-of-stock or inactive items and continue adding remaining items
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

  if (!isAuthenticated) {
    return (
      <div className="orders-dashboard">
        <style>{ordersStyles}</style>
        <section className="orders-auth-card">
          <span className="orders-auth-card__icon">🔐</span>
          <h1>Đơn hàng của tôi</h1>
          <p>Bạn cần đăng nhập để xem lịch sử mua hàng, thanh toán và theo dõi vận chuyển.</p>
          <Link to={routeConfig.public.login} className="order-action order-action--primary">
            Đi đến trang đăng nhập
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="orders-dashboard">
      <style>{ordersStyles}</style>

      <section className="orders-hero">
        <div>
          <span className="orders-hero__eyebrow">PC Mall Account</span>
          <h1>Xin chào, {getCustomerName(authState)}</h1>
          <p>Quản lý đơn hàng, thanh toán, vận chuyển và thao tác nhanh trong một dashboard gọn gàng.</p>
        </div>
        <div className="orders-hero__summary">
          <span>Tổng chi tiêu</span>
          <strong>{formatCurrency(orders.reduce((sum, order) => sum + Number(order.finalAmount || 0), 0))} đ</strong>
          <small>{stats.total} đơn hàng đã ghi nhận</small>
        </div>
      </section>

      <section className="orders-stats" aria-label="Thống kê đơn hàng">
        <div className="orders-stat-card orders-stat-card--total">
          <span>Tổng đơn</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="orders-stat-card">
          <span>Chờ xác nhận</span>
          <strong>{stats.pending}</strong>
        </div>
        <div className="orders-stat-card">
          <span>Đang xử lý</span>
          <strong>{stats.processing}</strong>
        </div>
        <div className="orders-stat-card">
          <span>Đã giao</span>
          <strong>{stats.delivered}</strong>
        </div>
        <div className="orders-stat-card orders-stat-card--danger">
          <span>Đã hủy</span>
          <strong>{stats.canceled}</strong>
        </div>
      </section>

      {createdOrderId ? (
        <div className="orders-alert orders-alert--success">
          Đơn hàng mới <strong>#{createdOrderId}</strong> đã được tạo thành công.
        </div>
      ) : null}

      {buildsMigrated > 0 ? (
        <div className="orders-alert orders-alert--info">
          Đã đồng bộ <strong>{buildsMigrated}</strong> cấu hình PC từ chế độ khách lên tài khoản. Xem tại{" "}
          <Link to={routeConfig.public.pcBuilder}>PC Builder</Link>.
        </div>
      ) : null}

      {successMessage ? <div className="orders-alert orders-alert--success">{successMessage}</div> : null}
      {errorMessage ? <div className="orders-alert orders-alert--danger">{errorMessage}</div> : null}

      <section className="orders-toolbar">
        <label className="orders-search">
          <span>🔎</span>
          <input
            type="search"
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder="Tìm mã đơn, sản phẩm, SKU, địa chỉ, mã vận đơn..."
          />
        </label>
        <label className="orders-filter">
          <span>Phương thức thanh toán</span>
          <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
            {PAYMENT_FILTERS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <nav className="orders-tabs" aria-label="Lọc trạng thái đơn hàng">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`orders-tab ${statusFilter === tab.id ? "is-active" : ""}`}
          >
            <span className="orders-tab__icon">{tab.icon}</span>
            <span>{tab.label}</span>
            <strong>{tabCounts[tab.id] || 0}</strong>
          </button>
        ))}
      </nav>

      {loading ? (
        <section className="orders-loading">
          <span className="orders-loading__spinner" />
          <div>
            <strong>Đang tải lịch sử đơn hàng...</strong>
            <p>Vui lòng chờ trong giây lát.</p>
          </div>
        </section>
      ) : filteredOrders.length === 0 ? (
        <EmptyOrdersState hasFilters={Boolean(searchKeyword || paymentFilter !== "ALL" || statusFilter !== "ALL")} />
      ) : (
        <section className="orders-list">
          {filteredOrders.map((order) => {
            const isBusy = actionOrderId === order.id;
            const paymentMeta = getPaymentStatusMeta(order.paymentStatus);
            const detailUrl = routeConfig.public.orderDetail.replace(":orderId", String(order.id));
            const itemPreview = order.items || [];

            return (
              <article className={`order-card ${createdOrderId === order.id ? "is-new" : ""}`} key={order.id}>
                <div className="order-card__top">
                  <div>
                    <div className="order-card__id">Đơn hàng #{order.id}</div>
                    <div className="order-card__date">{order.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : "Chưa có ngày đặt"}</div>
                  </div>
                  <div className="order-card__badges">
                    <OrderStatusBadge status={order.status} />
                    <span className="payment-badge" style={{ color: paymentMeta.tone, borderColor: `${paymentMeta.tone}33`, background: `${paymentMeta.tone}12` }}>
                      {paymentMeta.label}
                    </span>
                  </div>
                </div>

                <div className="order-card__body">
                  <div className="order-card__main">
                    <div className="order-products">
                      {itemPreview.length > 0 ? (
                        itemPreview.slice(0, 4).map((item) => (
                          <div className="order-product" key={item.id || `${item.name}-${item.sku}`}>
                            <div className="order-product__image">
                              <img src={resolveProductImage(item)} alt={item.product_name || item.name || "Sản phẩm"} />
                            </div>
                            <div>
                              <strong>{item.product_name || item.name || "Sản phẩm"}</strong>
                              <span>{item.sku ? `SKU: ${item.sku} · ` : ""}SL {item.quantity || 1} · {formatCurrency(item.price || item.unit_price)} đ</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="order-product order-product--empty">Chưa có dữ liệu sản phẩm trong đơn.</div>
                      )}
                      {itemPreview.length > 4 ? <div className="order-products__more">+{itemPreview.length - 4} sản phẩm khác</div> : null}
                    </div>

                    <OrderProgress status={order.status} />

                    <div className="order-tracking">
                      <span className="order-tracking__dot" />
                      <div>
                        <strong>Theo dõi đơn hàng</strong>
                        <p>{getTrackingText(order)}</p>
                      </div>
                    </div>
                  </div>

                  <aside className="order-card__summary">
                    <div>
                      <span>Tổng thanh toán</span>
                      <strong>{formatCurrency(order.finalAmount)} đ</strong>
                    </div>
                    <dl>
                      <div>
                        <dt>Phương thức</dt>
                        <dd>{getPaymentMethodLabel(order.paymentMethod)}</dd>
                      </div>
                      <div>
                        <dt>Số lượng</dt>
                        <dd>{order.totalItems || itemPreview.length || 0} sản phẩm</dd>
                      </div>
                      <div>
                        <dt>Địa chỉ</dt>
                        <dd>{order.shippingAddress || "Chưa có thông tin"}</dd>
                      </div>
                    </dl>
                  </aside>
                </div>

                <div className="order-card__actions">
                  <Link to={detailUrl} className="order-action order-action--primary">
                    Xem chi tiết
                  </Link>
                  <Link to={detailUrl} className="order-action">
                    Theo dõi đơn hàng
                  </Link>
                  <button type="button" className="order-action" disabled={isBusy} onClick={() => handleReorder(order)}>
                    {isBusy ? "Đang thêm..." : "Mua lại"}
                  </button>
                  {canCustomerPayOrder(order) ? (
                    <button type="button" className="order-action order-action--pay" disabled={isBusy} onClick={() => handlePayOrder(order)}>
                      {isBusy ? "Đang mở..." : "Thanh toán VNPay"}
                    </button>
                  ) : null}
                  {canCustomerCancelOrder(order) ? (
                    <button type="button" className="order-action order-action--danger" disabled={isBusy} onClick={() => handleCancelOrder(order.id)}>
                      {isBusy ? "Đang xử lý..." : "Hủy đơn"}
                    </button>
                  ) : null}
                  {canCustomerConfirmReceived(order) ? (
                    <button type="button" className="order-action order-action--success" disabled={isBusy} onClick={() => handleConfirmReceived(order.id)}>
                      {isBusy ? "Đang xác nhận..." : "Xác nhận đã nhận hàng"}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

const ordersStyles = `
.orders-dashboard {
  display: grid;
  gap: 22px;
}

.orders-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 24px;
  align-items: end;
  padding: 30px;
  border-radius: 28px;
  color: #fff;
  background:
    radial-gradient(circle at top right, rgba(96, 165, 250, 0.38), transparent 34%),
    linear-gradient(135deg, #0f172a 0%, #1e3a8a 58%, #2563eb 100%);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
}

.orders-hero__eyebrow {
  display: inline-flex;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #bfdbfe;
}

.orders-hero h1 {
  margin: 0;
  font-size: clamp(30px, 4vw, 46px);
  line-height: 1.08;
}

.orders-hero p {
  max-width: 680px;
  margin: 10px 0 0;
  color: rgba(255, 255, 255, 0.82);
  font-size: 16px;
}

.orders-hero__summary {
  min-width: 240px;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.32);
}

.orders-hero__summary span,
.orders-hero__summary small {
  display: block;
  color: rgba(255, 255, 255, 0.72);
}

.orders-hero__summary strong {
  display: block;
  margin: 8px 0 4px;
  font-size: 24px;
}

.orders-stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.orders-stat-card {
  min-height: 104px;
  padding: 18px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.06);
}

.orders-stat-card span {
  color: #64748b;
  font-weight: 700;
  font-size: 13px;
}

.orders-stat-card strong {
  display: block;
  margin-top: 10px;
  color: #0f172a;
  font-size: 32px;
  line-height: 1;
}

.orders-stat-card--total {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(135deg, #0f172a, #2563eb);
}

.orders-stat-card--total span,
.orders-stat-card--total strong {
  color: #fff;
}

.orders-stat-card--danger strong {
  color: #dc2626;
}

.orders-alert {
  padding: 15px 18px;
  border-radius: 16px;
  font-weight: 700;
}

.orders-alert a {
  color: inherit;
}

.orders-alert--success {
  color: #047857;
  border: 1px solid #86efac;
  background: #ecfdf5;
}

.orders-alert--info {
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
}

.orders-alert--danger {
  color: #b91c1c;
  border: 1px solid #fecaca;
  background: #fef2f2;
}

.orders-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 12px;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
}

.orders-search,
.orders-filter {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 0 14px;
  border: 1px solid #dbe4f0;
  border-radius: 14px;
  background: #f8fafc;
}

.orders-search input,
.orders-filter select {
  width: 100%;
  border: 0;
  outline: 0;
  color: #0f172a;
  background: transparent;
  font: inherit;
}

.orders-filter {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2px;
  align-items: center;
}

.orders-filter span {
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.orders-tabs {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.orders-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  padding: 0 16px;
  border: 1px solid #dbe4f0;
  border-radius: 999px;
  color: #334155;
  background: #fff;
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

.orders-tab:hover {
  transform: translateY(-2px);
  border-color: #93c5fd;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.12);
}

.orders-tab.is-active {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(135deg, #0f172a, #2563eb);
}

.orders-tab strong {
  min-width: 24px;
  padding: 3px 8px;
  border-radius: 999px;
  color: #1d4ed8;
  background: #eff6ff;
  font-size: 12px;
}

.orders-tab.is-active strong {
  color: #0f172a;
  background: #fff;
}

.orders-list {
  display: grid;
  gap: 16px;
}

.order-card {
  display: grid;
  gap: 18px;
  padding: 20px;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
}

.order-card.is-new {
  border-color: #60a5fa;
  box-shadow: 0 20px 52px rgba(37, 99, 235, 0.14);
}

.order-card__top,
.order-card__body,
.order-card__actions {
  display: flex;
  gap: 16px;
}

.order-card__top {
  justify-content: space-between;
  align-items: flex-start;
}

.order-card__id {
  color: #0f172a;
  font-size: 24px;
  font-weight: 900;
}

.order-card__date {
  margin-top: 5px;
  color: #64748b;
  font-size: 14px;
}

.order-card__badges {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.payment-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 900;
}

.order-card__body {
  align-items: stretch;
}

.order-card__main {
  display: grid;
  gap: 14px;
  min-width: 0;
  flex: 1;
}

.order-products {
  display: grid;
  gap: 10px;
}

.order-product {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  min-height: 70px;
  padding: 10px;
  border: 1px solid #edf2f7;
  border-radius: 16px;
  background: #f8fafc;
}

.order-product--empty {
  display: block;
  color: #64748b;
  font-weight: 700;
}

.order-product__image {
  width: 58px;
  height: 58px;
  overflow: hidden;
  border-radius: 14px;
  background: #e2e8f0;
}

.order-product__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.order-product strong {
  display: block;
  overflow: hidden;
  color: #0f172a;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-product span,
.order-products__more {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
}

.order-progress {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.order-progress__step {
  position: relative;
  display: grid;
  gap: 6px;
  justify-items: center;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 800;
  text-align: center;
}

.order-progress__step::before {
  content: "";
  position: absolute;
  top: 15px;
  left: -50%;
  width: 100%;
  height: 3px;
  background: #e2e8f0;
  z-index: 0;
}

.order-progress__step:first-child::before {
  display: none;
}

.order-progress__step.is-active::before {
  background: #2563eb;
}

.order-progress__marker {
  z-index: 1;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  color: #94a3b8;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
}

.order-progress__step.is-active {
  color: #1d4ed8;
}

.order-progress__step.is-active .order-progress__marker {
  color: #fff;
  border-color: #2563eb;
  background: #2563eb;
}

.order-tracking {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px;
  border-radius: 16px;
  background: #eff6ff;
}

.order-tracking--cancelled {
  background: #fef2f2;
}

.order-tracking__dot {
  flex: 0 0 auto;
  width: 12px;
  height: 12px;
  margin-top: 5px;
  border-radius: 999px;
  background: #2563eb;
  box-shadow: 0 0 0 5px rgba(37, 99, 235, 0.14);
}

.order-tracking--cancelled .order-tracking__dot {
  background: #dc2626;
  box-shadow: 0 0 0 5px rgba(220, 38, 38, 0.14);
}

.order-tracking strong {
  color: #0f172a;
}

.order-tracking p {
  margin: 3px 0 0;
  color: #475569;
  font-size: 13px;
}

.order-card__summary {
  display: grid;
  align-content: start;
  gap: 14px;
  width: 310px;
  padding: 16px;
  border-radius: 18px;
  background: linear-gradient(180deg, #f8fafc, #eef6ff);
}

.order-card__summary span,
.order-card__summary dt {
  color: #64748b;
  font-size: 13px;
  font-weight: 800;
}

.order-card__summary strong {
  display: block;
  margin-top: 6px;
  color: #0f172a;
  font-size: 24px;
}

.order-card__summary dl {
  display: grid;
  gap: 10px;
  margin: 0;
}

.order-card__summary dl div {
  display: grid;
  gap: 3px;
}

.order-card__summary dd {
  margin: 0;
  color: #0f172a;
  font-weight: 700;
}

.order-card__actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.order-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid #dbe4f0;
  border-radius: 12px;
  color: #0f172a;
  background: #fff;
  font: inherit;
  font-weight: 900;
  text-decoration: none;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}

.order-action:hover {
  transform: translateY(-1px);
  border-color: #93c5fd;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.1);
}

.order-action:disabled {
  cursor: not-allowed;
  opacity: 0.68;
  transform: none;
}

.order-action--primary,
.order-action--pay {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(135deg, #0f172a, #2563eb);
}

.order-action--danger {
  color: #b91c1c;
  border-color: #fecaca;
  background: #fff;
}

.order-action--success {
  color: #fff;
  border-color: transparent;
  background: #059669;
}

.orders-loading,
.orders-empty,
.orders-auth-card {
  display: grid;
  gap: 14px;
  justify-items: center;
  padding: 34px;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  background: #fff;
  text-align: center;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
}

.orders-loading {
  grid-template-columns: auto minmax(0, 1fr);
  justify-items: start;
  text-align: left;
}

.orders-loading p,
.orders-empty p,
.orders-auth-card p {
  margin: 0;
  color: #64748b;
}

.orders-loading__spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #bfdbfe;
  border-top-color: #2563eb;
  border-radius: 999px;
  animation: orders-spin 800ms linear infinite;
}

.orders-empty__art {
  width: min(180px, 70vw);
}

.orders-empty__art svg {
  display: block;
  width: 100%;
  height: auto;
}

.orders-empty h2,
.orders-auth-card h1 {
  margin: 0;
  color: #0f172a;
}

.orders-empty__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 18px;
  border-radius: 14px;
  color: #fff;
  background: linear-gradient(135deg, #0f172a, #2563eb);
  font-weight: 900;
  text-decoration: none;
}

.orders-auth-card__icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: #eff6ff;
  font-size: 30px;
}

@keyframes orders-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1100px) {
  .orders-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .order-card__body {
    flex-direction: column;
  }

  .order-card__summary {
    width: auto;
  }
}

@media (max-width: 760px) {
  .orders-hero,
  .orders-toolbar,
  .orders-loading {
    grid-template-columns: 1fr;
  }

  .orders-hero {
    padding: 24px;
  }

  .orders-hero__summary {
    min-width: 0;
  }

  .orders-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .order-card {
    padding: 16px;
    border-radius: 20px;
  }

  .order-card__top,
  .order-card__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .order-card__badges {
    justify-content: flex-start;
  }

  .order-progress {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .order-progress__step::before {
    display: none;
  }

  .order-action {
    width: 100%;
  }
}

@media (max-width: 520px) {
  .orders-stats {
    grid-template-columns: 1fr;
  }

  .order-product {
    grid-template-columns: 48px minmax(0, 1fr);
  }

  .order-product__image {
    width: 48px;
    height: 48px;
  }

  .order-card__id {
    font-size: 20px;
  }
}
`;
