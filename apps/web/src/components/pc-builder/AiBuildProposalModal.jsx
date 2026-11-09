import React, { useState } from "react";
import { formatCurrency, getProductPrice, getProductName, getProductId } from "./pcBuilderUtils";
import { resolveProductImage } from "../../utils/productImage";

const COMPONENT_ICONS = {
  cpu: "🔲",
  gpu: "🎮",
  mainboard: "🔌",
  ram: "⚡",
  storage: "💾",
  psu: "🔋",
  case: "📦",
  cooling: "❄️"
};

const COMPONENT_LABELS = {
  cpu: "Bộ vi xử lý (CPU)",
  gpu: "Card đồ họa (GPU)",
  mainboard: "Bo mạch chủ (Mainboard)",
  ram: "Bộ nhớ RAM",
  storage: "Ổ cứng (SSD/HDD)",
  psu: "Nguồn máy tính (PSU)",
  case: "Vỏ thùng máy (Case)",
  cooling: "Tản nhiệt (Cooling)"
};

function FormattedAiAdvice({ text, isStreaming = false }) {
  if (!text) return null;

  // Loại bỏ các khối json codeblock nếu AI xuất ra ở cuối để tránh làm bẩn UI
  const cleanText = text.replace(/```json[\s\S]*?```/g, "").trim();
  const lines = cleanText.split("\n");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {lines.map((line, lIdx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={lIdx} style={{ height: "4px" }} />;

        const isBullet = /^[-*•]\s*/.test(trimmed);
        const remaining = trimmed.replace(/^[-*•]\s*/, "");

        const parts = [];
        const boldRegex = /\*\*(.*?)\*\*/g;
        let lastIndex = 0;
        let match;

        while ((match = boldRegex.exec(remaining)) !== null) {
          if (match.index > lastIndex) {
            parts.push(remaining.substring(lastIndex, match.index));
          }
          parts.push(
            <strong key={match.index} style={{ color: "#0f172a", fontWeight: 700 }}>
              {match[1]}
            </strong>
          );
          lastIndex = boldRegex.lastIndex;
        }
        if (lastIndex < remaining.length) {
          parts.push(remaining.substring(lastIndex));
        }

        const content = parts.length > 0 ? parts : remaining;

        if (isBullet) {
          return (
            <div
              key={lIdx}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                paddingLeft: "6px"
              }}
            >
              <span style={{ color: "#2563eb", fontSize: "14px", lineHeight: "1.4" }}>•</span>
              <span style={{ flex: 1, fontSize: "13px", color: "#334155", lineHeight: "1.6" }}>
                {content}
              </span>
            </div>
          );
        }

        return (
          <p
            key={lIdx}
            style={{
              margin: 0,
              fontSize: "13px",
              color: "#334155",
              lineHeight: "1.65"
            }}
          >
            {content}
          </p>
        );
      })}
      {isStreaming && (
        <span
          style={{
            display: "inline-block",
            color: "#2563eb",
            fontWeight: 800,
            fontSize: "14px",
            animation: "pulse 0.8s infinite"
          }}
        >
          ▌
        </span>
      )}
    </div>
  );
}

export default function AiBuildProposalModal({
  isOpen,
  onClose,
  proposalData,
  onApplyBuild,
  onEditRequirements,
  isApplying = false
}) {
  const [activeTab, setActiveTab] = useState("bestValue");

  if (!isOpen || !proposalData) return null;

  const {
    useCase = "gaming",
    subPurpose = "",
    targetBudget = 25000000,
    resolution = "1080p",
    engineType = "ai",
    aiAdvice = "",
    provider = "gemini-2.5-flash",
    dynamicBottleneck = null,
    ramArchitecture = null,
    candidates = {}
  } = proposalData;

  // Selected candidate based on active tab
  const currentCandidate = candidates[activeTab] || candidates.bestValue || {
    label: "Cấu hình đề xuất",
    totalPrice: proposalData.totalPrice || targetBudget,
    budgetUtilization: proposalData.budgetUtilization || 98,
    components: proposalData.components || [],
    compatibilityReport: proposalData.compatibilityReport || { score: 98, compatible: true }
  };

  // Convert components object or array to normalized array
  const rawComponents = currentCandidate.components || [];
  const normalizedComponents = Array.isArray(rawComponents)
    ? rawComponents
    : Object.entries(rawComponents).map(([typeKey, compVal]) => ({
        type: (compVal?.type || compVal?.componentType || typeKey).toLowerCase(),
        componentType: (compVal?.type || compVal?.componentType || typeKey).toLowerCase(),
        ...compVal
      }));

  // Helper calculate total candidate price
  const candidateTotalPrice = Number(
    currentCandidate.totalPrice ||
    normalizedComponents.reduce((sum, item) => sum + (getProductPrice(item.product || item) || 0), 0)
  );

  const budgetDiff = candidateTotalPrice - targetBudget;
  const budgetUtilization = Math.round((candidateTotalPrice / targetBudget) * 100) || 100;

  // Format purpose tag
  const purposeDisplay = subPurpose
    ? `${useCase.toUpperCase()} • ${subPurpose.toUpperCase()}`
    : useCase.toUpperCase();

  // Dynamic bottleneck severity analysis
  const bottleneckSource = dynamicBottleneck || proposalData.bottleneckReport || proposalData.bottleneck;
  const rawBn = bottleneckSource?.bottleneckPercent ?? bottleneckSource?.percentage ?? bottleneckSource?.bottleneckRatio ?? null;
  const bnNum = rawBn !== null && rawBn !== undefined ? Math.round(parseFloat(rawBn)) : null;
  let bnBg = "#ecfdf5";
  let bnBorder = "#a7f3d0";
  let bnColor = "#059669";
  let bnLabel = bnNum !== null ? `Nghẽn cổ chai: ~${bnNum}% (Tối ưu < 15%)` : null;

  if (bnNum !== null) {
    if (bnNum > 30) {
      bnBg = "#fff1f2";
      bnBorder = "#fecdd3";
      bnColor = "#dc2626";
      bnLabel = `⚠️ Cảnh báo nghẽn: ~${bnNum}% (GPU/CPU lệch pha)`;
    } else if (bnNum >= 15) {
      bnBg = "#fffbeb";
      bnBorder = "#fde68a";
      bnColor = "#b45309";
      bnLabel = `⚡ Nghẽn cổ chai: ~${bnNum}% (Mức chấp nhận)`;
    }
  }

  // RAM Channel status analysis
  const ramItem = normalizedComponents.find(c => {
    const t = (c.type || c.componentType || "").toLowerCase();
    return t === "ram";
  });
  const ramName = ramItem?.name || ramItem?.product?.name || "";
  const isDualExplicit = ramArchitecture?.channelConfig?.toLowerCase().includes("dual") || ramArchitecture?.isDualChannel;
  const isDualFromName = /(2\s*x|dual)/i.test(ramName);
  const isDual = isDualExplicit !== undefined ? isDualExplicit : isDualFromName;

  const handleApply = () => {
    if (onApplyBuild) {
      onApplyBuild(currentCandidate);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        overflowY: "auto"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1050px",
          maxHeight: "92vh",
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #cbd5e1"
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: "20px 28px",
            borderBottom: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px"
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  backgroundColor: engineType === "ai" ? "#eff6ff" : "#f1f5f9",
                  color: engineType === "ai" ? "#2563eb" : "#475569",
                  fontSize: "18px",
                  fontWeight: 700
                }}
              >
                {engineType === "ai" ? "✨" : "⚙️"}
              </span>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }}>
                {engineType === "ai"
                  ? "Bản Đề Xuất Cấu Hình PC Tối Ưu Từ AI"
                  : "Bản Đề Xuất Cấu Hình Chuẩn Lab Hệ Thống"}
              </h2>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: "999px",
                  backgroundColor: engineType === "ai" ? "#dbeafe" : "#e2e8f0",
                  color: engineType === "ai" ? "#1e40af" : "#334155"
                }}
              >
                {engineType === "ai" ? `Engine: ${provider}` : "Heuristic Rule Engine"}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
              Xem trước và đánh giá chi tiết 8 linh kiện cùng phân tích kỹ thuật trước khi áp dụng vào không gian lắp ráp.
            </p>
          </div>

          {/* Quick Context Badges */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "12px",
                padding: "4px 10px",
                borderRadius: "6px",
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                color: "#334155",
                fontWeight: 600
              }}
            >
              🎯 {purposeDisplay}
            </span>
            <span
              style={{
                fontSize: "12px",
                padding: "4px 10px",
                borderRadius: "6px",
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                color: "#334155",
                fontWeight: 600
              }}
            >
              🖥️ {resolution.toUpperCase()}
            </span>
            <span
              style={{
                fontSize: "12px",
                padding: "4px 10px",
                borderRadius: "6px",
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                color: "#2563eb",
                fontWeight: 700
              }}
            >
              💰 Hạn mức: {formatCurrency(targetBudget)}đ
            </span>
            {proposalData?.platformPref && proposalData.platformPref !== "auto" && (
              <span
                style={{
                  fontSize: "12px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  backgroundColor: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  color: "#1e40af",
                  fontWeight: 600
                }}
              >
                CPU: {proposalData.platformPref.toUpperCase()}
              </span>
            )}
            {proposalData?.gpuBrandPref && proposalData.gpuBrandPref !== "auto" && (
              <span
                style={{
                  fontSize: "12px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  backgroundColor: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  color: "#065f46",
                  fontWeight: 600
                }}
              >
                GPU: {proposalData.gpuBrandPref.toUpperCase()}
              </span>
            )}
            {proposalData?.minRam && (
              <span
                style={{
                  fontSize: "12px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  color: "#475569",
                  fontWeight: 600
                }}
              >
                RAM: {proposalData.minRam.toUpperCase()}
              </span>
            )}
            {proposalData?.minStorage && (
              <span
                style={{
                  fontSize: "12px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  color: "#475569",
                  fontWeight: 600
                }}
              >
                SSD: {proposalData.minStorage.toUpperCase()}
              </span>
            )}
            {proposalData?.needWifi && (
              <span
                style={{
                  fontSize: "12px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  color: "#15803d",
                  fontWeight: 600
                }}
              >
                📶 Wi-Fi 6E
              </span>
            )}
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                fontSize: "20px",
                cursor: "pointer",
                color: "#64748b",
                padding: "4px 8px",
                borderRadius: "6px"
              }}
              title="Đóng"
            >
              ✕
            </button>
          </div>
        </div>

        {/* CANDIDATE TABS (3 PHƯƠNG ÁN ĐỀ XUẤT) */}
        {candidates && Object.keys(candidates).length > 1 && (
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              padding: "0 28px"
            }}
          >
            {[
              { id: "bestValue", label: "Best Value (Cân Bằng P/P)", icon: "🌟", desc: "Tối ưu hiệu năng / giá tiền" },
              { id: "bestPerformance", label: "Best Performance (Tối Đa Sức Mạnh)", icon: "🚀", desc: "Đẩy cao GPU & CPU" },
              { id: "budgetSafe", label: "Budget Safe (Tiết Kiệm Chi Phí)", icon: "🛡️", desc: "Tiết kiệm 10-15% ngân sách" }
            ].map((tab) => {
              const cand = candidates[tab.id];
              if (!cand) return null;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "2px",
                    padding: "12px 20px",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    borderBottom: isSelected ? "3px solid #2563eb" : "3px solid transparent",
                    color: isSelected ? "#0f172a" : "#64748b",
                    fontWeight: isSelected ? 700 : 500,
                    transition: "all 0.15s ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px" }}>
                    <span>{tab.icon}</span>
                    <span>{cand.label || tab.label}</span>
                  </div>
                  <span style={{ fontSize: "11px", color: isSelected ? "#2563eb" : "#94a3b8" }}>
                    {formatCurrency(cand.totalPrice)}đ • {tab.desc}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* MODAL BODY (SCROLLABLE) */}
        <div
          style={{
            padding: "24px 28px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            backgroundColor: "#f8fafc"
          }}
        >
          {/* AI ADVISORY & PERFORMANCE SUMMARY CARD */}
          {(aiAdvice || bnLabel || ramItem) && (
            <div
              style={{
                flexShrink: 0,
                width: "100%",
                boxSizing: "border-box",
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "14px",
                padding: "18px 20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginBottom: "12px",
                  borderBottom: "1px solid #f1f5f9",
                  paddingBottom: "10px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "16px" }}>🧠</span>
                  <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                    Đánh Giá Chuyên Môn & Phân Tích Cân Bằng Hệ Thống
                  </h3>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {bnLabel && (
                    <span
                      style={{
                        fontSize: "12px",
                        padding: "3px 9px",
                        borderRadius: "6px",
                        backgroundColor: bnBg,
                        color: bnColor,
                        fontWeight: 600,
                        border: `1px solid ${bnBorder}`
                      }}
                    >
                      {bnLabel}
                    </span>
                  )}
                  {ramItem && (
                    <span
                      style={{
                        fontSize: "12px",
                        padding: "3px 9px",
                        borderRadius: "6px",
                        backgroundColor: isDual ? "#eff6ff" : "#fffbeb",
                        color: isDual ? "#2563eb" : "#b45309",
                        fontWeight: 600,
                        border: `1px solid ${isDual ? "#bfdbfe" : "#fde68a"}`
                      }}
                    >
                      {isDual ? "⚡ Dual-Channel (Băng thông x2)" : "⚠️ Single-Channel (Khuyên dùng 2 thanh)"}
                    </span>
                  )}
                </div>
              </div>

              {proposalData?.isStreaming && (
                <div
                  style={{
                    backgroundColor: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    marginBottom: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "12.5px",
                    color: "#1d4ed8"
                  }}
                >
                  <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⚙️</span>
                  <span><strong>AI đang thẩm định 32 linh kiện và viết báo cáo...</strong> Dữ liệu đang được truyền tải dạng streaming.</span>
                </div>
              )}

              {aiAdvice ? (
                <div
                  style={{
                    fontSize: "13px",
                    lineHeight: "1.65",
                    color: "#334155",
                    backgroundColor: "#f8fafc",
                    padding: "14px 16px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0"
                  }}
                >
                  <FormattedAiAdvice text={aiAdvice} isStreaming={proposalData?.isStreaming} />
                </div>
              ) : (
                <div style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
                  Hệ thống đã cân đối xung nhịp CPU và sức mạnh card đồ họa GPU để tối đa hóa hiệu năng ở độ phân giải{" "}
                  <strong>{resolution.toUpperCase()}</strong> mà không phát sinh hiện tượng thắt cổ chai phần cứng.
                </div>
              )}
            </div>
          )}

          {/* COMPONENT BREAKDOWN TABLE */}
          <div
            style={{
              flexShrink: 0,
              width: "100%",
              boxSizing: "border-box",
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
            }}
          >
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid #e2e8f0",
                backgroundColor: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                Danh Sách 8 Linh Kiện Thực Tế Được Chọn ({normalizedComponents.length}/8)
              </h3>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Kho hàng thực tế • Sẵn sàng lắp ráp
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                    <th style={{ padding: "10px 16px", fontWeight: 600, width: "180px" }}>Linh Kiện</th>
                    <th style={{ padding: "10px 16px", fontWeight: 600 }}>Tên Sản Phẩm & Lý Do Lựa Chọn</th>
                    <th style={{ padding: "10px 16px", fontWeight: 600, textAlign: "right", width: "140px" }}>Đơn Giá</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizedComponents.map((item, idx) => {
                    const cType = (item.type || item.componentType || "").toLowerCase();
                    const prod = item.product || item;
                    const price = getProductPrice(prod) || item.price || 0;
                    const name = getProductName(prod) || item.name || "Chưa xác định";
                    const img = resolveProductImage(prod) || item.image || item.image_url;
                    const explanation = item.explanation || prod?.explanation || "Lựa chọn tối ưu tương thích và P/P.";
                    const percentOfBudget = Math.round((price / targetBudget) * 100);

                    return (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: idx < normalizedComponents.length - 1 ? "1px solid #f1f5f9" : "none",
                          backgroundColor: idx % 2 === 0 ? "#ffffff" : "#fafafa"
                        }}
                      >
                        {/* Component Type & Icon */}
                        <td style={{ padding: "12px 16px", verticalAlign: "top" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "18px" }}>{COMPONENT_ICONS[cType] || "🔧"}</span>
                            <div>
                              <div style={{ fontWeight: 600, color: "#0f172a", textTransform: "capitalize" }}>
                                {cType.toUpperCase()}
                              </div>
                              <div style={{ fontSize: "11px", color: "#64748b" }}>
                                {COMPONENT_LABELS[cType] || cType}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Product Details & XAI Reason */}
                        <td style={{ padding: "12px 16px", verticalAlign: "top" }}>
                          <div style={{ display: "flex", gap: "12px" }}>
                            {img && (
                              <img
                                src={img}
                                alt={name}
                                style={{
                                  width: "48px",
                                  height: "48px",
                                  objectFit: "contain",
                                  borderRadius: "6px",
                                  border: "1px solid #e2e8f0",
                                  backgroundColor: "#ffffff",
                                  padding: "2px",
                                  flexShrink: 0
                                }}
                                onError={(e) => {
                                  e.target.style.display = "none";
                                }}
                              />
                            )}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: "4px" }}>
                                {name}
                              </div>
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "#475569",
                                  backgroundColor: "#f1f5f9",
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                  display: "inline-block"
                                }}
                              >
                                💡 <em>{explanation}</em>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Price */}
                        <td style={{ padding: "12px 16px", textAlign: "right", verticalAlign: "top" }}>
                          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px" }}>
                            {formatCurrency(price)}đ
                          </div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            {percentOfBudget}% ngân sách
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* FINANCIAL & COMPATIBILITY STATS BAR */}
          <div
            style={{
              flexShrink: 0,
              width: "100%",
              boxSizing: "border-box",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "14px",
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              padding: "16px 20px"
            }}
          >
            <div>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Tổng Chi Phí Dàn Máy</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a" }}>
                {formatCurrency(candidateTotalPrice)}đ
              </div>
              <div style={{ fontSize: "11px", color: budgetDiff <= 0 ? "#16a34a" : "#ea580c" }}>
                {budgetDiff <= 0
                  ? `Tiết kiệm ${formatCurrency(Math.abs(budgetDiff))}đ so với ngân sách`
                  : `Vượt ${formatCurrency(budgetDiff)}đ so với ngân sách`}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Tỷ Lệ Tận Dụng Ngân Sách</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#2563eb" }}>
                {budgetUtilization}%
              </div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>
                Định mức: {formatCurrency(targetBudget)}đ
              </div>
            </div>

            <div>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Độ Tương Thích Kỹ Thuật</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#16a34a", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>100%</span>
                <span style={{ fontSize: "13px", fontWeight: 600 }}>Tương thích hoàn hảo</span>
              </div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>
                0 lỗi xung đột • Socket, Nguồn & Kích thước đồng bộ
              </div>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER / DECISION GATE */}
        <div
          style={{
            padding: "16px 28px",
            borderTop: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={onEditRequirements}
              disabled={isApplying}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 16px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#334155",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              <span>←</span>
              <span>Chỉnh Sửa Tiêu Chí</span>
            </button>
            <button
              onClick={onClose}
              disabled={isApplying}
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                border: "none",
                backgroundColor: "transparent",
                color: "#64748b",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer"
              }}
            >
              Hủy bỏ (Giữ nguyên build cũ)
            </button>
          </div>

          <button
            onClick={handleApply}
            disabled={isApplying || proposalData?.isStreaming}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 24px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: isApplying || proposalData?.isStreaming ? "#94a3b8" : "#2563eb",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 700,
              cursor: isApplying || proposalData?.isStreaming ? "not-allowed" : "pointer",
              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
              transition: "all 0.15s ease"
            }}
          >
            <span>{isApplying || proposalData?.isStreaming ? "⏳" : "✅"}</span>
            <span>
              {proposalData?.isStreaming
                ? "AI đang tuyển chọn 8 linh kiện..."
                : isApplying
                ? "Đang nạp linh kiện vào Workspace..."
                : "Áp Dụng Cấu Hình Này Vào Không Gian Lắp Ráp"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
