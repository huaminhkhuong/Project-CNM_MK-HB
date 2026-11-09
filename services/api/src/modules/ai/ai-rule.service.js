const fs = require("fs");
const path = require("path");
const { normalizeVietnamese, cleanSearchText } = require("./ai-normalize-helpers");

const STORE_PATH = path.resolve(__dirname, "../../data/ai-rules-store.json");

// Cấu hình Hệ thống AI & Token mặc định (Tập trung toàn bộ tham số AI của PC Mall)
const DEFAULT_SYSTEM_CONFIG = {
  provider: "gemini",
  model: "gemini-1.5-flash",
  temperature: 0.4,
  maxTokens: 2048,
  maxCatalogProducts: 35,
  retrievalMode: "keyword_and_category"
};

// Mẫu System Prompt mặc định cho 3 chức năng
const DEFAULT_PROMPTS = {
  GENERAL_CHAT: {
    scope: "GENERAL_CHAT",
    name: "AI Tư Vấn Bán Hàng & Kỹ Thuật Chung",
    systemPrompt: "Bạn là chuyên gia tư vấn kỹ thuật và bán hàng tại PC Mall. Nhiệm vụ: Giải đáp thắc mắc về phần cứng PC, laptop, linh kiện, so sánh sản phẩm và tư vấn cấu hình phù hợp với ngân sách của khách hàng. Phong cách trả lời: Thân thiện, khách quan, súc tích, trung thực, không bịa đặt sản phẩm không có thật.",
    model: "gemini-1.5-flash",
    temperature: 0.4,
    maxTokens: 1024
  },
  BUILDER_SUGGEST: {
    scope: "BUILDER_SUGGEST",
    name: "AI Đề Xuất Cấu Hình PC (Từ 32 Ứng Viên)",
    systemPrompt: "Bạn là chuyên gia cấu hình PC cao cấp tại PC Mall. Nhiệm vụ: Đánh giá danh sách 32 linh kiện ứng viên đã được lọc từ cơ sở dữ liệu (4 linh kiện cho mỗi danh mục trong 8 danh mục: CPU, Mainboard, RAM, GPU, Storage, PSU, Case, Cooling). Yêu cầu đánh giá và phân tích một cách không thiên vị, thật là nghiêm khắc. Chọn ra đúng 1 cấu hình tối ưu nhất gồm 8 linh kiện, đảm bảo 100% tương thích phần cứng, tối đa hóa hiệu năng trên từng đồng ngân sách của khách hàng.",
    model: "gemini-1.5-flash",
    temperature: 0.2,
    maxTokens: 2048
  },
  BUILDER_AUDIT_CHAT: {
    scope: "BUILDER_AUDIT_CHAT",
    name: "AI Giám Định & Chat Hỏi Đáp Về Build PC",
    systemPrompt: "Bạn là kỹ sư kiểm định phần cứng máy tính khắt khe của PC Mall. Nhiệm vụ: Giám định chi tiết dàn máy người dùng vừa xây dựng, phân tích kỹ thuật về điểm cân bằng CPU/GPU, độ dư công suất nguồn (PSU Headroom), nhiệt độ tản nhiệt và tính tương thích socket/bus RAM. Trả lời các câu hỏi người dùng về build này. Nếu phát hiện linh kiện yếu hoặc nghẽn, phải chỉ rõ nguyên nhân và đề xuất linh kiện thay thế hợp lý.",
    model: "gemini-1.5-flash",
    temperature: 0.3,
    maxTokens: 1536
  }
};

// Danh sách Quy tắc lọc đầu vào mặc định (Pre-seeded Production Rules với từ khóa có dấu và không dấu phong phú)
const DEFAULT_RULES = [
  // SCOPE: GENERAL_CHAT - Chào hỏi & FAQ
  {
    id: "rule-gen-01",
    scope: "GENERAL_CHAT",
    name: "Chào hỏi cơ bản & Giới thiệu trợ lý",
    matchType: "regex",
    pattern: "^(chao|xin chao|chào|xin chào|hello|hi|helo|alo|hey|shop oi|shop ơi|bot oi|bot ơi|ad oi|ad ơi|admin oi|admin ơi|ban la ai|bạn là ai)\\b",
    action: "DIRECT_REPLY",
    directReply: "Xin chào bạn! 👋 Mình là Trợ lý Kỹ thuật & Bán hàng AI của **PC Mall**. Mình có thể hỗ trợ bạn tư vấn cấu hình PC theo ngân sách, so sánh linh kiện, chọn laptop hoặc tra cứu chính sách mua sắm. Bạn đang quan tâm đến nhu cầu nào?",
    blockReason: "",
    promptInjection: "",
    priority: 100,
    isActive: true,
    hitCount: 0
  },
  {
    id: "rule-gen-02",
    scope: "GENERAL_CHAT",
    name: "Chính sách bảo hành điện tử",
    matchType: "contains",
    pattern: "bảo hành, bao hanh, chính sách bảo hành, chinh sach bao hanh, tra cứu bảo hành, tra cuu bao hanh, bảo hành máy tính, bao hanh may tinh, thời hạn bảo hành, thoi han bao hanh, đổi trả, doi tra, 1 đổi 1, 1 doi 1, trung tâm bảo hành, trung tam bao hanh",
    action: "DIRECT_REPLY",
    directReply: "🛡️ **Chính sách bảo hành tại PC Mall:**\n- 100% sản phẩm được bảo hành chính hãng từ 12 đến 36 tháng theo số Serial / Đơn hàng điện tử.\n- Đổi mới trong 30 ngày đầu nếu lỗi do nhà sản xuất.\n- Hỗ trợ gửi bảo hành tận nơi qua đơn vị vận chuyển hoặc ghé showroom PC Mall.\n- Bạn có thể vào mục **Bảo hành của tôi** trên menu để gửi yêu cầu và theo dõi tiến độ xử lý trực tiếp.",
    blockReason: "",
    promptInjection: "",
    priority: 95,
    isActive: true,
    hitCount: 0
  },
  {
    id: "rule-gen-03",
    scope: "GENERAL_CHAT",
    name: "Phương thức thanh toán & Đặt cọc",
    matchType: "contains",
    pattern: "thanh toán, thanh toan, vnpay, ship cod, trả góp, tra gop, chuyển khoản, chuyen khoan, quét mã qr, quet ma qr, qr code, đặt cọc, dat coc, thẻ tín dụng, the tin dung, quẹt thẻ, quet the, ví điện tử, vi dien tu",
    action: "DIRECT_REPLY",
    directReply: "💳 **Phương thức thanh toán hỗ trợ tại PC Mall:**\n1. **Giao hàng thu tiền (COD)**: Thanh toán tiền mặt khi nhận hàng toàn quốc.\n2. **Cổng thanh toán VNPay**: Thẻ ATM nội địa, thẻ quốc tế Visa/Mastercard, quét mã VNPAY-QR.\n3. **Chuyển khoản QR Banking**: Quét mã VietQR tiện lợi, xác nhận đơn tự động.\n- Đơn hàng build PC nguyên bộ được miễn phí công lắp ráp và hỗ trợ trả góp qua cổng thanh toán.",
    blockReason: "",
    promptInjection: "",
    priority: 90,
    isActive: true,
    hitCount: 0
  },
  {
    id: "rule-gen-04",
    scope: "GENERAL_CHAT",
    name: "Địa chỉ Showroom & Giờ làm việc",
    matchType: "contains",
    pattern: "địa chỉ, dia chi, showroom, cửa hàng, cua hang, ở đâu, o dau, giờ làm việc, gio lam viec, mấy giờ mở cửa, may gio mo cua, hotline, số điện thoại, so dien thoai, sđt, sdt, chi nhánh, chi nhanh, liên hệ, lien he",
    action: "DIRECT_REPLY",
    directReply: "📍 **Thông tin liên hệ PC Mall:**\n- **Showroom chính**: Tầng 1, Tòa nhà Công nghệ PC Mall, Khu Công Nghệ Cao, TP.HCM.\n- **Giờ mở cửa**: 08:00 - 21:30 (Tất cả các ngày trong tuần kể cả Thứ 7 & CN).\n- **Hotline kỹ thuật & tư vấn**: 1900 6868 (Miễn phí cước gọi).\n- **Email hỗ trợ**: support@pcmall.vn",
    blockReason: "",
    promptInjection: "",
    priority: 85,
    isActive: true,
    hitCount: 0
  },
  {
    id: "rule-gen-05",
    scope: "GENERAL_CHAT",
    name: "Tư vấn & So sánh RAM DDR4 vs DDR5",
    matchType: "regex",
    pattern: "(ddr4.*ddr5|ddr5.*ddr4|ram ddr4 hay ddr5|nen chon ddr4)",
    action: "SYSTEM_INJECT",
    directReply: "",
    blockReason: "",
    promptInjection: "Chỉ thị tư vấn RAM: Phân tích sâu so sánh DDR4 và DDR5 (xung nhịp bus, băng thông, giá cả, nền tảng mainboard). BẮT BUỘC ưu tiên giới thiệu các kit RAM DDR4 và DDR5 thật đang có sẵn trong kho PC Mall.",
    priority: 80,
    isActive: true,
    hitCount: 0
  },

  // SCOPE: GENERAL_CHAT - BỘ LỌC CHẶN CÂU HỎI NGOÀI LỀ (OFF-TOPIC GUARDRAILS ĐA LĨNH VỰC)
  {
    id: "rule-gen-06",
    scope: "GENERAL_CHAT",
    name: "Chặn nội dung ngoài lề tổng quát (Regex Off-topic Guardrail)",
    matchType: "regex",
    pattern: "(nau an|nau nuong|cong thuc|mon xao|mon luoc|mon nuong|mon kho|mon chien|suon xao|am thuc|an gi|giai toan|bai tap|lam tho|viet tho|viet van|van mau|soan van|xem boi|tu vi|cung hoang dao|phong thuy|tarot|xo so|lo de|danh de|soi cau|ca do|ca cuoc|casino|tai xiu|baccarat|ke don|chua benh|kham benh|uong thuoc|son moi|kem chong nang|trang diem|vay dam|chinh tri|bau cu|tong thong|thu tuong|ket qua bong da|ti so tran)",
    action: "BLOCK",
    directReply: "",
    blockReason: "⚠️ Rất tiếc, mình là Trợ lý AI chuyên biệt về Máy tính và Linh kiện của PC Mall nên không thể giải đáp các chủ đề ngoài lĩnh vực công nghệ / mua sắm (như ẩm thực, chính trị, làm thơ, bài tập học đường...). Bạn vui lòng hỏi về PC, laptop hoặc linh kiện nhé!",
    promptInjection: "",
    priority: 99,
    isActive: true,
    hitCount: 0
  },
  {
    id: "rule-offtopic-culinary",
    scope: "GENERAL_CHAT",
    name: "Chặn câu hỏi Ẩm thực, Nấu nướng & Công thức món ăn",
    matchType: "contains",
    pattern: "nấu ăn, nau an, nấu nướng, nau nuong, công thức nấu, cong thuc nau, món xào, mon xao, món luộc, mon luoc, món nướng, mon nuong, món kho, mon kho, món chiên, mon chien, món rán, mon ran, món canh, mon canh, sườn xào, suon xao, sườn chua ngọt, suon chua ngot, thịt kho, thit kho, bún chả, bun cha, phở bò, pho bo, cơm tấm, com tam, lẩu thái, lau thai, nước chấm, nuoc cham, pha cà phê, pha ca phe, trà sữa, tra sua, làm bánh, lam banh, gia vị, gia vi, nêm nếm, nem nem, cách làm món, cach lam mon, cách nấu, cach nau, quán ăn, quan an, nhà hàng, nha hang, đặc sản, dac san, ẩm thực, am thuc, ăn gì hôm nay, an gi hom nay",
    action: "BLOCK",
    directReply: "",
    blockReason: "⚠️ Rất tiếc, mình là Trợ lý AI chuyên biệt về Máy tính và Linh kiện phần cứng tại PC Mall nên không thể tư vấn về ẩm thực hay công thức nấu ăn. Bạn vui lòng hỏi về PC, laptop hoặc linh kiện công nghệ nhé!",
    promptInjection: "",
    priority: 98,
    isActive: true,
    hitCount: 0
  },
  {
    id: "rule-offtopic-academic",
    scope: "GENERAL_CHAT",
    name: "Chặn Giải bài tập, Văn thơ & Học đường",
    matchType: "contains",
    pattern: "giải toán, giai toan, bài tập về nhà, bai tap ve nha, giải bài tập, giai bai tap, làm thơ, lam tho, viết thơ, viet tho, bài thơ, bai tho, sáng tác thơ, sang tac tho, viết văn, viet van, đoạn văn, doan van, văn mẫu, van mau, phân tích thơ, phan tich tho, soạn văn, soan van, tập làm văn, tap lam van, nghị luận, nghi luan, giải phương trình, giai phuong trinh, hóa học lớp, hoa hoc lop, vật lý lớp, vat ly lop, sinh học lớp, sinh hoc lop, viết luận, viet luan, làm bài thi, lam bai thi",
    action: "BLOCK",
    directReply: "",
    blockReason: "⚠️ Rất tiếc, mình là Trợ lý AI chuyên sâu về Phần cứng PC của PC Mall nên không thể giải bài tập hoặc sáng tác văn thơ. Bạn vui lòng đặt câu hỏi liên quan đến máy tính, phần mềm hoặc linh kiện nhé!",
    promptInjection: "",
    priority: 97,
    isActive: true,
    hitCount: 0
  },
  {
    id: "rule-offtopic-fortune",
    scope: "GENERAL_CHAT",
    name: "Chặn Bói toán, Tử vi, Phong thủy & Tâm linh",
    matchType: "contains",
    pattern: "xem bói, xem boi, tử vi, tu vi, bói toán, boi toan, cung hoàng đạo, cung hoang dao, bói chỉ tay, boi chi tay, phong thủy, phong thuy, xem tướng, xem tuong, bói bài tarot, boi bai tarot, ngày hoàng đạo, ngay hoang dao, xem tuổi, xem tuoi, vận mệnh, van menh, số mệnh, so menh, bùa ngải, bua ngai, cúng bái, cung bai, giải hạn, giai han, tâm linh, tam linh, cầu tài lộc, cau tai loc",
    action: "BLOCK",
    directReply: "",
    blockReason: "⚠️ Rất tiếc, mình là Trợ lý AI kỹ thuật của PC Mall nên không hỗ trợ các chủ đề bói toán, tử vi hay phong thủy. Bạn vui lòng hỏi về máy tính hoặc thiết bị công nghệ nhé!",
    promptInjection: "",
    priority: 96,
    isActive: true,
    hitCount: 0
  },
  {
    id: "rule-offtopic-gambling",
    scope: "GENERAL_CHAT",
    name: "Chặn Cờ bạc, Cá độ, Lô đề & Đỏ đen",
    matchType: "contains",
    pattern: "xổ số, xo so, kết quả xổ số, ket qua xo so, lô đề, lo de, đánh đề, danh de, soi cầu, soi cau, cá độ, ca do, cá cược, ca cuoc, cờ bạc, co bac, casino, đánh bài, danh bai, tài xỉu, tai xiu, baccarat, xóc đĩa, xoc dia, đá gà, da ga, bắn cá đổi thưởng, ban ca doi thuong, nổ hũ, no hu, quay hũ, quay hu",
    action: "BLOCK",
    directReply: "",
    blockReason: "⚠️ PC Mall kiên quyết không hỗ trợ và từ chối các nội dung liên quan đến cờ bạc, cá cược hoặc lô đề. Vui lòng chỉ đặt các câu hỏi về sản phẩm công nghệ!",
    promptInjection: "",
    priority: 96,
    isActive: true,
    hitCount: 0
  },
  {
    id: "rule-offtopic-medical",
    scope: "GENERAL_CHAT",
    name: "Chặn Y tế, Chuẩn đoán bệnh & Thuốc men",
    matchType: "contains",
    pattern: "kê đơn thuốc, ke don thuoc, thuốc trị, thuoc tri, chữa bệnh, chua benh, khám bệnh, kham benh, chuẩn đoán bệnh, chuan doan benh, đau đầu uống gì, dau dau uong gi, đau bụng, dau bung, thuốc kháng sinh, thuoc khang sinh, toa thuốc, toa thuoc, phòng khám, phong kham, bệnh viện, benh vien, bác sĩ tư vấn, bac si tu van, triệu chứng sốt, trieu chung sot, thuốc cảm, thuoc cam, đau răng, dau rang, trị mụn, tri mun",
    action: "BLOCK",
    directReply: "",
    blockReason: "⚠️ Mình là Trợ lý AI phần cứng PC, không có chuyên môn y tế hay cấp phép kê đơn thuốc. Đối với vấn đề sức khỏe, bạn vui lòng thăm khám tại bệnh viện hoặc cơ sở y tế chuyên khoa nhé!",
    promptInjection: "",
    priority: 95,
    isActive: true,
    hitCount: 0
  },
  {
    id: "rule-offtopic-beauty",
    scope: "GENERAL_CHAT",
    name: "Chặn Thời trang, Mỹ phẩm & Làm đẹp",
    matchType: "contains",
    pattern: "son môi, son moi, kem chống nắng, kem chong nang, sữa rửa mặt, sua rua mat, dưỡng da, duong da, trang điểm, trang diem, makeup, phối đồ, phoi do, quần áo nữ, quan ao nu, váy đầm, vay dam, giày cao gót, giay cao got, tiệm cắt tóc, tiem cat toc, nhuộm tóc, nhuom toc, thẩm mỹ viện, tham my vien, nước hoa, nuoc hoa",
    action: "BLOCK",
    directReply: "",
    blockReason: "⚠️ Rất tiếc, mình là Trợ lý chuyên về Máy tính của PC Mall nên không thể tư vấn về thời trang, mỹ phẩm hay làm đẹp. Bạn có thể hỏi mình về các mẫu PC, laptop hoặc linh kiện nhé!",
    promptInjection: "",
    priority: 94,
    isActive: true,
    hitCount: 0
  },
  {
    id: "rule-offtopic-politics",
    scope: "GENERAL_CHAT",
    name: "Chặn Chính trị, Quân sự & Tranh chấp nhạy cảm",
    matchType: "contains",
    pattern: "chính trị, chinh tri, bầu cử tổng thống, bau cu tong thong, thủ tướng, thu tuong, đại hội đảng, dai hoi dang, biểu tình, bieu tinh, phản động, phan dong, vũ khí chiến tranh, vu khi chien tranh, súng đạn, sung dan, xung đột quân sự, xung dot quan su",
    action: "BLOCK",
    directReply: "",
    blockReason: "⚠️ Hệ thống PC Mall không thảo luận các chủ đề chính trị, thời sự hay quân sự. Bạn vui lòng chỉ hỏi về thiết bị điện tử và máy tính!",
    promptInjection: "",
    priority: 94,
    isActive: true,
    hitCount: 0
  },
  {
    id: "rule-offtopic-sports",
    scope: "GENERAL_CHAT",
    name: "Chặn Kết quả bóng đá & Thể thao ngoài lề",
    matchType: "contains",
    pattern: "kết quả bóng đá, ket qua bong da, tỉ số bóng đá, ti so bong da, lịch thi đấu ngoại hạng anh, lich thi dau ngoai hang anh, bảng xếp hạng cúp c1, bang xep hang cup c1, soi kèo bóng đá, soi keo bong da, trực tiếp trận đấu, truc tiep tran dau, world cup, giải ngoại hạng anh",
    action: "BLOCK",
    directReply: "",
    blockReason: "⚠️ Mình là Trợ lý hỗ trợ phần cứng máy tính và công nghệ, không hỗ trợ cập nhật kết quả thể thao hay bóng đá. Bạn vui lòng quay lại chủ đề PC hoặc sản phẩm IT nhé!",
    promptInjection: "",
    priority: 93,
    isActive: true,
    hitCount: 0
  },

  // SCOPE: BUILDER_SUGGEST
  {
    id: "rule-bld-01",
    scope: "BUILDER_SUGGEST",
    name: "Cảnh báo ngân sách quá thấp cho PC rời (< 5 triệu)",
    matchType: "budget_threshold",
    pattern: "< 5000000",
    action: "BLOCK",
    directReply: "",
    blockReason: "⚠️ Ngân sách dưới 5.000.000đ hiện không đủ để lắp ráp một case PC mới 100% hoàn chỉnh gồm đủ 8 linh kiện tại PC Mall. Ngân sách tối thiểu cho case văn phòng mới là từ 6.500.000đ, hoặc gaming phổ thông từ 9.000.000đ. Bạn vui lòng nâng mức ngân sách hoặc liên hệ nhân viên tư vấn linh kiện đã qua sử dụng.",
    promptInjection: "",
    priority: 100,
    isActive: true,
    hitCount: 0
  },
  {
    id: "rule-bld-02",
    scope: "BUILDER_SUGGEST",
    name: "Cảnh báo ngân sách vượt trần (> 250 triệu)",
    matchType: "budget_threshold",
    pattern: "> 250000000",
    action: "BLOCK",
    directReply: "",
    blockReason: "⚠️ Ngân sách trên 250.000.000đ thuộc nhóm Server/Workstation AI chuyên dụng đa card đồ họa. Vui lòng liên hệ trực tiếp bộ phận Kỹ sư Giải pháp Doanh nghiệp của PC Mall để được lên phương án cấu hình và tản nhiệt riêng biệt.",
    promptInjection: "",
    priority: 95,
    isActive: true,
    hitCount: 0
  },
  {
    id: "rule-bld-03",
    scope: "BUILDER_SUGGEST",
    name: "Chỉ thị AI chọn lọc nghiêm ngặt từ 32 ứng viên",
    matchType: "regex",
    pattern: ".*",
    action: "SYSTEM_INJECT",
    directReply: "",
    blockReason: "",
    promptInjection: "YÊU CẦU ĐẶC BIỆT: Đánh giá khắt khe và công tâm giữa các ứng viên linh kiện. Tuyệt đối không chọn linh kiện vượt quá ngân sách tổng. Đảm bảo công suất nguồn (PSU) lớn hơn tổng TDP các linh kiện ít nhất 150W.",
    priority: 10,
    isActive: true,
    hitCount: 0
  },

  // SCOPE: BUILDER_AUDIT_CHAT
  {
    id: "rule-aud-01",
    scope: "BUILDER_AUDIT_CHAT",
    name: "Chỉ thị phát hiện nghẽn cổ chai và đề xuất linh kiện thay thế",
    matchType: "contains",
    pattern: "nghen, nghẽn, bottleneck, yeu, yếu, lech pha, lệch pha, khong can bang, không cân bằng",
    action: "SYSTEM_INJECT",
    directReply: "",
    blockReason: "",
    promptInjection: "Người dùng đang đặc biệt quan tâm đến hiện tượng nghẽn cổ chai (Bottleneck). Hãy chỉ rõ phần trăm chênh lệch hiệu năng giữa CPU và GPU, chỉ ra linh kiện nào đang kéo tụt hiệu năng và bắt buộc trả về mảng 'replacements' với linh kiện thay thế phù hợp hơn.",
    priority: 90,
    isActive: true,
    hitCount: 0
  },
  {
    id: "rule-aud-02",
    scope: "BUILDER_AUDIT_CHAT",
    name: "Chỉ thị kiểm tra an toàn công suất nguồn (PSU)",
    matchType: "contains",
    pattern: "nguon co no khong, nguồn có nổ không, nguon du khong, nguồn đủ không, bao nhieu watt, bao nhiêu watt, co can thay nguon, có cần thay nguồn",
    action: "SYSTEM_INJECT",
    directReply: "",
    blockReason: "",
    promptInjection: "Hãy tính toán chi tiết tổng công suất tiêu thụ tối đa (Peak TDP) của cả dàn máy, so sánh với công suất định mức của PSU đã chọn, đánh giá độ dư an toàn (khuyến nghị dư tối thiểu 20-25%) và đưa ra kết luận rõ ràng.",
    priority: 85,
    isActive: true,
    hitCount: 0
  }
];

class AiRuleService {
  constructor() {
    this.store = null;
    this.loadStore();
  }

  loadStore() {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const data = fs.readFileSync(STORE_PATH, "utf-8");
        this.store = JSON.parse(data);
        if (!this.store.systemConfig) {
          this.store.systemConfig = { ...DEFAULT_SYSTEM_CONFIG };
        }
      } else {
        this.store = {
          rules: DEFAULT_RULES,
          prompts: DEFAULT_PROMPTS,
          systemConfig: { ...DEFAULT_SYSTEM_CONFIG },
          lastUpdated: new Date().toISOString()
        };
        this.saveStore();
      }
      // Đồng bộ cấu hình từ store sang UnifiedLlmService ngay khi khởi động
      try {
        const { unifiedLlmService } = require("./unified-llm.service");
        const sysCfg = this.store.systemConfig || {};
        const syncPayload = {
          provider: sysCfg.provider || "gemini",
          model: sysCfg.model || "gemini-3.5-flash-lite",
          temperature: Number(sysCfg.temperature ?? 0.35),
          maxTokens: Number(sysCfg.maxTokens || 2048)
        };
        if (this.store.apiKey) {
          syncPayload.apiKey = this.store.apiKey;
        }
        unifiedLlmService.configure(syncPayload);
      } catch (_syncErr) {}
    } catch (err) {
      console.warn("[AiRuleService] Failed to load store from disk, using defaults:", err.message);
      this.store = {
        rules: DEFAULT_RULES,
        prompts: DEFAULT_PROMPTS,
        systemConfig: { ...DEFAULT_SYSTEM_CONFIG },
        lastUpdated: new Date().toISOString()
      };
    }
  }

  saveStore() {
    try {
      const dir = path.dirname(STORE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.store.lastUpdated = new Date().toISOString();
      fs.writeFileSync(STORE_PATH, JSON.stringify(this.store, null, 2), "utf-8");
    } catch (err) {
      console.error("[AiRuleService] Failed to save store to disk:", err);
    }
  }

  getAllRules(query = {}) {
    let list = [...(this.store.rules || [])];
    if (query.scope && query.scope !== "ALL") {
      list = list.filter((r) => r.scope === query.scope || r.scope === "GLOBAL");
    }
    if (query.action && query.action !== "ALL") {
      list = list.filter((r) => r.action === query.action);
    }
    if (query.search) {
      const s = normalizeVietnamese(query.search);
      list = list.filter(
        (r) =>
          normalizeVietnamese(r.name).includes(s) ||
          normalizeVietnamese(r.pattern).includes(s)
      );
    }
    // Sắp xếp theo thứ tự ưu tiên cao đến thấp
    return list.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  getRuleById(id) {
    return (this.store.rules || []).find((r) => r.id === id) || null;
  }

  createRule(payload) {
    const newRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      scope: payload.scope || "GENERAL_CHAT",
      name: payload.name || "Quy tắc mới",
      matchType: payload.matchType || "contains",
      pattern: payload.pattern || "",
      action: payload.action || "DIRECT_REPLY",
      directReply: payload.directReply || "",
      blockReason: payload.blockReason || "",
      promptInjection: payload.promptInjection || "",
      priority: Number(payload.priority || 50),
      isActive: payload.isActive !== false,
      hitCount: 0,
      createdAt: new Date().toISOString()
    };
    this.store.rules.push(newRule);
    this.saveStore();
    return newRule;
  }

  updateRule(id, payload) {
    const index = (this.store.rules || []).findIndex((r) => r.id === id);
    if (index === -1) return null;

    const existing = this.store.rules[index];
    const updated = {
      ...existing,
      ...payload,
      priority: payload.priority !== undefined ? Number(payload.priority) : existing.priority,
      updatedAt: new Date().toISOString()
    };
    this.store.rules[index] = updated;
    this.saveStore();
    return updated;
  }

  deleteRule(id) {
    const beforeCount = (this.store.rules || []).length;
    this.store.rules = (this.store.rules || []).filter((r) => r.id !== id);
    if (this.store.rules.length !== beforeCount) {
      this.saveStore();
      return true;
    }
    return false;
  }

  toggleRule(id) {
    const rule = this.getRuleById(id);
    if (!rule) return null;
    rule.isActive = !rule.isActive;
    this.saveStore();
    return rule;
  }

  getPrompts() {
    return this.store.prompts || DEFAULT_PROMPTS;
  }

  getPromptByScope(scope) {
    const prompts = this.getPrompts();
    return prompts[scope] || DEFAULT_PROMPTS[scope] || null;
  }

  updatePrompt(scope, payload) {
    if (!this.store.prompts) this.store.prompts = { ...DEFAULT_PROMPTS };
    const current = this.store.prompts[scope] || DEFAULT_PROMPTS[scope] || {};
    this.store.prompts[scope] = {
      ...current,
      ...payload,
      scope,
      updatedAt: new Date().toISOString()
    };
    this.saveStore();
    return this.store.prompts[scope];
  }

  /**
   * Lấy cấu hình hệ thống AI tập trung (Provider, Model, Output Tokens, v.v.)
   * Khóa API nhạy cảm được che mờ (masked) để bảo vệ tuyệt đối trên màn hình.
   */
  getSystemConfig() {
    const cfg = this.store?.systemConfig || { ...DEFAULT_SYSTEM_CONFIG };
    const rawKey = this.store?.apiKey || process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || "";
    let maskedKey = "";
    if (rawKey) {
      maskedKey = rawKey.length > 8 ? `${rawKey.slice(0, 4)}••••••••${rawKey.slice(-4)}` : "••••••••";
    }
    return {
      provider: cfg.provider || "gemini",
      model: cfg.model || "gemini-1.5-flash",
      temperature: Number(cfg.temperature ?? 0.4),
      maxTokens: Number(cfg.maxTokens ?? 2048),
      maxCatalogProducts: Number(cfg.maxCatalogProducts ?? 35),
      retrievalMode: cfg.retrievalMode || "keyword_and_category",
      apiKeyMasked: maskedKey,
      hasApiKey: Boolean(rawKey)
    };
  }

  /**
   * Cập nhật cấu hình hệ thống AI từ trang Quản trị Admin.
   * Nếu người dùng nhập key mới (không chứa ký tự che mờ '••'), lưu trữ an toàn và nạp vào runtime.
   */
  updateSystemConfig(newConfig = {}) {
    if (!this.store.systemConfig) {
      this.store.systemConfig = { ...DEFAULT_SYSTEM_CONFIG };
    }
    if (newConfig.provider) this.store.systemConfig.provider = String(newConfig.provider).trim();
    if (newConfig.model) this.store.systemConfig.model = String(newConfig.model).trim();
    if (newConfig.temperature !== undefined) {
      this.store.systemConfig.temperature = Math.max(0.1, Math.min(1.0, Number(newConfig.temperature)));
    }
    if (newConfig.maxTokens !== undefined) {
      this.store.systemConfig.maxTokens = Math.max(256, Math.min(8192, Number(newConfig.maxTokens)));
    }
    if (newConfig.maxCatalogProducts !== undefined) {
      this.store.systemConfig.maxCatalogProducts = Math.max(10, Math.min(100, Number(newConfig.maxCatalogProducts)));
    }
    if (newConfig.retrievalMode) {
      this.store.systemConfig.retrievalMode = String(newConfig.retrievalMode).trim();
    }

    if (newConfig.apiKey && typeof newConfig.apiKey === "string" && !newConfig.apiKey.includes("••")) {
      const trimmed = newConfig.apiKey.trim();
      if (trimmed) {
        this.store.apiKey = trimmed;
        process.env.GEMINI_API_KEY = trimmed;
        process.env.LLM_API_KEY = trimmed;
      }
    }

    this.saveStore();

    try {
      const { unifiedLlmService } = require("./unified-llm.service");
      unifiedLlmService.configure({
        provider: this.store.systemConfig.provider,
        model: this.store.systemConfig.model,
        temperature: this.store.systemConfig.temperature,
        maxTokens: this.store.systemConfig.maxTokens,
        ...(this.store.apiKey ? { apiKey: this.store.apiKey } : {})
      });
    } catch (_) {}

    return this.getSystemConfig();
  }

  /**
   * Phân tích và dự toán token đầu vào & đầu ra cho LLM khi gửi danh mục sản phẩm kho hàng.
   * So sánh định dạng dòng nén (Compact TSV/Markdown) vs JSON phân cấp (Raw JSON).
   */
  getTokenEstimation(productCount = 100) {
    const pCount = Math.max(1, Math.min(200, Number(productCount || 100)));
    const compactPerItem = 28;
    const jsonPerItem = 95;
    const baseSystemPrompt = 950;
    const userAndHistory = 350;

    const compactInputTokens = Math.round(baseSystemPrompt + userAndHistory + (pCount * compactPerItem));
    const jsonInputTokens = Math.round(baseSystemPrompt + userAndHistory + (pCount * jsonPerItem));
    const maxOutputTokens = Number(this.store?.systemConfig?.maxTokens || 2048);

    return {
      productCount: pCount,
      compactFormat: {
        tokensPerProduct: compactPerItem,
        estimatedTotalInputTokens: compactInputTokens,
        costPer1kQueriesUsd: ((compactInputTokens * 0.075) / 1000).toFixed(4),
        recommended: true,
        note: "Định dạng dòng nén (Mã, Tên, Giá, Tồn kho, Specs chính). Tiết kiệm ~70% token, chống nhiễu context."
      },
      rawJsonFormat: {
        tokensPerProduct: jsonPerItem,
        estimatedTotalInputTokens: jsonInputTokens,
        costPer1kQueriesUsd: ((jsonInputTokens * 0.075) / 1000).toFixed(4),
        recommended: false,
        note: "Định dạng JSON phân cấp. Tốn gấp 3.5 lần token và có nguy cơ Lost-in-the-middle."
      },
      currentOutputConfig: {
        maxOutputTokens,
        estimatedWords: Math.round(maxOutputTokens * 0.75),
        description: "Giới hạn độ dài sinh câu trả lời của LLM. Mức 2048 token đủ cho 1.200 - 1.500 từ tiếng Việt."
      }
    };
  }

  /**
   * Đánh giá đầu vào của người dùng theo tập quy tắc của từng Chức Năng (Scope).
   * @param {string} scope 'GENERAL_CHAT' | 'BUILDER_SUGGEST' | 'BUILDER_AUDIT_CHAT'
   * @param {string} rawText Câu hỏi của người dùng
   * @param {object} extraData Dữ liệu phụ trợ (ví dụ: budget, buildItems)
   * @returns {{ handled: boolean, action: string, reply?: string, reason?: string, promptInjections?: string[], matchedRule?: object }}
   */
  evaluateInput(scope, rawText = "", extraData = {}) {
    const text = String(rawText || "").trim();
    const normalizedText = normalizeVietnamese(text);
    const cleanedText = cleanSearchText(text);
    const rules = this.getAllRules({ scope }).filter((r) => r.isActive);

    const promptInjections = [];
    const matchedInjectRules = [];

    for (const rule of rules) {
      let isMatch = false;

      // 1. Khớp theo kiểu Ngân sách (budget_threshold)
      if (rule.matchType === "budget_threshold") {
        const budget = Number(extraData.budget || extraData.targetBudget || 0);
        if (budget > 0 && rule.pattern) {
          const trimmedPat = rule.pattern.trim();
          if (trimmedPat.startsWith("<")) {
            const limit = Number(trimmedPat.replace("<", "").trim());
            if (budget < limit) isMatch = true;
          } else if (trimmedPat.startsWith(">")) {
            const limit = Number(trimmedPat.replace(">", "").trim());
            if (budget > limit) isMatch = true;
          }
        }
      }

      // 2. Khớp theo Regular Expression (regex)
      else if (rule.matchType === "regex" && rule.pattern) {
        try {
          // Bỏ qua wildcard '.*' nếu không có injection
          const reg = new RegExp(rule.pattern, "i");
          if (reg.test(text) || reg.test(normalizedText) || reg.test(cleanedText)) {
            isMatch = true;
          }
        } catch (_e) {
          // Ignore invalid regex
        }
      }

      // 3. Khớp theo danh sách từ khóa (contains)
      else if (rule.matchType === "contains" && rule.pattern) {
        const rawKeywords = rule.pattern
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);
        isMatch = rawKeywords.some((kw) => {
          const normKw = normalizeVietnamese(kw);
          const cleanKw = cleanSearchText(kw);
          return (
            normalizedText.includes(normKw) ||
            cleanedText.includes(cleanKw) ||
            text.toLowerCase().includes(kw.toLowerCase())
          );
        });
      }

      // 4. Khớp chính xác (exact)
      else if (rule.matchType === "exact" && rule.pattern) {
        const targetNorm = normalizeVietnamese(rule.pattern.trim());
        const targetClean = cleanSearchText(rule.pattern.trim());
        isMatch =
          normalizedText === targetNorm ||
          cleanedText === targetClean ||
          text.toLowerCase() === rule.pattern.trim().toLowerCase();
      }

      if (isMatch) {
        // Tăng đếm hit count
        rule.hitCount = (rule.hitCount || 0) + 1;
        this.saveStore();

        // Nếu là DIRECT_REPLY -> Trả lời tại chỗ ngay lập tức (Bypass AI)
        if (rule.action === "DIRECT_REPLY") {
          return {
            handled: true,
            action: "DIRECT_REPLY",
            reply: rule.directReply,
            ruleId: rule.id,
            ruleName: rule.name,
            model: "system-local-faq",
            hitType: "LOCAL_BYPASS"
          };
        }

        // Nếu là BLOCK -> Chặn ngay lập tức
        if (rule.action === "BLOCK") {
          return {
            handled: true,
            action: "BLOCK",
            reply: rule.blockReason || "Yêu cầu của bạn không nằm trong phạm vi hỗ trợ của hệ thống.",
            ruleId: rule.id,
            ruleName: rule.name,
            model: "system-guardrail-filter",
            hitType: "BLOCKED"
          };
        }

        // Nếu là SYSTEM_INJECT -> Thu thập chỉ thị để ghép vào prompt cho LLM
        if (rule.action === "SYSTEM_INJECT" && rule.promptInjection) {
          promptInjections.push(rule.promptInjection);
          matchedInjectRules.push({ id: rule.id, name: rule.name });
        }
      }
    }

    return {
      handled: false,
      action: matchedInjectRules.length > 0 ? "SYSTEM_INJECT" : "PASS_THROUGH",
      ruleId: matchedInjectRules.map((r) => r.id).join(", ") || undefined,
      ruleName: matchedInjectRules.map((r) => r.name).join(" + ") || undefined,
      matchedRules: matchedInjectRules,
      promptInjections,
      model: this.store?.systemConfig?.model || "gemini-1.5-flash"
    };
  }
}

const aiRuleService = new AiRuleService();

module.exports = {
  aiRuleService,
  AiRuleService
};
