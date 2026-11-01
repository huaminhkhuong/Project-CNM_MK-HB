import React, { useState } from "react";
import { formatCurrency } from "./pcBuilderUtils";

const CATEGORIES = [
  { id: "all", label: "Tất Cả", icon: "📦" },
  { id: "gaming", label: "Gaming & Giả Lập", icon: "🎮" },
  { id: "creative", label: "Đồ Họa & Kiến Trúc", icon: "🎬" },
  { id: "work", label: "Lập Trình & AI", icon: "💻" },
  { id: "style", label: "Thẩm Mỹ & Độ Ồn", icon: "🎨" }
];

const PREBUILT_TEMPLATES = [
  // 🎮 Gaming & Giả Lập
  {
    id: "gaming",
    title: "Gaming AAA 1080p / 2K",
    category: "gaming",
    icon: "🎮",
    budget: 25000000,
    targetRes: "2K (144Hz)",
    highlightSpecs: "Intel Core i5 / Ryzen 5 • RTX 4060 Ti 16G • 32GB RAM • 1TB SSD NVMe",
    desc: "Tối ưu hiệu năng / giá tiền (P/P), chiến mượt Black Myth Wukong, Cyberpunk, GTA V mức thiết lập cao."
  },
  {
    id: "gaming_4k",
    title: "Gaming 4K High-End Ultra",
    category: "gaming",
    icon: "🚀",
    budget: 55000000,
    targetRes: "4K (144Hz+)",
    highlightSpecs: "Intel Core i7 / Ryzen 7 • RTX 4080 / 4090 • 32GB DDR5 • 2TB Gen4",
    desc: "Cỗ máy đồ họa tối thượng, max setting mọi bom tấn thế giới mở ở độ phân giải 4K kèm Ray Tracing siêu mượt."
  },
  {
    id: "emulator",
    title: "Giả Lập Android Cày Game Multi-Tab",
    category: "gaming",
    icon: "📱",
    budget: 22000000,
    targetRes: "1080p Multi-Window",
    highlightSpecs: "CPU 16-24 luồng • 32GB - 64GB RAM • SSD NVMe tốc độ cao",
    desc: "Cắm 8 - 20 tab NoxPlayer, LDPlayer xuyên ngày đêm, CPU đa nhân vận hành ổn định không văng giả lập."
  },

  // 🎬 Đồ Họa & Kiến Trúc
  {
    id: "editing",
    title: "Dựng Phim 4K Premiere & DaVinci",
    category: "creative",
    icon: "🎬",
    budget: 35000000,
    targetRes: "2K / 4K Chuẩn Màu",
    highlightSpecs: "Intel QuickSync + CUDA • 32GB - 64GB RAM • SSD NVMe Gen4",
    desc: "Bộ mã hóa phần cứng kép, preview timeline mượt mà, render video 4K sắc nét và ổn định."
  },
  {
    id: "design_2d",
    title: "Đồ Họa 2D Photoshop & Lightroom",
    category: "creative",
    icon: "🎨",
    budget: 18000000,
    targetRes: "1080p / 2K sRGB 100%",
    highlightSpecs: "CPU xung đơn nhân cao • 16GB - 32GB RAM • SSD NVMe 1TB",
    desc: "Chuyên trị chỉnh sửa ảnh Raw nặng hàng trăm layer, xuất màu chuẩn xác cho in ấn và thiết kế truyền thông."
  },
  {
    id: "architect_3d",
    title: "Kiến Trúc 3D, AutoCAD & Revit",
    category: "creative",
    icon: "📐",
    budget: 42000000,
    targetRes: "2K / 4K Kỹ Thuật",
    highlightSpecs: "CPU i7/R7 xung cao • NVIDIA RTX VRAM lớn • 32GB RAM",
    desc: "Xử lý bản vẽ kỹ thuật phức tạp, diễn họa 3ds Max, Blender, SketchUp không giật lag khung hình."
  },

  // 💻 Lập Trình & AI Workstation
  {
    id: "office",
    title: "Văn Phòng, Kế Toán & Excel Nặng",
    category: "work",
    icon: "💼",
    budget: 12000000,
    targetRes: "1080p 60-75Hz",
    highlightSpecs: "CPU ổn định mát mẻ • 16GB RAM • SSD 500GB NVMe",
    desc: "Mở file Excel hàng trăm MB triệu dòng tức thì, chạy phần mềm kế toán MISA, ERP bền bỉ 4-5 năm."
  },
  {
    id: "developer",
    title: "Lập Trình Fullstack & Docker",
    category: "work",
    icon: "💻",
    budget: 25000000,
    targetRes: "2K Màn Rộng",
    highlightSpecs: "CPU 12-20 luồng • 32GB RAM • SSD NVMe đọc 5000MB/s",
    desc: "Biên dịch code siêu nhanh, chạy đồng thời Docker, Kubernetes, WSL2 và IDE mượt mà không nghẽn RAM."
  },
  {
    id: "ai",
    title: "AI Workstation & Local LLM",
    category: "work",
    icon: "🤖",
    budget: 50000000,
    targetRes: "Đa màn hình",
    highlightSpecs: "NVIDIA RTX 16GB - 24GB VRAM • 64GB RAM • Nguồn công suất lớn",
    desc: "Tối ưu chạy mô hình ngôn ngữ lớn Ollama, Stable Diffusion ComfyUI và huấn luyện Deep Learning."
  },
  {
    id: "streaming",
    title: "Livestreaming Game & VTuber",
    category: "work",
    icon: "📡",
    budget: 30000000,
    targetRes: "1080p 60fps Stream",
    highlightSpecs: "Bộ mã hóa NVENC/AV1 • 32GB RAM • Tản nhiệt êm ái",
    desc: "Vừa chiến game vừa phát sóng trực tiếp lên YouTube/TikTok không drop khung hình, âm thanh trong trẻo."
  },

  // 🎨 Phong Cách & Thẩm Mỹ
  {
    id: "white_theme",
    title: "Tone Trắng Bể Cá Panorama",
    category: "style",
    icon: "⚪",
    budget: 28000000,
    targetRes: "2K Gaming",
    highlightSpecs: "Vỏ Case bể cá vô cực • Linh kiện Full Trắng / Bạc • Quạt ARGB",
    desc: "Góc làm việc sang trọng hiện đại, kính cường lực tràn viền khoe trọn linh kiện tone trắng tinh tế."
  },
  {
    id: "silent",
    title: "Stealth Siêu Êm & Mát Mẻ",
    category: "style",
    icon: "❄️",
    budget: 26000000,
    targetRes: "2K Work/Play",
    highlightSpecs: "Tản nhiệt cao cấp • Quạt FDB êm ái • Vỏ cách âm tối ưu",
    desc: "Độ ồn tối đa dưới 22dB, làm việc ban đêm yên tĩnh tuyệt đối, giữ nhiệt độ CPU/GPU luôn mát dịu."
  }
];

export function PrebuiltTemplatesSection({
  onSelectPreset,
  onCustomizePreset,
  isCollapsible = false,
  defaultExpanded = true
}) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const filteredTemplates = PREBUILT_TEMPLATES.filter(
    (item) => selectedCategory === "all" || item.category === selectedCategory
  );

  return (
    <section
      aria-label="Các bộ PC mẫu sẵn có"
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #cbd5e1",
        borderRadius: "16px",
        padding: "20px 24px",
        marginBottom: "20px",
        boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)"
      }}
    >
      {/* Header khu vực */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: isExpanded ? "16px" : 0
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "8px",
              backgroundColor: "#f1f5f9",
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              flexShrink: 0
            }}
          >
            📦
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#0f172a" }}>
                Các Bộ PC Mẫu Sẵn Có (Chọn Nhanh Theo Nhu Cầu)
              </h3>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  backgroundColor: "#eff6ff",
                  color: "#2563eb",
                  border: "1px solid #bfdbfe"
                }}
              >
                12 Bộ Chuẩn Lab
              </span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "#64748b" }}>
              Được đội ngũ kỹ thuật cấu hình sẵn theo tỷ lệ P/P tối ưu, tương thích 100% chuẩn kỹ thuật.
            </p>
          </div>
        </div>

        {isCollapsible && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: "none",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: "700",
              color: "#334155",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>{isExpanded ? "Thu gọn ▲" : "Xem danh sách ▼"}</span>
          </button>
        )}
      </div>

      {isExpanded && (
        <>
          {/* Bộ lọc Danh mục */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              overflowX: "auto",
              paddingBottom: "10px",
              marginBottom: "14px",
              borderBottom: "1px solid #f1f5f9"
            }}
          >
            {CATEGORIES.map((cat) => {
              const isSel = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: isSel ? "1.5px solid #0f172a" : "1px solid #e2e8f0",
                    backgroundColor: isSel ? "#0f172a" : "#ffffff",
                    color: isSel ? "#ffffff" : "#334155",
                    fontSize: "12px",
                    fontWeight: isSel ? "700" : "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    whiteSpace: "nowrap",
                    transition: "background-color 0.15s ease"
                  }}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Lưới các bộ PC mẫu */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
              gap: "12px"
            }}
          >
            {filteredTemplates.map((tpl) => (
              <div
                key={tpl.id}
                style={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "border-color 0.15s ease, background-color 0.15s ease"
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "20px", lineHeight: "1" }}>{tpl.icon}</span>
                      <h4 style={{ margin: 0, fontSize: "13.5px", fontWeight: "800", color: "#0f172a", lineHeight: "1.3" }}>
                        {tpl.title}
                      </h4>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "14px", fontWeight: "900", color: "#2563eb" }}>
                      {formatCurrency(tpl.budget)}đ
                    </span>
                    <span style={{ fontSize: "10.5px", fontWeight: "700", padding: "2px 6px", borderRadius: "4px", backgroundColor: "#eff6ff", color: "#1e40af" }}>
                      {tpl.targetRes}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: "11px",
                      color: "#475569",
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                      padding: "6px 8px",
                      marginBottom: "8px",
                      lineHeight: "1.4"
                    }}
                  >
                    ⚡ <strong>Cấu hình:</strong> {tpl.highlightSpecs}
                  </div>

                  <p style={{ margin: "0 0 12px", fontSize: "11.5px", color: "#64748b", lineHeight: "1.45" }}>
                    {tpl.desc}
                  </p>
                </div>

                {/* 2 Nút hành động */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => onSelectPreset && onSelectPreset(tpl)}
                    title="Nạp ngay cấu hình này để xem xét và đặt mua"
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "none",
                      backgroundColor: "#0f172a",
                      color: "#ffffff",
                      fontSize: "11.5px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px"
                    }}
                  >
                    <span>⚡</span>
                    <span>Chọn Nhanh Bộ Này</span>
                  </button>

                  {onCustomizePreset && (
                    <button
                      type="button"
                      onClick={() => onCustomizePreset(tpl)}
                      title="Mở bộ tiêu chí 5 bước với các thông số của bộ này"
                      style={{
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        backgroundColor: "#ffffff",
                        color: "#334155",
                        fontSize: "11.5px",
                        fontWeight: "700",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px"
                      }}
                    >
                      <span>⚙️</span>
                      <span>Tùy Biến</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default PrebuiltTemplatesSection;
