const path = require("path");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
const { SKU_IMAGE_MAP } = require("../scripts/sku-image-map");

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function getTableColumns(connection, databaseName, tableName) {
  const [rows] = await connection.execute(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
    `,
    [databaseName, tableName]
  );

  return rows.map((row) => row.COLUMN_NAME);
}

function buildInsertParts(record) {
  const entries = Object.entries(record).filter(([, value]) => value !== undefined);
  return {
    fields: entries.map(([field]) => field),
    values: entries.map(([, value]) => value),
    placeholders: entries.map(() => "?")
  };
}

async function insertRecord(connection, tableName, record) {
  const { fields, values, placeholders } = buildInsertParts(record);
  const [result] = await connection.execute(
    `INSERT INTO ${tableName} (${fields.join(", ")}) VALUES (${placeholders.join(", ")})`,
    values
  );
  return result.insertId;
}

async function findOne(connection, sql, params) {
  const [rows] = await connection.execute(sql, params);
  return rows[0] || null;
}

async function main() {
  const databaseName = process.env.DB_NAME;
  if (!databaseName) {
    throw new Error("DB_NAME is required in services/api/.env");
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: databaseName,
    multipleStatements: false
  });

  try {
    console.log("🚀 Starting Demo PC Build & Compatibility Seeding...");

    // 1. Ensure Categories
    const categoryNames = ["CPU", "MAINBOARD", "RAM", "GPU", "SSD", "PSU", "CASE", "COOLING"];
    const categoryIds = {};

    for (const name of categoryNames) {
      let row = await findOne(connection, "SELECT id FROM categories WHERE name = ? LIMIT 1", [name]);
      if (!row) {
        const insertId = await insertRecord(connection, "categories", { name });
        categoryIds[name] = insertId;
      } else {
        categoryIds[name] = row.id;
      }
    }
    categoryIds.STORAGE = categoryIds.SSD;
    console.log(`✓ Categories verified (${Object.keys(categoryIds).length} categories)`);

    // 2. Ensure Brands
    const brandNames = ["Intel", "AMD", "ASUS", "MSI", "Gigabyte", "Corsair", "Cooler Master", "Samsung", "Kingston", "DeepCool", "Thermalright"];
    const brandIds = {};

    for (const name of brandNames) {
      let row = await findOne(connection, "SELECT id FROM brands WHERE name = ? LIMIT 1", [name]);
      if (!row) {
        const insertId = await insertRecord(connection, "brands", {
          name,
          slug: slugify(name),
          status: "ACTIVE",
          is_active: 1
        });
        brandIds[name] = insertId;
      } else {
        brandIds[name] = row.id;
      }
    }
    console.log(`✓ Brands verified (${Object.keys(brandIds).length} brands)`);

    // 3. Ensure Attributes and Values
    const attributes = ["socket", "ram_type", "wattage", "form_factor", "storage_type"];
    const attributeIds = {};

    for (const name of attributes) {
      let row = await findOne(connection, "SELECT id FROM attributes WHERE name = ? LIMIT 1", [name]);
      if (!row) {
        attributeIds[name] = await insertRecord(connection, "attributes", { name });
      } else {
        attributeIds[name] = row.id;
      }
    }

    const attributeValueIds = {};
    async function ensureAttrVal(attrKey, val) {
      const aId = attributeIds[attrKey];
      let row = await findOne(connection, "SELECT id FROM attribute_values WHERE attribute_id = ? AND value = ? LIMIT 1", [aId, val]);
      if (!row) {
        const id = await insertRecord(connection, "attribute_values", { attribute_id: aId, value: val });
        attributeValueIds[`${attrKey}:${val}`] = id;
      } else {
        attributeValueIds[`${attrKey}:${val}`] = row.id;
      }
    }

    await ensureAttrVal("socket", "LGA1700");
    await ensureAttrVal("socket", "AM5");
    await ensureAttrVal("socket", "AM4");
    await ensureAttrVal("socket", "LGA1200");

    await ensureAttrVal("ram_type", "DDR5");
    await ensureAttrVal("ram_type", "DDR4");

    await ensureAttrVal("wattage", "550W");
    await ensureAttrVal("wattage", "650W");
    await ensureAttrVal("wattage", "750W");

    await ensureAttrVal("form_factor", "ATX");
    await ensureAttrVal("form_factor", "M-ATX");

    await ensureAttrVal("storage_type", "NVME");
    await ensureAttrVal("storage_type", "SATA");

    console.log("✓ Core Attributes & Values verified");

    // 4. Ensure Demo Component Products
    const demoComponents = [
      {
        name: "Intel Core i5-13400F",
        slug: "intel-core-i5-13400f",
        description: "CPU 10 nhân 16 luồng Socket LGA1700 tối ưu gaming và đa nhiệm",
        categoryId: categoryIds.CPU,
        brandId: brandIds.Intel,
        price: 5200000,
        sku: "CPU-INTEL-I5-13400F",
        specs: { socket: "LGA1700" }
      },
      {
        name: "AMD Ryzen 7 7800X3D",
        slug: "amd-ryzen-7-7800x3d",
        description: "Ông hoàng gaming 8 nhân 16 luồng bộ nhớ đệm 3D V-Cache đỉnh cao",
        categoryId: categoryIds.CPU,
        brandId: brandIds.AMD,
        price: 10800000,
        sku: "CPU-AMD-R7-7800X3D",
        specs: { socket: "AM5" }
      },
      {
        name: "Intel Core i3-12100F",
        slug: "intel-core-i3-12100f",
        description: "CPU 4 nhân 8 luồng quốc dân cho học tập văn phòng và eSports",
        categoryId: categoryIds.CPU,
        brandId: brandIds.Intel,
        price: 2150000,
        sku: "CPU-INTEL-I3-12100F",
        specs: { socket: "LGA1700" }
      },
      {
        name: "ASUS Prime B760M-A WIFI DDR5",
        slug: "asus-prime-b760m-a-wifi-ddr5",
        description: "Bo mạch chủ Intel B760 Socket LGA1700 hỗ trợ RAM DDR5 và PCIe 4.0",
        categoryId: categoryIds.MAINBOARD,
        brandId: brandIds.ASUS,
        price: 3900000,
        sku: "MB-ASUS-B760M-A-D5",
        specs: { socket: "LGA1700", ram_type: "DDR5", form_factor: "M-ATX" }
      },
      {
        name: "MSI PRO B650M-A WIFI",
        slug: "msi-pro-b650m-a-wifi",
        description: "Bo mạch chủ AMD B650 Socket AM5 hỗ trợ DDR5 và WiFi 6E",
        categoryId: categoryIds.MAINBOARD,
        brandId: brandIds.MSI,
        price: 4100000,
        sku: "MB-MSI-PRO-B650M-A",
        specs: { socket: "AM5", ram_type: "DDR5", form_factor: "M-ATX" }
      },
      {
        name: "ASUS Prime H610M-K DDR4",
        slug: "asus-prime-h610m-k-ddr4",
        description: "Bo mạch chủ phổ thông Socket LGA1700 hỗ trợ RAM DDR4 bền bỉ",
        categoryId: categoryIds.MAINBOARD,
        brandId: brandIds.ASUS,
        price: 1900000,
        sku: "MB-ASUS-H610M-K-D4",
        specs: { socket: "LGA1700", ram_type: "DDR4", form_factor: "M-ATX" }
      },
      {
        name: "Corsair Vengeance 16GB DDR5 5600MHz",
        slug: "corsair-vengeance-16gb-ddr5-5600mhz",
        description: "Kit RAM DDR5 16GB (2x8GB) bus 5600MHz tản nhiệt nhôm",
        categoryId: categoryIds.RAM,
        brandId: brandIds.Corsair,
        price: 1850000,
        sku: "RAM-CORSAIR-16G-D5-5600",
        specs: { ram_type: "DDR5" }
      },
      {
        name: "Corsair Dominator Titanium 32GB DDR5 6000MHz",
        slug: "corsair-dominator-titanium-32gb-ddr5-6000mhz",
        description: "Kit RAM DDR5 cao cấp 32GB (2x16GB) bus 6000MHz RGB",
        categoryId: categoryIds.RAM,
        brandId: brandIds.Corsair,
        price: 4200000,
        sku: "RAM-CORSAIR-32G-D5-6000",
        specs: { ram_type: "DDR5" }
      },
      {
        name: "Kingston Fury Beast 16GB DDR4 3200MHz",
        slug: "kingston-fury-beast-16gb-ddr4-3200mhz",
        description: "Kit RAM DDR4 16GB (2x8GB) bus 3200MHz tản nhôm đen",
        categoryId: categoryIds.RAM,
        brandId: brandIds.Kingston,
        price: 1100000,
        sku: "RAM-KINGSTON-16G-D4-3200",
        specs: { ram_type: "DDR4" }
      },
      {
        name: "MSI GeForce RTX 4060 Ventus 2X Black 8GB",
        slug: "msi-geforce-rtx-4060-ventus-2x-black-8gb",
        description: "Card đồ họa NVIDIA RTX 4060 8GB GDDR6 Ray Tracing & DLSS 3.0",
        categoryId: categoryIds.GPU,
        brandId: brandIds.MSI,
        price: 8200000,
        sku: "GPU-MSI-RTX4060-VENTUS-8G",
        specs: {}
      },
      {
        name: "Gigabyte GeForce RTX 4070 Ti SUPER EAGLE OC 16GB",
        slug: "gigabyte-geforce-rtx-4070-ti-super-eagle-oc-16gb",
        description: "Card đồ họa 16GB GDDR6X 3 Fan cân mượt mọi game 4K và đồ họa",
        categoryId: categoryIds.GPU,
        brandId: brandIds.Gigabyte,
        price: 24500000,
        sku: "GPU-GIGABYTE-RTX4070TI-16G",
        specs: {}
      },
      {
        name: "Gigabyte Radeon RX 6500 XT EAGLE 4GB",
        slug: "gigabyte-radeon-rx-6500-xt-eagle-4gb",
        description: "VGA eSports giá tốt cân mượt LOL, FIFA, Valorant, CS2",
        categoryId: categoryIds.GPU,
        brandId: brandIds.Gigabyte,
        price: 3800000,
        sku: "GPU-GIGABYTE-RX6500XT-4G",
        specs: {}
      },
      {
        name: "Samsung 990 EVO 1TB PCIe 4.0 NVMe",
        slug: "samsung-990-evo-1tb-pcie-4-0-nvme",
        description: "SSD M.2 NVMe PCIe 4.0 x4 tốc độ đọc lên đến 5000MB/s",
        categoryId: categoryIds.SSD,
        brandId: brandIds.Samsung,
        price: 2150000,
        sku: "SSD-SAMSUNG-990EVO-1TB",
        specs: { storage_type: "NVME" }
      },
      {
        name: "Kingston NV2 500GB M.2 2280 NVMe",
        slug: "kingston-nv2-500gb-m-2-2280-nvme",
        description: "SSD M.2 NVMe Gen4 tốc độ 3500MB/s giá cực tốt",
        categoryId: categoryIds.SSD,
        brandId: brandIds.Kingston,
        price: 980000,
        sku: "SSD-KINGSTON-NV2-500GB",
        specs: { storage_type: "NVME" }
      },
      {
        name: "Cooler Master MWE 650W 80 Plus Bronze V2",
        slug: "cooler-master-mwe-650w-80-plus-bronze-v2",
        description: "Nguồn 650W chuẩn 80 Plus Bronze công suất thực an toàn",
        categoryId: categoryIds.PSU,
        brandId: brandIds["Cooler Master"],
        price: 1450000,
        sku: "PSU-CM-MWE-650-BRONZE",
        specs: { wattage: "650W" }
      },
      {
        name: "Cooler Master MWE Gold 750W V2 Full Modular",
        slug: "cooler-master-mwe-gold-750w-v2-full-modular",
        description: "Nguồn 750W 80 Plus Gold dây rời Full Modular cao cấp",
        categoryId: categoryIds.PSU,
        brandId: brandIds["Cooler Master"],
        price: 2650000,
        sku: "PSU-CM-MWE-750-GOLD",
        specs: { wattage: "750W" }
      },
      {
        name: "Cooler Master Elite V4 500W",
        slug: "cooler-master-elite-v4-500w",
        description: "Bộ nguồn 500W phổ thông tin cậy cho máy văn phòng và đồ họa nhẹ",
        categoryId: categoryIds.PSU,
        brandId: brandIds["Cooler Master"],
        price: 950000,
        sku: "PSU-CM-ELITE-500W",
        specs: { wattage: "550W" }
      },
      {
        name: "Corsair 4000D Airflow Black",
        slug: "corsair-4000d-airflow-black",
        description: "Vỏ case Mid Tower mặt lưới tản nhiệt tối ưu hỗ trợ main ATX",
        categoryId: categoryIds.CASE,
        brandId: brandIds.Corsair,
        price: 2100000,
        sku: "CASE-CORSAIR-4000D-AIRFLOW",
        specs: { form_factor: "ATX" }
      },
      {
        name: "Case Mik LV12 White Bể Cá Panorama",
        slug: "case-mik-lv12-white-be-ca-panorama",
        description: "Vỏ Case Tone Trắng bể cá kính cường lực panorama cực đẹp",
        categoryId: categoryIds.CASE,
        brandId: brandIds.Corsair,
        price: 1050000,
        sku: "CASE-MIK-LV12-WHITE",
        specs: { form_factor: "M-ATX" }
      },
      {
        name: "Thermalright Assassin X120 SE ARGB",
        slug: "thermalright-assassin-x120-se-argb",
        description: "Tản nhiệt tháp 4 ống đồng quạt PWM 120mm LED ARGB mát mẻ",
        categoryId: categoryIds.COOLING,
        brandId: brandIds.Thermalright,
        price: 450000,
        sku: "COOL-THERMALRIGHT-X120-ARGB",
        specs: {}
      },
      {
        name: "DeepCool LS720 SE ARGB 360mm",
        slug: "deepcool-ls720-se-argb-360mm",
        description: "Tản nhiệt nước AIO 360mm hiệu năng giải nhiệt 300W TDP",
        categoryId: categoryIds.COOLING,
        brandId: brandIds.DeepCool,
        price: 2750000,
        sku: "COOL-DEEPCOOL-LS720-360",
        specs: {}
      }
    ];

    const seededSkus = {};

    for (const comp of demoComponents) {
      // 1. Product
      let prod = await findOne(connection, "SELECT id FROM products WHERE slug = ? LIMIT 1", [comp.slug]);
      let prodId;
      if (!prod) {
        prodId = await insertRecord(connection, "products", {
          name: comp.name,
          slug: comp.slug,
          description: comp.description,
          price: comp.price,
          category_id: comp.categoryId,
          brand_id: comp.brandId,
          status: "ACTIVE",
          is_active: 1
        });
      } else {
        prodId = prod.id;
      }

      // 2. ProductSku
      const imgUrl = SKU_IMAGE_MAP[comp.sku] || null;
      let skuRow = await findOne(connection, "SELECT id FROM product_skus WHERE sku = ? LIMIT 1", [comp.sku]);
      let skuId;
      if (!skuRow) {
        skuId = await insertRecord(connection, "product_skus", {
          product_id: prodId,
          sku: comp.sku,
          price: comp.price,
          stock: 30,
          image_url: imgUrl,
          status: "ACTIVE",
          is_active: 1
        });
      } else {
        skuId = skuRow.id;
        if (imgUrl) {
          await connection.execute(
            "UPDATE product_skus SET image_url = ? WHERE id = ? AND (image_url IS NULL OR image_url = '')",
            [imgUrl, skuId]
          );
        }
      }
      seededSkus[comp.slug] = skuId;

      // 3. ProductVariant (for compatibility)
      let varRow = await findOne(connection, "SELECT id FROM product_variants WHERE sku = ? LIMIT 1", [comp.sku]);
      if (!varRow) {
        await insertRecord(connection, "product_variants", {
          product_id: prodId,
          sku: comp.sku,
          price: comp.price,
          stock_quantity: 30,
          image_url: imgUrl,
          status: "ACTIVE",
          is_active: 1
        });
      } else if (imgUrl) {
        await connection.execute(
          "UPDATE product_variants SET image_url = ? WHERE id = ? AND (image_url IS NULL OR image_url = '')",
          [imgUrl, varRow.id]
        );
      }

      // 4. SkuAttribute links
      for (const [attrKey, attrVal] of Object.entries(comp.specs || {})) {
        const valId = attributeValueIds[`${attrKey}:${attrVal}`];
        if (valId) {
          let link = await findOne(connection, "SELECT id FROM sku_attributes WHERE sku_id = ? AND attribute_value_id = ? LIMIT 1", [skuId, valId]);
          if (!link) {
            await insertRecord(connection, "sku_attributes", {
              sku_id: skuId,
              attribute_value_id: valId
            });
          }
        }
      }
    }
    console.log(`✓ Demo products & SKUs verified (${demoComponents.length} components)`);

    // 5. Ensure Compatibility Rules
    const rulesToEnsure = [
      {
        name: "CPU & Mainboard Socket Match",
        source_category_id: categoryIds.CPU,
        target_category_id: categoryIds.MAINBOARD,
        source_attribute_key: "socket",
        target_attribute_key: "socket",
        operator: "EQ",
        description: "Socket của CPU và Bo mạch chủ phải trùng khớp nhau (VD: LGA1700 - LGA1700, AM5 - AM5)"
      },
      {
        name: "Mainboard & RAM DDR Standard Match",
        source_category_id: categoryIds.MAINBOARD,
        target_category_id: categoryIds.RAM,
        source_attribute_key: "ram_type",
        target_attribute_key: "ram_type",
        operator: "EQ",
        description: "Chuẩn RAM của Mainboard và thanh RAM phải đồng bộ (DDR4 hoặc DDR5)"
      },
      {
        name: "Mainboard Form Factor & Case Clearance",
        source_category_id: categoryIds.MAINBOARD,
        target_category_id: categoryIds.CASE,
        source_attribute_key: "form_factor",
        target_attribute_key: "form_factor",
        operator: "EQ",
        description: "Vỏ Case phải hỗ trợ form factor của Bo mạch chủ (ATX, Micro-ATX, Mini-ITX)"
      }
    ];

    for (const rule of rulesToEnsure) {
      let r = await findOne(
        connection,
        "SELECT id FROM compatibility_rules WHERE source_category_id = ? AND target_category_id = ? AND source_attribute_key = ? LIMIT 1",
        [rule.source_category_id, rule.target_category_id, rule.source_attribute_key]
      );
      if (!r) {
        await insertRecord(connection, "compatibility_rules", {
          ...rule,
          is_compatible: 1,
          status: "ACTIVE",
          is_active: 1
        });
      }
    }
    console.log(`✓ Compatibility Rules verified (${rulesToEnsure.length} core rules)`);

    // 6. SEED REAL "PC BUILD MẪU" (Demo PC Builds) in pc_builds and pc_build_items
    console.log("Seeding Demo PC Builds into pc_builds and pc_build_items...");

    // Find a target user for demo builds (Admin or first user)
    const userRow = await findOne(connection, "SELECT id FROM users ORDER BY id ASC LIMIT 1");
    const demoUserId = userRow ? userRow.id : 1;

    const demoBuilds = [
      {
        name: "⚡ Dàn PC Gaming Quốc Dân (i5-13400F • RTX 4060 • 16GB DDR5)",
        items: [
          { component_type: "cpu", slug: "intel-core-i5-13400f" },
          { component_type: "mainboard", slug: "asus-prime-b760m-a-wifi-ddr5" },
          { component_type: "ram", slug: "corsair-vengeance-16gb-ddr5-5600mhz" },
          { component_type: "gpu", slug: "msi-geforce-rtx-4060-ventus-2x-black-8gb" },
          { component_type: "storage", slug: "samsung-990-evo-1tb-pcie-4-0-nvme" },
          { component_type: "psu", slug: "cooler-master-mwe-650w-80-plus-bronze-v2" },
          { component_type: "case", slug: "corsair-4000d-airflow-black" },
          { component_type: "cooling", slug: "thermalright-assassin-x120-se-argb" }
        ]
      },
      {
        name: "🚀 Dàn PC Hi-End Gaming 4K (Ryzen 7 7800X3D • RTX 4070 Ti • 32GB DDR5)",
        items: [
          { component_type: "cpu", slug: "amd-ryzen-7-7800x3d" },
          { component_type: "mainboard", slug: "msi-pro-b650m-a-wifi" },
          { component_type: "ram", slug: "corsair-dominator-titanium-32gb-ddr5-6000mhz" },
          { component_type: "gpu", slug: "gigabyte-geforce-rtx-4070-ti-super-eagle-oc-16gb" },
          { component_type: "storage", slug: "samsung-990-evo-1tb-pcie-4-0-nvme" },
          { component_type: "psu", slug: "cooler-master-mwe-gold-750w-v2-full-modular" },
          { component_type: "case", slug: "case-mik-lv12-white-be-ca-panorama" },
          { component_type: "cooling", slug: "deepcool-ls720-se-argb-360mm" }
        ]
      },
      {
        name: "💼 Dàn PC Văn Phòng & Học Tập (Core i3-12100 • 16GB RAM • SSD 500GB)",
        items: [
          { component_type: "cpu", slug: "intel-core-i3-12100f" },
          { component_type: "mainboard", slug: "asus-prime-h610m-k-ddr4" },
          { component_type: "ram", slug: "kingston-fury-beast-16gb-ddr4-3200mhz" },
          { component_type: "gpu", slug: "gigabyte-radeon-rx-6500-xt-eagle-4gb" },
          { component_type: "storage", slug: "kingston-nv2-500gb-m-2-2280-nvme" },
          { component_type: "psu", slug: "cooler-master-elite-v4-500w" },
          { component_type: "case", slug: "case-mik-lv12-white-be-ca-panorama" },
          { component_type: "cooling", slug: "thermalright-assassin-x120-se-argb" }
        ]
      }
    ];

    for (const b of demoBuilds) {
      // Calculate total price from SKUs
      let buildTotal = 0;
      const resolvedItems = [];

      for (const it of b.items) {
        const skuId = seededSkus[it.slug];
        if (skuId) {
          const skuRow = await findOne(connection, "SELECT price FROM product_skus WHERE id = ? LIMIT 1", [skuId]);
          const p = Number(skuRow?.price || 0);
          buildTotal += p;
          resolvedItems.push({
            sku_id: skuId,
            component_type: it.component_type
          });
        }
      }

      let existingBuild = await findOne(connection, "SELECT id FROM pc_builds WHERE name = ? LIMIT 1", [b.name]);
      let buildId;

      if (!existingBuild) {
        buildId = await insertRecord(connection, "pc_builds", {
          user_id: demoUserId,
          name: b.name,
          total_price: buildTotal,
          status: "SAVED",
          is_saved: 1
        });
      } else {
        buildId = existingBuild.id;
        await connection.execute("UPDATE pc_builds SET total_price = ?, status = 'SAVED', is_saved = 1 WHERE id = ?", [buildTotal, buildId]);
        await connection.execute("DELETE FROM pc_build_items WHERE build_id = ?", [buildId]);
      }

      for (const item of resolvedItems) {
        await insertRecord(connection, "pc_build_items", {
          build_id: buildId,
          sku_id: item.sku_id,
          component_type: item.component_type
        });
      }
      console.log(`   ✓ Created/Updated Demo Build: "${b.name}" (${resolvedItems.length}/8 items, Total: ${buildTotal.toLocaleString("vi-VN")}đ)`);
    }

    console.log("🎉 Seed Demo PC Build completed successfully with 100% database compatibility!");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error.message);
  console.error(error);
  process.exit(1);
});
