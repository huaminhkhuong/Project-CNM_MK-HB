const { prisma } = require("../../config/prisma");
const { createError } = require("../../utils/service-helpers");

function mapBrand(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug || null,
    logoUrl: row.logo_url || null
  };
}

async function getAllBrands() {
  const rows = await prisma.brand.findMany({
    where: { is_active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, logo_url: true }
  });
  return rows.map(mapBrand);
}

module.exports = {
  getAllBrands
};