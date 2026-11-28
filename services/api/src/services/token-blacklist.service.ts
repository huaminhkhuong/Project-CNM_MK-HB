import jwt from "jsonwebtoken";
import { query } from "../config/database";

function decodeToken(token: string): { userId?: string; exp?: number } {
  const decoded = jwt.decode(token) as { userId?: string; exp?: number } | null;
  return decoded ?? {};
}

export async function blacklistToken(token: string): Promise<void> {
  if (!token || typeof token !== "string") return;
  const { userId, exp } = decodeToken(token);
  const expiresUnix =
    typeof exp === "number" && Number.isFinite(exp) && exp > 0
      ? Math.floor(exp)
      : Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  try {
    // Use FROM_UNIXTIME(?) so MySQL stores expires_at in the active session timezone (+07:00),
    // matching NOW() identically for short-lived 15m access tokens and 7d refresh tokens.
    const sql =
      "INSERT IGNORE INTO token_blacklist (token, user_id, expires_at) VALUES (?, ?, FROM_UNIXTIME(?))";
    await query(sql, [token, userId ? Number(userId) : null, expiresUnix]);
  } catch (err: any) {
    if (err?.code === "ER_NO_SUCH_TABLE") {
      console.warn("[token-blacklist] table not found");
      return;
    }
    throw err;
  }
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  try {
    const sql = "SELECT 1 FROM token_blacklist WHERE token = ? AND expires_at > NOW() LIMIT 1";
    const rows = (await query(sql, [token])) as any[];
    return rows.length > 0;
  } catch (err: any) {
    if (err?.code === "ER_NO_SUCH_TABLE") return false;
    throw err;
  }
}

export async function purgeExpiredTokens(): Promise<void> {
  try {
    await query("DELETE FROM token_blacklist WHERE expires_at <= NOW()", []);
  } catch (err: any) {
    if (err?.code === "ER_NO_SUCH_TABLE") return;
    throw err;
  }
}