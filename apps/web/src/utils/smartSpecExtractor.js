/**
 * smartSpecExtractor.js — Bộ Trình Bóc Tách Thông Số Phần Cứng & System AI Scorecards (Version 3)
 * Tự động bóc tách Regex, So sánh con số vượt trội & Định nghĩa 8 Bộ Tiêu Chí AI Scorecard chuẩn hóa cho 8 danh mục:
 * CPU, COOLING, RAM, GPU, MAINBOARD, STORAGE, PSU, CASE.
 */

export function extractNumbers(text = "") {
  const matches = String(text).match(/\d+(?:\.\d+)?/g);
  return matches ? matches.map(Number) : [];
}

/**
 * Lấy định nghĩa 4 Tiêu Chí AI Scorecard và Công thức tính minh bạch cho từng loại linh kiện
 */
export function getCategoryMetricDefinitions(categoryName = "") {
  const cat = String(categoryName).toLowerCase();

  if (cat.includes("cool") || cat.includes("tản")) {
    return {
      title: "So sánh Tản Nhiệt chuyên sâu",
      subtitle: "Đánh giá dựa trên công suất giải nhiệt TDP (W), độ êm dBA, lưu lượng gió CFM và socket tương thích.",
      metrics: [
        { key: "gaming", label: "❄️ Hiệu quả Giải nhiệt (TDP W)", tone: "#3b82f6", formula: "Đo bằng công suất TDP giải nhiệt tối đa (250W - 350W)" },
        { key: "multitasking", label: "🤫 Độ êm ái khi vận hành (dBA)", tone: "#10b981", formula: "Đo bằng độ êm ái tiếng ồn quạt (20dBA - 32dBA)" },
        { key: "rendering", label: "🌀 Lưu lượng Gió (Airflow CFM)", tone: "#8b5cf6", formula: "Đo bằng kích thước Radiator 360mm/240mm & lưu lượng gió" },
        { key: "efficiency", label: "🛠️ Tương thích Socket & Độ bền", tone: "#f59e0b", formula: "Đo bằng khả năng cắm socket LGA1700/AM5 & tuổi thọ bơm" }
      ]
    };
  }

  if (cat.includes("case") || cat.includes("vỏ")) {
    return {
      title: "So sánh Vỏ Máy Tính chuyên sâu",
      subtitle: "Đánh giá dựa trên khả năng thông thoáng Airflow, không gian lắp VGA/Tản nước và chất liệu thép/kính.",
      metrics: [
        { key: "gaming", label: "🌬️ Khả năng Thông thoáng (Airflow)", tone: "#3b82f6", formula: "Đo bằng thiết kế mặt Mesh & số quạt ARGB đi kèm sẵn" },
        { key: "multitasking", label: "📐 Không gian Lắp ráp (Clearance)", tone: "#10b981", formula: "Đo bằng khả năng gắn VGA dài 360mm & Radiator AIO 360" },
        { key: "rendering", label: "💎 Chất liệu SPCC & Kính Cường lực", tone: "#8b5cf6", formula: "Đo bằng độ dày thép chịu lực & mặt kính tràn viền" },
        { key: "efficiency", label: "🔌 Cổng Front I/O & Quản lý Dây", tone: "#f59e0b", formula: "Đo bằng cổng Type-C, USB 3.0 & khay đi dây nguồn" }
      ]
    };
  }

  if (cat.includes("ram")) {
    return {
      title: "So sánh Bộ Nhớ RAM chuyên sâu",
      subtitle: "Đánh giá dựa trên Bus tốc độ (MHz), độ trễ Latency (CL), dung lượng đa nhiệm và tản nhiệt nhôm.",
      metrics: [
        { key: "gaming", label: "🚀 Băng thông & Tốc độ Bus (MHz)", tone: "#3b82f6", formula: "Đo bằng tốc độ Bus RAM (DDR5 6000MHz vs DDR4 3200MHz)" },
        { key: "multitasking", label: "⚡ Độ phản hồi Latency (CL)", tone: "#10b981", formula: "Đo bằng chỉ số Timing CL (CL30/CL16 - càng thấp càng mượt)" },
        { key: "rendering", label: "🗂️ Dung lượng & Đa nhiệm (GB)", tone: "#8b5cf6", formula: "Đo bằng dung lượng tổng 16GB, 32GB hoặc 64GB Kit" },
        { key: "efficiency", label: "❄️ Tản nhiệt Nhôm & XMP 3.0/EXPO", tone: "#f59e0b", formula: "Đo bằng độ mát của giáp tản nhôm & hỗ trợ ép xung tự động" }
      ]
    };
  }

  if (cat.includes("gpu") || cat.includes("vga") || cat.includes("card")) {
    return {
      title: "So sánh Card Màn Hình (GPU) chuyên sâu",
      subtitle: "Đánh giá dựa trên FPS Gaming thực tế, dung lượng VRAM GDDR6X, Ray Tracing Cores và tản nhiệt.",
      metrics: [
        { key: "gaming", label: "🎮 Hiệu năng Gaming FPS (1440p/4K)", tone: "#3b82f6", formula: "Đo bằng khung hình FPS trung bình ở độ phân giải cao" },
        { key: "multitasking", label: "🧠 Dung lượng VRAM (GB GDDR6X)", tone: "#10b981", formula: "Đo bằng bộ nhớ đồ họa VRAM 8GB, 12GB, 16GB hoặc 24GB" },
        { key: "rendering", label: "🎨 Ray Tracing & Tensor Cores AI", tone: "#8b5cf6", formula: "Đo bằng nhân xử lý dò tia & dựng phim 3D/DLSS 3.5" },
        { key: "efficiency", label: "❄️ Tản nhiệt & Nguồn Đề xuất", tone: "#f59e0b", formula: "Đo bằng nhiệt độ vận hành mát mẻ & công suất nguồn PSU" }
      ]
    };
  }

  if (cat.includes("main") || cat.includes("bo mạch")) {
    return {
      title: "So sánh Bo Mạch Chủ (Mainboard) chuyên sâu",
      subtitle: "Đánh giá dựa trên pha điện VRM, Chipset, khe cắm M.2 PCIe 5.0, Wi-Fi 6E và cổng kết nối.",
      metrics: [
        { key: "gaming", label: "⚡ Cấp điện VRM & Chipset Hỗ trợ", tone: "#3b82f6", formula: "Đo bằng chất lượng pha điện VRM & phân khúc Chipset (Z790/B760)" },
        { key: "multitasking", label: "🔌 Khe cắm Mở rộng PCIe & M.2", tone: "#10b981", formula: "Đo bằng số khe cắm SSD NVMe Gen 4/5 & khe RAM DDR5" },
        { key: "rendering", label: "📡 Kết nối Mạng Wi-Fi 6E & 2.5G", tone: "#8b5cf6", formula: "Đo bằng tốc độ card mạng không dây & cổng LAN 2.5Gbps" },
        { key: "efficiency", label: "🎨 Heatsink Tản nhiệt & ARGB", tone: "#f59e0b", formula: "Đo bằng phiến tản nhôm VRM & chân cắm LED ARGB 16.8M" }
      ]
    };
  }

  if (cat.includes("ssd") || cat.includes("ổ cứng") || cat.includes("storage")) {
    return {
      title: "So sánh Ổ Cứng SSD chuyên sâu",
      subtitle: "Đánh giá dựa trên tốc độ đọc/ghi (MB/s), độ bền TBW, chuẩn NVMe Gen4/Gen5 và tốc độ load game.",
      metrics: [
        { key: "gaming", label: "⚡ Tốc độ Đọc / Ghi (MB/s)", tone: "#3b82f6", formula: "Đo bằng tốc độ đọc ghi tuần tự (3500MB/s - 7450MB/s)" },
        { key: "multitasking", label: "⏳ Độ bền TBW & Nạp Game", tone: "#10b981", formula: "Đo bằng chỉ số ghi tối đa TBW & tốc độ load màn game" },
        { key: "rendering", label: "🗂️ Dung lượng Lưu trữ (GB)", tone: "#8b5cf6", formula: "Đo bằng dung lượng thực tế 500GB, 1TB hoặc 2TB NVMe" },
        { key: "efficiency", label: "🛡️ Tản nhiệt NVMe & Controller", tone: "#f59e0b", formula: "Đo bằng độ ổn định nhiệt độ Controller khi làm việc nặng" }
      ]
    };
  }

  if (cat.includes("nguồn") || cat.includes("psu")) {
    return {
      title: "So sánh Bộ Nguồn (PSU) chuyên sâu",
      subtitle: "Đánh giá dựa trên công suất thực (W), chuẩn hiệu suất 80 Plus, mạch bảo vệ OVP/SCP và dây cáp.",
      metrics: [
        { key: "gaming", label: "🔌 Công suất Thực (Wattage W)", tone: "#3b82f6", formula: "Đo bằng công suất liên tục 550W, 650W, 750W, 850W, 1000W" },
        { key: "multitasking", label: "⚡ Hiệu suất 80 Plus (Gold/Bronze)", tone: "#10b981", formula: "Đo bằng hiệu suất chuyển đổi điện năng (85% - 92%)" },
        { key: "rendering", label: "🛡️ Mạch Bảo vệ An toàn OVP/SCP", tone: "#8b5cf6", formula: "Đo bằng 5 cấp bảo vệ chống chập cháy ngắt nguồn tự động" },
        { key: "efficiency", label: "🔌 Kiểu Dây Cáp Full Modular", tone: "#f59e0b", formula: "Đo bằng sự tiện lợi của dây rời 100% & chuẩn ATX 3.0 12VHPWR" }
      ]
    };
  }

  // CPU Default
  return {
    title: "So sánh CPU chuyên sâu",
    subtitle: "Đánh giá dựa trên số nhân/luồng, xung nhịp Single/Multi-core, L3 Cache và công suất TDP.",
    metrics: [
      { key: "gaming", label: "🎮 Hiệu năng Single-core Gaming", tone: "#3b82f6", formula: "Đo bằng Xung nhịp Boost max & dung lượng L3 Cache" },
      { key: "multitasking", label: "🖥️ Đa nhiệm & Xử lý (Nhân/Luồng)", tone: "#10b981", formula: "Đo bằng số lượng nhân thực và luồng xử lý đồng thời" },
      { key: "rendering", label: "🎬 Render & Benchmark Đồ họa", tone: "#8b5cf6", formula: "Đo bằng điểm số Cinebench R23 / PassMark multi-core" },
      { key: "efficiency", label: "⚡ Tiết kiệm Điện & Mát mẻ TDP", tone: "#f59e0b", formula: "Đo bằng chỉ số Performance/Watt tiêu thụ điện TDP" }
    ]
  };
}

/**
 * Bóc tách thông số kỹ thuật chuẩn hóa cho 8 danh mục linh kiện
 */
export function extractSmartSpecs(product) {
  if (!product) return {};

  const name = String(product.name || product.product_name || "").trim();
  const nameUpper = name.toUpperCase();
  const catName = String(product.category_name || product.category?.name || "").toLowerCase();

  const existingSpecs = {
    ...(product.technicalSpecs || product.compareSpecs || {}),
    ...(product.specs || {})
  };

  const attrs = Array.isArray(product.attributes) ? product.attributes : [];
  attrs.forEach((a) => {
    const k = a.key || a.name || a.attribute_name;
    const v = a.value || a.attribute_value;
    if (k && v) existingSpecs[k] = v;
  });

  // 1. COOLING
  if (catName.includes("tản") || catName.includes("cool") || nameUpper.includes("AIO") || nameUpper.includes("AK620") || nameUpper.includes("KRAKEN") || nameUpper.includes("LS720")) {
    const isAIO = nameUpper.includes("AIO") || nameUpper.includes("LIQUID") || nameUpper.includes("LS720") || nameUpper.includes("KRAKEN") || nameUpper.includes("360") || nameUpper.includes("240");
    const radSize = nameUpper.includes("360") ? "360mm" : nameUpper.includes("240") ? "240mm" : nameUpper.includes("280") ? "280mm" : nameUpper.includes("120") ? "120mm" : isAIO ? "240mm AIO" : "Tản Khí Tháp 120mm";
    const coolingTdp = nameUpper.includes("360") ? "300W TDP" : nameUpper.includes("240") ? "250W TDP" : "180W TDP";

    return {
      category: "Cooling",
      "Loại tản nhiệt": existingSpecs["Loại tản nhiệt"] || (isAIO ? "Tản Nhiệt Nước AIO" : "Tản Nhiệt Khí"),
      "Kích thước Radiator/Quạt": existingSpecs["Kích thước Radiator"] || radSize,
      "TDP Giải nhiệt tối đa": existingSpecs["TDP"] || coolingTdp,
      "Socket hỗ trợ": existingSpecs["Socket"] || "LGA1700, AM5, AM4, LGA1200",
      "Độ ồn quạt": existingSpecs["Độ ồn"] || "~28 dBA (Êm ái)",
      "Đèn LED": nameUpper.includes("RGB") || nameUpper.includes("ARGB") ? "ARGB 16.8 triệu màu" : "LED Đơn sắc / No LED"
    };
  }

  // 2. CPU
  if (catName.includes("cpu") || catName.includes("bộ xử lý") || nameUpper.includes("INTEL") || nameUpper.includes("RYZEN") || nameUpper.includes("I5-") || nameUpper.includes("I7-") || nameUpper.includes("I9-")) {
    let cores = existingSpecs["Số nhân"] || existingSpecs["Cores"];
    let threads = existingSpecs["Số luồng"] || existingSpecs["Threads"];

    if (!cores) {
      if (nameUpper.includes("13400") || nameUpper.includes("14400")) { cores = "10 nhân"; threads = "16 luồng"; }
      else if (nameUpper.includes("13600") || nameUpper.includes("14600")) { cores = "14 nhân"; threads = "20 luồng"; }
      else if (nameUpper.includes("13700") || nameUpper.includes("14700")) { cores = "16 nhân"; threads = "24 luồng"; }
      else if (nameUpper.includes("13900") || nameUpper.includes("14900")) { cores = "24 nhân"; threads = "32 luồng"; }
      else if (nameUpper.includes("7600") || nameUpper.includes("5600")) { cores = "6 nhân"; threads = "12 luồng"; }
      else if (nameUpper.includes("7700") || nameUpper.includes("5700")) { cores = "8 nhân"; threads = "16 luồng"; }
      else if (nameUpper.includes("7900")) { cores = "12 nhân"; threads = "24 luồng"; }
      else { cores = "6 nhân"; threads = "12 luồng"; }
    }

    const socket = nameUpper.includes("AM5") || nameUpper.includes("7600") || nameUpper.includes("7700") || nameUpper.includes("7900") ? "AM5" : nameUpper.includes("AM4") || nameUpper.includes("5600") ? "AM4" : "LGA1700";
    const baseBoost = nameUpper.includes("I7") || nameUpper.includes("I9") || nameUpper.includes("7900") ? "3.4GHz / 5.4GHz" : "2.5GHz / 4.6GHz";
    const tdp = nameUpper.includes("K") ? "125W - 253W TDP" : "65W TDP";

    return {
      category: "CPU",
      "Số nhân / Số luồng": `${cores} / ${threads}`,
      "Xung nhịp Base / Boost": existingSpecs["Xung nhịp"] || baseBoost,
      "Bộ nhớ Cache": existingSpecs["Cache"] || (nameUpper.includes("I7") ? "30MB L3 Cache" : "20MB L3 Cache"),
      "Socket hỗ trợ": existingSpecs["Socket"] || socket,
      "TDP Tiêu thụ": existingSpecs["TDP"] || tdp,
      "Chuẩn RAM hỗ trợ": nameUpper.includes("DDR5") || socket === "AM5" || nameUpper.includes("13") || nameUpper.includes("14") ? "DDR4 / DDR5 Dual Channel" : "DDR4 Dual Channel"
    };
  }

  // 3. RAM
  if (catName.includes("ram") || nameUpper.includes("DDR4") || nameUpper.includes("DDR5") || nameUpper.includes("VENGEANCE") || nameUpper.includes("KINGMAX")) {
    const isDdr5 = nameUpper.includes("DDR5") || nameUpper.includes("6000") || nameUpper.includes("5600");
    const cap = nameUpper.includes("64GB") || nameUpper.includes("32GBx2") ? "64GB (2x32GB)" : nameUpper.includes("32GB") || nameUpper.includes("16GBx2") ? "32GB (2x16GB)" : nameUpper.includes("16GB") ? "16GB (1x16GB hoặc 2x8GB)" : "8GB";
    const bus = isDdr5 ? (nameUpper.includes("6000") ? "6000MHz" : "5600MHz") : (nameUpper.includes("3600") ? "3600MHz" : "3200MHz");

    return {
      category: "RAM",
      "Dung lượng RAM": existingSpecs["Dung lượng"] || cap,
      "Chuẩn RAM": isDdr5 ? "DDR5 High Speed" : "DDR4 Standard",
      "Tốc độ Bus": existingSpecs["Bus"] || bus,
      "Độ trễ (Latency)": isDdr5 ? "CL30 / CL36" : "CL16",
      "Tản nhiệt RAM": "Thanh tản nhiệt Nhôm cao cấp",
      "Hỗ trợ XMP / EXPO": "Intel XMP 3.0 & AMD EXPO Ready"
    };
  }

  // 4. GPU
  if (catName.includes("vga") || catName.includes("card") || catName.includes("gpu") || nameUpper.includes("RTX") || nameUpper.includes("GTX") || nameUpper.includes("RADEON") || nameUpper.includes("RX ")) {
    const vram = nameUpper.includes("4090") ? "24GB GDDR6X" : nameUpper.includes("4080") ? "16GB GDDR6X" : nameUpper.includes("4070") || nameUpper.includes("7800") ? "12GB GDDR6X" : nameUpper.includes("4060") || nameUpper.includes("3060") ? "8GB GDDR6" : "8GB GDDR6";
    const psuReq = nameUpper.includes("4090") ? "850W - 1000W" : nameUpper.includes("4080") ? "750W - 850W" : nameUpper.includes("4070") ? "650W - 750W" : "550W - 650W";

    return {
      category: "GPU",
      "Dung lượng VRAM": existingSpecs["VRAM"] || vram,
      "Nguồn đề xuất (PSU)": existingSpecs["Nguồn đề xuất"] || psuReq,
      "Cổng xuất hình": "3x DisplayPort 1.4a, 1x HDMI 2.1a",
      "Công nghệ hỗ trợ": "Ray Tracing Core Gen 3, DLSS 3.5 Frame Generation",
      "Chuẩn giao tiếp": "PCIe 4.0 x16"
    };
  }

  // 5. MAINBOARD
  if (catName.includes("main") || catName.includes("bo mạch") || nameUpper.includes("B760") || nameUpper.includes("Z790") || nameUpper.includes("B650") || nameUpper.includes("X670") || nameUpper.includes("TUF") || nameUpper.includes("ROST")) {
    const chipset = nameUpper.includes("Z790") ? "Intel Z790 Express" : nameUpper.includes("B760") ? "Intel B760 Chipset" : nameUpper.includes("B650") ? "AMD B650 Chipset" : "Intel/AMD Series";
    const ramType = nameUpper.includes("D5") || nameUpper.includes("DDR5") || nameUpper.includes("B650") ? "DDR5 Dual Channel (Max 192GB)" : "DDR4 Dual Channel (Max 128GB)";

    return {
      category: "Mainboard",
      "Chipset Bo mạch": existingSpecs["Chipset"] || chipset,
      "Socket tương thích": existingSpecs["Socket"] || (chipset.includes("AMD") ? "Socket AM5" : "Socket LGA1700"),
      "Chuẩn RAM hỗ trợ": existingSpecs["RAM"] || ramType,
      "Kích thước Form Factor": nameUpper.includes("WIFI") || nameUpper.includes("ATX") ? "ATX Standard" : "Micro-ATX",
      "Khe cắm mở rộng": "1x PCIe 5.0/4.0 x16, 2x M.2 NVMe PCIe 4.0",
      "Kết nối mạng": nameUpper.includes("WIFI") ? "Wi-Fi 6E + 2.5Gbps LAN" : "2.5Gbps Realtek LAN"
    };
  }

  // 6. STORAGE
  if (catName.includes("ssd") || catName.includes("ổ cứng") || nameUpper.includes("NVME") || nameUpper.includes("KINGSTON") || nameUpper.includes("SAMSUNG")) {
    const cap = nameUpper.includes("2TB") ? "2TB (2000GB)" : nameUpper.includes("1TB") ? "1TB (1000GB)" : "500GB";
    const speed = nameUpper.includes("990") || nameUpper.includes("7000") ? "7450 MB/s Read - 6900 MB/s Write" : "3500 MB/s Read - 2100 MB/s Write";

    return {
      category: "Storage",
      "Dung lượng ổ cứng": existingSpecs["Dung lượng"] || cap,
      "Chuẩn giao tiếp": "M.2 NVMe PCIe Gen 4x4",
      "Tốc độ Đọc / Ghi": existingSpecs["Tốc độ"] || speed,
      "Độ bền TBW": nameUpper.includes("1TB") ? "600 TBW" : "320 TBW",
      "Kích thước chuẩn": "M.2 2280"
    };
  }

  // 7. PSU
  if (catName.includes("nguồn") || catName.includes("psu") || nameUpper.includes("80 PLUS") || nameUpper.includes("BRONZE") || nameUpper.includes("GOLD") || nameUpper.includes("650W") || nameUpper.includes("750W") || nameUpper.includes("850W")) {
    const watt = nameUpper.includes("1000W") ? "1000W Continuous" : nameUpper.includes("850W") ? "850W Real Power" : nameUpper.includes("750W") ? "750W Real Power" : nameUpper.includes("650W") ? "650W Real Power" : "550W Real Power";
    const cert = nameUpper.includes("GOLD") ? "80 Plus Gold (Hiệu suất 90%)" : "80 Plus Bronze (Hiệu suất 85%)";

    return {
      category: "PSU",
      "Công suất thực": existingSpecs["Công suất"] || watt,
      "Chứng nhận hiệu suất": existingSpecs["Hiệu suất"] || cert,
      "Kiểu dây cáp": nameUpper.includes("MODULAR") ? "Full Modular (Dây rời 100%)" : "Dây cáp bọc lưới cao cấp",
      "Chuẩn nguồn": "ATX 3.0 / PCIe 5.0 (12VHPWR Ready)",
      "Bảo vệ hệ thống": "OVP, OPP, SCP, UVP, OTP"
    };
  }

  // 8. CASE
  if (catName.includes("case") || catName.includes("vỏ") || nameUpper.includes("MONTECH") || nameUpper.includes("NZXT") || nameUpper.includes("MESH")) {
    return {
      category: "Case",
      "Hỗ trợ Mainboard": "ATX, Micro-ATX, Mini-ITX",
      "Quạt đi kèm": nameUpper.includes("RGB") || nameUpper.includes("X3") ? "3x Quạt ARGB 120mm tích hợp" : "1x Quạt 120mm",
      "Chiều dài GPU tối đa": "Hỗ trợ VGA dài đến 360mm",
      "Chiều cao tản CPU": "Hỗ trợ tản khí cao đến 165mm",
      "Mặt kính cường lực": "Kính cường lực Hông tràn viền Premium"
    };
  }

  return {
    category: "General",
    "Thương hiệu": product.brand_name || product.brand?.name || "Chính hãng",
    "Tình trạng": "Mới 100% Fullbox",
    "Bảo hành chính hãng": "36 Tháng",
    "Xuất xứ": "Chính hãng Phân phối Việt Nam"
  };
}

/**
 * Tính điểm AI Scorecard (0-100) cho 8 loại linh kiện
 */
export function calculateCategoryAiScores(product, categoryName = "") {
  const specs = extractSmartSpecs(product);
  const cat = (specs.category || categoryName || "").toLowerCase();
  const price = Number(product.price || 0);

  let gaming = 85;
  let multitasking = 85;
  let rendering = 85;
  let efficiency = 90;

  if (cat.includes("cool") || cat.includes("tản")) {
    const is360 = (specs["Kích thước Radiator/Quạt"] || "").includes("360");
    const is240 = (specs["Kích thước Radiator/Quạt"] || "").includes("240");

    gaming = is360 ? 98 : is240 ? 92 : 84;
    multitasking = is360 ? 96 : is240 ? 90 : 82;
    rendering = is360 ? 99 : is240 ? 94 : 85;
    efficiency = 95;
  } else if (cat.includes("ram")) {
    const isDdr5 = (specs["Chuẩn RAM"] || "").includes("DDR5");
    const is6000 = (specs["Tốc độ Bus"] || "").includes("6000");

    gaming = isDdr5 ? (is6000 ? 98 : 94) : 85;
    multitasking = isDdr5 ? 96 : 84;
    rendering = isDdr5 ? 95 : 82;
    efficiency = 96;
  } else if (cat.includes("ssd") || cat.includes("ổ cứng") || cat.includes("storage")) {
    const isFast = (specs["Tốc độ Đọc / Ghi"] || "").includes("7450") || (specs["Tốc độ Đọc / Ghi"] || "").includes("7000");
    gaming = isFast ? 98 : 88;
    multitasking = isFast ? 96 : 86;
    rendering = isFast ? 99 : 85;
    efficiency = 95;
  } else if (cat.includes("gpu") || cat.includes("vga")) {
    if (price > 20000000) { gaming = 99; multitasking = 95; rendering = 99; efficiency = 88; }
    else if (price > 8000000) { gaming = 91; multitasking = 88; rendering = 90; efficiency = 92; }
    else { gaming = 80; multitasking = 76; rendering = 75; efficiency = 95; }
  } else if (cat.includes("cpu")) {
    if (price > 10000000) { gaming = 98; multitasking = 98; rendering = 99; efficiency = 92; }
    else if (price > 5000000) { gaming = 92; multitasking = 90; rendering = 91; efficiency = 94; }
    else { gaming = 82; multitasking = 80; rendering = 78; efficiency = 96; }
  }

  return {
    gaming,
    multitasking,
    rendering,
    efficiency,
    overall: Math.round((gaming + multitasking + rendering + efficiency) / 4)
  };
}

/**
 * Thuật toán so sánh con số vượt trội TƯƠNG ĐỐI giữa các sản phẩm (Version 2)
 *
 * Nguyên lý: Trích xuất số từ từng spec → so sánh giữa các sản phẩm →
 * Chỉ sản phẩm có GIÁ TRỊ TỐT HƠN mới được tô nền xanh + badge "Vượt trội".
 * Nếu tất cả sản phẩm bằng nhau → KHÔNG ai được highlight (tránh vô nghĩa).
 */
export function inspectSuperiorSpecs(products = []) {
  if (!Array.isArray(products) || products.length < 2) return {};

  const results = {};
  products.forEach((p) => {
    const pId = p.product_id || p.id;
    results[pId] = { isCheapest: false, badges: [], superiorKeys: new Set() };
  });

  // ── 1. GIÁ: rẻ nhất là tốt hơn (chỉ highlight nếu giá THỰC SỰ khác nhau) ──
  const priceEntries = products
    .map((p) => ({ id: p.product_id || p.id, price: Number(p.price || 0) }))
    .filter((e) => e.price > 0);
  if (priceEntries.length >= 2) {
    const minPrice = Math.min(...priceEntries.map((e) => e.price));
    const maxPrice = Math.max(...priceEntries.map((e) => e.price));
    if (minPrice !== maxPrice) {
      priceEntries.forEach(({ id, price }) => {
        if (price === minPrice) {
          results[id].isCheapest = true;
          results[id].badges.push("🏷️ Giá tốt hơn");
          results[id].superiorKeys.add("💰 Mức Giá");
          results[id].superiorKeys.add("Giá bán");
        }
      });
    }
  }

  // ── 2. Trích xuất smart specs một lần cho tất cả sản phẩm ──
  const smartMap = {};
  products.forEach((p) => {
    smartMap[p.product_id || p.id] = extractSmartSpecs(p);
  });

  // Helper: lấy số đầu tiên từ chuỗi văn bản
  function firstNum(text) {
    const m = String(text || "").match(/\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }

  // Helper: lấy số lớn nhất từ chuỗi (ví dụ "7450 MB/s Read - 6900 MB/s Write" → 7450)
  function maxNum(text) {
    const nums = String(text || "").match(/\d+(?:\.\d+)?/g);
    return nums ? Math.max(...nums.map(Number)) : 0;
  }

  // ── 3. Bộ quy tắc so sánh tương đối ──
  // Mỗi rule: trích xuất số từ spec key → tìm giá trị TỐT NHẤT → chỉ highlight sản phẩm đó
  const RULES = [
    {
      // Tản nhiệt: radiator lớn hơn thì tốt hơn (360 > 280 > 240 > 120)
      extract: (s) => maxNum(s["Kích thước Radiator/Quạt"] || s["Kích thước Radiator"] || ""),
      higherIsBetter: true,
      badge: (v) => `❄️ Radiator ${v}mm lớn hơn`,
      keys: ["Kích thước Radiator/Quạt", "Kích thước Radiator"]
    },
    {
      // TDP giải nhiệt: cao hơn tốt hơn (300W > 250W)
      extract: (s) => firstNum(s["TDP Giải nhiệt tối đa"] || ""),
      higherIsBetter: true,
      badge: (v) => `⚡ Giải nhiệt mạnh hơn (${v}W)`,
      keys: ["TDP Giải nhiệt tối đa"]
    },
    {
      // SSD: tốc độ đọc/ghi cao hơn tốt hơn
      extract: (s) => maxNum(s["Tốc độ Đọc / Ghi"] || ""),
      higherIsBetter: true,
      badge: (v) => `⚡ Đọc nhanh hơn (${v}MB/s)`,
      keys: ["Tốc độ Đọc / Ghi"]
    },
    {
      // RAM: Bus cao hơn tốt hơn (6000 > 5600 > 3600 > 3200)
      extract: (s) => firstNum(s["Tốc độ Bus"] || ""),
      higherIsBetter: true,
      badge: (v) => `🚀 Bus RAM nhanh hơn (${v}MHz)`,
      keys: ["Tốc độ Bus"]
    },
    {
      // RAM: dung lượng nhiều hơn tốt hơn
      extract: (s) => firstNum(s["Dung lượng RAM"] || ""),
      higherIsBetter: true,
      badge: (v) => `🧠 Dung lượng RAM lớn hơn (${v}GB)`,
      keys: ["Dung lượng RAM"]
    },
    {
      // GPU: VRAM nhiều hơn tốt hơn (24 > 16 > 12 > 8)
      extract: (s) => firstNum(s["Dung lượng VRAM"] || ""),
      higherIsBetter: true,
      badge: (v) => `🎮 VRAM lớn hơn (${v}GB)`,
      keys: ["Dung lượng VRAM"]
    },
    {
      // SSD/Storage: dung lượng nhiều hơn tốt hơn (2TB > 1TB > 500GB)
      extract: (s) => {
        const text = s["Dung lượng ổ cứng"] || "";
        const tbMatch = text.match(/(\d+(?:\.\d+)?)\s*TB/i);
        if (tbMatch) return Math.round(Number(tbMatch[1]) * 1000);
        return firstNum(text);
      },
      higherIsBetter: true,
      badge: () => `💾 Dung lượng SSD lớn hơn`,
      keys: ["Dung lượng ổ cứng"]
    },
    {
      // PSU: công suất cao hơn tốt hơn (850W > 750W > 650W)
      extract: (s) => firstNum(s["Công suất thực"] || ""),
      higherIsBetter: true,
      badge: (v) => `🔌 Nguồn mạnh hơn (${v}W)`,
      keys: ["Công suất thực"]
    },
    {
      // CPU: số nhân nhiều hơn tốt hơn
      extract: (s) => firstNum(s["Số nhân / Số luồng"] || ""),
      higherIsBetter: true,
      badge: (v) => `🖥️ Nhiều nhân hơn (${v} nhân)`,
      keys: ["Số nhân / Số luồng"]
    },
    {
      // Tản nhiệt: tiếng ồn THẤP hơn tốt hơn (22dBA < 28dBA)
      extract: (s) => firstNum(s["Độ ồn quạt"] || ""),
      higherIsBetter: false,
      badge: (v) => `🤫 Êm hơn (~${v}dBA)`,
      keys: ["Độ ồn quạt"]
    }
  ];

  RULES.forEach((rule) => {
    // Thu thập giá trị số của từng sản phẩm theo rule này
    const entries = products
      .map((p) => ({ id: p.product_id || p.id, val: rule.extract(smartMap[p.product_id || p.id]) }))
      .filter((e) => e.val > 0);

    if (entries.length < 2) return; // Cần ít nhất 2 sản phẩm có dữ liệu để so sánh

    const vals = entries.map((e) => e.val);
    const best = rule.higherIsBetter ? Math.max(...vals) : Math.min(...vals);
    const worst = rule.higherIsBetter ? Math.min(...vals) : Math.max(...vals);

    if (best === worst) return; // Tất cả bằng nhau → không highlight ai cả

    // Chỉ highlight sản phẩm có giá trị TỐT NHẤT
    entries.forEach(({ id, val }) => {
      if (val === best) {
        results[id].badges.push(rule.badge(best));
        rule.keys.forEach((k) => results[id].superiorKeys.add(k));
      }
    });
  });

  return results;
}
