import React from "react";

export function BuilderFloatingCompareBar({
  compareList,
  activeComponent,
  onOpenCompare,
  onClearCompare
}) {
  if (!Array.isArray(compareList) || compareList.length === 0) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "24px",
      right: "24px",
      backgroundColor: "#0f172a",
      color: "#ffffff",
      padding: "12px 18px",
      borderRadius: "16px",
      boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.35)",
      display: "flex",
      alignItems: "center",
      gap: "16px",
      zIndex: 999,
      border: "1px solid #334155"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "22px" }}>📊</span>
        <div>
          <strong style={{ fontSize: "13.5px", display: "block", color: "#f8fafc" }}>
            Đã chọn {compareList.length}/3 sản phẩm
          </strong>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
            Danh mục: {String(activeComponent || "").toUpperCase()}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenCompare}
        style={{
          backgroundColor: "#2563eb",
          color: "#ffffff",
          border: "none",
          borderRadius: "10px",
          padding: "8px 16px",
          fontSize: "12.5px",
          fontWeight: "800",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(37, 99, 235, 0.4)"
        }}
      >
        📊 So Sánh Side-by-Side →
      </button>

      <button
        type="button"
        onClick={onClearCompare}
        style={{
          backgroundColor: "transparent",
          color: "#94a3b8",
          border: "none",
          fontSize: "16px",
          cursor: "pointer",
          padding: "0 4px"
        }}
        title="Bỏ danh sách so sánh"
      >
        ✕
      </button>
    </div>
  );
}

export default BuilderFloatingCompareBar;
