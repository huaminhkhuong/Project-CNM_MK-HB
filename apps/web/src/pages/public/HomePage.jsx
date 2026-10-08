import { useEffect, useMemo, useState } from "react";

import { CategoryGrid } from "../../components/marketplace/CategoryGrid";

import { MemberHubStrip } from "../../components/marketplace/MemberHubStrip";
import { useAuth } from "../../hooks/useAuth";
import { HeroBanner } from "../../components/marketplace/HeroBanner";
import { ProductSection } from "../../components/marketplace/ProductSection";
import { getCategories, getProducts } from "../../services/catalog.service";

function normalizeProductsResponse(data) {
  const payload = data?.data || data;

  if (Array.isArray(payload)) {
    return payload;
  }

  return Array.isArray(payload?.items) ? payload.items : [];
}

function enrichProducts(products) {
  return products.map((product, index) => {
    const basePrice = Number(product?.price || 0);
    const discount = [10, 15, 8, 18, 12][index % 5];
    const oldPrice = Math.round(basePrice * (100 / (100 - discount)));

    return {
      ...product,
      oldPrice,
      discountPercent: discount,
      rating: 4.6 + ((index % 3) * 0.1),
      soldCount: 120 + index * 37,
      isMall: index % 2 === 0,
      isFreeShip: index % 3 !== 1
    };
  });
}

// Module-level cache: survives component unmount → instant back-navigation
const pageCache = new Map();
const ITEMS_PER_PAGE = 20;
const MAX_PAGES = 5; // allow up to 5 pages

export function HomePage() {
  const { isAuthenticated } = useAuth();
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [pageProducts, setPageProducts] = useState({});   // { 1: [...], 2: [...] }
  const [totalItems, setTotalItems] = useState(0);
  const [loadingPage, setLoadingPage] = useState(true);
  const [catLoaded, setCatLoaded] = useState(false);

  const totalPages = Math.min(Math.ceil(totalItems / ITEMS_PER_PAGE), MAX_PAGES);

  // Fetch a single page — uses module-level cache for instant re-renders
  async function fetchPage(p, { silent = false } = {}) {
    if (pageCache.has(p)) {
      const cached = pageCache.get(p);
      setPageProducts(prev => ({ ...prev, [p]: cached.items }));
      if (cached.totalItems) setTotalItems(cached.totalItems);
      return;
    }
    if (!silent) setLoadingPage(true);
    try {
      const response = await getProducts({ page: p, limit: ITEMS_PER_PAGE });
      const items = normalizeProductsResponse(response);
      // catalog.service returns axios response.data → already { items, pagination, filters }
      const pagination = response?.pagination ?? response?.data?.pagination;
      const total = pagination?.totalItems ?? items.length;
      pageCache.set(p, { items, totalItems: total });
      setPageProducts(prev => ({ ...prev, [p]: items }));
      setTotalItems(_prev => total || _prev);

    } catch {
      // keep previous state
    } finally {
      if (!silent) setLoadingPage(false);
    }
  }

  // Initial load: categories + page 1 in parallel
  useEffect(() => {
    async function loadHomeData() {
      try {
        const [categoryResponse] = await Promise.all([
          catLoaded ? Promise.resolve(null) : getCategories(),
          fetchPage(1)
        ]);
        if (categoryResponse) {
          setCategories(Array.isArray(categoryResponse?.data) ? categoryResponse.data : []);
          setCatLoaded(true);
        }
      } catch {
        // silent
      }
    }
    loadHomeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch page: load if not cached, then silently prefetch next
  useEffect(() => {
    if (page === 1) return; // page 1 already loaded above
    fetchPage(page).then(() => {
      // prefetch next page silently
      if (page < totalPages) fetchPage(page + 1, { silent: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Prefetch page 2 silently once page 1 is rendered
  useEffect(() => {
    if (totalPages > 1 && !pageCache.has(2)) {
      fetchPage(2, { silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const currentProducts = useMemo(
    () => enrichProducts(pageProducts[page] || []),
    [pageProducts, page]
  );

  const featuredProducts = useMemo(() => currentProducts.slice(0, 10), [currentProducts]);
  const flashSaleProducts = useMemo(() => currentProducts.slice(2, 12), [currentProducts]);
  const recommendedProducts = useMemo(() => [...currentProducts].reverse().slice(0, 10), [currentProducts]);

  const loading = loadingPage && !pageProducts[page];

  return (
    <div className="market-home" style={{ padding: "0" }}>
      <HeroBanner />
      
      <div className="market-container">
        {isAuthenticated && <MemberHubStrip />}
        <CategoryGrid categories={categories} />

        {loading ? (
          <div className="market-panel">
            <div className="market-empty">Đang tải dữ liệu trang chủ...</div>
          </div>
        ) : null}

        {!loading && featuredProducts.length > 0 ? (
          <ProductSection
            title="Sản phẩm nổi bật"
            subtitle="Những linh kiện, phụ kiện và cấu hình bán chạy nhất cho game thủ và người dùng chuyên nghiệp."
            products={featuredProducts}
            eagerCount={4}
          />
        ) : null}

        {!loading && flashSaleProducts.length > 0 ? (
          <ProductSection
            title="Flash sale công nghệ"
            subtitle="Giá giảm theo khung giờ, hiển thị dày thông tin như một sàn thương mại điện tử thật."
            products={flashSaleProducts}
          />
        ) : null}

        {!loading && recommendedProducts.length > 0 ? (
          <ProductSection
            title="Dành riêng cho bạn"
            subtitle="Gợi ý sản phẩm mới, phù hợp với xu hướng build PC, nâng cấp góc chiến game và làm việc."
            products={recommendedProducts}
          />
        ) : null}

        {/* ── Pagination Bar ── */}
        {totalPages > 1 && !loading && (
          <HomePagination
            page={page}
            totalPages={totalPages}
            loadingPage={loadingPage && !!pageProducts[page]}
            onPageChange={(p) => {
              setPage(p);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ── Pagination Component ── */
function HomePagination({ page, totalPages, loadingPage, onPageChange }) {
  const pages = [];
  // Always show first, last, and 2 around current
  const shown = new Set([1, totalPages]);
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) shown.add(i);
  const sorted = Array.from(shown).sort((a, b) => a - b);

  // Build pages list with ellipsis
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) pages.push("...");
    pages.push(p);
    prev = p;
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: "32px 0 48px",
      flexWrap: "wrap",
    }}>
      {/* Prev button */}
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1 || loadingPage}
        style={paginationBtnStyle({ disabled: page <= 1 || loadingPage, active: false, isArrow: true })}
        aria-label="Trang trước"
      >
        ‹
      </button>

      {pages.map((p, idx) =>
        p === "..." ? (
          <span key={`dots-${idx}`} style={{ color: "var(--market-muted)", padding: "0 4px", userSelect: "none" }}>
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => p !== page && onPageChange(p)}
            disabled={loadingPage}
            style={paginationBtnStyle({ disabled: false, active: p === page, isArrow: false })}
            aria-current={p === page ? "page" : undefined}
          >
            {loadingPage && p === page ? (
              <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "v2-spin 0.7s linear infinite" }} />
            ) : p}
          </button>
        )
      )}

      {/* Next button */}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages || loadingPage}
        style={paginationBtnStyle({ disabled: page >= totalPages || loadingPage, active: false, isArrow: true })}
        aria-label="Trang kế tiếp"
      >
        ›
      </button>

      {/* Page count info */}
      <span style={{
        marginLeft: 8,
        fontSize: 12,
        color: "var(--market-muted)",
        fontWeight: 500,
        letterSpacing: "0.02em",
      }}>
        Trang {page} / {totalPages}
      </span>

      <style>{`
        @keyframes v2-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function paginationBtnStyle({ disabled, active, isArrow }) {
  return {
    minWidth: isArrow ? 36 : 40,
    height: 40,
    padding: isArrow ? "0 12px" : "0",
    borderRadius: 10,
    border: active
      ? "2px solid #3b82f6"
      : "1.5px solid var(--market-border)",
    background: active
      ? "linear-gradient(135deg, #2563eb, #3b82f6)"
      : "var(--market-surface)",
    color: active ? "#ffffff" : disabled ? "var(--market-muted)" : "var(--market-text)",
    fontSize: isArrow ? 20 : 14,
    fontWeight: active ? 800 : 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
    boxShadow: active ? "0 4px 16px rgba(37,99,235,0.35)" : "var(--v2-shadow-xs)",
    fontFamily: "inherit",
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transform: active ? "translateY(-1px)" : "translateY(0)",
  };
}
