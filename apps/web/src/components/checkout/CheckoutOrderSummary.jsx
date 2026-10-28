import { getAvailableCoupons, validateCoupon } from "../../services/coupon.service";

export function CheckoutOrderSummary({
  sectionStyle,
  items,
  formatCurrency,
  appliedCoupon,
  setAppliedCoupon,
  couponInput,
  setCouponInput,
  couponLoading,
  setCouponLoading,
  couponError,
  setCouponError,
  showCouponModal,
  setShowCouponModal,
  availableCoupons,
  setAvailableCoupons,
  loadingCoupons,
  setLoadingCoupons,
  totalAmount,
  discountAmount,
  finalAmount
}) {
  return (
    <>
      <aside style={{ position: "sticky", top: 40 }}>
        <div style={{ ...sectionStyle, padding: 28, animationDelay: "0.3s" }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 20, letterSpacing: "-0.02em", color: "#0f172a" }}>
            Tóm tắt linh kiện
          </h2>

          {/* Product listing with scrolling support */}
          <div style={{ display: "grid", gap: 4, maxHeight: 320, overflowY: "auto", paddingRight: 6, marginBottom: 20, borderBottom: "1px solid #f1f5f9" }}>
            {items.map((item) => (
              <div key={item.id} className="sidebar-product-item">
                <div style={{ width: 64, height: 64, borderRadius: 12, background: "#f8fafc", overflow: "hidden", flexShrink: 0, border: "1.5px solid #f1f5f9", display: "grid", placeItems: "center" }}>
                  {item.product?.imageUrl || item.variant?.imageUrl ? (
                    <img src={item.product?.imageUrl || item.variant?.imageUrl} alt="" style={{ width: "85%", height: "85%", objectFit: "contain" }} />
                  ) : (
                    <span style={{ fontSize: 24, opacity: 0.2 }}>📦</span>
                  )}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 850, color: "#1e293b", marginBottom: 4, lineHeight: 1.3, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                    {item.product?.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                    <span>Số lượng: {item.quantity}</span>
                    <span style={{ color: "var(--market-primary)", fontWeight: 800 }}>{formatCurrency(item.unitPrice)} đ</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Voucher Box in Checkout */}
          <div style={{ marginBottom: 20, padding: 16, borderRadius: 16, background: "rgba(241, 245, 249, 0.7)", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
                <span>🎟️</span> Mã ưu đãi / Voucher
              </span>
              <button
                type="button"
                onClick={async () => {
                  setShowCouponModal(true);
                  try {
                    setLoadingCoupons(true);
                    const res = await getAvailableCoupons();
                    setAvailableCoupons(res?.data || []);
                  } catch (e) {
                    console.warn("Could not load coupons", e);
                  } finally {
                    setLoadingCoupons(false);
                  }
                }}
                style={{ background: "none", border: "none", color: "var(--market-primary)", fontSize: 13, fontWeight: 800, cursor: "pointer", textDecoration: "underline", padding: 0 }}
              >
                Chọn mã
              </button>
            </div>

            {appliedCoupon ? (
              <div style={{ padding: "10px 12px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 900, color: "#065f46", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>{appliedCoupon.coupon?.code || appliedCoupon.code}</span>
                    <span style={{ fontSize: 10, background: "#10b981", color: "#fff", padding: "1px 5px", borderRadius: 4, fontWeight: 800 }}>Đã áp dụng</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#047857", fontWeight: 700, marginTop: 2 }}>
                    Giảm {formatCurrency(discountAmount)} đ
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponError("");
                    sessionStorage.removeItem("cnm_applied_coupon");
                  }}
                  style={{ background: "rgba(239, 68, 68, 0.1)", border: "none", color: "#ef4444", width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", cursor: "pointer", fontWeight: 900, fontSize: 12 }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    placeholder="Mã giảm giá..."
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    style={{
                      flex: 1, padding: "8px 12px", borderRadius: 10, border: "1px solid #cbd5e1",
                      fontSize: 12, fontWeight: 750, textTransform: "uppercase", outline: "none",
                      background: "#fff"
                    }}
                  />
                  <button
                    type="button"
                    disabled={couponLoading || !couponInput.trim()}
                    onClick={async () => {
                      const code = couponInput.trim().toUpperCase();
                      if (!code) return;
                      try {
                        setCouponLoading(true);
                        setCouponError("");
                        const res = await validateCoupon({
                          code,
                          items: items.map((item) => ({
                            productId: item.productId || item.product?.id,
                            categoryId: item.product?.category_id || item.product?.categoryId,
                            unitPrice: Number(item.unitPrice || item.price || 0),
                            quantity: Number(item.quantity || 1)
                          })),
                          totalAmount
                        });
                        const couponData = res?.data || res;
                        setAppliedCoupon(couponData);
                        sessionStorage.setItem("cnm_applied_coupon", JSON.stringify(couponData));
                        setCouponInput("");
                      } catch (err) {
                        setCouponError(err.response?.data?.message || err.message || "Mã không hợp lệ");
                      } finally {
                        setCouponLoading(false);
                      }
                    }}
                    style={{
                      padding: "0 14px", borderRadius: 10, border: "none",
                      background: "var(--market-primary)", color: "#fff",
                      fontWeight: 800, fontSize: 12, cursor: couponLoading || !couponInput.trim() ? "not-allowed" : "pointer"
                    }}
                  >
                    {couponLoading ? "..." : "Áp dụng"}
                  </button>
                </div>
                {couponError && (
                  <div style={{ color: "#ef4444", fontSize: 11, fontWeight: 700 }}>
                    ⚠️ {couponError}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontWeight: 700, fontSize: 14 }}>
              <span>Tổng tiền hàng</span>
              <span style={{ color: "#1e293b" }}>{formatCurrency(totalAmount)} đ</span>
            </div>
            {discountAmount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "#059669", fontWeight: 750, fontSize: 14 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span>🎟️</span> Giảm giá ({appliedCoupon?.coupon?.code || appliedCoupon?.code})
                </span>
                <span style={{ fontWeight: 900 }}>-{formatCurrency(discountAmount)} đ</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontWeight: 700, fontSize: 14 }}>
              <span>Phí giao hàng</span>
              <span style={{ color: "#059669", background: "rgba(5, 150, 105, 0.08)", padding: "2px 8px", borderRadius: 6, fontSize: "12px", fontWeight: 800 }}>Miễn phí</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 8, alignItems: "flex-end" }}>
              <span>Thành tiền</span>
              <div style={{ textAlign: "right" }}>
                {discountAmount > 0 && (
                  <div style={{ fontSize: 13, color: "#94a3b8", textDecoration: "line-through", fontWeight: 700, marginBottom: 2 }}>
                    {formatCurrency(totalAmount)} đ
                  </div>
                )}
                <span style={{ color: "var(--market-primary)", fontSize: 22 }}>{formatCurrency(finalAmount)} đ</span>
                <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, marginTop: 2 }}>(Đã gồm VAT & Thuế bảo vệ)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Elegant Trust Badges */}
        <div className="trust-badge-container">
          <div className="trust-badge-line">
            <div className="trust-badge-icon">🛡️</div>
            <div>
              <div style={{ fontWeight: 850, color: "#334155" }}>Bảo mật SSL 256-bit</div>
              <div style={{ fontSize: "11px", color: "#64748b", marginTop: 2 }}>Mọi giao dịch và thông tin cá nhân đều mã hóa tuyệt đối</div>
            </div>
          </div>
          <div className="trust-badge-line">
            <div className="trust-badge-icon">🔄</div>
            <div>
              <div style={{ fontWeight: 850, color: "#334155" }}>Cam kết bảo hành & Đổi trả</div>
              <div style={{ fontSize: "11px", color: "#64748b", marginTop: 2 }}>Đổi trả miễn phí trong 30 ngày • Bảo hành chính hãng 100%</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Modal danh sách Voucher trong Checkout */}
      {showCouponModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(8px)",
            display: "grid", placeItems: "center", padding: 20
          }}
          onClick={() => setShowCouponModal(false)}
        >
          <div
            style={{
              background: "#fff", borderRadius: 28, width: "100%", maxWidth: 540,
              maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", animation: "fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: "24px 28px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>🎟️</span>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#0f172a" }}>Chọn mã ưu đãi đơn hàng</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCouponModal(false)}
                style={{ background: "#f1f5f9", border: "none", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontWeight: 800, fontSize: 16, color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px 28px", overflowY: "auto", flex: 1, display: "grid", gap: 14 }}>
              {loadingCoupons ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b", fontWeight: 700 }}>
                  Đang tải danh sách ưu đãi...
                </div>
              ) : availableCoupons.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b", fontWeight: 700 }}>
                  Hiện chưa có mã giảm giá nào khả dụng
                </div>
              ) : (
                availableCoupons.map((c) => {
                  const isCurrentApplied = (appliedCoupon?.coupon?.code || appliedCoupon?.code) === c.code;
                  return (
                    <div
                      key={c.id}
                      style={{
                        padding: 18, borderRadius: 20,
                        border: isCurrentApplied ? "2px solid #10b981" : "1.5px solid #e2e8f0",
                        background: isCurrentApplied ? "rgba(16, 185, 129, 0.04)" : "#f8fafc",
                        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ background: "var(--market-primary)", color: "#fff", padding: "3px 8px", borderRadius: 8, fontSize: 12, fontWeight: 900 }}>
                            {c.code}
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 850, color: "#1e293b" }}>
                            {c.name}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4, marginTop: 4 }}>
                          {c.description}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginTop: 6 }}>
                          Đơn tối thiểu: {formatCurrency(c.minOrderValue)} đ • HSD: {new Date(c.endDate).toLocaleDateString("vi-VN")}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isCurrentApplied || couponLoading}
                        onClick={async () => {
                          try {
                            setCouponLoading(true);
                            setCouponError("");
                            const res = await validateCoupon({
                              code: c.code,
                              items: items.map((item) => ({
                                productId: item.productId || item.product?.id,
                                categoryId: item.product?.category_id || item.product?.categoryId,
                                unitPrice: Number(item.unitPrice || item.price || 0),
                                quantity: Number(item.quantity || 1)
                              })),
                              totalAmount
                            });
                            const couponData = res?.data || res;
                            setAppliedCoupon(couponData);
                            sessionStorage.setItem("cnm_applied_coupon", JSON.stringify(couponData));
                            setShowCouponModal(false);
                          } catch (err) {
                            alert(err.response?.data?.message || err.message || "Mã không hợp lệ");
                          } finally {
                            setCouponLoading(false);
                          }
                        }}
                        style={{
                          padding: "10px 18px", borderRadius: 14, border: "none",
                          background: isCurrentApplied ? "#10b981" : "var(--market-primary)",
                          color: "#fff", fontWeight: 800, fontSize: 13,
                          cursor: isCurrentApplied ? "default" : "pointer",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.06)", flexShrink: 0
                        }}
                      >
                        {isCurrentApplied ? "Đang chọn" : "Áp dụng"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
