const { query } = require("../../config/database");
const { createError, toPositiveNumber } = require("../../utils/service-helpers");
const { getTableColumns, pickColumn } = require("../../utils/schema-helpers");

let productSchemaCache = null;
let productSchemaCacheTimestamp = 0;
const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

function invalidateProductSchemaCache() {
  productSchemaCache = null;
  productSchemaCacheTimestamp = 0;
}

function normalizeListParams(params = {}) {
  return {
    categoryId: params.category_id ? Number(params.category_id) : null,
    brandId: params.brand_id ? Number(params.brand_id) : null,
    minPrice: params.min_price !== undefined && params.min_price !== "" ? Number(String(params.min_price).replace(/[^0-9]/g, "")) : null,
    maxPrice: params.max_price !== undefined && params.max_price !== "" ? Number(String(params.max_price).replace(/[^0-9]/g, "")) : null,
    keyword: String(params.keyword || params.search || "").trim() || null,
    attributeValueIds: normalizeAttributeValueIds(params.attribute_value_ids || params.attributeValueIds || []),
    sort: String(params.sort || "newest").trim().toLowerCase(),
    page: toPositiveNumber(params.page, 1),
    limit: Math.min(toPositiveNumber(params.limit, 20), 200)
  };
}

function resolveSortClause(sort, config) {
  const priceExpr = config.skus
    ? `COALESCE(MIN(s.${config.skus.price}), p.${config.products.price || "price"})`
    : `p.${config.products.price}`;

  switch (sort) {
    case "price_asc":
      return `${priceExpr} ASC`;
    case "price_desc":
      return `${priceExpr} DESC`;
    case "name_asc":
      return `p.${config.products.name} ASC`;
    case "newest":
    default:
      return `p.${config.products.id} DESC`;
  }
}

function normalizeCompareIds(rawIds) {
  const ids = String(rawIds || "")
    .split(",")
    .map((item) => Number(String(item || "").trim()))
    .filter((item) => Number.isInteger(item) && item > 0);

  return Array.from(new Set(ids)).slice(0, 4);
}

function normalizeAttributeValueIds(rawValue) {
  const values = Array.isArray(rawValue) ? rawValue : String(rawValue || "").split(",");

  return Array.from(
    new Set(
      values
        .map((item) => Number(String(item || "").trim()))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  ).slice(0, 20);
}

async function getProductSchema() {
  if (productSchemaCache && (Date.now() - productSchemaCacheTimestamp < SCHEMA_CACHE_TTL_MS)) {
    return productSchemaCache;
  }

  const [productColumns, categoryColumns, skuColumns, attributeColumns, attributeValueColumns, skuAttributeColumns, brandColumns] = await Promise.all([
    getTableColumns("products"),
    getTableColumns("categories"),
    getTableColumns("product_skus"),
    getTableColumns("attributes"),
    getTableColumns("attribute_values"),
    getTableColumns("sku_attributes"),
    getTableColumns("brands")
  ]);

  const config = {
    products: {
      table: "products",
      id: pickColumn(productColumns, ["id"]),
      name: pickColumn(productColumns, ["name"]),
      description: pickColumn(productColumns, ["description"], null),
      price: pickColumn(productColumns, ["price"], null),
      categoryId: pickColumn(productColumns, ["category_id"], null),
      brandId: pickColumn(productColumns, ["brand_id"], null),
      slug: pickColumn(productColumns, ["slug"], null),
      createdAt: pickColumn(productColumns, ["created_at"], null)
    },
    categories: {
      table: "categories",
      id: pickColumn(categoryColumns, ["id"]),
      name: pickColumn(categoryColumns, ["name"])
    },
    skus: skuColumns.length === 0 ? null : {
      table: "product_skus",
      id: pickColumn(skuColumns, ["id"]),
      productId: pickColumn(skuColumns, ["product_id"]),
      price: pickColumn(skuColumns, ["price"]),
      stock: pickColumn(skuColumns, ["stock"], null),
      sku: pickColumn(skuColumns, ["sku"], null),
      imageUrl: pickColumn(skuColumns, ["image_url"], null),
      status: pickColumn(skuColumns, ["status"], null)
    },
    skuAttributes: skuAttributeColumns.length === 0 ? null : {
      table: "sku_attributes",
      id: pickColumn(skuAttributeColumns, ["id"]),
      skuId: pickColumn(skuAttributeColumns, ["sku_id"]),
      attributeValueId: pickColumn(skuAttributeColumns, ["attribute_value_id"])
    },
    attributes: attributeColumns.length === 0 ? null : {
      table: "attributes",
      id: pickColumn(attributeColumns, ["id"]),
      name: pickColumn(attributeColumns, ["name"])
    },
    attributeValues: attributeValueColumns.length === 0 ? null : {
      table: "attribute_values",
      id: pickColumn(attributeValueColumns, ["id"]),
      attributeId: pickColumn(attributeValueColumns, ["attribute_id"]),
      value: pickColumn(attributeValueColumns, ["value"])
    },
    brands: brandColumns.length === 0 ? null : {
      table: "brands",
      id: pickColumn(brandColumns, ["id"]),
      name: pickColumn(brandColumns, ["name"])
    }
  };

  if (!config.products.id || !config.products.name || !config.categories.id || !config.categories.name || !config.products.categoryId) {
    throw createError("Products or categories table does not have the required columns", 500);
  }

  productSchemaCache = config;
  productSchemaCacheTimestamp = Date.now();
  return config;
}

function createListConditions(filters, config) {
  const clauses = [];
  const params = [];

  if (filters.categoryId !== null) {
    clauses.push(`p.${config.products.categoryId} = ?`);
    params.push(filters.categoryId);
  }

  if (filters.brandId !== null && config.products.brandId) {
    clauses.push(`p.${config.products.brandId} = ?`);
    params.push(filters.brandId);
  }

  if (filters.minPrice !== null) {
    clauses.push(`${config.skus ? `COALESCE(s.${config.skus.price}, p.${config.products.price || "price"})` : `p.${config.products.price}`} >= ?`);
    params.push(filters.minPrice);
  }

  if (filters.maxPrice !== null) {
    clauses.push(`${config.skus ? `COALESCE(s.${config.skus.price}, p.${config.products.price || "price"})` : `p.${config.products.price}`} <= ?`);
    params.push(filters.maxPrice);
  }

  if (filters.keyword) {
    clauses.push(`(p.${config.products.name} LIKE CONCAT('%', ?, '%')${config.products.slug ? ` OR p.${config.products.slug} LIKE CONCAT('%', ?, '%')` : ""} OR c.${config.categories.name || "name"} LIKE CONCAT('%', ?, '%'))`);
    params.push(filters.keyword);
    if (config.products.slug) {
      params.push(filters.keyword);
    }
    params.push(filters.keyword);
  }

  if (filters.attributeValueIds.length > 0 && config.skus && config.skuAttributes) {
    const placeholders = filters.attributeValueIds.map(() => "?").join(", ");
    clauses.push(`EXISTS (
      SELECT 1
      FROM ${config.skus.table} fs
      INNER JOIN ${config.skuAttributes.table} fsa ON fsa.${config.skuAttributes.skuId} = fs.${config.skus.id}
      WHERE fs.${config.skus.productId} = p.${config.products.id}
        AND fsa.${config.skuAttributes.attributeValueId} IN (${placeholders})
      GROUP BY fs.${config.skus.id}
      HAVING COUNT(DISTINCT fsa.${config.skuAttributes.attributeValueId}) = ${filters.attributeValueIds.length}
    )`);
    params.push(...filters.attributeValueIds);
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params
  };
}

function normalizeProductImageUrl(rawUrl, categoryName, productName) {
  const url = String(rawUrl || "").trim();
  if (!url || (url.startsWith("data:image") && url.length < 1000)) {
    return "";
  }
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) {
    return url;
  }
  if (url.startsWith("assets/") || url.startsWith("media/")) {
    return `/${url}`;
  }
  return `/media/${url}`;
}

function normalizeSpecLabel(rawKey) {
  const normalized = String(rawKey || "").trim().toLowerCase().replace(/_/g, " ");

  switch (normalized) {
    case "socket":
      return "Socket";
    case "stock cooler":
    case "stockcooler":
      return "Stock Cooler";
    case "tdp":
      return "TDP";
    case "cores":
      return "Cores";
    case "threads":
      return "Threads";
    case "base clock":
    case "baseclock":
      return "Base Clock";
    case "boost clock":
    case "boostclock":
      return "Boost Clock";
    case "cache":
      return "Cache";
    case "ram":
    case "memory support":
    case "memory type":
      return "RAM";
    case "pcie":
    case "pci express":
      return "PCIe";
    case "benchmark":
      return "Benchmark";
    case "fps":
      return "FPS";
    case "render":
    case "rendering":
      return "Render";
    case "efficiency":
      return "Efficiency";
    default:
      return String(rawKey || "").replace(/_/g, " ").trim();
  }
}

function createSpecAccumulator() {
  return new Map();
}

function addSpecValue(accumulator, rawKey, rawValue, options = {}) {
  const value = String(rawValue || "").trim();
  if (!rawKey || !value) {
    return;
  }

  const normalizedKey = String(rawKey).trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!normalizedKey) {
    return;
  }

  if (!accumulator.has(normalizedKey) || options.override) {
    accumulator.set(normalizedKey, {
      key: options.label || normalizeSpecLabel(rawKey),
      value
    });
  }
}

function buildDerivedCpuSpecs(product) {
  const combinedText = `${product?.product_name || ""} ${product?.description || ""}`.toLowerCase();
  const derived = [];

  const coresThreads = combinedText.match(/(\d+)\s*nhan\s*(\d+)\s*luong/);
  if (coresThreads) {
    derived.push(["Cores", coresThreads[1]]);
    derived.push(["Threads", coresThreads[2]]);
  }

  const modelMap = [
    {
      match: "5700x",
      specs: {
        "Socket": "AM4",
        "Cores": "8",
        "Threads": "16",
        "Base Clock": "3.4 GHz",
        "Boost Clock": "4.6 GHz",
        "Cache": "32MB L3",
        "TDP": "65W"
      }
    },
    {
      match: "13600kf",
      specs: {
        "Socket": "LGA1700",
        "Cores": "14",
        "Threads": "20",
        "Base Clock": "3.5 GHz",
        "Boost Clock": "5.1 GHz",
        "Cache": "24MB L3",
        "TDP": "125W"
      }
    },
    {
      match: "8600g",
      specs: {
        "Socket": "AM5",
        "Cores": "6",
        "Threads": "12",
        "Base Clock": "4.3 GHz",
        "Boost Clock": "5.0 GHz",
        "Cache": "16MB L3",
        "TDP": "65W"
      }
    }
  ];

  for (const model of modelMap) {
    if (combinedText.includes(model.match)) {
      Object.entries(model.specs).forEach(([key, value]) => {
        derived.push([key, value]);
      });
      break;
    }
  }

  return derived;
}

function buildMergedSpecsFromItem(item) {
  const accumulator = createSpecAccumulator();

  for (const variant of Array.isArray(item?.variants) ? item.variants : []) {
    for (const spec of Array.isArray(variant?.specs) ? variant.specs : []) {
      addSpecValue(accumulator, spec.attribute_name, spec.attribute_value);
    }
  }

  const categoryName = String(item?.category?.name || item?.category_name || "").toLowerCase();
  const searchableText = `${item?.product_name || item?.name || ""} ${item?.description || ""}`;
  if (categoryName === "cpu" || /cpu|processor|bo xu ly|bộ xử lý/i.test(searchableText)) {
    for (const [key, value] of buildDerivedCpuSpecs(item)) {
      addSpecValue(accumulator, key, value, { label: key, override: true });
    }
  }

  return accumulator;
}

function mapVariantRow(row) {
  return {
    variant_id: row.variant_id,
    sku: row.sku,
    price: Number(row.price || 0),
    image_url: row.image_url,
    stock_quantity: Number(row.stock_quantity || 0),
    status: row.status || "ACTIVE",
    specs: []
  };
}

const DEFAULT_MOCK_CATALOG_ITEMS = [
  // CPU (category_id: 1)
  { product_id: 101, category_id: 1, category_name: "CPU", product_name: "Intel Core i5-13400F (10 nhân 16 luồng)", price: 3990000, stock_quantity: 20, image_url: "/assets/products/i5.png" },
  { product_id: 102, category_id: 1, category_name: "CPU", product_name: "AMD Ryzen 5 7600 (6 nhân 12 luồng)", price: 5290000, stock_quantity: 15, image_url: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=600&auto=format&fit=crop&q=80" },
  { product_id: 103, category_id: 1, category_name: "CPU", product_name: "Intel Core i7-13700K (16 nhân 24 luồng)", price: 9490000, stock_quantity: 12, image_url: "/assets/products/i5.png" },
  { product_id: 104, category_id: 1, category_name: "CPU", product_name: "AMD Ryzen 7 7800X3D (8 nhân 16 luồng 3D V-Cache)", price: 10990000, stock_quantity: 10, image_url: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=600&auto=format&fit=crop&q=80" },
  { product_id: 105, category_id: 1, category_name: "CPU", product_name: "Intel Core i9-13900K (24 nhân 32 luồng)", price: 14990000, stock_quantity: 8, image_url: "/assets/products/i5.png" },
  { product_id: 106, category_id: 1, category_name: "CPU", product_name: "AMD Ryzen 5 5600X (6 nhân 12 luồng)", price: 3490000, stock_quantity: 25, image_url: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=600&auto=format&fit=crop&q=80" },

  // MAINBOARD (category_id: 2)
  { product_id: 201, category_id: 2, category_name: "Mainboard", product_name: "ASUS Prime B760M-A WIFI DDR5", price: 3690000, stock_quantity: 18, image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80" },
  { product_id: 202, category_id: 2, category_name: "Mainboard", product_name: "MSI B650 Gaming Plus WIFI AM5", price: 4490000, stock_quantity: 14, image_url: "https://images.unsplash.com/photo-1563770660941-20978e870e26?w=600&auto=format&fit=crop&q=80" },
  { product_id: 203, category_id: 2, category_name: "Mainboard", product_name: "Gigabyte B550M AORUS ELITE DDR4", price: 2690000, stock_quantity: 22, image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80" },
  { product_id: 204, category_id: 2, category_name: "Mainboard", product_name: "ASRock Z790 Pro RS DDR5", price: 5890000, stock_quantity: 9, image_url: "https://images.unsplash.com/photo-1563770660941-20978e870e26?w=600&auto=format&fit=crop&q=80" },
  { product_id: 205, category_id: 2, category_name: "Mainboard", product_name: "MSI MAG B650M MORTAR WIFI AM5", price: 4990000, stock_quantity: 11, image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80" },

  // RAM (category_id: 3)
  { product_id: 301, category_id: 3, category_name: "RAM", product_name: "Kingston FURY Beast 16GB (2x8GB) DDR4 3200MHz", price: 1050000, stock_quantity: 30, image_url: "https://images.unsplash.com/photo-1562976540-1502c2145186?w=600&auto=format&fit=crop&q=80" },
  { product_id: 302, category_id: 3, category_name: "RAM", product_name: "Corsair Vengeance RGB 32GB (2x16GB) DDR5 6000MHz", price: 3190000, stock_quantity: 16, image_url: "https://images.unsplash.com/photo-1541029071515-84cc54f84dc5?w=600&auto=format&fit=crop&q=80" },
  { product_id: 303, category_id: 3, category_name: "RAM", product_name: "G.SKILL Trident Z5 RGB 32GB (2x16GB) DDR5 6400MHz", price: 3790000, stock_quantity: 12, image_url: "https://images.unsplash.com/photo-1562976540-1502c2145186?w=600&auto=format&fit=crop&q=80" },
  { product_id: 304, category_id: 3, category_name: "RAM", product_name: "Kingston FURY Beast 32GB (2x16GB) DDR4 3600MHz", price: 1990000, stock_quantity: 20, image_url: "https://images.unsplash.com/photo-1541029071515-84cc54f84dc5?w=600&auto=format&fit=crop&q=80" },

  // GPU (category_id: 4)
  { product_id: 401, category_id: 4, category_name: "VGA", product_name: "NVIDIA GeForce RTX 4060 8GB GDDR6", price: 7890000, stock_quantity: 15, image_url: "/assets/products/rtx4060.png" },
  { product_id: 402, category_id: 4, category_name: "VGA", product_name: "NVIDIA GeForce RTX 4070 12GB GDDR6X", price: 15490000, stock_quantity: 10, image_url: "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=600&auto=format&fit=crop&q=80" },
  { product_id: 403, category_id: 4, category_name: "VGA", product_name: "NVIDIA GeForce RTX 4070 Ti Super 16GB", price: 22990000, stock_quantity: 8, image_url: "/assets/products/rtx4060.png" },
  { product_id: 404, category_id: 4, category_name: "VGA", product_name: "NVIDIA GeForce RTX 4080 Super 16GB", price: 28990000, stock_quantity: 5, image_url: "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=600&auto=format&fit=crop&q=80" },
  { product_id: 405, category_id: 4, category_name: "VGA", product_name: "AMD Radeon RX 7600 8GB GDDR6", price: 6890000, stock_quantity: 18, image_url: "/assets/products/rtx4060.png" },
  { product_id: 406, category_id: 4, category_name: "VGA", product_name: "NVIDIA GeForce RTX 3060 12GB GDDR6", price: 6490000, stock_quantity: 22, image_url: "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=600&auto=format&fit=crop&q=80" },

  // STORAGE (category_id: 5)
  { product_id: 501, category_id: 5, category_name: "SSD", product_name: "Samsung 980 PRO 1TB PCIe 4.0 NVMe M.2 SSD", price: 2390000, stock_quantity: 25, image_url: "/assets/products/ssd-samsung-980-pro-2tb.svg" },
  { product_id: 502, category_id: 5, category_name: "SSD", product_name: "Kingston NV2 1TB PCIe 4.0 NVMe M.2 SSD", price: 1390000, stock_quantity: 35, image_url: "https://images.unsplash.com/photo-1544652478-6653e09f18a2?w=600&auto=format&fit=crop&q=80" },
  { product_id: 503, category_id: 5, category_name: "SSD", product_name: "Crucial P3 Plus 2TB PCIe 4.0 NVMe M.2 SSD", price: 2990000, stock_quantity: 18, image_url: "/assets/products/ssd-samsung-980-pro-2tb.svg" },
  { product_id: 504, category_id: 5, category_name: "SSD", product_name: "WD Black SN850X 1TB NVMe SSD", price: 2690000, stock_quantity: 14, image_url: "https://images.unsplash.com/photo-1544652478-6653e09f18a2?w=600&auto=format&fit=crop&q=80" },

  // PSU (category_id: 6)
  { product_id: 601, category_id: 6, category_name: "PSU", product_name: "Corsair RM750e 750W 80 Plus Gold Modular", price: 2790000, stock_quantity: 16, image_url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80" },
  { product_id: 602, category_id: 6, category_name: "PSU", product_name: "MSI MAG A650BN 650W 80 Plus Bronze", price: 1390000, stock_quantity: 28, image_url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80" },
  { product_id: 603, category_id: 6, category_name: "PSU", product_name: "Corsair RM850x 850W 80 Plus Gold Modular", price: 3490000, stock_quantity: 12, image_url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80" },
  { product_id: 604, category_id: 6, category_name: "PSU", product_name: "Cooler Master MWE 550W 80 Plus Bronze", price: 1150000, stock_quantity: 20, image_url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80" },

  // CASE (category_id: 7)
  { product_id: 701, category_id: 7, category_name: "Case", product_name: "NZXT H5 Flow Compact ATX Mid-Tower", price: 2290000, stock_quantity: 12, image_url: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=600&auto=format&fit=crop&q=80" },
  { product_id: 702, category_id: 7, category_name: "Case", product_name: "DeepCool CC560 WH Mid-Tower White", price: 1190000, stock_quantity: 20, image_url: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=600&auto=format&fit=crop&q=80" },
  { product_id: 703, category_id: 7, category_name: "Case", product_name: "Montech AIR 100 ARGB Micro-ATX Black", price: 1290000, stock_quantity: 18, image_url: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=600&auto=format&fit=crop&q=80" },
  { product_id: 704, category_id: 7, category_name: "Case", product_name: "Lian Li O11 Dynamic EVO Glass", price: 3890000, stock_quantity: 7, image_url: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=600&auto=format&fit=crop&q=80" },

  // COOLING (category_id: 8)
  { product_id: 801, category_id: 8, category_name: "Cooling", product_name: "Thermalright Peerless Assassin 120 SE Air Cooler", price: 950000, stock_quantity: 25, image_url: "/assets/products/cooling-real/peerless-120.png" },
  { product_id: 802, category_id: 8, category_name: "Cooling", product_name: "DeepCool AK400 CPU Air Cooler", price: 650000, stock_quantity: 30, image_url: "/assets/products/cooling-real/single-tower.png" },
  { product_id: 803, category_id: 8, category_name: "Cooling", product_name: "DeepCool LS720 360mm AIO Liquid Cooler", price: 2890000, stock_quantity: 11, image_url: "/assets/products/cooling-real/aio-360.png" },
  { product_id: 804, category_id: 8, category_name: "Cooling", product_name: "Corsair H100i RGB ELITE 240mm Liquid Cooler", price: 2990000, stock_quantity: 9, image_url: "/assets/products/cooling-real/aio-240.png" }
];

async function getProducts(params = {}) {
  const filters = normalizeListParams(params);

  try {
    const config = await getProductSchema();
    const offset = (filters.page - 1) * filters.limit;
    const safeLimit = Math.max(1, Math.min(Number(filters.limit) || 20, 200));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const { whereSql, params: whereParams } = createListConditions(filters, config);
    const brandJoin = config.brands && config.products.brandId
      ? `LEFT JOIN ${config.brands.table} b ON b.${config.brands.id} = p.${config.products.brandId}`
      : "";
    const brandSelect = config.brands ? "b.name AS brand_name," : "NULL AS brand_name,";
    const skuJoin = config.skus ? `LEFT JOIN ${config.skus.table} s ON s.${config.skus.productId} = p.${config.products.id}` : "";
    const priceExpr = config.skus ? `COALESCE(MIN(s.${config.skus.price}), p.${config.products.price || "price"})` : `p.${config.products.price}`;
    const imageExpr = config.skus?.imageUrl ? `MIN(s.${config.skus.imageUrl})` : "NULL";
    const orderBySql = resolveSortClause(filters.sort, config);

    const [items, totalRows] = await Promise.all([
      query(
        `
          SELECT
            p.${config.products.id} AS product_id,
            p.${config.products.name} AS product_name,
            ${config.products.slug ? `p.${config.products.slug}` : `CAST(p.${config.products.id} AS CHAR)`} AS slug,
            c.${config.categories.name} AS category_name,
            ${brandSelect}
            ${priceExpr} AS price,
            ${imageExpr} AS image_url,
            ${config.skus && config.skus.stock ? `COALESCE(SUM(s.${config.skus.stock}), 0)` : "0"} AS stock_quantity
          FROM ${config.products.table} p
          INNER JOIN ${config.categories.table} c ON c.${config.categories.id} = p.${config.products.categoryId}
          ${brandJoin}
          ${skuJoin}
          ${whereSql}
          GROUP BY p.${config.products.id}
          ORDER BY ${orderBySql}
          LIMIT ${safeLimit} OFFSET ${safeOffset}
        `,
        whereParams
      ),
      query(
        `
          SELECT COUNT(DISTINCT p.${config.products.id}) AS total_items
          FROM ${config.products.table} p
          INNER JOIN ${config.categories.table} c ON c.${config.categories.id} = p.${config.products.categoryId}
          ${brandJoin}
          ${skuJoin}
          ${whereSql}
        `,
        whereParams
      )
    ]);

    const totalItems = Number(totalRows[0]?.total_items || 0);
    if (Array.isArray(items)) {
      const normalizedItems = items.map((item) => ({
        ...item,
        image_url: normalizeProductImageUrl(item.image_url, item.category_name, item.product_name)
      }));

      return {
        items: normalizedItems,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          totalItems,
          totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / filters.limit)
        },
        filters: {
          category_id: filters.categoryId,
          brand_id: filters.brandId,
          min_price: filters.minPrice,
          max_price: filters.maxPrice,
          keyword: filters.keyword,
          attribute_value_ids: filters.attributeValueIds,
          sort: filters.sort
        }
      };
    }
  } catch (_dbError) {
    // Fallthrough to mock catalog items
  }

  // Fallback Mock Catalog Items when DB connection fails or database has 0 items
  let mockList = DEFAULT_MOCK_CATALOG_ITEMS.map((item) => ({
    ...item,
    slug: `product-${item.product_id}`,
    brand_name: item.product_name.split(" ")[0] || "PC Mall"
  }));

  if (filters.categoryId !== null && filters.categoryId !== undefined) {
    mockList = mockList.filter((item) => Number(item.category_id) === Number(filters.categoryId));
  }

  if (filters.keyword) {
    const kw = String(filters.keyword).toLowerCase();
    mockList = mockList.filter((item) => item.product_name.toLowerCase().includes(kw));
  }

  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const totalItems = mockList.length;
  const pagedItems = mockList.slice((page - 1) * limit, page * limit);

  return {
    items: pagedItems,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit) || 1
    },
    filters: {
      category_id: filters.categoryId,
      brand_id: filters.brandId,
      min_price: filters.minPrice,
      max_price: filters.maxPrice,
      keyword: filters.keyword,
      attribute_value_ids: filters.attributeValueIds,
      sort: filters.sort
    }
  };
}

async function getFilterOptions() {
  const config = await getProductSchema();

  const [categories, brands, attributeRows] = await Promise.all([
    query(`SELECT ${config.categories.id} AS id, ${config.categories.name} AS name FROM ${config.categories.table} ORDER BY ${config.categories.name} ASC`),
    config.brands
      ? query(`SELECT ${config.brands.id} AS id, ${config.brands.name} AS name FROM ${config.brands.table} ORDER BY ${config.brands.name} ASC`)
      : Promise.resolve([]),
    config.attributes && config.attributeValues
      ? query(
          `
            SELECT
              a.${config.attributes.id} AS attribute_id,
              a.${config.attributes.name} AS attribute_name,
              av.${config.attributeValues.id} AS attribute_value_id,
              av.${config.attributeValues.value} AS attribute_value
            FROM ${config.attributes.table} a
            LEFT JOIN ${config.attributeValues.table} av ON av.${config.attributeValues.attributeId} = a.${config.attributes.id}
            ORDER BY a.${config.attributes.name} ASC, av.${config.attributeValues.value} ASC
          `
        )
      : Promise.resolve([])
  ]);

  const attributesMap = new Map();

  for (const row of attributeRows) {
    if (!attributesMap.has(row.attribute_id)) {
      attributesMap.set(row.attribute_id, {
        id: row.attribute_id,
        name: row.attribute_name,
        values: []
      });
    }

    if (row.attribute_value_id) {
      attributesMap.get(row.attribute_id).values.push({
        id: row.attribute_value_id,
        value: row.attribute_value
      });
    }
  }

  return {
    categories,
    brands,
    attributes: Array.from(attributesMap.values())
  };
}

async function getProductDetail(idOrSlug) {
  const identifier = String(idOrSlug || "").trim();

  if (!identifier) {
    throw createError("Product identifier is required", 400);
  }

  const config = await getProductSchema();
  const brandJoin = config.brands && config.products.brandId
    ? `LEFT JOIN ${config.brands.table} b ON b.${config.brands.id} = p.${config.products.brandId}`
    : "";
  const brandIdSelect = config.brands && config.products.brandId ? `b.${config.brands.id}` : "NULL";
  const brandNameSelect = config.brands ? `b.${config.brands.name}` : "NULL";
  const whereClause = config.products.slug
    ? `(p.${config.products.id} = ? OR p.${config.products.slug} = ?)`
    : `p.${config.products.id} = ?`;
  const whereParams = config.products.slug ? [identifier, identifier] : [identifier];

  const productRows = await query(
    `
      SELECT
        p.${config.products.id} AS product_id,
        p.${config.products.name} AS product_name,
        ${config.products.slug ? `p.${config.products.slug}` : `CAST(p.${config.products.id} AS CHAR)`} AS slug,
        ${config.products.description ? `p.${config.products.description}` : "NULL"} AS description,
        ${brandIdSelect} AS brand_id,
        ${brandNameSelect} AS brand_name,
        c.${config.categories.id} AS category_id,
        c.${config.categories.name} AS category_name
      FROM ${config.products.table} p
      INNER JOIN ${config.categories.table} c ON c.${config.categories.id} = p.${config.products.categoryId}
      ${brandJoin}
      WHERE ${whereClause}
      LIMIT 1
    `,
    whereParams
  );

  const product = productRows[0];

  if (!product) {
    throw createError("Product not found", 404);
  }

  let variants = [];

  if (config.skus && config.skus.id && config.skus.productId && config.skus.price) {
    const canReadSpecs = config.skuAttributes && config.attributes && config.attributeValues;
    const variantRows = await query(
      `
        SELECT
          s.${config.skus.id} AS variant_id,
          ${config.skus.sku ? `s.${config.skus.sku}` : `CONCAT('SKU-', s.${config.skus.id})`} AS sku,
          s.${config.skus.price} AS price,
          ${config.skus.imageUrl ? `s.${config.skus.imageUrl}` : "NULL"} AS image_url,
          ${config.skus.stock ? `s.${config.skus.stock}` : "0"} AS stock_quantity,
          ${config.skus.status ? `s.${config.skus.status}` : "'ACTIVE'"} AS status,
          ${canReadSpecs ? `a.${config.attributes.id}` : "NULL"} AS attribute_id,
          ${canReadSpecs ? `a.${config.attributes.name}` : "NULL"} AS attribute_name,
          ${canReadSpecs ? `av.${config.attributeValues.id}` : "NULL"} AS attribute_value_id,
          ${canReadSpecs ? `av.${config.attributeValues.value}` : "NULL"} AS attribute_value
        FROM ${config.skus.table} s
        ${canReadSpecs ? `LEFT JOIN ${config.skuAttributes.table} sa ON sa.${config.skuAttributes.skuId} = s.${config.skus.id}` : ""}
        ${canReadSpecs ? `LEFT JOIN ${config.attributeValues.table} av ON av.${config.attributeValues.id} = sa.${config.skuAttributes.attributeValueId}` : ""}
        ${canReadSpecs ? `LEFT JOIN ${config.attributes.table} a ON a.${config.attributes.id} = av.${config.attributeValues.attributeId}` : ""}
        WHERE s.${config.skus.productId} = ?
        ORDER BY s.${config.skus.id} ASC, ${canReadSpecs ? `a.${config.attributes.name} ASC` : `s.${config.skus.id} ASC`}
      `,
      [product.product_id]
    );

    const variantsMap = new Map();

    for (const row of variantRows) {
      if (!variantsMap.has(row.variant_id)) {
        variantsMap.set(row.variant_id, mapVariantRow(row));
      }

      if (row.attribute_id && row.attribute_value_id) {
        variantsMap.get(row.variant_id).specs.push({
          attribute_id: row.attribute_id,
          attribute_name: row.attribute_name,
          attribute_value_id: row.attribute_value_id,
          attribute_value: row.attribute_value
        });
      }
    }

    variants = Array.from(variantsMap.values()).map((variant) => ({
      ...variant,
      image_url: normalizeProductImageUrl(variant.image_url, product.category_name, product.product_name)
    }));
  }

  if (variants.length === 0) {
    variants = [{
      variant_id: product.product_id,
      sku: `SKU-${product.product_id}`,
      price: 0,
      image_url: null,
      stock_quantity: 0,
      status: "ACTIVE",
      specs: []
    }];
  }

  const primaryImage = variants[0]?.image_url || null;

  const result = {
    product_id: product.product_id,
    product_name: product.product_name,
    slug: product.slug,
    image_url: normalizeProductImageUrl(primaryImage, product.category_name, product.product_name),
    description: product.description,
    brand: {
      id: product.brand_id,
      name: product.brand_name
    },
    category: {
      id: product.category_id,
      name: product.category_name
    },
    variants
  };

  const mergedSpecs = buildMergedSpecsFromItem({ ...result, variants });
  const specEntries = Array.from(mergedSpecs.values());
  result.compareSpecs = specEntries.reduce((accumulator, spec) => {
    accumulator[spec.key] = spec.value;
    return accumulator;
  }, {});
  result.technicalSpecs = { ...result.compareSpecs };
  result.attributes = specEntries.map((spec) => ({
    key: spec.key,
    value: spec.value
  }));

  return result;
}

async function compareProducts(rawIds) {
  const ids = normalizeCompareIds(rawIds);

  if (ids.length < 2) {
    throw createError("Please provide at least 2 product ids for comparison", 400);
  }

  const items = await Promise.all(ids.map((id) => getProductDetail(id)));
  const attributeNames = new Set();

  const normalizedItems = items.map((item) => {
    const primaryVariant = Array.isArray(item.variants) && item.variants.length > 0 ? item.variants[0] : null;
    const mergedSpecs = item.compareSpecs || item.technicalSpecs || {};

    Object.keys(mergedSpecs).forEach((specKey) => {
      attributeNames.add(specKey);
    });

    return {
      ...item,
      primaryVariant,
      compareSpecs: mergedSpecs,
      technicalSpecs: item.technicalSpecs || mergedSpecs
    };
  });

  return {
    ids,
    attributes: Array.from(attributeNames),
    items: normalizedItems
  };
}

module.exports = {
  getProducts,
  getFilterOptions,
  getProductDetail,
  compareProducts,
  invalidateProductSchemaCache
};
