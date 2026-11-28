const { query } = require("../../config/database");
const { createError, toPositiveInteger } = require("../../utils/service-helpers");
const { getTableColumns, pickColumn } = require("../../utils/schema-helpers");
const { ROLES, hasAnyRole, normalizeRole } = require("../../utils/role-helpers");
const ordersService = require("../orders/orders.service");
const { createWarrantyRecordsForDeliveredOrder } = require("../warranties/warranty-sync.service");
const mockProvider = require("./providers/mock-shipping.provider");

let schemaCache = null;

const SHIPMENT_STATUSES = ["CREATED", "READY_TO_SHIP", "IN_TRANSIT", "DELIVERED", "FAILED", "RETURNED", "CANCELED"];

function canManageShipments(role) {
  return hasAnyRole(role, [ROLES.ADMIN, ROLES.SALES_STAFF]);
}

function toActor(userOrUserId) {
  if (typeof userOrUserId === "object" && userOrUserId !== null) {
    return {
      userId: userOrUserId.id,
      role: normalizeRole(userOrUserId.role)
    };
  }

  return {
    userId: userOrUserId,
    role: ROLES.CUSTOMER
  };
}

function normalizeShipmentStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();

  if (!SHIPMENT_STATUSES.includes(normalized)) {
    throw createError(`Shipment status must be one of: ${SHIPMENT_STATUSES.join(", ")}`, 400);
  }

  return normalized;
}

async function getSchema() {
  if (schemaCache) {
    return schemaCache;
  }

  const [shipmentColumns, shipmentLogColumns, orderColumns] = await Promise.all([
    getTableColumns("shipments").catch(() => []),
    getTableColumns("shipment_logs").catch(() => []),
    getTableColumns("orders")
  ]);

  if (shipmentColumns.length === 0) {
    throw createError("Shipments table is not available. Please import phase7_shipments_migration.sql", 500);
  }

  const schema = {
    shipments: {
      table: "shipments",
      id: pickColumn(shipmentColumns, ["id"]),
      orderId: pickColumn(shipmentColumns, ["order_id"]),
      status: pickColumn(shipmentColumns, ["status"], null),
      trackingCode: pickColumn(shipmentColumns, ["tracking_code"], null),
      createdAt: pickColumn(shipmentColumns, ["created_at"], null),
      updatedAt: pickColumn(shipmentColumns, ["updated_at"], null)
    },
    shipmentLogs: {
      table: shipmentLogColumns.length > 0 ? "shipment_logs" : null,
      id: pickColumn(shipmentLogColumns, ["id"], null),
      shipmentId: pickColumn(shipmentLogColumns, ["shipment_id"], null),
      status: pickColumn(shipmentLogColumns, ["status"], null),
      note: pickColumn(shipmentLogColumns, ["note"], null),
      createdAt: pickColumn(shipmentLogColumns, ["created_at"], null)
    },
    orders: {
      table: "orders",
      id: pickColumn(orderColumns, ["id"]),
      userId: pickColumn(orderColumns, ["user_id"]),
      status: pickColumn(orderColumns, ["status"], null),
      updatedAt: pickColumn(orderColumns, ["updated_at"], null)
    }
  };

  if (!schema.shipments.id || !schema.shipments.orderId) {
    throw createError("Shipments table does not have required columns", 500);
  }

  if (!schema.orders.id || !schema.orders.userId) {
    throw createError("Orders table does not have required columns", 500);
  }

  schemaCache = schema;
  return schema;
}

function mapShipment(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    orderId: row.orderId,
    status: row.status || "CREATED",
    trackingCode: row.trackingCode,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null
  };
}

async function getOrderRow(orderId) {
  const schema = await getSchema();
  const rows = await query(
    `
      SELECT
        o.${schema.orders.id} AS id,
        o.${schema.orders.userId} AS userId,
        ${schema.orders.status ? `o.${schema.orders.status}` : "NULL"} AS status
      FROM ${schema.orders.table} o
      WHERE o.${schema.orders.id} = ?
      LIMIT 1
    `,
    [orderId]
  );

  return rows[0] || null;
}

async function getShipmentRowById(shipmentId) {
  const schema = await getSchema();
  const rows = await query(
    `
      SELECT
        s.${schema.shipments.id} AS id,
        s.${schema.shipments.orderId} AS orderId,
        ${schema.shipments.status ? `s.${schema.shipments.status}` : "NULL"} AS status,
        ${schema.shipments.trackingCode ? `s.${schema.shipments.trackingCode}` : "NULL"} AS trackingCode,
        ${schema.shipments.createdAt ? `s.${schema.shipments.createdAt}` : "NULL"} AS createdAt,
        ${schema.shipments.updatedAt ? `s.${schema.shipments.updatedAt}` : "NULL"} AS updatedAt
      FROM ${schema.shipments.table} s
      WHERE s.${schema.shipments.id} = ?
      LIMIT 1
    `,
    [shipmentId]
  );

  return rows[0] || null;
}

async function getShipmentRowByOrderId(orderId) {
  const schema = await getSchema();
  const rows = await query(
    `
      SELECT
        s.${schema.shipments.id} AS id,
        s.${schema.shipments.orderId} AS orderId,
        ${schema.shipments.status ? `s.${schema.shipments.status}` : "NULL"} AS status,
        ${schema.shipments.trackingCode ? `s.${schema.shipments.trackingCode}` : "NULL"} AS trackingCode,
        ${schema.shipments.createdAt ? `s.${schema.shipments.createdAt}` : "NULL"} AS createdAt,
        ${schema.shipments.updatedAt ? `s.${schema.shipments.updatedAt}` : "NULL"} AS updatedAt
      FROM ${schema.shipments.table} s
      WHERE s.${schema.shipments.orderId} = ?
      LIMIT 1
    `,
    [orderId]
  );

  return rows[0] || null;
}

async function appendShipmentLog(shipmentId, status, note) {
  const schema = await getSchema();

  if (!schema.shipmentLogs.table || !schema.shipmentLogs.shipmentId || !schema.shipmentLogs.status) {
    return;
  }

  const fields = [schema.shipmentLogs.shipmentId, schema.shipmentLogs.status];
  const values = ["?", "?"];
  const params = [shipmentId, status];

  if (schema.shipmentLogs.note) {
    fields.push(schema.shipmentLogs.note);
    values.push("?");
    params.push(note || null);
  }

  if (schema.shipmentLogs.createdAt) {
    fields.push(schema.shipmentLogs.createdAt);
    values.push("NOW()");
  }

  await query(
    `INSERT INTO ${schema.shipmentLogs.table} (${fields.join(", ")}) VALUES (${values.join(", ")})`,
    params
  );
}

async function syncOrderStatusForShipment(orderId, shipmentStatus) {
  const schema = await getSchema();

  if (!schema.orders.status) {
    return;
  }

  let nextOrderStatus = null;

  if (["CREATED", "READY_TO_SHIP", "IN_TRANSIT"].includes(shipmentStatus)) {
    nextOrderStatus = "SHIPPED";
  } else if (shipmentStatus === "DELIVERED") {
    nextOrderStatus = "DELIVERED";
  }

  if (!nextOrderStatus) {
    return;
  }

  const updates = [`${schema.orders.status} = ?`];
  const params = [nextOrderStatus];

  if (schema.orders.updatedAt) {
    updates.push(`${schema.orders.updatedAt} = NOW()`);
  }

  params.push(orderId);
  await query(`UPDATE ${schema.orders.table} SET ${updates.join(", ")} WHERE ${schema.orders.id} = ?`, params);

  if (nextOrderStatus === "DELIVERED") {
    await createWarrantyRecordsForDeliveredOrder(orderId);
  }
}

async function getShipmentByOrder(userOrUserId, orderId) {
  const actor = toActor(userOrUserId);
  const parsedOrderId = toPositiveInteger(orderId, "orderId");
  const order = await getOrderRow(parsedOrderId);

  if (!order) {
    throw createError("Order not found", 404);
  }

  if (!canManageShipments(actor.role) && Number(order.userId) !== Number(actor.userId)) {
    throw createError("Forbidden: you do not have permission to view this shipment", 403);
  }

  const shipment = await getShipmentRowByOrderId(parsedOrderId);

  if (!shipment) {
    throw createError("Shipment not found", 404);
  }

  return mapShipment(shipment);
}

async function assertFullSerialsAssigned(orderId) {
  const [itemsRows, serialsRows] = await Promise.all([
    query(`SELECT COALESCE(SUM(quantity), 0) AS totalRequired FROM order_items WHERE order_id = ?`, [orderId]),
    query(`SELECT COUNT(*) AS totalAssigned FROM order_item_serials WHERE order_id = ?`, [orderId])
  ]);
  const totalRequired = Number(itemsRows[0]?.totalRequired || 0);
  const totalAssigned = Number(serialsRows[0]?.totalAssigned || 0);
  if (totalRequired > 0 && totalAssigned < totalRequired) {
    throw createError(
      `Vui lòng gán đủ Serial Number cho tất cả linh kiện trước khi xuất kho / giao hàng (${totalAssigned}/${totalRequired} S/N đã gán).`,
      400
    );
  }
}

async function createShipment(actorUser, payload = {}) {
  const actor = toActor(actorUser);

  if (!canManageShipments(actor.role)) {
    throw createError("Forbidden: you do not have permission to create shipments", 403);
  }

  const schema = await getSchema();
  const orderId = toPositiveInteger(payload.orderId || payload.order_id, "orderId");
  const order = await getOrderRow(orderId);

  if (!order) {
    throw createError("Order not found", 404);
  }

  const nextPayload = mockProvider.createShipmentPayload(orderId, payload);
  const shipmentStatus = normalizeShipmentStatus(nextPayload.status);
  if (["IN_TRANSIT", "DELIVERED"].includes(shipmentStatus)) {
    await assertFullSerialsAssigned(orderId);
  }
  const existingShipment = await getShipmentRowByOrderId(orderId);

  if (existingShipment) {
    return updateShipmentStatus(actorUser, existingShipment.id, {
      status: shipmentStatus,
      trackingCode: nextPayload.trackingCode,
      note: payload.note || "Shipment updated via mock provider"
    });
  }

  const fields = [schema.shipments.orderId];
  const values = ["?"];
  const params = [orderId];

  if (schema.shipments.status) {
    fields.push(schema.shipments.status);
    values.push("?");
    params.push(shipmentStatus);
  }

  if (schema.shipments.trackingCode) {
    fields.push(schema.shipments.trackingCode);
    values.push("?");
    params.push(nextPayload.trackingCode);
  }

  if (schema.shipments.createdAt) {
    fields.push(schema.shipments.createdAt);
    values.push("NOW()");
  }

  if (schema.shipments.updatedAt) {
    fields.push(schema.shipments.updatedAt);
    values.push("NOW()");
  }

  const result = await query(
    `INSERT INTO ${schema.shipments.table} (${fields.join(", ")}) VALUES (${values.join(", ")})`,
    params
  );

  await appendShipmentLog(result.insertId, shipmentStatus, payload.note || "Shipment created via mock provider");
  await syncOrderStatusForShipment(orderId, shipmentStatus);

  const createdShipment = await getShipmentRowById(result.insertId);
  return mapShipment(createdShipment);
}

async function updateShipmentStatus(actorUser, shipmentId, payload = {}) {
  const actor = toActor(actorUser);

  if (!canManageShipments(actor.role)) {
    throw createError("Forbidden: you do not have permission to update shipments", 403);
  }

  const schema = await getSchema();
  const parsedShipmentId = toPositiveInteger(shipmentId, "shipmentId");
  const shipment = await getShipmentRowById(parsedShipmentId);

  if (!shipment) {
    throw createError("Shipment not found", 404);
  }

  const nextStatus = normalizeShipmentStatus(payload.status || shipment.status || "CREATED");
  if (["IN_TRANSIT", "DELIVERED"].includes(nextStatus)) {
    await assertFullSerialsAssigned(shipment.orderId);
  }
  const nextTrackingCode = String(payload.trackingCode || shipment.trackingCode || "").trim() || null;
  const updates = [];
  const params = [];

  if (schema.shipments.status) {
    updates.push(`${schema.shipments.status} = ?`);
    params.push(nextStatus);
  }

  if (schema.shipments.trackingCode) {
    updates.push(`${schema.shipments.trackingCode} = ?`);
    params.push(nextTrackingCode);
  }

  if (schema.shipments.updatedAt) {
    updates.push(`${schema.shipments.updatedAt} = NOW()`);
  }

  params.push(parsedShipmentId);
  await query(`UPDATE ${schema.shipments.table} SET ${updates.join(", ")} WHERE ${schema.shipments.id} = ?`, params);

  await appendShipmentLog(parsedShipmentId, nextStatus, payload.note || "Shipment status updated");
  await syncOrderStatusForShipment(shipment.orderId, nextStatus);

  const updatedShipment = await getShipmentRowById(parsedShipmentId);
  return mapShipment(updatedShipment);
}

async function getOrderDetailWithShipment(actorUser, orderId) {
  return ordersService.getOrderDetail(actorUser, orderId);
}

module.exports = {
  getShipmentByOrder,
  createShipment,
  updateShipmentStatus,
  getOrderDetailWithShipment,
  SHIPMENT_STATUSES
};
