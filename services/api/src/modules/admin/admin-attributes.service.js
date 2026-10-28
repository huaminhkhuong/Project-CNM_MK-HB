const { prisma } = require("../../config/prisma");
const { createError, toPositiveInteger } = require("../../utils/service-helpers");

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function formatAttributeGroup(attribute, values) {
  return {
    id: attribute.id,
    name: attribute.name,
    key: normalizeKey(attribute.name),
    values
  };
}

function formatAttributeValue(av) {
  return {
    id: av.id,
    attributeId: av.attribute_id,
    attributeName: av.Attribute ? av.Attribute.name : "",
    value: av.value,
    label: `${av.Attribute ? av.Attribute.name : ""}: ${av.value}`
  };
}

async function findAttributeById(attributeId) {
  return prisma.attribute.findUnique({ where: { id: Number(attributeId) } });
}

async function findAttributeValueById(attributeValueId) {
  return prisma.attributeValue.findUnique({
    where: { id: Number(attributeValueId) },
    include: { Attribute: true }
  });
}

async function ensureUniqueAttributeName(name, excludeId = null) {
  const existing = await prisma.attribute.findFirst({
    where: {
      name: { equals: name.trim(), mode: "insensitive" },
      ...(excludeId ? { NOT: { id: Number(excludeId) } } : {})
    }
  });
  if (existing) throw createError("Attribute name already exists", 409);
}

async function ensureUniqueAttributeValue(attributeId, value, excludeId = null) {
  const existing = await prisma.attributeValue.findFirst({
    where: {
      attribute_id: Number(attributeId),
      value: { equals: value.trim(), mode: "insensitive" },
      ...(excludeId ? { NOT: { id: Number(excludeId) } } : {})
    }
  });
  if (existing) throw createError("Attribute value already exists for this attribute", 409);
}

async function getAttributes() {
  const attributes = await prisma.attribute.findMany({
    orderBy: { name: "asc" },
    include: {
      AttributeValue: {
        orderBy: { value: "asc" },
        include: { Attribute: true }
      }
    }
  });

  return attributes.map((attr) =>
    formatAttributeGroup(
      attr,
      attr.AttributeValue.map(formatAttributeValue)
    )
  );
}

async function getAttributeValues(params = {}) {
  const where = {};
  if (params.attributeId) {
    where.attribute_id = toPositiveInteger(params.attributeId, "attributeId");
  }
  const rows = await prisma.attributeValue.findMany({
    where,
    orderBy: [{ Attribute: { name: "asc" } }, { value: "asc" }],
    include: { Attribute: true }
  });
  return rows.map(formatAttributeValue);
}

async function createAttribute(payload) {
  const name = String(payload.name || "").trim();
  await ensureUniqueAttributeName(name);
  const created = await prisma.attribute.create({ data: { name } });
  return formatAttributeGroup(created, []);
}

async function updateAttribute(attributeId, payload) {
  const parsedId = toPositiveInteger(attributeId, "attributeId");
  const existing = await findAttributeById(parsedId);
  if (!existing) throw createError("Attribute not found", 404);

  const name = String(payload.name || "").trim();
  await ensureUniqueAttributeName(name, parsedId);
  await prisma.attribute.update({ where: { id: parsedId }, data: { name } });

  const updated = await findAttributeById(parsedId);
  const values = await getAttributeValues({ attributeId: parsedId });
  return formatAttributeGroup(updated, values);
}

async function deleteAttribute(attributeId) {
  const parsedId = toPositiveInteger(attributeId, "attributeId");
  const existing = await findAttributeById(parsedId);
  if (!existing) throw createError("Attribute not found", 404);

  // Prisma transaction: delete sku_attributes referencing values, then values, then attribute
  await prisma.$transaction([
    prisma.skuAttribute.deleteMany({
      where: { AttributeValue: { attribute_id: parsedId } }
    }),
    prisma.attributeValue.deleteMany({ where: { attribute_id: parsedId } }),
    prisma.attribute.delete({ where: { id: parsedId } })
  ]);
  return { id: parsedId, deleted: true };
}

async function createAttributeValue(payload) {
  const attributeId = toPositiveInteger(payload.attributeId, "attributeId");
  const value = String(payload.value || "").trim();
  const attribute = await findAttributeById(attributeId);
  if (!attribute) throw createError("Attribute not found", 404);

  await ensureUniqueAttributeValue(attributeId, value);
  const created = await prisma.attributeValue.create({
    data: { attribute_id: attributeId, value },
    include: { Attribute: true }
  });
  return formatAttributeValue(created);
}

async function updateAttributeValue(attributeValueId, payload) {
  const parsedId = toPositiveInteger(attributeValueId, "attributeValueId");
  const existing = await findAttributeValueById(parsedId);
  if (!existing) throw createError("Attribute value not found", 404);

  const nextAttributeId = Object.prototype.hasOwnProperty.call(payload, "attributeId")
    ? toPositiveInteger(payload.attributeId, "attributeId")
    : existing.attribute_id;
  const nextValue = Object.prototype.hasOwnProperty.call(payload, "value")
    ? String(payload.value || "").trim()
    : existing.value;

  const attribute = await findAttributeById(nextAttributeId);
  if (!attribute) throw createError("Attribute not found", 404);

  await ensureUniqueAttributeValue(nextAttributeId, nextValue, parsedId);
  const updated = await prisma.attributeValue.update({
    where: { id: parsedId },
    data: { attribute_id: nextAttributeId, value: nextValue },
    include: { Attribute: true }
  });
  return formatAttributeValue(updated);
}

async function deleteAttributeValue(attributeValueId) {
  const parsedId = toPositiveInteger(attributeValueId, "attributeValueId");
  const existing = await findAttributeValueById(parsedId);
  if (!existing) throw createError("Attribute value not found", 404);

  await prisma.$transaction([
    prisma.skuAttribute.deleteMany({ where: { attribute_value_id: parsedId } }),
    prisma.attributeValue.delete({ where: { id: parsedId } })
  ]);
  return { id: parsedId, deleted: true };
}

module.exports = {
  getAttributes,
  getAttributeValues,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  createAttributeValue,
  updateAttributeValue,
  deleteAttributeValue
};