import React, { useState } from "react";
import { AIAdvisorPanel } from "./AIAdvisorPanel";
import { CompatibilityGauge, PowerMeter, CostTicker } from "./BuilderMetricsV2";

function ScoreRing({ score, size = 52, strokeWidth = 4 }) {
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const cls = score >= 70 ? "" : score >= 45 ? "score-ring__fill--warn" : "score-ring__fill--bad";

  return (
    <div className="score-ring" style={{ "--score-size": `${size}px` }}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle className="score-ring__bg"   cx={size/2} cy={size/2} r={r} strokeWidth={strokeWidth} />
        <circle className={`score-ring__fill ${cls}`} cx={size/2} cy={size/2} r={r} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset} />
      </svg>
      <div className="score-ring__label">
        <span className="score-ring__number">{score}</span>
        <span className="score-ring__sub">/100</span>
      </div>
    </div>
  );
}

export function BuildSummarySidebar({
  xaiReport,
  totalPrice,
  selectedCount,
  insights,
  handleBuyWholeBuild,
  processingComponent,
  hasBlockerSeverity,
  xaiBuildReadiness,
  blockerReasonTooltip,
  isAuthenticated,
  onSaveBuild,
  onAddAllToCart,
  onShareBuild,
  onClearAll,
  handleAutoRecommend,
  suggestionFormBudget,
  visibleChecks = [],
  onOpenXaiDrawer,
  onOpenAiDrawer,
  handleRunWhatIf,
  isWhatIfLoading,
  aiInsightText,
  selectedItems,
  formatCurrency,
  onExportPdf,
  }) {
  return (
    <aside className="builder-summary" aria-label="Build summary">

      {/* V2 Cost Ticker — Tổng giá animated */}
      <CostTicker
        totalPrice={totalPrice}
        budget={Number(insights?.budget || suggestionFormBudget || 0)}
        componentCount={selectedCount}
      />

      {/* CTA Buttons V2 */}
      <div className="v2-summary-cta" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="v2-btn-order"
          onClick={handleBuyWholeBuild}
          disabled={processingComponent === "cart" || selectedCount === 0 || hasBlockerSeverity || xaiBuildReadiness === "BLOCKED"}
          title={blockerReasonTooltip || "Đặt mua toàn bộ linh kiện đã chọn trong cấu hình"}
          style={{
            opacity: (hasBlockerSeverity || xaiBuildReadiness === "BLOCKED") ? 0.55 : 1,
            cursor: (hasBlockerSeverity || xaiBuildReadiness === "BLOCKED") ? "not-allowed" : "pointer"
          }}
        >
          {processingComponent === "cart" ? "⏳ Đang xử lý..." : hasBlockerSeverity ? "⛔ Bị Chặn" : "🚀 Đặt Mua Nguyên Bộ"}
        </button>

        <button
          type="button"
          className="v2-btn-pdf"
          onClick={() => onExportPdf ? onExportPdf() : window.print()}
          title="Xuất PDF báo giá cấu hình có logo PC Mall"
        >
          📄 Xuất PDF Báo Giá
        </button>
      </div>


      {/* Blocker / Compatibility Advisory Card */}
      {hasBlockerSeverity && (
        <div style={{
          background: "#fffbe6",
          color: "#7c2d12",
          border: "1px solid #fef08a",
          borderRadius: 12,
          padding: "10px 14px",
          fontSize: 11.5,
          marginBottom: 12,
          fontWeight: 600,
          lineHeight: 1.45,
          boxShadow: "0 2px 8px rgba(245, 158, 11, 0.12)",
          display: "flex",
          alignItems: "flex-start",
          gap: "8px"
        }}>
          <span style={{ fontSize: "15px", flexShrink: 0 }}>⚠️</span>
          <div>
            <strong style={{ display: "block", color: "#9a3412", fontSize: "12px", marginBottom: "2px", fontWeight: "700" }}>
              Gợi Ý Tối Ưu Cấu Hình
            </strong>
            <span>{blockerReasonTooltip}</span>
          </div>
        </div>
      )}

      {/* Secondary actions row */}
      <div className="summary-secondary-actions" style={{ marginBottom: 16 }}>
        <button type="button" className="btn-summary-action" onClick={onSaveBuild}>
          {isAuthenticated ? "💾 Lưu TK" : "💾 Lưu"}
        </button>
        <button type="button" className="btn-summary-action" onClick={onAddAllToCart} disabled={selectedCount === 0}>
          🛒 Giỏ hàng
        </button>
        <button type="button" className="btn-summary-action" onClick={onShareBuild}>
          🔗 Chia sẻ
        </button>
        {onClearAll && (
          <button
            type="button"
            className="btn-summary-action"
            onClick={onClearAll}
            disabled={selectedCount === 0}
            title="Xóa toàn bộ linh kiện đã chọn trong cấu hình"
            style={{ color: selectedCount > 0 ? "#dc2626" : "inherit" }}
          >
            🗑️ Reset
          </button>
        )}
      </div>

      {/* 🤖 AI Advisor CTA Button — Mở Slide-Over Drawer */}
      <button
        type="button"
        onClick={onOpenAiDrawer}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(99,102,241,0.08))",
          border: "1.5px solid rgba(37,99,235,0.3)",
          borderRadius: 14,
          marginBottom: 16,
          cursor: "pointer",
          transition: "all 0.2s ease",
          boxShadow: "0 4px 12px rgba(37,99,235,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🤖</span>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8", display: "flex", alignItems: "center", gap: 6 }}>
              AI Advisor Tư Vấn PC
              <span style={{
                fontSize: 9,
                fontWeight: 800,
                padding: "2px 6px",
                borderRadius: 10,
                background: "#22c55e",
                color: "#fff",
              }}>LIVE</span>
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
              Hỏi đáp ngữ cảnh • Cảnh báo tự động
            </div>
          </div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8" }}>Hỏi AI →</span>
      </button>

      {/* V2 Compatibility Gauge */}
      <CompatibilityGauge
        score={xaiReport?.score ?? 100}
        issues={(xaiReport?.issues || []).map(i => i.detail || i.message || String(i)).filter(Boolean)}
        isChecking={false}
      />

      {/* What-If Simulation Widget (FIX VẤN ĐỀ 11 — Gọi đúng handleRunWhatIf) */}
      <div className="whatif-widget">
        <div className="whatif-header">
          <span className="whatif-title">🔮 WHAT-IF SIMULATION</span>
          <span className="whatif-delta">Mô Phỏng Ngân Sách</span>
        </div>
        <p className="whatif-desc">Mô phỏng biến động FPS & linh kiện khi tăng/giảm ngân sách 5 triệu đ:</p>
        <div className="whatif-actions">
          <button
            type="button"
            className="btn-whatif"
            onClick={() => handleRunWhatIf(5000000)}
            disabled={isWhatIfLoading}
            style={{ backgroundColor: "#f0fdf4", color: "#16a34a", borderColor: "#bbf7d0" }}
          >
            {isWhatIfLoading ? "⏳ Đang tính toán..." : "🚀 Mô phỏng +5Tr (+25 FPS)"}
          </button>
          <button
            type="button"
            className="btn-whatif"
            onClick={() => handleRunWhatIf(-5000000)}
            disabled={isWhatIfLoading}
            style={{ backgroundColor: "#fff7ed", color: "#c2410c", borderColor: "#fed7aa" }}
          >
            {isWhatIfLoading ? "⏳ Đang tính toán..." : "💡 Mô phỏng -5Tr (Tiết kiệm)"}
          </button>
        </div>
      </div>

      {/* Build Health 5-Dimensional Scorecard */}
      <div className="summary-section">
        <div className="summary-section__header">
          <span className="summary-section__title">Sức Khỏe Build (5 Scores)</span>
          <span style={{ fontSize: "10px", fontWeight: 700, color: xaiReport.compatible ? "var(--c-success)" : "var(--c-warning)" }}>
            {xaiReport.compatible ? "✓ READY" : "⚠ Sửa lỗi"}
          </span>
        </div>

        <div className="compat-score-row">
          <ScoreRing score={xaiReport.score} />
          <div className="compat-score-info">
            <h4 className="compat-score-title">Compatibility & Readiness</h4>
            <p className="compat-score-desc">{insights.recommendation}</p>
          </div>
        </div>

        {/* 5-Dimensional Scorecard Grid */}
        <div className="scorecard-grid">
          <div className="scorecard-item">
            <span className="scorecard-label">Tương thích</span>
            <span className="scorecard-val">{xaiReport.scores?.compatibilityScore || 90}%</span>
          </div>
          <div className="scorecard-item">
            <span className="scorecard-label">Hiệu năng</span>
            <span className="scorecard-val">{xaiReport.scores?.performanceScore || 85}%</span>
          </div>
          <div className="scorecard-item">
            <span className="scorecard-label">P/P Giá trị</span>
            <span className="scorecard-val">{xaiReport.scores?.valueScore || 88}%</span>
          </div>
          <div className="scorecard-item">
            <span className="scorecard-label">Điện / Tản</span>
            <span className="scorecard-val">{xaiReport.scores?.powerThermalScore || 92}%</span>
          </div>
        </div>

        {/* Check items with 4-level Severity Badges */}
        <div className="compat-checks" style={{ marginTop: "10px" }}>
          {visibleChecks.map((check) => {
            const severity = check.severity || (check.ok ? "INFO" : "WARNING");
            const severityStyles = {
              BLOCKER:  { bg: "#fff1f2", color: "#be123c", border: "#fecdd3", label: "BLOCKER" },
              WARNING:  { bg: "#fff7ed", color: "#ea580c", border: "#ffedd5", label: "WARNING" },
              ADVISORY: { bg: "#fffbeb", color: "#d97706", border: "#fef3c7", label: "ADVISORY" },
              INFO:     { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0", label: "INFO" }
            };
            const sStyle = severityStyles[severity] || severityStyles.INFO;
            const icon = check.ok ? "✓" : severity === "BLOCKER" ? "⛔" : "⚠";

            return (
              <div
                key={check.label}
                className="compat-check"
                style={{
                  backgroundColor: sStyle.bg,
                  border: `1px solid ${sStyle.border}`,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  marginBottom: "6px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px"
                }}
              >
                <span className="compat-check__icon" style={{ color: sStyle.color, fontWeight: "bold" }} aria-hidden>{icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="compat-check__label" style={{ fontWeight: "700", fontSize: "12px", color: "#0f172a" }}>{check.label}</span>
                    <span style={{
                      fontSize: "10px",
                      fontWeight: "800",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      backgroundColor: sStyle.color,
                      color: "#ffffff"
                    }}>
                      {sStyle.label}
                    </span>
                  </div>
                  <span className="compat-check__detail" style={{ fontSize: "11px", color: "#475569", marginTop: "2px", display: "block" }}>{check.detail}</span>
                </div>
              </div>
            );
          })}
        </div>

        <button type="button" className="btn-compat-detail" onClick={() => onOpenXaiDrawer(true)}>
          🧠 Xem Giải Thích Chi Tiết XAI →
        </button>
      </div>

      {/* AI Insight */}
      <div className="ai-insight">
        <div className="ai-insight__header">
          <span className="ai-insight__icon">⚡</span>
          <span className="ai-insight__title">AI Insight</span>
        </div>
        <div className="ai-insight__text">
          {aiInsightText}
        </div>
        <button type="button" className="btn-ai-explain" onClick={() => onOpenXaiDrawer(true)}>
          Xem Giải Thích Đầy Đủ →
        </button>
      </div>

    </aside>
  );
}
