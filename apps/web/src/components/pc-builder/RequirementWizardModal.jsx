import { useState, useEffect } from "react";

/* ── 1. CÁC MỤC ĐÍCH CHÍNH & TIÊU CHÍ PHÂN NHÁNH CHUYÊN SÂU ── */
const DETAILED_PURPOSES = [
  {
    id: "gaming",
    label: "Gaming & eSports",
    icon: "🎮",
    desc: "Chiến game mượt mà từ eSports tốc độ cao đến bom tấn AAA thế giới mở",
    subOptions: [
      {
        id: "aaa_raytracing",
        label: "Game AAA đồ họa cực hạn (Wukong, Cyberpunk, GTA V, Alan Wake 2)",
        hint: "Ưu tiên Card đồ họa (GPU) mạnh, VRAM 12GB - 16GB+, hỗ trợ Ray Tracing & DLSS/FSR",
        badge: "VRAM 12GB+"
      },
      {
        id: "esports_fps",
        label: "eSports FPS thi đấu (CS2, Valorant, LMHT, FO4, Apex Legends, PUBG)",
        hint: "Tối ưu xung nhịp đơn nhân CPU, chỉ số IPC cao, duy trì 144Hz - 360Hz không drop FPS",
        badge: "Max FPS 240Hz+"
      },
      {
        id: "emulator_multitab",
        label: "Giả lập Android & Cày game nhiều tab (NoxPlayer, LDPlayer 5 - 20 tab)",
        hint: "Đòi hỏi CPU nhiều nhân/luồng (16 - 24 luồng) và dung lượng RAM lớn (32GB - 64GB)",
        badge: "RAM 32GB - 64GB"
      },
      {
        id: "simulation_strategy",
        label: "Mô phỏng thế giới & Chiến thuật nặng (Cities Skylines 2, MS Flight Sim, Total War)",
        hint: "Ăn cực nhiều bộ nhớ đệm CPU Cache (AMD 3D V-Cache / Intel Core i7) và tối thiểu 32GB RAM",
        badge: "CPU Cache lớn"
      }
    ]
  },
  {
    id: "editing",
    label: "Đồ Họa, Dựng Phim & Media",
    icon: "🎬",
    desc: "Xử lý hình ảnh, dựng video 4K/8K, hiệu ứng kỹ xảo và diễn họa kiến trúc",
    subOptions: [
      {
        id: "video_4k_8k",
        label: "Dựng video 4K / 8K (Adobe Premiere Pro, DaVinci Resolve Studio, CapCut Pro)",
        hint: "Cần bộ mã hóa phần cứng Intel QuickSync / Nvidia NVENC, RAM 32GB - 64GB, SSD Gen4 nhanh",
        badge: "QuickSync / NVENC"
      },
      {
        id: "design_2d_photo",
        label: "Đồ họa 2D, Thiết kế & Chỉnh màu (Photoshop, Illustrator, Lightroom Classic)",
        hint: "Tối ưu xung nhịp đơn nhân CPU, RAM 16GB - 32GB, xuất màu chuẩn xác cho màn hình đồ họa",
        badge: "CPU Xung Cao"
      },
      {
        id: "cad_bim_arch",
        label: "Kiến trúc, Kỹ thuật CAD & BIM (AutoCAD, Revit, SketchUp, Lumion, SolidWorks)",
        hint: "Cần CPU xung cao, GPU ổn định driver DirectX/OpenGL, RAM 32GB+, tản nhiệt VRM khỏe",
        badge: "RAM 32GB+"
      },
      {
        id: "vfx_3d_render",
        label: "Kỹ xảo 3D, VFX & Diễn họa (Blender, Cinema 4D, 3ds Max, Maya, Unreal Engine 5)",
        hint: "Cần cả CPU đa nhân render và GPU VRAM lớn để load khối cảnh phức tạp không bị văng",
        badge: "VRAM Lớn + Đa Nhân"
      }
    ]
  },
  {
    id: "ai",
    label: "Lập Trình, AI & Data Science",
    icon: "🤖",
    desc: "Huấn luyện mô hình trí tuệ nhân tạo, chạy LLM cục bộ và lập trình đa nền tảng",
    subOptions: [
      {
        id: "deeplearning_llm",
        label: "Nghiên cứu AI, Local LLM & Stable Diffusion (Ollama, LM Studio 7B-70B, ComfyUI)",
        hint: "Bắt buộc Card đồ họa NVIDIA RTX có VRAM từ 12GB - 24GB+ (CUDA Cores & Tensor Cores)",
        badge: "NVIDIA RTX 16GB+"
      },
      {
        id: "fullstack_docker",
        label: "Lập trình Fullstack, Docker & Microservices (Docker, Kubernetes, WSL2, Go/Rust)",
        hint: "Cần CPU từ 12 - 24 luồng, RAM tối thiểu 32GB - 64GB để chạy nhiều container mượt mà",
        badge: "RAM 32GB - 64GB"
      },
      {
        id: "mobile_game_dev",
        label: "Lập trình Di Động & Game Engine (Android Studio AVD, Unity, Flutter)",
        hint: "Cần CPU xung cao gánh máy ảo mượt mà, RAM 32GB và ổ cứng SSD NVMe tốc độ cao",
        badge: "SSD NVMe Gen4"
      }
    ]
  },
  {
    id: "office",
    label: "Văn Phòng & Doanh Nghiệp",
    icon: "💼",
    desc: "Tin học văn phòng, kế toán, quản trị dữ liệu và học tập bền bỉ dài lâu",
    subOptions: [
      {
        id: "data_excel_erp",
        label: "Kế toán, Xử lý file Excel nặng & ERP (File hàng trăm MB triệu dòng, Power BI, SQL)",
        hint: "Cần CPU mượt mà, RAM 16GB - 32GB và SSD NVMe đọc ghi nhanh để mở file tức thì",
        badge: "RAM 16GB - 32GB"
      },
      {
        id: "office_standard",
        label: "Văn phòng tiêu chuẩn, Soạn thảo & Học tập (Word, Excel, Lướt web, Họp Zoom)",
        hint: "Tối ưu chi phí, vận hành êm ái, siêu bền bỉ, tiết kiệm điện năng cho văn phòng",
        badge: "Tối Ưu Chi Phí"
      }
    ]
  },
  {
    id: "streaming",
    label: "Livestreaming & Sáng Tạo",
    icon: "📡",
    desc: "Phát sóng trực tiếp game, trò chuyện VTuber trên YouTube, TikTok, Facebook",
    subOptions: [
      {
        id: "game_stream_obs",
        label: "Vừa chơi game vừa phát sóng trực tiếp (OBS Studio, TikTok Live Studio, YouTube)",
        hint: "Cần GPU có bộ mã hóa AV1/NVENC riêng biệt để stream mà không làm tụt FPS trong game",
        badge: "NVENC / AV1"
      },
      {
        id: "vtuber_3d",
        label: "VTuber & Motion Capture (Live2D, VTube Studio, 3D Face Tracking)",
        hint: "Cần CPU và GPU gánh đồng thời mô hình 3D, phần mềm tracking và game song song",
        badge: "CPU Đa Luồng"
      }
    ]
  }
];

/* ── 2. ĐỘ PHÂN GIẢI & TẦN SỐ QUÉT & MÀN HÌNH ── */
const RESOLUTION_OPTIONS = [
  { id: "1080p", label: "1080p Full HD", desc: "Chuẩn phổ biến, tối đa hóa chỉ số FPS cho game thi đấu eSports", badge: "Chuẩn FPS" },
  { id: "2k", label: "1440p / 2K QHD", desc: "Chuẩn vàng hiện đại, cân bằng hoàn hảo giữa độ sắc nét và độ mượt", badge: "Chuẩn Vàng" },
  { id: "4k", label: "4K Ultra HD (2160p)", desc: "Hình ảnh siêu nét, hiển thị tối thượng cho màn hình 32 inch+ hoặc TV OLED", badge: "Ultra Sharp" },
  { id: "ultrawide", label: "Màn Siêu Rộng Ultrawide", desc: "Tỉ lệ 21:9 / 32:9 cho góc nhìn bao quát trong đua xe, bay lượn và làm việc", badge: "21:9 Siêu Rộng" }
];

const REFRESH_RATE_OPTIONS = [
  { id: "60hz", label: "60Hz - 75Hz (Văn phòng / Đồ họa màu)", desc: "Phù hợp tác vụ tĩnh và màn hình thiết kế đồ họa" },
  { id: "144hz", label: "120Hz - 180Hz (Gaming chuẩn mượt mà)", desc: "Mượt mà vượt trội, tiêu chuẩn tối thiểu cho game thủ" },
  { id: "240hz", label: "240Hz - 360Hz+ (eSports thi đấu)", desc: "Độ trễ phản hồi cực thấp, dành riêng cho game thủ chuyên nghiệp" }
];

const MONITOR_COUNT_OPTIONS = [
  { id: "1", label: "1 Màn Hình Độc Lập", desc: "Góc làm việc tiêu chuẩn gọn gàng" },
  { id: "2", label: "2 Màn Hình Song Song", desc: "Vừa làm việc vừa chat / theo dõi tài liệu / giám sát livestream" },
  { id: "3", label: "3+ Màn Hình Hoặc Màn Phụ", desc: "Không gian làm việc mở rộng cho trader, lập trình viên, dựng phim" }
];

/* ── 3. THẨM MỸ, KÍCH THƯỚC & TIẾNG ỒN ── */
const AESTHETIC_OPTIONS = [
  { id: "stealth", label: "🖤 Stealth All-Black", desc: "Tone đen tuyền lịch lãm, tối giản sang trọng, không đèn LED gây chói mắt" },
  { id: "white_tank", label: "⚪ Pure White Snow (Trắng Bể Cá)", desc: "Đồng bộ tone trắng từ vỏ case, tản nhiệt, RAM đến card đồ họa và dây nguồn" },
  { id: "rgb_gaming", label: "🌈 RGB Gaming Showroom", desc: "Hệ thống quạt LED ARGB đồng bộ rực rỡ, đậm chất game thủ" },
  { id: "minimal_contrast", label: "☯️ Minimal Contrast (Trắng - Đen)", desc: "Phong cách tương phản hiện đại, tinh tế và không lỗi mốt" }
];

const CASE_SIZE_OPTIONS = [
  { id: "mid_tower", label: "Mid-Tower Tiêu Chuẩn", desc: "Kích thước thông dụng nhất, luồng gió thoáng khí, dễ nâng cấp và vệ sinh" },
  { id: "panoramic", label: "Bể Cá Panorama Kính Trong Suốt", desc: "Kính cường lực 2 mặt không cột góc, khoe trọn linh kiện nội thất bên trong" },
  { id: "compact", label: "Nhỏ Gọn (M-ATX / ITX)", desc: "Tiết kiệm tối đa diện tích mặt bàn làm việc, dễ dàng di chuyển" },
  { id: "full_tower", label: "Full-Tower Không Gian Lớn", desc: "Không gian cực rộng rãi, lắp vừa tản nhiệt nước custom và nhiều ổ cứng" }
];

const ACOUSTIC_OPTIONS = [
  { id: "silent", label: "🤫 Siêu Yên Tĩnh (Silent Focus < 25dB)", desc: "Quạt êm ái, tối ưu làm việc đêm trong phòng ngủ không nghe tiếng ồn" },
  { id: "balanced", label: "⚖️ Cân Bằng Tiêu Chuẩn", desc: "Độ ồn vừa phải, quạt tự động điều tốc theo tải nhiệt độ" },
  { id: "max_airflow", label: "🌪️ Tối Đa Lưu Lượng Gió (Max Airflow)", desc: "Quạt quay mạnh mẽ giúp linh kiện luôn mát lạnh nhất khi full tải" }
];

/* ── 4. TIÊU CHUẨN PHẦN CỨNG & NỀN TẢNG ── */
const PLATFORM_PREFERENCES = [
  { id: "auto", label: "🌐 Tự Động Tối Ưu P/P", desc: "Hệ thống tự chọn vi xử lý Intel hoặc AMD có hiệu năng trên giá thành tốt nhất" },
  { id: "intel", label: "🔵 Ưu Tiên Intel Core", desc: "Tối ưu dựng phim Adobe QuickSync, đa nhiệm P-Core/E-Core và phần mềm doanh nghiệp" },
  { id: "amd", label: "🔴 Ưu Tiên AMD Ryzen", desc: "Tiết kiệm điện, mát mẻ, socket AM5 hỗ trợ nâng cấp đến 2027+, 3D V-Cache đỉnh cao" }
];

const GPU_BRAND_PREFERENCES = [
  { id: "auto", label: "🌐 Tự Động Tối Ưu", desc: "Chọn card đồ họa mang lại FPS cao nhất trong hạn mức ngân sách" },
  { id: "nvidia", label: "🟢 Bắt Buộc NVIDIA GeForce", desc: "Cần CUDA Cores cho AI/Deep Learning, Ray Tracing, DLSS 3.5 và NVENC" },
  { id: "amd", label: "🔴 Chấp Nhận AMD Radeon", desc: "Tối ưu thuần P/P gaming truyền thống, dung lượng VRAM dồi dào trong tầm giá" }
];

const COOLING_PREFERENCES = [
  { id: "air", label: "💨 Tản nhiệt khí tháp đôi (Air Cooler)", desc: "Bền bỉ vĩnh cửu, không lo rò rỉ nước, chi phí hợp lý và an toàn tuyệt đối" },
  { id: "aio", label: "🌊 Tản nhiệt nước AIO 240/360mm", desc: "Làm mát sâu cho CPU mạnh khi tải nặng, tạo điểm nhấn thẩm mỹ hiện đại" },
  { id: "aio_lcd", label: "🖥️ Tản nước có màn hình LCD kỹ thuật số", desc: "Màn hình trên pump hiển thị nhiệt độ CPU/GPU thực tế hoặc ảnh động GIF" }
];

const RAM_OPTIONS = [
  { id: "16gb", label: "16GB RAM", desc: "Tiêu chuẩn cơ bản cho văn phòng và các tựa game eSports phổ thông" },
  { id: "32gb", label: "32GB RAM (Khuyên Dùng)", desc: "Mức chuẩn vàng hiện nay cho Gaming AAA, dựng video 4K và mở 50 tab Chrome" },
  { id: "64gb", label: "64GB+ RAM", desc: "Dành riêng cho Render 3D, After Effects nặng, chạy nhiều container Docker & máy ảo" }
];

const STORAGE_OPTIONS = [
  { id: "500gb", label: "500GB SSD NVMe", desc: "Đủ cài đặt Windows và một số phần mềm cùng 2 - 3 game nhẹ" },
  { id: "1tb", label: "1TB SSD NVMe (Khuyên Dùng)", desc: "Thoải mái cài Win, lưu trữ dữ liệu và 5 - 10 tựa game dung lượng lớn" },
  { id: "2tb", label: "2TB+ SSD NVMe", desc: "Lưu trữ kho game khổng lồ hoặc khối lượng tư liệu video đồ họa đồ sộ" }
];

export function RequirementWizardModal({
  isOpen,
  onClose,
  onSubmitProfile,
  suggestionForm
}) {
  const [currentStep, setCurrentStep] = useState(1);

  // Form State
  const [purpose, setPurpose] = useState("gaming");
  const [subPurpose, setSubPurpose] = useState("aaa_raytracing");
  const [budget, setBudget] = useState("25000000");
  const [budgetFlexibility, setBudgetFlexibility] = useState("flexible"); // "strict" | "flexible" | "open"
  const [includeMonitor, setIncludeMonitor] = useState(false); // Bao gồm màn hình trong ngân sách?
  const [resolution, setResolution] = useState("2k");
  const [refreshRate, setRefreshRate] = useState("144hz");
  const [monitorCount, setMonitorCount] = useState("1");
  const [aesthetic, setAesthetic] = useState("white_tank");
  const [caseSize, setCaseSize] = useState("mid_tower");
  const [acousticPref, setAcousticPref] = useState("balanced"); // "silent" | "balanced" | "max_airflow"
  const [platformPref, setPlatformPref] = useState("auto"); // "auto" | "intel" | "amd"
  const [gpuBrandPref, setGpuBrandPref] = useState("auto"); // "auto" | "nvidia" | "amd"
  const [coolingPref, setCoolingPref] = useState("air");
  const [minRam, setMinRam] = useState("32gb");
  const [minStorage, setMinStorage] = useState("1tb");
  const [secondaryStorage, setSecondaryStorage] = useState(false); // Cần thêm HDD lưu trữ?
  const [needWifi, setNeedWifi] = useState(true);
  const [futureNeed, setFutureNeed] = useState("ready_upgrade"); // "stable_5y" | "ready_upgrade"
  const [customPrompt, setCustomPrompt] = useState("");

  // Tự động đồng bộ form state khi mở modal
  useEffect(() => {
    if (isOpen) {
      if (suggestionForm?.purpose) setPurpose(suggestionForm.purpose);
      if (suggestionForm?.subPurpose) setSubPurpose(suggestionForm.subPurpose);
      if (suggestionForm?.budget) setBudget(String(suggestionForm.budget));
      if (suggestionForm?.resolution) setResolution(suggestionForm.resolution);
      setCurrentStep(1);
    }
  }, [isOpen, suggestionForm]);

  if (!isOpen) return null;

  const currentPurposeObj = DETAILED_PURPOSES.find((p) => p.id === purpose) || DETAILED_PURPOSES[0];

  function handleAddTag(tag) {
    setCustomPrompt((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return tag;
      if (trimmed.includes(tag)) return prev;
      return `${trimmed}, ${tag}`;
    });
  }

  function handleFinalSubmit(engineType) {
    const isAi = engineType === "ai";
    const profile = {
      engineType, // "system" | "ai"
      purpose,
      subPurpose,
      budget: Number(budget || 25000000),
      budgetFlexibility,
      includeMonitor,
      resolution,
      refreshRate,
      monitorCount,
      aesthetic,
      caseSize,
      acousticPref,
      platformPref,
      gpuBrandPref,
      coolingPref,
      minRam,
      minStorage,
      secondaryStorage,
      needWifi,
      futureNeed,
      // Hướng Hệ Thống CHỈ nhận tiêu chí, Hướng AI nhận tiêu chí + ô nhập thêm
      customPrompt: isAi ? customPrompt.trim() : "",
      promptText: isAi ? customPrompt.trim() : ""
    };

    onSubmitProfile(profile);
    onClose();
  }

  return (
    <div
      className="req-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px"
      }}
    >
      <div
        className="req-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(980px, 96vw)",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "18px",
          background: "#ffffff",
          border: "1px solid #cbd5e1",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
          overflow: "hidden"
        }}
      >
        {/* ── HEADER ── */}
        <header
          style={{
            padding: "16px 24px",
            background: "#0f172a",
            color: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #1e293b"
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span
                style={{
                  background: "#2563eb",
                  color: "#ffffff",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: "800",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}
              >
                PC BUILD ARCHITECT
              </span>
              <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                Bộ Thiết Lập Tiêu Chí Xây Dựng Máy Tính Toàn Diện
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#ffffff" }}>
              Xác Định Nhu Cầu & Tiêu Chuẩn Phần Cứng Cho Cấu Hình PC
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#cbd5e1",
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              fontSize: "18px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease"
            }}
          >
            ×
          </button>
        </header>

        {/* ── STEPPER NAVIGATION BAR ── */}
        <nav
          style={{
            padding: "12px 24px",
            backgroundColor: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            overflowX: "auto"
          }}
        >
          {[
            { step: 1, label: "1. Nhu Cầu & Tác Vụ" },
            { step: 2, label: "2. Ngân Sách Dự Kiến" },
            { step: 3, label: "3. Màn Hình & Trải Nghiệm" },
            { step: 4, label: "4. Thẩm Mỹ & Độ Ồn" },
            { step: 5, label: "5. Phần Cứng & Đề Xuất" }
          ].map((item, idx) => {
            const isActive = currentStep === item.step;
            const isPassed = currentStep > item.step;
            return (
              <div
                key={item.step}
                onClick={() => setCurrentStep(item.step)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  opacity: isActive ? 1 : isPassed ? 0.9 : 0.65,
                  flex: 1,
                  minWidth: "140px",
                  padding: "4px 6px",
                  borderRadius: "6px",
                  transition: "background-color 0.15s ease"
                }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    fontWeight: "800",
                    background: isActive ? "#2563eb" : isPassed ? "#16a34a" : "#cbd5e1",
                    color: "#ffffff",
                    flexShrink: 0
                  }}
                >
                  {isPassed ? "✓" : item.step}
                </div>
                <span
                  style={{
                    fontSize: "11.5px",
                    fontWeight: isActive ? "800" : "600",
                    color: isActive ? "#0f172a" : isPassed ? "#16a34a" : "#64748b",
                    whiteSpace: "nowrap"
                  }}
                >
                  {item.label}
                </span>
                {idx < 4 && (
                  <div
                    style={{
                      flex: 1,
                      height: "1.5px",
                      backgroundColor: isPassed ? "#16a34a" : "#e2e8f0",
                      marginLeft: "6px"
                    }}
                  />
                )}
              </div>
            );
          })}
        </nav>

        {/* ── STEP CONTENT CONTAINER (SCROLLABLE) ── */}
        <div style={{ padding: "22px 26px", overflowY: "auto", flex: 1, backgroundColor: "#ffffff" }}>
          {/* ════════════ BƯỚC 1: MỤC ĐÍCH & PHẦN MỀM / GAME CỤ THỂ ════════════ */}
          {currentStep === 1 && (
            <div>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", fontWeight: "800", color: "#2563eb", textTransform: "uppercase" }}>
                  Bước 1 trên 5
                </div>
                <h3 style={{ margin: "2px 0 4px", fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
                  Mục Đích Sử Dụng Chính & Tác Vụ Cụ Thể Của Bạn
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                  Chọn lĩnh vực chính, sau đó chọn phân nhánh phần mềm hoặc tựa game bạn sử dụng thường xuyên nhất để hệ thống tối ưu đúng linh kiện gánh tải.
                </p>
              </div>

              {/* Nhóm mục đích chính */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px", marginBottom: "20px" }}>
                {DETAILED_PURPOSES.map((p) => {
                  const isSelected = purpose === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setPurpose(p.id);
                        if (p.subOptions && p.subOptions[0]) {
                          setSubPurpose(p.subOptions[0].id);
                        }
                      }}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "10px",
                        border: isSelected ? "2px solid #2563eb" : "1px solid #e2e8f0",
                        backgroundColor: isSelected ? "#eff6ff" : "#ffffff",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px"
                      }}
                    >
                      <span style={{ fontSize: "22px", lineHeight: "1" }}>{p.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "13.5px", fontWeight: "700", color: isSelected ? "#1e40af" : "#0f172a" }}>
                          {p.label}
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", lineHeight: "1.4" }}>
                          {p.desc}
                        </div>
                      </div>
                      <span style={{ color: isSelected ? "#2563eb" : "#cbd5e1", fontSize: "16px" }}>
                        {isSelected ? "●" : "○"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Phân nhánh chi tiết của mục đích đã chọn */}
              <div
                style={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "16px"
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#334155", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>🎯</span>
                  <span>Chi tiết ứng dụng / thể loại game bạn tập trung ({currentPurposeObj.label}):</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {currentPurposeObj.subOptions.map((sub) => {
                    const isSubSelected = subPurpose === sub.id;
                    return (
                      <label
                        key={sub.id}
                        onClick={() => setSubPurpose(sub.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          border: isSubSelected ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                          backgroundColor: isSubSelected ? "#ffffff" : "#ffffff",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          boxShadow: isSubSelected ? "0 2px 8px rgba(37, 99, 235, 0.12)" : "none"
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "13px", fontWeight: isSubSelected ? "700" : "600", color: isSubSelected ? "#1e40af" : "#0f172a" }}>
                              {sub.label}
                            </span>
                            {sub.badge && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: "700",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  backgroundColor: isSubSelected ? "#dbeafe" : "#f1f5f9",
                                  color: isSubSelected ? "#1e40af" : "#475569"
                                }}
                              >
                                {sub.badge}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                            {sub.hint}
                          </span>
                        </div>
                        <input
                          type="radio"
                          name="subPurpose"
                          checked={isSubSelected}
                          onChange={() => setSubPurpose(sub.id)}
                          style={{ marginLeft: "12px", accentColor: "#2563eb", cursor: "pointer" }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ════════════ BƯỚC 2: NGÂN SÁCH DỰ KIẾN, CO GIÃN & PHẠM VI ════════════ */}
          {currentStep === 2 && (
            <div>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", fontWeight: "800", color: "#2563eb", textTransform: "uppercase" }}>
                  Bước 2 trên 5
                </div>
                <h3 style={{ margin: "2px 0 4px", fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
                  Hạn Mức Ngân Sách Dự Kiến & Độ Co Giãn
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                  Xác định mức chi phí bạn muốn đầu tư cho hệ thống máy tính và chiến lược phân bổ tài chính.
                </p>
              </div>

              {/* Ô hiển thị số tiền & Slider */}
              <div
                style={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "18px 20px",
                  marginBottom: "16px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                    Mức ngân sách mục tiêu
                  </span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                    <span style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a" }}>
                      {Number(budget || 0).toLocaleString("vi-VN")}
                    </span>
                    <span style={{ fontSize: "14px", fontWeight: "700", color: "#2563eb" }}>VNĐ</span>
                  </div>
                </div>

                <div style={{ fontSize: "12px", color: "#475569", marginBottom: "12px" }}>
                  {Number(budget) < 15000000
                    ? "Phân khúc Phổ thông: Tối ưu chi phí, mượt mà học tập, văn phòng và game eSports nhẹ."
                    : Number(budget) <= 30000000
                    ? "Phân khúc Tầm trung: Tối ưu P/P, chiến mượt mà game AAA ở độ phân giải 1080p / 2K, đồ họa 4K mượt mà."
                    : Number(budget) <= 50000000
                    ? "Phân khúc Cao cấp: Card đồ họa mạnh mẽ, tản nhiệt nước cao cấp, mượt mà game 2K/4K max settings và AI."
                    : "Phân khúc Đỉnh cao / Workstation: Sức mạnh xử lý tối thượng, render 3D chuyên nghiệp, mô hình AI lớn."}
                </div>

                <input
                  type="range"
                  min="8000000"
                  max="120000000"
                  step="1000000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  style={{
                    width: "100%",
                    accentColor: "#2563eb",
                    cursor: "pointer",
                    height: "6px"
                  }}
                />

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                  <span>8.000.000đ</span>
                  <span>30.000.000đ</span>
                  <span>60.000.000đ</span>
                  <span>120.000.000đ</span>
                </div>

                {/* Các nút chọn nhanh */}
                <div style={{ marginTop: "14px" }}>
                  <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>Hoặc chọn nhanh theo các mốc phổ biến:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {[
                      { val: "12000000", label: "12 Triệu (Văn phòng / eSports)" },
                      { val: "18000000", label: "18 Triệu (Gaming FHD / Đồ họa 2D)" },
                      { val: "25000000", label: "25 Triệu (Chuẩn Gaming 2K AAA)" },
                      { val: "35000000", label: "35 Triệu (RTX 4070 / Dựng phim 4K)" },
                      { val: "50000000", label: "50 Triệu (AI Workstation / RTX 4070Ti Super)" },
                      { val: "75000000", label: "75 Triệu (Flagship RTX 4080 / 4090)" }
                    ].map((bBtn) => (
                      <button
                        key={bBtn.val}
                        type="button"
                        onClick={() => setBudget(bBtn.val)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: budget === bBtn.val ? "1px solid #2563eb" : "1px solid #cbd5e1",
                          backgroundColor: budget === bBtn.val ? "#eff6ff" : "#ffffff",
                          color: budget === bBtn.val ? "#1e40af" : "#334155",
                          fontSize: "11.5px",
                          fontWeight: budget === bBtn.val ? "700" : "500",
                          cursor: "pointer"
                        }}
                      >
                        {bBtn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mức độ linh hoạt của ngân sách & Phạm vi tính toán */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px" }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "8px" }}>
                    Mức độ linh hoạt của ngân sách:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {[
                      { id: "flexible", label: "⚡ Linh hoạt nhẹ (±5 - 10%)", desc: "Cho phép bù thêm một chút nếu có linh kiện p/p vượt trội (VD: thêm 400k để lên đôi RAM)" },
                      { id: "strict", label: "🔒 Giới hạn cứng tuyệt đối", desc: "Tổng chi phí không được vượt quá số tiền đã chọn dù chỉ 1 đồng" },
                      { id: "open", label: "🌟 Thoải mái tối đa", desc: "Ưu tiên cấu hình hoàn hảo và đạt chuẩn linh kiện tốt nhất" }
                    ].map((item) => {
                      const isSel = budgetFlexibility === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setBudgetFlexibility(item.id)}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "8px",
                            border: isSel ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                            backgroundColor: isSel ? "#eff6ff" : "#ffffff",
                            cursor: "pointer"
                          }}
                        >
                          <div style={{ fontSize: "12.5px", fontWeight: isSel ? "700" : "600", color: isSel ? "#1e40af" : "#0f172a" }}>
                            {item.label}
                          </div>
                          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                            {item.desc}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "8px" }}>
                    Phạm vi tính toán ngân sách:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {[
                      { val: false, label: "🖥️ Chỉ riêng thùng máy PC (Case Only)", desc: "100% ngân sách tập trung tối đa cho 8 linh kiện phần cứng thùng máy" },
                      { val: true, label: "🖥️+ Dự trù kèm Màn hình trong ngân sách", desc: "Hệ thống sẽ cân đối trích khoảng 15-20% ngân sách cho màn hình phù hợp" }
                    ].map((item) => {
                      const isSel = includeMonitor === item.val;
                      return (
                        <div
                          key={String(item.val)}
                          onClick={() => setIncludeMonitor(item.val)}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "8px",
                            border: isSel ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                            backgroundColor: isSel ? "#eff6ff" : "#ffffff",
                            cursor: "pointer"
                          }}
                        >
                          <div style={{ fontSize: "12.5px", fontWeight: isSel ? "700" : "600", color: isSel ? "#1e40af" : "#0f172a" }}>
                            {item.label}
                          </div>
                          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                            {item.desc}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════ BƯỚC 3: MÀN HÌNH, TẦN SỐ QUÉT & TRẢI NGHIỆM ════════════ */}
          {currentStep === 3 && (
            <div>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", fontWeight: "800", color: "#2563eb", textTransform: "uppercase" }}>
                  Bước 3 trên 5
                </div>
                <h3 style={{ margin: "2px 0 4px", fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
                  Môi Trường Hiển Thị, Tần Số Quét & Số Lượng Màn Hình
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                  Hệ thống dựa trên độ phân giải và tần số quét mục tiêu để tính toán chính xác sức mạnh Card đồ họa (GPU) và CPU cần thiết, tránh lãng phí hoặc thiếu hụt FPS.
                </p>
              </div>

              {/* Độ phân giải mục tiêu */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "8px" }}>
                  1. Độ phân giải màn hình chính của bạn:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
                  {RESOLUTION_OPTIONS.map((res) => {
                    const isSel = resolution === res.id;
                    return (
                      <div
                        key={res.id}
                        onClick={() => setResolution(res.id)}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "10px",
                          border: isSel ? "2px solid #2563eb" : "1px solid #e2e8f0",
                          backgroundColor: isSel ? "#eff6ff" : "#ffffff",
                          cursor: "pointer",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ fontSize: "13.5px", fontWeight: "700", color: isSel ? "#1e40af" : "#0f172a" }}>
                            {res.label}
                          </span>
                          <span style={{ fontSize: "10px", fontWeight: "700", padding: "1px 5px", borderRadius: "4px", backgroundColor: isSel ? "#dbeafe" : "#f1f5f9", color: isSel ? "#1e40af" : "#64748b" }}>
                            {res.badge}
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b", lineHeight: "1.35" }}>
                          {res.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tần số quét & Số lượng màn hình */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "8px" }}>
                    2. Tần số quét màn hình (Refresh Rate):
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {REFRESH_RATE_OPTIONS.map((rate) => {
                      const isSel = refreshRate === rate.id;
                      return (
                        <div
                          key={rate.id}
                          onClick={() => setRefreshRate(rate.id)}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "8px",
                            border: isSel ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                            backgroundColor: isSel ? "#eff6ff" : "#ffffff",
                            cursor: "pointer"
                          }}
                        >
                          <div style={{ fontSize: "12.5px", fontWeight: isSel ? "700" : "600", color: isSel ? "#1e40af" : "#0f172a" }}>
                            {rate.label}
                          </div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            {rate.desc}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "8px" }}>
                    3. Số lượng màn hình kết nối:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {MONITOR_COUNT_OPTIONS.map((m) => {
                      const isSel = monitorCount === m.id;
                      return (
                        <div
                          key={m.id}
                          onClick={() => setMonitorCount(m.id)}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "8px",
                            border: isSel ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                            backgroundColor: isSel ? "#eff6ff" : "#ffffff",
                            cursor: "pointer"
                          }}
                        >
                          <div style={{ fontSize: "12.5px", fontWeight: isSel ? "700" : "600", color: isSel ? "#1e40af" : "#0f172a" }}>
                            {m.label}
                          </div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            {m.desc}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════ BƯỚC 4: THẨM MỸ, KÍCH THƯỚC & ĐỘ ỒN ════════════ */}
          {currentStep === 4 && (
            <div>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", fontWeight: "800", color: "#2563eb", textTransform: "uppercase" }}>
                  Bước 4 trên 5
                </div>
                <h3 style={{ margin: "2px 0 4px", fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
                  Phong Cách Thẩm Mỹ, Kích Thước & Tiêu Chuẩn Tiếng Ồn
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                  Tùy biến ngoại hình, kiểu dáng vỏ case và mức độ êm ái khi máy hoạt động theo sở thích và không gian phòng của bạn.
                </p>
              </div>

              {/* Tông màu thẩm mỹ */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "8px" }}>
                  1. Phong cách thẩm mỹ & Tông màu chủ đạo:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
                  {AESTHETIC_OPTIONS.map((a) => {
                    const isSel = aesthetic === a.id;
                    return (
                      <div
                        key={a.id}
                        onClick={() => setAesthetic(a.id)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "8px",
                          border: isSel ? "2px solid #2563eb" : "1px solid #e2e8f0",
                          backgroundColor: isSel ? "#eff6ff" : "#ffffff",
                          cursor: "pointer"
                        }}
                      >
                        <div style={{ fontSize: "12.5px", fontWeight: "700", color: isSel ? "#1e40af" : "#0f172a" }}>
                          {a.label}
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                          {a.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Kích thước case & Độ ồn */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "8px" }}>
                    2. Kích thước & Kiểu dáng thùng máy:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {CASE_SIZE_OPTIONS.map((cs) => {
                      const isSel = caseSize === cs.id;
                      return (
                        <div
                          key={cs.id}
                          onClick={() => setCaseSize(cs.id)}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "8px",
                            border: isSel ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                            backgroundColor: isSel ? "#eff6ff" : "#ffffff",
                            cursor: "pointer"
                          }}
                        >
                          <div style={{ fontSize: "12.5px", fontWeight: isSel ? "700" : "600", color: isSel ? "#1e40af" : "#0f172a" }}>
                            {cs.label}
                          </div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            {cs.desc}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "8px" }}>
                    3. Tiêu chuẩn độ ồn khi vận hành:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {ACOUSTIC_OPTIONS.map((ac) => {
                      const isSel = acousticPref === ac.id;
                      return (
                        <div
                          key={ac.id}
                          onClick={() => setAcousticPref(ac.id)}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "8px",
                            border: isSel ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                            backgroundColor: isSel ? "#eff6ff" : "#ffffff",
                            cursor: "pointer"
                          }}
                        >
                          <div style={{ fontSize: "12.5px", fontWeight: isSel ? "700" : "600", color: isSel ? "#1e40af" : "#0f172a" }}>
                            {ac.label}
                          </div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            {ac.desc}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════ BƯỚC 5: TIÊU CHUẨN PHẦN CỨNG & PHÂN NHÁNH 2 HƯỚNG ĐỀ XUẤT ════════════ */}
          {currentStep === 5 && (
            <div>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", fontWeight: "800", color: "#2563eb", textTransform: "uppercase" }}>
                  Bước 5 trên 5 • Bước Quyết Định Phân Nhánh
                </div>
                <h3 style={{ margin: "2px 0 4px", fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
                  Tiêu Chuẩn Phần Cứng (Đầu Vào Dùng Chung) & Chọn 1 Trong 2 Hướng Đề Xuất
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                  Toàn bộ các tiêu chí bên dưới là <strong>đầu vào chuẩn mực chung</strong> cho cả 2 hướng. Ở bước cuối, bạn chọn <strong>Hệ Thống Đề Xuất</strong> (chỉ nhận tiêu chí) hoặc <strong>AI Tư Vấn</strong> (nhận tiêu chí + có thêm ô nhập yêu cầu riêng).
                </p>
              </div>

              {/* Tùy chọn Nền tảng CPU & GPU */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px", marginBottom: "14px" }}>
                <div>
                  <div style={{ fontSize: "11.5px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                    Khẩu vị Nền tảng Vi Xử Lý (CPU):
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {PLATFORM_PREFERENCES.map((pl) => {
                      const isSel = platformPref === pl.id;
                      return (
                        <div
                          key={pl.id}
                          onClick={() => setPlatformPref(pl.id)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: isSel ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                            backgroundColor: isSel ? "#eff6ff" : "#ffffff",
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                        >
                          <span style={{ fontWeight: isSel ? "700" : "600", color: isSel ? "#1e40af" : "#0f172a" }}>{pl.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11.5px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                    Khẩu vị Card Đồ Họa (GPU):
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {GPU_BRAND_PREFERENCES.map((gb) => {
                      const isSel = gpuBrandPref === gb.id;
                      return (
                        <div
                          key={gb.id}
                          onClick={() => setGpuBrandPref(gb.id)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: isSel ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                            backgroundColor: isSel ? "#eff6ff" : "#ffffff",
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                        >
                          <span style={{ fontWeight: isSel ? "700" : "600", color: isSel ? "#1e40af" : "#0f172a" }}>{gb.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11.5px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                    Loại Tản Nhiệt CPU:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {COOLING_PREFERENCES.map((cp) => {
                      const isSel = coolingPref === cp.id;
                      return (
                        <div
                          key={cp.id}
                          onClick={() => setCoolingPref(cp.id)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: isSel ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                            backgroundColor: isSel ? "#eff6ff" : "#ffffff",
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                        >
                          <span style={{ fontWeight: isSel ? "700" : "600", color: isSel ? "#1e40af" : "#0f172a" }}>{cp.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Tùy chọn RAM, SSD, Wi-Fi & Nâng Cấp */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "10px",
                  padding: "12px 14px",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  marginBottom: "16px"
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", marginBottom: "4px" }}>DUNG LƯỢNG RAM TỐI THIỂU</div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {RAM_OPTIONS.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setMinRam(r.id)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          border: minRam === r.id ? "1px solid #2563eb" : "1px solid #cbd5e1",
                          backgroundColor: minRam === r.id ? "#eff6ff" : "#ffffff",
                          color: minRam === r.id ? "#1e40af" : "#334155",
                          fontSize: "11px",
                          fontWeight: "700",
                          cursor: "pointer"
                        }}
                      >
                        {r.id.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", marginBottom: "4px" }}>DUNG LƯỢNG SSD TỐI THIỂU</div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {STORAGE_OPTIONS.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setMinStorage(s.id)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          border: minStorage === s.id ? "1px solid #2563eb" : "1px solid #cbd5e1",
                          backgroundColor: minStorage === s.id ? "#eff6ff" : "#ffffff",
                          color: minStorage === s.id ? "#1e40af" : "#334155",
                          fontSize: "11px",
                          fontWeight: "700",
                          cursor: "pointer"
                        }}
                      >
                        {s.id.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", marginBottom: "4px" }}>WI-FI & BLUETOOTH</div>
                  <button
                    type="button"
                    onClick={() => setNeedWifi(!needWifi)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "4px",
                      border: needWifi ? "1px solid #16a34a" : "1px solid #cbd5e1",
                      backgroundColor: needWifi ? "#ecfdf5" : "#ffffff",
                      color: needWifi ? "#065f46" : "#64748b",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer"
                    }}
                  >
                    {needWifi ? "✓ Có Wi-Fi 6E & BT" : "Chỉ dùng LAN dây"}
                  </button>
                </div>

                <div>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", marginBottom: "4px" }}>KẾ HOẠCH NÂNG CẤP</div>
                  <button
                    type="button"
                    onClick={() => setFutureNeed(futureNeed === "ready_upgrade" ? "stable_5y" : "ready_upgrade")}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "4px",
                      border: futureNeed === "ready_upgrade" ? "1px solid #2563eb" : "1px solid #cbd5e1",
                      backgroundColor: futureNeed === "ready_upgrade" ? "#eff6ff" : "#ffffff",
                      color: futureNeed === "ready_upgrade" ? "#1e40af" : "#64748b",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer"
                    }}
                  >
                    {futureNeed === "ready_upgrade" ? "⚡ Sẵn sàng nâng cấp sau" : "Dùng ổn định 4-5 năm"}
                  </button>
                </div>
              </div>

              {/* Tóm tắt hồ sơ tiêu chuẩn (Đầu vào dùng chung) */}
              <div
                style={{
                  backgroundColor: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  marginBottom: "16px",
                  fontSize: "12px",
                  color: "#1e40af",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "6px"
                }}
              >
                <div>
                  📋 <strong>Đầu vào dùng chung đã sẵn sàng:</strong> {currentPurposeObj.label} • {Number(budget).toLocaleString("vi-VN")}đ • Màn {resolution.toUpperCase()} ({refreshRate}) • {aesthetic === "white_tank" ? "Trắng bể cá" : "Stealth"} • RAM {minRam.toUpperCase()} • SSD {minStorage.toUpperCase()}
                </div>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#2563eb" }}>Chọn 1 trong 2 hướng bên dưới ➔</span>
              </div>

              {/* PHÂN NHÁNH 2 HƯỚNG RÕ RÀNG */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
                
                {/* ── HƯỚNG 1: HỆ THỐNG ĐỀ XUẤT (LAB RULE ENGINE) ── */}
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    borderRadius: "14px",
                    padding: "18px 20px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "20px" }}>⚙️</span>
                        <span style={{ fontSize: "13.5px", fontWeight: "800", color: "#0f172a" }}>HƯỚNG 1: HỆ THỐNG ĐỀ XUẤT</span>
                      </div>
                      <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 7px", borderRadius: "5px", backgroundColor: "#e2e8f0", color: "#334155" }}>
                        Lab Rule Engine
                      </span>
                    </div>

                    <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "12px", lineHeight: "1.45" }}>
                      Thuật toán logic Lab tự động khớp nối 8 linh kiện từ kho thực tế theo đúng bộ tiêu chí kỹ thuật đã chọn. Đảm bảo 100% tương thích Socket, TDP tản nhiệt, kích thước Case & công suất PSU.
                    </div>

                    <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px 12px", marginBottom: "14px" }}>
                      <div style={{ fontSize: "11px", fontWeight: "700", color: "#0f172a", marginBottom: "4px" }}>
                        Đặc tính Hướng Hệ Thống:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "11.5px", color: "#475569", lineHeight: "1.6" }}>
                        <li><strong>Chỉ nhận bộ tiêu chí:</strong> Không có ô nhập thêm văn bản</li>
                        <li><strong>Tức thì:</strong> Phản hồi dưới 0.1 giây</li>
                        <li><strong>Zero Hallucination:</strong> Tuyệt đối không ảo giác phần cứng</li>
                        <li><strong>Không cần đăng nhập:</strong> Mọi người dùng đều dùng được ngay</li>
                      </ul>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleFinalSubmit("system")}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      backgroundColor: "#0f172a",
                      color: "#ffffff",
                      border: "none",
                      fontSize: "13px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)",
                      transition: "background-color 0.15s ease"
                    }}
                  >
                    <span>🚀</span>
                    <span>Đề Xuất Cấu Hình Bằng Hệ Thống</span>
                  </button>
                </div>

                {/* ── HƯỚNG 2: AI TƯ VẤN (GEMINI 2.5 LLM) ── */}
                <div
                  style={{
                    backgroundColor: "#eff6ff",
                    border: "1.5px solid #93c5fd",
                    borderRadius: "14px",
                    padding: "18px 20px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    boxShadow: "0 4px 16px rgba(37, 99, 235, 0.08)"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "20px" }}>✨</span>
                        <span style={{ fontSize: "13.5px", fontWeight: "800", color: "#1e40af" }}>HƯỚNG 2: AI TƯ VẤN</span>
                      </div>
                      <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 7px", borderRadius: "5px", backgroundColor: "#2563eb", color: "#ffffff" }}>
                        Gemini 3.5 LLM
                      </span>
                    </div>

                    <div style={{ fontSize: "12px", color: "#334155", marginBottom: "10px", lineHeight: "1.45" }}>
                      Mô hình Gemini 3.5 tiếp nhận toàn bộ tiêu chí kỹ thuật ở trên, đồng thời cung cấp thêm ô nhập bên dưới để bạn bổ sung các yêu cầu riêng biệt theo ngôn ngữ tự nhiên.
                    </div>

                    {/* Ô NHẬP THÊM RIÊNG BIỆT DÀNH CHO AI */}
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ fontSize: "11px", fontWeight: "700", color: "#1e40af", marginBottom: "4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>📝 Nhập thêm yêu cầu riêng biệt của bạn:</span>
                        <span style={{ fontSize: "10px", color: "#64748b", fontWeight: "normal" }}>Tùy chọn</span>
                      </div>
                      <textarea
                        rows={2}
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="VD: 'Thích vỏ case bể cá màu trắng, tản nhiệt nước có màn LCD, đêm làm việc siêu êm, linh kiện ASUS'..."
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid #bfdbfe",
                          fontSize: "12px",
                          color: "#0f172a",
                          resize: "none",
                          outline: "none",
                          backgroundColor: "#ffffff",
                          boxSizing: "border-box"
                        }}
                      />
                    </div>

                    {/* Quick Tags tiện lợi */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "12px" }}>
                      {[
                        "+ Thích case bể cá màu trắng",
                        "+ Tản nhiệt nước có màn LCD",
                        "+ Vừa chơi game vừa stream",
                        "+ Ưu tiên GPU NVIDIA VRAM lớn",
                        "+ Đêm làm việc yêu cầu siêu êm ái",
                        "+ Nguồn dư tải nâng cấp sau"
                      ].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => handleAddTag(t)}
                          style={{
                            background: "#ffffff",
                            border: "1px solid #bfdbfe",
                            borderRadius: "4px",
                            padding: "2px 6px",
                            fontSize: "10px",
                            color: "#1e40af",
                            cursor: "pointer"
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleFinalSubmit("ai")}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      backgroundColor: "#2563eb",
                      color: "#ffffff",
                      border: "none",
                      fontSize: "13px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)",
                      transition: "background-color 0.15s ease"
                    }}
                  >
                    <span>✨</span>
                    <span>AI Phân Tích & Tư Vấn Cấu Hình</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER BUTTONS ── */}
        <footer
          style={{
            padding: "14px 24px",
            borderTop: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#334155",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              <span>←</span>
              <span>Quay Lại</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#64748b",
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer"
              }}
            >
              Đóng
            </button>
          )}

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => Math.min(5, prev + 1))}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 22px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: "700",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)"
              }}
            >
              <span>Tiếp Tục</span>
              <span>➔</span>
            </button>
          ) : (
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "500" }}>
              Chọn 1 trong 2 nút đề xuất ở trên để hoàn tất cấu hình
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}

export default RequirementWizardModal;
