const { getDbPool, query } = require("../../config/database");
const { createError, toPositiveInteger } = require("../../utils/service-helpers");
const { ROLES, hasAnyRole } = require("../../utils/role-helpers");

const {
  ORDER_STATUSES,
  STAFF_VISIBLE_STATUSES,
  toActor,
  canManageOrders,
  repairLegacyPaidOrdersForStaff,
  getSchemaConfig,
  baseOrderSelect,
  getOrderRowById,
  getOrderRowByIdAny,
  getShipmentByOrderId,
  getCustomerByUserId,
  getOrderItemsByOrderId,
  formatOrderSummary,
  formatShipment
} = require("./orders.common");

async function getMyOrders(userId) {
  const config = await getSchemaConfig();
  const rows = await query(
    `${baseOrderSelect(config)}
      WHERE o.${config.orders.userId} = ?
      ORDER BY ${config.orders.createdAt ? `o.${config.orders.createdAt}` : `o.${config.orders.id}`} DESC`,
    [userId]
  );

  const orders = [];
  for (const row of rows) {
    const [shipment, customer] = await Promise.all([
      getShipmentByOrderId(row.id),
      getCustomerByUserId(row.userId)
    ]);
    orders.push({
      ...formatOrderSummary(row),
      shipment: formatShipment(shipment),
      customer
    });
  }

  return orders;
}

async function getAllOrders() {
  const config = await getSchemaConfig();
  const rows = await query(
    `${baseOrderSelect(config)}
      ORDER BY ${config.orders.createdAt ? `o.${config.orders.createdAt}` : `o.${config.orders.id}`} DESC`
  );

  const orders = [];
  for (const row of rows) {
    const [shipment, customer] = await Promise.all([
      getShipmentByOrderId(row.id),
      getCustomerByUserId(row.userId)
    ]);
    orders.push({
      ...formatOrderSummary(row),
      shipment: formatShipment(shipment),
      customer
    });
  }

  return orders;
}

async function getProcessingOrders(params = {}) {
  const config = await getSchemaConfig();
  await repairLegacyPaidOrdersForStaff(config);
  const status = params.status ? normalizeOrderStatus(params.status) : null;
  const whereClauses = [];
  const queryParams = [];

  if (config.orders.status) {
    if (status) {
      whereClauses.push(`o.${config.orders.status} = ?`);
      queryParams.push(status);
    } else {
      whereClauses.push(`o.${config.orders.status} IN (${STAFF_VISIBLE_STATUSES.map(() => "?").join(", ")})`);
      queryParams.push(...STAFF_VISIBLE_STATUSES);
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const rows = await query(
    `${baseOrderSelect(config)}
      ${whereSql}
      ORDER BY ${config.orders.createdAt ? `o.${config.orders.createdAt}` : `o.${config.orders.id}`} DESC`,
    queryParams
  );

  const orders = [];
  for (const row of rows) {
    const [shipment, customer] = await Promise.all([
      getShipmentByOrderId(row.id),
      getCustomerByUserId(row.userId)
    ]);
    orders.push({
      ...formatOrderSummary(row),
      shipment: formatShipment(shipment),
      customer
    });
  }

  return orders;
}

async function getOrderDetail(userOrUserId, orderId) {
  const parsedOrderId = toPositiveInteger(orderId, "orderId");
  const actor = toActor(userOrUserId);
  const orderRow = canManageOrders(actor.role)
    ? await getOrderRowByIdAny(parsedOrderId)
    : await getOrderRowById(actor.userId, parsedOrderId);

  if (!orderRow) {
    throw createError("Order not found", 404);
  }

  const [items, shipment] = await Promise.all([
    getOrderItemsByOrderId(parsedOrderId),
    getShipmentByOrderId(parsedOrderId)
  ]);
  const customer = await getCustomerByUserId(orderRow.userId);

  return {
    ...formatOrderSummary(orderRow),
    items,
    shipment: formatShipment(shipment),
    customer
  };
}


module.exports = {
  getMyOrders,
  getAllOrders,
  getProcessingOrders,
  getOrderDetail
};
