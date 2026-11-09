import React from "react";

const formatCurrency = (v) => Number(v || 0).toLocaleString("vi-VN");

/**
 * AIControlPanel — Bảng Tùy Chỉnh Ngân Sách & Thông Số Kỹ Thuật (System Lab)
 */
export function AIControlPanel({
  suggestionForm,
  setSuggestionForm,
  onAutoRecommend,
  isAutoBuilding
}) {
  const currentBudget = Number(suggestionForm?.budget || 25000000);

  return (
    <div style={styles.card}>
      <h4 style={styles.title}>
        <span>⚙️</span> Tùy Chỉnh Nhanh Cấu Hình Hệ Thống
      </h4>

      {/* Budget Slider */}
      <div style={styles.field}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <span style={styles.label}>Ngân Sách Mục Tiêu:</span>
          <strong style={{ color: "#2563eb", fontSize: "12px" }}>{formatCurrency(currentBudget)}đ</strong>
        </div>
        <input
          type="range"
          min={10000000}
          max={100000000}
          step={1000000}
          value={currentBudget}
          onChange={(e) => setSuggestionForm((prev) => ({ ...prev, budget: e.target.value }))}
          style={{ width: "100%", accentColor: "#2563eb", cursor: "pointer", height: "5px" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#64748b", marginTop: "3px" }}>
          <span>10 Triệu</span>
          <span>50 Triệu</span>
          <span>100 Triệu</span>
        </div>
      </div>

      {/* Resolution Selector */}
      <div style={styles.field}>
        <label style={styles.label}>Độ Phân Giải Màn Hình:</label>
        <div style={styles.btnGroup}>
          {["1080p", "2K", "4K"].map((res) => {
            const isSel = (suggestionForm?.resolution || "1080p").toLowerCase() === res.toLowerCase();
            return (
              <button
                key={res}
                type="button"
                onClick={() => setSuggestionForm((prev) => ({ ...prev, resolution: res.toLowerCase() }))}
                style={{
                  ...styles.chipBtn,
                  backgroundColor: isSel ? "#0f172a" : "#ffffff",
                  color: isSel ? "#ffffff" : "#475569",
                  borderColor: isSel ? "#0f172a" : "#cbd5e1"
                }}
              >
                {res}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preference Selector */}
      <div style={styles.field}>
        <label style={styles.label}>Khẩu Vị Tối Ưu:</label>
        <div style={styles.btnGroup}>
          {[
            { id: "value", label: "P/P Tối Ưu" },
            { id: "performance", label: "Max FPS" },
            { id: "quiet", label: "Siêu Mát" },
            { id: "future", label: "Dễ Nâng Cấp" }
          ].map((pref) => {
            const isSel = (suggestionForm?.preference || "value") === pref.id;
            return (
              <button
                key={pref.id}
                type="button"
                onClick={() => setSuggestionForm((prev) => ({ ...prev, preference: pref.id }))}
                style={{
                  ...styles.chipBtn,
                  backgroundColor: isSel ? "#0f172a" : "#ffffff",
                  color: isSel ? "#ffffff" : "#475569",
                  borderColor: isSel ? "#0f172a" : "#cbd5e1"
                }}
              >
                {pref.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit Trigger */}
      <button
        type="button"
        onClick={() => onAutoRecommend({ engineType: "system" })}
        disabled={isAutoBuilding}
        style={{
          width: "100%",
          padding: "9px",
          borderRadius: "8px",
          backgroundColor: "#0f172a",
          color: "#ffffff",
          border: "none",
          fontWeight: "800",
          fontSize: "12px",
          cursor: "pointer",
          marginTop: "4px",
          transition: "all 0.15s ease"
        }}
      >
        {isAutoBuilding ? "Đang tính toán..." : "🚀 Nạp Cấu Hình Mẫu Này"}
      </button>
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    padding: "14px",
    border: "1px solid #e2e8f0",
    marginBottom: "14px"
  },
  title: {
    margin: "0 0 10px 0",
    fontSize: "12.5px",
    fontWeight: "800",
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    gap: "6px"
  },
  field: {
    marginBottom: "10px"
  },
  label: {
    display: "block",
    fontSize: "11px",
    fontWeight: "700",
    color: "#475569",
    marginBottom: "4px"
  },
  btnGroup: {
    display: "flex",
    gap: "5px",
    flexWrap: "wrap"
  },
  chipBtn: {
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "700",
    cursor: "pointer",
    border: "1px solid",
    transition: "all 0.15s ease"
  }
};
