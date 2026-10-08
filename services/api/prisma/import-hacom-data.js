/**
 * 📦 HACOM DATA IMPORT SCRIPT
 * Import toàn bộ dữ liệu linh kiện PC từ C:\Users\ASUS\Downloads\data\data\json
 * vào database PC Mall.
 *
 * Xử lý 6 vấn đề:
 *  1. ✅ Giá bất thường → nhận diện sentinel 30tr, fallback theo category
 *  2. ✅ Key thông số không đồng nhất → normalize về key chuẩn
 *  3. ✅ Slug xấu → regenerate từ tên sản phẩm
 *  4. ✅ Ảnh relative path → map sang /assets/products/hacom/...
 *  5. ✅ Số lượng sản phẩm ít → import toàn bộ 8 danh mục
 *  6. ✅ Thiếu stock → gán mặc định theo danh mục
 *
 * Chạy: node services/api/prisma/import-hacom-data.js
 */

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

// ============================================================
// CẤU HÌNH
// ============================================================

const DATA_DIR = path.join("C:\\Users\\ASUS\\Downloads\\data\\data\\json");

// Map file JSON → category name trong DB
const FILE_CATEGORY_MAP = {
  "hacom_cpu.json":       "CPU",
  "hacom_mainboard.json": "MAINBOARD",
  "hacom_ram.json":       "RAM",
  "hacom_vga.json":       "GPU",
  "hacom_ssd.json":       "SSD",
  "hacom_psu.json":       "PSU",
  "hacom_case.json":      "CASE",
  "hacom_cooling.json":   "COOLING",
};

// Stock mặc định theo danh mục (vấn đề 6)
const DEFAULT_STOCK = {
  CPU:       20,
  Mainboard: 15,
  RAM:       30,
  VGA:       12,
  SSD:       25,
  PSU:       18,
  Case:      15,
  Cooling:   20,
};

// ============================================================
// VẤN ĐỀ 2: NORMALIZE KEY THÔNG SỐ
// Map tất cả variant của tên field → key chuẩn
// ============================================================
const SPEC_KEY_NORMALIZE = {
  // Socket
  "socket":                       "socket",
  "spec_socket":                  "socket",
  "hỗ trợ socket":               "socket",
  "socket support":               "socket",
  "cpu hỗ trợ":                  "socket",

  // RAM type
  "loại ram hỗ trợ":             "ram_type",
  "loai ram hỗ trợ":             "ram_type",
  "hỗ trợ bộ nhớ":              "ram_type",
  "ram hỗ trợ":                  "ram_type",

  // TDP
  "tdp":                          "tdp",
  "tdp mặc định":                "tdp",
  "công suất":                   "tdp",
  "power":                        "tdp",

  // Form factor
  "kích cỡ":                     "form_factor",
  "kích thước":                  "form_factor",
  "yếu tố hình thức":           "form_factor",
  "form factor":                  "form_factor",

  // Chipset
  "chipset":                      "chipset",

  // Cores/Threads
  "số nhân":                     "cores",
  "số luồng":                    "threads",

  // Cache
  "cache":                        "cache",
  "bộ nhớ đệm":                 "cache",

  // Speed
  "tốc độ cơ bản":              "base_speed",
  "tần số cơ bản":              "base_speed",
  "tốc độ":                     "speed",

  // Storage type
  "chuẩn kết nối":              "storage_interface",
  "giao tiếp":                   "storage_interface",

  // PSU wattage
  "công suất psu":               "psu_wattage",
  "psu wattage":                  "psu_wattage",

  // Cooler type
  "loại tản nhiệt":             "cooling_type",
  "cooling type":                 "cooling_type",

  // Warranty
  "bảo hành":                   "warranty",

  // Brand
  "thương hiệu":                "brand_name",
  "hãng sản xuất":             "brand_name",
};

// ============================================================
// VẤN ĐỀ 3: GENERATE SLUG SẠCH TỪ TÊN SẢN PHẨM
// ============================================================
function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // bỏ dấu tiếng Việt
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 200);               // giới hạn độ dài
}

// ============================================================
// VẤN ĐỀ 1: XỬ LÝ GIÁ BẤT THƯỜNG
//
// Phân tích data thực tế (audit đầy đủ):
//  - Cooling/SSD : price = 30,000,000 (sentinel lỗi crawler) → dùng original_price
//  - PSU/Case    : price chỉ 4%–50% of original (giá lỗi crawler) → dùng original_price
//  - Mainboard   : price thấp (sale cũ <30%) → dùng original_price
//  - CPU/RAM/VGA : price hợp lý (sale 60%–90%) → dùng price bình thường
//
// Logic xử lý 3 tầng:
//  Tầng 1: Sentinel check — price = 30,000,000 → dùng original
//  Tầng 2: Ratio check   — price < 60% original → dùng original
//  Tầng 3: Floor check   — giá cuối < MIN_CATEGORY_PRICE → dùng original
// ============================================================
const SENTINEL_PRICE = 30000000; // Giá lỗi từ crawler của Hacom

// Giá sàn hợp lý tối thiểu theo từng category (VNĐ)
// Nếu giá cuối thấp hơn mức này → bất thường → dùng original_price
const MIN_CATEGORY_PRICE = {
  CPU:       800000,   // CPU rẻ nhất thị trường ~800k
  Mainboard: 1000000,  // Mainboard rẻ nhất ~1tr
  RAM:       200000,   // RAM rẻ nhất ~200k
  VGA:       1000000,  // VGA rẻ nhất ~1tr
  SSD:       250000,   // SSD rẻ nhất ~250k
  PSU:       400000,   // Nguồn rẻ nhất ~400k
  Case:      250000,   // Case rẻ nhất ~250k
  Cooling:   150000,   // Tản nhiệt rẻ nhất ~150k
};

function resolvePrice(price, originalPrice, categoryName) {
  // ── Tầng 0: Không có dữ liệu ──────────────────────────────
  if (!price && !originalPrice) return null;
  if (!price) return originalPrice;
  if (!originalPrice) {
    if (price === SENTINEL_PRICE) return null;
    return price;
  }

  // ── Tầng 1: Sentinel check ────────────────────────────────
  // price = chính xác 30,000,000 → lỗi crawler
  if (price === SENTINEL_PRICE) {
    return originalPrice;
  }

  // ── Tầng 2: Ratio check ───────────────────────────────────
  // price < 60% của original → giá lỗi/sale cũ bất thường
  // (Audit: PSU/Case thường chỉ 4%–50%, CPU/GPU thường 60%–90%)
  if (price < originalPrice * 0.6) {
    return originalPrice;
  }

  // ── Tầng 3: Floor check ───────────────────────────────────
  // Giá cuối vẫn thấp hơn mức sàn hợp lý của category
  const minPrice = MIN_CATEGORY_PRICE[categoryName];
  if (minPrice && price < minPrice && originalPrice >= minPrice) {
    return originalPrice;
  }

  // ── Bình thường: dùng price ───────────────────────────────
  return price;
}

// Fallback giá theo category khi CẢ HAI field đều null/lỗi
const CATEGORY_PRICE_FALLBACK = {
  CPU:       3000000,
  Mainboard: 3500000,
  RAM:       1200000,
  VGA:       5000000,
  SSD:       1500000,
  PSU:       1500000,
  Case:      1200000,
  Cooling:    800000,
};

// ============================================================
// VẤN ĐỀ 4: MAP ĐƯỜNG DẪN ẢNH
// data/images/hacom/cpu/... → /assets/products/hacom/cpu/...
// ============================================================
function mapImagePath(localPath) {
  if (!localPath) return null;
  // Chuyển từ "data/images/hacom/..." → "/assets/products/hacom/..."
  return localPath.replace(/^data\/images\//, "/assets/products/");
}

// ============================================================
// NORMALIZE SPEC KEY
// ============================================================
function normalizeSpecKey(rawKey) {
  const lower = rawKey.toLowerCase().trim();
  return SPEC_KEY_NORMALIZE[lower] || null; // null = bỏ qua key không cần
}

// ============================================================
// EXTRACT SOCKET TỪ THÔNG SỐ
// Trả về giá trị socket chuẩn: "LGA1700", "AM5", "AM4"...
// ============================================================
function extractSocket(specValue) {
  if (!specValue) return null;
  const v = String(specValue).toUpperCase();
  if (v.includes("LGA1851")) return "LGA1851";
  if (v.includes("LGA1700") || v.includes("FCLGA 1700") || v.includes("FCLGA1700")) return "LGA1700";
  if (v.includes("LGA1200") || v.includes("FCLGA1200")) return "LGA1200";
  if (v.includes("AM5")) return "AM5";
  if (v.includes("AM4")) return "AM4";
  return specValue.trim().substring(0, 50);
}

// ============================================================
// EXTRACT RAM TYPE TỪ THÔNG SỐ
// ============================================================
function extractRamType(specValue) {
  if (!specValue) return null;
  const v = String(specValue).toUpperCase();
  if (v.includes("DDR5")) return "DDR5";
  if (v.includes("DDR4")) return "DDR4";
  if (v.includes("DDR3")) return "DDR3";
  return null;
}

// ============================================================
// EXTRACT TDP TỪ THÔNG SỐ
// ============================================================
function extractTDP(specValue) {
  if (!specValue) return null;
  const match = String(specValue).match(/(\d+)\s*W/i);
  if (match) return `${match[1]}W`;
  return null;
}

// ============================================================
// EXTRACT FORM FACTOR
// ============================================================
function extractFormFactor(specValue) {
  if (!specValue) return null;
  const v = String(specValue).toUpperCase();
  if (v.includes("ITX") || v.includes("MINI-ITX")) return "ITX";
  if (v.includes("MATX") || v.includes("M-ATX") || v.includes("MICRO-ATX") || v.includes("MICRO ATX")) return "mATX";
  if (v.includes("ATX")) return "ATX";
  return null;
}

// ============================================================
// EXTRACT PSU WATTAGE
// ============================================================
function extractPSUWattage(specValue) {
  if (!specValue) return null;
  const match = String(specValue).match(/(\d+)\s*W/i);
  if (match) return `${match[1]}W`;
  return null;
}

// ============================================================
// PARSE THÔNG SỐ KỸ THUẬT VÀ TRẢ VỀ ATTRIBUTES ĐÃ NORMALIZE
// ============================================================
function parseSpecifications(specs, categoryName) {
  const result = {};

  if (!specs || typeof specs !== "object") return result;

  for (const [rawKey, value] of Object.entries(specs)) {
    const normalKey = normalizeSpecKey(rawKey);
    if (!normalKey || !value) continue;

    switch (normalKey) {
      case "socket":
        result.socket = extractSocket(String(value));
        break;
      case "ram_type":
        result.ram_type = extractRamType(String(value));
        break;
      case "tdp":
        result.tdp = extractTDP(String(value));
        break;
      case "form_factor":
        result.form_factor = extractFormFactor(String(value));
        break;
      case "psu_wattage":
        result.psu_wattage = extractPSUWattage(String(value));
        break;
      case "chipset":
        result.chipset = String(value).trim().substring(0, 100);
        break;
      case "warranty":
        result.warranty = String(value).trim().substring(0, 50);
        break;
    }
  }

  // Fallback: phân tích theo category nếu không tìm được
  if (categoryName === "PSU" && !result.psu_wattage) {
    // Tìm wattage trong tên sản phẩm
  }

  // Lọc bỏ null/undefined
  return Object.fromEntries(
    Object.entries(result).filter(([, v]) => v != null)
  );
}

// ============================================================
// UPSERT CATEGORY
// ============================================================
async function ensureCategory(name) {
  let cat = await prisma.category.findFirst({ where: { name } });
  if (!cat) {
    cat = await prisma.category.create({ data: { name } });
    console.log(`  📂 Tạo category: ${name}`);
  }
  return cat;
}

// ============================================================
// UPSERT BRAND
// ============================================================
async function ensureBrand(name) {
  if (!name) name = "Unknown";
  const cleanName = String(name).trim().substring(0, 100);
  let brand = await prisma.brand.findFirst({ where: { name: cleanName } });
  if (!brand) {
    const slug = generateSlug(cleanName).substring(0, 100);
    brand = await prisma.brand.create({
      data: {
        name: cleanName,
        slug,
        status: "ACTIVE",
        is_active: true,
      },
    });
    console.log(`  🏷️  Tạo brand: ${cleanName}`);
  }
  return brand;
}

// ============================================================
// UPSERT ATTRIBUTE + VALUE
// ============================================================
const attrCache = new Map();    // name → id
const valCache = new Map();     // "name::value" → id

async function ensureAttributeValue(attrName, value) {
  // Ensure attribute
  if (!attrCache.has(attrName)) {
    let attr = await prisma.attribute.findFirst({ where: { name: attrName } });
    if (!attr) {
      attr = await prisma.attribute.create({ data: { name: attrName } });
    }
    attrCache.set(attrName, attr.id);
  }
  const attrId = attrCache.get(attrName);

  // Ensure value
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

// ============================================================
// LINK SKU → ATTRIBUTE VALUE
// ============================================================
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
// IMPORT MỘT SẢN PHẨM
// ============================================================
async function importProduct(item, category, categoryName) {
  // VẤN ĐỀ 1: Xử lý giá — 3 tầng kiểm tra, fallback theo category nếu null
  const resolvedPrice = resolvePrice(item.price, item.original_price, categoryName);
  const price = resolvedPrice ?? CATEGORY_PRICE_FALLBACK[categoryName] ?? 1000000;

  // VẤN ĐỀ 3: Slug sạch
  const slug = generateSlug(item.name);

  // VẤN ĐỀ 4: Map ảnh
  const imageUrl = mapImagePath(item.thumbnail || (item.local_images && item.local_images[0]));

  // VẤN ĐỀ 6: Stock mặc định
  const stock = DEFAULT_STOCK[categoryName] || 15;

  // Brand
  const brand = await ensureBrand(item.brand);

  // Upsert Product (tìm theo slug)
  let product = await prisma.product.findFirst({ where: { slug } });

  if (!product) {
    product = await prisma.product.create({
      data: {
        name: item.name,
        slug,
        description: `Sản phẩm ${categoryName} chính hãng từ ${item.brand}. Nguồn: ${item.url || "hacom.vn"}`,
        price,
        category_id: category.id,
        brand_id: brand.id,
        status: "ACTIVE",
        is_active: true,
      },
    });
  } else {
    // Update giá và brand nếu cần
    await prisma.product.update({
      where: { id: product.id },
      data: {
        price,
        category_id: category.id,
        brand_id: brand.id,
        is_active: true,
        status: "ACTIVE",
      },
    });
  }

  // Tạo SKU code từ id của data
  const skuCode = `HACOM-${String(item.id || item.product_id || item.slug).toUpperCase().substring(0, 60)}`;

  // Upsert ProductSku
  let sku = await prisma.productSku.findFirst({ where: { sku: skuCode } });

  if (!sku) {
    sku = await prisma.productSku.create({
      data: {
        product_id: product.id,
        sku: skuCode,
        price,
        stock,
        image_url: imageUrl,
        status: "ACTIVE",
        is_active: true,
      },
    });
  } else {
    await prisma.productSku.update({
      where: { id: sku.id },
      data: { price, stock, image_url: imageUrl, is_active: true, status: "ACTIVE" },
    });
  }

  // VẤN ĐỀ 2: Normalize và lưu attributes
  const specs = item.specifications || {};
  const parsedAttrs = parseSpecifications(specs, categoryName);

  for (const [attrName, attrValue] of Object.entries(parsedAttrs)) {
    if (!attrValue) continue;
    try {
      const attrValueId = await ensureAttributeValue(attrName, String(attrValue));
      await linkSkuAttribute(sku.id, attrValueId);
    } catch (e) {
      // Bỏ qua lỗi duplicate
    }
  }

  return { product, sku, price, parsedAttrs };
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  📦 HACOM DATA IMPORT — PC Mall");
  console.log("═══════════════════════════════════════════════════\n");

  let totalProducts = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  const summary = [];

  for (const [fileName, categoryName] of Object.entries(FILE_CATEGORY_MAP)) {
    const filePath = path.join(DATA_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠️  Không tìm thấy file: ${fileName} — bỏ qua`);
      continue;
    }

    console.log(`\n📂 Đang import: [${categoryName}] từ ${fileName}`);
    console.log("─".repeat(50));

    const raw = fs.readFileSync(filePath, "utf-8");
    const items = JSON.parse(raw);

    const category = await ensureCategory(categoryName);

    let catCreated = 0;
    let catUpdated = 0;
    let catErrors = 0;

    for (const item of items) {
      try {
        const existing = await prisma.product.findFirst({
          where: { slug: generateSlug(item.name) },
        });

        const result = await importProduct(item, category, categoryName);

        if (existing) {
          catUpdated++;
          console.log(`  ♻️  Updated: ${item.name.substring(0, 60)} — ${Number(result.price).toLocaleString("vi-VN")}đ`);
        } else {
          catCreated++;
          console.log(`  ✅ Created: ${item.name.substring(0, 60)} — ${Number(result.price).toLocaleString("vi-VN")}đ`);
        }
        totalProducts++;
      } catch (err) {
        catErrors++;
        totalErrors++;
        console.error(`  ❌ Lỗi: ${item.name?.substring(0, 50)} — ${err.message}`);
      }
    }

    totalCreated += catCreated;
    totalUpdated += catUpdated;

    summary.push({
      category: categoryName,
      total: items.length,
      created: catCreated,
      updated: catUpdated,
      errors: catErrors,
    });

    console.log(`  → ${catCreated} tạo mới, ${catUpdated} cập nhật, ${catErrors} lỗi`);
  }

  // ============================================================
  // KẾT QUẢ CUỐI
  // ============================================================
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  📊 KẾT QUẢ IMPORT");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Tổng sản phẩm xử lý : ${totalProducts}`);
  console.log(`  Tạo mới             : ${totalCreated}`);
  console.log(`  Cập nhật            : ${totalUpdated}`);
  console.log(`  Lỗi                 : ${totalErrors}`);
  console.log("\n  Chi tiết theo danh mục:");
  for (const s of summary) {
    console.log(`  - ${s.category.padEnd(10)}: ${s.total} sản phẩm | ✅ ${s.created} tạo | ♻️  ${s.updated} cập nhật | ❌ ${s.errors} lỗi`);
  }
  console.log("\n✅ Hoàn tất import!\n");
  console.log("💡 Lưu ý: Copy ảnh từ:");
  console.log("   C:\\Users\\ASUS\\Downloads\\data\\data\\images\\hacom\\");
  console.log("   → d:\\Project CNM_MK-HB\\apps\\web\\public\\assets\\products\\hacom\\");
}

main()
  .catch((e) => {
    console.error("❌ Import thất bại:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
