import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

import { useAuth } from "../../hooks/useAuth";
import { httpClient } from "../../services/http";
import { getCart, removeCartItem, updateCartItem } from "../../services/cart.service";
import { getAvailableCoupons } from "../../services/coupon.service";
import { resolveProductImage } from "../../utils/productImage";

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

  // Coupon Voucher States
  const [couponInput, setCouponInput] = useState("");
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponMessage, setCouponMessage] = useState(null);

  const items = useMemo(() => cart?.items || [], [cart]);
  const totalAmount = Number(cart?.totalAmount || 0);

  async function validateCouponForCart(codeToValidate, targetCart = cart, silent = false) {
    const cleanCode = String(codeToValidate || "").trim();
    if (!cleanCode) return;
    const cartItems = Array.isArray(targetCart?.items) ? targetCart.items : [];
    const cartTotal = Number(targetCart?.totalAmount || 0);
    if (cartItems.length === 0 || cartTotal <= 0) {
      setAppliedCoupon(null);
      if (!silent) setCouponMessage(null);
      return;
    }

    try {
      if (!silent) {
        setIsApplyingCoupon(true);
        setCouponMessage(null);
      }
      const res = await httpClient.post("/coupons/validate", {
        code: cleanCode,
        totalAmount: cartTotal,
        orderAmount: cartTotal,
        items: cartItems.map((item) => ({
          productId: Number(item.product?.id || item.productId || 0),
          categoryId: Number(item.product?.category?.id || item.product?.category_id || item.categoryId || 0),
          unitPrice: Number(item.unitPrice || item.price || 0),
          quantity: Number(item.quantity || 1),
          lineTotal: Number(item.lineTotal || Number(item.unitPrice || 0) * Number(item.quantity || 1))
        }))
      });
      if (res.data?.success && res.data?.data) {
        const data = res.data.data;
        setCouponInput(data.code || cleanCode.toUpperCase());
        setAppliedCoupon(data);
        setCouponMessage({
          type: "success",
          text: `Đã áp dụng mã ${data.code || cleanCode.toUpperCase()}: Giảm ${formatCurrency(data.discountAmount)} đ`
        });
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Mã giảm giá không hợp lệ";
      setAppliedCoupon(null);
      setCouponMessage({ type: "error", text: msg });
    } finally {
      if (!silent) {
        setIsApplyingCoupon(false);
      }
    }
  }

  async function handleApplyCoupon(codeOverride) {
    const code = typeof codeOverride === "string" ? codeOverride : couponInput;
    await validateCouponForCart(code, cart, false);
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponMessage(null);
  }

  useEffect(() => {
    async function loadCartAndCoupons() {
      try {
        setLoading(true);
        setErrorMessage("");
        const [cartResponse, couponsResponse] = await Promise.all([
          getCart(),
          getAvailableCoupons().catch(() => ({ data: [] }))
        ]);
        setCart(normalizeCartResponse(cartResponse));
        const couponsList = couponsResponse?.data || couponsResponse || [];
        setAvailableCoupons(Array.isArray(couponsList) ? couponsList : []);
      } catch (error) {
        setErrorMessage(getErrorMessage(error, "Không thể tải giỏ hàng"));
      } finally {
        setLoading(false);
      }
    }

    loadCartAndCoupons();
  }, [isAuthenticated]);

  async function handleUpdateQuantity(itemId, nextQuantity) {
    if (nextQuantity <= 0) {
      return handleRemoveItem(itemId);
    }

    try {
      setProcessingItemId(String(itemId));
      setErrorMessage("");
      const response = await updateCartItem(itemId, { quantity: nextQuantity });
      const nextCart = normalizeCartResponse(response);
      setCart(nextCart);
      if (appliedCoupon?.code) {
        await validateCouponForCart(appliedCoupon.code, nextCart, true);
      }
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
      const nextCart = normalizeCartResponse(response);
      setCart(nextCart);
      if (appliedCoupon?.code) {
        await validateCouponForCart(appliedCoupon.code, nextCart, true);
      }
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
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px" }}>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .cart-item-card { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); border: 1.5px solid transparent; }
        .cart-item-card:hover { transform: translateY(-4px); border-color: rgba(37, 99, 235, 0.1); box-shadow: 0 20px 40px rgba(0,0,0,0.04); }
        .qty-btn { width: 36px; height: 36px; border-radius: 12px; border: none; background: #fff; cursor: pointer; font-weight: 900; color: #1e293b; box-shadow: 0 2px 8px rgba(0,0,0,0.05); transition: all 0.2s; }
        .qty-btn:hover:not(:disabled) { background: #f1f5f9; transform: scale(1.05); }
        .qty-btn:active:not(:disabled) { transform: scale(0.95); }
        .qty-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 42, fontWeight: 950, letterSpacing: "-0.05em", color: "#0f172a", marginBottom: 8 }}>Giỏ hàng</h1>
        <p style={{ color: "#64748b", fontSize: 17, fontWeight: 600 }}>Thiết kế bộ PC mơ ước, thanh toán linh hoạt.</p>
      </div>

      {!isAuthenticated && items.length > 0 && (
        <div style={{ marginBottom: 24, padding: "14px 20px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 18, color: "#1e40af", fontWeight: 700, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span>💡 Bạn đang xem Giỏ hàng Khách. Khi đăng nhập, các linh kiện này sẽ tự động đồng bộ vào tài khoản của bạn.</span>
          <Link to="/login" state={{ from: { pathname: "/cart" } }} style={{ color: "#1d4ed8", fontWeight: 900, textDecoration: "underline" }}>Đăng nhập ngay</Link>
        </div>
      )}

      {errorMessage && (
        <div style={{ marginBottom: 32, padding: '16px 24px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 20, color: '#b91c1c', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {errorMessage}</span>
          <button onClick={() => setErrorMessage("")} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 800, fontSize: 18 }}>✕</button>
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ ...SECTION_STYLE, textAlign: 'center', padding: "80px 40px" }}>
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
              const imgSrc = resolveProductImage({
                image_url: item.product?.imageUrl || item.variant?.imageUrl,
                category_name: item.product?.category?.name,
                name: item.product?.name
              });

              return (
                <article
                  key={item.id}
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
                        <button type="button" className="qty-btn" onClick={() => handleUpdateQuantity(item.id, Number(item.quantity) + 1)} disabled={isProcessing}>+</button>
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
              
              <div style={{ display: "grid", gap: 16, marginBottom: 32 }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: 16, fontWeight: 600 }}>
                  <span>Số lượng:</span>
                  <span style={{ fontWeight: 800, color: '#1e293b' }}>{cart?.totalItems || 0} sản phẩm</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: 16, fontWeight: 600 }}>
                  <span>Phí vận chuyển:</span>
                  <span style={{ fontWeight: 800, color: '#10b981' }}>Miễn phí</span>
                </div>
                <div style={{ height: 1, background: '#e2e8f0', margin: '8px 0' }} />

                {/* Coupon Code Input */}
                <div style={{ margin: '8px 0' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 8 }}>
                    🏷️ Mã giảm giá / Voucher
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="VD: PCMALL10, VIPBUILD..."
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      disabled={isApplyingCoupon || !!appliedCoupon}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: 12,
                        border: '1px solid #cbd5e1',
                        fontSize: 14,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        outline: 'none'
                      }}
                    />
                    {appliedCoupon ? (
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 12,
                          border: 'none',
                          background: '#fee2e2',
                          color: '#dc2626',
                          fontWeight: 800,
                          fontSize: 13,
                          cursor: 'pointer'
                        }}
                      >
                        Hủy
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleApplyCoupon()}
                        disabled={isApplyingCoupon || !couponInput.trim()}
                        style={{
                          padding: '10px 16px',
                          borderRadius: 12,
                          border: 'none',
                          background: isApplyingCoupon ? '#94a3b8' : 'var(--market-primary)',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: 13,
                          cursor: isApplyingCoupon ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {isApplyingCoupon ? '...' : 'Áp dụng'}
                      </button>
                    )}
                  </div>
                  {availableCoupons.length > 0 && !appliedCoupon && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      {availableCoupons.slice(0, 4).map((c) => (
                        <button
                          key={c.id || c.code}
                          type="button"
                          onClick={() => handleApplyCoupon(c.code)}
                          disabled={isApplyingCoupon}
                          title={c.description || c.name}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            border: "1px dashed #3b82f6",
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: "pointer"
                          }}
                        >
                          🎟️ {c.code}
                        </button>
                      ))}
                    </div>
                  )}
                  {couponMessage && (
                    <div style={{ fontSize: 12, marginTop: 6, fontWeight: 700, color: couponMessage.type === 'success' ? '#16a34a' : '#dc2626' }}>
                      {couponMessage.text}
                    </div>
                  )}
                </div>

                {appliedCoupon && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a", fontSize: 16, fontWeight: 700 }}>
                    <span>Giảm giá ({appliedCoupon.code}):</span>
                    <span>-{formatCurrency(appliedCoupon.discountAmount)} đ</span>
                  </div>
                )}

                <div style={{ height: 1, background: '#e2e8f0', margin: '8px 0' }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: 'flex-end', marginTop: 8 }}>
                  <span style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>Tổng cộng</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 28, fontWeight: 950, color: 'var(--market-primary)' }}>
                      {formatCurrency(Math.max(0, totalAmount - Number(appliedCoupon?.discountAmount || 0)))} đ
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginTop: 4 }}>(Đã tính thuế VAT)</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 16 }}>
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated) {
                      navigate("/login", { state: { from: { pathname: "/checkout", state: { appliedCoupon } } } });
                      return;
                    }
                    navigate("/checkout", { state: { appliedCoupon } });
                  }}
                  style={{ 
                    height: 64, fontSize: 18, borderRadius: 20, border: "none", 
                    background: "linear-gradient(135deg, var(--market-primary), #1e40af)", 
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
    </div>
  );
}
