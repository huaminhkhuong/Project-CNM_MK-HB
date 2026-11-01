import React, { useState, useEffect, useRef } from "react";
import { formatCurrency, getProductPrice, getProductName, getProductId } from "./pcBuilderUtils";
import { resolveProductImage } from "../../utils/productImage";
import { streamAiResponse } from "../../utils/aiStreamClient";

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
  storage: "Ổ cứng (SSD)",
  psu: "Nguồn máy tính (PSU)",
  case: "Vỏ thùng máy (Case)",
  cooling: "Tản nhiệt (Cooling)"
};

export function AiBuildAuditModal({
  isOpen,
  onClose,
  currentBuild,
  onApplyReplacement
}) {
  const [activeTab, setActiveTab] = useState("audit"); // "audit" | "chat"
  const [isAuditing, setIsAuditing] = useState(false);
  const [streamedReport, setStreamedReport] = useState("");
  const [auditResult, setAuditResult] = useState(null);
  const [auditError, setAuditError] = useState(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatStreaming, setIsChatStreaming] = useState(false);

  const reportContainerRef = useRef(null);
  const chatBottomRef = useRef(null);
  const abortControllerRef = useRef(null);

  const rawItems = currentBuild?.items || [];
  const buildItems = Array.isArray(rawItems)
    ? rawItems
    : Object.entries(rawItems).map(([type, comp]) => ({
        componentType: type,
        ...(comp.product || comp)
      }));

  const totalPrice = Number(currentBuild?.totalPrice || buildItems.reduce((sum, i) => sum + (getProductPrice(i) || 0), 0));
  const targetBudget = Number(currentBuild?.targetBudget || currentBuild?.budget || 0);
  const useCase = currentBuild?.useCase || currentBuild?.purpose || "gaming";
  const resolution = currentBuild?.resolution || "1080p";

  // Trigger Audit when modal opens
  useEffect(() => {
    if (isOpen && buildItems.length > 0 && !auditResult && !isAuditing) {
      runAudit();
    }
  }, [isOpen, buildItems.length]);

  // Auto-scroll chat
  useEffect(() => {
    if (activeTab === "chat" && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isChatStreaming, activeTab]);

  const runAudit = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    setIsAuditing(true);
    setStreamedReport("");
    setAuditResult(null);
    setAuditError(null);

    const formattedBuildItems = buildItems.map((item) => ({
      componentType: item.componentType || item.type,
      productName: getProductName(item),
      price: getProductPrice(item),
      specs: item.specs || item.product?.specs || {}
    }));

    await streamAiResponse(
      "/pc-builder/ai-audit-stream",
      {
        buildItems: formattedBuildItems,
        targetBudget,
        useCase,
        resolution
      },
      {
        signal: abortCtrl.signal,
        onChunk: (chunk) => {
          setStreamedReport((prev) => prev + chunk);
          if (reportContainerRef.current) {
            reportContainerRef.current.scrollTop = reportContainerRef.current.scrollHeight;
          }
        },
        onDone: (result) => {
          setIsAuditing(false);
          setAuditResult(result);
        },
        onError: (err) => {
          setIsAuditing(false);
          setAuditError(err.message || "Không thể hoàn thành giám định.");
        }
      }
    );
  };

  const handleSendMessage = async (customText = null) => {
    const textToSend = String(customText || chatInput).trim();
    if (!textToSend || isChatStreaming) return;

    if (!customText) setChatInput("");

    const newMessages = [...chatMessages, { role: "user", content: textToSend }];
    setChatMessages(newMessages);
    setIsChatStreaming(true);

    const formattedBuildItems = buildItems.map((item) => ({
      componentType: item.componentType || item.type,
      productName: getProductName(item),
      price: getProductPrice(item)
    }));

    let currentReply = "";
    // Temporary assistant message
    setChatMessages([...newMessages, { role: "assistant", content: "" }]);

    await streamAiResponse(
      "/pc-builder/ai-chat-stream",
      {
        buildItems: formattedBuildItems,
        messages: newMessages,
        userMessage: textToSend,
        useCase,
        resolution
      },
      {
        onChunk: (chunk) => {
          currentReply += chunk;
          setChatMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              last.content = currentReply;
            }
            return copy;
          });
        },
        onDone: (result) => {
          setIsChatStreaming(false);
          setChatMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              last.content = result.reply || currentReply;
              last.replacements = result.replacements || [];
            }
            return copy;
          });
        },
        onError: (err) => {
          setIsChatStreaming(false);
          setChatMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              last.content = `⚠️ Lỗi: ${err.message || "Kênh AI đang bận. Vui lòng thử lại sau ít giây."}`;
            }
            return copy;
          });
        }
      }
    );
  };

  if (!isOpen) return null;

  // Format Status Badge
  const score = auditResult?.auditScore ?? 80;
  const status = auditResult?.status ?? "GOOD";
  let statusBadgeBg = "#ecfdf5";
  let statusBadgeColor = "#059669";
  let statusBadgeText = "XUẤT SẮC - SẴN SÀNG LẮP RÁP";

  if (status === "CRITICAL_ISSUE" || score < 50) {
    statusBadgeBg = "#fef2f2";
    statusBadgeColor = "#dc2626";
    statusBadgeText = "NGUY HIỂM - LỖI PHẦN CỨNG / NGHẼN NẶNG";
  } else if (status === "NEEDS_OPTIMIZATION" || score < 80) {
    statusBadgeBg = "#fffbeb";
    statusBadgeColor = "#d97706";
    statusBadgeText = "CẦN TỐI ƯU HÓA LINH KIỆN";
  }

  const issues = auditResult?.issues || [];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isAuditing) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1050px",
          height: "90vh",
          maxHeight: "880px",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #e2e8f0"
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: "16px 24px",
            backgroundColor: "#0f172a",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #1e293b"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px"
              }}
            >
              🧠
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#f8fafc" }}>
                  Hội Đồng Thẩm Định Kỹ Thuật AI
                </h2>
                <span
                  style={{
                    backgroundColor: "#1e293b",
                    color: "#94a3b8",
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "6px",
                    border: "1px solid #334155"
                  }}
                >
                  Strict Auditor • Gemini 3.5 Flash
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>
                Đánh giá không thiên vị, bóc tách nghẽn cổ chai và phát hiện linh kiện rủi ro
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* TABS */}
            <div
              style={{
                display: "flex",
                backgroundColor: "#1e293b",
                padding: "3px",
                borderRadius: "8px",
                border: "1px solid #334155"
              }}
            >
              <button
                onClick={() => setActiveTab("audit")}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: activeTab === "audit" ? "#2563eb" : "transparent",
                  color: activeTab === "audit" ? "#ffffff" : "#94a3b8",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span>📋 Báo Cáo Thẩm Định</span>
                {issues.length > 0 && (
                  <span
                    style={{
                      backgroundColor: "#ef4444",
                      color: "#fff",
                      fontSize: "10px",
                      borderRadius: "10px",
                      padding: "1px 6px"
                    }}
                  >
                    {issues.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("chat")}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: activeTab === "chat" ? "#2563eb" : "transparent",
                  color: activeTab === "chat" ? "#ffffff" : "#94a3b8",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span>💬 Chat Với AI Về Build</span>
              </button>
            </div>

            <button
              onClick={onClose}
              style={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                color: "#94a3b8",
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "16px"
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* SUMMARY SUBHEADER */}
        <div
          style={{
            padding: "10px 24px",
            backgroundColor: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "13px" }}>
            <div>
              <span style={{ color: "#64748b" }}>Đã chọn: </span>
              <strong style={{ color: "#0f172a" }}>{buildItems.length} / 8 linh kiện</strong>
            </div>
            <div>
              <span style={{ color: "#64748b" }}>Tổng giá trị: </span>
              <strong style={{ color: "#2563eb" }}>{formatCurrency(totalPrice)}đ</strong>
            </div>
            <div>
              <span style={{ color: "#64748b" }}>Mục đích: </span>
              <strong style={{ color: "#0f172a" }}>{useCase.toUpperCase()} ({resolution.toUpperCase()})</strong>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                backgroundColor: statusBadgeBg,
                color: statusBadgeColor,
                fontSize: "12px",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "6px",
                border: `1px solid ${statusBadgeColor}33`,
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <span>{score}/100</span>
              <span>•</span>
              <span>{statusBadgeText}</span>
            </span>

            <button
              onClick={runAudit}
              disabled={isAuditing}
              style={{
                padding: "6px 12px",
                backgroundColor: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                color: "#334155",
                fontSize: "12px",
                fontWeight: 600,
                cursor: isAuditing ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }}
            >
              <span>🔄</span>
              <span>{isAuditing ? "Đang thẩm định..." : "Thẩm định lại"}</span>
            </button>
          </div>
        </div>

        {/* BODY CONTENT */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
          {activeTab === "audit" ? (
            <div
              ref={reportContainerRef}
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "20px"
              }}
            >
              {/* STREAMING STATUS BANNER */}
              {isAuditing && (
                <div
                  style={{
                    backgroundColor: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: "8px",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: "#1d4ed8",
                    fontSize: "13px"
                  }}
                >
                  <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⚙️</span>
                  <span>
                    <strong>AI đang trực tiếp phân tích từng thông số phần cứng...</strong> Phản hồi đang được streaming real-time từ Google Gemini.
                  </span>
                </div>
              )}

              {auditError && (
                <div
                  style={{
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "8px",
                    padding: "12px 16px",
                    color: "#b91c1c",
                    fontSize: "13px"
                  }}
                >
                  ⚠️ <strong>Lỗi:</strong> {auditError}
                </div>
              )}

              {/* ⚠️ PHẦN ĐỀ XUẤT THAY THẾ LINH KIỆN NẾU BỊ ĐÁNH GIÁ XẤU (ACTIONABLE REPLACEMENTS) */}
              {issues.length > 0 && (
                <div
                  style={{
                    backgroundColor: "#fff7ed",
                    border: "1px solid #fed7aa",
                    borderRadius: "12px",
                    padding: "18px 20px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                    <span style={{ fontSize: "20px" }}>🚨</span>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#9a3412" }}>
                      Phát hiện {issues.length} điểm nghẽn / linh kiện không tối ưu cần thay thế
                    </h3>
                  </div>
                  <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#7c2d12" }}>
                    Dựa trên đánh giá nghiêm khắc của AI, hệ thống đã tự động lọc các linh kiện trong kho hàng PC Mall khớp với tiêu chuẩn kỹ thuật khuyến nghị:
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {issues.map((issue, idx) => {
                      const icon = COMPONENT_ICONS[issue.componentType] || "🔧";
                      const label = COMPONENT_LABELS[issue.componentType] || issue.componentType.toUpperCase();
                      const isHigh = issue.severity === "high";

                      return (
                        <div
                          key={idx}
                          style={{
                            backgroundColor: "#ffffff",
                            borderRadius: "10px",
                            border: `1px solid ${isHigh ? "#fca5a5" : "#fed7aa"}`,
                            padding: "14px 16px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "16px" }}>{icon}</span>
                              <strong style={{ fontSize: "14px", color: "#0f172a" }}>{label}: {issue.currentName}</strong>
                            </div>
                            <span
                              style={{
                                backgroundColor: isHigh ? "#fee2e2" : "#fef3c7",
                                color: isHigh ? "#dc2626" : "#b45309",
                                fontSize: "11px",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "4px"
                              }}
                            >
                              {isHigh ? "MỨC ĐỘ NGUY HIỂM CAO" : "MỨC ĐỘ CẦN LƯU Ý"}
                            </span>
                          </div>

                          <div style={{ fontSize: "13px", color: "#475569", lineHeight: "1.5", marginBottom: "8px" }}>
                            <strong style={{ color: "#b91c1c" }}>Nguyên nhân: </strong>
                            {issue.problem}
                          </div>

                          {issue.targetCriteria?.advice && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#0369a1",
                                backgroundColor: "#f0f9ff",
                                padding: "8px 12px",
                                borderRadius: "6px",
                                marginBottom: "12px",
                                border: "1px solid #e0f2fe"
                              }}
                            >
                              💡 <strong>Lời khuyên kỹ sư:</strong> {issue.targetCriteria.advice}
                            </div>
                          )}

                          {/* DANH SÁCH LINH KIỆN THẬT ĐƯỢC TỰ ĐỘNG LỌC TỪ KHO HÀNG */}
                          {issue.suggestedProducts && issue.suggestedProducts.length > 0 ? (
                            <div>
                              <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "8px" }}>
                                📦 Linh kiện trong kho hàng khớp tiêu chuẩn trên (Nhấp để đổi ngay):
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px" }}>
                                {issue.suggestedProducts.map((prod) => {
                                  const pPrice = getProductPrice(prod);
                                  const pName = getProductName(prod);
                                  const pId = getProductId(prod);
                                  const imgSrc = resolveProductImage(prod);

                                  return (
                                    <div
                                      key={pId}
                                      style={{
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "8px",
                                        padding: "10px",
                                        backgroundColor: "#f8fafc",
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "space-between",
                                        gap: "8px"
                                      }}
                                    >
                                      <div style={{ display: "flex", gap: "10px" }}>
                                        <img
                                          src={imgSrc}
                                          alt={pName}
                                          style={{
                                            width: "48px",
                                            height: "48px",
                                            objectFit: "contain",
                                            borderRadius: "6px",
                                            backgroundColor: "#fff",
                                            border: "1px solid #e2e8f0"
                                          }}
                                        />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div
                                            style={{
                                              fontSize: "12px",
                                              fontWeight: 600,
                                              color: "#0f172a",
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                              display: "-webkit-box",
                                              WebkitLineClamp: 2,
                                              WebkitBoxOrient: "vertical"
                                            }}
                                            title={pName}
                                          >
                                            {pName}
                                          </div>
                                          <div style={{ fontSize: "13px", fontWeight: 700, color: "#2563eb", marginTop: "2px" }}>
                                            {formatCurrency(pPrice)}đ
                                          </div>
                                        </div>
                                      </div>

                                      <button
                                        onClick={() => {
                                          if (onApplyReplacement) {
                                            onApplyReplacement(issue.componentType, prod, {
                                              variant_id: prod.variantId || prod.id,
                                              price: pPrice,
                                              stock: prod.stock || 10
                                            });
                                          }
                                        }}
                                        style={{
                                          width: "100%",
                                          padding: "6px 10px",
                                          backgroundColor: "#2563eb",
                                          color: "#ffffff",
                                          border: "none",
                                          borderRadius: "6px",
                                          fontSize: "12px",
                                          fontWeight: 600,
                                          cursor: "pointer",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          gap: "6px"
                                        }}
                                      >
                                        <span>🔄</span>
                                        <span>Đổi Sang Linh Kiện Này</span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>
                              (Hiện không có linh kiện sẵn hàng khớp 100% tiêu chí trên, bạn có thể tham khảo mục khác trong cửa hàng).
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* BÁO CÁO TOÀN DIỆN MARKDOWN TỪ AI */}
              <div
                style={{
                  backgroundColor: "#f8fafc",
                  borderRadius: "12px",
                  padding: "20px",
                  border: "1px solid #e2e8f0"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                  <span style={{ fontSize: "18px" }}>📜</span>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                    Biên Bản Giám Định Chi Tiết Của AI
                  </h4>
                </div>

                <div
                  style={{
                    fontSize: "13.5px",
                    lineHeight: "1.7",
                    color: "#334155",
                    whiteSpace: "pre-wrap",
                    fontFamily: "inherit"
                  }}
                >
                  {/* Remove JSON code block for clean reading */}
                  {streamedReport.replace(/```json[\s\S]*?```/g, "").trim() || "Đang tải biên bản giám định..."}
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: CHAT TRỰC TIẾP VỚI AI VỀ BUILD */
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {/* CHAT MESSAGES */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  backgroundColor: "#f8fafc"
                }}
              >
                {chatMessages.length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "40px 20px",
                      color: "#64748b"
                    }}
                  >
                    <div style={{ fontSize: "36px", marginBottom: "8px" }}>💬</div>
                    <h4 style={{ margin: "0 0 6px 0", color: "#0f172a", fontSize: "15px" }}>
                      Hỏi Đáp Chuyên Sâu Cùng Kỹ Sư Phần Cứng
                    </h4>
                    <p style={{ margin: 0, fontSize: "13px" }}>
                      Hỏi bất kỳ điều gì về dàn PC của bạn: giảm chi phí, khả năng nâng cấp, độ an toàn nguồn điện...
                    </p>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                        justifyContent: "center",
                        marginTop: "16px"
                      }}
                    >
                      {[
                        "Làm sao giảm 2 triệu mà không tụt FPS?",
                        "Nguồn này có nâng cấp card được sau này không?",
                        "Bộ tản nhiệt này có đủ mát khi render nặng?",
                        "RAM 1 thanh hay 2 thanh khác biệt gì?"
                      ].map((promptChip, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => handleSendMessage(promptChip)}
                          style={{
                            backgroundColor: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: "20px",
                            padding: "6px 14px",
                            fontSize: "12px",
                            color: "#1e293b",
                            cursor: "pointer"
                          }}
                        >
                          {promptChip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chatMessages.map((msg, mIdx) => {
                  const isUser = msg.role === "user";
                  return (
                    <div
                      key={mIdx}
                      style={{
                        display: "flex",
                        justifyContent: isUser ? "flex-end" : "flex-start"
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "80%",
                          padding: "12px 16px",
                          borderRadius: isUser ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                          backgroundColor: isUser ? "#2563eb" : "#ffffff",
                          color: isUser ? "#ffffff" : "#0f172a",
                          fontSize: "13.5px",
                          lineHeight: "1.6",
                          border: isUser ? "none" : "1px solid #e2e8f0",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                          whiteSpace: "pre-wrap"
                        }}
                      >
                        {/* Remove JSON code block from chat display */}
                        {msg.content.replace(/```json[\s\S]*?```/g, "").trim() || (isChatStreaming ? "..." : "")}

                        {/* REPLACEMENT CARDS IN CHAT */}
                        {msg.replacements && msg.replacements.length > 0 && (
                          <div style={{ marginTop: "12px", borderTop: "1px solid #e2e8f0", paddingTop: "10px" }}>
                            <div style={{ fontSize: "12px", fontWeight: 700, color: "#b45309", marginBottom: "6px" }}>
                              💡 Linh kiện đề xuất thay thế:
                            </div>
                            {msg.replacements.map((rep, rIdx) => (
                              <div key={rIdx} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                {rep.suggestedProducts && rep.suggestedProducts.map((p) => {
                                  const pPrice = getProductPrice(p);
                                  const pName = getProductName(p);
                                  return (
                                    <div
                                      key={getProductId(p)}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        backgroundColor: "#f8fafc",
                                        padding: "8px 10px",
                                        borderRadius: "6px",
                                        border: "1px solid #e2e8f0"
                                      }}
                                    >
                                      <div>
                                        <div style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a" }}>{pName}</div>
                                        <div style={{ fontSize: "11px", color: "#2563eb" }}>{formatCurrency(pPrice)}đ</div>
                                      </div>
                                      <button
                                        onClick={() => {
                                          if (onApplyReplacement) {
                                            onApplyReplacement(rep.componentType, p, {
                                              variant_id: p.variantId || p.id,
                                              price: pPrice,
                                              stock: p.stock || 10
                                            });
                                          }
                                        }}
                                        style={{
                                          padding: "4px 8px",
                                          backgroundColor: "#2563eb",
                                          color: "#fff",
                                          border: "none",
                                          borderRadius: "4px",
                                          fontSize: "11px",
                                          cursor: "pointer"
                                        }}
                                      >
                                        Đổi ngay
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatBottomRef} />
              </div>

              {/* CHAT INPUT BAR */}
              <div
                style={{
                  padding: "12px 20px",
                  borderTop: "1px solid #e2e8f0",
                  backgroundColor: "#ffffff",
                  display: "flex",
                  gap: "10px"
                }}
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendMessage();
                  }}
                  placeholder="Hỏi AI kỹ sư về cấu hình (VD: 'Nên đổi sang card nào để rẻ hơn?')..."
                  disabled={isChatStreaming}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    outline: "none"
                  }}
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isChatStreaming || !chatInput.trim()}
                  style={{
                    padding: "10px 18px",
                    backgroundColor: chatInput.trim() && !isChatStreaming ? "#2563eb" : "#94a3b8",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: chatInput.trim() && !isChatStreaming ? "pointer" : "not-allowed"
                  }}
                >
                  {isChatStreaming ? "..." : "Gửi"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div
          style={{
            padding: "14px 24px",
            backgroundColor: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            💡 Mẹo: Khi bấm <strong>"Đổi Sang Linh Kiện Này"</strong>, cấu hình trong workspace sẽ lập tức cập nhật.
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "8px 20px",
              backgroundColor: "#0f172a",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Đóng Biên Bản
          </button>
        </div>
      </div>
    </div>
  );
}

export default AiBuildAuditModal;
