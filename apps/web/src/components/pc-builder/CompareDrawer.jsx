import React from "react";
import { resolveProductImage } from "../../utils/productImage";
import { extractSmartSpecs, calculateCategoryAiScores, inspectSuperiorSpecs } from "../../utils/smartSpecExtractor";

const formatCurrency = (v) => Number(v || 0).toLocaleString("vi-VN");

/**
 * CompareDrawer — Bảng So Sánh Chi Tiết 2-3 Sản Phẩm Cùng Danh Mục (Compare Mode)
 * So sánh Side-by-Side: Giá tiền, Hình ảnh, Thương hiệu, Specs kỹ thuật chi tiết, Điểm Đánh Giá và Tương thích.
 */
export function CompareDrawer({
  isOpen,
  onClose,
  compareList = [],
  activeComponent,
  onSelectProduct,
  onRemoveFromCompare,
  onClearCompare
}) {
  if (!isOpen || compareList.length === 0) return null;

  // Extract superior specs map for green highlighting
  const superiorMap = inspectSuperiorSpecs(compareList);

  // Extract smart specs & AI scores for each product in compare list
  const smartSpecsList = compareList.map((prod) => ({
    product: prod,
    specs: extractSmartSpecs(prod),
    scores: calculateCategoryAiScores(prod, activeComponent)
  }));

  // Aggregate all unique spec keys across all products in compare list
  const specKeysMap = new Map();
  smartSpecsList.forEach(({ specs }) => {
    Object.keys(specs).forEach((k) => {
      if (k !== "category") specKeysMap.set(k, k);
    });
  });

  const allSpecKeys = Array.from(specKeysMap.values());
  if (allSpecKeys.length === 0) {
    allSpecKeys.push("Bảo hành chính hãng", "Thương hiệu", "Xuất xứ", "Tình trạng");
  }

  // ✅ Build lookup map từ smartSpecsList đã tính sẵn — tránh gọi lại extractSmartSpecs() trong getSpecVal
  const smartSpecsMap = Object.fromEntries(
    smartSpecsList.map(({ product, specs }) => [product.product_id || product.id, specs])
  );

  const getSpecVal = (prod, key) => {
    // Dùng specs đã pre-compute thay vì gọi extractSmartSpecs() lại
    const smartSpecs = smartSpecsMap[prod.product_id || prod.id] || {};
    if (smartSpecs[key]) return String(smartSpecs[key]);

    const techSpecs = prod?.technicalSpecs || prod?.compareSpecs || {};
    if (techSpecs[key]) return String(techSpecs[key]);

    const attrs = Array.isArray(prod?.attributes) ? prod.attributes : [];
    const found = attrs.find((a) => (a.key || a.name || a.attribute_name || "").toLowerCase() === key.toLowerCase());
    if (found) return String(found.value || found.attribute_value);

    // ✅ Fix: dùng "—" thay vì "Chính hãng" khi spec không có dữ liệu
    return "—";
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.drawer}>
        {/* DRAWER HEADER */}
        <div style={styles.header}>
          <div>
            <div style={styles.badge}>📊 PRODUCT COMPARISON MATRIX</div>
            <h3 style={styles.title}>
              So Sánh {compareList.length} Sản Phẩm {activeComponent?.toUpperCase()}
            </h3>
            <p style={styles.subtitle}>
              Bảng so sánh thông số kỹ thuật, mức giá và hiệu năng side-by-side
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button type="button" onClick={onClearCompare} style={styles.clearBtn}>
              🗑️ Xóa Tất Cả
            </button>
            <button type="button" onClick={onClose} style={styles.closeBtn}>
              ✕
            </button>
          </div>
        </div>

        {/* COMPARISON MATRIX TABLE */}
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: "18%" }}>Thông Số / Tiêu Chí</th>
                {compareList.map((prod) => {
                  const pId = prod.product_id || prod.id;
                  const name = prod.product_name || prod.name || "Sản phẩm";
                  const price = Number(prod.price || 0);
                  const img = resolveProductImage(prod);

                  return (
                    <th key={pId} style={styles.thProduct}>
                      <div style={styles.prodHeaderCard}>
                        <button
                          type="button"
                          onClick={() => onRemoveFromCompare(pId)}
                          style={styles.removeProductBtn}
                          title="Bỏ sản phẩm này"
                        >
                          ×
                        </button>
                        <img src={img} alt={name} style={styles.prodImg} />
                        <div style={styles.prodTitle}>{name}</div>
                        <div style={styles.prodPrice}>{formatCurrency(price)}đ</div>

                        <button
                          type="button"
                          onClick={() => {
                            onSelectProduct(activeComponent, prod);
                            onClose();
                          }}
                          style={styles.selectBtn}
                        >
                          + Chọn Linh Kiện Này
                        </button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* Row 1: Brand */}
              <tr>
                <td style={styles.tdLabel}>🏷️ Thương Hiệu</td>
                {compareList.map((prod) => (
                  <td key={prod.product_id || prod.id} style={styles.tdVal}>
                    <strong>{prod.brand_name || prod.brand?.name || "Chính hãng"}</strong>
                  </td>
                ))}
              </tr>

              {/* Row 2: Price Diff — so sánh tương đối: chỉ badge khi giá thực sự khác nhau */}
              <tr>
                <td style={styles.tdLabel}>💰 Mức Giá</td>
                {(() => {
                  const allPrices = compareList.map((p) => Number(p.price || 0)).filter((v) => v > 0);
                  const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
                  const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;
                  // Chỉ hiện badge "Rẻ nhất" khi các giá THỰC SỰ khác nhau
                  const pricesDiffer = minPrice > 0 && minPrice !== maxPrice;
                  return compareList.map((prod) => {
                    const price = Number(prod.price || 0);
                    const isCheapest = pricesDiffer && price === minPrice;
                    return (
                      <td key={prod.product_id || prod.id} style={styles.tdVal}>
                        <span style={{ fontSize: "14px", fontWeight: "800", color: "#1d4ed8" }}>
                          {price > 0 ? `${formatCurrency(price)}đ` : "Liên hệ"}
                        </span>
                        {isCheapest && (
                          <span style={styles.cheapestBadge}>
                            🏷️ Rẻ nhất
                          </span>
                        )}
                      </td>
                    );
                  });
                })()}
              </tr>

              {/* Row 3: Rating */}
              <tr>
                <td style={styles.tdLabel}>⭐ Đánh Giá Người Dùng</td>
                {compareList.map((prod) => (
                  <td key={prod.product_id || prod.id} style={styles.tdVal}>
                    {/* ✅ Fix: chỉ hiện rating thực tế, không hardcode 4.8 cho tất cả */}
                    {prod.rating
                      ? `★ ${Number(prod.rating).toFixed(1)} / 5.0`
                      : <span style={{ color: "#94a3b8", fontSize: "11px" }}>— Chưa có đánh giá</span>
                    }
                  </td>
                ))}
              </tr>

              {/* Technical Spec Rows */}
              {allSpecKeys.map((specKey, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#f8fafc" : "#ffffff" }}>
                  <td style={styles.tdLabel}>⚙️ {specKey}</td>
                  {compareList.map((prod) => {
                    const pId = prod.product_id || prod.id;
                    const val = getSpecVal(prod, specKey);
                    const superiorInfo = superiorMap[pId];
                    // ✅ Fix Bug #2: chỉ dùng so sánh tương đối, XÓA fallback tuyệt đối
                    const isSuperior = superiorInfo?.superiorKeys?.has(specKey) === true;

                    return (
                      <td
                        key={pId}
                        style={{
                          ...styles.tdVal,
                          backgroundColor: isSuperior ? "#ecfdf5" : "transparent",
                          color: isSuperior ? "#047857" : "#0f172a",
                          fontWeight: isSuperior ? "800" : "500"
                        }}
                      >
                        {val}
                        {isSuperior && (
                          <span style={{ marginLeft: 6, padding: "2px 6px", borderRadius: 999, background: "#bbf7d0", color: "#047857", fontSize: "10px", fontWeight: "800" }}>
                            ✨ Vượt trội
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div style={styles.footer}>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            💡 Nhấn <strong>"+ Chọn Linh Kiện Này"</strong> để thay thế sản phẩm đó vào cấu hình hiện tại của bạn.
          </span>
          <button type="button" onClick={onClose} style={styles.closeModalBtn}>
            Đóng Bảng So Sánh
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "20px"
  },
  drawer: {
    backgroundColor: "#ffffff",
    borderRadius: "24px",
    width: "100%",
    maxWidth: "1020px",
    maxHeight: "92vh",
    overflowY: "auto",
    padding: "24px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    border: "1px solid #e2e8f0"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "16px"
  },
  badge: {
    display: "inline-block",
    backgroundColor: "#f0fdf4",
    color: "#16a34a",
    fontSize: "10.5px",
    fontWeight: "800",
    padding: "3px 8px",
    borderRadius: "6px",
    letterSpacing: "0.5px",
    marginBottom: "4px"
  },
  title: {
    margin: 0,
    fontSize: "19px",
    fontWeight: "800",
    color: "#0f172a"
  },
  subtitle: {
    margin: "2px 0 0 0",
    fontSize: "12.5px",
    color: "#64748b"
  },
  clearBtn: {
    backgroundColor: "#f1f5f9",
    border: "1px solid #cbd5e1",
    padding: "6px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
    color: "#475569"
  },
  closeBtn: {
    backgroundColor: "#f1f5f9",
    border: "none",
    borderRadius: "50%",
    width: "34px",
    height: "34px",
    fontSize: "15px",
    cursor: "pointer",
    color: "#64748b"
  },
  tableWrap: {
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    overflow: "hidden",
    marginBottom: "16px"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse"
  },
  th: {
    padding: "12px",
    fontSize: "12px",
    fontWeight: "700",
    color: "#475569",
    textAlign: "left",
    backgroundColor: "#f8fafc",
    borderBottom: "1px solid #e2e8f0"
  },
  thProduct: {
    padding: "12px",
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    textAlign: "center",
    verticalAlign: "top"
  },
  prodHeaderCard: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  },
  removeProductBtn: {
    position: "absolute",
    top: "-6px",
    right: "-6px",
    backgroundColor: "#fee2e2",
    color: "#ef4444",
    border: "none",
    borderRadius: "50%",
    width: "22px",
    height: "22px",
    fontSize: "13px",
    fontWeight: "800",
    cursor: "pointer",
    lineHeight: "22px",
    padding: 0
  },
  prodImg: {
    width: "72px",
    height: "72px",
    objectFit: "contain",
    marginBottom: "8px"
  },
  prodTitle: {
    fontSize: "12.5px",
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: "1.3",
    maxHeight: "33px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    marginBottom: "4px"
  },
  prodPrice: {
    fontSize: "13px",
    fontWeight: "800",
    color: "#1d4ed8",
    marginBottom: "8px"
  },
  selectBtn: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "6px 12px",
    fontSize: "11.5px",
    fontWeight: "700",
    cursor: "pointer",
    width: "100%"
  },
  tdLabel: {
    padding: "10px 14px",
    fontSize: "12px",
    fontWeight: "700",
    color: "#475569",
    borderBottom: "1px solid #f1f5f9"
  },
  tdVal: {
    padding: "10px 14px",
    fontSize: "12.5px",
    color: "#0f172a",
    textAlign: "center",
    borderBottom: "1px solid #f1f5f9",
    borderLeft: "1px solid #f1f5f9"
  },
  cheapestBadge: {
    display: "block",
    marginTop: "2px",
    fontSize: "10px",
    fontWeight: "800",
    color: "#16a34a",
    backgroundColor: "#dcfce7",
    padding: "2px 6px",
    borderRadius: "6px"
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "1px solid #e2e8f0",
    paddingTop: "14px"
  },
  closeModalBtn: {
    padding: "10px 18px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#ffffff",
    color: "#334155",
    fontWeight: "700",
    fontSize: "12.5px",
    cursor: "pointer"
  }
};
