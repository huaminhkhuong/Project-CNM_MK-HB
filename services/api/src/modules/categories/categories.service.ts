import { query } from "../../config/database";
import { createError } from "../../utils/service-helpers";
import { buildActiveCondition, getTableColumns, pickColumn } from "../../utils/schema-helpers";

let schemaCache: any = null;

export interface CategoryItem {
  id: number | string;
  name: string;
  slug?: string | null;
  parentId?: number | string | null;
  children?: CategoryItem[];
}

function mapCategory(row: any): CategoryItem {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parentId
  };
}

function buildCategoryTree(items: CategoryItem[]): CategoryItem[] {
  const categoryMap = new Map<string, CategoryItem>();
  const roots: CategoryItem[] = [];

  for (const item of items) {
    categoryMap.set(String(item.id), {
      ...item,
      children: []
    });
  }

  for (const item of categoryMap.values()) {
    if (item.parentId !== null && item.parentId !== undefined && categoryMap.has(String(item.parentId))) {
      categoryMap.get(String(item.parentId))!.children!.push(item);
      continue;
    }

    roots.push(item);
  }

  return roots;
}

async function getSchemaConfig(): Promise<any> {
  if (schemaCache) {
    return schemaCache;
  }

  const columns = await getTableColumns("categories");
  const config = {
    table: "categories",
    id: pickColumn(columns, ["id"]),
    name: pickColumn(columns, ["name"]),
    slug: pickColumn(columns, ["slug"], null),
    parentId: pickColumn(columns, ["parent_id"], null),
    sortOrder: pickColumn(columns, ["sort_order", "display_order"], null),
    activeCondition: buildActiveCondition("c", columns)
  };

  if (!config.id || !config.name) {
    throw createError("Categories table does not have the required columns", 500);
  }

  schemaCache = config;
  return config;
}

export async function getAllCategories(): Promise<CategoryItem[]> {
  const config = await getSchemaConfig();
  const orderParts = [config.sortOrder ? `c.${config.sortOrder} ASC` : null, `c.${config.name} ASC`].filter(Boolean);

  const rows = await query<any[]>(
    `
      SELECT
        c.${config.id} AS id,
        c.${config.name} AS name,
        ${config.slug ? `c.${config.slug}` : "NULL"} AS slug,
        ${config.parentId ? `c.${config.parentId}` : "NULL"} AS parentId
      FROM ${config.table} c
      WHERE ${config.activeCondition}
      ORDER BY ${orderParts.join(", ")}
    `
  );

  return rows.map(mapCategory);
}

export async function getCategoryTree(): Promise<CategoryItem[]> {
  return buildCategoryTree(await getAllCategories());
}

export default {
  getAllCategories,
  getCategoryTree
};
