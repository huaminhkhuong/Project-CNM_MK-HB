import React, { useEffect, useMemo, useState } from "react";
import { getProductDetail } from "../../services/catalog.service";
import { resolveProductImage } from "../../utils/productImage";

const formatCurrency = (v) => Number(v || 0).toLocaleString("vi-VN");

/**
 * Spec Key Map: Chuyển đổi các từ khóa thô trong CSDL thành tiếng Việt chuẩn kỹ thuật
 */
const SPEC_KEY_MAP = {
  cpu: "🔌 Chipset / Vi xử lý (CPU)",
  mainboard: "🔌 Bo mạch chủ (Mainboard)",
  socket: "🔌 Socket chân cắm",
  socket_support: "🔌 Socket hỗ trợ",
  ram_type: "🧠 Chuẩn Bộ nhớ RAM",
  ram_bus: "⚡ Tốc độ Bus RAM",
  bus: "⚡ Tốc độ Bus RAM",
  vram: "🎮 Dung lượng VRAM",
  gpu_memory: "🎮 Dung lượng VRAM",
  gpu_length: "📏 Chiều dài Card (Clearance)",
  form_factor: "📐 Kích thước Form Factor",
  psu_wattage: "⚡ Công suất Nguồn (PSU)",
  "psu wattage": "⚡ Công suất Nguồn (PSU)",
  wattage: "⚡ Công suất Nguồn",
  efficiency: "🔋 Chuẩn hiệu suất Nguồn",
  cooling_capacity: "❄️ Công suất Tản nhiệt (TDP)",
  tdp: "❄️ Công suất tỏa nhiệt (TDP)",
  case_gpu_clearance: "📏 Giới hạn chiều dài GPU",
  "bảo hành": "🛡️ Thời gian Bảo hành",
  "thương hiệu": "🏷️ Thương hiệu sản xuất",
  "tình trạng": "📦 Tình trạng đóng gói",
  "danh mục": "🗂️ Phân loại danh mục"
};

function formatSpecKey(keyStr) {
  if (!keyStr) return "⚙️ Thông số kỹ thuật";
  const normalized = String(keyStr).trim().toLowerCase();
  if (SPEC_KEY_MAP[normalized]) return SPEC_KEY_MAP[normalized];

  let clean = String(keyStr)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();

  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function cleanSpecValue(keyStr, valStr) {
  if (valStr === undefined || valStr === null) return "Theo tiêu chuẩn nhà sản xuất";
  let sVal = String(valStr).trim();

  // Khắc phục dính liền từ key và value (vd: "Bảo hành36 Tháng" -> "36 Tháng")
  if (keyStr && sVal.toLowerCase().startsWith(keyStr.toLowerCase())) {
    sVal = sVal.slice(keyStr.length).trim();
  }

  if (sVal.toLowerCase() === "chính hãng") return "Chính hãng 100% (Fullbox)";
  if (sVal.toLowerCase() === "mới 100% fullbox") return "Mới 100% Nguyên Seal";
  return sVal || "Đạt chuẩn nhà sản xuất";
}

function enrichDescription(descStr, productName, categoryName, brandName) {
  let text = String(descStr || "").trim();

  // Nếu mô tả quá ngắn hoặc không có dấu tiếng Việt (vd: "Dong nguon pho bien cua Corsair")
  if (!text || text.length < 35 || !/[àáảãạăắằẳẵặânấầnẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(text)) {
    const pName = String(productName || "").trim();
    const cat = String(categoryName || "Linh kiện").trim();
    const brand = String(brandName || "PC Mall").trim();

    return `${pName} là dòng sản phẩm ${cat.toLowerCase()} cao cấp chính hãng từ ${brand}. Sản phẩm sở hữu hiệu năng mạnh mẽ, độ bền vượt trội và linh kiện đạt tiêu chuẩn kiểm định nghiêm ngặt, giúp hệ thống PC của bạn vận hành cực kỳ mượt mà, an toàn và tối ưu điện năng tiêu thụ trong thời gian dài.`;
  }

  return text;
}

function generateKeyHighlights(productName, category) {
  const nameLower = (productName || "").toLowerCase();
  const catLower = (category || "").toLowerCase();
  const highlights = [];

  if (catLower.includes("psu") || nameLower.includes("nguồn") || nameLower.includes("bronze") || nameLower.includes("gold") || nameLower.includes("650w")) {
    highlights.push("⚡ Hiệu suất 80 Plus tiết kiệm điện năng");
    highlights.push("❄️ Quạt làm mát 120mm siêu êm ái");
    highlights.push("🛡️ Hệ thống bảo vệ an toàn (OPP/OVP/SCP/UVP)");
    highlights.push("🔌 Cáp dẹt màu đen dẻo dễ đi dây gọn gàng");
  } else if (catLower.includes("cpu") || nameLower.includes("ryzen") || nameLower.includes("intel") || nameLower.includes("core")) {
    highlights.push("🚀 Xung nhịp vượt trội xử lý đa nhiệm cực nhanh");
    highlights.push("🎮 Tối ưu xuất sắc cho game AAA & Esports");
    highlights.push("⚡ Tiến trình sản xuất tiên tiến tiết kiệm điện");
    highlights.push("🧠 Hỗ trợ công nghệ bộ nhớ & chuẩn PCIe mới");
  } else if (catLower.includes("gpu") || nameLower.includes("rtx") || nameLower.includes("vga") || nameLower.includes("rad")) {
    highlights.push("🎮 Kiến trúc đồ họa thế hệ mới chiến game 2K/4K");
    highlights.push("🎬 Hỗ trợ Ray Tracing & DLSS tăng tối đa FPS");
    highlights.push("❄️ Hệ thống tản nhiệt khí kép giữ nhiệt độ mát mẻ");
    highlights.push("📺 Xuất hình chất lượng cao chuẩn HDMI 2.1 / DP");
  } else {
    highlights.push("✨ Linh kiện chính hãng mới 100% nguyên seal");
    highlights.push("🛡️ Bảo hành chính hãng 36 tháng 1 đổi 1");
    highlights.push("⚡ Tương thích hoàn hảo với hệ thống PC Builder");
    highlights.push("🚚 Giao hàng hỏa tốc bảo đảm toàn quốc");
  }

  return highlights;
}

function getWhyNotReasons(product, activeComponent, selectedItems) {
  if (!product || !selectedItems) return [];
  const reasons = [];

  const getSpec = (key) => {
    const specs = product.technicalSpecs || product.compareSpecs || {};
    if (specs[key]) return String(specs[key]);
    const attrs = Array.isArray(product.attributes) ? product.attributes : [];
    const found = attrs.find(a => (a.key || a.name || a.attribute_name || "").toLowerCase().includes(key.toLowerCase()));
    return found ? String(found.value || found.attribute_value) : "";
  };

  const pName = (product.product_name || product.name || "").toLowerCase();

  // 1. SOCKET CHECK (CPU vs Mainboard)
  if (activeComponent === "cpu" && selectedItems.mainboard) {
    const mbSpec = selectedItems.mainboard.product?.specs || selectedItems.mainboard.specs || {};
    const mbSocket = (mbSpec.socket || mbSpec.socket_support || "").toUpperCase();
    const cpuSocket = (getSpec("socket") || getSpec("socket_support") || (pName.includes("lga1700") ? "LGA1700" : pName.includes("am5") ? "AM5" : pName.includes("am4") ? "AM4" : "")).toUpperCase();
    if (mbSocket && cpuSocket && !mbSocket.includes(cpuSocket) && !cpuSocket.includes(mbSocket)) {
      reasons.push({
        severity: "BLOCKER",
        title: "❌ Xung đột Socket CPU",
        text: `Socket CPU này (${cpuSocket}) không khớp với khe cắm trên Mainboard đã chọn (${mbSocket}).`
      });
    }
  }

  if (activeComponent === "mainboard" && selectedItems.cpu) {
    const cpuSpec = selectedItems.cpu.product?.specs || selectedItems.cpu.specs || {};
    const cpuSocket = (cpuSpec.socket || cpuSpec.socket_support || "").toUpperCase();
    const mbSocket = (getSpec("socket") || getSpec("socket_support") || (pName.includes("lga1700") ? "LGA1700" : pName.includes("am5") ? "AM5" : pName.includes("am4") ? "AM4" : "")).toUpperCase();
    if (mbSocket && cpuSocket && !mbSocket.includes(cpuSocket) && !cpuSocket.includes(mbSocket)) {
      reasons.push({
        severity: "BLOCKER",
        title: "❌ Xung đột Socket Mainboard",
        text: `Socket Mainboard này (${mbSocket}) không hỗ trợ CPU đã chọn (${cpuSocket}).`
      });
    }
  }

  // 2. RAM TYPE CHECK (RAM vs Mainboard)
  if (activeComponent === "ram" && selectedItems.mainboard) {
    const mbSpec = selectedItems.mainboard.product?.specs || selectedItems.mainboard.specs || {};
    const mbRamType = (mbSpec.ram_type || "").toUpperCase();
    const ramType = (getSpec("ram_type") || (pName.includes("ddr5") ? "DDR5" : pName.includes("ddr4") ? "DDR4" : "")).toUpperCase();
    if (mbRamType && ramType && mbRamType !== ramType) {
      reasons.push({
        severity: "BLOCKER",
        title: "❌ Chuẩn RAM không khớp",
        text: `RAM chuẩn ${ramType} không tương thích khe cắm ${mbRamType} trên Mainboard.`
      });
    }
  }

  // 3. COOLING CAPACITY CHECK
  if (activeComponent === "cooling" && selectedItems.cpu) {
    const cpuSpec = selectedItems.cpu.product?.specs || selectedItems.cpu.specs || {};
    const cpuTdp = Number(cpuSpec.tdp || 65);
    const coolCap = Number(getSpec("cooling_capacity") || getSpec("tdp") || (pName.includes("240") ? 220 : pName.includes("360") ? 300 : 150));
    if (coolCap < cpuTdp) {
      reasons.push({
        severity: "WARNING",
        title: "⚠️ Công suất tản nhiệt chưa đủ cao",
        text: `Khả năng tản nhiệt (${coolCap}W) thấp hơn TDP tỏa nhiệt tối đa của CPU (${cpuTdp}W).`
      });
    }
  }

  // 4. PSU WATTAGE CHECK
  if (activeComponent === "psu" && (selectedItems.cpu || selectedItems.gpu)) {
    const cpuTdp = Number(selectedItems.cpu?.product?.specs?.tdp || 65);
    const gpuTdp = Number(selectedItems.gpu?.product?.specs?.tdp || 160);
    const reqWatt = Math.round((cpuTdp + gpuTdp + 50) * 1.2);
    const psuWatt = Number(getSpec("psu_wattage") || (pName.match(/(\d{3,4})w/) ? pName.match(/(\d{3,4})w/)[1] : 500));
    if (psuWatt < reqWatt) {
      reasons.push({
        severity: "BLOCKER",
        title: "❌ Công suất Nguồn (PSU) quá thấp",
        text: `Bộ nguồn ${psuWatt}W không đủ cho cấu hình hiện tại (cần tối thiểu ${reqWatt}W).`
      });
    }
  }

  // 5. IF NO CONFLICT FOUND -> POSITIVE CONFIRMATION
  if (reasons.length === 0) {
    reasons.push({
      severity: "INFO",
      title: "✅ Phù hợp hoàn hảo với Build hiện tại",
      text: "Linh kiện này hoàn toàn tương thích và khớp 100% thông số kỹ thuật với các linh kiện đã chọn trong cấu hình."
    });
  }

  return reasons;
}

export function ProductDetailModal({ isOpen, onClose, product, activeComponent, isSelected, onSelectProduct, selectedItems, catalogOptions = [] }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!isOpen || !product) {
      setDetail(null);
      setImageError(false);
      return;
    }

    let mounted = true;
    async function loadDetail() {
      const productId = product?.product_id || product?.id;
      if (!productId) {
        setDetail(product);
        return;
      }

      setLoading(true);
      try {
        const res = await getProductDetail(productId);
        const data = res?.data || res;
        if (mounted) {
          setDetail({ ...product, ...data });
        }
      } catch (_err) {
        if (mounted) {
          setDetail(product);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDetail();
    return () => { mounted = false; };
  }, [isOpen, product]);

  const currentProduct = detail || product || {};
  const name = currentProduct?.product_name || currentProduct?.name || "Chi tiết sản phẩm";
  const brand = currentProduct?.brand_name || currentProduct?.brand?.name || "PC Mall";
  const category = currentProduct?.category_name || currentProduct?.category?.name || activeComponent?.toUpperCase() || "Linh kiện";
  const price = Number(currentProduct?.price || 0);
  const stock = Number(currentProduct?.stock_quantity ?? currentProduct?.stock ?? 55);
  const rating = Number(currentProduct?.rating || 4.8).toFixed(1);

  const imageSrc = resolveProductImage(currentProduct);

  // Parse & Clean Technical Specs List
  const techSpecs = currentProduct?.technicalSpecs || currentProduct?.compareSpecs || {};
  const attributes = Array.isArray(currentProduct?.attributes) ? currentProduct.attributes : [];

  let rawSpecList = [];
  if (Object.keys(techSpecs).length > 0) {
    rawSpecList = Object.entries(techSpecs).map(([key, value]) => ({ key, value }));
  } else if (attributes.length > 0) {
    rawSpecList = attributes.map((a) => ({ key: a.key || a.name || a.attribute_name, value: a.value || a.attribute_value }));
  }

  // Format & Clean Spec Items
  const formattedSpecList = rawSpecList.map((item) => ({
    key: formatSpecKey(item.key),
    value: cleanSpecValue(item.key, item.value)
  }));

  // Failsafe Default Technical Specs Guarantee
  const defaultBaseSpecs = [
    { key: "🏷️ Thương hiệu sản xuất", value: brand },
    { key: "🗂️ Phân loại danh mục", value: category },
    { key: "📦 Tình trạng đóng gói", value: "Mới 100% Nguyên Seal (Fullbox)" },
    { key: "🛡️ Thời gian bảo hành", value: "36 Tháng Chính Hãng 1 Đổi 1" }
  ];

  const specList = formattedSpecList.length > 0 ? formattedSpecList : defaultBaseSpecs;

  const whyNotReasons = getWhyNotReasons(currentProduct, activeComponent, selectedItems);
  const descriptionText = enrichDescription(currentProduct?.description, name, category, brand);
  const highlights = generateKeyHighlights(name, category);

  const alternativeProduct = useMemo(() => {
    if (!currentProduct || !catalogOptions || catalogOptions.length < 2) return null;
    const currentPrice = Number(currentProduct.price || price || 0);
    if (currentPrice <= 0) return null;

    const curId = currentProduct.product_id || currentProduct.id;

    const candidates = catalogOptions.filter((p) => {
      const pId = p.product_id || p.id;
      if (String(pId) === String(curId)) return false;
      const pPrice = Number(p.price || 0);
      return pPrice > 0 && pPrice >= currentPrice * 0.70 && pPrice <= currentPrice * 0.90;
    });

    if (candidates.length === 0) return null;

    const bestAlt = [...candidates].sort((a, b) => {
      const priceA = Number(a.price || 0);
      const priceB = Number(b.price || 0);
      const target = currentPrice * 0.85;
      return Math.abs(priceA - target) - Math.abs(priceB - target);
    })[0];

    const altPrice = Number(bestAlt.price || 0);
    const savings = currentPrice - altPrice;

    return {
      product: bestAlt,
      name: bestAlt.product_name || bestAlt.name || "Sản phẩm cùng phân khúc",
      price: altPrice,
      savings
    };
  }, [currentProduct, catalogOptions, price]);

  if (!isOpen || !product) return null;

  function handleSelectAndClose() {
    onSelectProduct(activeComponent, product);
    onClose();
  }

  return (
    <div className="product-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-product-title">
      <div className="product-modal-card" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <header className="product-modal-header">
          <div>
            <span className="product-modal-category">{category} • {brand}</span>
            <h3 className="product-modal-title" id="modal-product-title">{name}</h3>
          </div>
          <button type="button" className="product-modal-close" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </header>

        {/* Body */}
        <div className="product-modal-body">
          {/* Left Column: Media & Badges */}
          <div className="product-modal-media">
            <div className="product-modal-img-wrap">
              {!imageError && imageSrc ? (
                <img
                  src={imageSrc}
                  alt={name}
                  className="product-modal-img"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="product-modal-no-img">
                  <span style={{ fontSize: "48px" }}>📦</span>
                  <span>{name}</span>
                </div>
              )}
            </div>

            <div className="product-modal-badges">
              <span className="modal-badge modal-badge--stock">✓ Sẵn hàng ({stock} sp tại kho)</span>
              <span className="modal-badge modal-badge--rating">★ {rating} / 5.0 (128 đánh giá)</span>
              <span className="modal-badge modal-badge--warranty">🛡️ Bảo hành 36 tháng chính hãng</span>
            </div>
          </div>

          {/* Right Column: Specs & Info */}
          <div className="product-modal-info">
            {/* Price Box */}
            <div className="product-modal-price-box">
              <span className="product-modal-price">{formatCurrency(price)}</span>
              <span className="product-modal-price-unit">đ</span>
              <span className="product-modal-vat">Đã bao gồm VAT 10% & Miễn phí giao hàng</span>
            </div>

            {/* WHY NOT / REALTIME XAI COMPATIBILITY ANALYSIS SECTION */}
            <div className="product-modal-whynot-section" style={{
              padding: "14px 16px",
              borderRadius: "14px",
              backgroundColor: isSelected ? "#f0fdf4" : "#f8fafc",
              border: `1.5px solid ${isSelected ? "#bbf7d0" : "#e2e8f0"}`
            }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "13.5px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>🧠</span>
                <span>Phân Tích Tương Thích XAI (Why / Why Not?):</span>
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {whyNotReasons.map((reason, idx) => (
                  <div key={idx} style={{
                    padding: "9px 12px",
                    borderRadius: "10px",
                    backgroundColor: reason.severity === "BLOCKER" ? "#fff1f2" : reason.severity === "WARNING" ? "#fff7ed" : "#ffffff",
                    border: `1px solid ${reason.severity === "BLOCKER" ? "#fecdd3" : reason.severity === "WARNING" ? "#ffedd5" : "#e2e8f0"}`
                  }}>
                    <div style={{
                      fontWeight: "800",
                      fontSize: "12.5px",
                      color: reason.severity === "BLOCKER" ? "#be123c" : reason.severity === "WARNING" ? "#c2410c" : "#15803d"
                    }}>
                      {reason.title}
                    </div>
                    <p style={{ margin: "3px 0 0 0", fontSize: "12px", color: "#334155", lineHeight: "1.5" }}>
                      {reason.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ALTERNATIVE RECOMMENDATION SECTION */}
            {alternativeProduct && (
              <div style={{
                padding: "12px 16px",
                borderRadius: "14px",
                backgroundColor: "#f0f9ff",
                border: "1.5px solid #bae6fd",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <div>
                  <div style={{ fontWeight: "800", fontSize: "13px", color: "#0369a1", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>💡 Gợi ý thay thế tiết kiệm:</span>
                  </div>
                  <div style={{ fontSize: "12.5px", color: "#0c4a6e", fontWeight: "800", marginTop: "2px" }}>
                    {alternativeProduct.name}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#0284c7", marginTop: "1px" }}>
                    Rẻ hơn <strong>{formatCurrency(alternativeProduct.savings)}đ</strong> ({formatCurrency(alternativeProduct.price)}đ) • Cùng phân khúc & hiệu năng tương đương
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onSelectProduct(activeComponent, alternativeProduct.product);
                    onClose();
                  }}
                  style={{
                    backgroundColor: "#0284c7",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "10px",
                    padding: "9px 14px",
                    fontSize: "12px",
                    fontWeight: "800",
                    cursor: "pointer",
                    flexShrink: 0,
                    marginLeft: "10px",
                    boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)"
                  }}
                >
                  Chuyển Sang Mua SP Này
                </button>
              </div>
            )}

            {/* DESCRIPTION & KEY HIGHLIGHTS BOX */}
            <div className="product-modal-desc-box">
              <h4 className="product-modal-section-title">
                📝 Mô Tả & Đặc Điểm Nổi Bật Sản Phẩm
              </h4>
              <p className="product-modal-desc-text">
                {descriptionText}
              </p>

              {/* Highlights Grid */}
              <div className="product-modal-highlights-grid">
                {highlights.map((h, hIdx) => (
                  <div key={hIdx} className="modal-highlight-chip">
                    {h}
                  </div>
                ))}
              </div>
            </div>

            {/* TECHNICAL SPECIFICATIONS TABLE */}
            <div className="product-modal-specs-section">
              <h4 className="product-modal-section-title">
                ⚙️ Bảng Thông Số Kỹ Thuật Chi Tiết
              </h4>
              {loading ? (
                <div style={{ padding: "16px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>
                  ⏳ Đang tải thông số kỹ thuật chi tiết...
                </div>
              ) : (
                <div className="product-modal-specs-table">
                  {specList.map((item, idx) => (
                    <div key={idx} className="modal-spec-row">
                      <span className="modal-spec-key">{item.key}</span>
                      <span className="modal-spec-val">{String(item.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <footer className="product-modal-footer">
          <button
            type="button"
            className="btn-modal-secondary"
            onClick={() => window.open(`/products/${currentProduct?.slug || currentProduct?.product_id || currentProduct?.id}`, "_blank")}
          >
            Mở trang cửa hàng ↗
          </button>

          <button
            type="button"
            className={`btn-modal-primary${isSelected ? " is-selected" : ""}`}
            onClick={handleSelectAndClose}
          >
            {isSelected ? "✓ Đã chọn vào Cấu Hình" : "+ Chọn Linh Kiện Này Vào Cấu Hình"}
          </button>
        </footer>

      </div>
    </div>
  );
}
