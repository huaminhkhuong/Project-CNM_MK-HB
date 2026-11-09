const { query } = require("../../config/database");
const { createError } = require("../../utils/service-helpers");
const { getTableColumns } = require("../../utils/schema-helpers");
const { checkDatabaseHealth } = require("../../services/test-connection.service");
const { getRecentAuditLogs } = require("../../services/audit-log.service");

const DEFAULT_SETTINGS = [
  { key: "store_name", value: "PC Mall", description: "Tên hiển thị của hệ thống" },
  { key: "support_email", value: "support@pcmall.vn", description: "Email hỗ trợ khách hàng" },
  { key: "support_phone", value: "0900000000", description: "Số điện thoại hỗ trợ" },
  { key: "online_payment_mode", value: "sandbox", description: "Chế độ thanh toán online: sandbox/live" },
  { key: "shipping_mode", value: "mock", description: "Chế độ vận chuyển: mock/live" },
  { key: "maintenance_mode", value: "off", description: "Bật/tắt chế độ bảo trì" },
  // Cấu hình linh hoạt Tài khoản ngân hàng & Thông tin Doanh nghiệp
  { key: "bank_name", value: "Techcombank", description: "Tên ngân hàng nhận chuyển khoản" },
  { key: "bank_account_number", value: "8686868991", description: "Số tài khoản ngân hàng nhận thanh toán" },
  { key: "bank_account_holder", value: "HỨA MINH KHƯƠNG", description: "Tên chủ tài khoản ngân hàng" },
  { key: "store_hotline", value: "1900 8888", description: "Hotline tổng đài tư vấn" },
  { key: "store_tax_id", value: "0316888999", description: "Mã số thuế doanh nghiệp" },
  { key: "store_address", value: "123 Nguyễn Thị Minh Khai, Q.1, TP. Hồ Chí Minh", description: "Địa chỉ trụ sở / Showroom chính" }
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

async function countWhereIfExists(tableName, whereSql = "1=1", params = []) {
  if (!(await tableExists(tableName))) {
    return 0;
  }

  const rows = await query(`SELECT COUNT(*) AS total FROM ${tableName} WHERE ${whereSql}`, params).catch(() => []);
  return Number(rows[0]?.total || 0);
}

async function getSystemOverview() {
  const [
    dbHealth,
    users,
    products,
    skus,
    attributes,
    compatibilityRules,
    orders,
    tickets,
    warranties,
    payments,
    shipments,
    pendingPaymentApprovals,
    bankTransferOrders,
    lowStockSkus,
    pendingOrders,
    unassignedTickets,
    pendingTickets,
    pendingWarranties,
    settings,
    auditLogs
  ] = await Promise.all([
    checkDatabaseHealth(),
    countIfExists("users"),
    countIfExists("products"),
    countIfExists("product_skus"),
    countIfExists("attributes"),
    countIfExists("compatibility_rules"),
    countIfExists("orders"),
    countIfExists("tickets"),
    countIfExists("warranties"),
    countIfExists("payments"),
    countIfExists("shipments"),
    countOrdersByPaymentStatus(["AWAITING_ADMIN_CONFIRMATION", "PENDING_VERIFICATION"]),
    countOrdersByPaymentStatus(["PENDING_GATEWAY", "AWAITING_ADMIN_CONFIRMATION", "PENDING_VERIFICATION", "PAID", "REJECTED"]),
    countWhereIfExists("product_skus", "stock <= 5 AND (status IS NULL OR status = 'ACTIVE')"),
    countWhereIfExists("orders", "status IN ('PENDING', 'PROCESSING')"),
    countWhereIfExists("tickets", "assigned_to IS NULL AND status IN ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER')"),
    countWhereIfExists("tickets", "status IN ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER')"),
    countWhereIfExists("warranties", "status IN ('SUBMITTED', 'UNDER_REVIEW', 'RECEIVED', 'PROCESSING')"),
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
      skus,
      attributes,
      compatibilityRules,
      orders,
      tickets,
      warranties,
      payments,
      shipments,
      pendingPaymentApprovals,
      bankTransferOrders,
      lowStockSkus,
      pendingOrders,
      unassignedTickets,
      pendingTickets,
      pendingWarranties
    },
    settings,
    auditLogs
  };
}

/**
 * Lấy thông tin cấu hình cửa hàng & tài khoản ngân hàng công khai
 * (Dùng cho khách hàng xem trên giao diện thanh toán & hóa đơn)
 */
async function getPublicStoreInfo() {
  const settings = await getSettings().catch(() => getDefaultSettings());
  const map = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }

  return {
    storeName: map.store_name || "PC Mall",
    supportEmail: map.support_email || "support@pcmall.vn",
    supportPhone: map.support_phone || map.store_hotline || "1900 8888",
    storeAddress: map.store_address || "123 Nguyễn Thị Minh Khai, Q.1, TP. Hồ Chí Minh",
    storeTaxId: map.store_tax_id || "0316888999",
    storeHotline: map.store_hotline || "1900 8888",
    bankName: map.bank_name || "Techcombank",
    bankAccountNumber: map.bank_account_number || "8686868991",
    bankAccountHolder: map.bank_account_holder || "HỨA MINH KHƯƠNG",
    transferNotePrefix: "DH"
  };
}

module.exports = {
  getSettings,
  updateSettings,
  getSystemOverview,
  getPublicStoreInfo
};
