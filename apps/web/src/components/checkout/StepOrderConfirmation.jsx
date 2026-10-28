import { SpinnerIcon } from "./CheckoutIcons";

export function StepOrderConfirmation({
  sectionStyle,
  inputStyle,
  currentFullName,
  currentEmail,
  currentPhone,
  selectedAddress,
  currentUser,
  formatAddressDisplay,
  getAddressFullName,
  selectedPaymentOption,
  formValues,
  handleChange,
  setActiveStep,
  isSubmitting,
  items,
  handleSubmit,
  errorMessage
}) {
  return (
    <section style={{ ...sectionStyle, animationDelay: "0.25s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center" }}>
          🛡️
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: "#1e293b" }}>Bước 4: Xác nhận thông tin đơn hàng</h2>
      </div>

      {/* Info summary table for user review */}
      <div style={{ display: "grid", gap: 20, background: "#f8fafc", padding: 24, borderRadius: 24, border: "1px solid #e2e8f0", marginBottom: 24 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#1e293b" }}>Kiểm tra kỹ trước khi thanh toán:</h3>

        <div style={{ display: "grid", gap: 12, fontSize: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 10 }}>
            <span style={{ color: "#64748b", fontWeight: 700 }}>Khách hàng mua:</span>
            <strong style={{ color: "#0f172a" }}>{currentFullName} ({currentEmail})</strong>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 10 }}>
            <span style={{ color: "#64748b", fontWeight: 700 }}>Người nhận & SĐT:</span>
            <strong style={{ color: "#0f172a" }}>
              {getAddressFullName(selectedAddress, currentUser)}
              {" - "}{selectedAddress?.phone || currentPhone}
            </strong>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 10 }}>
            <span style={{ color: "#64748b", fontWeight: 700 }}>Địa chỉ giao hàng:</span>
            <span style={{ color: "#334155", fontWeight: 650 }}>
              {selectedAddress ? formatAddressDisplay(selectedAddress) : "Chưa cấu hình địa chỉ"}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, paddingBottom: 6 }}>
            <span style={{ color: "#64748b", fontWeight: 700 }}>Thanh toán qua:</span>
            <span style={{ color: selectedPaymentOption?.tone || "#64748b", fontWeight: 900 }}>
              {selectedPaymentOption ? `${selectedPaymentOption.label} (${selectedPaymentOption.shortLabel})` : "Chưa chọn phương thức thanh toán"}
            </span>
          </div>
        </div>
      </div>

      {/* Note area */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 13, color: "#64748b", fontWeight: 800, display: "block", marginBottom: 8, paddingLeft: 4 }}>
          Ghi chú giao hàng đặc biệt (Ví dụ: Giao giờ hành chính, gọi trước...)
        </label>
        <textarea
          name="note"
          rows={3}
          value={formValues.note}
          onChange={handleChange}
          placeholder="Nhập ghi chú của bạn tại đây để bên vận chuyển phục vụ tốt hơn..."
          style={{ ...inputStyle, resize: "none" }}
        />
      </div>

      <div className="step-actions-footer">
        <button id="btn-back-step3" type="button" onClick={() => setActiveStep(3)} className="btn-premium btn-premium-secondary">
          ← Quay lại bước 3
        </button>
        <button
          id="btn-place-order"
          type="button"
          disabled={isSubmitting || items.length === 0}
          onClick={handleSubmit}
          className="btn-premium btn-premium-primary"
          style={{ height: 56, padding: "0 40px" }}
        >
          {isSubmitting && <SpinnerIcon />}
          {isSubmitting ? "Đang xử lý đơn hàng..." : `Đặt hàng ngay${selectedPaymentOption ? ` (${selectedPaymentOption.shortLabel})` : ""}`}
        </button>
      </div>

      {errorMessage && (
        <div style={{ marginTop: 20, padding: 16, borderRadius: 16, background: "rgba(239,68,68,0.06)", color: "#b91c1c", fontSize: 14, fontWeight: 800, textAlign: "center", border: "1px solid rgba(239,68,68,0.2)" }}>
          ⚠️ {errorMessage}
        </div>
      )}
    </section>
  );
}
