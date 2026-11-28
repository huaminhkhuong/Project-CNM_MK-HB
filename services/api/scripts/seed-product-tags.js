/**
 * Idempotent Product Tags Seeder (`services/api/scripts/seed-product-tags.js`)
 * Maps the 10 canonical tags (`gaming`, `esports`, `aaa`, `van_phong`, `do_hoa`,
 * `ai`, `workstation`, `lap_trinh`, `white_theme`, `rgb`) to real PC component
 * products (CPU, Mainboard, RAM, GPU, PSU, Case) in MySQL (`cnm_mk_hb`).
 *
 * Safe to run repeatedly: uses ON DUPLICATE KEY UPDATE for `tags` and
 * INSERT IGNORE for `product_tags` without deleting custom admin tags.
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const { getDbPool } = require("../src/config/database");

const CANONICAL_TAGS = [
  { code: "gaming", label: "Gaming", group_name: "use_case", description: "Phù hợp chơi game phổ thông đến cao cấp" },
  { code: "esports", label: "eSports", group_name: "use_case", description: "Tối ưu FPS cao cho game cạnh tranh (Valorant, CS2, LoL)" },
  { code: "aaa", label: "Game AAA", group_name: "use_case", description: "Đáp ứng game đồ họa nặng, Ray Tracing, 2K/4K" },
  { code: "van_phong", label: "Văn phòng", group_name: "use_case", description: "Phù hợp học tập, làm việc văn phòng, tiết kiệm điện" },
  { code: "do_hoa", label: "Đồ họa / Render", group_name: "use_case", description: "Tối ưu thiết kế 2D/3D, dựng phim, render" },
  { code: "ai", label: "AI / Machine Learning", group_name: "use_case", description: "Phù hợp huấn luyện mô hình AI, VRAM/CUDA lớn" },
  { code: "workstation", label: "Workstation / Server", group_name: "use_case", description: "Linh kiện máy trạm / máy chủ chuyên dụng" },
  { code: "lap_trinh", label: "Lập trình", group_name: "use_case", description: "Đa nhiệm tốt cho lập trình, Docker, máy ảo" },
  { code: "white_theme", label: "Tone Trắng", group_name: "style", description: "Linh kiện màu trắng đồng bộ thẩm mỹ" },
  { code: "rgb", label: "LED RGB", group_name: "style", description: "Hỗ trợ đèn LED RGB / ARGB" }
];

// Target core PC Builder categories: CPU(1), Mainboard(2), RAM(3), GPU(4), PSU(6), Case(7)
const TARGET_CATEGORY_IDS = [1, 2, 3, 4, 6, 7];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();
}

function classifyProductTags(product) {
  const catId = Number(product.category_id);
  const rawName = String(product.name || "");
  const name = normalizeText(rawName);
  const price = Number(product.min_price || product.price || 0);
  const tags = new Set();

  // ── 1. CPU ──────────────────────────────────────────────────────────────────
  if (catId === 1) {
    const isHighEnd = /(i9|i7|ultra 9|ultra 7|ryzen 9|ryzen 7|x3d|xeon|threadripper|9950|9900|9800|7950|7900|7800|14900|14700|13900|13700|285k|265k|270k)/i.test(name);
    const isMidRange = /(i5|ultra 5|ryzen 5|7600|7500|8400|8700|12400|12600|13400|13600|14400|14600|225|235|245|250|5600|5500)/i.test(name);
    const isEntryOrApu = /(i3|athlon|pentium|celeron|3200g|3400g|4600g|5600g|5700g|5500gt|5600gt|8500g|8600g|8700g|12100|13100|14100)/i.test(name);
    const isWorkstationCpu = /(xeon|threadripper|epyc|i9|ultra 9|ryzen 9|14900|13900|7950|9950|285k)/i.test(name);

    if (isHighEnd) {
      tags.add("gaming");
      tags.add("esports");
      tags.add("aaa");
      tags.add("do_hoa");
      tags.add("ai");
      tags.add("lap_trinh");
      if (isWorkstationCpu || price >= 8500000) tags.add("workstation");
    } else if (isMidRange) {
      tags.add("gaming");
      tags.add("esports");
      tags.add("lap_trinh");
      tags.add("van_phong");
      if (price >= 3500000) {
        tags.add("aaa");
        tags.add("do_hoa");
      }
    } else if (isEntryOrApu) {
      tags.add("van_phong");
      tags.add("esports");
      tags.add("gaming");
      tags.add("lap_trinh");
    } else {
      tags.add("gaming");
      tags.add("van_phong");
      tags.add("lap_trinh");
    }
  }

  // ── 2. MAINBOARD ────────────────────────────────────────────────────────────
  else if (catId === 2) {
    const isEnthusiast = /(z890|z790|z690|x870|x670|trx|wrx|proart|creator|workstation|ws\b|taichi|hero|godlike|aorus master|aorus extreme|rog strix|rog maximus)/i.test(name);
    const isMidRange = /(b860|b760|b660|b650|b550|tuf|mortar|tomahawk|gaming|aorus|steel legend|eagle)/i.test(name);
    const isBudget = /(h610|h510|a520|a620|prime|pro h|pro a)/i.test(name);

    if (isEnthusiast || price >= 6500000) {
      tags.add("gaming");
      tags.add("aaa");
      tags.add("do_hoa");
      tags.add("ai");
      tags.add("workstation");
      tags.add("lap_trinh");
    } else if (isMidRange || price >= 2500000) {
      tags.add("gaming");
      tags.add("esports");
      tags.add("aaa");
      tags.add("do_hoa");
      tags.add("lap_trinh");
      tags.add("van_phong");
    } else if (isBudget) {
      tags.add("van_phong");
      tags.add("esports");
      tags.add("gaming");
      tags.add("lap_trinh");
    } else {
      tags.add("gaming");
      tags.add("van_phong");
      tags.add("lap_trinh");
    }
  }

  // ── 3. RAM ──────────────────────────────────────────────────────────────────
  else if (catId === 3) {
    const isLargeCap = /(64gb|96gb|128gb|2x32|2x48|4x16|4x32)/i.test(name);
    const is32Gb = /(32gb|2x16)/i.test(name);
    const is16Gb = /(16gb|2x8)/i.test(name);
    const isEccOrServer = /(ecc|server|rdimm|workstation)/i.test(name);

    if (isEccOrServer || isLargeCap) {
      tags.add("workstation");
      tags.add("ai");
      tags.add("do_hoa");
      tags.add("lap_trinh");
      tags.add("aaa");
      tags.add("gaming");
    } else if (is32Gb) {
      tags.add("gaming");
      tags.add("esports");
      tags.add("aaa");
      tags.add("do_hoa");
      tags.add("ai");
      tags.add("lap_trinh");
      tags.add("workstation");
    } else if (is16Gb) {
      tags.add("gaming");
      tags.add("esports");
      tags.add("van_phong");
      tags.add("lap_trinh");
      if (/ddr5/i.test(name)) tags.add("do_hoa");
    } else {
      tags.add("van_phong");
      tags.add("esports");
      tags.add("gaming");
    }
  }

  // ── 4. GPU (VGA) ────────────────────────────────────────────────────────────
  else if (catId === 4) {
    const isWorkstationGpu = /(quadro|rtx a\d+|rtx \d000 ada|pro w|tesla|radeon pro)/i.test(name);
    const isFlagshipAi = /(5090|5080|4090|4080|3090|7900 xtx|7900 xt|9070 xt|24gb|16gb|32gb)/i.test(name);
    const isHighMid = /(5070|5060 ti|4070|4060 ti|3080|3070|7800 xt|7700 xt|9070|6800|6700)/i.test(name);
    const isMainstream = /(5060|5050|4060|3060|3050|7600|6600|6650|2060|1660)/i.test(name);
    const isEntry = /(gt 730|gt 1030|gtx 1650|rx 6400|rx 6500|rx 550|rx 580|gt 710)/i.test(name);

    if (isWorkstationGpu) {
      tags.add("workstation");
      tags.add("do_hoa");
      tags.add("ai");
      tags.add("lap_trinh");
    } else if (isFlagshipAi) {
      tags.add("gaming");
      tags.add("aaa");
      tags.add("do_hoa");
      tags.add("ai");
      tags.add("workstation");
      tags.add("lap_trinh");
    } else if (isHighMid) {
      tags.add("gaming");
      tags.add("esports");
      tags.add("aaa");
      tags.add("do_hoa");
      if (/nvidia|rtx|12gb|16gb/i.test(name)) tags.add("ai");
      tags.add("lap_trinh");
    } else if (isMainstream) {
      tags.add("gaming");
      tags.add("esports");
      tags.add("do_hoa");
      tags.add("lap_trinh");
      if (/rtx (4060|5060|3060)/i.test(name)) tags.add("aaa");
    } else if (isEntry) {
      tags.add("van_phong");
      tags.add("esports");
      tags.add("gaming");
    } else {
      tags.add("gaming");
      tags.add("esports");
      tags.add("do_hoa");
    }
  }

  // ── 6. PSU ──────────────────────────────────────────────────────────────────
  else if (catId === 6) {
    const wattMatch = name.match(/(\d{3,4})\s*w\b/i);
    const watts = wattMatch ? Number(wattMatch[1]) : 0;

    if (watts >= 850 || /platinum|titanium|atx 3|pcie 5|1000w|1200w|1300w|1600w/i.test(name)) {
      tags.add("gaming");
      tags.add("aaa");
      tags.add("do_hoa");
      tags.add("ai");
      tags.add("workstation");
      tags.add("lap_trinh");
    } else if (watts >= 650) {
      tags.add("gaming");
      tags.add("esports");
      tags.add("aaa");
      tags.add("do_hoa");
      tags.add("lap_trinh");
      if (watts >= 750) {
        tags.add("ai");
        tags.add("workstation");
      }
    } else {
      tags.add("van_phong");
      tags.add("esports");
      tags.add("gaming");
      tags.add("lap_trinh");
    }
  }

  // ── 7. CASE ─────────────────────────────────────────────────────────────────
  else if (catId === 7) {
    const isFullOrPro = /(full tower|e-atx|eatx|proart|workstation|o11|h9|h7|7000d|5000d|nv7|nv9|hyte)/i.test(name);
    const isCompactOffice = /(mini|micro|matx|m-atx|itx|office|van phong|slim|silent|minimal)/i.test(name);

    tags.add("gaming");
    tags.add("esports");
    tags.add("lap_trinh");
    if (isFullOrPro || price >= 2000000) {
      tags.add("aaa");
      tags.add("do_hoa");
      tags.add("ai");
      tags.add("workstation");
    }
    if (isCompactOffice || price <= 1500000) {
      tags.add("van_phong");
    }
  }

  // ── STYLE TAGS (always layered on top of use_case tags so PC Builder never filters them out) ──
  if (/(white|trang|snow|polar|frost|ice|aero|silver|lunar)/i.test(name)) {
    tags.add("white_theme");
  }
  if (/(rgb|argb|a-rgb|led|trident z|vengeance rgb|fury beast rgb|dominator|aura|mystic|prism|infinity|fan led|3f|4f|panorama|be ca)/i.test(name)) {
    tags.add("rgb");
  }

  return Array.from(tags);
}

async function seedProductTags() {
  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    console.log("🚀 [Seed Product Tags] Bắt đầu đồng bộ 10 canonical tags và ánh xạ sản phẩm...");

    // 1. Ensure all 10 canonical tags exist idempotently
    for (const tag of CANONICAL_TAGS) {
      await connection.query(
        `
          INSERT INTO tags (code, label, group_name, description)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            label = VALUES(label),
            group_name = VALUES(group_name),
            description = VALUES(description)
        `,
        [tag.code, tag.label, tag.group_name, tag.description]
      );
    }

    const [tagRows] = await connection.query(`SELECT id, code FROM tags`);
    const tagIdByCode = new Map(tagRows.map((r) => [String(r.code), Number(r.id)]));

    // 2. Load active products in core PC Builder categories (CPU, Mainboard, RAM, GPU, PSU, Case)
    const placeholders = TARGET_CATEGORY_IDS.map(() => "?").join(", ");
    const [products] = await connection.query(
      `
        SELECT
          p.id,
          p.category_id,
          p.name,
          p.price,
          MIN(ps.price) AS min_price
        FROM products p
        LEFT JOIN product_skus ps ON ps.product_id = p.id
        WHERE p.category_id IN (${placeholders})
          AND (p.is_active IS NULL OR p.is_active = 1)
        GROUP BY p.id, p.category_id, p.name, p.price
        ORDER BY p.category_id ASC, p.id ASC
      `,
      TARGET_CATEGORY_IDS
    );

    const pairs = [];
    for (const product of products) {
      const assignedCodes = classifyProductTags(product);
      for (const code of assignedCodes) {
        const tagId = tagIdByCode.get(code);
        if (tagId) {
          pairs.push([Number(product.id), tagId]);
        }
      }
    }

    // 3. Batch INSERT IGNORE so script is 100% idempotent
    let insertedRows = 0;
    const chunkSize = 500;
    for (let i = 0; i < pairs.length; i += chunkSize) {
      const batch = pairs.slice(i, i + chunkSize);
      const [res] = await connection.query(
        `INSERT IGNORE INTO product_tags (product_id, tag_id) VALUES ?`,
        [batch]
      );
      insertedRows += Number(res.affectedRows || 0);
    }

    // 4. Print live summary
    const [[summary]] = await connection.query(
      `SELECT COUNT(*) AS totalMappings, COUNT(DISTINCT product_id) AS taggedProducts FROM product_tags`
    );
    const [perTag] = await connection.query(
      `
        SELECT t.code, t.group_name, COUNT(pt.product_id) AS cnt
        FROM tags t
        LEFT JOIN product_tags pt ON pt.tag_id = t.id
        GROUP BY t.id, t.code, t.group_name
        ORDER BY t.id ASC
      `
    );

    console.log(
      `✅ [Seed Product Tags] Xử lý ${products.length} sản phẩm (6 danh mục lõi), tạo mới ${insertedRows} liên kết.`
    );
    console.log(
      `📊 [Seed Product Tags] Tổng hiện có trong DB: ${summary.totalMappings} product_tags trên ${summary.taggedProducts} sản phẩm.`
    );
    for (const row of perTag) {
      console.log(`   - ${row.code} (${row.group_name}): ${row.cnt} sản phẩm`);
    }
  } finally {
    connection.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedProductTags()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ [Seed Product Tags] Lỗi:", err);
      process.exit(1);
    });
}

module.exports = { seedProductTags, classifyProductTags };

