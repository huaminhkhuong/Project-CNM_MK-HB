import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addStoredCompareId, buildCompareUrl } from "../../utils/compare";
import { resolveProductImage } from "../../utils/productImage";

const STAR_TEXT = "★★★★★";

function getProductName(product) {
  return product?.product_name || product?.name || "Sản phẩm đang cập nhật";
}
function getBrandName(product) {
  return product?.brand_name || product?.brand?.name || "Thương hiệu";
}
function getProductCategory(product) {
  return String(product?.category_name || product?.category?.name || "");
}
function getProductPrice(product) {
  return Number(product?.price ?? product?.pricing?.minPrice ?? product?.defaultVariant?.price ?? product?.skus?.[0]?.price ?? 0);
}
function getProductStock(product) {
  return Number(product?.stock ?? product?.stock_quantity ?? product?.defaultVariant?.stock ?? product?.skus?.[0]?.stock ?? 0);
}
function getCoolingType(product) {
  const rawValues = [
    product?.coolingType, product?.cooling_type,
    ...(Array.isArray(product?.attributes)
      ? product.attributes.map((a) => ({ key: a?.key || a?.name || a?.attribute_name, value: a?.value || a?.attribute_value }))
      : []),
  ];
  for (const item of rawValues) {
    if (!item) continue;
    if (typeof item === "string") {
      const n = item.toLowerCase();
      if (n.includes("air")) return "AIR COOLER";
      if (n.includes("aio") || n.includes("liquid")) return "AIO";
      if (n.includes("fan")) return "CASE FAN";
    } else {
      const key = String(item.key || "").toLowerCase();
      const val = String(item.value || "").toLowerCase();
      if (key.includes("cooling") || key.includes("radiator") || key.includes("fan")) {
        if (val.includes("air")) return "AIR COOLER";
        if (val.includes("aio") || val.includes("liquid")) return "AIO";
        if (val.includes("fan")) return "CASE FAN";
      }
    }
  }
  const cat = getProductCategory(product).toLowerCase();
  if (cat.includes("cooling") || cat.includes("cooler")) return "AIR COOLER";
  return "";
}
function getStockMeta(stock) {
  if (stock <= 0) return { label: "Hết hàng", tone: "danger" };
  if (stock <= 5) return { label: "Sắp hết", tone: "warning" };
  return { label: "Còn hàng", tone: "success" };
}

/* Quick View overlay component */
function QuickViewOverlay({ href }) {
  const [hov, setHov] = useState(false);
  return (
    <Link
      to={href}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 44,
        background: hov
          ? "linear-gradient(135deg, #1d4ed8, #3b82f6)"
          : "rgba(10, 14, 28, 0.82)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontSize: 13,
        fontWeight: 700,
        textDecoration: "none",
        borderRadius: "0 0 12px 12px",
        transform: "translateY(100%)",
        transition: "transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease",
        zIndex: 5,
        letterSpacing: "0.02em",
        boxShadow: hov ? "0 -4px 20px rgba(37,99,235,0.4)" : "none",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
      className="v2-quickview"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      Xem nhanh
    </Link>
  );
}

export function ProductCard({ product, eager = false }) {
  const navigate  = useNavigate();
  const cardRef   = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasFailedOnce, setHasFailedOnce] = useState(false);
  const [imageSrc, setImageSrc]   = useState(() => resolveProductImage(product));
  const [isHovered, setIsHovered] = useState(false);

  const productId      = product?.product_id || product?.id;
  const productName    = getProductName(product);
  const productSlug    = product?.slug || productId;
  const brandName      = getBrandName(product);
  const categoryName   = getProductCategory(product);
  const price          = getProductPrice(product);
  const oldPrice       = Number(product?.oldPrice || Math.round(price * 1.14));
  const discountPercent= Number(product?.discountPercent || 12);
  const rating         = Number(product?.rating || 4.8).toFixed(1);
  const soldCount      = Number(product?.soldCount || 120);
  const stock          = getProductStock(product);
  const stockMeta      = getStockMeta(stock);
  const isMall         = Boolean(product?.isMall);
  const isFreeShip     = Boolean(product?.isFreeShip);
  const coolingType    = useMemo(() => getCoolingType(product), [product]);

  useEffect(() => {
    const nextSrc = resolveProductImage(product);
    // Skip skeleton if browser already has this image cached
    if (nextSrc === imageSrc && imageLoaded) return;
    setImageSrc(nextSrc);
    // Check if browser cache already has it (complete = true on cached images)
    if (eager || nextSrc === imageSrc) {
      setImageLoaded(true);
    } else {
      const probe = new window.Image();
      probe.src = nextSrc;
      if (probe.complete) {
        setImageLoaded(true);
      } else {
        setImageLoaded(false);
      }
    }
    setHasFailedOnce(false);
  }, [product]);

  function handleCompareClick() {
    if (!productId) return;
    navigate(buildCompareUrl(addStoredCompareId(productId)));
  }

  function handleImageError() {
    setImageLoaded(true);
    if (hasFailedOnce) return;
    setHasFailedOnce(true);
    const fallback = resolveProductImage(
      { category_name: categoryName || "cooling", product_name: productName },
      { label: brandName }
    );
    if (fallback && fallback !== imageSrc) setImageSrc(fallback);
  }

  const href = `/products/${productSlug}`;

  return (
    <>
      <style>{`
        .v2-product-card:hover .v2-quickview {
          transform: translateY(0) !important;
        }
        .v2-product-card:hover .v2-card-img {
          transform: scale(1.05) !important;
        }
        .v2-product-card:hover .v2-card-glow {
          opacity: 1 !important;
        }
      `}</style>

      <article
        ref={cardRef}
        className="market-product-card v2-product-card"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ overflow: "hidden" }}
      >
        <Link className="market-product-card__link" to={href}>
          {/* ── Image Media ── */}
          <div
            className={`market-product-card__media ${imageLoaded ? "is-loaded" : "is-loading"}`}
            style={{ position: "relative", overflow: "hidden" }}
          >
            {/* Shimmer skeleton V2 */}
            {!imageLoaded && (
              <div style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(90deg, var(--market-surface-soft) 25%, rgba(255,255,255,0.12) 50%, var(--market-surface-soft) 75%)",
                backgroundSize: "600px 100%",
                animation: "v2-shimmer 1.6s ease-in-out infinite",
                zIndex: 3,
              }} />
            )}

            {/* Glow overlay on hover */}
            <div
              className="v2-card-glow"
              style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(circle at center, rgba(59,130,246,0.08) 0%, transparent 70%)",
                opacity: 0,
                transition: "opacity 0.3s ease",
                zIndex: 2,
                pointerEvents: "none",
              }}
            />

            <img
              src={imageSrc}
              alt={productName}
              loading={eager ? "eager" : "lazy"}
              fetchpriority={eager ? "high" : "auto"}
              className="v2-card-img"
              style={{ transition: "transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
              onLoad={() => setImageLoaded(true)}
              onError={handleImageError}
            />

            {/* Badges: Discount */}
            <div className="market-product-card__badges">
              <span className="market-product-card__discount">
                -{discountPercent}%
              </span>
              {coolingType && (
                <span className="market-product-card__type">{coolingType}</span>
              )}
            </div>

            {/* Badges: Mall + Stock */}
            <div className="market-product-card__flags">
              {isMall && (
                <span className="market-product-card__mall">🏬 Mall</span>
              )}
              <span className={`market-product-card__status market-product-card__status--${stockMeta.tone}`}>
                {stockMeta.label}
              </span>
            </div>

            {/* Quick View overlay */}
            <QuickViewOverlay href={href} />
          </div>

          {/* ── Body ── */}
          <div className="market-product-card__body">
            {/* Brand + Category */}
            <div className="market-product-card__brand-row">
              <span className="market-product-card__brand">{brandName}</span>
              <span className="market-product-card__category">{categoryName || "PC Mall"}</span>
            </div>

            {/* Product Name */}
            <div className="market-product-card__name">{productName}</div>

            {/* Price */}
            <div className="market-product-card__price">
              <span className="market-product-card__price-current">
                {price.toLocaleString("vi-VN")}đ
              </span>
              <span className="market-product-card__price-old">
                {oldPrice.toLocaleString("vi-VN")}đ
              </span>
            </div>

            {/* Rating + Sold */}
            <div className="market-product-card__meta">
              <span className="market-product-card__rating">
                <span className="market-product-card__stars">{STAR_TEXT}</span>
                <span style={{ fontWeight: 600 }}>{rating}</span>
              </span>
              <span style={{ color: "var(--market-muted)", fontSize: 11 }}>
                Đã bán {soldCount}
              </span>
            </div>

            {/* Tags */}
            <div className="market-product-card__bottom">
              <span className="market-product-card__tag">
                {isFreeShip ? "🚀 Freeship" : "⚡ Giao nhanh"}
              </span>
              <span className="market-product-card__tag market-product-card__tag--muted">
                Tồn {Math.max(stock, 0)}
              </span>
            </div>
          </div>
        </Link>

        {/* ── Actions ── */}
        <div className="market-product-card__actions">
          <button
            className="market-product-card__compare"
            type="button"
            onClick={handleCompareClick}
          >
            ⚖️ So sánh
          </button>
          <Link
            className="market-product-card__detail"
            to={href}
            style={{
              transform: isHovered ? "scale(1.02)" : "scale(1)",
              boxShadow: isHovered
                ? "0 6px 20px rgba(37,99,235,0.45)"
                : "0 4px 12px rgba(37,99,235,0.3)",
            }}
          >
            Chi tiết →
          </Link>
        </div>
      </article>
    </>
  );
}
