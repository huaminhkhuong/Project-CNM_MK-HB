import { query, testConnection } from "../config/database";

export async function checkDatabaseHealth(): Promise<any> {
  const connectionResult = await testConnection();
  const rows = await query<any[]>("SELECT NOW() AS currentTime, DATABASE() AS databaseName");
  const databaseInfo = rows[0] || null;

  return {
    ...connectionResult,
    data: databaseInfo
  };
}

export default {
  checkDatabaseHealth
};
