import { getCategories, getProducts, clearCatalogCache } from "../../services/catalog.service";
import { COMPONENT_SECTIONS, SPEC_ALIASES } from "./pcBuilderConstants";
import {
  getEnvelopeItems,
  getProductId,
  getProductName,
  getProductBrand,
  getProductPrice,
  normalizeText,
  findSpec,
  estimateProductPerformance
} from "./pcBuilderUtils";

const CACHE_KEY = "pcmall_builder_catalog_cache_v6";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

/**
 * Load complete catalog for PC Builder with 2-tier caching:
 * 1. LocalStorage (5-minute TTL)
 * 2. Parallel API queries by category keywords with search fallback
 */
export async function loadBuilderCatalog(forceRefresh = false) {
  if (!forceRefresh) {
    try {
      const cachedRaw = localStorage.getItem(CACHE_KEY);
      if (cachedRaw) {
        const { timestamp, data } = JSON.parse(cachedRaw);
        const hasContent = data && Object.values(data).some((arr) => Array.isArray(arr) && arr.length > 0);
        if (Date.now() - timestamp < CACHE_TTL_MS && hasContent) {
          return { data, fromCache: true };
        }
      }
    } catch (cacheErr) {
      console.warn("Failed to read catalog cache from localStorage", cacheErr);
    }
  } else {
    clearCatalogCache();
  }

  const next = COMPONENT_SECTIONS.reduce((acc, s) => {
    acc[s.componentType] = [];
    return acc;
  }, {});

  let categoryList = [];
  try {
    const res = await getCategories();
    categoryList = getEnvelopeItems(res, []);
  } catch (err) {
    console.warn("builderCatalogLoader: failed to load categories", err);
  }

  await Promise.all(
    COMPONENT_SECTIONS.map(async (section) => {
      try {
        let items = [];
        const keywords = section.categoryKeywords || [section.categoryName || section.componentType];
        const matchedCats = categoryList.filter((cat) => {
          const name = String(cat?.name || cat?.category_name || "").toUpperCase();
          return keywords.some((kw) => name.includes(kw.toUpperCase()));
        });

        if (matchedCats.length > 0) {
          const catResults = await Promise.all(
            matchedCats.map((cat) => getProducts({ category_id: cat.id, limit: 100 }))
          );
          const allCatItems = catResults.flatMap((r) => getEnvelopeItems(r, []));
          const seenIds = new Set();
          items = allCatItems.filter((p) => {
            const pId = getProductId(p);
            if (!pId || seenIds.has(pId)) return false;
            seenIds.add(pId);
            return true;
          });
        }

        // Fallback 1: Query by search keyword
        if (!items || items.length === 0) {
          const fallbackRes = await getProducts({ search: section.componentType, limit: 100 });
          items = getEnvelopeItems(fallbackRes, []);
        }

        // Fallback 2: General catalog filtered by keywords
        if (!items || items.length === 0) {
          const allRes = await getProducts({ limit: 100 });
          const allItems = getEnvelopeItems(allRes, []);
          items = allItems.filter((p) => {
            const catName = String(p?.category_name || p?.Category?.name || "").toUpperCase();
            const prodName = String(p?.product_name || p?.name || "").toUpperCase();
            return keywords.some((kw) => {
              const kUpper = String(kw || "").toUpperCase();
              return kUpper && (catName.includes(kUpper) || prodName.includes(kUpper));
            });
          });
        }

        next[section.componentType] = items;
      } catch (err) {
        console.warn(`builderCatalogLoader: failed to load ${section.componentType}`, err);
      }
    })
  );

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: next }));
  } catch (saveCacheErr) {
    console.warn("Failed to save catalog cache to localStorage", saveCacheErr);
  }

  return { data: next, fromCache: false };
}

/**
 * Extract sorted list of available brands for active component
 */
export function extractAvailableBrands(optionsByComponent, activeComponent) {
  const allProducts = optionsByComponent[activeComponent] || [];
  const brands = new Set(allProducts.map((p) => getProductBrand(p)).filter(Boolean));
  return [...brands].sort();
}

/**
 * Filter catalog products by search term and advanced filters
 */
export function filterProducts(optionsByComponent, activeComponent, {
  searchTerm = "",
  filterPriceRange = { min: 0, max: 0 },
  filterBrands = [],
  filterAiScoreMin = 0
}) {
  const keyword = normalizeText(searchTerm);
  let products = (optionsByComponent[activeComponent] || []).filter((p) => {
    const text = `${getProductName(p)} ${getProductBrand(p)} ${findSpec(p, SPEC_ALIASES.coolingType)} ${findSpec(p, SPEC_ALIASES.socket)} ${findSpec(p, SPEC_ALIASES.ramType)}`;
    return !keyword || normalizeText(text).includes(keyword);
  });

  // Price range filter
  if (filterPriceRange.min > 0) {
    products = products.filter((p) => getProductPrice(p) >= filterPriceRange.min);
  }
  if (filterPriceRange.max > 0) {
    products = products.filter((p) => getProductPrice(p) <= filterPriceRange.max);
  }

  // Brand filter (multi-select)
  if (filterBrands.length > 0) {
    products = products.filter((p) => filterBrands.includes(getProductBrand(p)));
  }

  // AI Score minimum filter
  if (filterAiScoreMin > 0) {
    products = products.filter(
      (p) => estimateProductPerformance(p, activeComponent) >= filterAiScoreMin
    );
  }

  return products;
}
