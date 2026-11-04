/**
 * Guardrail Filter cho hệ thống Chat AI PC Mall.
 * Ngăn chặn tuyệt đối các tin nhắn không liên quan (nấu ăn, chính trị, thể thao ngoài lề, bài tập toán/văn, thơ ca, jailbreak/prompt injection)
 * được gửi đến LLM, bảo vệ token, ngân sách API và tôn nghiêm của trợ lý bán hàng/kỹ thuật.
 */

const { normalizeVietnamese } = require("./ai-normalize-helpers");

// Danh sách từ khóa/chủ đề bị cấm hoặc không liên quan (Off-topic & Injection)
const PROHIBITED_PATTERNS = [
  // 1. Jailbreak / Prompt Injection / System prompt leak
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s*prompt/i,
  /you\s+are\s+now\s+a/i,
  /jailbreak/i,
  /dan\s+mode/i,
  /reveal\s+(your|the)\s+secret/i,
  /cho\s+toi\s+biet\s+prompt/i,
  /quen\s+het\s+huong\s+dan/i,
  /dong\s+vai\s+tro/i,
  /hacked/i,

  // 2. Ẩm thực / Nấu ăn
  /nau\s+(an|com|canh|chao|pho|bun)/i,
  /cong\s+thuc\s+(nau|lam\s+banh|pha\s+che)/i,
  /mon\s+(xao|luoc|hap|ran|chien|nuong|an)/i,
  /gia\s+vi|nuoc\s+mam|hat\s+nem|duong|muoi/i,

  // 3. Chính trị / Tôn giáo / Tin tức ngoài lề
  /chinh\s+tri|dang\s+cong\s+san|tong\s+thong|bau\s+cu/i,
  /chien\s+tranh|quan\s+su|vu\s+khi|bom\s+dan/i,
  /ton\s+giao|chua\s+troi|phat\s+phap/i,

  // 4. Soạn văn / Làm thơ / Bài tập học đường không liên quan
  /lam\s+tho|bai\s+tho|sang\s+tac\s+tho/i,
  /viet\s+(bai\s+van|doan\s+van|mo\s+bai|ket\s+bai)/i,
  /giai\s+(toan|hoa|sinh|su|dia|tieng\s+anh)/i,
  /phuong\s+trinh\s+bac/i,

  // 5. Y tế / Sức khỏe / Thuốc men
  /thuoc\s+(uong|chua\s+benh|tri\s+mun)/i,
  /trieu\s+chung\s+(benh|cam\s+cum|sot)/i,
  /kham\s+benh|bac\s+si|uong\s+thuoc/i,

  // 6. Xổ số / Cờ bạc / Tiền tệ ngoài lề
  /xo\s+so|lo\s+de|danh\s+de|tai\s+xiu|baccarat|casino/i,
  /cho\s+so\s+dep|so\s+mo/i
];

// Danh sách từ khóa hợp lệ trong domain Máy Tính / Phụ Kiện / Ecommerce PC Mall
// Bao gồm: Thương hiệu, Công nghệ hiện đại (DDR4/5, Socket, Bus), Loại linh kiện, Nơi sản xuất & Xuất xứ
const DOMAIN_WHITELIST_KEYWORDS = [
  // 1. Phần cứng & Loại linh kiện (Accented & Unaccented)
  "pc", "may tinh", "laptop", "cpu", "chip", "chipset", "vi xu ly", "bo xu ly", "phan cung",
  "mainboard", "main", "bo mach", "bo mach chu", "ram", "gpu", "vga", "card", "card man hinh", "card do hoa",
  "ssd", "hdd", "o cung", "o the ran", "o dia", "nvme", "sata", "sata 3", "m.2",
  "psu", "nguon", "nguon may tinh", "case", "vo may", "vo case", "thung may",
  "cooling", "tan nhiet", "tan khi", "tan nuoc", "aio", "tan thap", "dual tower",
  "fan", "quat", "quat case", "thermal", "keo tan nhiet",
  "man hinh", "monitor", "ban phim", "chuot", "keyboard", "mouse", "tai nghe", "headphone", "gear", "loa", "webcam", "micro",

  // 2. Thương hiệu toàn cầu (Brands)
  "intel", "amd", "nvidia", "asus", "gigabyte", "msi", "asrock", "colorful", "galax", "zotac",
  "palit", "inno3d", "sapphire", "powercolor", "xfx", "corsair", "kingston", "gskill", "g.skill",
  "teamgroup", "patriot", "samsung", "western digital", "wd", "seagate", "crucial", "klevv", "pny",
  "lexar", "adata", "transcend", "dahua", "hikvision", "deepcool", "thermalright", "cooler master", "coolermaster",
  "nzxt", "lian li", "antec", "montech", "xigmatek", "mik", "segotep", "seasonic", "super flower", "fsp",
  "be quiet", "bequiet", "silverstone", "id-cooling", "idcooling", "arctic", "noctua",
  "dell", "hp", "lenovo", "acer", "lg", "viewsonic", "aoc", "philips", "benq", "logitech", "razer", "steelseries",

  // 3. Công nghệ hiện đại, Thế hệ & Thông số kỹ thuật (DDR4/5, Socket, Kiến trúc, Bus, VRAM, GPU)
  "ddr3", "ddr4", "ddr5", "lpddr4", "lpddr5", "bus", "3200", "3600", "4800", "5200", "5600", "6000", "6400", "7200",
  "xmp", "expo", "cl16", "cl18", "cl30", "cl32", "cl36", "dual channel", "quad channel",
  "pcie", "pcie 3.0", "pcie 4.0", "pcie 5.0", "gen 3", "gen 4", "gen 5",
  "atx 3.0", "atx 3.1", "12vhpwr", "12v-2x6", "80 plus", "bronze", "silver", "gold", "platinum", "titanium",
  "full modular", "semi modular", "non modular",
  "lga 1700", "lga 1851", "lga 1200", "socket 1700", "socket 1851", "am4", "am5", "socket am4", "socket am5",
  "zen 2", "zen 3", "zen 4", "zen 5", "raptor lake", "alder lake", "arrow lake", "meteor lake", "lunar lake",
  "core ultra", "ultra 5", "ultra 7", "ultra 9", "245k", "250k", "250kf", "265k", "285k",
  "core i3", "core i5", "core i7", "core i9", "12100", "12400", "12600", "13100", "13400", "13600", "13700", "13900", "14100", "14400", "14600", "14700", "14900",
  "ryzen 3", "ryzen 5", "ryzen 7", "ryzen 9", "3200g", "3400g", "5600", "5600x", "5700x", "5800x3d", "7500f", "7600", "7700", "7800x3d", "9600x", "9700x", "9800x3d", "9900x", "9950x", "x3d",
  "rtx", "gtx", "radeon", "blackwell", "ada lovelace",
  "rtx 3050", "3060", "3060 ti", "3070", "3070 ti", "3080", "3090",
  "rtx 4060", "4060 ti", "4070", "4070 super", "4070 ti", "4070 ti super", "4080", "4080 super", "4090",
  "rtx 5070", "5080", "5090", "gtx 1650", "1660",
  "rx 6600", "rx 7600", "rx 7700 xt", "rx 7800 xt", "rx 7900 xt", "rx 7900 xtx",
  "arc a380", "arc a580", "arc a750", "arc a770", "battlemage",
  "dlss", "dlss 3", "dlss 3.5", "fsr", "fsr 3", "xess", "ray tracing", "path tracing", "frame generation",
  "vram", "8gb", "12gb", "16gb", "24gb", "gddr6", "gddr6x", "tdp", "65w", "105w", "125w", "250w",
  "vrm", "heatsink", "argb", "rgb", "pwm", "120mm", "140mm",
  "wifi 6", "wifi 6e", "wifi 7", "bluetooth", "2.5gbe", "10gbe", "thunderbolt", "usb4", "type-c", "displayport", "hdmi 2.1",
  "oled", "qd-oled", "mini led", "ips", "va", "144hz", "165hz", "180hz", "240hz", "360hz", "g-sync", "freesync", "hdr",

  // 4. Xuất xứ, Nơi sản xuất & Phân phối (Origin / Manufacturing / Warranty)
  "chinh hang", "hang cong ty", "nguyen seal", "full box", "tray", "box", "xach tay", "nhap khau",
  "like new", "troi bao hanh", "xuat xu", "noi san xuat", "san xuat tai", "made in",
  "taiwan", "dai loan", "china", "trung quoc", "vietnam", "viet nam", "korea", "han quoc", "usa", "my",
  "malaysia", "philippines", "costa rica", "synnex fpt", "fpt", "vien son", "vinh xuan", "mai hoang", "khai thien", "dgw", "digiworld",

  // 5. Tác vụ công nghệ & Nhu cầu (Gaming, Đồ họa, Lập trình, Văn phòng)
  "build", "rap may", "lap may", "cau hinh", "choi game", "gaming", "esport", "aaa",
  "fps", "valorant", "csgo", "cs2", "lol", "lien minh", "dota", "dota 2", "genshin", "wukong", "cyberpunk",
  "gta", "fifa", "fc online", "fo4", "pubg", "free fire", "roblox", "minecraft", "apex", "warzone", "elden ring",
  "render", "do hoa", "blender", "premiere", "photoshop", "autocad", "3ds max",
  "lap trinh", "code", "dev", "docker", "may ao", "vm", "machine learning", "deep learning", "ai",
  "van phong", "hoc tap", "word", "excel", "sinh vien",

  // 6. Khái niệm kỹ thuật & So sánh
  "nghen co chai", "bottleneck", "overclock", "ep xung", "watt", "cong suat",
  "socket", "bus", "timing", "clearance", "kich thuoc", "atx", "matx", "itx", "airflow",
  "so sanh", "nang cap", "tu van", "lua chon", "ngan sach", "trieu",
  "toi tan", "manh nhat", "tot nhat", "moi nhat", "hien dai", "hien dai nhat", "tien tien", "xin nhat", "khung nhat", "dinh nhat",
  "flagship", "linh kien",

  // 7. Giao dịch & Dịch vụ PC Mall
  "bao hanh", "doi tra", "giao hang", "ship", "don hang", "thanh toan", "vnpay", "cod",
  "gio hang", "khuyen mai", "giam gia", "mua hang", "pc mall", "cua hang", "showroom"
];

function checkWordMatch(text, keyword) {
  if (keyword.includes(" ")) {
    return text.includes(keyword);
  }
  const regex = new RegExp(`\\b${keyword}\\b`, "i");
  return regex.test(text);
}

/**
 * Kiểm tra xem một tin nhắn có hợp lệ để xử lý và gửi đến LLM hay không.
 * @param {string} message Tin nhắn người dùng
 * @returns {{ isAllowed: boolean, reason?: string, fallbackReply?: string }}
 */
function validateChatMessageDomain(message) {
  if (!message || typeof message !== "string") {
    return {
      isAllowed: false,
      reason: "EMPTY_MESSAGE",
      fallbackReply: "Xin chào! Bạn vui lòng nhập câu hỏi hoặc yêu cầu tư vấn về máy tính, linh kiện PC nhé."
    };
  }

  const raw = message.trim();
  const normalized = normalizeVietnamese(raw).toLowerCase();

  // 1. Kiểm tra độ dài bất thường (ngăn chặn buffer overflow/spam token)
  if (raw.length > 2000) {
    return {
      isAllowed: false,
      reason: "MESSAGE_TOO_LONG",
      fallbackReply: "⚠️ Tin nhắn của bạn quá dài. Vui lòng tóm tắt ngắn gọn câu hỏi về PC/linh kiện (dưới 1000 ký tự) để mình hỗ trợ nhanh nhất nhé!"
    };
  }

  // 2. Kiểm tra các mẫu Prohibited / Jailbreak / Off-topic rõ rệt
  for (const pattern of PROHIBITED_PATTERNS) {
    if (pattern.test(raw) || pattern.test(normalized)) {
      return {
        isAllowed: false,
        reason: "PROHIBITED_OR_OFF_TOPIC",
        fallbackReply: "🤖 Dạ, mình là Trợ lý AI chuyên biệt của PC Mall, chỉ được huấn luyện để **tư vấn build PC, phân tích linh kiện phần cứng, laptop và giải đáp bảo hành/mua hàng**.\n\nMình không thể hỗ trợ các chủ đề ngoài công nghệ máy tính (như nấu ăn, làm thơ, giải toán hay các câu hỏi không liên quan). Bạn có cần tư vấn cấu hình máy tính hoặc linh kiện nào không ạ?"
      };
    }
  }

  // 3. Cho phép chào hỏi ngắn gọn (greeting)
  if (normalized.length <= 15 && /\b(chao|chao ban|xin chao|hi|hello|alo|hey|hello ban)\b/.test(normalized)) {
    return { isAllowed: true };
  }

  // 4. Kiểm tra Domain Whitelist
  const hasDomainKeyword = DOMAIN_WHITELIST_KEYWORDS.some((kw) => checkWordMatch(normalized, kw));

  // Kiểm tra xem có chứa số tiền ngân sách không (vd: 15tr, 20 triệu, 500k)
  const hasBudgetKeyword = /\d+\s*(tr|trieu|k|m|dong|vnd|ti)\b/i.test(normalized);

  if (!hasDomainKeyword && !hasBudgetKeyword) {
    return {
      isAllowed: false,
      reason: "OFF_DOMAIN",
      fallbackReply: "🤖 Dạ câu hỏi của bạn dường như không liên quan đến **máy tính, linh kiện PC, phụ kiện hoặc dịch vụ tại PC Mall**.\n\nĐể mình có thể phục vụ tốt nhất, bạn vui lòng đặt câu hỏi liên quan đến:\n- 🎯 Tư vấn cấu hình PC theo ngân sách và nhu cầu (Gaming, Đồ họa, Văn phòng, AI/Lập trình)\n- 🔌 So sánh và kiểm tra tương thích linh kiện (CPU, Mainboard, RAM, GPU, Nguồn, Case)\n- 📦 Hỗ trợ bảo hành, tra cứu đơn hàng hoặc thanh toán tại PC Mall."
    };
  }

  return { isAllowed: true };
}

module.exports = {
  validateChatMessageDomain,
  PROHIBITED_PATTERNS,
  DOMAIN_WHITELIST_KEYWORDS
};
