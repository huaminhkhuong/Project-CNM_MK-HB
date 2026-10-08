import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import { ProductCard } from "../common/ProductCard";

export function ProductSection({ title, subtitle, products, eagerCount = 0 }) {
  const gridRef = useRef(null);

  /* IntersectionObserver: staggered fade-up for each card */
  useEffect(() => {
    const cards = gridRef.current?.querySelectorAll(".v2-pc-wrapper");
    if (!cards || !cards.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [products]);

  if (!products?.length) return null;

  return (
    <section style={{ marginBottom: 32 }}>
      {/* ── Section Header ── */}
      <div style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 20,
        padding: "0 4px",
      }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            color: "var(--market-text)",
            fontFamily: "'Be Vietnam Pro', sans-serif",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            {/* Gradient accent bar */}
            <span style={{
              display: "inline-block",
              width: 4,
              height: 22,
              borderRadius: 3,
              background: "linear-gradient(180deg, #3b82f6, #f5a623)",
              flexShrink: 0,
            }} />
            {title}
          </h2>
          {subtitle && (
            <p style={{
              margin: "5px 0 0 14px",
              fontSize: 13,
              color: "var(--market-muted)",
              lineHeight: 1.5,
              maxWidth: 620,
            }}>
              {subtitle}
            </p>
          )}
        </div>

        <Link
          to="/products"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 700,
            color: "var(--market-primary)",
            textDecoration: "none",
            padding: "6px 14px",
            borderRadius: 20,
            border: "1px solid rgba(37, 99, 235, 0.25)",
            background: "rgba(37, 99, 235, 0.06)",
            transition: "all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(37, 99, 235, 0.14)";
            e.currentTarget.style.borderColor = "rgba(37, 99, 235, 0.5)";
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.2)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(37, 99, 235, 0.06)";
            e.currentTarget.style.borderColor = "rgba(37, 99, 235, 0.25)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          Xem tất cả
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>

      {/* ── Product Grid ── */}
      <div
        ref={gridRef}
        className="market-product-grid"
      >
        {products.map((product, idx) => (
          <div
            key={`${product.product_id || product.id}-${product.slug || product.name}`}
            className="v2-pc-wrapper v2-animate-fadeUp"
            style={{ transitionDelay: `${Math.min(idx * 0.06, 0.48)}s` }}
          >
            <ProductCard product={product} eager={idx < eagerCount} />
          </div>
        ))}
      </div>
    </section>
  );
}
