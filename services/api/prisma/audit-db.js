const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function audit() {
  const [
    products, skus, categories, brands, users, roles,
    orders, pcBuilds, tickets, warranties, compatRules,
    attributes, attributeValues, skuAttributes,
    chatSessions, aiChats
  ] = await Promise.all([
    prisma.product.count(),
    prisma.productSku.count(),
    prisma.category.count(),
    prisma.brand.count(),
    prisma.user.count(),
    prisma.role.count(),
    prisma.order.count(),
    prisma.pcBuild.count(),
    prisma.ticket.count(),
    prisma.warrantyItem.count(),
    prisma.compatibilityRule.count(),
    prisma.attribute.count(),
    prisma.attributeValue.count(),
    prisma.skuAttribute.count(),
    prisma.chatSession.count(),
    prisma.aiChat.count(),
  ]);

  const roleList = await prisma.role.findMany();
  const usersByRole = await prisma.user.groupBy({ by: ["role_id"], _count: { id: true } });
  const catList = await prisma.category.findMany();
  const prodByCategory = await prisma.product.groupBy({ by: ["category_id"], _count: { id: true } });
  const brandList = await prisma.brand.findMany({ select: { id: true, name: true } });
  const skuActiveCount = await prisma.productSku.count({ where: { is_active: true } });
  const compatRuleActive = await prisma.compatibilityRule.count({ where: { is_active: true } });
  const orderByStatus = await prisma.order.groupBy({ by: ["status"], _count: { id: true } });
  const sampleProducts = await prisma.product.findMany({
    take: 5,
    select: { id: true, name: true, price: true, category_id: true, is_active: true },
    orderBy: { id: "desc" }
  });

  console.log("=== DATABASE AUDIT ===");
  console.log("COUNTS:");
  console.log("  products:", products, "  skus:", skus, "(active:", skuActiveCount + ")");
  console.log("  categories:", categories, "  brands:", brands);
  console.log("  users:", users, "  roles:", roles);
  console.log("  orders:", orders, "  pcBuilds:", pcBuilds);
  console.log("  tickets:", tickets, "  warranties:", warranties);
  console.log("  compatRules:", compatRules, "(active:", compatRuleActive + ")");
  console.log("  attributes:", attributes, "  attributeValues:", attributeValues, "  skuAttributes:", skuAttributes);
  console.log("  chatSessions:", chatSessions, "  aiChats:", aiChats);

  console.log("\nROLES:", roleList.map(r => r.id + ":" + r.name).join(", "));

  console.log("\nUSERS BY ROLE:");
  for (const u of usersByRole) {
    const role = roleList.find(r => r.id === u.role_id);
    console.log("  role_id=" + u.role_id + " (" + (role ? role.name : "unknown") + "): " + u._count.id + " users");
  }

  console.log("\nCATEGORIES:");
  for (const c of catList) {
    const prod = prodByCategory.find(p => p.category_id === c.id);
    console.log("  [" + c.id + "] " + c.name + ": " + (prod ? prod._count.id : 0) + " products");
  }

  console.log("\nBRANDS (" + brandList.length + "):", brandList.map(b => b.name).join(", "));

  console.log("\nORDERS BY STATUS:");
  for (const o of orderByStatus) {
    console.log("  " + o.status + ": " + o._count.id);
  }

  console.log("\nSAMPLE PRODUCTS (latest 5):");
  for (const p of sampleProducts) {
    console.log("  [" + p.id + "] " + p.name.substring(0, 60) + " | " + Number(p.price).toLocaleString("vi-VN") + "đ | active:" + p.is_active);
  }

  await prisma.$disconnect();
}

audit().catch(e => { console.error(e.message); process.exit(1); });
