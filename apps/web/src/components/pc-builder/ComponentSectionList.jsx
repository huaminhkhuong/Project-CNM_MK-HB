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
            {isDone && imgUrl ? (
              <div style={{ position: "relative", width: "34px", height: "34px", flexShrink: 0 }}>
                <img
                  src={imgUrl}
                  alt={getProductName(product)}
                  style={{
                    width: "34px",
                    height: "34px",
                    objectFit: "contain",
                    borderRadius: "7px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    padding: "2px"
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
              <div className="step-indicator" aria-hidden>
                {idx + 1}
              </div>
            )}

            <div className="step-content">
              <strong className="step-title">{section.label}</strong>
              <span className="step-desc">
                {isDone
                  ? getProductName(product)
                  : section.componentType === "cooling" && !insights?.coolingState?.required
                    ? "Tùy chọn"
                    : "Chưa chọn"}
              </span>
              {isDone && product && getProductStock(product) <= 0 && (
                <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{
                    fontSize: "10px",
                    fontWeight: "800",
                    color: "#dc2626",
                    backgroundColor: "#fee2e2",
                    padding: "1px 6px",
                    borderRadius: "4px"
                  }}>
                    Hết hàng
                  </span>
                  {onSubstitute && (
                    <button
                      type="button"
                      style={{
                        backgroundColor: "#fef3c7",
                        color: "#d97706",
                        border: "1px solid #f59e0b",
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
              {isDone && section.componentType === "ram" && onUpdateQuantity && (
                <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    type="button"
                    style={{
                      fontSize: "10px",
                      fontWeight: selected?.quantity === 2 ? "600" : "800",
                      backgroundColor: selected?.quantity === 2 ? "#f1f5f9" : "#e0e7ff",
                      color: selected?.quantity === 2 ? "#64748b" : "#4338ca",
                      border: `1px solid ${selected?.quantity === 2 ? "#cbd5e1" : "#a5b4fc"}`,
                      borderRadius: "4px",
                      padding: "2px 6px",
                      cursor: "pointer"
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
                      fontSize: "10px",
                      fontWeight: selected?.quantity === 2 ? "800" : "600",
                      backgroundColor: selected?.quantity === 2 ? "#dbeafe" : "#f1f5f9",
                      color: selected?.quantity === 2 ? "#1d4ed8" : "#64748b",
                      border: `1px solid ${selected?.quantity === 2 ? "#93c5fd" : "#cbd5e1"}`,
                      borderRadius: "4px",
                      padding: "2px 6px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "3px"
                    }}
                    title="2 thanh kích hoạt Dual Channel tăng băng thông"
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

            {isDone && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <span className="step-price">{formatCurrency(getItemPrice(selected))}đ</span>
                {selected?.quantity > 1 && (
                  <span style={{ fontSize: "10px", color: "#64748b", fontWeight: "600" }}>
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
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveComponent(section.componentType);
                }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
