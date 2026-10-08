/**
 * 🔧 SEED COMPATIBILITY RULES — PC Mall
 * Bổ sung đầy đủ quy tắc tương thích linh kiện dựa trên:
 *   - Attribute values đã có trong DB (socket, ram_type, form_factor, tdp)
 *   - Kiến thức kỹ thuật thực tế về linh kiện PC
 *
 * Chiến lược:
 *   1. Đọc tất cả attribute values từ DB
 *   2. Xây dựng rules tương thích/không tương thích theo từng nhóm
 *   3. Upsert vào bảng compatibility_rules
 *
 * Chạy: node services/api/prisma/seed-compatibility-rules.js
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: tìm attribute value id theo tên attribute và giá trị
// ─────────────────────────────────────────────────────────────────────────────
async function findAttrValueId(attributeName, value) {
  const attr = await prisma.attribute.findFirst({
    where: { name: { contains: attributeName } }
  });
  if (!attr) return null;
  const val = await prisma.attributeValue.findFirst({
    where: { attribute_id: attr.id, value: { contains: value } }
  });
  return val?.id || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: upsert một rule
// ─────────────────────────────────────────────────────────────────────────────
async function upsertRule(v1Id, v2Id, isCompatible, description) {
  if (!v1Id || !v2Id) {
    console.log(`  ⚠️  Bỏ qua rule "${description}" — không tìm thấy attribute values`);
    return false;
  }

  // Kiểm tra rule đã tồn tại chưa
  const existing = await prisma.compatibilityRule.findFirst({
    where: {
      OR: [
        { attribute_value_1: v1Id, attribute_value_2: v2Id },
        { attribute_value_1: v2Id, attribute_value_2: v1Id }
      ]
    }
  });

  if (existing) {
    // Update nếu cần
    await prisma.compatibilityRule.update({
      where: { id: existing.id },
      data: { is_compatible: isCompatible, description, is_active: true, status: "ACTIVE" }
    });
    console.log(`  ♻️  Updated: ${description}`);
    return true;
  }

  await prisma.compatibilityRule.create({
    data: {
      attribute_value_1: v1Id,
      attribute_value_2: v2Id,
      is_compatible: isCompatible,
      description,
      status: "ACTIVE",
      is_active: true
    }
  });
  console.log(`  ✅ Created: ${description}`);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  🔧 SEED COMPATIBILITY RULES — PC Mall");
  console.log("═══════════════════════════════════════════════════\n");

  // 1. Đọc toàn bộ attributes và values từ DB
  const allAttrs = await prisma.attribute.findMany({
    include: { AttributeValue: true }
  });

  console.log("📋 Attributes hiện có trong DB:");
  for (const a of allAttrs) {
    const vals = a.AttributeValue.map(v => `"${v.value}"`).join(", ");
    console.log(`  [${a.id}] ${a.name}: ${vals.substring(0, 100)}`);
  }
  console.log();

  // 2. Tạo map attribute values để tra cứu
  const attrMap = {};
  for (const a of allAttrs) {
    const name = a.name.toLowerCase().trim();
    attrMap[name] = {};
    for (const v of a.AttributeValue) {
      const key = v.value.toLowerCase().trim();
      attrMap[name][key] = v.id;
    }
  }

  // Helper tìm id qua map
  function findId(attrName, valuePart) {
    const attrKey = Object.keys(attrMap).find(k => k.includes(attrName.toLowerCase()));
    if (!attrKey) return null;
    const vals = attrMap[attrKey];
    const valKey = Object.keys(vals).find(k => k.includes(valuePart.toLowerCase()));
    return valKey ? vals[valKey] : null;
  }

  let created = 0;
  let skipped = 0;

  console.log("─".repeat(50));
  console.log("📌 GROUP 1: SOCKET TƯƠNG THÍCH (CPU ↔ Mainboard)\n");

  // ── Socket rules ───────────────────────────────────────────────────────────
  // LGA1700 tương thích với nhau (CPU LGA1700 + MB LGA1700)
  const socketRules = [
    ["LGA1700", "LGA1700", true,  "CPU LGA1700 tương thích với Mainboard LGA1700 (Intel 12th/13th/14th gen)"],
    ["LGA1851", "LGA1851", true,  "CPU LGA1851 tương thích với Mainboard LGA1851 (Intel 15th gen Arrow Lake)"],
    ["LGA1200", "LGA1200", true,  "CPU LGA1200 tương thích với Mainboard LGA1200 (Intel 10th/11th gen)"],
    ["AM5",     "AM5",     true,  "CPU AM5 tương thích với Mainboard AM5 (AMD Ryzen 7000/8000/9000)"],
    ["AM4",     "AM4",     true,  "CPU AM4 tương thích với Mainboard AM4 (AMD Ryzen 3000/5000)"],
    // KHÔNG tương thích
    ["LGA1700", "LGA1200", false, "CPU LGA1700 KHÔNG tương thích với Mainboard LGA1200 (khác socket)"],
    ["LGA1700", "AM4",     false, "CPU LGA1700 KHÔNG tương thích với Mainboard AM4 (Intel/AMD khác nhau)"],
    ["LGA1700", "AM5",     false, "CPU LGA1700 KHÔNG tương thích với Mainboard AM5 (Intel/AMD khác nhau)"],
    ["LGA1851", "LGA1700", false, "CPU LGA1851 KHÔNG tương thích với Mainboard LGA1700 (khác thế hệ)"],
    ["LGA1851", "AM5",     false, "CPU LGA1851 KHÔNG tương thích với Mainboard AM5 (Intel/AMD khác nhau)"],
    ["LGA1200", "AM4",     false, "CPU LGA1200 KHÔNG tương thích với Mainboard AM4 (Intel/AMD khác nhau)"],
    ["LGA1200", "AM5",     false, "CPU LGA1200 KHÔNG tương thích với Mainboard AM5 (Intel/AMD khác nhau)"],
    ["AM5",     "AM4",     false, "CPU AM5 KHÔNG tương thích với Mainboard AM4 (khác thế hệ socket AMD)"],
    ["AM4",     "LGA1700", false, "CPU AM4 KHÔNG tương thích với Mainboard LGA1700 (AMD/Intel khác nhau)"],
    ["AM4",     "LGA1851", false, "CPU AM4 KHÔNG tương thích với Mainboard LGA1851 (AMD/Intel khác nhau)"],
  ];

  for (const [sock1, sock2, compat, desc] of socketRules) {
    const id1 = findId("socket", sock1);
    const id2 = findId("socket", sock2);
    const ok = await upsertRule(id1, id2, compat, desc);
    ok ? created++ : skipped++;
  }

  console.log("\n📌 GROUP 2: RAM TYPE TƯƠNG THÍCH (RAM ↔ Mainboard)\n");

  // ── RAM type rules ─────────────────────────────────────────────────────────
  const ramRules = [
    ["DDR5", "DDR5", true,  "RAM DDR5 tương thích với Mainboard hỗ trợ DDR5 (Intel 12th+/AMD 7000+)"],
    ["DDR4", "DDR4", true,  "RAM DDR4 tương thích với Mainboard hỗ trợ DDR4"],
    ["DDR3", "DDR3", true,  "RAM DDR3 tương thích với Mainboard hỗ trợ DDR3"],
    ["DDR5", "DDR4", false, "RAM DDR5 KHÔNG tương thích với Mainboard chỉ hỗ trợ DDR4 (chân khác nhau)"],
    ["DDR5", "DDR3", false, "RAM DDR5 KHÔNG tương thích với Mainboard DDR3"],
    ["DDR4", "DDR3", false, "RAM DDR4 KHÔNG tương thích với Mainboard DDR3 (chân khác nhau)"],
    ["DDR4", "DDR5", false, "RAM DDR4 KHÔNG tương thích với Mainboard chỉ hỗ trợ DDR5"],
  ];

  for (const [ram1, ram2, compat, desc] of ramRules) {
    const id1 = findId("ram_type", ram1);
    const id2 = findId("ram_type", ram2);
    const ok = await upsertRule(id1, id2, compat, desc);
    ok ? created++ : skipped++;
  }

  console.log("\n📌 GROUP 3: FORM FACTOR TƯƠNG THÍCH (Mainboard ↔ Case)\n");

  // ── Form factor rules ──────────────────────────────────────────────────────
  // Form factor giống nhau thì luôn tương thích. Form factor chéo giữa Mainboard và Case
  // được xử lý theo chiều (directional) bởi logic engine.
  // Đồng thời xóa các rule cũ bị gán sai
  await prisma.compatibilityRule.deleteMany({
    where: {
      OR: [
        { description: { contains: "quá lớn" } },
        { id: { in: [20, 22, 23] } }
      ]
    }
  });

  const formRules = [
    ["ATX",  "ATX",  true,  "Mainboard ATX tương thích với Case ATX (Mid Tower / Full Tower)"],
    ["mATX", "mATX", true,  "Mainboard mATX tương thích với Case hỗ trợ mATX"],
    ["ITX",  "ITX",  true,  "Mainboard ITX tương thích với Case ITX"],
  ];

  for (const [form1, form2, compat, desc] of formRules) {
    const id1 = findId("form_factor", form1);
    const id2 = findId("form_factor", form2);
    const ok = await upsertRule(id1, id2, compat, desc);
    ok ? created++ : skipped++;
  }

  // ── Tổng kết ───────────────────────────────────────────────────────────────
  const totalRules = await prisma.compatibilityRule.count();
  const activeRules = await prisma.compatibilityRule.count({ where: { is_active: true } });

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  📊 KẾT QUẢ SEED COMPATIBILITY RULES");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  ✅ Tạo/cập nhật thành công : ${created}`);
  console.log(`  ⚠️  Bỏ qua (thiếu data)    : ${skipped}`);
  console.log(`  📦 Tổng rules trong DB     : ${totalRules} (active: ${activeRules})`);

  if (skipped > 0) {
    console.log(`\n  💡 Ghi chú: ${skipped} rules bị bỏ qua do attribute values chưa có trong DB.`);
    console.log("     Hãy chạy import-hacom-data.js trước để đảm bảo đầy đủ attributes.");
  }

  console.log("\n✅ Hoàn tất seed compatibility rules!\n");
}

main()
  .catch((e) => {
    console.error("❌ Thất bại:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
