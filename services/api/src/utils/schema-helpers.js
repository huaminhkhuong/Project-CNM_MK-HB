const { query } = require("../config/database");
const { env } = require("../config/env");
const { createError } = require("./service-helpers");

function pickColumn(columns, candidates, defaultValue = null) {
  return candidates.find((column) => columns.includes(column)) || defaultValue;
}

function buildActiveCondition(alias, columns) {
  if (columns.includes("status")) {
    return `${alias}.status = 'ACTIVE'`;
  }

  if (columns.includes("is_active")) {
    return `${alias}.is_active = 1`;
  }

  return "1 = 1";
}

async function getTableColumns(tableName) {
  const rows = await query(
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

async function requireTableColumns(tableName, columns, message) {
  const existingColumns = await getTableColumns(tableName);

  const hasAllColumns = columns.every((column) => existingColumns.includes(column));

  if (!hasAllColumns) {
    throw createError(message, 500);
  }

  return existingColumns;
}

module.exports = {
  pickColumn,
  buildActiveCondition,
  getTableColumns,
  requireTableColumns
};
