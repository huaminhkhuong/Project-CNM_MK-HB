import { CreditCardIcon } from "./CheckoutIcons";

export function StepPaymentMethod({
  sectionStyle,
  formValues,
  handlePaymentMethodChange,
  isSubmitting,
  errors,
  paymentMethodCards,
  selectedPaymentOption,
  paymentMethodGuidance,
  bankAccountConfig,
  currentUser,
  formatCurrency,
  finalAmount,
  generateTransferNote,
  setActiveStep,
  handleStep3Next,
  validPaymentMethods,
  paymentProofFile,
  onPaymentProofChange
}) {
  return (
    <section style={{ ...sectionStyle, animationDelay: "0.2s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center" }}>
          <CreditCardIcon />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: "#1e293b" }}>Bước 3: Phương thức thanh toán</h2>
      </div>

      <div style={{ display: "grid", gap: 20 }}>
        <div>
          <label style={{ fontSize: 13, color: "#64748b", fontWeight: 800, display: "block", marginBottom: 12, paddingLeft: 4 }}>
            Chọn phương thức thanh toán phù hợp với bạn:
          </label>
          <div className="payment-method-grid" role="radiogroup" aria-label="Phương thức thanh toán">
            {paymentMethodCards.map((option) => {
              const Icon = option.icon;
              const selected = formValues.paymentMethod === option.value;

              return (
                <label
                  key={option.value}
                  id={`payment-method-card-${option.value.toLowerCase()}`}
                  className={`payment-method-card ${selected ? "selected" : ""} ${isSubmitting ? "disabled" : ""}`}
                  style={{ "--payment-tone": option.tone }}
                >
                  <input
                    id={`payment-method-${option.value.toLowerCase()}`}
                    type="radio"
                    name="paymentMethod"
                    value={option.value}
                    checked={selected}
                    disabled={isSubmitting}
                    onChange={() => handlePaymentMethodChange(option.value)}
                  />
                  <span className="payment-method-card__icon"><Icon /></span>
                  <span className="payment-method-card__content">
                    <span className="payment-method-card__head">
                      <strong>{option.label}</strong>
                      <span>{option.badge}</span>
                    </span>
                    <small>{option.description}</small>
                  </span>
                  <span className="payment-method-card__check" aria-hidden="true">{selected ? "✓" : ""}</span>
                </label>
              );
            })}
          </div>
          {errors.paymentMethod && <div className="field-error-inline">{errors.paymentMethod}</div>}
        </div>

        {selectedPaymentOption && (
          <div className="payment-method-guidance">
            <strong>Hướng dẫn thanh toán</strong>
            {paymentMethodGuidance[selectedPaymentOption.value]}
          </div>
        )}

        {formValues.paymentMethod === "BANK_TRANSFER" && (
          <div style={{ padding: 24, background: "rgba(37, 99, 235, 0.04)", borderRadius: 20, border: "2px dashed rgba(37, 99, 235, 0.3)", animation: "fadeInUp 0.4s ease" }}>
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <h3 style={{ fontSize: 17, fontWeight: 900, marginBottom: 16, color: "#1e293b" }}>Thông tin tài khoản nhận</h3>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <span style={{ color: "#64748b", fontWeight: 700, fontSize: "13px" }}>Ngân hàng:</span>
                    <span style={{ fontWeight: 800, color: "#1e293b", fontSize: "13px" }}>{bankAccountConfig.bankName}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <span style={{ color: "#64748b", fontWeight: 700, fontSize: "13px" }}>Số tài khoản:</span>
                    <span style={{ fontWeight: 800, color: "var(--market-primary)", fontSize: "15px" }}>{bankAccountConfig.accountNumber}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <span style={{ color: "#64748b", fontWeight: 700, fontSize: "13px" }}>Chủ tài khoản:</span>
                    <span style={{ fontWeight: 800, color: "#1e293b", fontSize: "13px" }}>{bankAccountConfig.accountHolder}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                    <span style={{ color: "#64748b", fontWeight: 700, fontSize: "13px" }}>Số tiền chuyển:</span>
                    <span style={{ fontWeight: 900, color: "var(--market-primary)", fontSize: "15px" }}>{formatCurrency(finalAmount)} đ</span>
                  </div>
                  <div style={{ padding: "12px", background: "#fffbeb", borderRadius: 12, border: "1px solid #fef3c7", fontSize: "12.5px", fontWeight: 700, color: "#b45309" }}>
                    💡 Cú pháp: {generateTransferNote(currentUser?.phone || "SĐT của bạn")}
                  </div>
                </div>
              </div>
              <div style={{ width: 160, margin: "0 auto" }}>
                <div style={{ background: "#fff", padding: 12, borderRadius: 16, border: "1px solid #e2e8f0", textAlign: "center" }}>
                  <div style={{ width: 130, height: 130, background: "#f8fafc", margin: "0 auto", display: "grid", placeItems: "center", borderRadius: 10, border: "1px dashed #cbd5e1", overflow: "hidden" }}>
                    <img
                      src={bankAccountConfig.qrCodeImage}
                      alt="QR Code"
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        e.currentTarget.parentElement.innerHTML = `
                          <div style="text-align: center">
                            <div style="font-size: 40px; margin-bottom: 4px">📱</div>
                            <div style="font-size: 10px; font-weight: 800; color: #64748b">QR CODE</div>
                          </div>
                        `;
                      }}
                    />
                  </div>
                  <div style={{ marginTop: 8, fontSize: "11px", fontWeight: 750, color: "#64748b" }}>Quét mã chuyển nhanh</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px dashed rgba(37, 99, 235, 0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <strong style={{ fontSize: "13.5px", color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                  🧾 Đính kèm biên lai chuyển khoản (tùy chọn):
                </strong>
                {paymentProofFile && (
                  <button
                    type="button"
                    onClick={() => onPaymentProofChange?.(null)}
                    style={{ fontSize: "12px", color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
                  >
                    ✕ Xóa ảnh
                  </button>
                )}
              </div>

              {paymentProofFile ? (
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: "#fff", borderRadius: 14, border: "1px solid #bbf7d0" }}>
                  <span style={{ fontSize: "24px" }}>📸</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 800, color: "#15803d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {paymentProofFile.name}
                    </div>
                    <small style={{ fontSize: "11px", color: "#64748b" }}>
                      {(paymentProofFile.size / 1024).toFixed(1)} KB · Sẵn sàng tự động gửi biên lai khi đặt hàng
                    </small>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 800, color: "#16a34a", background: "#dcfce7", padding: "4px 8px", borderRadius: 8 }}>
                    ✓ Đã chọn
                  </span>
                </div>
              ) : (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 18px",
                    background: "#fff",
                    borderRadius: 14,
                    border: "2px dashed #cbd5e1",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#2563eb";
                    e.currentTarget.style.background = "#eff6ff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#cbd5e1";
                    e.currentTarget.style.background = "#fff";
                  }}
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        onPaymentProofChange?.(file);
                      }
                    }}
                  />
                  <span style={{ fontSize: "28px" }}>📤</span>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 750, color: "#1e293b" }}>
                      Chọn ảnh chụp biên lai giao dịch thành công
                    </div>
                    <small style={{ fontSize: "11.5px", color: "#64748b" }}>
                      Hỗ trợ PNG, JPG, WEBP (tối đa 5MB). Bạn cũng có thể tải lên sau tại trang Chi tiết đơn hàng.
                    </small>
                  </div>
                </label>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="step-actions-footer">
        <button id="btn-back-step2" type="button" onClick={() => setActiveStep(2)} className="btn-premium btn-premium-secondary">
          ← Quay lại bước 2
        </button>
        <button
          id="btn-checkout-step3-next"
          type="button"
          onClick={handleStep3Next}
          disabled={!validPaymentMethods.includes(formValues.paymentMethod)}
          className="btn-premium btn-premium-primary"
        >
          Tiếp tục bước 4 →
        </button>
      </div>
    </section>
  );
}
