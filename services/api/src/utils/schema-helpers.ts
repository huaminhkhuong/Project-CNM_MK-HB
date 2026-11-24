import { query } from "../config/database";
import { env } from "../config/env";
import { createError } from "./service-helpers";

export function pickColumn(columns: string[], candidates: string[], defaultValue: string | null = null): string | null {
  return candidates.find((column) => columns.includes(column)) || defaultValue;
}

export function buildActiveCondition(alias: string, columns: string[]): string {
  if (columns.includes("status")) {
    return `${alias}.status = 'ACTIVE'`;
  }

  if (columns.includes("is_active")) {
    return `${alias}.is_active = 1`;
  }

  return "1 = 1";
}

export async function getTableColumns(tableName: string): Promise<string[]> {
  const rows = await query<any[]>(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = COALESCE(DATABASE(), ?)
        AND TABLE_NAME = ?
    `,
    [env.dbName, tableName]
  );

  return rows.map((row) => row.COLUMN_NAME);
}

export async function requireTableColumns(tableName: string, columns: string[], message: string): Promise<string[]> {
  const existingColumns = await getTableColumns(tableName);

  const hasAllColumns = columns.every((column) => existingColumns.includes(column));

  if (!hasAllColumns) {
    throw createError(message, 500);
  }

  return existingColumns;
}

export default {
  pickColumn,
  buildActiveCondition,
  getTableColumns,
  requireTableColumns
};
