const { prisma } = require("../../config/prisma");

async function restoreOrderInventory(connection, config, orderId) {
  try {
    const items = await prisma.orderItem.findMany({
      where: { order_id: Number(orderId) },
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
  } catch (err) {
    console.warn(`[orders.service] Failed to restore inventory via Prisma for order ${orderId}:`, err);
  }
}


module.exports = {
  restoreOrderInventory
};
