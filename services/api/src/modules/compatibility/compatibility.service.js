const { query } = require("../../config/database");
const { createError, toPositiveInteger } = require("../../utils/service-helpers");

function normalizeAttributeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

async function findBuild(userId, buildId) {
  const rows = await query(
    `
      SELECT id, user_id AS userId, name
      FROM pc_builds
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `,
    [buildId, userId]
  );

  return rows[0] || null;
}

async function getBuildItemsWithAttributes(buildId) {
  const rows = await query(
    `
      SELECT
        i.id AS buildItemId,
        i.component_type AS componentType,
        s.id AS skuId,
        p.id AS productId,
        p.name AS productName,
        c.id AS categoryId,
        c.name AS categoryName,
        a.id AS attributeId,
        a.name AS attributeName,
        av.id AS attributeValueId,
        av.value AS attributeValue
      FROM pc_build_items i
      INNER JOIN product_skus s ON s.id = i.sku_id
      INNER JOIN products p ON p.id = s.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN sku_attributes sa ON sa.sku_id = s.id
      LEFT JOIN attribute_values av ON av.id = sa.attribute_value_id
      LEFT JOIN attributes a ON a.id = av.attribute_id
      WHERE i.build_id = ?
      ORDER BY i.id ASC, a.name ASC
    `,
    [buildId]
  );

  const itemMap = new Map();

  for (const row of rows) {
    if (!itemMap.has(row.buildItemId)) {
      itemMap.set(row.buildItemId, {
        buildItemId: row.buildItemId,
        componentType: row.componentType,
        variant: {
          id: row.skuId,
          sku: `SKU-${row.skuId}`
        },
        product: {
          id: row.productId,
          name: row.productName,
          categoryId: row.categoryId,
          categoryName: row.categoryName
        },
        attributes: {}
      });
    }

    if (row.attributeId && row.attributeValueId) {
      const item = itemMap.get(row.buildItemId);
      const attributeKey = normalizeAttributeKey(row.attributeName);
      item.attributes[attributeKey] = {
        attributeId: row.attributeId,
        attributeKey,
        attributeValueId: row.attributeValueId,
        attributeValue: row.attributeValue
      };
    }
  }

  return Array.from(itemMap.values());
}

async function getCompatibilityMap() {
  const rows = await query(
    `
      SELECT 
        id, 
        name,
        description,
        attribute_value_1 AS attributeValue1, 
        attribute_value_2 AS attributeValue2,
        source_category_id AS sourceCategoryId,
        target_category_id AS targetCategoryId,
        source_attribute_key AS sourceAttributeKey,
        target_attribute_key AS targetAttributeKey,
        operator,
        is_compatible AS isCompatible
      FROM compatibility_rules
      WHERE is_active = 1
      ORDER BY id ASC
    `
  );

  return rows.map((row) => ({
    ruleId: row.id,
    name: row.name,
    description: row.description,
    attributeValue1: row.attributeValue1 ? Number(row.attributeValue1) : null,
    attributeValue2: row.attributeValue2 ? Number(row.attributeValue2) : null,
    sourceCategoryId: row.sourceCategoryId ? Number(row.sourceCategoryId) : null,
    targetCategoryId: row.targetCategoryId ? Number(row.targetCategoryId) : null,
    sourceAttributeKey: row.sourceAttributeKey,
    targetAttributeKey: row.targetAttributeKey,
    operator: row.operator,
    isCompatible: Number(row.isCompatible) === 1
  }));
}

function isFormFactorCompatible(boardForm, caseForm) {
  const b = String(boardForm || "").toLowerCase().trim();
  const c = String(caseForm || "").toLowerCase().trim();
  if (!b || !c) return true;
  if (c.includes("atx") && !c.includes("matx") && !c.includes("micro")) {
    // Case ATX gắn được ATX, mATX, ITX
    return true;
  }
  if (c.includes("matx") || c.includes("micro")) {
    // Case mATX gắn được mATX, ITX; KHÔNG gắn được ATX
    return !b.includes("atx") || b.includes("matx") || b.includes("micro");
  }
  if (c.includes("itx")) {
    // Case ITX chỉ gắn được ITX
    return b.includes("itx");
  }
  return true;
}

function buildIssue(rule, sourceItem, targetItem, sourceAttribute, targetAttribute) {
  const desc = rule?.description || rule?.name;
  return {
    ruleId: rule?.ruleId || rule?.id,
    ruleDescription: desc,
    source: {
      componentType: sourceItem.componentType,
      categoryName: sourceItem.product.categoryName,
      productName: sourceItem.product.name,
      sku: sourceItem.variant.sku,
      attributeKey: sourceAttribute.attributeKey,
      attributeValue: sourceAttribute.attributeValue
    },
    target: {
      componentType: targetItem.componentType,
      categoryName: targetItem.product.categoryName,
      productName: targetItem.product.name,
      sku: targetItem.variant.sku,
      attributeKey: targetAttribute.attributeKey,
      attributeValue: targetAttribute.attributeValue
    },
    message: desc || `${sourceItem.product.categoryName || sourceItem.componentType} (${sourceAttribute.attributeValue}) không tương thích với ${targetItem.product.categoryName || targetItem.componentType} (${targetAttribute.attributeValue})`
  };
}

async function checkBuildCompatibility(userId, buildId) {
  const parsedBuildId = toPositiveInteger(buildId, "buildId");
  const build = await findBuild(userId, parsedBuildId);

  if (!build) {
    throw createError("PC build not found", 404);
  }

  const [buildItems, rules] = await Promise.all([
    getBuildItemsWithAttributes(parsedBuildId),
    getCompatibilityMap()
  ]);

  const issues = [];
  const reportedRulePairs = new Set();

  for (let i = 0; i < buildItems.length; i += 1) {
    for (let j = i + 1; j < buildItems.length; j += 1) {
      const itemA = buildItems[i];
      const itemB = buildItems[j];
      const catA = itemA.product.categoryId;
      const catB = itemB.product.categoryId;

      // 1. Kiểm tra Form Factor đặc thù (Mainboard 2 ↔ Case 7)
      if ((catA === 2 && catB === 7) || (catA === 7 && catB === 2)) {
        const boardItem = catA === 2 ? itemA : itemB;
        const caseItem = catA === 7 ? itemA : itemB;
        const boardForm = boardItem.attributes?.form_factor?.attributeValue;
        const caseForm = caseItem.attributes?.form_factor?.attributeValue;

        if (boardForm && caseForm && !isFormFactorCompatible(boardForm, caseForm)) {
          const formRule = rules.find((r) => r.sourceCategoryId === 2 && r.targetCategoryId === 7 && !r.isCompatible) || {
            ruleId: 999,
            name: "Không tương thích kích thước bo mạch và vỏ case",
            description: `Bo mạch chủ chuẩn ${boardForm} quá lớn, không thể lắp vừa thùng máy chuẩn ${caseForm}.`
          };
          issues.push(buildIssue(formRule, boardItem, caseItem, boardItem.attributes.form_factor, caseItem.attributes.form_factor));
          continue;
        }
      }

      // 2. Kiểm tra thông qua bộ rules trong DB
      const attrsA = Object.values(itemA.attributes);
      const attrsB = Object.values(itemB.attributes);

      for (const attrA of attrsA) {
        for (const attrB of attrsB) {
          const valAId = Number(attrA.attributeValueId);
          const valBId = Number(attrB.attributeValueId);

          for (const rule of rules) {
            if (!rule.attributeValue1 || !rule.attributeValue2) continue;

            const isDirectionalMatch = (
              (rule.attributeValue1 === valAId && rule.attributeValue2 === valBId && (!rule.sourceCategoryId || rule.sourceCategoryId === catA)) ||
              (rule.attributeValue1 === valBId && rule.attributeValue2 === valAId && (!rule.sourceCategoryId || rule.sourceCategoryId === catB))
            );

            if (isDirectionalMatch && !rule.isCompatible) {
              const pairKey = `${rule.ruleId}:${valAId}:${valBId}`;
              if (!reportedRulePairs.has(pairKey)) {
                reportedRulePairs.add(pairKey);
                // Bỏ qua nếu là form factor (đã xử lý chuyên biệt ở trên)
                if (attrA.attributeKey === "form_factor" && attrB.attributeKey === "form_factor") {
                  continue;
                }
                issues.push(buildIssue(rule, itemA, itemB, attrA, attrB));
              }
            }
          }
        }
      }
    }
  }

  return {
    buildId: build.id,
    buildName: build.name,
    compatible: issues.length === 0,
    checkedRuleCount: rules.length,
    checkedComponentCount: buildItems.length,
    issues
  };
}

module.exports = {
  checkBuildCompatibility
};
