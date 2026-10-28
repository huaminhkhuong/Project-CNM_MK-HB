/**
 * Heuristic Specs Parser
 * Provides text normalization, spec extraction, and hardware metric helpers
 * for PC Builder component evaluation and auto-configuration.
 */

export function normalizeText(value: any): string {
  return String(value || "").trim().toLowerCase();
}

export function normalizeSocket(raw: string): string {
  const rawUpper = String(raw || "").trim().toUpperCase();
  if (!rawUpper) return "";
  return rawUpper.split(" ").join("").split("-").join("");
}

export function normalizeAttributeKey(value: any): string {
  const raw = String(value || "").trim().toLowerCase();
  const chars: string[] = [];
  let lastWasUnderscore = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === " " || c === "-" || c === "_") {
      if (!lastWasUnderscore && chars.length > 0) {
        chars.push("_");
        lastWasUnderscore = true;
      }
    } else {
      chars.push(c);
      lastWasUnderscore = false;
    }
  }
  if (chars.length > 0 && chars[chars.length - 1] === "_") {
    chars.pop();
  }
  return chars.join("");
}

export function parseNumber(value: any, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const str = String(value || "").trim();
  if (!str) return fallback;
  let numericStr = "";
  let hasDot = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char >= "0" && char <= "9") {
      numericStr += char;
    } else if (char === "." && !hasDot && numericStr.length > 0) {
      numericStr += char;
      hasDot = true;
    } else if (numericStr.length > 0) {
      break;
    }
  }
  const parsed = numericStr ? Number(numericStr) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toMoney(value: any): number {
  return Number(Number(value || 0).toFixed(2));
}

export function specBag(specs: Array<{ key: string; value: string }> = []): Record<string, string> {
  return specs.reduce<Record<string, string>>((accumulator, spec) => {
    const key = normalizeText(spec.key);
    if (key) accumulator[key] = String(spec.value || "");
    return accumulator;
  }, {});
}

export function findSpec(specs: Array<{ key: string; value: string }> = [], aliases: string[]): string {
  const bag = specBag(specs);
  const keys = aliases.map((alias) => normalizeText(alias));
  const hit = Object.entries(bag).find(([key]) => keys.some((alias) => key.includes(alias)));
  return hit?.[1] || "";
}

export function findComponentSpec(
  comp: {
    specs?: Array<{ key: string; value: string }>;
    attributeMap?: Map<string, { attributeId: number; attributeValueId: number; value: string }>;
  },
  aliases: string[]
): string {
  if (comp.attributeMap) {
    // 1. Exact match on normalized attribute key first (highest priority)
    for (const alias of aliases) {
      const normAlias = normalizeAttributeKey(alias);
      const exact = comp.attributeMap.get(normAlias);
      if (exact?.value) return exact.value;
    }
    // 2. Fuzzy match fallback
    for (const alias of aliases) {
      const normAlias = normalizeAttributeKey(alias);
      for (const [key, attr] of comp.attributeMap.entries()) {
        if (key === normAlias || key.includes(normAlias) || normAlias.includes(key)) {
          if (attr.value) return attr.value;
        }
      }
    }
  }
  return findSpec(comp.specs || [], aliases);
}

export function hasTruthySpec(value: any): boolean {
  const text = normalizeText(value);
  if (!text) return false;
  if (["khong", "không", "no", "false", "none", "0"].some((token) => text === token || text.includes(token))) return false;
  return ["co", "có", "yes", "true", "included", "stock", "kem", "kèm", "boxed", "1"].some((token) => text === token || text.includes(token));
}

export function cpuHasStockCooler(specs: Array<{ key: string; value: string }>, _productName?: string): boolean {
  const specValue = findSpec(specs, ["stock_cooler", "stock cooler", "cooler included", "tản đi kèm", "boxed cooler"]);
  if (specValue) return hasTruthySpec(specValue);
  return true;
}

export function socketMatches(requiredSocket: string, supportedSockets: string): boolean {
  const left = normalizeText(requiredSocket);
  const right = normalizeText(supportedSockets);
  if (!left || !right) return true;
  return right.includes(left) || left.includes(right);
}

export function getCpuSocket(item: any): string {
  const specSock = item?.specs?.["socket"] || item?.specs?.["socket hỗ trợ"] || item?.specs?.["spec_socket"];
  if (specSock) {
    return normalizeSocket(specSock);
  }
  return "";
}

export function getMainboardSocket(item: any): string {
  const specSock = item?.specs?.["socket"] || item?.specs?.["socket hỗ trợ"] || item?.specs?.["spec_socket"];
  if (specSock) {
    return normalizeSocket(specSock);
  }
  return "";
}

export function getMainboardRamType(item: any): "DDR4" | "DDR5" {
  const specRam = item?.specs?.["ram_type"] || item?.specs?.["chuẩn ram"] || item?.specs?.["spec_ram_type"];
  if (specRam) {
    const upper = String(specRam).toUpperCase();
    if (upper.includes("DDR5")) return "DDR5";
    if (upper.includes("DDR4")) return "DDR4";
  }
  return "DDR4";
}

export function getRamType(item: any): "DDR4" | "DDR5" {
  const specRam = item?.specs?.["ram_type"] || item?.specs?.["chuẩn ram"] || item?.specs?.["spec_ram_type"];
  if (specRam) {
    const upper = String(specRam).toUpperCase();
    if (upper.includes("DDR5")) return "DDR5";
    if (upper.includes("DDR4")) return "DDR4";
  }
  return "DDR4";
}

export function getPsuWattage(item: any): number {
  const specWatt = item?.specs?.["psu_wattage"] || item?.specs?.["wattage"] || item?.specs?.["công suất"] || item?.specs?.["công suất nguồn"];
  if (specWatt) {
    const v = parseNumber(specWatt, 0);
    if (v >= 300 && v <= 2500) return v;
  }
  return 650;
}

export function getCpuTdp(item: any): number {
  const specTdp = item?.specs?.["tdp"] || item?.specs?.["tdp tiêu thụ"] || item?.specs?.["công suất"];
  if (specTdp) {
    const v = parseNumber(specTdp, 0);
    if (v > 0) return v;
  }
  return 65;
}

export function getGpuTdp(item: any): number {
  const specTdp = item?.specs?.["tdp"] || item?.specs?.["tdp tiêu thụ"] || item?.specs?.["công suất"];
  if (specTdp) {
    const v = parseNumber(specTdp, 0);
    if (v >= 30 && v <= 700) return v;
  }
  return 150;
}

export function isFormFactorCompatible(boardForm: string, caseForm: string): boolean {
  const b = normalizeText(boardForm);
  const c = normalizeText(caseForm);
  if (!b || !c) return true;
  if (c.includes("atx") && !c.includes("matx") && !c.includes("micro")) {
    return true;
  }
  if (c.includes("matx") || c.includes("micro")) {
    return !b.includes("atx") || b.includes("matx") || b.includes("micro");
  }
  if (c.includes("itx")) {
    return b.includes("itx");
  }
  return true;
}
