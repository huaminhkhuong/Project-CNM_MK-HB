const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function showAllAttributes() {
  const attrs = await prisma.attribute.findMany({
    include: {
      AttributeValue: {
        include: {
          SkuAttribute: true
        }
      }
    }
  });

  console.log("=== TOÀN BỘ ATTRIBUTES VÀ VALUES ĐANG CÓ TRONG DB ===");
  for (const a of attrs) {
    console.log(`\n[Attr ID ${a.id}] ${a.name} (${a.AttributeValue.length} values):`);
    for (const v of a.AttributeValue) {
      console.log(`   - [Val ID ${v.id}] "${v.value}" (used by ${v.SkuAttribute.length} skus)`);
    }
  }

  await prisma.$disconnect();
}

showAllAttributes();
