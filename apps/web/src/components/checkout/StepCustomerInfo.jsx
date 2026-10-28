import { UserIcon } from "./CheckoutIcons";

export function StepCustomerInfo({
  sectionStyle,
  inputStyle,
  hasPhoneValue,
  currentFullName,
  currentEmail,
  currentPhone,
  phoneInput,
  setPhoneInput,
  setErrors,
  errors,
  hasPersistedPhone,
  normalizedPhoneInput,
  isUpdatingPhone,
  handleSavePhone,
  handleStep1Next,
  handleSubmitStep1
}) {
  const onFormSubmit = handleSubmitStep1 || handleSavePhone;

  return (
    <section style={{ ...sectionStyle, animationDelay: "0.1s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ background: "rgba(37, 99, 235, 0.1)", color: "var(--market-primary)", width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center" }}>
          <UserIcon />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: "#1e293b" }}>Bước 1: Thông tin khách hàng</h2>
      </div>

      {!hasPhoneValue && (
        <div className="alert-gentle">
          <span>⚠️</span>
          <div><strong>Thiếu số điện thoại.</strong> Vui lòng bổ sung số điện thoại để giao hàng nhanh hơn và kích hoạt bảo hành điện tử chính xác.</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Họ và tên", value: currentFullName || "Tài khoản PC Mall" },
          { label: "Email", value: currentEmail || "Chưa có email" },
          { label: "Trạng thái", value: hasPhoneValue ? "Đã đủ thông tin giao hàng" : "Cần bổ sung số điện thoại" }
        ].map((item) => (
          <div key={item.label} style={{ padding: 18, borderRadius: 20, border: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 6 }}>{item.label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", lineHeight: 1.5 }}>{item.value}</div>
          </div>
        ))}
      </div>

      <form onSubmit={onFormSubmit} style={{ display: "grid", gap: 20 }}>
        <div>
          <label style={{ fontSize: 13, color: "#64748b", fontWeight: 800, display: "block", marginBottom: 8, paddingLeft: 4 }}>
            Số điện thoại người mua
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="checkout-phone-input"
              type="text"
              value={phoneInput}
              onChange={(e) => {
                setPhoneInput(e.target.value);
                setErrors({});
              }}
              placeholder="Ví dụ: 0901234567"
              style={inputStyle}
            />
            {hasPersistedPhone && normalizedPhoneInput !== currentPhone && (
              <span style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", fontSize: "11px", background: "rgba(37,99,235,0.08)", color: "var(--market-primary)", padding: "4px 8px", borderRadius: "8px", fontWeight: 800 }}>
                Đã thay đổi
              </span>
            )}
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: "#64748b", fontWeight: 600 }}>
            Số điện thoại này sẽ được tự động dùng cho người nhận nếu bạn chưa lưu địa chỉ giao hàng.
          </div>
          {errors.phone && <div style={{ color: "#ef4444", fontSize: 13, fontWeight: 800, marginTop: 6 }}>⚠ {errors.phone}</div>}
        </div>

        <div className="step-actions-footer" style={{ justifyContent: "flex-end" }}>
          {(!hasPersistedPhone || normalizedPhoneInput !== currentPhone) ? (
            <button
              id="btn-step1-save-phone"
              type="submit"
              disabled={isUpdatingPhone}
              className="btn-premium btn-premium-primary"
            >
              {isUpdatingPhone ? "Đang lưu..." : "Lưu và tiếp tục"} →
            </button>
          ) : (
            <button
              id="btn-step1-next"
              type="submit"
              className="btn-premium btn-premium-primary"
            >
              Tiếp tục sang địa chỉ →
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
