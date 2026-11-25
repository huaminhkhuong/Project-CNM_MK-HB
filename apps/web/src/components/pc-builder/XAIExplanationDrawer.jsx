import { useState, useEffect, useMemo } from "react";
import {
  getSelectedProduct,
  getProductName,
  getProductBrand,
  findSpec,
  normalizeText,
  parseNumber
} from "./pcBuilderUtils";
import { SPEC_ALIASES } from "./pcBuilderConstants";

/**
 * XAIExplanationDrawer — Trạm Chẩn Đoán Phần Cứng & Giải Thích Tri Thức XAI Chuẩn Tech-Studio
 * Tối ưu hóa UI/UX:
 * 1. HUD Bar tinh gọn tích hợp nhịp tim trạng thái + tiến trình + thẩm định lại.
 * 2. Visual Spec Clash Box đối chiếu trực tiếp thông số 2 linh kiện (CPU vs Mainboard Socket, RAM DDR4 vs DDR5...).
 * 3. Phím tắt 1 chạm khắc phục nhanh (Đổi Mainboard, Đổi CPU...) giải quyết tức thì.
 * 4. Khử trùng lặp thông minh giữa luật Heuristic và luật Database (RULE-xxx).
 * 5. Ngôn ngữ tự nhiên, không rớt dòng tiêu đề, hỗ trợ Dark Mode & Light Mode hoàn hảo.
 */
export function XAIExplanationDrawer({
  isOpen,
  onClose,
  xaiReport,
  isLoading = false,
  onRecheck,
  selectedItems = {},
  onNavigateComponent
}) {
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

  const checks = xaiReport?.checks || [];
  const summary = xaiReport?.summary || {};

  // Xác định luật nào là chờ chọn linh kiện
  const isPendingCheck = (c) => {
    if (c.applicable === false) return true;
    const d = (c.detail || "").toLowerCase();
    return d.includes("chưa được chọn") || d.includes("chưa chọn") || d.includes("chưa có");
  };

  // Khử trùng lặp và gom nhóm các luật xung đột cùng loại
  const dedupedChecks = useMemo(() => {
    const list = [];
    const seenDomains = new Map(); // domain -> index

    // Sort: blockers first, then warnings, then passed, then pending
    const sorted = [...checks].sort((a, b) => {
      const getWeight = (c) => {
        if (!c.ok) return c.severity === "BLOCKER" ? 0 : 1;
        if (isPendingCheck(c)) return 3;
        return 2;
      };
      return getWeight(a) - getWeight(b);
    });

    for (const c of sorted) {
      const k = (c.key || "").toLowerCase();
      const short = (c.explanation?.short || "").toLowerCase();
      const detail = (c.detail || "").toLowerCase();

      let domain = null;
      if (k === "socket" || (k.startsWith("rule_") && (short.includes("socket") || detail.includes("socket")))) {
        domain = "socket";
      } else if (k === "ram" || (k.startsWith("rule_") && (short.includes("ram") || detail.includes("ram") || detail.includes("ddr")))) {
        domain = "ram";
      } else if (k === "psu" || (k.startsWith("rule_") && (short.includes("công suất") || detail.includes("watt") || detail.includes("nguồn")))) {
        domain = "psu";
      } else if (k.includes("gpu_clearance") || (k.startsWith("rule_") && (short.includes("chiều dài gpu") || detail.includes("vga")))) {
        domain = "gpu_clearance";
      }

      const ruleId = c.ruleId || c.explanation?.ruleId || (c.key.startsWith("rule_") ? `RULE-${c.key.replace("rule_", "")}` : null);

      if (domain && !c.ok) {
        if (seenDomains.has(domain)) {
          const idx = seenDomains.get(domain);
          const existing = list[idx];
          if (ruleId && !existing.ruleBadges.includes(ruleId)) {
            existing.ruleBadges.push(ruleId);
          }
          if (c.explanation?.suggestion && !existing.explanation?.suggestion) {
            existing.explanation = { ...existing.explanation, suggestion: c.explanation.suggestion };
          }
          continue; // skip duplicate entry
        }
        seenDomains.set(domain, list.length);
        list.push({
          ...c,
          _domain: domain,
          ruleBadges: ruleId ? [ruleId] : []
        });
      } else {
        list.push({
          ...c,
          ruleBadges: ruleId ? [ruleId] : []
        });
      }
    }

    return list;
  }, [checks]);

  const errorChecks = dedupedChecks.filter(c => !c.ok && (c.severity === "BLOCKER" || c.explanation?.level === "error"));
  const warningChecks = dedupedChecks.filter(c => !c.ok && c.severity !== "BLOCKER" && c.explanation?.level !== "error");
  const passedChecks = dedupedChecks.filter(c => c.ok && !isPendingCheck(c));
  const pendingChecks = dedupedChecks.filter(c => isPendingCheck(c));
  const evaluatedChecks = dedupedChecks.filter(c => !isPendingCheck(c));

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
    return dedupedChecks; // 'all'
  })();

  const selectedCount = summary.selectedCount || Object.values(selectedItems || {}).filter(item => Boolean(getSelectedProduct(item)?.id || getSelectedProduct(item)?.product_id)).length || 3;
  const isCompleteBuild = Boolean(summary.isCompleteBuild) || selectedCount >= 8;

  // Clean raw tags [COMP-001] from short text for display
  const getCleanTitle = (item) => {
    const raw = item.explanation?.short || item.key || "Kiểm tra kỹ thuật";
    return raw.replace(/^[❌✅⚠️💡⏳\s]*(\[[^\]]+\]\s*)*/g, "").trim();
  };

  // Clean parenthesized repetitions from body text
  const cleanLongText = (text) => {
    if (!text) return "";
    return text
      .replace(/\s*\([A-Z\s_]+:[^)]+\)\.?/g, "")
      .replace(/\s*\(\s*\)/g, "")
      .trim();
  };

  if (!isOpen) return null;

  return (
    <div className="xai-drawer-overlay" onClick={onClose} style={styles.overlay}>
      <div
        className="xai-drawer-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          ...styles.drawer,
          backgroundColor: isDark ? "#0b0f19" : "#ffffff",
          color: isDark ? "#f8fafc" : "#0f172a",
          borderLeft: isDark ? "1px solid #1e293b" : "none"
        }}
      >
        {/* HEADER */}
        <div style={styles.header}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={styles.headerIconWrap}>
              <span style={{ fontSize: "20px" }}>🧠</span>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 style={styles.title}>Trợ Lý Tri Thức Phần Cứng (XAI)</h2>
                <span style={styles.versionBadge}>v2.5 AI Engine</span>
              </div>
              <p style={styles.subtitle}>
                Chẩn đoán tương thích vật lý, logic dòng điện và xung đột linh kiện tự động
              </p>
            </div>
          </div>
          <button style={styles.closeBtn} onClick={onClose} title="Đóng">✕</button>
        </div>

        {/* BODY */}
        {isLoading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner} />
            <p style={{ marginTop: "16px", color: "#38bdf8", fontWeight: "700", fontSize: "14px" }}>
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
            {/* ── CYBER HARDWARE DIAGNOSTIC HUD BAR ────────────────────── */}
            <div style={styles.hudCard(isDark, errorChecks.length > 0)}>
              {/* Row 1: Pulse Status Badge + Mini Progress + Recheck */}
              <div style={styles.hudTopRow}>
                <div style={styles.statusPill(errorChecks.length > 0, warningChecks.length > 0)}>
                  <span style={styles.statusPulse(errorChecks.length > 0)} />
                  <span style={{ fontWeight: "800", fontSize: "12.5px", letterSpacing: "0.3px" }}>
                    {errorChecks.length > 0
                      ? `PHÁT HIỆN ${errorChecks.length} XUNG ĐỘT PHẦN CỨNG`
                      : warningChecks.length > 0
                      ? `CÓ ${warningChecks.length} ĐIỂM CẦN LƯU Ý`
                      : "CẤU HÌNH HOÀN TOÀN TƯƠNG THÍCH"}
                  </span>
                </div>

                <div style={styles.miniProgressContainer}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "11.5px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b" }}>
                      Lắp ráp:
                    </span>
                    <span style={{ fontSize: "12px", fontWeight: "800", color: isDark ? "#38bdf8" : "#0284c7" }}>
                      {selectedCount}/8
                    </span>
                  </div>
                  <div style={styles.miniProgressTrack(isDark)}>
                    <div style={styles.miniProgressFill((selectedCount / 8) * 100)} />
                  </div>
                </div>

                {onRecheck && (
                  <button onClick={onRecheck} style={styles.recheckMiniBtn(isDark)} title="Quét lại toàn bộ quy tắc">
                    🔄 Quét lại
                  </button>
                )}
              </div>

              {/* Row 2: Sub-message & 5D Scorecard trigger */}
              <div style={styles.hudBottomRow}>
                <span style={{ fontSize: "12px", color: isDark ? "#cbd5e1" : "#475569", flex: 1, lineHeight: "1.4" }}>
                  {errorChecks.length > 0
                    ? "Cần khắc phục các xung đột bên dưới trước khi tiến hành mua sắm và lắp ráp máy."
                    : warningChecks.length > 0
                    ? "Các linh kiện lắp vừa vặn, xem thêm gợi ý để tối ưu luồng gió và hiệu năng."
                    : "Các linh kiện đã chọn hoàn toàn ăn khớp chân cắm, chuẩn RAM và điện áp."}
                </span>
                <button
                  type="button"
                  onClick={() => setShowEstimatedScores(!showEstimatedScores)}
                  style={styles.toggleScoreBtn(isDark)}
                >
                  {showEstimatedScores ? "Ẩn điểm 5D ▲" : "Xem điểm 5D ▾"}
                </button>
              </div>

              {/* Expandable 5D Scorecard */}
              {showEstimatedScores && xaiReport.scores && (
                <div style={styles.scorecardContainer(isDark)}>
                  {styles.scorePill("🧩 Tương thích", xaiReport.scores.compatibilityScore, isDark)}
                  {styles.scorePill("🎮 Hiệu năng", xaiReport.scores.performanceScore, isDark)}
                  {styles.scorePill("💰 P/P Giá trị", xaiReport.scores.valueScore, isDark)}
                  {styles.scorePill("⚡ Nguồn/Nhiệt", xaiReport.scores.powerThermalScore, isDark)}
                  {styles.scorePill("🚀 Nâng cấp", xaiReport.scores.upgradeScore, isDark)}
                </div>
              )}
            </div>

            {/* ── SMART FILTER TABS ───────────────────────────────────── */}
            <div style={styles.filterBar(isDark)}>
              {errorChecks.length > 0 && (
                <button
                  style={styles.filterTab(activeFilter === "error", "#ef4444", isDark)}
                  onClick={() => setFilter("error")}
                >
                  🔴 Lỗi xung đột ({errorChecks.length})
                </button>
              )}

              {warningChecks.length > 0 && (
                <button
                  style={styles.filterTab(activeFilter === "warning", "#f59e0b", isDark)}
                  onClick={() => setFilter("warning")}
                >
                  ⚠️ Lưu ý ({warningChecks.length})
                </button>
              )}

              <button
                style={styles.filterTab(activeFilter === "passed", "#10b981", isDark)}
                onClick={() => setFilter("passed")}
              >
                ✅ Đã tương thích ({passedChecks.length})
              </button>

              {pendingChecks.length > 0 && (
                <button
                  style={styles.filterTab(activeFilter === "pending", "#64748b", isDark)}
                  onClick={() => setFilter("pending")}
                >
                  ⏳ Chờ thêm linh kiện ({pendingChecks.length})
                </button>
              )}

              <button
                style={styles.filterTab(activeFilter === "all", "#3b82f6", isDark)}
                onClick={() => setFilter("all")}
              >
                📋 Toàn bộ ({dedupedChecks.length})
              </button>
            </div>

            {/* ── CHECKS LIST ─────────────────────────────────────────── */}
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
                    ? { label: "⛔ XUNG ĐỘT", bg: "#ef4444", color: "#ffffff" }
                    : isWarn
                    ? { label: "⚠️ CẦN LƯU Ý", bg: "#f59e0b", color: "#ffffff" }
                    : isPending
                    ? { label: "⏳ CHỜ CHỌN", bg: isDark ? "#1e293b" : "#f1f5f9", color: isDark ? "#94a3b8" : "#64748b" }
                    : { label: "✅ TƯƠNG THÍCH", bg: "#10b981", color: "#ffffff" };

                  const clashData = !isPending ? extractClashData(item, selectedItems) : null;
                  const cleanTitle = getCleanTitle(item);

                  return (
                    <div
                      key={index}
                      style={styles.checkCard(isError, isWarn, isPending, isDark)}
                    >
                      {/* CARD HEADER */}
                      <div style={styles.checkCardHeader}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: "18px", flexShrink: 0 }}>
                            {isError ? "❌" : isWarn ? "⚠️" : isPending ? "⏳" : "✅"}
                          </span>
                          <span style={{
                            ...styles.checkTitle,
                            color: isDark ? "#f8fafc" : "#0f172a"
                          }}>
                            {cleanTitle}
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
                          <span style={{
                            fontSize: "10.5px",
                            fontWeight: "800",
                            padding: "3px 8px",
                            borderRadius: "10px",
                            backgroundColor: badgeMeta.bg,
                            color: badgeMeta.color,
                            letterSpacing: "0.3px",
                            whiteSpace: "nowrap"
                          }}>
                            {badgeMeta.label}
                          </span>

                          {item.ruleBadges && item.ruleBadges.length > 0 && (
                            <span style={styles.ruleIdTag(isDark)}>
                              {item.ruleBadges.join(" • ")}
                            </span>
                          )}

                          {item.detail && !isPending && item.detail.length <= 18 && (
                            <span style={styles.specChipTag(isDark)}>
                              {item.detail}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* ── VISUAL SPEC CLASH BOX IF APPLICABLE ──────────────── */}
                      {clashData && (
                        <VisualSpecClashBox
                          clashData={clashData}
                          isDark={isDark}
                          onNavigateComponent={onNavigateComponent}
                        />
                      )}

                      {/* ── CARD BODY EXPLANATION ──────────────────────────── */}
                      <p style={{ ...styles.checkLongText, color: isDark ? "#cbd5e1" : "#334155" }}>
                        {isPending
                          ? `Quy tắc này sẽ tự động kiểm tra ngay khi bạn chọn thêm linh kiện liên quan (${item.detail || item.key}).`
                          : cleanLongText(exp.long || item.detail || "Đã kiểm tra tương thích kỹ thuật.")}
                      </p>

                      {/* SUGGESTION / REPAIR ADVICE (if no clash box or additional tip) */}
                      {exp.suggestion && !clashData && (
                        <div style={styles.suggestionBox(isDark, isError)}>
                          <div style={{ fontWeight: "800", color: isError ? (isDark ? "#f87171" : "#b91c1c") : (isDark ? "#fbbf24" : "#b45309"), marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                            <span>💡</span>
                            <span>{isError ? "Đề xuất khắc phục ngay:" : "Gợi ý tối ưu:"}</span>
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
              backgroundColor: isDark ? "#0b0f19" : "#f8fafc",
              borderTopColor: isDark ? "#1e293b" : "#e2e8f0"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px" }}>🛡️</span>
                <span style={{ fontSize: "12.5px", color: isDark ? "#94a3b8" : "#64748b" }}>
                  Bảo chứng tương thích bởi <strong>AI PC Mall Engine</strong>
                </span>
              </div>
              <button style={styles.doneBtn} onClick={onClose}>Đã hiểu</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * VisualSpecClashBox — Thành phần hiển thị trực quan sàn đấu đối chiếu thông số
 */
function VisualSpecClashBox({ clashData, isDark, onNavigateComponent }) {
  if (!clashData) return null;
  const { left, operator, operatorLabel, right, quickActions } = clashData;

  return (
    <div style={styles.clashBox(isDark)}>
      <div style={styles.clashBoxHeader(isDark)}>
        <span style={{ fontSize: "10.5px", fontWeight: "800", letterSpacing: "0.5px", color: isDark ? "#94a3b8" : "#64748b", textTransform: "uppercase" }}>
          ⚡ ĐỐI CHIẾU THÔNG SỐ TRỰC TIẾP (HARDWARE SPEC CLASH)
        </span>
      </div>

      <div style={styles.clashSidesRow}>
        {/* LEFT COMPONENT */}
        <div style={styles.clashSide(isDark, left.brandColor)}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <span style={{ fontSize: "14px" }}>{left.icon}</span>
            <span style={{ fontSize: "11px", fontWeight: "800", color: left.brandColor, textTransform: "uppercase" }}>
              {left.label}
            </span>
          </div>
          <div style={styles.clashCompName(isDark)} title={left.name}>
            {left.name}
          </div>
          <div style={styles.clashSpecChip(isDark, left.brandColor)}>
            <span style={{ fontSize: "10px", opacity: 0.8 }}>{left.specName}:</span>
            <span style={{ fontSize: "12px", fontWeight: "900" }}>{left.specValue}</span>
          </div>
        </div>

        {/* CLASH DIVIDER */}
        <div style={styles.clashDivider(isDark)}>
          <div style={styles.clashIconCircle}>
            <span style={{ fontSize: "15px", fontWeight: "900" }}>{operator}</span>
          </div>
          <span style={styles.clashDividerText}>
            {operatorLabel}
          </span>
        </div>

        {/* RIGHT COMPONENT */}
        <div style={styles.clashSide(isDark, right.brandColor)}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <span style={{ fontSize: "14px" }}>{right.icon}</span>
            <span style={{ fontSize: "11px", fontWeight: "800", color: right.brandColor, textTransform: "uppercase" }}>
              {right.label}
            </span>
          </div>
          <div style={styles.clashCompName(isDark)} title={right.name}>
            {right.name}
          </div>
          <div style={styles.clashSpecChip(isDark, right.brandColor)}>
            <span style={{ fontSize: "10px", opacity: 0.8 }}>{right.specName}:</span>
            <span style={{ fontSize: "12px", fontWeight: "900" }}>{right.specValue}</span>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      {quickActions && quickActions.length > 0 && onNavigateComponent && (
        <div style={styles.clashActionsRow(isDark)}>
          <span style={{ fontSize: "11.5px", fontWeight: "700", color: isDark ? "#94a3b8" : "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
            <span>⚡</span>
            <span>Khắc phục nhanh:</span>
          </span>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
            {quickActions.map((qa, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onNavigateComponent(qa.targetCategory)}
                style={styles.quickActionBtn(isDark, qa.primary)}
              >
                {qa.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Trích xuất dữ liệu đối chiếu thông số cho Clash Box
 */
function extractClashData(item, selectedItems) {
  const k = (item.key || "").toLowerCase();
  const short = (item.explanation?.short || "").toLowerCase();
  const detail = (item.detail || "").toLowerCase();
  const long = (item.explanation?.long || "").toLowerCase();

  // 1. Socket CPU <-> Mainboard
  if (k === "socket" || short.includes("socket") || detail.includes("socket") || long.includes("socket")) {
    const cpuProduct = getSelectedProduct(selectedItems?.cpu);
    const mbProduct = getSelectedProduct(selectedItems?.mainboard);
    const cpuName = getProductName(cpuProduct) || "Intel Core i5-14400F";
    const mbName = getProductName(mbProduct) || "MSI MAG B650M MORTAR WIFI";

    // Extract socket specs
    let cpuSocket = findSpec(cpuProduct, SPEC_ALIASES.socket);
    if (!cpuSocket) {
      if (/1700/i.test(cpuName) || /12\d{2}|13\d{2}|14\d{2}/.test(cpuName)) cpuSocket = "LGA1700";
      else if (/am5/i.test(cpuName) || /7\d{3}|8\d{3}|9\d{3}/.test(cpuName)) cpuSocket = "AM5";
      else if (/am4/i.test(cpuName) || /3\d{3}|4\d{3}|5\d{3}/.test(cpuName)) cpuSocket = "AM4";
      else if (/1200/i.test(cpuName) || /10\d{2}|11\d{2}/.test(cpuName)) cpuSocket = "LGA1200";
    }

    let mbSocket = findSpec(mbProduct, SPEC_ALIASES.socket);
    if (!mbSocket) {
      if (/b650|x670|a620|b850|x870/i.test(mbName) || /am5/i.test(mbName)) mbSocket = "AM5";
      else if (/b760|z790|h610|b660|z690/i.test(mbName) || /1700/i.test(mbName)) mbSocket = "LGA1700";
      else if (/b550|b450|x570|a520/i.test(mbName) || /am4/i.test(mbName)) mbSocket = "AM4";
      else if (/b460|b560|z490|z590/i.test(mbName) || /1200/i.test(mbName)) mbSocket = "LGA1200";
    }

    if (!cpuSocket || !mbSocket) {
      const match = (item.detail || "").match(/socket\s*([A-Za-z0-9]+).*?socket\s*([A-Za-z0-9]+)/i) ||
                    (item.detail || "").match(/([A-Za-z0-9]+)\s*\/\s*([A-Za-z0-9]+)/);
      if (match) {
        if (!cpuSocket) cpuSocket = match[1];
        if (!mbSocket) mbSocket = match[2];
      }
    }

    return {
      type: "socket",
      left: {
        category: "cpu",
        label: "Vi xử lý (CPU)",
        name: cpuName,
        specName: "Chuẩn Socket",
        specValue: cpuSocket || "LGA1700",
        brandColor: cpuName.toLowerCase().includes("intel") ? "#0284c7" : "#ef4444",
        icon: "🧩"
      },
      operator: "≠",
      operatorLabel: "KHÁC CHÂN CẮM",
      right: {
        category: "mainboard",
        label: "Bo mạch chủ (Mainboard)",
        name: mbName,
        specName: "Khe cắm bo mạch",
        specValue: mbSocket || "AM5",
        brandColor: mbName.toLowerCase().includes("amd") || /b650|am5/i.test(mbName) ? "#ef4444" : "#0284c7",
        icon: "🔌"
      },
      quickActions: [
        {
          label: `🔄 Đổi Mainboard (chuẩn ${cpuSocket || "LGA1700"})`,
          targetCategory: "mainboard",
          primary: true
        },
        {
          label: `🔄 Đổi CPU (chuẩn ${mbSocket || "AM5"})`,
          targetCategory: "cpu",
          primary: false
        }
      ]
    };
  }

  // 2. RAM <-> Mainboard Type
  if (k === "ram" || short.includes("ram") || detail.includes("ddr") || long.includes("ddr")) {
    const ramProduct = getSelectedProduct(selectedItems?.ram);
    const mbProduct = getSelectedProduct(selectedItems?.mainboard);
    const ramName = getProductName(ramProduct) || "Bộ nhớ RAM";
    const mbName = getProductName(mbProduct) || "Bo mạch chủ";

    let ramType = findSpec(ramProduct, SPEC_ALIASES.ramType) || (/ddr5/i.test(ramName) ? "DDR5" : "DDR4");
    let mbRam = findSpec(mbProduct, SPEC_ALIASES.ramType) || (/ddr5/i.test(mbName) ? "DDR5" : "DDR4");

    return {
      type: "ram",
      left: {
        category: "ram",
        label: "Bộ nhớ RAM",
        name: ramName,
        specName: "Thế hệ RAM",
        specValue: ramType,
        brandColor: "#8b5cf6",
        icon: "🧠"
      },
      operator: "≠",
      operatorLabel: "KHÁC THẾ HỆ RAM",
      right: {
        category: "mainboard",
        label: "Bo mạch chủ",
        name: mbName,
        specName: "Chuẩn khe RAM",
        specValue: mbRam,
        brandColor: "#0284c7",
        icon: "🔌"
      },
      quickActions: [
        {
          label: `🔄 Đổi RAM (chuẩn ${mbRam})`,
          targetCategory: "ram",
          primary: true
        },
        {
          label: `🔄 Đổi Mainboard (hỗ trợ ${ramType})`,
          targetCategory: "mainboard",
          primary: false
        }
      ]
    };
  }

  // 3. GPU Length <-> Case Clearance
  if (k.includes("gpu_clearance") || short.includes("chiều dài gpu") || detail.includes("clearance")) {
    const gpuProduct = getSelectedProduct(selectedItems?.gpu);
    const caseProduct = getSelectedProduct(selectedItems?.case);
    const gpuName = getProductName(gpuProduct) || "Card đồ họa (VGA)";
    const caseName = getProductName(caseProduct) || "Vỏ thùng máy (Case)";

    const gpuLength = parseNumber(findSpec(gpuProduct, SPEC_ALIASES.gpuLength), 330);
    const caseClearance = parseNumber(findSpec(caseProduct, SPEC_ALIASES.caseGpuClearance), 300);

    return {
      type: "gpu_clearance",
      left: {
        category: "gpu",
        label: "Card màn hình (VGA)",
        name: gpuName,
        specName: "Chiều dài GPU",
        specValue: `${gpuLength} mm`,
        brandColor: "#10b981",
        icon: "🎮"
      },
      operator: ">",
      operatorLabel: "DÀI HƠN KHOANG CASE",
      right: {
        category: "case",
        label: "Vỏ máy tính (Case)",
        name: caseName,
        specName: "Không gian tối đa",
        specValue: `${caseClearance} mm`,
        brandColor: "#f59e0b",
        icon: "📦"
      },
      quickActions: [
        {
          label: `🔄 Đổi Vỏ Case (Clearance ≥ ${gpuLength}mm)`,
          targetCategory: "case",
          primary: true
        },
        {
          label: "🔄 Đổi Card VGA nhỏ hơn",
          targetCategory: "gpu",
          primary: false
        }
      ]
    };
  }

  // 4. PSU Wattage
  if (k === "psu" || short.includes("công suất") || detail.includes("watt") || long.includes("watt")) {
    const psuProduct = getSelectedProduct(selectedItems?.psu);
    const psuName = getProductName(psuProduct) || "Nguồn máy tính (PSU)";
    const psuWatt = parseNumber(findSpec(psuProduct, SPEC_ALIASES.psuWattage), 500);

    return {
      type: "psu",
      left: {
        category: "psu",
        label: "Tổng nhu cầu dàn máy",
        name: "Yêu cầu ước tính theo CPU & GPU",
        specName: "Công suất khuyên dùng",
        specValue: "650W+",
        brandColor: "#ef4444",
        icon: "⚡"
      },
      operator: ">",
      operatorLabel: "THIẾU CÔNG SUẤT NGUỒN",
      right: {
        category: "psu",
        label: "Nguồn đã chọn (PSU)",
        name: psuName,
        specName: "Công suất định mức",
        specValue: `${psuWatt} W`,
        brandColor: "#f59e0b",
        icon: "🔋"
      },
      quickActions: [
        {
          label: "🔄 Nâng cấp Nguồn (PSU) ≥ 650W",
          targetCategory: "psu",
          primary: true
        }
      ]
    };
  }

  // 5. Cooling requirement
  if (k.includes("cooling_required") || detail.includes("tản nhiệt riêng")) {
    const cpuProduct = getSelectedProduct(selectedItems?.cpu);
    const cpuName = getProductName(cpuProduct) || "CPU Đã chọn";

    return {
      type: "cooling_required",
      left: {
        category: "cpu",
        label: "Vi xử lý (CPU)",
        name: cpuName,
        specName: "Đặc điểm làm mát",
        specValue: "Không kèm quạt stock",
        brandColor: "#0284c7",
        icon: "🖥"
      },
      operator: "➜",
      operatorLabel: "CẦN TẢN RỜI",
      right: {
        category: "cooling",
        label: "Tản nhiệt (Cooling)",
        name: "Chưa chọn tản nhiệt",
        specName: "Khuyến nghị",
        specValue: "Tản khí / Tản AIO",
        brandColor: "#06b6d4",
        icon: "❄️"
      },
      quickActions: [
        {
          label: "❄️ Chọn Tản Nhiệt CPU ngay (Bước 9)",
          targetCategory: "cooling",
          primary: true
        }
      ]
    };
  }

  return null;
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(11, 15, 25, 0.78)",
    backdropFilter: "blur(8px)",
    zIndex: 9999,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "stretch"
  },
  drawer: {
    width: "100%",
    maxWidth: "600px",
    boxShadow: "-12px 0 40px rgba(0, 0, 0, 0.5)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    animation: "slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
  },
  header: {
    padding: "18px 24px",
    background: "linear-gradient(135deg, #0b0f19 0%, #1e293b 100%)",
    color: "#ffffff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)"
  },
  headerIconWrap: {
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    background: "linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(147, 51, 234, 0.25))",
    border: "1px solid rgba(147, 51, 234, 0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    margin: 0,
    fontSize: "17px",
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: "-0.01em"
  },
  versionBadge: {
    fontSize: "10px",
    fontWeight: "800",
    color: "#38bdf8",
    background: "rgba(56, 189, 248, 0.15)",
    border: "1px solid rgba(56, 189, 248, 0.3)",
    padding: "2px 6px",
    borderRadius: "6px"
  },
  subtitle: {
    margin: "3px 0 0 0",
    fontSize: "12px",
    color: "#94a3b8"
  },
  closeBtn: {
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    color: "#ffffff",
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s"
  },

  // HUD CARD
  hudCard: (isDark, hasErrors) => ({
    margin: "14px 20px 0",
    padding: "14px 16px",
    backgroundColor: isDark
      ? hasErrors ? "rgba(239, 68, 68, 0.08)" : "rgba(30, 41, 59, 0.6)"
      : hasErrors ? "#fef2f2" : "#f0f9ff",
    borderRadius: "14px",
    border: `1px solid ${hasErrors ? (isDark ? "rgba(239, 68, 68, 0.35)" : "#fecaca") : (isDark ? "#334155" : "#bae6fd")}`,
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  }),
  hudTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    flexWrap: "wrap"
  },
  statusPill: (hasErrors, hasWarnings) => {
    let bg = "#10b981";
    let text = "#ffffff";
    let border = "#059669";
    if (hasErrors) {
      bg = "#ef4444";
      border = "#dc2626";
    } else if (hasWarnings) {
      bg = "#f59e0b";
      border = "#d97706";
    }
    return {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      backgroundColor: bg,
      color: text,
      padding: "5px 12px",
      borderRadius: "99px",
      border: `1px solid ${border}`,
      boxShadow: hasErrors ? "0 2px 10px rgba(239, 68, 68, 0.35)" : "none"
    };
  },
  statusPulse: (hasErrors) => ({
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "#ffffff",
    boxShadow: hasErrors ? "0 0 8px #ffffff" : "none"
  }),
  miniProgressContainer: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: 1,
    minWidth: "140px",
    justifyContent: "center"
  },
  miniProgressTrack: (isDark) => ({
    flex: 1,
    height: "6px",
    backgroundColor: isDark ? "#334155" : "#e2e8f0",
    borderRadius: "99px",
    overflow: "hidden"
  }),
  miniProgressFill: (percent) => ({
    width: `${Math.min(100, Math.max(0, percent))}%`,
    height: "100%",
    background: "linear-gradient(90deg, #38bdf8, #818cf8)",
    borderRadius: "99px",
    transition: "width 0.4s ease"
  }),
  recheckMiniBtn: (isDark) => ({
    backgroundColor: isDark ? "rgba(59, 130, 246, 0.15)" : "#eff6ff",
    color: isDark ? "#93c5fd" : "#1d4ed8",
    border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.3)" : "#bfdbfe"}`,
    padding: "5px 10px",
    borderRadius: "8px",
    fontSize: "11.5px",
    fontWeight: "700",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "4px"
  }),
  hudBottomRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    borderTop: "1px dashed rgba(148, 163, 184, 0.2)",
    paddingTop: "8px"
  },
  toggleScoreBtn: (isDark) => ({
    background: "none",
    border: "none",
    color: isDark ? "#38bdf8" : "#0284c7",
    fontSize: "11.5px",
    fontWeight: "700",
    cursor: "pointer",
    padding: "2px 4px",
    whiteSpace: "nowrap"
  }),
  scorecardContainer: (isDark) => ({
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    paddingTop: "6px"
  }),
  scorePill: (label, score, isDark = false) => (
    <div key={label} style={{
      fontSize: "11px",
      fontWeight: "600",
      padding: "4px 8px",
      borderRadius: "8px",
      backgroundColor: isDark ? "rgba(15, 23, 42, 0.8)" : "#ffffff",
      color: isDark ? "#cbd5e1" : "#334155",
      border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
      display: "flex",
      alignItems: "center",
      gap: "4px"
    }}>
      <span>{label}:</span>
      <span style={{ fontWeight: "800", color: score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444" }}>
        {score ?? 0}%
      </span>
    </div>
  ),

  // FILTER BAR
  filterBar: (isDark) => ({
    display: "flex",
    gap: "6px",
    padding: "12px 20px 8px",
    borderBottom: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}`,
    overflowX: "auto"
  }),
  filterTab: (active, activeColor = "#3b82f6", isDark = false) => ({
    padding: "6px 12px",
    borderRadius: "16px",
    border: active ? "none" : `1px solid ${isDark ? "#334155" : "#cbd5e1"}`,
    backgroundColor: active ? activeColor : isDark ? "rgba(30, 41, 59, 0.6)" : "#ffffff",
    color: active ? "#ffffff" : isDark ? "#cbd5e1" : "#475569",
    fontWeight: active ? "800" : "600",
    fontSize: "12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.15s ease",
    boxShadow: active ? `0 2px 8px ${activeColor}55` : "none"
  }),

  // CHECKS LIST
  checksList: {
    flex: 1,
    overflowY: "auto",
    padding: "14px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  checkCard: (isError, isWarn, isPending, isDark) => {
    let bg = isDark ? "#111827" : "#ffffff";
    let border = isDark ? "#1f2937" : "#e2e8f0";

    if (isError) {
      bg = isDark ? "rgba(239, 68, 68, 0.05)" : "#fff5f5";
      border = isDark ? "rgba(239, 68, 68, 0.3)" : "#fecaca";
    } else if (isWarn) {
      bg = isDark ? "rgba(245, 158, 11, 0.05)" : "#fffbeb";
      border = isDark ? "rgba(245, 158, 11, 0.3)" : "#fde68a";
    } else if (isPending) {
      bg = isDark ? "rgba(17, 24, 39, 0.5)" : "#f8fafc";
      border = isDark ? "#1e293b" : "#f1f5f9";
    } else {
      bg = isDark ? "rgba(16, 185, 129, 0.04)" : "#f0fdf4";
      border = isDark ? "rgba(16, 185, 129, 0.2)" : "#bbf7d0";
    }

    return {
      padding: "14px 16px",
      borderRadius: "14px",
      border: `1px solid ${border}`,
      backgroundColor: bg,
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      boxShadow: isDark ? "0 2px 8px rgba(0, 0, 0, 0.2)" : "0 1px 4px rgba(0, 0, 0, 0.04)"
    };
  },
  checkCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px"
  },
  checkTitle: {
    fontWeight: "700",
    fontSize: "14px",
    lineHeight: "1.4"
  },
  ruleIdTag: (isDark) => ({
    fontSize: "10.5px",
    fontWeight: "800",
    backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
    color: isDark ? "#94a3b8" : "#475569",
    padding: "2px 6px",
    borderRadius: "6px",
    border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
    whiteSpace: "nowrap"
  }),
  specChipTag: (isDark) => ({
    fontSize: "11px",
    fontWeight: "700",
    backgroundColor: isDark ? "rgba(59, 130, 246, 0.15)" : "#eff6ff",
    color: isDark ? "#93c5fd" : "#2563eb",
    padding: "2px 8px",
    borderRadius: "6px",
    border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.3)" : "#bfdbfe"}`,
    whiteSpace: "nowrap"
  }),
  checkLongText: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "1.55"
  },

  // ── VISUAL CLASH BOX STYLES ──────────────────────────────────────
  clashBox: (isDark) => ({
    borderRadius: "12px",
    backgroundColor: isDark ? "#090d16" : "#f8fafc",
    border: `1px solid ${isDark ? "#1e293b" : "#e2e8f0"}`,
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  }),
  clashBoxHeader: (isDark) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: `1px dashed ${isDark ? "#1e293b" : "#e2e8f0"}`,
    paddingBottom: "6px"
  }),
  clashSidesRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },
  clashSide: (isDark, brandColor) => ({
    flex: 1,
    minWidth: 0,
    backgroundColor: isDark ? "rgba(15, 23, 42, 0.7)" : "#ffffff",
    border: `1px solid ${isDark ? "#1e293b" : "#e2e8f0"}`,
    borderTop: `3px solid ${brandColor}`,
    borderRadius: "10px",
    padding: "10px"
  }),
  clashCompName: (isDark) => ({
    fontSize: "12px",
    fontWeight: "700",
    color: isDark ? "#f1f5f9" : "#1e293b",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    marginBottom: "6px"
  }),
  clashSpecChip: (isDark, brandColor) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "2px 8px",
    borderRadius: "6px",
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9",
    color: brandColor,
    border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0"}`
  }),
  clashDivider: (isDark) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 2px",
    textAlign: "center",
    minWidth: "75px"
  }),
  clashIconCircle: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    backgroundColor: "#ef4444",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(239, 68, 68, 0.4)",
    marginBottom: "4px"
  },
  clashDividerText: {
    fontSize: "9px",
    fontWeight: "800",
    color: "#ef4444",
    letterSpacing: "0.2px",
    textTransform: "uppercase"
  },
  clashActionsRow: (isDark) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    flexWrap: "wrap",
    borderTop: `1px dashed ${isDark ? "#1e293b" : "#e2e8f0"}`,
    paddingTop: "8px"
  }),
  quickActionBtn: (isDark, isPrimary) => ({
    backgroundColor: isPrimary ? "#2563eb" : (isDark ? "rgba(30, 41, 59, 0.8)" : "#ffffff"),
    color: isPrimary ? "#ffffff" : (isDark ? "#93c5fd" : "#1e40af"),
    border: isPrimary ? "none" : `1px solid ${isDark ? "#3b82f6" : "#bfdbfe"}`,
    padding: "6px 12px",
    borderRadius: "8px",
    fontSize: "11.5px",
    fontWeight: "700",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    transition: "all 0.15s ease",
    boxShadow: isPrimary ? "0 2px 8px rgba(37, 99, 235, 0.3)" : "none"
  }),

  // SUGGESTION BOX
  suggestionBox: (isDark, isError = true) => ({
    padding: "10px 12px",
    backgroundColor: isDark ? "rgba(15, 23, 42, 0.6)" : "#ffffff",
    borderRadius: "10px",
    fontSize: "12.5px",
    color: isDark ? "#f1f5f9" : "#1e293b",
    borderLeft: `3px solid ${isError ? "#ef4444" : "#f59e0b"}`,
    borderTop: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}`,
    borderRight: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}`,
    borderBottom: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}`
  }),

  // FOOTER
  footer: {
    padding: "14px 20px",
    borderTop: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  doneBtn: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    padding: "8px 20px",
    borderRadius: "10px",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "13.5px",
    boxShadow: "0 2px 10px rgba(37, 99, 235, 0.3)"
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 0",
    fontSize: "14px"
  },
  emptyStateContainer: (isDark) => ({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 24px",
    textAlign: "center",
    backgroundColor: isDark ? "#0b0f19" : "#fafafa"
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
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 24px",
    textAlign: "center"
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid rgba(56, 189, 248, 0.2)",
    borderTop: "3px solid #38bdf8",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite"
  }
};
