import React, { useState } from "react";

/**
 * Danh sách 5 tựa game tiêu chuẩn benchmark phổ biến tại thị trường Việt Nam & Quốc tế.
 * Hệ số multiplier tính theo FPS chuẩn 1080p base:
 */
const BENCHMARK_GAMES = [
  { id: "cs2", name: "Counter-Strike 2", icon: "🎯", type: "Esports (CPU-bound)", factor: 1.35 },
  { id: "valorant", name: "Valorant", icon: "⚡", type: "Esports (High-FPS)", factor: 1.85 },
  { id: "gtav", name: "Grand Theft Auto V", icon: "🚗", type: "Open-World (Balanced)", factor: 1.05 },
  { id: "cyberpunk", name: "Cyberpunk 2077", icon: "🤖", type: "AAA (Ray Tracing Heavy)", factor: 0.58 },
  { id: "wukong", name: "Black Myth: Wukong", icon: "🐒", type: "AAA (UE5 Next-Gen)", factor: 0.52 }
];

const RESOLUTION_FACTORS = {
  "1080p": 1.0,
  "1440p": 0.72,
  "4k": 0.44
};

/**
 * InsightsPanel — Khối hiển thị thông số điện năng, PSU Sweet Spot Curve & Benchmark Game FPS
 */
export function InsightsPanel({ insights }) {
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [selectedRes, setSelectedRes] = useState("1080p");

  if (!insights) return null;

  const power = Number(insights.power || 0);
  const baseFps = Number(insights.fps || 120);
  const recommendedPsu = power > 0 ? Math.ceil((power * 1.35) / 50) * 50 : 550;

  // Nếu người dùng đã chọn PSU cụ thể trong dàn máy, dùng watt đó; nếu chưa thì dùng recommendedPsu
  const activePsuWatt = Number(insights.psuWatt || recommendedPsu);
  const psuLoad = activePsuWatt > 0 && power > 0 ? Math.round((power / activePsuWatt) * 100) : 0;

  // Đánh giá vùng hiệu suất nguồn (PSU Efficiency Sweet Spot)
  // Đa số nguồn 80 Plus Gold/Platinum đạt hiệu suất cao nhất 90-92% tại 50% - 65% tải
  let sweetSpotStatus = { label: "Tải an toàn", color: "#059669", bg: "#ecfdf5", desc: "Nguồn hoạt động mát và ổn định" };
  if (psuLoad >= 45 && psuLoad <= 65) {
    sweetSpotStatus = { label: "💎 Vùng Tối Ưu (Sweet Spot)", color: "#2563eb", bg: "#eff6ff", desc: "Đạt hiệu suất chuyển đổi 90%+ cao nhất, quạt êm nhất" };
  } else if (psuLoad > 85) {
    sweetSpotStatus = { label: "⚠️ Tải cao (>85%)", color: "#dc2626", bg: "#fef2f2", desc: "Nguồn chịu tải lớn khi full load, nên nâng công suất PSU" };
  } else if (psuLoad > 70) {
    sweetSpotStatus = { label: "Khá cao (70-85%)", color: "#d97706", bg: "#fffbeb", desc: "Dư địa nâng cấp hạn chế khi ép xung hoặc thêm ổ cứng" };
  }

  const fpsGrade =
    baseFps >= 200
      ? "🏆 4K Ultra / 240Hz"
      : baseFps >= 144
      ? "✨ 2K High / 144Hz"
      : baseFps >= 60
      ? "🎮 1080p Full HD"
      : "💼 Đồ họa cơ bản";

  const resFactor = RESOLUTION_FACTORS[selectedRes] || 1.0;

  return (
    <div className="insights-panel" style={{ padding: "0 4px" }}>
      <div className="sidebar-section-header" style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="sidebar-section-title">⚡ Điện Năng & Hiệu Năng</span>
        <button
          type="button"
          onClick={() => setShowBenchmark(!showBenchmark)}
          style={{
            fontSize: "10.5px",
            fontWeight: "700",
            color: "#2563eb",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "6px",
            padding: "2px 8px",
            cursor: "pointer"
          }}
        >
          {showBenchmark ? "Thu gọn ▲" : "Chi tiết Game FPS ▼"}
        </button>
      </div>

      <div className="sidebar-stats" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
        <div className="sidebar-stat-card" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px 8px", textAlign: "center" }}>
          <span className="sidebar-stat-label" style={{ fontSize: "9px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>TDP Tiêu Thụ</span>
          <span className="sidebar-stat-value" style={{ fontSize: "16px", fontWeight: "900", color: "#0f172a" }}>{power}W</span>
        </div>

        <div className="sidebar-stat-card" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px 8px", textAlign: "center" }}>
          <span className="sidebar-stat-label" style={{ fontSize: "9px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>FPS Gaming</span>
          <span className="sidebar-stat-value" style={{ fontSize: "16px", fontWeight: "900", color: "#2563eb" }}>{baseFps > 0 ? `~${baseFps} FPS` : "~165 FPS"}</span>
        </div>
      </div>

      {/* Recommended PSU & Sweet Spot Curve */}
      <div style={{ backgroundColor: "#f8fafc", borderRadius: "12px", padding: "12px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#334155" }}>🔌 Nguồn PSU:</span>
          <strong style={{ fontSize: "12px", color: sweetSpotStatus.color }}>{activePsuWatt}W (Đề xuất ≥ {recommendedPsu}W)</strong>
        </div>

        {/* PSU Sweet Spot Curve Bar */}
        {power > 0 && (
          <div style={{ display: "grid", gap: "4px" }}>
            <div style={{ position: "relative", width: "100%", height: "8px", backgroundColor: "#e2e8f0", borderRadius: "99px", overflow: "hidden" }}>
              {/* Sweet spot highlight zone (50% - 65%) */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  width: "15%",
                  height: "100%",
                  backgroundColor: "rgba(37, 99, 235, 0.25)",
                  zIndex: 1
                }}
                title="Vùng tải tối ưu 50-65% (Hiệu suất 90%+)"
              />
              <div
                style={{
                  width: `${Math.min(100, psuLoad)}%`,
                  height: "100%",
                  backgroundColor: sweetSpotStatus.color,
                  transition: "width 0.4s ease",
                  position: "relative",
                  zIndex: 2
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#64748b" }}>
              <span>0%</span>
              <span style={{ color: "#2563eb", fontWeight: "700" }}>50%-65% Sweet Spot</span>
              <span>100%</span>
            </div>
          </div>
        )}

        <div style={{ padding: "6px 8px", borderRadius: "6px", backgroundColor: sweetSpotStatus.bg, border: `1px solid ${sweetSpotStatus.color}25` }}>
          <div style={{ fontSize: "10.5px", fontWeight: "700", color: sweetSpotStatus.color }}>
            {sweetSpotStatus.label} ({psuLoad}% tải)
          </div>
          <div style={{ fontSize: "9.5px", color: "#64748b", marginTop: "2px" }}>
            {sweetSpotStatus.desc}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px dashed #e2e8f0", paddingTop: "6px" }}>
          <span style={{ fontSize: "10.5px", color: "#64748b" }}>Cấu hình trải nghiệm:</span>
          <span style={{ fontSize: "10.5px", fontWeight: "800", color: "#1e293b" }}>{fpsGrade}</span>
        </div>
      </div>

      {/* Game Benchmark FPS Estimator Accordion */}
      {showBenchmark && (
        <div style={{ marginTop: "10px", padding: "12px", borderRadius: "12px", background: "#ffffff", border: "1px solid #bfdbfe", boxShadow: "0 2px 8px rgba(37, 99, 235, 0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: "800", color: "#1e293b" }}>🎮 Ước tính FPS Game</span>
            {/* Resolution Selector */}
            <div style={{ display: "flex", gap: "4px" }}>
              {["1080p", "1440p", "4k"].map((res) => (
                <button
                  key={res}
                  type="button"
                  onClick={() => setSelectedRes(res)}
                  style={{
                    fontSize: "9.5px",
                    fontWeight: selectedRes === res ? "800" : "600",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    border: "none",
                    cursor: "pointer",
                    background: selectedRes === res ? "#2563eb" : "#f1f5f9",
                    color: selectedRes === res ? "#ffffff" : "#475569"
                  }}
                >
                  {res.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: "6px" }}>
            {BENCHMARK_GAMES.map((game) => {
              const estimatedFps = Math.max(20, Math.round(baseFps * game.factor * resFactor));
              const fpsColor = estimatedFps >= 120 ? "#7c3aed" : estimatedFps >= 60 ? "#059669" : estimatedFps >= 30 ? "#d97706" : "#dc2626";

              return (
                <div key={game.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 6px", borderRadius: "6px", background: "#f8fafc" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{game.icon}</span>
                    <div>
                      <div style={{ fontSize: "10.5px", fontWeight: "700", color: "#1e293b" }}>{game.name}</div>
                      <div style={{ fontSize: "8.5px", color: "#94a3b8" }}>{game.type}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "12px", fontWeight: "900", color: fpsColor }}>~{estimatedFps} FPS</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: "8px", fontSize: "9px", color: "#94a3b8", textAlign: "center" }}>
            *Dữ liệu ước tính dựa trên tương quan CPU + GPU và mức thiết lập High Settings.
          </div>
        </div>
      )}
    </div>
  );
}
