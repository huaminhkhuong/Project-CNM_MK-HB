const { getDbPool, query } = require("../../config/database");
const { env } = require("../../config/env");
const {
  createError,
  toNonNegativeNumber,
  toPositiveInteger,
  toPositiveNumber
} = require("../../utils/service-helpers");

const ROLE_IDENTIFIER_COLUMNS = ["name", "code", "slug"];

let roleIdentifierColumnCache = null;
let compatibilityRuleNameColumnReady = null;

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function normalizeListParams(params = {}, defaultLimit = 20, maxLimit = 100) {
  const page = toPositiveNumber(params.page, 1);
  const limit = Math.min(toPositiveNumber(params.limit, defaultLimit), maxLimit);

  return {
    keyword: String(params.keyword || "").trim() || null,
    page,
    limit,
    offset: (page - 1) * limit
  };
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeComponentType(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeRuleType(value) {
  const normalized = String(value || "ATTRIBUTE_MATCH").trim().toUpperCase();

  if (!["ATTRIBUTE_MATCH", "ATTRIBUTE_NOT_MATCH"].includes(normalized)) {
    throw createError("ruleType must be ATTRIBUTE_MATCH or ATTRIBUTE_NOT_MATCH", 400);
  }

  return normalized;
}

async function ensureCompatibilityRuleNameColumn() {
  if (compatibilityRuleNameColumnReady) {
    return;
  }

  const rows = await query(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'compatibility_rules'
        AND COLUMN_NAME = 'name'
      LIMIT 1
    `,
    [env.dbName]
  );

  if (!rows[0]) {
    await query("ALTER TABLE compatibility_rules ADD COLUMN name VARCHAR(255) NULL AFTER id");
  }

  compatibilityRuleNameColumnReady = true;
}

function ruleTypeToOperator(ruleType) {
  return ruleType === "ATTRIBUTE_NOT_MATCH" ? "NEQ" : "EQ";
}

function operatorToRuleType(operator) {
  return String(operator || "EQ").trim().toUpperCase() === "NEQ" ? "ATTRIBUTE_NOT_MATCH" : "ATTRIBUTE_MATCH";
}

async function getRoleIdentifierColumn() {
  if (roleIdentifierColumnCache) {
    return roleIdentifierColumnCache;
  }

  const rows = await query(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'roles'
        AND COLUMN_NAME IN ('name', 'code', 'slug')
    `,
    [env.dbName]
  );

  const availableColumns = rows.map((row) => row.COLUMN_NAME);
  const matchedColumn = ROLE_IDENTIFIER_COLUMNS.find((column) => availableColumns.includes(column));

  if (!matchedColumn) {
    throw createError("Roles table must have one of these columns: name, code, slug", 500);
  }

  roleIdentifierColumnCache = matchedColumn;
  return matchedColumn;
}

async function ensureCategoryExists(categoryId) {
  const rows = await query(
    `SELECT id FROM categories WHERE id = ? LIMIT 1`,
    [categoryId]
  );

  if (!rows[0]) {
    throw createError("Category not found", 404);
  }
}

async function ensureBrandExists(brandId) {
  const rows = await query(
    `SELECT id FROM brands WHERE id = ? LIMIT 1`,
    [brandId]
  );

  if (!rows[0]) {
    throw createError("Brand not found", 404);
  }
}

async function ensureUniqueProductSlug(slug, excludeId = null) {
  const params = [slug];
  let sql = `SELECT id FROM products WHERE slug = ?`;

  if (excludeId !== null) {
    sql += ` AND id <> ?`;
    params.push(excludeId);
  }

  sql += ` LIMIT 1`;

  const rows = await query(sql, params);

  if (rows[0]) {
    throw createError("Product slug already exists", 409);
  }
}

async function ensureUniqueVariantSku(sku) {
  const rows = await query(
    `SELECT id FROM product_skus WHERE sku = ? LIMIT 1`,
    [String(sku).trim()]
  );

  if (rows[0]) {
    throw createError("Variant SKU already exists", 409);
  }
}

async function findProductById(productId) {
  const rows = await query(
    `
      SELECT
        p.id,
        p.name,
        p.slug,
        p.description,
        p.category_id AS categoryId,
        p.brand_id AS brandId,
        p.status,
        p.is_active AS isActive,
        p.created_at AS createdAt,
        p.updated_at AS updatedAt,
        c.name AS categoryName,
        b.name AS brandName
      FROM products p
      INNER JOIN categories c ON c.id = p.category_id
      INNER JOIN brands b ON b.id = p.brand_id
      WHERE p.id = ?
      LIMIT 1
    `,
    [productId]
  );

  return rows[0] || null;
}

async function findProductVariants(productId) {
  const rows = await query(
    `
      SELECT
        id,
        sku,
        price,
        stock AS stock,
        image_url AS imageUrl,
        status,
        is_active AS isActive
      FROM product_skus
      WHERE product_id = ?
      ORDER BY id DESC
    `,
    [productId]
  );

  return rows.map((row) => ({
    id: row.id,
    sku: row.sku,
    price: Number(row.price || 0),
    stock: Number(row.stock || 0),
    imageUrl: row.imageUrl,
    status: row.status || (row.isActive === null ? null : row.isActive ? "ACTIVE" : "INACTIVE") || "ACTIVE"
  }));
}

async function getProductDetail(productId) {
  const product = await findProductById(productId);

  if (!product) {
    throw createError("Product not found", 404);
  }

  const variants = await findProductVariants(productId);

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    category: {
      id: product.categoryId,
      name: product.categoryName
    },
    brand: {
      id: product.brandId,
      name: product.brandName
    },
    status: product.status || (product.isActive === null ? null : product.isActive ? "ACTIVE" : "INACTIVE") || "ACTIVE",
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    variants
  };
}

async function getProducts(params = {}) {
  const filters = normalizeListParams(params, 20, 100);
  const safeLimit = Math.max(1, Math.min(Number(filters.limit) || 20, 100));
  const safeOffset = Math.max(0, Number(filters.offset) || 0);
  const whereClauses = [];
  const queryParams = [];

  if (filters.keyword) {
    whereClauses.push(`(
      p.name LIKE CONCAT('%', ?, '%')
      OR p.slug LIKE CONCAT('%', ?, '%')
      OR c.name LIKE CONCAT('%', ?, '%')
      OR b.name LIKE CONCAT('%', ?, '%')
    )`);
    queryParams.push(filters.keyword, filters.keyword, filters.keyword, filters.keyword);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const [items, totalRows] = await Promise.all([
    query(
      `
        SELECT
          p.id,
          p.name,
          p.slug,
          p.description,
          p.category_id AS categoryId,
          p.brand_id AS brandId,
          p.status,
          p.is_active AS isActive,
          p.created_at AS createdAt,
          p.updated_at AS updatedAt,
          c.name AS categoryName,
          b.name AS brandName,
          COUNT(ps.id) AS variantCount,
          MIN(ps.price) AS minPrice
        FROM products p
        INNER JOIN categories c ON c.id = p.category_id
        LEFT JOIN brands b ON b.id = p.brand_id
        LEFT JOIN product_skus ps ON ps.product_id = p.id
        ${whereSql}
        GROUP BY p.id
        ORDER BY p.id DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset}
      `,
      queryParams
    ),
    query(
      `
        SELECT COUNT(*) AS totalItems
        FROM products p
        INNER JOIN categories c ON c.id = p.category_id
        LEFT JOIN brands b ON b.id = p.brand_id
        ${whereSql}
      `,
      queryParams
    )
  ]);

  const totalItems = Number(totalRows[0]?.totalItems || 0);

  return {
    items: items.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      category: {
        id: row.categoryId,
        name: row.categoryName
      },
      brand: {
        id: row.brandId,
        name: row.brandName || "Chưa phân loại"
      },
      status: row.status || (row.isActive === null ? null : row.isActive ? "ACTIVE" : "INACTIVE") || "ACTIVE",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      variantCount: Number(row.variantCount || 0),
      minPrice: Number(row.minPrice || 0)
    })),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / filters.limit)
    }
  };
}

async function createProduct(payload) {
  const name = String(payload.name || "").trim();
  const slug = String(payload.slug || slugify(name)).trim();
  const categoryId = toPositiveInteger(payload.categoryId, "categoryId");
  const brandId = toPositiveInteger(payload.brandId, "brandId");
  const description = payload.description !== undefined ? String(payload.description || "").trim() : null;

  await ensureCategoryExists(categoryId);
  await ensureBrandExists(brandId);
  await ensureUniqueProductSlug(slug);

  const [result] = await getDbPool().execute(
    `
      INSERT INTO products (
        name,
        slug,
        description,
        category_id,
        brand_id,
        status,
        is_active,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', 1, NOW(), NOW())
    `,
    [name, slug, description, categoryId, brandId]
  );

  return getProductDetail(result.insertId);
}

async function updateProduct(productId, payload) {
  const parsedProductId = toPositiveInteger(productId, "productId");
  const existingProduct = await findProductById(parsedProductId);

  if (!existingProduct) {
    throw createError("Product not found", 404);
  }

  const updates = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(payload, "name")) {
    updates.push(`name = ?`);
    params.push(String(payload.name || "").trim());
  }

  if (Object.prototype.hasOwnProperty.call(payload, "slug")) {
    const slug = String(payload.slug || "").trim();
    await ensureUniqueProductSlug(slug, parsedProductId);
    updates.push(`slug = ?`);
    params.push(slug);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "description")) {
    updates.push(`description = ?`);
    params.push(payload.description === null ? null : String(payload.description || "").trim());
  }

  if (Object.prototype.hasOwnProperty.call(payload, "categoryId")) {
    const categoryId = toPositiveInteger(payload.categoryId, "categoryId");
    await ensureCategoryExists(categoryId);
    updates.push(`category_id = ?`);
    params.push(categoryId);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "brandId")) {
    const brandId = toPositiveInteger(payload.brandId, "brandId");
    await ensureBrandExists(brandId);
    updates.push(`brand_id = ?`);
    params.push(brandId);
  }

  if (updates.length === 0) {
    throw createError("No valid product fields provided for update", 400);
  }

  params.push(parsedProductId);

  await query(
    `
      UPDATE products
      SET ${updates.join(", ")}, updated_at = NOW()
      WHERE id = ?
    `,
    params
  );

  return getProductDetail(parsedProductId);
}

async function changeProductStatus(productId, status) {
  const parsedProductId = toPositiveInteger(productId, "productId");
  const existingProduct = await findProductById(parsedProductId);

  if (!existingProduct) {
    throw createError("Product not found", 404);
  }

  await query(
    `
      UPDATE products
      SET status = ?, is_active = ?, updated_at = NOW()
      WHERE id = ?
    `,
    [status, status === "ACTIVE" ? 1 : 0, parsedProductId]
  );

  return getProductDetail(parsedProductId);
}

async function deleteProduct(productId) {
  const parsedProductId = toPositiveInteger(productId, "productId");
  const existingProduct = await findProductById(parsedProductId);

  if (!existingProduct) {
    throw createError("Product not found", 404);
  }

  const variantRows = await query(
    `SELECT COUNT(*) AS total FROM product_skus WHERE product_id = ?`,
    [parsedProductId]
  );
  const variantCount = Number(variantRows[0]?.total || 0);

  if (variantCount > 0) {
    throw createError("Cannot delete product that already has SKUs. Please hide the product instead.", 409);
  }

  await query(`DELETE FROM products WHERE id = ?`, [parsedProductId]);

  return {
    id: parsedProductId,
    deleted: true
  };
}

async function createVariant(productId, payload) {
  const parsedProductId = toPositiveInteger(productId, "productId");
  const existingProduct = await findProductById(parsedProductId);

  if (!existingProduct) {
    throw createError("Product not found", 404);
  }

  const sku = String(payload.sku || "").trim();
  const price = toNonNegativeNumber(payload.price, "price");
  const stock = payload.stock !== undefined ? toNonNegativeNumber(payload.stock, "stock") : 0;
  const imageUrl = payload.imageUrl !== undefined ? String(payload.imageUrl || "").trim() : null;

  await ensureUniqueVariantSku(sku);

  await getDbPool().execute(
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
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', 1, NOW(), NOW())
    `,
    [parsedProductId, sku, price, stock, imageUrl]
  );

  return getProductDetail(parsedProductId);
}

async function findUserById(userId) {
  const roleIdentifierColumn = await getRoleIdentifierColumn();
  const rows = await query(
    `
      SELECT
        u.id,
        u.full_name AS fullName,
        u.email,
        u.phone,
        u.role_id AS roleId,
        u.status,
        u.created_at AS createdAt,
        u.updated_at AS updatedAt,
        r.${roleIdentifierColumn} AS role
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
      LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

function formatUser(row) {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    roleId: row.roleId,
    role: row.role,
    status: row.status || "ACTIVE",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

async function getUsers(params = {}) {
  const roleIdentifierColumn = await getRoleIdentifierColumn();
  const filters = normalizeListParams(params, 20, 100);
  const safeLimit = Math.max(1, Math.min(Number(filters.limit) || 20, 100));
  const safeOffset = Math.max(0, Number(filters.offset) || 0);
  const whereClauses = [];
  const queryParams = [];

  if (filters.keyword) {
    whereClauses.push(`(
      u.full_name LIKE CONCAT('%', ?, '%')
      OR u.email LIKE CONCAT('%', ?, '%')
    )`);
    queryParams.push(filters.keyword, filters.keyword);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const [items, totalRows] = await Promise.all([
    query(
      `
        SELECT
          u.id,
          u.full_name AS fullName,
          u.email,
          u.phone,
          u.role_id AS roleId,
          u.status,
          u.created_at AS createdAt,
          u.updated_at AS updatedAt,
          r.${roleIdentifierColumn} AS role
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        ${whereSql}
        ORDER BY u.created_at DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset}
      `,
      queryParams
    ),
    query(
      `SELECT COUNT(*) AS totalItems FROM users u ${whereSql}`,
      queryParams
    )
  ]);

  const totalItems = Number(totalRows[0]?.totalItems || 0);

  return {
    items: items.map(formatUser),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / filters.limit)
    }
  };
}

async function changeUserStatus(userId, status) {
  const parsedUserId = toPositiveInteger(userId, "userId");
  const existingUser = await findUserById(parsedUserId);

  if (!existingUser) {
    throw createError("User not found", 404);
  }

  await query(
    `
      UPDATE users
      SET status = ?, updated_at = NOW()
      WHERE id = ?
    `,
    [status, parsedUserId]
  );

  return formatUser(await findUserById(parsedUserId));
}

async function findCategoryByComponentType(componentType) {
  const rows = await query(
    `SELECT id, name FROM categories WHERE UPPER(name) = ? LIMIT 1`,
    [normalizeComponentType(componentType)]
  );

  return rows[0] || null;
}

async function findCompatibilityRuleRowById(ruleId) {
  await ensureCompatibilityRuleNameColumn();

  const rows = await query(
    `
      SELECT
        cr.id,
        cr.name,
        cr.source_category_id AS sourceCategoryId,
        cr.target_category_id AS targetCategoryId,
        cr.source_attribute_key AS sourceAttributeKey,
        cr.target_attribute_key AS targetAttributeKey,
        cr.operator,
        cr.description,
        cr.status,
        cr.is_active AS isActive,
        cr.created_at AS createdAt,
        cr.updated_at AS updatedAt,
        sc.name AS sourceCategoryName,
        tc.name AS targetCategoryName
      FROM compatibility_rules cr
      INNER JOIN categories sc ON sc.id = cr.source_category_id
      INNER JOIN categories tc ON tc.id = cr.target_category_id
      WHERE cr.id = ?
      LIMIT 1
    `,
    [ruleId]
  );

  return rows[0] || null;
}

function formatCompatibilityRule(row) {
  const sourceAttributeKey = normalizeKey(row.sourceAttributeKey);
  const targetAttributeKey = normalizeKey(row.targetAttributeKey);
  const sourceComponentType = normalizeComponentType(row.sourceCategoryName);
  const targetComponentType = normalizeComponentType(row.targetCategoryName);
  const ruleType = operatorToRuleType(row.operator);
  const description = row.description || "";
  const name = row.name || description || `${sourceComponentType} ${sourceAttributeKey} ${ruleType} ${targetComponentType} ${targetAttributeKey}`;

  return {
    id: row.id,
    name,
    sourceComponentType,
    targetComponentType,
    ruleType,
    sourceAttributeKey,
    targetAttributeKey,
    description,
    status: row.status || (row.isActive === null ? null : row.isActive ? "ACTIVE" : "INACTIVE") || "ACTIVE",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

async function getCompatibilityRules() {
  await ensureCompatibilityRuleNameColumn();

  const rows = await query(
    `
      SELECT
        cr.id,
        cr.name,
        cr.source_category_id AS sourceCategoryId,
        cr.target_category_id AS targetCategoryId,
        cr.source_attribute_key AS sourceAttributeKey,
        cr.target_attribute_key AS targetAttributeKey,
        cr.operator,
        cr.description,
        cr.status,
        cr.is_active AS isActive,
        cr.created_at AS createdAt,
        cr.updated_at AS updatedAt,
        sc.name AS sourceCategoryName,
        tc.name AS targetCategoryName
      FROM compatibility_rules cr
      INNER JOIN categories sc ON sc.id = cr.source_category_id
      INNER JOIN categories tc ON tc.id = cr.target_category_id
      ORDER BY cr.id DESC
    `
  );

  return rows.map(formatCompatibilityRule);
}

async function createCompatibilityRule(payload) {
  await ensureCompatibilityRuleNameColumn();

  const sourceCategory = await findCategoryByComponentType(payload.sourceComponentType);
  const targetCategory = await findCategoryByComponentType(payload.targetComponentType);

  if (!sourceCategory) {
    throw createError("Source component type category not found", 404);
  }

  if (!targetCategory) {
    throw createError("Target component type category not found", 404);
  }

  const name = String(payload.name || "").trim();
  const description = String(payload.description || "").trim() || null;
  const operator = ruleTypeToOperator(normalizeRuleType(payload.ruleType));

  const [result] = await getDbPool().execute(
    `
      INSERT INTO compatibility_rules (
        name,
        source_category_id,
        target_category_id,
        source_attribute_key,
        target_attribute_key,
        operator,
        description,
        status,
        is_active,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1, NOW(), NOW())
    `,
    [
      name,
      sourceCategory.id,
      targetCategory.id,
      normalizeKey(payload.sourceAttributeKey),
      normalizeKey(payload.targetAttributeKey),
      operator,
      description
    ]
  );

  return formatCompatibilityRule(await findCompatibilityRuleRowById(result.insertId));
}

async function updateCompatibilityRule(ruleId, payload) {
  await ensureCompatibilityRuleNameColumn();

  const parsedRuleId = toPositiveInteger(ruleId, "ruleId");
  const existingRule = await findCompatibilityRuleRowById(parsedRuleId);

  if (!existingRule) {
    throw createError("Compatibility rule not found", 404);
  }

  const updates = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(payload, "name")) {
    updates.push(`name = ?`);
    params.push(String(payload.name || "").trim());
  }

  if (Object.prototype.hasOwnProperty.call(payload, "sourceComponentType")) {
    const sourceCategory = await findCategoryByComponentType(payload.sourceComponentType);

    if (!sourceCategory) {
      throw createError("Source component type category not found", 404);
    }

    updates.push(`source_category_id = ?`);
    params.push(sourceCategory.id);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "targetComponentType")) {
    const targetCategory = await findCategoryByComponentType(payload.targetComponentType);

    if (!targetCategory) {
      throw createError("Target component type category not found", 404);
    }

    updates.push(`target_category_id = ?`);
    params.push(targetCategory.id);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "sourceAttributeKey")) {
    updates.push(`source_attribute_key = ?`);
    params.push(normalizeKey(payload.sourceAttributeKey));
  }

  if (Object.prototype.hasOwnProperty.call(payload, "targetAttributeKey")) {
    updates.push(`target_attribute_key = ?`);
    params.push(normalizeKey(payload.targetAttributeKey));
  }

  if (Object.prototype.hasOwnProperty.call(payload, "ruleType")) {
    updates.push(`operator = ?`);
    params.push(ruleTypeToOperator(normalizeRuleType(payload.ruleType)));
  }

  if (Object.prototype.hasOwnProperty.call(payload, "description")) {
    updates.push(`description = ?`);
    params.push(String(payload.description || "").trim() || null);
  }

  if (updates.length === 0) {
    throw createError("No valid compatibility rule fields provided for update", 400);
  }

  params.push(parsedRuleId);

  await query(
    `
      UPDATE compatibility_rules
      SET ${updates.join(", ")}, updated_at = NOW()
      WHERE id = ?
    `,
    params
  );

  return formatCompatibilityRule(await findCompatibilityRuleRowById(parsedRuleId));
}

async function changeCompatibilityRuleStatus(ruleId, status) {
  const parsedRuleId = toPositiveInteger(ruleId, "ruleId");
  const existingRule = await findCompatibilityRuleRowById(parsedRuleId);

  if (!existingRule) {
    throw createError("Compatibility rule not found", 404);
  }

  await query(
    `
      UPDATE compatibility_rules
      SET status = ?, is_active = ?, updated_at = NOW()
      WHERE id = ?
    `,
    [status, status === "ACTIVE" ? 1 : 0, parsedRuleId]
  );

  return formatCompatibilityRule(await findCompatibilityRuleRowById(parsedRuleId));
}

function getDashboardSummary() {
  return {
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0
  };
}

module.exports = {
  getDashboardSummary,
  getProducts,
  createProduct,
  updateProduct,
  changeProductStatus,
  deleteProduct,
  createVariant,
  getUsers,
  changeUserStatus,
  getCompatibilityRules,
  createCompatibilityRule,
  updateCompatibilityRule,
  changeCompatibilityRuleStatus
};



