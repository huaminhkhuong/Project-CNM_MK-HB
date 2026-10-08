import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { clearAiChatHistory, getAiChatHistory, sendAiChat } from "../../services/ai.service";
import { addItemToCart } from "../../services/cart.service";
import { createChatSession, getChatSession, sendChatMessage } from "../../services/chat.service";
import { useAuth } from "../../hooks/useAuth";
import { routeConfig } from "../../routes/routeConfig";
import { addStoredCompareId, buildCompareUrl } from "../../utils/compare";
import { resolveProductImage } from "../../utils/productImage";
import {
  clearGuestAiChatMessages,
  getGuestAiChatMessages,
  setGuestAiChatMessages
} from "../../utils/guestStorage";

const LIVE_SESSION_KEY = "pcmall_sales_consultation_session";
const AI_HISTORY_KEY_VERSION = "pcmall_ai_chat_utf8_v2";

const QUICK_ACTIONS = [
  { label: "Build PC theo ngân sách", prompt: "Build PC 15 triệu chơi game", icon: "🧩" },
  { label: "Tư vấn laptop học tập", prompt: "Laptop học tập dưới 15 triệu", icon: "💻" },
  { label: "So sánh linh kiện", prompt: "So sánh RTX 4060 và RTX 4070", icon: "⚖️" },
  { label: "Kiểm tra tương thích", prompt: "Kiểm tra tương thích CPU, mainboard, RAM và PSU cho cấu hình gaming", icon: "✅" },
  { label: "Hỏi bảo hành", prompt: "Chính sách bảo hành PC Mall như thế nào?", icon: "🛡️" },
  { label: "Gặp nhân viên bán hàng", prompt: "", icon: "🎧", live: true }
];

const STATUS_META = {
  ai: { label: "AI đang tư vấn", detail: "Phản hồi tự động dựa trên dữ liệu PC Mall" },
  waiting_staff: { label: "Đã gửi yêu cầu cho nhân viên", detail: "Nhân viên bán hàng sẽ phản hồi sớm nhất" },
  open: { label: "Đã gửi yêu cầu cho nhân viên", detail: "Nhân viên bán hàng sẽ phản hồi sớm nhất" },
  assigned: { label: "Nhân viên đang phản hồi", detail: "Bạn đang chat trực tiếp với nhân viên bán hàng" },
  waiting_customer: { label: "Nhân viên đang chờ bạn", detail: "Bạn có thể phản hồi ngay trong khung chat" },
  resolved: { label: "Đã giải quyết", detail: "Phiên tư vấn đã kết thúc" }
};

function createMessage(role, content, metadata = {}) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content: content || "",
    products: metadata.products || [],
    build: metadata.build || null,
    intent: metadata.intent || "",
    handoffSuggested: Boolean(metadata.handoffSuggested),
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

function getSessionStatus(session) {
  if (!session) return STATUS_META.ai;
  return STATUS_META[session.status] || STATUS_META.waiting_staff;
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
      brandName: product?.brandName || item?.brandName || "",
      categoryName: product?.categoryName || item?.categoryName || ""
    };
  });
}

function mapLiveMessages(session) {
  return (session?.messages || []).map((message) => ({
    id: message.id,
    role: message.sender === "customer" ? "user" : message.sender === "system" ? "system" : "staff",
    content: message.text,
    products: [],
    build: message.buildData || null,
    createdAt: message.timestamp
  }));
}

export function AiChatPage() {
  const navigate = useNavigate();
  const { isAuthenticated, authState } = useAuth();
  const textareaRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const shouldStickToBottomRef = useRef(false);
  const didMountRef = useRef(false);
  const [mode, setMode] = useState("ai");
  const [aiMessages, setAiMessages] = useState(() => {
    if (localStorage.getItem(AI_HISTORY_KEY_VERSION) !== "1") {
      clearGuestAiChatMessages();
      localStorage.setItem(AI_HISTORY_KEY_VERSION, "1");
    }
    return getGuestAiChatMessages();
  });
  const [humanMessages, setHumanMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [liveSessionId, setLiveSessionId] = useState(() => localStorage.getItem(LIVE_SESSION_KEY) || "");
  const [liveSession, setLiveSession] = useState(null);
  const [actionProductId, setActionProductId] = useState(null);
  const [loadingBuildCart, setLoadingBuildCart] = useState(false);

  const canSend = useMemo(() => String(question || "").trim().length > 0 && !loading, [loading, question]);
  const isHumanMode = mode === "human";
  const visibleMessages = isHumanMode ? humanMessages : aiMessages;
  const chatStatus = isHumanMode ? getSessionStatus(liveSession) : STATUS_META.ai;
  const isGuestUser = !isAuthenticated;
  const customerName = authState?.user?.fullName || authState?.user?.email || "Khách vãng lai";
  const customerAvatarLabel = isGuestUser ? "KH" : getAvatarLabel(authState?.user, "KH");

  useEffect(() => {
    setGuestAiChatMessages(aiMessages);
  }, [aiMessages]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let isCancelled = false;

    async function loadDbHistory() {
      try {
        const response = await getAiChatHistory(30);
        const data = normalizeApiData(response);
        const dbMsgs = Array.isArray(data?.messages) ? data.messages : [];
        if (!isCancelled && dbMsgs.length > 0) {
          const mapped = dbMsgs.map((m) => ({
            id: m.id || `${m.role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role: m.role,
            content: m.content,
            products: m.products || [],
            build: m.build || null,
            intent: m.intent || "",
            handoffSuggested: Boolean(m.handoffSuggested),
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

  useEffect(() => {
    if (!liveSessionId) {
      localStorage.removeItem(LIVE_SESSION_KEY);
      setLiveSession(null);
      return undefined;
    }

    localStorage.setItem(LIVE_SESSION_KEY, liveSessionId);

    async function poll() {
      try {
        const response = await getChatSession(liveSessionId);
        const session = normalizeApiData(response);
        setLiveSession(session);
        setHumanMessages(mapLiveMessages(session));
      } catch {
        setStatusMessage("Chưa đồng bộ được phiên tư vấn. Tin nhắn của bạn vẫn được giữ trên trình duyệt.");
      }
    }

    poll();
    const intervalId = setInterval(poll, 3000);
    return () => clearInterval(intervalId);
  }, [liveSessionId]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    if (!shouldStickToBottomRef.current) return;
    const container = chatMessagesRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth"
    });
    shouldStickToBottomRef.current = false;
  }, [visibleMessages, loading, statusMessage]);

  function markChatAutoScroll() {
    const container = chatMessagesRef.current;
    if (!container) {
      shouldStickToBottomRef.current = true;
      return;
    }

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 120;
  }

  async function handleClearChatHistory() {
    if (!confirm("Xóa lịch sử AI chat trên trình duyệt và rời phiên tư vấn hiện tại?")) return;
    if (isAuthenticated) {
      try {
        await clearAiChatHistory();
      } catch (err) {
        console.warn("Failed to clear DB AI chat history:", err);
      }
    }
    setAiMessages(clearGuestAiChatMessages());
    setHumanMessages([]);
    setLiveSessionId("");
    setLiveSession(null);
    setMode("ai");
    setStatusMessage("");
    shouldStickToBottomRef.current = false;
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setStatusMessage("");
    shouldStickToBottomRef.current = false;
    textareaRef.current?.focus();
  }

  async function handleStartLiveChat(initialMessage = "") {
    try {
      markChatAutoScroll();
      setLoading(true);
      setStatusMessage("");
      const response = await createChatSession({
        customerName,
        initialMessage,
        conversationType: "SALES_CONSULTATION"
      });
      const session = normalizeApiData(response);
      if (session?.sessionId) {
        setLiveSessionId(session.sessionId);
        setLiveSession(session);
        setHumanMessages(mapLiveMessages(session));
        setMode("human");
        setStatusMessage("Yêu cầu tư vấn đã được gửi. Nhân viên bán hàng sẽ phản hồi sớm nhất.");
      }
    } catch {
      setStatusMessage("Yêu cầu tư vấn đã được gửi. Nhân viên bán hàng sẽ phản hồi sớm nhất.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStartNewLiveChat(initialMessage = "") {
    setLiveSessionId("");
    setLiveSession(null);
    setHumanMessages([]);
    await handleStartLiveChat(initialMessage);
  }

  function openOrStartLiveChat(initialMessage = "") {
    const isResolvedSession = String(liveSession?.status || "").toLowerCase() === "resolved";
    if (isResolvedSession) {
      handleStartNewLiveChat(initialMessage);
      return;
    }
    if (liveSessionId) {
      switchMode("human");
      return;
    }
    handleStartLiveChat(initialMessage);
  }

  async function handleSubmit(event) {
    event?.preventDefault();
    const trimmedQuestion = String(question || "").trim();
    if (!trimmedQuestion || loading) return;

    const userMessage = createMessage("user", trimmedQuestion);
    setQuestion("");
    markChatAutoScroll();

    if (isHumanMode && liveSessionId) {
      if (String(liveSession?.status || "").toLowerCase() === "resolved") {
        await handleStartNewLiveChat(trimmedQuestion);
        textareaRef.current?.focus();
        return;
      }
      try {
        setHumanMessages((prev) => [...prev, userMessage]);
        await sendChatMessage(liveSessionId, {
          sender: "customer",
          text: trimmedQuestion
        });
        textareaRef.current?.focus();
      } catch {
        setStatusMessage("Tin nhắn chưa gửi được. Bạn thử lại sau ít phút.");
      }
      return;
    }

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
      const reply =
        String(data.reply || "").trim() ||
        "Hiện hệ thống chưa có thông tin phù hợp. Mình có thể chuyển yêu cầu này cho nhân viên bán hàng để hỗ trợ kỹ hơn.";
      const handoffSuggested =
        ["unknown"].includes(String(data.intent || "")) ||
        /nhan vien|nhân viên|chua xac dinh|chưa xác định|chua co san pham|chưa có sản phẩm/i.test(reply);

      setAiMessages((prev) => [
        ...prev,
        createMessage("assistant", reply, {
          products: data.products || [],
          build: data.build || null,
          intent: data.intent || "",
          handoffSuggested
        })
      ]);
      textareaRef.current?.focus();
    } catch {
      setStatusMessage("AI đang phản hồi chậm. Bạn có thể thử lại hoặc gửi yêu cầu cho nhân viên bán hàng.");
      setQuestion(trimmedQuestion);
    } finally {
      setLoading(false);
    }
  }

  function handleAction(action) {
    if (action.live) {
      openOrStartLiveChat(question);
      return;
    }
    setMode("ai");
    setQuestion(action.prompt);
    textareaRef.current?.focus();
  }

  async function handleAddToCart(product) {
    if (!isAuthenticated) {
      navigate(routeConfig.public.login);
      return;
    }
    try {
      setActionProductId(product.id);
      await addItemToCart({ productId: product.id, quantity: 1 });
      setStatusMessage("Đã thêm sản phẩm vào giỏ hàng.");
    } catch {
      setStatusMessage("Chưa thể thêm sản phẩm vào giỏ hàng. Bạn thử lại sau.");
    } finally {
      setActionProductId(null);
    }
  }

  function handleCompare(product) {
    const compareIds = addStoredCompareId(product.id);
    navigate(buildCompareUrl(compareIds));
  }

  function handlePcBuilder(product) {
    navigate(routeConfig.public.pcBuilder, {
      state: {
        loadItem: {
          id: product.id || product.productId,
          productId: product.id || product.productId,
          name: product.name || product.productName,
          productName: product.name || product.productName,
          skuId: product.skuId || product.id,
          price: product.price,
          componentType: product.componentType || (product.categoryName || "").toLowerCase(),
          categoryName: product.categoryName,
          brandName: product.brandName,
          imageUrl: product.imageUrl,
          slug: product.slug
        }
      }
    });
  }

  function handleLoadBuildToBuilder(build) {
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

  async function handleAddToCartFullBuild(build) {
    if (!isAuthenticated) {
      navigate(routeConfig.public.login);
      return;
    }
    const components = getBuildComponents(build);
    if (components.length === 0) {
      setStatusMessage("Không tìm thấy linh kiện trong cấu hình để thêm vào giỏ hàng.");
      return;
    }

    setLoadingBuildCart(true);
    setStatusMessage(`Đang thêm ${components.length} linh kiện vào giỏ hàng...`);

    let successCount = 0;
    let failCount = 0;

    for (const item of components) {
      try {
        const pId = item.productId || item.id;
        const vId = item.skuId && item.skuId !== pId ? item.skuId : undefined;
        await addItemToCart({
          productId: pId,
          variantId: vId,
          quantity: 1
        });
        successCount++;
      } catch (err) {
        failCount++;
      }
    }

    setLoadingBuildCart(false);
    if (successCount > 0) {
      setStatusMessage(`Đã thêm thành công cả dàn PC (${successCount}/${components.length} linh kiện) vào giỏ hàng!`);
    } else {
      setStatusMessage("Không thể thêm linh kiện vào giỏ hàng. Bạn vui lòng thử lại sau.");
    }
  }

  return (
    <div className="ai-advisor-page">
      <style>{aiChatStyles}</style>

      <section className="ai-consult-hero">
        <div>
          <span>AI + Sales Consultation</span>
          <h1>AI Tư Vấn PC Mall</h1>
          <p>Tư vấn build PC, laptop, linh kiện, kiểm tra tương thích, bảo hành và thanh toán. Khi cần hỗ trợ sâu hơn, bạn có thể chuyển tiếp cho nhân viên bán hàng ngay trong cùng luồng chat.</p>
        </div>
        <div className="ai-status-card">
          <strong>{chatStatus.label}</strong>
          <small>{chatStatus.detail}</small>
          {liveSession?.staffName ? <em>Phụ trách: {liveSession.staffName}</em> : <em>PC Mall Sales Center</em>}
        </div>
      </section>

      <section className="ai-action-bar" aria-label="Tác vụ tư vấn nhanh">
        {QUICK_ACTIONS.map((action) => (
          <button key={action.label} type="button" className={action.live ? "ai-action ai-action--live" : "ai-action"} onClick={() => handleAction(action)}>
            <span>{action.icon}</span>
            {action.label}
          </button>
        ))}
      </section>

      <section className="ai-consult-shell">
        <aside className="ai-consult-sidebar">
          <div className="ai-mode-card">
            <span>Chế độ hội thoại</span>
            <strong>{isHumanMode ? "Sales consultation" : "AI chat"}</strong>
            <p>{isHumanMode ? "Tin nhắn đang được lưu vào phiên tư vấn để nhân viên bán hàng theo dõi." : "AI phản hồi nhanh theo intent và dữ liệu sản phẩm thật trong database."}</p>
          </div>
          <div className="ai-mode-list">
            <button type="button" className={!isHumanMode ? "is-active" : ""} onClick={() => switchMode("ai")}>
              <span>AI</span>
              <strong>AI chat</strong>
              <small>Tư vấn nhanh, không bịa sản phẩm.</small>
            </button>
            <button type="button" className={isHumanMode ? "is-active" : ""} onClick={() => openOrStartLiveChat(question)}>
              <span>Sales</span>
              <strong>Human support</strong>
              <small>Nhân viên bán hàng phản hồi trực tiếp.</small>
            </button>
          </div>
            <button type="button" className="ai-live-button" onClick={() => openOrStartLiveChat(question)} disabled={loading}>
            {String(liveSession?.status || "").toLowerCase() === "resolved" ? "Tạo phiên tư vấn mới" : liveSessionId ? "Mở Human support" : "Kết nối nhân viên bán hàng"}
          </button>
          <button type="button" className="ai-clear-button" onClick={handleClearChatHistory}>
            Xóa lịch sử chat
          </button>
        </aside>

        <main className="ai-chat-panel">
          <div className="ai-chat-head">
            <div>
              <strong>{isHumanMode ? "Tư vấn với nhân viên bán hàng" : "Trung tâm tư vấn thông minh"}</strong>
              <span>{isHumanMode ? `Mã phiên ${liveSessionId.slice(0, 8)}...` : "AI phân loại intent trước khi tìm sản phẩm"}</span>
            </div>
            <div className="ai-chat-head-actions">
              {isHumanMode ? (
                <button type="button" className="ai-back-ai-button" onClick={() => switchMode("ai")}>
                  Quay lại AI
                </button>
              ) : null}
              <span className={`ai-status-pill ai-status-pill--${isHumanMode ? "human" : "ai"}`}>{chatStatus.label}</span>
            </div>
          </div>

          <div className="ai-chat-messages" ref={chatMessagesRef}>
            {visibleMessages.length === 0 ? (
              <div className="ai-empty-state">
                <div>{isHumanMode ? "NV" : "AI"}</div>
                <h2>Bắt đầu bằng nhu cầu của bạn</h2>
                <p>Nhập ngân sách, mục đích sử dụng hoặc chọn một quick action phía trên để AI tư vấn. Nếu cần chốt cấu hình, hãy kết nối nhân viên bán hàng.</p>
              </div>
            ) : null}

            {visibleMessages.map((message) => {
              const isUser = message.role === "user";
              const isSystem = message.role === "system";
              const isStaff = message.role === "staff";

              if (isSystem) {
                return <div key={message.id} className="ai-system-message">{message.content}</div>;
              }

              return (
                <article key={message.id} className={`ai-message ${isUser ? "ai-message--user" : ""}`}>
                  {!isUser ? <div className={`ai-avatar ${isStaff ? "ai-avatar--staff" : ""}`}>{isStaff ? "NV" : "AI"}</div> : null}
                  <div className="ai-message__content">
                    <div className="ai-message-meta">{isUser ? "Bạn" : isStaff ? "Nhân viên bán hàng" : "AI PC Mall"}</div>
                    <div className="ai-bubble" dangerouslySetInnerHTML={{ __html: renderContent(message.content) }} />

                    {!isUser && message.handoffSuggested ? (
                      <button type="button" className="ai-inline-handoff" onClick={() => openOrStartLiveChat(question)}>
                        Kết nối nhân viên bán hàng
                      </button>
                    ) : null}

                    {!isUser && message.build ? (
                      <div className="ai-build-card">
                        <div className="ai-card-head">
                          <strong>Cấu hình đề xuất (Chuẩn 100% Tương thích)</strong>
                          <span>{formatCurrency(message.build.totalPrice)}đ</span>
                        </div>
                        <div className="ai-build-list">
                          {getBuildComponents(message.build).map((item) => (
                            <div key={`${item.componentType}-${item.skuId || item.name}`} className="ai-build-item-row">
                              <span className="ai-build-slot">{String(item.componentType || "").toUpperCase()}</span>
                              <strong className="ai-build-pname" title={item.name}>{item.name}</strong>
                              <small className="ai-build-price">{formatCurrency(item.price)}đ{item.stock !== "" ? ` · còn ${item.stock}` : ""}</small>
                              <button
                                type="button"
                                className="ai-build-item-pick"
                                title="Nạp linh kiện này vào Workspace Builder"
                                onClick={() => handlePcBuilder(item)}
                              >
                                + Chọn
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="ai-build-actions">
                          <button
                            type="button"
                            className="ai-btn-builder"
                            onClick={() => handleLoadBuildToBuilder(message.build)}
                          >
                            🧩 Nạp Dàn PC vào Builder
                          </button>
                          <button
                            type="button"
                            className="ai-btn-cart"
                            disabled={loadingBuildCart}
                            onClick={() => handleAddToCartFullBuild(message.build)}
                          >
                            {loadingBuildCart ? "Đang thêm..." : "🛒 Thêm cả dàn vào Giỏ"}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {!isUser && (message.products || []).length > 0 ? (
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
                                <button type="button" disabled={actionProductId === product.id} onClick={() => handleAddToCart(product)}>
                                  {actionProductId === product.id ? "Đang thêm..." : "Thêm giỏ"}
                                </button>
                                <button type="button" onClick={() => handleCompare(product)}>So sánh</button>
                                <button type="button" onClick={() => handlePcBuilder(product)}>+ Chọn vào Builder</button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {isUser ? <div className="ai-avatar ai-avatar--user">{customerAvatarLabel}</div> : null}
                </article>
              );
            })}

            {loading ? (
              <article className="ai-message">
                <div className="ai-avatar">AI</div>
                <div className="ai-typing"><span /><span /><span /></div>
              </article>
            ) : null}

            {statusMessage ? <div className="ai-status-message">{statusMessage}</div> : null}
          </div>

          <form className="ai-composer" onSubmit={handleSubmit}>
            {isHumanMode && String(liveSession?.status || "").toLowerCase() === "resolved" ? (
              <div className="ai-resolved-session-notice">
                Phiên tư vấn này đã kết thúc. Nếu bạn gửi tin nhắn mới, PC Mall sẽ mở một phiên tư vấn mới cho bạn.
              </div>
            ) : null}
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
              rows={2}
              placeholder={isHumanMode ? "Nhập tin nhắn cho nhân viên bán hàng..." : "Hỏi AI về build PC, laptop, linh kiện..."}
            />
            <button type="submit" disabled={!canSend} aria-label="Gửi tin nhắn">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            </button>
          </form>
        </main>
      </section>
    </div>
  );
}

const aiChatStyles = `
.ai-advisor-page {
  display: grid;
  gap: 18px;
  min-height: calc(100vh - 140px);
  padding: 24px 0 0;
}

.ai-consult-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 22px;
  align-items: end;
  padding: 30px;
  border-radius: 24px;
  color: #fff;
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.42), transparent 34%),
    linear-gradient(135deg, #07111f 0%, #0f2b57 48%, #2563eb 100%);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.2);
}

.ai-consult-hero span {
  color: #bfdbfe;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ai-consult-hero h1 {
  margin: 8px 0 10px;
  font-size: clamp(32px, 5vw, 52px);
  line-height: 1.05;
}

.ai-consult-hero p {
  max-width: 780px;
  margin: 0;
  color: rgba(255, 255, 255, 0.84);
  line-height: 1.7;
}

.ai-status-card,
.ai-mode-card,
.ai-consult-sidebar,
.ai-chat-panel,
.ai-product-card,
.ai-build-card {
  border: 1px solid #e2e8f0;
  background: #fff;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.08);
}

.ai-status-card {
  display: grid;
  gap: 6px;
  padding: 18px;
  border-color: rgba(255,255,255,0.2);
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.36);
}

.ai-status-card strong,
.ai-status-card em {
  color: #fff;
}

.ai-status-card small {
  color: rgba(255, 255, 255, 0.76);
}

.ai-action-bar {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}

.ai-action {
  display: grid;
  place-items: center;
  gap: 7px;
  min-height: 78px;
  padding: 12px;
  border: 1px solid #dbe4f0;
  border-radius: 16px;
  color: #0f172a;
  background: #fff;
  font-weight: 900;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.ai-action:hover {
  transform: translateY(-2px);
  border-color: #93c5fd;
  box-shadow: 0 12px 26px rgba(37, 99, 235, 0.14);
}

.ai-action span {
  font-size: 22px;
}

.ai-action--live {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(135deg, #0f172a, #2563eb);
}

.ai-consult-shell {
  display: grid;
  grid-template-columns: 290px minmax(0, 1fr);
  gap: 18px;
  align-items: stretch;
}

.ai-consult-sidebar,
.ai-chat-panel {
  overflow: hidden;
  border-radius: 24px;
}

.ai-consult-sidebar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  align-self: start;
}

.ai-mode-card {
  display: grid;
  gap: 8px;
  padding: 16px;
  border-radius: 16px;
}

.ai-mode-card span,
.ai-mode-list span,
.ai-message-meta {
  color: #64748b;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

.ai-mode-card strong {
  color: #0f172a;
  font-size: 20px;
}

.ai-mode-card p,
.ai-mode-list small {
  margin: 0;
  color: #64748b;
  line-height: 1.55;
}

.ai-mode-list {
  display: grid;
  gap: 10px;
}

.ai-mode-list button {
  display: grid;
  gap: 4px;
  width: 100%;
  text-align: left;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #f8fafc;
  font: inherit;
  cursor: pointer;
}

.ai-mode-list button.is-active {
  border-color: #2563eb;
  background: #eff6ff;
}

.ai-live-button,
.ai-clear-button,
.ai-inline-handoff {
  min-height: 42px;
  border: 0;
  border-radius: 12px;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

.ai-live-button,
.ai-inline-handoff {
  color: #fff;
  background: linear-gradient(135deg, #0f172a, #2563eb);
}

.ai-live-button:disabled {
  opacity: 0.75;
  cursor: not-allowed;
}

.ai-clear-button {
  color: #64748b;
  background: #f1f5f9;
}

.ai-chat-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: min(720px, calc(100vh - 270px));
  min-height: 560px;
  max-height: calc(100vh - 270px);
  background: rgba(255,255,255,0.86);
}

.ai-chat-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: #fff;
}

.ai-chat-head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ai-back-ai-button {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  color: #1d4ed8;
  background: #eff6ff;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.ai-chat-head > div:first-child {
  display: grid;
  gap: 3px;
}

.ai-chat-head strong {
  color: #0f172a;
  font-size: 18px;
}

.ai-chat-head span {
  color: #64748b;
  font-size: 13px;
}

.ai-status-pill {
  padding: 8px 12px;
  border-radius: 999px;
  color: #1d4ed8;
  background: #eff6ff;
  font-size: 12px;
  font-weight: 900;
}

.ai-status-pill--human {
  color: #047857;
  background: #ecfdf5;
}

.ai-chat-messages {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 24px;
}

.ai-empty-state {
  display: grid;
  place-items: center;
  gap: 10px;
  margin: auto;
  max-width: 430px;
  text-align: center;
  color: #64748b;
}

.ai-empty-state div {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 22px;
  color: #fff;
  background: linear-gradient(135deg, #0f172a, #2563eb);
  font-weight: 900;
}

.ai-empty-state h2 {
  margin: 0;
  color: #0f172a;
}

.ai-system-message,
.ai-status-message {
  align-self: center;
  padding: 8px 14px;
  border-radius: 999px;
  color: #475569;
  background: #f1f5f9;
  font-size: 13px;
  font-weight: 800;
}

.ai-status-message {
  color: #075985;
  background: #e0f2fe;
}

.ai-message {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.ai-message--user {
  justify-content: flex-end;
}

.ai-avatar {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  border-radius: 14px;
  color: #fff;
  background: linear-gradient(135deg, #0f172a, #2563eb);
  font-size: 12px;
  font-weight: 900;
}

.ai-avatar--staff {
  background: linear-gradient(135deg, #047857, #10b981);
}

.ai-avatar--user {
  background: #0f172a;
}

.ai-message__content {
  display: grid;
  gap: 8px;
  max-width: min(880px, 78%);
}

.ai-message--user .ai-message__content {
  justify-items: end;
}

.ai-bubble {
  padding: 15px 18px;
  border: 1px solid #e2e8f0;
  border-radius: 18px 18px 18px 6px;
  background: #fff;
  color: #1e293b;
  line-height: 1.75;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.ai-message--user .ai-bubble {
  color: #fff;
  border-color: transparent;
  border-radius: 18px 18px 6px 18px;
  background: linear-gradient(135deg, #0f172a, #2563eb);
}

.ai-inline-handoff {
  justify-self: start;
  padding: 0 14px;
}

.ai-product-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.ai-product-card,
.ai-build-card {
  overflow: hidden;
  border-radius: 16px;
}

.ai-product-card {
  display: grid;
  grid-template-columns: 145px minmax(0, 1fr);
}

.ai-product-card__image {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 158px;
  background: #f8fafc;
}

.ai-product-card__image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 12px;
}

.ai-product-card__image span {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 4px 8px;
  border-radius: 999px;
  color: #047857;
  background: #ecfdf5;
  font-size: 12px;
  font-weight: 900;
}

.ai-product-card__body {
  display: grid;
  gap: 8px;
  padding: 14px;
}

.ai-product-card__body small {
  color: #64748b;
  font-weight: 800;
}

.ai-product-card__body strong {
  color: #0f172a;
  line-height: 1.45;
}

.ai-product-card__body > span {
  color: #2563eb;
  font-size: 18px;
  font-weight: 900;
}

.ai-product-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.ai-product-actions a,
.ai-product-actions button,
.ai-build-card a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 9px;
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  color: #0f172a;
  background: #fff;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
  text-decoration: none;
  cursor: pointer;
}

.ai-product-actions button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.ai-build-card {
  padding: 14px;
}

.ai-card-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.ai-card-head span {
  color: #2563eb;
  font-weight: 900;
}

.ai-build-list {
  display: grid;
  gap: 8px;
}

.ai-build-list .ai-build-item-row {
  display: grid;
  grid-template-columns: 80px 1fr auto auto;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.ai-build-list span.ai-build-slot {
  color: #2563eb;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.05em;
}

.ai-build-list strong.ai-build-pname {
  color: #0f172a;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-build-list small.ai-build-price {
  color: #059669;
  font-weight: 800;
  font-size: 12.5px;
}

.ai-build-item-pick {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 12px;
  font-size: 11.5px;
  font-weight: 800;
  border-radius: 8px;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ai-build-item-pick:hover {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
  transform: translateY(-1px);
}

.ai-build-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 14px;
}

.ai-btn-builder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 800;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #0f172a, #1e3a8a);
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
}

.ai-btn-builder:hover {
  filter: brightness(1.15);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.25);
}

.ai-btn-cart {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 800;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #10b981, #047857);
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
}

.ai-btn-cart:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.3);
}

.ai-btn-cart:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ai-typing {
  display: flex;
  gap: 7px;
  padding: 14px 18px;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  background: #fff;
}

.ai-typing span {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #2563eb;
  animation: ai-bounce 1.3s ease-in-out infinite;
}

.ai-typing span:nth-child(2) { animation-delay: 0.16s; }
.ai-typing span:nth-child(3) { animation-delay: 0.32s; }

.ai-composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 54px;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid #e2e8f0;
  background: rgba(255,255,255,0.94);
}

.ai-resolved-session-notice {
  grid-column: 1 / -1;
  padding: 12px 14px;
  border: 1px solid #bfdbfe;
  border-radius: 16px;
  background: #eff6ff;
  color: #1d4ed8;
  font-weight: 800;
  line-height: 1.5;
}

.ai-composer textarea {
  width: 100%;
  padding: 13px 15px;
  border: 1px solid #dbe4f0;
  border-radius: 16px;
  background: #f8fafc;
  color: #0f172a;
  font: inherit;
  resize: none;
  outline: none;
}

.ai-composer button {
  border: 0;
  border-radius: 16px;
  color: #fff;
  background: linear-gradient(135deg, #0f172a, #2563eb);
  cursor: pointer;
}

.ai-composer button:disabled {
  color: #94a3b8;
  background: #e2e8f0;
  cursor: not-allowed;
}

@keyframes ai-bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-7px); }
}

@media (max-width: 1120px) {
  .ai-action-bar {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .ai-consult-shell,
  .ai-consult-hero {
    grid-template-columns: 1fr;
  }

  .ai-consult-sidebar {
    order: 2;
  }
}

@media (max-width: 760px) {
  .ai-advisor-page {
    padding-top: 14px;
  }

  .ai-consult-hero {
    padding: 22px;
  }

  .ai-action-bar,
  .ai-product-grid,
  .ai-product-card {
    grid-template-columns: 1fr;
  }

  .ai-chat-panel {
    height: 680px;
    max-height: none;
  }

  .ai-message__content {
    max-width: 100%;
  }
}
`;

