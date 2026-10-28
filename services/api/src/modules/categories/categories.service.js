const { prisma } = require("../../config/prisma");
const { createError } = require("../../utils/service-helpers");

function mapCategory(row) {
  return {
    id: row.id,
    name: row.name,
    slug: null,    // categories table has no slug in Prisma schema
    parentId: null // categories table has no parent_id in Prisma schema
  };
}

function buildCategoryTree(items) {
  const categoryMap = new Map();
  const roots = [];

  for (const item of items) {
    categoryMap.set(String(item.id), { ...item, children: [] });
  }

  for (const item of categoryMap.values()) {
    if (
      item.parentId !== null &&
      item.parentId !== undefined &&
      categoryMap.has(String(item.parentId))
    ) {
      categoryMap.get(String(item.parentId)).children.push(item);
      continue;
    }
    roots.push(item);
  }
  return roots;
}

async function getAllCategories() {
  const rows = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });
  return rows.map(mapCategory);
}

async function getCategoryTree() {
  return buildCategoryTree(await getAllCategories());
}

module.exports = {
  getAllCategories,
  getCategoryTree
};