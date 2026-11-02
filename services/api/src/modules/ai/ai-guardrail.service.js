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
// Lưu ý: Dùng word boundary hoặc từ có nghĩa để tránh match substring ngẫu nhiên (ví dụ 'thi' chứa 'hi')
const DOMAIN_WHITELIST_KEYWORDS = [
  // Phần cứng & Linh kiện
  "pc", "may tinh", "laptop", "cpu", "mainboard", "main", "ram", "gpu", "vga", "card",
  "ssd", "hdd", "o cung", "nvme", "sata", "psu", "nguon", "case", "vo may", "cooling",
  "tan nhiet", "fan", "quat", "aio", "man hinh", "monitor", "ban phim", "chuot", "keyboard",
  "mouse", "tai nghe", "headphone", "gear", "loa", "webcam", "micro", "thermal", "keo tan nhiet",

  // Thương hiệu & Dòng chip nổi tiếng
  "intel", "amd", "nvidia", "asus", "gigabyte", "msi", "asrock", "corsair", "kingston",
  "western digital", "wd", "seagate", "samsung", "lexar", "teamgroup", "thermalright",
  "deepcool", "nzxt", "coolermaster", "ryzen", "core i", "core ultra", "rtx", "gtx", "radeon",
  "blackwell", "ddr4", "ddr5", "lga", "am4", "am5",

  // Tác vụ công nghệ & Nhu cầu
  "build", "rap may", "lap may", "cau hinh", "choi game", "gaming", "esport", "aaa",
  "fps", "valorant", "csgo", "cs2", "lol", "lien minh", "genshin", "wukong", "cyberpunk",
  "gta", "render", "do hoa", "blender", "premiere", "photoshop", "autocad", "3ds max",
  "lap trinh", "code", "dev", "docker", "may ao", "vm", "machine learning", "deep learning",
  "van phong", "hoc tap", "word", "excel", "sinh vien",

  // Khái niệm kỹ thuật & So sánh
  "nghen co chai", "bottleneck", "overclock", "ep xung", "vrm", "tdp", "watt", "cong suat",
  "socket", "bus", "cl", "timing", "pcie", "m.2", "clearance", "kich thuoc", "atx", "matx",
  "itx", "airflow", "so sanh", "nang cap", "tu van", "lua chon", "ngan sach", "trieu",

  // Giao dịch & Hỗ trợ khách hàng PC Mall
  "bao hanh", "doi tra", "giao hang", "ship", "don hang", "thanh toan", "vnpay", "cod",
  "gio hang", "khuyen mai", "giam gia", "mua hang", "pc mall", "cua hang"
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
