const { prisma } = require("../../config/prisma");

/**
 * Restores order item stock back to product_skus.
 * When a mysql2 transactional `connection` is provided, executes strictly on that
 * connection so stock restoration participates atomically in the caller's transaction.
 */
async function restoreOrderInventory(connection, config, orderId) {
  const numericOrderId = Number(orderId);
  if (!Number.isInteger(numericOrderId) || numericOrderId <= 0) {
    return;
  }

  if (connection && typeof connection.execute === "function") {
    const orderItemsTable = config?.orderItems?.table || "order_items";
    const orderIdCol = config?.orderItems?.orderId || "order_id";
    const variantCol = config?.orderItems?.variantId || "product_variant_id";
    const qtyCol = config?.orderItems?.quantity || "quantity";
    const skusTable = config?.skus?.table || "product_skus";
    const skuIdCol = config?.skus?.id || "id";
    const stockCol = config?.skus?.stock || "stock";

    const [items] = await connection.execute(
      `SELECT ${variantCol} AS product_variant_id, ${qtyCol} AS quantity FROM ${orderItemsTable} WHERE ${orderIdCol} = ?`,
      [numericOrderId]
    );

    for (const item of items || []) {
      const qty = Number(item.quantity || 0);
      const variantId = Number(item.product_variant_id || 0);
      if (qty > 0 && variantId > 0) {
        await connection.execute(
          `UPDATE ${skusTable} SET ${stockCol} = ${stockCol} + ? WHERE ${skuIdCol} = ?`,
          [qty, variantId]
        );
      }
    }
    return;
  }

  const items = await prisma.orderItem.findMany({
    where: { order_id: numericOrderId },
    select: { product_variant_id: true, quantity: true }
  });

  for (const item of items) {
    const qty = Number(item.quantity || 0);
    if (qty > 0 && item.product_variant_id) {
      await prisma.productSku.update({
        where: { id: item.product_variant_id },
        data: { stock: { increment: qty } }
      });
    }
  }
}

module.exports = {
  restoreOrderInventory
};
