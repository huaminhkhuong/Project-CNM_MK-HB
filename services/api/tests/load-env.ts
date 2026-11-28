import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

process.env.NODE_ENV = "test";

/**
 * Always isolate automated tests onto a dedicated test database (`cnm_mk_hb_test`)
 * so `npm test` NEVER mutates or pollutes the live development database (`cnm_mk_hb`).
 */
function resolveTestDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL && process.env.TEST_DATABASE_URL.trim()) {
    return process.env.TEST_DATABASE_URL.trim();
  }
  const baseUrl = process.env.DATABASE_URL || "mysql://root:root@127.0.0.1:3307/cnm_mk_hb";
  try {
    const parsed = new URL(baseUrl);
    const currentDb = parsed.pathname.replace(/^\//, "") || "cnm_mk_hb";
    const testDb = currentDb.endsWith("_test") ? currentDb : `${currentDb}_test`;
    parsed.pathname = `/${testDb}`;
    return parsed.toString();
  } catch {
    return "mysql://root:root@127.0.0.1:3307/cnm_mk_hb_test";
  }
}

const testDatabaseUrl = resolveTestDatabaseUrl();
process.env.DATABASE_URL = testDatabaseUrl;
try {
  process.env.DB_NAME = new URL(testDatabaseUrl).pathname.replace(/^\//, "") || "cnm_mk_hb_test";
} catch {
  process.env.DB_NAME = "cnm_mk_hb_test";
}

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test_access_secret";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test_refresh_secret";
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
