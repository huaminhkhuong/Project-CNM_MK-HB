import React from "react";
import { formatCurrency } from "./pcBuilderUtils";

export function BuildTradeoffModal({
  isOpen,
  onClose,
  tradeoffs = [],
  onSelectOption,
  onAutoResolveAll
}) {
  if (!isOpen || !tradeoffs || tradeoffs.length === 0) return null;

  return (
    <div
      className="tradeoff-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px"
      }}
      onClick={onClose}
    >
      <div
        className="tradeoff-modal-container"
        style={{
          width: "100%",
          maxWidth: "800px",
          maxHeight: "90vh",
          backgroundColor: "#ffffff",
          borderRadius: "18px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div
          style={{
            padding: "20px 24px",
            background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
            color: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "28px", background: "rgba(255,255,255,0.18)", padding: "6px 12px", borderRadius: "12px" }}>
              ⚖️
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#ffffff" }}>
                Tối Ưu Hóa Cấu Hình: Lựa Chọn Phương Án (Trade-offs)
              </h2>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "rgba(255,255,255,0.88)" }}>
                Hệ thống tìm thấy các phương án cân bằng hiệu năng và ngân sách. Bạn hãy chọn phương án ưng ý nhất!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              color: "#ffffff",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              cursor: "pointer",
              fontSize: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            ✕
          </button>
        </div>

        {/* BODY */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "24px" }}>
          {tradeoffs.map((decision, dIdx) => (
            <div
              key={decision.componentType || dIdx}
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "14px",
                padding: "18px"
              }}
            >
              <div style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "800", backgroundColor: "#dbeafe", color: "#1e40af", padding: "3px 8px", borderRadius: "6px", textTransform: "uppercase" }}>
                    {decision.componentType}
                  </span>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#0f172a" }}>
                    {decision.title}
                  </h3>
                </div>
                <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
                  {decision.description}
                </p>
              </div>

              {/* OPTIONS GRID */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px" }}>
                {decision.options.map((option) => (
                  <div
                    key={option.id}
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "12px",
                      border: `2px solid ${option.recommended ? "#3b82f6" : "#cbd5e1"}`,
                      padding: "14px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      position: "relative",
                      boxShadow: option.recommended ? "0 4px 12px rgba(59, 130, 246, 0.12)" : "none"
                    }}
                  >
                    {option.recommended && (
                      <span
                        style={{
                          position: "absolute",
                          top: "-10px",
                          right: "12px",
                          backgroundColor: "#2563eb",
                          color: "#ffffff",
                          fontSize: "10px",
                          fontWeight: "800",
                          padding: "2px 8px",
                          borderRadius: "10px",
                          letterSpacing: "0.03em"
                        }}
                      >
                        ⭐ KHUYÊN DÙNG
                      </span>
                    )}

                    <div>
                      <h4 style={{ margin: "0 0 6px 0", fontSize: "14px", fontWeight: "700", color: "#1e293b" }}>
                        {option.title}
                      </h4>

                      <div style={{ fontSize: "12px", fontWeight: "600", color: option.deltaPrice > 0 ? "#dc2626" : "#16a34a", marginBottom: "10px" }}>
                        {option.deltaPrice === 0
                          ? "✓ Trong hạn mức ban đầu (+0đ)"
                          : option.deltaPrice > 0
                          ? `▲ Chênh lệch: +${formatCurrency(option.deltaPrice)}đ`
                          : `▼ Tiết kiệm: -${formatCurrency(Math.abs(option.deltaPrice))}đ`}
                      </div>

                      {/* PROS */}
                      {option.pros && option.pros.length > 0 && (
                        <div style={{ marginBottom: "8px" }}>
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#16a34a" }}>Điểm mạnh:</span>
                          <ul style={{ margin: "4px 0 0 0", paddingLeft: "16px", fontSize: "12px", color: "#334155" }}>
                            {option.pros.map((pro, pIdx) => (
                              <li key={pIdx} style={{ marginBottom: "2px" }}>{pro}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* CONS */}
                      {option.cons && option.cons.length > 0 && (
                        <div style={{ marginBottom: "12px" }}>
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#d97706" }}>Cân nhắc:</span>
                          <ul style={{ margin: "4px 0 0 0", paddingLeft: "16px", fontSize: "12px", color: "#475569" }}>
                            {option.cons.map((con, cIdx) => (
                              <li key={cIdx} style={{ marginBottom: "2px" }}>{con}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectOption(decision.componentType, option)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "none",
                        backgroundColor: option.recommended ? "#2563eb" : "#0f172a",
                        color: "#ffffff",
                        fontSize: "12.5px",
                        fontWeight: "700",
                        cursor: "pointer",
                        marginTop: "8px",
                        transition: "all 0.15s ease"
                      }}
                    >
                      Chọn phương án này
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px"
          }}
        >
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            Nếu phân vân, hãy chọn tự động để AI cân đối phương án hài hòa nhất.
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#475569",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={onAutoResolveAll}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: "none",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: "700",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)"
              }}
            >
              🤖 Để hệ thống tự quyết định
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
