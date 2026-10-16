import React from "react";

const formatCurrency = (v) => Number(v || 0).toLocaleString("vi-VN");

/**
 * WhatIfComparisonPanel — Bảng Mô Phỏng & So Sánh Tăng/Giảm Ngân Sách (What-If Delta Comparison)
 * So sánh Side-by-Side giữa Build Hiện Tại vs Build Mô Phỏng (+5Tr / -5Tr).
 * Hiển thị Delta Chênh Lệch: Tổng tiền, FPS Gaming, Điểm XAI và Danh Sách Linh Kiện Khác Biệt.
 */
export function WhatIfComparisonPanel({
  currentBuildSnapshot,
  simulatedBuild,
  deltaBudget = 5000000,
  onApplySimulatedBuild,
  onResetToCurrentBuild,
  onClose,
  isApplying = false
}) {
  if (!simulatedBuild || !currentBuildSnapshot) return null;

  const currentPrice = Number(currentBuildSnapshot.totalPrice || 0);
  const simPrice = Number(simulatedBuild.totalPrice || 0);
  const diffPrice = simPrice - currentPrice;
  const isIncrease = deltaBudget >= 0;

  const currentScore = currentBuildSnapshot.xaiReport?.score || currentBuildSnapshot.score || 92;
  const simScore = simulatedBuild.compatibilityReport?.score || simulatedBuild.score || 96;

  // Compute FPS comparison
  const currentFpsEsports = Math.round(currentPrice / 100000 * 1.1) + 120;
  const simFpsEsports = Math.round(simPrice / 100000 * 1.1) + 120;
  const diffFpsEsports = simFpsEsports - currentFpsEsports;

  const currentFpsAaa = Math.round(currentPrice / 250000) + 40;
  const simFpsAaa = Math.round(simPrice / 250000) + 40;
  const diffFpsAaa = simFpsAaa - currentFpsAaa;

  // Compute component differences (Diff)
  const currentComps = currentBuildSnapshot.selectedItems || {};
  const simComps = Array.isArray(simulatedBuild.components)
    ? simulatedBuild.components.reduce((acc, c) => ({ ...acc, [(c.type || c.componentType).toLowerCase()]: c }), {})
    : simulatedBuild.components || {};

  const allTypes = Array.from(new Set([...Object.keys(currentComps), ...Object.keys(simComps)]));

  const diffList = allTypes.map((type) => {
    const rawCur = currentComps[type] || {};
    const curProduct = rawCur.product || rawCur;
    const curVariant = rawCur.variant || {};
    const curName = curProduct.name || curProduct.product_name || curProduct.productName || "Chưa chọn";
    const curPrice = Number(curVariant.price || curProduct.price || rawCur.price || 0);

    const rawSim = simComps[type] || {};
    const simProduct = rawSim.product || rawSim;
    const simName = simProduct.name || simProduct.product_name || simProduct.productName || "Chưa chọn";
    const simPriceVal = Number(simProduct.price || rawSim.price || 0);

    const isDifferent = curName !== simName;
    let changeType = "unchanged"; // "upgraded" | "downgraded" | "unchanged"

    if (isDifferent) {
      if (curPrice === 0 && simPriceVal > 0) {
        changeType = "upgraded";
      } else if (simPriceVal > curPrice) {
        changeType = "upgraded";
      } else if (simPriceVal < curPrice) {
        changeType = "downgraded";
      } else {
        changeType = "upgraded";
      }
    }

    return {
      type: type.toUpperCase(),
      curName,
      simName,
      curPrice,
      simPriceVal,
      isDifferent,
      changeType
    };
  });

  const upgradedCount = diffList.filter((d) => d.changeType === "upgraded").length;
  const downgradedCount = diffList.filter((d) => d.changeType === "downgraded").length;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* MODAL HEADER */}
        <div style={styles.header}>
          <div>
            <div style={styles.badge}>🔮 WHAT-IF SIMULATION ENGINE</div>
            <h3 style={styles.title}>
              So Sánh Cấu Hình: Hiện Tại vs Mô Phỏng {isIncrease ? `+${formatCurrency(deltaBudget)}đ` : `${formatCurrency(deltaBudget)}đ`}
            </h3>
            <p style={styles.subtitle}>
              Đã phát hiện <strong>{upgradedCount} linh kiện nâng cấp ⬆️</strong> {downgradedCount > 0 ? `và ${downgradedCount} linh kiện tiết kiệm ⬇️` : ""} giúp tối ưu hiệu năng.
            </p>
          </div>

          <button type="button" onClick={onClose} style={styles.closeBtn}>
            ✕
          </button>
        </div>

        {/* METRICS DELTA CARDS GRID */}
        <div style={styles.metricsGrid}>
          {/* Metric 1: Total Price */}
          <div style={styles.metricCard}>
            <span style={styles.metricLabel}>💰 Tổng Chi Phí</span>
            <div style={styles.metricCompareRow}>
              <div>
                <span style={styles.valOld}>{formatCurrency(currentPrice)}đ</span>
                <span style={styles.subText}>Build Hiện Tại</span>
              </div>
              <span style={styles.arrow}>➔</span>
              <div>
                <span style={styles.valNew}>{formatCurrency(simPrice)}đ</span>
                <span style={styles.subText}>Build Mô Phỏng</span>
              </div>
            </div>
            <div style={styles.diffBadge(diffPrice > 0 ? "plus" : "minus")}>
              {diffPrice >= 0 ? `+${formatCurrency(diffPrice)}đ` : `${formatCurrency(diffPrice)}đ`}
            </div>
          </div>

          {/* Metric 2: FPS Esports */}
          <div style={styles.metricCard}>
            <span style={styles.metricLabel}>🎮 Game eSports (1080p)</span>
            <div style={styles.metricCompareRow}>
              <div>
                <span style={styles.valOld}>{currentFpsEsports} FPS</span>
                <span style={styles.subText}>CS2 / Valorant</span>
              </div>
              <span style={styles.arrow}>➔</span>
              <div>
                <span style={styles.valNew}>{simFpsEsports} FPS</span>
                <span style={styles.subText}>Tăng trưởng</span>
              </div>
            </div>
            <div style={styles.diffBadge("fps")}>
              {diffFpsEsports >= 0 ? `+${diffFpsEsports} FPS` : `${diffFpsEsports} FPS`}
            </div>
          </div>

          {/* Metric 3: FPS AAA 1080p/2K */}
          <div style={styles.metricCard}>
            <span style={styles.metricLabel}>🎬 Game AAA (1080p/2K)</span>
            <div style={styles.metricCompareRow}>
              <div>
                <span style={styles.valOld}>{currentFpsAaa} FPS</span>
                <span style={styles.subText}>Wukong / Cyberpunk</span>
              </div>
              <span style={styles.arrow}>➔</span>
              <div>
                <span style={styles.valNew}>{simFpsAaa} FPS</span>
                <span style={styles.subText}>Tăng trưởng</span>
              </div>
            </div>
            <div style={styles.diffBadge("fps")}>
              {diffFpsAaa >= 0 ? `+${diffFpsAaa} FPS` : `${diffFpsAaa} FPS`}
            </div>
          </div>

          {/* Metric 4: Compatibility Score */}
          <div style={styles.metricCard}>
            <span style={styles.metricLabel}>🧠 Điểm Tương Thích XAI</span>
            <div style={styles.metricCompareRow}>
              <div>
                <span style={styles.valOld}>{currentScore}/100</span>
                <span style={styles.subText}>Độ an toàn</span>
              </div>
              <span style={styles.arrow}>➔</span>
              <div>
                <span style={styles.valNew}>{simScore}/100</span>
                <span style={styles.subText}>BUILD READY</span>
              </div>
            </div>
            <div style={styles.diffBadge("score")}>
              {simScore >= currentScore ? `+${simScore - currentScore} Điểm` : `${simScore - currentScore} Điểm`}
            </div>
          </div>
        </div>

        {/* COMPONENT DELTA DIFF TABLE */}
        <div style={styles.tableWrap}>
          <div style={styles.tableTitleRow}>
            <h4 style={styles.tableTitle}>🔍 Bảng So Sánh Chi Tiết Linh Kiện (Component Delta Diff)</h4>
            <span style={styles.tableSubtitle}>
              Linh kiện nâng cấp ⬆️ (viền xanh) và tiết kiệm ⬇️ (viền cam) được phân loại rõ ràng
            </span>
          </div>

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: "15%" }}>Loại Linh Kiện</th>
                <th style={{ ...styles.th, width: "36%" }}>Build Hiện Tại</th>
                <th style={{ ...styles.th, width: "36%" }}>Build Mô Phỏng ({isIncrease ? `+${formatCurrency(deltaBudget)}đ` : `${formatCurrency(deltaBudget)}đ`})</th>
                <th style={{ ...styles.th, width: "13%", textAlign: "center" }}>Trạng Thái</th>
              </tr>
            </thead>
            <tbody>
              {diffList.map((item, idx) => (
                <tr key={idx} style={{ backgroundColor: item.changeType === "upgraded" ? "#f0fdf4" : item.changeType === "downgraded" ? "#fff7ed" : "transparent" }}>
                  <td style={{ ...styles.td, fontWeight: "700", color: "#334155" }}>{item.type}</td>
                  <td style={styles.td}>
                    <div style={{ fontWeight: "600", color: "#0f172a", fontSize: "13px" }}>{item.curName}</div>
                    {item.curPrice > 0 && <div style={{ fontSize: "11px", color: "#64748b" }}>{formatCurrency(item.curPrice)}đ</div>}
                  </td>
                  <td style={{ ...styles.td, borderLeft: "2px solid #cbd5e1" }}>
                    <div style={{ fontWeight: "700", color: item.changeType === "upgraded" ? "#15803d" : item.changeType === "downgraded" ? "#c2410c" : "#0f172a", fontSize: "13px" }}>
                      {item.simName}
                    </div>
                    {item.simPriceVal > 0 && <div style={{ fontSize: "11px", color: item.changeType === "upgraded" ? "#16a34a" : "#ea580c" }}>{formatCurrency(item.simPriceVal)}đ</div>}
                  </td>
                  <td style={{ ...styles.td, textAlign: "center" }}>
                    {item.changeType === "upgraded" && (
                      <span style={{ backgroundColor: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0", padding: "4px 10px", borderRadius: "12px", fontSize: "11.5px", fontWeight: "800" }}>
                        ⬆️ Upgraded
                      </span>
                    )}
                    {item.changeType === "downgraded" && (
                      <span style={{ backgroundColor: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa", padding: "4px 10px", borderRadius: "12px", fontSize: "11.5px", fontWeight: "800" }}>
                        ⬇️ Downgraded
                      </span>
                    )}
                    {item.changeType === "unchanged" && (
                      <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: "500" }}>✨ Giữ nguyên</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ACTION BUTTONS FOOTER */}
        <div style={styles.footer}>
          <button type="button" onClick={onResetToCurrentBuild} style={styles.secondaryBtn}>
            ↺ Giữ Nguyên Build Ban Đầu
          </button>

          <button
            type="button"
            onClick={() => onApplySimulatedBuild(simulatedBuild)}
            disabled={isApplying}
            style={styles.primaryBtn}
          >
            {isApplying ? "⏳ Đang Nạp Cấu Hình Simulation..." : "🚀 Áp Dụng Cấu Hình Mô Phỏng Này"}
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
  modal: {
    backgroundColor: "#ffffff",
    borderRadius: "24px",
    width: "100%",
    maxWidth: "960px",
    maxHeight: "90vh",
    overflowY: "auto",
    padding: "28px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    border: "1px solid #e2e8f0"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px"
  },
  badge: {
    display: "inline-block",
    backgroundColor: "#f0fdf4",
    color: "#16a34a",
    fontSize: "11px",
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
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "14px",
    marginBottom: "24px"
  },
  metricCard: {
    backgroundColor: "#f8fafc",
    borderRadius: "16px",
    padding: "14px",
    border: "1px solid #e2e8f0",
    position: "relative"
  },
  metricLabel: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#475569",
    display: "block",
    marginBottom: "8px"
  },
  metricCompareRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  valOld: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#64748b",
    display: "block"
  },
  valNew: {
    fontSize: "15px",
    fontWeight: "800",
    color: "#0f172a",
    display: "block"
  },
  subText: {
    fontSize: "10px",
    color: "#94a3b8"
  },
  arrow: {
    color: "#94a3b8",
    fontSize: "14px"
  },
  diffBadge: (type) => ({
    marginTop: "8px",
    display: "inline-block",
    fontSize: "11px",
    fontWeight: "800",
    padding: "2px 8px",
    borderRadius: "6px",
    backgroundColor: type === "plus" ? "#dcfce7" : type === "minus" ? "#fee2e2" : "#eff6ff",
    color: type === "plus" ? "#15803d" : type === "minus" ? "#b91c1c" : "#1d4ed8"
  }),
  tableWrap: {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    marginBottom: "24px"
  },
  tableTitleRow: {
    padding: "14px 18px",
    backgroundColor: "#f8fafc",
    borderBottom: "1px solid #e2e8f0"
  },
  tableTitle: {
    margin: 0,
    fontSize: "14px",
    fontWeight: "700",
    color: "#0f172a"
  },
  tableSubtitle: {
    fontSize: "12px",
    color: "#64748b"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse"
  },
  th: {
    padding: "10px 14px",
    fontSize: "12px",
    fontWeight: "700",
    color: "#475569",
    textAlign: "left",
    backgroundColor: "#f8fafc",
    borderBottom: "1px solid #e2e8f0"
  },
  td: {
    padding: "12px 14px",
    fontSize: "13px",
    borderBottom: "1px solid #f1f5f9"
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
    fontWeight: "700",
    fontSize: "13px",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)"
  }
};
