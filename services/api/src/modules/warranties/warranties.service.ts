const { query } = require("../../config/database");
const { createError, toPositiveInteger } = require("../../utils/service-helpers");
const { getTableColumns, pickColumn } = require("../../utils/schema-helpers");

let schemaCache = null;

function generateWarrantyCode(orderItemId) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `WRN-${stamp}-${orderItemId}-${random}`;
}

function normalizeStatus(status) {
  return String(status || "ACTIVE").trim().toUpperCase() || "ACTIVE";
}

function formatMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

async function getSchema() {
  if (schemaCache) {
    return schemaCache;
  }

  const [warrantyColumns, orderColumns, orderItemColumns] = await Promise.all([
    getTableColumns("warranties").catch(() => []),
    getTableColumns("orders"),
    getTableColumns("order_items")
  ]);

  if (warrantyColumns.length === 0) {
    throw createError("Warranties table is not available. Please import phase6_warranties_migration.sql", 500);
  }

  const schema = {
    warranties: {
      table: "warranties",
      id: pickColumn(warrantyColumns, ["id"]),
      userId: pickColumn(warrantyColumns, ["user_id"]),
      orderId: pickColumn(warrantyColumns, ["order_id"], null),
      orderItemId: pickColumn(warrantyColumns, ["order_item_id"], null),
      skuId: pickColumn(warrantyColumns, ["sku_id", "product_variant_id"], null),
      warrantyCode: pickColumn(warrantyColumns, ["warranty_code", "code"]),
      status: pickColumn(warrantyColumns, ["status"], null),
      note: pickColumn(warrantyColumns, ["note", "notes"], null),
      activatedAt: pickColumn(warrantyColumns, ["activated_at"], null),
      expiresAt: pickColumn(warrantyColumns, ["expires_at"], null),
      createdAt: pickColumn(warrantyColumns, ["created_at"], null)
    },
    orders: {
      table: "orders",
      id: pickColumn(orderColumns, ["id"]),
      userId: pickColumn(orderColumns, ["user_id"]),
      status: pickColumn(orderColumns, ["status"], null),
      createdAt: pickColumn(orderColumns, ["created_at"], null)
    },
    orderItems: {
      table: "order_items",
      id: pickColumn(orderItemColumns, ["id"]),
      orderId: pickColumn(orderItemColumns, ["order_id"]),
      productId: pickColumn(orderItemColumns, ["product_id"], null),
      variantId: pickColumn(orderItemColumns, ["product_variant_id", "variant_id"], null),
      sku: pickColumn(orderItemColumns, ["sku_snapshot", "sku"]),
      productName: pickColumn(orderItemColumns, ["name_snapshot", "product_name", "name"]),
      unitPrice: pickColumn(orderItemColumns, ["unit_price"]),
      quantity: pickColumn(orderItemColumns, ["quantity"]),
      lineTotal: pickColumn(orderItemColumns, ["line_total", "total_price"], null)
    }
  };

  if (!schema.warranties.id || !schema.warranties.userId || !schema.warranties.warrantyCode) {
    throw createError("Warranties table does not have required columns", 500);
  }

  if (!schema.orders.id || !schema.orders.userId || !schema.orderItems.id || !schema.orderItems.orderId || !schema.orderItems.sku || !schema.orderItems.productName) {
    throw createError("Orders or order_items table does not have required columns for warranty activation", 500);
  }

  schemaCache = schema;
  return schema;
}

function mapWarrantyRow(row) {
  return {
    id: row.id,
    orderId: row.orderId,
    orderItemId: row.orderItemId,
    skuId: row.skuId,
    warrantyCode: row.warrantyCode,
    status: normalizeStatus(row.status),
    note: row.note,
    activatedAt: row.activatedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    item: {
      productName: row.productName,
      sku: row.sku,
      unitPrice: formatMoney(row.unitPrice),
      quantity: Number(row.quantity || 0)
    }
  };
}

async function getEligibleOrderItems(userId) {
  const schema = await getSchema();
  const canceledStatuses = ["CANCELED"];
  const statusCondition = schema.orders.status ? `AND COALESCE(o.${schema.orders.status}, 'PENDING') NOT IN (${canceledStatuses.map(() => "?").join(", ")})` : "";
  const rows = await query(
    `
      SELECT
        oi.${schema.orderItems.id} AS id,
        o.${schema.orders.id} AS orderId,
        ${schema.orderItems.variantId ? `oi.${schema.orderItems.variantId}` : "NULL"} AS skuId,
        oi.${schema.orderItems.sku} AS sku,
        oi.${schema.orderItems.productName} AS productName,
        oi.${schema.orderItems.unitPrice} AS unitPrice,
        oi.${schema.orderItems.quantity} AS quantity,
        ${schema.orderItems.lineTotal ? `oi.${schema.orderItems.lineTotal}` : `(oi.${schema.orderItems.unitPrice} * oi.${schema.orderItems.quantity})`} AS lineTotal,
        ${schema.orders.createdAt ? `o.${schema.orders.createdAt}` : "NULL"} AS orderedAt
      FROM ${schema.orderItems.table} oi
      INNER JOIN ${schema.orders.table} o ON o.${schema.orders.id} = oi.${schema.orderItems.orderId}
      LEFT JOIN ${schema.warranties.table} w ON ${schema.warranties.orderItemId ? `w.${schema.warranties.orderItemId} = oi.${schema.orderItems.id}` : `w.${schema.warranties.orderId} = o.${schema.orders.id}`}
      WHERE o.${schema.orders.userId} = ?
        ${statusCondition}
        AND w.${schema.warranties.id} IS NULL
      ORDER BY oi.${schema.orderItems.id} DESC
    `,
    [userId, ...canceledStatuses]
  );

  return rows.map((row) => ({
    id: row.id,
    orderId: row.orderId,
    skuId: row.skuId,
    sku: row.sku,
    productName: row.productName,
    unitPrice: formatMoney(row.unitPrice),
    quantity: Number(row.quantity || 0),
    lineTotal: formatMoney(row.lineTotal),
    orderedAt: row.orderedAt
  }));
}

async function getMyWarranties(userId, params = {}) {
  const schema = await getSchema();
  const keyword = String(params.keyword || "").trim();
  const clauses = [`w.${schema.warranties.userId} = ?`];
  const queryParams = [userId];

  if (keyword) {
    clauses.push(`(w.${schema.warranties.warrantyCode} LIKE CONCAT('%', ?, '%') OR oi.${schema.orderItems.productName} LIKE CONCAT('%', ?, '%') OR oi.${schema.orderItems.sku} LIKE CONCAT('%', ?, '%'))`);
    queryParams.push(keyword, keyword, keyword);
  }

  const rows = await query(
    `
      SELECT
        w.${schema.warranties.id} AS id,
        ${schema.warranties.orderId ? `w.${schema.warranties.orderId}` : `o.${schema.orders.id}`} AS orderId,
        ${schema.warranties.orderItemId ? `w.${schema.warranties.orderItemId}` : `oi.${schema.orderItems.id}`} AS orderItemId,
        ${schema.warranties.skuId ? `w.${schema.warranties.skuId}` : `oi.${schema.orderItems.variantId || schema.orderItems.id}`} AS skuId,
        w.${schema.warranties.warrantyCode} AS warrantyCode,
        ${schema.warranties.status ? `w.${schema.warranties.status}` : "'ACTIVE'"} AS status,
        ${schema.warranties.note ? `w.${schema.warranties.note}` : "NULL"} AS note,
        ${schema.warranties.activatedAt ? `w.${schema.warranties.activatedAt}` : "NULL"} AS activatedAt,
        ${schema.warranties.expiresAt ? `w.${schema.warranties.expiresAt}` : "NULL"} AS expiresAt,
        ${schema.warranties.createdAt ? `w.${schema.warranties.createdAt}` : "NULL"} AS createdAt,
        oi.${schema.orderItems.productName} AS productName,
        oi.${schema.orderItems.sku} AS sku,
        oi.${schema.orderItems.unitPrice} AS unitPrice,
        oi.${schema.orderItems.quantity} AS quantity
      FROM ${schema.warranties.table} w
      LEFT JOIN ${schema.orderItems.table} oi ON oi.${schema.orderItems.id} = w.${schema.warranties.orderItemId}
      LEFT JOIN ${schema.orders.table} o ON o.${schema.orders.id} = oi.${schema.orderItems.orderId}
      WHERE ${clauses.join(" AND ")}
      ORDER BY ${schema.warranties.createdAt ? `w.${schema.warranties.createdAt}` : `w.${schema.warranties.id}`} DESC
    `,
    queryParams
  );

  return rows.map(mapWarrantyRow);
}

async function activateWarranty(userId, payload = {}) {
  const schema = await getSchema();
  const orderItemId = toPositiveInteger(payload.orderItemId || payload.order_item_id, "orderItemId");
  const note = String(payload.note || "").trim() || null;
  const eligibleItems = await getEligibleOrderItems(userId);
  const targetItem = eligibleItems.find((item) => Number(item.id) === orderItemId);

  if (!targetItem) {
    throw createError("Order item is not eligible for warranty activation", 404);
  }

  const warrantyCode = generateWarrantyCode(orderItemId);
  const fields = [schema.warranties.userId, schema.warranties.warrantyCode];
  const values = ["?", "?"];
  const params = [userId, warrantyCode];

  if (schema.warranties.orderId) {
    fields.push(schema.warranties.orderId);
    values.push("?");
    params.push(targetItem.orderId);
  }

  if (schema.warranties.orderItemId) {
    fields.push(schema.warranties.orderItemId);
    values.push("?");
    params.push(orderItemId);
  }

  let finalSkuId = targetItem.skuId;
  if (!finalSkuId && targetItem.sku) {
    const skuRows = await query("SELECT id FROM product_skus WHERE sku = ? LIMIT 1", [targetItem.sku]);
    if (skuRows && skuRows[0]) {
      finalSkuId = skuRows[0].id;
    }
  }

  if (schema.warranties.skuId && finalSkuId) {
    fields.push(schema.warranties.skuId);
    values.push("?");
    params.push(finalSkuId);
  }

  if (schema.warranties.status) {
    fields.push(schema.warranties.status);
    values.push("?");
    params.push("ACTIVE");
  }

  if (schema.warranties.note) {
    fields.push(schema.warranties.note);
    values.push("?");
    params.push(note);
  }

  if (schema.warranties.activatedAt) {
    fields.push(schema.warranties.activatedAt);
    values.push("NOW()");
  }

  // Resolve warranty months from SKU / Product master data
  let warrantyMonths = 24;
  try {
    const masterRows = await query(
      `
        SELECT
          s.warranty_months AS skuWarrantyMonths,
          p.warranty_months AS productWarrantyMonths,
          c.name AS categoryName,
          p.name AS productName
        FROM order_items oi
        LEFT JOIN product_skus s ON s.id = oi.product_variant_id
        LEFT JOIN products p ON p.id = COALESCE(s.product_id, oi.product_id)
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE oi.id = ?
        LIMIT 1
      `,
      [orderItemId]
    );
    if (masterRows && masterRows[0]) {
      const { getWarrantyMonthsFromItem } = require("./warranty-sync.service");
      warrantyMonths = getWarrantyMonthsFromItem(masterRows[0]);
    }
  } catch (_e) {
    warrantyMonths = 24;
  }

  if (schema.warranties.expiresAt) {
    fields.push(schema.warranties.expiresAt);
    values.push(`DATE_ADD(NOW(), INTERVAL ${Number(warrantyMonths) || 24} MONTH)`);
  }

  if (schema.warranties.createdAt) {
    fields.push(schema.warranties.createdAt);
    values.push("NOW()");
  }

  const result = await query(
    `INSERT INTO ${schema.warranties.table} (${fields.join(", ")}) VALUES (${values.join(", ")})`,
    params
  );

  const warranties = await getMyWarranties(userId, { keyword: warrantyCode });
  const createdWarranty = warranties.find((item) => item.id === result.insertId) || warranties[0] || null;

  if (!createdWarranty) {
    throw createError("Warranty activated but could not be fetched", 500);
  }

  return createdWarranty;
}

module.exports = {
  getEligibleOrderItems,
  getMyWarranties,
  activateWarranty
};
