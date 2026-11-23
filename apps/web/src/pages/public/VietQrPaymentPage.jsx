import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";

import { useAuth } from "../../hooks/useAuth";
import { getSepayOrderPaymentInfo } from "../../services/order.service";
import { subscribeToOrderEvents } from "../../services/order-events.service";
import { routeConfig } from "../../routes/routeConfig";

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function formatCountdown(remainingMs) {
  const safeSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function VietQrPaymentPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [copiedField, setCopiedField] = useState("");
  const [qrSrc, setQrSrc] = useState("");
  const [remainingMs, setRemainingMs] = useState(null);

  const loadPaymentInfo = useCallback(
    async ({ silent = false } = {}) => {
      if (!orderId) return;
      try {
        if (!silent) setLoading(true);
        const res = await getSepayOrderPaymentInfo(orderId);
        const data = res?.data?.data || res?.data || res;
        setPaymentInfo(data);
        setErrorMessage("");
        setQrSrc((prev) => prev || data?.qrUrl || data?.fallbackQrUrl || "");

        if (String(data?.paymentStatus || "").toUpperCase() === "PAID") {
          window.setTimeout(() => {
            navigate(`/payment/result?success=true&orderId=${encodeURIComponent(String(orderId))}&method=BANK_TRANSFER`, {
              replace: true
            });
          }, 900);
        }
      } catch (error) {
        if (!silent) {
          const msg = axios.isAxiosError(error)
            ? error.response?.data?.message || "Không thể tải thông tin thanh toán VietQR"
            : error?.message || "Không thể tải thông tin thanh toán VietQR";
          setErrorMessage(msg);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [orderId, navigate]
  );

  useEffect(() => {
    if (!isAuthenticated || !orderId) {
      setLoading(false);
      return;
    }
    loadPaymentInfo({ silent: false });
  }, [isAuthenticated, orderId, loadPaymentInfo]);

  // Realtime SSE + 3s polling fallback until PAID or CANCELED/EXPIRED
  useEffect(() => {
    if (!isAuthenticated || !orderId) return undefined;
    const status = String(paymentInfo?.orderStatus || "").toUpperCase();
    const payStatus = String(paymentInfo?.paymentStatus || "").toUpperCase();
    if (payStatus === "PAID" || status === "CANCELED" || payStatus === "EXPIRED") {
      return undefined;
    }

    const unsubscribe = subscribeToOrderEvents((event) => {
      if (!event?.orderId || String(event.orderId) === String(orderId)) {
        loadPaymentInfo({ silent: true });
      }
    });

    const intervalId = window.setInterval(() => {
      loadPaymentInfo({ silent: true });
    }, 3000);

    return () => {
      unsubscribe();
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, orderId, paymentInfo?.orderStatus, paymentInfo?.paymentStatus, loadPaymentInfo]);

  // Live countdown timer
  useEffect(() => {
    if (!paymentInfo?.expiresAt) return undefined;
    const expiresAtMs = new Date(paymentInfo.expiresAt).getTime();
    if (!Number.isFinite(expiresAtMs)) return undefined;

    const tick = () => {
      setRemainingMs(Math.max(0, expiresAtMs - Date.now()));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [paymentInfo?.expiresAt]);

  async function handleCopy(field, value) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopiedField(field);
      window.setTimeout(() => {
        setCopiedField((prev) => (prev === field ? "" : prev));
      }, 2000);
    } catch {
      // Fallback ignored
    }
  }

  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: 640, margin: "40px auto", padding: 32, borderRadius: 24, background: "#fff", border: "1px solid #e2e8f0", textAlign: "center" }}>
        <h2 style={{ margin: "0 0 12px" }}>Cần đăng nhập</h2>
        <p style={{ color: "#64748b", marginBottom: 20 }}>Vui lòng đăng nhập để xem mã QR thanh toán cho đơn hàng của bạn.</p>
        <Link to={routeConfig.public.login} style={{ padding: "12px 24px", borderRadius: 12, background: "#2563eb", color: "#fff", textDecoration: "none", fontWeight: 700 }}>
          Đăng nhập
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 880, margin: "40px auto", padding: 40, borderRadius: 24, background: "#fff", border: "1px solid #e2e8f0", textAlign: "center", fontWeight: 700, color: "#475569" }}>
        Đang khởi tạo mã VietQR thanh toán tự động cho đơn hàng #{orderId}...
      </div>
    );
  }

  if (errorMessage || !paymentInfo) {
    return (
      <div style={{ maxWidth: 680, margin: "40px auto", display: "grid", gap: 16 }}>
        <div style={{ padding: 24, borderRadius: 20, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontWeight: 700 }}>
          {errorMessage || "Không tìm thấy thông tin thanh toán cho đơn hàng này."}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link to={routeConfig.public.orders} style={{ padding: "12px 20px", borderRadius: 12, background: "#2563eb", color: "#fff", textDecoration: "none", fontWeight: 700 }}>
            Về danh sách đơn hàng
          </Link>
        </div>
      </div>
    );
  }

  const normalizedOrderStatus = String(paymentInfo.orderStatus || "").toUpperCase();
  const normalizedPaymentStatus = String(paymentInfo.paymentStatus || "").toUpperCase();
  const isPaid = normalizedPaymentStatus === "PAID";
  const isCanceledOrExpired = normalizedOrderStatus === "CANCELED" || normalizedPaymentStatus === "EXPIRED";

  return (
    <div style={{ maxWidth: 980, margin: "24px auto", display: "grid", gap: 24 }}>
      <style>{`
        @keyframes sepayPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.86); }
        }
      `}</style>

      {/* Header banner */}
      <section
        style={{
          padding: "28px 32px",
          borderRadius: 28,
          background: isPaid
            ? "linear-gradient(135deg, #ecfdf5, #d1fae5)"
            : isCanceledOrExpired
              ? "linear-gradient(135deg, #fef2f2, #fee2e2)"
              : "linear-gradient(135deg, #0f172a, #1e3a8a)",
          color: isPaid ? "#065f46" : isCanceledOrExpired ? "#991b1b" : "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)"
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.8 }}>
            Thanh toán chuyển khoản tự động • SePay VietQR
          </div>
          <h1 style={{ margin: 0, fontSize: 32, letterSpacing: "-0.03em" }}>
            {isPaid
              ? `Đã thanh toán đơn hàng #${paymentInfo.orderId}`
              : isCanceledOrExpired
                ? `Đơn hàng #${paymentInfo.orderId} đã hủy / hết hạn`
                : `Quét mã VietQR cho đơn hàng #${paymentInfo.orderId}`}
          </h1>
          <div style={{ fontSize: 14, opacity: 0.9 }}>
            {isPaid
              ? "Hệ thống đã nhận tiền từ ngân hàng và tự động duyệt đơn. Đang chuyển sang trang xác nhận..."
              : isCanceledOrExpired
                ? "Phiên thanh toán cho đơn hàng này đã kết thúc. Vui lòng không chuyển khoản vào mã QR này."
                : "Tiền vào tài khoản sẽ được SePay tự động đối soát & duyệt đơn trong 2–5 giây — không cần gửi ảnh minh chứng."}
          </div>
        </div>

        {!isPaid && !isCanceledOrExpired && remainingMs !== null ? (
          <div style={{ padding: "14px 20px", borderRadius: 18, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", textAlign: "center", minWidth: 150 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.8 }}>Thời gian còn lại</div>
            <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "monospace", marginTop: 2 }}>{formatCountdown(remainingMs)}</div>
          </div>
        ) : null}
      </section>

      {isPaid ? (
        <section style={{ padding: 28, borderRadius: 24, background: "#fff", border: "1px solid #a7f3d0", display: "grid", gap: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#047857" }}>✅ Giao dịch đã được xác nhận tự động</div>
          {paymentInfo.transactionCode ? (
            <div style={{ fontSize: 14, color: "#334155" }}>
              Mã giao dịch ngân hàng: <strong style={{ fontFamily: "monospace" }}>{paymentInfo.transactionCode}</strong>
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              to={routeConfig.public.orderDetail.replace(":orderId", String(paymentInfo.orderId))}
              style={{ padding: "12px 20px", borderRadius: 12, background: "#059669", color: "#fff", textDecoration: "none", fontWeight: 700 }}
            >
              Xem chi tiết đơn hàng
            </Link>
            <Link
              to={routeConfig.public.orders}
              style={{ padding: "12px 20px", borderRadius: 12, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", textDecoration: "none", fontWeight: 700 }}
            >
              Danh sách đơn hàng
            </Link>
          </div>
        </section>
      ) : isCanceledOrExpired ? (
        <section style={{ padding: 28, borderRadius: 24, background: "#fff", border: "1px solid #fecaca", display: "grid", gap: 14 }}>
          <div style={{ color: "#991b1b", fontWeight: 700 }}>
            Đơn hàng này đã bị hủy hoặc quá hạn thanh toán ({paymentInfo.timeoutMinutes} phút). Tồn kho đã được hoàn trả.
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Link to={routeConfig.public.orders} style={{ padding: "12px 20px", borderRadius: 12, background: "#2563eb", color: "#fff", textDecoration: "none", fontWeight: 700 }}>
              Quay lại danh sách đơn hàng
            </Link>
          </div>
        </section>
      ) : (
        <section style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", alignItems: "start" }}>
          {/* Left: Dynamic VietQR */}
          <div style={{ padding: 28, borderRadius: 24, background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 12px 30px rgba(15, 23, 42, 0.04)", display: "grid", justifyItems: "center", gap: 16 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", fontSize: 13, fontWeight: 700 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#2563eb", animation: "sepayPulse 1.5s ease-in-out infinite" }} />
              Đang chờ ngân hàng xác nhận tự động...
            </div>

            <div style={{ padding: 14, borderRadius: 20, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <img
                src={qrSrc || paymentInfo.qrUrl}
                alt={`Mã VietQR thanh toán đơn hàng #${paymentInfo.orderId}`}
                onError={(e) => {
                  if (paymentInfo.fallbackQrUrl && e.currentTarget.src !== paymentInfo.fallbackQrUrl) {
                    e.currentTarget.src = paymentInfo.fallbackQrUrl;
                  }
                }}
                style={{ width: 280, maxWidth: "100%", display: "block", borderRadius: 12, background: "#fff" }}
              />
            </div>

            <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 1.6 }}>
              Mở ứng dụng ngân hàng (MBBank, Vietcombank, Techcombank, ACB, BIDV, TPBank...) hoặc ví điện tử hỗ trợ <strong>VietQR / Napas 247</strong> để quét mã trên.
            </div>
          </div>

          {/* Right: Transfer Details & Copy Actions */}
          <div style={{ padding: 28, borderRadius: 24, background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 12px 30px rgba(15, 23, 42, 0.04)", display: "grid", gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#0f172a" }}>Thông tin chuyển khoản chính xác</h2>

            {paymentInfo.paymentNote && String(paymentInfo.paymentNote).includes("nhận thiếu") ? (
              <div style={{ padding: "12px 14px", borderRadius: 14, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>
                ⚠️ {paymentInfo.paymentNote}
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Ngân hàng thụ hưởng</div>
                  <div style={{ fontWeight: 800, color: "#0f172a", marginTop: 2 }}>{paymentInfo.bankName} ({paymentInfo.bankCode})</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Số tài khoản</div>
                  <div style={{ fontWeight: 900, fontSize: 18, color: "#1d4ed8", fontFamily: "monospace", marginTop: 2 }}>{paymentInfo.accountNumber}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy("accountNumber", paymentInfo.accountNumber)}
                  style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: copiedField === "accountNumber" ? "#dcfce7" : "#fff", color: copiedField === "accountNumber" ? "#166534" : "#0f172a", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                >
                  {copiedField === "accountNumber" ? "Đã sao chép" : "Sao chép"}
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Chủ tài khoản</div>
                  <div style={{ fontWeight: 800, color: "#0f172a", marginTop: 2 }}>{paymentInfo.accountHolder}</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Số tiền cần chuyển</div>
                  <div style={{ fontWeight: 900, fontSize: 20, color: "#dc2626", marginTop: 2 }}>{formatCurrency(paymentInfo.amount)} VND</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy("amount", String(paymentInfo.amount))}
                  style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: copiedField === "amount" ? "#dcfce7" : "#fff", color: copiedField === "amount" ? "#166534" : "#0f172a", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                >
                  {copiedField === "amount" ? "Đã sao chép" : "Sao chép"}
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 14, background: "#fffbeb", border: "1.5px solid #fcd34d" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#92400e", fontWeight: 800 }}>Nội dung chuyển khoản (Bắt buộc giữ nguyên)</div>
                  <div style={{ fontWeight: 900, fontSize: 20, color: "#b45309", fontFamily: "monospace", marginTop: 2 }}>{paymentInfo.transferContent}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy("transferContent", paymentInfo.transferContent)}
                  style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #f59e0b", background: copiedField === "transferContent" ? "#dcfce7" : "#fff", color: copiedField === "transferContent" ? "#166534" : "#b45309", fontWeight: 800, fontSize: 12, cursor: "pointer" }}
                >
                  {copiedField === "transferContent" ? "Đã sao chép" : "Sao chép"}
                </button>
              </div>
            </div>

            <div style={{ padding: "12px 14px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", fontSize: 13, lineHeight: 1.5 }}>
              <strong>Lưu ý:</strong> Quét mã VietQR bên trái sẽ tự động điền sẵn số tiền và nội dung <strong>{paymentInfo.transferContent}</strong>. Sau khi bạn bấm chuyển tiền thành công trên app ngân hàng, màn hình này sẽ tự động cập nhật trong vòng 2–5 giây.
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 4 }}>
              <button
                type="button"
                onClick={() => loadPaymentInfo({ silent: false })}
                style={{ padding: "11px 18px", borderRadius: 12, border: "1px solid #2563eb", background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, cursor: "pointer" }}
              >
                🔄 Kiểm tra lại trạng thái
              </button>
              <Link
                to={routeConfig.public.orderDetail.replace(":orderId", String(paymentInfo.orderId))}
                style={{ padding: "11px 18px", borderRadius: 12, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", textDecoration: "none", fontWeight: 700 }}
              >
                Chi tiết đơn hàng
              </Link>
              <Link
                to={routeConfig.public.orders}
                style={{ padding: "11px 18px", borderRadius: 12, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", textDecoration: "none", fontWeight: 700 }}
              >
                Đơn hàng của tôi
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

