/**
 * 🚀 SEED COMPREHENSIVE COMPATIBILITY RULES
 * Bổ sung đầy đủ hệ thống quy tắc tương thích linh kiện PC chuẩn kỹ thuật (35+ rules).
 * Tích hợp cả 2 cơ chế:
 *   1. Category + Attribute Key Rules (phục vụ Admin, Tech Staff & PC Builder Engine)
 *   2. Attribute Value Pair Rules (phục vụ /compatibility/builds/:id engine)
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function seedComprehensiveRules() {
  console.log("═════════════════════════════════════════════════════════════════");
  console.log("🛠️  BẮT ĐẦU SEED HỆ THỐNG QUY TẮC TƯƠNG THÍCH LINH KIỆN PC");
  console.log("═════════════════════════════════════════════════════════════════\n");

  // Xóa sạch các rule cũ để nạp lại bộ chuẩn hóa 100%
  await prisma.compatibilityRule.deleteMany({});
  console.log("🧹 Đã làm sạch các rules cũ trong database.");

  // Helper tìm attribute value ID
  async function getValId(attrName, valStr) {
    const attr = await prisma.attribute.findFirst({
      where: { name: { equals: attrName } }
    });
    if (!attr) return null;
    const val = await prisma.attributeValue.findFirst({
      where: { attribute_id: attr.id, value: { equals: valStr } }
    });
    return val?.id || null;
  }

  // Lấy trước các ID thuộc tính quan trọng
  const socket1700 = await getValId("socket", "LGA1700");
  const socketAM5  = await getValId("socket", "AM5");
  const socketAM4  = await getValId("socket", "AM4");
  const socket1200 = await getValId("socket", "LGA1200");
  const socket1851 = await getValId("socket", "LGA1851");

  const ramDDR5    = await getValId("ram_type", "DDR5");
  const ramDDR4    = await getValId("ram_type", "DDR4");

  const formATX    = await getValId("form_factor", "ATX");
  const formMATX   = await getValId("form_factor", "mATX");
  const formITX    = await getValId("form_factor", "ITX");

  const psu550     = await getValId("psu_wattage", "550W");
  const psu650     = await getValId("psu_wattage", "650W");
  const psu750     = await getValId("psu_wattage", "750W");
  const psu850     = await getValId("psu_wattage", "850W");

  const radSupport240 = await getValId("case_radiator_support", "240mm");
  const radSupport360 = await getValId("case_radiator_support", "360mm");
  const radSupport120 = await getValId("case_radiator_support", "120mm");

  const radSize240 = await getValId("radiator_size", "240mm");
  const radSize360 = await getValId("radiator_size", "360mm");

  const coolerMultiSocket = await getValId("socket_support", "LGA1700, AM5, AM4, LGA1200");
  const coolerModernSocket = await getValId("socket_support", "LGA1700, AM5, AM4");

  // Danh mục: 1:CPU, 2:MAINBOARD, 3:RAM, 4:GPU, 5:STORAGE, 6:PSU, 7:CASE, 8:COOLING
  const rules = [
    // ══════════════════════════════════════════════════════════════════════════
    // NHÓM 1: CPU (1) ↔ MAINBOARD (2) — SOCKET TƯƠNG THÍCH
    // ══════════════════════════════════════════════════════════════════════════
    {
      name: "CPU LGA1700 ↔ Mainboard LGA1700",
      source_category_id: 1, target_category_id: 2,
      source_attribute_key: "socket", target_attribute_key: "socket",
      operator: "EQ", is_compatible: true,
      attribute_value_1: socket1700, attribute_value_2: socket1700,
      description: "CPU Intel LGA1700 (Gen 12/13/14) tương thích hoàn toàn với Mainboard socket LGA1700 (H610, B760, Z790)."
    },
    {
      name: "CPU AM5 ↔ Mainboard AM5",
      source_category_id: 1, target_category_id: 2,
      source_attribute_key: "socket", target_attribute_key: "socket",
      operator: "EQ", is_compatible: true,
      attribute_value_1: socketAM5, attribute_value_2: socketAM5,
      description: "CPU AMD Ryzen AM5 (Series 7000/8000/9000) tương thích với Mainboard AM5 (A620, B650, X670, X870)."
    },
    {
      name: "CPU AM4 ↔ Mainboard AM4",
      source_category_id: 1, target_category_id: 2,
      source_attribute_key: "socket", target_attribute_key: "socket",
      operator: "EQ", is_compatible: true,
      attribute_value_1: socketAM4, attribute_value_2: socketAM4,
      description: "CPU AMD Ryzen AM4 (Series 3000/5000) tương thích với Mainboard AM4 (A520, B450, B550, X570)."
    },
    {
      name: "CPU LGA1851 ↔ Mainboard LGA1851",
      source_category_id: 1, target_category_id: 2,
      source_attribute_key: "socket", target_attribute_key: "socket",
      operator: "EQ", is_compatible: true,
      attribute_value_1: socket1851, attribute_value_2: socket1851,
      description: "CPU Intel Core Ultra LGA1851 (Series 2 / Arrow Lake) tương thích với Mainboard Z890, B860."
    },
    {
      name: "CPU LGA1200 ↔ Mainboard LGA1200",
      source_category_id: 1, target_category_id: 2,
      source_attribute_key: "socket", target_attribute_key: "socket",
      operator: "EQ", is_compatible: true,
      attribute_value_1: socket1200, attribute_value_2: socket1200,
      description: "CPU Intel Gen 10/11 socket LGA1200 tương thích với Mainboard H410, B460, B560, Z490, Z590."
    },
    // Xung đột Socket
    {
      name: "CPU LGA1700 ↔ Mainboard AM5 (Khác hãng)",
      source_category_id: 1, target_category_id: 2,
      source_attribute_key: "socket", target_attribute_key: "socket",
      operator: "NEQ", is_compatible: false,
      attribute_value_1: socket1700, attribute_value_2: socketAM5,
      description: "KHÔNG TƯƠNG THÍCH: CPU Intel socket LGA1700 không thể lắp vào bo mạch chủ AMD socket AM5."
    },
    {
      name: "CPU LGA1700 ↔ Mainboard AM4 (Khác hãng)",
      source_category_id: 1, target_category_id: 2,
      source_attribute_key: "socket", target_attribute_key: "socket",
      operator: "NEQ", is_compatible: false,
      attribute_value_1: socket1700, attribute_value_2: socketAM4,
      description: "KHÔNG TƯƠNG THÍCH: CPU Intel socket LGA1700 không thể lắp vào bo mạch chủ AMD socket AM4."
    },
    {
      name: "CPU LGA1700 ↔ Mainboard LGA1200 (Khác thế hệ)",
      source_category_id: 1, target_category_id: 2,
      source_attribute_key: "socket", target_attribute_key: "socket",
      operator: "NEQ", is_compatible: false,
      attribute_value_1: socket1700, attribute_value_2: socket1200,
      description: "KHÔNG TƯƠNG THÍCH: CPU Intel Gen 12/13/14 (LGA1700) không tương thích chân cắm với Mainboard LGA1200."
    },
    {
      name: "CPU AM5 ↔ Mainboard AM4 (Khác thế hệ AMD)",
      source_category_id: 1, target_category_id: 2,
      source_attribute_key: "socket", target_attribute_key: "socket",
      operator: "NEQ", is_compatible: false,
      attribute_value_1: socketAM5, attribute_value_2: socketAM4,
      description: "KHÔNG TƯƠNG THÍCH: CPU AMD AM5 (DDR5) dùng socket LGA không thể cắm vào Mainboard AM4 dùng socket PGA."
    },
    {
      name: "CPU AM5 ↔ Mainboard LGA1700 (Khác hãng)",
      source_category_id: 1, target_category_id: 2,
      source_attribute_key: "socket", target_attribute_key: "socket",
      operator: "NEQ", is_compatible: false,
      attribute_value_1: socketAM5, attribute_value_2: socket1700,
      description: "KHÔNG TƯƠNG THÍCH: CPU AMD Ryzen AM5 không thể lắp vào bo mạch chủ Intel LGA1700."
    },
    {
      name: "CPU LGA1851 ↔ Mainboard LGA1700 (Khác thế hệ)",
      source_category_id: 1, target_category_id: 2,
      source_attribute_key: "socket", target_attribute_key: "socket",
      operator: "NEQ", is_compatible: false,
      attribute_value_1: socket1851, attribute_value_2: socket1700,
      description: "KHÔNG TƯƠNG THÍCH: CPU Intel Arrow Lake LGA1851 không tương thích với Mainboard LGA1700."
    },

    // ══════════════════════════════════════════════════════════════════════════
    // NHÓM 2: RAM (3) ↔ MAINBOARD (2) — CHUẨN BỘ NHỚ RAM TYPE
    // ══════════════════════════════════════════════════════════════════════════
    {
      name: "RAM DDR5 ↔ Mainboard DDR5",
      source_category_id: 3, target_category_id: 2,
      source_attribute_key: "ram_type", target_attribute_key: "ram_type",
      operator: "EQ", is_compatible: true,
      attribute_value_1: ramDDR5, attribute_value_2: ramDDR5,
      description: "RAM DDR5 tương thích hoàn toàn với Mainboard hỗ trợ khe cắm DDR5 (B760 D5, Z790, B650, X670)."
    },
    {
      name: "RAM DDR4 ↔ Mainboard DDR4",
      source_category_id: 3, target_category_id: 2,
      source_attribute_key: "ram_type", target_attribute_key: "ram_type",
      operator: "EQ", is_compatible: true,
      attribute_value_1: ramDDR4, attribute_value_2: ramDDR4,
      description: "RAM DDR4 tương thích hoàn toàn với Mainboard hỗ trợ khe cắm DDR4 (H610, B760 D4, B550, A520)."
    },
    {
      name: "RAM DDR5 ↔ Mainboard DDR4 (Lệch chân cắm)",
      source_category_id: 3, target_category_id: 2,
      source_attribute_key: "ram_type", target_attribute_key: "ram_type",
      operator: "NEQ", is_compatible: false,
      attribute_value_1: ramDDR5, attribute_value_2: ramDDR4,
      description: "KHÔNG TƯƠNG THÍCH: RAM DDR5 không thể cắm vào khe RAM DDR4 (chân cắm và rãnh khóa vị trí khác nhau)."
    },
    {
      name: "RAM DDR4 ↔ Mainboard DDR5 (Lệch chân cắm)",
      source_category_id: 3, target_category_id: 2,
      source_attribute_key: "ram_type", target_attribute_key: "ram_type",
      operator: "NEQ", is_compatible: false,
      attribute_value_1: ramDDR4, attribute_value_2: ramDDR5,
      description: "KHÔNG TƯƠNG THÍCH: RAM DDR4 không thể cắm vào bo mạch chủ chuẩn DDR5."
    },

    // ══════════════════════════════════════════════════════════════════════════
    // NHÓM 3: MAINBOARD (2) ↔ CASE (7) — KÍCH THƯỚC FORM FACTOR
    // ══════════════════════════════════════════════════════════════════════════
    {
      name: "Mainboard ATX ↔ Case ATX",
      source_category_id: 2, target_category_id: 7,
      source_attribute_key: "form_factor", target_attribute_key: "form_factor",
      operator: "EQ", is_compatible: true,
      attribute_value_1: formATX, attribute_value_2: formATX,
      description: "Mainboard chuẩn ATX vừa vặn hoàn hảo trong thùng máy Mid-Tower hoặc Full-Tower chuẩn ATX."
    },
    {
      name: "Mainboard mATX ↔ Case mATX",
      source_category_id: 2, target_category_id: 7,
      source_attribute_key: "form_factor", target_attribute_key: "form_factor",
      operator: "EQ", is_compatible: true,
      attribute_value_1: formMATX, attribute_value_2: formMATX,
      description: "Mainboard kích thước Micro-ATX (mATX) lắp vừa vặn trong thùng máy chuẩn mATX."
    },
    {
      name: "Mainboard ITX ↔ Case ITX",
      source_category_id: 2, target_category_id: 7,
      source_attribute_key: "form_factor", target_attribute_key: "form_factor",
      operator: "EQ", is_compatible: true,
      attribute_value_1: formITX, attribute_value_2: formITX,
      description: "Mainboard chuẩn Mini-ITX tương thích với thùng máy ITX nhỏ gọn."
    },
    {
      name: "Mainboard mATX ↔ Case ATX (Case lớn hỗ trợ main nhỏ)",
      source_category_id: 2, target_category_id: 7,
      source_attribute_key: "form_factor", target_attribute_key: "form_factor",
      operator: "LTE", is_compatible: true,
      attribute_value_1: formMATX, attribute_value_2: formATX,
      description: "TƯƠNG THÍCH TỐT: Thùng máy ATX rộng rãi luôn có sẵn lỗ ốc tương thích gắn vừa bo mạch mATX."
    },
    {
      name: "Mainboard ITX ↔ Case ATX (Case lớn hỗ trợ main nhỏ)",
      source_category_id: 2, target_category_id: 7,
      source_attribute_key: "form_factor", target_attribute_key: "form_factor",
      operator: "LTE", is_compatible: true,
      attribute_value_1: formITX, attribute_value_2: formATX,
      description: "TƯƠNG THÍCH TỐT: Thùng máy ATX lắp vừa vặn bo mạch chủ Mini-ITX."
    },
    {
      name: "Mainboard ITX ↔ Case mATX (Case mATX hỗ trợ main ITX)",
      source_category_id: 2, target_category_id: 7,
      source_attribute_key: "form_factor", target_attribute_key: "form_factor",
      operator: "LTE", is_compatible: true,
      attribute_value_1: formITX, attribute_value_2: formMATX,
      description: "TƯƠNG THÍCH TỐT: Thùng máy mATX hỗ trợ lắp đặt bo mạch Mini-ITX."
    },
    {
      name: "Mainboard ATX ↔ Case mATX (Main quá to)",
      source_category_id: 2, target_category_id: 7,
      source_attribute_key: "form_factor", target_attribute_key: "form_factor",
      operator: "GTE", is_compatible: false,
      attribute_value_1: formATX, attribute_value_2: formMATX,
      description: "KHÔNG TƯƠNG THÍCH: Bo mạch chủ ATX (305x244mm) quá dài không thể lắp vào thùng máy Micro-ATX (tối đa 244x244mm)."
    },
    {
      name: "Mainboard ATX ↔ Case ITX (Main quá to)",
      source_category_id: 2, target_category_id: 7,
      source_attribute_key: "form_factor", target_attribute_key: "form_factor",
      operator: "GTE", is_compatible: false,
      attribute_value_1: formATX, attribute_value_2: formITX,
      description: "KHÔNG TƯƠNG THÍCH: Bo mạch chủ ATX hoàn toàn không thể lắp vào thùng máy nhỏ Mini-ITX."
    },
    {
      name: "Mainboard mATX ↔ Case ITX (Main quá to)",
      source_category_id: 2, target_category_id: 7,
      source_attribute_key: "form_factor", target_attribute_key: "form_factor",
      operator: "GTE", is_compatible: false,
      attribute_value_1: formMATX, attribute_value_2: formITX,
      description: "KHÔNG TƯƠNG THÍCH: Bo mạch chủ Micro-ATX không thể lắp vào thùng máy kích thước Mini-ITX."
    },

    // ══════════════════════════════════════════════════════════════════════════
    // NHÓM 4: COOLING (8) ↔ CPU (1) — SOCKET HỖ TRỢ & HIỆU NĂNG TẢN
    // ══════════════════════════════════════════════════════════════════════════
    {
      name: "Tản nhiệt Đa Socket ↔ CPU LGA1700",
      source_category_id: 8, target_category_id: 1,
      source_attribute_key: "socket_support", target_attribute_key: "socket",
      operator: "EQ", is_compatible: true,
      attribute_value_1: coolerMultiSocket, attribute_value_2: socket1700,
      description: "Tản nhiệt hỗ trợ kèm ngàm LGA1700 lắp đặt hoàn hảo cho CPU Intel Gen 12/13/14."
    },
    {
      name: "Tản nhiệt Đa Socket ↔ CPU AM5",
      source_category_id: 8, target_category_id: 1,
      source_attribute_key: "socket_support", target_attribute_key: "socket",
      operator: "EQ", is_compatible: true,
      attribute_value_1: coolerMultiSocket, attribute_value_2: socketAM5,
      description: "Tản nhiệt hỗ trợ ngàm AM5 tương thích tốt với dòng chip AMD Ryzen 7000/8000/9000."
    },
    {
      name: "Tản nhiệt Đa Socket ↔ CPU AM4",
      source_category_id: 8, target_category_id: 1,
      source_attribute_key: "socket_support", target_attribute_key: "socket",
      operator: "EQ", is_compatible: true,
      attribute_value_1: coolerMultiSocket, attribute_value_2: socketAM4,
      description: "Tản nhiệt hỗ trợ ngàm AM4 lắp đặt tương thích với CPU AMD Ryzen 3000/5000."
    },
    {
      name: "Tản nhiệt Hiện đại ↔ CPU LGA1700",
      source_category_id: 8, target_category_id: 1,
      source_attribute_key: "socket_support", target_attribute_key: "socket",
      operator: "EQ", is_compatible: true,
      attribute_value_1: coolerModernSocket, attribute_value_2: socket1700,
      description: "Tản nhiệt có ngàm LGA1700/AM5/AM4 lắp đặt chuẩn xác với CPU Intel LGA1700."
    },
    {
      name: "Tản nhiệt Hiện đại ↔ CPU AM5",
      source_category_id: 8, target_category_id: 1,
      source_attribute_key: "socket_support", target_attribute_key: "socket",
      operator: "EQ", is_compatible: true,
      attribute_value_1: coolerModernSocket, attribute_value_2: socketAM5,
      description: "Tản nhiệt hỗ trợ ngàm AM5/AM4 lắp đặt chuẩn xác với CPU AMD AM5."
    },

    // ══════════════════════════════════════════════════════════════════════════
    // NHÓM 5: COOLING (8) ↔ CASE (7) — KÍCH THƯỚC RADIATOR KÉT NƯỚC
    // ══════════════════════════════════════════════════════════════════════════
    {
      name: "Tản AIO 360mm ↔ Case hỗ trợ Radiator 360mm",
      source_category_id: 8, target_category_id: 7,
      source_attribute_key: "radiator_size", target_attribute_key: "case_radiator_support",
      operator: "LTE", is_compatible: true,
      attribute_value_1: radSize360, attribute_value_2: radSupport360,
      description: "Tản nhiệt nước AIO 360mm (3 quạt 120mm) lắp vừa khít nóc/mặt trước thùng máy hỗ trợ 360mm."
    },
    {
      name: "Tản AIO 240mm ↔ Case hỗ trợ Radiator 240mm",
      source_category_id: 8, target_category_id: 7,
      source_attribute_key: "radiator_size", target_attribute_key: "case_radiator_support",
      operator: "LTE", is_compatible: true,
      attribute_value_1: radSize240, attribute_value_2: radSupport240,
      description: "Tản nhiệt nước AIO 240mm lắp đặt vừa vặn trong khoang tản nhiệt 240mm của case."
    },
    {
      name: "Tản AIO 240mm ↔ Case hỗ trợ Radiator 360mm (Case lớn gắn tản nhỏ)",
      source_category_id: 8, target_category_id: 7,
      source_attribute_key: "radiator_size", target_attribute_key: "case_radiator_support",
      operator: "LTE", is_compatible: true,
      attribute_value_1: radSize240, attribute_value_2: radSupport360,
      description: "TƯƠNG THÍCH TỐT: Thùng máy hỗ trợ Radiator 360mm luôn có khoang lắp vừa vặn tản AIO 240mm."
    },
    {
      name: "Tản AIO 360mm ↔ Case chỉ hỗ trợ Radiator 240mm (Két nước quá dài)",
      source_category_id: 8, target_category_id: 7,
      source_attribute_key: "radiator_size", target_attribute_key: "case_radiator_support",
      operator: "GTE", is_compatible: false,
      attribute_value_1: radSize360, attribute_value_2: radSupport240,
      description: "KHÔNG TƯƠNG THÍCH: Két nước tản AIO 360mm quá dài (gần 400mm cả đầu tank), thùng máy chỉ hỗ trợ 240mm không thể gắn vừa."
    },
    {
      name: "Tản AIO 360mm ↔ Case chỉ hỗ trợ Radiator 120mm (Két nước quá dài)",
      source_category_id: 8, target_category_id: 7,
      source_attribute_key: "radiator_size", target_attribute_key: "case_radiator_support",
      operator: "GTE", is_compatible: false,
      attribute_value_1: radSize360, attribute_value_2: radSupport120,
      description: "KHÔNG TƯƠNG THÍCH: Thùng máy mini 120mm hoàn toàn không có không gian lắp đặt tản nước AIO 360mm."
    },

    // ══════════════════════════════════════════════════════════════════════════
    // NHÓM 6: PSU (6) ↔ GPU (4) — CÔNG SUẤT NGUỒN CẤP ĐIỆN
    // ══════════════════════════════════════════════════════════════════════════
    {
      name: "Nguồn 650W+ ↔ VGA RTX 3050 / RTX 3060 / RTX 4060",
      source_category_id: 6, target_category_id: 4,
      source_attribute_key: "psu_wattage", target_attribute_key: "tdp",
      operator: "GTE", is_compatible: true,
      attribute_value_1: psu650, attribute_value_2: null,
      description: "Bộ nguồn 650W chuẩn 80 Plus cung cấp điện năng dồi dào và an toàn cho card đồ họa tầm trung."
    },
    {
      name: "Nguồn 750W+ ↔ VGA RTX 4070 / RTX 4070 Ti",
      source_category_id: 6, target_category_id: 4,
      source_attribute_key: "psu_wattage", target_attribute_key: "tdp",
      operator: "GTE", is_compatible: true,
      attribute_value_1: psu750, attribute_value_2: null,
      description: "Bộ nguồn 750W Gold đáp ứng chuẩn khuyến cáo công suất cho các dòng card RTX 4070 / 4070 Ti."
    },
    {
      name: "Nguồn 850W+ ↔ VGA RTX 4080 / RTX 4090",
      source_category_id: 6, target_category_id: 4,
      source_attribute_key: "psu_wattage", target_attribute_key: "tdp",
      operator: "GTE", is_compatible: true,
      attribute_value_1: psu850, attribute_value_2: null,
      description: "Bộ nguồn 850W - 1000W chuẩn PCIe 5.0 (12VHPWR) đảm bảo vận hành ổn định cho card đồ họa phân khúc High-End."
    },
    {
      name: "Nguồn 550W ↔ VGA Cao cấp TDP > 220W (Thiếu nguồn)",
      source_category_id: 6, target_category_id: 4,
      source_attribute_key: "psu_wattage", target_attribute_key: "tdp",
      operator: "LTE", is_compatible: false,
      attribute_value_1: psu550, attribute_value_2: null,
      description: "CẢNH BÁO QUÁ TẢI: Nguồn 550W không đủ đáp ứng công suất cho các dòng card cao cấp (RTX 4070 Ti, 4080, 4090), có nguy cơ sập nguồn khi tải nặng."
    },

    // ══════════════════════════════════════════════════════════════════════════
    // NHÓM 7: STORAGE (5) ↔ MAINBOARD (2) — GIAO TIẾP Ổ CỨNG M.2 & SATA
    // ══════════════════════════════════════════════════════════════════════════
    {
      name: "SSD M.2 NVMe PCIe 4.0 ↔ Mainboard Khe M.2",
      source_category_id: 5, target_category_id: 2,
      source_attribute_key: "interface", target_attribute_key: "m2_slots",
      operator: "EQ", is_compatible: true,
      attribute_value_1: null, attribute_value_2: null,
      description: "Ổ cứng SSD M.2 NVMe PCIe 4.0 x4 tương thích tốc độ cao với các khe cắm M.2 trên toàn bộ bo mạch chủ hiện đại."
    },
    {
      name: "SSD SATA 2.5 inch ↔ Mainboard Cổng SATA III",
      source_category_id: 5, target_category_id: 2,
      source_attribute_key: "interface", target_attribute_key: "sata_ports",
      operator: "EQ", is_compatible: true,
      attribute_value_1: null, attribute_value_2: null,
      description: "Ổ cứng SSD SATA chuẩn 2.5 inch cắm qua cáp SATA tương thích 100% với cổng SATA 6Gb/s của Mainboard."
    }
  ];

  let createdCount = 0;
  for (const r of rules) {
    await prisma.compatibilityRule.create({
      data: {
        name: r.name,
        source_category_id: r.source_category_id,
        target_category_id: r.target_category_id,
        source_attribute_key: r.source_attribute_key,
        target_attribute_key: r.target_attribute_key,
        operator: r.operator,
        is_compatible: r.is_compatible,
        attribute_value_1: r.attribute_value_1,
        attribute_value_2: r.attribute_value_2,
        description: r.description,
        status: "ACTIVE",
        is_active: true
      }
    });
    createdCount++;
  }

  console.log(`\n🎉 ĐÃ TẠO THÀNH CÔNG ${createdCount} QUY TẮC TƯƠNG THÍCH CHUẨN XÁC!`);

  const total = await prisma.compatibilityRule.count();
  const activeCount = await prisma.compatibilityRule.count({ where: { is_active: true } });
  const withCategoryCount = await prisma.compatibilityRule.count({
    where: {
      source_category_id: { not: null },
      target_category_id: { not: null }
    }
  });

  console.log(`\n📊 THỐNG KÊ QUY TẮC HIỆN TẠI TRONG DATABASE:`);
  console.log(`   - Tổng số quy tắc trong DB: ${total}`);
  console.log(`   - Số quy tắc đang kích hoạt (Active): ${activeCount}`);
  console.log(`   - Số quy tắc hiển thị trên trang Quản trị Admin/Tech: ${withCategoryCount}/${total}`);

  await prisma.$disconnect();
}

seedComprehensiveRules().catch(e => {
  console.error("Lỗi:", e);
  process.exit(1);
});
