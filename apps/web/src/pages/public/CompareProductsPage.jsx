import { Fragment, useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";

import { getCategories, getCompareProducts, getProductDetail, getProducts } from "../../services/catalog.service";
import { addItemToCart } from "../../services/cart.service";
import { useAuth } from "../../hooks/useAuth";
import { getStoredCompareIds, MAX_COMPARE_ITEMS, normalizeCompareIds, storeCompareIds } from "../../utils/compare";
import { resolveProductImage } from "../../utils/productImage";
import { extractSmartSpecs, calculateCategoryAiScores, getCategoryMetricDefinitions, inspectSuperiorSpecs } from "../../utils/smartSpecExtractor";

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function getErrorMessage(error, fallback) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback;
  }
  return error?.message || fallback;
}

const MAX_COMPARE = MAX_COMPARE_ITEMS;

const SLOT_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981"];

const CPU_SPEC_ROWS = [
  { key: "coresThreads", label: "Số nhân / số luồng", aliases: ["cores/threads", "core/thread", "nhân/luồng", "so nhan / so luong", "cores", "cpu cores"] },
  { key: "baseBoost", label: "Xung nhịp base / boost", aliases: ["base/boost", "base clock", "boost clock", "xung nhịp", "xung nhip", "frequency", "clock"] },
  { key: "cache", label: "Cache", aliases: ["cache", "l3 cache", "smart cache"] },
  { key: "tdp", label: "TDP", aliases: ["tdp", "power", "công suất", "cong suat"] },
  { key: "socket", label: "Socket", aliases: ["socket", "cpu socket"] },
  { key: "ram", label: "RAM hỗ trợ", aliases: ["ram", "memory support", "memory type", "ram hỗ trợ", "ram ho tro"] },
  { key: "pcie", label: "PCIe version", aliases: ["pcie", "pci express", "pci-e"] },
  { key: "benchmark", label: "Điểm benchmark", aliases: ["benchmark", "passmark", "cinebench", "geekbench", "cpu mark"] },
  { key: "fps", label: "FPS gaming estimate", aliases: ["fps", "gaming fps", "fps gaming", "game fps"] },
  { key: "render", label: "Hiệu năng render", aliases: ["render", "rendering", "cinebench multi", "multi core"] },
  { key: "efficiency", label: "Tiết kiệm điện", aliases: ["efficiency", "power efficient", "tiết kiệm điện", "tiet kiem dien"] }
];

const CPU_SCORE_METRICS = [
  { key: "gaming", label: "Gaming", tone: "#2563eb" },
  { key: "multitasking", label: "Multitasking", tone: "#7c3aed" },
  { key: "rendering", label: "Rendering", tone: "#ea580c" },
  { key: "efficiency", label: "Efficiency", tone: "#059669" }
];

const CPU_AUDIENCES = [
  { key: "gaming", label: "Gaming" },
  { key: "streaming", label: "Streaming" },
  { key: "office", label: "Văn phòng" },
  { key: "render", label: "Render video" },
  { key: "ai", label: "AI / lập trình" }
];

function getProductId(product) {
  return String(product?.product_id || product?.id || "");
}

function getProductName(product, fallback = "Sản phẩm đang cập nhật") {
  return product?.product_name || product?.name || fallback;
}

function getProductImage(product) {
  return resolveProductImage(product);
}

function getPrimaryVariant(product) {
  return product?.primaryVariant || product?.variants?.[0] || product?.skus?.[0] || product?.defaultVariant || null;
}

function getProductPrice(product) {
  const variant = getPrimaryVariant(product);
  return Number(variant?.price ?? product?.price ?? product?.pricing?.minPrice ?? 0);
}

function getProductStock(product) {
  const variant = getPrimaryVariant(product);
  return Number(variant?.stock_quantity ?? variant?.stock ?? product?.stock_quantity ?? product?.stock ?? 0);
}

function getCategoryName(product) {
  return product?.category?.name || product?.category_name || "—";
}

function getCategoryKey(product) {
  return String(product?.category?.id || product?.category_id || product?.category?.name || product?.category_name || "");
}

function getBrandName(product) {
  return product?.brand?.name || product?.brand_name || product?.brandName || "—";
}

function normalizeSpecs(product) {
  const specs = {};
  const sources = [product?.compareSpecs, product?.specs, product?.technicalSpecs];

  sources.forEach((source) => {
    if (source && typeof source === "object" && !Array.isArray(source)) {
      Object.entries(source).forEach(([key, value]) => {
        specs[key] = value;
      });
    }
  });

  if (Array.isArray(product?.attributes)) {
    product.attributes.forEach((attr) => {
      const key = attr.name || attr.key || attr.attributeName || attr.attribute?.name;
      const value = attr.value || attr.attributeValue || attr.attribute_value || attr.attributeValueName;
      if (key) specs[key] = value || "—";
    });
  } else if (product?.attributes && typeof product.attributes === "object") {
    Object.entries(product.attributes).forEach(([key, value]) => {
      specs[key] = value;
    });
  }

  return specs;
}

function normalizeSpecKey(key) {
  return String(key || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findSpecValue(specs, aliases) {
  const entries = Object.entries(specs || {});
  const normalizedAliases = aliases.map(normalizeSpecKey);
  const found = entries.find(([key]) => {
    const normalizedKey = normalizeSpecKey(key);
    return normalizedAliases.some((alias) => normalizedKey === alias || normalizedKey.includes(alias) || alias.includes(normalizedKey));
  });
  return found?.[1] ?? null;
}

function extractNumbers(value) {
  return String(value ?? "")
    .replace(/,/g, ".")
    .match(/\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter((item) => Number.isFinite(item)) || [];
}

function getSpecNumber(specs, aliases, index = 0) {
  const numbers = extractNumbers(findSpecValue(specs, aliases));
  return numbers[index] || 0;
}

function getCpuSpecValue(product, row) {
  const specs = normalizeSpecs(product);
  const direct = findSpecValue(specs, row.aliases);
  if (direct && row.key !== "coresThreads" && row.key !== "baseBoost") return direct;

  if (row.key === "coresThreads") {
    const cores = getSpecNumber(specs, ["cores", "nhân", "so nhan", "cpu cores"]);
    const threads = getSpecNumber(specs, ["threads", "luồng", "so luong"], 0);
    if (cores || threads) return `${cores || "—"}C / ${threads || "—"}T`;
  }

  if (row.key === "baseBoost") {
    const base = getSpecNumber(specs, ["base clock", "base", "xung cơ bản", "xung co ban"]);
    const boost = getSpecNumber(specs, ["boost clock", "boost", "turbo", "xung tối đa", "xung toi da"]);
    if (base || boost) return `${base || "—"} / ${boost || "—"} GHz`;
  }

  return "—";
}

function getCpuRawStats(product) {
  const specs = normalizeSpecs(product);
  const coresThreadsText = getCpuSpecValue(product, CPU_SPEC_ROWS[0]);
  const coresThreadNumbers = extractNumbers(coresThreadsText);
  const clockText = getCpuSpecValue(product, CPU_SPEC_ROWS[1]);
  const clockNumbers = extractNumbers(clockText);

  const cores = coresThreadNumbers[0] || getSpecNumber(specs, ["cores", "nhân", "so nhan"]);
  const threads = coresThreadNumbers[1] || getSpecNumber(specs, ["threads", "luồng", "so luong"]);
  const baseClock = clockNumbers[0] || getSpecNumber(specs, ["base clock", "base"]);
  const boostClock = clockNumbers[1] || getSpecNumber(specs, ["boost clock", "boost", "turbo"]);
  const cache = getSpecNumber(specs, ["cache", "l3 cache"]);
  const tdp = getSpecNumber(specs, ["tdp", "power"]);
  const benchmark = getSpecNumber(specs, ["benchmark", "passmark", "cinebench", "geekbench", "cpu mark"]);
  const fps = getSpecNumber(specs, ["fps", "gaming fps", "fps gaming"]);
  const render = getSpecNumber(specs, ["render", "rendering", "cinebench multi", "multi core"]);

  return { cores, threads, baseClock, boostClock, cache, tdp, benchmark, fps, render };
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value || 0)));
}

function scaleScore(value, maxValue) {
  if (!value || !maxValue) return 0;
  return clampScore((value / maxValue) * 100);
}

function buildCpuAnalysis(items) {
  const rawStats = items.map((item) => ({ id: getProductId(item), stats: getCpuRawStats(item) }));
  const max = (selector) => Math.max(...rawStats.map((item) => selector(item.stats) || 0), 0);
  const maxBenchmark = max((stats) => stats.benchmark || (stats.cores * stats.boostClock * 1000));
  const maxGaming = max((stats) => stats.fps || stats.benchmark || (stats.boostClock * 1000 + stats.cache * 20));
  const maxRender = max((stats) => stats.render || stats.benchmark || (stats.threads * stats.baseClock * 1000));
  const maxMultitask = max((stats) => stats.threads * stats.baseClock);
  const maxEfficiencyBase = max((stats) => (stats.benchmark || stats.threads * stats.baseClock * 1000) / Math.max(stats.tdp || 1, 1));

  return rawStats.reduce((accumulator, { id, stats }) => {
    const gamingSource = stats.fps || stats.benchmark || (stats.boostClock * 1000 + stats.cache * 20);
    const multitaskingSource = stats.threads * stats.baseClock;
    const renderingSource = stats.render || stats.benchmark || (stats.threads * stats.baseClock * 1000);
    const efficiencySource = (stats.benchmark || stats.threads * stats.baseClock * 1000) / Math.max(stats.tdp || 1, 1);

    const scores = {
      gaming: scaleScore(gamingSource, maxGaming),
      multitasking: scaleScore(multitaskingSource, maxMultitask),
      rendering: scaleScore(renderingSource, maxRender),
      efficiency: scaleScore(efficiencySource, maxEfficiencyBase)
    };

    const badges = [];
    if (id && stats.tdp && scores.efficiency >= 85) badges.push("Power Efficient");
    if (id && scores.gaming >= 90) badges.push("Gaming Best");
    if (id && scaleScore(stats.benchmark || renderingSource, maxBenchmark) >= 88) badges.push("Recommended");

    accumulator[id] = { stats, scores, badges };
    return accumulator;
  }, {});
}

function getCpuAudience(scores) {
  return CPU_AUDIENCES.filter((audience) => {
    if (audience.key === "gaming") return scores.gaming >= 70;
    if (audience.key === "streaming") return scores.gaming >= 65 && scores.multitasking >= 65;
    if (audience.key === "office") return scores.efficiency >= 55 || scores.multitasking >= 45;
    if (audience.key === "render") return scores.rendering >= 70;
    if (audience.key === "ai") return scores.multitasking >= 70 || scores.rendering >= 70;
    return false;
  }).map((item) => item.label);
}

function getPrimarySkuId(product) {
  const variant = getPrimaryVariant(product);
  return variant?.id || variant?.sku_id || variant?.skuId || null;
}

export function CompareProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Selected products to compare (array of IDs)
  const [selectedIds, setSelectedIds] = useState(() => {
    const ids = searchParams.get("ids");
    if (ids) return normalizeCompareIds(ids);
    return getStoredCompareIds();
  });

  const [selectedProductMap, setSelectedProductMap] = useState({});

  // Compare result from API
  const [compareResult, setCompareResult] = useState(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [compareError, setCompareError] = useState("");

  // Search panel
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [cartLoadingId, setCartLoadingId] = useState(null);
  const searchRef = useRef(null);
  const searchTimerRef = useRef(null);

  // Load categories
  useEffect(() => {
    getCategories().then(res => {
      const list = res?.data || res || [];
      setCategories(Array.isArray(list) ? list : []);
    }).catch(() => {});
  }, []);

  // Auto-compare when selectedIds change
  useEffect(() => {
    storeCompareIds(selectedIds);
    if (selectedIds.length > 0) {
      setSearchParams({ ids: selectedIds.join(",") }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }

    if (selectedIds.length >= 2) {
      runCompare(selectedIds);
    } else {
      setCompareResult(null);
    }
  }, [selectedIds]);

  useEffect(() => {
    if (selectedIds.length === 0) {
      setSelectedProductMap({});
      return;
    }

    let cancelled = false;
    const missingIds = selectedIds.filter((id) => !selectedProductMap[id]);
    if (missingIds.length === 0) return;

    Promise.all(
      missingIds.map(async (id) => {
        try {
          const response = await getProductDetail(id);
          return [id, response?.data || response];
        } catch (_error) {
          return [id, null];
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setSelectedProductMap((prev) => {
        const next = { ...prev };
        entries.forEach(([id, product]) => {
          if (product) next[id] = product;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedIds, selectedProductMap]);

  // Search products (debounced)
  useEffect(() => {
    if (!showSearch) return;
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const params = { limit: 20 };
        if (searchQuery) params.search = searchQuery;
        if (selectedCategory) params.category_id = selectedCategory;
        const res = await getProducts(params);
        const payload = res?.data || res;
        const items = Array.isArray(payload) ? payload : (Array.isArray(payload?.items) ? payload.items : []);
        setSearchResults(items);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 350);
  }, [searchQuery, selectedCategory, showSearch]);

  // Close search panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearch(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function runCompare(ids) {
    setLoadingCompare(true);
    setCompareError("");
    setCompareResult(null);
    try {
      const res = await getCompareProducts(ids.join(","));
      const data = res?.data || res;
      setCompareResult(data);
      if (Array.isArray(data?.items)) {
        setSelectedProductMap((prev) => {
          const next = { ...prev };
          data.items.forEach((item) => {
            const id = getProductId(item);
            if (id) next[id] = item;
          });
          return next;
        });
      }
    } catch (err) {
      setCompareError(getErrorMessage(err, "Không thể so sánh sản phẩm. Vui lòng thử lại."));
    } finally {
      setLoadingCompare(false);
    }
  }

  function addProduct(product) {
    const id = getProductId(product);
    if (!id) return;
    if (selectedIds.includes(id)) return;
    if (selectedIds.length >= MAX_COMPARE) return;
    const nextIds = normalizeCompareIds([...selectedIds, id]);
    setSelectedProductMap(prev => ({ ...prev, [id]: product }));
    setSelectedIds(nextIds);
    setShowSearch(nextIds.length < MAX_COMPARE);
    setSearchQuery("");
  }

  function removeProduct(id) {
    setSelectedIds(prev => prev.filter(p => p !== String(id)));
  }

  function clearAll() {
    setSelectedIds([]);
    setSelectedProductMap({});
    setCompareResult(null);
    setSearchParams({});
  }

  async function handleAddToCart(product) {
    const productId = getProductId(product);
    if (!productId) return;
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    try {
      setCartLoadingId(productId);
      setActionMessage("");
      await addItemToCart({ productId, variantId: getPrimarySkuId(product), quantity: 1 });
      setActionMessage(`Đã thêm ${getProductName(product)} vào giỏ hàng.`);
    } catch (error) {
      setCompareError(getErrorMessage(error, "Không thể thêm sản phẩm vào giỏ hàng."));
    } finally {
      setCartLoadingId(null);
    }
  }

  const comparedItems = useMemo(() => (
    Array.isArray(compareResult?.items) ? compareResult.items : []
  ), [compareResult]);

  const attributeNames = useMemo(() => (
    Array.isArray(compareResult?.attributes) ? compareResult.attributes : []
  ), [compareResult]);

  const categoryKeys = useMemo(() => (
    Array.from(new Set(comparedItems.map(getCategoryKey).filter(Boolean)))
  ), [comparedItems]);
  const hasMixedCategories = categoryKeys.length > 1;
  const specGroupTitle = hasMixedCategories
    ? "Thông số kỹ thuật theo từng danh mục"
    : `Thông số ${getCategoryName(comparedItems[0] || {}).toLowerCase()}`;

  const bestPriceId = useMemo(() => {
    const priced = comparedItems
      .map((item) => ({ id: getProductId(item), price: getProductPrice(item), stock: getProductStock(item) }))
      .filter((item) => item.price > 0 && item.stock > 0);
    if (priced.length === 0) return "";
    return priced.sort((a, b) => a.price - b.price)[0].id;
  }, [comparedItems]);

  const bestPickId = bestPriceId;
  const bestPriceProduct = useMemo(
    () => comparedItems.find((item) => getProductId(item) === bestPriceId) || null,
    [bestPriceId, comparedItems]
  );
  const inStockCount = useMemo(
    () => comparedItems.filter((item) => getProductStock(item) > 0).length,
    [comparedItems]
  );
  const isCpuCompare = useMemo(() => (
    comparedItems.length >= 2 &&
    comparedItems.every((item) => {
      const cat = getCategoryName(item).toLowerCase();
      const name = getProductName(item).toLowerCase();
      return (cat.includes("cpu") || cat.includes("bộ xử lý") || name.includes("i5-") || name.includes("i7-") || name.includes("ryzen")) &&
             !cat.includes("tản") && !cat.includes("cool") && !name.includes("aio") && !name.includes("ls720") && !name.includes("kraken");
    })
  ), [comparedItems]);

  const isCoolingCompare = useMemo(() => (
    comparedItems.length >= 2 &&
    comparedItems.some((item) => {
      const cat = getCategoryName(item).toLowerCase();
      const name = getProductName(item).toLowerCase();
      return cat.includes("tản") || cat.includes("cool") || name.includes("aio") || name.includes("ls720") || name.includes("kraken") || name.includes("ak620");
    })
  ), [comparedItems]);

  const cpuAnalysis = useMemo(() => (
    isCpuCompare ? buildCpuAnalysis(comparedItems) : {}
  ), [comparedItems, isCpuCompare]);

  // Merge all specs rows across all products with Smart Extractor fallback
  const allSpecKeys = useMemo(() => {
    const keys = new Set();
    comparedItems.forEach(item => {
      const smartSpecs = extractSmartSpecs(item);
      Object.keys(smartSpecs).forEach(k => {
        if (k !== "category") keys.add(k);
      });
      const specs = normalizeSpecs(item);
      Object.keys(specs).forEach(k => keys.add(k));
    });
    return Array.from(keys);
  }, [comparedItems]);

  // ✅ Pre-compute extractSmartSpecs() một lần cho mỗi sản phẩm (tránh gọi lại N×M lần trong spec rows)
  const smartSpecsMap = useMemo(() => {
    const map = {};
    comparedItems.forEach(item => {
      map[getProductId(item)] = extractSmartSpecs(item);
    });
    return map;
  }, [comparedItems]);

  // ✅ Fix Bug #2+5: Tính superiorMap một lần duy nhất (không gọi lại N lần trong .map())
  const superiorSpecMap = useMemo(() => inspectSuperiorSpecs(comparedItems), [comparedItems]);

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", paddingBottom: 80 }}>

      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", padding: "56px 20px 80px", color: "#fff" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20 }}>
            <div>
              <h1 style={{ fontSize: 40, fontWeight: 900, margin: "0 0 10px" }}>⚖️ So sánh sản phẩm</h1>
              <p style={{ fontSize: 16, color: "#94a3b8", margin: 0 }}>
                Đặt tối đa 4 sản phẩm lên cùng một bảng để so sánh chi tiết thông số, giá và tồn kho.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              {selectedIds.length > 0 && (
                <button
                  onClick={clearAll}
                  style={{ padding: "10px 20px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 12, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 }}
                >
                  🗑️ Xóa tất cả
                </button>
              )}
              {selectedIds.length >= 2 && (
                <button
                  onClick={() => runCompare(selectedIds)}
                  style={{ padding: "10px 24px", background: "linear-gradient(135deg, #3b82f6, #2563eb)", border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 800 }}
                >
                  🔄 So sánh lại
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "-36px auto 0", padding: "0 20px", position: "relative", zIndex: 10 }}>

        {/* ── Product Slot Picker ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
          {Array.from({ length: MAX_COMPARE }).map((_, slotIndex) => {
            const id = selectedIds[slotIndex];
            const item = comparedItems.find(p => getProductId(p) === String(id)) || selectedProductMap[id];
            const color = SLOT_COLORS[slotIndex];

            if (id && !loadingCompare) {
              const imageUrl = getProductImage(item);
              const price = getProductPrice(item);
              const stock = getProductStock(item);
              const itemId = getProductId(item);
              const cpuBadges = isCpuCompare ? [...(cpuAnalysis[itemId]?.badges || []), itemId === bestPriceId ? "Best Value" : null].filter(Boolean) : [];
              return (
                <div key={slotIndex} style={{ background: "#fff", borderRadius: 24, border: `2px solid ${color}`, overflow: "hidden", boxShadow: `0 8px 24px ${color}22`, position: "relative" }}>
                  <div style={{ background: color, height: 4 }} />
                  <button
                    onClick={() => removeProduct(id)}
                    title="Xóa khỏi so sánh"
                    style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: "50%", background: "#fee2e2", border: "none", color: "#ef4444", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}
                  >
                    ×
                  </button>
                  <div style={{ padding: "20px 20px 16px" }}>
                    {/* Product image or placeholder */}
                    <div style={{ height: 120, borderRadius: 16, background: imageUrl ? `center/contain no-repeat url(${imageUrl})` : `linear-gradient(135deg, ${color}22, ${color}11)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 12 }}>
                      {!imageUrl && "📦"}
                    </div>
                    <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>{getCategoryName(item)}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", lineHeight: 1.35, marginBottom: 8 }}>
                      {getProductName(item, `Sản phẩm #${id}`)}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                      {(cpuBadges.length > 0 ? cpuBadges : [
                        itemId === bestPriceId ? "Giá tốt nhất" : null,
                        itemId === bestPickId ? "Đáng mua" : null
                      ].filter(Boolean)).map((badge) => (
                        <span key={badge} style={{ padding: "4px 8px", borderRadius: 999, background: badge === "Power Efficient" ? "#ecfdf5" : "#eff6ff", color: badge === "Power Efficient" ? "#047857" : "#1d4ed8", fontSize: 11, fontWeight: 900 }}>{badge}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, color }}>
                      {price > 0 ? `${formatCurrency(price)}đ` : "—"}
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                      Tồn kho: {stock || "—"}
                    </div>
                  </div>
                </div>
              );
            }

            // Empty slot
            return (
              <div key={slotIndex} style={{ background: "#fff", borderRadius: 24, border: "2px dashed #e2e8f0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 220, cursor: "pointer", transition: "border-color 0.2s", position: "relative" }}
                onClick={() => setShowSearch(true)}
                onMouseEnter={e => e.currentTarget.style.borderColor = color}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#e2e8f0"}
              >
                <div style={{ width: 52, height: 52, borderRadius: 16, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 12 }}>+</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#64748b" }}>Thêm sản phẩm</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Slot {slotIndex + 1}</div>
              </div>
            );
          })}
        </div>

        {/* ── Search Panel ── */}
        <div ref={searchRef} style={{ marginBottom: 32, position: "relative" }}>
          {/* Search trigger input */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <div style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 18 }}>🔍</div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowSearch(true); }}
                onFocus={() => setShowSearch(true)}
                placeholder="Tìm sản phẩm để so sánh... (VD: Intel i5, RTX 4070)"
                style={{ width: "100%", height: 52, borderRadius: 16, border: "1px solid #e2e8f0", background: "#fff", paddingLeft: 50, paddingRight: 16, fontSize: 15, boxSizing: "border-box", boxShadow: showSearch ? "0 0 0 3px #3b82f620" : "0 2px 8px rgba(0,0,0,0.04)", outline: "none", transition: "box-shadow 0.2s" }}
              />
            </div>
            <select
              value={selectedCategory}
              onChange={e => { setSelectedCategory(e.target.value); setShowSearch(true); }}
              style={{ height: 52, padding: "0 16px", borderRadius: 16, border: "1px solid #e2e8f0", background: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", minWidth: 160 }}
            >
              <option value="">Tất cả danh mục</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Search results dropdown */}
          {showSearch && (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, background: "#fff", borderRadius: 20, border: "1px solid #e2e8f0", boxShadow: "0 20px 40px rgba(0,0,0,0.12)", zIndex: 100, maxHeight: 400, overflowY: "auto" }}>
              {searchLoading ? (
                <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>🔄 Đang tìm kiếm...</div>
              ) : searchResults.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>
                  {searchQuery || selectedCategory ? "Không tìm thấy sản phẩm nào." : "Đang tải danh sách sản phẩm để chọn..."}
                </div>
              ) : (
                searchResults.map(product => {
                  const id = getProductId(product);
                  const isSelected = selectedIds.includes(id);
                  const isFull = selectedIds.length >= MAX_COMPARE;
                  const imageUrl = getProductImage(product);
                  return (
                    <div
                      key={id}
                      onClick={() => !isSelected && !isFull && addProduct(product)}
                      style={{
                        display: "flex", alignItems: "center", gap: 16, padding: "14px 20px",
                        cursor: isSelected || isFull ? "default" : "pointer",
                        opacity: isFull && !isSelected ? 0.4 : 1,
                        borderBottom: "1px solid #f1f5f9",
                        transition: "background 0.15s",
                        background: isSelected ? "#f0f9ff" : "#fff"
                      }}
                      onMouseEnter={e => { if (!isSelected && !isFull) e.currentTarget.style.background = "#f8fafc"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "#f0f9ff" : "#fff"; }}
                    >
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: imageUrl ? `center/contain no-repeat url(${imageUrl})` : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20 }}>
                        {!imageUrl && "📦"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {getProductName(product)}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                          {getCategoryName(product)} · ID: {id}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, padding: "4px 12px", borderRadius: 8, background: isSelected ? "#dbeafe" : "#f1f5f9", color: isSelected ? "#1d4ed8" : "#64748b", flexShrink: 0 }}>
                        {isSelected ? "✓ Đã thêm" : isFull ? "Đầy" : "+ Thêm"}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* ── Status Messages ── */}
        {selectedIds.length === 1 && (
          <div style={{ padding: "16px 24px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 16, marginBottom: 24, color: "#92400e", fontWeight: 600, fontSize: 14 }}>
            💡 Thêm ít nhất 1 sản phẩm nữa để bắt đầu so sánh.
          </div>
        )}

        {compareError && (
          <div style={{ padding: "16px 24px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 16, marginBottom: 24, color: "#b91c1c", fontWeight: 600, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>🛑 {compareError}</span>
            <button onClick={() => setCompareError("")} style={{ background: "none", border: "none", color: "#b91c1c", fontSize: 20, cursor: "pointer" }}>×</button>
          </div>
        )}

        {actionMessage ? (
          <div style={{ padding: "16px 24px", background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 16, marginBottom: 24, color: "#047857", fontWeight: 700, fontSize: 14 }}>
            {actionMessage}
          </div>
        ) : null}

        {hasMixedCategories ? (
          <div style={{ padding: "16px 24px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 16, marginBottom: 24, color: "#9a3412", fontWeight: 700, fontSize: 14 }}>
            Cảnh báo: các sản phẩm đang thuộc nhiều danh mục khác nhau. Để kết quả chính xác hơn, bạn nên so sánh các linh kiện cùng loại như CPU với CPU, RAM với RAM hoặc VGA với VGA.
          </div>
        ) : null}

        {!loadingCompare && comparedItems.length >= 2 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
            <div style={{ padding: 18, borderRadius: 18, background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 10px 24px rgba(15,23,42,0.04)" }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", fontWeight: 900 }}>Đang so sánh</div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950, color: "#0f172a" }}>{comparedItems.length} / {MAX_COMPARE} sản phẩm</div>
            </div>
            <div style={{ padding: 18, borderRadius: 18, background: "#fff", border: "1px solid #bbf7d0", boxShadow: "0 10px 24px rgba(15,23,42,0.04)" }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "#047857", fontWeight: 900 }}>Giá tốt nhất</div>
              <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{bestPriceProduct ? getProductName(bestPriceProduct) : "Chưa xác định"}</div>
            </div>
            <div style={{ padding: 18, borderRadius: 18, background: "#fff", border: "1px solid #bfdbfe", boxShadow: "0 10px 24px rgba(15,23,42,0.04)" }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "#1d4ed8", fontWeight: 900 }}>Có hàng</div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950, color: "#0f172a" }}>{inStockCount} sản phẩm</div>
            </div>
          </div>
        ) : null}

        {loadingCompare && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
            <div style={{ width: 48, height: 48, border: "4px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
            So sánh đang được thực hiện...
          </div>
        )}

        {!loadingCompare && comparedItems.length >= 2 ? (() => {
          // ✅ Fix 1: Dùng smartSpecsMap[item].category làm nguồn chính xác nhất
          // extractSmartSpecs() có logic nhận diện tên sản phẩm (AIO, KRAKEN, LS720...)
          // mạnh hơn getCategoryName() vốn chỉ đọc field category từ DB
          const item0Id = getProductId(comparedItems[0] || {});
          const detectedCategory = smartSpecsMap[item0Id]?.category
            || getCategoryName(comparedItems[0] || {});
          const defs = getCategoryMetricDefinitions(detectedCategory);

          // ✅ Fix 2: Pre-compute TẤT CẢ scores trước khi render
          // Để tìm giá trị MAX cho từng metric → so sánh tương đối
          const allProductScores = comparedItems.map(item => ({
            id: getProductId(item),
            scores: calculateCategoryAiScores(item, detectedCategory)
          }));

          // Với mỗi metric: tìm giá trị TỐT NHẤT trong tất cả sản phẩm
          const metricMaxScores = {};
          defs.metrics.forEach(metric => {
            metricMaxScores[metric.key] = Math.max(
              ...allProductScores.map(s => s.scores[metric.key] || 0), 0
            );
          });

          return (
            <section style={{ marginBottom: 24, borderRadius: 28, overflow: "hidden", background: "linear-gradient(135deg, #020617, #111827)", border: "1px solid rgba(148, 163, 184, 0.24)", boxShadow: "0 24px 60px rgba(15,23,42,0.24)" }}>
              <div style={{ padding: 24, color: "#fff", display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: "#93c5fd", fontWeight: 900 }}>
                  {detectedCategory.toUpperCase()} PERFORMANCE LAB
                </div>
                <h2 style={{ margin: 0, fontSize: 30, lineHeight: 1.1 }}>{defs.title}</h2>
                <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.6 }}>{defs.subtitle}</p>
              </div>
              <div style={{ overflowX: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: `240px repeat(${comparedItems.length}, minmax(240px, 1fr))`, minWidth: 240 + comparedItems.length * 240, background: "#fff" }}>
                  <div style={{ padding: 18, background: "#f8fafc", fontWeight: 900, color: "#475569" }}>
                    Chỉ số Đánh Giá AI
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginTop: 4 }}>Dựa trên thông số phần cứng thực tế</div>
                  </div>
                  {comparedItems.map((item) => {
                    const itemId = getProductId(item);
                    // ✅ Fix 3: Dùng superiorSpecMap từ useMemo, không gọi lại inspectSuperiorSpecs
                    const superior = superiorSpecMap[itemId] || { badges: [] };
                    // Lấy scores từ allProductScores đã tính sẵn
                    const productScoreEntry = allProductScores.find(s => s.id === itemId);
                    const scores = productScoreEntry?.scores || {};
                    const badges = superior.badges.length > 0
                      ? superior.badges
                      : [scores.overall >= 90 ? "Hiệu Năng Cao" : "Chính Hãng"];

                    return (
                      <div key={itemId} style={{ padding: 18, borderLeft: "1px solid #e2e8f0", display: "grid", gap: 14 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {badges.map((badge) => (
                            <span key={badge} style={{ padding: "5px 9px", borderRadius: 999, background: badge.includes("Giá") ? "#dcfce7" : badge.includes("❄️") || badge.includes("⚡") || badge.includes("🚀") ? "#dbeafe" : "#fef3c7", color: badge.includes("Giá") ? "#047857" : badge.includes("❄️") || badge.includes("⚡") || badge.includes("🚀") ? "#1d4ed8" : "#b45309", fontSize: 11, fontWeight: 950 }}>
                              {badge}
                            </span>
                          ))}
                        </div>
                        <div style={{ fontWeight: 900, color: "#0f172a", minHeight: 38, fontSize: 14 }}>{getProductName(item)}</div>
                        <div style={{ display: "grid", gap: 12 }}>
                          {defs.metrics.map((metric) => {
                            const score = scores[metric.key] || 0;
                            const maxScore = metricMaxScores[metric.key] || 0;

                            // ✅ Fix 4: Highlight GREEN chỉ khi sản phẩm NÀY có điểm cao nhất
                            // VÀ không phải tất cả sản phẩm đều bằng nhau (tránh highlight vô nghĩa)
                            const allSameScore = allProductScores.every(
                              s => (s.scores[metric.key] || 0) === maxScore
                            );
                            const isBestOnMetric = score > 0 && score === maxScore
                              && !allSameScore && allProductScores.length >= 2;

                            return (
                              <div key={metric.key} style={{ display: "grid", gap: 4 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, fontWeight: 800 }}>
                                  <span style={{ color: isBestOnMetric ? "#047857" : "#334155" }}>
                                    {metric.label}
                                    {isBestOnMetric && (
                                      <span style={{ marginLeft: 5, fontSize: 10, padding: "1px 5px", borderRadius: 999, background: "#d1fae5", color: "#047857" }}>Tốt hơn</span>
                                    )}
                                  </span>
                                  <span style={{ color: isBestOnMetric ? "#047857" : metric.tone, fontWeight: 900 }}>
                                    {score > 0 ? `${score}/100` : "—"}
                                  </span>
                                </div>
                                <div style={{ height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                                  <div style={{
                                    width: `${score}%`,
                                    height: "100%",
                                    borderRadius: 999,
                                    background: isBestOnMetric
                                      ? "linear-gradient(90deg, #10b981, #059669)"
                                      : `linear-gradient(90deg, ${metric.tone}, ${metric.tone}cc)`,
                                    transition: "width 0.6s ease"
                                  }} />
                                </div>
                                <div style={{ fontSize: 10.5, color: "#64748b", fontStyle: "italic" }}>
                                  💡 {metric.formula}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 4 }}>PHÙ HỢP CHO AI</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                            {scores.overall >= 90 ? "Người dùng chuyên nghiệp" : scores.overall >= 75 ? "Gaming / Đa dụng" : "Cần thêm thông số"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })() : null}


        {/* ── Comparison Table ── */}
        {!loadingCompare && comparedItems.length >= 2 && (
          <div style={{ background: "#fff", borderRadius: 28, border: "1px solid #e2e8f0", overflowX: "auto", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: `220px repeat(${comparedItems.length}, minmax(220px, 1fr))`, borderBottom: "2px solid #f1f5f9", minWidth: 220 + comparedItems.length * 220 }}>
              <div style={{ padding: "20px 24px", background: "#f8fafc", fontWeight: 800, fontSize: 14, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Tiêu chí so sánh
              </div>
              {comparedItems.map((item, i) => {
                const color = SLOT_COLORS[i] || "#3b82f6";
                const price = getProductPrice(item);
                const itemId = getProductId(item);
                return (
                  <div key={itemId} style={{ padding: "20px 20px", borderLeft: `3px solid ${color}`, background: `${color}08` }}>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>{getCategoryName(item)}</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", lineHeight: 1.3, marginBottom: 8 }}>{getProductName(item)}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                      {itemId === bestPriceId ? (
                        <span style={{ padding: "4px 8px", borderRadius: 999, background: "#ecfdf5", color: "#047857", fontSize: 11, fontWeight: 900 }}>Giá tốt nhất</span>
                      ) : null}
                      {itemId === bestPickId ? (
                        <span style={{ padding: "4px 8px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontSize: 11, fontWeight: 900 }}>Đáng mua nhất</span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color }}>{price > 0 ? `${formatCurrency(price)}đ` : "—"}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                      <Link
                        to={`/products/${item.slug || itemId}`}
                        style={{ display: "inline-flex", padding: "8px 10px", borderRadius: 10, border: `1px solid ${color}33`, color, textDecoration: "none", fontWeight: 800, fontSize: 12 }}
                      >
                        Xem chi tiết
                      </Link>
                      <button
                        type="button"
                        disabled={cartLoadingId === itemId || getProductStock(item) <= 0}
                        onClick={() => handleAddToCart(item)}
                        style={{ display: "inline-flex", padding: "8px 10px", borderRadius: 10, border: "none", background: getProductStock(item) > 0 ? color : "#cbd5e1", color: "#fff", fontWeight: 800, fontSize: 12, cursor: getProductStock(item) > 0 ? "pointer" : "not-allowed" }}
                      >
                        {cartLoadingId === itemId ? "Đang thêm..." : "Thêm giỏ"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Fixed rows: Price, Stock */}
            {[
              {
                label: "💰 Giá bán",
                render: (item) => {
                  const price = getProductPrice(item);
                  const isBest = getProductId(item) === bestPriceId;
                  return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 900, color: isBest ? "#047857" : "#0f172a" }}>
                      {price > 0 ? `${formatCurrency(price)}đ` : "—"}
                      {isBest ? <span style={{ fontSize: 11, padding: "3px 7px", borderRadius: 999, background: "#dcfce7", color: "#047857" }}>Tốt nhất</span> : null}
                    </span>
                  );
                }
              },
              {
                label: "📦 Tồn kho",
                render: (item) => {
                  const qty = getProductStock(item);
                  return <span style={{ fontWeight: 700, color: qty > 0 ? "#15803d" : "#ef4444" }}>{qty > 0 ? `${qty} sản phẩm` : "Hết hàng"}</span>;
                }
              },
              {
                label: "🏷 Thương hiệu",
                render: (item) => getBrandName(item)
              },
              {
                label: "📂 Danh mục",
                render: (item) => getCategoryName(item)
              }
            ].map((row, ri) => (
              <div key={ri} style={{ display: "grid", gridTemplateColumns: `220px repeat(${comparedItems.length}, minmax(220px, 1fr))`, borderBottom: "1px solid #f1f5f9", background: ri % 2 === 0 ? "#fff" : "#fafbff", minWidth: 220 + comparedItems.length * 220 }}>
                <div style={{ padding: "16px 24px", fontWeight: 700, fontSize: 14, color: "#374151", background: "#f8fafc", borderRight: "1px solid #f1f5f9" }}>{row.label}</div>
                {comparedItems.map((item, ci) => (
                  <div key={getProductId(item)} style={{ padding: "16px 20px", fontSize: 14, borderLeft: ci > 0 ? "1px solid #f1f5f9" : "none" }}>
                    {row.render(item)}
                  </div>
                ))}
              </div>
            ))}

            {/* Dynamic spec rows */}
            {(attributeNames.length > 0 ? attributeNames : allSpecKeys).length > 0 && (
              <>
                <div style={{ padding: "14px 24px", background: "#f8fafc", borderTop: "2px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 900, fontSize: 14, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>⚙️ {specGroupTitle}</div>
                </div>
                {(attributeNames.length > 0 ? attributeNames : allSpecKeys).map((key, ki) => {
                  // ✅ Fix Bug #5: dùng superiorSpecMap đã được tính sẵn ngoài .map()
                  return (
                    <div key={ki} style={{ display: "grid", gridTemplateColumns: `220px repeat(${comparedItems.length}, minmax(220px, 1fr))`, borderBottom: "1px solid #f1f5f9", background: ki % 2 === 0 ? "#fff" : "#fafbff", minWidth: 220 + comparedItems.length * 220 }}>
                      <div style={{ padding: "14px 24px", fontWeight: 700, fontSize: 13, color: "#475569", background: "#f8fafc", borderRight: "1px solid #f1f5f9", textTransform: "capitalize" }}>
                        {String(key).replace(/_/g, " ")}
                      </div>
                      {comparedItems.map((item, ci) => {
                        const itemId = getProductId(item);
                        // ✅ Dùng smartSpecsMap pre-computed thay vì gọi extractSmartSpecs() lại
                        const smartSpecs = smartSpecsMap[itemId] || {};
                        const specs = normalizeSpecs(item);
                        // ✅ Fix Bug #4: dùng "—" thay vì "Chính hãng" khi spec không tồn tại
                        const val = smartSpecs[key] || specs[key] || "—";

                        // ✅ Fix Bug #2: chỉ dùng so sánh tương đối từ superiorSpecMap
                        // KHÔNG còn fallback tuyệt đối (val.includes("360mm") ...) gây highlight cả 2 bên
                        const isSuperior = superiorSpecMap[itemId]?.superiorKeys?.has(key) === true;

                        return (
                          <div
                            key={itemId}
                            style={{
                              padding: "14px 20px",
                              fontSize: 13,
                              borderLeft: ci > 0 ? "1px solid #f1f5f9" : "none",
                              backgroundColor: isSuperior ? "#ecfdf5" : "transparent",
                              color: isSuperior ? "#047857" : "#0f172a",
                              fontWeight: isSuperior ? 900 : 600,
                              transition: "all 0.2s"
                            }}
                          >
                            {val}
                            {isSuperior && (
                              <span style={{ marginLeft: 8, padding: "2px 7px", borderRadius: 999, background: "#bbf7d0", color: "#047857", fontSize: 10.5, fontWeight: 900 }}>
                                ✨ Vượt trội
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            )}

            {/* Add to cart row */}
            <div style={{ display: "grid", gridTemplateColumns: `220px repeat(${comparedItems.length}, minmax(220px, 1fr))`, background: "#f8fafc", borderTop: "2px solid #e2e8f0", minWidth: 220 + comparedItems.length * 220 }}>
              <div style={{ padding: "20px 24px", fontWeight: 700, fontSize: 13, color: "#64748b" }}>Thao tác</div>
              {comparedItems.map((item, ci) => {
                const color = SLOT_COLORS[ci] || "#3b82f6";
                const itemId = getProductId(item);
                return (
                  <div key={itemId} style={{ padding: "20px 20px", borderLeft: ci > 0 ? "1px solid #e2e8f0" : "none", display: "flex", flexDirection: "column", gap: 8 }}>
                    <Link
                      to={`/products/${item.slug || itemId}`}
                      style={{ display: "block", textAlign: "center", padding: "10px 16px", background: "#fff", border: `1px solid ${color}44`, color, borderRadius: 12, fontWeight: 800, fontSize: 13, textDecoration: "none" }}
                    >
                      Xem chi tiết
                    </Link>
                    <button
                      type="button"
                      disabled={cartLoadingId === itemId || getProductStock(item) <= 0}
                      onClick={() => handleAddToCart(item)}
                      style={{ padding: "10px 16px", background: getProductStock(item) > 0 ? `linear-gradient(135deg, ${color}, ${color}cc)` : "#cbd5e1", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, cursor: getProductStock(item) > 0 ? "pointer" : "not-allowed", fontWeight: 800 }}
                    >
                      {cartLoadingId === itemId ? "Đang thêm..." : getProductStock(item) > 0 ? "Thêm vào giỏ" : "Hết hàng"}
                    </button>
                    <button
                      onClick={() => removeProduct(itemId)}
                      style={{ padding: "8px 16px", background: "none", border: "1px solid #e2e8f0", borderRadius: 12, color: "#94a3b8", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
                    >
                      Xóa khỏi SS
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {selectedIds.length === 0 && !loadingCompare && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>⚖️</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#374151", marginBottom: 12 }}>Chưa có sản phẩm nào</h2>
            <p style={{ fontSize: 16, maxWidth: 400, margin: "0 auto 24px" }}>
              Dùng ô tìm kiếm phía trên hoặc vào trang sản phẩm và nhấn nút "So sánh" để thêm vào đây.
            </p>
            <Link to="/products" style={{ display: "inline-block", padding: "12px 28px", background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "#fff", borderRadius: 14, fontWeight: 800, textDecoration: "none", fontSize: 15 }}>
              Duyệt sản phẩm →
            </Link>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        select option { background: #fff; color: #0f172a; }
      `}</style>
    </div>
  );
}
