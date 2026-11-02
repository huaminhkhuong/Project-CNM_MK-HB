import { useState, useEffect } from "react";

/**
 * XAIExplanationDrawer — Panel giải thích tri thức phần cứng XAI tiếng Việt
 * Tối ưu hiển thị trực quan, phân loại linh kiện đã chọn và linh kiện chưa chọn
 * Tránh làm người dùng bị rối mắt với các luật kiểm tra của linh kiện chưa thêm vào cấu hình.
 */
export function XAIExplanationDrawer({ isOpen, onClose, xaiReport, isLoading = false, onRecheck }) {
  const [filter, setFilter] = useState("auto"); // 'auto' | 'error' | 'warning' | 'passed' | 'pending' | 'all'
  const [showEstimatedScores, setShowEstimatedScores] = useState(false);

  // Check dark theme
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    if (typeof document !== "undefined") {
      const checkDark = () => {
        const theme = document.documentElement.getAttribute("data-theme") || document.body.getAttribute("data-theme");
        setIsDark(theme === "dark");
      };
      checkDark();
      const observer = new MutationObserver(checkDark);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      return () => observer.disconnect();
    }
  }, []);

  if (!isOpen) return null;

  const checks = xaiReport?.checks || [];
  const summary = xaiReport?.summary || {};

  // Xác định luật nào là chờ chọn linh kiện
  const isPendingCheck = (c) => {
    if (c.applicable === false) return true;
    const d = (c.detail || "").toLowerCase();
    return d.includes("chưa được chọn") || d.includes("chưa chọn") || d.includes("chưa có");
  };

  const errorChecks = checks.filter(c => !c.ok && (c.severity === "BLOCKER" || c.explanation?.level === "error"));
  const warningChecks = checks.filter(c => !c.ok && c.severity !== "BLOCKER" && c.explanation?.level !== "error");
  const passedChecks = checks.filter(c => c.ok && !isPendingCheck(c));
  const pendingChecks = checks.filter(c => isPendingCheck(c));
  const evaluatedChecks = checks.filter(c => !isPendingCheck(c));

  // Auto-chọn tab ưu tiên: nếu có lỗi thì luôn ưu tiên mở tab lỗi đầu tiên!
  let activeFilter = filter;
  if (filter === "auto") {
    if (errorChecks.length > 0) activeFilter = "error";
    else if (warningChecks.length > 0) activeFilter = "warning";
    else activeFilter = "passed";
  }

  const filteredChecks = (() => {
    if (activeFilter === "error") return errorChecks;
    if (activeFilter === "warning") return warningChecks;
    if (activeFilter === "passed") return passedChecks;
    if (activeFilter === "pending") return pendingChecks;
    if (activeFilter === "evaluated") return evaluatedChecks;
    return checks; // 'all'
  })();

  const selectedCount = summary.selectedCount || 3;
  const isCompleteBuild = Boolean(summary.isCompleteBuild);

  // Clean raw tags [COMP-001] from short text for display
  const getCleanTitle = (item) => {
    const raw = item.explanation?.short || item.key || "Kiểm tra kỹ thuật";
    return raw.replace(/^[❌✅⚠️💡⏳\s]*(\[[^\]]+\]\s*)*/g, "").trim();
  };

  return (
    <div className="xai-drawer-overlay" onClick={onClose} style={styles.overlay}>
      <div
        className="xai-drawer-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          ...styles.drawer,
          backgroundColor: isDark ? "#0f172a" : "#ffffff",
          color: isDark ? "#f8fafc" : "#0f172a",
          borderLeft: isDark ? "1px solid #1e293b" : "none"
        }}
      >
        {/* HEADER */}
        <div style={styles.header}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px" }}>🧠</span>
              <h2 style={styles.title}>Trợ Lý Tri Thức Phần Cứng (XAI)</h2>
            </div>
            <p style={styles.subtitle}>
              Báo cáo giải thích lập luận tương thích và tối ưu linh kiện tự động
            </p>
          </div>
          <button style={styles.closeBtn} onClick={onClose} title="Đóng">✕</button>
        </div>

        {/* BODY */}
        {isLoading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner} />
            <p style={{ marginTop: "16px", color: "#3b82f6", fontWeight: "600", fontSize: "14px" }}>
              ⚡ AI Engine đang phân tích tương thích các linh kiện đã chọn...
            </p>
          </div>
        ) : !xaiReport || !xaiReport.checks || xaiReport.checks.length === 0 ? (
          <div style={styles.emptyStateContainer(isDark)}>
            <div style={{ fontSize: "52px", marginBottom: "16px" }}>🔍</div>
            <h3 style={{ margin: "0 0 8px 0", color: isDark ? "#f8fafc" : "#0f172a", fontSize: "17px", fontWeight: "700" }}>
              Chưa có dữ liệu kiểm tra tương thích
            </h3>
            <p style={{ margin: "0 0 24px 0", color: isDark ? "#94a3b8" : "#64748b", fontSize: "14px", lineHeight: "1.6", maxWidth: "380px" }}>
              Hãy chọn thêm ít nhất 2 linh kiện để AI tiến hành kiểm tra tương thích socket, RAM, nguồn điện và kích thước.
            </p>
            {onRecheck && (
              <button style={styles.recheckMainBtn} onClick={onRecheck}>
                ⚡ Kiểm tra tương thích ngay
              </button>
            )}
          </div>
        ) : (
          <>
            {/* OVERALL STATUS BANNER */}
            <div style={styles.summaryCard(isDark, errorChecks.length > 0)}>
              <div style={styles.scoreBadge(errorChecks.length === 0)}>
                <span style={{ fontSize: "26px", fontWeight: "900" }}>
                  {errorChecks.length === 0 ? "100%" : "0%"}
                </span>
                <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "800" }}>
                  {errorChecks.length === 0 ? "Khớp tốt" : "Xung đột"}
                </span>
                <span style={{
                  marginTop: "4px",
                  fontSize: "10px",
                  fontWeight: "800",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  backgroundColor: errorChecks.length === 0 ? "#16a34a" : "#dc2626",
                  color: "#ffffff"
                }}>
                  {errorChecks.length === 0 ? "TƯƠNG THÍCH" : "CẦN SỬA"}
                </span>
              </div>

              <div style={{ flex: 1 }}>
                <h4 style={{ margin: "0 0 6px 0", color: isDark ? "#f8fafc" : "#0f172a", fontSize: "15px", fontWeight: "700" }}>
                  {errorChecks.length > 0
                    ? `Phát hiện ${errorChecks.length} lỗi xung đột cấu hình cần khắc phục!`
                    : warningChecks.length > 0
                    ? `Cấu hình hoạt động được nhưng có ${warningChecks.length} điểm cần lưu ý.`
                    : "Các linh kiện đã chọn hoàn toàn tương thích và khớp chuẩn!"}
                </h4>

                {/* STATS PILLS */}
                <div style={styles.countsRow}>
                  {errorChecks.length > 0 && (
                    <span style={styles.countBadge("#fee2e2", "#dc2626", "#fecdd3")}>
                      🔴 Lỗi: {errorChecks.length}
                    </span>
                  )}
                  {warningChecks.length > 0 && (
                    <span style={styles.countBadge("#fef3c7", "#d97706", "#fde68a")}>
                      ⚠️ Lưu ý: {warningChecks.length}
                    </span>
                  )}
                  <span style={styles.countBadge("#dcfce7", "#16a34a", "#bbf7d0")}>
                    ✅ Đã khớp: {passedChecks.length}
                  </span>
                  {pendingChecks.length > 0 && (
                    <span style={styles.countBadge(isDark ? "#1e293b" : "#f1f5f9", isDark ? "#94a3b8" : "#64748b", isDark ? "#334155" : "#e2e8f0")}>
                      ⏳ Chờ chọn: {pendingChecks.length}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* PROGRESS BAR FOR INCOMPLETE BUILD */}
            {!isCompleteBuild ? (
              <div style={styles.progressCard(isDark)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12.5px", fontWeight: "700", color: isDark ? "#60a5fa" : "#2563eb" }}>
                    🛠️ Tiến trình lắp ráp: {selectedCount}/8 linh kiện
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: "800", color: isDark ? "#94a3b8" : "#64748b" }}>
                    {Math.min(100, Math.round((selectedCount / 8) * 100))}%
                  </span>
                </div>
                <div style={styles.progressTrack(isDark)}>
                  <div style={styles.progressFill((selectedCount / 8) * 100)} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                  <span style={{ fontSize: "11.5px", color: isDark ? "#94a3b8" : "#64748b" }}>
                    💡 AI đang kiểm tra trực tiếp {evaluatedChecks.length} quy tắc giữa các linh kiện đã chọn.
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowEstimatedScores(!showEstimatedScores)}
                    style={{
                      background: "none",
                      border: "none",
                      color: isDark ? "#38bdf8" : "#0284c7",
                      fontSize: "11.5px",
                      fontWeight: "700",
                      cursor: "pointer",
                      padding: "2px 4px"
                    }}
                  >
                    {showEstimatedScores ? "Ẩn điểm sơ bộ ▲" : "Xem điểm sơ bộ ▾"}
                  </button>
                </div>

                {showEstimatedScores && xaiReport.scores && (
                  <div style={{ ...styles.scorecardContainer, marginTop: "10px", paddingTop: "8px", borderTop: `1px dashed ${isDark ? "#334155" : "#e2e8f0"}` }}>
                    {styles.scorePill("🧩 Tương thích", xaiReport.scores.compatibilityScore, isDark)}
                    {styles.scorePill("🎮 Hiệu năng", xaiReport.scores.performanceScore, isDark)}
                    {styles.scorePill("💰 P/P Giá trị", xaiReport.scores.valueScore, isDark)}
                    {styles.scorePill("⚡ Nguồn/Nhiệt", xaiReport.scores.powerThermalScore, isDark)}
                    {styles.scorePill("🚀 Nâng cấp", xaiReport.scores.upgradeScore, isDark)}
                  </div>
                )}
              </div>
            ) : (
              xaiReport.scores && (
                <div style={styles.scorecardContainer}>
                  {styles.scorePill("🧩 Tương thích", xaiReport.scores.compatibilityScore, isDark)}
                  {styles.scorePill("🎮 Hiệu năng", xaiReport.scores.performanceScore, isDark)}
                  {styles.scorePill("💰 P/P Giá trị", xaiReport.scores.valueScore, isDark)}
                  {styles.scorePill("⚡ Nguồn/Nhiệt", xaiReport.scores.powerThermalScore, isDark)}
                  {styles.scorePill("🚀 Nâng cấp", xaiReport.scores.upgradeScore, isDark)}
                </div>
              )
            )}

            {/* ACTION BAR */}
            {onRecheck && (
              <div style={{ padding: "10px 24px 0", display: "flex", justifyContent: "flex-end" }}>
                <button onClick={onRecheck} style={styles.recheckBtn(isDark)}>
                  🔄 Cập nhật thẩm định AI
                </button>
              </div>
            )}

            {/* FILTER TABS */}
            <div style={{ ...styles.filterBar, borderBottomColor: isDark ? "#1e293b" : "#f1f5f9" }}>
              {errorChecks.length > 0 && (
                <button
                  style={styles.filterTab(activeFilter === "error", "#dc2626", isDark)}
                  onClick={() => setFilter("error")}
                >
                  🔴 Lỗi cần sửa ({errorChecks.length})
                </button>
              )}

              {warningChecks.length > 0 && (
                <button
                  style={styles.filterTab(activeFilter === "warning", "#d97706", isDark)}
                  onClick={() => setFilter("warning")}
                >
                  ⚠️ Lưu ý ({warningChecks.length})
                </button>
              )}

              <button
                style={styles.filterTab(activeFilter === "passed", "#16a34a", isDark)}
                onClick={() => setFilter("passed")}
              >
                ✅ Đã khớp ({passedChecks.length})
              </button>

              {pendingChecks.length > 0 && (
                <button
                  style={styles.filterTab(activeFilter === "pending", "#64748b", isDark)}
                  onClick={() => setFilter("pending")}
                >
                  ⏳ Chờ linh kiện ({pendingChecks.length})
                </button>
              )}

              <button
                style={styles.filterTab(activeFilter === "all", "#2563eb", isDark)}
                onClick={() => setFilter("all")}
              >
                📋 Tất cả ({checks.length})
              </button>
            </div>

            {/* CHECKS LIST */}
            <div style={styles.checksList}>
              {filteredChecks.length === 0 ? (
                <div style={{ ...styles.emptyState, color: isDark ? "#64748b" : "#94a3b8" }}>
                  Không có mục nào trong danh mục này.
                </div>
              ) : (
                filteredChecks.map((item, index) => {
                  const exp = item.explanation || {};
                  const isPending = isPendingCheck(item);
                  const isError = !item.ok && (item.severity === "BLOCKER" || exp.level === "error");
                  const isWarn = !item.ok && !isError;

                  const badgeMeta = isError
                    ? { label: "⛔ Xung đột nghiêm trọng", bg: "#dc2626", color: "#ffffff" }
                    : isWarn
                    ? { label: "⚠️ Cần lưu ý", bg: "#d97706", color: "#ffffff" }
                    : isPending
                    ? { label: "⏳ Chờ chọn linh kiện", bg: isDark ? "#334155" : "#e2e8f0", color: isDark ? "#94a3b8" : "#475569" }
                    : { label: "✅ Tương thích tốt", bg: "#16a34a", color: "#ffffff" };

                  return (
                    <div
                      key={index}
                      style={styles.checkCard(isError, isWarn, isPending, isDark)}
                    >
                      <div style={styles.checkCardHeader}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                          <span style={{ fontSize: "16px" }}>
                            {isError ? "❌" : isWarn ? "⚠️" : isPending ? "⏳" : "✅"}
                          </span>
                          <span style={{
                            ...styles.checkTitle,
                            color: isDark ? "#f8fafc" : "#0f172a"
                          }}>
                            {getCleanTitle(item)}
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <span style={{
                            fontSize: "11px",
                            fontWeight: "700",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            backgroundColor: badgeMeta.bg,
                            color: badgeMeta.color,
                            letterSpacing: "0.3px"
                          }}>
                            {badgeMeta.label}
                          </span>
                          {item.detail && !isPending && (
                            <span style={styles.detailTag(isDark)}>{item.detail}</span>
                          )}
                        </div>
                      </div>

                      <p style={{ ...styles.checkLongText, color: isDark ? "#cbd5e1" : "#334155" }}>
                        {isPending
                          ? `Quy tắc này sẽ tự động kiểm tra ngay khi bạn chọn thêm linh kiện liên quan (${item.detail || item.key}).`
                          : exp.long || item.detail || "Đã kiểm tra tương thích kỹ thuật."}
                      </p>

                      {exp.suggestion && isError && (
                        <div style={styles.suggestionBox(isDark, true)}>
                          <div style={{ fontWeight: "800", color: isDark ? "#f87171" : "#b91c1c", marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                            <span>💡</span>
                            <span>Đề xuất khắc phục ngay:</span>
                          </div>
                          <div style={{ lineHeight: "1.5" }}>{exp.suggestion}</div>
                        </div>
                      )}

                      {exp.suggestion && isWarn && (
                        <div style={styles.suggestionBox(isDark, false)}>
                          <div style={{ fontWeight: "800", color: isDark ? "#fbbf24" : "#b45309", marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                            <span>💡</span>
                            <span>Gợi ý tối ưu:</span>
                          </div>
                          <div style={{ lineHeight: "1.5" }}>{exp.suggestion}</div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* FOOTER */}
            <div style={{
              ...styles.footer,
              backgroundColor: isDark ? "#0f172a" : "#f8fafc",
              borderTopColor: isDark ? "#1e293b" : "#e2e8f0"
            }}>
              <span style={{ fontSize: "12.5px", color: isDark ? "#94a3b8" : "#64748b" }}>
                🤖 Thẩm định tự động bởi AI PC Mall Engine
              </span>
              <button style={styles.doneBtn} onClick={onClose}>Đã hiểu</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    backdropFilter: "blur(6px)",
    zIndex: 9999,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "stretch"
  },
  drawer: {
    width: "100%",
    maxWidth: "580px",
    boxShadow: "-8px 0 32px rgba(15, 23, 42, 0.4)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    animation: "slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
  },
  header: {
    padding: "20px 24px",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    color: "#ffffff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
  },
  title: {
    margin: 0,
    fontSize: "17px",
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: "-0.01em"
  },
  subtitle: {
    margin: "4px 0 0 0",
    fontSize: "12.5px",
    color: "#94a3b8"
  },
  closeBtn: {
    background: "rgba(255, 255, 255, 0.12)",
    border: "none",
    color: "#ffffff",
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    cursor: "pointer",
    fontSize: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.2s"
  },
  summaryCard: (isDark, hasErrors) => ({
    margin: "16px 24px 0",
    padding: "16px",
    backgroundColor: isDark
      ? hasErrors ? "rgba(225, 29, 72, 0.1)" : "#1e293b"
      : hasErrors ? "#fff1f2" : "#f8fafc",
    borderRadius: "16px",
    border: `1px solid ${hasErrors ? (isDark ? "#be123c" : "#fecdd3") : (isDark ? "#334155" : "#e2e8f0")}`,
    display: "flex",
    gap: "16px",
    alignItems: "center"
  }),
  scoreBadge: (compatible) => ({
    backgroundColor: compatible ? "#ecfdf5" : "#fff1f2",
    color: compatible ? "#15803d" : "#be123c",
    border: `2px solid ${compatible ? "#bbf7d0" : "#fecdd3"}`,
    borderRadius: "14px",
    padding: "10px 14px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minWidth: "105px"
  }),
  countsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "8px"
  },
  countBadge: (bg, color, border) => ({
    backgroundColor: bg,
    color: color,
    border: border ? `1px solid ${border}` : "none",
    fontSize: "11.5px",
    fontWeight: "700",
    padding: "3px 9px",
    borderRadius: "14px"
  }),
  progressCard: (isDark) => ({
    margin: "12px 24px 0",
    padding: "12px 14px",
    backgroundColor: isDark ? "rgba(30, 41, 59, 0.6)" : "#f0f9ff",
    borderRadius: "12px",
    border: `1px solid ${isDark ? "#334155" : "#bae6fd"}`
  }),
  progressTrack: (isDark) => ({
    width: "100%",
    height: "6px",
    backgroundColor: isDark ? "#334155" : "#e2e8f0",
    borderRadius: "99px",
    overflow: "hidden"
  }),
  progressFill: (percent) => ({
    width: `${Math.min(100, Math.max(0, percent))}%`,
    height: "100%",
    background: "linear-gradient(90deg, #3b82f6, #06b6d4)",
    borderRadius: "99px",
    transition: "width 0.4s ease"
  }),
  filterBar: {
    display: "flex",
    gap: "6px",
    padding: "14px 24px 8px",
    borderBottom: "1px solid #f1f5f9",
    overflowX: "auto"
  },
  filterTab: (active, activeColor = "#2563eb", isDark = false) => ({
    padding: "7px 12px",
    borderRadius: "18px",
    border: active ? "none" : `1px solid ${isDark ? "#334155" : "#cbd5e1"}`,
    backgroundColor: active ? activeColor : isDark ? "rgba(30, 41, 59, 0.7)" : "#ffffff",
    color: active ? "#ffffff" : isDark ? "#cbd5e1" : "#475569",
    fontWeight: active ? "700" : "600",
    fontSize: "12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.15s ease",
    boxShadow: active ? `0 2px 8px ${activeColor}55` : "none"
  }),
  checksList: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },
  scorecardContainer: {
    margin: "8px 24px 0",
    display: "flex",
    flexWrap: "wrap",
    gap: "6px"
  },
  scorePill: (label, score, isDark = false) => (
    <div key={label} style={{
      fontSize: "11px",
      fontWeight: "600",
      padding: "4px 8px",
      borderRadius: "8px",
      backgroundColor: isDark ? "rgba(30, 41, 59, 0.8)" : "#f1f5f9",
      color: isDark ? "#cbd5e1" : "#334155",
      border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
      display: "flex",
      alignItems: "center",
      gap: "4px"
    }}>
      <span>{label}:</span>
      <span style={{ fontWeight: "800", color: score >= 80 ? "#16a34a" : score >= 60 ? "#d97706" : "#dc2626" }}>
        {score ?? 0}%
      </span>
    </div>
  ),
  emptyStateContainer: (isDark) => ({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 24px",
    textAlign: "center",
    backgroundColor: isDark ? "#0f172a" : "#fafafa"
  }),
  recheckMainBtn: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    padding: "12px 24px",
    borderRadius: "12px",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "14px",
    boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)",
    transition: "all 0.2s ease"
  },
  recheckBtn: (isDark) => ({
    backgroundColor: isDark ? "rgba(37, 99, 235, 0.15)" : "#eff6ff",
    color: isDark ? "#93c5fd" : "#1d4ed8",
    border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.3)" : "#bfdbfe"}`,
    padding: "6px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px"
  }),
  emptyState: {
    textAlign: "center",
    padding: "40px 0",
    fontSize: "14px"
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 24px",
    textAlign: "center"
  },
  spinner: {
    width: "36px",
    height: "36px",
    border: "3px solid rgba(59, 130, 246, 0.2)",
    borderTop: "3px solid #2563eb",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite"
  },
  checkCard: (isError, isWarn, isPending, isDark) => {
    let bg = isDark ? "#1e293b" : "#ffffff";
    let border = isDark ? "#334155" : "#e2e8f0";

    if (isError) {
      bg = isDark ? "rgba(225, 29, 72, 0.08)" : "#fff1f2";
      border = isDark ? "rgba(225, 29, 72, 0.4)" : "#fecdd3";
    } else if (isWarn) {
      bg = isDark ? "rgba(217, 119, 6, 0.08)" : "#fffbeb";
      border = isDark ? "rgba(217, 119, 6, 0.4)" : "#fde68a";
    } else if (isPending) {
      bg = isDark ? "rgba(30, 41, 59, 0.35)" : "#f8fafc";
      border = isDark ? "#334155" : "#f1f5f9";
    } else {
      bg = isDark ? "rgba(16, 185, 129, 0.05)" : "#f0fdf4";
      border = isDark ? "rgba(16, 185, 129, 0.25)" : "#bbf7d0";
    }

    return {
      padding: "12px 14px",
      borderRadius: "12px",
      border: `1px solid ${border}`,
      backgroundColor: bg,
      transition: "transform 0.15s ease"
    };
  },
  checkCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "4px"
  },
  checkTitle: {
    fontWeight: "700",
    fontSize: "13.5px"
  },
  detailTag: (isDark) => ({
    fontSize: "11px",
    fontWeight: "700",
    backgroundColor: isDark ? "#0f172a" : "#ffffff",
    padding: "2px 8px",
    borderRadius: "6px",
    color: isDark ? "#93c5fd" : "#2563eb",
    border: `1px solid ${isDark ? "#334155" : "#cbd5e1"}`
  }),
  checkLongText: {
    margin: "4px 0",
    fontSize: "12.5px",
    lineHeight: "1.5"
  },
  suggestionBox: (isDark, isError = true) => ({
    marginTop: "8px",
    padding: "8px 10px",
    backgroundColor: isDark ? "rgba(15, 23, 42, 0.6)" : "#ffffff",
    borderRadius: "8px",
    fontSize: "12px",
    color: isDark ? "#f1f5f9" : "#1e293b",
    borderLeft: `3px solid ${isError ? "#dc2626" : "#d97706"}`
  }),
  footer: {
    padding: "14px 24px",
    borderTop: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  doneBtn: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    padding: "8px 18px",
    borderRadius: "10px",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "13.5px",
    boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)"
  }
};
