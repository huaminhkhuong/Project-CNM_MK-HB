import { getDbPool, query  } from "../../config/database";
import { createError, toNonNegativeNumber, toPositiveInteger  } from "../../utils/service-helpers";

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

async function findProductById(productId) {
  const rows = await query(
    `
      SELECT
        p.id,
        p.name,
        p.slug,
        p.category_id AS categoryId,
        c.name AS categoryName,
        p.brand_id AS brandId,
        b.name AS brandName
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.id = ?
      LIMIT 1
    `,
    [productId]
  );

  return rows[0] || null;
}

async function findSkuById(skuId) {
  const rows = await query(
    `
      SELECT
        s.id,
        s.product_id AS productId,
        s.sku,
        s.price,
        s.stock,
        s.image_url AS imageUrl,
        s.status,
        s.is_active AS isActive,
        s.created_at AS createdAt,
        s.updated_at AS updatedAt,
        p.name AS productName,
        p.slug AS productSlug,
        p.category_id AS categoryId,
        c.name AS categoryName,
        p.brand_id AS brandId,
        b.name AS brandName
      FROM product_skus s
      INNER JOIN products p ON p.id = s.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE s.id = ?
      LIMIT 1
    `,
    [skuId]
  );

  return rows[0] || null;
}

async function ensureUniqueSkuCode(skuCode, excludeId = null) {
  const params = [String(skuCode).trim()];
  let sql = `SELECT id FROM product_skus WHERE sku = ?`;

  if (excludeId !== null) {
    sql += ` AND id <> ?`;
    params.push(excludeId);
  }

  sql += ` LIMIT 1`;

  const rows = await query(sql, params);

  if (rows[0]) {
    throw createError("SKU already exists", 409);
  }
}

async function getSkuAttributeMappings(skuId) {
  const rows = await query(
    `
      SELECT
        sa.id,
        sa.sku_id AS skuId,
        av.id AS attributeValueId,
        av.value,
        a.id AS attributeId,
        a.name AS attributeName
      FROM sku_attributes sa
      INNER JOIN attribute_values av ON av.id = sa.attribute_value_id
      INNER JOIN attributes a ON a.id = av.attribute_id
      WHERE sa.sku_id = ?
      ORDER BY a.name ASC, av.value ASC
    `,
    [skuId]
  );

  return rows.map((row) => ({
    id: row.id,
    skuId: row.skuId,
    attributeId: row.attributeId,
    attributeName: row.attributeName,
    attributeKey: normalizeKey(row.attributeName),
    attributeValueId: row.attributeValueId,
    value: row.value,
    label: `${row.attributeName}: ${row.value}`
  }));
}

function formatSku(row, attributes) {
  return {
    id: row.id,
    productId: row.productId,
    sku: row.sku,
    price: Number(row.price || 0),
    stock: Number(row.stock || 0),
    imageUrl: row.imageUrl,
    status: row.status || (row.isActive === null ? null : row.isActive ? "ACTIVE" : "INACTIVE") || "ACTIVE",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    product: {
      id: row.productId,
      name: row.productName,
      slug: row.productSlug,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      brandId: row.brandId,
      brandName: row.brandName
    },
    attributes
  };
}

async function getSkuDetail(skuId) {
  const parsedSkuId = toPositiveInteger(skuId, "skuId");
  const sku = await findSkuById(parsedSkuId);

  if (!sku) {
    throw createError("SKU not found", 404);
  }

  return formatSku(sku, await getSkuAttributeMappings(parsedSkuId));
}

async function getSkus(params: any = {}) {
  const whereClauses = [];
  const queryParams = [];
  const keyword = String(params.keyword || "").trim();

  if (params.productId) {
    whereClauses.push(`s.product_id = ?`);
    queryParams.push(toPositiveInteger(params.productId, "productId"));
  }

  if (keyword) {
    whereClauses.push(`(s.sku LIKE CONCAT('%', ?, '%') OR p.name LIKE CONCAT('%', ?, '%'))`);
    queryParams.push(keyword, keyword);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const [skuRows, attributeRows] = await Promise.all([
    query(
      `
        SELECT
          s.id,
          s.product_id AS productId,
          s.sku,
          s.price,
          s.stock,
          s.image_url AS imageUrl,
          s.status,
          s.is_active AS isActive,
          s.created_at AS createdAt,
          s.updated_at AS updatedAt,
          p.name AS productName,
          p.slug AS productSlug,
          p.category_id AS categoryId,
          c.name AS categoryName,
          p.brand_id AS brandId,
          b.name AS brandName
        FROM product_skus s
        INNER JOIN products p ON p.id = s.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN brands b ON b.id = p.brand_id
        ${whereSql}
        ORDER BY s.id DESC
      `,
      queryParams
    ),
    query(
      `
        SELECT
          sa.sku_id AS skuId,
          av.id AS attributeValueId,
          av.value,
          a.id AS attributeId,
          a.name AS attributeName
        FROM sku_attributes sa
        INNER JOIN attribute_values av ON av.id = sa.attribute_value_id
        INNER JOIN attributes a ON a.id = av.attribute_id
        ORDER BY a.name ASC, av.value ASC
      `
    )
  ]);

  return skuRows.map((row) => formatSku(
    row,
    attributeRows
      .filter((attribute) => Number(attribute.skuId) === Number(row.id))
      .map((attribute) => ({
        skuId: attribute.skuId,
        attributeId: attribute.attributeId,
        attributeName: attribute.attributeName,
        attributeKey: normalizeKey(attribute.attributeName),
        attributeValueId: attribute.attributeValueId,
        value: attribute.value,
        label: `${attribute.attributeName}: ${attribute.value}`
      }))
  ));
}

async function validateAttributeValueIds(attributeValueIds = []) {
  const ids = Array.from(new Set((Array.isArray(attributeValueIds) ? attributeValueIds : []).map((value) => toPositiveInteger(value, "attributeValueId"))));

  if (ids.length === 0) {
    return [];
  }

  const placeholders = ids.map(() => "?").join(", ");
  const rows = await query(
    `
      SELECT av.id, av.attribute_id AS attributeId, av.value, a.name AS attributeName
      FROM attribute_values av
      INNER JOIN attributes a ON a.id = av.attribute_id
      WHERE av.id IN (${placeholders})
    `,
    ids
  );

  if (rows.length !== ids.length) {
    throw createError("One or more attribute values do not exist", 404);
  }

  const perAttribute = new Set();

  for (const row of rows) {
    if (perAttribute.has(row.attributeId)) {
      throw createError("Each SKU can only have one value per attribute", 400);
    }

    perAttribute.add(row.attributeId);
  }

  return rows;
}

async function assignAttributesToSkuInternal(connection, skuId, attributeValueIds = []) {
  await validateAttributeValueIds(attributeValueIds);
  await connection.execute(`DELETE FROM sku_attributes WHERE sku_id = ?`, [skuId]);

  for (const attributeValueId of Array.from(new Set(attributeValueIds || []))) {
    await connection.execute(
      `INSERT INTO sku_attributes (sku_id, attribute_value_id) VALUES (?, ?)`,
      [skuId, Number(attributeValueId)]
    );
  }
}

async function createSku(payload) {
  const productId = toPositiveInteger(payload.productId, "productId");
  const skuCode = String(payload.sku || "").trim();
  const price = toNonNegativeNumber(payload.price, "price");
  const stock = payload.stock !== undefined ? toNonNegativeNumber(payload.stock, "stock") : 0;
  const imageUrl = payload.imageUrl !== undefined ? String(payload.imageUrl || "").trim() : null;
  const status = String(payload.status || "ACTIVE").trim().toUpperCase();

  await ensureUniqueSkuCode(skuCode);

  const product = await findProductById(productId);
  if (!product) {
    throw createError("Product not found", 404);
  }

  const connection = await getDbPool().getConnection();

  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `
        INSERT INTO product_skus (
          product_id,
          sku,
          price,
          stock,
          image_url,
          status,
          is_active,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [productId, skuCode, price, stock, imageUrl, status, status === "ACTIVE" ? 1 : 0]
    );
    await assignAttributesToSkuInternal(connection, (result as any).insertId, payload.attributeValueIds || []);
    await connection.commit();
    return getSkuDetail((result as any).insertId);
  } catch (error: any) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateSku(skuId, payload) {
  const parsedSkuId = toPositiveInteger(skuId, "skuId");
  const existing = await findSkuById(parsedSkuId);

  if (!existing) {
    throw createError("SKU not found", 404);
  }

  const updates = [];
  const params: any[] = [];

  if (Object.prototype.hasOwnProperty.call(payload, "productId")) {
    const productId = toPositiveInteger(payload.productId, "productId");
    const product = await findProductById(productId);

    if (!product) {
      throw createError("Product not found", 404);
    }

    updates.push(`product_id = ?`);
    params.push(productId);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "sku")) {
    const skuCode = String(payload.sku || "").trim();
    await ensureUniqueSkuCode(skuCode, parsedSkuId);
    updates.push(`sku = ?`);
    params.push(skuCode);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "price")) {
    updates.push(`price = ?`);
    params.push(toNonNegativeNumber(payload.price, "price"));
  }

  if (Object.prototype.hasOwnProperty.call(payload, "stock")) {
    updates.push(`stock = ?`);
    params.push(toNonNegativeNumber(payload.stock, "stock"));
  }

  if (Object.prototype.hasOwnProperty.call(payload, "imageUrl")) {
    updates.push(`image_url = ?`);
    params.push(String(payload.imageUrl || "").trim() || null);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    const status = String(payload.status || "ACTIVE").trim().toUpperCase();
    updates.push(`status = ?`, `is_active = ?`);
    params.push(status, status === "ACTIVE" ? 1 : 0);
  }

  if (updates.length > 0) {
    params.push(parsedSkuId);
    await query(`UPDATE product_skus SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`, params);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "attributeValueIds")) {
    const connection = await getDbPool().getConnection();

    try {
      await connection.beginTransaction();
      await assignAttributesToSkuInternal(connection, parsedSkuId, payload.attributeValueIds || []);
      await connection.commit();
    } catch (error: any) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  return getSkuDetail(parsedSkuId);
}

async function deleteSku(skuId) {
  const parsedSkuId = toPositiveInteger(skuId, "skuId");
  const existing = await findSkuById(parsedSkuId);

  if (!existing) {
    throw createError("SKU not found", 404);
  }

  const connection = await getDbPool().getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute(`DELETE FROM sku_attributes WHERE sku_id = ?`, [parsedSkuId]);
    await connection.execute(`DELETE FROM product_skus WHERE id = ?`, [parsedSkuId]);
    await connection.commit();
    return { id: parsedSkuId, deleted: true };
  } catch (error: any) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function assignAttributesToSku(skuId, attributeValueIds) {
  const parsedSkuId = toPositiveInteger(skuId, "skuId");
  const existing = await findSkuById(parsedSkuId);

  if (!existing) {
    throw createError("SKU not found", 404);
  }

  const connection = await getDbPool().getConnection();

  try {
    await connection.beginTransaction();
    await assignAttributesToSkuInternal(connection, parsedSkuId, attributeValueIds || []);
    await connection.commit();
    return getSkuDetail(parsedSkuId);
  } catch (error: any) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export {
  getSkus,
  getSkuDetail,
  createSku,
  updateSku,
  deleteSku,
  assignAttributesToSku
};
export default {
  getSkus,
  getSkuDetail,
  createSku,
  updateSku,
  deleteSku,
  assignAttributesToSku
};
