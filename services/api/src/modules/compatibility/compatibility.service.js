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

      // 1.1 Kiểm tra Chiều dài GPU vs Khoảng trống Case (GPU 4 ↔ Case 7) [COMP-004]
      if ((catA === 4 && catB === 7) || (catA === 7 && catB === 4)) {
        const gpuItem = catA === 4 ? itemA : itemB;
        const caseItem = catA === 7 ? itemA : itemB;
        const gpuLengthVal = gpuItem.attributes?.gpu_length?.attributeValue || gpuItem.attributes?.length?.attributeValue;
        const caseGpuClearanceVal = caseItem.attributes?.case_gpu_clearance?.attributeValue || caseItem.attributes?.gpu_clearance?.attributeValue;

        const gpuLen = parseFloat(String(gpuLengthVal || "").match(/\d+/)?.[0] || 0);
        const caseClearance = parseFloat(String(caseGpuClearanceVal || "").match(/\d+/)?.[0] || 0);

        if (gpuLen > 0 && caseClearance > 0 && gpuLen > caseClearance) {
          const gpuClearanceRule = {
            ruleId: 1004,
            name: "Card màn hình quá dài so với Vỏ Case",
            description: `Card màn hình dài ${gpuLen}mm vượt quá khoảng không gian tối đa ${caseClearance}mm của thùng máy.`
          };
          issues.push(buildIssue(
            gpuClearanceRule,
            gpuItem,
            caseItem,
            gpuItem.attributes?.gpu_length || { attributeKey: "gpu_length", attributeValue: `${gpuLen}mm` },
            caseItem.attributes?.case_gpu_clearance || { attributeKey: "case_gpu_clearance", attributeValue: `${caseClearance}mm` }
          ));
        }
      }

      // 1.2 Kiểm tra Chiều cao Tản khí & Kích thước Radiator AIO vs Vỏ Case (Cooling 8 ↔ Case 7) [COMP-006]
      if ((catA === 8 && catB === 7) || (catA === 7 && catB === 8)) {
        const coolingItem = catA === 8 ? itemA : itemB;
        const caseItem = catA === 7 ? itemA : itemB;

        // Tản nhiệt khí: cooler_height vs case_cooler_clearance
        const coolerHeightVal = coolingItem.attributes?.cooler_height?.attributeValue || coolingItem.attributes?.height?.attributeValue;
        const caseCoolerClearanceVal = caseItem.attributes?.case_cooler_clearance?.attributeValue || caseItem.attributes?.cooler_clearance?.attributeValue;
        const coolerH = parseFloat(String(coolerHeightVal || "").match(/\d+/)?.[0] || 0);
        const caseCoolerClearance = parseFloat(String(caseCoolerClearanceVal || "").match(/\d+/)?.[0] || 0);

        if (coolerH > 0 && caseCoolerClearance > 0 && coolerH > caseCoolerClearance) {
          const coolerHeightRule = {
            ruleId: 1006,
            name: "Tản nhiệt khí quá cao so với bề rộng Vỏ Case",
            description: `Tản nhiệt CPU cao ${coolerH}mm vượt quá giới hạn chiều cao ${caseCoolerClearance}mm của thùng máy (sẽ cấn kính hông).`
          };
          issues.push(buildIssue(
            coolerHeightRule,
            coolingItem,
            caseItem,
            coolingItem.attributes?.cooler_height || { attributeKey: "cooler_height", attributeValue: `${coolerH}mm` },
            caseItem.attributes?.case_cooler_clearance || { attributeKey: "case_cooler_clearance", attributeValue: `${caseCoolerClearance}mm` }
          ));
        }

        // Tản nước AIO: radiator_size vs case_radiator_support
        const radSizeVal = coolingItem.attributes?.radiator_size?.attributeValue;
        const caseRadVal = caseItem.attributes?.case_radiator_support?.attributeValue;
        const radSize = parseFloat(String(radSizeVal || "").match(/\d{3}/)?.[0] || 0);
        const caseRad = parseFloat(String(caseRadVal || "").match(/\d{3}/)?.[0] || 0);

        if (radSize > 0 && caseRad > 0 && radSize > caseRad) {
          const radRule = {
            ruleId: 1007,
            name: "Radiator tản nước AIO quá lớn so với Vỏ Case",
            description: `Két nước Radiator ${radSize}mm không lắp vừa thùng máy chỉ hỗ trợ tối đa ${caseRad}mm.`
          };
          issues.push(buildIssue(
            radRule,
            coolingItem,
            caseItem,
            coolingItem.attributes?.radiator_size || { attributeKey: "radiator_size", attributeValue: `${radSize}mm` },
            caseItem.attributes?.case_radiator_support || { attributeKey: "case_radiator_support", attributeValue: `${caseRad}mm` }
          ));
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

      // 3. Kiểm tra các rules dạng Key & Operator (do Admin / Tech cấu hình qua giao diện)
      for (const rule of rules) {
        if (!rule.sourceAttributeKey || !rule.targetAttributeKey) continue;
        const matchesDirect = (!rule.sourceCategoryId || rule.sourceCategoryId === catA) && (!rule.targetCategoryId || rule.targetCategoryId === catB);
        const matchesReverse = (!rule.sourceCategoryId || rule.sourceCategoryId === catB) && (!rule.targetCategoryId || rule.targetCategoryId === catA);
        if (!matchesDirect && !matchesReverse) continue;

        const srcItem = matchesDirect ? itemA : itemB;
        const tgtItem = matchesDirect ? itemB : itemA;
        const srcAttr = srcItem.attributes[rule.sourceAttributeKey];
        const tgtAttr = tgtItem.attributes[rule.targetAttributeKey];

        if (srcAttr && tgtAttr) {
          const sVal = String(srcAttr.attributeValue || "").trim().toLowerCase();
          const tVal = String(tgtAttr.attributeValue || "").trim().toLowerCase();
          let matched = false;

          if (rule.operator === "EQ" || rule.operator === "=") {
            matched = sVal === tVal || sVal.includes(tVal) || tVal.includes(sVal);
          } else if (rule.operator === "NEQ" || rule.operator === "!=" || rule.operator === "<>") {
            matched = sVal !== tVal && !sVal.includes(tVal) && !tVal.includes(sVal);
          } else if (rule.operator === "GTE" || rule.operator === ">=") {
            const sNum = parseFloat(sVal) || 0;
            const tNum = parseFloat(tVal) || 0;
            matched = sNum >= tNum;
          } else if (rule.operator === "LTE" || rule.operator === "<=") {
            const sNum = parseFloat(sVal) || 0;
            const tNum = parseFloat(tVal) || 0;
            matched = sNum <= tNum;
          } else if (rule.operator === "CONTAINS") {
            matched = sVal.includes(tVal) || tVal.includes(sVal);
          } else {
            matched = sVal === tVal;
          }

          const isConflict = rule.isCompatible ? !matched : matched;
          if (isConflict) {
            const pairKey = `key_rule:${rule.ruleId}:${srcItem.buildItemId}:${tgtItem.buildItemId}`;
            if (!reportedRulePairs.has(pairKey)) {
              reportedRulePairs.add(pairKey);
              issues.push(buildIssue(rule, srcItem, tgtItem, srcAttr, tgtAttr));
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
