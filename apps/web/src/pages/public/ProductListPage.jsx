import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";

import { ProductCard } from "../../components/common/ProductCard";
import { getProductFilterOptions, getProducts } from "../../services/catalog.service";

/* ── Helpers ─────────────────────────────────────────────────── */
function normalizeProductResponse(data) {
  const payload = data?.data || data;
  if (Array.isArray(payload)) {
    return { items: payload, pagination: { page: 1, limit: payload.length, totalItems: payload.length, totalPages: 1 } };
  }
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    pagination: payload?.pagination || { page: 1, limit: 12, totalItems: 0, totalPages: 0 }
  };
}

function normalizeFilterOptions(data) {
  const payload = data?.data || data || {};
  return {
    categories: Array.isArray(payload.categories) ? payload.categories : [],
    brands: Array.isArray(payload.brands) ? payload.brands : [],
    attributes: Array.isArray(payload.attributes) ? payload.attributes : []
  };
}

function parseAttributeIdsFromUrl(searchParams) {
  const raw = searchParams.get("attribute_value_ids") || "";
  return raw.split(",").map((item) => Number(String(item).trim())).filter((id) => Number.isInteger(id) && id > 0);
}

const SORT_OPTIONS = [
  { value: "featured",   label: "🌟 Nổi bật nhất" },
  { value: "newest",     label: "🆕 Mới nhất" },
  { value: "price_asc",  label: "💰 Giá tăng dần" },
  { value: "price_desc", label: "💰 Giá giảm dần" },
  { value: "name_asc",   label: "🔤 Tên A-Z" },
];

function getFacetIcon(facetName) {
  const n = String(facetName || "").toLowerCase();
  if (n.includes("vram") || n.includes("vga")) return "🎮";
  if (n.includes("ram") || n.includes("bộ nhớ")) return "💾";
  if (n.includes("bus") || n.includes("tốc độ")) return "⚡";
  if (n.includes("socket") || n.includes("cpu") || n.includes("nhân")) return "🧠";
  if (n.includes("chipset")) return "🧩";
  if (n.includes("form factor") || n.includes("kích thước")) return "📐";
  if (n.includes("ổ cứng") || n.includes("ssd") || n.includes("kết nối")) return "🗄️";
  if (n.includes("nguồn") || n.includes("công suất") || n.includes("psu") || n.includes("dây")) return "🔌";
  if (n.includes("tản") || n.includes("radiator") || n.includes("quạt") || n.includes("nhiệt")) return "❄️";
  if (n.includes("led")) return "✨";
  return "⚙️";
}

/* ── FilterSection — accordion item ─────────────────────────── */
function FilterSection({ title, icon, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyRef = useRef(null);

  return (
    <div style={{
      borderRadius: 12,
      border: "1px solid var(--market-border, #e2e8f0)",
      overflow: "hidden",
      background: "var(--market-surface, #fff)",
      transition: "box-shadow 0.2s ease",
    }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", padding: "11px 14px",
          background: "transparent", border: "none",
          cursor: "pointer", gap: 8,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 800, color: "var(--market-text, #0f172a)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {icon} {title}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1)", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div ref={bodyRef} style={{
        maxHeight: open ? 600 : 0,
        overflow: "hidden",
        transition: "max-height 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
      }}>
        <div style={{ padding: "4px 14px 14px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Price Range Slider ──────────────────────────────────────── */
function PriceRangeInputs({ minPrice, maxPrice, onChange }) {
  const formatM = (v) => {
    const n = Number(v);
    if (!n) return "";
    if (n >= 1000000) return `${(n / 1000000).toFixed(0)}tr`;
    return `${(n / 1000).toFixed(0)}k`;
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* Visual range track */}
      <div style={{
        height: 4, background: "var(--market-border, #e2e8f0)", borderRadius: 99,
        position: "relative", margin: "4px 0",
      }}>
        <div style={{
          position: "absolute", left: 0, right: 0, top: 0, height: "100%",
          background: "linear-gradient(90deg, #1d4ed8, #3b82f6)",
          borderRadius: 99,
          boxShadow: "0 0 6px rgba(59,130,246,0.4)",
        }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          { name: "min_price", value: minPrice, placeholder: "Từ (VNĐ)" },
          { name: "max_price", value: maxPrice, placeholder: "Đến (VNĐ)" },
        ].map(({ name, value, placeholder }) => (
          <div key={name} style={{ position: "relative" }}>
            <input
              type="number"
              name={name}
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 9,
                border: "1px solid var(--market-border, #e2e8f0)",
                background: "var(--market-surface-soft, #f8fafc)",
                color: "var(--market-text, #0f172a)",
                fontSize: 12,
                fontWeight: 600,
                outline: "none",
                transition: "border-color 0.18s ease",
                boxSizing: "border-box",
                font: "inherit",
              }}
              onFocus={e => { e.target.style.borderColor = "rgba(59,130,246,0.6)"; e.target.style.boxShadow = "0 0 0 2px rgba(59,130,246,0.1)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--market-border, #e2e8f0)"; e.target.style.boxShadow = "none"; }}
            />
          </div>
        ))}
      </div>

      {/* Quick price presets */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {[
          { label: "< 5tr", min: "", max: "5000000" },
          { label: "5-15tr", min: "5000000", max: "15000000" },
          { label: "15-30tr", min: "15000000", max: "30000000" },
          { label: "> 30tr", min: "30000000", max: "" },
        ].map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange({ target: { name: "min_price", value: preset.min } }, { target: { name: "max_price", value: preset.max } })}
            style={{
              padding: "3px 8px",
              borderRadius: 99,
              border: "1px solid var(--market-border, #e2e8f0)",
              background: "var(--market-surface-soft, #f8fafc)",
              color: "var(--market-muted, #64748b)",
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(37,99,235,0.08)"; e.currentTarget.style.borderColor = "rgba(37,99,235,0.3)"; e.currentTarget.style.color = "#2563eb"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--market-surface-soft, #f8fafc)"; e.currentTarget.style.borderColor = "var(--market-border, #e2e8f0)"; e.currentTarget.style.color = "var(--market-muted, #64748b)"; }}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────── */
export function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") || searchParams.get("q") || searchParams.get("keyword") || "";

  const [filters, setFilters] = useState({
    search: initialSearch,
    category_id: searchParams.get("category_id") || "",
    brand_id: searchParams.get("brand_id") || "",
    min_price: searchParams.get("min_price") || "",
    max_price: searchParams.get("max_price") || "",
    attribute_value_ids: parseAttributeIdsFromUrl(searchParams),
    sort: searchParams.get("sort") || "featured",
    page: Number(searchParams.get("page") || 1),
    limit: 12
  });

  const [products,    setProducts]    = useState([]);
  const [categories,  setCategories]  = useState([]);
  const [brands,      setBrands]      = useState([]);
  const [attributes,  setAttributes]  = useState([]);
  const [pagination,  setPagination]  = useState({ page: 1, limit: 12, totalItems: 0, totalPages: 0 });
  const [loading,     setLoading]     = useState(true);
  const [errorMessage,setErrorMessage]= useState("");
  const [viewMode,    setViewMode]    = useState("grid"); // "grid" | "list"
  const [isScrolled,  setIsScrolled]  = useState(false);

  /* Sticky sort bar detection */
  useEffect(() => {
    const handler = () => setIsScrolled(window.scrollY > 180);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const hasProducts = products.length > 0;

  const queryParams = useMemo(() => ({
    search: filters.search || undefined,
    category_id: filters.category_id || undefined,
    brand_id: filters.brand_id || undefined,
    min_price: filters.min_price || undefined,
    max_price: filters.max_price || undefined,
    attribute_value_ids: filters.attribute_value_ids.length > 0 ? filters.attribute_value_ids.join(",") : undefined,
    sort: filters.sort !== "featured" ? filters.sort : "featured",
    page: filters.page,
    limit: filters.limit
  }), [filters]);

  function syncFiltersToUrl(nextFilters) {
    const params = new URLSearchParams();
    if (nextFilters.search)               params.set("search", nextFilters.search);
    if (nextFilters.category_id)          params.set("category_id", nextFilters.category_id);
    if (nextFilters.brand_id)             params.set("brand_id", nextFilters.brand_id);
    if (nextFilters.min_price)            params.set("min_price", nextFilters.min_price);
    if (nextFilters.max_price)            params.set("max_price", nextFilters.max_price);
    if (nextFilters.attribute_value_ids?.length) params.set("attribute_value_ids", nextFilters.attribute_value_ids.join(","));
    if (nextFilters.sort && nextFilters.sort !== "featured") params.set("sort", nextFilters.sort);
    if (nextFilters.page > 1)             params.set("page", String(nextFilters.page));
    setSearchParams(params);
  }

  useEffect(() => {
    async function loadFilterData() {
      try {
        const response = await getProductFilterOptions({ category_id: filters.category_id });
        const normalized = normalizeFilterOptions(response);
        setCategories(normalized.categories);
        setBrands(normalized.brands);
        setAttributes(normalized.attributes);
      } catch {
        setCategories([]);
        setBrands([]);
        setAttributes([]);
      }
    }
    loadFilterData();
  }, [filters.category_id]);

  useEffect(() => {
    const currentSearch = searchParams.get("search") || searchParams.get("q") || searchParams.get("keyword") || "";
    setFilters(prev => ({
      ...prev,
      search: currentSearch,
      category_id: searchParams.get("category_id") || "",
      brand_id: searchParams.get("brand_id") || "",
      min_price: searchParams.get("min_price") || "",
      max_price: searchParams.get("max_price") || "",
      attribute_value_ids: parseAttributeIdsFromUrl(searchParams),
      sort: searchParams.get("sort") || "featured",
      page: Number(searchParams.get("page") || 1)
    }));
  }, [searchParams]);

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true); setErrorMessage("");
        const response = await getProducts(queryParams);
        const normalized = normalizeProductResponse(response);
        setProducts(normalized.items);
        setPagination(normalized.pagination);
      } catch (error) {
        setErrorMessage(axios.isAxiosError(error)
          ? error.response?.data?.message || "Không thể tải danh sách sản phẩm."
          : error.message || "Không thể tải danh sách sản phẩm.");
        setProducts([]);
      } finally { setLoading(false); }
    }
    loadProducts();
  }, [queryParams]);

  function handleFilterChange(eventOrE1, eventOrE2) {
    // Supports single event or double event (price preset)
    if (eventOrE2) {
      const { name: n1, value: v1 } = eventOrE1.target;
      const { name: n2, value: v2 } = eventOrE2.target;
      setFilters(prev => ({ ...prev, [n1]: v1, [n2]: v2, page: 1 }));
    } else {
      const { name, value } = eventOrE1.target;
      setFilters(prev => ({ ...prev, [name]: value, page: 1 }));
    }
  }

  function handleAttributeToggle(attributeValueId) {
    const numericId = Number(attributeValueId);
    setFilters(prev => {
      const exists = prev.attribute_value_ids.includes(numericId);
      const next = {
        ...prev,
        attribute_value_ids: exists
          ? prev.attribute_value_ids.filter(id => id !== numericId)
          : [...prev.attribute_value_ids, numericId],
        page: 1
      };
      syncFiltersToUrl(next);
      return next;
    });
  }

  function clearAttributeFilters() {
    setFilters(prev => {
      const next = { ...prev, attribute_value_ids: [], page: 1 };
      syncFiltersToUrl(next);
      return next;
    });
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    const next = { ...filters, page: 1 };
    setFilters(next);
    syncFiltersToUrl(next);
  }

  function goToPage(nextPage) {
    setFilters(prev => {
      const next = { ...prev, page: nextPage };
      syncFiltersToUrl(next);
      return next;
    });
  }

  /* Active attribute labels map */
  const activeAttributeLabels = useMemo(() => {
    const result = [];
    for (const attr of attributes) {
      for (const val of attr.values || []) {
        if (filters.attribute_value_ids.includes(Number(val.id))) {
          result.push({
            id: Number(val.id),
            attributeName: attr.name,
            value: val.value
          });
        }
      }
    }
    return result;
  }, [attributes, filters.attribute_value_ids]);

  /* Active filter count */
  const activeFilterCount = [
    filters.search,
    filters.category_id, filters.brand_id,
    filters.min_price, filters.max_price,
  ].filter(Boolean).length + filters.attribute_value_ids.length;

  return (
    <div style={{ display: "grid", gap: 28 }}>

      {/* ── Hero Banner V2 ── */}
      <section style={{
        padding: "44px 40px",
        borderRadius: 28,
        background: "linear-gradient(135deg, #080d1a 0%, #0f1f45 50%, #0d2b5a 100%)",
        border: "1px solid rgba(59,130,246,0.15)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
        display: "grid",
        gap: 12,
        color: "#fff",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Mesh background */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(59,130,246,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }} />
        {/* Glow orbs */}
        <div style={{ position: "absolute", top: -60, right: -60, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -40, right: "30%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,166,35,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#60a5fa", position: "relative" }}>
          {filters.search ? "🔍 KẾT QUẢ TÌM KIẾM" : "🛍️ DANH MỤC CỬA HÀNG"}
        </div>
        <h1 style={{ margin: 0, fontSize: "clamp(28px, 4vw, 42px)", lineHeight: 1.1, letterSpacing: "-0.03em", maxWidth: 680, position: "relative", fontFamily: "'Be Vietnam Pro', sans-serif" }}>
          {filters.search ? (
            <>
              Kết quả cho:{" "}
              <span style={{ background: "linear-gradient(135deg, #60a5fa, #f5a623)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                "{filters.search}"
              </span>
            </>
          ) : (
            <>
              Khám phá thế giới{" "}
              <span style={{ background: "linear-gradient(135deg, #60a5fa, #f5a623)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                công nghệ đỉnh cao
              </span>
            </>
          )}
        </h1>
        <p style={{ margin: 0, color: "rgba(148,163,184,0.85)", fontSize: 15, maxWidth: 640, lineHeight: 1.65, position: "relative" }}>
          {filters.search
            ? `Hiển thị danh sách sản phẩm và linh kiện phù hợp với từ khóa "${filters.search}".`
            : "Tìm nhanh linh kiện, máy tính và phụ kiện chính hãng — lọc chuyên sâu theo thông số kỹ thuật chi tiết."}
        </p>
      </section>

      {/* ── Main Layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "268px 1fr", gap: 24, alignItems: "start" }}>

        {/* ── FILTER SIDEBAR V2 ── */}
        <aside style={{
          background: "var(--market-surface, #fff)",
          borderRadius: 20,
          border: "1px solid var(--market-border, #e2e8f0)",
          boxShadow: "var(--v2-shadow-sm, 0 4px 16px rgba(0,0,0,0.06))",
          position: "sticky",
          top: 108,
          overflow: "hidden",
        }}>
          {/* Sidebar Header */}
          <div style={{
            padding: "16px 18px 12px",
            borderBottom: "1px solid var(--market-border, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, rgba(37,99,235,0.04), rgba(245,166,35,0.02))",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 28, height: 28, borderRadius: 8,
                background: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13,
              }}>🔧</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "var(--market-text, #0f172a)" }}>Bộ lọc</span>
              {activeFilterCount > 0 && (
                <span style={{
                  background: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
                  color: "#fff", fontSize: 10, fontWeight: 800,
                  padding: "2px 7px", borderRadius: 99,
                  boxShadow: "0 2px 6px rgba(37,99,235,0.35)",
                }}>
                  {activeFilterCount}
                </span>
              )}
            </div>
            {activeFilterCount > 0 && (
              <button
                id="sidebar-clear-all-btn"
                data-testid="sidebar-clear-all-btn"
                type="button"
                onClick={() => {
                  const next = { ...filters, search: "", category_id: "", brand_id: "", min_price: "", max_price: "", attribute_value_ids: [], page: 1 };
                  setFilters(next);
                  syncFiltersToUrl(next);
                }}
                style={{ background: "none", border: "none", color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: "2px 6px", borderRadius: 6 }}
              >
                Xóa tất cả
              </button>
            )}
          </div>

          {/* Sidebar Body */}
          <form id="sidebar-filter-form" data-testid="sidebar-filter-form" onSubmit={handleSearchSubmit} style={{ display: "grid", gap: 6, padding: "12px 12px 16px" }}>

            {/* Search */}
            <FilterSection title="Từ khóa" icon="🔍" defaultOpen={true}>
              <div style={{ position: "relative" }}>
                <input
                  id="sidebar-search-input"
                  data-testid="sidebar-search-input"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Tên sản phẩm..."
                  style={{
                    width: "100%", padding: "9px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--market-border, #e2e8f0)",
                    background: "var(--market-surface-soft, #f8fafc)",
                    color: "var(--market-text, #0f172a)",
                    fontSize: 13, fontWeight: 500,
                    outline: "none", boxSizing: "border-box", font: "inherit",
                    transition: "all 0.18s ease",
                  }}
                  onFocus={e => { e.target.style.borderColor = "rgba(59,130,246,0.6)"; e.target.style.boxShadow = "0 0 0 2px rgba(59,130,246,0.1)"; }}
                  onBlur={e => { e.target.style.borderColor = "var(--market-border, #e2e8f0)"; e.target.style.boxShadow = "none"; }}
                />
              </div>
            </FilterSection>

            {/* Category */}
            {categories.length > 0 && (
              <FilterSection title="Danh mục" icon="📂" defaultOpen={true}>
                <div style={{ display: "grid", gap: 4, maxHeight: 220, overflowY: "auto" }}>
                  {[{ id: "", name: "Tất cả danh mục" }, ...categories].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setFilters(p => ({ ...p, category_id: String(c.id), page: 1 })); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "7px 10px", borderRadius: 9,
                        border: `1px solid ${String(filters.category_id) === String(c.id) ? "rgba(37,99,235,0.35)" : "transparent"}`,
                        background: String(filters.category_id) === String(c.id) ? "rgba(37,99,235,0.08)" : "transparent",
                        color: String(filters.category_id) === String(c.id) ? "#1d4ed8" : "var(--market-text, #334155)",
                        fontSize: 13, fontWeight: String(filters.category_id) === String(c.id) ? 700 : 500,
                        textAlign: "left", cursor: "pointer", width: "100%",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={e => { if (String(filters.category_id) !== String(c.id)) { e.currentTarget.style.background = "rgba(37,99,235,0.04)"; e.currentTarget.style.color = "#2563eb"; } }}
                      onMouseLeave={e => { if (String(filters.category_id) !== String(c.id)) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--market-text, #334155)"; } }}
                    >
                      {String(filters.category_id) === String(c.id) && <span style={{ color: "#2563eb" }}>✓</span>}
                      {c.name}
                    </button>
                  ))}
                </div>
              </FilterSection>
            )}

            {/* Brand */}
            {brands.length > 0 && (
              <FilterSection title="Thương hiệu" icon="🏷️" defaultOpen={false}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {brands.map((b) => {
                    const isActive = String(filters.brand_id) === String(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setFilters(p => ({ ...p, brand_id: isActive ? "" : String(b.id), page: 1 }))}
                        style={{
                          padding: "5px 12px", borderRadius: 99,
                          border: `1px solid ${isActive ? "rgba(37,99,235,0.4)" : "var(--market-border, #e2e8f0)"}`,
                          background: isActive ? "rgba(37,99,235,0.1)" : "var(--market-surface-soft, #f8fafc)",
                          color: isActive ? "#1d4ed8" : "var(--market-text, #475569)",
                          fontSize: 12, fontWeight: isActive ? 700 : 500,
                          cursor: "pointer",
                          transition: "all 0.18s cubic-bezier(0.34,1.56,0.64,1)",
                          transform: isActive ? "scale(1.04)" : "scale(1)",
                        }}
                      >
                        {b.name}
                      </button>
                    );
                  })}
                </div>
              </FilterSection>
            )}

            {/* Price Range */}
            <FilterSection title="Khoảng giá" icon="💰" defaultOpen={true}>
              <PriceRangeInputs
                minPrice={filters.min_price}
                maxPrice={filters.max_price}
                onChange={handleFilterChange}
              />
            </FilterSection>

            {/* Dynamic Category Faceted Attributes */}
            {attributes.map((attr, idx) => {
              const icon = getFacetIcon(attr.name);
              const activeCountInAttr = (attr.values || []).filter(v => filters.attribute_value_ids.includes(Number(v.id))).length;
              return (
                <FilterSection
                  key={attr.id || attr.name}
                  title={`${attr.name}${activeCountInAttr > 0 ? ` (${activeCountInAttr})` : ""}`}
                  icon={icon}
                  defaultOpen={idx < 4 || activeCountInAttr > 0}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(attr.values || []).map((val) => {
                      const valueId = Number(val.id);
                      const isChecked = filters.attribute_value_ids.includes(valueId);
                      return (
                        <button
                          key={val.id}
                          type="button"
                          onClick={() => handleAttributeToggle(valueId)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "5px 10px",
                            borderRadius: 8,
                            fontSize: 11.5,
                            cursor: "pointer",
                            border: isChecked ? "1.5px solid #2563eb" : "1px solid var(--market-border, #e2e8f0)",
                            background: isChecked ? "rgba(37,99,235,0.12)" : "var(--market-surface-soft, #f8fafc)",
                            color: isChecked ? "#1d4ed8" : "var(--market-text, #334155)",
                            fontWeight: isChecked ? 800 : 500,
                            boxShadow: isChecked ? "0 2px 8px rgba(37,99,235,0.18)" : "none",
                            transition: "all 0.18s cubic-bezier(0.34,1.56,0.64,1)",
                            transform: isChecked ? "scale(1.02)" : "scale(1)",
                          }}
                        >
                          {isChecked && <span style={{ color: "#2563eb", fontWeight: 900 }}>✓</span>}
                          <span>{val.value}</span>
                          {val.productCount !== undefined && (
                            <span style={{
                              fontSize: 10,
                              opacity: 0.75,
                              background: isChecked ? "rgba(37,99,235,0.22)" : "rgba(0,0,0,0.06)",
                              padding: "1px 5px",
                              borderRadius: 99,
                              fontWeight: 700
                            }}>
                              {val.productCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </FilterSection>
              );
            })}

            {/* Apply Button */}
            <button
              type="submit"
              style={{
                padding: "12px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
                color: "#ffffff",
                fontWeight: 800, fontSize: 13,
                cursor: "pointer",
                marginTop: 4,
                transition: "all 0.22s cubic-bezier(0.34,1.56,0.64,1)",
                boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
                letterSpacing: "0.04em",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(37,99,235,0.45)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(37,99,235,0.35)"; }}
            >
              🔍 ÁP DỤNG BỘ LỌC
            </button>
          </form>
        </aside>

        {/* ── MAIN PRODUCT AREA ── */}
        <main style={{ display: "grid", gap: 20 }}>

          {/* ── Sort & Filter Bar — Sticky Glass ── */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 20px",
            background: isScrolled
              ? "rgba(255,255,255,0.92)"
              : "var(--market-surface, #fff)",
            backdropFilter: isScrolled ? "blur(16px)" : "none",
            WebkitBackdropFilter: isScrolled ? "blur(16px)" : "none",
            borderRadius: 16,
            boxShadow: isScrolled
              ? "0 8px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.5)"
              : "var(--v2-shadow-sm, 0 4px 16px rgba(0,0,0,0.06))",
            border: "1px solid var(--market-border, #e2e8f0)",
            position: "sticky",
            top: 108,
            zIndex: 20,
            transition: "all 0.3s ease",
            gap: 12,
            flexWrap: "wrap",
          }}>
            {/* Results count */}
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--market-text, #334155)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block", boxShadow: "0 0 6px rgba(16,185,129,0.6)" }} />
              <span style={{ color: "#1d4ed8", fontWeight: 800 }}>{products.length}</span>
              <span>/ {pagination.totalItems || products.length} sản phẩm</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Sort Select */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--market-muted, #64748b)", whiteSpace: "nowrap" }}>Sắp xếp:</span>
                <select
                  id="product-sort-select"
                  data-testid="product-sort-select"
                  name="sort"
                  value={filters.sort}
                  onChange={(e) => {
                    const next = { ...filters, sort: e.target.value, page: 1 };
                    setFilters(next);
                    syncFiltersToUrl(next);
                  }}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--market-border, #e2e8f0)",
                    background: "var(--market-surface-soft, #f8fafc)",
                    color: "var(--market-text, #0f172a)",
                    fontSize: 13, fontWeight: 600,
                    cursor: "pointer",
                    outline: "none",
                    minWidth: 160,
                    font: "inherit",
                    transition: "border-color 0.18s ease",
                  }}
                  onFocus={e => e.target.style.borderColor = "rgba(59,130,246,0.5)"}
                  onBlur={e => e.target.style.borderColor = "var(--market-border, #e2e8f0)"}
                >
                  {SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>

              {/* View Mode Toggle */}
              <div style={{
                display: "flex",
                border: "1px solid var(--market-border, #e2e8f0)",
                borderRadius: 10,
                overflow: "hidden",
                background: "var(--market-surface-soft, #f8fafc)",
              }}>
                {[
                  { mode: "grid", icon: "⊞" },
                  { mode: "list", icon: "☰" },
                ].map(({ mode, icon }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    title={`${mode === "grid" ? "Lưới" : "Danh sách"}`}
                    style={{
                      width: 36, height: 36,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: viewMode === mode ? "linear-gradient(135deg, #1d4ed8, #3b82f6)" : "transparent",
                      color: viewMode === mode ? "#fff" : "var(--market-muted, #64748b)",
                      border: "none", cursor: "pointer",
                      fontSize: mode === "grid" ? 16 : 18,
                      transition: "all 0.18s cubic-bezier(0.34,1.56,0.64,1)",
                      fontWeight: 700,
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Active Facet Filter Chips Bar ── */}
          {(Boolean(filters.search) || Boolean(filters.category_id) || Boolean(filters.brand_id) || Boolean(filters.min_price || filters.max_price) || activeAttributeLabels.length > 0) && (
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              background: "var(--market-surface, #fff)",
              borderRadius: 14,
              border: "1px solid var(--market-border, #e2e8f0)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--market-muted, #64748b)", display: "flex", alignItems: "center", gap: 5 }}>
                🔍 Đang lọc:
              </span>

              {/* Search keyword chip */}
              {filters.search && (
                <span
                  id="filter-chip-search"
                  data-testid="filter-chip-search"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "4px 10px", borderRadius: 8,
                    background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.35)",
                    color: "#1d4ed8", fontSize: 12, fontWeight: 700
                  }}
                >
                  🔍 Từ khóa: <strong>"{filters.search}"</strong>
                  <button
                    id="clear-search-chip"
                    data-testid="clear-search-chip"
                    type="button"
                    onClick={() => {
                      const next = { ...filters, search: "", page: 1 };
                      setFilters(next);
                      syncFiltersToUrl(next);
                    }}
                    style={{ background: "none", border: "none", color: "#2563eb", fontWeight: 800, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </span>
              )}

              {/* Category chip */}
              {filters.category_id && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "4px 10px", borderRadius: 8,
                  background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.25)",
                  color: "#1d4ed8", fontSize: 12, fontWeight: 600
                }}>
                  📂 {categories.find(c => String(c.id) === String(filters.category_id))?.name || "Danh mục"}
                  <button type="button" onClick={() => {
                    const next = { ...filters, category_id: "", attribute_value_ids: [], page: 1 };
                    setFilters(next);
                    syncFiltersToUrl(next);
                  }} style={{ background: "none", border: "none", color: "#2563eb", fontWeight: 800, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>✕</button>
                </span>
              )}

              {/* Brand chip */}
              {filters.brand_id && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "4px 10px", borderRadius: 8,
                  background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.25)",
                  color: "#1d4ed8", fontSize: 12, fontWeight: 600
                }}>
                  🏷️ {brands.find(b => String(b.id) === String(filters.brand_id))?.name || "Thương hiệu"}
                  <button type="button" onClick={() => {
                    const next = { ...filters, brand_id: "", page: 1 };
                    setFilters(next);
                    syncFiltersToUrl(next);
                  }} style={{ background: "none", border: "none", color: "#2563eb", fontWeight: 800, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>✕</button>
                </span>
              )}

              {/* Price range chip */}
              {(filters.min_price || filters.max_price) && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "4px 10px", borderRadius: 8,
                  background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.25)",
                  color: "#1d4ed8", fontSize: 12, fontWeight: 600
                }}>
                  💰 {filters.min_price ? `${Number(filters.min_price).toLocaleString("vi-VN")}đ` : "0đ"} - {filters.max_price ? `${Number(filters.max_price).toLocaleString("vi-VN")}đ` : "Tối đa"}
                  <button type="button" onClick={() => {
                    const next = { ...filters, min_price: "", max_price: "", page: 1 };
                    setFilters(next);
                    syncFiltersToUrl(next);
                  }} style={{ background: "none", border: "none", color: "#2563eb", fontWeight: 800, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>✕</button>
                </span>
              )}

              {/* Technical Attribute chips */}
              {activeAttributeLabels.map(item => (
                <span key={item.id} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "4px 10px", borderRadius: 8,
                  background: "#eff6ff", border: "1px solid #93c5fd",
                  color: "#1d4ed8", fontSize: 12, fontWeight: 600
                }}>
                  {item.attributeName}: <strong>{item.value}</strong>
                  <button type="button" onClick={() => handleAttributeToggle(item.id)} style={{ background: "none", border: "none", color: "#2563eb", fontWeight: 800, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>✕</button>
                </span>
              ))}

              {/* Clear all button */}
              <button
                id="clear-all-filters-btn"
                data-testid="clear-all-filters-btn"
                type="button"
                onClick={() => {
                  const next = { ...filters, search: "", category_id: "", brand_id: "", min_price: "", max_price: "", attribute_value_ids: [], page: 1 };
                  setFilters(next);
                  syncFiltersToUrl(next);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#dc2626",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  padding: "4px 8px",
                  marginLeft: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                ✕ Xóa tất cả bộ lọc
              </button>
            </div>
          )}

          {/* ── Loading State ── */}
          {loading && (
            <div style={{
              display: "grid", placeItems: "center", padding: 60,
              background: "var(--market-surface, #fff)",
              borderRadius: 20, border: "1px solid var(--market-border, #e2e8f0)",
              gap: 16,
            }}>
              <div style={{
                width: 44, height: 44,
                border: "3px solid rgba(59,130,246,0.2)",
                borderTop: "3px solid #3b82f6",
                borderRadius: "50%",
                animation: "v2-spin 0.8s linear infinite",
              }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--market-muted, #64748b)" }}>Đang tải danh sách sản phẩm...</div>
            </div>
          )}

          {/* ── Error State ── */}
          {!loading && errorMessage && (
            <div style={{
              padding: 20, borderRadius: 16,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "#b91c1c", fontWeight: 600, fontSize: 14,
            }}>
              ⚠️ {errorMessage}
            </div>
          )}

          {/* ── Empty State ── */}
          {!loading && !errorMessage && !hasProducts && (
            <div style={{
              padding: "60px 40px", textAlign: "center",
              borderRadius: 20,
              background: "var(--market-surface, #fff)",
              border: "1px dashed var(--market-border, #e2e8f0)",
            }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>🔍</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--market-text, #0f172a)", marginBottom: 8 }}>Không tìm thấy sản phẩm nào</div>
              <div style={{ color: "var(--market-muted, #64748b)", fontSize: 14 }}>Hãy thử thay đổi điều kiện lọc hoặc xóa bớt thông số kỹ thuật.</div>
            </div>
          )}

          {/* ── Product Grid / List ── */}
          {!loading && hasProducts && (
            <>
              <div style={
                viewMode === "grid"
                  ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(228px, 1fr))", gap: 18 }
                  : { display: "grid", gridTemplateColumns: "1fr", gap: 10 }
              }>
                {products.map((product, idx) => (
                  <div
                    key={`${product.product_id || product.id}-${product.slug || "item"}`}
                    className="v2-pc-wrapper v2-animate-fadeUp"
                    style={{ transitionDelay: `${Math.min(idx * 0.05, 0.35)}s`, animation: "v2-fadeUp 0.4s ease both" }}
                  >
                    {viewMode === "list" ? (
                      /* List View Card */
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "100px 1fr auto",
                        gap: 16,
                        padding: 16,
                        background: "var(--market-surface, #fff)",
                        border: "1px solid var(--market-border, #e2e8f0)",
                        borderRadius: 16,
                        alignItems: "center",
                        transition: "all 0.22s ease",
                        cursor: "pointer",
                      }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(37,99,235,0.12)"; e.currentTarget.style.borderColor = "rgba(59,130,246,0.3)"; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "var(--market-border, #e2e8f0)"; }}
                      >
                        <img
                          src={product.imageUrl || product.image_url || ""}
                          alt={product.product_name || product.name || ""}
                          style={{ width: 90, height: 90, objectFit: "contain", borderRadius: 10, background: "#f8fafc" }}
                          onError={e => { e.target.style.display = "none"; }}
                        />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--market-text, #0f172a)", marginBottom: 4 }}>
                            {product.product_name || product.name}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--market-muted, #64748b)" }}>
                            {product.brand_name || ""} · {product.category_name || ""}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{
                            fontSize: 16, fontWeight: 900,
                            background: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
                            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                            marginBottom: 4,
                          }}>
                            {Number(product.price || 0).toLocaleString("vi-VN")}đ
                          </div>
                          <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700 }}>Còn hàng</div>
                        </div>
                      </div>
                    ) : (
                      <ProductCard product={product} />
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination V2 */}
              {pagination.totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => goToPage(Math.max(1, Number(pagination.page || 1) - 1))}
                    disabled={Number(pagination.page || 1) <= 1}
                    style={{
                      padding: "9px 18px", borderRadius: 10,
                      border: "1px solid var(--market-border, #e2e8f0)",
                      background: Number(pagination.page) <= 1 ? "var(--market-surface-soft, #f8fafc)" : "var(--market-surface, #fff)",
                      color: "var(--market-text, #334155)",
                      fontWeight: 700, fontSize: 13, cursor: Number(pagination.page) <= 1 ? "not-allowed" : "pointer",
                      opacity: Number(pagination.page) <= 1 ? 0.5 : 1,
                      transition: "all 0.18s ease",
                    }}
                    onMouseEnter={e => { if (Number(pagination.page) > 1) { e.currentTarget.style.borderColor = "rgba(37,99,235,0.4)"; e.currentTarget.style.background = "rgba(37,99,235,0.06)"; } }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--market-border, #e2e8f0)"; e.currentTarget.style.background = "var(--market-surface, #fff)"; }}
                  >
                    ← Trước
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, Math.min(pagination.totalPages - 4, (pagination.page || 1) - 2)) + i;
                    const isActive = pageNum === Number(pagination.page || 1);
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => goToPage(pageNum)}
                        style={{
                          width: 38, height: 38, borderRadius: 10,
                          border: isActive ? "none" : "1px solid var(--market-border, #e2e8f0)",
                          background: isActive ? "linear-gradient(135deg, #1d4ed8, #3b82f6)" : "var(--market-surface, #fff)",
                          color: isActive ? "#fff" : "var(--market-text, #334155)",
                          fontWeight: 700, fontSize: 13, cursor: "pointer",
                          boxShadow: isActive ? "0 4px 12px rgba(37,99,235,0.35)" : "none",
                          transition: "all 0.18s ease",
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => goToPage(Math.min(Number(pagination.totalPages || 1), Number(pagination.page || 1) + 1))}
                    disabled={Number(pagination.page || 1) >= Number(pagination.totalPages || 1)}
                    style={{
                      padding: "9px 18px", borderRadius: 10,
                      border: "1px solid var(--market-border, #e2e8f0)",
                      background: Number(pagination.page) >= Number(pagination.totalPages) ? "var(--market-surface-soft, #f8fafc)" : "var(--market-surface, #fff)",
                      color: "var(--market-text, #334155)",
                      fontWeight: 700, fontSize: 13,
                      cursor: Number(pagination.page) >= Number(pagination.totalPages) ? "not-allowed" : "pointer",
                      opacity: Number(pagination.page) >= Number(pagination.totalPages) ? 0.5 : 1,
                      transition: "all 0.18s ease",
                    }}
                    onMouseEnter={e => { if (Number(pagination.page) < Number(pagination.totalPages)) { e.currentTarget.style.borderColor = "rgba(37,99,235,0.4)"; e.currentTarget.style.background = "rgba(37,99,235,0.06)"; } }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--market-border, #e2e8f0)"; e.currentTarget.style.background = "var(--market-surface, #fff)"; }}
                  >
                    Sau →
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <style>{`
        @keyframes v2-spin { 100% { transform: rotate(360deg); } }
        @keyframes v2-fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
