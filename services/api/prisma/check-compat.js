const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  const rules = await prisma.compatibilityRule.findMany({
    include: {
      attribute_values_compatibility_rules_attribute_value_1Toattribute_values: { include: { Attribute: true } },
      attribute_values_compatibility_rules_attribute_value_2Toattribute_values: { include: { Attribute: true } }
    }
  });

  console.log("EXISTING COMPAT RULES (" + rules.length + "):");
  rules.forEach(r => {
    const v1 = r.attribute_values_compatibility_rules_attribute_value_1Toattribute_values;
    const v2 = r.attribute_values_compatibility_rules_attribute_value_2Toattribute_values;
    console.log("  Rule", r.id, "|", v1?.Attribute?.name, "=", v1?.value, "<->", v2?.Attribute?.name, "=", v2?.value, "| compatible:", r.is_compatible);
  });

  const attrs = await prisma.attribute.findMany({ include: { AttributeValue: true } });
  console.log("\nATTRIBUTES IN DB (" + attrs.length + "):");
  attrs.forEach(a => {
    const vals = a.AttributeValue.map(v => v.id + ":" + v.value).join(", ").substring(0, 120);
    console.log("  [attr_id=" + a.id + "] " + a.name + " => " + vals);
  });

  await prisma.$disconnect();
}

check().catch(e => { console.error(e.message); process.exit(1); });
