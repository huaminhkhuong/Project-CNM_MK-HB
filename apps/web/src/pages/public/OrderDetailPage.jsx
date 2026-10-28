import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";

import { OrderStatusBadge } from "../../components/marketplace/OrderStatusBadge";
import { useAuth } from "../../hooks/useAuth";
import { cancelMyOrder, confirmOrderReceived, createVnpayUrl, getOrderDetail, uploadPaymentProof } from "../../services/order.service";
import { subscribeToOrderEvents } from "../../services/order-events.service";
import { routeConfig } from "../../routes/routeConfig";
import { PAYMENT_STATUS_META, canCustomerCancelOrder, canCustomerConfirmReceived, canCustomerPayOrder } from "../../utils/orderStatus";
import { resolveProductImage } from "../../utils/productImage";

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api").replace(/\/api\/?$/, "");

function getErrorMessage(error, fallbackMessage) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallbackMessage;
  }

  return error?.message || fallbackMessage;
}

function normalizeResponse(response) {
  return response?.data?.data || response?.data || response;
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
    shippingAddress: dbOrder.shipping_address || dbOrder.shippingAddress,
    createdAt: dbOrder.created_at || dbOrder.createdAt,
    note: dbOrder.note,
    customer: dbOrder.customer || dbOrder.User || null,
    trackingCode: shipment?.trackingCode || dbOrder.tracking_code || dbOrder.trackingCode,
    shipmentStatus: shipment?.status || null,
    totalAmount: dbOrder.total_amount || dbOrder.totalAmount,
    shippingFee: dbOrder.shipping_fee || dbOrder.shippingFee || 0,
    discountAmount: dbOrder.discount_amount || dbOrder.discountAmount || 0,
    couponCode: dbOrder.coupon_code || dbOrder.couponCode || null,
    finalAmount: dbOrder.final_amount || dbOrder.finalAmount || dbOrder.total_amount || dbOrder.totalAmount || 0,
    items: (dbOrder.OrderItem || dbOrder.items || []).map((item) => ({
      id: item.id,
      productName: item.name_snapshot || item.nameSnapshot || item.productName || item.product?.name || "Sản phẩm",
      sku: item.sku_snapshot || item.skuSnapshot || item.sku,
      quantity: item.quantity,
      unitPrice: item.unit_price || item.unitPrice,
      lineTotal: item.line_total || item.lineTotal,
      imageUrl: item.ProductSku?.image_url || item.ProductSku?.imageUrl || item.imageUrl || item.product?.imageUrl || null
    }))
  };
}

function resolveUploadUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

function getPaymentMethodLabel(method) {
  const normalized = String(method || "").toUpperCase();
  if (normalized === "BANK_TRANSFER") return "BANK_TRANSFER / QR Banking";
  if (normalized === "VNPAY") return "VNPay";
  return normalized || "COD";
}

function getPaymentStatusMeta(status, method) {
  const normalized = String(status || "").toUpperCase();
  if (String(method || "").toUpperCase() === "BANK_TRANSFER" && ["PENDING_GATEWAY", "UNPAID", ""].includes(normalized)) {
    return { label: "Chờ tải minh chứng", tone: "#b45309" };
  }
  if (normalized === "AWAITING_ADMIN_CONFIRMATION" || normalized === "PENDING_VERIFICATION") {
    return { label: "Chờ admin xác nhận", tone: "#1d4ed8" };
  }
  return PAYMENT_STATUS_META[normalized] || { label: status || "Chưa thanh toán", tone: "#64748b" };
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

function getShipmentStatusLabel(status) {
  const labels = {
    CREATED: "Đã tạo vận đơn",
    READY_TO_SHIP: "Sẵn sàng giao",
    IN_TRANSIT: "Đang vận chuyển",
    DELIVERED: "Đã giao thành công",
    FAILED: "Giao thất bại",
    RETURNED: "Đã hoàn hàng",
    CANCELED: "Đã hủy vận đơn"
  };

  return labels[String(status || "").toUpperCase()] || status || "Chưa cập nhật";
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ fontSize: 13, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value || "Chưa có dữ liệu"}</div>
    </div>
  );
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
  const [paymentProof, setPaymentProof] = useState(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  const reloadOrder = useCallback(async ({ silent = true } = {}) => {
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
  }, [orderId]);

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

  async function handleUploadPaymentProof(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";

    // Validate file type
    if (!file.type.match(/image\/(jpeg|jpg|png|gif)/)) {
      setErrorMessage("Chỉ chấp nhận file ảnh (JPG, PNG, GIF)");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Kích thước file không được quá 5MB");
      return;
    }

    try {
      setUploadingProof(true);
      setErrorMessage("");
      const response = await uploadPaymentProof(orderId, file);
      const data = normalizeResponse(response);
      setSuccessMessage("Đã tải lên minh chứng chuyển khoản. Đơn hàng đang chờ admin xác nhận.");
      setPaymentProof(data?.paymentProof || data?.payment_proof || null);
      await reloadOrder();
    } catch (error) {
      console.error("Upload error:", error);
      setErrorMessage(getErrorMessage(error, "Không thể tải lên bằng chứng thanh toán"));
    } finally {
      setUploadingProof(false);
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

  const itemCount = useMemo(() => (order?.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0), [order]);
  const recipient = useMemo(() => parseRecipientFromShippingAddress(order?.shippingAddress, order?.customer || user), [order, user]);
  const paymentStatusMeta = getPaymentStatusMeta(order?.paymentStatus, order?.paymentMethod);
  const normalizedPaymentStatus = String(order?.paymentStatus || "").toUpperCase();
  const proofUrl = paymentProof || order?.paymentProof;
  const canUploadPaymentProof =
    order?.paymentMethod === "BANK_TRANSFER" &&
    !["PAID", "AWAITING_ADMIN_CONFIRMATION", "PENDING_VERIFICATION"].includes(normalizedPaymentStatus);
  const canConfirmReceived = canCustomerConfirmReceived(order);

  if (!isAuthenticated) {
    return (
      <div style={{ display: "grid", gap: 16, padding: 24, borderRadius: 24, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
        <h1 style={{ margin: 0 }}>Chi tiết đơn hàng</h1>
        <p style={{ margin: 0, color: "var(--muted)" }}>Bạn cần đăng nhập để xem thông tin đơn hàng.</p>
        <div>
          <Link to={routeConfig.public.login} style={{ color: "var(--primary)", fontWeight: 700 }}>Đi đến trang đăng nhập</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 24, borderRadius: 24, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>Đang tải chi tiết đơn hàng...</div>;
  }

  if (errorMessage) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ padding: 18, borderRadius: 18, background: "rgba(255, 240, 236, 0.92)", border: "1px solid rgba(182, 64, 44, 0.22)", color: "var(--danger)" }}>
          {errorMessage}
        </div>
        <div>
          <button type="button" onClick={() => navigate(routeConfig.public.orders)} style={{ padding: "12px 18px", borderRadius: 999, border: "1px solid var(--border)", background: "#fff", cursor: "pointer", fontWeight: 700 }}>
            Quay lại danh sách đơn hàng
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section style={{ padding: "36px 32px", borderRadius: 24, background: "linear-gradient(135deg, #f8fafc, #f1f5f9)", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "end" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>Chi tiết đơn hàng</div>
            <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1, letterSpacing: "-0.05em" }}>Đơn hàng #{order.id}</h1>
            <div style={{ marginTop: 10 }}><OrderStatusBadge status={order.status} /></div>
            <div style={{ color: "var(--muted)", marginTop: 8 }}>Theo dõi đầy đủ trạng thái, vận đơn, thanh toán và thông tin sản phẩm trong đơn.</div>
          </div>

          <div style={{ textAlign: "right", display: "grid", gap: 6 }}>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>Tổng thanh toán</div>
            <div style={{ fontWeight: 800, fontSize: 30 }}>{formatCurrency(order.finalAmount)} VND</div>
          </div>
        </div>
      </section>

      {successMessage ? (
        <div style={{ padding: 16, borderRadius: 16, background: "#ecfdf5", border: "1px solid #86efac", color: "#047857" }}>{successMessage}</div>
      ) : null}

      {(canCustomerCancelOrder(order) || canCustomerPayOrder(order) || canConfirmReceived) ? (
        <section style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: 20, borderRadius: 20, background: "#fff", border: "1px solid var(--border)" }}>
          {canCustomerPayOrder(order) ? (
            <button type="button" disabled={actionLoading} onClick={handlePayOrder} style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: "#2563eb", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
              {actionLoading ? "Đang mở cổng thanh toán..." : "💳 Thanh toán VNPay ngay"}
            </button>
          ) : null}
          {canCustomerCancelOrder(order) ? (
            <button type="button" disabled={actionLoading} onClick={handleCancelOrder} style={{ padding: "12px 24px", borderRadius: 12, border: "1px solid #fecaca", background: "#fff", color: "#b91c1c", fontWeight: 800, cursor: "pointer" }}>
              Hủy đơn hàng
            </button>
          ) : null}
          {canConfirmReceived ? (
            <button type="button" disabled={actionLoading} onClick={handleConfirmReceived} style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: "#059669", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
              {actionLoading ? "Đang xác nhận..." : "Xác nhận đã nhận hàng"}
            </button>
          ) : null}
        </section>
      ) : null}

      {/* Bank Transfer Payment Proof Upload */}
      {order?.paymentMethod === "BANK_TRANSFER" ? (
        <section style={{ padding: 24, borderRadius: 20, background: "linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(37, 99, 235, 0.02))", border: "2px dashed rgba(37, 99, 235, 0.3)" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(37, 99, 235, 0.1)", color: "#2563eb", display: "grid", placeItems: "center", fontSize: 24 }}>💳</div>
            <div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1e293b" }}>Bằng chứng thanh toán chuyển khoản</h3>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 14 }}>Vui lòng tải lên screenshot chứng minh bạn đã chuyển khoản thành công</p>
            </div>
          </div>

          {proofUrl && !canUploadPaymentProof ? (
            <div style={{ padding: 20, background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 100, height: 100, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                  <img 
                    src={resolveUploadUrl(proofUrl)} 
                    alt="Bằng chứng thanh toán" 
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "#166534", fontSize: 16 }}>✅ Đã tải lên bằng chứng thanh toán</div>
                  <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>Admin đang xác nhận thanh toán của bạn</div>
                </div>
              </div>
            </div>
          ) : canUploadPaymentProof ? (
            <div style={{ padding: 20, background: "#fff", borderRadius: 16, border: "1px dashed #cbd5e1", marginBottom: 16 }}>
              <input
                type="file"
                id="paymentProof"
                accept="image/jpeg,image/jpg,image/png,image/gif"
                onChange={handleUploadPaymentProof}
                style={{ display: "none" }}
              />
              <label
                htmlFor="paymentProof"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  padding: 24,
                  borderRadius: 12,
                  background: "#f8fafc",
                  border: "2px dashed #94a3b8",
                  cursor: "pointer",
                  transition: "all 0.3s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#2563eb";
                  e.currentTarget.style.background = "#eff6ff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#94a3b8";
                  e.currentTarget.style.background = "#f8fafc";
                }}
              >
                {uploadingProof ? (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>⏳</div>
                    <div style={{ fontWeight: 700, color: "#64748b" }}>Đang tải lên...</div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 48 }}>📤</div>
                    <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 16 }}>Click để tải lên screenshot</div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>Chấp nhận: JPG, PNG, GIF (Max 5MB)</div>
                  </>
                )}
              </label>
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 8, padding: 16, background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 14 }}>📋 Hướng dẫn chuyển khoản:</div>
            <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
              1. Chuyển khoản vào tài khoản Techcombank: <strong>8686868991</strong> - <strong>HỨA MINH KHƯƠNG</strong><br/>
              2. Số tiền chuyển: <strong>{formatCurrency(order?.finalAmount)} VND</strong><br/>
              3. Nội dung chuyển khoản: <strong>DH{user?.phone || "SĐT của bạn"}</strong><br/>
              4. Chụp screenshot màn hình chuyển khoản và tải lên ở trên
            </div>
          </div>
        </section>
      ) : null}

      <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div style={{ padding: 20, borderRadius: 20, background: "#fff", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}><InfoRow label="Trạng thái đơn" value={order.status} /></div>
        <div style={{ padding: 20, borderRadius: 20, background: "#fff", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}><InfoRow label="Phương thức thanh toán" value={getPaymentMethodLabel(order.paymentMethod)} /></div>
        <div style={{ padding: 20, borderRadius: 20, background: "#fff", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}><InfoRow label="Trạng thái thanh toán" value={paymentStatusMeta.label} /></div>
        <div style={{ padding: 20, borderRadius: 20, background: "#fff", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}><InfoRow label="Số lượng sản phẩm" value={String(itemCount)} /></div>
      </section>

      <section style={{ display: "grid", gap: 24, gridTemplateColumns: "minmax(0, 1.3fr) minmax(320px, 0.9fr)", alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18, padding: 24, borderRadius: 24, background: "#fff", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 28 }}>Sản phẩm trong đơn</h2>
            <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>Chi tiết từng sản phẩm, số lượng và thành tiền cho mỗi SKU đã đặt mua.</p>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {(order.items || []).map((item) => (
              <div key={item.id} style={{ display: "flex", gap: 16, padding: 18, borderRadius: 18, background: "#fff", border: "1px solid #f1f5f9", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                <div style={{ width: 64, height: 64, borderRadius: 12, background: "linear-gradient(135deg, #f8fafc, #fff)", border: "1px solid #e2e8f0", display: "grid", placeItems: "center", flexShrink: 0, overflow: "hidden" }}>
                  {item.imageUrl ? (
                    <img src={resolveProductImage({ image_url: item.imageUrl, name: item.productName })} alt={item.productName} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} />
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                  )}
                </div>
                <div style={{ flex: 1, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{item.productName}</div>
                    <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>SKU: {item.sku || "Không rõ"}</div>
                    {item.serialNumbers && item.serialNumbers.length > 0 ? (
                      <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" }}>S/N xuất kho:</span>
                        {item.serialNumbers.map((sn, sIdx) => (
                          <Link
                            key={sIdx}
                            to={`/warranties?lookup=${encodeURIComponent(sn)}`}
                            title="Bấm để tra cứu bảo hành theo Serial Number này"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "2px 8px",
                              borderRadius: 6,
                              background: "#f1f5f9",
                              border: "1px solid #cbd5e1",
                              fontFamily: "monospace",
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#1e40af",
                              textDecoration: "none",
                              transition: "all 0.15s ease"
                            }}
                          >
                            🏷️ {sn}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{formatCurrency(item.lineTotal)} VND</div>
                    <div style={{ fontSize: 14, color: "var(--muted)" }}>{formatCurrency(item.unitPrice)} x {item.quantity}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <section style={{ display: "grid", gap: 14, padding: 24, borderRadius: 24, background: "#fff", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
            <h2 style={{ margin: 0, fontSize: 24 }}>Thông tin giao hàng</h2>
            <InfoRow label="Người nhận" value={recipient.name} />
            <InfoRow label="Số điện thoại" value={recipient.phone} />
            <InfoRow label="Địa chỉ" value={recipient.address} />
            <InfoRow label="Ngày tạo" value={order.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : "Không rõ"} />
            <InfoRow label="Ghi chú" value={order.note || "Không có ghi chú"} />
          </section>

          {order.trackingCode ? (
            <section style={{ display: "grid", gap: 14, padding: 24, borderRadius: 24, background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "1px solid #bbf7d0", boxShadow: "0 4px 12px rgba(34, 197, 94, 0.1)" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#22c55e", color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 2px 8px rgba(34, 197, 94, 0.3)" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: "#166534", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>Mã vận đơn</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: "#14532d", letterSpacing: "0.02em" }}>{order.trackingCode}</div>
                </div>
              </div>
              <p style={{ margin: 0, color: "#15803d", fontSize: 14 }}>
                Trạng thái giao hàng: <strong>{getShipmentStatusLabel(order.shipmentStatus || "IN_TRANSIT")}</strong>. Tra cứu mã vận đơn trên đối tác vận chuyển để theo dõi lộ trình nhanh nhất.
              </p>
            </section>
          ) : null}

          <section style={{ display: "grid", gap: 14, padding: 24, borderRadius: 24, background: "#fff", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
            <h2 style={{ margin: 0, fontSize: 24 }}>Chi tiết thanh toán</h2>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
                <span>Tạm tính</span>
                <span>{formatCurrency(order.totalAmount)} VND</span>
              </div>
              {Number(order.discountAmount) > 0 ? (
                <div style={{ display: "flex", justifyContent: "space-between", color: "#10b981", fontWeight: 700 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span>🎟️</span> Giảm giá Voucher {order.couponCode ? `(${order.couponCode})` : ""}
                  </span>
                  <span>-{formatCurrency(order.discountAmount)} VND</span>
                </div>
              ) : null}
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
                <span>Phí dịch vụ và vận chuyển</span>
                <span>{formatCurrency(order.shippingFee)} VND</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 22, paddingTop: 16, marginTop: 4, borderTop: "1px dashed #cbd5e1" }}>
                <span>Cần thanh toán</span>
                <span style={{ color: "var(--primary)" }}>{formatCurrency(order.finalAmount)} VND</span>
              </div>
            </div>
          </section>

          <section style={{ display: "grid", gap: 12, padding: 24, borderRadius: 24, background: "#fff", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
            <h2 style={{ margin: 0, fontSize: 24 }}>Tiện ích nhanh</h2>
            <Link to={routeConfig.public.warranties} style={{ color: "var(--primary)", fontWeight: 700 }}>Kiểm tra bảo hành điện tử</Link>
            <Link to={routeConfig.public.orders} style={{ color: "var(--primary)", fontWeight: 700 }}>Quay lại lịch sử đơn hàng</Link>
          </section>
        </div>
      </section>
    </div>
  );
}
