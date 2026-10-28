const { query } = require("../../config/database");
const { createError } = require("../../utils/service-helpers");
const { getTableColumns } = require("../../utils/schema-helpers");
const { checkDatabaseHealth } = require("../../services/test-connection.service");
const { getRecentAuditLogs } = require("../../services/audit-log.service");

const DEFAULT_SETTINGS = [
  { key: "store_name", value: "CNM PC Store", description: "Ten hien thi cua he thong" },
  { key: "support_email", value: "support@example.com", description: "Email ho tro khach hang" },
  { key: "support_phone", value: "0900000000", description: "So dien thoai ho tro" },
  { key: "online_payment_mode", value: "sandbox", description: "Che do thanh toan online: sandbox/live" },
  { key: "shipping_mode", value: "mock", description: "Che do van chuyen: mock/live" },
  { key: "maintenance_mode", value: "off", description: "Bat/tat che do bao tri" }
];

const ALLOWED_KEYS = new Set(DEFAULT_SETTINGS.map((item) => item.key));

async function ensureSettingsTable() {
  const columns = await getTableColumns("system_settings").catch(() => []);
  if (columns.length === 0) {
    throw createError("system_settings table is not available. Please run npm run db:migrate", 500);
  }
  return columns;
}

async function hasSettingsTable() {
  const columns = await getTableColumns("system_settings").catch(() => []);
  return columns.length > 0;
}

function getDefaultSettings() {
  return DEFAULT_SETTINGS.map((item, index) => ({
    id: index + 1,
    key: item.key,
    value: item.value,
    description: item.description,
    createdAt: null,
    updatedAt: null,
    readonly: true
  }));
}

async function ensureDefaultSettings() {
  await ensureSettingsTable();

  for (const item of DEFAULT_SETTINGS) {
    await query(
      `
        INSERT INTO system_settings (setting_key, setting_value, description)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          description = VALUES(description),
          updated_at = CURRENT_TIMESTAMP
      `,
      [item.key, item.value, item.description]
    );
  }
}

async function getSettings() {
  if (!(await hasSettingsTable())) {
    return getDefaultSettings();
  }

  await ensureDefaultSettings();
  const rows = await query(
    `
      SELECT
        id,
        setting_key AS settingKey,
        setting_value AS settingValue,
        description,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM system_settings
      ORDER BY setting_key ASC
    `
  );

  return rows.map((row) => ({
    id: row.id,
    key: row.settingKey,
    value: row.settingValue,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

async function updateSettings(payload = {}) {
  if (!(await hasSettingsTable())) {
    const entries = Object.entries(payload).filter(([key]) => ALLOWED_KEYS.has(key));
    const overrides = Object.fromEntries(entries);

    return getDefaultSettings().map((item) => ({
      ...item,
      value: Object.prototype.hasOwnProperty.call(overrides, item.key) ? String(overrides[item.key] ?? "") : item.value
    }));
  }

  await ensureDefaultSettings();
  const entries = Object.entries(payload).filter(([key]) => ALLOWED_KEYS.has(key));

  if (entries.length === 0) {
    throw createError("No valid system settings provided", 400);
  }

  for (const [key, value] of entries) {
    await query(
      `
        UPDATE system_settings
        SET setting_value = ?, updated_at = CURRENT_TIMESTAMP
        WHERE setting_key = ?
      `,
      [value === null || value === undefined ? "" : String(value), key]
    );
  }

  return getSettings();
}

async function tableExists(tableName) {
  const columns = await getTableColumns(tableName).catch(() => []);
  return columns.length > 0;
}

async function countIfExists(tableName) {
  if (!(await tableExists(tableName))) {
    return null;
  }

  const rows = await query(`SELECT COUNT(*) AS total FROM ${tableName}`);
  return Number(rows[0]?.total || 0);
}

async function countOrdersByPaymentStatus(statuses) {
  if (!(await tableExists("orders"))) {
    return 0;
  }

  const placeholders = statuses.map(() => "?").join(", ");
  const rows = await query(
    `
      SELECT COUNT(*) AS total
      FROM orders
      WHERE payment_method = 'BANK_TRANSFER'
        AND payment_status IN (${placeholders})
    `,
    statuses
  );

  return Number(rows[0]?.total || 0);
}

async function getSystemOverview() {
  const [
    dbHealth,
    users,
    products,
    orders,
    tickets,
    payments,
    shipments,
    pendingPaymentApprovals,
    bankTransferOrders,
    settings,
    auditLogs
  ] = await Promise.all([
    checkDatabaseHealth(),
    countIfExists("users"),
    countIfExists("products"),
    countIfExists("orders"),
    countIfExists("tickets"),
    countIfExists("payments"),
    countIfExists("shipments"),
    countOrdersByPaymentStatus(["AWAITING_ADMIN_CONFIRMATION", "PENDING_VERIFICATION"]),
    countOrdersByPaymentStatus(["PENDING_GATEWAY", "AWAITING_ADMIN_CONFIRMATION", "PENDING_VERIFICATION", "PAID", "REJECTED"]),
    getSettings(),
    getRecentAuditLogs(12)
  ]);

  return {
    health: {
      api: {
        status: "UP",
        timestamp: new Date().toISOString()
      },
      database: {
        status: dbHealth?.success ? "UP" : "DOWN",
        details: dbHealth
      }
    },
    metrics: {
      users,
      products,
      orders,
      tickets,
      payments,
      shipments,
      pendingPaymentApprovals,
      bankTransferOrders
    },
    settings,
    auditLogs
  };
}

module.exports = {
  getSettings,
  updateSettings,
  getSystemOverview
};
