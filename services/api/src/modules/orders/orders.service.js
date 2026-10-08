const { getDbPool, query } = require("../../config/database");
const { createError, toNonNegativeNumber, toPositiveInteger } = require("../../utils/service-helpers");
const { buildActiveCondition, getTableColumns, pickColumn } = require("../../utils/schema-helpers");
const { ROLES, hasAnyRole, normalizeRole } = require("../../utils/role-helpers");
const { env } = require("../../config/env");
const { createWarrantyRecordsForDeliveredOrder } = require("../warranties/warranty-sync.service");
const { publishOrderEvent } = require("../../services/order-events");

let schemaCache = null;
const ORDER_STATUSES = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELED"];
const STAFF_VISIBLE_STATUSES = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"];
const ORDER_STATUS_TRANSITIONS = {
  PENDING: ["PROCESSING", "CANCELED"],
  PROCESSING: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  CANCELED: []
};

function toMoney(value) {
  return Number(Number(value || 0).toFixed(2));
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

function canManageOrders(role) {
  return hasAnyRole(role, [ROLES.ADMIN, ROLES.SALES_STAFF]);
}

function normalizeOrderStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();

  if (!ORDER_STATUSES.includes(normalized)) {
    throw createError(`status must be one of: ${ORDER_STATUSES.join(", ")}`, 400);
  }

  return normalized;
}

async function repairLegacyPaidOrdersForStaff(config) {
  if (!config?.orders?.table || !config?.orders?.status || !config?.orders?.paymentStatus) {
    return;
  }

  await query(
    `
      UPDATE ${config.orders.table}
      SET ${config.orders.status} = 'PROCESSING'
      WHERE ${config.orders.status} = 'PAID'
        AND ${config.orders.paymentStatus} = 'PAID'
    `
  );
}

async function getSchemaConfig() {
  if (schemaCache) {
    return schemaCache;
  }

  const [orderColumns, orderItemColumns, cartColumns, cartItemColumns, addressColumns, variantColumns, productColumns, categoryColumns, skuColumns, shipmentColumns, userColumns] = await Promise.all([
    getTableColumns("orders"),
    getTableColumns("order_items"),
    getTableColumns("carts"),
    getTableColumns("cart_items"),
    getTableColumns("addresses"),
    getTableColumns("product_variants"),
    getTableColumns("products"),
    getTableColumns("categories").catch(() => []),
    getTableColumns("product_skus").catch(() => []),
    getTableColumns("shipments").catch(() => []),
    getTableColumns("users").catch(() => [])
  ]);

  const config = {
    orders: {
      table: "orders",
      columns: orderColumns,
      id: pickColumn(orderColumns, ["id"]),
      userId: pickColumn(orderColumns, ["user_id"]),
      addressId: pickColumn(orderColumns, ["address_id"], null),
      status: pickColumn(orderColumns, ["status"], null),
      totalAmount: pickColumn(orderColumns, ["total_amount"]),
      shippingFee: pickColumn(orderColumns, ["shipping_fee"], null),
      finalAmount: pickColumn(orderColumns, ["final_amount"], null),
      shippingAddress: pickColumn(orderColumns, ["shipping_address", "shipping_address_text"], null),
      paymentMethod: pickColumn(orderColumns, ["payment_method"], null),
      paymentStatus: pickColumn(orderColumns, ["payment_status"], null),
      note: pickColumn(orderColumns, ["note", "notes"], null),
      assignedSalesId: pickColumn(orderColumns, ["assigned_sales_id"], null),
      createdAt: pickColumn(orderColumns, ["created_at"], null),
      updatedAt: pickColumn(orderColumns, ["updated_at"], null)
    },
    orderItems: {
      table: "order_items",
      columns: orderItemColumns,
      id: pickColumn(orderItemColumns, ["id"]),
      orderId: pickColumn(orderItemColumns, ["order_id"]),
      productId: pickColumn(orderItemColumns, ["product_id"], null),
      variantId: pickColumn(orderItemColumns, ["product_variant_id", "variant_id"], null),
      sku: pickColumn(orderItemColumns, ["sku_snapshot", "sku"]),
      name: pickColumn(orderItemColumns, ["name_snapshot", "product_name", "name"]),
      unitPrice: pickColumn(orderItemColumns, ["unit_price"]),
      quantity: pickColumn(orderItemColumns, ["quantity"]),
      lineTotal: pickColumn(orderItemColumns, ["line_total", "total_price"], null),
      createdAt: pickColumn(orderItemColumns, ["created_at"], null),
      updatedAt: pickColumn(orderItemColumns, ["updated_at"], null)
    },
    carts: {
      table: "carts",
      columns: cartColumns,
      id: pickColumn(cartColumns, ["id"]),
      userId: pickColumn(cartColumns, ["user_id"])
    },
    cartItems: {
      table: "cart_items",
      columns: cartItemColumns,
      id: pickColumn(cartItemColumns, ["id"]),
      cartId: pickColumn(cartItemColumns, ["cart_id"]),
      variantId: pickColumn(cartItemColumns, ["product_variant_id", "variant_id"]),
      quantity: pickColumn(cartItemColumns, ["quantity"])
    },
    addresses: {
      table: "addresses",
      columns: addressColumns,
      id: pickColumn(addressColumns, ["id"]),
      userId: pickColumn(addressColumns, ["user_id"]),
      fullName: pickColumn(addressColumns, ["full_name", "receiver_name", "contact_name"], null),
      phone: pickColumn(addressColumns, ["phone", "phone_number"], null),
      addressLine: pickColumn(addressColumns, ["address_line", "street_address", "line1", "address"], null),
      ward: pickColumn(addressColumns, ["ward"], null),
      district: pickColumn(addressColumns, ["district"], null),
      province: pickColumn(addressColumns, ["province", "city"], null)
    },
    variants: {
      table: "product_variants",
      columns: variantColumns,
      id: pickColumn(variantColumns, ["id"]),
      productId: pickColumn(variantColumns, ["product_id"]),
      sku: pickColumn(variantColumns, ["sku"]),
      price: pickColumn(variantColumns, ["price"]),
      stock: pickColumn(variantColumns, ["stock_quantity", "stock", "quantity"], null),
      activeCondition: buildActiveCondition("pv", variantColumns)
    },
    products: {
      table: "products",
      columns: productColumns,
      id: pickColumn(productColumns, ["id"]),
      name: pickColumn(productColumns, ["name"]),
      categoryId: pickColumn(productColumns, ["category_id"], null),
      imageUrl: pickColumn(productColumns, ["image_url", "thumbnail_url", "thumbnail", "image"], null),
      thumbnail: pickColumn(productColumns, ["thumbnail", "thumbnail_url", "image_url", "image"], null),
      slug: pickColumn(productColumns, ["slug"]),
      activeCondition: buildActiveCondition("p", productColumns)
    },
    categories: categoryColumns.length === 0 ? null : {
      table: "categories",
      columns: categoryColumns,
      id: pickColumn(categoryColumns, ["id"], null),
      name: pickColumn(categoryColumns, ["name"], null)
    },
    skus: skuColumns.length === 0 ? null : {
      table: "product_skus",
      columns: skuColumns,
      id: pickColumn(skuColumns, ["id"], null),
      productId: pickColumn(skuColumns, ["product_id"], null),
      sku: pickColumn(skuColumns, ["sku"], null),
      imageUrl: pickColumn(skuColumns, ["image_url", "thumbnail_url", "thumbnail", "image"], null)
    },
    shipments: {
      table: shipmentColumns.length > 0 ? "shipments" : null,
      columns: shipmentColumns,
      id: pickColumn(shipmentColumns, ["id"], null),
      orderId: pickColumn(shipmentColumns, ["order_id"], null),
      status: pickColumn(shipmentColumns, ["status"], null),
      trackingCode: pickColumn(shipmentColumns, ["tracking_code"], null),
      updatedAt: pickColumn(shipmentColumns, ["updated_at"], null)
    },
    users: {
      table: userColumns.length > 0 ? "users" : null,
      columns: userColumns,
      id: pickColumn(userColumns, ["id"], null),
      email: pickColumn(userColumns, ["email"], null),
      fullName: pickColumn(userColumns, ["full_name", "name"], null),
      phone: pickColumn(userColumns, ["phone", "phone_number"], null)
    }
  };

  if (!config.orders.id || !config.orders.userId || !config.orders.totalAmount) {
    throw createError("Orders table does not have the required columns", 500);
  }

  if (!config.orderItems.id || !config.orderItems.orderId || !config.orderItems.sku || !config.orderItems.name || !config.orderItems.unitPrice || !config.orderItems.quantity) {
    throw createError("Order items table does not have the required columns", 500);
  }

  if (!config.carts.id || !config.carts.userId || !config.cartItems.id || !config.cartItems.cartId || !config.cartItems.variantId || !config.cartItems.quantity) {
    throw createError("Cart tables do not have the required columns", 500);
  }

  if (!config.addresses.id || !config.addresses.userId) {
    throw createError("Addresses table does not have the required columns", 500);
  }

  if (!config.variants.id || !config.variants.productId || !config.variants.sku || !config.variants.price) {
    throw createError("Product variants table does not have the required columns", 500);
  }

  if (!config.products.id || !config.products.name || !config.products.slug) {
    throw createError("Products table does not have the required columns", 500);
  }

  schemaCache = config;
  return config;
}

function buildAddressText(address) {
  const parts = [
    address.fullName,
    address.phone,
    address.addressLine,
    address.ward,
    address.district,
    address.province
  ].filter(Boolean);

  return parts.join(", ");
}

async function getCartByUserId(userId, connection = null) {
  const config = await getSchemaConfig();
  const executor = connection || getDbPool();
  const [rows] = await executor.execute(
    `
      SELECT c.${config.carts.id} AS id, c.${config.carts.userId} AS userId
      FROM ${config.carts.table} c
      WHERE c.${config.carts.userId} = ?
      LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

async function getAddressById(userId, addressId, connection = null) {
  const config = await getSchemaConfig();
  const executor = connection || getDbPool();
  const [rows] = await executor.execute(
    `
      SELECT
        a.${config.addresses.id} AS id,
        a.${config.addresses.userId} AS userId,
        ${config.addresses.fullName ? `a.${config.addresses.fullName}` : "NULL"} AS fullName,
        ${config.addresses.phone ? `a.${config.addresses.phone}` : "NULL"} AS phone,
        ${config.addresses.addressLine ? `a.${config.addresses.addressLine}` : "NULL"} AS addressLine,
        ${config.addresses.ward ? `a.${config.addresses.ward}` : "NULL"} AS ward,
        ${config.addresses.district ? `a.${config.addresses.district}` : "NULL"} AS district,
        ${config.addresses.province ? `a.${config.addresses.province}` : "NULL"} AS province
      FROM ${config.addresses.table} a
      WHERE a.${config.addresses.id} = ?
        AND a.${config.addresses.userId} = ?
      LIMIT 1
    `,
    [addressId, userId]
  );

  return rows[0] || null;
}

async function getCartItemsForCheckout(cartId, connection = null, options = {}) {
  const config = await getSchemaConfig();
  const executor = connection || getDbPool();
  const stockExpression = config.variants.stock ? `pv.${config.variants.stock}` : "0";
  const lockClause = options.lock ? " FOR UPDATE" : "";
  const [rows] = await executor.execute(
    `
      SELECT
        ci.${config.cartItems.id} AS cartItemId,
        ci.${config.cartItems.quantity} AS quantity,
        pv.${config.variants.id} AS variantId,
        pv.${config.variants.productId} AS productId,
        pv.${config.variants.sku} AS sku,
        pv.${config.variants.price} AS price,
        ${stockExpression} AS stock,
        p.${config.products.name} AS productName,
        p.${config.products.slug} AS productSlug
      FROM ${config.cartItems.table} ci
      INNER JOIN ${config.variants.table} pv ON pv.${config.variants.id} = ci.${config.cartItems.variantId}
      INNER JOIN ${config.products.table} p ON p.${config.products.id} = pv.${config.variants.productId}
      WHERE ci.${config.cartItems.cartId} = ?
        AND ${config.variants.activeCondition}
        AND ${config.products.activeCondition}
      ORDER BY ci.${config.cartItems.id} ASC${lockClause}
    `,
    [cartId]
  );

  return rows.map((row) => {
    const quantity = Number(row.quantity || 0);
    const unitPrice = toMoney(row.price || 0);

    return {
      cartItemId: row.cartItemId,
      variantId: row.variantId,
      productId: row.productId,
      sku: row.sku,
      productName: row.productName,
      productSlug: row.productSlug,
      stock: Number(row.stock || 0),
      quantity,
      unitPrice,
      lineTotal: toMoney(unitPrice * quantity)
    };
  });
}

function buildOrderInsertData(config, payload) {
  const fields = [config.orders.userId, config.orders.totalAmount];
  const values = ["?", "?"];
  const params = [payload.userId, payload.totalAmount];

  if (config.orders.addressId) {
    fields.push(config.orders.addressId);
    values.push("?");
    params.push(payload.addressId);
  }

  if (config.orders.shippingFee) {
    fields.push(config.orders.shippingFee);
    values.push("?");
    params.push(payload.shippingFee);
  }

  if (config.orders.finalAmount) {
    fields.push(config.orders.finalAmount);
    values.push("?");
    params.push(payload.finalAmount);
  }

  if (config.orders.status) {
    fields.push(config.orders.status);
    values.push("?");
    params.push("PENDING");
  }

  if (config.orders.shippingAddress) {
    fields.push(config.orders.shippingAddress);
    values.push("?");
    params.push(payload.shippingAddress);
  }

  if (config.orders.paymentMethod) {
    fields.push(config.orders.paymentMethod);
    values.push("?");
    params.push(payload.paymentMethod || "COD");
  }

  if (config.orders.paymentStatus) {
    fields.push(config.orders.paymentStatus);
    values.push("?");
    params.push(["VNPAY", "ONLINE", "BANK_TRANSFER"].includes(String(payload.paymentMethod || "COD").trim().toUpperCase()) ? "PENDING_GATEWAY" : "UNPAID");
  }

  if (config.orders.note) {
    fields.push(config.orders.note);
    values.push("?");
    params.push(payload.note || null);
  }

  if (config.orders.assignedSalesId && payload.assignedSalesId) {
    fields.push(config.orders.assignedSalesId);
    values.push("?");
    params.push(payload.assignedSalesId);
  }

  if (config.orders.createdAt) {
    fields.push(config.orders.createdAt);
    values.push("NOW()");
  }

  if (config.orders.updatedAt) {
    fields.push(config.orders.updatedAt);
    values.push("NOW()");
  }

  return { fields, values, params };
}

function buildOrderItemInsertData(config, orderId, item) {
  const fields = [config.orderItems.orderId, config.orderItems.sku, config.orderItems.name, config.orderItems.unitPrice, config.orderItems.quantity];
  const values = ["?", "?", "?", "?", "?"];
  const params = [orderId, item.sku, item.productName, item.unitPrice, item.quantity];

  if (config.orderItems.productId) {
    fields.push(config.orderItems.productId);
    values.push("?");
    params.push(item.productId);
  }

  if (config.orderItems.variantId) {
    fields.push(config.orderItems.variantId);
    values.push("?");
    params.push(item.variantId);
  }

  if (config.orderItems.lineTotal) {
    fields.push(config.orderItems.lineTotal);
    values.push("?");
    params.push(item.lineTotal);
  }

  if (config.orderItems.createdAt) {
    fields.push(config.orderItems.createdAt);
    values.push("NOW()");
  }

  if (config.orderItems.updatedAt) {
    fields.push(config.orderItems.updatedAt);
    values.push("NOW()");
  }

  return { fields, values, params };
}

function baseOrderSelect(config) {
  return `
    SELECT
      o.${config.orders.id} AS id,
      o.${config.orders.userId} AS userId,
      ${config.orders.addressId ? `o.${config.orders.addressId}` : "NULL"} AS addressId,
      ${config.orders.status ? `o.${config.orders.status}` : "'PENDING'"} AS status,
      o.${config.orders.totalAmount} AS totalAmount,
      ${config.orders.shippingFee ? `o.${config.orders.shippingFee}` : "0"} AS shippingFee,
      ${config.orders.finalAmount ? `o.${config.orders.finalAmount}` : `o.${config.orders.totalAmount}`} AS finalAmount,
      ${config.orders.shippingAddress ? `o.${config.orders.shippingAddress}` : "NULL"} AS shippingAddress,
      ${config.orders.paymentMethod ? `o.${config.orders.paymentMethod}` : "NULL"} AS paymentMethod,
      ${config.orders.paymentStatus ? `o.${config.orders.paymentStatus}` : "NULL"} AS paymentStatus,
      ${config.orders.note ? `o.${config.orders.note}` : "NULL"} AS note,
      ${config.orders.assignedSalesId ? `o.${config.orders.assignedSalesId}` : "NULL"} AS assignedSalesId,
      ${config.orders.createdAt ? `o.${config.orders.createdAt}` : "NULL"} AS createdAt,
      ${config.orders.updatedAt ? `o.${config.orders.updatedAt}` : "NULL"} AS updatedAt
    FROM ${config.orders.table} o
  `;
}

async function getOrderRowById(userId, orderId) {
  const config = await getSchemaConfig();
  const rows = await query(
    `${baseOrderSelect(config)}
      WHERE o.${config.orders.id} = ?
        AND o.${config.orders.userId} = ?
      LIMIT 1`,
    [orderId, userId]
  );

  return rows[0] || null;
}

async function getOrderRowByIdAny(orderId) {
  const config = await getSchemaConfig();
  const rows = await query(
    `${baseOrderSelect(config)}
      WHERE o.${config.orders.id} = ?
      LIMIT 1`,
    [orderId]
  );

  return rows[0] || null;
}

async function getShipmentByOrderId(orderId) {
  const config = await getSchemaConfig();

  if (!config.shipments.table || !config.shipments.id || !config.shipments.orderId) {
    return null;
  }

  const rows = await query(
    `
      SELECT
        s.${config.shipments.id} AS id,
        s.${config.shipments.orderId} AS orderId,
        ${config.shipments.status ? `s.${config.shipments.status}` : "NULL"} AS status,
        ${config.shipments.trackingCode ? `s.${config.shipments.trackingCode}` : "NULL"} AS trackingCode,
        ${config.shipments.updatedAt ? `s.${config.shipments.updatedAt}` : "NULL"} AS updatedAt
      FROM ${config.shipments.table} s
      WHERE s.${config.shipments.orderId} = ?
      LIMIT 1
    `,
    [orderId]
  );

  return rows[0] || null;
}

async function getCustomerByUserId(userId) {
  const config = await getSchemaConfig();

  if (!config.users.table || !config.users.id) {
    return null;
  }

  const rows = await query(
    `
      SELECT
        u.${config.users.id} AS id,
        ${config.users.fullName ? `u.${config.users.fullName}` : "NULL"} AS fullName,
        ${config.users.email ? `u.${config.users.email}` : "NULL"} AS email,
        ${config.users.phone ? `u.${config.users.phone}` : "NULL"} AS phone
      FROM ${config.users.table} u
      WHERE u.${config.users.id} = ?
      LIMIT 1
    `,
    [userId]
  );

  const customer = rows[0];

  if (!customer) {
    return null;
  }

  return {
    id: customer.id,
    fullName: customer.fullName,
    email: customer.email,
    phone: customer.phone
  };
}

async function getOrderItemsByOrderId(orderId) {
  const config = await getSchemaConfig();
  const skuJoinCondition = config.skus?.table && config.skus?.sku
    ? `ps.${config.skus.sku} = oi.${config.orderItems.sku}${config.skus.productId && config.orderItems.productId ? ` AND (oi.${config.orderItems.productId} IS NULL OR ps.${config.skus.productId} = oi.${config.orderItems.productId})` : ""}`
    : null;

  const rows = await query(
    `
      SELECT
        oi.${config.orderItems.id} AS id,
        ${config.orderItems.productId ? `oi.${config.orderItems.productId}` : "NULL"} AS productId,
        ${config.orderItems.variantId ? `oi.${config.orderItems.variantId}` : "NULL"} AS variantId,
        oi.${config.orderItems.sku} AS sku,
        oi.${config.orderItems.name} AS productName,
        oi.${config.orderItems.unitPrice} AS unitPrice,
        oi.${config.orderItems.quantity} AS quantity,
        ${config.orderItems.lineTotal ? `oi.${config.orderItems.lineTotal}` : `(oi.${config.orderItems.unitPrice} * oi.${config.orderItems.quantity})`} AS lineTotal,
        ${config.products.imageUrl ? `p.${config.products.imageUrl}` : "NULL"} AS productImageUrl,
        ${config.products.thumbnail ? `p.${config.products.thumbnail}` : "NULL"} AS productThumbnail,
        ${config.categories?.name ? `c.${config.categories.name}` : "NULL"} AS categoryName,
        ${config.skus?.imageUrl ? `ps.${config.skus.imageUrl}` : "NULL"} AS skuImageUrl
      FROM ${config.orderItems.table} oi
      ${config.products.id && config.orderItems.productId ? `LEFT JOIN ${config.products.table} p ON p.${config.products.id} = oi.${config.orderItems.productId}` : ""}
      ${config.categories?.table && config.categories.id && config.products.categoryId ? `LEFT JOIN ${config.categories.table} c ON c.${config.categories.id} = p.${config.products.categoryId}` : ""}
      ${config.skus?.table && skuJoinCondition ? `LEFT JOIN ${config.skus.table} ps ON ${skuJoinCondition}` : ""}
      WHERE oi.${config.orderItems.orderId} = ?
      ORDER BY oi.${config.orderItems.id} ASC
    `,
    [orderId]
  );

  return rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    variantId: row.variantId,
    sku: row.sku,
    productName: row.productName,
    imageUrl: row.skuImageUrl || row.productImageUrl || row.productThumbnail || null,
    image_url: row.skuImageUrl || row.productImageUrl || row.productThumbnail || null,
    thumbnail: row.productThumbnail || row.productImageUrl || null,
    categoryName: row.categoryName || null,
    category_name: row.categoryName || null,
    product: {
      image_url: row.productImageUrl || null,
      thumbnail: row.productThumbnail || null,
      category_name: row.categoryName || null
    },
    skuData: {
      image_url: row.skuImageUrl || null
    },
    unitPrice: toMoney(row.unitPrice),
    quantity: Number(row.quantity || 0),
    lineTotal: toMoney(row.lineTotal)
  }));
}

function formatOrderSummary(row) {
  return {
    id: row.id,
    userId: row.userId,
    addressId: row.addressId,
    status: row.status,
    totalAmount: toMoney(row.totalAmount),
    shippingFee: toMoney(row.shippingFee),
    finalAmount: toMoney(row.finalAmount),
    shippingAddress: row.shippingAddress,
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    note: row.note,
    assignedSalesId: row.assignedSalesId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function formatShipment(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    orderId: row.orderId,
    status: row.status || "CREATED",
    trackingCode: row.trackingCode,
    updatedAt: row.updatedAt
  };
}

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
    const finalAmount = toMoney(totalAmount + shippingFee);
    const shippingAddress = buildAddressText(address);

    const orderData = buildOrderInsertData(config, {
      userId,
      addressId,
      totalAmount,
      shippingFee,
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
    return getOrderDetail({ id: userId, role: ROLES.CUSTOMER }, orderId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

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

async function cancelOrder(userId, orderId) {
  const parsedOrderId = toPositiveInteger(orderId, "orderId");
  const config = await getSchemaConfig();

  if (!config.orders.status) {
    throw createError("Orders table does not support status updates", 500);
  }

  const existingOrder = await getOrderRowById(userId, parsedOrderId);

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

  await query(
    `
      UPDATE ${config.orders.table}
      SET ${updateParts.join(", ")}
      WHERE ${config.orders.id} = ?
        AND ${config.orders.userId} = ?
    `,
    params
  );

  return getOrderDetail({ id: userId, role: ROLES.CUSTOMER }, parsedOrderId);
}

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

  const existingOrder = await getOrderRowByIdAny(parsedOrderId);

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

    if (config.shipments.table && config.shipments.status) {
      await query(
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
      await query(
        `
          UPDATE ${config.shipments.table}
          SET ${config.shipments.status} = ?
          WHERE ${config.shipments.orderId} = ?
        `,
        ["DELIVERED", parsedOrderId]
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

  await query(
    `
      UPDATE ${config.orders.table}
      SET ${updateParts.join(", ")}
      WHERE ${config.orders.id} = ?
    `,
    [...params, parsedOrderId]
  );

  if (nextStatus === "COMPLETED") {
    await createWarrantyRecordsForDeliveredOrder(parsedOrderId);
  }

  const updatedOrder = await getOrderDetail(actor, parsedOrderId);
  publishOrderEvent(updatedOrder?.userId || updatedOrder?.user_id || existingOrder.user_id, {
    orderId: parsedOrderId,
    status: nextStatus,
    paymentStatus: updatedOrder?.paymentStatus || updatedOrder?.payment_status || existingOrder.payment_status
  });

  return updatedOrder;
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
  createOrderFromCart,
  getMyOrders,
  getAllOrders,
  getProcessingOrders,
  getOrderDetail,
  cancelOrder,
  updateOrderStatus,
  markOrderPaid,
  createMockShipment,
  updateConsultationNote,
  uploadPaymentProof,
  approvePaymentProof
};
