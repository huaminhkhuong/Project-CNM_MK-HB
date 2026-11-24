import { prisma } from "../config/prisma";

export async function checkDatabaseConnection() {
  const startedAt = Date.now();

  try {
    const rows = await prisma.$queryRaw<
      Array<{ currentTime: Date; databaseName: string | null }>
    >`SELECT NOW() AS currentTime, DATABASE() AS databaseName`;

    const row = rows[0];

    return {
      connected: true,
      latencyMs: Date.now() - startedAt,
      database: row?.databaseName ?? null,
      serverTime: row?.currentTime ? new Date(row.currentTime).toISOString() : null
    };
  } catch (error: any) {
    return {
      connected: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Database ping failed"
    };
  }
}
