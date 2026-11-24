import { query } from "../config/database";

export async function getDatabaseTime(): Promise<any> {
  const rows = await query<any[]>("SELECT NOW() AS currentTime");
  return rows[0] || null;
}

export async function getProductCount(): Promise<any> {
  const rows = await query<any[]>("SELECT COUNT(*) AS totalProducts FROM products");
  return rows[0] || { totalProducts: 0 };
}

export default {
  getDatabaseTime,
  getProductCount
};
