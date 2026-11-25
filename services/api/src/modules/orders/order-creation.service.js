const { getDbPool, query } = require("../../config/database");
const { prisma } = require("../../config/prisma");
const { createError, toNonNegativeNumber, toPositiveInteger } = require("../../utils/service-helpers");
const { buildActiveCondition, getTableColumns, pickColumn } = require("../../utils/schema-helpers");
const { ROLES, hasAnyRole, normalizeRole } = require("../../utils/role-helpers");
const { env } = require("../../config/env");
const { publishOrderEvent } = require("../../services/order-events");
const { recordAuditLog } = require("../../services/audit-log.service");
const { sendOrderStatusNotification } = require("../notifications/notifications.service");

const {
  toMoney,
  getSchemaConfig,
  buildAddressText,
  getCartByUserId,
  getAddressById,
  getCartItemsForCheckout,
  buildOrderInsertData,
  buildOrderItemInsertData
} = require("./orders.common");
const { getOrderDetail } = require("./order-query.service");

async function createOrderFromCart(userId, payload = {}) {
  const config = await getSchemaConfig();
  const addressId = toPositiveInteger(payload.addressId, "addressId");
  const shippingFee = toNonNegativeNumber(payload.shippingFee || 0, "shippingFee");
  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const cart = await getCartByUserId(userId, connection);

    if (!cart) {
      throw createError("Cart not found", 404);
    }

    const address = await getAddressById(userId, addressId, connection);

    if (!address) {
      throw createError("Address not found", 404);
    }

    const cartItems = await getCartItemsForCheckout(cart.id, connection, { lock: true });

    if (cartItems.length === 0) {
      throw createError("Cart is empty", 400);
    }

    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        throw createError(`Sản phẩm ${item.productName || item.sku} không còn đủ tồn kho (chỉ còn ${item.stock})`, 400);
      }
    }

    // Atomic stock decrement inside transaction with conditional WHERE check
    for (const item of cartItems) {
      if (config.variants.stock) {
        const [updateResult] = await connection.execute(
          `
            UPDATE ${config.variants.table}
            SET ${config.variants.stock} = ${config.variants.stock} - ?
            WHERE ${config.variants.id} = ?
              AND ${config.variants.stock} >= ?
          `,
          [item.quantity, item.variantId, item.quantity]
        );

        if (updateResult.affectedRows === 0) {
          throw createError(`Sản phẩm ${item.productName || item.sku} vừa hết hàng hoặc không đủ số lượng`, 400);
        }
      }
    }

    const totalAmount = toMoney(cartItems.reduce((sum, item) => sum + item.lineTotal, 0));

    let discountAmount = 0;
    let appliedCoupon = null;

    if (payload.couponCode) {
      const { validateAndCalculateCoupon } = require("../coupons/coupons.service");
      const couponResult = await validateAndCalculateCoupon({
        code: payload.couponCode,
        userId,
        items: cartItems.map((item) => ({
          productId: item.productId,
          categoryId: item.categoryId,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.lineTotal
        })),
        totalAmount,
        shippingFee
      });

      discountAmount = couponResult.discountAmount;
      appliedCoupon = couponResult.coupon;
    }

    const finalAmount = toMoney(Math.max(0, totalAmount - discountAmount + shippingFee));
    const shippingAddress = buildAddressText(address);

    const orderData = buildOrderInsertData(config, {
      userId,
      addressId,
      totalAmount,
      shippingFee,
      discountAmount,
      couponId: appliedCoupon ? appliedCoupon.id : null,
      couponCode: appliedCoupon ? appliedCoupon.code : null,
      finalAmount,
      shippingAddress,
      paymentMethod: payload.paymentMethod || "COD",
      note: payload.note || null
    });

    const [orderResult] = await connection.execute(
      `
        INSERT INTO ${config.orders.table} (${orderData.fields.join(", ")})
        VALUES (${orderData.values.join(", ")})
      `,
      orderData.params
    );

    const orderId = orderResult.insertId;

    if (appliedCoupon && discountAmount > 0) {
      await connection.execute(
        `
          INSERT INTO coupon_usages (coupon_id, user_id, order_id, discount_amount, created_at)
          VALUES (?, ?, ?, ?, NOW())
        `,
        [appliedCoupon.id, userId, orderId, discountAmount]
      );

      await connection.execute(
        `
          UPDATE coupons
          SET used_count = used_count + 1
          WHERE id = ?
        `,
        [appliedCoupon.id]
      );
    }

    for (const item of cartItems) {
      const orderItemData = buildOrderItemInsertData(config, orderId, item);
      await connection.execute(
        `
          INSERT INTO ${config.orderItems.table} (${orderItemData.fields.join(", ")})
          VALUES (${orderItemData.values.join(", ")})
        `,
        orderItemData.params
      );
    }

    await connection.execute(
      `
        DELETE FROM ${config.cartItems.table}
        WHERE ${config.cartItems.cartId} = ?
      `,
      [cart.id]
    );

    await connection.commit();
    const createdOrderDetail = await getOrderDetail({ id: userId, role: ROLES.CUSTOMER }, orderId);
    sendOrderStatusNotification({
      userId,
      orderId,
      status: "PENDING"
    }).catch((err) => console.warn("[Notification] Order created notification failed:", err.message));
    return createdOrderDetail;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}


module.exports = {
  createOrderFromCart
};
