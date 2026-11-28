const { query } = require("../../config/database");
const { getTableColumns } = require("../../utils/schema-helpers");

const DEFAULT_FREE_SHIPPING_THRESHOLD = 5000000;
const DEFAULT_SHIPPING_FEE = 30000;
const CACHE_TTL_MS = 5000;

let cachedConfig = null;
let cacheExpiresAt = 0;

function invalidateShippingFeeCache() {
  cachedConfig = null;
  cacheExpiresAt = 0;
}

async function getShippingFeeConfig() {
  const now = Date.now();
  if (cachedConfig && cacheExpiresAt > now) {
    return cachedConfig;
  }

  let freeShippingThreshold = DEFAULT_FREE_SHIPPING_THRESHOLD;
  let defaultShippingFee = DEFAULT_SHIPPING_FEE;

  try {
    const columns = await getTableColumns("system_settings").catch(() => []);
    if (columns.length > 0) {
      const rows = await query(
        `
          SELECT setting_key, setting_value
          FROM system_settings
          WHERE setting_key IN ('free_shipping_threshold', 'default_shipping_fee')
        `
      );
      for (const row of rows || []) {
        const key = String(row.setting_key || "").trim();
        const numVal = Number(row.setting_value);
        if (key === "free_shipping_threshold" && Number.isFinite(numVal) && numVal >= 0) {
          freeShippingThreshold = numVal;
        } else if (key === "default_shipping_fee" && Number.isFinite(numVal) && numVal >= 0) {
          defaultShippingFee = numVal;
        }
      }
    }
  } catch {
    // Fallback to safe defaults if system_settings cannot be read
  }

  cachedConfig = { freeShippingThreshold, defaultShippingFee };
  cacheExpiresAt = now + CACHE_TTL_MS;
  return cachedConfig;
}

/**
 * Authoritative server-side shipping fee calculation (ignores client-supplied shippingFee).
 * - PICKUP / subtotal <= 0 / subtotal >= freeShippingThreshold (default 5,000,000 VND) => 0 VND
 * - Otherwise => defaultShippingFee (default 30,000 VND)
 */
async function calculateServerShippingFee(subtotal, options = {}) {
  const numericSubtotal = Number(subtotal || 0);
  const shippingMethod = String(options.shippingMethod || "").trim().toUpperCase();

  if (shippingMethod === "PICKUP" || numericSubtotal <= 0) {
    return 0;
  }

  const { freeShippingThreshold, defaultShippingFee } = await getShippingFeeConfig();
  if (numericSubtotal >= freeShippingThreshold) {
    return 0;
  }

  return Number(defaultShippingFee.toFixed(2));
}

module.exports = {
  DEFAULT_FREE_SHIPPING_THRESHOLD,
  DEFAULT_SHIPPING_FEE,
  getShippingFeeConfig,
  calculateServerShippingFee,
  invalidateShippingFeeCache
};

