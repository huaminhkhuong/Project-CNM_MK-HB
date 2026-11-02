import React from "react";
import { resolveProductImage } from "../../utils/productImage";
import { getProductStock } from "./pcBuilderUtils";

const formatCurrency = (v) => Number(v || 0).toLocaleString("vi-VN");

const getProductName = (p) => p?.product_name || p?.name || p?.title || "Chưa chọn";
const getSelectedProduct = (item) => item?.product || item;
const getItemPrice = (item) => {
  const unitPrice = Number(item?.variant?.price || item?.product?.price || item?.price || 0);
  const qty = Math.max(1, Number(item?.quantity || 1));
  return unitPrice * qty;
};

/**
 * ComponentSectionList — Danh sách 8 bước chọn linh kiện trong Sidebar
 */
export function ComponentSectionList({
  sections = [],
  selectedItems = {},
  activeComponent,
  setActiveComponent,
  setSearchTerm,
  insights,
  onRemoveComponent,
  onClearAll,
  completionPercent = 0,
  onSubstitute,
  onUpdateQuantity
}) {
  const selectedCount = Object.keys(selectedItems || {}).length;

  return (
    <div className="component-section-list">
      <div className="sidebar-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="sidebar-section-title">Tiến trình lắp ráp</span>
          <span className="sidebar-section-title" style={{ color: "var(--c-primary)" }}>
            {completionPercent}%
          </span>
        </div>
        {onClearAll && selectedCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            style={{
              backgroundColor: "transparent",
              color: "#ef4444",
              border: "none",
              fontSize: "11px",
              fontWeight: "700",
              cursor: "pointer",
              padding: "2px 4px",
              borderRadius: "4px"
            }}
            title="Xóa toàn bộ linh kiện đã chọn trong cấu hình"
          >
            🗑️ Xóa hết
          </button>
        )}
      </div>

      <div className="sidebar-progress-wrap">
        <div
          className="sidebar-progress-track"
          role="progressbar"
          aria-valuenow={completionPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="sidebar-progress-fill" style={{ width: `${completionPercent}%` }} />
        </div>
      </div>

      {sections.map((section, idx) => {
        const selected = selectedItems[section.componentType];
        const product  = selected ? getSelectedProduct(selected) : null;
        const isDone   = Boolean(selected);
        const isActive = activeComponent === section.componentType;
        const imgUrl   = product ? resolveProductImage(product) : null;

        return (
          <div
            key={section.componentType}
            role="button"
            tabIndex={0}
            className={`step-item${isActive ? " is-active" : ""}${isDone ? " is-done" : ""}`}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              padding: "10px 12px",
              boxSizing: "border-box"
            }}
            onClick={() => {
              setActiveComponent(section.componentType);
              if (setSearchTerm) setSearchTerm("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setActiveComponent(section.componentType);
                if (setSearchTerm) setSearchTerm("");
              }
            }}
            aria-current={isActive ? "step" : undefined}
          >
            {/* HÀNG 1: HEADER CỦA SLOT (TÊN SLOT + GIÁ TIỀN + NÚT XÓA) */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "6px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "800",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  color: isActive ? "#1d4ed8" : "#64748b"
                }}
              >
                {section.label}
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {isDone && (
                  <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                    <span className="step-price" style={{ fontSize: "11px", fontWeight: "800", color: "#2563eb" }}>
                      {formatCurrency(getItemPrice(selected))}đ
                    </span>
                    {selected?.quantity > 1 && (
                      <span
                        style={{
                          fontSize: "9.5px",
                          fontWeight: "800",
                          color: "#1d4ed8",
                          backgroundColor: "#dbeafe",
                          padding: "0 4px",
                          borderRadius: "4px"
                        }}
                      >
                        x{selected.quantity}
                      </span>
                    )}
                  </div>
                )}

                {isDone && (
                  <button
                    type="button"
                    className="step-remove-btn"
                    title="Xóa linh kiện này"
                    aria-label={`Xóa ${section.label}`}
                    style={{
                      width: "18px",
                      height: "18px",
                      fontSize: "13px",
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer"
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveComponent(section.componentType);
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* HÀNG 2: NỘI DUNG CHÍNH (THUMBNAIL + TÊN SẢN PHẨM) */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%" }}>
              {isDone && imgUrl ? (
                <div style={{ position: "relative", width: "36px", height: "36px", flexShrink: 0 }}>
                  <img
                    src={imgUrl}
                    alt={getProductName(product)}
                    style={{
                      width: "36px",
                      height: "36px",
                      objectFit: "contain",
                      borderRadius: "7px",
                      border: "1px solid #cbd5e1",
                      backgroundColor: "#ffffff",
                      padding: "2px",
                      boxSizing: "border-box"
                    }}
                  />
                  <span style={{
                    position: "absolute",
                    bottom: "-2px",
                    right: "-2px",
                    backgroundColor: "#16a34a",
                    color: "#ffffff",
                    fontSize: "8.5px",
                    fontWeight: "800",
                    width: "13px",
                    height: "13px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.25)"
                  }}>
                    ✓
                  </span>
                </div>
              ) : (
                <div className="step-indicator" aria-hidden style={{ flexShrink: 0 }}>
                  {idx + 1}
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  title={isDone ? getProductName(product) : ""}
                  style={{
                    fontSize: "12px",
                    fontWeight: isDone ? "600" : "500",
                    color: isDone ? "#0f172a" : "#94a3b8",
                    lineHeight: "1.35",
                    display: "-webkit-box",
                    WebkitLineClamp: isDone ? 2 : 1,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    wordBreak: "break-word"
                  }}
                >
                  {isDone
                    ? getProductName(product)
                    : section.componentType === "cooling" && !insights?.coolingState?.required
                      ? "Tùy chọn"
                      : "Chưa chọn"}
                </div>
              </div>
            </div>

            {/* HÀNG 3: NẾU HẾT HÀNG */}
            {isDone && product && getProductStock(product) <= 0 && (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "3px 6px",
                backgroundColor: "#fef2f2",
                borderRadius: "5px",
                boxSizing: "border-box"
              }}>
                <span style={{ fontSize: "10px", fontWeight: "800", color: "#dc2626" }}>
                  ⚠️ Hết hàng
                </span>
                {onSubstitute && (
                  <button
                    type="button"
                    style={{
                      backgroundColor: "#fee2e2",
                      color: "#dc2626",
                      border: "1px solid #fca5a5",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: "700",
                      padding: "1px 6px",
                      cursor: "pointer"
                    }}
                    title="Đổi linh kiện tương thích còn hàng"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSubstitute(section.componentType, product);
                    }}
                  >
                    🔄 Đổi
                  </button>
                )}
              </div>
            )}

            {/* HÀNG 4: BỘ CHỌN SỐ LƯỢNG RAM (1 THANH / 2 THANH DUAL-CHANNEL) */}
            {isDone && section.componentType === "ram" && onUpdateQuantity && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "6px",
                  width: "100%",
                  boxSizing: "border-box",
                  marginTop: "3px",
                  paddingTop: "6px",
                  borderTop: "1px dashed #e2e8f0"
                }}
              >
                <button
                  type="button"
                  style={{
                    fontSize: "10.5px",
                    fontWeight: selected?.quantity === 2 ? "500" : "700",
                    backgroundColor: selected?.quantity === 2 ? "#f8fafc" : "#eff6ff",
                    color: selected?.quantity === 2 ? "#64748b" : "#2563eb",
                    border: `1px solid ${selected?.quantity === 2 ? "#e2e8f0" : "#3b82f6"}`,
                    borderRadius: "6px",
                    padding: "4px 4px",
                    cursor: "pointer",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "3px"
                  }}
                  title="1 thanh đơn lẻ (Single Channel)"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateQuantity("ram", 1);
                  }}
                >
                  1 Thanh
                </button>
                <button
                  type="button"
                  style={{
                    fontSize: "10.5px",
                    fontWeight: selected?.quantity === 2 ? "700" : "500",
                    backgroundColor: selected?.quantity === 2 ? "#eff6ff" : "#f8fafc",
                    color: selected?.quantity === 2 ? "#2563eb" : "#64748b",
                    border: `1px solid ${selected?.quantity === 2 ? "#3b82f6" : "#e2e8f0"}`,
                    borderRadius: "6px",
                    padding: "4px 4px",
                    cursor: "pointer",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "3px"
                  }}
                  title="2 thanh kích hoạt Dual Channel (x2 băng thông bộ nhớ)"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateQuantity("ram", 2);
                  }}
                >
                  <span>⚡ 2 Thanh (Dual)</span>
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
