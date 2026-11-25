import React, { useState } from "react";

/**
 * Danh sách 5 tựa game tiêu chuẩn benchmark phổ biến:
 */
const BENCHMARK_GAMES = [
  { id: "cs2", name: "Counter-Strike 2", icon: "🎯", type: "Esports (CPU-bound)", factor: 1.35 },
  { id: "valorant", name: "Valorant", icon: "⚡", type: "Esports (High-FPS)", factor: 1.85 },
  { id: "gtav", name: "Grand Theft Auto V", icon: "🚗", type: "Open-World", factor: 1.05 },
  { id: "cyberpunk", name: "Cyberpunk 2077", icon: "🤖", type: "AAA Heavy RT", factor: 0.58 },
  { id: "wukong", name: "Black Myth: Wukong", icon: "🐒", type: "AAA UE5", factor: 0.52 }
];

const RESOLUTION_MULTIPLIERS = {
  "1080p": 1.0,
  "1440p": 0.72,
  "4k": 0.44
};

/**
 * PerformanceScoreWidget — Hiển thị điểm số hiệu năng ước tính (0-100),
 * nhãn phân loại (Entry / Mid / High / Enthusiast) và ước tính FPS game theo độ phân giải
 */
export function PerformanceScoreWidget({ performanceEstimate, onOpenXaiDrawer }) {
  const [resolution, setResolution] = useState("1080p");
  const [expandedGames, setExpandedGames] = useState(false);

  if (!performanceEstimate) return null;

  const score = performanceEstimate.score || 50;
  const grade = performanceEstimate.grade || "Mid-range";
  const fps = performanceEstimate.estimatedFps || { esports1080p: 120, aaa1080p: 45, rendering4k: "Cơ bản" };
  const base1080Fps = Number(fps.esports1080p || 120) * 0.75;

  const getGradeColor = (g) => {
    switch (g) {
      case "Enthusiast": return "#7c3aed"; // Purple
      case "High-end": return "#059669";   // Emerald
      case "Mid-range": return "#1d4ed8";   // Blue
      default: return "#d97706";           // Amber
    }
  };

  const color = getGradeColor(grade);
  const resMult = RESOLUTION_MULTIPLIERS[resolution] || 1.0;

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <span style={styles.label}>📊 ĐIỂM HIỆU NĂNG ƯỚC TÍNH</span>
          <div style={styles.scoreRow}>
            <span style={{ ...styles.scoreValue, color }}>{score}</span>
            <span style={styles.scoreMax}>/100</span>
            <span style={{ ...styles.gradeBadge, backgroundColor: color }}>{grade}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            style={styles.benchmarkToggleBtn}
            onClick={() => setExpandedGames(!expandedGames)}
          >
            🎮 {expandedGames ? "Ẩn Game FPS" : "Chi tiết Game FPS"}
          </button>

          {onOpenXaiDrawer && (
            <button style={styles.xaiBtn} onClick={onOpenXaiDrawer}>
              🧠 Xem Giải Thích XAI
            </button>
          )}
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div style={styles.barBg}>
        <div style={{ ...styles.barFill, width: `${score}%`, backgroundColor: color }} />
      </div>

      {/* ESTIMATED METRICS GRID */}
      <div style={styles.metricsGrid}>
        <div style={styles.metricItem}>
          <span style={styles.metricIcon}>🎮</span>
          <div>
            <div style={styles.metricVal}>~{Math.round(fps.esports1080p * resMult)} FPS</div>
            <div style={styles.metricLbl}>Esports ({resolution.toUpperCase()})</div>
          </div>
        </div>

        <div style={styles.metricItem}>
          <span style={styles.metricIcon}>🐉</span>
          <div>
            <div style={styles.metricVal}>~{Math.round(fps.aaa1080p * resMult)} FPS</div>
            <div style={styles.metricLbl}>AAA Game ({resolution.toUpperCase()})</div>
          </div>
        </div>

        <div style={styles.metricItem}>
          <span style={styles.metricIcon}>🎬</span>
          <div>
            <div style={styles.metricVal}>{fps.rendering4k}</div>
            <div style={styles.metricLbl}>Render Video 4K</div>
          </div>
        </div>
      </div>

      {/* EXPANDED BENCHMARK ESTIMATION FOR 5 TITLES */}
      {expandedGames && (
        <div style={styles.benchmarkBox}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: "800", color: "#1e293b" }}>🎯 FPS Dự kiến theo độ phân giải:</span>
            <div style={{ display: "flex", gap: "4px" }}>
              {["1080p", "1440p", "4k"].map((res) => (
                <button
                  key={res}
                  type="button"
                  onClick={() => setResolution(res)}
                  style={{
                    fontSize: "11px",
                    fontWeight: resolution === res ? "800" : "600",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    background: resolution === res ? "#2563eb" : "#f1f5f9",
                    color: resolution === res ? "#ffffff" : "#475569"
                  }}
                >
                  {res.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px" }}>
            {BENCHMARK_GAMES.map((game) => {
              const estimatedFps = Math.max(20, Math.round(base1080Fps * game.factor * resMult));
              const fpsColor = estimatedFps >= 120 ? "#7c3aed" : estimatedFps >= 60 ? "#059669" : estimatedFps >= 30 ? "#d97706" : "#dc2626";

              return (
                <div key={game.id} style={styles.gameCard}>
                  <div style={{ fontSize: "16px" }}>{game.icon}</div>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#1e293b", marginTop: "2px" }}>{game.name}</div>
                  <div style={{ fontSize: "13px", fontWeight: "900", color: fpsColor, marginTop: "2px" }}>~{estimatedFps} FPS</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "18px 20px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 4px 16px rgba(15, 23, 42, 0.04)",
    marginBottom: "16px"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
    flexWrap: "wrap",
    gap: "10px"
  },
  label: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: "0.5px"
  },
  scoreRow: {
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
    marginTop: "2px"
  },
  scoreValue: {
    fontSize: "32px",
    fontWeight: "800",
    lineHeight: "1"
  },
  scoreMax: {
    fontSize: "14px",
    color: "#94a3b8",
    fontWeight: "600"
  },
  gradeBadge: {
    color: "#ffffff",
    fontSize: "11px",
    fontWeight: "700",
    padding: "3px 10px",
    borderRadius: "99px",
    marginLeft: "8px"
  },
  benchmarkToggleBtn: {
    backgroundColor: "#f8fafc",
    color: "#334155",
    border: "1px solid #cbd5e1",
    padding: "8px 12px",
    borderRadius: "10px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  xaiBtn: {
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    padding: "8px 14px",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  barBg: {
    height: "8px",
    backgroundColor: "#f1f5f9",
    borderRadius: "99px",
    overflow: "hidden",
    marginBottom: "16px"
  },
  barFill: {
    height: "100%",
    borderRadius: "99px",
    transition: "width 0.5s ease-in-out"
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "12px",
    paddingTop: "12px",
    borderTop: "1px dashed #e2e8f0"
  },
  metricItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "#f8fafc",
    padding: "10px 12px",
    borderRadius: "10px"
  },
  metricIcon: {
    fontSize: "20px"
  },
  metricVal: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#0f172a"
  },
  metricLbl: {
    fontSize: "11px",
    color: "#64748b"
  },
  benchmarkBox: {
    marginTop: "14px",
    padding: "12px",
    borderRadius: "12px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0"
  },
  gameCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "8px 10px",
    textAlign: "center"
  }
};
