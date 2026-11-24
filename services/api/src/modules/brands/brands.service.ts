import { query } from "../../config/database";
import { createError } from "../../utils/service-helpers";
import { buildActiveCondition, getTableColumns, pickColumn } from "../../utils/schema-helpers";

let schemaCache: any = null;

export interface BrandItem {
  id: number | string;
  name: string;
  slug?: string | null;
  logoUrl?: string | null;
}

function mapBrand(row: any): BrandItem {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logoUrl
  };
}

async function getSchemaConfig(): Promise<any> {
  if (schemaCache) {
    return schemaCache;
  }

  const columns = await getTableColumns("brands");

  if (columns.length === 0) {
    schemaCache = null;
    return null;
  }

  const config = {
    table: "brands",
    id: pickColumn(columns, ["id"]),
    name: pickColumn(columns, ["name"]),
    slug: pickColumn(columns, ["slug"], null),
    logo: pickColumn(columns, ["logo_url", "logo", "image_url"], null),
    sortOrder: pickColumn(columns, ["sort_order", "display_order"], null),
    activeCondition: buildActiveCondition("b", columns)
  };

  if (!config.id || !config.name) {
    throw createError("Brands table does not have the required columns", 500);
  }

  schemaCache = config;
  return config;
}

export async function getAllBrands(): Promise<BrandItem[]> {
  const config = await getSchemaConfig();

  if (!config) {
    return [];
  }

  const orderParts = [config.sortOrder ? `b.${config.sortOrder} ASC` : null, `b.${config.name} ASC`].filter(Boolean);

  const rows = await query<any[]>(
    `
      SELECT
        b.${config.id} AS id,
        b.${config.name} AS name,
        ${config.slug ? `b.${config.slug}` : "NULL"} AS slug,
        ${config.logo ? `b.${config.logo}` : "NULL"} AS logoUrl
      FROM ${config.table} b
      WHERE ${config.activeCondition}
      ORDER BY ${orderParts.join(", ")}
    `
  );

  return rows.map(mapBrand);
}

export default {
  getAllBrands
};
