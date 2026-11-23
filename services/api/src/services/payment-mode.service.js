const { query } = require("../config/database");
const { env } = require("../config/env");

const VALID_ONLINE_PAYMENT_MODES = ["sandbox", "mock", "live"];
const CACHE_TTL_MS = 5000;

let cachedMode = null;
let cacheExpiresAt = 0;

function getActiveEnv() {
  return globalThis.__CNM_ENV__ || env;
}

function invalidatePaymentModeCache() {
  cachedMode = null;
  cacheExpiresAt = 0;
}

function hasValidVnpayCredentials(activeEnv) {
  const tmnCode = String(activeEnv.vnpayTmnCode || process.env.VNPAY_TMN_CODE || "").trim();
  const hashSecret = String(activeEnv.vnpayHashSecret || process.env.VNPAY_HASH_SECRET || "").trim();
  if (!tmnCode || !hashSecret) {
    return false;
  }
  const lowerTmn = tmnCode.toLowerCase();
  const lowerSecret = hashSecret.toLowerCase();
  if (lowerTmn.startsWith("your_") || lowerSecret.startsWith("your_")) {
    return false;
  }
  return true;
}

async function getOnlinePaymentMode() {
  const now = Date.now();
  if (now < cacheExpiresAt) {
    return cachedMode;
  }

  try {
    const rows = await query(
      `
        SELECT setting_value AS settingValue
        FROM system_settings
        WHERE setting_key = 'online_payment_mode'
        LIMIT 1
      `
    );
    const raw = rows?.[0]?.settingValue;
    const normalized = raw !== undefined && raw !== null ? String(raw).trim().toLowerCase() : "";
    cachedMode = VALID_ONLINE_PAYMENT_MODES.includes(normalized) ? normalized : null;
  } catch (_error) {
    cachedMode = null;
  }

  cacheExpiresAt = now + CACHE_TTL_MS;
  return cachedMode;
}

/**
 * Dynamically determines whether mock payment mode is active.
 * Priority:
 *  1. NODE_ENV === "production" -> ALWAYS false (hard security lock).
 *  2. NODE_ENV === "test" -> follows env.paymentMockMode (keeps automated test suite deterministic).
 *  3. development -> reads system_settings.online_payment_mode (cached 5s):
 *     - "mock" -> true
 *     - "sandbox" | "live" -> false (falls back to true only if VNPAY credentials are missing)
 *     - missing in DB -> falls back to env.paymentMockMode
 */
async function isMockPaymentEnabled() {
  const activeEnv = getActiveEnv();

  if (activeEnv.nodeEnv === "production") {
    return false;
  }

  if (activeEnv.nodeEnv === "test") {
    return Boolean(activeEnv.paymentMockMode);
  }

  const dbMode = await getOnlinePaymentMode();
  if (dbMode === "mock") {
    return true;
  }

  if (dbMode === "sandbox" || dbMode === "live") {
    return !hasValidVnpayCredentials(activeEnv);
  }

  return Boolean(activeEnv.paymentMockMode);
}

module.exports = {
  VALID_ONLINE_PAYMENT_MODES,
  getOnlinePaymentMode,
  isMockPaymentEnabled,
  invalidatePaymentModeCache
};

