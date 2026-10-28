const { getDbPool, query } = require("../../config/database");
const { createError, toPositiveInteger } = require("../../utils/service-helpers");
const { ROLES } = require("../../utils/role-helpers");
const { env } = require("../../config/env");
const { publishOrderEvent } = require("../../services/order-events");
const { recordAuditLog } = require("../../services/audit-log.service");
const { sendOrderStatusNotification } = require("../notifications/notifications.service");

const {
  toMoney,
  getSchemaConfig
} = require("./orders.common");
const { restoreOrderInventory } = require("./order-inventory.service");
const { getOrderDetail } = require("./order-query.service");

async function cancelOrder(userId, orderId, payloadOrReason) {
  const parsedOrderId = toPositiveInteger(orderId, "orderId");
  const config = await getSchemaConfig();

  if (!config.orders.status) {
    throw createError("Orders table does not support status updates", 500);
  }

  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `
        SELECT
          o.${config.orders.id} AS id,
          o.${config.orders.status} AS status,
          o.${config.orders.userId} AS userId,
          ${config.orders.couponId ? `o.${config.orders.couponId}` : "NULL"} AS couponId,
          ${config.orders.paymentStatus ? `o.${config.orders.paymentStatus}` : "NULL"} AS paymentStatus
        FROM ${config.orders.table} o
        WHERE o.${config.orders.id} = ?
          AND o.${config.orders.userId} = ?
        FOR UPDATE
      `,
      [parsedOrderId, userId]
    );

    const existingOrder = rows[0];
    if (!existingOrder) {
      throw createError("Order not found", 404);
    }

    if (String(existingOrder.status || "").toUpperCase() !== "PENDING") {
      throw createError("Only pending orders can be canceled", 400);
    }

    const updateParts = [`${config.orders.status} = ?`];
    const params = ["CANCELED"];

    if (config.orders.updatedAt) {
      updateParts.push(`${config.orders.updatedAt} = NOW()`);
    }

    params.push(parsedOrderId, userId);

    const [updateResult] = await connection.execute(
      `
        UPDATE ${config.orders.table}
        SET ${updateParts.join(", ")}
        WHERE ${config.orders.id} = ?
          AND ${config.orders.userId} = ?
          AND ${config.orders.status} = 'PENDING'
      `,
      params
    );

    if (updateResult.affectedRows === 0) {
      throw createError("Order was already updated or canceled", 409);
    }

    // Atomic inventory restoration inside transaction
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

    // Cancel shipment if exists
    if (config.shipments?.table && config.shipments?.status && config.shipments?.orderId) {
      await connection.execute(
        `
          UPDATE ${config.shipments.table}
          SET ${config.shipments.status} = 'CANCELED'
          WHERE ${config.shipments.orderId} = ?
        `,
        [parsedOrderId]
      );
    }

    await connection.commit();

    const updatedOrder = await getOrderDetail({ id: userId, role: ROLES.CUSTOMER }, parsedOrderId);
    publishOrderEvent(userId, {
      orderId: parsedOrderId,
      status: "CANCELED",
      paymentStatus: updatedOrder?.paymentStatus || updatedOrder?.payment_status || existingOrder.paymentStatus
    });

    const cancelReason = (typeof payloadOrReason === "object" ? payloadOrReason?.reason : payloadOrReason) || "Khách hàng tự hủy đơn hàng";

    sendOrderStatusNotification({
      userId,
      orderId: parsedOrderId,
      status: "CANCELED",
      reason: cancelReason
    }).catch((err) => console.warn("[Notification] Order cancel notification failed:", err.message));

    return updatedOrder;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}


async function cancelExpiredPendingOrders(options = {}) {
  const timeoutMinutes = Number(options.timeoutMinutes || env.paymentTimeoutMinutes || process.env.PAYMENT_TIMEOUT_MINUTES || 30);
  const safeMinutes = Math.max(1, Math.min(Number(timeoutMinutes) || 30, 10080));
  const batchLimit = Math.max(1, Math.min(Number(options.batchLimit || 50), 200));
  const config = await getSchemaConfig();

  if (!config.orders.status || !config.orders.createdAt) {
    return { success: true, expiredCount: 0, orderIds: [], timeoutMinutes: safeMinutes };
  }

  const pool = getDbPool();

  // 1. Identify orders in PENDING status with gateway payment that exceeded timeout
  const candidateRows = await query(
    `
      SELECT
        o.${config.orders.id} AS id,
        o.${config.orders.userId} AS userId,
        o.${config.orders.status} AS status,
        ${config.orders.couponId ? `o.${config.orders.couponId}` : "NULL"} AS couponId,
        ${config.orders.paymentStatus ? `o.${config.orders.paymentStatus}` : "'PENDING_GATEWAY'"} AS paymentStatus,
        ${config.orders.paymentMethod ? `o.${config.orders.paymentMethod}` : "NULL"} AS paymentMethod,
        ${config.orders.note ? `o.${config.orders.note}` : "NULL"} AS note,
        o.${config.orders.createdAt} AS createdAt
      FROM ${config.orders.table} o
      WHERE o.${config.orders.status} = 'PENDING'
        AND ${config.orders.paymentStatus ? `(o.${config.orders.paymentStatus} IN ('PENDING_GATEWAY', 'PAYMENT_CANCELLED') OR (o.${config.orders.paymentStatus} = 'UNPAID' AND ${config.orders.paymentMethod ? `UPPER(COALESCE(o.${config.orders.paymentMethod}, '')) NOT IN ('COD')` : "1=1"}))` : "1=1"}
        AND o.${config.orders.createdAt} <= (NOW() - INTERVAL ${safeMinutes} MINUTE)
      ORDER BY o.${config.orders.id} ASC
      LIMIT ${batchLimit}
    `
  );

  if (!candidateRows || candidateRows.length === 0) {
    return { success: true, expiredCount: 0, orderIds: [], timeoutMinutes: safeMinutes };
  }

  const expiredOrderIds = [];

  for (const candidate of candidateRows) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Row-level lock to prevent race conditions with incoming payment IPN/webhooks
      const [lockedRows] = await connection.execute(
        `
          SELECT
            o.${config.orders.id} AS id,
            o.${config.orders.status} AS status,
            o.${config.orders.userId} AS userId,
            ${config.orders.paymentStatus ? `o.${config.orders.paymentStatus}` : "NULL"} AS paymentStatus,
            ${config.orders.note ? `o.${config.orders.note}` : "NULL"} AS note
          FROM ${config.orders.table} o
          WHERE o.${config.orders.id} = ?
          FOR UPDATE
        `,
        [candidate.id]
      );

      const currentOrder = lockedRows[0];
      if (!currentOrder) {
        await connection.rollback();
        continue;
      }

      // Check if order is still PENDING and unpaid
      const isPending = String(currentOrder.status || "").toUpperCase() === "PENDING";
      const currentPaymentStatus = String(currentOrder.paymentStatus || "").toUpperCase();
      const candidateMethod = String(candidate.paymentMethod || "").toUpperCase();
      const isGatewayPending = !config.orders.paymentStatus ||
        ["PENDING_GATEWAY", "PAYMENT_CANCELLED"].includes(currentPaymentStatus) ||
        (currentPaymentStatus === "UNPAID" && candidateMethod !== "COD");

      if (!isPending || !isGatewayPending) {
        // Order was paid or updated concurrently, skip rollback
        await connection.rollback();
        continue;
      }

      // Atomically restore product SKU stock in product_skus
      await restoreOrderInventory(connection, config, candidate.id);

      // Restore coupon usage if order had a coupon
      if (config.orders.couponId && candidate.couponId) {
        await connection.execute(
          `
            UPDATE coupons
            SET used_count = GREATEST(0, used_count - 1)
            WHERE id = ?
          `,
          [candidate.couponId]
        ).catch(() => {});

        await connection.execute(
          `
            DELETE FROM coupon_usages
            WHERE order_id = ?
          `,
          [candidate.id]
        ).catch(() => {});
      }

      // Update order status to CANCELED and payment_status to EXPIRED
      const timeoutNote = `[Hệ thống tự động hủy: Quá hạn thanh toán ${safeMinutes} phút, tồn kho đã được hoàn trả]`;
      const combinedNote = currentOrder.note ? `${currentOrder.note} ${timeoutNote}` : timeoutNote;

      const orderUpdateParts = [
        `${config.orders.status} = 'CANCELED'`
      ];
      const orderUpdateParams = [];

      if (config.orders.paymentStatus) {
        orderUpdateParts.push(`${config.orders.paymentStatus} = 'EXPIRED'`);
      }

      if (config.orders.note) {
        orderUpdateParts.push(`${config.orders.note} = ?`);
        orderUpdateParams.push(combinedNote);
      }

      if (config.orders.updatedAt) {
        orderUpdateParts.push(`${config.orders.updatedAt} = NOW()`);
      }

      orderUpdateParams.push(candidate.id);

      await connection.execute(
        `
          UPDATE ${config.orders.table}
          SET ${orderUpdateParts.join(", ")}
          WHERE ${config.orders.id} = ?
        `,
        orderUpdateParams
      );

      // Cancel shipment if exists
      if (config.shipments?.table && config.shipments?.status && config.shipments?.orderId) {
        await connection.execute(
          `
            UPDATE ${config.shipments.table}
            SET ${config.shipments.status} = 'CANCELED'
            WHERE ${config.shipments.orderId} = ?
          `,
          [candidate.id]
        );
      }

      // Cancel corresponding gateway payment record in payments table
      try {
        const paymentCols = await getTableColumns("payments").catch(() => []);
        if (paymentCols.length > 0) {
          await connection.execute(
            `
              UPDATE payments
              SET status = 'CANCELED',
                  note = CONCAT(COALESCE(note, ''), ' [Hết hạn thời gian thanh toán]')
              WHERE order_id = ?
                AND status = 'PENDING_GATEWAY'
            `,
            [candidate.id]
          );
        }
      } catch (_pErr) {
        // payments table might not exist in all environments
      }

      await connection.commit();

      expiredOrderIds.push(candidate.id);

      // Record audit log
      recordAuditLog({
        actorRole: "SYSTEM",
        action: "ORDER_PAYMENT_TIMEOUT",
        entityType: "ORDER",
        entityId: candidate.id,
        description: `Đơn hàng #${candidate.id} tự động hủy do quá hạn thanh toán (${safeMinutes} phút). Đã hoàn trả tồn kho vào product_skus.`,
        metadata: {
          orderId: candidate.id,
          userId: candidate.userId,
          timeoutMinutes: safeMinutes,
          previousPaymentStatus: candidate.paymentStatus
        }
      }).catch(() => {});

      // Realtime event to notify client if browser/app is connected
      publishOrderEvent(candidate.userId, {
        orderId: candidate.id,
        status: "CANCELED",
        paymentStatus: "EXPIRED"
      });

    } catch (err) {
      await connection.rollback();
      console.error(`[PaymentTimeout] Failed to expire order #${candidate.id}:`, err?.message || err);
    } finally {
      connection.release();
    }
  }

  return {
    success: true,
    expiredCount: expiredOrderIds.length,
    orderIds: expiredOrderIds,
    timeoutMinutes: safeMinutes
  };
}

module.exports = {
  cancelOrder,
  cancelExpiredPendingOrders
};
