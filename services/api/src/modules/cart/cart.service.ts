import { getDbPool, query } from "../../config/database";
import { createError, toPositiveInteger } from "../../utils/service-helpers";
import { buildActiveCondition, getTableColumns, pickColumn } from "../../utils/schema-helpers";

let schemaCache: any = null;

async function getSchemaConfig(): Promise<any> {
  if (schemaCache) {
    return schemaCache;
  }

  const [cartColumns, cartItemColumns, variantColumns, productColumns] = await Promise.all([
    getTableColumns("carts"),
    getTableColumns("cart_items"),
    getTableColumns("product_variants"),
    getTableColumns("products")
  ]);

  const config = {
    carts: {
      table: "carts",
      columns: cartColumns,
      id: pickColumn(cartColumns, ["id"]),
      userId: pickColumn(cartColumns, ["user_id"]),
      createdAt: pickColumn(cartColumns, ["created_at"], null),
      updatedAt: pickColumn(cartColumns, ["updated_at"], null)
    },
    cartItems: {
      table: "cart_items",
      columns: cartItemColumns,
      id: pickColumn(cartItemColumns, ["id"]),
      cartId: pickColumn(cartItemColumns, ["cart_id"]),
      variantId: pickColumn(cartItemColumns, ["product_variant_id", "variant_id"]),
      quantity: pickColumn(cartItemColumns, ["quantity"]),
      createdAt: pickColumn(cartItemColumns, ["created_at"], null),
      updatedAt: pickColumn(cartItemColumns, ["updated_at"], null)
    },
    variants: {
      table: "product_variants",
      columns: variantColumns,
      id: pickColumn(variantColumns, ["id"]),
      productId: pickColumn(variantColumns, ["product_id"]),
      sku: pickColumn(variantColumns, ["sku"]),
      price: pickColumn(variantColumns, ["price"]),
      stock: pickColumn(variantColumns, ["stock_quantity", "stock", "quantity"], null),
      image: pickColumn(variantColumns, ["image_url", "thumbnail_url", "thumbnail", "image"], null),
      activeCondition: buildActiveCondition("pv", variantColumns)
    },
    products: {
      table: "products",
      columns: productColumns,
      id: pickColumn(productColumns, ["id"]),
      name: pickColumn(productColumns, ["name"]),
      slug: pickColumn(productColumns, ["slug"]),
      activeCondition: buildActiveCondition("p", productColumns)
    }
  };

  if (!config.carts.id || !config.carts.userId) {
    throw createError("Carts table does not have the required columns", 500);
  }

  if (!config.cartItems.id || !config.cartItems.cartId || !config.cartItems.variantId || !config.cartItems.quantity) {
    throw createError("Cart items table does not have the required columns", 500);
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

async function getCartByUserId(userId: any, connection: any = null): Promise<any> {
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

async function createCart(connection: any, userId: any): Promise<any> {
  const config = await getSchemaConfig();
  const fields = [config.carts.userId];
  const valuesSql = ["?"];
  const params = [userId];

  if (config.carts.createdAt) {
    fields.push(config.carts.createdAt);
    valuesSql.push("NOW()");
  }

  if (config.carts.updatedAt) {
    fields.push(config.carts.updatedAt);
    valuesSql.push("NOW()");
  }

  await connection.execute(
    `
      INSERT INTO ${config.carts.table} (${fields.join(", ")})
      VALUES (${valuesSql.join(", ")})
    `,
    params
  );

  return getCartByUserId(userId, connection);
}

async function getOrCreateCart(userId: any, connection: any = null): Promise<any> {
  const cart = await getCartByUserId(userId, connection);

  if (cart) {
    return cart;
  }

  if (connection) {
    return createCart(connection, userId);
  }

  const pool = getDbPool();
  const localConnection = await pool.getConnection();

  try {
    await localConnection.beginTransaction();
    const createdCart = await createCart(localConnection, userId);
    await localConnection.commit();
    return createdCart;
  } catch (error: any) {
    await localConnection.rollback();
    throw error;
  } finally {
    localConnection.release();
  }
}

async function getCartItems(cartId: any): Promise<any[]> {
  const config = await getSchemaConfig();
  const rows = await query<any[]>(
    `
      SELECT
        ci.${config.cartItems.id} AS id,
        ci.${config.cartItems.quantity} AS quantity,
        pv.${config.variants.id} AS variantId,
        pv.${config.variants.sku} AS sku,
        pv.${config.variants.price} AS price,
        ${config.variants.stock ? `pv.${config.variants.stock}` : "0"} AS stock,
        ${config.variants.image ? `pv.${config.variants.image}` : "NULL"} AS imageUrl,
        p.${config.products.id} AS productId,
        p.${config.products.name} AS productName,
        p.${config.products.slug} AS productSlug
      FROM ${config.cartItems.table} ci
      INNER JOIN ${config.variants.table} pv ON pv.${config.variants.id} = ci.${config.cartItems.variantId}
      INNER JOIN ${config.products.table} p ON p.${config.products.id} = pv.${config.variants.productId}
      WHERE ci.${config.cartItems.cartId} = ?
        AND ${config.variants.activeCondition}
        AND ${config.products.activeCondition}
      ORDER BY ci.${config.cartItems.id} DESC
    `,
    [cartId]
  );

  return rows.map((row) => ({
    id: row.id,
    quantity: Number(row.quantity),
    unitPrice: Number(row.price),
    totalPrice: Number(row.price) * Number(row.quantity),
    variant: {
      id: row.variantId,
      sku: row.sku,
      price: Number(row.price),
      stock: Number(row.stock || 0),
      imageUrl: row.imageUrl
    },
    product: {
      id: row.productId,
      name: row.productName,
      slug: row.productSlug
    }
  }));
}

function formatCart(cart: any, items: any[] = []): any {
  const totalItems = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalPrice = items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);

  return {
    id: cart.id,
    userId: cart.userId,
    items,
    totalItems,
    totalPrice
  };
}

async function findVariantById(variantId: any): Promise<any> {
  const config = await getSchemaConfig();
  const rows = await query<any[]>(
    `
      SELECT
        pv.${config.variants.id} AS id,
        pv.${config.variants.price} AS price,
        ${config.variants.stock ? `pv.${config.variants.stock}` : "0"} AS stock
      FROM ${config.variants.table} pv
      INNER JOIN ${config.products.table} p ON p.${config.products.id} = pv.${config.variants.productId}
      WHERE pv.${config.variants.id} = ?
        AND ${config.variants.activeCondition}
        AND ${config.products.activeCondition}
      LIMIT 1
    `,
    [variantId]
  );

  return rows[0] || null;
}

async function findCartItemByVariantId(cartId: any, variantId: any, connection: any = null): Promise<any> {
  const config = await getSchemaConfig();
  const executor = connection || getDbPool();
  const [rows] = await executor.execute(
    `
      SELECT id, quantity
      FROM ${config.cartItems.table}
      WHERE ${config.cartItems.cartId} = ? AND ${config.cartItems.variantId} = ?
      LIMIT 1
    `,
    [cartId, variantId]
  );

  return rows[0] || null;
}

async function findCartItemById(cartId: any, itemId: any, connection: any = null): Promise<any> {
  const config = await getSchemaConfig();
  const executor = connection || getDbPool();
  const [rows] = await executor.execute(
    `
      SELECT id, ${config.cartItems.variantId} AS variantId, quantity
      FROM ${config.cartItems.table}
      WHERE ${config.cartItems.id} = ? AND ${config.cartItems.cartId} = ?
      LIMIT 1
    `,
    [itemId, cartId]
  );

  return rows[0] || null;
}

export async function getCurrentCart(userId: any): Promise<any> {
  const cart = await getOrCreateCart(userId);
  const items = await getCartItems(cart.id);

  return formatCart(cart, items);
}

export async function addItem(userId: any, payload: any): Promise<any> {
  const variantId = toPositiveInteger(payload.productVariantId, "productVariantId");
  const quantity = toPositiveInteger(payload.quantity || 1, "quantity");
  const variant = await findVariantById(variantId);

  if (!variant) {
    throw createError("Product variant not found", 404);
  }

  if (Number(variant.stock || 0) < quantity) {
    throw createError("Not enough stock for this product variant", 400);
  }

  const config = await getSchemaConfig();
  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const cart = await getOrCreateCart(userId, connection);
    const existingItem = await findCartItemByVariantId(cart.id, variantId, connection);

    if (existingItem) {
      const newQuantity = Number(existingItem.quantity) + quantity;

      if (Number(variant.stock || 0) < newQuantity) {
        throw createError("Not enough stock for this product variant", 400);
      }

      const updateParts = [`${config.cartItems.quantity} = ?`];
      const params = [newQuantity];

      if (config.cartItems.updatedAt) {
        updateParts.push(`${config.cartItems.updatedAt} = NOW()`);
      }

      params.push(existingItem.id);

      await connection.execute(
        `
          UPDATE ${config.cartItems.table}
          SET ${updateParts.join(", ")}
          WHERE ${config.cartItems.id} = ?
        `,
        params
      );
    } else {
      const fields = [config.cartItems.cartId, config.cartItems.variantId, config.cartItems.quantity];
      const values = ["?", "?", "?"];
      const params = [cart.id, variantId, quantity];

      if (config.cartItems.createdAt) {
        fields.push(config.cartItems.createdAt);
        values.push("NOW()");
      }

      if (config.cartItems.updatedAt) {
        fields.push(config.cartItems.updatedAt);
        values.push("NOW()");
      }

      await connection.execute(
        `
          INSERT INTO ${config.cartItems.table} (${fields.join(", ")})
          VALUES (${values.join(", ")})
        `,
        params
      );
    }

    await connection.commit();
    return getCurrentCart(userId);
  } catch (error: any) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateItemQuantity(userId: any, itemId: any, payload: any): Promise<any> {
  const parsedItemId = toPositiveInteger(itemId, "itemId");
  const quantity = toPositiveInteger(payload.quantity, "quantity");
  const config = await getSchemaConfig();
  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const cart = await getOrCreateCart(userId, connection);
    const existingItem = await findCartItemById(cart.id, parsedItemId, connection);

    if (!existingItem) {
      throw createError("Cart item not found", 404);
    }

    const variant = await findVariantById(existingItem.variantId);

    if (!variant) {
      throw createError("Product variant not found", 404);
    }

    if (Number(variant.stock || 0) < quantity) {
      throw createError("Not enough stock for this product variant", 400);
    }

    const updateParts = [`${config.cartItems.quantity} = ?`];
    const params = [quantity];

    if (config.cartItems.updatedAt) {
      updateParts.push(`${config.cartItems.updatedAt} = NOW()`);
    }

    params.push(parsedItemId);

    await connection.execute(
      `
        UPDATE ${config.cartItems.table}
        SET ${updateParts.join(", ")}
        WHERE ${config.cartItems.id} = ?
      `,
      params
    );

    await connection.commit();
    return getCurrentCart(userId);
  } catch (error: any) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function removeItem(userId: any, itemId: any): Promise<any> {
  const parsedItemId = toPositiveInteger(itemId, "itemId");
  const config = await getSchemaConfig();
  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const cart = await getOrCreateCart(userId, connection);
    const existingItem = await findCartItemById(cart.id, parsedItemId, connection);

    if (!existingItem) {
      throw createError("Cart item not found", 404);
    }

    await connection.execute(
      `
        DELETE FROM ${config.cartItems.table}
        WHERE ${config.cartItems.id} = ?
      `,
      [parsedItemId]
    );

    await connection.commit();
    return getCurrentCart(userId);
  } catch (error: any) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export default {
  getCurrentCart,
  addItem,
  updateItemQuantity,
  removeItem
};
