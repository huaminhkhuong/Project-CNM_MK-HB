/**
 * 📦 HACOM DATA IMPORT SCRIPT
 * Import toàn bộ dữ liệu linh kiện PC từ C:\Users\ASUS\Downloads\data\data\json
 * vào database PC Mall.
 *
 * Xử lý:
 *  1. ✅ Nhận diện 8 danh mục chuẩn (CPU, Mainboard, RAM, GPU, SSD, PSU, Case, Cooling)
 *  2. ✅ Brand normalization & extraction (Intel, AMD, ASUS, MSI, Gigabyte, Samsung, Corsair, etc.)
 *  3. ✅ Giá thực tế & giải quyết lỗi crawler
 *  4. ✅ Image mapping chính xác sang /assets/products/hacom/...
 *  5. ✅ Slug sạch và không trùng lặp
 *  6. ✅ Trích xuất & chuẩn hoá thông số kỹ thuật (Socket, RAM Type, TDP, Form Factor, Wattage, etc.)
 *
 * Chạy: node prisma/import-hacom-data.js
 */

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

// ============================================================
// CẤU HÌNH
// ============================================================

const LOCAL_RAW_JSON = path.join(__dirname, "../data/raw/json");
const FALLBACK_DOWNLOADS_JSON = path.join("C:\\Users\\ASUS\\Downloads\\data\\data\\json");
const DATA_DIR = fs.existsSync(LOCAL_RAW_JSON) ? LOCAL_RAW_JSON : FALLBACK_DOWNLOADS_JSON;

// Map file JSON → Category chuẩn (id + tên chuẩn đồng bộ với hệ thống)
const FILE_CATEGORY_MAP = {
  "hacom_cpu.json":       { id: 1, name: "CPU" },
  "hacom_mainboard.json": { id: 2, name: "Mainboard" },
  "hacom_ram.json":       { id: 3, name: "RAM" },
  "hacom_vga.json":       { id: 4, name: "GPU" },
  "hacom_ssd.json":       { id: 5, name: "SSD" },
  "hacom_psu.json":       { id: 6, name: "PSU" },
  "hacom_case.json":      { id: 7, name: "Case" },
  "hacom_cooling.json":   { id: 8, name: "Cooling" },
};

// Stock mặc định theo danh mục
const DEFAULT_STOCK = {
  CPU:       20,
  Mainboard: 15,
  RAM:       30,
  GPU:       12,
  SSD:       25,
  PSU:       18,
  Case:      15,
  Cooling:   20,
};

// Thời hạn bảo hành mặc định theo danh mục (tháng)
const DEFAULT_WARRANTY_MONTHS = {
  CPU:       36,
  Mainboard: 36,
  RAM:       36,
  GPU:       36,
  SSD:       60,
  PSU:       60,
  Case:      12,
  Cooling:   24,
};

// ============================================================
// BRAND EXTRACTION TỪ TÊN SẢN PHẨM KHI BỊ THIẾU
// ============================================================
function extractBrandFromName(name) {
  if (!name) return null;
  const upper = String(name).toUpperCase();
  const KNOWN_BRANDS = [
    { match: "INTEL", name: "Intel" },
    { match: "AMD", name: "AMD" },
    { match: "ASUS", name: "ASUS" },
    { match: "ROG", name: "ASUS" },
    { match: "TUF", name: "ASUS" },
    { match: "MSI", name: "MSI" },
    { match: "GIGABYTE", name: "Gigabyte" },
    { match: "AORUS", name: "Gigabyte" },
    { match: "CORSAIR", name: "Corsair" },
    { match: "KINGSTON", name: "Kingston" },
    { match: "SAMSUNG", name: "Samsung" },
    { match: "WESTERN DIGITAL", name: "Western Digital" },
    { match: "WD", name: "Western Digital" },
    { match: "DEEPCOOL", name: "DeepCool" },
    { match: "THERMALRIGHT", name: "Thermalright" },
    { match: "NZXT", name: "NZXT" },
    { match: "MONTECH", name: "Montech" },
    { match: "LIAN LI", name: "Lian Li" },
    { match: "COOLER MASTER", name: "Cooler Master" },
    { match: "INNO3D", name: "Inno3D" },
    { match: "PALIT", name: "Palit" },
    { match: "ZOTAC", name: "ZOTAC" },
    { match: "COLORFUL", name: "Colorful" },
    { match: "G.SKILL", name: "G.Skill" },
    { match: "GSKILL", name: "G.Skill" },
    { match: "CRUCIAL", name: "Crucial" },
    { match: "TEAMGROUP", name: "TeamGroup" },
    { match: "SEAGATE", name: "Seagate" },
    { match: "SEASONIC", name: "Seasonic" },
    { match: "SUPER FLOWER", name: "Super Flower" },
    { match: "ANTEC", name: "Antec" },
    { match: "ASROCK", name: "ASRock" },
  ];
  for (const b of KNOWN_BRANDS) {
    if (upper.includes(b.match)) {
      return b.name;
    }
  }
  return null;
}

// ============================================================
// GENERATE SLUG
// ============================================================
function generateSlug(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 190);
}

// ============================================================
// GIÁ BẤT THƯỜNG / FALLBACK
// ============================================================
const SENTINEL_PRICE = 30000000;

const MIN_CATEGORY_PRICE = {
  CPU:       800000,
  Mainboard: 1000000,
  RAM:       200000,
  GPU:       1000000,
  SSD:       250000,
  PSU:       400000,
  Case:      250000,
  Cooling:   150000,
};

const MAX_DECIMAL_PRICE = 99999000; // DECIMAL(10, 2) max is 99,999,999.99

function resolvePrice(price, originalPrice, categoryName) {
  let resolved = price;
  if (!price && !originalPrice) return null;
  if (!price) resolved = originalPrice;
  else if (!originalPrice) {
    if (price === SENTINEL_PRICE) return null;
    resolved = price;
  } else if (price === SENTINEL_PRICE) {
    resolved = originalPrice;
  } else if (price < originalPrice * 0.6) {
    resolved = originalPrice;
  } else {
    const minPrice = MIN_CATEGORY_PRICE[categoryName];
    if (minPrice && price < minPrice && originalPrice >= minPrice) {
      resolved = originalPrice;
    }
  }

  if (resolved != null && Number(resolved) > MAX_DECIMAL_PRICE) {
    resolved = MAX_DECIMAL_PRICE;
  }
  return resolved;
}

const CATEGORY_PRICE_FALLBACK = {
  CPU:       3500000,
  Mainboard: 3200000,
  RAM:       1400000,
  GPU:       7500000,
  SSD:       1600000,
  PSU:       1500000,
  Case:      1200000,
  Cooling:    850000,
};

// ============================================================
// MAP IMAGE PATH
// ============================================================
function resolveItemImageUrl(item) {
  const candidates = [
    item.thumbnail,
    ...(Array.isArray(item.local_images) ? item.local_images : []),
    ...(Array.isArray(item.images) ? item.images : [])
  ];

  for (const c of candidates) {
    if (!c || typeof c !== "string") continue;
    const trimmed = c.trim();
    if (trimmed.startsWith("data/images/")) {
      return trimmed.replace(/^data\/images\//, "/assets/products/");
    }
    if (trimmed.startsWith("/assets/products/")) {
      return trimmed;
    }
  }

  // Fallback to CDN URL if local image path not found
  if (Array.isArray(item.source_image_urls) && item.source_image_urls.length > 0) {
    for (const url of item.source_image_urls) {
      if (typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"))) {
        return url;
      }
    }
  }

  return null;
}

// ============================================================
// NORMALIZE SPEC KEY
// ============================================================
const SPEC_KEY_NORMALIZE = {
  "socket":                       "socket",
  "spec_socket":                  "socket",
  "hỗ trợ socket":               "socket",
  "socket support":               "socket",
  "cpu hỗ trợ":                  "socket",
  "loại ram hỗ trợ":             "ram_type",
  "loai ram hỗ trợ":             "ram_type",
  "hỗ trợ bộ nhớ":              "ram_type",
  "ram hỗ trợ":                  "ram_type",
  "chuẩn ram":                   "ram_type",
  "loại ram":                    "ram_type",
  "tdp":                          "tdp",
  "tdp mặc định":                "tdp",
  "công suất":                   "tdp",
  "power":                        "tdp",
  "kích cỡ":                     "form_factor",
  "kích thước":                  "form_factor",
  "yếu tố hình thức":           "form_factor",
  "form factor":                  "form_factor",
  "chipset":                      "chipset",
  "số nhân":                     "cores",
  "số luồng":                    "threads",
  "cache":                        "cache",
  "bộ nhớ đệm":                 "cache",
  "tốc độ cơ bản":              "base_speed",
  "tần số cơ bản":              "base_speed",
  "tốc độ":                     "speed",
  "bus":                          "speed",
  "chuẩn kết nối":              "storage_interface",
  "giao tiếp":                   "storage_interface",
  "dung lượng":                  "capacity",
  "công suất psu":               "psu_wattage",
  "công suất thực":             "psu_wattage",
  "psu wattage":                  "psu_wattage",
  "loại tản nhiệt":             "cooling_type",
  "cooling type":                 "cooling_type",
  "bảo hành":                   "warranty",
  "vram":                         "vram",
  "dung lượng vram":             "vram",
  "bộ nhớ vga":                 "vram"
};

function extractSocket(specValue, name = "") {
  const v = `${specValue || ""} ${name || ""}`.toUpperCase();
  if (v.includes("LGA1851") || v.includes("LGA 1851")) return "LGA1851";
  if (v.includes("LGA1700") || v.includes("FCLGA 1700") || v.includes("FCLGA1700") || v.includes("LGA 1700")) return "LGA1700";
  if (v.includes("LGA1200") || v.includes("FCLGA1200") || v.includes("LGA 1200")) return "LGA1200";
  if (v.includes("AM5")) return "AM5";
  if (v.includes("AM4")) return "AM4";
  return specValue ? String(specValue).trim().substring(0, 50) : null;
}

function extractRamType(specValue, name = "") {
  const v = `${specValue || ""} ${name || ""}`.toUpperCase();
  if (v.includes("DDR5")) return "DDR5";
  if (v.includes("DDR4")) return "DDR4";
  if (v.includes("DDR3")) return "DDR3";
  return null;
}

function extractTDP(specValue, name = "") {
  const combined = `${specValue || ""} ${name || ""}`;
  const match = combined.match(/(\d+)\s*W/i);
  if (match) return `${match[1]}W`;
  return null;
}

function extractFormFactor(specValue, name = "") {
  const v = `${specValue || ""} ${name || ""}`.toUpperCase();
  if (v.includes("ITX") || v.includes("MINI-ITX")) return "ITX";
  if (v.includes("MATX") || v.includes("M-ATX") || v.includes("MICRO-ATX") || v.includes("MICRO ATX")) return "mATX";
  if (v.includes("E-ATX") || v.includes("EATX")) return "E-ATX";
  if (v.includes("ATX")) return "ATX";
  return null;
}

function extractPSUWattage(specValue, name = "") {
  const combined = `${specValue || ""} ${name || ""}`;
  const match = combined.match(/(\d+)\s*W/i);
  if (match) return `${match[1]}W`;
  return null;
}

function parseSpecifications(specs, categoryName, productName) {
  const result = {};
  if (specs && typeof specs === "object") {
    for (const [rawKey, value] of Object.entries(specs)) {
      const lower = rawKey.toLowerCase().trim();
      const normalKey = SPEC_KEY_NORMALIZE[lower];
      if (!normalKey || !value) continue;

      switch (normalKey) {
        case "socket":
          result.socket = extractSocket(value, productName);
          break;
        case "ram_type":
          result.ram_type = extractRamType(value, productName);
          break;
        case "tdp":
          result.tdp = extractTDP(value, productName);
          break;
        case "form_factor":
          result.form_factor = extractFormFactor(value, productName);
          break;
        case "psu_wattage":
          result.psu_wattage = extractPSUWattage(value, productName);
          break;
        case "chipset":
          result.chipset = String(value).trim().substring(0, 100);
          break;
        case "capacity":
          result.capacity = String(value).trim().substring(0, 50);
          break;
        case "speed":
        case "base_speed":
          result.speed = String(value).trim().substring(0, 100);
          break;
        case "storage_interface":
          result.storage_interface = String(value).trim().substring(0, 100);
          break;
        case "cooling_type":
          result.cooling_type = String(value).trim().substring(0, 100);
          break;
        case "vram":
          result.vram = String(value).trim().substring(0, 50);
          break;
      }
    }
  }

  // Fallback từ productName nếu specs còn thiếu
  if (categoryName === "CPU" && !result.socket) {
    result.socket = extractSocket("", productName);
  }
  if ((categoryName === "CPU" || categoryName === "Mainboard" || categoryName === "RAM") && !result.ram_type) {
    result.ram_type = extractRamType("", productName);
  }
  if (categoryName === "PSU" && !result.psu_wattage) {
    result.psu_wattage = extractPSUWattage("", productName);
  }
  if (categoryName === "GPU" && !result.vram) {
    const vMatch = productName.match(/(\d+)\s*GB/i);
    if (vMatch) result.vram = `${vMatch[1]}GB`;
  }
  if (categoryName === "SSD" && !result.capacity) {
    const cMatch = productName.match(/(\d+)\s*(TB|GB)/i);
    if (cMatch) result.capacity = `${cMatch[1]}${cMatch[2].toUpperCase()}`;
  }

  return Object.fromEntries(
    Object.entries(result).filter(([, v]) => v != null && String(v).trim().length > 0)
  );
}

// ============================================================
// ENSURE CATEGORY
// ============================================================
async function ensureCategory(catConfig) {
  let cat = await prisma.category.findUnique({ where: { id: catConfig.id } });
  if (!cat) {
    cat = await prisma.category.findFirst({ where: { name: catConfig.name } });
  }
  if (!cat) {
    cat = await prisma.category.create({
      data: { id: catConfig.id, name: catConfig.name }
    });
    console.log(`  📂 Tạo category: ${catConfig.name} (id: ${catConfig.id})`);
  } else if (cat.name !== catConfig.name) {
    cat = await prisma.category.update({
      where: { id: cat.id },
      data: { name: catConfig.name }
    });
  }
  return cat;
}

// ============================================================
// ENSURE BRAND
// ============================================================
const brandCache = new Map();

async function ensureBrand(rawBrand, productName = "") {
  let cleanName = String(rawBrand || "").trim();
  if (!cleanName || cleanName.toLowerCase() === "unknown" || cleanName.toLowerCase() === "thương hiệu") {
    cleanName = extractBrandFromName(productName) || "Chính hãng";
  }
  cleanName = cleanName.substring(0, 100);

  if (brandCache.has(cleanName)) {
    return brandCache.get(cleanName);
  }

  let brand = await prisma.brand.findFirst({
    where: {
      OR: [
        { name: cleanName },
        { slug: generateSlug(cleanName) }
      ]
    }
  });

  if (!brand) {
    const slug = generateSlug(cleanName) || `brand-${Date.now()}`;
    brand = await prisma.brand.create({
      data: {
        name: cleanName,
        slug,
        status: "ACTIVE",
        is_active: true,
      },
    });
    console.log(`  🏷️  Tạo brand mới: ${cleanName}`);
  }

  brandCache.set(cleanName, brand);
  return brand;
}

// ============================================================
// ATTRIBUTE & VALUE MANAGEMENT
// ============================================================
const attrCache = new Map();
const valCache = new Map();

async function ensureAttributeValue(attrName, value) {
  if (!attrCache.has(attrName)) {
    let attr = await prisma.attribute.findFirst({ where: { name: attrName } });
    if (!attr) {
      attr = await prisma.attribute.create({ data: { name: attrName } });
    }
    attrCache.set(attrName, attr.id);
  }
  const attrId = attrCache.get(attrName);

  const cacheKey = `${attrName}::${value}`;
  if (!valCache.has(cacheKey)) {
    let val = await prisma.attributeValue.findFirst({
      where: { attribute_id: attrId, value },
    });
    if (!val) {
      val = await prisma.attributeValue.create({
        data: { attribute_id: attrId, value },
      });
    }
    valCache.set(cacheKey, val.id);
  }
  return valCache.get(cacheKey);
}

async function linkSkuAttribute(skuId, attributeValueId) {
  const existing = await prisma.skuAttribute.findFirst({
    where: { sku_id: skuId, attribute_value_id: attributeValueId },
  });
  if (!existing) {
    await prisma.skuAttribute.create({
      data: { sku_id: skuId, attribute_value_id: attributeValueId },
    });
  }
}

// ============================================================
// IMPORT SINGLE PRODUCT
// ============================================================
async function importProduct(item, category, categoryName) {
  const resolvedPrice = resolvePrice(item.price, item.original_price, categoryName);
  const price = resolvedPrice ?? CATEGORY_PRICE_FALLBACK[categoryName] ?? 1200000;
  const brand = await ensureBrand(item.brand, item.name);
  const stock = DEFAULT_STOCK[categoryName] || 15;
  const warrantyMonths = DEFAULT_WARRANTY_MONTHS[categoryName] || 24;
  const imageUrl = resolveItemImageUrl(item);

  // Generate unique slug
  let baseSlug = item.slug ? generateSlug(item.slug) : generateSlug(item.name);
  if (!baseSlug) baseSlug = `prod-${Date.now()}`;

  let product = await prisma.product.findFirst({
    where: {
      OR: [
        { slug: baseSlug },
        { name: item.name }
      ]
    }
  });

  const description = item.description || 
    `Sản phẩm ${categoryName} chính hãng ${brand.name}: ${item.name}. Bảo hành ${warrantyMonths} tháng, mới 100% fullbox.`;

  if (!product) {
    product = await prisma.product.create({
      data: {
        name: item.name,
        slug: baseSlug,
        description,
        price,
        category_id: category.id,
        brand_id: brand.id,
        warranty_months: warrantyMonths,
        status: "ACTIVE",
        is_active: true,
      },
    });
  } else {
    product = await prisma.product.update({
      where: { id: product.id },
      data: {
        name: item.name,
        price,
        category_id: category.id,
        brand_id: brand.id,
        warranty_months: warrantyMonths,
        description: description || product.description,
        is_active: true,
        status: "ACTIVE",
      },
    });
  }

  // SKU code
  const rawSkuCode = item.id || item.product_id || item.slug || baseSlug;
  const skuCode = `HACOM-${String(rawSkuCode).toUpperCase().replace(/[^A-Z0-9_-]/g, "-").substring(0, 60)}`;

  let sku = await prisma.productSku.findFirst({
    where: {
      OR: [
        { sku: skuCode },
        { product_id: product.id }
      ]
    }
  });

  if (!sku) {
    sku = await prisma.productSku.create({
      data: {
        product_id: product.id,
        sku: skuCode,
        price,
        stock,
        image_url: imageUrl,
        warranty_months: warrantyMonths,
        status: "ACTIVE",
        is_active: true,
      },
    });
  } else {
    sku = await prisma.productSku.update({
      where: { id: sku.id },
      data: {
        price,
        stock,
        image_url: imageUrl || sku.image_url,
        warranty_months: warrantyMonths,
        is_active: true,
        status: "ACTIVE"
      },
    });
  }

  // Parse and save specifications
  const specs = item.specifications || {};
  const parsedAttrs = parseSpecifications(specs, categoryName, item.name);

  for (const [attrName, attrValue] of Object.entries(parsedAttrs)) {
    if (!attrValue) continue;
    try {
      const attrValueId = await ensureAttributeValue(attrName, String(attrValue));
      await linkSkuAttribute(sku.id, attrValueId);
    } catch {
      // Ignore duplicate sku-attribute associations
    }
  }

  return { product, sku, brand: brand.name, price, imageUrl };
}

// ============================================================
// MAIN EXECUTION
// ============================================================
async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  📦 HACOM DATA IMPORT & SYNCHRONIZATION — PC MALL");
  console.log("═══════════════════════════════════════════════════════════\n");

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  const categoryStats = [];

  for (const [fileName, catDef] of Object.entries(FILE_CATEGORY_MAP)) {
    const filePath = path.join(DATA_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠️ Không tìm thấy file: ${fileName} — bỏ qua`);
      continue;
    }

    console.log(`\n📂 Đang import: [${catDef.name}] từ ${fileName}...`);
    console.log("─".repeat(55));

    const raw = fs.readFileSync(filePath, "utf-8");
    const items = JSON.parse(raw);
    const category = await ensureCategory(catDef);

    let catCreated = 0;
    let catUpdated = 0;
    let catErrors = 0;

    for (const item of items) {
      try {
        const slug = item.slug ? generateSlug(item.slug) : generateSlug(item.name);
        const existing = await prisma.product.findFirst({
          where: { OR: [{ slug }, { name: item.name }] }
        });

        const res = await importProduct(item, category, catDef.name);

        if (existing) {
          catUpdated++;
          console.log(`  ♻️  Update: [${res.brand}] ${item.name.substring(0, 50)} — ${Number(res.price).toLocaleString("vi-VN")}đ`);
        } else {
          catCreated++;
          console.log(`  ✅ Create: [${res.brand}] ${item.name.substring(0, 50)} — ${Number(res.price).toLocaleString("vi-VN")}đ`);
        }
        totalProcessed++;
      } catch (err) {
        catErrors++;
        totalErrors++;
        console.error(`  ❌ Lỗi: ${item.name?.substring(0, 40)}: ${err.message}`);
      }
    }

    totalCreated += catCreated;
    totalUpdated += catUpdated;

    categoryStats.push({
      category: catDef.name,
      total: items.length,
      created: catCreated,
      updated: catUpdated,
      errors: catErrors
    });

    console.log(`  → ${catCreated} tạo mới, ${catUpdated} cập nhật, ${catErrors} lỗi`);
  }

  // Cập nhật lại cache / tổng kết
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  📊 TỔNG KẾT KẾT QUẢ IMPORT");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Tổng số sản phẩm xử lý : ${totalProcessed}`);
  console.log(`  Sản phẩm tạo mới       : ${totalCreated}`);
  console.log(`  Sản phẩm cập nhật      : ${totalUpdated}`);
  console.log(`  Lỗi                    : ${totalErrors}`);
  console.log("\n  Chi tiết từng danh mục:");
  for (const s of categoryStats) {
    console.log(`  - ${s.category.padEnd(10)}: ${s.total} items | ✅ ${s.created} tạo mới | ♻️ ${s.updated} cập nhật | ❌ ${s.errors} lỗi`);
  }

  // Đếm tổng số sản phẩm hiện có trong DB
  const finalCount = await prisma.product.count({ where: { is_active: true } });
  console.log(`\n🎉 Tổng số sản phẩm đang ACTIVE trong database: ${finalCount}`);
  console.log("═══════════════════════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("❌ Lỗi nghiêm trọng khi import:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
