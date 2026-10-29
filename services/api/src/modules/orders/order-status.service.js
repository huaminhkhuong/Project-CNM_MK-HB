const { env } = require("../../config/env");
const { getDbPool, query } = require("../../config/database");
const { createError, toNonNegativeNumber, toPositiveInteger } = require("../../utils/service-helpers");
const { ROLES, hasAnyRole } = require("../../utils/role-helpers");
const { createWarrantyRecordsForDeliveredOrder } = require("../warranties/warranty-sync.service");
const { publishOrderEvent } = require("../../services/order-events");
const { recordAuditLog } = require("../../services/audit-log.service");
const { sendOrderStatusNotification } = require("../notifications/notifications.service");

const {
  ORDER_STATUSES,
  ORDER_STATUS_TRANSITIONS,
  toMoney,
  toActor,
  canManageOrders,
  normalizeOrderStatus,
  getSchemaConfig,
  getOrderRowById,
  getOrderRowByIdAny,
  getShipmentByOrderId,
  formatShipment
} = require("./orders.common");
const { restoreOrderInventory } = require("./order-inventory.service");
const { getOrderDetail } = require("./order-query.service");

async function updateOrderStatus(actor, orderId, statusOrPayload) {
  const parsedOrderId = toPositiveInteger(orderId, "orderId");
  const config = await getSchemaConfig();
  const payload = typeof statusOrPayload === "object" && statusOrPayload !== null
    ? statusOrPayload
    : { status: statusOrPayload };

  if (!canManageOrders(actor.role)) {
    throw createError("Forbidden: you do not have permission to manage orders", 403);
  }

  if (!config.orders.status) {
    throw createError("Orders table does not support status updates", 500);
  }

  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.execute(
      `
        SELECT
          o.${config.orders.id} AS id,
          o.${config.orders.status} AS status,
          o.${config.orders.userId} AS userId,
          ${config.orders.couponId ? `o.${config.orders.couponId}` : "NULL"} AS couponId,
          ${config.orders.paymentStatus ? `o.${config.orders.paymentStatus}` : "NULL"} AS paymentStatus
        FROM ${config.orders.table} o
        WHERE o.${config.orders.id} = ?
        FOR UPDATE
      `,
      [parsedOrderId]
    );

    const existingOrder = orderRows[0];
    if (!existingOrder) {
      throw createError("Order not found", 404);
    }

    const currentStatus = normalizeOrderStatus(existingOrder.status || "PENDING");
    const nextStatus = normalizeOrderStatus(payload.status);
    const allowedNextStatuses = ORDER_STATUS_TRANSITIONS[currentStatus] || [];

    if (currentStatus !== nextStatus && !allowedNextStatuses.includes(nextStatus)) {
      throw createError(`Cannot change order status from ${currentStatus} to ${nextStatus}`, 400);
    }

    const existingShipment = await getShipmentByOrderId(parsedOrderId);

    if (nextStatus === "SHIPPED") {
      if (!existingShipment || !String(existingShipment.trackingCode || "").trim()) {
        throw createError("Cannot mark order as SHIPPED without a shipment tracking code", 400);
      }

      // Check serial numbers assignment for PC hardware components
      try {
        const [itemsCount] = await connection.execute(
          `SELECT SUM(${config.orderItems.quantity}) AS totalRequired FROM ${config.orderItems.table} WHERE ${config.orderItems.orderId} = ?`,
          [parsedOrderId]
        );
        const [serialsCount] = await connection.execute(
          `SELECT COUNT(*) AS totalAssigned FROM order_item_serials WHERE order_id = ?`,
          [parsedOrderId]
        );
        const totalRequired = Number(itemsCount[0]?.totalRequired || 0);
        const totalAssigned = Number(serialsCount[0]?.totalAssigned || 0);

        if (totalRequired > 0 && totalAssigned < totalRequired) {
          throw createError(
            `Vui lòng gán đủ Serial Number cho tất cả linh kiện trước khi xuất kho / giao hàng (${totalAssigned}/${totalRequired} S/N đã gán).`,
            400
          );
        }
      } catch (err) {
        if (err.statusCode) throw err;
      }

      if (config.shipments.table && config.shipments.status) {
        await connection.execute(
          `
            UPDATE ${config.shipments.table}
            SET ${config.shipments.status} = ?
            WHERE ${config.shipments.orderId} = ?
          `,
          ["IN_TRANSIT", parsedOrderId]
        );
      }
    }

    if (nextStatus === "DELIVERED") {
      if (!existingShipment || !String(existingShipment.trackingCode || "").trim()) {
        throw createError("Cannot mark order as DELIVERED without a shipment tracking code", 400);
      }

      if (config.shipments.table && config.shipments.status) {
        await connection.execute(
          `
            UPDATE ${config.shipments.table}
            SET ${config.shipments.status} = ?
            WHERE ${config.shipments.orderId} = ?
          `,
          ["DELIVERED", parsedOrderId]
        );
      }
    }

    if (nextStatus === "CANCELED") {
      if (config.shipments.table && config.shipments.status) {
        await connection.execute(
          `
            UPDATE ${config.shipments.table}
            SET ${config.shipments.status} = ?
            WHERE ${config.shipments.orderId} = ?
          `,
          ["CANCELED", parsedOrderId]
        );
      }
    }

    const updateParts = [`${config.orders.status} = ?`];
    const params = [nextStatus];

    if (config.orders.note && payload.reason && nextStatus === "CANCELED") {
      updateParts.push(`${config.orders.note} = ?`);
      params.push(String(payload.reason).trim());
    }

    if (config.orders.updatedAt) {
      updateParts.push(`${config.orders.updatedAt} = NOW()`);
    }

    params.push(parsedOrderId);

    await connection.execute(
      `
        UPDATE ${config.orders.table}
        SET ${updateParts.join(", ")}
        WHERE ${config.orders.id} = ?
      `,
      params
    );

    // Atomically restore inventory when transitioning to CANCELED from an active status
    if (nextStatus === "CANCELED" && currentStatus !== "CANCELED") {
      await restoreOrderInventory(connection, config, parsedOrderId);

      // Restore coupon usage if order had a coupon
      if (config.orders.couponId && existingOrder.couponId) {
        await connection.execute(
          `
            UPDATE coupons
            SET used_count = GREATEST(0, used_count - 1)
            WHERE id = ?
          `,
          [existingOrder.couponId]
        ).catch(() => {});

        await connection.execute(
          `
            DELETE FROM coupon_usages
            WHERE order_id = ?
          `,
          [parsedOrderId]
        ).catch(() => {});
      }
    }

    await connection.commit();

    if (nextStatus === "COMPLETED" || nextStatus === "DELIVERED") {
      await createWarrantyRecordsForDeliveredOrder(parsedOrderId);
    }

    const updatedOrder = await getOrderDetail(actor, parsedOrderId);
    const targetUserId = updatedOrder?.userId || updatedOrder?.user_id || existingOrder.userId;
    publishOrderEvent(targetUserId, {
      orderId: parsedOrderId,
      status: nextStatus,
      paymentStatus: updatedOrder?.paymentStatus || updatedOrder?.payment_status || existingOrder.paymentStatus
    });

    if (targetUserId) {
      sendOrderStatusNotification({
        userId: targetUserId,
        orderId: parsedOrderId,
        status: nextStatus,
        carrier: updatedOrder?.shipment?.carrier || payload?.carrier,
        trackingCode: updatedOrder?.shipment?.trackingCode || payload?.trackingCode,
        reason: payload?.reason
      }).catch((err) => console.warn("[Notification] Order update notification failed:", err.message));
    }

    return updatedOrder;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function markOrderPaid(actor, orderId) {
  const parsedOrderId = toPositiveInteger(orderId, "orderId");
  const config = await getSchemaConfig();

  if (!canManageOrders(actor.role)) {
    throw createError("Forbidden: you do not have permission to manage orders", 403);
  }

  if (!config.orders.paymentStatus) {
    throw createError("Orders table does not support payment status updates", 500);
  }

  const existingOrder = await getOrderRowByIdAny(parsedOrderId);

  if (!existingOrder) {
    throw createError("Order not found", 404);
  }

  const updateParts = [`${config.orders.paymentStatus} = ?`];
  const params = ["PAID"];

  if (config.orders.updatedAt) {
    updateParts.push(`${config.orders.updatedAt} = NOW()`);
  }

  await query(
    `
      UPDATE ${config.orders.table}
      SET ${updateParts.join(", ")}
      WHERE ${config.orders.id} = ?
    `,
    [...params, parsedOrderId]
  );

  return getOrderDetail(actor, parsedOrderId);
}

async function createMockShipment(actor, orderId, payload = {}) {
  const parsedOrderId = toPositiveInteger(orderId, "orderId");
  const config = await getSchemaConfig();

  if (!canManageOrders(actor.role)) {
    throw createError("Forbidden: you do not have permission to manage shipments", 403);
  }

  if (!config.shipments.table || !config.shipments.id || !config.shipments.orderId) {
    throw createError("Shipments table is not configured. Please add shipments(id, order_id, status, tracking_code)", 500);
  }

  const existingOrder = await getOrderRowByIdAny(parsedOrderId);

  if (!existingOrder) {
    throw createError("Order not found", 404);
  }

  const providedTrackingCode = String(payload.trackingCode || "").trim();
  const canGenerateMockTracking = env.shippingMockMode || env.nodeEnv !== "production";

  if (!providedTrackingCode && !canGenerateMockTracking) {
    throw createError("Tracking code is required when shipping mock mode is disabled", 503);
  }

  const trackingCode = providedTrackingCode || `MOCK-${parsedOrderId}-${Date.now()}`;
  const shipmentStatus = String(payload.status || "CREATED").trim().toUpperCase() || "CREATED";
  const existingShipment = await getShipmentByOrderId(parsedOrderId);

  if (existingShipment) {
    const updateParts = [];
    const updateParams = [];

    if (config.shipments.status) {
      updateParts.push(`${config.shipments.status} = ?`);
      updateParams.push(shipmentStatus);
    }

    if (config.shipments.trackingCode) {
      updateParts.push(`${config.shipments.trackingCode} = ?`);
      updateParams.push(trackingCode);
    }

    if (config.shipments.updatedAt) {
      updateParts.push(`${config.shipments.updatedAt} = NOW()`);
    }

    if (updateParts.length === 0) {
      throw createError("Shipments table does not support mock shipment updates", 500);
    }

    await query(
      `
        UPDATE ${config.shipments.table}
        SET ${updateParts.join(", ")}
        WHERE ${config.shipments.orderId} = ?
      `,
      [...updateParams, parsedOrderId]
    );
  } else {
    const fields = [config.shipments.orderId];
    const values = ["?"];
    const params = [parsedOrderId];

    if (config.shipments.status) {
      fields.push(config.shipments.status);
      values.push("?");
      params.push(shipmentStatus);
    }

    if (config.shipments.trackingCode) {
      fields.push(config.shipments.trackingCode);
      values.push("?");
      params.push(trackingCode);
    }

    if (config.shipments.updatedAt) {
      fields.push(config.shipments.updatedAt);
      values.push("NOW()");
    }

    await query(
      `INSERT INTO ${config.shipments.table} (${fields.join(", ")}) VALUES (${values.join(", ")})`,
      params
    );
  }

  return getOrderDetail(actor, parsedOrderId);
}

async function updateConsultationNote(actor, orderId, note) {
  const parsedOrderId = toPositiveInteger(orderId, "orderId");
  const config = await getSchemaConfig();

  if (!canManageOrders(actor.role)) {
    throw createError("Forbidden: you do not have permission to update consultation notes", 403);
  }

  if (!config.orders.note) {
    throw createError("Orders table does not support notes", 500);
  }

  const existingOrder = await getOrderRowByIdAny(parsedOrderId);

  if (!existingOrder) {
    throw createError("Order not found", 404);
  }

  const nextNote = String(note || "").trim();

  const updateParts = [`${config.orders.note} = ?`];
  const updateParams = [nextNote];

  if (config.orders.updatedAt) {
    updateParts.push(`${config.orders.updatedAt} = NOW()`);
  }

  await query(
    `
      UPDATE ${config.orders.table}
      SET ${updateParts.join(", ")}
      WHERE ${config.orders.id} = ?
    `,
    [...updateParams, parsedOrderId]
  );

  return getOrderDetail(actor, parsedOrderId);
}

async function uploadPaymentProof(userId, orderId, file) {
  const parsedOrderId = toPositiveInteger(orderId, "orderId");
  const config = await getSchemaConfig();

  const existingOrder = await getOrderRowByIdAny(parsedOrderId);

  if (!existingOrder) {
    throw createError("Order not found", 404);
  }

  if (existingOrder[config.orders.userId] !== userId) {
    throw createError("You can only upload payment proof for your own orders", 403);
  }

  if (existingOrder[config.orders.paymentMethod] !== "BANK_TRANSFER") {
    throw createError("Payment proof upload is only available for bank transfer orders", 400);
  }

  // Save the file and get the public URL
  const paymentProofUrl = file ? `/uploads/payment-proofs/${file.filename}` : null;

  // Update order with payment proof URL
  const updateParts = [`${config.orders.paymentStatus} = ?`];
  const updateParams = ["PENDING_VERIFICATION"];

  if (paymentProofUrl) {
    // Add payment_proof column if it exists
    const paymentProofColumn = pickColumn(config.orders.columns, ["payment_proof", "paymentProof"], null);
    if (paymentProofColumn) {
      updateParts.push(`${paymentProofColumn} = ?`);
      updateParams.push(paymentProofUrl);
    }
  }

  if (config.orders.updatedAt) {
    updateParts.push(`${config.orders.updatedAt} = NOW()`);
  }

  await query(
    `
      UPDATE ${config.orders.table}
      SET ${updateParts.join(", ")}
      WHERE ${config.orders.id} = ?
    `,
    [...updateParams, parsedOrderId]
  );

  return {
    orderId: parsedOrderId,
    paymentProof: paymentProofUrl,
    paymentStatus: "PENDING_VERIFICATION"
  };
}

async function approvePaymentProof(actor, orderId, body) {
  const parsedOrderId = toPositiveInteger(orderId, "orderId");
  const config = await getSchemaConfig();

  if (!canManageOrders(actor.role)) {
    throw createError("Forbidden: you do not have permission to approve payments", 403);
  }

  const existingOrder = await getOrderRowByIdAny(parsedOrderId);

  if (!existingOrder) {
    throw createError("Order not found", 404);
  }

  const { approved, rejectionReason } = body || {};
  const isApproved = Boolean(approved);

  // Update payment status
  const updateParts = [`${config.orders.paymentStatus} = ?`];
  const updateParams = [isApproved ? "PAID" : "REJECTED"];

  if (config.orders.updatedAt) {
    updateParts.push(`${config.orders.updatedAt} = NOW()`);
  }

  // If approved and order is still PENDING, move to PROCESSING
  if (isApproved && existingOrder[config.orders.status] === "PENDING") {
    updateParts.push(`${config.orders.status} = ?`);
    updateParams.push("PROCESSING");
  }

  await query(
    `
      UPDATE ${config.orders.table}
      SET ${updateParts.join(", ")}
      WHERE ${config.orders.id} = ?
    `,
    [...updateParams, parsedOrderId]
  );

  return getOrderDetail(actor, parsedOrderId);
}


module.exports = {
  updateOrderStatus,
  markOrderPaid,
  createMockShipment,
  updateConsultationNote,
  uploadPaymentProof,
  approvePaymentProof
};
