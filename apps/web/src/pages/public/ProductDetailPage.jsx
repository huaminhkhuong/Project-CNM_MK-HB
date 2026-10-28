import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { addItemToCart } from "../../services/cart.service";
import { refreshCart } from "../../store/cartStore";
import { getProductDetail, getProducts } from "../../services/catalog.service";
import { useAuth } from "../../hooks/useAuth";
import { routeConfig } from "../../routes/routeConfig";
import { addStoredCompareId, buildCompareUrl } from "../../utils/compare";
import { resolveProductImage } from "../../utils/productImage";
import { ProductReviewsSection } from "../../components/ProductReviewsSection";

const DIRECT_CHECKOUT_DRAFT_KEY = "checkout_direct_draft_v1";

function getErrorMessage(error, fallbackMessage) {
  return error?.response?.data?.message || error?.message || fallbackMessage;
}

function normalizeProductDetail(response) {
  const raw = response?.data || response;
  if (raw?.success && raw?.data) return raw.data;
  return raw;
}

function normalizeProductList(response) {
  const raw = response?.data || response;
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function getProductId(product) {
  return product?.id || product?.product_id;
}

function getProductName(product) {
  return product?.name || product?.product_name || product?.productName || "Sản phẩm PC Mall";
}

function getProductCategory(product) {
  return product?.category?.name || product?.Category?.name || product?.category_name || "Linh kiện PC";
}

function getProductBrand(product) {
  const brand = product?.brand?.name || product?.Brand?.name || product?.brand_name || (typeof product?.brand === "string" ? product.brand : null);
  if (brand && brand.trim() && brand.toLowerCase() !== "unknown" && brand.toLowerCase() !== "thương hiệu") {
    return brand.trim();
  }
  const name = String(product?.name || product?.product_name || "").toUpperCase();
  const KNOWN = ["INTEL", "AMD", "ASUS", "MSI", "GIGABYTE", "CORSAIR", "KINGSTON", "SAMSUNG", "WD", "DEEPCOOL", "THERMALRIGHT", "NZXT", "MONTECH", "LIAN LI", "COOLER MASTER", "INNO3D", "PALIT", "ZOTAC", "COLORFUL", "G.SKILL", "CRUCIAL", "NOCTUA", "JONSBO", "XIGMATEK", "AIGO", "KENOO", "MIK"];
  for (const b of KNOWN) {
    if (name.includes(b)) {
      if (b === "WD") return "WD";
      return b.charAt(0) + b.slice(1).toLowerCase();
    }
  }
  return "Chính hãng";
}

function getSkuId(sku) {
  return sku?.id || sku?.variant_id || sku?.skuId;
}

function getSkuStock(sku) {
  return Number(sku?.stock ?? sku?.stock_quantity ?? sku?.quantity ?? 0);
}

function getSkuPrice(sku, fallback = 0) {
  return Number(sku?.price ?? sku?.unitPrice ?? fallback ?? 0);
}

function getAttributeValue(attributes, keys) {
  const normalizedKeys = keys.map((key) => key.toLowerCase());
  const hit = (attributes || []).find((attr) => {
    const key = String(attr.key || attr.name || attr.attribute_name || "").toLowerCase();
    return normalizedKeys.some((token) => key.includes(token));
  });
  return hit?.value || hit?.attribute_value || "";
}

function parseDescription(description) {
  if (!description) return "Sản phẩm chính hãng tại PC Mall, phù hợp nâng cấp hoặc build mới dàn PC hiệu năng ổn định.";
  return String(description).replace(/<[^>]*>/g, "").trim();
}

function isCompletePc(product) {
  const name = getProductName(product).toLowerCase();
  const category = getProductCategory(product).toLowerCase();
  return category.includes("complete") || category.includes("pc") || name.includes("complete pc") || name.includes("pc ") || name.includes("gaming pc");
}

function buildPcConfig(product, attributes) {
  const config = [
    ["CPU", ["cpu", "processor", "vi xử lý"]],
    ["GPU", ["gpu", "vga", "graphics", "card đồ họa"]],
    ["RAM", ["ram", "memory"]],
    ["Mainboard", ["mainboard", "motherboard", "bo mạch"]],
    ["SSD", ["ssd", "storage", "ổ cứng"]],
    ["PSU", ["psu", "power", "nguồn"]],
    ["Case", ["case", "vỏ"]],
    ["Cooling", ["cooling", "cooler", "tản nhiệt"]]
  ];

  return config.map(([label, keys]) => ({
    label,
    value: getAttributeValue(attributes, keys) || (isCompletePc(product) ? "Đang cập nhật theo cấu hình lắp ráp" : "")
  }));
}

function getAudience(product, attributes) {
  const name = getProductName(product).toLowerCase();
  const category = getProductCategory(product).toLowerCase();
  if (category.includes("gpu") || name.includes("rtx") || name.includes("radeon")) {
    return ["Gaming 1080p/1440p", "Streaming", "Render GPU", "AI cơ bản"];
  }
  if (category.includes("cpu") || name.includes("core") || name.includes("ryzen")) {
    return ["Gaming", "Lập trình", "Đa nhiệm", "Render video"];
  }
  if (category.includes("ram")) return ["Đa nhiệm", "Chrome nhiều tab", "Gaming", "Workstation"];
  if (category.includes("ssd")) return ["Tăng tốc Windows", "Game loading nhanh", "Lưu project", "Nâng cấp laptop/PC"];
  if (isCompletePc(product)) return ["Người muốn mua PC hoàn chỉnh", "Gaming", "Làm việc tại nhà", "Sáng tạo nội dung"];
  return ["Build PC mới", "Nâng cấp linh kiện", "Văn phòng", "Gaming phổ thông"];
}

function getHighlights(product, attributes) {
  const brand = getProductBrand(product);
  const category = getProductCategory(product);
  const warranty = getAttributeValue(attributes, ["warranty", "bảo hành"]) || "Bảo hành điện tử theo chính sách PC Mall";
  return [
    `${brand} chính hãng, nguồn gốc rõ ràng`,
    `Tối ưu cho nhóm ${category}`,
    warranty,
    "Được PC Mall kiểm tra trước khi giao",
    "Hỗ trợ tư vấn tương thích với cấu hình hiện có"
  ];
}

function getSpecRows(product, attributes, skus) {
  const rows = (attributes || []).map((attr) => ({
    key: attr.key || attr.name || attr.attribute_name || "Thông số",
    value: attr.value || attr.attribute_value || "Đang cập nhật"
  }));

  const baseRows = [
    { key: "Thương hiệu", value: getProductBrand(product) },
    { key: "Danh mục", value: getProductCategory(product) },
    { key: "SKU chính", value: skus[0]?.sku || product?.sku || "Đang cập nhật" },
    { key: "Tình trạng", value: "Còn hàng" }
  ];

  return [...baseRows, ...rows].filter((row, index, arr) => arr.findIndex((item) => item.key === row.key) === index);
}

function getSimilarPrice(product) {
  return Number(product?.price ?? product?.pricing?.minPrice ?? product?.skus?.[0]?.price ?? product?.defaultVariant?.price ?? 0);
}

const SPEC_ICONS = {
  "thương hiệu": "🏆",
  "brand": "🏆",
  "danh mục": "📂",
  "category": "📂",
  "sku": "🔖",
  "tình trạng": "✅",
  "cpu": "🧠",
  "processor": "🧠",
  "vi xử lý": "🧠",
  "gpu": "🎮",
  "vga": "🎮",
  "graphics": "🎮",
  "card đồ họa": "🎮",
  "ram": "💾",
  "memory": "💾",
  "ssd": "💿",
  "hdd": "💿",
  "storage": "💿",
  "ổ cứng": "💿",
  "psu": "⚡",
  "power": "⚡",
  "nguồn": "⚡",
  "mainboard": "🖼️",
  "motherboard": "🖼️",
  "case": "🖥️",
  "vỏ": "🖥️",
  "cooling": "🌬️",
  "cooler": "🌬️",
  "tản nhiệt": "🌬️",
  "warranty": "🛡️",
  "bảo hành": "🛡️",
  "frequency": "📶",
  "speed": "📶",
  "tốc độ": "📶",
  "socket": "🔌",
  "chipset": "🔌",
  "display": "🖥️",
  "màn hình": "🖥️",
};

function getSpecIcon(key) {
  const lower = String(key).toLowerCase();
  for (const [match, icon] of Object.entries(SPEC_ICONS)) {
    if (lower.includes(match)) return icon;
  }
  return "⚙️";
}

export function ProductDetailPage() {
  const { idOrSlug } = useParams();
  const [product, setProduct] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedSkuId, setSelectedSkuId] = useState("");
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const skus = useMemo(() => {
    const rawSkus = Array.isArray(product?.skus) ? product.skus : [];
    const rawVariants = Array.isArray(product?.variants) ? product.variants : [];
    const normalized = rawSkus.length > 0 ? rawSkus : rawVariants;
    if (normalized.length > 0) {
      return normalized.map((sku) => ({
        ...sku,
        id: getSkuId(sku),
        stock: getSkuStock(sku),
        price: getSkuPrice(sku, product?.price)
      }));
    }
    return [{
      id: product?.id || product?.product_id,
      sku: product?.sku || `${product?.slug || "PC-MALL"}-BASE`,
      stock: Number(product?.stock ?? product?.stock_quantity ?? 0),
      price: Number(product?.price || 0)
    }];
  }, [product]);

  const selectedSku = useMemo(() => {
    return skus.find((sku) => String(sku.id) === String(selectedSkuId)) || skus[0] || null;
  }, [selectedSkuId, skus]);

  const attributes = useMemo(() => (Array.isArray(product?.attributes) ? product.attributes : []), [product]);
  const productId = useMemo(() => getProductId(product), [product]);
  const availableStock = getSkuStock(selectedSku);
  const heroPrice = getSkuPrice(selectedSku, product?.price);
  const productName = getProductName(product);
  const categoryName = getProductCategory(product);
  const brandName = getProductBrand(product);
  const completePc = isCompletePc(product);
  const pcConfig = useMemo(() => buildPcConfig(product || {}, attributes), [attributes, product]);
  const specRows = useMemo(() => getSpecRows(product || {}, attributes, skus), [attributes, product, skus]);
  const audience = useMemo(() => getAudience(product || {}, attributes), [attributes, product]);
  const highlights = useMemo(() => getHighlights(product || {}, attributes), [attributes, product]);

  const displayImage = useMemo(() => {
    if (!product) return resolveProductImage({});
    return resolveProductImage({
      ...product,
      skus,
      category_name: categoryName
    });
  }, [categoryName, product, skus]);

  function saveDirectCheckoutDraft() {
    if (!product || !selectedSku) return;

    const quantityValue = Math.max(1, Math.min(availableStock, Number(quantity || 1)));
    const unitPrice = heroPrice;
    const draft = {
      mode: "direct",
      source: "product_detail",
      createdAt: Date.now(),
      items: [
        {
          id: `direct-${productId}-${selectedSku.id || productId}`,
          productId,
          productVariantId: selectedSku.id || productId,
          quantity: quantityValue,
          unitPrice,
          lineTotal: unitPrice * quantityValue,
          product: {
            id: productId,
            name: productName,
            slug: product?.slug || "",
            category: product?.category || product?.Category || null,
            imageUrl: displayImage
          },
          variant: {
            id: selectedSku.id || productId,
            sku: selectedSku.sku || "",
            price: unitPrice,
            stock: getSkuStock(selectedSku),
            imageUrl: selectedSku.imageUrl || selectedSku.image_url || null
          }
        }
      ],
      totalAmount: unitPrice * quantityValue,
      totalItems: quantityValue
    };

    try {
      sessionStorage.setItem(DIRECT_CHECKOUT_DRAFT_KEY, JSON.stringify(draft));
      localStorage.setItem(DIRECT_CHECKOUT_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore storage quota errors
    }
  }

  useEffect(() => {
    async function loadProductDetail() {
      try {
        setLoading(true);
        setFetchError("");
        const response = await getProductDetail(idOrSlug);
        const data = normalizeProductDetail(response);
        setProduct(data);
      } catch (error) {
        setFetchError(getErrorMessage(error, "Không thể tải chi tiết sản phẩm."));
        setProduct(null);
      } finally {
        setLoading(false);
      }
    }

    if (idOrSlug) loadProductDetail();
  }, [idOrSlug]);

  useEffect(() => {
    if (skus.length > 0 && !selectedSkuId) {
      setSelectedSkuId(String(skus[0].id || ""));
    }
  }, [selectedSkuId, skus]);

  useEffect(() => {
    async function loadSimilarProducts() {
      if (!product?.category_id && !product?.category?.id) return;
      try {
        const response = await getProducts({ category_id: product.category_id || product.category?.id, limit: 8 });
        const list = normalizeProductList(response).filter((item) => String(getProductId(item)) !== String(productId));
        setSimilarProducts(list.slice(0, 4));
      } catch (_error) {
        setSimilarProducts([]);
      }
    }

    loadSimilarProducts();
  }, [product, productId]);

  async function addCurrentToCart({ goCheckout = false } = {}) {
    if (goCheckout) {
      saveDirectCheckoutDraft();
      if (!isAuthenticated) {
        navigate("/login?redirect=/checkout");
        return;
      }
      navigate(routeConfig.public.checkout);
      return;
    }

    try {
      setSubmitting(true);
      setActionError("");
      setSuccessMessage("");
      if (!productId) {
        throw new Error("Không tìm thấy mã sản phẩm để thêm vào giỏ hàng.");
      }

      await addItemToCart({
        productId,
        productVariantId: selectedSku?.id || productId,
        quantity,
        unitPrice: heroPrice,
        product: {
          id: productId,
          name: productName,
          slug: product?.slug || "",
          category: categoryName ? { name: categoryName } : null,
          imageUrl: displayImage
        },
        variant: {
          id: selectedSku?.id || productId,
          sku: selectedSku?.sku || "",
          price: heroPrice,
          stock: availableStock,
          imageUrl: selectedSku?.imageUrl || selectedSku?.image_url || displayImage
        }
      });
      await refreshCart();
      setSuccessMessage("Đã thêm sản phẩm vào giỏ hàng.");
    } catch (error) {
      setActionError(getErrorMessage(error, "Không thể thêm vào giỏ hàng."));
    } finally {
      setSubmitting(false);
    }
  }

  function handleCompareProduct() {
    if (!productId) return;
    const compareIds = addStoredCompareId(productId);
    navigate(buildCompareUrl(compareIds));
  }

  function handlePcBuilder() {
    navigate(routeConfig.public.pcBuilder, {
      state: {
        productId,
        productName,
        skuId: selectedSku?.id
      }
    });
  }

  if (loading) {
    return (
      <div className="product-detail-page">
        <style>{productDetailStyles}</style>
        <section className="product-loading">Đang tải chi tiết sản phẩm...</section>
      </div>
    );
  }

  if (fetchError || !product) {
    return (
      <div className="product-detail-page">
        <style>{productDetailStyles}</style>
        <section className="product-empty">
          <h1>Không tìm thấy sản phẩm</h1>
          <p>{fetchError || "Sản phẩm này có thể đã ngừng kinh doanh hoặc đường dẫn chưa chính xác."}</p>
          <Link to={routeConfig.public.catalog}>Quay lại danh sách</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="product-detail-page">
      <style>{productDetailStyles}</style>

      <nav className="product-breadcrumb">
        <Link to={routeConfig.public.root}>Trang chủ</Link>
        <span>/</span>
        <Link to={routeConfig.public.catalog}>Linh kiện PC</Link>
        <span>/</span>
        <strong>{categoryName}</strong>
      </nav>

      <section className="product-hero">
        {/* ── Image Gallery V2 ── */}
        <div className="product-gallery">
          <div className="product-gallery__image v2-gallery-main">
            <img
              src={displayImage}
              alt={productName}
              className="v2-gallery-img"
              onError={(e) => { e.currentTarget.src = resolveProductImage({}, { label: categoryName }); }}
            />
            {/* Zoom hint */}
            <div className="v2-gallery-zoom-hint">🔍 Hover để phóng to</div>
          </div>

          {/* Thumbnail strip */}
          <div className="v2-gallery-thumbs">
            {[displayImage, displayImage, displayImage].map((src, i) => (
              <div
                key={i}
                className={`v2-gallery-thumb ${i === 0 ? "is-active" : ""}`}
              >
                <img src={src} alt={`${productName} ${i + 1}`} onError={e => { e.target.style.opacity = 0.3; }} />
              </div>
            ))}
          </div>

          <div className="product-badges">
            <span>✅ Còn hàng</span>
            <span>🏆 Chính hãng 100%</span>
            <span>🛡️ Bảo hành điện tử</span>
            <span>🚀 Giao nhanh</span>
          </div>
        </div>

        <div className="product-info">
          <span className="product-eyebrow">{brandName} · {categoryName}</span>
          <h1>{productName}</h1>
          <p>{parseDescription(product?.description)}</p>
          <div className="product-rating">
            <strong>★★★★★</strong>
            <span>4.8/5 · 128 đánh giá · Đã kiểm tra tương thích PC Mall</span>
          </div>

          <div className="product-overview">
            <h2>Tổng quan sản phẩm nổi bật</h2>
            <div>
              {highlights.slice(0, 4).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        </div>

        <aside className="buy-sidebar">
          {/* Price */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <strong className="buy-sidebar__price">{formatCurrency(heroPrice)}đ</strong>
            <span style={{ fontSize: 14, color: "#64748b", textDecoration: "line-through", fontWeight: 600 }}>
              {formatCurrency(Math.round(heroPrice * 1.12))}đ
            </span>
            <span style={{
              padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 800,
              background: "linear-gradient(135deg, #f5a623, #f97316)", color: "#0f172a",
            }}>-12%</span>
          </div>

          <div className="stock-pill" style={{ color: availableStock > 0 ? "#10b981" : "#ef4444" }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: availableStock > 0 ? "#10b981" : "#ef4444",
              display: "inline-block", marginRight: 6,
              boxShadow: availableStock > 0 ? "0 0 6px rgba(16,185,129,0.6)" : "0 0 6px rgba(239,68,68,0.6)"
            }} />
            {availableStock > 0 ? `Còn hàng · ${availableStock} sản phẩm` : "Tạm hết hàng"}
          </div>

          <label className="sku-select">
            <span>Phiên bản / SKU</span>
            <select value={selectedSkuId} onChange={(event) => setSelectedSkuId(event.target.value)}>
              {skus.map((sku) => (
                <option key={sku.id || sku.sku} value={sku.id || ""}>
                  {sku.sku || "SKU mặc định"} · {formatCurrency(sku.price)}đ · Còn {sku.stock}
                </option>
              ))}
            </select>
          </label>

          <div className="quantity-row">
            <span>Số lượng</span>
            <div>
              <button type="button" onClick={() => setQuantity((c) => Math.max(1, c - 1))}>−</button>
              <input value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(availableStock, Number(e.target.value || 1))))} />
              <button type="button" onClick={() => setQuantity((c) => Math.min(availableStock, c + 1))}>+</button>
            </div>
          </div>

          {/* Success animation */}
          {successMessage && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: 12,
              background: "rgba(5,150,105,0.1)",
              border: "1px solid rgba(16,185,129,0.3)",
              color: "#047857", fontSize: 13, fontWeight: 700,
              animation: "v2-fadeIn 0.3s ease both",
            }}>
              <span style={{ fontSize: 18 }}>✅</span>
              <span>Đã thêm vào giỏ!</span>
              <Link to={routeConfig.public.cart} style={{ marginLeft: "auto", color: "#047857", fontWeight: 800, textDecoration: "underline", fontSize: 12 }}>Xem giỏ →</Link>
            </div>
          )}

          {actionError && (
            <div style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#b91c1c", fontSize: 12, fontWeight: 600 }}>
              ⚠️ {actionError}
            </div>
          )}

          {/* Primary CTA */}
          <button
            id="btn-add-to-cart"
            data-testid="add-to-cart-button"
            className="buy-action buy-action--primary"
            type="button"
            disabled={submitting || availableStock <= 0}
            onClick={(e) => {
              e.preventDefault();
              addCurrentToCart();
            }}
            style={{
              background: availableStock <= 0 ? "#94a3b8" : submitting ? "#64748b" : "linear-gradient(135deg, #1d4ed8, #3b82f6)",
              boxShadow: availableStock <= 0 || submitting ? "none" : "0 6px 20px rgba(37,99,235,0.4)",
              transform: "translateY(0)",
              transition: "all 0.22s cubic-bezier(0.34,1.56,0.64,1)",
              cursor: availableStock <= 0 || submitting ? "not-allowed" : "pointer",
              position: "relative",
              zIndex: 10,
            }}
            onMouseEnter={e => { if (!submitting && availableStock > 0) { e.currentTarget.style.transform = "translateY(-2px) scale(1.02)"; e.currentTarget.style.boxShadow = "0 10px 28px rgba(37,99,235,0.5)"; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = submitting || availableStock <= 0 ? "none" : "0 6px 20px rgba(37,99,235,0.4)"; }}
          >
            {availableStock <= 0 ? "🚫 Tạm hết hàng" : submitting ? "⏳ Đang thêm..." : "🛒 Thêm vào giỏ hàng"}
          </button>

          {/* Buy Now CTA */}
          <button
            id="btn-buy-now"
            data-testid="buy-now-button"
            className="buy-action buy-action--buy"
            type="button"
            disabled={submitting || availableStock <= 0}
            onClick={() => addCurrentToCart({ goCheckout: true })}
            style={{
              background: availableStock <= 0 ? "#cbd5e1" : "linear-gradient(135deg, #f97316, #ef4444)",
              boxShadow: availableStock <= 0 ? "none" : "0 6px 18px rgba(249,115,22,0.35)",
              cursor: availableStock <= 0 || submitting ? "not-allowed" : "pointer",
              transition: "all 0.22s cubic-bezier(0.34,1.56,0.64,1)",
              position: "relative",
              zIndex: 10,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 10px 24px rgba(249,115,22,0.5)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 6px 18px rgba(249,115,22,0.35)"; }}
          >
            ⚡ Mua ngay
          </button>

          {/* Secondary actions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button
              className="buy-action"
              type="button"
              onClick={handlePcBuilder}
              style={{
                background: "rgba(37,99,235,0.06)",
                border: "1px solid rgba(37,99,235,0.25)",
                color: "#1d4ed8", fontSize: 12, fontWeight: 700,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(37,99,235,0.12)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(37,99,235,0.06)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              🔧 PC Builder
            </button>
            <button
              className="buy-action"
              type="button"
              onClick={handleCompareProduct}
              style={{
                background: "rgba(100,116,139,0.06)",
                border: "1px solid rgba(100,116,139,0.2)",
                color: "#475569", fontSize: 12, fontWeight: 700,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(100,116,139,0.12)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(100,116,139,0.06)"; }}
            >
              ⚖️ So sánh
            </button>
          </div>

          {/* AI Advisor Box */}
          <div className="ai-support-box">
            <strong>⚡ AI Advisor</strong>
            <p>Không chắc sản phẩm có hợp cấu hình? Hỏi AI kiểm tra tương thích ngay.</p>
            <Link to={routeConfig.public.aiChat}>Hỏi AI ngay →</Link>
          </div>
        </aside>
      </section>

      <section className="detail-layout">
        <div className="detail-main">
          <section className="detail-section">
            <h2>Mô tả chi tiết</h2>
            <p>{parseDescription(product?.description)}</p>
            <p>
              PC Mall khuyến nghị sản phẩm này cho khách hàng cần hiệu năng ổn định, linh kiện chính hãng và chính sách hậu mãi rõ ràng.
              Sản phẩm được kiểm tra tình trạng trước khi giao và có thể kết hợp với AI Advisor hoặc PC Builder để tối ưu toàn bộ cấu hình.
            </p>
          </section>

          <section className="detail-section">
            <h2>Thông số kỹ thuật đầy đủ</h2>
            <div className="spec-table v2-spec-table">
              {specRows.map((row, idx) => (
                <div key={`${row.key}-${row.value}`} className={`v2-spec-row ${idx % 2 === 0 ? "v2-spec-row--even" : ""}`}>
                  <span className="v2-spec-key">
                    <span className="v2-spec-icon">{getSpecIcon(row.key)}</span>
                    {row.key}
                  </span>
                  <strong className="v2-spec-val">{row.value}</strong>
                </div>
              ))}
            </div>
          </section>

          {completePc ? (
            <section className="detail-section">
              <h2>Linh kiện bên trong bộ PC</h2>
              <div className="pc-config-grid">
                {pcConfig.map((item) => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value || "Đang cập nhật"}</strong>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="detail-section">
            <h2>Phù hợp cho ai</h2>
            <div className="audience-grid">
              {audience.map((item) => (
                <div key={item}>{item}</div>
              ))}
            </div>
          </section>

          <section className="detail-section">
            <h2>Ưu điểm nổi bật</h2>
            <div className="highlight-list">
              {highlights.map((item) => (
                <div key={item}>✓ {item}</div>
              ))}
            </div>
          </section>

          <section className="policy-grid">
            <div className="policy-card">
              <h2>Chính sách bảo hành</h2>
              <p>Bảo hành điện tử theo serial/đơn hàng, hỗ trợ tra cứu online và tiếp nhận yêu cầu bảo hành ngay trên PC Mall.</p>
              <Link to={routeConfig.public.warranties}>Tra cứu bảo hành</Link>
            </div>
            <div className="policy-card">
              <h2>Chính sách giao hàng</h2>
              <p>Giao nhanh nội thành, đóng gói chống sốc, cập nhật trạng thái đơn hàng và mã vận đơn trong tài khoản khách hàng.</p>
              <Link to={routeConfig.public.orders}>Theo dõi đơn hàng</Link>
            </div>
          </section>

          <ProductReviewsSection productId={productId} idOrSlug={idOrSlug} />

          <section className="detail-section">
            <h2>Sản phẩm tương tự</h2>
            <div className="similar-grid">
              {similarProducts.length > 0 ? similarProducts.map((item) => (
                <Link key={getProductId(item)} to={routeConfig.public.productDetail.replace(":idOrSlug", String(item.slug || getProductId(item)))}>
                  <img
                    src={resolveProductImage(item)}
                    alt={getProductName(item)}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.src = resolveProductImage({ category_name: getProductCategory(item) || "COOLING" });
                    }}
                  />
                  <strong>{getProductName(item)}</strong>
                  <span>{formatCurrency(getSimilarPrice(item))}đ</span>
                </Link>
              )) : (
                <p className="muted-text">Chưa có sản phẩm tương tự trong danh mục này.</p>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

const productDetailStyles = `
.product-detail-page {
  display: grid;
  gap: 22px;
  padding: 28px 0 100px; /* Safe bottom clearance against floating widgets */
}

.product-loading,
.product-empty,
.detail-section,
.policy-card,
.buy-sidebar {
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
}

.product-loading,
.product-empty {
  padding: 40px;
  text-align: center;
}

.product-empty a,
.product-alert a,
.policy-card a,
.ai-support-box a {
  color: #2563eb;
  font-weight: 900;
  text-decoration: none;
}

.product-alert {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: center;
  padding: 14px 16px;
  border-radius: 16px;
  font-weight: 800;
}

.product-alert--danger {
  color: #b91c1c;
  border: 1px solid #fecaca;
  background: #fef2f2;
}

.product-alert--success {
  color: #047857;
  border: 1px solid #86efac;
  background: #ecfdf5;
}

.product-breadcrumb {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  color: #64748b;
  font-size: 14px;
}

.product-breadcrumb a {
  color: #2563eb;
  font-weight: 800;
  text-decoration: none;
}

.product-hero {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr) 380px;
  gap: 22px;
  align-items: start;
}

.product-gallery,
.product-info {
  display: grid;
  gap: 18px;
}

.product-gallery__image {
  display: grid;
  place-items: center;
  min-height: 520px;
  border: 1px solid #e2e8f0;
  border-radius: 28px;
  background: radial-gradient(circle at center, #fff, #eef6ff);
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
}

.product-gallery__image img {
  width: 100%;
  max-height: 460px;
  object-fit: contain;
  padding: 24px;
  filter: drop-shadow(0 20px 38px rgba(15, 23, 42, 0.14));
}

.product-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.product-badges span,
.stock-pill {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 11px;
  border-radius: 999px;
  color: #047857;
  background: #ecfdf5;
  font-size: 12px;
  font-weight: 900;
}

.product-info {
  padding: 6px 0;
}

.product-eyebrow {
  color: #2563eb;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.product-info h1 {
  margin: 0;
  color: #0f172a;
  font-size: clamp(34px, 4vw, 54px);
  line-height: 1.05;
}

.product-info p {
  margin: 0;
  color: #475569;
  line-height: 1.75;
  font-size: 16px;
}

.product-rating {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.product-rating strong {
  color: #f59e0b;
  letter-spacing: 2px;
}

.product-rating span {
  color: #64748b;
  font-weight: 700;
}

.product-overview {
  padding: 20px;
  border: 1px solid #dbeafe;
  border-radius: 22px;
  background: #eff6ff;
}

.product-overview h2,
.detail-section h2,
.policy-card h2 {
  margin: 0 0 14px;
  color: #0f172a;
}

.product-overview div,
.highlight-list {
  display: grid;
  gap: 10px;
}

.product-overview span,
.highlight-list div {
  color: #1e3a8a;
  font-weight: 800;
}

.buy-sidebar {
  position: sticky;
  top: 108px;
  display: grid;
  gap: 14px;
  padding: 22px;
  z-index: 50;
  max-height: calc(100vh - 124px);
  overflow-y: auto;
  scrollbar-width: thin;
}

.buy-sidebar__label,
.sku-select span,
.quantity-row > span {
  color: #64748b;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

.buy-sidebar__price {
  color: #2563eb;
  font-size: 38px;
  line-height: 1;
}

.sku-select {
  display: grid;
  gap: 8px;
}

.sku-select select,
.quantity-row input {
  width: 100%;
  min-height: 44px;
  border: 1px solid #dbe4f0;
  border-radius: 14px;
  background: #f8fafc;
  color: #0f172a;
  font: inherit;
}

.sku-select select {
  padding: 0 12px;
}

.quantity-row {
  display: grid;
  gap: 8px;
}

.quantity-row div {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  gap: 8px;
}

.quantity-row button {
  border: 1px solid #dbe4f0;
  border-radius: 12px;
  background: #fff;
  color: #0f172a;
  font-size: 20px;
  font-weight: 900;
  cursor: pointer;
}

.quantity-row input {
  text-align: center;
  font-weight: 900;
}

.buy-action {
  min-height: 48px;
  border: 1px solid #dbe4f0;
  border-radius: 14px;
  color: #0f172a;
  background: #fff;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.buy-action:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.1);
}

.buy-action--primary,
.buy-action--buy {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(135deg, #0f172a, #2563eb);
}

.buy-action--buy {
  background: linear-gradient(135deg, #f97316, #ef4444);
}

.buy-action:disabled {
  cursor: not-allowed;
  opacity: 0.7;
  transform: none;
}

.ai-support-box {
  display: grid;
  gap: 8px;
  padding: 16px;
  border-radius: 18px;
  background: #eff6ff;
}

.ai-support-box p {
  margin: 0;
  color: #475569;
  line-height: 1.6;
}

.detail-layout {
  display: grid;
}

.detail-main {
  display: grid;
  gap: 18px;
}

.detail-section,
.policy-card {
  padding: 24px;
}

.detail-section p,
.policy-card p,
.muted-text {
  color: #475569;
  line-height: 1.75;
}

.spec-table {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.spec-table div,
.pc-config-grid div,
.audience-grid div,
.review-grid div,
.similar-grid a {
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #f8fafc;
}

.spec-table div,
.pc-config-grid div {
  display: grid;
  gap: 5px;
  padding: 14px;
}

.spec-table span,
.pc-config-grid span {
  color: #64748b;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

.spec-table strong,
.pc-config-grid strong {
  color: #0f172a;
}

.pc-config-grid,
.audience-grid,
.review-grid,
.similar-grid,
.policy-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.audience-grid div {
  padding: 16px;
  color: #1d4ed8;
  background: #eff6ff;
  font-weight: 900;
}

.policy-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.review-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.review-grid div {
  padding: 16px;
}

.review-grid strong,
.review-grid span {
  display: block;
}

.review-grid span {
  margin: 6px 0;
  color: #f59e0b;
}

.review-grid p {
  margin: 0;
}

.similar-grid a {
  display: grid;
  gap: 10px;
  padding: 14px;
  color: inherit;
  text-decoration: none;
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.similar-grid a:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 28px rgba(37, 99, 235, 0.12);
}

.similar-grid img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: contain;
}

.similar-grid strong {
  color: #0f172a;
}

.similar-grid span {
  color: #2563eb;
  font-weight: 900;
}

/* ── GALLERY V2 ── */
.v2-gallery-main {
  position: relative;
  overflow: hidden;
  cursor: zoom-in;
}

.v2-gallery-main:hover .v2-gallery-img {
  transform: scale(1.06) !important;
}

.v2-gallery-img {
  width: 100%;
  max-height: 460px;
  object-fit: contain;
  padding: 24px;
  filter: drop-shadow(0 20px 38px rgba(15, 23, 42, 0.14));
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.v2-gallery-zoom-hint {
  position: absolute;
  bottom: 12px;
  right: 12px;
  padding: 4px 10px;
  background: rgba(10, 14, 28, 0.75);
  backdrop-filter: blur(8px);
  color: #cbd5e1;
  font-size: 11px;
  font-weight: 600;
  border-radius: 99px;
  border: 1px solid rgba(255,255,255,0.1);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.v2-gallery-main:hover .v2-gallery-zoom-hint {
  opacity: 1;
}

.v2-gallery-thumbs {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.v2-gallery-thumb {
  width: 72px;
  height: 72px;
  border-radius: 12px;
  border: 2px solid transparent;
  background: #f8fafc;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1);
  flex-shrink: 0;
}

.v2-gallery-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 6px;
}

.v2-gallery-thumb.is-active {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.15), 0 4px 10px rgba(37,99,235,0.2);
}

.v2-gallery-thumb:hover {
  transform: translateY(-2px);
  border-color: rgba(59,130,246,0.4);
}

/* ── SPEC TABLE V2 ── */
.v2-spec-table {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.v2-spec-row {
  display: grid;
  grid-template-columns: 200px 1fr;
  align-items: center;
  min-height: 44px;
  border-bottom: 1px solid rgba(226,232,240,0.6);
  transition: background 0.15s ease;
}

.v2-spec-row:last-child { border-bottom: none; }

.v2-spec-row--even {
  background: rgba(241,245,249,0.6);
}

.v2-spec-row:hover {
  background: rgba(37,99,235,0.04);
}

.v2-spec-key {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-right: 1px solid rgba(226,232,240,0.6);
}

.v2-spec-icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.v2-spec-val {
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.45;
}

/* ── BUY SIDEBAR V2 ── */
.buy-sidebar {
  position: sticky;
  top: 108px;
  display: grid;
  gap: 12px;
  padding: 22px;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
}

.buy-sidebar__price {
  background: linear-gradient(135deg, #1d4ed8, #3b82f6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 38px;
  line-height: 1;
  font-family: 'Be Vietnam Pro', sans-serif;
  letter-spacing: -0.04em;
}

.stock-pill {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  color: #047857;
  background: rgba(5,150,105,0.1);
  font-size: 12px;
  font-weight: 700;
  border: 1px solid rgba(16,185,129,0.25);
  width: fit-content;
}

@media (max-width: 1240px) {
  .product-hero { grid-template-columns: minmax(0, 1fr) 360px; }
  .product-info { grid-column: 1 / -1; order: -1; }
}

@media (max-width: 900px) {
  .product-hero, .spec-table, .policy-grid, .review-grid { grid-template-columns: 1fr; }
  .buy-sidebar { position: static; }
  .pc-config-grid, .audience-grid, .similar-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .v2-spec-row { grid-template-columns: 1fr; }
  .v2-spec-key { border-right: none; border-bottom: 1px solid rgba(226,232,240,0.4); }
}

@media (max-width: 560px) {
  .product-detail-page { padding-top: 18px; }
  .product-gallery__image { min-height: 300px; }
  .pc-config-grid, .audience-grid, .similar-grid { grid-template-columns: 1fr; }
  .buy-sidebar__price { font-size: 30px; }
  .v2-gallery-thumbs { display: none; }
}

/* Product Reviews Section Styles (AUD-010) */
.product-reviews-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 32px;
}

.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 16px;
}

.section-header-row h2 {
  font-size: 22px;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}

.section-subtext {
  font-size: 14px;
  color: #64748b;
  margin: 4px 0 0;
}

.verified-shield-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  color: #fff;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
}

.reviews-summary-card {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 32px;
  background: #f8fafc;
  border-radius: 18px;
  padding: 24px 32px;
  border: 1px solid #e2e8f0;
  align-items: center;
}

.score-column {
  text-align: center;
  border-right: 1px solid #e2e8f0;
  padding-right: 24px;
}

.big-rating-number {
  font-size: 54px;
  font-weight: 900;
  color: #0f172a;
  line-height: 1;
}

.stars-row {
  font-size: 22px;
  color: #f59e0b;
  margin: 8px 0;
  letter-spacing: 2px;
}

.rating-total-text {
  font-size: 13px;
  color: #64748b;
  font-weight: 600;
}

.distribution-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rating-bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.star-label {
  width: 52px;
  font-weight: 600;
  color: #334155;
  text-align: right;
}

.progress-track {
  flex: 1;
  height: 8px;
  background: #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #f59e0b, #10b981);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.count-label {
  width: 70px;
  color: #64748b;
  font-size: 12px;
}

.review-action-container {
  margin: 8px 0;
}

.auth-required-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 24px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 16px;
}

.box-icon {
  font-size: 28px;
}

.box-content strong {
  display: block;
  color: #1e3a8a;
  font-size: 15px;
}

.box-content p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #3b82f6;
}

.btn-review-login {
  padding: 10px 20px;
  background: #2563eb;
  color: #fff !important;
  font-weight: 700;
  border-radius: 12px;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.2s ease;
}

.btn-review-login:hover {
  background: #1d4ed8;
}

.buyer-restricted-box {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 18px 22px;
  background: #fffbeb;
  border: 1px solid #fef3c7;
  border-radius: 16px;
}

.restricted-icon {
  font-size: 28px;
}

.restricted-text strong {
  display: block;
  color: #92400e;
  font-size: 14px;
  margin-bottom: 4px;
}

.restricted-text p {
  margin: 0;
  font-size: 13px;
  color: #b45309;
  line-height: 1.5;
}

.verified-review-form-card {
  padding: 24px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 18px;
}

.buyer-verified-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #dcfce7;
  color: #15803d;
  font-size: 12px;
  font-weight: 700;
  border-radius: 8px;
  margin-bottom: 8px;
}

.chip-check {
  font-weight: 900;
}

.verified-review-form-card h3 {
  font-size: 18px;
  color: #0f172a;
  margin: 0 0 16px;
}

.review-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.star-picker-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.star-picker-row label {
  font-weight: 700;
  font-size: 14px;
  color: #334155;
}

.interactive-stars {
  display: flex;
  gap: 4px;
}

.star-btn {
  background: transparent;
  border: none;
  font-size: 28px;
  color: #cbd5e1;
  cursor: pointer;
  transition: transform 0.15s ease, color 0.15s ease;
  padding: 0;
}

.star-btn:hover {
  transform: scale(1.25);
}

.star-btn.active {
  color: #f59e0b;
}

.star-feedback-label {
  font-size: 13px;
  font-weight: 700;
  color: #d97706;
}

.review-form .form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.review-form .form-group label {
  font-weight: 700;
  font-size: 14px;
  color: #334155;
}

.review-form textarea {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  font-family: inherit;
  font-size: 14px;
  resize: vertical;
  background: #fff;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.review-form textarea:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}

.char-count {
  font-size: 12px;
  color: #64748b;
  text-align: right;
}

.btn-submit-review {
  align-self: flex-start;
  padding: 12px 28px;
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  color: #fff;
  font-weight: 800;
  font-size: 14px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.btn-submit-review:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(16, 185, 129, 0.45);
}

.btn-submit-review:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.review-alert {
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}

.review-alert--success {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #86efac;
}

.review-alert--error {
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fca5a5;
}

.reviews-items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.review-item-card {
  padding: 20px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.review-item-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.review-item-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.author-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2563eb, #6366f1);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 15px;
  flex-shrink: 0;
}

.author-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.author-name {
  font-size: 14px;
  color: #0f172a;
}

.verified-buyer-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #059669;
  font-weight: 700;
}

.review-date {
  font-size: 12px;
  color: #94a3b8;
}

.review-stars {
  font-size: 16px;
  color: #f59e0b;
  letter-spacing: 1px;
}

.review-comment-body {
  font-size: 14px;
  color: #334155;
  line-height: 1.6;
  margin: 0;
}

.reviews-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
}

.reviews-pagination .page-btn {
  padding: 8px 16px;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reviews-pagination .page-btn:hover:not(:disabled) {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.reviews-pagination .page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reviews-pagination .page-indicator {
  font-size: 13px;
  color: #64748b;
  font-weight: 600;
}

@media (max-width: 768px) {
  .reviews-summary-card {
    grid-template-columns: 1fr;
    gap: 20px;
    padding: 20px;
  }
  .score-column {
    border-right: none;
    border-bottom: 1px solid #e2e8f0;
    padding-right: 0;
    padding-bottom: 16px;
  }
  .auth-required-box {
    flex-direction: column;
    align-items: flex-start;
  }
}
`;


