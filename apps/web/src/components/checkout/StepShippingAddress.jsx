import { MapPinIcon } from "./CheckoutIcons";

export function StepShippingAddress({
  sectionStyle,
  inputStyle,
  hasPhoneValue,
  addresses,
  showAddressForm,
  defaultAddress,
  selectedAddress,
  currentUser,
  effectivePhone,
  formValues,
  setFormValues,
  handleStartEditAddress,
  handleOpenNewAddressForm,
  handleDeleteAddress,
  editingAddressId,
  handleSaveAddress,
  newAddress,
  setNewAddress,
  errors,
  handleCloseAddressForm,
  isSavingAddress,
  setActiveStep,
  getAddressFullName,
  formatAddressDisplay
}) {
  return (
    <section style={{ ...sectionStyle, animationDelay: "0.15s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981", width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center" }}>
          <MapPinIcon />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: "#1e293b" }}>Bước 2: Địa chỉ giao hàng</h2>
      </div>

      {(!hasPhoneValue || addresses.length === 0) && (
        <div className="alert-gentle" style={{ marginBottom: 20 }}>
          <span>ℹ️</span>
          <div>
            {!hasPhoneValue
              ? "Vui lòng bổ sung số điện thoại để giao hàng nhanh hơn."
              : "Bạn chưa có địa chỉ giao hàng đã lưu. Hãy thêm địa chỉ để tiếp tục đặt hàng."}
          </div>
        </div>
      )}

      {!showAddressForm && defaultAddress && (
        <div style={{ marginBottom: 20, padding: 20, borderRadius: 24, border: "1px solid rgba(37,99,235,0.14)", background: "linear-gradient(135deg, rgba(239,246,255,0.95), rgba(248,250,252,0.95))" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: "#1d4ed8", background: "rgba(37,99,235,0.12)", padding: "5px 10px", borderRadius: 999 }}>ĐỊA CHỈ ĐÃ LƯU</span>
                {selectedAddress && (
                  <span style={{ fontSize: 11, fontWeight: 900, color: "#047857", background: "rgba(16,185,129,0.12)", padding: "5px 10px", borderRadius: 999 }}>ĐANG CHỌN</span>
                )}
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>{getAddressFullName(defaultAddress, currentUser)}</div>
              <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, marginBottom: 6 }}>{formatAddressDisplay(defaultAddress)}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}>Số điện thoại: {defaultAddress.phone || effectivePhone || "Vui lòng cập nhật"}</div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="address-card__btn address-card__btn-select"
                onClick={() => setFormValues((prev) => ({ ...prev, addressId: String(defaultAddress.id) }))}
              >
                Dùng địa chỉ này
              </button>
              <button
                type="button"
                className="address-card__btn address-card__btn-edit"
                onClick={(e) => handleStartEditAddress(defaultAddress, e)}
              >
                Chỉnh sửa
              </button>
              <button
                type="button"
                className="address-card__btn address-card__btn-edit"
                onClick={handleOpenNewAddressForm}
              >
                Thêm địa chỉ mới
              </button>
            </div>
          </div>
        </div>
      )}

      {!showAddressForm && addresses.length > 0 && (
        <div style={{ display: "grid", gap: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#475569" }}>Danh sách địa chỉ của bạn</h3>
          <div className="address-grid-list">
            {addresses.map((addr) => {
              const isSelected = formValues.addressId === String(addr.id);
              return (
                <div
                  key={addr.id}
                  onClick={() => setFormValues((prev) => ({ ...prev, addressId: String(addr.id) }))}
                  className={`address-card ${isSelected ? "selected" : ""}`}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 12 }}>
                      <strong style={{ fontSize: 16, color: "#0f172a" }}>{getAddressFullName(addr, currentUser)}</strong>
                      {isSelected && <span style={{ background: "rgba(37,99,235,0.1)", color: "var(--market-primary)", fontSize: "10px", padding: "2px 8px", borderRadius: "8px", fontWeight: 800 }}>Đang chọn</span>}
                    </div>
                    <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, marginBottom: 6 }}>
                      📍 {formatAddressDisplay(addr)}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>
                      📞 {addr.phone || effectivePhone || "Vui lòng cập nhật"}
                    </div>
                  </div>

                  <div className="address-card__actions">
                    <button
                      type="button"
                      className="address-card__btn address-card__btn-select"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormValues((prev) => ({ ...prev, addressId: String(addr.id) }));
                      }}
                    >
                      {isSelected ? "Đang sử dụng" : "Dùng địa chỉ này"}
                    </button>
                    <button
                      type="button"
                      className="address-card__btn address-card__btn-edit"
                      onClick={(e) => handleStartEditAddress(addr, e)}
                    >
                      Chỉnh sửa
                    </button>
                    <button
                      type="button"
                      className="address-card__btn address-card__btn-delete"
                      onClick={(e) => handleDeleteAddress(addr.id, e)}
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            id="btn-open-new-address"
            type="button"
            onClick={handleOpenNewAddressForm}
            style={{
              textAlign: "center",
              width: "100%",
              padding: "16px",
              borderRadius: 16,
              border: "1.5px dashed var(--market-primary)",
              color: "var(--market-primary)",
              background: "rgba(37,99,235,0.02)",
              fontWeight: 800,
              cursor: "pointer",
              fontSize: 15,
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(37,99,235,0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(37,99,235,0.02)"; }}
          >
            + Thêm địa chỉ giao hàng mới
          </button>
        </div>
      )}

      {(showAddressForm || addresses.length === 0) && (
        <div id="address-form-section" style={{ background: "rgba(248, 250, 252, 0.6)", padding: 24, borderRadius: 24, border: "1px dashed #cbd5e1" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 900, color: "#1e293b" }}>
            {editingAddressId ? "Chỉnh sửa địa chỉ nhận hàng" : "Thêm địa chỉ giao hàng mới"}
          </h3>

          <form onSubmit={handleSaveAddress} style={{ display: "grid", gap: 16 }}>
            <div className="responsive-two-cols">
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: "#475569", display: "block", marginBottom: 6 }}>Họ tên người nhận</label>
                <input
                  id="address-fullname-input"
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={newAddress.full_name}
                  onChange={(e) => setNewAddress((p) => ({ ...p, full_name: e.target.value }))}
                  style={{ ...inputStyle, padding: "12px 16px" }}
                />
                {errors.addr_fullName && <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 700 }}>{errors.addr_fullName}</span>}
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: "#475569", display: "block", marginBottom: 6 }}>Số điện thoại nhận hàng</label>
                <input
                  id="address-phone-input"
                  required
                  placeholder="Ví dụ: 0901234567"
                  value={newAddress.phone}
                  onChange={(e) => setNewAddress((p) => ({ ...p, phone: e.target.value }))}
                  style={{ ...inputStyle, padding: "12px 16px" }}
                />
                {errors.addr_phone && <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 700 }}>{errors.addr_phone}</span>}
              </div>
            </div>

            <div className="responsive-three-cols">
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: "#475569", display: "block", marginBottom: 6 }}>Tỉnh / Thành phố</label>
                <input
                  id="address-province-input"
                  required
                  placeholder="Hồ Chí Minh, Hà Nội..."
                  value={newAddress.province}
                  onChange={(e) => setNewAddress((p) => ({ ...p, province: e.target.value }))}
                  style={{ ...inputStyle, padding: "12px 16px" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: "#475569", display: "block", marginBottom: 6 }}>Quận / Huyện</label>
                <input
                  id="address-district-input"
                  required
                  placeholder="Quận 1, Cầu Giấy..."
                  value={newAddress.district}
                  onChange={(e) => setNewAddress((p) => ({ ...p, district: e.target.value }))}
                  style={{ ...inputStyle, padding: "12px 16px" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: "#475569", display: "block", marginBottom: 6 }}>Phường / Xã</label>
                <input
                  id="address-ward-input"
                  required
                  placeholder="Phường Bến Nghé..."
                  value={newAddress.ward}
                  onChange={(e) => setNewAddress((p) => ({ ...p, ward: e.target.value }))}
                  style={{ ...inputStyle, padding: "12px 16px" }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 800, color: "#475569", display: "block", marginBottom: 6 }}>Địa chỉ cụ thể</label>
              <input
                id="address-line-input"
                required
                placeholder="Số nhà, tên đường, tòa nhà..."
                value={newAddress.address_line}
                onChange={(e) => setNewAddress((p) => ({ ...p, address_line: e.target.value }))}
                style={{ ...inputStyle, padding: "12px 16px" }}
              />
              {errors.addr_line && <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 700, marginTop: 4 }}>{errors.addr_line}</div>}
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 800, color: "#475569", display: "block", marginBottom: 6 }}>Ghi chú giao hàng</label>
              <textarea
                id="address-note-input"
                rows={3}
                value={formValues.note}
                onChange={(e) => setFormValues((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi đến..."
                style={{ ...inputStyle, resize: "none", padding: "12px 16px" }}
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 12 }}>
              {addresses.length > 0 && (
                <button
                  id="btn-cancel-address"
                  type="button"
                  onClick={handleCloseAddressForm}
                  style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: "#e2e8f0", fontWeight: 800, cursor: "pointer" }}
                >
                  Hủy
                </button>
              )}
              <button
                id="btn-save-address"
                type="submit"
                disabled={isSavingAddress}
                style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: "var(--market-primary)", color: "#fff", fontWeight: 800, cursor: isSavingAddress ? "not-allowed" : "pointer" }}
              >
                {isSavingAddress ? "Đang lưu..." : editingAddressId ? "Cập nhật địa chỉ" : "Lưu địa chỉ và chọn"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="step-actions-footer">
        <button id="btn-back-step1" type="button" onClick={() => setActiveStep(1)} className="btn-premium btn-premium-secondary">
          ← Quay lại bước 1
        </button>
        {addresses.length > 0 && !showAddressForm && (
          <button
            id="btn-checkout-step2-next"
            type="button"
            disabled={!formValues.addressId}
            onClick={() => setActiveStep(3)}
            className="btn-premium btn-premium-primary"
          >
            Tiếp tục bước 3 →
          </button>
        )}
      </div>
    </section>
  );
}
