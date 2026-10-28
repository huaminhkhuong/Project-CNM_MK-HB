import { httpClient } from "./http";

const requestCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

async function cachedRequest(cacheKey, fetcher) {
  const now = Date.now();
  if (requestCache.has(cacheKey)) {
    const entry = requestCache.get(cacheKey);
    if (now - entry.timestamp < CACHE_TTL_MS) {
      return entry.promise;
    }
    requestCache.delete(cacheKey);
  }

  const requestPromise = Promise.resolve()
    .then(fetcher)
    .catch((error) => {
      requestCache.delete(cacheKey);
      throw error;
    });

  requestCache.set(cacheKey, { timestamp: now, promise: requestPromise });
  return requestPromise;
}

export async function getProducts(params = {}) {
  const normalizedParams = {
    ...params,
    min_price: params.min_price ?? params.minPrice,
    max_price: params.max_price ?? params.maxPrice,
    keyword: params.keyword ?? params.search
  };
  const cacheKey = `products:${JSON.stringify(normalizedParams)}`;
  return cachedRequest(cacheKey, async () => {
    const response = await httpClient.get("/products", { params: normalizedParams });
    return response.data;
  });
}

export async function getProductFilterOptions(params = {}) {
  const categoryId = params.category_id ?? params.categoryId ?? "";
  const cacheKey = `product-filter-options:${categoryId || "all"}`;
  return cachedRequest(cacheKey, async () => {
    const response = await httpClient.get("/products/filter-options", { params });
    return response.data;
  });
}

export async function getCompareProducts(ids) {
  const response = await httpClient.get("/products/compare", {
    params: {
      ids: Array.isArray(ids) ? ids.join(",") : ids
    }
  });
  return response.data;
}

export async function getProductDetail(idOrSlug) {
  const response = await httpClient.get(`/products/${idOrSlug}`);
  return response.data;
}

export async function getCategories() {
  return cachedRequest("categories", async () => {
    const response = await httpClient.get("/categories");
    return response.data;
  });
}

export async function getBrands() {
  return cachedRequest("brands", async () => {
    const response = await httpClient.get("/brands");
    return response.data;
  });
}

export function clearCatalogCache() {
  requestCache.clear();
  try {
    localStorage.removeItem("pcmall_builder_catalog_cache_v6");
  } catch (_e) {
    // Ignore localStorage errors
  }
}

export async function getProductReviews(idOrSlug, params = {}) {
  const response = await httpClient.get(`/products/${idOrSlug}/reviews`, { params });
  return response.data;
}

export async function getReviewEligibility(idOrSlug) {
  const response = await httpClient.get(`/products/${idOrSlug}/reviews/eligibility`);
  return response.data;
}

export async function submitProductReview(idOrSlug, data) {
  const response = await httpClient.post(`/products/${idOrSlug}/reviews`, data);
  return response.data;
}

