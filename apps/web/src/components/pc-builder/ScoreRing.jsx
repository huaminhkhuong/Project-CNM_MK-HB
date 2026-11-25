import React from "react";

/* ── SCORE RING SVG COMPONENT ─────────────────────────────────── */
export function ScoreRing({ score, size = 52, strokeWidth = 4 }) {
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const cls = score >= 70 ? "" : score >= 45 ? "score-ring__fill--warn" : "score-ring__fill--bad";

  return (
    <div className="score-ring" style={{ "--score-size": `${size}px` }}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle className="score-ring__bg" cx={size / 2} cy={size / 2} r={r} strokeWidth={strokeWidth} />
        <circle
          className={`score-ring__fill ${cls}`}
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="score-ring__label">
        <span className="score-ring__number">{score}</span>
        <span className="score-ring__sub">/100</span>
      </div>
    </div>
  );
}

export default ScoreRing;
