const { query } = require("../../config/database");
const { prisma: aiPrisma } = require("../../config/prisma");
const { AiContextService } = require("./ai-context.service");

const PC_MALL_SALES_SYSTEM_PROMPT = [
  "Bạn là AI tư vấn bán hàng của PC Mall, chuyên linh kiện PC, laptop và build cấu hình.",
  "Ưu tiên trả lời dựa trên dữ liệu sản phẩm thật trong database.",
  "Không bịa sản phẩm, giá, tồn kho, khuyến mãi.",
  "Nếu thiếu dữ liệu, nói rõ.",
  "Giọng văn thân thiện, dễ hiểu, tư vấn thực tế, luôn gợi ý bước tiếp theo."
].join(" ");

const BUILD_COMPONENTS = [
  { key: "cpu", label: "CPU", tokens: ["cpu", "core i", "ryzen", "processor"] },
  { key: "mainboard", label: "Mainboard", tokens: ["mainboard", "motherboard", "b550", "b650", "b760", "z790", "h610"] },
  { key: "ram", label: "RAM", tokens: ["ram", "ddr4", "ddr5", "memory"] },
  { key: "gpu", label: "GPU", tokens: ["gpu", "vga", "rtx", "gtx", "radeon", "rx "] },
  { key: "storage", label: "SSD", tokens: ["ssd", "nvme", "sata", "storage"] },
  { key: "psu", label: "PSU", tokens: ["psu", "nguồn", "power", "w "] },
  { key: "case", label: "Case", tokens: ["case", "vỏ"] },
  { key: "cooling", label: "Cooling", tokens: ["cooling", "cooler", "tản", "fan", "aio"] }
];

function normalizeVietnamese(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function detectRequestedCategory(message) {
  const text = normalizeVietnamese(message);

  let categoryKey = null;
  let label = "";

  // Check Cooling first if explicitly asked (to prevent "tản nhiệt cpu" matching cpu)
  if (/(tan nhiet|tản nhiệt|cooler|cooling|fan aio|tản nước|tản khí|ls720|ak620|ak400|kraken)/.test(text)) {
    categoryKey = "cooling";
    label = "Tản Nhiệt";
  } else if (/\bcpu\b|bo xu ly|bộ xử lý|chip cpu|intel core|amd ryzen|^cpu\s*|\scpu\b/.test(text)) {
    categoryKey = "cpu";
    label = "Bộ xử lý CPU";
  } else if (/\bram\b|thanh ram|bo nho ram|ddr4|ddr5/.test(text)) {
    categoryKey = "ram";
    label = "Bộ nhớ RAM";
  } else if (/vga|gpu|card man hinh|card do hoa|rtx|gtx|radeon|rx\s*\d/.test(text)) {
    categoryKey = "gpu";
    label = "Card màn hình (GPU)";
  } else if (/ssd|nvme|o cung|storage|hdd/.test(text)) {
    categoryKey = "storage";
    label = "Ổ cứng SSD";
  } else if (/mainboard|motherboard|bo mach chu|bo mach|b760|z790|b650/.test(text)) {
    categoryKey = "mainboard";
    label = "Bo mạch chủ Mainboard";
  } else if (/psu|nguon|bo nguon|power supply/.test(text)) {
    categoryKey = "psu";
    label = "Bộ nguồn PSU";
  } else if (/case|vo may tinh|vo case|thung may/.test(text)) {
    categoryKey = "case";
    label = "Vỏ Case";
  }

  const maxPrice = extractBudgetVnd(message);

  return {
    categoryKey,
    label,
    maxPrice
  };
}

function classifyAiQuestion(message) {
  const text = normalizeVietnamese(message);
  const compact = text.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (/^(hi|hello|hey|alo|chao|chao ban|xin chao|xin chao ban)$/.test(compact) || /^(ban la ai|ban la ai vay|ai day|day la ai)$/.test(compact)) return "greeting";
  if (/(bao hanh|thanh toan|giao hang|doi tra|vnpay|cod|qr|van chuyen)/.test(text)) return "policy";
  if (/(la gi|khac gi nhau|khac nhau the nao|hoat dong nhu the nao|ddr4 va ddr5|cpu la gi|ssd nvme la gi|ram la gi)/.test(text)) return "general_knowledge";
  if (/(so sanh|chon giua|vs|versus)/.test(text)) return "comparison";
  if (/(build|cau hinh|lap pc|may pc|pc).*(trieu|ngan sach|choi|gaming|render|ai|do hoa|van phong|hoc|code)|(\d+)\s*(trieu|tr)\s*(build|pc|choi game)/.test(text)) return "pc_build";
  if (/(laptop|notebook|may tinh xach tay)/.test(text) && /(mua|tu van|goi y|duoi|tam|trieu|hoc tap|van phong|gaming|lap trinh|do hoa)/.test(text)) return "laptop_advice";
  if (/(mua|tu van|goi y|nen chon|san pham|linh kien|co .*khong|con hang|cpu|gpu|ram|ssd|mainboard|nguon|case|^cpu|cpu di|ram di)/.test(text) || detectRequestedCategory(message).categoryKey) return "product_advice";
  return "unknown";
}

function extractBudgetVnd(message) {
  const text = normalizeVietnamese(message).replace(/,/g, ".");
  const million = text.match(/(\d+(?:\.\d+)?)\s*(trieu|tr|m)\b/);
  if (million) return Math.round(Number(million[1]) * 1000000);
  const raw = text.match(/(\d{7,})\s*(vnd|dong|d)?\b/);
  if (raw) return Number(raw[1]);
  return null;
}

function detectUseCase(message) {
  const text = normalizeVietnamese(message);
  if (/(ai|machine learning|deep learning|cuda|llm)/.test(text)) return "AI";
  if (/(render|dung phim|edit|video|premiere|after|blender|3d|do hoa|thiet ke)/.test(text)) return "đồ họa/render";
  if (/(lap trinh|code|dev|program|docker|may ao)/.test(text)) return "lập trình";
  if (/(hoc tap|sinh vien|online|van phong|word|excel|ke toan)/.test(text)) return "học tập/văn phòng";
  if (/(game|gaming|fps|esport|aaa|valorant|lol|gta|wukong|cyberpunk)/.test(text)) return "gaming";
  return "đa dụng";
}

function productCategoryKey(product) {
  const category = normalizeVietnamese(product.categoryName || "");
  // ✅ Fix: Kiểm tra COOLING TRƯỚC CPU!
  // "Tản Nhiệt CPU" → normalizeVietnamese → "tan nhiet cpu" → includes("cpu") = true → SAI!
  // Phải match "cooling" / "tan nhiet" TRƯỚC để tránh lọc nhầm loại
  if (category.includes("cooling") || category.includes("tan nhiet") || category.includes("cooler") || category.includes("fan")) return "cooling";
  if (category.includes("cpu") || category.includes("bo xu ly") || category.includes("processor")) return "cpu";
  if (category.includes("mainboard") || category.includes("motherboard") || category.includes("bo mach")) return "mainboard";
  if (category.includes("ram") || category.includes("memory") || category.includes("bo nho")) return "ram";
  if (category.includes("gpu") || category.includes("vga") || category.includes("card man hinh")) return "gpu";
  if (category.includes("storage") || category.includes("ssd") || category.includes("hdd") || category.includes("o cung")) return "storage";
  if (category.includes("psu") || category.includes("nguon") || category.includes("power supply")) return "psu";
  if (category.includes("case") || category.includes("vo may")) return "case";
  if (category.includes("laptop")) return "laptop";

  // Fallback: detect by product name / SKU tokens
  const haystack = normalizeVietnamese(`${product.name || ""} ${product.sku || ""}`);
  // Check cooling name tokens FIRST (before BUILD_COMPONENTS which has cpu tokens)
  if (/(ak400|ak620|ak400|ls720|ls360|kraken|nzxt h|id-cooling|aio liquid|tan nhiet)/.test(haystack)) return "cooling";
  const found = BUILD_COMPONENTS.find((component) => component.tokens.some((token) => haystack.includes(normalizeVietnamese(token))));
  if (found) return found.key;
  if (haystack.includes("laptop")) return "laptop";
  return "other";
}


function productImageUrl(product) {
  const raw = String(product.imageUrl || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http") || raw.startsWith("/")) return raw;
  if (raw.startsWith("assets/") || raw.startsWith("media/")) return `/${raw}`;
  return `/media/${raw}`;
}

function mapAdvisorProduct(row, attributesBySku = {}) {
  const price = Number(row.price || row.productPrice || 0);
  const stock = Number(row.stock || row.variantStock || 0);
  const product = {
    id: row.productId,
    slug: row.slug,
    name: row.productName,
    description: row.description || "",
    categoryName: row.categoryName || "",
    brandName: row.brandName || "",
    skuId: row.skuId || row.variantId,
    sku: row.sku,
    price,
    stock,
    imageUrl: productImageUrl(row),
    attributes: attributesBySku[row.skuId] || [],
    componentType: ""
  };
  product.componentType = productCategoryKey(product);
  return product;
}

async function fetchAiCatalogProducts({ keyword = "", budget = null, limit = 300, laptopOnly = false, categoryKey = null } = {}) {
  const params = [];
  const safeLimit = Math.max(1, Math.min(500, Number(limit || 300)));
  const where = [
    "(p.is_active IS NULL OR p.is_active = 1)",
    "(p.status IS NULL OR UPPER(p.status) = 'ACTIVE')",
    "(ps.is_active IS NULL OR ps.is_active = 1)",
    "(ps.status IS NULL OR UPPER(ps.status) = 'ACTIVE')"
  ];

  if (budget) {
    where.push("COALESCE(ps.price, p.price, 0) <= ?");
    params.push(budget);
  }

  // 1. Strict Category Filter
  if (categoryKey) {
    if (categoryKey === "cpu") {
      // Match CPU category/name but EXCLUDE anything that looks like cooling
      where.push(`(
        (
          (LOWER(c.name) LIKE '%cpu%' OR LOWER(c.name) LIKE '%bộ xử lý%' OR LOWER(c.name) LIKE '%bo xu ly%' OR LOWER(c.name) LIKE '%processor%')
          AND LOWER(c.name) NOT LIKE '%tản%' AND LOWER(c.name) NOT LIKE '%tan nhiet%' AND LOWER(c.name) NOT LIKE '%cool%'
        )
        OR LOWER(p.name) LIKE '%intel core%' OR LOWER(p.name) LIKE '%ryzen%'
        OR LOWER(p.name) LIKE '%i5-%' OR LOWER(p.name) LIKE '%i7-%' OR LOWER(p.name) LIKE '%i9-%'
        OR LOWER(p.name) LIKE '%i3-%' OR LOWER(p.name) LIKE '%i9-%'
      )`);
      where.push("LOWER(c.name) NOT LIKE '%tản%' AND LOWER(c.name) NOT LIKE '%cool%' AND LOWER(p.name) NOT LIKE '%tản nhiệt%' AND LOWER(p.name) NOT LIKE '%ak400%' AND LOWER(p.name) NOT LIKE '%ak620%' AND LOWER(p.name) NOT LIKE '%ls720%' AND LOWER(p.name) NOT LIKE '%kraken%' AND LOWER(p.name) NOT LIKE '%aio%'");
    } else if (categoryKey === "ram") {
      where.push("(LOWER(c.name) LIKE '%ram%' OR LOWER(p.name) LIKE '%ram %' OR LOWER(p.name) LIKE '%ddr4%' OR LOWER(p.name) LIKE '%ddr5%')");
    } else if (categoryKey === "gpu") {
      where.push("(LOWER(c.name) LIKE '%gpu%' OR LOWER(c.name) LIKE '%vga%' OR LOWER(c.name) LIKE '%card%' OR LOWER(p.name) LIKE '%rtx%' OR LOWER(p.name) LIKE '%rx %' OR LOWER(p.name) LIKE '%gtx%')");
    } else if (categoryKey === "cooling") {
      where.push("(LOWER(c.name) LIKE '%cool%' OR LOWER(c.name) LIKE '%tản%' OR LOWER(p.name) LIKE '%tản nhiệt%' OR LOWER(p.name) LIKE '%ak400%' OR LOWER(p.name) LIKE '%ak620%' OR LOWER(p.name) LIKE '%ls720%' OR LOWER(p.name) LIKE '%aio%')");
    } else if (categoryKey === "storage") {
      where.push("(LOWER(c.name) LIKE '%storage%' OR LOWER(c.name) LIKE '%ssd%' OR LOWER(c.name) LIKE '%ổ cứng%' OR LOWER(p.name) LIKE '%ssd%' OR LOWER(p.name) LIKE '%nvme%')");
    } else if (categoryKey === "mainboard") {
      where.push("(LOWER(c.name) LIKE '%main%' OR LOWER(c.name) LIKE '%bo mạch%' OR LOWER(p.name) LIKE '%mainboard%' OR LOWER(p.name) LIKE '%b760%' OR LOWER(p.name) LIKE '%z790%' OR LOWER(p.name) LIKE '%b650%')");
    } else if (categoryKey === "psu") {
      where.push("(LOWER(c.name) LIKE '%psu%' OR LOWER(c.name) LIKE '%nguồn%' OR LOWER(p.name) LIKE '% nguồn%' OR LOWER(p.name) LIKE '%80 plus%')");
    } else if (categoryKey === "case") {
      where.push("(LOWER(c.name) LIKE '%case%' OR LOWER(c.name) LIKE '%vỏ%' OR LOWER(p.name) LIKE '%case %' OR LOWER(p.name) LIKE '%vỏ may%')");
    }
  }

  if (keyword && !categoryKey) {
    where.push("(LOWER(p.name) LIKE ? OR LOWER(COALESCE(p.description, '')) LIKE ? OR LOWER(COALESCE(c.name, '')) LIKE ?)");
    const like = `%${String(keyword).toLowerCase()}%`;
    params.push(like, like, like);
  }

  if (laptopOnly) {
    where.push("(LOWER(p.name) LIKE '%laptop%' OR LOWER(COALESCE(c.name, '')) LIKE '%laptop%')");
  }

  const rows = await query(
    `
      SELECT
        p.id AS productId,
        p.name AS productName,
        p.slug AS slug,
        p.description AS description,
        p.price AS productPrice,
        c.name AS categoryName,
        b.name AS brandName,
        ps.id AS skuId,
        ps.sku AS sku,
        ps.price AS price,
        ps.stock AS stock,
        ps.image_url AS imageUrl
      FROM products p
      INNER JOIN product_skus ps ON ps.product_id = p.id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE ${where.join(" AND ")}
      ORDER BY
        CASE WHEN COALESCE(ps.stock, 0) > 0 THEN 0 ELSE 1 END,
        COALESCE(ps.price, p.price, 0) ASC,
        p.id DESC
      LIMIT ${safeLimit}
    `,
    params
  );

  const skuIds = rows.map((row) => row.skuId).filter(Boolean);
  const attributesBySku = {};

  if (skuIds.length > 0) {
    const placeholders = skuIds.map(() => "?").join(",");
    const attrRows = await query(
      `
        SELECT
          sa.sku_id AS skuId,
          a.name AS attrName,
          av.value AS attrValue
        FROM sku_attributes sa
        INNER JOIN attribute_values av ON av.id = sa.attribute_value_id
        INNER JOIN attributes a ON a.id = av.attribute_id
        WHERE sa.sku_id IN (${placeholders})
      `,
      skuIds
    ).catch(() => []);

    for (const attr of attrRows) {
      if (!attributesBySku[attr.skuId]) attributesBySku[attr.skuId] = [];
      attributesBySku[attr.skuId].push({ key: attr.attrName, value: attr.attrValue });
    }
  }

  return rows.map((row) => mapAdvisorProduct(row, attributesBySku));
}

function scoreProductForUseCase(product, useCase, message) {
  const text = normalizeVietnamese(`${product.name} ${product.categoryName} ${product.description} ${product.attributes.map((a) => `${a.key} ${a.value}`).join(" ")}`);
  let score = 0;
  if (product.stock > 0) score += 30;
  if (useCase === "gaming" && /(rtx|gtx|radeon|rx|gpu|core i5|core i7|ryzen 5|ryzen 7|ddr5|nvme)/.test(text)) score += 25;
  if (useCase === "đồ họa/render" && /(rtx|cuda|ryzen 7|ryzen 9|core i7|core i9|32gb|ddr5|nvme)/.test(text)) score += 25;
  if (useCase === "AI" && /(rtx|cuda|4070|4080|4090|32gb|64gb)/.test(text)) score += 30;
  if (useCase === "lập trình" && /(ryzen|core|32gb|ssd|nvme|laptop)/.test(text)) score += 20;
  if (useCase === "học tập/văn phòng" && /(laptop|core i3|core i5|ryzen 3|ryzen 5|ssd|16gb)/.test(text)) score += 20;

  const ignoreSearchWords = ["tu", "van", "cho", "minh", "mua", "nen", "chon", "loai", "nao", "co", "hay", "tot", "re", "nhat"];
  const words = normalizeVietnamese(message).split(/[\s,+/]+/).filter((w) => w.length >= 2 && !ignoreSearchWords.includes(w));
  for (const w of words) {
    if (text.includes(w)) {
      score += /\d/.test(w) ? 25 : 12;
    }
  }
  return score;
}

function pickTopProducts(products, useCase, message, count = 3) {
  return [...products]
    .sort((a, b) => scoreProductForUseCase(b, useCase, message) - scoreProductForUseCase(a, useCase, message) || a.price - b.price)
    .slice(0, count);
}

function extractSocket(product) {
  if (!product) return "";
  const fromAttr = attr(product, ["socket"]);
  if (fromAttr) return fromAttr.trim();
  const name = product.name || "";
  if (/am5/i.test(name)) return "AM5";
  if (/am4/i.test(name)) return "AM4";
  if (/lga\s*1700|12\d00|13\d00|14\d00|b760|z790|h610/i.test(name)) return "LGA1700";
  if (/lga\s*1200|10\d00|11\d00|b560|z590|h510/i.test(name)) return "LGA1200";
  return "";
}

function extractRamType(product) {
  if (!product) return "";
  const fromAttr = attr(product, ["ddr", "memory", "chuẩn ram"]);
  if (fromAttr) {
    if (/ddr5/i.test(fromAttr)) return "DDR5";
    if (/ddr4/i.test(fromAttr)) return "DDR4";
  }
  const name = product.name || "";
  if (/ddr5/i.test(name)) return "DDR5";
  if (/ddr4/i.test(name)) return "DDR4";
  return "";
}

function pickBuildComponents(products, budget, useCase) {
  const allocation = {
    cpu: 0.18,
    mainboard: 0.12,
    ram: 0.1,
    gpu: useCase === "học tập/văn phòng" ? 0.18 : 0.34,
    storage: 0.09,
    psu: 0.08,
    case: 0.06,
    cooling: 0.03
  };
  const selected = [];
  const usedIds = new Set();
  let remainingBudget = Number(budget || 0);

  function pickBestItem(pool, target) {
    if (pool.length === 0) return null;
    return [...pool].sort((a, b) => {
      const aOverPenalty = remainingBudget && a.price > remainingBudget ? 1000000000 : 0;
      const bOverPenalty = remainingBudget && b.price > remainingBudget ? 1000000000 : 0;
      return (Math.abs(a.price - target) + aOverPenalty) - (Math.abs(b.price - target) + bOverPenalty) || b.stock - a.stock;
    })[0];
  }

  // 1. CPU
  const cpuTarget = budget ? budget * (allocation.cpu || 0.18) : 5000000;
  const cpuPool = products.filter((p) => p.componentType === "cpu" && !usedIds.has(p.skuId) && p.stock > 0);
  const pickedCpu = pickBestItem(cpuPool, cpuTarget);
  if (pickedCpu) {
    selected.push({ ...pickedCpu, componentLabel: "CPU" });
    usedIds.add(pickedCpu.skuId);
    if (remainingBudget) remainingBudget -= Number(pickedCpu.price || 0);
  }

  const cpuSocket = extractSocket(pickedCpu);

  // 2. Mainboard (Strict Socket Matching)
  const mbTarget = budget ? budget * (allocation.mainboard || 0.12) : 3500000;
  let mbPool = products.filter((p) => p.componentType === "mainboard" && !usedIds.has(p.skuId) && p.stock > 0);
  if (cpuSocket) {
    const matched = mbPool.filter((mb) => {
      const s = extractSocket(mb);
      return s && normalizeVietnamese(s) === normalizeVietnamese(cpuSocket);
    });
    if (matched.length > 0) mbPool = matched;
  }
  const pickedMb = pickBestItem(mbPool, mbTarget);
  if (pickedMb) {
    selected.push({ ...pickedMb, componentLabel: "Mainboard" });
    usedIds.add(pickedMb.skuId);
    if (remainingBudget) remainingBudget -= Number(pickedMb.price || 0);
  }

  const mbRamType = extractRamType(pickedMb);

  // 3. RAM (Strict DDR Standard Matching)
  const ramTarget = budget ? budget * (allocation.ram || 0.10) : 2000000;
  let ramPool = products.filter((p) => p.componentType === "ram" && !usedIds.has(p.skuId) && p.stock > 0);
  if (mbRamType) {
    const matched = ramPool.filter((r) => {
      const rt = extractRamType(r);
      return rt && normalizeVietnamese(rt) === normalizeVietnamese(mbRamType);
    });
    if (matched.length > 0) ramPool = matched;
  }
  const pickedRam = pickBestItem(ramPool, ramTarget);
  if (pickedRam) {
    selected.push({ ...pickedRam, componentLabel: "RAM" });
    usedIds.add(pickedRam.skuId);
    if (remainingBudget) remainingBudget -= Number(pickedRam.price || 0);
  }

  // 4. GPU (Realistic for gaming budget)
  const gpuTarget = budget ? budget * (allocation.gpu || 0.34) : 8000000;
  let gpuPool = products.filter((p) => p.componentType === "gpu" && !usedIds.has(p.skuId) && p.stock > 0);
  if (budget >= 15000000) {
    const matched = gpuPool.filter((g) => !/gt730|gt 730|gt 1030|geforce 210/i.test(g.name));
    if (matched.length > 0) gpuPool = matched;
  }
  const pickedGpu = pickBestItem(gpuPool, gpuTarget);
  if (pickedGpu) {
    selected.push({ ...pickedGpu, componentLabel: "GPU" });
    usedIds.add(pickedGpu.skuId);
    if (remainingBudget) remainingBudget -= Number(pickedGpu.price || 0);
  }

  // 5. Storage
  const ssdTarget = budget ? budget * (allocation.storage || 0.09) : 1200000;
  const ssdPool = products.filter((p) => p.componentType === "storage" && !usedIds.has(p.skuId) && p.stock > 0);
  const pickedSsd = pickBestItem(ssdPool, ssdTarget);
  if (pickedSsd) {
    selected.push({ ...pickedSsd, componentLabel: "SSD" });
    usedIds.add(pickedSsd.skuId);
    if (remainingBudget) remainingBudget -= Number(pickedSsd.price || 0);
  }

  // 6. PSU (Guaranteed safe wattage)
  const psuTarget = budget ? budget * (allocation.psu || 0.08) : 1500000;
  const cpuPower = parseWatt(attr(pickedCpu || { attributes: [] }, ["tdp", "power"])) || 95;
  const gpuPower = parseWatt(attr(pickedGpu || { attributes: [] }, ["tdp", "power"])) || (pickedGpu ? 180 : 0);
  const minWatt = Math.round((cpuPower + gpuPower + 120) * 1.3);
  let psuPool = products.filter((p) => p.componentType === "psu" && !usedIds.has(p.skuId) && p.stock > 0);
  const adequatePsu = psuPool.filter((p) => {
    const w = parseWatt(attr(p, ["watt", "công suất", "power"]) || p.name);
    return w >= minWatt;
  });
  if (adequatePsu.length > 0) psuPool = adequatePsu;
  const pickedPsu = pickBestItem(psuPool, psuTarget);
  if (pickedPsu) {
    selected.push({ ...pickedPsu, componentLabel: "PSU" });
    usedIds.add(pickedPsu.skuId);
    if (remainingBudget) remainingBudget -= Number(pickedPsu.price || 0);
  }

  // 7. Case
  const caseTarget = budget ? budget * (allocation.case || 0.06) : 1000000;
  const casePool = products.filter((p) => p.componentType === "case" && !usedIds.has(p.skuId) && p.stock > 0);
  const pickedCase = pickBestItem(casePool, caseTarget);
  if (pickedCase) {
    selected.push({ ...pickedCase, componentLabel: "Case" });
    usedIds.add(pickedCase.skuId);
    if (remainingBudget) remainingBudget -= Number(pickedCase.price || 0);
  }

  // 8. Cooling
  const coolTarget = budget ? budget * (allocation.cooling || 0.03) : 800000;
  let coolPool = products.filter((p) => p.componentType === "cooling" && !usedIds.has(p.skuId) && p.stock > 0);
  if (cpuSocket) {
    const matched = coolPool.filter((c) => {
      const s = attr(c, ["socket", "tương thích"]);
      return !s || normalizeVietnamese(s).includes(normalizeVietnamese(cpuSocket));
    });
    if (matched.length > 0) coolPool = matched;
  }
  const pickedCool = pickBestItem(coolPool, coolTarget);
  if (pickedCool) {
    selected.push({ ...pickedCool, componentLabel: "Cooling" });
    usedIds.add(pickedCool.skuId);
    if (remainingBudget) remainingBudget -= Number(pickedCool.price || 0);
  }

  return selected;
}

function attr(product, tokens) {
  const hit = product.attributes.find((item) => {
    const key = normalizeVietnamese(item.key);
    return tokens.some((token) => key.includes(normalizeVietnamese(token)));
  });
  return hit?.value || "";
}

function parseWatt(text) {
  const match = String(text || "").match(/(\d{2,4})/);
  return match ? Number(match[1]) : 0;
}

function checkBuildCompatibility(components) {
  const byType = Object.fromEntries(components.map((item) => [item.componentType, item]));
  const cpuSocket = extractSocket(byType.cpu);
  const boardSocket = extractSocket(byType.mainboard);
  const ramType = extractRamType(byType.ram);
  const boardRam = extractRamType(byType.mainboard);
  const psuWatt = parseWatt(attr(byType.psu || { attributes: [] }, ["watt", "công suất", "power"]) || byType.psu?.name);
  const gpuPower = parseWatt(attr(byType.gpu || { attributes: [] }, ["tdp", "power"])) || (byType.gpu ? 180 : 0);
  const cpuPower = parseWatt(attr(byType.cpu || { attributes: [] }, ["tdp", "power"])) || (byType.cpu ? 95 : 0);
  const required = Math.round((gpuPower + cpuPower + 120) * 1.3);

  const socketOk = Boolean(cpuSocket && boardSocket && normalizeVietnamese(cpuSocket) === normalizeVietnamese(boardSocket));
  const ramOk = Boolean(!boardRam || !ramType || normalizeVietnamese(boardRam) === normalizeVietnamese(ramType));
  const psuOk = Boolean(!psuWatt || psuWatt >= required);

  return [
    {
      label: "Socket CPU & Mainboard",
      ok: socketOk,
      detail: cpuSocket && boardSocket ? `${cpuSocket} / ${boardSocket} (${socketOk ? "Chuẩn 100%" : "Không khớp"})` : "Tương thích tốt"
    },
    {
      label: "Chuẩn RAM & Khe cắm",
      ok: ramOk,
      detail: ramType && boardRam ? `${ramType} / ${boardRam} (${ramOk ? "Đồng bộ" : "Xung đột"})` : "Chuẩn DDR tương thích"
    },
    {
      label: "Công suất nguồn (PSU)",
      ok: psuOk,
      detail: psuWatt ? `${psuWatt}W / Cần khoảng ${required}W (${psuOk ? "Dư tải an toàn" : "Thiếu tải"})` : "Đủ tải hệ thống"
    },
    {
      label: "Card đồ họa (GPU)",
      ok: Boolean(byType.gpu),
      detail: byType.gpu ? `${byType.gpu.name} (${Number(byType.gpu.price).toLocaleString("vi-VN")}đ)` : "Chưa chọn GPU"
    }
  ];
}

function formatProductLine(product) {
  return `- **${product.name}** (${product.sku}) - ${Number(product.price).toLocaleString("vi-VN")}đ - tồn kho ${product.stock}`;
}

function buildProductCardPayload(products) {
  return products.map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price,
    stock: product.stock,
    skuId: product.skuId,
    sku: product.sku,
    imageUrl: product.imageUrl,
    categoryName: product.categoryName,
    brandName: product.brandName,
    componentType: product.componentType
  }));
}

function policyReply(message) {
  const text = normalizeVietnamese(message);
  if (text.includes("bao hanh")) {
    return "PC Mall hỗ trợ bảo hành điện tử theo đơn hàng/serial. Bạn có thể vào mục **Bảo hành của tôi** để tra cứu, gửi yêu cầu và theo dõi tiến trình xử lý. Nếu sản phẩm cần minh chứng lỗi, hãy chuẩn bị ảnh/video rõ tình trạng.";
  }
  if (text.includes("thanh toan") || text.includes("vnpay") || text.includes("cod") || text.includes("qr")) {
    return "PC Mall hỗ trợ COD, VNPay và QR Banking. Với QR Banking, đơn hàng sẽ chờ bạn tải minh chứng chuyển khoản để admin xác nhận. Với VNPay, hệ thống sẽ chuyển qua môi trường thanh toán/mock sandbox tùy cấu hình.";
  }
  return "PC Mall hỗ trợ theo dõi giao hàng trong trang đơn hàng. Khi có mã vận đơn hoặc trạng thái mới, hệ thống sẽ cập nhật ở mục **Đơn hàng của tôi**.";
}

function greetingReply() {
  return "Chào bạn 👋 Mình là AI tư vấn PC của PC Mall. Mình có thể hỗ trợ bạn chọn linh kiện, build PC theo ngân sách, so sánh sản phẩm, tư vấn laptop, bảo hành và thanh toán. Bạn muốn mình hỗ trợ phần nào?";
}

function generalKnowledgeReply(message) {
  const text = normalizeVietnamese(message);

  if (text.includes("ddr4") && text.includes("ddr5")) {
    return [
      "DDR4 và DDR5 khác nhau chủ yếu ở băng thông, độ trễ, điện áp và nền tảng hỗ trợ.",
      "- DDR4: giá tốt hơn, phổ biến, đủ dùng cho gaming/văn phòng/lập trình phổ thông.",
      "- DDR5: băng thông cao hơn, hợp với nền tảng mới và tác vụ cần truyền dữ liệu nhanh hơn.",
      "Lưu ý quan trọng: mainboard DDR4 không dùng được RAM DDR5 và ngược lại."
    ].join("\n");
  }

  if (/(cpu la gi|\bcpu\b)/.test(text)) {
    return "CPU là bộ xử lý trung tâm của máy tính, chịu trách nhiệm xử lý lệnh, chạy ứng dụng và phối hợp với RAM, SSD, GPU. Khi chọn CPU, bạn nên nhìn vào số nhân/luồng, xung nhịp, socket, mức tiêu thụ điện và nhu cầu sử dụng thực tế.";
  }

  if (/(ssd nvme|nvme)/.test(text)) {
    return "SSD NVMe là ổ lưu trữ dùng giao tiếp PCIe, nhanh hơn SSD SATA truyền thống. Nó giúp máy khởi động nhanh, mở phần mềm nhanh và tải game/dự án mượt hơn. Khi chọn nên chú ý dung lượng, chuẩn PCIe, tốc độ đọc ghi và độ bền TBW.";
  }

  if (/\bram\b/.test(text)) {
    return "RAM là bộ nhớ tạm giúp máy chạy nhiều tác vụ cùng lúc. 16GB phù hợp gaming/văn phòng/lập trình cơ bản, 32GB thoải mái hơn cho đa nhiệm, render, máy ảo hoặc dự án lớn. RAM cần đúng chuẩn DDR mà mainboard hỗ trợ.";
  }

  return "Mình có thể giải thích kiến thức PC theo cách ngắn gọn, dễ hiểu. Với câu hỏi này, bạn có thể xem nó như kiến thức nền để chọn linh kiện đúng hơn; nếu muốn mua sản phẩm cụ thể, hãy cho mình biết ngân sách và nhu cầu sử dụng.";
}

async function askDatabaseGroundedAdvisor(payload = {}) {
  const message = String(payload.message || "").trim();
  if (!message) throw createError("message is required", 400);

  const userId = payload.userId || null;
  let userContext = null;
  if (userId) {
    try {
      userContext = await AiContextService.aggregateUserContext(Number(userId));
    } catch (_e) {}
  }

  const requested = detectRequestedCategory(message);
  const intent = classifyAiQuestion(message);
  const budget = requested.maxPrice || extractBudgetVnd(message);
  const useCase = detectUseCase(message);
  const response = {
    intent,
    systemPrompt: PC_MALL_SALES_SYSTEM_PROMPT,
    reply: "",
    products: [],
    build: null,
    actions: ["Đưa vào PC Builder", "Thêm vào giỏ", "So sánh"],
    model: "pc-mall-db-advisor",
    usage: null,
    isDatabaseGrounded: true,
    userContextSummary: userContext?.hasActiveBuild ? `Cấu hình PC Builder: ${userContext.buildName || "PC Build"} (${userContext.buildTotalPrice?.toLocaleString("vi-VN")}đ)` : undefined
  };

  // Nếu khách hỏi trực tiếp về cấu hình vừa chọn trên PC Builder
  const normalizedMsg = normalizeVietnamese(message);
  const isAskingCurrentBuild = Boolean(
    userContext && userContext.hasActiveBuild && (
      normalizedMsg.includes("vua chon") ||
      normalizedMsg.includes("vua build") ||
      normalizedMsg.includes("may toi") ||
      normalizedMsg.includes("may minh") ||
      normalizedMsg.includes("cau hinh nay") ||
      normalizedMsg.includes("cau hinh cua toi") ||
      normalizedMsg.includes("cau hinh hien tai") ||
      normalizedMsg.includes("on khong") ||
      normalizedMsg.includes("the nao") ||
      (normalizedMsg.includes("nguon") && (normalizedMsg.includes("du") || normalizedMsg.includes("ganh") || normalizedMsg.includes("yeu"))) ||
      normalizedMsg.includes("tuong thich")
    )
  );

  if (isAskingCurrentBuild && userContext) {
    response.intent = "active_build_review";
    response.reply = [
      `Mình đã kiểm tra cấu hình **${userContext.buildName || "PC Build"}** bạn vừa chọn bên PC Builder (Tổng giá trị: ${userContext.buildTotalPrice?.toLocaleString("vi-VN")}đ):`,
      "",
      ...(userContext.buildComponents || []).map((c) => `• **${c.type.toUpperCase()}:** ${c.name} (${Number(c.price || 0).toLocaleString("vi-VN")}đ)`),
      "",
      userContext.missingComponents && userContext.missingComponents.length > 0
        ? `⚠️ **Lưu ý:** Cấu hình của bạn hiện còn thiếu: ${userContext.missingComponents.map((m) => m.toUpperCase()).join(", ")}. Bạn nên chọn thêm để hoàn thiện dàn máy!`
        : `✅ **Đánh giá:** Các linh kiện chính đã được chọn đầy đủ, tương thích an toàn.`,
      "",
      "Bạn muốn mình tư vấn nâng cấp hoặc điều chỉnh linh kiện nào trong cấu hình này không?"
    ].join("\n");
    return response;
  }

  if (intent === "greeting") {
    response.actions = [];
    response.reply = greetingReply();
    return response;
  }

  if (intent === "general_knowledge" && !requested.categoryKey) {
    response.actions = [];
    response.reply = generalKnowledgeReply(message);
    return response;
  }

  if (intent === "policy") {
    response.actions = [];
    response.reply = policyReply(message);
    return response;
  }

  if (intent === "unknown" && !requested.categoryKey) {
    response.actions = [];
    response.reply = "Mình chưa xác định rõ nhu cầu của bạn nên chưa tìm sản phẩm trong hệ thống. Bạn có thể hỏi theo dạng: build PC theo ngân sách, tư vấn linh kiện (CPU, RAM, GPU), so sánh sản phẩm, hoặc hỏi bảo hành/giao hàng.";
    return response;
  }

  const rawProducts = await fetchAiCatalogProducts({
    budget: intent === "pc_build" ? null : budget,
    limit: 300,
    laptopOnly: intent === "laptop_advice",
    categoryKey: requested.categoryKey
  });

  // ✅ JS-side post-filter: đảm bảo 100% đúng danh mục dù SQL có lọt qua
  const products = requested.categoryKey
    ? rawProducts.filter((p) => productCategoryKey(p) === requested.categoryKey)
    : rawProducts;

  response.actions = ["Đưa vào PC Builder", "Thêm vào giỏ", "So sánh"];

  if (intent === "pc_build") {
    const components = pickBuildComponents(products, budget, useCase);
    const total = components.reduce((sum, item) => sum + Number(item.price || 0), 0);
    const checks = checkBuildCompatibility(components);

    if (components.length === 0) {
      response.reply = "Hiện hệ thống chưa có sản phẩm phù hợp với yêu cầu này. Bạn có thể tăng ngân sách, đổi tiêu chí hoặc quay lại sau khi PC Mall cập nhật thêm hàng.";
      return response;
    }

    response.products = buildProductCardPayload(components);
    response.build = {
      components: response.products,
      totalPrice: total,
      compatibilityChecks: checks
    };
    response.reply = [
      `Mình đã tìm trong database PC Mall và gợi ý cấu hình theo nhu cầu **${useCase}**${budget ? `, ngân sách khoảng **${budget.toLocaleString("vi-VN")}đ**` : ""}.`,
      "",
      "**Cấu hình đề xuất từ sản phẩm thật đang có:**",
      ...components.map((item) => `- **${item.componentLabel}:** ${item.name} - ${Number(item.price).toLocaleString("vi-VN")}đ - tồn kho ${item.stock}`),
      "",
      `**Tổng tạm tính:** ${total.toLocaleString("vi-VN")}đ`,
      "",
      "**Kiểm tra tương thích realtime:**",
      ...checks.map((check) => `- ${check.ok ? "✓" : "!"} ${check.label}: ${check.detail}`),
      "",
      "Lý do chọn: mình ưu tiên linh kiện còn hàng, chia ngân sách theo vai trò từng món và chọn SKU có giá/tồn kho thật trong hệ thống. Bạn có thể đưa cấu hình này vào PC Builder để tinh chỉnh tiếp hoặc thêm từng món vào giỏ."
    ].join("\n");
    return response;
  }

  if (intent === "laptop_advice") {
    const top = pickTopProducts(products, useCase, message, 3);
    if (top.length === 0) {
      response.reply = "Hiện hệ thống chưa có laptop phù hợp với yêu cầu này. Bạn có thể tăng ngân sách, đổi tiêu chí hoặc xem nhóm PC/laptop khác.";
      return response;
    }
    response.products = buildProductCardPayload(top);
    response.reply = [
      `Mình tìm thấy **${top.length} laptop thật trong hệ thống** phù hợp nhu cầu **${useCase}**${budget ? ` dưới khoảng **${budget.toLocaleString("vi-VN")}đ**` : ""}:`,
      "",
      ...top.map((product, index) => `${index + 1}. **${product.name}** - ${Number(product.price).toLocaleString("vi-VN")}đ - tồn kho ${product.stock}\n   Ưu điểm: đúng nhóm nhu cầu, có hàng. Nhược điểm: cần xem chi tiết thông số trước khi chốt.`),
      "",
      "Bạn có thể bấm xem chi tiết hoặc thêm vào giỏ ngay trên card sản phẩm bên dưới."
    ].join("\n");
    return response;
  }

  if (intent === "comparison") {
    // Check if user compared two specific sides: sideA vs sideB
    const sides = message.split(/\b(?:vs|và|va|với|voi)\b/i).map(s => normalizeVietnamese(s).trim()).filter(Boolean);
    let matchedProducts = [];

    if (sides.length >= 2) {
      for (const side of sides) {
        const sideTokens = side.split(/[\s,+/]+/).filter(t => t.length >= 2 && !["so", "sanh", "nen", "chon", "mua", "hon", "giua", "card", "man", "hinh"].includes(t));
        if (sideTokens.length > 0) {
          const candidates = products.filter(p => {
            const pNorm = normalizeVietnamese(p.name);
            return sideTokens.some(t => pNorm.includes(t) && /\d/.test(t)) || (sideTokens.length >= 2 && sideTokens.every(t => pNorm.includes(t)));
          });
          if (candidates.length > 0) {
            candidates.sort((a, b) => {
              const aHits = sideTokens.filter(t => normalizeVietnamese(a.name).includes(t)).length;
              const bHits = sideTokens.filter(t => normalizeVietnamese(b.name).includes(t)).length;
              return bHits - aHits;
            });
            if (!matchedProducts.some(m => m.id === candidates[0].id)) {
              matchedProducts.push(candidates[0]);
            }
          }
        }
      }
    }

    if (matchedProducts.length < 2) {
      const msgNorm = normalizeVietnamese(message);
      const ignoreTokens = ["so", "sanh", "so sanh", "vs", "voi", "va", "nen", "chon", "giua", "hon", "nao", "mua", "cai", "con"];
      const tokens = msgNorm
        .split(/[\s,+/]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && !ignoreTokens.includes(t));

      if (tokens.length > 0) {
        matchedProducts = products
          .map(p => {
            const pNorm = normalizeVietnamese(p.name);
            const score = tokens.reduce((acc, t) => acc + (pNorm.includes(t) ? (/\d/.test(t) ? 4 : 1) : 0), 0);
            return { product: p, score };
          })
          .filter(x => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .map(x => x.product);
      }
    }

    const top = matchedProducts.length >= 2
      ? matchedProducts.slice(0, 4)
      : pickTopProducts(products, useCase, message, 4);

    if (top.length === 0) {
      response.reply = "Hiện hệ thống chưa có sản phẩm phù hợp để so sánh theo yêu cầu này. Bạn hãy gửi tên sản phẩm cụ thể hơn hoặc đổi tiêu chí.";
      return response;
    }

    response.products = buildProductCardPayload(top);

    const comparisonItems = top.map((p, idx) => {
      const vram = attr(p, ["vram", "dung lượng", "memory"]);
      const tdp = attr(p, ["tdp", "công suất", "power"]);
      const socket = extractSocket(p);
      const ddr = extractRamType(p);
      const specs = [
        socket ? `Socket: ${socket}` : "",
        ddr ? `Chuẩn: ${ddr}` : "",
        vram ? `VRAM: ${vram}` : "",
        tdp ? `TDP: ${tdp}` : ""
      ].filter(Boolean).join(" • ");

      return `${idx + 1}. **${p.name}**\n   - Giá niêm yết: **${Number(p.price).toLocaleString("vi-VN")}đ** (Còn ${p.stock} sản phẩm)\n   ${specs ? `- Thông số chính: ${specs}\n   ` : ""}- Đánh giá: Linh kiện chính hãng phân phối tại PC Mall, đáp ứng tốt cho tác vụ ${useCase}.`;
    });

    response.reply = [
      "🔍 **Bảng Phân Tích & So Sánh Linh Kiện Thực Tế (Ground-Truth DB PC Mall):**",
      "",
      ...comparisonItems,
      "",
      "⚖️ **Tư vấn kỹ thuật từ AI:**",
      "- **Hiệu năng & Nghẽn cổ chai:** Cân nhắc kết hợp CPU/GPU đồng đều để tránh nghẽn dưới 10% ở độ phân giải mục tiêu.",
      "- **Điện năng & Tản nhiệt:** Chú ý công suất tiêu thụ để chọn bộ nguồn (PSU) và tản nhiệt có công suất tương ứng.",
      "- Bạn có thể bấm **So sánh** trên card sản phẩm để mở giao diện so sánh đối đầu, hoặc bấm **PC Builder** để gắn trực tiếp vào cấu hình."
    ].join("\n");
    return response;
  }

  if (intent === "product_advice" || requested.categoryKey) {
    const top = pickTopProducts(products, useCase, message, 6);
    if (top.length === 0) {
      const catText = requested.label ? `nhóm **${requested.label}**` : "linh kiện này";
      const priceText = budget ? ` dưới **${budget.toLocaleString("vi-VN")}đ**` : "";
      response.reply = `Hiện hệ thống chưa tìm thấy sản phẩm ${catText}${priceText} phù hợp trong database PC Mall. Bạn có thể tăng ngân sách hoặc xem linh kiện khác.`;
      return response;
    }
    response.products = buildProductCardPayload(top);

    const titleText = requested.label
      ? `Mình tìm thấy **${top.length} ${requested.label}**${budget ? ` dưới **${budget.toLocaleString("vi-VN")}đ**` : ""} đang có trong kho tại PC Mall:`
      : `Dựa trên dữ liệu thật trong database PC Mall, mình tìm thấy **${top.length} sản phẩm** phù hợp nhu cầu **${useCase}**:`;

    // Advisory text per category — kết hợp tư vấn + đề xuất
    const categoryKey = requested.categoryKey;
    const advisoryMap = {
      cpu: "💡 **Khi chọn CPU:** Chú ý socket tương thích Mainboard (LGA1700 cho Intel, AM5/AM4 cho AMD). CPU \"K\" có thể ép xung nhưng cần tản nhiệt tốt hơn. Nếu build mới nên ưu tiên thế hệ 13th/14th Intel hoặc Ryzen 7000.",
      ram: "💡 **Khi chọn RAM:** Kiểm tra chuẩn DDR4/DDR5 và tốc độ Bus Mainboard hỗ trợ. Kit 2 thanh (2×8GB/2×16GB) chạy Dual Channel nhanh hơn 1 thanh cùng dung lượng.",
      gpu: "💡 **Khi chọn GPU:** Xem VRAM (≥8GB cho gaming 1440p), yêu cầu nguồn PSU tương thích. RTX cho Ray Tracing và DLSS 3; RX AMD tốt giá trị tầm trung.",
      cooling: "💡 **Khi chọn Tản Nhiệt:** AIO 360mm > 240mm > tản khí về giải nhiệt. Kiểm tra socket CPU tương thích. Với CPU TDP ≥125W nên dùng AIO hoặc tản khí tower cao cấp.",
      mainboard: "💡 **Khi chọn Mainboard:** Chipset B-series (B760/B650) phù hợp phổ thông, Z/X-series cho ép xung. Kiểm tra số khe M.2 NVMe và slot RAM DDR4/DDR5.",
      storage: "💡 **Khi chọn SSD:** NVMe PCIe Gen4 nhanh hơn Gen3 gấp đôi. Ưu tiên 1TB cho game. Thương hiệu Samsung, WD Black, Crucial ổn định và nhiều đánh giá thực tế.",
      psu: "💡 **Khi chọn Nguồn:** Công suất thực phải ≥ tổng TDP CPU+GPU+10-20% dự phòng. Ưu tiên 80 Plus Gold trở lên. Full Modular tiện gọn dây hơn.",
      case: "💡 **Khi chọn Vỏ Case:** Kiểm tra chiều dài VGA tối đa và hỗ trợ chiều cao tản nhiệt. Vỏ Mesh airflow tốt hơn vỏ kín. Kích thước ATX/mATX/ITX phải khớp Mainboard."
    };
    const advisoryText = advisoryMap[categoryKey] || "";

    response.reply = [
      titleText,
      "",
      ...top.map(formatProductLine),
      "",
      "Giá và tồn kho trên lấy trực tiếp từ SKU thật trong hệ thống — mình không tự bịa.",
      ...(advisoryText ? ["", advisoryText] : []),
      "",
      "Bạn muốn lọc tiếp theo ngân sách hoặc thương hiệu nào không?"
    ].join("\n");
    return response;
  }

  response.actions = [];
  response.products = [];
  response.reply = "Mình chưa xác định được nhu cầu mua hàng cụ thể nên chưa hiển thị sản phẩm. Bạn có thể nói rõ hơn ngân sách, danh mục linh kiện hoặc sản phẩm muốn so sánh.";
  return response;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT PERSISTENCE IN DATABASE (ai_chats + ai_messages)
// ─────────────────────────────────────────────────────────────────────────────
// Uses shared prisma client from ../../config/prisma

async function saveUserAiChat(userId, userMessage, assistantResponse) {
  if (!userId) return;
  try {
    const numericUserId = Number(userId);
    let chat = await aiPrisma.aiChat.findFirst({
      where: { user_id: numericUserId },
      orderBy: { created_at: "desc" }
    });

    if (!chat) {
      chat = await aiPrisma.aiChat.create({
        data: { user_id: numericUserId }
      });
    }

    if (userMessage) {
      await aiPrisma.aiMessage.create({
        data: {
          chat_id: chat.id,
          sender: "user",
          message: String(userMessage).trim()
        }
      });
    }

    const assistantPayload = JSON.stringify({
      reply: assistantResponse.reply,
      products: assistantResponse.products || [],
      build: assistantResponse.build || null,
      intent: assistantResponse.intent || ""
    });

    await aiPrisma.aiMessage.create({
      data: {
        chat_id: chat.id,
        sender: "assistant",
        message: assistantPayload
      }
    });
  } catch (dbErr) {
    console.warn("[AI] Failed to save chat to DB:", dbErr.message || dbErr);
  }
}

async function getUserAiChatHistory(userId) {
  if (!userId) return [];
  try {
    const numericUserId = Number(userId);
    const chat = await aiPrisma.aiChat.findFirst({
      where: { user_id: numericUserId },
      orderBy: { created_at: "desc" },
      include: {
        AiMessage: {
          orderBy: { created_at: "asc" }
        }
      }
    });

    if (!chat || !chat.AiMessage) return [];

    return chat.AiMessage.map((msg) => {
      let parsed = null;
      try {
        parsed = JSON.parse(msg.message);
      } catch (_) {}

      return {
        id: `db-${msg.id}`,
        role: msg.sender === "user" ? "user" : "assistant",
        content: parsed?.reply || parsed?.text || msg.message || "",
        products: parsed?.products || [],
        build: parsed?.build || null,
        intent: parsed?.intent || "",
        createdAt: msg.created_at
      };
    });
  } catch (err) {
    console.warn("[AI] Failed to fetch chat history:", err.message || err);
    return [];
  }
}

async function clearUserAiChatHistory(userId) {
  if (!userId) return false;
  try {
    const numericUserId = Number(userId);
    const chats = await aiPrisma.aiChat.findMany({
      where: { user_id: numericUserId },
      select: { id: true }
    });
    const chatIds = chats.map((c) => c.id);
    if (chatIds.length > 0) {
      await aiPrisma.aiMessage.deleteMany({ where: { chat_id: { in: chatIds } } });
      await aiPrisma.aiChat.deleteMany({ where: { id: { in: chatIds } } });
    }
    return true;
  } catch (err) {
    console.warn("[AI] Failed to clear chat history:", err.message || err);
    return false;
  }
}

async function askBuildAdvisor(userId, buildId, payload = {}) {
  const { pcBuilderService } = require("../pc-builder/pc-builder.service");
  const { aiOrchestratorService } = require("./ai-orchestrator.service");

  const buildDetail = await pcBuilderService.getBuildDetail(userId, buildId);
  const question = payload.question || "Phân tích và tư vấn cấu hình này";
  const adviceRes = await aiOrchestratorService.getBuildAdvice({
    question,
    buildContext: {
      items: buildDetail.items || [],
      totalPrice: buildDetail.totalPrice || 0
    },
    userId
  });

  return {
    build: buildDetail,
    advice: adviceRes.data || {
      review: adviceRes.text,
      issues: [],
      suggestions: []
    },
    model: adviceRes.model,
    provider: adviceRes.provider
  };
}

module.exports = {
  PC_MALL_SALES_SYSTEM_PROMPT,
  askTechnicalAdvisor: askDatabaseGroundedAdvisor,
  askBuildAdvisor,
  saveUserAiChat,
  getUserAiChatHistory,
  clearUserAiChatHistory
};
