import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

/* ── Particle component ── */
function Particle({ style }) {
  return (
    <div
      style={{
        position: "absolute",
        width: style.size,
        height: style.size,
        borderRadius: "50%",
        background: style.color,
        opacity: style.opacity,
        top: style.top,
        left: style.left,
        animation: `v2-particleFloat ${style.duration}s ease-in-out infinite`,
        animationDelay: style.delay,
        filter: "blur(1px)",
        pointerEvents: "none",
      }}
    />
  );
}

const PARTICLES = [
  { size: "6px",  color: "rgba(59,130,246,0.7)",  opacity: 0.8, top: "15%",  left: "8%",   duration: 5.5, delay: "0s"    },
  { size: "4px",  color: "rgba(245,166,35,0.8)",  opacity: 0.9, top: "22%",  left: "85%",  duration: 4.2, delay: "0.5s"  },
  { size: "8px",  color: "rgba(96,165,250,0.6)",  opacity: 0.7, top: "65%",  left: "12%",  duration: 6.8, delay: "1s"    },
  { size: "5px",  color: "rgba(245,166,35,0.6)",  opacity: 0.8, top: "75%",  left: "78%",  duration: 5.2, delay: "1.5s"  },
  { size: "3px",  color: "rgba(255,255,255,0.8)",  opacity: 0.6, top: "40%",  left: "92%",  duration: 4.8, delay: "0.3s"  },
  { size: "7px",  color: "rgba(139,92,246,0.5)",  opacity: 0.7, top: "88%",  left: "25%",  duration: 7.0, delay: "2s"    },
  { size: "4px",  color: "rgba(59,130,246,0.6)",  opacity: 0.8, top: "52%",  left: "6%",   duration: 5.8, delay: "0.8s"  },
  { size: "5px",  color: "rgba(16,185,129,0.6)",  opacity: 0.7, top: "30%",  left: "55%",  duration: 6.2, delay: "2.5s"  },
];

const SERVICE_BADGES = [
  { icon: "🚀", label: "Giao hàng 2h", sub: "Nội thành TP.HCM & HN" },
  { icon: "🔧", label: "Lắp ráp miễn phí", sub: "Kỹ thuật viên chuyên nghiệp" },
  { icon: "🛡️", label: "Bảo hành 1 đổi 1", sub: "Trong 30 ngày đầu" },
];

const TYPEWRITER_WORDS = ["PC", "Workstation", "Server"];

export function HeroBanner() {
  const [wordIdx, setWordIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const timerRef = useRef(null);

  /* Typewriter logic */
  useEffect(() => {
    const currentWord = TYPEWRITER_WORDS[wordIdx];
    const speed = isDeleting ? 80 : 130;

    timerRef.current = setTimeout(() => {
      if (!isDeleting && displayed === currentWord) {
        setTimeout(() => setIsDeleting(true), 1800);
        return;
      }
      if (isDeleting && displayed === "") {
        setIsDeleting(false);
        setWordIdx((i) => (i + 1) % TYPEWRITER_WORDS.length);
        return;
      }
      setDisplayed(isDeleting
        ? currentWord.slice(0, displayed.length - 1)
        : currentWord.slice(0, displayed.length + 1)
      );
    }, speed);

    return () => clearTimeout(timerRef.current);
  }, [displayed, isDeleting, wordIdx]);

  return (
    <section
      style={{
        position: "relative",
        minHeight: 540,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "80px 20px 60px",
        overflow: "hidden",
        background: "linear-gradient(145deg, #080d1a 0%, #0b1120 30%, #0f172a 60%, #111827 80%, #0d1629 100%)",
        margin: "0 0 32px",
        borderRadius: 20,
        border: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      {/* ── Animated Mesh Grid Lines Background ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(59,130,246,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.07) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          animation: "v2-meshFloat 18s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      {/* ── Radial Glow Orbs ── */}
      <div style={{
        position: "absolute", top: "-10%", left: "20%",
        width: 420, height: 420, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)",
        animation: "v2-floatY 8s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "-5%", right: "15%",
        width: 320, height: 320, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(245,166,35,0.12) 0%, transparent 70%)",
        animation: "v2-floatY 10s ease-in-out infinite",
        animationDelay: "-4s",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: "40%", left: "-5%",
        width: 260, height: 260, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)",
        animation: "v2-floatY 7s ease-in-out infinite",
        animationDelay: "-2s",
        pointerEvents: "none",
      }} />

      {/* ── Floating Particles ── */}
      {PARTICLES.map((p, i) => <Particle key={i} style={p} />)}

      {/* ── Badge label ── */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(59, 130, 246, 0.12)",
          border: "1px solid rgba(59, 130, 246, 0.3)",
          borderRadius: 9999,
          padding: "6px 18px",
          marginBottom: 28,
          animation: "v2-fadeUp 0.6s ease both",
          position: "relative",
          zIndex: 1,
        }}
      >
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "#3b82f6",
          animation: "v2-pulseGlow 2s ease-in-out infinite",
          display: "inline-block",
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#93c5fd", letterSpacing: "0.02em" }}>
          Nền tảng build PC thông minh hàng đầu
        </span>
      </div>

      {/* ── Hero Heading ── */}
      <h1
        style={{
          fontSize: "clamp(36px, 5.5vw, 64px)",
          fontWeight: 900,
          margin: "0 0 20px",
          lineHeight: 1.08,
          letterSpacing: "-0.04em",
          maxWidth: 820,
          fontFamily: "'Be Vietnam Pro', sans-serif",
          animation: "v2-fadeUp 0.7s 0.1s ease both",
          position: "relative",
          zIndex: 1,
        }}
      >
        <span style={{ color: "#ffffff" }}>Tự lắp ráp </span>
        <span
          style={{
            background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #f5a623 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            backgroundSize: "200% auto",
            animation: "v2-gradientShift 3s ease infinite",
            display: "inline-block",
            minWidth: "4ch",
          }}
        >
          {displayed}
          <span
            style={{
              display: "inline-block",
              width: 3,
              height: "0.85em",
              background: "#f5a623",
              marginLeft: 3,
              verticalAlign: "middle",
              animation: "v2-blink 1s step-end infinite",
              borderRadius: 2,
            }}
          />
        </span>
        <span style={{ color: "#ffffff" }}> của riêng bạn.</span>
      </h1>

      {/* ── Sub-heading ── */}
      <p
        style={{
          fontSize: "clamp(15px, 2vw, 20px)",
          color: "rgba(203, 213, 225, 0.85)",
          maxWidth: 680,
          margin: "0 auto 44px",
          lineHeight: 1.65,
          fontWeight: 400,
          animation: "v2-fadeUp 0.7s 0.2s ease both",
          position: "relative",
          zIndex: 1,
        }}
      >
        Gợi ý từ AI thông minh, kiểm tra tương thích thời gian thực, so sánh giá cả và tự lắp ráp cấu hình hoàn hảo cho game, đồ họa hoặc làm việc chuyên nghiệp.
      </p>

      {/* ── CTA Buttons ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 14,
          flexWrap: "wrap",
          marginBottom: 52,
          animation: "v2-fadeUp 0.7s 0.3s ease both",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Link
          to="/pc-builder"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "0 32px",
            height: 54,
            background: "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)",
            color: "#ffffff",
            fontWeight: 800,
            fontSize: 16,
            borderRadius: 14,
            textDecoration: "none",
            transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
            boxShadow: "0 8px 24px rgba(37, 99, 235, 0.45), 0 0 0 1px rgba(59,130,246,0.3)",
            letterSpacing: "-0.01em",
            fontFamily: "'Be Vietnam Pro', sans-serif",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = "translateY(-3px) scale(1.03)";
            e.currentTarget.style.boxShadow = "0 16px 40px rgba(37, 99, 235, 0.55), 0 0 30px rgba(59,130,246,0.25)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = "translateY(0) scale(1)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(37, 99, 235, 0.45), 0 0 0 1px rgba(59,130,246,0.3)";
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          Bắt đầu lắp ráp PC
        </Link>

        <Link
          to="/ai-chat"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "0 28px",
            height: 54,
            background: "linear-gradient(135deg, rgba(245,166,35,0.15), rgba(249,115,22,0.15))",
            color: "#f5a623",
            fontWeight: 700,
            fontSize: 16,
            borderRadius: 14,
            textDecoration: "none",
            border: "1px solid rgba(245, 166, 35, 0.4)",
            backdropFilter: "blur(10px)",
            transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
            letterSpacing: "-0.01em",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = "translateY(-3px) scale(1.03)";
            e.currentTarget.style.background = "linear-gradient(135deg, rgba(245,166,35,0.25), rgba(249,115,22,0.25))";
            e.currentTarget.style.boxShadow = "0 12px 30px rgba(245, 166, 35, 0.25)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = "translateY(0) scale(1)";
            e.currentTarget.style.background = "linear-gradient(135deg, rgba(245,166,35,0.15), rgba(249,115,22,0.15))";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <span style={{ fontSize: 18 }}>✨</span>
          AI Tư Vấn
        </Link>

        <Link
          to="/products"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "0 28px",
            height: 54,
            background: "rgba(255, 255, 255, 0.06)",
            color: "rgba(226, 232, 240, 0.9)",
            fontWeight: 600,
            fontSize: 16,
            borderRadius: 14,
            textDecoration: "none",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            backdropFilter: "blur(10px)",
            transition: "all 0.25s ease",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            e.currentTarget.style.color = "#ffffff";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
            e.currentTarget.style.color = "rgba(226, 232, 240, 0.9)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          Linh kiện PC
        </Link>
      </div>

      {/* ── Service Badges ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 14,
          flexWrap: "wrap",
          animation: "v2-fadeUp 0.7s 0.45s ease both",
          position: "relative",
          zIndex: 1,
        }}
      >
        {SERVICE_BADGES.map((badge, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 20px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 12,
              backdropFilter: "blur(12px)",
              transition: "all 0.22s ease",
              cursor: "default",
              animationDelay: `${i * 0.08}s`,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.09)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.18)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <span style={{ fontSize: 20 }}>{badge.icon}</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", lineHeight: 1.2 }}>
                {badge.label}
              </div>
              <div style={{ fontSize: 11, color: "rgba(148, 163, 184, 0.9)", marginTop: 2, lineHeight: 1.3 }}>
                {badge.sub}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
