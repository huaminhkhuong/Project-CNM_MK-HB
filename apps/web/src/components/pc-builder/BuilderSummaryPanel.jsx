import React, { useState, useRef, useEffect } from "react";
import { parseNaturalLanguageQuery } from "../../utils/aiConstraintParser";

const formatCurrency = (v) => Number(v || 0).toLocaleString("vi-VN");

const PRESET_ICONS = {
  gaming: "🎮",
  gaming_4k: "🚀",
  emulator: "📱",
  editing: "🎬",
  design_2d: "🎨",
  architect_3d: "📐",
  office: "💼",
  developer: "💻",
  ai: "🤖",
  streaming: "📡",
  white_theme: "⚪",
  silent: "❄️"
};

const MEGA_CATEGORIES = [
  {
    title: "🎮 Gaming & Giả Lập",
    items: [
      { id: "gaming", label: "Gaming AAA", icon: "🎮", budget: 25000000, desc: "Tối ưu FPS 1080p/2K" },
      { id: "gaming_4k", label: "Gaming 4K High-End", icon: "🚀", budget: 55000000, desc: "Max Setting 4K Ultra" },
      { id: "emulator", label: "Giả lập Multi-Tab", icon: "📱", budget: 22000000, desc: "RAM 32GB+ cắm Nox/LDPlayer" }
    ]
  },
  {
    title: "🎬 Đồ Họa & Kiến Trúc",
    items: [
      { id: "editing", label: "Dựng Phim 4K", icon: "🎬", budget: 35000000, desc: "Premiere / After Effects" },
      { id: "design_2d", label: "Đồ họa 2D / Photo", icon: "🎨", budget: 18000000, desc: "Photoshop, Illustrator" },
      { id: "architect_3d", label: "Kiến trúc 3D / Revit", icon: "📐", budget: 42000000, desc: "AutoCAD, Revit, 3ds Max" }
    ]
  },
  {
    title: "💻 Lập Trình, AI & Công Việc",
    items: [
      { id: "office", label: "Văn phòng / Học tập", icon: "💼", budget: 12000000, desc: "Ổn định, tiết kiệm điện" },
      { id: "developer", label: "Lập trình & Docker", icon: "💻", budget: 25000000, desc: "CPU 10+ nhân, RAM 32GB" },
      { id: "ai", label: "AI Workstation", icon: "🤖", budget: 50000000, desc: "VRAM lớn (RTX 4090/4080)" },
      { id: "streaming", label: "Streaming / VTuber", icon: "📡", budget: 30000000, desc: "Cân bằng CPU/GPU, NVENC" }
    ]
  },
  {
    title: "🎨 Thẩm Mỹ & Phong Cách",
    items: [
      { id: "white_theme", label: "Tone Trắng Bể Cá", icon: "⚪", budget: 28000000, desc: "Pure White, Vỏ Panorama" },
      { id: "silent", label: "Siêu êm & Mát mẻ", icon: "❄️", budget: 26000000, desc: "Tản nhiệt cao cấp, độ ồn = 0" }
    ]
  }
];

/**
 * BuilderSummaryPanel — Header Card 2 Tầng Chuyên Nghiệp & Mega Dropdown Cao Cấp
 */
export function BuilderSummaryPanel({
  selectedPresetId,
  onSelectPreset,
  presets = [],
  onOpenReqWizard,
  onOpenXaiDrawer,
  onAutoBuild,
  isAutoBuilding,
  budget = 25000000,
  onRefreshCatalog,
  onClearAll,
  selectedCount = 0,
  onExportPdf,
}) {
  const [isMegaOpen, setIsMegaOpen] = useState(false);
  const [aiSearchInput, setAiSearchInput] = useState("");
  const megaRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (megaRef.current && !megaRef.current.contains(e.target)) {
        setIsMegaOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelectOption(item) {
    onSelectPreset(item);
    setIsMegaOpen(false);
  }

  function handleAiPromptSubmit(e) {
    e.preventDefault();
    if (!aiSearchInput.trim() || isAutoBuilding) return;

    const parsed = parseNaturalLanguageQuery(aiSearchInput);
    onAutoBuild({
      purpose: parsed.purpose,
      budget: parsed.budget,
      excludedTypes: parsed.excludedTypes,
      resolution: parsed.targetResolution
    });
    setAiSearchInput("");
  }

  const primaryPresets = presets.slice(0, 4);

  return (
    <>
      {/* Backdrop mờ khi mở Mega Dropdown giúp tập trung & đóng nhanh khi click ngoài */}
      {isMegaOpen && (
        <div
          className="topbar-mega-backdrop"
          onClick={() => setIsMegaOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            backgroundColor: "rgba(15, 23, 42, 0.25)",
            backdropFilter: "blur(3px)",
            animation: "v2-fadeIn 0.2s ease"
          }}
        />
      )}

      <header
        className="builder-topbar-v2"
        style={{
          position: "relative",
          zIndex: isMegaOpen ? 9999 : 100,
          background: "#ffffff",
          borderRadius: "20px",
          padding: "16px 24px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 8px 30px rgba(15, 23, 42, 0.06)",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          marginBottom: "20px"
        }}
        ref={megaRef}
      >
        {/* TẦNG 1: BRAND LOGO + AI SEARCH INPUT + NÚT CHỨC NĂNG */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          {/* Brand */}
          <div className="topbar-brand" style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg, #2563eb, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "900", fontSize: "16px", boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)" }}>
              PC
            </div>
            <div>
              <span style={{ fontSize: "15px", fontWeight: "900", color: "#0f172a", letterSpacing: "-0.02em", display: "block", lineHeight: "1.1" }}>
                PC MALL <span style={{ color: "#2563eb" }}>BUILDER</span>
              </span>
              <span style={{ fontSize: "10.5px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Hệ Thống Lắp Ráp Thông Minh AI
              </span>
            </div>
          </div>

          {/* AI Search Form */}
          <form
            onSubmit={handleAiPromptSubmit}
            style={{
              flex: "1 1 360px",
              maxWidth: "520px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#f8fafc",
              border: "1.5px solid #cbd5e1",
              borderRadius: "14px",
              padding: "4px 6px 4px 14px",
              transition: "all 0.2s ease",
              boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.04)"
            }}
          >
            <input
              type="text"
              value={aiSearchInput}
              onChange={(e) => setAiSearchInput(e.target.value)}
              placeholder="🔍 Mô tả nhu cầu (VD: 'PC 20tr chơi Wukong mượt', 'Dựng phim 4K 30tr')..."
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: "12.5px",
                color: "#0f172a",
                fontWeight: "500"
              }}
            />
            <button
              type="submit"
              disabled={isAutoBuilding || !aiSearchInput.trim()}
              style={{
                padding: "8px 16px",
                borderRadius: "10px",
                border: "none",
                background: aiSearchInput.trim() ? "linear-gradient(135deg, #2563eb, #1d4ed8)" : "#cbd5e1",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: "800",
                cursor: aiSearchInput.trim() ? "pointer" : "not-allowed",
                boxShadow: aiSearchInput.trim() ? "0 4px 12px rgba(37, 99, 235, 0.35)" : "none",
                transition: "all 0.2s ease",
                whiteSpace: "nowrap"
              }}
            >
              ⚡ Build Với AI
            </button>
          </form>

          {/* Topbar Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", flexShrink: 0 }}>
            <button
              type="button"
              className="btn-topbar-secondary"
              onClick={onOpenReqWizard}
              title="Tùy chỉnh chi tiết mục đích, ngân sách & màn hình"
              style={{
                padding: "8px 14px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              ⚙️ Nhu Cầu Chi Tiết
            </button>

            <button
              type="button"
              className="btn-topbar-secondary"
              onClick={onOpenXaiDrawer}
              title="Xem giải thích AI chuyên sâu"
              style={{
                padding: "8px 12px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer"
              }}
            >
              🧠 XAI
            </button>

            <button
              type="button"
              className="btn-topbar-secondary"
              onClick={() => onExportPdf ? onExportPdf() : window.print()}
              title="Xuất PDF Báo giá cấu hình"
              style={{
                padding: "8px 12px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer"
              }}
            >
              📄 PDF
            </button>

            {onRefreshCatalog && (
              <button
                type="button"
                className="btn-topbar-secondary"
                onClick={onRefreshCatalog}
                title="Làm mới danh mục"
                style={{
                  padding: "8px 10px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer"
                }}
              >
                🔄
              </button>
            )}

            {onClearAll && (
              <button
                type="button"
                className="btn-topbar-secondary"
                onClick={onClearAll}
                disabled={selectedCount === 0}
                title="Reset bộ PC"
                style={{
                  padding: "8px 10px",
                  borderRadius: "10px",
                  border: "1px solid #fecdd3",
                  background: selectedCount === 0 ? "#f8fafc" : "#fff1f2",
                  color: selectedCount === 0 ? "#94a3b8" : "#e11d48",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: selectedCount === 0 ? "not-allowed" : "pointer"
                }}
              >
                🗑️
              </button>
            )}

            <button
              type="button"
              className="btn-ai-build"
              onClick={() => onAutoBuild()}
              disabled={isAutoBuilding}
              style={{
                padding: "8px 18px",
                borderRadius: "10px",
                border: "none",
                background: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
                color: "#ffffff",
                fontSize: "12.5px",
                fontWeight: "800",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
                whiteSpace: "nowrap"
              }}
            >
              ⚡ {isAutoBuilding ? "Đang tạo..." : "AI Auto-Build"}
            </button>
          </div>
        </div>

        {/* ĐƯỜNG PHÂN CÁCH TẦNG */}
        <div style={{ height: "1px", backgroundColor: "#f1f5f9", width: "100%" }} />

        {/* TẦNG 2: THANH NHU CẦU CHỌN SẴN & NÚT NHU CẦU KHÁC */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", flex: 1 }}>
            <span style={{ fontSize: "12px", fontWeight: "800", color: "#1e293b", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}>
              🎯 Nhu cầu gợi ý sẵn:
            </span>

            {/* Quick 4 main preset chips */}
            {primaryPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 14px",
                  borderRadius: "12px",
                  border: selectedPresetId === preset.id ? "2px solid #2563eb" : "1.5px solid #cbd5e1",
                  background: selectedPresetId === preset.id ? "#eff6ff" : "#f8fafc",
                  color: selectedPresetId === preset.id ? "#1d4ed8" : "#334155",
                  fontWeight: selectedPresetId === preset.id ? "800" : "600",
                  fontSize: "12px",
                  cursor: "pointer",
                  transition: "all 0.18s ease",
                  boxShadow: selectedPresetId === preset.id ? "0 4px 12px rgba(37, 99, 235, 0.18)" : "none"
                }}
              >
                <span>{PRESET_ICONS[preset.id] || "🎯"}</span>
                <span>{preset.label}</span>
                <span style={{ fontSize: "10.5px", fontWeight: "700", opacity: 0.85, paddingLeft: "4px", borderLeft: "1px solid #cbd5e1" }}>
                  {formatCurrency(preset.budget)}đ
                </span>
              </button>
            ))}
          </div>

          {/* MEGA DROPDOWN TOGGLE BUTTON & POPOVER CONTAINER */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setIsMegaOpen((prev) => !prev)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "12px",
                border: "2px solid #3b82f6",
                background: isMegaOpen ? "#1d4ed8" : "#eff6ff",
                color: isMegaOpen ? "#ffffff" : "#1d4ed8",
                fontWeight: "800",
                fontSize: "12.5px",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(59, 130, 246, 0.25)",
                transition: "all 0.2s ease"
              }}
            >
              <span>➕ Nhu cầu khác (12+ Tùy chọn)</span>
              <span style={{ fontSize: "10px", transition: "transform 0.2s", transform: isMegaOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                ▼
              </span>
            </button>

            {/* MEGA DROPDOWN POPOVER MENU — FLOATS HIGHEST OVER ALL ELEMENTS */}
            {isMegaOpen && (
              <div
                className="topbar-mega-menu"
                style={{
                  position: "absolute",
                  top: "calc(100% + 12px)",
                  right: 0,
                  zIndex: 9999,
                  width: "740px",
                  maxWidth: "90vw",
                  background: "#ffffff",
                  borderRadius: "20px",
                  padding: "24px",
                  boxShadow: "0 25px 60px rgba(15, 23, 42, 0.28), 0 0 0 1.5px rgba(59, 130, 246, 0.25)",
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "20px",
                  animation: "v2-fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {MEGA_CATEGORIES.map((cat, idx) => (
                  <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <h5 style={{ margin: "0 0 4px 0", fontSize: "13px", fontWeight: "900", color: "#1e3a8a", borderBottom: "2px solid #eff6ff", paddingBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span>{cat.title}</span>
                    </h5>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {cat.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectOption(item)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "9px 12px",
                            borderRadius: "12px",
                            border: selectedPresetId === item.id ? "2px solid #2563eb" : "1px solid #e2e8f0",
                            background: selectedPresetId === item.id ? "#eff6ff" : "#f8fafc",
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "all 0.18s ease"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "18px" }}>{item.icon}</span>
                            <div>
                              <strong style={{ fontSize: "12.5px", color: "#0f172a", display: "block", fontWeight: "800" }}>{item.label}</strong>
                              <span style={{ fontSize: "11px", color: "#64748b" }}>{item.desc}</span>
                            </div>
                          </div>
                          <span style={{ fontSize: "11px", fontWeight: "800", color: "#1d4ed8", backgroundColor: "#ffffff", padding: "3px 8px", borderRadius: "8px", border: "1px solid #bfdbfe", whiteSpace: "nowrap" }}>
                            {formatCurrency(item.budget)}đ
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
