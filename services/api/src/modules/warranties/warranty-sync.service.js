const { query } = require("../../config/database");

function addWarrantyPeriod(date = new Date(), months = 12) {
  const expiresAt = new Date(date);
  expiresAt.setMonth(expiresAt.getMonth() + months);
  return expiresAt;
}

function generateWarrantyCode(orderItemId, serialNumber) {
  if (serialNumber) {
    return `BH-${serialNumber}`;
  }
  return `BH-${orderItemId}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

function getWarrantyMonthsFromItem(item) {
  if (!item) return 24;

  // 1. Prioritize SKU Master Data (allows SKU-specific overrides like Boxed vs Tray)
  const skuMonths = Number(item.skuWarrantyMonths ?? item.sku_warranty_months ?? item.ProductSku?.warranty_months);
  if (Number.isFinite(skuMonths) && skuMonths > 0) {
    return skuMonths;
  }

  // 2. Prioritize Product Master Data (base product warranty set by Admin)
  const productMonths = Number(
    item.productWarrantyMonths ??
    item.product_warranty_months ??
    item.Product?.warranty_months ??
    item.ProductSku?.Product?.warranty_months
  );
  if (Number.isFinite(productMonths) && productMonths > 0) {
    return productMonths;
  }

  // 3. Explicit item.warrantyMonths or item.warranty_months (if snapshotted on orderItem)
  const explicitMonths = Number(item.warrantyMonths ?? item.warranty_months);
  if (Number.isFinite(explicitMonths) && explicitMonths > 0) {
    return explicitMonths;
  }

  // 4. Fallback for legacy items without master data: keyword / category heuristics
  const catName = String(item.categoryName || item.Category?.name || "").toLowerCase();
  const prodName = String(item.productName || item.Product?.name || "").toLowerCase();
  const combined = `${catName} ${prodName}`;

  if (/psu|nguồn|power supply/i.test(combined) && (/seasonic|rm750|rm850|rm1000|corsair rm/i.test(combined))) {
    return 120;
  }
  if (/ssd|nvme/i.test(combined) && (/980 pro|990 pro|sn850/i.test(combined))) {
    return 60;
  }
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
        oi.quantity,
        c.name AS categoryName,
        p.name AS productName,
        s.warranty_months AS skuWarrantyMonths,
        p.warranty_months AS productWarrantyMonths
      FROM order_items oi
      LEFT JOIN product_skus s ON s.id = oi.product_variant_id
      LEFT JOIN products p ON p.id = COALESCE(s.product_id, oi.product_id)
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE oi.order_id = ?
    `,
    [parsedOrderId]
  );

  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    return [];
  }

  // Fetch assigned serial numbers from order_item_serials
  const assignedSerials = await query(
    `
      SELECT id, order_item_id AS orderItemId, sku_id AS skuId, serial_number AS serialNumber, warranty_id AS warrantyId
      FROM order_item_serials
      WHERE order_id = ?
    `,
    [parsedOrderId]
  );

  const serialsByItem = new Map();
  for (const s of assignedSerials || []) {
    if (!serialsByItem.has(s.orderItemId)) {
      serialsByItem.set(s.orderItemId, []);
    }
    serialsByItem.get(s.orderItemId).push(s);
  }

  const now = new Date();
  const createdWarranties = [];

  for (const item of orderItems) {
    const months = getWarrantyMonthsFromItem(item);
    const itemExpiresAt = addWarrantyPeriod(now, months);
    const itemSerials = serialsByItem.get(item.id) || [];

    if (itemSerials.length > 0) {
      // Create 1 warranty per assigned serial number (1:1 warranty tracking)
      for (const serial of itemSerials) {
        // Check if warranty already exists for this serial
        const [existing] = await query(
          `SELECT id, warranty_code AS warrantyCode FROM warranties WHERE serial_number = ? LIMIT 1`,
          [serial.serialNumber]
        );

        if (existing) {
          // Keep order_item_serials aligned
          await query(
            `UPDATE order_item_serials SET warranty_id = ?, status = 'IN_WARRANTY' WHERE id = ?`,
            [existing.id, serial.id]
          );
          createdWarranties.push({ id: existing.id, serialNumber: serial.serialNumber, code: existing.warrantyCode });
          continue;
        }

        const warrantyCode = generateWarrantyCode(item.id, serial.serialNumber);
        const insertRes = await query(
          `
            INSERT INTO warranties
              (user_id, order_id, order_item_id, sku_id, serial_number, warranty_code, status, note, activated_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
          `,
          [
            order.userId,
            item.orderId,
            item.id,
            item.skuId || null,
            serial.serialNumber,
            warrantyCode,
            `Bảo hành chính hãng kích hoạt theo S/N ${serial.serialNumber}`,
            now,
            itemExpiresAt
          ]
        );

        const newWarrantyId = insertRes.insertId;
        await query(
          `UPDATE order_item_serials SET warranty_id = ?, status = 'IN_WARRANTY' WHERE id = ?`,
          [newWarrantyId, serial.id]
        );

        createdWarranties.push({
          id: newWarrantyId,
          serialNumber: serial.serialNumber,
          code: warrantyCode
        });
      }
    } else {
      // Legacy fallback: no S/N assigned during fulfillment
      const [existing] = await query(
        `SELECT id, warranty_code AS warrantyCode FROM warranties WHERE order_item_id = ? LIMIT 1`,
        [item.id]
      );

      if (!existing) {
        const warrantyCode = generateWarrantyCode(item.id);
        const insertRes = await query(
          `
            INSERT INTO warranties
              (user_id, order_id, order_item_id, sku_id, warranty_code, status, note, activated_at, expires_at)
            VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
          `,
          [
            order.userId,
            item.orderId,
            item.id,
            item.skuId || null,
            warrantyCode,
            "Auto-created when order was completed",
            now,
            itemExpiresAt
          ]
        );
        createdWarranties.push({ id: insertRes.insertId, code: warrantyCode });
      }
    }
  }

  if (createdWarranties.length > 0) {
    const notifTitle = "Bảo hành điện tử đã kích hoạt";
    const notifMsg = `Đơn hàng #${parsedOrderId} đã được kích hoạt bảo hành điện tử chính hãng theo Serial Number cho ${createdWarranties.length} sản phẩm.`;

    await query(
      `
        INSERT INTO warranty_notifications (user_id, request_id, title, message, is_read)
        VALUES (?, NULL, ?, ?, 0)
      `,
      [
        order.userId,
        notifTitle,
        notifMsg
      ]
    );

    try {
      const { sendWarrantyNotification } = require("../notifications/notifications.service");
      sendWarrantyNotification({
        userId: order.userId,
        title: notifTitle,
        message: notifMsg
      }).catch(() => {});
    } catch {}
  }

  return createdWarranties;
}

module.exports = {
  addWarrantyPeriod,
  generateWarrantyCode,
  getWarrantyMonthsFromItem,
  createWarrantyRecordsForDeliveredOrder
};
