import {
  SPEC_ALIASES,
  COMPONENT_SECTIONS
} from "./pcBuilderConstants";
import {
  getProductId,
  getProductName,
  getProductPrice,
  getSelectedProduct,
  getItemPrice,
  normalizeText,
  parseNumber,
  findSpec,
  getCoolingDiagnostics,
  estimateProductPerformance
} from "./pcBuilderUtils";

export function getCoolingCardStatus(product, selectedItems) {
  const cpu = getSelectedProduct(selectedItems.cpu);
  const caseProduct = getSelectedProduct(selectedItems.case);
  const d = getCoolingDiagnostics(cpu, product, caseProduct, true);
  if (!getProductId(cpu)) return { label: "Chờ CPU để đánh giá", cls: "meta-compat--neutral" };
  if (!d.socketOk)   return { label: "Không hợp socket", cls: "meta-compat--bad" };
  if (!d.capacityOk) return { label: "TDP chưa đủ",      cls: "meta-compat--warn" };
  if (!d.radiatorOk || !d.heightOk) return { label: "Kiểm tra với case", cls: "meta-compat--warn" };
  return { label: "Tương thích tốt", cls: "meta-compat--good" };
}

export function scoreCoolingProduct(product, selectedItems, targetPrice = 0) {
  const cpu = getSelectedProduct(selectedItems.cpu);
  const caseProduct = getSelectedProduct(selectedItems.case);
  const d = getCoolingDiagnostics(cpu, product, caseProduct, Boolean(getProductId(product)));
  let penalty = Math.abs(getProductPrice(product) - targetPrice) / 100000;
  if (d.required && !d.socketOk)   penalty += 2000;
  if (d.required && !d.capacityOk) penalty += 1400;
  if (!d.radiatorOk) penalty += 900;
  if (!d.heightOk)   penalty += 900;
  if (d.required && d.coolerCapacity > 0) penalty -= Math.min(3, d.coolerCapacity / Math.max(1, d.cpuTdp + 25));
  return penalty;
}

export function pickRecommendedCoolingProduct(products, selectedItems, targetPrice = 0) {
  if (!Array.isArray(products) || products.length === 0) return null;
  return [...products].sort((a, b) => scoreCoolingProduct(a, selectedItems, targetPrice) - scoreCoolingProduct(b, selectedItems, targetPrice))[0] || null;
}

export function calculateBuilderInsights(selectedItems = {}, selectedCount = 0, requirementProfile = {}) {
  const s = selectedItems || {};
  const cpu       = getSelectedProduct(s.cpu);
  const mainboard = getSelectedProduct(s.mainboard);
  const ram       = getSelectedProduct(s.ram);
  const gpu       = getSelectedProduct(s.gpu);
  const psu       = getSelectedProduct(s.psu);
  const caseProduct = getSelectedProduct(s.case);
  const cooling   = getSelectedProduct(s.cooling);
  const storage   = getSelectedProduct(s.storage);

  const cpuSocket  = findSpec(cpu, SPEC_ALIASES.socket);
  const boardSocket = findSpec(mainboard, SPEC_ALIASES.socket);
  const ramType    = findSpec(ram, SPEC_ALIASES.ramType);
  const boardRam   = findSpec(mainboard, SPEC_ALIASES.ramType);
  const psuWatt    = parseNumber(findSpec(psu, SPEC_ALIASES.psuWattage) || getProductName(psu), 0);
  
  // ── Tính toán Power / Thermal thực tế từ dữ liệu TDP trong DB ──
  const actualCpuTdp = parseNumber(findSpec(cpu, SPEC_ALIASES.tdp), 0);
  const actualGpuTdp = parseNumber(findSpec(gpu, SPEC_ALIASES.tdp), 0);
  const baseMotherboardOtherPower = 85;

  const power = Math.max(
    100,
    Math.round(
      (actualCpuTdp || (s.cpu ? 95 : 65)) +
      (actualGpuTdp || (s.gpu ? 180 : 0)) +
      baseMotherboardOtherPower
    )
  );

  const recommendedPsuWatt = Math.round(power * 1.25);
  const psuMarginPercent = psuWatt > 0 ? Math.round(((psuWatt - power) / psuWatt) * 100) : 0;
  const isPsuMarginWarning = s.psu && psuWatt > 0 && psuMarginPercent < 20;

  const coolingSelected = Boolean(s.cooling);
  const coolingDiag = getCoolingDiagnostics(cpu, cooling, caseProduct, coolingSelected);
  const coolingFitOk = !coolingSelected || (coolingDiag.socketOk && coolingDiag.capacityOk && coolingDiag.radiatorOk && coolingDiag.heightOk);

  const ramSlots = parseNumber(findSpec(mainboard, SPEC_ALIASES.ramSlots), 4);
  const ramName = normalizeText(getProductName(ram));
  const ramSticksMatch = ramName.match(/(\d+)\s*x\s*\d+\s*gb/i);
  const ramSticks = ramSticksMatch ? parseNumber(ramSticksMatch[1], 1) : 1;

  const m2Slots = parseNumber(findSpec(mainboard, SPEC_ALIASES.m2Slots), 2);
  const boardForm = findSpec(mainboard, SPEC_ALIASES.boardFormFactor);
  const caseForm = findSpec(caseProduct, SPEC_ALIASES.caseFormFactor);

  // ── COMP-011: M.2 PCIe Gen 4/5 Check ──
  const storageSpecStr = findSpec(storage, SPEC_ALIASES.pcieGen) || "";
  const storageName = normalizeText(getProductName(storage));
  const boardName = normalizeText(getProductName(mainboard));
  const boardHasGen5 = /z890|x870e|b860/.test(boardName) || parseNumber(findSpec(mainboard, SPEC_ALIASES.m2Gen5Slots), 0) > 0;
  const boardHasGen4 = boardHasGen5 || /z490|z590|z690|z790|x570|b550|b650|x670|b760|x870|b850/.test(boardName) || parseNumber(findSpec(mainboard, SPEC_ALIASES.m2Gen4Slots), 0) > 0;
  const isStorageGen5 = /gen\s*5|pcie\s*5|nvme\s*2\.0/.test(storageSpecStr) || /firecuda\s*540|mp700/.test(storageName);
  const isStorageGen4 = !isStorageGen5 && (/gen\s*4|pcie\s*4/.test(storageSpecStr) || /990\s*pro|sn850|firecuda\s*530|mp600/.test(storageName));
  const isM2GenOk = !s.storage || !s.mainboard || (!(isStorageGen5 && !boardHasGen5) && !(isStorageGen4 && !boardHasGen4));

  const isFormFactorCompatible = (bForm, cForm) => {
    const b = normalizeText(bForm);
    const c = normalizeText(cForm);
    if (!b || !c) return true;
    if (c.includes("atx") && !c.includes("matx") && !c.includes("micro")) return true;
    if (c.includes("matx") || c.includes("micro")) return !b.includes("atx") || b.includes("matx") || b.includes("micro");
    if (c.includes("itx")) return b.includes("itx");
    return true;
  };

  const gpuLength      = parseNumber(findSpec(gpu, SPEC_ALIASES.gpuLength), 0);
  const rawCaseClearance = parseNumber(findSpec(caseProduct, SPEC_ALIASES.caseGpuClearance), 0);
  // Failsafe: If extracted clearance is < 250mm, it's likely a CPU Cooler height clearance value (e.g., 160mm), not GPU length. Standard ATX cases accommodate 340-400mm GPUs.
  const caseClearance  = rawCaseClearance > 250 ? rawCaseClearance : caseProduct ? 360 : 0;

  const temp  = Math.min(88, Math.round(48 + power / 18 - (coolingSelected ? (coolingFitOk ? 10 : 5) : 0)));

  const checks = [
    {
      label: "Socket CPU ↔ Mainboard [COMP-001]", icon: "🔌",
      ok: !cpuSocket || !boardSocket || normalizeText(cpuSocket) === normalizeText(boardSocket),
      detail: cpuSocket && boardSocket ? `${cpuSocket} / ${boardSocket}` : "Cần dữ liệu socket từ sản phẩm."
    },
    {
      label: "Tương thích RAM ↔ Mainboard [COMP-002]", icon: "🧠",
      ok: !ramType || !boardRam || normalizeText(boardRam).includes(normalizeText(ramType)) || normalizeText(ramType).includes(normalizeText(boardRam)),
      detail: ramType && boardRam ? `${ramType} / ${boardRam}` : "Cần dữ liệu chuẩn RAM từ sản phẩm."
    },
    {
      label: "Khe cắm RAM khả dụng [COMP-002]", icon: "🎴",
      ok: !s.ram || !s.mainboard || ramSlots >= ramSticks,
      detail: s.ram && s.mainboard ? `${ramSticks} thanh RAM / ${ramSlots} khe Mainboard` : "Chưa chọn đủ RAM hoặc Mainboard."
    },
    {
      label: "PCIe Slot GPU ↔ Mainboard [COMP-003]", icon: "🎛",
      ok: true, // ATX mainboards always have ≥1 PCIe x16 slot; assume ok unless spec data says otherwise
      detail: s.gpu && s.mainboard ? "Mainboard hỗ trợ khe cắm PCIe x16 cho GPU" : "Chưa chọn GPU hoặc Mainboard."
    },
    {
      label: "Chiều dài GPU ↔ Case [COMP-004]", icon: "📐",
      ok: !gpuLength || !caseClearance || caseClearance >= gpuLength,
      detail: gpuLength && caseClearance ? `${gpuLength}mm GPU / ${caseClearance}mm clearance Case` : (s.gpu && s.case ? "Đang dùng spec mặc định (không có dữ liệu chiều dài)" : "Chưa chọn GPU hoặc Case.")
    },
    {
      label: "Yêu cầu tản nhiệt CPU [COMP-005]", icon: "❄️",
      ok: !getProductId(cpu) || !coolingDiag.required || coolingSelected,
      detail: !getProductId(cpu)
        ? "Chọn CPU để đánh giá nhu cầu tản nhiệt."
        : coolingDiag.required
          ? coolingSelected ? "CPU cần tản nhiệt riêng — đã chọn cooler." : "CPU không đi kèm tản nhiệt. Cần chọn Air Cooler hoặc AIO."
          : "CPU có tản nhiệt đi kèm. Có thể nâng cấp cooler để mát và êm hơn."
    },
    {
      label: "Két nước Radiator AIO ↔ Case [COMP-006A]", icon: "💧",
      ok: !coolingSelected || coolingDiag.radiatorOk,
      detail: !coolingSelected ? "Chưa chọn tản nhiệt."
        : coolingDiag.radiatorSize > 0
          ? (coolingDiag.radiatorOk
              ? `Radiator ${coolingDiag.radiatorSize}mm / Case hỗ trợ ${coolingDiag.caseRadiatorSupport || 360}mm`
              : `Radiator ${coolingDiag.radiatorSize}mm quá lớn so với Case (tối đa ${coolingDiag.caseRadiatorSupport || 240}mm)`)
          : "Tản nhiệt khí — không áp dụng Radiator."
    },
    {
      label: "Chiều cao Tản khí ↔ Case [COMP-006B]", icon: "📏",
      ok: !coolingSelected || coolingDiag.heightOk,
      detail: !coolingSelected ? "Chưa chọn tản nhiệt."
        : coolingDiag.coolerHeight > 0
          ? (coolingDiag.heightOk
              ? `Tản cao ${coolingDiag.coolerHeight}mm / Case cho phép tối đa ${coolingDiag.caseCoolerClearance || 165}mm`
              : `Tản cao ${coolingDiag.coolerHeight}mm cấn nắp kính Case (tối đa ${coolingDiag.caseCoolerClearance || 155}mm)`)
          : "Tản nước AIO — không áp dụng chiều cao tháp."
    },
    {
      label: "Hiệu suất giải nhiệt TDP [COMP-006C]", icon: "🌡",
      ok: !coolingSelected || (coolingDiag.socketOk && coolingDiag.capacityOk),
      detail: !coolingSelected ? "Chưa chọn tản nhiệt."
        : [
            coolingDiag.coolerSockets ? `Socket: ${coolingDiag.coolerSockets}` : null,
            coolingDiag.coolerCapacity ? `Cooling: ${coolingDiag.coolerCapacity}W` : null
          ].filter(Boolean).join(" · ")
    },
    {
      label: "Nguồn đủ công suất Watt [COMP-007]", icon: "⚡",
      ok: !s.psu || psuWatt === 0 || isPsuMarginWarning || psuWatt >= power,
      severity: !s.psu || psuWatt === 0 ? undefined : isPsuMarginWarning ? "WARNING" : psuWatt < power ? "BLOCKER" : undefined,
      detail: s.psu
        ? isPsuMarginWarning
          ? `⚠️ PSU ${psuWatt}W chỉ dư ${psuMarginPercent}% dư địa (Nên dư ≥ 20% dự phòng tụt áp)`
          : `${psuWatt}W PSU / Công suất thực tế ${power}W (Khuyên dùng ≥ ${recommendedPsuWatt}W)`
        : "Chưa chọn PSU."
    },
    {
      label: "Đầu cắm nguồn GPU / CPU [COMP-008]", icon: "🔌",
      ok: !s.psu || psuWatt >= (actualGpuTdp > 250 ? 650 : 450),
      detail: s.psu ? `PSU ${psuWatt}W đáp ứng các cổng cấp nguồn phụ 8-pin` : "Chưa chọn PSU."
    },
    {
      label: "Khe cắm M.2 SSD ↔ Mainboard [COMP-009]", icon: "💾",
      ok: !s.storage || m2Slots >= 1,
      detail: s.storage ? `Mainboard trang bị ${m2Slots} khe M.2 NVMe` : "Chưa chọn Storage."
    },
    {
      label: "Chuẩn khe M.2 PCIe Gen 4/5 [COMP-011]", icon: "⚡",
      ok: isM2GenOk,
      severity: isM2GenOk ? undefined : "WARNING",
      detail: s.storage && s.mainboard
        ? isStorageGen5
          ? boardHasGen5 ? "SSD PCIe Gen 5 — Mainboard hỗ trợ băng thông tối đa" : "⚠️ SSD PCIe Gen 5 — Mainboard chỉ hỗ trợ Gen 4 (giới hạn tốc độ)"
          : isStorageGen4
            ? boardHasGen4 ? "SSD PCIe Gen 4 — Mainboard hỗ trợ chuẩn xác" : "⚠️ SSD PCIe Gen 4 — Mainboard chỉ hỗ trợ Gen 3"
            : "Chuẩn PCIe M.2 phù hợp bo mạch chủ"
        : "Chưa chọn SSD hoặc Mainboard."
    },
    {
      label: "Form Factor Mainboard ↔ Case [COMP-010]", icon: "📦",
      ok: !s.mainboard || !s.case || isFormFactorCompatible(boardForm, caseForm),
      detail: s.mainboard && s.case ? `MB ${boardForm || "ATX"} / Case ${caseForm || "ATX"}` : "Chưa chọn Mainboard hoặc Case."
    }
  ];

  const hardFails = checks.filter((c) => c.ok === false && c.severity !== "WARNING").length;
  const requiredCount = getProductId(cpu) && !coolingDiag.required ? COMPONENT_SECTIONS.length - 1 : COMPONENT_SECTIONS.length;
  const completionRatio = requiredCount > 0 ? Math.min(selectedCount, requiredCount) / requiredCount : 0;
  const compatibilityScore = Math.max(0, Math.round(completionRatio * 65 + ((checks.length - hardFails) / checks.length) * 35));
  const cpuScore = s.cpu ? estimateProductPerformance(cpu, "cpu") : 45;
  const gpuScore = s.gpu ? estimateProductPerformance(gpu, "gpu") : 40;

  const resolution = normalizeText(requirementProfile?.resolution || "1080p");
  const resMultiplier = resolution === "4k" ? 0.45 : resolution === "2k" || resolution === "1440p" ? 0.7 : 1.0;
  const base1080pFps = Math.round((gpuScore * 0.75 + cpuScore * 0.25) * 1.55);
  const fps   = Math.round(base1080pFps * resMultiplier);

  // ── Tính toán tổng chi phí build hiện tại ──
  const currentTotalPrice = Object.values(s).reduce((sum, item) => sum + getItemPrice(item), 0);
  const targetBudgetNum = Number(requirementProfile?.budget || 0);
  const isOverBudget = targetBudgetNum > 0 && currentTotalPrice > targetBudgetNum * 1.10; // Vượt quá 10% ngân sách → BLOCKED

  // ── Tính toán Build Readiness theo đúng 11 điều kiện DoD ──
  const hasBlockerCheck = checks.some((c) => c.ok === false && c.severity !== "WARNING");
  
  let buildReadiness = "READY";
  if (hasBlockerCheck || isOverBudget) {
    buildReadiness = "BLOCKED";
  } else if (selectedCount < requiredCount || isPsuMarginWarning) {
    buildReadiness = "WARNINGS_ACKNOWLEDGED";
  }

  let reqMatch = 85;
  const purpose = normalizeText(requirementProfile?.purpose || requirementProfile?.useCase || "gaming");
  if (purpose === "gaming") {
    if (resolution === "4k") reqMatch = gpuScore >= 80 ? 95 : gpuScore >= 65 ? 78 : 55;
    else if (resolution === "2k") reqMatch = gpuScore >= 70 ? 92 : gpuScore >= 55 ? 75 : 60;
    else reqMatch = gpuScore >= 60 ? 90 : 70;
  } else if (purpose === "editing" || purpose === "render" || purpose === "ai") {
    const ramSizeMatch = parseNumber(getProductName(ram), 16);
    reqMatch = cpuScore >= 75 && ramSizeMatch >= 32 ? 96 : cpuScore >= 60 ? 80 : 62;
  } else if (purpose === "office") {
    reqMatch = power < 250 ? 95 : 82;
  }
  if (requirementProfile?.futureNeed === "upgrade_ram" && ramSlots >= 4) reqMatch = Math.min(99, reqMatch + 5);

  // ── Tính toán Upgradeability Score theo tiềm năng nâng cấp Mainboard ──
  const boardFormText = normalizeText(boardForm);
  let mainboardPotentialScore = 50;

  // 1. Form Factor Potential (ATX/EATX lớn hơn có nhiều PCIe slots & không gian cắm thêm)
  if (boardFormText.includes("eatx") || boardFormText.includes("extended")) mainboardPotentialScore += 25;
  else if (boardFormText.includes("atx") && !boardFormText.includes("matx") && !boardFormText.includes("micro")) mainboardPotentialScore += 20;
  else if (boardFormText.includes("matx") || boardFormText.includes("micro")) mainboardPotentialScore += 12;
  else if (boardFormText.includes("itx")) mainboardPotentialScore += 5;
  else mainboardPotentialScore += 15; // Mặc định ATX chuẩn

  // 2. RAM Expansion Potential (4 khe cắm RAM cho phép nâng cấp cắm đôi dễ dàng)
  if (ramSlots >= 4) mainboardPotentialScore += 15;
  else if (ramSlots >= 2) mainboardPotentialScore += 5;

  // 3. Storage Expansion Potential (M.2 NVMe Slots)
  if (m2Slots >= 3) mainboardPotentialScore += 10;
  else if (m2Slots >= 2) mainboardPotentialScore += 5;

  // 4. Power Headroom Potential (PSU dư > 25% giúp nâng GPU/CPU sau này mà không cần thay PSU)
  if (psuWatt > 0 && psuMarginPercent >= 30) mainboardPotentialScore += 10;
  else if (psuWatt > 0 && psuMarginPercent >= 20) mainboardPotentialScore += 5;

  const calculatedUpgradeScore = Math.min(99, Math.max(35, Math.round(compatibilityScore * 0.35 + mainboardPotentialScore * 0.65)));

  const scores = {
    compatibilityScore,
    performanceScore: Math.min(99, Math.round(fps / 2.2)),
    valueScore: Math.min(96, Math.round(compatibilityScore * 0.5 + (fps / 2.2) * 0.5)),
    powerThermalScore: isPsuMarginWarning ? Math.min(75, Math.round(100 - temp * 0.5 - 20)) : Math.max(30, Math.round(100 - temp * 0.6)),
    upgradeScore: calculatedUpgradeScore,
    requirementMatchScore: Math.min(99, Math.max(35, Math.round(reqMatch)))
  };

  return {
    checks, compatibilityScore, requiredCount, fps, power, temp, buildReadiness, scores,
    warningCount: checks.filter((c) => !c.ok).length,
    recommendation: hardFails
      ? "Cần xử lý các cảnh báo tương thích nghiêm trọng trước khi mua."
      : selectedCount < requiredCount
        ? "Tiếp tục bổ sung các linh kiện còn thiếu để đạt trạng thái READY."
        : "Cấu hình đạt trạng thái BUILD READY và sẵn sàng để đặt hàng!",
    coolingState: {
      required: coolingDiag.required,
      selected: coolingSelected,
      fitOk: coolingFitOk,
      tone: coolingDiag.required && !coolingSelected ? "danger" : coolingFitOk ? "success" : "warning",
      title: coolingDiag.required ? "CPU cần tản nhiệt riêng" : "Cooling là tùy chọn",
      text: coolingDiag.required
        ? coolingSelected ? "Cooling requirement satisfied." : "CPU này không đi kèm tản nhiệt. Vui lòng chọn Air Cooler hoặc AIO."
        : "CPU đã có tản nhiệt đi kèm. Nâng cấp cooler giúp máy mát và êm hơn."
    }
  };
}
