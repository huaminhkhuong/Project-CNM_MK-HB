import { getDbPool, query  } from "../../config/database";
import { createError, toPositiveInteger  } from "../../utils/service-helpers";

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

async function findAttributeById(attributeId) {
  const rows = await query(`SELECT id, name FROM attributes WHERE id = ? LIMIT 1`, [attributeId]);
  return rows[0] || null;
}

async function findAttributeValueById(attributeValueId) {
  const rows = await query(
    `
      SELECT av.id, av.attribute_id AS attributeId, av.value, a.name AS attributeName
      FROM attribute_values av
      INNER JOIN attributes a ON a.id = av.attribute_id
      WHERE av.id = ?
      LIMIT 1
    `,
    [attributeValueId]
  );

  return rows[0] || null;
}

async function ensureUniqueAttributeName(name, excludeId = null) {
  const params = [String(name).trim()];
  let sql = `SELECT id FROM attributes WHERE LOWER(name) = LOWER(?)`;

  if (excludeId !== null) {
    sql += ` AND id <> ?`;
    params.push(excludeId);
  }

  sql += ` LIMIT 1`;

  const rows = await query(sql, params);

  if (rows[0]) {
    throw createError("Attribute name already exists", 409);
  }
}

async function ensureUniqueAttributeValue(attributeId, value, excludeId = null) {
  const params = [attributeId, String(value).trim()];
  let sql = `SELECT id FROM attribute_values WHERE attribute_id = ? AND LOWER(value) = LOWER(?)`;

  if (excludeId !== null) {
    sql += ` AND id <> ?`;
    params.push(excludeId);
  }

  sql += ` LIMIT 1`;

  const rows = await query(sql, params);

  if (rows[0]) {
    throw createError("Attribute value already exists for this attribute", 409);
  }
}

function formatAttributeGroup(row, values) {
  return {
    id: row.id,
    name: row.name,
    key: normalizeKey(row.name),
    values
  };
}

async function getAttributes() {
  const [attributeRows, valueRows] = await Promise.all([
    query(`SELECT id, name FROM attributes ORDER BY name ASC`),
    query(
      `
        SELECT av.id, av.attribute_id AS attributeId, av.value, a.name AS attributeName
        FROM attribute_values av
        INNER JOIN attributes a ON a.id = av.attribute_id
        ORDER BY a.name ASC, av.value ASC
      `
    )
  ]);

  return attributeRows.map((attribute) => formatAttributeGroup(
    attribute,
    valueRows
      .filter((value) => Number(value.attributeId) === Number(attribute.id))
      .map((value) => ({
        id: value.id,
        attributeId: value.attributeId,
        attributeName: value.attributeName,
        value: value.value,
        label: `${value.attributeName}: ${value.value}`
      }))
  ));
}

async function getAttributeValues(params: any = {}) {
  const whereClauses = [];
  const queryParams = [];

  if (params.attributeId) {
    whereClauses.push(`av.attribute_id = ?`);
    queryParams.push(toPositiveInteger(params.attributeId, "attributeId"));
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const rows = await query(
    `
      SELECT av.id, av.attribute_id AS attributeId, av.value, a.name AS attributeName
      FROM attribute_values av
      INNER JOIN attributes a ON a.id = av.attribute_id
      ${whereSql}
      ORDER BY a.name ASC, av.value ASC
    `,
    queryParams
  );

  return rows.map((row) => ({
    id: row.id,
    attributeId: row.attributeId,
    attributeName: row.attributeName,
    value: row.value,
    label: `${row.attributeName}: ${row.value}`
  }));
}

async function createAttribute(payload) {
  const name = String(payload.name || "").trim();
  await ensureUniqueAttributeName(name);

  const [result] = await getDbPool().execute(`INSERT INTO attributes (name) VALUES (?)`, [name]);
  return formatAttributeGroup(await findAttributeById((result as any).insertId), []);
}

async function updateAttribute(attributeId, payload) {
  const parsedAttributeId = toPositiveInteger(attributeId, "attributeId");
  const existing = await findAttributeById(parsedAttributeId);

  if (!existing) {
    throw createError("Attribute not found", 404);
  }

  const name = String(payload.name || "").trim();
  await ensureUniqueAttributeName(name, parsedAttributeId);
  await query(`UPDATE attributes SET name = ? WHERE id = ?`, [name, parsedAttributeId]);

  const updated = await findAttributeById(parsedAttributeId);
  const values = await getAttributeValues({ attributeId: parsedAttributeId });
  return formatAttributeGroup(updated, values);
}

async function deleteAttribute(attributeId) {
  const parsedAttributeId = toPositiveInteger(attributeId, "attributeId");
  const existing = await findAttributeById(parsedAttributeId);

  if (!existing) {
    throw createError("Attribute not found", 404);
  }

  const connection = await getDbPool().getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute(
      `
        DELETE sa FROM sku_attributes sa
        INNER JOIN attribute_values av ON av.id = sa.attribute_value_id
        WHERE av.attribute_id = ?
      `,
      [parsedAttributeId]
    );
    await connection.execute(`DELETE FROM attribute_values WHERE attribute_id = ?`, [parsedAttributeId]);
    await connection.execute(`DELETE FROM attributes WHERE id = ?`, [parsedAttributeId]);
    await connection.commit();
    return { id: parsedAttributeId, deleted: true };
  } catch (error: any) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createAttributeValue(payload) {
  const attributeId = toPositiveInteger(payload.attributeId, "attributeId");
  const value = String(payload.value || "").trim();
  const attribute = await findAttributeById(attributeId);

  if (!attribute) {
    throw createError("Attribute not found", 404);
  }

  await ensureUniqueAttributeValue(attributeId, value);

  const [result] = await getDbPool().execute(
    `INSERT INTO attribute_values (attribute_id, value) VALUES (?, ?)`,
    [attributeId, value]
  );

  const created = await findAttributeValueById((result as any).insertId);
  return {
    id: created.id,
    attributeId: created.attributeId,
    attributeName: created.attributeName,
    value: created.value,
    label: `${created.attributeName}: ${created.value}`
  };
}

async function updateAttributeValue(attributeValueId, payload) {
  const parsedAttributeValueId = toPositiveInteger(attributeValueId, "attributeValueId");
  const existing = await findAttributeValueById(parsedAttributeValueId);

  if (!existing) {
    throw createError("Attribute value not found", 404);
  }

  const nextAttributeId = Object.prototype.hasOwnProperty.call(payload, "attributeId")
    ? toPositiveInteger(payload.attributeId, "attributeId")
    : existing.attributeId;
  const nextValue = Object.prototype.hasOwnProperty.call(payload, "value")
    ? String(payload.value || "").trim()
    : existing.value;

  const attribute = await findAttributeById(nextAttributeId);

  if (!attribute) {
    throw createError("Attribute not found", 404);
  }

  await ensureUniqueAttributeValue(nextAttributeId, nextValue, parsedAttributeValueId);
  await query(`UPDATE attribute_values SET attribute_id = ?, value = ? WHERE id = ?`, [nextAttributeId, nextValue, parsedAttributeValueId]);

  const updated = await findAttributeValueById(parsedAttributeValueId);
  return {
    id: updated.id,
    attributeId: updated.attributeId,
    attributeName: updated.attributeName,
    value: updated.value,
    label: `${updated.attributeName}: ${updated.value}`
  };
}

async function deleteAttributeValue(attributeValueId) {
  const parsedAttributeValueId = toPositiveInteger(attributeValueId, "attributeValueId");
  const existing = await findAttributeValueById(parsedAttributeValueId);

  if (!existing) {
    throw createError("Attribute value not found", 404);
  }

  const connection = await getDbPool().getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute(`DELETE FROM sku_attributes WHERE attribute_value_id = ?`, [parsedAttributeValueId]);
    await connection.execute(`DELETE FROM attribute_values WHERE id = ?`, [parsedAttributeValueId]);
    await connection.commit();
    return { id: parsedAttributeValueId, deleted: true };
  } catch (error: any) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export {
  getAttributes,
  getAttributeValues,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  createAttributeValue,
  updateAttributeValue,
  deleteAttributeValue
};
export default {
  getAttributes,
  getAttributeValues,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  createAttributeValue,
  updateAttributeValue,
  deleteAttributeValue
};
