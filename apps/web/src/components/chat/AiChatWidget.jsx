import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { httpClient } from "../../services/http";
import "./AiChatWidget.css";

const PURPOSES = [
  { id: "gaming", label: "Gaming AAA / eSports", icon: "🎮" },
  { id: "editing", label: "Dựng phim / Đồ họa 4K", icon: "🎬" },
  { id: "ai", label: "AI Workstation / Dev", icon: "🤖" },
  { id: "office", label: "Văn phòng / Học tập", icon: "💼" }
];

const RESOLUTIONS = [
  { id: "1080p", label: "1080p Full HD" },
  { id: "2k", label: "1440p / 2K" },
  { id: "4k", label: "4K Ultra HD" }
];

const formatCurrency = (v) => Number(v || 0).toLocaleString("vi-VN");

/**
 * AiChatWidget — Universal Floating AI Chatbot Widget (Nổi góc màn hình trên mọi trang)
 * Tích hợp Form Nhu Cầu + Linh kiện có sẵn ở nhà + Auto-fill 1-Click sang PC Builder.
 */
export function AiChatWidget() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("form"); // "form" | "chat"

  /* Form Criteria State */
  const [purpose, setPurpose] = useState("gaming");
  const [budget, setBudget] = useState("25000000");
  const [resolution, setResolution] = useState("1080p");
  
  /* Owned/External Components Checklist */
  const [ownedRam, setOwnedRam] = useState(false);
  const [ownedSsd, setOwnedSsd] = useState(false);
  const [ownedGpu, setOwnedGpu] = useState(false);
  const [ownedCase, setOwnedCase] = useState(false);
  const [ownedNotes, setOwnedNotes] = useState("");

  /* Messages & Chat State */
  const [messages, setMessages] = useState(() => [
    {
      id: 1,
      sender: "ai",
      text: "Xin chào! Mình là PC Mall AI Assistant. Bạn muốn tư vấn bộ PC mới hay đã có sẵn linh kiện nào ở nhà chưa?",
      timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    if (activeTab === "chat" && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  /* Submit Form Criteria & Ask AI */
  function handleFormSubmit(e) {
    e.preventDefault();
    setActiveTab("chat");

    const ownedList = [];
    if (ownedRam) ownedList.push("RAM");
    if (ownedSsd) ownedList.push("SSD/Storage");
    if (ownedGpu) ownedList.push("GPU/Card màn hình");
    if (ownedCase) ownedList.push("Vỏ Case");

    let promptMsg = `Tư vấn giúp mình bộ PC nhu cầu ${purpose.toUpperCase()} (Độ phân giải ${resolution.toUpperCase()}) với ngân sách khoảng ${formatCurrency(budget)}đ.`;
    if (ownedList.length > 0) {
      promptMsg += `\nLưu ý: Mình ĐÃ CÓ SẴN linh kiện ở nhà: ${ownedList.join(", ")}.`;
    }
    if (ownedNotes.trim()) {
      promptMsg += ` (Chi tiết linh kiện cũ: ${ownedNotes.trim()})`;
    }

    sendUserMessage(promptMsg, {
      purpose,
      budget: Number(budget),
      resolution,
      ownedList,
      ownedNotes
    });
  }

  /* Send User Message & Handle REAL Backend API Call with graceful fallback */
  async function sendUserMessage(textToSend, extraCriteria = null) {
    const trimmedText = String(textToSend || "").trim();
    if (!trimmedText) return;

    if (trimmedText.length > 2000) {
      const warningMsg = {
        id: Date.now(),
        sender: "ai",
        text: "⚠️ Câu hỏi của bạn quá dài (vượt quá 2000 ký tự). Vui lòng rút gọn nội dung.",
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      };
      setMessages((prev) => [...prev, warningMsg]);
      return;
    }

    const userMsg = {
      id: Date.now(),
      sender: "customer",
      text: trimmedText,
      timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    const activeCriteria = extraCriteria || {
      purpose,
      budget: Number(budget),
      resolution,
      ownedList: [
        ...(ownedRam ? ["RAM"] : []),
        ...(ownedSsd ? ["SSD/Storage"] : []),
        ...(ownedGpu ? ["GPU/Card màn hình"] : []),
        ...(ownedCase ? ["Vỏ Case"] : [])
      ],
      ownedNotes
    };

    try {
      // 🌐 HTTP CALL TO BACKEND API via unified httpClient (axios with auth interceptors)
      const resData = await httpClient.post("/chat/ai-consultation", {
        message: trimmedText,
        criteria: activeCriteria
      });

      const responsePayload = resData?.data?.data || resData?.data || resData;

      const aiMsg = {
        id: Date.now() + 1,
        sender: "ai",
        text: responsePayload?.text || "Dưới đây là phương án tối ưu theo yêu cầu của bạn:",
        buildPayload: responsePayload?.buildPayload || null,
        products: Array.isArray(responsePayload?.products) ? responsePayload.products : [],
        responseType: responsePayload?.type || "advisor_reply",
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.warn("Backend API call offline/error:", err);
      
      const fallbackMsg = {
        id: Date.now() + 1,
        sender: "ai",
        text: "Hệ thống tư vấn AI hiện không khả dụng. Vui lòng thử lại sau.",
        buildPayload: null,
        products: [],
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      };

      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  /* 1-CLICK NAVIGATE & APPLY BUILD TO PC BUILDER WORKSPACE */
  function handleNavigateAndApplyBuild(buildPayload) {
    if (!buildPayload) return;
    
    // Save payload to sessionStorage for PcBuilderPage lazy initialization
    sessionStorage.setItem("pcmall_pending_ai_build", JSON.stringify(buildPayload));
    
    // Close chat and navigate seamlessly
    setIsOpen(false);
    navigate("/pc-builder");

    // Dispatch custom event for real-time update if already on /pc-builder
    window.dispatchEvent(new CustomEvent("pcmall:apply-pending-ai-build", { detail: buildPayload }));
  }

  return (
    <div className="ai-chat-widget-root">
      {/* ── 3D MASCOT ULTRA VIP ANIMATED FLOATING ACTION BUTTON ───────── */}
      {!isOpen && (
        <div className="ai-mascot-fab-wrap">
          {/* Floating Tooltip Speech Bubble */}
          <div className="ai-mascot-tooltip" onClick={() => setIsOpen(true)}>
            <span className="tooltip-dot" />
            <span className="tooltip-text">👋 Tư vấn PC 24/7 với AI</span>
          </div>

          {/* 3D Mascot Circular Button */}
          <button
            type="button"
            className="ai-mascot-fab"
            onClick={() => setIsOpen(true)}
            title="Mở AI Assistant Tư Vấn Cấu Hình PC"
            aria-label="Mở AI Assistant"
          >
            <div className="mascot-img-wrap">
              <img
                src="/assets/ai_bot_mascot_vip.png"
                alt="AI Assistant Mascot VIP"
                className="mascot-img"
              />
            </div>
            <span className="mascot-vip-badge">VIP</span>
            <span className="mascot-online-dot" />
            <span className="mascot-aura-ring" />
          </button>
        </div>
      )}

      {/* ── FLOATING CHAT DRAWER PANEL ───────────────────────── */}
      {isOpen && (
        <div className="ai-chat-drawer">
          {/* Header */}
          <div className="ai-chat-header">
            <div className="ai-chat-title-box">
              <span className="ai-chat-avatar">🤖</span>
              <div>
                <strong className="ai-chat-name">PC Mall AI Assistant</strong>
                <span className="ai-chat-status">🟢 Online (Sẵn sàng 24/7)</span>
              </div>
            </div>
            <div className="ai-chat-header-actions">
              <button
                type="button"
                className="ai-chat-icon-btn"
                onClick={() => setMessages([{ id: 1, sender: "ai", text: "Xin chào! Mình có thể giúp gì cho bộ PC mới của bạn?", timestamp: "vừa xong" }])}
                title="Làm mới cuộc trò chuyện"
              >
                🔄
              </button>
              <button
                type="button"
                className="ai-chat-icon-btn"
                onClick={() => setIsOpen(false)}
                title="Thu nhỏ"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="ai-chat-tabs">
            <button
              type="button"
              className={`ai-chat-tab-btn${activeTab === "form" ? " is-active" : ""}`}
              onClick={() => setActiveTab("form")}
            >
              🎯 1. Nhu Cầu & Đồ Có Sẵn
            </button>
            <button
              type="button"
              className={`ai-chat-tab-btn${activeTab === "chat" ? " is-active" : ""}`}
              onClick={() => setActiveTab("chat")}
            >
              💬 2. Hội Thoại AI {messages.length > 1 && `(${messages.length})`}
            </button>
          </div>

          {/* Body Content */}
          <div className="ai-chat-body">
            {activeTab === "form" ? (
              <form onSubmit={handleFormSubmit} className="ai-form-container">
                {/* 1. Purpose */}
                <div className="ai-form-group">
                  <label className="ai-form-label">1. Mục đích sử dụng chính của bạn:</label>
                  <div className="ai-purpose-grid">
                    {PURPOSES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`ai-purpose-chip${purpose === item.id ? " is-selected" : ""}`}
                        onClick={() => setPurpose(item.id)}
                      >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Budget */}
                <div className="ai-form-group">
                  <div className="ai-form-label-row">
                    <label className="ai-form-label">2. Ngân sách mua sắm dự kiến:</label>
                    <span className="ai-budget-val">{formatCurrency(budget)}đ</span>
                  </div>
                  <input
                    type="range"
                    min="8000000"
                    max="100000000"
                    step="1000000"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="ai-budget-slider"
                  />
                  <div className="ai-quick-budget-pills">
                    {["15000000", "25000000", "35000000", "50000000"].map((bVal) => (
                      <button
                        key={bVal}
                        type="button"
                        className={`ai-budget-pill${budget === bVal ? " is-selected" : ""}`}
                        onClick={() => setBudget(bVal)}
                      >
                        {formatCurrency(bVal)}đ
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Resolution */}
                <div className="ai-form-group">
                  <label className="ai-form-label">3. Target Độ phân giải màn hình:</label>
                  <div className="ai-res-grid">
                    {RESOLUTIONS.map((res) => (
                      <button
                        key={res.id}
                        type="button"
                        className={`ai-res-chip${resolution === res.id ? " is-selected" : ""}`}
                        onClick={() => setResolution(res.id)}
                      >
                        {res.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Owned Components Exclusions */}
                <div className="ai-form-group ai-owned-section">
                  <label className="ai-form-label">🏠 Linh kiện bạn ĐÃ CÓ SẴN ở nhà (AI sẽ loại trừ tiền):</label>
                  <div className="ai-owned-checkboxes">
                    <label className="ai-checkbox-item">
                      <input type="checkbox" checked={ownedRam} onChange={(e) => setOwnedRam(e.target.checked)} />
                      <span>🧠 Đã có RAM</span>
                    </label>
                    <label className="ai-checkbox-item">
                      <input type="checkbox" checked={ownedSsd} onChange={(e) => setOwnedSsd(e.target.checked)} />
                      <span>💾 Đã có SSD</span>
                    </label>
                    <label className="ai-checkbox-item">
                      <input type="checkbox" checked={ownedGpu} onChange={(e) => setOwnedGpu(e.target.checked)} />
                      <span>🎮 Đã có Card GPU</span>
                    </label>
                    <label className="ai-checkbox-item">
                      <input type="checkbox" checked={ownedCase} onChange={(e) => setOwnedCase(e.target.checked)} />
                      <span>📦 Đã có Vỏ Case</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Mô tả linh kiện có sẵn (ví dụ: RAM Kingmax 16GB DDR4)..."
                    value={ownedNotes}
                    onChange={(e) => setOwnedNotes(e.target.value)}
                    className="ai-owned-notes-input"
                  />
                </div>

                <button type="submit" className="btn-ai-submit-form">
                  ⚡ Gửi AI Phân Tích & Đề Xuất Cấu Hình
                </button>
              </form>
            ) : (
              /* CHAT MESSAGES LIST */
              <div className="ai-messages-scroll">
                {messages.map((msg) => (
                  <div key={msg.id} className={`ai-message-row ai-message-row--${msg.sender}`}>
                    <div className="ai-message-bubble">
                      <div className="ai-message-text">{msg.text}</div>

                      {/* ✅ FIX BUG #1: RENDER PRODUCT CARDS từ backend (RAM, CPU, GPU, ...) */}
                      {msg.products && msg.products.length > 0 && (
                        <div className="ai-product-list">
                          <div className="ai-product-list-label">
                            📦 {msg.products.length} sản phẩm thực tế trong hệ thống:
                          </div>
                          <div className="ai-product-cards-scroll">
                            {msg.products.map((prod, idx) => {
                              const imgSrc = prod.imageUrl || prod.image_url || prod.img || null;
                              const isInStock = Number(prod.stock || 0) > 0;
                              const prodSlug = prod.slug || prod.id || prod.productId;
                              const prodId   = prod.id || prod.productId;
                              return (
                                <div key={prod.id || prod.productId || idx} className="ai-prod-card">
                                  {/* Category badge */}
                                  <div className="ai-prod-cat-badge">{prod.categoryName || prod.category_name || "Linh kiện"}</div>

                                  {/* Image */}
                                  <div className="ai-prod-img-wrap">
                                    {imgSrc
                                      ? <img src={imgSrc} alt={prod.name || prod.productName} className="ai-prod-img" />
                                      : <span className="ai-prod-img-placeholder">📦</span>
                                    }
                                  </div>

                                  {/* Name */}
                                  <div className="ai-prod-name" title={prod.name || prod.productName}>
                                    {prod.name || prod.productName}
                                  </div>

                                  {/* Brand */}
                                  {(prod.brandName || prod.brand_name) && (
                                    <div className="ai-prod-brand">{prod.brandName || prod.brand_name}</div>
                                  )}

                                  {/* Price */}
                                  <div className="ai-prod-price">
                                    {Number(prod.price || 0) > 0
                                      ? `${formatCurrency(prod.price)}đ`
                                      : "Liên hệ"}
                                  </div>

                                  {/* Stock badge */}
                                  <span className={`ai-prod-stock ${isInStock ? "in-stock" : "out-stock"}`}>
                                    {isInStock ? `Còn ${prod.stock} SP` : "Hết hàng"}
                                  </span>

                                  {/* Action buttons */}
                                  <div className="ai-prod-actions">
                                    <Link
                                      to={`/products/${prodSlug}`}
                                      className="ai-prod-btn ai-prod-btn--detail"
                                      onClick={() => setIsOpen(false)}
                                    >
                                      Xem
                                    </Link>
                                    <Link
                                      to={`/compare?ids=${prodId}`}
                                      className="ai-prod-btn ai-prod-btn--compare"
                                      onClick={() => setIsOpen(false)}
                                    >
                                      SS
                                    </Link>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* PC BUILD CARD (form submit hoặc pc_build intent) */}
                      {msg.buildPayload && (
                        <div className="ai-build-card">
                          <div className="ai-build-card-header">
                            <strong className="ai-build-card-title">🖥️ {msg.buildPayload.label}</strong>
                            <span className="ai-build-card-price">{formatCurrency(msg.buildPayload.totalPrice)}đ</span>
                          </div>

                          <div className="ai-build-card-comps">
                            {msg.buildPayload.components.map((c, i) => (
                              <div key={i} className="ai-build-comp-row">
                                <span className="comp-tag">{c.type}</span>
                                <span className="comp-name">{c.name}</span>
                                <span className="comp-price">{c.price > 0 ? `${formatCurrency(c.price)}đ` : "Có sẵn"}</span>
                              </div>
                            ))}
                          </div>

                          <button
                            type="button"
                            className="btn-ai-apply-navigate"
                            onClick={() => handleNavigateAndApplyBuild(msg.buildPayload)}
                          >
                            🚀 Lắp Ráp Cấu Hình Này Ngay →
                          </button>
                        </div>
                      )}

                      <span className="ai-message-time">{msg.timestamp}</span>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="ai-message-row ai-message-row--ai">
                    <div className="ai-message-bubble ai-typing-indicator">
                      <span>🤖 AI đang tra cứu DB & phân thích tương thích...</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>
            )}
          </div>

          {/* Footer Input Bar (Chỉ hiện khi ở tab Chat) */}
          {activeTab === "chat" && (
            <div className="ai-chat-footer">
              <div className="ai-prompt-chips">
                <button
                  type="button"
                  onClick={() => sendUserMessage("RAM 3200 cắm mainboard 2666 có cháy không bạn?")}
                >
                  ❓ RAM 3200 cắm main 2666?
                </button>
                <button
                  type="button"
                  onClick={() => sendUserMessage("Tư vấn giúp mình PC 20tr đã có sẵn RAM DDR4 16GB ở nhà")}
                >
                  🏠 Dùng lại RAM DDR4 cũ
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendUserMessage(inputText);
                }}
                className="ai-input-row"
              >
                <input
                  type="text"
                  placeholder="Nhập câu hỏi hoặc nhu cầu lắp PC..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isLoading}
                  className="ai-chat-input"
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputText.trim()}
                  className="btn-ai-send"
                >
                  🚀
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
