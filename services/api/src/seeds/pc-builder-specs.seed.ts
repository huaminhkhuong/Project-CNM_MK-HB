/**
 * PC Builder Spec Data Seeder [P0-02]
 * ====================================
 * Bổ sung đầy đủ thuộc tính kỹ thuật vào bảng sku_attributes cho 100 SKUs
 * dựa trên tên sản phẩm thực tế trong DB cnm_ecommerce.
 *
 * Schema:
 *   attributes(id, name)
 *   attribute_values(id, attribute_id, value)
 *   sku_attributes(id, sku_id, attribute_value_id)
 *
 * Run: npx ts-node services/api/src/seeds/pc-builder-specs.seed.ts
 * OR:  node -r ts-node/register services/api/src/seeds/pc-builder-specs.seed.ts
 */

import mysql from "mysql2/promise";

// ─── DB Connection ────────────────────────────────────────────────────────────
const DB_CONFIG = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "cnm_ecommerce",
};

// ─── Spec Map: SKU ID → khai báo thuộc tính đầy đủ ──────────────────────────
// Key: sku_id (int), Value: Record<attribute_name, attribute_value>
const SKU_SPECS: Record<number, Record<string, string>> = {

  // ═══════════════════════════════════════════════════════════════════
  // CPU (15 SKUs) — Bổ sung: tdp, stock_cooler
  //   socket đã có → CHỈ bổ sung các key còn thiếu
  // ═══════════════════════════════════════════════════════════════════
  // Intel LGA1700
  [1]:  { socket: "LGA1700", tdp: "65W",  stock_cooler: "yes" },  // i5-14400F
  [11]: { socket: "LGA1700", tdp: "125W", stock_cooler: "no"  },  // i7-14700K
  [13]: { socket: "LGA1700", tdp: "58W",  stock_cooler: "yes" },  // i3-12100F
  [31]: { socket: "LGA1700", tdp: "58W",  stock_cooler: "yes" },  // i3-12100F (dup)
  [32]: { socket: "LGA1700", tdp: "125W", stock_cooler: "no"  },  // i7-14700K (dup)
  [35]: { socket: "LGA1700", tdp: "65W",  stock_cooler: "yes" },  // i5-12400
  [37]: { socket: "LGA1700", tdp: "125W", stock_cooler: "no"  },  // i9-12900K
  [39]: { socket: "LGA1700", tdp: "125W", stock_cooler: "no"  },  // i5-13600KF

  // AMD AM4
  [34]: { socket: "AM4", tdp: "65W",  stock_cooler: "yes" },  // Ryzen 5 5600
  [40]: { socket: "AM4", tdp: "65W",  stock_cooler: "no"  },  // Ryzen 7 5700X

  // AMD AM5
  [2]:  { socket: "AM5", tdp: "65W",  stock_cooler: "yes" },  // Ryzen 5 7600
  [12]: { socket: "AM5", tdp: "120W", stock_cooler: "no"  },  // Ryzen 7 7800X3D
  [33]: { socket: "AM5", tdp: "120W", stock_cooler: "no"  },  // Ryzen 7 7800X3D (dup)
  [36]: { socket: "AM5", tdp: "170W", stock_cooler: "no"  },  // Ryzen 9 7900X
  [38]: { socket: "AM5", tdp: "65W",  stock_cooler: "yes" },  // Ryzen 5 8600G

  // ═══════════════════════════════════════════════════════════════════
  // MAINBOARD (15 SKUs) — Bổ sung: ram_slots, m2_slots
  //   socket, ram_type, form_factor đã có
  // ═══════════════════════════════════════════════════════════════════
  // Intel LGA1700 — DDR4
  [16]: { socket: "LGA1700", ram_type: "DDR4", form_factor: "mATX",  ram_slots: "4", m2_slots: "2" },  // MSI MAG B660M MORTAR WIFI DDR4
  [48]: { socket: "LGA1700", ram_type: "DDR4", form_factor: "mATX",  ram_slots: "2", m2_slots: "1" },  // ASUS Prime H610M-K

  // Intel LGA1700 — DDR5
  [3]:  { socket: "LGA1700", ram_type: "DDR5", form_factor: "mATX",  ram_slots: "2", m2_slots: "1" },  // ASUS Prime B760M-A WIFI DDR5
  [44]: { socket: "LGA1700", ram_type: "DDR5", form_factor: "mATX",  ram_slots: "4", m2_slots: "2" },  // ASUS TUF GAMING B760M-PLUS
  [14]: { socket: "LGA1700", ram_type: "DDR5", form_factor: "ATX",   ram_slots: "4", m2_slots: "4" },  // ASUS ROG STRIX Z790-E GAMING WIFI
  [41]: { socket: "LGA1700", ram_type: "DDR5", form_factor: "ATX",   ram_slots: "4", m2_slots: "5" },  // ASUS ROG MAXIMUS Z790 HERO
  [47]: { socket: "LGA1700", ram_type: "DDR5", form_factor: "ATX",   ram_slots: "4", m2_slots: "4" },  // Gigabyte Z790 AORUS ELITE AX
  [45]: { socket: "LGA1700", ram_type: "DDR5", form_factor: "ATX",   ram_slots: "4", m2_slots: "4" },  // MSI MPG Z790 EDGE WIFI

  // AMD AM4 — DDR4
  [46]: { socket: "AM4", ram_type: "DDR4", form_factor: "mATX",  ram_slots: "4", m2_slots: "2" },  // ASRock B550M Pro4
  [49]: { socket: "AM4", ram_type: "DDR4", form_factor: "ATX",   ram_slots: "4", m2_slots: "2" },  // MSI B550 GAMING GEN3

  // AMD AM5 — DDR5
  [4]:  { socket: "AM5", ram_type: "DDR5", form_factor: "mATX",  ram_slots: "2", m2_slots: "2" },  // MSI PRO B650M-A WIFI
  [15]: { socket: "AM5", ram_type: "DDR5", form_factor: "ATX",   ram_slots: "4", m2_slots: "2" },  // Gigabyte B650 AORUS ELITE AX
  [42]: { socket: "AM5", ram_type: "DDR5", form_factor: "ATX",   ram_slots: "4", m2_slots: "3" },  // MSI MAG B650 TOMAHAWK WIFI
  [43]: { socket: "AM5", ram_type: "DDR5", form_factor: "mATX",  ram_slots: "2", m2_slots: "2" },  // Gigabyte A620M S2H
  [50]: { socket: "AM5", ram_type: "DDR5", form_factor: "ATX",   ram_slots: "4", m2_slots: "3" },  // ROG STRIX X670E-F GAMING WIFI

  // ═══════════════════════════════════════════════════════════════════
  // RAM (15 SKUs) — Bổ sung: speed, capacity
  //   ram_type đã có
  // ═══════════════════════════════════════════════════════════════════
  // DDR4
  [6]:  { ram_type: "DDR4", speed: "3200MHz", capacity: "16GB" },  // Kingston Fury 16GB DDR4 3200
  [18]: { ram_type: "DDR4", speed: "3200MHz", capacity: "16GB" },  // Corsair Vengeance LPX 16GB DDR4 3200
  [52]: { ram_type: "DDR4", speed: "3200MHz", capacity: "16GB" },  // Lexar Thor 16GB DDR4 3200
  [54]: { ram_type: "DDR4", speed: "3600MHz", capacity: "16GB" },  // Corsair Vengeance RGB 16GB DDR4 3600
  [55]: { ram_type: "DDR4", speed: "3200MHz", capacity: "8GB"  },  // Kingston Fury Beast 8GB DDR4 3200
  [57]: { ram_type: "DDR4", speed: "3200MHz", capacity: "16GB" },  // G.Skill Ripjaws V 16GB DDR4 3200
  [60]: { ram_type: "DDR4", speed: "3200MHz", capacity: "32GB" },  // Crucial Pro 32GB DDR4 3200

  // DDR5
  [5]:  { ram_type: "DDR5", speed: "5600MHz", capacity: "16GB" },  // Corsair Vengeance 16GB DDR5 5600
  [17]: { ram_type: "DDR5", speed: "6000MHz", capacity: "32GB" },  // G.Skill Trident Z5 RGB 32GB DDR5 6000
  [19]: { ram_type: "DDR5", speed: "6000MHz", capacity: "32GB" },  // TeamGroup T-Force Delta RGB 32GB DDR5
  [51]: { ram_type: "DDR5", speed: "6000MHz", capacity: "32GB" },  // TeamGroup T-Force Delta RGB 32GB DDR5 6000
  [53]: { ram_type: "DDR5", speed: "6400MHz", capacity: "32GB" },  // G.Skill Trident Z5 RGB 32GB DDR5 6400
  [56]: { ram_type: "DDR5", speed: "4800MHz", capacity: "16GB" },  // TeamGroup Elite 16GB DDR5 4800
  [58]: { ram_type: "DDR5", speed: "7200MHz", capacity: "32GB" },  // Corsair Dominator Titanium 32GB DDR5 7200
  [59]: { ram_type: "DDR5", speed: "6000MHz", capacity: "32GB" },  // Lexar Ares RGB 32GB DDR5 6000

  // ═══════════════════════════════════════════════════════════════════
  // GPU (14 SKUs) — Hoàn toàn mới: gpu_length, tdp, vram, pcie_slot
  // ═══════════════════════════════════════════════════════════════════
  [7]:  { gpu_length: "240mm", tdp: "115W",  vram: "8GB",  pcie_slot: "x16" },  // NVIDIA RTX 4060 8GB
  [20]: { gpu_length: "285mm", tdp: "220W",  vram: "12GB", pcie_slot: "x16" },  // NVIDIA RTX 4070 SUPER 12GB
  [22]: { gpu_length: "336mm", tdp: "450W",  vram: "24GB", pcie_slot: "x16" },  // NVIDIA RTX 4090 24GB Founders Edition
  [21]: { gpu_length: "287mm", tdp: "263W",  vram: "16GB", pcie_slot: "x16" },  // AMD Radeon RX 7800 XT 16GB
  [61]: { gpu_length: "285mm", tdp: "263W",  vram: "16GB", pcie_slot: "x16" },  // Sapphire PULSE RX 7800 XT 16GB
  [62]: { gpu_length: "358mm", tdp: "320W",  vram: "16GB", pcie_slot: "x16" },  // ASUS ProArt RTX 4080 SUPER 16GB
  [63]: { gpu_length: "268mm", tdp: "170W",  vram: "12GB", pcie_slot: "x16" },  // MSI GeForce RTX 3060 Ventus 2X 12GB
  [64]: { gpu_length: "345mm", tdp: "285W",  vram: "16GB", pcie_slot: "x16" },  // Gigabyte RTX 4070 Ti SUPER Gaming OC
  [65]: { gpu_length: "212mm", tdp: "165W",  vram: "8GB",  pcie_slot: "x16" },  // PowerColor Hellhound RX 7600 8GB
  [66]: { gpu_length: "355mm", tdp: "450W",  vram: "24GB", pcie_slot: "x16" },  // ASUS ROG Strix RTX 4090 OC Edition
  [67]: { gpu_length: "325mm", tdp: "355W",  vram: "24GB", pcie_slot: "x16" },  // Sapphire NITRO+ RX 7900 XTX 24GB
  [68]: { gpu_length: "306mm", tdp: "165W",  vram: "8GB",  pcie_slot: "x16" },  // MSI GeForce RTX 4060 Ti Gaming X 8GB
  [69]: { gpu_length: "232mm", tdp: "132W",  vram: "8GB",  pcie_slot: "x16" },  // Gigabyte Radeon RX 6600 Eagle 8GB
  [70]: { gpu_length: "302mm", tdp: "220W",  vram: "12GB", pcie_slot: "x16" },  // ASUS Dual RTX 4070 SUPER 12GB

  // ═══════════════════════════════════════════════════════════════════
  // PSU (14 SKUs) — Bổ sung: efficiency, psu_wattage (chuẩn key)
  //   wattage đã có (nhưng key sai: "wattage" thay vì "psu_wattage")
  //   → Thêm "efficiency" và "psu_wattage" (alias đúng cho engine)
  // ═══════════════════════════════════════════════════════════════════
  [9]:  { psu_wattage: "650W",  efficiency: "80Plus Bronze" },  // Cooler Master MWE 650 Bronze V2
  [26]: { psu_wattage: "850W",  efficiency: "80Plus Gold"   },  // Corsair RM850x 80 Plus Gold
  [27]: { psu_wattage: "750W",  efficiency: "80Plus Gold"   },  // EVGA SuperNOVA 750 GT
  [28]: { psu_wattage: "1000W", efficiency: "80Plus Gold"   },  // MSI MPG A1000G PCIE5
  [81]: { psu_wattage: "1000W", efficiency: "80Plus Gold"   },  // Deepcool PX1000G 1000W Gold
  [82]: { psu_wattage: "750W",  efficiency: "80Plus Gold"   },  // Seasonic Focus GX-750
  [83]: { psu_wattage: "850W",  efficiency: "80Plus Gold"   },  // MSI MPG A850G PCIE5
  [84]: { psu_wattage: "1200W", efficiency: "80Plus Gold"   },  // Corsair RM1200x Shift Gold
  [85]: { psu_wattage: "550W",  efficiency: "80Plus Bronze" },  // Cooler Master MWE 550 Bronze V2
  [86]: { psu_wattage: "1000W", efficiency: "80Plus Platinum" }, // Be Quiet! Straight Power 12 1000W
  [87]: { psu_wattage: "750W",  efficiency: "80Plus Platinum" }, // SilverStone SX750 Platinum SFX
  [88]: { psu_wattage: "650W",  efficiency: "80Plus Bronze" },  // Deepcool PK650D Bronze
  [89]: { psu_wattage: "1600W", efficiency: "80Plus Titanium" }, // Seasonic Prime TX-1600 Titanium
  [90]: { psu_wattage: "650W",  efficiency: "80Plus Bronze" },  // Corsair CX650 Bronze

  // ═══════════════════════════════════════════════════════════════════
  // CASE (13 SKUs) — Bổ sung: case_gpu_clearance, case_radiator_support,
  //                           case_cooler_clearance
  //   form_factor đã có (phần lớn)
  // ═══════════════════════════════════════════════════════════════════
  // Mid Tower / Full Tower
  [10]: { form_factor: "ATX",   case_gpu_clearance: "380mm", case_radiator_support: "240mm", case_cooler_clearance: "155mm" },  // Cooler Master CMP 520
  [29]: { form_factor: "ATX",   case_gpu_clearance: "375mm", case_radiator_support: "360mm", case_cooler_clearance: "185mm" },  // NZXT H7 Flow Black
  [30]: { form_factor: "ATX",   case_gpu_clearance: "446mm", case_radiator_support: "360mm", case_cooler_clearance: "167mm" },  // Lian Li O11 Dynamic EVO Black
  [91]: { form_factor: "ATX",   case_gpu_clearance: "446mm", case_radiator_support: "360mm", case_cooler_clearance: "167mm" },  // Lian Li O11 Dynamic EVO Black (dup)
  [92]: { form_factor: "ATX",   case_gpu_clearance: "365mm", case_radiator_support: "360mm", case_cooler_clearance: "170mm" },  // NZXT H6 Flow Black
  [93]: { form_factor: "ATX",   case_gpu_clearance: "400mm", case_radiator_support: "360mm", case_cooler_clearance: "175mm" },  // Deepcool CH560 Digital
  [94]: { form_factor: "ATX",   case_gpu_clearance: "410mm", case_radiator_support: "360mm", case_cooler_clearance: "170mm" },  // Cooler Master TD500 Mesh V2
  [95]: { form_factor: "ATX",   case_gpu_clearance: "430mm", case_radiator_support: "360mm", case_cooler_clearance: "190mm" },  // Corsair 5000D Airflow White
  [96]: { form_factor: "ATX",   case_gpu_clearance: "480mm", case_radiator_support: "420mm", case_cooler_clearance: "195mm" },  // Phanteks NV7 Black
  [97]: { form_factor: "ATX",   case_gpu_clearance: "400mm", case_radiator_support: "360mm", case_cooler_clearance: "180mm" },  // Lian Li Lancool 216 RGB
  [99]: { form_factor: "ATX",   case_gpu_clearance: "450mm", case_radiator_support: "420mm", case_cooler_clearance: "187mm" },  // Be Quiet! Shadow Base 800 DX

  // Mini-ITX
  [98]: { form_factor: "ITX",   case_gpu_clearance: "322mm", case_radiator_support: "120mm", case_cooler_clearance: "65mm"  },  // NZXT H210 Mini-ITX Black

  // mATX
  [100]:{ form_factor: "mATX",  case_gpu_clearance: "320mm", case_radiator_support: "240mm", case_cooler_clearance: "160mm" },  // Deepcool Matrexx 40 3FS

  // ═══════════════════════════════════════════════════════════════════
  // STORAGE (14 SKUs) — Bổ sung: interface, capacity
  //   storage_type đã có
  // ═══════════════════════════════════════════════════════════════════
  [8]:  { storage_type: "NVMe", interface: "PCIe Gen4 x4", capacity: "1TB"  },  // Samsung 990 EVO 1TB
  [23]: { storage_type: "NVMe", interface: "PCIe Gen4 x4", capacity: "1TB"  },  // WD Black SN850X 1TB
  [24]: { storage_type: "NVMe", interface: "PCIe Gen4 x4", capacity: "2TB"  },  // Crucial P3 Plus 2TB
  [25]: { storage_type: "NVMe", interface: "PCIe Gen4 x4", capacity: "2TB"  },  // Samsung 980 Pro 2TB
  [71]: { storage_type: "NVMe", interface: "PCIe Gen4 x4", capacity: "2TB"  },  // Lexar NM790 2TB Gen4
  [72]: { storage_type: "NVMe", interface: "PCIe Gen4 x4", capacity: "4TB"  },  // Samsung 990 Pro 4TB NVMe
  [73]: { storage_type: "HDD",  interface: "SATA",          capacity: "4TB"  },  // WD Blue 4TB HDD
  [74]: { storage_type: "NVMe", interface: "PCIe Gen5 x4", capacity: "1TB"  },  // Crucial T705 1TB Gen5
  [75]: { storage_type: "NVMe", interface: "PCIe Gen4 x4", capacity: "1TB"  },  // Kingston NV2 1TB Gen4
  [76]: { storage_type: "HDD",  interface: "SATA",          capacity: "8TB"  },  // Seagate IronWolf 8TB NAS
  [77]: { storage_type: "SATA SSD", interface: "SATA",     capacity: "1TB"  },  // Samsung 870 EVO 1TB SATA
  [78]: { storage_type: "NVMe", interface: "PCIe Gen4 x4", capacity: "2TB"  },  // TeamGroup MP44 2TB Gen4
  [79]: { storage_type: "NVMe", interface: "PCIe Gen4 x4", capacity: "2TB"  },  // WD Black SN850X 2TB
  [80]: { storage_type: "SATA SSD", interface: "SATA",     capacity: "500GB" }, // Crucial MX500 500GB SATA
};

// ─── Note: Cooling category was NOT in the DB categories returned ─────────────
// If COOLING products exist with different category name, add here.
// Pattern would be:
// [sku_id]: { socket_support: "LGA1700,AM5,AM4", cooling_capacity: "250W", radiator_size: "240mm", cooler_height: "0mm", cooling_type: "AIO" }

// ─── Helper: Upsert attribute ─────────────────────────────────────────────────
async function getOrCreateAttribute(conn: any, name: string): Promise<number> {
  const [rows] = await conn.execute(
    "SELECT id FROM attributes WHERE name = ? LIMIT 1",
    [name]
  );
  if ((rows as any[]).length > 0) return (rows as any[])[0].id;
  const [result] = await conn.execute(
    "INSERT INTO attributes (name) VALUES (?)",
    [name]
  );
  return (result as any).insertId;
}

// ─── Helper: Upsert attribute_value ──────────────────────────────────────────
async function getOrCreateAttributeValue(conn: any, attributeId: number, value: string): Promise<number> {
  const [rows] = await conn.execute(
    "SELECT id FROM attribute_values WHERE attribute_id = ? AND value = ? LIMIT 1",
    [attributeId, value]
  );
  if ((rows as any[]).length > 0) return (rows as any[])[0].id;
  const [result] = await conn.execute(
    "INSERT INTO attribute_values (attribute_id, value) VALUES (?, ?)",
    [attributeId, value]
  );
  return (result as any).insertId;
}

// ─── Helper: Upsert sku_attribute ─────────────────────────────────────────────
async function upsertSkuAttribute(conn: any, skuId: number, attributeValueId: number): Promise<void> {
  // Check if this sku already has a value for this attribute (via join)
  const [existing] = await conn.execute(
    `SELECT sa.id FROM sku_attributes sa
     JOIN attribute_values av ON av.id = sa.attribute_value_id
     WHERE sa.sku_id = ? AND av.attribute_id = ?
     LIMIT 1`,
    [skuId, /* will need attribute_id */ (await conn.execute("SELECT attribute_id FROM attribute_values WHERE id = ? LIMIT 1", [attributeValueId]) as any)[0]?.[0]?.attribute_id || 0]
  );
  if ((existing as any[]).length > 0) {
    // Update existing
    await conn.execute(
      "UPDATE sku_attributes SET attribute_value_id = ? WHERE id = ?",
      [attributeValueId, (existing as any[])[0].id]
    );
  } else {
    await conn.execute(
      "INSERT INTO sku_attributes (sku_id, attribute_value_id) VALUES (?, ?)",
      [skuId, attributeValueId]
    );
  }
}

// ─── Main Seed ─────────────────────────────────────────────────────────────────
async function seed() {
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log("✅ Connected to DB:", DB_CONFIG.database);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const skuIds = Object.keys(SKU_SPECS).map(Number);
  console.log(`\n📋 Processing ${skuIds.length} SKUs with spec data...\n`);

  // Cache attribute ids
  const attrIdCache: Record<string, number> = {};
  const attrValIdCache: Record<string, number> = {};

  for (const skuId of skuIds) {
    const specs = SKU_SPECS[skuId];
    const specEntries = Object.entries(specs);

    // Verify SKU exists
    const [skuRows] = await conn.execute(
      "SELECT s.id, p.name FROM product_skus s JOIN products p ON p.id = s.product_id WHERE s.id = ? LIMIT 1",
      [skuId]
    );
    if ((skuRows as any[]).length === 0) {
      console.warn(`  ⚠️  SKU[${skuId}] not found in DB — skipping`);
      skipped++;
      continue;
    }
    const productName = (skuRows as any[])[0].name;

    process.stdout.write(`  SKU[${skuId}] ${productName.substring(0, 45).padEnd(45)} `);

    try {
      for (const [attrName, attrValue] of specEntries) {
        // Get or create attribute
        if (!attrIdCache[attrName]) {
          attrIdCache[attrName] = await getOrCreateAttribute(conn, attrName);
        }
        const attributeId = attrIdCache[attrName];

        // Get or create attribute value
        const cacheKey = `${attributeId}:${attrValue}`;
        if (!attrValIdCache[cacheKey]) {
          attrValIdCache[cacheKey] = await getOrCreateAttributeValue(conn, attributeId, attrValue);
        }
        const attributeValueId = attrValIdCache[cacheKey];

        // Upsert sku_attributes
        const [existingRows] = await conn.execute(
          `SELECT sa.id FROM sku_attributes sa
           JOIN attribute_values av ON av.id = sa.attribute_value_id
           WHERE sa.sku_id = ? AND av.attribute_id = ?
           LIMIT 1`,
          [skuId, attributeId]
        );

        if ((existingRows as any[]).length > 0) {
          const existingId = (existingRows as any[])[0].id;
          await conn.execute(
            "UPDATE sku_attributes SET attribute_value_id = ? WHERE id = ?",
            [attributeValueId, existingId]
          );
          updated++;
        } else {
          await conn.execute(
            "INSERT INTO sku_attributes (sku_id, attribute_value_id) VALUES (?, ?)",
            [skuId, attributeValueId]
          );
          inserted++;
        }
      }
      console.log(`✅ ${specEntries.length} attrs`);
    } catch (err: any) {
      console.log(`❌ ERROR: ${(err as Error).message}`);
      errors++;
    }
  }

  console.log("\n══════════════════════════════════════════════════");
  console.log("   SEEDER COMPLETED");
  console.log("══════════════════════════════════════════════════");
  console.log(`  ✅ Inserted: ${inserted}`);
  console.log(`  🔄 Updated:  ${updated}`);
  console.log(`  ⏭️  Skipped:  ${skipped}`);
  console.log(`  ❌ Errors:   ${errors}`);
  console.log(`  📊 Total SKUs processed: ${skuIds.length - skipped - errors}`);

  // Post-seed verification
  console.log("\n── Post-Seed Verification ──────────────────────");
  const checkAttrs = ["socket", "tdp", "gpu_length", "psu_wattage", "case_gpu_clearance", "cooling_capacity"];
  for (const attrName of checkAttrs) {
    const [countRows] = await conn.execute(
      `SELECT COUNT(DISTINCT sa.sku_id) as cnt
       FROM sku_attributes sa
       JOIN attribute_values av ON av.id = sa.attribute_value_id
       JOIN attributes a ON a.id = av.attribute_id
       WHERE a.name = ?`,
      [attrName]
    );
    const cnt = (countRows as any[])[0]?.cnt || 0;
    console.log(`  ${attrName.padEnd(22)}: ${cnt} SKUs now have this attribute`);
  }

  await conn.end();
  console.log("\n✅ DB connection closed. Seeder done!");
}

seed().catch((err) => {
  console.error("❌ Seeder failed:", err);
  process.exit(1);
});
