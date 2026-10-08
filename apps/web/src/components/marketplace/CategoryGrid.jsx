import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";

const CATEGORY_CONFIG = {
  CPU:      { icon: "🧠", grad: "linear-gradient(135deg, #3b82f6, #6366f1)", glow: "rgba(99,102,241,0.4)" },
  GPU:      { icon: "🎮", grad: "linear-gradient(135deg, #10b981, #06b6d4)", glow: "rgba(6,182,212,0.4)"  },
  VGA:      { icon: "🎮", grad: "linear-gradient(135deg, #10b981, #06b6d4)", glow: "rgba(6,182,212,0.4)"  },
  RAM:      { icon: "💾", grad: "linear-gradient(135deg, #f59e0b, #f97316)", glow: "rgba(249,115,22,0.4)" },
  SSD:      { icon: "⚡", grad: "linear-gradient(135deg, #f5a623, #eab308)", glow: "rgba(234,179,8,0.4)"  },
  STORAGE:  { icon: "🗂️", grad: "linear-gradient(135deg, #8b5cf6, #a78bfa)", glow: "rgba(139,92,246,0.4)" },
  MAINBOARD:{ icon: "🧩", grad: "linear-gradient(135deg, #ec4899, #f43f5e)", glow: "rgba(244,63,94,0.4)"  },
  PSU:      { icon: "🔌", grad: "linear-gradient(135deg, #14b8a6, #06b6d4)", glow: "rgba(20,184,166,0.4)" },
  CASE:     { icon: "🖥️", grad: "linear-gradient(135deg, #64748b, #94a3b8)", glow: "rgba(100,116,139,0.4)"},
  COOLING:  { icon: "❄️", grad: "linear-gradient(135deg, #0ea5e9, #38bdf8)", glow: "rgba(14,165,233,0.4)" },
};

export function CategoryGrid({ categories }) {
  const items = categories.slice(0, 10);
  const gridRef = useRef(null);

  /* Scroll fade-up using IntersectionObserver */
  useEffect(() => {
    const cards = gridRef.current?.querySelectorAll(".v2-cat-card");
    if (!cards) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [items.length]);

  if (!items.length) return null;

  return (
    <section style={{ marginBottom: 32 }}>
      {/* Section Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          padding: "0 4px",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              color: "var(--market-text)",
              fontFamily: "'Be Vietnam Pro', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 4,
                height: 22,
                borderRadius: 3,
                background: "linear-gradient(180deg, #3b82f6, #f5a623)",
                flexShrink: 0,
              }}
            />
            Danh mục nổi bật
          </h2>
          <p style={{ margin: "4px 0 0 14px", fontSize: 13, color: "var(--market-muted)", lineHeight: 1.4 }}>
            Nhóm sản phẩm được khách hàng công nghệ tìm kiếm nhiều nhất.
          </p>
        </div>
      </div>

      {/* Category Cards Grid */}
      <div
        ref={gridRef}
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "stretch",
          flexWrap: "wrap",
          gap: 12,
          padding: "4px 0",
        }}
      >
        {items.map((category, idx) => {
          const key = String(category.name || "").toUpperCase();
          const config = CATEGORY_CONFIG[key] || {
            icon: "🛍️",
            grad: "linear-gradient(135deg, #475569, #64748b)",
            glow: "rgba(71,85,105,0.4)",
          };

          return (
            <Link
              key={category.id}
              to={`/products?category_id=${category.id}`}
              className="v2-cat-card v2-animate-fadeUp"
              style={{
                flex: "1",
                minWidth: 108,
                maxWidth: 128,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "18px 10px",
                textDecoration: "none",
                background: "var(--market-surface)",
                border: "1px solid var(--market-border)",
                borderRadius: 16,
                color: "var(--market-text)",
                transition: "all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)",
                boxShadow: "var(--v2-shadow-xs)",
                transitionDelay: `${idx * 0.04}s`,
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-6px) scale(1.02)";
                e.currentTarget.style.boxShadow = `0 12px 32px ${config.glow}, 0 4px 8px rgba(0,0,0,0.1)`;
                e.currentTarget.style.borderColor = config.glow.replace("0.4", "0.5");
                const icon = e.currentTarget.querySelector(".v2-cat-icon");
                if (icon) icon.style.transform = "scale(1.12) rotate(-5deg)";
                const name = e.currentTarget.querySelector(".v2-cat-name");
                if (name) name.style.background = config.grad;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0) scale(1)";
                e.currentTarget.style.boxShadow = "var(--v2-shadow-xs)";
                e.currentTarget.style.borderColor = "var(--market-border)";
                const icon = e.currentTarget.querySelector(".v2-cat-icon");
                if (icon) icon.style.transform = "scale(1) rotate(0deg)";
                const name = e.currentTarget.querySelector(".v2-cat-name");
                if (name) name.style.background = "transparent";
              }}
            >
              {/* Gradient background shimmer on hover */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: config.grad,
                  opacity: 0,
                  transition: "opacity 0.28s ease",
                  borderRadius: 16,
                  pointerEvents: "none",
                }}
                className="v2-cat-hover-bg"
              />

              {/* Icon Badge */}
              <div
                className="v2-cat-icon"
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 14,
                  background: config.grad,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  flexShrink: 0,
                  boxShadow: `0 4px 12px ${config.glow}`,
                  transition: "transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {config.icon}
              </div>

              {/* Name */}
              <div
                className="v2-cat-name"
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  textAlign: "center",
                  color: "var(--market-text)",
                  letterSpacing: "0.04em",
                  lineHeight: 1.3,
                  textTransform: "uppercase",
                  transition: "all 0.22s ease",
                  WebkitBackgroundClip: "unset",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {category.name}
              </div>
            </Link>
          );
        })}
      </div>

      <style>{`
        .v2-cat-card:hover .v2-cat-hover-bg { opacity: 0.06 !important; }
        .v2-cat-card:hover .v2-cat-name {
          background: none !important;
          -webkit-background-clip: unset !important;
          -webkit-text-fill-color: var(--market-primary) !important;
          color: var(--market-primary) !important;
        }
        [data-theme="dark"] .v2-cat-card:hover .v2-cat-name {
          -webkit-text-fill-color: #60a5fa !important;
          color: #60a5fa !important;
        }
      `}</style>
    </section>
  );
}
