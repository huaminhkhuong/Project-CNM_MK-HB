const CATEGORY_PLACEHOLDERS = {
  cpu: "CPU",
  mainboard: "Mainboard",
  ram: "RAM",
  gpu: "GPU",
  storage: "Storage",
  ssd: "SSD",
  psu: "PSU",
  case: "Case",
  cooling: "Cooling",
  cooler: "Cooling",
  fan: "Cooling",
  aio: "Cooling",
  laptop: "Laptop",
  completepc: "Complete PC",
  default: "PC Mall"
};

const FALLBACK_IMAGES = {
  default: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&h=800&fit=crop",
  cpu: "/assets/products/i5.png",
  mainboard: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=800&fit=crop",
  ram: "https://images.unsplash.com/photo-1562976540-1502c2145186?w=800&h=800&fit=crop",
  gpu: "/assets/products/rtx4060.png",
  storage: "/assets/products/ssd-samsung-980-pro-2tb.svg",
  psu: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&h=800&fit=crop",
  case: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&h=800&fit=crop",
  cooling: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&h=800&fit=crop",
  laptop: "/assets/products/laptop-acer-predator-helios-16.svg",
  completepc: "/assets/products/complete-pc-gaming-mid.jpg"
};

function pickLabel(categoryName, productName) {
  const key = String(categoryName || productName || "")
    .trim()
    .toLowerCase();

  for (const [token, label] of Object.entries(CATEGORY_PLACEHOLDERS)) {
    if (key.includes(token)) return label;
  }

  return CATEGORY_PLACEHOLDERS.default;
}

function isBrokenImage(url) {
  const value = String(url || "").trim();
  if (!value) return true;
  if (value.startsWith("data:image/svg+xml")) return false;
  if (value.startsWith("data:image") && value.length < 1000) return true;
  if (value.includes("placehold.co") && /0f172a|111827|black/i.test(value)) return true;
  if (value.includes("via.placeholder.com") || value.includes("placeholder.com")) return true;
  if (value.includes("null") || value.includes("undefined")) return true;
  return false;
}

function getProductCategoryKey(product = {}) {
  return String(
    product?.category_name ||
      product?.categoryName ||
      product?.category?.name ||
      product?.product_name ||
      product?.name ||
      ""
  )
    .trim()
    .toLowerCase();
}

function getCategoryFallbackKey(product = {}, options = {}) {
  const name = String(product?.product_name || product?.name || "").toLowerCase();
  const cat = getProductCategoryKey(product);
  const key = `${cat} ${String(options.label || "").toLowerCase()} ${name}`;

  if (["cpu", "processor", "intel", "ryzen", "bo xu ly"].some((t) => key.includes(t))) return "cpu";
  if (["mainboard", "motherboard", "bo mach", "b650", "b760", "z790", "x670", "b550", "a520"].some((t) => key.includes(t))) return "mainboard";
  if (["ram", "memory", "ddr4", "ddr5"].some((t) => key.includes(t))) return "ram";
  if (["gpu", "vga", "rtx", "radeon", "graphics card", "card do hoa"].some((t) => key.includes(t))) return "gpu";
  if (["cooling", "cooler", "fan", "aio", "radiator", "tan nhiet"].some((t) => key.includes(t))) return "cooling";
  if (["psu", "power", "nguon"].some((t) => key.includes(t))) return "psu";
  if (["case", "thung may", "vo pc", "chassis"].some((t) => key.includes(t))) return "case";
  if (["storage", "ssd", "hdd", "nvme"].some((t) => key.includes(t))) return "storage";
  if (["laptop", "notebook"].some((t) => key.includes(t))) return "laptop";
  if (["complete pc", "pc bo", "pc bộ", "pc build", "custom build"].some((t) => key.includes(t))) return "completepc";

  return "default";
}

function getFallbackImage(product = {}, options = {}) {
  if (options.fallbackUrl && !isBrokenImage(options.fallbackUrl)) {
    return options.fallbackUrl;
  }

  const key = getCategoryFallbackKey(product, options);
  return FALLBACK_IMAGES[key] || FALLBACK_IMAGES.default;
}

export function resolveProductImage(product = {}, options = {}) {
  const candidates = [
    product?.image_url,
    product?.imageUrl,
    product?.thumbnail,
    product?.thumbnail_url,
    product?.product?.image_url,
    product?.product?.imageUrl,
    product?.product?.thumbnail,
    product?.sku?.image_url,
    product?.sku?.imageUrl,
    product?.skuData?.image_url,
    product?.skuData?.imageUrl,
    product?.defaultVariant?.imageUrl,
    product?.primaryVariant?.image_url,
    product?.variants?.[0]?.image_url,
    product?.variants?.[0]?.imageUrl,
    product?.skus?.[0]?.image_url,
    product?.skus?.[0]?.imageUrl
  ];

  for (const raw of candidates) {
    const url = String(raw || "").trim();
    if (isBrokenImage(url)) continue;
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) {
      return url;
    }
    if (url.startsWith("assets/") || url.startsWith("media/")) {
      return `/${url}`;
    }
    return `/media/${url}`;
  }

  const categoryFallback = getFallbackImage(product, options);
  if (categoryFallback) return categoryFallback;

  return FALLBACK_IMAGES.default;
}
