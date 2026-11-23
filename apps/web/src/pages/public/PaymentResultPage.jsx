import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";

import { createVnpayUrl } from "../../services/order.service";
import { routeConfig } from "../../routes/routeConfig";

function getErrorMessage(error, fallbackMessage) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallbackMessage;
  }
  return error.message || fallbackMessage;
}

function getReasonMessage(reason) {
  const normalized = String(reason || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "invalid_signature") {
    return "Chữ ký xác thực từ cổng thanh toán không hợp lệ. Giao dịch không được ghi nhận để đảm bảo an toàn.";
  }
  if (normalized === "invalid_amount") {
    return "Số tiền thanh toán không khớp với giá trị đơn hàng. Vui lòng liên hệ bộ phận hỗ trợ PC Mall.";
  }
  if (normalized === "user_cancelled" || normalized === "vnpay_24") {
    return "Bạn đã hủy giao dịch thanh toán. Đơn hàng vẫn đang chờ thanh toán và bạn có thể thử lại bất cứ lúc nào.";
  }
  if (normalized === "order_canceled") {
    return "Đơn hàng đã bị hủy hoặc đã hết hạn thanh toán.";
  }
  if (normalized === "order_not_found") {
    return "Không tìm thấy đơn hàng tương ứng trên hệ thống.";
  }
  if (normalized.startsWith("vnpay_")) {
    const code = normalized.replace("vnpay_", "").toUpperCase();
    return `Giao dịch VNPay chưa hoàn tất (Mã phản hồi: ${code}). Bạn có thể thử thanh toán lại.`;
  }
  return `Lý do: ${reason}`;
}

export function PaymentResultPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const success = searchParams.get("success") === "true";
  const orderId = searchParams.get("orderId");
  const reason = searchParams.get("reason");
  const method = String(searchParams.get("method") || "").toUpperCase();
  const reasonMessage = getReasonMessage(reason);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState("");

  async function handleRetryPay() {
    if (!orderId) return;
    if (method === "BANK_TRANSFER" || !reason?.startsWith("vnpay_")) {
      navigate(routeConfig.public.paymentVietQr.replace(":orderId", String(orderId)));
      return;
    }
    try {
      setPayLoading(true);
      setPayError("");
      const urlRes = await createVnpayUrl(orderId, {});
      const urlData = urlRes?.data?.data || urlRes?.data || urlRes;
      if (urlData?.paymentUrl) {
        window.location.href = urlData.paymentUrl;
        return;
      }
      throw new Error("Không lấy được liên kết thanh toán");
    } catch (error) {
      setPayError(getErrorMessage(error, "Không thể mở lại cổng thanh toán"));
      setPayLoading(false);
    }
  }

  if (!orderId) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <section
          style={{
            padding: "30px 28px",
            borderRadius: 32,
            background: "linear-gradient(135deg, rgba(238,77,45,0.08), rgba(255,247,237,0.95))",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow)"
          }}
        >
          <h1 style={{ margin: "0 0 8px", fontSize: 38, lineHeight: 1.1, letterSpacing: "-0.04em", color: "#ee4d2d" }}>
            Thanh toán chưa hoàn tất
          </h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 17 }}>
            {reasonMessage || "Không tìm thấy thông tin mã đơn hàng từ cổng thanh toán. Vui lòng kiểm tra trạng thái trong danh sách đơn hàng của bạn."}
          </p>
        </section>

        <section style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: 24, borderRadius: 24, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <Link to="/orders" style={{ padding: "12px 20px", borderRadius: 16, background: "var(--primary)", color: "#fff", fontWeight: 700, textDecoration: "none" }}>
            Danh sách đơn hàng
          </Link>
          <Link to="/" style={{ padding: "12px 20px", borderRadius: 16, border: "1px solid var(--border)", background: "#fff", fontWeight: 700, textDecoration: "none", color: "var(--text)" }}>
            Về trang chủ
          </Link>
        </section>
      </div>
    );
  }

  const canRetry = !success && !["order_canceled", "order_not_found"].includes(String(reason || "").toLowerCase());

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section
        style={{
          padding: "30px 28px",
          borderRadius: 32,
          background: success
            ? "linear-gradient(135deg, rgba(46, 213, 115, 0.08), rgba(228, 248, 239, 0.95))"
            : "linear-gradient(135deg, rgba(238,77,45,0.08), rgba(255,247,237,0.95))",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow)"
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: 44, lineHeight: 1, letterSpacing: "-0.05em", color: success ? "#0f4c3f" : "#ee4d2d" }}>
          {success ? "Thanh toán thành công" : "Thanh toán chưa hoàn tất"}
        </h1>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 18 }}>
          {success
            ? method === "BANK_TRANSFER"
              ? "Giao dịch chuyển khoản VietQR đã được SePay xác nhận tự động. Đơn hàng của bạn đang được chuẩn bị và đóng gói."
              : "Cảm ơn bạn. Đơn hàng đã được ghi nhận thanh toán và đang chuyển sang xử lý."
            : (reasonMessage || "Giao dịch chưa hoàn tất. Bạn có thể thử thanh toán lại từ trang đơn hàng.")}
        </p>
      </section>

      <section style={{ display: "grid", gap: 18, padding: 24, borderRadius: 24, background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>Mã đơn hàng</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>#{orderId}</div>
          {reasonMessage ? <div style={{ color: "var(--danger)", marginTop: 8, fontWeight: 600 }}>{reasonMessage}</div> : null}
        </div>

        {payError ? (
          <div style={{ padding: 12, borderRadius: 12, background: "#fef2f2", color: "#b91c1c" }}>{payError}</div>
        ) : null}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            to={routeConfig.public.orderDetail.replace(":orderId", String(orderId))}
            style={{ padding: "12px 20px", borderRadius: 16, background: "var(--primary)", color: "#fff", fontWeight: 700, textDecoration: "none" }}
          >
            Xem chi tiết đơn
          </Link>
          <Link to="/orders" style={{ padding: "12px 20px", borderRadius: 16, border: "1px solid var(--border)", background: "#fff", fontWeight: 700, textDecoration: "none", color: "var(--text)" }}>
            Danh sách đơn hàng
          </Link>
          {canRetry ? (
            <button
              type="button"
              disabled={payLoading}
              onClick={handleRetryPay}
              style={{ padding: "12px 20px", borderRadius: 16, border: "none", background: "#2563eb", color: "#fff", fontWeight: 700, cursor: "pointer" }}
            >
              {payLoading ? "Đang mở..." : "Thử thanh toán lại"}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
