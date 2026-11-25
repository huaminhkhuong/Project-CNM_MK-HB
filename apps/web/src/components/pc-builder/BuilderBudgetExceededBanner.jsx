import React from "react";

export function BuilderBudgetExceededBanner({
  isBudgetExceeded,
  isBudgetBlocked,
  budgetExceededPercent,
  budgetDiff,
  userBudget,
  totalPrice,
  mostExpensiveComponent,
  candidateBuilds,
  onApplyBudgetSafe,
  onRunWhatIf,
  isWhatIfLoading,
  formatCurrency
}) {
  if (!isBudgetExceeded) return null;

  return (
    <div style={{
      backgroundColor: isBudgetBlocked ? "#fff1f2" : "#fff7ed",
      border: `1px solid ${isBudgetBlocked ? "#fecdd3" : "#fed7aa"}`,
      borderRadius: "16px",
      padding: "16px 20px",
      marginBottom: "20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      boxShadow: isBudgetBlocked
        ? "0 4px 16px rgba(220, 38, 38, 0.12)"
        : "0 4px 12px rgba(234, 88, 12, 0.08)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <span style={{ fontSize: "28px" }}>{isBudgetBlocked ? "🚫" : "⚠️"}</span>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: isBudgetBlocked ? "#be123c" : "#c2410c" }}>
              {isBudgetBlocked ? "Vượt Ngân Sách Nghiêm Trọng" : "Cảnh Báo Ngân Sách"}&nbsp;
              {budgetExceededPercent}% (+{formatCurrency(budgetDiff)}đ)
            </h4>
            {/* Badge trạng thái rõ ràng */}
            <span style={{
              fontSize: "10px",
              fontWeight: "800",
              padding: "2px 8px",
              borderRadius: "6px",
              backgroundColor: isBudgetBlocked ? "#be123c" : "#ea580c",
              color: "#ffffff",
              letterSpacing: "0.5px",
              flexShrink: 0
            }}>
              {isBudgetBlocked ? "⛔ BỊ CHẶN MUA" : "⚠ CẢNH BÁO"}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "12.5px", color: isBudgetBlocked ? "#9f1239" : "#9a3412", lineHeight: "1.4" }}>
            Hạn mức: <strong>{formatCurrency(userBudget)}đ</strong> · Hiện tại: <strong>{formatCurrency(totalPrice)}đ</strong>.
            {isBudgetBlocked
              ? " Vượt quá 10% — nút Đặt Mua đã bị khóa cho đến khi điều chỉnh lại cấu hình."
              : " Vượt nhẹ dưới 10% — bạn vẫn có thể đặt mua nhưng nên cân nhắc."}
            {mostExpensiveComponent && (
              <span> Gợi ý: Đổi <strong>{mostExpensiveComponent.type} ({mostExpensiveComponent.name})</strong> xuống phân khúc thấp hơn.</span>
            )}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
        {candidateBuilds?.budgetSafe && (
          <button
            type="button"
            onClick={onApplyBudgetSafe}
            style={{
              backgroundColor: isBudgetBlocked ? "#be123c" : "#ea580c",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              padding: "8px 14px",
              fontSize: "12px",
              fontWeight: "700",
              cursor: "pointer"
            }}
          >
            💡 Áp Dụng Budget Safe
          </button>
        )}

        <button
          type="button"
          onClick={() => onRunWhatIf(-5000000)}
          disabled={isWhatIfLoading}
          style={{
            backgroundColor: "#ffffff",
            color: isBudgetBlocked ? "#be123c" : "#c2410c",
            border: `1px solid ${isBudgetBlocked ? "#fecdd3" : "#fdba74"}`,
            borderRadius: "10px",
            padding: "8px 14px",
            fontSize: "12px",
            fontWeight: "700",
            cursor: "pointer"
          }}
        >
          🔮 Mô phỏng -5Tr
        </button>
      </div>
    </div>
  );
}

export default BuilderBudgetExceededBanner;
