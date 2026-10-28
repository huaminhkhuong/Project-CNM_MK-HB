import React, { useState, useEffect } from "react";
import { resolveProductImage } from "../../utils/productImage";
import { SPEC_ALIASES } from "./pcBuilderConstants";
import {
  formatCurrency,
  getProductId,
  getProductName,
  getProductBrand,
  getProductPrice,
  getProductStock,
  getRating,
  findSpec,
  estimateProductPerformance,
  getCoolingBadge,
  getStockState
} from "./pcBuilderUtils";
import { getCoolingCardStatus } from "./builderInsightsCalculator";

/* ── SKELETON CARD ────────────────────────────────────────────── */
export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-media" />
      <div className="skeleton-body">
        <div className="skeleton-line skeleton-line--short" />
        <div className="skeleton-line skeleton-line--full" />
        <div className="skeleton-line skeleton-line--medium" />
      </div>
    </div>
  );
}

/* ── SMART TECHNICAL SPECIFICATION EXTRACTOR ─────────────────── */
export function extractProductSpecs(product, type) {
  const name = getProductName(product);
  const nameLower = name.toLowerCase();

  if (type === "cpu") {
    let socket = findSpec(product, SPEC_ALIASES.socket);
    if (!socket) {
      if (nameLower.includes("lga1700") || /\bi[3579]-1[234]\d{3}/.test(nameLower)) socket = "LGA1700";
      else if (nameLower.includes("am5") || /ryzen\s*[79]?\s*7\d{3}/.test(nameLower)) socket = "AM5";
      else if (nameLower.includes("am4") || /ryzen\s*[3579]?\s*[35]\d{3}/.test(nameLower)) socket = "AM4";
      else socket = "AM5 / LGA1700";
    }
    let tdp = findSpec(product, SPEC_ALIASES.tdp);
    if (!tdp) {
      const match = nameLower.match(/(\d{2,3})\s*w/);
      tdp = match ? `${match[1]}W` : "65W - 125W";
    }
    return [
      { label: "Socket", value: socket },
      { label: "TDP", value: tdp }
    ];
  }

  if (type === "mainboard") {
    let socket = findSpec(product, SPEC_ALIASES.socket);
    if (!socket) {
      if (nameLower.includes("b650") || nameLower.includes("x670") || nameLower.includes("a620")) socket = "AM5";
      else if (nameLower.includes("b760") || nameLower.includes("z790") || nameLower.includes("b660") || nameLower.includes("z690")) socket = "LGA1700";
      else if (nameLower.includes("b550") || nameLower.includes("a520") || nameLower.includes("x570")) socket = "AM4";
      else socket = "ATX / Micro-ATX";
    }
    let ram = findSpec(product, SPEC_ALIASES.ramType);
    if (!ram) {
      if (nameLower.includes("ddr5")) ram = "DDR5 Dual Channel";
      else if (nameLower.includes("ddr4")) ram = "DDR4 Dual Channel";
      else ram = "DDR4 / DDR5";
    }
    return [
      { label: "Socket", value: socket },
      { label: "Hỗ trợ RAM", value: ram }
    ];
  }

  if (type === "ram") {
    let ramType = findSpec(product, SPEC_ALIASES.ramType);
    if (!ramType) {
      if (nameLower.includes("ddr5")) ramType = "DDR5";
      else if (nameLower.includes("ddr4")) ramType = "DDR4";
      else ramType = "DDR4 / DDR5";
    }
    let speed = "";
    const speedMatch = nameLower.match(/(\d{4})\s*mhz/);
    if (speedMatch) speed = `${speedMatch[1]}MHz`;

    return [
      { label: "Chuẩn RAM", value: `${ramType} ${speed}`.trim() },
      { label: "Loại bộ nhớ", value: "Desktop DIMM" }
    ];
  }

  if (type === "gpu") {
    let vram = "";
    const vramMatch = nameLower.match(/(\d{1,2}\s*gb)/);
    if (vramMatch) vram = vramMatch[1].toUpperCase();

    let length = findSpec(product, SPEC_ALIASES.gpuLength);
    if (!length) length = "VGA Tiêu chuẩn";

    return [
      { label: "VRAM", value: vram || "GDDR6" },
      { label: "Chiều dài GPU", value: length }
    ];
  }

  if (type === "storage") {
    let capacity = "";
    const capMatch = nameLower.match(/(\d{3,4}\s*gb|\d\s*tb)/);
    if (capMatch) capacity = capMatch[1].toUpperCase();

    let interfaceType = "PCIe NVMe SSD";
    if (nameLower.includes("sata")) interfaceType = "SATA III 2.5\"";

    return [
      { label: "Dung lượng", value: capacity || "SSD Tốc độ cao" },
      { label: "Giao tiếp", value: interfaceType }
    ];
  }

  if (type === "psu") {
    let watt = findSpec(product, SPEC_ALIASES.psuWattage);
    if (!watt) {
      const wattMatch = nameLower.match(/(\d{3,4})\s*w/);
      watt = wattMatch ? `${wattMatch[1]}W` : "Công suất thực";
    }
    let cert = "80 Plus Certified";
    if (nameLower.includes("gold")) cert = "80 Plus Gold";
    else if (nameLower.includes("bronze")) cert = "80 Plus Bronze";
    else if (nameLower.includes("platinum")) cert = "80 Plus Platinum";

    return [
      { label: "Công suất", value: typeof watt === "number" ? `${watt}W` : watt },
      { label: "Chứng nhận", value: cert }
    ];
  }

  if (type === "case") {
    let formFactor = "Mid Tower ATX";
    if (nameLower.includes("mini") || nameLower.includes("itx")) formFactor = "Mini-ITX / Micro-ATX";
    else if (nameLower.includes("full")) formFactor = "Full Tower ATX";

    let clearance = findSpec(product, SPEC_ALIASES.caseGpuClearance);
    if (!clearance) clearance = "Hỗ trợ VGA dài";

    return [
      { label: "Form Factor", value: formFactor },
      { label: "Không gian GPU", value: clearance }
    ];
  }

  if (type === "cooling") {
    let coolingType = findSpec(product, SPEC_ALIASES.coolingType);
    if (!coolingType) {
      const radMatch = nameLower.match(/(240|360|120|280)/);
      if (radMatch || nameLower.includes("aio") || nameLower.includes("nước")) coolingType = `AIO ${radMatch ? radMatch[1] : "Liquid"}`;
      else coolingType = "Tản nhiệt khí";
    }
    let sockets = findSpec(product, SPEC_ALIASES.socketSupport) || "Intel & AMD Socket";

    return [
      { label: "Loại tản", value: coolingType },
      { label: "Socket hỗ trợ", value: sockets }
    ];
  }

  return [
    { label: "Thương hiệu", value: getProductBrand(product) },
    { label: "Bảo hành", value: "36 Tháng" }
  ];
}

export function getComponentEmoji(componentType) {
  const map = {
    cpu: "💻",
    gpu: "🎮",
    ram: "⚡",
    storage: "💾",
    mainboard: "🧩",
    psu: "🔌",
    case: "🖥️",
    cooling: "❄️"
  };
  return map[componentType] || "📦";
}

/* ── PRODUCT IMAGE CONTAINER WITH AUTOMATIC CATEGORY FALLBACK ──── */
export function ProductImageContainer({ product, activeComponent, isSelected }) {
  const [imageSrc, setImageSrc] = useState(() => resolveProductImage(product));
  const [imgError, setImgError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const stock = getProductStock(product);
  const stockState = getStockState(stock);

  useEffect(() => {
    setImageSrc(resolveProductImage(product));
    setImgError(false);
    setLoaded(false);
  }, [product]);

  function handleImageError() {
    const categoryFallback = resolveProductImage({ category_name: activeComponent, product_name: getProductName(product) });
    if (categoryFallback && categoryFallback !== imageSrc) {
      setImageSrc(categoryFallback);
    } else {
      setImgError(true);
    }
  }

  return (
    <div className="product-card__image-container">
      {/* Skeleton Loading State (P9-07) */}
      {!loaded && !imgError && imageSrc && (
        <div className="product-card__skeleton" aria-hidden="true" />
      )}

      {!imgError && imageSrc ? (
        <img
          className={`product-card__img ${loaded ? "is-loaded" : "is-loading"}`}
          src={imageSrc}
          alt={getProductName(product)}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={handleImageError}
        />
      ) : (
        <div className="product-card__no-image">
          <span className="no-image-icon">📦</span>
          <span className="no-image-text">{getProductName(product).slice(0, 20)}</span>
        </div>
      )}

      {/* Quick view overlay badge */}
      <span className="product-card__quick-hint">🔍 Xem chi tiết</span>

      {/* Badges Overlaid */}
      <span className={`product-card__stock-badge ${stockState.cls}`}>{stockState.label}</span>
      {isSelected && <span className="product-card__selected-mark">✓ Đã chọn</span>}
      {activeComponent === "cooling" && (
        <span className="product-card__type-badge">{getCoolingBadge(product)}</span>
      )}
    </div>
  );
}

export function getAiScoreBadge(perf) {
  if (perf >= 80) return { label: `AI ${perf}/100 • Rất Tốt`, cls: "ai-badge--excellent" };
  if (perf >= 60) return { label: `AI ${perf}/100 • Khá Tốt`, cls: "ai-badge--good" };
  if (perf >= 40) return { label: `AI ${perf}/100 • Trung Bình`, cls: "ai-badge--fair" };
  return { label: `AI ${perf}/100 • Cần Cân Nhắc`, cls: "ai-badge--poor" };
}

/* ── "WHY THIS COMPONENT?" EXPLANATION GENERATOR ────────────────── */
export function getWhyThisComponentExplanation(product, activeComponent, selectedItems, totalPrice, suggestionForm) {
  const price = getProductPrice(product);
  const budget = Number(suggestionForm?.budget || 25000000);
  const priceRatio = budget > 0 ? Math.round((price / budget) * 100) : 0;
  
  const reasons = [];

  // 1. Budget Ratio Reason
  if (priceRatio > 0) {
    reasons.push(`Giá chiếm ${priceRatio}% ngân sách`);
  }

  // 2. Spec & Compatibility Reason
  const specs = extractProductSpecs(product, activeComponent);
  const findSpecVal = (labelKey) => {
    const s = specs.find((item) => item.label.toLowerCase().includes(labelKey.toLowerCase()));
    return s ? s.value : null;
  };

  const nameLower = getProductName(product).toLowerCase();

  if (activeComponent === "cpu") {
    const socket = findSpecVal("socket") || findSpec(product, "socket");
    if (socket) reasons.push(`Tương thích socket ${socket}`);
    else reasons.push("Hiệu năng đa nhiệm & Gaming tối ưu");
  } else if (activeComponent === "mainboard") {
    const socket = findSpecVal("socket") || findSpec(product, "socket");
    const ramType = findSpecVal("ram") || findSpec(product, "ram_type");
    if (socket && ramType) reasons.push(`Khớp socket ${socket} & RAM ${ramType}`);
    else if (socket) reasons.push(`Khớp socket ${socket}`);
  } else if (activeComponent === "ram") {
    const cap = findSpecVal("dung lượng") || findSpecVal("ram") || findSpec(product, "capacity");
    if (cap) reasons.push(`Dung lượng ${cap} mượt mà`);
    else reasons.push("Tốc độ Bus cao, giảm giật lag");
  } else if (activeComponent === "gpu") {
    if (nameLower.includes("4090") || nameLower.includes("4080") || nameLower.includes("7900")) {
      reasons.push("Xử lý 4K Gaming / 3D Render cao cấp");
    } else if (nameLower.includes("4070") || nameLower.includes("7800")) {
      reasons.push("Chiến mượt mà game 2K Ultra / 1440p");
    } else {
      reasons.push("Đáp ứng tốt Gaming 1080p eSports & AAA");
    }
  } else if (activeComponent === "cooling") {
    const coolingType = findSpecVal("loại tản") || findSpecVal("tản");
    if (coolingType) reasons.push(`Giải nhiệt CPU tốt (${coolingType})`);
    else reasons.push("Giữ CPU mát mẻ dưới 75°C khi tải nặng");
  } else if (activeComponent === "psu") {
    const watt = findSpecVal("công suất") || findSpec(product, "psu_wattage");
    if (watt) reasons.push(`Công suất ${watt}W có margin an toàn >20%`);
    else reasons.push("Cung cấp dòng điện ổn định 80 Plus");
  } else if (activeComponent === "case") {
    const form = findSpecVal("kích thước") || findSpec(product, "form_factor");
    if (form) reasons.push(`Thiết kế ${form} thông thoáng, vừa GPU & AIO`);
    else reasons.push("Luồng khí tản nhiệt tốt, dễ đi dây");
  } else if (activeComponent === "storage") {
    reasons.push("Tốc độ đọc/ghi NVMe cao, load game cực nhanh");
  }

  // 3. Purpose Match Reason
  const purpose = suggestionForm?.purpose;
  if (purpose === "gaming") reasons.push("Tối ưu Gaming FPS");
  else if (purpose === "editing") reasons.push("Tối ưu Đồ họa & Video");
  else if (purpose === "office") reasons.push("Tiết kiệm điện & bền bỉ");

  return reasons.join(" • ");
}

/* ── PRODUCT CARD COMPONENT ──────────────────────────────────── */
export function BuilderProductCard({
  activeComponent,
  isSelected,
  processingComponent,
  loading,
  onSelect,
  onOpenDetail,
  product,
  selectedItems,
  suggestionForm,
  totalPrice,
  isCompared,
  onToggleCompare
}) {
  const productId     = getProductId(product);
  const perf          = estimateProductPerformance(product, activeComponent);
  const stock         = getProductStock(product);
  const coolingStatus = activeComponent === "cooling" ? getCoolingCardStatus(product, selectedItems) : null;
  const isProcessing  = processingComponent === activeComponent;
  const specs         = extractProductSpecs(product, activeComponent);
  const aiBadge       = getAiScoreBadge(perf);
  const whyText       = getWhyThisComponentExplanation(product, activeComponent, selectedItems, totalPrice, suggestionForm);

  return (
    <article className={`product-card${isSelected ? " is-selected" : ""}`} onClick={() => onOpenDetail(product)}>
      <ProductImageContainer product={product} activeComponent={activeComponent} isSelected={isSelected} />

      <div className="product-card__body">
        <div className="product-card__brand">{getProductBrand(product)}</div>

        <h3 className="product-card__name" title={getProductName(product)}>
          {getProductName(product)}
        </h3>

        <div className="product-card__meta">
          <span className="meta-rating">
            <span className="meta-rating__star">★</span>
            <span className="meta-rating__val">{getRating(product)}</span>
          </span>
          {activeComponent === "cooling" && coolingStatus ? (
            <span className={`meta-ai-badge ${coolingStatus.cls}`}>{coolingStatus.label}</span>
          ) : (
            <span className={`meta-ai-badge ${aiBadge.cls}`}>{aiBadge.label}</span>
          )}
        </div>

        <div className="product-card__specs">
          {specs.map((s, idx) => (
            <div key={idx} className="spec-row">
              <span className="spec-row__label">{s.label}</span>
              <span className="spec-row__value" title={s.value}>{s.value}</span>
            </div>
          ))}
          <div className="spec-row">
            <span className="spec-row__label">Tồn kho</span>
            <span className="spec-row__value spec-row__value--stock">
              Còn {stock} sp
            </span>
          </div>
        </div>

        {/* WHY THIS COMPONENT EXPLANATION BOX */}
        {whyText && (
          <div
            className={`product-card__why-box${isSelected ? " is-selected" : ""}`}
            style={{
              marginTop: "10px",
              marginBottom: "8px",
              padding: "8px 10px",
              backgroundColor: isSelected ? "#eff6ff" : "#f8fafc",
              border: `1px solid ${isSelected ? "#bfdbfe" : "#e2e8f0"}`,
              borderRadius: "8px",
              fontSize: "12px",
              lineHeight: "1.4",
              color: isSelected ? "#1e40af" : "#475569"
            }}
          >
            <div style={{ fontWeight: "700", fontSize: "11px", color: isSelected ? "#1d4ed8" : "#0369a1", marginBottom: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
              <span>💡</span>
              <span>Lý do chọn ({activeComponent.toUpperCase()}):</span>
            </div>
            <div style={{ fontSize: "11.5px", fontWeight: isSelected ? "600" : "400" }}>
              {whyText}
            </div>
          </div>
        )}

        <div className="product-card__footer">
          <div className="product-card__price-box">
            <span className="product-card__price">{formatCurrency(getProductPrice(product))}</span>
            <span className="product-card__price-unit">đ</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "11.5px",
                fontWeight: "700",
                color: isCompared ? "#2563eb" : "#64748b",
                cursor: "pointer"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={Boolean(isCompared)}
                onChange={(e) => onToggleCompare(product, e.target.checked)}
                style={{ width: "14px", height: "14px", cursor: "pointer" }}
              />
              So sánh
            </label>

            <button
              type="button"
              className={`btn-select${isSelected ? " is-selected" : ""}`}
              disabled={isProcessing || loading}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(activeComponent, product);
              }}
            >
              {isProcessing ? "Đang chọn..." : isSelected ? "✓ Đã chọn" : "Chọn"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
export default BuilderProductCard;
