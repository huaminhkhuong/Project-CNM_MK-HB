/**
 * Compatibility Rule Evaluator
 * Evaluates both heuristic hardware rules (Socket, RAM type, PSU Wattage, GPU clearance,
 * cooling requirements, radiator size, form factors) and dynamic database rules from compatibility_rules.
 */

import {
  findComponentSpec,
  normalizeText,
  normalizeAttributeKey,
  parseNumber,
  cpuHasStockCooler,
  socketMatches,
  isFormFactorCompatible,
} from "./heuristic-specs.parser";
import { xaiExplanationService } from "./xai-explanation.service";

export interface DatabaseCompatibilityRule {
  id: number;
  name: string;
  description: string | null;
  sourceCategoryId: number | null;
  targetCategoryId: number | null;
  sourceAttributeKey: string | null;
  targetAttributeKey: string | null;
  operator: string;
  isCompatible: boolean;
  attributeValue1: number | null;
  attributeValue2: number | null;
  sourceCategoryName?: string;
  targetCategoryName?: string;
}

export interface DetailedComponent {
  componentType: string;
  skuId: number;
  productId: number;
  productName: string;
  categoryId: number;
  categoryName: string;
  specs: Array<{ key: string; value: string }>;
  attributeValueIds: Set<number>;
  attributeMap: Map<string, { attributeId: number; attributeValueId: number; value: string }>;
}

export const COMPONENT_DEFAULT_CAT_IDS: Record<string, number> = {
  cpu: 1,
  mainboard: 2,
  ram: 3,
  gpu: 4,
  vga: 4,
  storage: 5,
  ssd: 5,
  psu: 6,
  case: 7,
  cooling: 8,
};

export function extractNumericAttr(
  comp: DetailedComponent,
  aliases: string[],
  fallback = 0
): number {
  const spec = findComponentSpec(comp, aliases);
  if (!spec) return fallback;
  const num = parseNumber(spec, fallback);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Evaluate dynamic rules from compatibility_rules table in database
 */
export function evaluateDynamicDbRules(
  componentMap: Record<string, DetailedComponent>,
  activeRules: DatabaseCompatibilityRule[]
): any[] {
  const componentList = Object.values(componentMap).filter(
    (c) => c.productName || c.attributeValueIds.size > 0
  );
  const dbRuleChecks: any[] = [];
  const reportedRuleKeys = new Set<string>();

  for (let i = 0; i < componentList.length; i++) {
    for (let j = i + 1; j < componentList.length; j++) {
      const compA = componentList[i];
      const compB = componentList[j];
      const catA = compA.categoryId;
      const catB = compB.categoryId;

      for (const rule of activeRules) {
        const isDirectCategory =
          (!rule.sourceCategoryId || rule.sourceCategoryId === catA) &&
          (!rule.targetCategoryId || rule.targetCategoryId === catB);
        const isReverseCategory =
          (!rule.sourceCategoryId || rule.sourceCategoryId === catB) &&
          (!rule.targetCategoryId || rule.targetCategoryId === catA);

        if (!isDirectCategory && !isReverseCategory) {
          continue;
        }

        const isDirect = isDirectCategory;
        const srcComp = isDirect ? compA : compB;
        const tgtComp = isDirect ? compB : compA;

        // Case A: Specific attribute_value_1 and attribute_value_2 pair
        if (rule.attributeValue1 && rule.attributeValue2) {
          const hasV1InSrc = srcComp.attributeValueIds.has(rule.attributeValue1);
          const hasV2InTgt = tgtComp.attributeValueIds.has(rule.attributeValue2);
          const hasV1InTgt = tgtComp.attributeValueIds.has(rule.attributeValue1);
          const hasV2InSrc = srcComp.attributeValueIds.has(rule.attributeValue2);

          const matched = (hasV1InSrc && hasV2InTgt) || (hasV1InTgt && hasV2InSrc);
          if (matched) {
            const ruleKey = `rule_${rule.id}`;
            const isOk = rule.isCompatible; // if isCompatible=0 (false), this pair is prohibited (isOk=false)
            if (!reportedRuleKeys.has(ruleKey) || !isOk) {
              reportedRuleKeys.add(ruleKey);
              dbRuleChecks.push({
                key: ruleKey,
                ok: isOk,
                detail: isOk
                  ? rule.description || `${rule.name}: Phù hợp tương thích`
                  : rule.description || `${rule.name}: Xung đột giữa ${srcComp.productName} và ${tgtComp.productName}`,
                meta: {
                  ruleId: `RULE-${rule.id}`,
                  ruleName: rule.name,
                  ruleDescription: rule.description,
                  severity: isOk ? "INFO" : "BLOCKER",
                  sourceComponent: srcComp.componentType,
                  targetComponent: tgtComp.componentType,
                },
              });
            }
          }
        }
        // Case B: Key-based & Operator Rule (configured by Admin / Tech)
        else if (rule.sourceAttributeKey && rule.targetAttributeKey) {
          const srcVal = findComponentSpec(srcComp, [rule.sourceAttributeKey]);
          const tgtVal = findComponentSpec(tgtComp, [rule.targetAttributeKey]);

          if (srcVal && tgtVal) {
            const sValNorm = normalizeText(srcVal);
            const tValNorm = normalizeText(tgtVal);
            let conditionMatched = false;

            if (rule.operator === "EQ" || rule.operator === "=") {
              conditionMatched = sValNorm === tValNorm || sValNorm.includes(tValNorm) || tValNorm.includes(sValNorm);
            } else if (rule.operator === "NEQ" || rule.operator === "!=" || rule.operator === "<>") {
              conditionMatched = sValNorm !== tValNorm && !sValNorm.includes(tValNorm) && !tValNorm.includes(sValNorm);
            } else if (rule.operator === "GTE" || rule.operator === ">=") {
              const sNum = parseNumber(srcVal, 0);
              const tNum = parseNumber(tgtVal, 0);
              conditionMatched = sNum >= tNum;
            } else if (rule.operator === "LTE" || rule.operator === "<=") {
              const sNum = parseNumber(srcVal, 0);
              const tNum = parseNumber(tgtVal, 0);
              conditionMatched = sNum <= tNum;
            } else if (rule.operator === "CONTAINS") {
              conditionMatched = sValNorm.includes(tValNorm) || tValNorm.includes(sValNorm);
            } else {
              conditionMatched = sValNorm === tValNorm;
            }

            const isOk = rule.isCompatible ? conditionMatched : !conditionMatched;
            const ruleKey = `rule_${rule.id}`;
            if (!reportedRuleKeys.has(ruleKey) || !isOk) {
              reportedRuleKeys.add(ruleKey);
              dbRuleChecks.push({
                key: ruleKey,
                ok: isOk,
                detail: isOk
                  ? rule.description || `${rule.name}: ${srcVal} tương thích với ${tgtVal}`
                  : rule.description || `${rule.name}: ${srcVal} không tương thích với ${tgtVal}`,
                meta: {
                  ruleId: `RULE-${rule.id}`,
                  ruleName: rule.name,
                  ruleDescription: rule.description,
                  severity: isOk ? "INFO" : "BLOCKER",
                  sourceComponent: srcComp.componentType,
                  targetComponent: tgtComp.componentType,
                },
              });
            }
          }
        }
      }
    }
  }

  return dbRuleChecks;
}

/**
 * Evaluates full heuristic and database rules suite for a component set
 */
export function evaluateCompatibility(
  componentMap: Record<string, DetailedComponent>,
  activeRules: DatabaseCompatibilityRule[]
): any {
  const cpu = componentMap.cpu || { componentType: "cpu", skuId: 0, productId: 0, productName: "", categoryId: 1, categoryName: "CPU", specs: [], attributeValueIds: new Set(), attributeMap: new Map() };
  const mainboard = componentMap.mainboard || { componentType: "mainboard", skuId: 0, productId: 0, productName: "", categoryId: 2, categoryName: "MAINBOARD", specs: [], attributeValueIds: new Set(), attributeMap: new Map() };
  const ram = componentMap.ram || { componentType: "ram", skuId: 0, productId: 0, productName: "", categoryId: 3, categoryName: "RAM", specs: [], attributeValueIds: new Set(), attributeMap: new Map() };
  const gpu = componentMap.gpu || { componentType: "gpu", skuId: 0, productId: 0, productName: "", categoryId: 4, categoryName: "GPU", specs: [], attributeValueIds: new Set(), attributeMap: new Map() };
  const psu = componentMap.psu || { componentType: "psu", skuId: 0, productId: 0, productName: "", categoryId: 6, categoryName: "PSU", specs: [], attributeValueIds: new Set(), attributeMap: new Map() };
  const caseProduct = componentMap.case || { componentType: "case", skuId: 0, productId: 0, productName: "", categoryId: 7, categoryName: "CASE", specs: [], attributeValueIds: new Set(), attributeMap: new Map() };
  const cooling = componentMap.cooling || { componentType: "cooling", skuId: 0, productId: 0, productName: "", categoryId: 8, categoryName: "COOLING", specs: [], attributeValueIds: new Set(), attributeMap: new Map() };

  const cpuSocket = findComponentSpec(cpu, ["socket", "socket hỗ trợ", "chân cắm"]);
  const boardSocket = findComponentSpec(mainboard, ["socket", "socket hỗ trợ", "chân cắm"]);
  const ramType = findComponentSpec(ram, ["ram_type", "chuẩn ram", "ddr", "memory type", "ram type"]);
  const boardRam = findComponentSpec(mainboard, ["ram_type", "chuẩn ram", "ddr", "memory"]);

  const psuWatt = extractNumericAttr(psu, ["psu_wattage", "wattage", "công suất", "công suất nguồn", "watt"], 0);
  const gpuTdp = extractNumericAttr(gpu, ["tdp", "power", "tiêu thụ", "tdp tiêu thụ", "công suất"], 150);
  const cpuTdp = extractNumericAttr(cpu, ["tdp", "power", "tiêu thụ", "tdp tiêu thụ", "công suất"], 65);
  const requiredWatt = componentMap.gpu ? Math.round((gpuTdp + cpuTdp + 100) * 1.25) : Math.round((cpuTdp + 90) * 1.25);

  const gpuLength = extractNumericAttr(gpu, ["gpu_length", "vga length", "card length", "chiều dài gpu", "length", "kích thước vga"], 0);
  const caseClearance = extractNumericAttr(caseProduct, ["case_gpu_clearance", "gpu clearance", "vga clearance", "không gian vga tối đa", "max gpu length", "max vga length"], 0);
  const hasCooling = Boolean(componentMap.cooling && (cooling.productName || cooling.skuId > 0));
  const requiresCooling = Boolean(cpu.productName || cpu.skuId > 0) ? !cpuHasStockCooler(cpu.specs, cpu.productName) : false;
  const coolerSockets = findComponentSpec(cooling, ["socket_support", "socket support", "supported socket", "socket hỗ trợ", "socket"]);
  const coolerCapacity = extractNumericAttr(cooling, ["cooling_capacity", "cooling capacity", "tdp tản", "tdp capacity", "tdp giải nhiệt tối đa"], 0);
  const radiatorSize = extractNumericAttr(cooling, ["radiator_size", "radiator", "radiator size", "kích thước radiator", "rad size"], 0);
  const caseRadiatorSupport = extractNumericAttr(caseProduct, ["case_radiator_support", "radiator support", "case hỗ trợ radiator", "hỗ trợ tản nước", "max radiator"], 0);
  const coolerHeight = extractNumericAttr(cooling, ["cooler_height", "cooler height", "chiều cao tản", "height", "tower height"], 0);
  const caseCoolerClearance = extractNumericAttr(caseProduct, ["case_cooler_clearance", "cpu cooler clearance", "giới hạn chiều cao tản", "cooler clearance", "max cooler height"], 0);
  const ramSlots = extractNumericAttr(mainboard, ["ram_slots", "số khe ram", "khe ram", "ram slots"], 4);
  const m2Slots = extractNumericAttr(mainboard, ["m2_slots", "số khe m.2 nvme", "khe m2", "m.2 slots", "m2"], 2);
  const boardFormFactor = findComponentSpec(mainboard, ["form_factor", "kích thước form factor", "kích thước main", "chuẩn mainboard"]);
  const caseFormFactor = findComponentSpec(caseProduct, ["form_factor", "hỗ trợ mainboard", "form_factor_support", "hỗ trợ main", "hỗ trợ form factor"]);

  // Storage M.2 PCIe Generation
  const storageComp = componentMap.storage || componentMap.ssd;
  const storageInterface = storageComp
    ? findComponentSpec(storageComp, ["interface", "giao tiếp", "chuẩn giao tiếp", "pcie_gen", "pcie generation", "storage_type"])
    : "";
  const boardM2Gen = findComponentSpec(mainboard, ["m2_gen", "m2_slots", "pcie_slot", "chuẩn cắm"]);
  const storageIsGen5 = normalizeText(storageInterface).includes("gen 5") || normalizeText(storageInterface).includes("gen5");
  const boardSupportsGen5 = normalizeText(boardM2Gen).includes("gen 5") || normalizeText(boardM2Gen).includes("gen5");
  const storageIsGen4 = normalizeText(storageInterface).includes("gen 4") || normalizeText(storageInterface).includes("gen4");
  const boardSupportsGen4 = normalizeText(boardM2Gen).includes("gen 4") || normalizeText(boardM2Gen).includes("gen4") || boardSupportsGen5;
  const isM2GenCompatible = !storageComp || !componentMap.mainboard || !storageIsGen5 || boardSupportsGen5;

  // RAM stick count
  const ramSticks = extractNumericAttr(ram, ["ram_sticks", "số thanh ram", "quantity", "sticks"], 1);
  const isRamSlotsOk = !componentMap.ram || !componentMap.mainboard || ramSlots >= ramSticks;

  // Dynamic DB rules evaluation
  const dbRuleChecks = evaluateDynamicDbRules(componentMap, activeRules);

  const findDbRuleResult = (categoryA: string, categoryB: string) => {
    const failed = dbRuleChecks.find(
      (c) =>
        !c.ok &&
        ((c.meta?.sourceComponent === categoryA && c.meta?.targetComponent === categoryB) ||
          (c.meta?.sourceComponent === categoryB && c.meta?.targetComponent === categoryA))
    );
    const passed = dbRuleChecks.find(
      (c) =>
        c.ok &&
        ((c.meta?.sourceComponent === categoryA && c.meta?.targetComponent === categoryB) ||
          (c.meta?.sourceComponent === categoryB && c.meta?.targetComponent === categoryA))
    );
    return { failed, passed };
  };

  const socketDb = findDbRuleResult("cpu", "mainboard");
  const ramDb = findDbRuleResult("ram", "mainboard");
  const formFactorDb = findDbRuleResult("case", "mainboard");
  const radiatorDb = findDbRuleResult("cooling", "case");
  const coolingSocketDb = findDbRuleResult("cooling", "cpu");

  const isSocketOk = socketDb.failed ? false : (socketDb.passed ? true : (!cpuSocket || !boardSocket || normalizeText(cpuSocket) === normalizeText(boardSocket)));
  const isRamOk = ramDb.failed ? false : (ramDb.passed ? true : (!ramType || !boardRam || normalizeText(boardRam).includes(normalizeText(ramType)) || normalizeText(ramType).includes(normalizeText(boardRam))));
  const isFormFactorOk = formFactorDb.failed ? false : (formFactorDb.passed ? true : (!componentMap.mainboard || !componentMap.case || isFormFactorCompatible(boardFormFactor, caseFormFactor)));
  const isRadiatorOk = radiatorDb.failed ? false : (radiatorDb.passed ? true : (!hasCooling || radiatorSize === 0 || caseRadiatorSupport === 0 || caseRadiatorSupport >= radiatorSize));
  const isCoolingSocketOk = coolingSocketDb.failed ? false : (coolingSocketDb.passed ? true : (!hasCooling || socketMatches(cpuSocket, coolerSockets)));

  const checks = [
    {
      key: "socket",
      ok: isSocketOk,
      detail: socketDb.failed ? socketDb.failed.detail : (socketDb.passed ? socketDb.passed.detail : (cpuSocket && boardSocket ? `${cpuSocket} / ${boardSocket}` : "Cần thông số socket"))
    },
    {
      key: "ram",
      ok: isRamOk,
      detail: ramDb.failed ? ramDb.failed.detail : (ramDb.passed ? ramDb.passed.detail : (ramType && boardRam ? `${ramType} / ${boardRam}` : "Cần thông số RAM"))
    },
    {
      key: "psu",
      ok: !componentMap.psu || psuWatt === 0 || psuWatt >= requiredWatt,
      detail: componentMap.psu ? `${psuWatt || "?"}W / cần ${requiredWatt}W` : "Chưa chọn nguồn"
    },
    {
      // COMP-004: GPU Card Length vs Case GPU Clearance
      key: "gpu_clearance",
      ok: !componentMap.gpu || !componentMap.case || !gpuLength || !caseClearance || caseClearance >= gpuLength,
      detail: (() => {
        if (!componentMap.gpu || !componentMap.case) return "GPU hoặc Case chưa được chọn";
        if (gpuLength > 0 && caseClearance > 0) return `GPU dài ${gpuLength}mm / Case cho phép tối đa ${caseClearance}mm`;
        if (gpuLength > 0) return `GPU dài ${gpuLength}mm — chưa có thông số khoảng trống Case`;
        if (caseClearance > 0) return `Case hỗ trợ tối đa ${caseClearance}mm — chưa xác định chiều dài GPU`;
        return "Chưa có thông số kích thước GPU/Case";
      })()
    },
    {
      key: "cooling_required",
      ok: !cpu.productName || !requiresCooling || hasCooling,
      detail: requiresCooling ? (hasCooling ? "Đã chọn tản nhiệt rời phù hợp" : "CPU dòng K/KF/hiệu năng cao cần tản nhiệt rời") : "CPU có tản nhiệt nguyên hộp kèm theo"
    },
    {
      key: "cooling_socket",
      ok: isCoolingSocketOk,
      detail: coolingSocketDb.failed ? coolingSocketDb.failed.detail : (coolingSocketDb.passed ? coolingSocketDb.passed.detail : (hasCooling ? (coolerSockets || "Chưa có dữ liệu socket tản nhiệt") : "Chưa chọn tản nhiệt"))
    },
    {
      key: "cooling_tdp",
      ok: !hasCooling || coolerCapacity === 0 || cpuTdp === 0 || coolerCapacity >= cpuTdp,
      detail: hasCooling ? `Tản nhiệt ${coolerCapacity || "?"}W / CPU tỏa nhiệt ${cpuTdp || "?"}W` : "Chưa chọn tản nhiệt"
    },
    {
      // COMP-006A: AIO Radiator Size vs Case Radiator Support (240 / 280 / 360mm)
      key: "radiator_fit",
      ok: isRadiatorOk,
      detail: (() => {
        if (radiatorDb.failed) return radiatorDb.failed.detail;
        if (radiatorDb.passed) return radiatorDb.passed.detail;
        if (!hasCooling) return "Chưa chọn tản nhiệt";
        if (radiatorSize === 0) return "Tản nhiệt khí — không áp dụng kiểm tra Radiator";
        if (caseRadiatorSupport === 0) return `Radiator ${radiatorSize}mm — chưa có thông số hỗ trợ của Case`;
        return `Radiator ${radiatorSize}mm / Case hỗ trợ tối đa ${caseRadiatorSupport}mm`;
      })()
    },
    {
      // COMP-006B: Air Cooler Tower Height vs Case CPU Cooler Clearance
      key: "cooler_height",
      ok: !hasCooling || coolerHeight === 0 || caseCoolerClearance === 0 || caseCoolerClearance >= coolerHeight,
      detail: (() => {
        if (!hasCooling) return "Chưa chọn tản nhiệt";
        if (coolerHeight === 0) return "Tản nước AIO — chiều cao tháp không áp dụng";
        if (caseCoolerClearance === 0) return `Tản cao ${coolerHeight}mm — chưa có thông số khoảng trống Case`;
        return `Tản cao ${coolerHeight}mm / Case cho phép tối đa ${caseCoolerClearance}mm`;
      })()
    },
    {
      key: "ram_slots",
      ok: isRamSlotsOk,
      detail: componentMap.ram && componentMap.mainboard ? `${ramSticks} thanh RAM / ${ramSlots} khe Mainboard` : "RAM hoặc Mainboard chưa được chọn"
    },
    {
      key: "psu_connectors",
      ok: !componentMap.psu || psuWatt >= (gpuTdp > 250 ? 650 : 450),
      detail: componentMap.psu ? `PSU ${psuWatt}W — kiểm tra đầu cắm PCIe / EPS` : "Chưa chọn nguồn"
    },
    {
      // COMP-009: M.2 NVMe Slot Availability on Mainboard
      key: "storage_m2",
      ok: !storageComp || !componentMap.mainboard || m2Slots >= 1,
      detail: storageComp && componentMap.mainboard
        ? `Mainboard có ${m2Slots} khe M.2 NVMe`
        : "Ổ cứng hoặc Mainboard chưa được chọn"
    },
    {
      // COMP-011: M.2 PCIe Generation 4 / Generation 5 Support
      key: "storage_m2_gen",
      ok: isM2GenCompatible,
      detail: (() => {
        if (!storageComp || !componentMap.mainboard) return "Ổ cứng hoặc Mainboard chưa được chọn";
        if (storageIsGen5) {
          return boardSupportsGen5
            ? `SSD PCIe Gen 5 — Mainboard ${mainboard.productName || ""} hỗ trợ ✓`
            : `SSD PCIe Gen 5 — Mainboard thiếu khe M.2 Gen 5 (sẽ giới hạn ở tốc độ Gen 4 ~7GB/s)`;
        }
        if (storageIsGen4) {
          return boardSupportsGen4
            ? `SSD PCIe Gen 4 — Mainboard ${mainboard.productName || ""} hỗ trợ ✓`
            : `SSD PCIe Gen 4 — Mainboard chỉ hỗ trợ PCIe Gen 3 (tốc độ giới hạn ~3.5GB/s)`;
        }
        return `M.2 NVMe: ${m2Slots} khe — chuẩn PCIe chưa xác định từ thông số sản phẩm`;
      })()
    },
    {
      key: "case_form_factor",
      ok: isFormFactorOk,
      detail: formFactorDb.failed ? formFactorDb.failed.detail : (formFactorDb.passed ? formFactorDb.passed.detail : (componentMap.mainboard && componentMap.case ? `MB ${boardFormFactor || "ATX"} / Case ${caseFormFactor || "ATX"}` : "Mainboard hoặc Case chưa được chọn"))
    },
    {
      key: "bottleneck",
      ok: (() => {
        if (!componentMap.cpu || !componentMap.gpu) return true;
        const cTier = cpuTdp > 150 ? 5 : cpuTdp > 100 ? 4 : cpuTdp > 60 ? 3 : 2;
        const gTier = gpuTdp > 300 ? 5 : gpuTdp > 200 ? 4 : gpuTdp > 120 ? 3 : 2;
        return Math.abs(cTier - gTier) <= 1;
      })(),
      detail: (() => {
        if (!componentMap.cpu || !componentMap.gpu) return "CPU hoặc GPU chưa được chọn";
        const cTier = cpuTdp > 150 ? 5 : cpuTdp > 100 ? 4 : cpuTdp > 60 ? 3 : 2;
        const gTier = gpuTdp > 300 ? 5 : gpuTdp > 200 ? 4 : gpuTdp > 120 ? 3 : 2;
        const diff = Math.abs(cTier - gTier);
        return `CPU TDP ${cpuTdp}W (Tier ${cTier}) / GPU TDP ${gpuTdp}W (Tier ${gTier}) — ${diff <= 1 ? "Cân bằng hiệu năng tốt" : "Có độ lệch hiệu năng"}`;
      })()
    }
  ];

  const allChecks = [...checks, ...dbRuleChecks];
  const xaiReport = xaiExplanationService.buildCompleteReport(allChecks, componentMap);

  return {
    compatible: xaiReport.compatible,
    score: xaiReport.score,
    buildReadiness: xaiReport.buildReadiness,
    scores: xaiReport.scores,
    checks: xaiReport.checks,
    summary: xaiReport.summary,
    performanceEstimate: xaiReport.performanceEstimate,
    message: xaiReport.summary.overallMessage
  };
}
