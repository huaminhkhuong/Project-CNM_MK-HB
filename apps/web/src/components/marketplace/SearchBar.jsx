import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const QUICK_SUGGESTIONS = [
  { label: "CPU Intel Core i9", icon: "🧠" },
  { label: "GPU RTX 4080",      icon: "🎮" },
  { label: "RAM DDR5 32GB",     icon: "💾" },
  { label: "SSD NVMe 2TB",      icon: "⚡" },
  { label: "Tản nhiệt AIO 360", icon: "❄️" },
  { label: "Mainboard Z790",    icon: "🧩" },
];

export function SearchBar() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const urlSearch      = searchParams.get("search") || searchParams.get("q") || searchParams.get("keyword") || "";

  const inputRef   = useRef(null);
  const wrapRef    = useRef(null);
  const [query, setQuery]         = useState(urlSearch);
  const [focused, setFocused]     = useState(false);
  const [hovered, setHovered]     = useState(false);
  const showDrop = focused && query.length === 0;

  /* Keep input synced if search parameter in URL changes */
  useEffect(() => {
    setQuery(urlSearch);
  }, [urlSearch]);

  /* Close on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (!wrapRef.current?.contains(e.target)) setFocused(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = (e) => {
    e?.preventDefault();
    const q = query.trim();
    if (q) {
      navigate(`/products?search=${encodeURIComponent(q)}`);
    } else {
      navigate("/products");
    }
    setFocused(false);
  };

  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
    if (urlSearch) {
      navigate("/products");
    }
  };

  const handleSuggestion = (label) => {
    setQuery(label);
    navigate(`/products?search=${encodeURIComponent(label)}`);
    setFocused(false);
  };

  const isActive = focused || hovered;

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      {/* ── Search Form ── */}
      <form
        id="header-search-form"
        data-testid="header-search-form"
        onSubmit={handleSubmit}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          background: isActive
            ? "rgba(15, 23, 42, 0.96)"
            : "rgba(30, 41, 59, 0.65)",
          border: focused
            ? "1px solid rgba(59, 130, 246, 0.6)"
            : hovered
            ? "1px solid rgba(255, 255, 255, 0.2)"
            : "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: focused ? "12px 12px 0 0" : 12,
          height: 38,
          width: "100%",
          padding: "3px 4px 3px 12px",
          boxShadow: focused
            ? "0 0 0 3px rgba(59, 130, 246, 0.15), 0 8px 24px rgba(0,0,0,0.3)"
            : "none",
          transition: "all 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
          boxSizing: "border-box",
          gap: 6,
        }}
      >
        {/* Search icon */}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={focused ? "#3b82f6" : "#64748b"}
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transition: "stroke 0.2s ease" }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        {/* Input */}
        <input
          id="header-search-input"
          data-testid="header-search-input"
          ref={inputRef}
          type="text"
          placeholder="Tìm linh kiện PC..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => e.key === "Escape" && setFocused(false)}
          style={{
            flex: 1,
            background: "transparent",
            color: "#f8fafc",
            border: "none",
            outline: "none",
            fontSize: 13,
            fontWeight: 500,
            height: "100%",
            padding: 0,
            minWidth: 0,
            letterSpacing: "0.01em",
          }}
        />

        {/* Clear button */}
        {query && (
          <button
            id="header-search-clear"
            data-testid="header-search-clear"
            type="button"
            onClick={handleClear}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: 5,
              color: "#94a3b8",
              width: 22,
              height: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              fontSize: 12,
              transition: "all 0.15s ease",
              padding: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.2)"; e.currentTarget.style.color = "#ef4444"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#94a3b8"; }}
          >
            ✕
          </button>
        )}

        {/* Submit button */}
        <button
          id="header-search-submit"
          data-testid="header-search-submit"
          type="submit"
          title="Tìm kiếm"
          style={{
            background: focused
              ? "linear-gradient(135deg, #1d4ed8, #3b82f6)"
              : "rgba(255, 255, 255, 0.07)",
            border: "none",
            borderRadius: 8,
            color: focused ? "#ffffff" : "#64748b",
            width: 30,
            height: 30,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
            flexShrink: 0,
            boxShadow: focused ? "0 4px 10px rgba(37,99,235,0.4)" : "none",
          }}
          onMouseEnter={(e) => {
            if (!focused) {
              e.currentTarget.style.background = "rgba(59,130,246,0.15)";
              e.currentTarget.style.color = "#60a5fa";
            } else {
              e.currentTarget.style.transform = "scale(1.08)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            if (!focused) {
              e.currentTarget.style.background = "rgba(255,255,255,0.07)";
              e.currentTarget.style.color = "#64748b";
            }
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </form>

      {/* ── Quick Suggestions Dropdown ── */}
      {showDrop && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "rgba(10, 16, 32, 0.97)",
            backdropFilter: "blur(20px) saturate(140%)",
            WebkitBackdropFilter: "blur(20px) saturate(140%)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            borderTop: "1px solid rgba(59, 130, 246, 0.15)",
            borderRadius: "0 0 12px 12px",
            boxShadow: "0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.1)",
            overflow: "hidden",
            zIndex: 200,
            animation: "v2-fadeUp 0.18s ease both",
          }}
        >
          <div style={{
            padding: "8px 12px 6px",
            fontSize: 10,
            fontWeight: 800,
            color: "#475569",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}>
            🔥 Tìm kiếm phổ biến
          </div>
          {QUICK_SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              data-testid={`search-suggestion-${i}`}
              type="button"
              onClick={() => handleSuggestion(s.label)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "9px 12px",
                background: "transparent",
                border: "none",
                color: "#cbd5e1",
                fontSize: 13,
                fontWeight: 500,
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.15s ease",
                borderRadius: 0,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(59, 130, 246, 0.1)";
                e.currentTarget.style.color = "#93c5fd";
                e.currentTarget.style.paddingLeft = "16px";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#cbd5e1";
                e.currentTarget.style.paddingLeft = "12px";
              }}
            >
              <span style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                flexShrink: 0,
              }}>
                {s.icon}
              </span>
              {s.label}
              <svg style={{ marginLeft: "auto", opacity: 0.4, flexShrink: 0 }}
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
              </svg>
            </button>
          ))}
          <div style={{
            padding: "8px 12px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            fontSize: 11,
            color: "#334155",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}>
            <kbd style={{
              padding: "2px 6px",
              background: "rgba(255,255,255,0.06)",
              borderRadius: 4,
              fontSize: 10,
              color: "#64748b",
              border: "1px solid rgba(255,255,255,0.08)",
              fontFamily: "monospace",
            }}>Enter</kbd>
            <span style={{ color: "#334155" }}>để tìm kiếm</span>
            <kbd style={{
              padding: "2px 6px",
              background: "rgba(255,255,255,0.06)",
              borderRadius: 4,
              fontSize: 10,
              color: "#64748b",
              border: "1px solid rgba(255,255,255,0.08)",
              fontFamily: "monospace",
            }}>Esc</kbd>
            <span style={{ color: "#334155" }}>để đóng</span>
          </div>
        </div>
      )}
    </div>
  );
}
