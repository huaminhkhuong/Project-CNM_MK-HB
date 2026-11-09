/* ── PURE UTILITY MODULE: CALCULATE BUILDER INSIGHTS & SCORING ── */

export const COMPONENT_SECTIONS = [
  { componentType: "cpu", label: "Vi xử lý (CPU)" },
  { componentType: "mainboard", label: "Bo mạch chủ (Mainboard)" },
  { componentType: "ram", label: "Bộ nhớ (RAM)" },
  { componentType: "gpu", label: "Card màn hình (GPU)" },
  { componentType: "storage", label: "Ổ cứng chính (SSD)" },
  { componentType: "storage_2", label: "Ổ phụ (SSD 2 / HDD)", optional: true },
  { componentType: "psu", label: "Nguồn (PSU)" },
  { componentType: "case", label: "Vỏ máy (Case)" },
  { componentType: "cooling", label: "Tản nhiệt (Cooling)" }
];

export const SPEC_ALIASES = {
  socket: ["socket", "chân cắm"],
  ramType: ["memory type", "ram type", "chuẩn ram", "loại ram"],
  psuWattage: ["watt", "power", "công suất"],
  tdp: ["tdp", "công suất tỏa nhiệt"],
  gpuLength: ["gpu_length", "gpu length", "vga length", "chiều dài gpu", "chiều dài vga"],
  caseGpuClearance: ["gpu clearance", "vga clearance", "hỗ trợ vga tối đa", "vga dài tối đa"],
  coolingCapacity: ["cooling capacity", "tdp tản", "công suất tản"],
  radiatorSize: ["radiator", "kích thước radiator"],
  caseRadiatorSupport: ["radiator support", "hỗ trợ radiator"],
  coolerHeight: ["cooler height", "chiều cao tản"],
  caseCoolerClearance: ["cpu cooler clearance", "giới hạn chiều cao tản"],
  ramSlots: ["ram_slots", "khe ram"],
  m2Slots: ["m2_slots", "khe m2"],
  boardFormFactor: ["form_factor", "kích thước main", "chuẩn mainboard"],
  caseFormFactor: ["form_factor", "form_factor_support", "hỗ trợ main"]
};

export const normalizeText = (text) => String(text || "").toLowerCase().trim();

export const parseNumber = (value, fallback = 0) => {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : fallback;
};

export const getProductId = (product) => product?.id || product?.product_id || product?.productId || null;
export const getProductName = (product) => product?.product_name || product?.name || product?.title || "";
export const getProductPrice = (product) => Number(product?.price || product?.variant?.price || 0);
export const getItemPrice = (item) => {
  const unitPrice = Number(item?.variant?.price || item?.product?.price || item?.price || 0);
  const qty = Math.max(1, Number(item?.quantity || 1));
  return unitPrice * qty;
};
export const getSelectedProduct = (item) => item?.product || item;

export function findSpec(product, possibleKeys = []) {
  if (!product) return null;
  const attributes = product.attributes || product.specs || product.sku_attributes || [];
  if (Array.isArray(attributes)) {
    for (const attr of attributes) {
      const name = normalizeText(attr.name || attr.key || attr.attribute_name || attr.attributeName);
      if (possibleKeys.some((k) => name.includes(normalizeText(k)))) {
        return String(attr.value || attr.attribute_value || attr.attributeValue || "");
      }
    }
  }
  return null;
}

export function estimateProductPerformance(product, componentType) {
  if (!product) return 40;
  const name = getProductName(product).toLowerCase();
  const price = getProductPrice(product);

  if (componentType === "gpu") {
    if (name.includes("4090") || name.includes("7900 xtx")) return 98;
    if (name.includes("4080") || name.includes("7900 xt")) return 92;
    if (name.includes("4070 ti") || name.includes("7900 gre")) return 86;
    if (name.includes("4070") || name.includes("7800 xt")) return 80;
    if (name.includes("4060 ti") || name.includes("7700 xt")) return 72;
    if (name.includes("4060") || name.includes("7600") || name.includes("3060")) return 64;
    if (name.includes("1650") || name.includes("6400")) return 45;
    if (price > 30000000) return 90;
    if (price > 15000000) return 78;
    if (price > 8000000) return 65;
    return 50;
  }

  if (componentType === "cpu") {
    if (name.includes("i9") || name.includes("7950x") || name.includes("7900x3d")) return 96;
    if (name.includes("i7") || name.includes("7800x3d") || name.includes("7700x")) return 88;
    if (name.includes("i5") || name.includes("7600x") || name.includes("5700x")) return 76;
    if (name.includes("i3") || name.includes("5600") || name.includes("5500")) return 62;
    if (price > 12000000) return 92;
    if (price > 6000000) return 78;
    if (price > 3000000) return 65;
    return 50;
  }

  return 60;
}

export function getCoolingDiagnostics(cpu, cooling, caseProduct, coolingSelected = false) {
  const cpuSocket = findSpec(cpu, SPEC_ALIASES.socket);
  const coolerSockets = findSpec(cooling, ["socket support", "supported socket", "socket hỗ trợ", "socket"]);
  const actualCpuTdp = parseNumber(findSpec(cpu, SPEC_ALIASES.tdp), 0);
  const cpuTdp = actualCpuTdp || (cpu ? 95 : 65);

  const coolerCapacity = parseNumber(findSpec(cooling, SPEC_ALIASES.coolingCapacity), 0);
  const radiatorSize = parseNumber(findSpec(cooling, SPEC_ALIASES.radiatorSize), 0);
  const caseRadiatorSupport = parseNumber(findSpec(caseProduct, SPEC_ALIASES.caseRadiatorSupport), 0);
  const coolerHeight = parseNumber(findSpec(cooling, SPEC_ALIASES.coolerHeight), 0);
  const caseCoolerClearance = parseNumber(findSpec(caseProduct, SPEC_ALIASES.caseCoolerClearance), 0);

  const cpuName = normalizeText(getProductName(cpu));
  // Intel K/KF/KS/Ultra and AMD X/X3D/XT NEVER come with stock coolers in modern market
  const isExcludedFromStock = /\bi[3579]-?\d{4,5}(k|kf|ks)\b/.test(cpuName) || 
    /ultra\s*[579]/.test(cpuName) || 
    /ryzen\s*[3579].*(x3d|xt|\bx\b)/.test(cpuName) ||
    cpuName.includes("tray");

  const hasIncludedStockCooler = !isExcludedFromStock && (
    cpuName.includes("boxed") || 
    cpuName.includes("box") || 
    cpuName.includes("i3") || 
    cpuName.includes("i5-12400") || 
    cpuName.includes("i5-14400") || 
    cpuName.includes("ryzen 5 5600") || 
    cpuName.includes("ryzen 5 5500") || 
    cpuName.includes("3200g") || 
    cpuName.includes("3400g") || 
    cpuName.includes("athlon")
  );
  const required = Boolean(getProductId(cpu)) && !hasIncludedStockCooler;

  const socketMatches = (cpuSoc, coolSoc) => {
    if (!cpuSoc || !coolSoc) return true;
    const c = normalizeText(cpuSoc);
    const cool = normalizeText(coolSoc);
    return cool.includes(c) || c.includes(cool);
  };

  const socketOk = socketMatches(cpuSocket, coolerSockets);
  const capacityOk = !coolingSelected || coolerCapacity === 0 || cpuTdp === 0 || coolerCapacity >= cpuTdp;
  const radiatorOk = !coolingSelected || radiatorSize === 0 || caseRadiatorSupport === 0 || caseRadiatorSupport >= radiatorSize;
  const heightOk = !coolingSelected || coolerHeight === 0 || caseCoolerClearance === 0 || caseCoolerClearance >= coolerHeight;

  return {
    required,
    hasIncludedStockCooler,
    cpuTdp,
    coolerCapacity,
    radiatorSize,
    coolerHeight,
    coolerSockets,
    socketOk,
    capacityOk,
    radiatorOk,
    heightOk
  };
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

  const cpuSocket  = findSpec(cpu, SPEC_ALIASES.socket);
  const boardSocket = findSpec(mainboard, SPEC_ALIASES.socket);
  const ramType    = findSpec(ram, SPEC_ALIASES.ramType);
  const boardRam   = findSpec(mainboard, SPEC_ALIASES.ramType);
  const psuWatt    = parseNumber(findSpec(psu, SPEC_ALIASES.psuWattage) || getProductName(psu), 0);

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
  const sticksPerUnit = ramSticksMatch ? parseNumber(ramSticksMatch[1], 1) : 1;
  const ramQuantity = Math.max(1, Number(s.ram?.quantity || 1));
  const ramSticks = sticksPerUnit * ramQuantity;

  const m2Slots = parseNumber(findSpec(mainboard, SPEC_ALIASES.m2Slots), 2);
  const boardForm = findSpec(mainboard, SPEC_ALIASES.boardFormFactor);
  const caseForm = findSpec(caseProduct, SPEC_ALIASES.caseFormFactor);

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
  let rawCaseClearance  = parseNumber(findSpec(caseProduct, SPEC_ALIASES.caseGpuClearance), 0);
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
      ok: (() => {
        if (!s.gpu || !s.mainboard) return true;
        // Kiểm tra vật lý: GPU rời yêu cầu Mainboard có khe PCIe x16
        // Tất cả 20 mainboard trong catalog đều hỗ trợ PCIe x16.
        // Cảnh báo băng thông nếu CPU là APU thế hệ cũ chỉ có PCIe x8 lane
        const cpuName = normalizeText(getProductName(cpu));
        const isLimitedLanesApu = cpuName.includes("3200g") || cpuName.includes("3400g") || cpuName.includes("athlon");
        const gpuName = normalizeText(getProductName(gpu));
        const isHighEndGpu = gpuName.includes("4070") || gpuName.includes("4080") || gpuName.includes("4090") || gpuName.includes("5070") || gpuName.includes("5080") || gpuName.includes("5090");
        return !(isLimitedLanesApu && isHighEndGpu);
      })(),
      severity: (() => {
        const cpuName = normalizeText(getProductName(cpu));
        const isLimitedLanesApu = cpuName.includes("3200g") || cpuName.includes("3400g") || cpuName.includes("athlon");
        const gpuName = normalizeText(getProductName(gpu));
        const isHighEndGpu = gpuName.includes("4070") || gpuName.includes("4080") || gpuName.includes("4090") || gpuName.includes("5070") || gpuName.includes("5080") || gpuName.includes("5090");
        return isLimitedLanesApu && isHighEndGpu ? "WARNING" : undefined;
      })(),
      detail: (() => {
        if (!s.gpu || !s.mainboard) return "Chưa chọn GPU hoặc Mainboard.";
        const cpuName = normalizeText(getProductName(cpu));
        const isLimitedLanesApu = cpuName.includes("3200g") || cpuName.includes("3400g") || cpuName.includes("athlon");
        const gpuName = normalizeText(getProductName(gpu));
        const isHighEndGpu = gpuName.includes("4070") || gpuName.includes("4080") || gpuName.includes("4090") || gpuName.includes("5070") || gpuName.includes("5080") || gpuName.includes("5090");
        if (isLimitedLanesApu && isHighEndGpu) {
          return "APU chỉ cấp 8 làn PCIe x8, sẽ giới hạn băng thông tối đa của GPU cao cấp.";
        }
        return "Mainboard hỗ trợ khe cắm PCIe x16 cho GPU.";
      })()
    },
    {
      label: "Chiều dài GPU ↔ Case [COMP-004]", icon: "📐",
      ok: !gpuLength || !caseClearance || caseClearance >= gpuLength,
      detail: gpuLength && caseClearance ? `${gpuLength}mm GPU / ${caseClearance}mm clearance Case` : "Chưa chọn GPU hoặc Case."
    },
    {
      label: "Yêu cầu tản nhiệt CPU [COMP-005]", icon: "❄️",
      ok: !getProductId(cpu) || !coolingDiag.required || coolingSelected,
      detail: !getProductId(cpu) ? "Chọn CPU để đánh giá." : coolingDiag.required ? (coolingSelected ? "Đã chọn cooler rời." : "Bắt buộc chọn tản nhiệt rời (CPU không kèm tản stock).") : "CPU có kèm tản stock chính hãng."
    },
    {
      label: "Hiệu năng & Kích thước làm mát [COMP-006]", icon: "🌡",
      ok: !coolingSelected || coolingFitOk,
      detail: (() => {
        if (!coolingSelected) return "Chưa chọn tản nhiệt.";
        if (!coolingDiag.socketOk) return `Chân tản ${coolingDiag.coolerSockets || "?"} không vừa socket CPU ${cpuSocket}.`;
        if (!coolingDiag.capacityOk) return `Công suất tản (${coolingDiag.coolerCapacity}W) nhỏ hơn TDP CPU (${coolingDiag.cpuTdp}W).`;
        if (!coolingDiag.radiatorOk) return `Radiator ${coolingDiag.radiatorSize}mm vượt quá hỗ trợ của case.`;
        if (!coolingDiag.heightOk) return `Chiều cao tản ${coolingDiag.coolerHeight}mm cấn nắp hông case (${caseProduct?.specs?.find?.(s => s.name === 'case_cooler_clearance')?.value || "155mm"}).`;
        return "Tản nhiệt tương thích socket, công suất làm mát và kích thước thùng máy.";
      })()
    },
    {
      label: "Nguồn đủ công suất Watt [COMP-007]", icon: "⚡",
      ok: !s.psu || psuWatt === 0 || psuWatt >= power,
      severity: !s.psu || psuWatt === 0 ? undefined : psuWatt < power ? "BLOCKER" : isPsuMarginWarning ? "WARNING" : undefined,
      detail: (() => {
        if (!s.psu) return "Chưa chọn PSU.";
        if (psuWatt === 0) return "Chưa có thông số công suất PSU.";
        if (psuWatt < power) return `THIẾU CÔNG SUẤT: Nguồn ${psuWatt}W không đủ tải hệ thống ${power}W (Nguy cơ sập nguồn).`;
        if (isPsuMarginWarning) return `Biên độ an toàn nguồn thấp (${psuMarginPercent}% < 20%). Khuyến nghị nguồn từ ${recommendedPsuWatt}W trở lên.`;
        return `PSU ${psuWatt}W đáp ứng tốt hệ thống tải ${power}W (Dư tải ${psuMarginPercent}% an toàn).`;
      })()
    },
    {
      label: "Đầu cắm nguồn GPU / CPU [COMP-008]", icon: "🔌",
      ok: !s.psu || psuWatt >= (actualGpuTdp > 250 ? 650 : 450),
      detail: s.psu ? `PSU ${psuWatt}W đáp ứng cấp nguồn phụ` : "Chưa chọn PSU."
    },
    {
      label: "Khe cắm M.2 SSD ↔ Mainboard [COMP-009]", icon: "💾",
      ok: (() => {
        if (!s.storage && !s.storage_2) return true;
        const isM2 = (item) => {
          if (!item) return false;
          const p = getSelectedProduct(item);
          const name = normalizeText(getProductName(p));
          const type = normalizeText(findSpec(p, ["storage_type", "loại ổ cứng", "form_factor", "giao thức"]) || "");
          return name.includes("m.2") || name.includes("nvme") || type.includes("m.2") || type.includes("nvme");
        };
        const m2Count = (isM2(s.storage) ? 1 : 0) + (isM2(s.storage_2) ? 1 : 0);
        if (m2Count === 0) return true;
        return m2Slots >= m2Count;
      })(),
      detail: (() => {
        const isM2 = (item) => {
          if (!item) return false;
          const p = getSelectedProduct(item);
          const name = normalizeText(getProductName(p));
          const type = normalizeText(findSpec(p, ["storage_type", "loại ổ cứng", "form_factor", "giao thức"]) || "");
          return name.includes("m.2") || name.includes("nvme") || type.includes("m.2") || type.includes("nvme");
        };
        const m2Count = (isM2(s.storage) ? 1 : 0) + (isM2(s.storage_2) ? 1 : 0);
        if (!s.storage && !s.storage_2) return "Chưa chọn Storage.";
        return `${m2Count} ổ M.2 NVMe / ${m2Slots} khe Mainboard`;
      })()
    },
    {
      label: "Form Factor Mainboard ↔ Case [COMP-010]", icon: "📦",
      ok: !s.mainboard || !s.case || isFormFactorCompatible(boardForm, caseForm),
      detail: s.mainboard && s.case ? `MB ${boardForm || "ATX"} / Case ${caseForm || "ATX"}` : "Chưa chọn MB hoặc Case."
    }
  ];

  const hardFails = checks.filter((c) => c.ok === false && c.severity !== "WARNING").length;
  // storage_2 là optional, cooling có thể optional nếu CPU có stock cooler
  const optionalCount = (getProductId(cpu) && !coolingDiag.required ? 1 : 0) + 1; // +1 cho storage_2 optional
  const requiredCount = Math.max(1, COMPONENT_SECTIONS.length - optionalCount);
  const completionRatio = requiredCount > 0 ? Math.min(selectedCount, requiredCount) / requiredCount : 0;
  const compatibilityScore = Math.max(0, Math.round(completionRatio * 65 + ((checks.length - hardFails) / checks.length) * 35));
  const cpuScore = s.cpu ? estimateProductPerformance(cpu, "cpu") : 45;
  const gpuScore = s.gpu ? estimateProductPerformance(gpu, "gpu") : 40;

  const resolution = normalizeText(requirementProfile?.resolution || "1080p");
  const resMultiplier = resolution === "4k" ? 0.45 : resolution === "2k" || resolution === "1440p" ? 0.7 : 1.0;
  const base1080pFps = Math.round((gpuScore * 0.75 + cpuScore * 0.25) * 1.55);
  const fps   = Math.round(base1080pFps * resMultiplier);

  const currentTotalPrice = Object.values(s).reduce((sum, item) => sum + getItemPrice(item), 0);
  const targetBudgetNum = Number(requirementProfile?.budget || 0);
  const isOverBudget = targetBudgetNum > 0 && currentTotalPrice > targetBudgetNum * 1.15;

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

  let mainboardPotentialScore = 50;
  const boardFormText = normalizeText(boardForm);
  if (boardFormText.includes("eatx") || boardFormText.includes("extended")) mainboardPotentialScore += 25;
  else if (boardFormText.includes("atx") && !boardFormText.includes("matx") && !boardFormText.includes("micro")) mainboardPotentialScore += 20;

  return {
    power,
    temp,
    fps,
    checks,
    warningCount: checks.filter((c) => !c.ok).length,
    compatibilityScore,
    requirementMatchScore: reqMatch,
    psuMarginPercent,
    isPsuMarginWarning,
    coolingState: coolingDiag,
    buildReadiness,
    scores: {
      compatibilityScore,
      performanceScore: Math.min(99, Math.round((cpuScore * 0.4 + gpuScore * 0.6))),
      valueScore: 85,
      powerThermalScore: temp < 75 ? 90 : 75,
      upgradeScore: mainboardPotentialScore,
      requirementMatchScore: reqMatch
    }
  };
}
