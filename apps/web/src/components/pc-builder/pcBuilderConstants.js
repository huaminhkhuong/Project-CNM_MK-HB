/* ── DATA CONSTANTS FOR PC BUILDER ──────────────────────────── */

export const COMPONENT_SECTIONS = [
  { componentType: "cpu",       label: "CPU",          categoryName: "CPU",       categoryKeywords: ["CPU", "VI XỬ LÝ", "PROCESSOR"], icon: "🖥" },
  { componentType: "mainboard", label: "Mainboard",    categoryName: "MAINBOARD", categoryKeywords: ["MAINBOARD", "BO MẠCH", "MAIN"], icon: "🔌" },
  { componentType: "ram",       label: "RAM",          categoryName: "RAM",       categoryKeywords: ["RAM", "BỘ NHỚ", "MEMORY"], icon: "🧠" },
  { componentType: "gpu",       label: "GPU / VGA",    categoryName: "GPU",       categoryKeywords: ["GPU", "VGA", "CARD MÀN HÌNH", "CARD ĐỒ HỌA", "GRAPHICS"], icon: "🎮" },
  { componentType: "storage",   label: "SSD",          categoryName: "SSD",       categoryKeywords: ["SSD", "STORAGE", "HDD", "Ổ CỨNG", "Ổ SSD", "M.2", "NVME"], icon: "💾" },
  { componentType: "psu",       label: "PSU",          categoryName: "PSU",       categoryKeywords: ["PSU", "NGUỒN", "POWER SUPPLY"], icon: "⚡" },
  { componentType: "case",      label: "Case",         categoryName: "CASE",      categoryKeywords: ["CASE", "VỎ CASE", "VỎ MÁY TÍNH"], icon: "📦" },
  { componentType: "cooling",   label: "Cooling",      categoryName: "COOLING",   categoryKeywords: ["COOLING", "TẢN NHIỆT", "QUẠT", "AIO"], icon: "❄️" }
];

export const PRESET_BUILDS = [
  // 🎮 Gaming & Giả lập
  { id: "gaming",       label: "Gaming AAA",        budget: "25000000", useCase: "gaming",    category: "gaming",    desc: "Tối ưu FPS, ưu tiên GPU mạnh" },
  { id: "gaming_4k",    label: "Gaming 4K High-End", budget: "55000000", useCase: "gaming",    category: "gaming",    desc: "VGA khủng RTX 4080/4090, max settings 4K" },
  { id: "emulator",     label: "Giả lập Multi-Tab",  budget: "22000000", useCase: "gaming",    category: "gaming",    desc: "CPU nhiều nhân, RAM 32GB cắm Nox/LDPlayer" },

  // 🎬 Đồ họa & Kiến trúc
  { id: "editing",      label: "Dựng Phim 4K",      budget: "35000000", useCase: "editing",   category: "creative",  desc: "RAM 32GB+, SSD NVMe nhanh, render mượt" },
  { id: "design_2d",    label: "Đồ họa 2D / Photo",  budget: "18000000", useCase: "editing",   category: "creative",  desc: "Tối ưu Photoshop, Illustrator, Premiere HD" },
  { id: "architect_3d", label: "Kiến trúc 3D / Revit",budget: "42000000", useCase: "editing",   category: "creative",  desc: "CPU xung đơn nhân cao, VGA Quadro/RTX 3D" },

  // 💻 Lập trình, AI & Công việc
  { id: "office",       label: "Văn phòng / Học tập",budget: "12000000", useCase: "office",    category: "work",      desc: "Ổn định, tiết kiệm điện, mượt office" },
  { id: "developer",    label: "Lập trình & Docker", budget: "25000000", useCase: "office",    category: "work",      desc: "CPU 10+ nhân, RAM 32GB compile code cực nhanh" },
  { id: "ai",           label: "AI Workstation",     budget: "50000000", useCase: "ai",        category: "work",      desc: "VRAM lớn (RTX 4090/4080), chạy Deep Learning" },
  { id: "streaming",    label: "Streaming / VTuber", budget: "30000000", useCase: "streaming", category: "work",      desc: "Cân bằng CPU/GPU, NVENC encoder mượt" },

  // 🎨 Thẩm mỹ & Phong cách
  { id: "white_theme",  label: "Tone Trắng Bể Cá",   budget: "28000000", useCase: "gaming",    category: "style",     desc: "Tone Pure White, Vỏ Case Panorama Kính" },
  { id: "silent",       label: "Siêu êm & Mát mẻ",   budget: "26000000", useCase: "office",    category: "style",     desc: "Tản nhiệt cao cấp, độ ồn gần như bằng 0" }
];

export const AUTO_RECOMMEND_PROFILES = {
  gaming:       { allocations: { cpu: 0.16, mainboard: 0.11, ram: 0.11, gpu: 0.38, storage: 0.08, psu: 0.08, case: 0.04, cooling: 0.04 } },
  gaming_4k:    { allocations: { cpu: 0.15, mainboard: 0.10, ram: 0.10, gpu: 0.45, storage: 0.08, psu: 0.07, case: 0.03, cooling: 0.02 } },
  emulator:     { allocations: { cpu: 0.25, mainboard: 0.12, ram: 0.20, gpu: 0.15, storage: 0.10, psu: 0.08, case: 0.05, cooling: 0.05 } },
  editing:      { allocations: { cpu: 0.19, mainboard: 0.12, ram: 0.18, gpu: 0.20, storage: 0.14, psu: 0.09, case: 0.04, cooling: 0.04 } },
  design_2d:    { allocations: { cpu: 0.22, mainboard: 0.13, ram: 0.18, gpu: 0.18, storage: 0.14, psu: 0.08, case: 0.04, cooling: 0.03 } },
  architect_3d: { allocations: { cpu: 0.22, mainboard: 0.12, ram: 0.16, gpu: 0.30, storage: 0.09, psu: 0.06, case: 0.03, cooling: 0.02 } },
  office:       { allocations: { cpu: 0.22, mainboard: 0.14, ram: 0.16, gpu: 0.04, storage: 0.18, psu: 0.09, case: 0.09, cooling: 0.08 } },
  developer:    { allocations: { cpu: 0.26, mainboard: 0.14, ram: 0.20, gpu: 0.08, storage: 0.16, psu: 0.08, case: 0.04, cooling: 0.04 } },
  ai:           { allocations: { cpu: 0.15, mainboard: 0.12, ram: 0.18, gpu: 0.38, storage: 0.10, psu: 0.11, case: 0.03, cooling: 0.07 } },
  streaming:    { allocations: { cpu: 0.20, mainboard: 0.12, ram: 0.14, gpu: 0.24, storage: 0.12, psu: 0.10, case: 0.04, cooling: 0.04 } },
  white_theme:  { allocations: { cpu: 0.16, mainboard: 0.12, ram: 0.12, gpu: 0.34, storage: 0.08, psu: 0.08, case: 0.06, cooling: 0.04 } },
  silent:       { allocations: { cpu: 0.18, mainboard: 0.12, ram: 0.12, gpu: 0.30, storage: 0.10, psu: 0.09, case: 0.04, cooling: 0.05 } },
  default:      { allocations: { cpu: 0.18, mainboard: 0.12, ram: 0.10, gpu: 0.34, storage: 0.09, psu: 0.08, case: 0.06, cooling: 0.03 } }
};

export const SPEC_ALIASES = {
  socket:           ["socket"],
  ramType:          ["ram_type", "loại ram", "loai ram", "memory type", "ddr"],
  psuWattage:       ["psu_wattage", "wattage", "power", "công suất psu", "cong suat psu"],
  tdp:              ["tdp", "power"],
  gpuLength:        ["gpu_length", "gpu length", "vga length", "chiều dài gpu", "chiều dài vga"],
  caseGpuClearance: ["gpu clearance", "vga clearance", "case_gpu_clearance", "hỗ trợ vga tối đa", "vga dài tối đa"],
  coolingType:      ["cooling_type", "loại tản nhiệt", "loai tan nhiet", "cooler type"],
  socketSupport:    ["socket_support", "supported socket", "socket hỗ trợ", "socket ho tro"],
  coolingCapacity:  ["cooling_capacity", "tdp cooling", "tdp capacity", "cooling power"],
  radiatorSize:     ["radiator_size", "radiator", "radiator support"],
  coolerHeight:     ["cooler_height", "cpu cooler height", "height"],
  caseRadiatorSupport: ["case_radiator_support", "radiator support"],
  stockCooler:      ["stock_cooler", "cooler included", "boxed cooler", "tản đi kèm", "tan di kem"],
  boardFormFactor:  ["form_factor", "kích thước main", "chuẩn mainboard"],
  caseFormFactor:   ["form_factor", "form_factor_support", "hỗ trợ main", "hỗ trợ form factor"],
  m2Slots:          ["m2_slots", "khe m2", "m.2 slots", "m2"],
  ramSlots:         ["ram_slots", "khe ram", "ram slots"]
};
