import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

import { useAuth } from "../../hooks/useAuth";
import { getCart, removeCartItem, updateCartItem } from "../../services/cart.service";
import { getAvailableCoupons, validateCoupon } from "../../services/coupon.service";

function getErrorMessage(error, fallbackMessage) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallbackMessage;
  }
  return error.message || fallbackMessage;
}

function normalizeCartResponse(response) {
  return response?.data || response;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

const SECTION_STYLE = {
  padding: "32px",
  background: "rgba(255, 255, 255, 0.85)",
  backdropFilter: "blur(30px) saturate(180%)",
  borderRadius: "32px",
  border: "1px solid rgba(255, 255, 255, 0.7)",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.04), inset 0 0 0 1px rgba(255,255,255,1)",
  animation: "fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both"
};

export function CartPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingItemId, setProcessingItemId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const items = useMemo(() => cart?.items || [], [cart]);
  const totalAmount = Number(cart?.totalAmount || 0);

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(() => {
    try {
      const saved = sessionStorage.getItem("cnm_applied_coupon");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [loadingCoupons, setLoadingCoupons] = useState(false);

  const discountAmount = appliedCoupon ? Number(appliedCoupon.discountAmount || 0) : 0;
  const finalPayableAmount = Math.max(0, totalAmount - discountAmount);

  useEffect(() => {
    async function loadCart() {
      try {
        setLoading(true);
        setErrorMessage("");
        const response = await getCart();
        setCart(normalizeCartResponse(response));
      } catch (error) {
        setErrorMessage(getErrorMessage(error, "Không thể tải giỏ hàng"));
      } finally {
        setLoading(false);
      }
    }

    loadCart();

    const onCartChanged = () => {
      loadCart();
    };

    const onGuestCartUpdated = (e) => {
      if (!isAuthenticated && e?.detail) {
        setCart(normalizeCartResponse(e.detail));
      } else {
        loadCart();
      }
    };

    window.addEventListener("cnm_cart_changed", onCartChanged);
    window.addEventListener("cnm_cart_updated", onCartChanged);
    window.addEventListener("cnm_guest_cart_updated", onGuestCartUpdated);

    return () => {
      window.removeEventListener("cnm_cart_changed", onCartChanged);
      window.removeEventListener("cnm_cart_updated", onCartChanged);
      window.removeEventListener("cnm_guest_cart_updated", onGuestCartUpdated);
    };
  }, [isAuthenticated]);

  // Tự động kiểm tra lại điều kiện mã giảm giá nếu số lượng/giỏ hàng thay đổi
  useEffect(() => {
    if (appliedCoupon && items.length > 0 && totalAmount > 0) {
      const code = appliedCoupon.coupon?.code;
      if (code) {
        validateCoupon({
          code,
          items: items.map((item) => ({
            productId: item.productId || item.product?.id,
            categoryId: item.product?.category_id || item.product?.categoryId,
            unitPrice: Number(item.unitPrice || item.price || 0),
            quantity: Number(item.quantity || 1)
          })),
          totalAmount
        })
          .then((res) => {
            const updated = res?.data || res;
            setAppliedCoupon(updated);
            sessionStorage.setItem("cnm_applied_coupon", JSON.stringify(updated));
          })
          .catch(() => {
            setAppliedCoupon(null);
            sessionStorage.removeItem("cnm_applied_coupon");
          });
      }
    } else if (items.length === 0) {
      setAppliedCoupon(null);
      sessionStorage.removeItem("cnm_applied_coupon");
    }
  }, [totalAmount, items.length]);

  async function handleOpenCouponModal() {
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
  }

  async function handleApplyCoupon(codeToApply) {
    const code = (codeToApply || couponInput).trim().toUpperCase();
    if (!code) {
      setCouponError("Vui lòng nhập mã giảm giá");
      return;
    }

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
      setShowCouponModal(false);
      setCouponInput("");
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Mã giảm giá không hợp lệ";
      setCouponError(msg);
      setAppliedCoupon(null);
      sessionStorage.removeItem("cnm_applied_coupon");
    } finally {
      setCouponLoading(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponError("");
    setCouponInput("");
    sessionStorage.removeItem("cnm_applied_coupon");
  }

  async function handleUpdateQuantity(itemId, nextQuantity) {
    if (nextQuantity <= 0) {
      return handleRemoveItem(itemId);
    }

    try {
      setProcessingItemId(String(itemId));
      setErrorMessage("");
      const response = await updateCartItem(itemId, { quantity: nextQuantity });
      setCart(normalizeCartResponse(response));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể cập nhật số lượng"));
    } finally {
      setProcessingItemId("");
    }
  }

  async function handleRemoveItem(itemId) {
    try {
      setProcessingItemId(String(itemId));
      setErrorMessage("");
      const response = await removeCartItem(itemId);
      setCart(normalizeCartResponse(response));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể xóa sản phẩm khỏi giỏ hàng"));
    } finally {
      setProcessingItemId("");
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "80vh", display: "grid", placeItems: "center", fontSize: 18, color: "#64748b", fontWeight: 700 }}>
        Đang đồng bộ giỏ hàng...
      </div>
    );
  }

  return (
    <div data-testid="cart-page" style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px" }}>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .cart-item-card { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); border: 1.5px solid transparent; }
        .cart-item-card:hover { transform: translateY(-4px); border-color: rgba(37, 99, 235, 0.1); box-shadow: 0 20px 40px rgba(0,0,0,0.04); }
        .qty-btn { width: 36px; height: 36px; border-radius: 12px; border: none; background: #fff; cursor: pointer; font-weight: 900; color: #1e293b; box-shadow: 0 2px 8px rgba(0,0,0,0.05); transition: all 0.2s; }
        .qty-btn:hover:not(:disabled) { background: #f1f5f9; transform: scale(1.05); }
        .qty-btn:active:not(:disabled) { transform: scale(0.95); }
        .qty-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 42, fontWeight: 950, letterSpacing: "-0.05em", color: "#0f172a", marginBottom: 8 }}>Giỏ hàng</h1>
        <p style={{ color: "#64748b", fontSize: 17, fontWeight: 600 }}>Thiết kế bộ PC mơ ước, thanh toán linh hoạt.</p>
      </div>

      {!isAuthenticated && (
        <div style={{
          marginBottom: 32,
          padding: "20px 24px",
          background: "linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(99, 102, 241, 0.08))",
          border: "1.5px solid rgba(37, 99, 235, 0.2)",
          borderRadius: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          boxShadow: "0 10px 30px rgba(37, 99, 235, 0.05)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 32 }}>💡</span>
            <div>
              <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 15 }}>
                Bạn đang xem giỏ hàng tạm (Khách vãng lai)
              </div>
              <div style={{ color: "#64748b", fontSize: 13.5, marginTop: 2 }}>
                Đăng nhập hoặc đăng ký để hệ thống tự động hợp nhất giỏ hàng vào tài khoản của bạn và tiến hành thanh toán.
              </div>
            </div>
          </div>
          <Link
            to="/login?redirect=/cart"
            style={{
              padding: "10px 22px",
              borderRadius: 14,
              background: "var(--market-primary)",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 800,
              fontSize: 13.5,
              flexShrink: 0,
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)"
            }}
          >
            Đăng nhập ngay
          </Link>
        </div>
      )}

      {errorMessage && (
        <div style={{ marginBottom: 32, padding: '16px 24px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 20, color: '#b91c1c', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {errorMessage}</span>
          <button onClick={() => setErrorMessage("")} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 800, fontSize: 18 }}>✕</button>
        </div>
      )}

      {items.length === 0 ? (
        <div data-testid="cart-empty-state" style={{ ...SECTION_STYLE, textAlign: 'center', padding: "80px 40px" }}>
          <div style={{ fontSize: 80, marginBottom: 24, opacity: 0.3 }}>🛒</div>
          <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 16 }}>Giỏ hàng siêu nhẹ</h2>
          <p style={{ color: "#64748b", marginBottom: 40, fontSize: 18 }}>Bạn chưa chọn linh kiện nào cả. Hãy lấp đầy giỏ hàng bằng sức mạnh công nghệ!</p>
          <Link to="/products" style={{ display: "inline-block", padding: "16px 40px", borderRadius: 16, background: "var(--market-primary)", color: "#fff", textDecoration: "none", fontWeight: 800 }}>Khám phá linh kiện</Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 32, alignItems: "start" }}>
          {/* Main List */}
          <div style={{ display: "grid", gap: 20 }}>
            {items.map((item) => {
              const isProcessing = processingItemId === String(item.id);
              // Use camelCase imageUrl from both product (newly updated) and variant
              const imgSrc = item.product?.imageUrl || item.variant?.imageUrl;

              return (
                <article
                  key={item.id}
                  data-testid="cart-item"
                  className="cart-item-card"
                  style={{
                    ...SECTION_STYLE,
                    display: "grid",
                    gridTemplateColumns: "140px 1fr auto",
                    gap: 24,
                    padding: 24,
                    alignItems: "center",
                    opacity: isProcessing ? 0.6 : 1,
                  }}
                >
                  <div style={{ width: 140, height: 140, background: '#f8fafc', borderRadius: 20, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                    {imgSrc ? (
                      <img src={imgSrc} alt={item.product?.name} style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ fontSize: 48, filter: "grayscale(100%)", opacity: 0.2 }}>📦</span>
                    )}
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                       <span style={{ padding: '4px 10px', background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb', borderRadius: 8, fontSize: 11, fontWeight: 800 }}>{item.product?.category?.name || "Linh kiện"}</span>
                       <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>#{item.variant?.sku}</span>
                    </div>
                    <Link to={`/products/${item.product?.slug || item.product?.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900, lineHeight: 1.3, color: "#0f172a" }}>{item.product?.name}</h3>
                    </Link>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#64748b' }}>{formatCurrency(item.unitPrice)} đ</div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 16 }}>
                    <div style={{ fontWeight: 900, fontSize: 22, color: "var(--market-primary)" }}>{formatCurrency(item.lineTotal)} đ</div>
                    
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        background: "#f1f5f9", 
                        borderRadius: 16, 
                        padding: '6px' 
                      }}>
                        <button type="button" className="qty-btn" onClick={() => handleUpdateQuantity(item.id, Number(item.quantity) - 1)} disabled={isProcessing}>−</button>
                        <div style={{ minWidth: 48, textAlign: "center", fontWeight: 900, fontSize: 16 }}>{item.quantity}</div>
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => handleUpdateQuantity(item.id, Number(item.quantity) + 1)}
                          disabled={isProcessing || (item.variant?.stock && item.quantity >= item.variant.stock)}
                          title={item.variant?.stock && item.quantity >= item.variant.stock ? "Đã đạt số lượng tồn kho tối đa" : "Tăng số lượng"}
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={isProcessing}
                        style={{ 
                          width: 48, height: 48, borderRadius: 16, border: "none", 
                          background: "rgba(239, 68, 68, 0.08)", color: "#ef4444", 
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.transform = "scale(1.05)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.transform = "scale(1)"; }}
                        title="Xóa khỏi giỏ hàng"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Checkout Summary */}
          <aside style={{ position: "sticky", top: 40 }}>
            <div style={{ ...SECTION_STYLE, padding: 32 }}>
              <h2 style={{ margin: "0 0 24px", fontSize: 24, fontWeight: 950 }}>Tạm tính</h2>

              {/* Khung nhập và quản lý Coupon / Voucher */}
              <div style={{ marginBottom: 24, padding: "18px 20px", borderRadius: 20, background: "rgba(241, 245, 249, 0.7)", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>🎟️</span> Mã ưu đãi / Voucher
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenCouponModal}
                    style={{ background: "none", border: "none", color: "var(--market-primary)", fontSize: 13, fontWeight: 800, cursor: "pointer", textDecoration: "underline", padding: 0 }}
                  >
                    Xem mã ưu đãi
                  </button>
                </div>

                {appliedCoupon ? (
                  <div style={{ padding: "12px 14px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>🎉</span>
                      <div>
                        <div style={{ fontWeight: 900, color: "#065f46", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                          <span>{appliedCoupon.coupon?.code}</span>
                          <span style={{ fontSize: 11, background: "#10b981", color: "#fff", padding: "1px 6px", borderRadius: 6, fontWeight: 800 }}>Đã áp dụng</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#047857", fontWeight: 700, marginTop: 2 }}>
                          Giảm {formatCurrency(appliedCoupon.discountAmount)} đ
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      title="Gỡ mã giảm giá"
                      style={{ background: "rgba(239, 68, 68, 0.1)", border: "none", color: "#ef4444", width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", cursor: "pointer", fontWeight: 900, fontSize: 14 }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        placeholder="Nhập mã voucher..."
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => { if (e.key === "Enter") handleApplyCoupon(); }}
                        style={{
                          flex: 1, padding: "10px 14px", borderRadius: 14, border: "1px solid #cbd5e1",
                          fontSize: 13, fontWeight: 750, textTransform: "uppercase", outline: "none",
                          background: "#fff"
                        }}
                      />
                      <button
                        type="button"
                        disabled={couponLoading || !couponInput.trim()}
                        onClick={() => handleApplyCoupon()}
                        style={{
                          padding: "0 18px", borderRadius: 14, border: "none",
                          background: "var(--market-primary)", color: "#fff",
                          fontWeight: 800, fontSize: 13, cursor: couponLoading || !couponInput.trim() ? "not-allowed" : "pointer",
                          opacity: couponLoading || !couponInput.trim() ? 0.6 : 1, transition: "all 0.2s"
                        }}
                      >
                        {couponLoading ? "..." : "Áp dụng"}
                      </button>
                    </div>

                    {couponError && (
                      <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 700, marginTop: 2 }}>
                        ⚠️ {couponError}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div style={{ display: "grid", gap: 16, marginBottom: 32 }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: 16, fontWeight: 600 }}>
                  <span>Số lượng:</span>
                  <span style={{ fontWeight: 800, color: '#1e293b' }}>{cart?.totalItems || 0} sản phẩm</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: 16, fontWeight: 600 }}>
                  <span>Tạm tính hàng:</span>
                  <span style={{ fontWeight: 800, color: '#1e293b' }}>{formatCurrency(totalAmount)} đ</span>
                </div>
                {discountAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#059669", fontSize: 15, fontWeight: 750 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span>🎟️</span> Giảm giá ({appliedCoupon?.coupon?.code}):
                    </span>
                    <span style={{ fontWeight: 900 }}>-{formatCurrency(discountAmount)} đ</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: 16, fontWeight: 600 }}>
                  <span>Phí vận chuyển:</span>
                  <span style={{ fontWeight: 800, color: '#10b981' }}>Miễn phí</span>
                </div>
                <div style={{ height: 1, background: '#e2e8f0', margin: '8px 0' }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: 'flex-end', marginTop: 8 }}>
                  <span style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>Tổng cộng</span>
                  <div style={{ textAlign: 'right' }}>
                    {discountAmount > 0 && (
                      <div style={{ fontSize: 14, color: "#94a3b8", textDecoration: "line-through", fontWeight: 700, marginBottom: 2 }}>
                        {formatCurrency(totalAmount)} đ
                      </div>
                    )}
                    <div style={{ fontSize: 28, fontWeight: 950, color: 'var(--market-primary)' }}>{formatCurrency(finalPayableAmount)} đ</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginTop: 4 }}>(Đã tính thuế VAT)</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 16 }}>
                <button
                  id="cart-checkout-button"
                  data-testid="cart-checkout-button"
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated) {
                      navigate("/login?redirect=/checkout");
                    } else {
                      navigate("/checkout");
                    }
                  }}
                  style={{ 
                    height: 64, fontSize: 18, borderRadius: 20, border: "none", 
                    background: isAuthenticated
                      ? "linear-gradient(135deg, var(--market-primary), #1e40af)"
                      : "linear-gradient(135deg, #2563eb, #4f46e5)", 
                    color: "#fff", fontWeight: 900, cursor: "pointer",
                    boxShadow: "0 10px 25px rgba(32, 120, 202, 0.2)", transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 15px 30px rgba(32, 120, 202, 0.3)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 10px 25px rgba(32, 120, 202, 0.2)"; }}
                >
                  {isAuthenticated ? "XÁC NHẬN THANH TOÁN" : "ĐĂNG NHẬP ĐỂ THANH TOÁN"}
                </button>
                <Link 
                  to="/products"
                  style={{ 
                    textAlign: 'center', padding: '16px', color: '#64748b', 
                    textDecoration: 'none', fontWeight: 800, fontSize: 15, transition: "color 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "var(--market-primary)"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "#64748b"}
                >
                  ← Tiếp tục mua sắm
                </Link>
              </div>

              <div style={{ marginTop: 32, padding: 20, background: 'linear-gradient(to right, rgba(16, 185, 129, 0.05), rgba(16, 185, 129, 0.1))', borderRadius: 20, border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', gap: 16, alignItems: 'center' }}>
                 <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(16, 185, 129, 0.15)', display: 'grid', placeItems: 'center', fontSize: 20 }}>🛡️</div>
                 <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#065f46" }}>Bảo vệ giao dịch 100%</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#047857", opacity: 0.8, marginTop: 2 }}>Mã hóa end-to-end cao cấp</div>
                 </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Modal danh sách Voucher khả dụng */}
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
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#0f172a" }}>Mã ưu đãi PC & Linh kiện</h3>
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
                  const isCurrentApplied = appliedCoupon?.coupon?.code === c.code;
                  const isEligible = totalAmount >= Number(c.minOrderValue || 0);

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
                        onClick={() => handleApplyCoupon(c.code)}
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
    </div>
  );
}
