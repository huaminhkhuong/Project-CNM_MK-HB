/**
 * 📦 EXPORT COMPREHENSIVE COMPATIBILITY RULES TO SQL SCRIPT & SEED DB
 * Bộ quy tắc tương thích linh kiện PC toàn diện (420+ rules chuẩn xác 100% kỹ thuật).
 * Xuất ra: docs/03-database/phase11_compatibility_rules_seed.sql
 * Đồng thời nạp thẳng vào cơ sở dữ liệu MySQL hiện tại.
 */

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function generateComprehensiveHardwareRules() {
  const rules = [];

  // =========================================================================
  // 1. CPU (1) ↔ MAINBOARD (2) — SOCKET (5x5 = 25 rules)
  // Các socket: LGA1851, LGA1700, LGA1200, AM5, AM4
  // =========================================================================
  const sockets = [
    { name: "LGA1851", desc: "Intel Arrow Lake Core Ultra Series 2" },
    { name: "LGA1700", desc: "Intel Gen 12/13/14 Raptor Lake / Alder Lake" },
    { name: "LGA1200", desc: "Intel Gen 10/11 Comet Lake / Rocket Lake" },
    { name: "AM5",     desc: "AMD Ryzen 7000/8000/9000 Series" },
    { name: "AM4",     desc: "AMD Ryzen 1000/2000/3000/4000/5000 Series" },
  ];

  for (const sCpu of sockets) {
    for (const sMb of sockets) {
      const isCompat = sCpu.name === sMb.name;
      rules.push({
        name: `CPU ${sCpu.name} ↔ Mainboard ${sMb.name}`,
        source_category_id: 1,
        target_category_id: 2,
        source_attribute_key: "socket",
        target_attribute_key: "socket",
        source_attr_name: "socket",
        source_val: sCpu.name,
        target_attr_name: "socket",
        target_val: sMb.name,
        operator: isCompat ? "EQ" : "NEQ",
        is_compatible: isCompat,
        description: isCompat
          ? `TƯƠNG THÍCH: CPU ${sCpu.name} (${sCpu.desc}) tương thích hoàn hảo với Mainboard chuẩn socket ${sMb.name}.`
          : `KHÔNG TƯƠNG THÍCH: CPU socket ${sCpu.name} không thể lắp vào bo mạch chủ socket ${sMb.name} do khác biệt cơ học và chân cắm.`
      });
    }
  }

  // =========================================================================
  // 2. RAM (3) ↔ MAINBOARD (2) — RAM TYPE (3x3 = 9 rules)
  // Các thế hệ RAM: DDR5, DDR4, DDR3
  // =========================================================================
  const ramTypes = ["DDR5", "DDR4", "DDR3"];
  for (const rRam of ramTypes) {
    for (const rMb of ramTypes) {
      const isCompat = rRam === rMb;
      rules.push({
        name: `RAM ${rRam} ↔ Mainboard ${rMb}`,
        source_category_id: 3,
        target_category_id: 2,
        source_attribute_key: "ram_type",
        target_attribute_key: "ram_type",
        source_attr_name: "ram_type",
        source_val: rRam,
        target_attr_name: "ram_type",
        target_val: rMb,
        operator: isCompat ? "EQ" : "NEQ",
        is_compatible: isCompat,
        description: isCompat
          ? `TƯƠNG THÍCH: Bộ nhớ RAM ${rRam} tương thích chuẩn với khe cắm ${rMb} trên bo mạch chủ.`
          : `KHÔNG TƯƠNG THÍCH: RAM ${rRam} có rãnh khóa (notch) và điện áp khác biệt, không thể cắm vào khe ${rMb}.`
      });
    }
  }

  // =========================================================================
  // 3. MAINBOARD (2) ↔ CASE (7) — FORM FACTOR (4x4 = 16 rules)
  // Các cỡ: E-ATX, ATX, mATX, ITX
  // Thứ tự kích cỡ: E-ATX (4) > ATX (3) > mATX (2) > ITX (1)
  // =========================================================================
  const formRanks = { "E-ATX": 4, "ATX": 3, "mATX": 2, "ITX": 1 };
  const formFactors = ["E-ATX", "ATX", "mATX", "ITX"];
  for (const fMb of formFactors) {
    for (const fCase of formFactors) {
      const isCompat = formRanks[fCase] >= formRanks[fMb];
      rules.push({
        name: `Mainboard ${fMb} ↔ Case ${fCase}`,
        source_category_id: 2,
        target_category_id: 7,
        source_attribute_key: "form_factor",
        target_attribute_key: "form_factor",
        source_attr_name: "form_factor",
        source_val: fMb,
        target_attr_name: "form_factor",
        target_val: fCase,
        operator: isCompat ? "LTE" : "GT",
        is_compatible: isCompat,
        description: isCompat
          ? `TƯƠNG THÍCH: Thùng máy ${fCase} đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ ${fMb}.`
          : `KHÔNG TƯƠNG THÍCH: Bo mạch chủ ${fMb} kích thước quá lớn, không thể lắp vào thùng máy nhỏ gọn chuẩn ${fCase}.`
      });
    }
  }

  // =========================================================================
  // 4. COOLING (8) ↔ CASE (7) — RADIATOR SIZE (5x5 = 25 rules)
  // Các cỡ rad: 120mm, 240mm, 280mm, 360mm, 420mm
  // =========================================================================
  const radSizes = [120, 240, 280, 360, 420];
  for (const rad of radSizes) {
    for (const caseRad of radSizes) {
      const isCompat = caseRad >= rad;
      rules.push({
        name: `Radiator AIO ${rad}mm ↔ Case hỗ trợ ${caseRad}mm`,
        source_category_id: 8,
        target_category_id: 7,
        source_attribute_key: "radiator_size",
        target_attribute_key: "case_radiator_support",
        source_attr_name: "radiator_size",
        source_val: `${rad}mm`,
        target_attr_name: "case_radiator_support",
        target_val: `${caseRad}mm`,
        operator: isCompat ? "LTE" : "GT",
        is_compatible: isCompat,
        description: isCompat
          ? `TƯƠNG THÍCH: Két nước tản AIO ${rad}mm lắp đặt vừa vặn với khoang hỗ trợ rad ${caseRad}mm của case.`
          : `KHÔNG TƯƠNG THÍCH: Két làm mát ${rad}mm quá dài, khoang case tối đa chỉ hỗ trợ ${caseRad}mm.`
      });
    }
  }

  // =========================================================================
  // 5. COOLING (8) ↔ CASE (7) — COOLER HEIGHT CLEARANCE (6x7 = 42 rules)
  // Tản khí cooler_height: 148, 154, 157, 160, 165, 170 mm
  // Case clearance: 148, 154, 155, 157, 160, 165, 170 mm
  // =========================================================================
  const coolerHeights = [148, 154, 157, 160, 165, 170];
  const caseClearances = [148, 154, 155, 157, 160, 165, 170];
  for (const h of coolerHeights) {
    for (const c of caseClearances) {
      const isCompat = c >= h;
      rules.push({
        name: `Tản khí ${h}mm ↔ Case giới hạn ${c}mm`,
        source_category_id: 8,
        target_category_id: 7,
        source_attribute_key: "cooler_height",
        target_attribute_key: "case_cooler_clearance",
        source_attr_name: "cooler_height",
        source_val: `${h}mm`,
        target_attr_name: "case_cooler_clearance",
        target_val: `${c}mm`,
        operator: isCompat ? "LTE" : "GT",
        is_compatible: isCompat,
        description: isCompat
          ? `TƯƠNG THÍCH: Chiều cao tản nhiệt khí ${h}mm nằm trong giới hạn cho phép ${c}mm của nắp hông case.`
          : `KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao ${h}mm sẽ bị cấn nắp kính hông case (giới hạn tối đa ${c}mm).`
      });
    }
  }

  // =========================================================================
  // 6. COOLING (8) ↔ CPU (1) — THERMAL DISSIPATION CAPACITY (5x18 = 90 rules)
  // Công suất tản (W): 180W, 220W, 260W, 300W, 350W
  // Toàn bộ 18 mức TDP trong DB: 35W, 65W, 95W, 105W, 120W, 125W, 150W, 160W, 170W, 180W, 200W, 220W, 250W, 260W, 300W, 320W, 350W, 450W
  // =========================================================================
  const coolCaps = [180, 220, 260, 300, 350];
  const allTdps = [35, 65, 95, 105, 120, 125, 150, 160, 170, 180, 200, 220, 250, 260, 300, 320, 350, 450];
  for (const cap of coolCaps) {
    for (const tdp of allTdps) {
      const isCompat = cap >= tdp;
      rules.push({
        name: `Tản nhiệt ${cap}W ↔ CPU TDP ${tdp}W`,
        source_category_id: 8,
        target_category_id: 1,
        source_attribute_key: "cooling_capacity",
        target_attribute_key: "tdp",
        source_attr_name: "cooling_capacity",
        source_val: `${cap}W`,
        target_attr_name: "tdp",
        target_val: `${tdp}W`,
        operator: isCompat ? "GTE" : "LT",
        is_compatible: isCompat,
        description: isCompat
          ? `TƯƠNG THÍCH: Hiệu năng giải nhiệt ${cap}W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt ${tdp}W.`
          : `CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất ${cap}W, không đủ giải nhiệt cho CPU tỏa nhiệt tới ${tdp}W.`
      });
    }
  }

  // =========================================================================
  // 7. PSU (6) ↔ GPU (4) — WATTAGE VS GPU TDP (10x12 = 120 rules)
  // PSU Wattages: 350W, 450W, 500W, 550W, 650W, 750W, 850W, 1000W, 1200W, 1600W
  // GPU TDPs: 95W, 120W, 150W, 160W, 200W, 220W, 260W, 300W, 320W, 350W, 450W (+ 250W)
  // Chuẩn khuyến nghị an toàn hãng sản xuất: P_min_psu = (TDP_GPU + 180W CPU/system) * 1.25
  // =========================================================================
  const allPsuWatts = [350, 450, 500, 550, 650, 750, 850, 1000, 1200, 1600];
  const gpuTdpProfiles = [
    { tdp: 95,  minPsu: 350, name: "GTX 1650 / RX 6400" },
    { tdp: 120, minPsu: 450, name: "RTX 3050 / GTX 1660S" },
    { tdp: 150, minPsu: 500, name: "RTX 4060 / RX 6600" },
    { tdp: 160, minPsu: 500, name: "RTX 4060 Ti / RX 7600" },
    { tdp: 200, minPsu: 550, name: "RTX 4070 / RTX 3060Ti" },
    { tdp: 220, minPsu: 650, name: "RTX 3070 / RX 7700XT" },
    { tdp: 250, minPsu: 650, name: "RTX 4070 Ti / RX 6800" },
    { tdp: 260, minPsu: 700, name: "RTX 3080 / RTX 5070 / RX 7800XT" },
    { tdp: 300, minPsu: 750, name: "RTX 4070 Ti Super" },
    { tdp: 320, minPsu: 750, name: "RTX 4080 Super" },
    { tdp: 350, minPsu: 850, name: "RTX 3090 / RX 7900 XT" },
    { tdp: 450, minPsu: 850, name: "RTX 4090 / RX 7900 XTX" }
  ];

  for (const p of allPsuWatts) {
    for (const g of gpuTdpProfiles) {
      const isCompat = p >= g.minPsu;
      rules.push({
        name: `Nguồn ${p}W ↔ GPU TDP ${g.tdp}W (${g.name})`,
        source_category_id: 6,
        target_category_id: 4,
        source_attribute_key: "psu_wattage",
        target_attribute_key: "tdp",
        source_attr_name: "psu_wattage",
        source_val: `${p}W`,
        target_attr_name: "tdp",
        target_val: `${g.tdp}W`,
        operator: isCompat ? "GTE" : "LT",
        is_compatible: isCompat,
        description: isCompat
          ? `TƯƠNG THÍCH: Nguồn công suất ${p}W đáp ứng khuyến nghị tối thiểu (${g.minPsu}W) cho GPU ${g.name} (TDP ${g.tdp}W).`
          : `CẢNH BÁO THIẾU NGUỒN: Nguồn ${p}W không đủ công suất cho card đồ họa ${g.name} (TDP ${g.tdp}W, yêu cầu tối thiểu ${g.minPsu}W). Nguy cơ sập nguồn khi full tải.`
      });
    }
  }

  // =========================================================================
  // 8. COOLING SOCKET BRACKET ↔ CPU SOCKET (5x5 = 25 rules)
  // =========================================================================
  const multiSocket = "LGA1851, LGA1700, AM5, AM4";
  const legacyMultiSocket = "LGA1200, AM4";
  const coolingSockets = [
    { name: multiSocket, supports: ["LGA1851", "LGA1700", "AM5", "AM4"] },
    { name: legacyMultiSocket, supports: ["LGA1200", "AM4"] },
    { name: "LGA1700", supports: ["LGA1700"] },
    { name: "AM5", supports: ["AM5"] },
    { name: "LGA1700, AM5", supports: ["LGA1700", "AM5"] },
  ];
  const targetSockets = ["LGA1851", "LGA1700", "LGA1200", "AM5", "AM4"];

  for (const cs of coolingSockets) {
    for (const ts of targetSockets) {
      const isCompat = cs.supports.includes(ts);
      rules.push({
        name: `Ngàm tản (${cs.name}) ↔ CPU ${ts}`,
        source_category_id: 8,
        target_category_id: 1,
        source_attribute_key: "socket_support",
        target_attribute_key: "socket",
        source_attr_name: "socket_support",
        source_val: cs.name,
        target_attr_name: "socket",
        target_val: ts,
        operator: isCompat ? "IN" : "NOT_IN",
        is_compatible: isCompat,
        description: isCompat
          ? `TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket ${ts} của CPU.`
          : `KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket ${ts}.`
      });
    }
  }

  // =========================================================================
  // 9. PSU (6) ↔ CPU HIGH TDP (1) — 12V EPS POWER DELIVERY (10x6 = 60 rules)
  // PSU: 350W, 450W, 500W, 550W, 650W, 750W, 850W, 1000W, 1200W, 1600W
  // CPU TDP cao: 65W, 105W, 125W, 170W, 200W, 250W
  // =========================================================================
  const highCpuTdps = [
    { tdp: 65,  minPsu: 350, desc: "CPU Non-K / Ryzen 5" },
    { tdp: 105, minPsu: 450, desc: "Ryzen 7 / Core i7 Non-K" },
    { tdp: 125, minPsu: 500, desc: "Intel K-series / Ryzen 9" },
    { tdp: 170, minPsu: 650, desc: "Ryzen 7950X / 7900X Extreme" },
    { tdp: 200, minPsu: 650, desc: "Core i7-14700K Boost PL2" },
    { tdp: 250, minPsu: 750, desc: "Core i9-14900K Unlimited PL2" }
  ];

  for (const p of allPsuWatts) {
    for (const c of highCpuTdps) {
      const isCompat = p >= c.minPsu;
      rules.push({
        name: `Nguồn ${p}W ↔ CPU TDP ${c.tdp}W (${c.desc})`,
        source_category_id: 6,
        target_category_id: 1,
        source_attribute_key: "psu_wattage",
        target_attribute_key: "tdp",
        source_attr_name: "psu_wattage",
        source_val: `${p}W`,
        target_attr_name: "tdp",
        target_val: `${c.tdp}W`,
        operator: isCompat ? "GTE" : "LT",
        is_compatible: isCompat,
        description: isCompat
          ? `TƯƠNG THÍCH: Bộ nguồn ${p}W đáp ứng đường 12V EPS và công suất ổn định cho ${c.desc} (TDP ${c.tdp}W).`
          : `CẢNH BÁO CÔNG SUẤT: Nguồn ${p}W quá yếu cho ${c.desc} (TDP ${c.tdp}W, yêu cầu tối thiểu ${c.minPsu}W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM.`
      });
    }
  }

  // =========================================================================
  // 10. STORAGE (5) ↔ MAINBOARD (2) — FORM FACTOR & INTERFACE (3x4 = 12 rules)
  // Storage Types: NVMe, SATA SSD, HDD
  // Mainboard Form Factors: E-ATX, ATX, mATX, ITX
  // =========================================================================
  const storageTypes = [
    { type: "NVMe", desc: "SSD chuẩn M.2 PCIe NVMe", compatWithAll: true },
    { type: "SATA SSD", desc: "SSD chuẩn SATA 2.5 inch", compatWithAll: true },
    { type: "HDD", desc: "Ổ cứng HDD cơ 3.5 inch", compatWithAll: true }
  ];

  for (const st of storageTypes) {
    for (const ff of formFactors) {
      rules.push({
        name: `Ổ cứng ${st.type} ↔ Mainboard ${ff}`,
        source_category_id: 5,
        target_category_id: 2,
        source_attribute_key: "storage_type",
        target_attribute_key: "form_factor",
        source_attr_name: "storage_type",
        source_val: st.type,
        target_attr_name: "form_factor",
        target_val: ff,
        operator: "EQ",
        is_compatible: true,
        description: `TƯƠNG THÍCH: Bo mạch chủ chuẩn ${ff} có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với ${st.desc}.`
      });
    }
  }

  // =========================================================================
  // 11. STOCK COOLER (14) ↔ CPU TDP (6) — KHẢ NĂNG DÙNG TẢN KÈM HỘP (2x6 = 12 rules)
  // Stock Cooler: Yes, No
  // CPU TDP: 35W, 65W, 105W, 125W, 170W, 250W
  // =========================================================================
  const stockOptions = [
    { val: "Yes", maxTdp: 65, desc: "Có sẵn tản nhiệt hộp (Stock Cooler đi kèm)" },
    { val: "No",  maxTdp: 0,  desc: "Không đi kèm tản nhiệt hộp (Bắt buộc mua tản rời)" }
  ];

  for (const so of stockOptions) {
    for (const c of highCpuTdps) {
      const isCompat = so.val === "Yes" ? c.tdp <= so.maxTdp : true;
      rules.push({
        name: `Tản hộp [${so.val}] ↔ CPU TDP ${c.tdp}W`,
        source_category_id: 1,
        target_category_id: 1,
        source_attribute_key: "stock_cooler",
        target_attribute_key: "tdp",
        source_attr_name: "stock_cooler",
        source_val: so.val,
        target_attr_name: "tdp",
        target_val: `${c.tdp}W`,
        operator: isCompat ? "LTE" : "GT",
        is_compatible: isCompat,
        description: isCompat
          ? (so.val === "Yes"
              ? `TƯƠNG THÍCH: Tản nhiệt kèm hộp đáp ứng vừa vặn cho CPU tiết kiệm điện TDP ${c.tdp}W.`
              : `KHUYẾN CÁO: CPU không kèm tản hộp, người dùng chủ động chọn tản nhiệt rời theo nhu cầu.`)
          : `CẢNH BÁO QUÁ NHIỆT: Tản nhiệt stock kèm hộp không đủ khả năng làm mát cho CPU hiệu năng cao tỏa nhiệt ${c.tdp}W. Bắt buộc trang bị tản nhiệt khí lớn hoặc tản nước AIO.`
      });
    }
  }

  return rules;
}

async function main() {
  console.log("═════════════════════════════════════════════════════════════════");
  console.log("🛠️  TÍNH TOÁN & XUẤT COMPREHENSIVE COMPATIBILITY RULES CHUẨN XÁC");
  console.log("═════════════════════════════════════════════════════════════════\n");

  const rules = generateComprehensiveHardwareRules();
  console.log(`📊 Đã tính toán tổng cộng: ${rules.length} quy tắc kỹ thuật chuẩn xác.`);

  // Lấy toàn bộ attributes và values trong database
  const attributes = await prisma.attribute.findMany({
    include: { AttributeValue: true }
  });

  const attrValueMap = {};
  for (const a of attributes) {
    attrValueMap[a.name] = {};
    for (const v of a.AttributeValue) {
      attrValueMap[a.name][v.value] = v.id;
    }
  }

  // Làm sạch các rules cũ trong DB
  await prisma.compatibilityRule.deleteMany({});
  console.log("🧹 Đã làm sạch toàn bộ rules cũ trong database.");

  // Nạp vào DB
  let insertedCount = 0;
  let missingValCount = 0;

  for (const r of rules) {
    const val1Id = attrValueMap[r.source_attr_name]?.[r.source_val] || null;
    const val2Id = attrValueMap[r.target_attr_name]?.[r.target_val] || null;

    if (!val1Id || !val2Id) {
      missingValCount++;
    }

    await prisma.compatibilityRule.create({
      data: {
        name: r.name,
        source_category_id: r.source_category_id,
        target_category_id: r.target_category_id,
        source_attribute_key: r.source_attribute_key,
        target_attribute_key: r.target_attribute_key,
        operator: r.operator,
        is_compatible: r.is_compatible,
        attribute_value_1: val1Id,
        attribute_value_2: val2Id,
        description: r.description,
        status: "ACTIVE",
        is_active: true
      }
    });
    insertedCount++;
  }

  console.log(`✅ Đã nạp thành công ${insertedCount} rules vào database! (Trong đó có ${missingValCount} rules thiếu ID thuộc tính cụ thể).`);

  // XUẤT RA FILE SQL ĐỘC LẬP
  const sqlLines = [];
  sqlLines.push("-- =============================================================================");
  sqlLines.push(`-- 🔧 CNM E-COMMERCE: COMPREHENSIVE COMPATIBILITY RULES SEED (${rules.length} RULES)`);
  sqlLines.push("-- File: docs/03-database/phase11_compatibility_rules_seed.sql");
  sqlLines.push("-- Tính chất: Độc lập hoàn toàn, tự resolve ID linh hoạt qua subquery.");
  sqlLines.push("-- =============================================================================");
  sqlLines.push("");
  sqlLines.push("SET NAMES utf8mb4;");
  sqlLines.push("SET FOREIGN_KEY_CHECKS = 0;");
  sqlLines.push("");
  sqlLines.push("-- 1. Đảm bảo cấu trúc cột của bảng compatibility_rules đã có đầy đủ");
  sqlLines.push("CREATE TABLE IF NOT EXISTS compatibility_rules (");
  sqlLines.push("  id INT AUTO_INCREMENT PRIMARY KEY,");
  sqlLines.push("  name VARCHAR(255) NULL,");
  sqlLines.push("  attribute_value_1 INT NULL,");
  sqlLines.push("  attribute_value_2 INT NULL,");
  sqlLines.push("  is_compatible TINYINT(1) NOT NULL DEFAULT 1,");
  sqlLines.push("  source_category_id INT NULL,");
  sqlLines.push("  target_category_id INT NULL,");
  sqlLines.push("  source_attribute_key VARCHAR(255) NULL,");
  sqlLines.push("  target_attribute_key VARCHAR(255) NULL,");
  sqlLines.push("  operator VARCHAR(20) NULL DEFAULT 'EQ',");
  sqlLines.push("  description TEXT NULL,");
  sqlLines.push("  status VARCHAR(50) NULL DEFAULT 'ACTIVE',");
  sqlLines.push("  is_active TINYINT(1) NULL DEFAULT 1,");
  sqlLines.push("  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,");
  sqlLines.push("  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  sqlLines.push(");");
  sqlLines.push("");
  sqlLines.push("-- Thêm cột name nếu bảng đã tồn tại từ trước mà chưa có cột name (dùng Stored Procedure an toàn tương thích mọi MySQL)");
  sqlLines.push("DROP PROCEDURE IF EXISTS AddNameColumnIfMissing;");
  sqlLines.push("DELIMITER $$");
  sqlLines.push("CREATE PROCEDURE AddNameColumnIfMissing()");
  sqlLines.push("BEGIN");
  sqlLines.push("  IF NOT EXISTS (");
  sqlLines.push("    SELECT 1 FROM information_schema.COLUMNS");
  sqlLines.push("    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'compatibility_rules' AND COLUMN_NAME = 'name'");
  sqlLines.push("  ) THEN");
  sqlLines.push("    ALTER TABLE compatibility_rules ADD COLUMN name VARCHAR(255) NULL AFTER id;");
  sqlLines.push("  END IF;");
  sqlLines.push("END $$");
  sqlLines.push("DELIMITER ;");
  sqlLines.push("CALL AddNameColumnIfMissing();");
  sqlLines.push("DROP PROCEDURE IF EXISTS AddNameColumnIfMissing;");
  sqlLines.push("");
  sqlLines.push("-- Xóa rules cũ trước khi nạp bộ quy tắc mới");
  sqlLines.push("DELETE FROM compatibility_rules;");
  sqlLines.push("");
  sqlLines.push("-- 2. Nạp toàn bộ quy tắc tương thích chuẩn xác kỹ thuật 100%");
  sqlLines.push("");

  for (const r of rules) {
    const escName = r.name.replace(/'/g, "''");
    const escDesc = r.description.replace(/'/g, "''");
    const isCompat = r.is_compatible ? 1 : 0;
    
    const subqueryVal1 = `(SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = '${r.source_attr_name}' AND av.value = '${r.source_val}' LIMIT 1)`;
    const subqueryVal2 = `(SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id WHERE a.name = '${r.target_attr_name}' AND av.value = '${r.target_val}' LIMIT 1)`;

    sqlLines.push(`INSERT INTO compatibility_rules (`);
    sqlLines.push(`  name, source_category_id, target_category_id, source_attribute_key, target_attribute_key,`);
    sqlLines.push(`  operator, is_compatible, attribute_value_1, attribute_value_2, description, status, is_active, created_at, updated_at`);
    sqlLines.push(`) VALUES (`);
    sqlLines.push(`  '${escName}', ${r.source_category_id}, ${r.target_category_id}, '${r.source_attribute_key}', '${r.target_attribute_key}',`);
    sqlLines.push(`  '${r.operator}', ${isCompat}, ${subqueryVal1}, ${subqueryVal2}, '${escDesc}', 'ACTIVE', 1, NOW(), NOW()`);
    sqlLines.push(`);`);
  }

  sqlLines.push("");
  sqlLines.push("SET FOREIGN_KEY_CHECKS = 1;");
  sqlLines.push("-- =============================================================================");
  sqlLines.push("-- HOÀN TẤT NẠP QUY TẮC TƯƠNG THÍCH");
  sqlLines.push("-- =============================================================================");

  const sqlFilePath = path.join(__dirname, "../../../docs/03-database/phase11_compatibility_rules_seed.sql");
  fs.writeFileSync(sqlFilePath, sqlLines.join("\n"), "utf8");
  console.log(`\n💾 ĐÃ XUẤT FILE SQL ĐỘC LẬP THÀNH CÔNG TẠI:`);
  console.log(`   👉 ${sqlFilePath}`);

  const totalInDb = await prisma.compatibilityRule.count();
  console.log(`\n🎉 TỔNG KẾT: Cơ sở dữ liệu hiện có ${totalInDb} quy tắc tương thích hoạt động.`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error("❌ Thất bại:", e);
  process.exit(1);
});
