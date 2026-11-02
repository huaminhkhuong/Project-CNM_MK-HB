import { SPEC_ALIASES } from "./pcBuilderConstants.js";

export const formatCurrency = (v) => Number(v || 0).toLocaleString("vi-VN");

export function getEnvelopeData(response, fallback = []) {
  const p = response?.data;
  return p?.items || p?.data?.items || p?.data || p || response?.items || response?.data || response || fallback;
}

export function getEnvelopeItems(response, fallback = []) {
  const payload = response?.data ?? response;
  let cur = payload;
  for (let i = 0; i < 4; i++) {
    if (Array.isArray(cur)) return cur;
    if (!cur || typeof cur !== "object") break;
    if (Array.isArray(cur.items)) return cur.items;
    if (Array.isArray(cur.data)) return cur.data;
    cur = cur.data ?? cur.items ?? cur.result ?? cur.payload;
  }
  return fallback;
}

export const getProductId    = (p) => p?.product_id || p?.id;
export const getProductName  = (p) => p?.product_name || p?.name || "Đang cập nhật";
export const getProductBrand = (p) => p?.brand_name || p?.brand?.name || String(getProductName(p)).split(" ")[0] || "PC Mall";
export const getProductPrice = (p) => Number(p?.price ?? p?.pricing?.minPrice ?? p?.defaultVariant?.price ?? p?.variants?.[0]?.price ?? p?.skus?.[0]?.price ?? 0);
export const getProductStock = (p) => {
  const raw = p?.stock_quantity ?? p?.stockQuantity ?? p?.stock ?? p?.totalStock ?? p?.defaultVariant?.stock_quantity ?? p?.defaultVariant?.stock ?? p?.variants?.[0]?.stock_quantity ?? p?.variants?.[0]?.stock ?? p?.skus?.[0]?.stock;
  if (raw !== undefined && raw !== null && raw !== "") {
    const num = Number(raw);
    if (Number.isFinite(num)) return num;
  }
  return 15;
};
export const getRating       = (p) => Number(p?.rating || 4.7).toFixed(1);
export const getSelectedProduct = (item) => item?.product || item?.Product || item?.variant?.product || item?.productVariant?.product || {};
export const getSelectedVariant = (item) => item?.variant || item?.ProductVariant || item?.productVariant || item?.sku || {};
export const getVariantId    = (item) => { const v = getSelectedVariant(item); return v?.variant_id || v?.id || v?.skuId || item?.variantId || item?.productVariantId; };
export const getItemPrice    = (item) => {
  const unitPrice = Number(getSelectedVariant(item)?.price || item?.price || getSelectedProduct(item)?.price || 0);
  const qty = Math.max(1, Number(item?.quantity || 1));
  return unitPrice * qty;
};
export const normalizeText   = (v) => String(v || "").trim().toLowerCase();
export const parseNumber     = (v, fb = 0) => { const m = String(v || "").match(/(\d+(\.\d+)?)/); return m ? Number(m[1]) : fb; };

export function getCoolingCardStatus(product, selectedItems) {
  const cpu = getSelectedProduct(selectedItems?.cpu);
  const caseProduct = getSelectedProduct(selectedItems?.case);
  const d = getCoolingDiagnostics(cpu, product, caseProduct, true);
  if (!getProductId(cpu)) return { label: "Chờ CPU để đánh giá", cls: "meta-compat--neutral" };
  if (!d.socketOk)   return { label: "Không hợp socket", cls: "meta-compat--bad" };
  if (!d.capacityOk) return { label: "TDP chưa đủ",      cls: "meta-compat--warn" };
  if (!d.radiatorOk || !d.heightOk) return { label: "Kiểm tra với case", cls: "meta-compat--warn" };
  return { label: "Tương thích tốt", cls: "meta-compat--good" };
}

export function getSpecBag(product) {
  const raw = product?.specs || product?.specifications || product?.attributes || product?.technicalSpecs || product?.ProductAttributes || [];
  const bag = {};
  if (Array.isArray(raw)) {
    raw.forEach((entry) => {
      const key = String(entry.name || entry.key || entry.attribute_name || entry.Attribute?.name || "").trim();
      const value = entry.value || entry.attribute_value || entry.AttributeValue?.value || entry.text;
      if (key && value !== undefined && value !== null) bag[normalizeText(key)] = String(value);
    });
  } else if (raw && typeof raw === "object") {
    Object.entries(raw).forEach(([k, v]) => { bag[normalizeText(k)] = String(v); });
  }
  return bag;
}

export function findSpec(product, aliases) {
  const bag = getSpecBag(product);
  const safeAliases = Array.isArray(aliases) ? aliases : [];
  const tokens = safeAliases.map(normalizeText);
  const hit = Object.entries(bag).find(([k]) => tokens.some((t) => t && k.includes(t)));
  return hit?.[1] || "";
}

export function hasTruthySpecValue(v) {
  const text = normalizeText(v);
  if (!text) return false;
  if (["khong", "không", "no", "false", "none"].some((t) => text.includes(t))) return false;
  return ["co", "có", "yes", "true", "included", "stock", "kem", "kèm", "boxed"].some((t) => text.includes(t));
}

export function cpuHasStockCooler(product) {
  const val = findSpec(product, SPEC_ALIASES.stockCooler);
  if (val) return hasTruthySpecValue(val);
  const name = normalizeText(getProductName(product));
  if (/\bi[3579]-?\d{4,5}(k|kf|ks)\b/.test(name)) return false;
  if (/ryzen\s*[3579].*(x3d|xt|\bx\b)/.test(name)) return false;
  return true;
}

export const cpuNeedsDedicatedCooling = (p) => Boolean(getProductId(p)) && !cpuHasStockCooler(p);

export function socketMatches(a, b) {
  const l = normalizeText(a), r = normalizeText(b);
  if (!l || !r) return true;
  return r.includes(l) || l.includes(r);
}

export function getCoolingDiagnostics(cpu, cooling, caseProduct, hasCooling) {
  const cpuSocket = findSpec(cpu, SPEC_ALIASES.socket);
  const cpuTdp = parseNumber(findSpec(cpu, SPEC_ALIASES.tdp) || getProductName(cpu), 95);
  const coolerSockets = findSpec(cooling, SPEC_ALIASES.socketSupport);
  const coolerCapacity = parseNumber(findSpec(cooling, SPEC_ALIASES.coolingCapacity), 0);
  const radiatorSize = parseNumber(findSpec(cooling, SPEC_ALIASES.radiatorSize), 0);
  const caseRadiatorSupport = parseNumber(findSpec(caseProduct, SPEC_ALIASES.caseRadiatorSupport), 0);
  const coolerHeight = parseNumber(findSpec(cooling, SPEC_ALIASES.coolerHeight), 0);
  const caseCoolerClearance = parseNumber(findSpec(caseProduct, SPEC_ALIASES.caseCoolerClearance), 0);
  const required = cpuNeedsDedicatedCooling(cpu);
  return {
    required, stockCooler: cpuHasStockCooler(cpu), cpuSocket, cpuTdp,
    coolerSockets, coolerCapacity, radiatorSize, caseRadiatorSupport, coolerHeight, caseCoolerClearance,
    socketOk:   !hasCooling || socketMatches(cpuSocket, coolerSockets),
    capacityOk: !hasCooling || coolerCapacity === 0 || cpuTdp === 0 || coolerCapacity >= cpuTdp,
    radiatorOk: !hasCooling || radiatorSize === 0 || caseRadiatorSupport === 0 || caseRadiatorSupport >= radiatorSize,
    heightOk:   !hasCooling || coolerHeight === 0 || caseCoolerClearance === 0 || caseCoolerClearance >= coolerHeight
  };
}

export function estimateProductPerformance(product, type) {
  const name = normalizeText(getProductName(product));
  const price = getProductPrice(product);

  if (type === "gpu") {
    if (name.includes("4090") || name.includes("7900 xtx")) return 98;
    if (name.includes("4080") || name.includes("7900 xt")) return 92;
    if (name.includes("4070 ti") || name.includes("4070 super") || name.includes("7800 xt")) return 86;
    if (name.includes("4070") || name.includes("3080") || name.includes("7700 xt")) return 80;
    if (name.includes("4060 ti") || name.includes("3070") || name.includes("6700 xt")) return 72;
    if (name.includes("4060") || name.includes("3060") || name.includes("7600") || name.includes("6600")) return 65;
    if (price >= 40000000) return 98;
    if (price >= 25000000) return 90;
    if (price >= 16000000) return 82;
    if (price >= 11000000) return 74;
    if (price >= 7000000)  return 65;
    return Math.min(60, Math.max(30, Math.round(price / 150000)));
  }

  if (type === "cpu") {
    if (name.includes("i9") || name.includes("7950x") || name.includes("7900x") || name.includes("14900k") || name.includes("13900k")) return 95;
    if (name.includes("i7") || name.includes("7800x3d") || name.includes("14700k") || name.includes("13700k")) return 86;
    if (name.includes("i5") || name.includes("7600") || name.includes("14600k") || name.includes("13600k") || name.includes("14400")) return 74;
    if (name.includes("i3") || name.includes("12100")) return 58;
    if (price >= 14000000) return 94;
    if (price >= 9000000)  return 84;
    if (price >= 5000000)  return 72;
    if (price >= 2500000)  return 60;
    return Math.min(55, Math.max(30, Math.round(price / 100000)));
  }

  if (type === "cooling") {
    const cap = parseNumber(findSpec(product, SPEC_ALIASES.coolingCapacity), 180);
    return Math.max(40, Math.min(96, Math.round(cap / 4)));
  }

  return Math.min(98, Math.max(35, Math.round(price / 450000)));
}

export function getCoolingBadge(product) {
  const type = findSpec(product, SPEC_ALIASES.coolingType);
  const rad = parseNumber(findSpec(product, SPEC_ALIASES.radiatorSize), 0);
  if (rad >= 360) return "AIO 360";
  if (rad >= 240) return "AIO 240";
  return type || "Cooling";
}

export function getStockState(stock) {
  if (stock <= 0) return { label: "Hết hàng",    cls: "badge--out-stock" };
  if (stock <= 5) return { label: `Còn ${stock}`, cls: "badge--low-stock" };
  return { label: "Sẵn hàng", cls: "badge--in-stock" };
}

export function getProductSocket(product, componentType = "cpu") {
  const spec = findSpec(product, SPEC_ALIASES.socket);
  if (spec) return spec.toUpperCase();
  const name = getProductName(product).toUpperCase();
  if (name.includes("LGA1851") || name.includes("1851") || name.includes("ARROW LAKE") || name.includes("ULTRA 7") || name.includes("ULTRA 9") || name.includes("ULTRA 5")) return "LGA1851";
  if (name.includes("LGA1700") || name.includes("1700") || name.includes("12400") || name.includes("13400") || name.includes("14400") || name.includes("14600") || name.includes("14700") || name.includes("14900") || name.includes("B760") || name.includes("Z790")) return "LGA1700";
  if (name.includes("LGA1200") || name.includes("1200") || name.includes("10400") || name.includes("11400")) return "LGA1200";
  if (name.includes("AM5") || name.includes("7600") || name.includes("7700") || name.includes("7800") || name.includes("7900") || name.includes("7950") || name.includes("9600") || name.includes("9700") || name.includes("9800") || name.includes("B650") || name.includes("X670")) return "AM5";
  if (name.includes("AM4") || name.includes("3600") || name.includes("5600") || name.includes("5700") || name.includes("5800") || name.includes("5900") || name.includes("B550") || name.includes("A520") || name.includes("B450")) return "AM4";
  return "UNIVERSAL";
}

export function getProductRamType(product) {
  const spec = findSpec(product, SPEC_ALIASES.ramType);
  if (spec) {
    const s = spec.toUpperCase();
    if (s.includes("DDR5")) return "DDR5";
    if (s.includes("DDR4")) return "DDR4";
  }
  const name = getProductName(product).toUpperCase();
  if (name.includes("DDR5")) return "DDR5";
  if (name.includes("DDR4") || name.includes("D4") || name.includes("DRR4")) return "DDR4";
  return "DDR4";
}

export function getPsuWattageValue(product) {
  const spec = findSpec(product, SPEC_ALIASES.psuWattage);
  if (spec) {
    const parsed = parseNumber(spec, 0);
    if (parsed > 0) return parsed;
  }
  const name = getProductName(product);
  const match = name.match(/(\d{3,4})\s*W/i) || name.match(/\b(\d{3,4})B\b/i);
  if (match) return Number(match[1]);
  return 550;
}

/**
 * findOptimalAlternative — Tìm linh kiện thay thế tương thích tốt nhất đang còn hàng
 * @param {string} componentType - Loại linh kiện (cpu, gpu, mainboard, ram, psu, case, cooling, storage)
 * @param {object} outOfStockProduct - Sản phẩm bị hết hàng
 * @param {Array} catalog - Danh sách sản phẩm của loại linh kiện đó
 * @param {object} selectedItems - Các linh kiện khác trong cấu hình hiện tại
 * @returns {object|null} Sản phẩm thay thế tối ưu nhất
 */
export function findOptimalAlternative(componentType, outOfStockProduct, catalog = [], selectedItems = {}) {
  if (!Array.isArray(catalog) || catalog.length === 0) return null;
  const outPrice = getProductPrice(outOfStockProduct);
  const outId = getProductId(outOfStockProduct);

  // Lọc chỉ lấy các sản phẩm CÒN HÀNG và KHÁC sản phẩm hiện tại
  const available = catalog.filter((p) => {
    if (getProductId(p) === outId) return false;
    return getProductStock(p) > 0;
  });

  if (available.length === 0) return null;

  // Lấy ngữ cảnh tương thích từ selectedItems
  const currentCpu = getSelectedProduct(selectedItems?.cpu);
  const currentMb = getSelectedProduct(selectedItems?.mainboard);
  const currentGpu = getSelectedProduct(selectedItems?.gpu);
  const currentCase = getSelectedProduct(selectedItems?.case);

  let candidates = available;

  if (componentType === "cpu") {
    // Nếu đã chọn Mainboard, CPU thay thế PHẢI cùng socket
    const mbSocket = currentMb ? getProductSocket(currentMb, "mainboard") : null;
    const outSocket = getProductSocket(outOfStockProduct, "cpu");
    const targetSocket = (mbSocket && mbSocket !== "UNIVERSAL") ? mbSocket : (outSocket && outSocket !== "UNIVERSAL" ? outSocket : null);
    if (targetSocket) {
      const matchSocket = available.filter((c) => {
        const cSock = getProductSocket(c, "cpu");
        return cSock === "UNIVERSAL" || cSock === targetSocket;
      });
      if (matchSocket.length > 0) candidates = matchSocket;
    }
  } else if (componentType === "mainboard") {
    // Nếu đã chọn CPU, Mainboard thay thế PHẢI cùng socket với CPU
    const cpuSocket = currentCpu ? getProductSocket(currentCpu, "cpu") : null;
    if (cpuSocket && cpuSocket !== "UNIVERSAL") {
      const matchSocket = available.filter((m) => {
        const mSock = getProductSocket(m, "mainboard");
        return mSock === "UNIVERSAL" || mSock === cpuSocket;
      });
      if (matchSocket.length > 0) candidates = matchSocket;
    }
    // Nếu đã chọn RAM, Mainboard phải cùng chuẩn RAM
    const currentRam = getSelectedProduct(selectedItems?.ram);
    if (currentRam) {
      const ramType = getProductRamType(currentRam);
      const matchRam = candidates.filter((m) => getProductRamType(m) === ramType);
      if (matchRam.length > 0) candidates = matchRam;
    }
  } else if (componentType === "ram") {
    // RAM thay thế PHẢI cùng chuẩn DDR với Mainboard (nếu có)
    const mbRam = currentMb ? getProductRamType(currentMb) : null;
    if (mbRam) {
      const matchRam = available.filter((r) => getProductRamType(r) === mbRam);
      if (matchRam.length > 0) candidates = matchRam;
    }
  } else if (componentType === "psu") {
    // Nguồn thay thế PHẢI đáp ứng đủ công suất tối thiểu cho GPU
    let minWatt = 500;
    if (currentGpu) {
      const gName = getProductName(currentGpu).toLowerCase();
      if (gName.includes("4090") || gName.includes("7900 xtx")) minWatt = 850;
      else if (gName.includes("4080") || gName.includes("7900 xt")) minWatt = 750;
      else if (gName.includes("4070") || gName.includes("7800")) minWatt = 650;
      else if (gName.includes("4060") || gName.includes("7600") || gName.includes("3060")) minWatt = 550;
    }
    const matchWatt = available.filter((p) => getPsuWattageValue(p) >= minWatt);
    if (matchWatt.length > 0) candidates = matchWatt;
  } else if (componentType === "cooling") {
    // Tản nhiệt thay thế phải hợp socket CPU
    if (currentCpu) {
      const validCoolers = available.filter((c) => {
        const diag = getCoolingDiagnostics(currentCpu, c, currentCase, true);
        return diag.socketOk && diag.capacityOk;
      });
      if (validCoolers.length > 0) candidates = validCoolers;
    }
  }

  // Sắp xếp các ứng viên tương thích: Ưu tiên chênh lệch giá nhỏ nhất so với linh kiện cũ
  const sorted = [...candidates].sort((a, b) => {
    const diffA = Math.abs(getProductPrice(a) - outPrice);
    const diffB = Math.abs(getProductPrice(b) - outPrice);
    return diffA - diffB;
  });

  return sorted[0] || null;
}

