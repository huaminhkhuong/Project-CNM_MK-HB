import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { clearAiChatHistory, getAiChatHistory, sendAiChat, sendAiFeedback } from "../../services/ai.service";
import {
  createChatSession,
  getChatSession,
  handoffChatSession,
  sendChatMessage
} from "../../services/chat.service";
import { useAuth } from "../../hooks/useAuth";
import { useSocket } from "../../hooks/useSocket";
import { routeConfig } from "../../routes/routeConfig";
import { addStoredCompareId, buildCompareUrl } from "../../utils/compare";
import { resolveProductImage } from "../../utils/productImage";
import {
  clearGuestAiChatMessages,
  getGuestAiChatMessages,
  setGuestAiChatMessages
} from "../../utils/guestStorage";

const AI_HISTORY_KEY_VERSION = "pcmall_ai_chat_v3_clean";

const QUICK_ACTIONS = [
  { label: "Build PC chơi Dota 2", prompt: "Tôi muốn chơi Dota 2 cần build PC như thế nào?", icon: "🎮" },
  { label: "Build PC 15 triệu gaming", prompt: "Tư vấn cấu hình PC gaming khoảng 15 triệu", icon: "🧩" },
  { label: "CPU Intel Core Ultra mới", prompt: "CPU nào hiện tại đang tối tân nhất của Intel?", icon: "🚀" },
  { label: "AMD Ryzen 9000 Zen 5", prompt: "CPU AMD nào đang hiện đại và mạnh nhất hiện nay?", icon: "💎" },
  { label: "RAM DDR4 vs DDR5", prompt: "Nên chọn RAM DDR4 hay DDR5?", icon: "⚡" },
  { label: "So sánh RTX 4060 vs 4070", prompt: "So sánh RTX 4060 và RTX 4070", icon: "⚖️" }
];

function createMessage(role, content, metadata = {}) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content: content || "",
    products: metadata.products || [],
    build: metadata.build || null,
    intent: metadata.intent || "",
    model: metadata.model || "",
    ruleName: metadata.ruleName || "",
    hitType: metadata.hitType || "",
    createdAt: new Date().toISOString()
  };
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function getAvatarLabel(user, fallback = "KH") {
  const fullName = String(user?.fullName || "").trim();
  const email = String(user?.email || "").trim();
  const source = fullName || email;

  if (!source) return fallback;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }

  return source.charAt(0).toUpperCase();
}

function normalizeApiData(response) {
  return response?.data?.data || response?.data || response || {};
}

function renderContent(content) {
  return String(content || "")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
}

function getBuildComponents(build) {
  const components = build?.components || [];
  if (Array.isArray(components)) {
    return components.map((item) => ({
      id: item.id || item.productId,
      productId: item.productId || item.id,
      componentType: item.componentType || item.type || "other",
      skuId: item.skuId || item.id,
      name: item.name || item.product_name || "Linh kiện",
      price: Number(item.price || 0),
      stock: item.stock !== undefined ? item.stock : "",
      imageUrl: item.imageUrl || item.image_url || "",
      slug: item.slug || "",
      brandName: item.brandName || "",
      categoryName: item.categoryName || ""
    }));
  }
  if (!components || typeof components !== "object") return [];

  return Object.entries(components).map(([componentType, item]) => {
    const product = item?.product || item?.Product || item?.variant?.product || {};
    const variant = item?.variant || item?.ProductVariant || item?.sku || {};
    return {
      id: product?.id || item?.id,
      productId: product?.id || item?.id,
      componentType,
      skuId: variant?.id || variant?.variant_id || variant?.skuId || product?.id || componentType,
      name: product?.product_name || product?.name || item?.name || componentType.toUpperCase(),
      price: Number(variant?.price || item?.price || product?.price || 0),
      stock: variant?.stock || variant?.stock_quantity || product?.stock || "",
      imageUrl: product?.imageUrl || product?.image_url || item?.imageUrl || "",
      slug: product?.slug || item?.slug || "",
      brandName: product?.brand_name || product?.brandName || "",
      categoryName: product?.category_name || product?.categoryName || ""
    };
  });
}

export function AiChatPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();

  const [aiMessages, setAiMessages] = useState(() => {
    try {
      const savedVersion = localStorage.getItem("pcmall_ai_chat_ver");
      if (savedVersion !== AI_HISTORY_KEY_VERSION) {
        localStorage.removeItem("pcmall_ai_chat_guest_messages");
        localStorage.setItem("pcmall_ai_chat_ver", AI_HISTORY_KEY_VERSION);
        return [];
      }
      return getGuestAiChatMessages();
    } catch {
      return [];
    }
  });

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [activeModel, setActiveModel] = useState("Gemini 3.5 Flash Lite Grounded");

  // Live Chat Handoff với Nhân viên Bán hàng (Sales Staff)
  const { joinRoom, leaveRoom, on } = useSocket();
  const [chatMode, setChatMode] = useState("ai"); // "ai" | "human"
  const [liveSession, setLiveSession] = useState(null);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState({});

  async function handleFeedback(messageId, rating, messageContent) {
    if (feedbackMap[messageId]) return;
    setFeedbackMap((prev) => ({ ...prev, [messageId]: rating }));
    try {
      await sendAiFeedback({
        query: "AI Consultation Message",
        response: messageContent,
        rating,
        category: "AI_CHAT_PAGE"
      });
    } catch {
      // Graceful fallback
    }
  }

  const chatMessagesRef = useRef(null);
  const textareaRef = useRef(null);

  const customerAvatarLabel = useMemo(() => getAvatarLabel(user, "KH"), [user]);
  const canSend = Boolean(question.trim()) && !loading && !handoffLoading;

  useEffect(() => {
    setGuestAiChatMessages(aiMessages);
  }, [aiMessages]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let isCancelled = false;

    async function loadDbHistory() {
      try {
        const historyRes = await getAiChatHistory();
        const data = historyRes?.data?.data || historyRes?.data || [];
        if (!isCancelled && Array.isArray(data) && data.length > 0) {
          const mapped = data.map((m) => ({
            id: m.id || `db-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role: m.sender === "user" ? "user" : "assistant",
            content: m.message || "",
            products: m.products || [],
            build: m.build || null,
            intent: m.intent || "",
            model: m.model || "",
            createdAt: m.created_at || m.createdAt || new Date().toISOString()
          }));
          setAiMessages(mapped);
        }
      } catch (err) {
        console.warn("Failed to load user AI chat history from DB:", err);
      }
    }

    loadDbHistory();
    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated]);

  // Tự động cuộn mượt xuống đáy khung chat mỗi khi có tin nhắn mới
  useEffect(() => {
    const container = chatMessagesRef.current;
    if (!container) return;
    const timer = setTimeout(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth"
      });
    }, 60);
    return () => clearTimeout(timer);
  }, [aiMessages, liveSession?.messages, chatMode, loading]);

  // Kết nối Socket.io & Polling cho phiên Live Chat với Nhân viên Bán hàng
  useEffect(() => {
    if (chatMode !== "human" || !liveSession?.sessionId) return;

    const sessionId = liveSession.sessionId;
    joinRoom("join_chat", sessionId);

    on("chat:new_message", (msg) => {
      setLiveSession((prev) => {
        if (!prev || prev.sessionId !== sessionId) return prev;
        const exists = (prev.messages || []).some((m) => String(m.id) === String(msg.id));
        if (exists) return prev;
        return { ...prev, messages: [...(prev.messages || []), msg] };
      });
    });

    on("chat:session_updated", (updated) => {
      setLiveSession(updated);
    });

    on("chat:session_closed", (closed) => {
      setLiveSession(closed);
      setStatusMessage("Phiên tư vấn trực tiếp với nhân viên đã kết thúc.");
    });

    const pollInterval = setInterval(async () => {
      try {
        const res = await getChatSession(sessionId);
        const data = normalizeApiData(res);
        if (data?.sessionId) {
          setLiveSession(data);
        }
      } catch (_err) {}
    }, 5000);

    return () => {
      leaveRoom("leave_chat", sessionId);
      clearInterval(pollInterval);
    };
  }, [chatMode, liveSession?.sessionId, joinRoom, leaveRoom, on]);

  async function handleStartHumanHandoff() {
    if (handoffLoading) return;
    setHandoffLoading(true);
    setStatusMessage("");
    try {
      const savedSessionId = localStorage.getItem("pcmall_live_chat_session_id");
      const aiHistoryPayload = aiMessages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content
      }));
      let sessionData = null;

      if (savedSessionId) {
        try {
          const existingRes = await getChatSession(savedSessionId);
          const existing = normalizeApiData(existingRes);
          if (existing?.sessionId && !["closed", "resolved"].includes(existing.status)) {
            const handoffRes = await handoffChatSession(savedSessionId, {
              aiHistory: aiHistoryPayload
            });
            sessionData = normalizeApiData(handoffRes);
          }
        } catch (_e) {
          localStorage.removeItem("pcmall_live_chat_session_id");
        }
      }

      if (!sessionData) {
        const createdRes = await createChatSession({
          customerName: user?.fullName || user?.email || "Khách hàng PC Mall",
          conversationType: "SALES_CONSULTATION",
          initialMessage: question.trim() || "Xin chào, tôi cần nhân viên tư vấn trực tiếp về cấu hình PC & sản phẩm.",
          aiHistory: aiHistoryPayload
        });
        sessionData = normalizeApiData(createdRes);
        if (question.trim()) setQuestion("");
      }

      if (sessionData?.sessionId) {
        localStorage.setItem("pcmall_live_chat_session_id", sessionData.sessionId);
        setLiveSession(sessionData);
        setChatMode("human");
      }
    } catch (_err) {
      setStatusMessage("Không thể kết nối hàng đợi nhân viên lúc này. Vui lòng thử lại sau ít giây.");
    } finally {
      setHandoffLoading(false);
    }
  }

  useEffect(() => {
    if (searchParams.get("mode") === "human" && chatMode !== "human") {
      setSearchParams({}, { replace: true });
      handleStartHumanHandoff();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleClearChatHistory() {
    if (chatMode === "human") {
      localStorage.removeItem("pcmall_live_chat_session_id");
      setLiveSession(null);
      setChatMode("ai");
      setStatusMessage("");
      return;
    }
    if (isAuthenticated) {
      try {
        await clearAiChatHistory();
      } catch (err) {
        console.warn("Failed to clear DB AI chat history:", err);
      }
    }
    setAiMessages(clearGuestAiChatMessages());
    setStatusMessage("");
  }

  async function submitQuestion(queryText) {
    const trimmedQuestion = String(queryText || "").trim();
    if (!trimmedQuestion || loading) return;

    if (chatMode === "human" && liveSession?.sessionId) {
      setQuestion("");
      try {
        setLoading(true);
        setStatusMessage("");
        const msgRes = await sendChatMessage(liveSession.sessionId, {
          sender: "customer",
          text: trimmedQuestion
        });
        const newMsg = normalizeApiData(msgRes);
        if (newMsg?.id) {
          setLiveSession((prev) => {
            if (!prev) return prev;
            const exists = (prev.messages || []).some((m) => String(m.id) === String(newMsg.id));
            return exists ? prev : { ...prev, messages: [...(prev.messages || []), newMsg] };
          });
        }
        textareaRef.current?.focus();
      } catch (_err) {
        setStatusMessage("Không gửi được tin nhắn tới nhân viên. Phiên có thể đã đóng.");
        setQuestion(trimmedQuestion);
      } finally {
        setLoading(false);
      }
      return;
    }

    const userMessage = createMessage("user", trimmedQuestion);
    setQuestion("");

    const nextMessages = [...aiMessages, userMessage];
    try {
      setLoading(true);
      setStatusMessage("");
      setAiMessages(nextMessages);

      const response = await sendAiChat({
        message: trimmedQuestion,
        context: {
          recent_messages: nextMessages.slice(-6).map((message) => ({
            role: message.role,
            content: message.content
          }))
        }
      });
      const data = normalizeApiData(response);
      if (data.model) setActiveModel(data.model);
      const reply =
        String(data.reply || "").trim() ||
        "Hiện mình chưa tìm thấy thông tin phù hợp trong danh mục. Bạn có thể hỏi cụ thể hơn về tầm giá hoặc tên linh kiện nhé!";

      setAiMessages((prev) => [
        ...prev,
        createMessage("assistant", reply, {
          products: data.products || [],
          build: data.build || null,
          intent: data.intent || "",
          model: data.model || "",
          ruleName: data.ruleName || "",
          hitType: data.hitType || ""
        })
      ]);
      textareaRef.current?.focus();
    } catch {
      setStatusMessage("Kênh AI đang phản hồi chậm. Bạn vui lòng thử lại sau ít giây.");
      setQuestion(trimmedQuestion);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event?.preventDefault();
    await submitQuestion(question);
  }

  function handleAction(action) {
    if (action.prompt) {
      submitQuestion(action.prompt);
    }
  }

  function handleCompare(product) {
    const compareIds = addStoredCompareId(product.id);
    navigate(buildCompareUrl(compareIds));
  }

  function handleApplyBuildToBuilder(build) {
    const components = getBuildComponents(build);
    if (components.length === 0) return;

    navigate(routeConfig.public.pcBuilder, {
      state: {
        loadBuild: {
          components: components.map((c) => ({
            componentType: c.componentType,
            id: c.productId || c.id,
            productId: c.productId || c.id,
            name: c.name,
            productName: c.name,
            price: c.price,
            skuId: c.skuId,
            imageUrl: c.imageUrl,
            slug: c.slug
          }))
        }
      }
    });
  }

  return (
    <div className="ai-chat-window-frame">
      <style>{aiChatStyles}</style>

      {/* 1. Header Khung Chat: Tiêu đề + Trạng thái AI + Phím tắt thao tác */}
      <header className="ai-window-header">
        <div className="ai-header-left">
          <div className="ai-header-avatar">
            <span className="ai-avatar-icon">{chatMode === "human" ? "🎧" : "🤖"}</span>
            <span className="ai-online-dot" />
          </div>
          <div className="ai-header-meta">
            <div className="ai-title-row">
              <h1 className="ai-title">
                {chatMode === "human" ? "Tư Vấn Trực Tiếp Cùng Nhân Viên Sale" : "Khung Tư Vấn Trợ Lý AI"}
              </h1>
              <span className="ai-pill-status">
                {chatMode === "human"
                  ? liveSession?.staffName
                    ? `● Đang hỗ trợ: ${liveSession.staffName}`
                    : "⏳ Đang chờ nhân viên nhận phiên"
                  : "● Trực Tuyến 24/7"}
              </span>
              <span className="ai-pill-model">
                {chatMode === "human" ? "Live Sales Support" : activeModel}
              </span>
            </div>
            <p className="ai-subtitle">
              {chatMode === "human"
                ? "Trao đổi trực tiếp với Chuyên viên Tư vấn Bán hàng PC Mall theo thời gian thực"
                : "Tư vấn cấu hình phần cứng • Dữ liệu kho & giá thật PC Mall"}
            </p>
          </div>
        </div>

        <div className="ai-header-actions">
          {chatMode === "ai" ? (
            <button
              type="button"
              className="ai-btn-nav ai-btn-nav--builder"
              onClick={handleStartHumanHandoff}
              disabled={handoffLoading}
              title="Chuyển giao ngữ cảnh sang nhắn tin trực tiếp với Nhân viên Bán hàng"
            >
              <span>🎧</span> {handoffLoading ? "Đang kết nối..." : "Gặp Nhân Viên Sale"}
            </button>
          ) : (
            <button
              type="button"
              className="ai-btn-nav ai-btn-nav--builder"
              onClick={() => setChatMode("ai")}
              title="Quay lại khung tư vấn AI"
            >
              <span>🤖</span> Quay lại Chat AI
            </button>
          )}
          <Link to={routeConfig.public.ticketCreate} className="ai-btn-nav" title="Gửi phiếu yêu cầu hỗ trợ kỹ thuật / bảo hành cho Kỹ thuật viên">
            <span>🛠️</span> Hỗ Trợ Kỹ Thuật
          </Link>
          <Link to={routeConfig.public.pcBuilder} className="ai-btn-nav ai-btn-nav--builder" title="Mở không gian lắp ráp">
            <span>🚀</span> PC Builder
          </Link>
          <button type="button" className="ai-btn-nav ai-btn-nav--clear" onClick={handleClearChatHistory} title="Làm mới phiên chat">
            <span>🔄</span> Làm mới
          </button>
        </div>
      </header>

      {/* 2. Thân Khung Chat: Danh sách tin nhắn cuộn nội bộ mượt mà */}
      <main className="ai-window-feed" ref={chatMessagesRef}>
        <div className="ai-feed-inner">
          {chatMode === "human" ? (
            <>
              {(liveSession?.messages || []).map((msg) => {
                const isCustomer = msg.sender === "customer";
                const isSystem = msg.sender === "system";

                if (isSystem) {
                  // Rút gọn tin nhắn briefing hệ thống dài cho khách dễ nhìn
                  const isBriefing = String(msg.text || "").includes("TÓM TẮT NGỮ CẢNH") || String(msg.text || "").length > 260;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: "center",
                        background: "#eff6ff",
                        border: "1px solid #bfdbfe",
                        color: "#1e40af",
                        fontSize: "12px",
                        padding: "8px 14px",
                        borderRadius: "12px",
                        maxWidth: "85%",
                        textAlign: "center"
                      }}
                    >
                      {isBriefing
                        ? "📋 Hệ thống đã tự động chuyển tóm tắt lịch sử tư vấn AI & cấu hình PC của bạn cho Nhân viên Bán hàng."
                        : msg.text}
                    </div>
                  );
                }

                return (
                  <article key={msg.id} className={`ai-msg-row ${isCustomer ? "ai-msg-row--user" : "ai-msg-row--bot"}`}>
                    {!isCustomer ? (
                      <div className="ai-avatar ai-avatar--bot" style={{ background: "linear-gradient(135deg, #059669, #047857)" }}>
                        <span>NV</span>
                      </div>
                    ) : null}

                    <div className="ai-msg-content-shell">
                      <div className="ai-msg-sender-label">
                        {isCustomer ? "Bạn" : liveSession?.staffName || "Nhân viên Tư vấn PC Mall"}
                      </div>
                      <div className="ai-bubble" dangerouslySetInnerHTML={{ __html: renderContent(msg.text) }} />

                      {msg.buildData?.productSuggestion ? (
                        <div
                          style={{
                            marginTop: "8px",
                            padding: "10px 14px",
                            background: "#f8fafc",
                            border: "1px solid #cbd5e1",
                            borderRadius: "12px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "12px"
                          }}
                        >
                          <div>
                            <small style={{ color: "#64748b", display: "block", fontSize: "11px" }}>💡 Sản phẩm đề xuất từ nhân viên</small>
                            <strong style={{ color: "#0f172a", fontSize: "13px" }}>{msg.buildData.productSuggestion.title}</strong>
                          </div>
                          {msg.buildData.productSuggestion.url ? (
                            <a
                              href={msg.buildData.productSuggestion.url}
                              className="ai-btn-nav ai-btn-nav--builder"
                              style={{ textDecoration: "none" }}
                            >
                              Xem ngay →
                            </a>
                          ) : null}
                        </div>
                      ) : null}

                      {msg.buildData?.components ? (
                        <div className="ai-compact-build-card">
                          <div className="ai-build-card-top">
                            <div>
                              <span className="ai-build-badge">🧩 CẤU HÌNH NHÂN VIÊN ĐỀ XUẤT</span>
                              <div className="ai-build-title">Dàn máy được chuyên viên tư vấn thiết kế cho bạn</div>
                            </div>
                          </div>
                          <div className="ai-build-components-list">
                            {getBuildComponents(msg.buildData).map((item) => (
                              <div key={`${item.componentType}-${item.skuId || item.name}`} className="ai-build-component-row">
                                <span className="ai-comp-type-badge">{(item.componentType || "").toUpperCase()}</span>
                                <div className="ai-comp-main-info">
                                  <span className="ai-comp-full-name">{item.name}</span>
                                </div>
                                <span className="ai-comp-row-price">{formatCurrency(item.price)}đ</span>
                              </div>
                            ))}
                          </div>
                          <div className="ai-build-card-bottom">
                            <button
                              type="button"
                              className="ai-btn-apply-builder"
                              onClick={() => handleApplyBuildToBuilder(msg.buildData)}
                            >
                              🚀 Áp Dụng Cấu Hình Này Vào Không Gian Lắp Ráp →
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {isCustomer ? <div className="ai-avatar ai-avatar--user">{customerAvatarLabel}</div> : null}
                  </article>
                );
              })}
            </>
          ) : (
            <>
          {aiMessages.length === 0 ? (
            <div className="ai-empty-hero">
              <div className="ai-hero-badge">⚡ CHUYÊN GIA TƯ VẤN PHẦN CỨNG THỜI GIAN THỰC</div>
              <h2 className="ai-hero-heading">
                Xin chào! Tôi có thể giúp gì cho dàn PC của bạn?
              </h2>
              <p className="ai-hero-sub">
                Đặt câu hỏi về công nghệ vi xử lý, so sánh RAM/VGA hoặc yêu cầu cấu hình tối ưu theo tựa game yêu thích với 100% linh kiện chính hãng sẵn có trong kho PC Mall.
              </p>

              <div className="ai-hero-grid">
                {QUICK_ACTIONS.slice(0, 4).map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="ai-hero-card"
                    onClick={() => handleAction(action)}
                  >
                    <span className="ai-hero-card-icon">{action.icon}</span>
                    <div className="ai-hero-card-body">
                      <strong>{action.label}</strong>
                      <span>{action.prompt}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {aiMessages.map((message) => {
            const isUser = message.role === "user";

            return (
              <article key={message.id} className={`ai-msg-row ${isUser ? "ai-msg-row--user" : "ai-msg-row--bot"}`}>
                {!isUser ? (
                  <div className="ai-avatar ai-avatar--bot">
                    <span>AI</span>
                  </div>
                ) : null}

                <div className="ai-msg-content-shell">
                  <div className="ai-msg-sender-label">
                    {isUser ? "Bạn" : "Trợ lý AI PC Mall"}
                  </div>

                  <div className="ai-bubble" dangerouslySetInnerHTML={{ __html: renderContent(message.content) }} />

                  {/* Thẻ Cấu Hình PC Tương Thích 100% */}
                  {!isUser && message.build ? (
                    <div className="ai-compact-build-card">
                      <div className="ai-build-card-top">
                        <div>
                          <span className="ai-build-badge">🧩 CẤU HÌNH ĐỀ XUẤT TỐI ƯU</span>
                          <div className="ai-build-title">Dàn máy chuẩn 100% tương thích phần cứng</div>
                        </div>
                        <div className="ai-build-total">
                          <small>Tổng chi phí dự kiến</small>
                          <strong>{formatCurrency(message.build.totalPrice)}đ</strong>
                        </div>
                      </div>

                      <div className="ai-build-components-list">
                        {getBuildComponents(message.build).map((item) => {
                          const typeLabel = (item.componentLabel || item.componentType || "").toUpperCase();
                          return (
                            <div key={`${item.componentType}-${item.skuId || item.name}`} className="ai-build-component-row">
                              <span className="ai-comp-type-badge">{typeLabel}</span>
                              <div className="ai-comp-main-info">
                                <span className="ai-comp-full-name">{item.name}</span>
                              </div>
                              <span className="ai-comp-row-price">{formatCurrency(item.price)}đ</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="ai-build-card-bottom">
                        <button
                          type="button"
                          className="ai-btn-apply-builder"
                          onClick={() => handleApplyBuildToBuilder(message.build)}
                        >
                          🚀 Áp Dụng Cấu Hình Này Vào Không Gian Lắp Ráp →
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Thẻ Sản Phẩm Thực Tế Tại Cửa Hàng - CHỈ HIỂN THỊ KHI KHÔNG PHẢI BUILD PC */}
                  {!isUser && !message.build && (message.products || []).length > 0 ? (
                    <div className="ai-product-grid">
                      {message.products.map((product) => (
                        <article className="ai-product-card" key={`${product.id}-${product.skuId || product.sku}`}>
                          <div className="ai-product-card__image">
                            <img src={resolveProductImage(product)} alt={product.name} loading="lazy" />
                            <span>Còn {product.stock}</span>
                          </div>
                          <div className="ai-product-card__body">
                            <small>{product.brandName || product.categoryName || "PC Mall"}</small>
                            <strong>{product.name}</strong>
                            <span>{formatCurrency(product.price)}đ</span>
                            <div className="ai-product-actions">
                              <Link to={routeConfig.public.productDetail.replace(":idOrSlug", String(product.slug || product.id))}>Chi tiết</Link>
                              <button type="button" onClick={() => handleCompare(product)}>So sánh</button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}

                  {/* AI Response Feedback Thumb Buttons */}
                  {!isUser && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", fontSize: "11px", color: "#64748b" }}>
                      <span>Tư vấn có hữu ích?</span>
                      {feedbackMap[message.id] ? (
                        <span style={{ color: "#059669", fontWeight: "700" }}>
                          {feedbackMap[message.id] === 1 ? "👍 Cảm ơn bạn đã hài lòng!" : "👎 Đã ghi nhận góp ý của bạn!"}
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleFeedback(message.id, 1, message.content)}
                            title="Hữu ích"
                            style={{
                              background: "none",
                              border: "1px solid #e2e8f0",
                              borderRadius: "6px",
                              padding: "2px 6px",
                              cursor: "pointer",
                              fontSize: "12px",
                              transition: "all 0.2s"
                            }}
                          >
                            👍
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFeedback(message.id, -1, message.content)}
                            title="Chưa hài lòng"
                            style={{
                              background: "none",
                              border: "1px solid #e2e8f0",
                              borderRadius: "6px",
                              padding: "2px 6px",
                              cursor: "pointer",
                              fontSize: "12px",
                              transition: "all 0.2s"
                            }}
                          >
                            👎
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {isUser ? <div className="ai-avatar ai-avatar--user">{customerAvatarLabel}</div> : null}
              </article>
            );
          })}
            </>
          )}

          {loading ? (
            <article className="ai-msg-row ai-msg-row--bot">
              <div className="ai-avatar ai-avatar--bot">AI</div>
              <div className="ai-msg-content-shell">
                <div className="ai-typing">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </article>
          ) : null}

          {statusMessage ? <div className="ai-status-message">{statusMessage}</div> : null}
        </div>
      </main>

      {/* 3. Khung Soạn Thảo Tin Nhắn Nằm Gọn Bên Trong Khung Chat */}
      <footer className="ai-window-composer">
        {/* Dải Gợi Ý Câu Hỏi Nhanh (Pills) */}
        <div className="ai-composer-quick-strip">
          <span className="ai-strip-label">💡 Gợi ý:</span>
          <div className="ai-strip-scroll">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                className="ai-strip-pill"
                onClick={() => handleAction(action)}
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Khung Nhập Liệu Dạng Capsule Thanh Lịch */}
        <form className="ai-composer-capsule" onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value);
              setStatusMessage("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (canSend) handleSubmit(event);
              }
            }}
            rows={1}
            placeholder="Nhập yêu cầu: 'Nên chọn RAM DDR4 hay DDR5?', 'Build PC Dota 2 khoảng 15 triệu'..."
          />
          <button type="submit" disabled={!canSend} aria-label="Gửi tin nhắn" className="ai-btn-send">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>

        <div className="ai-composer-foot-hints">
          <span>Nhấn <strong>Enter</strong> để gửi • <strong>Shift + Enter</strong> xuống dòng</span>
          <span>⚡ Kết nối trực tiếp kho hàng thực tế PC Mall</span>
        </div>
      </footer>
    </div>
  );
}

const aiChatStyles = `
/* ═══════════════════════════════════════════════════════════════════
   KHUNG CHAT CHUYÊN NGHIỆP — DEDICATED DESKTOP CHAT WINDOW FRAME
   ═══════════════════════════════════════════════════════════════════ */
.ai-chat-window-frame {
  width: 100%;
  height: 100%;
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 16px 40px -12px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.03);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* 1. HEADER KHUNG CHAT */
.ai-window-header {
  flex-shrink: 0;
  background: #ffffff;
  border-bottom: 1px solid #f1f5f9;
  padding: 14px 22px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10;
}

.ai-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-header-avatar {
  position: relative;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.22);
}

.ai-avatar-icon {
  font-size: 22px;
}

.ai-online-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #10b981;
  border: 2px solid #ffffff;
}

.ai-header-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ai-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ai-title {
  margin: 0;
  font-size: 16.5px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.ai-pill-status {
  font-size: 10.5px;
  font-weight: 700;
  color: #059669;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  padding: 2px 7px;
  border-radius: 10px;
}

.ai-pill-model {
  font-size: 10.5px;
  font-weight: 700;
  color: #2563eb;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  padding: 2px 7px;
  border-radius: 10px;
}

.ai-subtitle {
  margin: 0;
  font-size: 11.5px;
  color: #64748b;
}

.ai-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-btn-nav {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  font-size: 12.5px;
  font-weight: 600;
  border-radius: 9px;
  text-decoration: none;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ai-btn-nav:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.ai-btn-nav--builder {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
  font-weight: 700;
}

.ai-btn-nav--builder:hover {
  background: #dbeafe;
}

.ai-btn-nav--clear {
  color: #64748b;
}

/* 2. KHUNG NỘI DUNG TIN NHẮN (FEED CHAT) */
.ai-window-feed {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px 24px;
  background: #fbfcfd;
  scroll-behavior: smooth;
}

/* Scrollbar tinh tế */
.ai-window-feed::-webkit-scrollbar {
  width: 6px;
}
.ai-window-feed::-webkit-scrollbar-track {
  background: transparent;
}
.ai-window-feed::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
.ai-window-feed::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.ai-feed-inner {
  max-width: 840px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* EMPTY HERO TRẠNG THÁI CHƯA CÓ TIN NHẮN */
.ai-empty-hero {
  padding: 30px 20px 20px;
  text-align: center;
}

.ai-hero-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 800;
  color: #2563eb;
  background: #eff6ff;
  border: 1px solid #dbeafe;
  padding: 4px 12px;
  border-radius: 20px;
  letter-spacing: 0.04em;
  margin-bottom: 12px;
}

.ai-hero-heading {
  margin: 0 0 8px;
  font-size: 21px;
  font-weight: 800;
  color: #0f172a;
}

.ai-hero-sub {
  margin: 0 auto 24px;
  max-width: 640px;
  font-size: 13.5px;
  line-height: 1.6;
  color: #64748b;
}

.ai-hero-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  max-width: 720px;
  margin: 0 auto;
}

.ai-hero-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.ai-hero-card:hover {
  background: #eff6ff;
  border-color: #93c5fd;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
}

.ai-hero-card-icon {
  font-size: 22px;
  flex-shrink: 0;
}

.ai-hero-card-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.ai-hero-card-body strong {
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
}

.ai-hero-card-body span {
  font-size: 11px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* HÀNG TIN NHẮN (MESSAGE ROWS) */
.ai-msg-row {
  display: flex;
  gap: 12px;
  width: 100%;
}

.ai-msg-row--user {
  justify-content: flex-end;
}

.ai-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 12px;
  flex-shrink: 0;
}

.ai-avatar--bot {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
}

.ai-avatar--user {
  background: #334155;
  color: #ffffff;
}

.ai-msg-content-shell {
  display: flex;
  flex-direction: column;
  max-width: 90%;
  min-width: 0;
}

.ai-msg-row--user .ai-msg-content-shell {
  align-items: flex-end;
}

.ai-msg-sender-label {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  margin-bottom: 4px;
  padding: 0 4px;
}

.ai-bubble {
  padding: 13px 18px;
  border-radius: 16px;
  font-size: 13.5px;
  line-height: 1.6;
  word-break: break-word;
}

.ai-msg-row--bot .ai-bubble {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #1e293b;
  border-top-left-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.ai-msg-row--user .ai-bubble {
  background: #2563eb;
  color: #ffffff;
  border-top-right-radius: 4px;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
}

/* THẺ CẤU HÌNH GỌN GÀNG */
.ai-compact-build-card {
  margin-top: 10px;
  background: #ffffff;
  border: 2px solid #bfdbfe;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.08);
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.ai-build-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #eff6ff;
  padding: 12px 16px;
  border-bottom: 1px solid #dbeafe;
}

.ai-build-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 800;
  color: #1d4ed8;
  letter-spacing: 0.05em;
}

.ai-build-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #0f172a;
}

.ai-build-total {
  text-align: right;
}

.ai-build-total small {
  display: block;
  font-size: 10.5px;
  color: #64748b;
}

.ai-build-total strong {
  font-size: 17px;
  color: #dc2626;
  font-weight: 800;
}

.ai-build-components-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 16px;
  background: #ffffff;
}

.ai-build-component-row {
  display: grid;
  grid-template-columns: 85px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.ai-build-component-row:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.ai-comp-type-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 6px;
  font-size: 10px;
  font-weight: 800;
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  text-align: center;
}

.ai-comp-main-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ai-comp-full-name {
  font-size: 12.5px;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.4;
  word-break: break-word;
}

.ai-comp-row-price {
  font-size: 13px;
  font-weight: 700;
  color: #2563eb;
  white-space: nowrap;
  text-align: right;
}

.ai-build-card-bottom {
  padding: 10px 16px;
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
}

.ai-btn-apply-builder {
  width: 100%;
  padding: 11px 16px;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #ffffff;
  border: none;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.22);
}

.ai-btn-apply-builder:hover {
  background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);
}

/* THẺ SẢN PHẨM */
.ai-product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.ai-product-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.ai-product-card__image {
  position: relative;
  height: 100px;
  background: #f8fafc;
}

.ai-product-card__image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.ai-product-card__image span {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(15, 23, 42, 0.75);
  color: #fff;
  font-size: 9px;
  padding: 2px 5px;
  border-radius: 4px;
}

.ai-product-card__body {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.ai-product-card__body small {
  font-size: 9.5px;
  color: #64748b;
}

.ai-product-card__body strong {
  font-size: 11.5px;
  color: #0f172a;
  line-height: 1.3;
  margin: 3px 0 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ai-product-card__body > span {
  font-size: 12px;
  font-weight: 800;
  color: #dc2626;
  margin-top: auto;
}

.ai-product-actions {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}

.ai-product-actions a,
.ai-product-actions button {
  flex: 1;
  text-align: center;
  padding: 5px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 6px;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #334155;
}

.ai-product-actions a:hover,
.ai-product-actions button:hover {
  background: #f1f5f9;
}

/* TYPING INDICATOR */
.ai-typing {
  display: inline-flex;
  gap: 5px;
  padding: 12px 16px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  border-top-left-radius: 4px;
}

.ai-typing span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #2563eb;
  animation: aiDotBounce 1.4s infinite ease-in-out both;
}

.ai-typing span:nth-child(1) { animation-delay: -0.32s; }
.ai-typing span:nth-child(2) { animation-delay: -0.16s; }
.ai-typing span:nth-child(3) { animation-delay: 0s; }
.ai-typing span:nth-child(4) { animation-delay: 0.16s; }

@keyframes aiDotBounce {
  0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
  40% { transform: scale(1); opacity: 1; }
}

.ai-status-message {
  padding: 8px 14px;
  border-radius: 8px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  font-size: 12px;
  text-align: center;
}

/* 3. KHUNG SOẠN THẢO TIN NHẮN (NẰM TRONG KHUNG CHAT, KHÔNG BỊ ÁP CỨNG ĐÁY MÀN HÌNH) */
.ai-window-composer {
  flex-shrink: 0;
  background: #ffffff;
  border-top: 1px solid #f1f5f9;
  padding: 12px 20px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 20;
}

/* DẢI GỢI Ý NHANH NGAY TRÊN Ô NHẬP */
.ai-composer-quick-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.ai-strip-label {
  font-size: 11px;
  font-weight: 800;
  color: #64748b;
  flex-shrink: 0;
}

.ai-strip-scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 2px;
}

.ai-strip-scroll::-webkit-scrollbar {
  display: none;
}

.ai-strip-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  font-size: 11.5px;
  font-weight: 600;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  color: #334155;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.ai-strip-pill:hover {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #1d4ed8;
  transform: translateY(-1px);
}

/* KHUNG NHẬP LIỆU DẠNG CAPSULE */
.ai-composer-capsule {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 14px;
  padding: 6px 10px 6px 14px;
  transition: all 0.2s ease;
}

.ai-composer-capsule:focus-within {
  background: #ffffff;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.ai-composer-capsule textarea {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-family: inherit;
  font-size: 13.5px;
  color: #0f172a;
  resize: none;
  line-height: 1.45;
  max-height: 80px;
  padding: 4px 0;
}

.ai-composer-capsule textarea::placeholder {
  color: #94a3b8;
}

.ai-btn-send {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: none;
  background: #2563eb;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
}

.ai-btn-send:hover:not(:disabled) {
  background: #1d4ed8;
  transform: scale(1.04);
}

.ai-btn-send:disabled {
  background: #e2e8f0;
  color: #94a3b8;
  cursor: not-allowed;
  box-shadow: none;
}

/* HINTS PHÍA DƯỚI */
.ai-composer-foot-hints {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #94a3b8;
  padding: 0 4px;
}

.ai-composer-foot-hints strong {
  color: #64748b;
}

@media (max-width: 768px) {
  .ai-window-header {
    padding: 10px 14px;
  }
  .ai-header-actions {
    display: none;
  }
  .ai-window-feed {
    padding: 14px 12px;
  }
  .ai-hero-grid {
    grid-template-columns: 1fr;
  }
  .ai-msg-content-shell {
    max-width: 96%;
  }
  .ai-build-component-row {
    grid-template-columns: 72px minmax(0, 1fr) auto;
    gap: 8px;
    padding: 6px 8px;
  }
  .ai-comp-full-name {
    font-size: 11.5px;
  }
  .ai-comp-row-price {
    font-size: 12px;
  }
  .ai-composer-foot-hints {
    display: none;
  }
}
`;
