import { prisma } from "../../config/prisma";

type ProductListParams = {
  search?: string;
  categorySlug?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  isActive?: boolean;
  page: number;
  limit: number;
  sortBy: "created_at" | "price" | "name";
  sortOrder: "asc" | "desc";
};

const DEFAULT_HARDWARE_CATEGORIES = [
  { id: 1, name: "CPU - Vi xử lý", description: "Bộ vi xử lý trung tâm Intel & AMD" },
  { id: 2, name: "Mainboard - Bo mạch chủ", description: "Bo mạch chủ hỗ trợ DDR4, DDR5, AM5, LGA1700" },
  { id: 3, name: "RAM - Bộ nhớ trong", description: "Bộ nhớ RAM DDR4 & DDR5 tốc độ cao" },
  { id: 4, name: "VGA - Card màn hình", description: "Card đồ họa NVIDIA RTX 40 series & AMD RX series" },
  { id: 5, name: "SSD / Storage - Ổ cứng", description: "Ổ cứng SSD NVMe PCIe 4.0 & HDD dung lượng lớn" },
  { id: 6, name: "PSU - Nguồn máy tính", description: "Nguồn công suất thực 80 Plus Bronze/Gold" },
  { id: 7, name: "Case - Vỏ máy tính", description: "Vỏ case ATX, Micro-ATX, E-ATX kính cường lực" },
  { id: 8, name: "Cooling - Tản nhiệt", description: "Tản nhiệt khí & Tản nhiệt nước AIO 240/360" }
];

const DEFAULT_HARDWARE_PRODUCTS = [
  // CPU
  { id: 101, category_id: 1, name: "Intel Core i5-13400F (Up to 4.6GHz, 10 nhân 16 luồng)", description: "Socket LGA1700, 65W TDP", price: 3990000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 102, category_id: 1, name: "AMD Ryzen 5 7600 (Up to 5.1GHz, 6 nhân 12 luồng)", description: "Socket AM5, 65W TDP", price: 5290000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 103, category_id: 1, name: "Intel Core i7-13700K (Up to 5.4GHz, 16 nhân 24 luồng)", description: "Socket LGA1700, 125W TDP", price: 9490000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 104, category_id: 1, name: "AMD Ryzen 7 7800X3D (Up to 5.0GHz, 8 nhân 16 luồng 3D V-Cache)", description: "Socket AM5, 120W TDP", price: 10990000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 105, category_id: 1, name: "Intel Core i9-13900K (Up to 5.8GHz, 24 nhân 32 luồng)", description: "Socket LGA1700, 150W TDP", price: 14990000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 106, category_id: 1, name: "AMD Ryzen 5 5600X (Up to 4.6GHz, 6 nhân 12 luồng)", description: "Socket AM4, 65W TDP", price: 3490000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=600&auto=format&fit=crop&q=80", created_at: new Date() },

  // MAINBOARD
  { id: 201, category_id: 2, name: "ASUS Prime B760M-A WIFI DDR5", description: "Socket LGA1700, DDR5, mATX, 2x M.2", price: 3690000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 202, category_id: 2, name: "MSI B650 Gaming Plus WIFI", description: "Socket AM5, DDR5, ATX, 2x M.2", price: 4490000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1563770660941-20978e870e26?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 203, category_id: 2, name: "Gigabyte B550M AORUS ELITE DDR4", description: "Socket AM4, DDR4, mATX, 2x M.2", price: 2690000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 204, category_id: 2, name: "ASRock Z790 Pro RS DDR5", description: "Socket LGA1700, DDR5, ATX, 4x M.2", price: 5890000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1563770660941-20978e870e26?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 205, category_id: 2, name: "MSI MAG B650M MORTAR WIFI", description: "Socket AM5, DDR5, mATX, 2x M.2", price: 4990000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80", created_at: new Date() },

  // RAM
  { id: 301, category_id: 3, name: "Kingston FURY Beast 16GB (2x8GB) DDR4 3200MHz", description: "DDR4, 16GB kit", price: 1050000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1562976540-1502c2145186?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 302, category_id: 3, name: "Corsair Vengeance RGB 32GB (2x16GB) DDR5 6000MHz", description: "DDR5, 32GB kit", price: 3190000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1541029071515-84cc54f84dc5?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 303, category_id: 3, name: "G.SKILL Trident Z5 RGB 32GB (2x16GB) DDR5 6400MHz", description: "DDR5, 32GB kit", price: 3790000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1562976540-1502c2145186?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 304, category_id: 3, name: "Kingston FURY Beast 32GB (2x16GB) DDR4 3600MHz", description: "DDR4, 32GB kit", price: 1990000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1541029071515-84cc54f84dc5?w=600&auto=format&fit=crop&q=80", created_at: new Date() },

  // GPU
  { id: 401, category_id: 4, name: "NVIDIA GeForce RTX 4060 8GB GDDR6", description: "Length: 240mm, TDP: 115W", price: 7890000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 402, category_id: 4, name: "NVIDIA GeForce RTX 4070 12GB GDDR6X", description: "Length: 285mm, TDP: 200W", price: 15490000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 403, category_id: 4, name: "NVIDIA GeForce RTX 4070 Ti Super 16GB GDDR6X", description: "Length: 305mm, TDP: 285W", price: 22990000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 404, category_id: 4, name: "NVIDIA GeForce RTX 4080 Super 16GB GDDR6X", description: "Length: 330mm, TDP: 320W", price: 28990000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 405, category_id: 4, name: "AMD Radeon RX 7600 8GB GDDR6", description: "Length: 230mm, TDP: 165W", price: 6890000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 406, category_id: 4, name: "NVIDIA GeForce RTX 3060 12GB GDDR6", description: "Length: 242mm, TDP: 170W", price: 6490000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=600&auto=format&fit=crop&q=80", created_at: new Date() },

  // STORAGE (Premium SSD: Samsung PRO / SN850X -> 60 months)
  { id: 501, category_id: 5, name: "Samsung 980 PRO 1TB PCIe 4.0 NVMe M.2 SSD", description: "M.2 NVMe, 1TB", price: 2390000, warranty_months: 60, is_active: true, image_url: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 502, category_id: 5, name: "Kingston NV2 1TB PCIe 4.0 NVMe M.2 SSD", description: "M.2 NVMe, 1TB", price: 1390000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1544652478-6653e09f18a2?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 503, category_id: 5, name: "Crucial P3 Plus 2TB PCIe 4.0 NVMe M.2 SSD", description: "M.2 NVMe, 2TB", price: 2990000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 504, category_id: 5, name: "WD Black SN850X 1TB PCIe 4.0 NVMe SSD", description: "M.2 NVMe, 1TB", price: 2690000, warranty_months: 60, is_active: true, image_url: "https://images.unsplash.com/photo-1544652478-6653e09f18a2?w=600&auto=format&fit=crop&q=80", created_at: new Date() },

  // PSU (Premium Corsair RM / Seasonic -> 120 months)
  { id: 601, category_id: 6, name: "Corsair RM750e 750W 80 Plus Gold Modular", description: "750W, ATX", price: 2790000, warranty_months: 120, is_active: true, image_url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 602, category_id: 6, name: "MSI MAG A650BN 650W 80 Plus Bronze", description: "650W, ATX", price: 1390000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 603, category_id: 6, name: "Corsair RM850x 850W 80 Plus Gold Modular", description: "850W, ATX", price: 3490000, warranty_months: 120, is_active: true, image_url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 604, category_id: 6, name: "Cooler Master MWE 550W 80 Plus Bronze", description: "550W, ATX", price: 1150000, warranty_months: 36, is_active: true, image_url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80", created_at: new Date() },

  // CASE (12 months)
  { id: 701, category_id: 7, name: "NZXT H5 Flow Compact ATX Mid-Tower", description: "ATX, GPU Clearance: 365mm", price: 2290000, warranty_months: 12, is_active: true, image_url: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 702, category_id: 7, name: "DeepCool CC560 WH Mid-Tower", description: "ATX, GPU Clearance: 370mm", price: 1190000, warranty_months: 12, is_active: true, image_url: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 703, category_id: 7, name: "Montech AIR 100 ARGB Micro-ATX", description: "mATX, GPU Clearance: 330mm", price: 1290000, warranty_months: 12, is_active: true, image_url: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 704, category_id: 7, name: "Lian Li O11 Dynamic EVO Glass", description: "E-ATX, GPU Clearance: 422mm", price: 3890000, warranty_months: 12, is_active: true, image_url: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=600&auto=format&fit=crop&q=80", created_at: new Date() },

  // COOLING (24 months)
  { id: 801, category_id: 8, name: "Thermalright Peerless Assassin 120 SE", description: "Air Cooler, TDP: 245W, Height: 157mm", price: 950000, warranty_months: 24, is_active: true, image_url: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 802, category_id: 8, name: "DeepCool AK400 CPU Air Cooler", description: "Air Cooler, TDP: 220W, Height: 155mm", price: 650000, warranty_months: 24, is_active: true, image_url: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 803, category_id: 8, name: "DeepCool LS720 360mm AIO Liquid Cooler", description: "AIO Liquid 360mm, TDP: 300W", price: 2890000, warranty_months: 24, is_active: true, image_url: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=600&auto=format&fit=crop&q=80", created_at: new Date() },
  { id: 804, category_id: 8, name: "Corsair H100i RGB ELITE 240mm Liquid Cooler", description: "AIO Liquid 240mm, TDP: 250W", price: 2990000, warranty_months: 24, is_active: true, image_url: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=600&auto=format&fit=crop&q=80", created_at: new Date() }
];

export async function listCategories() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" }
    });
    return categories.length > 0 ? categories : DEFAULT_HARDWARE_CATEGORIES;
  } catch (_err) {
    return DEFAULT_HARDWARE_CATEGORIES;
  }
}

export async function listBrands() {
  try {
    return await prisma.brand.findMany({
      orderBy: { name: "asc" }
    });
  } catch (_err) {
    return [
      { id: 1, name: "Intel" },
      { id: 2, name: "AMD" },
      { id: 3, name: "ASUS" },
      { id: 4, name: "MSI" },
      { id: 5, name: "Gigabyte" },
      { id: 6, name: "Kingston" },
      { id: 7, name: "Corsair" },
      { id: 8, name: "Samsung" }
    ];
  }
}

export function createCategory(data: {
  name: string;
  description?: string;
  is_active?: boolean;
}) {
  return prisma.category.create({ data });
}

export async function listProducts(params: ProductListParams) {
  const { search, categorySlug, categoryId, minPrice, maxPrice, isActive, page, limit, sortBy, sortOrder } = params;

  try {
    const where: any = {
      ...(typeof isActive === "boolean" ? { is_active: isActive } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { description: { contains: search } },
              { Category: { name: { contains: search } } },
              { Brand: { name: { contains: search } } }
            ]
          }
        : {}),
      ...(categoryId ? { category_id: categoryId } : {}),
      ...(typeof minPrice === "number" || typeof maxPrice === "number"
        ? {
            price: {
              ...(typeof minPrice === "number" ? { gte: minPrice } : {}),
              ...(typeof maxPrice === "number" ? { lte: maxPrice } : {})
            }
          }
        : {})
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          Category: true,
          Brand: true,
          ProductSku: { take: 1 }
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.product.count({ where })
    ]);

    return { items, total };
  } catch (_err) {
    // Database fallback (only reached when DB is disconnected or throwing query error)
  }

  // Fallback mock items filtering
  let filtered = DEFAULT_HARDWARE_PRODUCTS.map((p) => {
    const cat = DEFAULT_HARDWARE_CATEGORIES.find((c) => c.id === p.category_id);
    return {
      ...p,
      Category: cat,
      Brand: { name: p.name.split(" ")[0] },
      ProductSku: [{ id: p.id, sku: `SKU-${p.id}`, price: p.price, stock: 15, image_url: p.image_url || "" }],
      ProductVariant: [{ id: p.id, sku: `SKU-${p.id}`, price: p.price, stock_quantity: 15 }]
    };
  });

  if (categoryId) {
    filtered = filtered.filter((p) => p.category_id === categoryId);
  }

  if (search) {
    const kw = search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(kw) ||
        (p.description && p.description.toLowerCase().includes(kw)) ||
        (p.Category?.name && p.Category.name.toLowerCase().includes(kw)) ||
        (p.Brand?.name && p.Brand.name.toLowerCase().includes(kw))
    );
  }

  const total = filtered.length;
  const items = filtered.slice((page - 1) * limit, page * limit);
  return { items, total };
}

export async function getProductById(id: string | number) {
  let numericId: number;
  
  if (typeof id === "string") {
    numericId = parseInt(id, 10);
    if (isNaN(numericId)) return null;
  } else {
    numericId = Number(id);
  }

  return prisma.product.findUnique({
    where: { id: numericId },
    include: {
      Category: true,
      Brand: true,
      ProductSku: {
        include: {
          SkuAttribute: {
            include: {
              AttributeValue: {
                include: {
                  Attribute: true
                }
              }
            }
          }
        }
      }
    }
  });
}

export function createProduct(data: {
  category_id?: number;
  name: string;
  description?: string;
  price?: number;
  is_active?: boolean;
}) {
  return prisma.product.create({ data: data as any });
}

export function updateProduct(
  id: string | number,
  data: Partial<{
    category_id: number;
    name: string;
    description: string;
    price: number;
    is_active: boolean;
  }>
) {
  const finalId = typeof id === "string" ? parseInt(id, 10) : Number(id);
  return prisma.product.update({
    where: { id: finalId },
    data: data as any
  });
}

export function getCategoryById(id: string | number) {
  const finalId = typeof id === "string" ? parseInt(id, 10) : Number(id);
  if (isNaN(finalId)) return null;

  return prisma.category.findUnique({
    where: { id: finalId }
  });
}

export function getCategoryBySlug(slug: string) {
  return prisma.category.findFirst({ where: { name: slug } }); // Category has no slug, using name lookup
}

export function getCategoryByName(name: string) {
  return prisma.category.findFirst({ where: { name } });
}

export function getProductBySku(sku: string) {
  // Search by SKU in canonical ProductSku table
  return prisma.productSku.findFirst({ 
    where: { sku },
    include: {
      Product: {
        include: {
          Category: true,
          Brand: true,
          ProductSku: true
        }
      }
    }
  });
}

export function getProductBySlug(slug: string) {
  return prisma.product.findFirst({ 
    where: { slug },
    include: {
      Category: true,
      Brand: true,
      ProductSku: {
        include: {
          SkuAttribute: {
            include: {
              AttributeValue: {
                include: {
                  Attribute: true
                }
              }
            }
          }
        }
      }
    }
  });
}
