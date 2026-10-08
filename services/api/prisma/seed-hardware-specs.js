const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

async function seedHardwareSpecs() {
  console.log("🚀 Starting Hardware Specs Database Seeding (All 8 Categories)...");

  try {
    const products = await prisma.product.findMany({
      include: {
        Brand: true,
        Category: true,
        ProductSku: true
      }
    });

    console.log(`Found ${products.length} products in database to process.`);
    let skusUpdated = 0;
    let attributesCreated = 0;

    // Cache for attributes and attribute values to minimize DB roundtrips
    const attrCache = new Map();
    const attrValCache = new Map();

    const existingAttrs = await prisma.attribute.findMany();
    for (const a of existingAttrs) {
      attrCache.set(a.name, a.id);
    }

    const existingVals = await prisma.attributeValue.findMany();
    for (const v of existingVals) {
      attrValCache.set(`${v.attribute_id}:${v.value}`, v.id);
    }

    async function getOrCreateAttr(name) {
      if (attrCache.has(name)) return attrCache.get(name);
      let attr = await prisma.attribute.findFirst({ where: { name } });
      if (!attr) {
        attr = await prisma.attribute.create({ data: { name } });
        attributesCreated++;
      }
      attrCache.set(name, attr.id);
      return attr.id;
    }

    async function getOrCreateAttrVal(attributeId, value) {
      const cacheKey = `${attributeId}:${value}`;
      if (attrValCache.has(cacheKey)) return attrValCache.get(cacheKey);
      let attrVal = await prisma.attributeValue.findFirst({
        where: { attribute_id: attributeId, value }
      });
      if (!attrVal) {
        attrVal = await prisma.attributeValue.create({
          data: { attribute_id: attributeId, value }
        });
      }
      attrValCache.set(cacheKey, attrVal.id);
      return attrVal.id;
    }

    for (const prod of products) {
      const rawName = String(prod.name || "");
      const nameUpper = rawName.toUpperCase();
      const norm = normalize(rawName);
      const categoryName = (prod.Category?.name || "").toUpperCase();

      const specsToApply = {
        "Thương hiệu": prod.Brand?.name || "Chính hãng",
        "Tình trạng": "Mới 100% Fullbox",
        "Bảo hành": "36 Tháng Chính Hãng"
      };

      // ── 1. CPU (Bộ vi xử lý) ──────────────────────────
      if (categoryName.includes("CPU") || nameUpper.includes("INTEL") || nameUpper.includes("RYZEN") || nameUpper.includes("CORE I")) {
        let socket = "LGA1700";
        if (nameUpper.includes("AM5") || /7\d00|8\d00|9\d00/i.test(nameUpper)) socket = "AM5";
        else if (nameUpper.includes("AM4") || /5\d00|4\d00|3\d00/i.test(nameUpper)) socket = "AM4";
        else if (nameUpper.includes("LGA1200") || /10\d00|11\d00/i.test(nameUpper)) socket = "LGA1200";
        else if (nameUpper.includes("LGA1700") || /12\d00|13\d00|14\d00/i.test(nameUpper)) socket = "LGA1700";

        let cores = "6 nhân / 12 luồng";
        if (nameUpper.includes("14900") || nameUpper.includes("13900") || nameUpper.includes("7950")) cores = "24 nhân / 32 luồng";
        else if (nameUpper.includes("14700") || nameUpper.includes("13700")) cores = "20 nhân / 28 luồng";
        else if (nameUpper.includes("14600") || nameUpper.includes("13600")) cores = "14 nhân / 20 luồng";
        else if (nameUpper.includes("14400") || nameUpper.includes("13400")) cores = "10 nhân / 16 luồng";
        else if (nameUpper.includes("7800X3D") || nameUpper.includes("7700")) cores = "8 nhân / 16 luồng";
        else if (nameUpper.includes("12100") || nameUpper.includes("13100")) cores = "4 nhân / 8 luồng";

        let tdp = "65W TDP";
        if (nameUpper.includes("K") || nameUpper.includes("X3D") || nameUpper.includes("900")) tdp = "125W - 253W TDP";
        else if (nameUpper.includes("X") || nameUpper.includes("7700")) tdp = "105W TDP";

        specsToApply["Socket hỗ trợ"] = socket;
        specsToApply["Số nhân / Số luồng"] = cores;
        specsToApply["TDP Tiêu thụ"] = tdp;
        specsToApply["Kiến trúc"] = socket.startsWith("AM") ? "AMD Zen" : "Intel Core Hybrid";
      }

      // ── 2. MAINBOARD (Bo mạch chủ) ───────────────────
      else if (categoryName.includes("MAIN") || nameUpper.includes("MAINBOARD") || nameUpper.includes("BO MẠCH")) {
        let socket = "LGA1700";
        if (nameUpper.includes("B650") || nameUpper.includes("X670") || nameUpper.includes("A620") || nameUpper.includes("AM5")) socket = "AM5";
        else if (nameUpper.includes("B550") || nameUpper.includes("A520") || nameUpper.includes("X570") || nameUpper.includes("AM4")) socket = "AM4";
        else if (nameUpper.includes("H510") || nameUpper.includes("B560") || nameUpper.includes("Z590") || nameUpper.includes("LGA1200")) socket = "LGA1200";
        else if (nameUpper.includes("B760") || nameUpper.includes("Z790") || nameUpper.includes("H610") || nameUpper.includes("Z690")) socket = "LGA1700";

        let ramType = "DDR5";
        if (nameUpper.includes("DDR4") || socket === "AM4" || socket === "LGA1200") ramType = "DDR4";
        else if (nameUpper.includes("DDR5") || socket === "AM5") ramType = "DDR5";

        let formFactor = "Micro-ATX";
        if (nameUpper.includes("ITX") || nameUpper.includes("MINI")) formFactor = "Mini-ITX";
        else if (nameUpper.includes("PRO") && !nameUpper.includes("M") || nameUpper.includes("STRIX") || nameUpper.includes("AORUS MASTER")) formFactor = "ATX";

        specsToApply["Socket hỗ trợ"] = socket;
        specsToApply["Chuẩn RAM"] = ramType;
        specsToApply["Kích thước Form Factor"] = formFactor;
        specsToApply["Số khe RAM"] = formFactor === "Mini-ITX" ? "2 khe DDR" : "4 khe Dual Channel";
        specsToApply["Số khe M.2 NVMe"] = "2 khe M.2 PCIe 4.0";
      }

      // ── 3. RAM (Bộ nhớ) ───────────────────────────────
      else if (categoryName.includes("RAM") || nameUpper.includes("RAM") || nameUpper.includes("DDR4") || nameUpper.includes("DDR5")) {
        const isDdr5 = nameUpper.includes("DDR5") || /5200|5600|6000|6400|7200/i.test(nameUpper);
        const ramType = isDdr5 ? "DDR5 High Speed" : "DDR4 Standard";

        let cap = "16GB (2x8GB)";
        if (nameUpper.includes("64GB")) cap = "64GB (2x32GB)";
        else if (nameUpper.includes("32GB")) cap = "32GB (2x16GB)";
        else if (nameUpper.includes("8GB")) cap = "8GB (1x8GB)";

        let bus = isDdr5 ? "6000MHz" : "3200MHz";
        if (nameUpper.includes("5600")) bus = "5600MHz";
        else if (nameUpper.includes("7200")) bus = "7200MHz";
        else if (nameUpper.includes("3600")) bus = "3600MHz";

        specsToApply["Chuẩn RAM"] = ramType;
        specsToApply["Dung lượng RAM"] = cap;
        specsToApply["Tốc độ Bus"] = bus;
        specsToApply["Tản nhiệt"] = nameUpper.includes("RGB") ? "Tản nhôm tản nhiệt ARGB" : "Tản nhôm cao cấp";
      }

      // ── 4. GPU (Card màn hình) ───────────────────────
      else if (categoryName.includes("GPU") || categoryName.includes("VGA") || nameUpper.includes("RTX") || nameUpper.includes("RX") || nameUpper.includes("GTX") || nameUpper.includes("GEFORCE")) {
        let vram = "8GB GDDR6";
        let psu = "650W";
        let tdp = "160W";

        if (nameUpper.includes("4090")) { vram = "24GB GDDR6X"; psu = "850W - 1000W"; tdp = "450W"; }
        else if (nameUpper.includes("4080")) { vram = "16GB GDDR6X"; psu = "750W - 850W"; tdp = "320W"; }
        else if (nameUpper.includes("4070 TI")) { vram = "16GB GDDR6X"; psu = "750W"; tdp = "285W"; }
        else if (nameUpper.includes("4070")) { vram = "12GB GDDR6X"; psu = "650W"; tdp = "200W"; }
        else if (nameUpper.includes("3060")) { vram = "12GB GDDR6"; psu = "550W"; tdp = "170W"; }
        else if (nameUpper.includes("7600") || nameUpper.includes("4060")) { vram = "8GB GDDR6"; psu = "550W - 650W"; tdp = "130W"; }
        else if (nameUpper.includes("6500") || nameUpper.includes("1650")) { vram = "4GB GDDR6"; psu = "450W"; tdp = "75W"; }

        specsToApply["VRAM"] = vram;
        specsToApply["Nguồn đề xuất (PSU)"] = psu;
        specsToApply["TDP Tiêu thụ"] = tdp;
        specsToApply["Giao tiếp"] = "PCIe 4.0 x16";
        specsToApply["Công nghệ xuất hình"] = "DisplayPort 1.4a & HDMI 2.1";
      }

      // ── 5. STORAGE (Ổ cứng SSD) ───────────────────────
      else if (categoryName.includes("STORAGE") || categoryName.includes("SSD") || nameUpper.includes("SSD") || nameUpper.includes("NVME")) {
        let cap = "500GB";
        if (nameUpper.includes("2TB")) cap = "2TB";
        else if (nameUpper.includes("1TB") || nameUpper.includes("1000GB")) cap = "1TB";
        else if (nameUpper.includes("250GB") || nameUpper.includes("256GB")) cap = "250GB";

        const isSata = nameUpper.includes("SATA");
        const storageType = isSata ? "SSD 2.5\" SATA III" : "SSD M.2 NVMe PCIe 4.0";
        const readSpeed = isSata ? "550 MB/s" : nameUpper.includes("990") || nameUpper.includes("KC3000") ? "7000 MB/s" : "3500 MB/s";

        specsToApply["Loại ổ cứng"] = storageType;
        specsToApply["Dung lượng ổ cứng"] = cap;
        specsToApply["Tốc độ đọc tối đa"] = readSpeed;
        specsToApply["Chuẩn cắm"] = isSata ? "SATA III" : "M.2 2280 NVMe";
      }

      // ── 6. PSU (Nguồn máy tính) ───────────────────────
      else if (categoryName.includes("PSU") || categoryName.includes("NGUỒN") || nameUpper.includes("PSU") || nameUpper.includes("WATT") || nameUpper.includes("W ")) {
        let watt = "650W";
        const wMatch = nameUpper.match(/(\d{3,4})\s*W/);
        if (wMatch) watt = `${wMatch[1]}W`;

        let cert = "80 Plus Bronze";
        if (nameUpper.includes("PLATINUM")) cert = "80 Plus Platinum";
        else if (nameUpper.includes("GOLD")) cert = "80 Plus Gold";

        specsToApply["Công suất nguồn"] = watt;
        specsToApply["Chứng nhận hiệu suất"] = cert;
        specsToApply["Kiểu dây nguồn"] = nameUpper.includes("MODULAR") ? "Full Modular cao cấp" : "Dây cáp bọc lưới chống rối";
        specsToApply["Bảo vệ nguồn"] = "OVP, OPP, SCP, UVP, OCP an toàn";
      }

      // ── 7. CASE (Vỏ máy tính) ─────────────────────────
      else if (categoryName.includes("CASE") || categoryName.includes("VỎ") || nameUpper.includes("CASE") || norm.includes("vo may tinh")) {
        let form = "Mid Tower ATX";
        if (nameUpper.includes("MINI") || nameUpper.includes("ITX")) form = "Mini-ITX / Micro-ATX";
        else if (nameUpper.includes("FULL")) form = "Full Tower ATX";

        let style = "Mặt lưới Airflow thông thoáng";
        if (norm.includes("be ca") || nameUpper.includes("PANORAMA") || nameUpper.includes("KÍNH") || nameUpper.includes("LV12")) {
          style = "Vỏ Bể Cá Panorama Kính Cường Lực";
        }

        specsToApply["Kích thước Form Factor"] = form;
        specsToApply["Hỗ trợ Mainboard"] = "ATX, Micro-ATX, Mini-ITX";
        specsToApply["Không gian VGA tối đa"] = "380mm (Vừa vặn RTX 4070 / 4080)";
        specsToApply["Hỗ trợ Tản nước"] = "Radiator 240mm / 360mm ở nóc & mặt trước";
        specsToApply["Phong cách thiết kế"] = style;
      }

      // ── 8. COOLING (Tản nhiệt) ────────────────────────
      else if (categoryName.includes("COOLING") || categoryName.includes("TẢN") || nameUpper.includes("COOLER") || nameUpper.includes("AIO") || nameUpper.includes("KRAKEN")) {
        const isAio = nameUpper.includes("AIO") || nameUpper.includes("LS720") || nameUpper.includes("KRAKEN") || nameUpper.includes("240") || nameUpper.includes("360") || norm.includes("nuoc");
        const coolingType = isAio ? "Tản Nhiệt Nước AIO" : "Tản Nhiệt Khí Tháp";
        const rad = nameUpper.includes("360") ? "360mm 3 Fan" : nameUpper.includes("240") ? "240mm 2 Fan" : "Tháp 4-6 Ống Đồng PWM";

        specsToApply["Loại tản nhiệt"] = coolingType;
        specsToApply["Kích thước Tản / Radiator"] = rad;
        specsToApply["TDP Giải nhiệt tối đa"] = isAio ? "250W - 350W TDP" : "180W - 220W TDP";
        specsToApply["Socket hỗ trợ"] = "LGA1700, AM5, AM4, LGA1200";
        specsToApply["Độ ồn quạt"] = "~26 - 30 dBA (Êm ái)";
        specsToApply["Đèn LED"] = nameUpper.includes("ARGB") || nameUpper.includes("RGB") ? "ARGB 16.8M đồng bộ Mainboard" : "Không LED tinh tế";
      }

      // Apply to all SKUs of this product
      for (const [key, val] of Object.entries(specsToApply)) {
        const attrId = await getOrCreateAttr(key);
        const attrValId = await getOrCreateAttrVal(attrId, val);

        if (Array.isArray(prod.ProductSku)) {
          for (const sku of prod.ProductSku) {
            const existingSkuAttr = await prisma.skuAttribute.findFirst({
              where: { sku_id: sku.id, attribute_value_id: attrValId }
            });
            if (!existingSkuAttr) {
              await prisma.skuAttribute.create({
                data: { sku_id: sku.id, attribute_value_id: attrValId }
              });
              skusUpdated++;
            }
          }
        }
      }
    }

    console.log(`✅ Successfully seeded hardware attributes for ${products.length} products!`);
    console.log(`   - Connected SKU Attributes: ${skusUpdated}`);
    console.log(`   - Total Attributes In System: ${attrCache.size}`);
  } catch (err) {
    console.error("Seeding error:", err);
    throw err;
  }
}

seedHardwareSpecs()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
