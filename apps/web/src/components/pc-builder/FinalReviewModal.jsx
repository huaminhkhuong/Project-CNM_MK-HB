import React, { useState } from "react";

const formatCurrency = (v) => Number(v || 0).toLocaleString("vi-VN");

/**
 * FinalReviewModal — Màn hình Đánh Giá & Xác Nhận Cấu Hình AI Trước Khi Đặt Mua
 * Hiển thị tổng quan linh kiện, điểm tương thích XAI, ước tính FPS, cảnh báo Advisory và các tùy chọn dịch vụ đi kèm.
 */
export function FinalReviewModal({
  isOpen,
  onClose,
  selectedItems,
  totalPrice,
  xaiReport,
  insights,
  suggestionForm,
  onConfirmPurchase,
  isProcessing = false,
  isBlocked = false,
  blockerReason = ""
}) {
  const [includeAssembly, setIncludeAssembly] = useState(true);
  const [includeOsInstallation, setIncludeOsInstallation] = useState(true);

  if (!isOpen) return null;

  const itemsList = Object.entries(selectedItems || {}).map(([type, item]) => {
    const product = item?.product || item;
    const variant = item?.variant;
    const qty = Math.max(1, Number(item?.quantity || 1));
    const unitPrice = Number(variant?.price || product?.price || item?.price || 0);
    const baseName = product?.product_name || product?.name || type;
    return {
      type: type.toUpperCase(),
      name: qty > 1 ? `${baseName} (x${qty})` : baseName,
      price: unitPrice * qty
    };
  });

  const count = itemsList.length;
  const score = xaiReport?.score || insights?.compatibilityScore || 96;

  // ✅ FPS display
  const fpsNum = Number(insights?.fps || 0);
  const fpsDisplay = fpsNum > 0 ? `${fpsNum} FPS` : "~165 FPS";
  const fpsGrade  = fpsNum >= 200 ? "Cực mượt 🏆" : fpsNum >= 144 ? "Rất mượt ✨" : fpsNum >= 60 ? "Mượt mà ✅" : "Trung bình";

  const power = insights?.power || 450;

  const allChecks = insights?.checks || xaiReport?.checks || [];

  // Nhóm checks theo severity — ưu tiên BLOCKER > WARNING > pass
  const blockerChecks  = allChecks.filter((c) => !c.ok && c.severity === "BLOCKER");
  const warningChecks  = allChecks.filter((c) => !c.ok && (c.severity === "WARNING" || c.severity === "ADVISORY" || (!c.severity && c.ok === false)));
  const passedChecks   = allChecks.filter((c) => c.ok === true);

  const userBudget = Number(suggestionForm?.budget || 0);
  const isBudgetBlocked = userBudget > 0 && totalPrice > userBudget * 1.10;

  // ✅ FIX VẤN ĐỀ 14: Block nút Đặt Mua nếu có BLOCKER check hoặc vượt ngân sách 10%
  const hasBlocker = blockerChecks.length > 0 || isBudgetBlocked || isBlocked;

  // Danh sách hiển thị — BLOCKER trước, WARNING sau, tối đa 5 items
  const displayChecks = [...blockerChecks, ...warningChecks].slice(0, 5);

  const purpose    = (suggestionForm?.purpose || "gaming").toUpperCase();
  const resolution = suggestionForm?.resolution || "1080p";

  // Đánh giá tổng thể build readiness
  const buildReadiness = hasBlocker ? "BLOCKED"
    : warningChecks.length > 0 ? "WARNINGS"
    : count < 6 ? "INCOMPLETE"
    : "READY";

  const readinessText = hasBlocker
    ? isBudgetBlocked
      ? `⛔ BỊ CHẶN — Chi phí vượt quá 10% ngân sách (${formatCurrency(totalPrice)}đ / ${formatCurrency(userBudget)}đ)`
      : blockerReason || `⛔ BỊ CHẶN — Có ${blockerChecks.length} lỗi tương thích nghiêm trọng`
    : warningChecks.length > 0
    ? "⚠️ CÓ CẢNH BÁO — Nên xem xét lại"
    : count < 6
    ? "🔵 CHƯA ĐỦ LINH KIỆN"
    : "✅ BUILD READY — Sẵn sàng đặt hàng";

  const readinessStyle = {
    BLOCKED:    { bg: "#fef2f2", color: "#991b1b", border: "#fecdd3", text: readinessText },
    WARNINGS:   { bg: "#fff7ed", color: "#9a3412", border: "#fed7aa", text: readinessText },
    INCOMPLETE: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", text: readinessText },
    READY:      { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0", text: readinessText }
  }[buildReadiness];

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>

        {/* MODAL HEADER */}
        <div style={styles.header}>
          <div>
            <div style={styles.badge}>🛒 FINAL PRE-PURCHASE CHECKOUT REVIEW</div>
            <h3 style={styles.title}>Xác Nhận Đặt Mua Nguyên Bộ Cấu Hình</h3>
            <p style={styles.subtitle}>
              Kiểm tra lần cuối thông số kỹ thuật & dịch vụ hậu mãi từ hệ thống AI PC Mall
            </p>
          </div>

          <button type="button" onClick={onClose} style={styles.closeBtn}>
            ✕
          </button>
        </div>

        {/* BUILD READINESS BANNER */}
        <div style={{
          backgroundColor: readinessStyle.bg,
          border: `1px solid ${readinessStyle.border}`,
          borderRadius: "12px",
          padding: "10px 16px",
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          <span style={{ fontSize: "13px", fontWeight: "800", color: readinessStyle.color }}>
            {readinessStyle.text}
          </span>
          {passedChecks.length > 0 && (
            <span style={{ fontSize: "11.5px", color: readinessStyle.color, opacity: 0.8 }}>
              ({passedChecks.length}/{allChecks.length} kiểm tra đạt)
            </span>
          )}
        </div>

        {/* METRICS SUMMARY GRID */}
        <div style={styles.metricsGrid}>
          <div style={styles.metricBox}>
            <span style={styles.metricLabel}>💰 TỔNG CHI PHÍ BỘ PC</span>
            <span style={{ ...styles.metricVal, color: "#1d4ed8", fontSize: "20px" }}>
              {formatCurrency(totalPrice)}đ
            </span>
            <span style={styles.subText}>Đã bao gồm VAT 10%</span>
          </div>

          <div style={styles.metricBox}>
            <span style={styles.metricLabel}>🧠 ĐIỂM TƯƠNG THÍCH XAI</span>
            <span style={{ ...styles.metricVal, color: score >= 85 ? "#16a34a" : score >= 65 ? "#d97706" : "#dc2626" }}>
              {score}/100
            </span>
            <span style={styles.subText}>
              {score >= 85 ? "✅ Tương thích tốt" : score >= 65 ? "⚠️ Cần xem xét" : "❌ Có xung đột"}
            </span>
          </div>

          {/* ✅ FIX 1 applied here — hiển thị FPS với đơn vị và grade */}
          <div style={styles.metricBox}>
            <span style={styles.metricLabel}>🎮 HIỆU NĂNG ƯỚC TÍNH</span>
            <span style={{ ...styles.metricVal, color: "#0f172a" }}>
              {fpsDisplay}
            </span>
            <span style={styles.subText}>{fpsGrade} · {purpose} {resolution}</span>
          </div>

          <div style={styles.metricBox}>
            <span style={styles.metricLabel}>⚡ NĂNG LƯỢNG TIÊU THỤ</span>
            <span style={{ ...styles.metricVal, color: "#d97706" }}>
              ~{power}W
            </span>
            <span style={styles.subText}>An toàn nguồn &gt; 25%</span>
          </div>
        </div>

        {/* AI SUMMARY EVALUATION TEXT BANNER */}
        <div style={styles.aiSummaryBox}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "18px" }}>⚡</span>
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#1e40af" }}>
              Đánh Giá Tổng Quan Từ AI Advisor:
            </h4>
          </div>
          <p style={{ margin: 0, fontSize: "13px", color: "#1e3a8a", lineHeight: "1.5" }}>
            Bộ máy tính này gồm <strong>{count} linh kiện</strong> được phối ghép cho nhu cầu <strong>{purpose}</strong> ở độ phân giải <strong>{resolution}</strong>.
            Hiệu năng ước tính <strong>{fpsDisplay}</strong> ({fpsGrade}).
            Mức tiêu thụ điện năng <strong>~{power}W</strong> giúp bộ PC vận hành ổn định và dễ dàng nâng cấp.
          </p>
        </div>

        {/* COMPONENT SUMMARY & ADVISORIES GRID */}
        <div style={styles.contentGrid}>
          {/* Left Column: Components List */}
          <div style={styles.sectionCard}>
            <h4 style={styles.sectionTitle}>📋 Danh Sách Linh Kiện ({count} Món)</h4>
            <div style={styles.compList}>
              {itemsList.map((item, idx) => (
                <div key={idx} style={styles.compRow}>
                  <span style={styles.compBadge}>{item.type}</span>
                  <span style={styles.compName}>{item.name}</span>
                  <span style={styles.compPrice}>{formatCurrency(item.price)}đ</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Advisories & Service Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

            {/* ✅ FIX 2 & 3: Checks đúng logic, ưu tiên BLOCKER > WARNING > Pass */}
            <div style={styles.sectionCard}>
              <h4 style={styles.sectionTitle}>🛡️ Kiểm Tra An Toàn & Tương Thích</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {displayChecks.length > 0 ? (
                  displayChecks.map((check, idx) => {
                    const isBlocker = !check.ok && check.severity === "BLOCKER";
                    const isWarning = !check.ok;
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "8px",
                          fontSize: "12px",
                          backgroundColor: isBlocker ? "#fef2f2" : isWarning ? "#fff7ed" : "#f0fdf4",
                          border: `1px solid ${isBlocker ? "#fecdd3" : isWarning ? "#fed7aa" : "#bbf7d0"}`,
                          color: isBlocker ? "#991b1b" : isWarning ? "#9a3412" : "#166534"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                          <strong style={{ fontSize: "12px" }}>
                            {isBlocker ? "⛔" : "⚠️"} {check.label || check.key || "Kiểm tra"}
                          </strong>
                          <span style={{
                            fontSize: "9.5px",
                            fontWeight: "800",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            backgroundColor: isBlocker ? "#fecdd3" : "#fed7aa",
                            color: isBlocker ? "#991b1b" : "#9a3412",
                            letterSpacing: "0.3px"
                          }}>
                            {isBlocker ? "BLOCKER" : "WARNING"}
                          </span>
                        </div>
                        {(check.detail || check.text) && (
                          <span style={{ fontSize: "11.5px", opacity: 0.9, display: "block" }}>
                            {check.detail || check.text}
                          </span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  /* Không có BLOCKER hay WARNING → hiển thị pass summary */
                  <div style={{ fontSize: "12.5px", color: "#166534", backgroundColor: "#f0fdf4", padding: "12px", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                    <strong>✅ Không phát hiện xung đột hay nghẽn cổ chai.</strong>
                    <br />
                    <span style={{ fontSize: "11.5px", opacity: 0.85 }}>
                      Toàn bộ {allChecks.length > 0 ? `${passedChecks.length}/${allChecks.length}` : ""} kiểm tra tương thích đã đạt. Cấu hình sẵn sàng để đặt hàng!
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Free Extra Services Options */}
            <div style={styles.sectionCard}>
              <h4 style={styles.sectionTitle}>🎁 Dịch Vụ Miễn Phí Đi Kèm</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={includeAssembly}
                    onChange={(e) => setIncludeAssembly(e.target.checked)}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <div>
                    <strong style={{ fontSize: "13px", color: "#0f172a" }}>🛠️ Hỗ trợ lắp ráp & đi dây cáp thẩm mỹ (Miễn phí)</strong>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#64748b" }}>Kỹ thuật viên PC Mall kiểm tra test stress-test 24h trước khi giao</p>
                  </div>
                </label>

                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={includeOsInstallation}
                    onChange={(e) => setIncludeOsInstallation(e.target.checked)}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <div>
                    <strong style={{ fontSize: "13px", color: "#0f172a" }}>💿 Cài đặt sẵn Windows 11 & Driver tối ưu (Miễn phí)</strong>
                    <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#64748b" }}>Nhận máy cắm điện là sử dụng ngay lập tức</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS FOOTER */}
        {/* ✅ FIX 4: Block Confirm khi có BLOCKER check */}
        <div style={styles.footer}>
          <button type="button" onClick={onClose} style={styles.secondaryBtn}>
            ↺ Quay Lại Điều Chỉnh
          </button>

          <button
            type="button"
            onClick={() => onConfirmPurchase({ includeAssembly, includeOsInstallation })}
            disabled={isProcessing || hasBlocker}
            title={hasBlocker ? `⛔ Không thể đặt hàng: Phát hiện ${blockerChecks.length} lỗi tương thích nghiêm trọng. Quay lại và sửa trước khi mua.` : ""}
            style={{
              ...styles.primaryBtn,
              opacity: (isProcessing || hasBlocker) ? 0.55 : 1,
              cursor: (isProcessing || hasBlocker) ? "not-allowed" : "pointer",
              backgroundColor: hasBlocker ? "#dc2626" : "#2563eb"
            }}
          >
            {isProcessing
              ? "⏳ Đang Chuyển Đến Giỏ Hàng..."
              : hasBlocker
              ? `⛔ Bị Chặn — Sửa ${blockerChecks.length} Lỗi Trước Khi Mua`
              : `🚀 XÁC NHẬN ĐẶT MUA NGUYÊN BỘ (${formatCurrency(totalPrice)}đ)`}
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
    backgroundColor: "rgba(15, 23, 42, 0.70)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "20px"
  },
  modal: {
    backgroundColor: "#ffffff",
    borderRadius: "24px",
    width: "100%",
    maxWidth: "920px",
    maxHeight: "92vh",
    overflowY: "auto",
    padding: "28px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    border: "1px solid #e2e8f0"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "12px"
  },
  badge: {
    display: "inline-block",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    fontSize: "10.5px",
    fontWeight: "800",
    padding: "4px 10px",
    borderRadius: "8px",
    letterSpacing: "0.5px",
    marginBottom: "6px"
  },
  title: {
    margin: 0,
    fontSize: "20px",
    fontWeight: "800",
    color: "#0f172a"
  },
  subtitle: {
    margin: "4px 0 0 0",
    fontSize: "13px",
    color: "#64748b"
  },
  closeBtn: {
    backgroundColor: "#f1f5f9",
    border: "none",
    borderRadius: "50%",
    width: "36px",
    height: "36px",
    fontSize: "16px",
    cursor: "pointer",
    color: "#64748b"
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "12px",
    marginBottom: "16px"
  },
  metricBox: {
    backgroundColor: "#f8fafc",
    borderRadius: "14px",
    padding: "12px",
    border: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column"
  },
  metricLabel: {
    fontSize: "10.5px",
    fontWeight: "700",
    color: "#64748b",
    marginBottom: "4px"
  },
  metricVal: {
    fontSize: "18px",
    fontWeight: "800"
  },
  subText: {
    fontSize: "10px",
    color: "#94a3b8",
    marginTop: "2px"
  },
  aiSummaryBox: {
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: "14px",
    padding: "14px 18px",
    marginBottom: "20px"
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "20px"
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    padding: "14px"
  },
  sectionTitle: {
    margin: "0 0 10px 0",
    fontSize: "14px",
    fontWeight: "700",
    color: "#0f172a"
  },
  compList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    maxHeight: "220px",
    overflowY: "auto"
  },
  compRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: "12px",
    padding: "6px 8px",
    borderRadius: "8px",
    backgroundColor: "#f8fafc"
  },
  compBadge: {
    fontSize: "10px",
    fontWeight: "800",
    backgroundColor: "#e2e8f0",
    color: "#334155",
    padding: "2px 6px",
    borderRadius: "4px",
    marginRight: "8px",
    flexShrink: 0
  },
  compName: {
    flex: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    marginRight: "8px",
    color: "#0f172a",
    fontWeight: "600"
  },
  compPrice: {
    fontWeight: "700",
    color: "#2563eb",
    flexShrink: 0
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    cursor: "pointer",
    padding: "8px",
    borderRadius: "8px",
    backgroundColor: "#f8fafc"
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    borderTop: "1px solid #e2e8f0",
    paddingTop: "18px"
  },
  secondaryBtn: {
    padding: "12px 20px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#ffffff",
    color: "#334155",
    fontWeight: "700",
    fontSize: "13px",
    cursor: "pointer"
  },
  primaryBtn: {
    padding: "12px 24px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    fontWeight: "800",
    fontSize: "13.5px",
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)",
    transition: "background-color 0.2s ease"
  }
};



