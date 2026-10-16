const { query } = require("../../config/database");

function addWarrantyPeriod(date = new Date(), months = 12) {
  const expiresAt = new Date(date);
  expiresAt.setMonth(expiresAt.getMonth() + months);
  return expiresAt;
}

function generateWarrantyCode(orderItemId, serialNumber) {
  if (serialNumber && String(serialNumber).trim()) {
    return `SN-${String(serialNumber).trim().toUpperCase()}`;
  }
  return `BH-${orderItemId}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

function getWarrantyMonthsFromItem(item) {
  if (!item) return 24;
  const catName = String(item.categoryName || "").toLowerCase();
  const prodName = String(item.productName || "").toLowerCase();
  const combined = `${catName} ${prodName}`;

  if (/cpu|vi xử lý|processor|mainboard|bo mạch|motherboard|ram|bộ nhớ|gpu|vga|card đồ họa|graphics/i.test(combined)) {
    return 36;
  }
  if (/ssd|nvme|storage|ổ cứng|psu|nguồn|power supply/i.test(combined)) {
    return 36;
  }
  if (/cooling|tản nhiệt|aio|fan|quạt/i.test(combined)) {
    return 24;
  }
  if (/case|vỏ case|vỏ máy tính|màn hình|monitor/i.test(combined)) {
    return 12;
  }
  return 24;
}

let isWarrantyNotificationTableEnsured = false;

async function ensureWarrantyNotificationTable() {
  if (isWarrantyNotificationTableEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS warranty_notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      request_id INT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_warranty_notifications_user (user_id),
      INDEX idx_warranty_notifications_read (user_id, is_read)
    )
  `);
  isWarrantyNotificationTableEnsured = true;
}

async function createWarrantyRecordsForDeliveredOrder(orderId) {
  const parsedOrderId = Number(orderId);
  if (!Number.isFinite(parsedOrderId) || parsedOrderId <= 0) {
    return [];
  }

  const orderRows = await query(
    `
      SELECT id, user_id AS userId, status
      FROM orders
      WHERE id = ?
      LIMIT 1
    `,
    [parsedOrderId]
  );

  const order = orderRows?.[0];
  if (!order || !["DELIVERED", "COMPLETED"].includes(String(order.status || "").toUpperCase()) || !order.userId) {
    return [];
  }

  const orderItems = await query(
    `
      SELECT
        oi.id,
        oi.order_id AS orderId,
        oi.product_variant_id AS skuId,
        oi.serial_number AS serialNumber,
        c.name AS categoryName,
        p.name AS productName
      FROM order_items oi
      LEFT JOIN product_skus s ON s.id = oi.product_variant_id
      LEFT JOIN products p ON p.id = s.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN warranties w ON w.order_item_id = oi.id
      WHERE oi.order_id = ?
        AND w.id IS NULL
    `,
    [parsedOrderId]
  );

  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    return [];
  }

  const now = new Date();

  await Promise.all(
    orderItems.map((item) => {
      const months = getWarrantyMonthsFromItem(item);
      const itemExpiresAt = addWarrantyPeriod(now, months);
      return query(
        `
          INSERT IGNORE INTO warranties
            (user_id, order_id, order_item_id, sku_id, warranty_code, status, note, activated_at, expires_at)
          VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
        `,
        [
          order.userId,
          item.orderId,
          item.id,
          item.skuId || null,
          generateWarrantyCode(item.id, item.serialNumber),
          "Auto-created when order was completed",
          now,
          itemExpiresAt
        ]
      );
    })
  );

  await ensureWarrantyNotificationTable();
  await query(
    `
      INSERT INTO warranty_notifications (user_id, request_id, title, message, is_read)
      VALUES (?, NULL, ?, ?, 0)
    `,
    [
      order.userId,
      "Bảo hành điện tử đã kích hoạt",
      `Đơn hàng #${parsedOrderId} đã được kích hoạt bảo hành điện tử cho ${orderItems.length} sản phẩm.`
    ]
  );

  return orderItems;
}

module.exports = {
  createWarrantyRecordsForDeliveredOrder
};
