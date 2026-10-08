const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { query } = require("../../config/database");
const { env } = require("../../config/env");
const { createError } = require("../../utils/service-helpers");
const { getTableColumns, pickColumn } = require("../../utils/schema-helpers");
const { normalizeRole } = require("../../utils/role-helpers");

const ROLE_IDENTIFIER_COLUMNS = ["name", "code", "slug"];

let authSchemaCache = null;
let addressSchemaCache = null;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function createAccessToken(user) {
  const normalizedRole = normalizeRole(user.role_name);

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      roleId: user.role_id,
      role: normalizedRole
    },
    env.jwtAccessSecret,
    {
      expiresIn: env.jwtAccessExpiresIn
    }
  );
}

function sanitizeUser(user) {
  return {
    id: user.id,
    roleId: user.role_id,
    role: normalizeRole(user.role_name),
    fullName: user.full_name,
    email: user.email,
    phone: user.phone || null,
    status: user.status || "ACTIVE",
    createdAt: user.created_at || null,
    updatedAt: user.updated_at || null
  };
}

function formatAddress(row, schema) {
  if (!row || !schema?.exists) {
    return null;
  }

  return {
    id: row.id,
    fullName: schema.fullName ? row.full_name : null,
    phone: schema.phone ? row.phone : null,
    addressLine: schema.addressLine ? row.address_line : null,
    ward: schema.ward ? row.ward : null,
    district: schema.district ? row.district : null,
    province: schema.province ? row.province : null,
    createdAt: schema.createdAt ? row.created_at : null
  };
}

async function getRoleIdentifierColumn() {
  const rows = await query(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = COALESCE(DATABASE(), ?)
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

  return matchedColumn;
}

async function getAuthSchema() {
  if (authSchemaCache) {
    return authSchemaCache;
  }

  const userColumns = await getTableColumns("users");
  const schema = {
    phone: pickColumn(userColumns, ["phone"], null),
    status: pickColumn(userColumns, ["status"], null),
    updatedAt: pickColumn(userColumns, ["updated_at"], null),
    password: pickColumn(userColumns, ["password_hash", "password"])
  };

  if (!schema.password) {
    throw createError("Users table must have password_hash or password column", 500);
  }

  authSchemaCache = schema;
  return schema;
}

async function getAddressSchema() {
  if (addressSchemaCache) {
    return addressSchemaCache;
  }

  const addressColumns = await getTableColumns("addresses");
  const exists = addressColumns.length > 0;
  addressSchemaCache = {
    exists,
    table: "addresses",
    id: exists ? pickColumn(addressColumns, ["id"]) : null,
    userId: exists ? pickColumn(addressColumns, ["user_id"]) : null,
    fullName: exists ? pickColumn(addressColumns, ["full_name"]) : null,
    phone: exists ? pickColumn(addressColumns, ["phone"]) : null,
    addressLine: exists ? pickColumn(addressColumns, ["address_line"]) : null,
    ward: exists ? pickColumn(addressColumns, ["ward"]) : null,
    district: exists ? pickColumn(addressColumns, ["district"]) : null,
    province: exists ? pickColumn(addressColumns, ["province"]) : null,
    createdAt: exists ? pickColumn(addressColumns, ["created_at"]) : null,
    updatedAt: exists ? pickColumn(addressColumns, ["updated_at"]) : null
  };

  return addressSchemaCache;
}

async function findCustomerRole() {
  const identifierColumn = await getRoleIdentifierColumn();
  const rows = await query(
    `
      SELECT id, ${identifierColumn} AS role_name
      FROM roles
      WHERE UPPER(${identifierColumn}) = 'CUSTOMER'
      LIMIT 1
    `
  );

  return rows[0] || null;
}

async function findUserBy(whereColumn, value) {
  const [identifierColumn, schema] = await Promise.all([
    getRoleIdentifierColumn(),
    getAuthSchema()
  ]);

  const rows = await query(
    `
      SELECT
        u.id,
        u.role_id,
        u.full_name,
        u.email,
        ${schema.phone ? `u.${schema.phone}` : "NULL"} AS phone,
        u.${schema.password} AS password_value,
        ${schema.status ? `u.${schema.status}` : "'ACTIVE'"} AS status,
        u.created_at,
        ${schema.updatedAt ? `u.${schema.updatedAt}` : "u.created_at"} AS updated_at,
        r.${identifierColumn} AS role_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.${whereColumn} = ?
      LIMIT 1
    `,
    [value]
  );

  const user = rows[0] || null;

  if (!user) {
    return null;
  }

  user.password_hash = user.password_value;
  return user;
}

function assertActiveUser(user) {
  if (String(user.status || "ACTIVE").toUpperCase() !== "ACTIVE") {
    throw createError("Account is not active", 403);
  }
}

async function registerCustomer(payload) {
  const email = normalizeEmail(payload.email);
  const existingUser = await findUserBy("email", email);

  if (existingUser) {
    throw createError("Email already exists", 409);
  }

  const [customerRole, schema] = await Promise.all([
    findCustomerRole(),
    getAuthSchema()
  ]);

  if (!customerRole) {
    throw createError("Role CUSTOMER not found in roles table", 500);
  }

  const passwordHash = await bcrypt.hash(payload.password, 10);
  const columns = ["role_id", "full_name", "email", schema.password, "created_at"];
  const placeholders = ["?", "?", "?", "?", "NOW()"];
  const values = [customerRole.id, String(payload.full_name || "").trim(), email, passwordHash];

  if (schema.phone) {
    columns.splice(3, 0, schema.phone);
    placeholders.splice(3, 0, "?");
    values.splice(3, 0, String(payload.phone || "").trim() || null);
  }

  if (schema.status) {
    columns.push(schema.status);
    placeholders.push("?");
    values.push("ACTIVE");
  }

  if (schema.updatedAt) {
    columns.push(schema.updatedAt);
    placeholders.push("NOW()");
  }

  await query(
    `INSERT INTO users (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`,
    values
  );

  const createdUser = await findUserBy("email", email);

  return {
    accessToken: createAccessToken(createdUser),
    user: sanitizeUser(createdUser)
  };
}

async function login(payload) {
  const user = await findUserBy("email", normalizeEmail(payload.email));

  if (!user) {
    throw createError("Invalid email or password", 401);
  }

  const isPasswordValid = await bcrypt.compare(payload.password, user.password_hash);

  if (!isPasswordValid) {
    throw createError("Invalid email or password", 401);
  }

  assertActiveUser(user);

  return {
    accessToken: createAccessToken(user),
    user: sanitizeUser(user)
  };
}

async function getAuthUserById(id) {
  const user = await findUserBy("id", id);

  if (!user) {
    throw createError("User not found", 401);
  }

  assertActiveUser(user);
  return sanitizeUser(user);
}

async function getCurrentProfile(userId) {
  const [user, addresses] = await Promise.all([
    findUserBy("id", userId),
    getMyAddresses(userId)
  ]);

  if (!user) {
    throw createError("User not found", 404);
  }

  assertActiveUser(user);

  return {
    ...sanitizeUser(user),
    addresses
  };
}

async function updateCurrentProfile(userId, payload) {
  const schema = await getAuthSchema();
  const nextFullName = String(payload.full_name || payload.fullName || "").trim();
  const nextPhone = String(payload.phone || "").trim();
  const updates = [];
  const params = [];

  if (!nextFullName) {
    throw createError("Full name is required", 400);
  }

  updates.push("full_name = ?");
  params.push(nextFullName);

  if (schema.phone) {
    updates.push(`${schema.phone} = ?`);
    params.push(nextPhone || null);
  }

  if (schema.updatedAt) {
    updates.push(`${schema.updatedAt} = NOW()`);
  }

  params.push(userId);
  await query(`UPDATE users SET ${updates.join(", ")} WHERE id = ? LIMIT 1`, params);

  return getCurrentProfile(userId);
}

async function changePassword(userId, payload) {
  const schema = await getAuthSchema();
  const currentPassword = String(payload.currentPassword || payload.current_password || "");
  const newPassword = String(payload.newPassword || payload.new_password || "");

  if (newPassword.length < 6) {
    throw createError("New password must be at least 6 characters", 400);
  }

  const user = await findUserBy("id", userId);

  if (!user) {
    throw createError("User not found", 404);
  }

  const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);

  if (!isPasswordValid) {
    throw createError("Current password is incorrect", 400);
  }

  const nextPasswordHash = await bcrypt.hash(newPassword, 10);
  const updates = [`${schema.password} = ?`];
  const params = [nextPasswordHash];

  if (schema.updatedAt) {
    updates.push(`${schema.updatedAt} = NOW()`);
  }

  params.push(userId);
  await query(`UPDATE users SET ${updates.join(", ")} WHERE id = ? LIMIT 1`, params);

  return { changed: true };
}

async function getMyAddresses(userId) {
  const schema = await getAddressSchema();

  if (!schema.exists || !schema.id || !schema.userId) {
    return [];
  }

  const rows = await query(
    `
      SELECT
        a.${schema.id} AS id,
        ${schema.fullName ? `a.${schema.fullName}` : "NULL"} AS full_name,
        ${schema.phone ? `a.${schema.phone}` : "NULL"} AS phone,
        ${schema.addressLine ? `a.${schema.addressLine}` : "NULL"} AS address_line,
        ${schema.ward ? `a.${schema.ward}` : "NULL"} AS ward,
        ${schema.district ? `a.${schema.district}` : "NULL"} AS district,
        ${schema.province ? `a.${schema.province}` : "NULL"} AS province,
        ${schema.createdAt ? `a.${schema.createdAt}` : "NULL"} AS created_at
      FROM ${schema.table} a
      WHERE a.${schema.userId} = ?
      ORDER BY a.${schema.id} DESC
    `,
    [userId]
  );

  return rows.map((row) => formatAddress(row, schema));
}

async function saveMyAddress(userId, addressId, payload) {
  const schema = await getAddressSchema();

  if (!schema.exists || !schema.id || !schema.userId) {
    throw createError("Addresses table is not available", 500);
  }

  const addressData = {
    fullName: String(payload.fullName || payload.full_name || "").trim(),
    phone: String(payload.phone || "").trim(),
    addressLine: String(payload.addressLine || payload.address_line || "").trim(),
    ward: String(payload.ward || "").trim(),
    district: String(payload.district || "").trim(),
    province: String(payload.province || "").trim()
  };

  if (!addressData.addressLine) {
    throw createError("Address line is required", 400);
  }

  if (addressId) {
    const updates = [];
    const params = [];

    if (schema.fullName) {
      updates.push(`${schema.fullName} = ?`);
      params.push(addressData.fullName || null);
    }
    if (schema.phone) {
      updates.push(`${schema.phone} = ?`);
      params.push(addressData.phone || null);
    }
    if (schema.addressLine) {
      updates.push(`${schema.addressLine} = ?`);
      params.push(addressData.addressLine || null);
    }
    if (schema.ward) {
      updates.push(`${schema.ward} = ?`);
      params.push(addressData.ward || null);
    }
    if (schema.district) {
      updates.push(`${schema.district} = ?`);
      params.push(addressData.district || null);
    }
    if (schema.province) {
      updates.push(`${schema.province} = ?`);
      params.push(addressData.province || null);
    }
    if (schema.updatedAt) {
      updates.push(`${schema.updatedAt} = NOW()`);
    }

    params.push(userId, addressId);
    const result = await query(
      `UPDATE ${schema.table} SET ${updates.join(", ")} WHERE ${schema.userId} = ? AND ${schema.id} = ? LIMIT 1`,
      params
    );

    if (!result?.affectedRows) {
      throw createError("Address not found", 404);
    }
  } else {
    const columns = [schema.userId];
    const placeholders = ["?"];
    const params = [userId];

    if (schema.fullName) {
      columns.push(schema.fullName);
      placeholders.push("?");
      params.push(addressData.fullName || null);
    }
    if (schema.phone) {
      columns.push(schema.phone);
      placeholders.push("?");
      params.push(addressData.phone || null);
    }
    if (schema.addressLine) {
      columns.push(schema.addressLine);
      placeholders.push("?");
      params.push(addressData.addressLine || null);
    }
    if (schema.ward) {
      columns.push(schema.ward);
      placeholders.push("?");
      params.push(addressData.ward || null);
    }
    if (schema.district) {
      columns.push(schema.district);
      placeholders.push("?");
      params.push(addressData.district || null);
    }
    if (schema.province) {
      columns.push(schema.province);
      placeholders.push("?");
      params.push(addressData.province || null);
    }
    if (schema.createdAt) {
      columns.push(schema.createdAt);
      placeholders.push("NOW()");
    }

    await query(
      `INSERT INTO ${schema.table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`,
      params
    );
  }

  return getMyAddresses(userId);
}

async function deleteMyAddress(userId, addressId) {
  const schema = await getAddressSchema();

  if (!schema.exists || !schema.id || !schema.userId) {
    throw createError("Addresses table is not available", 500);
  }

  const result = await query(
    `DELETE FROM ${schema.table} WHERE ${schema.userId} = ? AND ${schema.id} = ? LIMIT 1`,
    [userId, addressId]
  );

  if (!result?.affectedRows) {
    throw createError("Address not found", 404);
  }

  return { deleted: true };
}

module.exports = {
  registerCustomer,
  login,
  getAuthUserById,
  getCurrentProfile,
  updateCurrentProfile,
  changePassword,
  getMyAddresses,
  saveMyAddress,
  deleteMyAddress
};
