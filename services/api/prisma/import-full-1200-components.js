/**
 * 🚀 NẠP TOÀN BỘ 1.200 SẢN PHẨM TỪ DATA/JSON VÀO DATABASE PC MALL
 * Nguồn dữ liệu: d:\Project CNM_MK-HB\data\json\pc_components_all.json
 * Bao gồm:
 *   - 100 CPU, 100 Mainboard, 100 RAM, 100 GPU/VGA, 100 SSD, 100 HDD,
 *   - 100 PSU, 100 Case, 100 Cooling, 100 Monitor, 100 Keyboard/Mouse, 100 Headphone.
 *   - Kèm 100% thuộc tính kỹ thuật chi tiết (specs) và đường dẫn ảnh thật.
 */

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

const DATA_FILE = path.resolve(__dirname, "../../../data/json/pc_components_all.json");

// Danh mục chuẩn
const CATEGORY_MAP = {
  cpu: { id: 1, name: "CPU" },
  mainboard: { id: 2, name: "Mainboard" },
  ram: { id: 3, name: "RAM" },
  vga: { id: 4, name: "GPU" },
  ssd: { id: 5, name: "SSD" },
  psu: { id: 6, name: "PSU" },
  case: { id: 7, name: "Case" },
  cooling: { id: 8, name: "Cooling" },
  hdd: { id: 9, name: "HDD" },
  monitor: { id: 10, name: "Màn hình" },
  keyboard_mouse: { id: 11, name: "Bàn phím & Chuột" },
  headphone: { id: 12, name: "Tai nghe" }
};

function generateSlug(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 180);
}

async function main() {
  console.log("══════════════════════════════════════════════════════════════════");
  console.log("🚀 BẮT ĐẦU NẠP 1.200 SẢN PHẨM TỪ DATA/JSON VÀO MYSQL");
  console.log("══════════════════════════════════════════════════════════════════\n");

  if (!fs.existsSync(DATA_FILE)) {
    console.error("❌ Không tìm thấy tệp dữ liệu:", DATA_FILE);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  console.log(`📦 Tìm thấy ${rawData.length} sản phẩm trong tệp pc_components_all.json\n`);

  // 1. Đảm bảo toàn bộ 12 danh mục tồn tại
  console.log("1. Đang đồng bộ danh mục sản phẩm (Categories)...");
  for (const cat of Object.values(CATEGORY_MAP)) {
    const existing = await prisma.category.findUnique({ where: { id: cat.id } });
    if (!existing) {
      await prisma.category.create({ data: { id: cat.id, name: cat.name } });
      console.log(`   + Tạo danh mục #${cat.id}: ${cat.name}`);
    } else if (existing.name !== cat.name) {
      await prisma.category.update({ where: { id: cat.id }, data: { name: cat.name } });
    }
  }
  console.log("   ✓ Danh mục đã sẵn sàng.\n");

  // 2. Cache Brands, Attributes & Attribute Values vào RAM để tăng tốc tối đa
  console.log("2. Đang chuẩn bị bộ đệm Brand & Attributes...");
  const brandCache = new Map();
  const allBrands = await prisma.brand.findMany();
  for (const b of allBrands) brandCache.set(b.name.toLowerCase(), b.id);

  const attributeCache = new Map();
  const allAttrs = await prisma.attribute.findMany();
  for (const a of allAttrs) attributeCache.set(a.name.toLowerCase(), a.id);

  const attrValueCache = new Map(); // "attrId:value" -> id
  const allValues = await prisma.attributeValue.findMany();
  for (const v of allValues) {
    if (v.attribute_id && v.value) {
      attrValueCache.set(`${v.attribute_id}:${v.value.trim().toLowerCase()}`, v.id);
    }
  }
  console.log(`   ✓ Đã tải ${brandCache.size} brands, ${attributeCache.size} attributes, ${attrValueCache.size} values.\n`);

  async function getOrCreateBrand(brandName) {
    let name = String(brandName || "Chính hãng").trim();
    if (!name || name.toLowerCase() === "unknown") name = "Chính hãng";
    const key = name.toLowerCase();
    if (brandCache.has(key)) return brandCache.get(key);

    const slug = generateSlug(name) || `brand-${Date.now()}`;
    const brand = await prisma.brand.create({
      data: { name, slug, status: "ACTIVE", is_active: true }
    });
    brandCache.set(key, brand.id);
    return brand.id;
  }

  async function getOrCreateAttribute(attrName) {
    const name = String(attrName || "").trim().substring(0, 100);
    if (!name) return null;
    const key = name.toLowerCase();
    if (attributeCache.has(key)) return attributeCache.get(key);

    const attr = await prisma.attribute.create({ data: { name } });
    attributeCache.set(key, attr.id);
    return attr.id;
  }

  async function getOrCreateAttributeValue(attrId, rawValue) {
    const val = String(rawValue || "").trim().substring(0, 100);
    if (!attrId || !val) return null;
    const key = `${attrId}:${val.toLowerCase()}`;
    if (attrValueCache.has(key)) return attrValueCache.get(key);

    const valRecord = await prisma.attributeValue.create({
      data: { attribute_id: attrId, value: val }
    });
    attrValueCache.set(key, valRecord.id);
    return valRecord.id;
  }

  // 3. Tiến hành nạp 1.200 sản phẩm
  console.log("3. Đang nạp và hợp nhất 1.200 sản phẩm...");
  let createdCount = 0;
  let updatedCount = 0;
  let skuAttrCount = 0;

  const total = rawData.length;
  for (let i = 0; i < total; i++) {
    const item = rawData[i];
    const catConfig = CATEGORY_MAP[item.category] || CATEGORY_MAP.cpu;
    const categoryId = catConfig.id;
    const brandId = await getOrCreateBrand(item.brand || item.name.split(" ")[0]);

    const baseSlug = item.slug ? generateSlug(item.slug) : generateSlug(item.name);
    let price = Math.max(100000, Number(item.price || 1500000));
    // Giới hạn max DECIMAL(10, 2)
    if (price > 99999999) price = 99999000;

    const warrantyMonths = [1, 2, 3, 4, 9].includes(categoryId) ? 36 : [5, 6].includes(categoryId) ? 60 : 24;

    let imageUrl = item.thumbnail || null;
    if (imageUrl && !imageUrl.startsWith("/") && !imageUrl.startsWith("http")) {
      imageUrl = `/${imageUrl}`;
    }

    // Tìm xem sản phẩm đã có trong DB chưa (theo slug hoặc tên)
    let product = await prisma.product.findFirst({
      where: {
        OR: [
          { slug: baseSlug },
          { name: item.name }
        ]
      }
    });

    const description = `Sản phẩm ${catConfig.name} chính hãng: ${item.name}. Bảo hành ${warrantyMonths} tháng tại PC Mall.`;

    if (!product) {
      product = await prisma.product.create({
        data: {
          name: item.name,
          slug: baseSlug,
          description,
          price,
          category_id: categoryId,
          brand_id: brandId,
          warranty_months: warrantyMonths,
          status: "ACTIVE",
          is_active: true
        }
      });
      createdCount++;
    } else {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          category_id: categoryId,
          brand_id: brandId,
          price,
          is_active: true,
          status: "ACTIVE"
        }
      });
      updatedCount++;
    }

    // Đảm bảo Product SKU
    const skuCode = item.sku || `SKU-${product.id}-${baseSlug.substring(0, 30).toUpperCase()}`;
    let sku = await prisma.productSku.findFirst({
      where: { product_id: product.id }
    });

    if (!sku) {
      sku = await prisma.productSku.create({
        data: {
          product_id: product.id,
          sku: skuCode,
          price,
          stock: 25,
          image_url: imageUrl,
          warranty_months: warrantyMonths,
          status: "ACTIVE",
          is_active: true
        }
      });
    } else {
      await prisma.productSku.update({
        where: { id: sku.id },
        data: {
          image_url: imageUrl || sku.image_url,
          price,
          is_active: true,
          status: "ACTIVE"
        }
      });
    }

    // Nạp specifications vào sku_attributes
    if (item.specifications && typeof item.specifications === "object" && sku) {
      for (const [k, v] of Object.entries(item.specifications)) {
        if (!k || v === undefined || v === null || String(v).trim() === "") continue;
        const attrId = await getOrCreateAttribute(k);
        if (!attrId) continue;
        const valId = await getOrCreateAttributeValue(attrId, String(v));
        if (!valId) continue;

        const existingLink = await prisma.skuAttribute.findFirst({
          where: {
            sku_id: sku.id,
            attribute_value_id: valId
          }
        });

        if (!existingLink) {
          await prisma.skuAttribute.create({
            data: {
              sku_id: sku.id,
              attribute_value_id: valId
            }
          });
          skuAttrCount++;
        }
      }
    }

    if ((i + 1) % 150 === 0 || i === total - 1) {
      console.log(`   ➜ Đã xử lý ${i + 1}/${total} sản phẩm (${createdCount} mới, ${updatedCount} cập nhật)...`);
    }
  }

  // 4. Tổng kết số lượng sau khi nạp
  const finalProductCount = await prisma.product.count({ where: { is_active: true } });
  const finalSkuCount = await prisma.productSku.count({ where: { is_active: true } });
  const byCategory = await prisma.category.findMany({
    include: {
      _count: {
        select: { Product: { where: { is_active: true } } }
      }
    }
  });

  console.log("\n══════════════════════════════════════════════════════════════════");
  console.log("✅ HOÀN TẤT NẠP TOÀN BỘ SẢN PHẨM VÀO HỆ THỐNG PC MALL!");
  console.log("══════════════════════════════════════════════════════════════════");
  console.log(`📊 Tổng số sản phẩm trong Database: ${finalProductCount} sản phẩm`);
  console.log(`📦 Tổng số biến thể SKU: ${finalSkuCount} SKUs`);
  console.log(`🔗 Tổng số liên kết thông số kỹ thuật (Specs): ${skuAttrCount} liên kết mới\n`);
  console.log("Chi tiết theo danh mục:");
  for (const c of byCategory) {
    console.log(`  - ${c.name}: ${c._count.Product} sản phẩm`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Lỗi trong quá trình nạp:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
