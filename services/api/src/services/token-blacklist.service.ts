import jwt from "jsonwebtoken";
import { query } from "../config/database";

function decodeToken(token: string): { userId?: string; exp?: number } {
  const decoded = jwt.decode(token) as { userId?: string; exp?: number } | null;
  return decoded ?? {};
}

export async function blacklistToken(token: string): Promise<void> {
  const { userId, exp } = decodeToken(token);
  const expiresAt = exp
    ? new Date(exp * 1000).toISOString().slice(0, 19).replace("T", " ")
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
  try {
    const sql = "INSERT IGNORE INTO token_blacklist (token, user_id, expires_at) VALUES (?, ?, ?)";
    await query(sql, [token, userId ? Number(userId) : null, expiresAt]);
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