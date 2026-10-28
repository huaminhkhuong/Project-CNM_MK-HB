import "./AiChatPage.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChatBuildCard } from "../../components/ai-chat/ChatBuildCard";
import { ChatProductGrid } from "../../components/ai-chat/ChatProductCard";

import { clearAiChatHistory, getAiChatHistory, sendAiChat } from "../../services/ai.service";
import { addItemToCart } from "../../services/cart.service";
import { createChatSession, getChatSession, handoffChatSession, sendChatMessage } from "../../services/chat.service";
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

      // Thu thập cấu hình PC pending từ sessionStorage (nếu khách vừa tạo cấu hình ở PC Builder)
      let clientBuild = null;
      try {
        const storedBuild = sessionStorage.getItem("pcmall_pending_ai_build");
        if (storedBuild) clientBuild = JSON.parse(storedBuild);
      } catch {
        // ignore
      }

      const response = await createChatSession({
        customerName,
        initialMessage,
        conversationType: "SALES_CONSULTATION",
        aiHistory: aiMessages.slice(-10), // Gửi 10 trao đổi gần nhất giữa User và AI để tạo Context Summary
        clientBuild
      });
      const session = normalizeApiData(response);
      if (session?.sessionId) {
        setLiveSessionId(session.sessionId);
        setLiveSession(session);
        setHumanMessages(mapLiveMessages(session));
        setMode("human");
        const staffMsg = session.staffName
          ? `Hệ thống đã tự động phân phối bạn tới nhân viên tư vấn ${session.staffName}.`
          : "Yêu cầu tư vấn đã được gửi vào hàng đợi. Nhân viên bán hàng sẽ phản hồi sớm nhất.";
        setStatusMessage(staffMsg);
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

  async function openOrStartLiveChat(initialMessage = "") {
    const isResolvedSession = String(liveSession?.status || "").toLowerCase() === "resolved";
    if (isResolvedSession) {
      await handleStartNewLiveChat(initialMessage);
      return;
    }
    if (liveSessionId) {
      try {
        setLoading(true);
        // Chuyển giao ngữ cảnh AI hiện tại vào session đã có
        let clientBuild = null;
        try {
          const storedBuild = sessionStorage.getItem("pcmall_pending_ai_build");
          if (storedBuild) clientBuild = JSON.parse(storedBuild);
        } catch {
          // ignore
        }

        const res = await handoffChatSession(liveSessionId, {
          aiHistory: aiMessages.slice(-10),
          clientBuild,
          note: initialMessage || undefined
        });
        const updated = normalizeApiData(res);
        if (updated) {
          setLiveSession(updated);
          setHumanMessages(mapLiveMessages(updated));
        }
      } catch (err) {
        console.warn("Handoff context transfer failed:", err);
      } finally {
        setLoading(false);
        switchMode("human");
      }
      return;
    }
    await handleStartLiveChat(initialMessage);
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
    try {
      setActionProductId(product.id);
      await addItemToCart({
        productId: product.id,
        quantity: 1,
        unitPrice: product.price,
        product: {
          id: product.id,
          name: product.name,
          imageUrl: product.imageUrl
        },
        variant: {
          id: product.skuId || product.id,
          sku: product.sku || `SKU-${product.id}`,
          price: product.price,
          imageUrl: product.imageUrl
        }
      });
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
                const isHandoffSummary = message.build?.isHandoffSummary || String(message.content || "").includes("TÓM TẮT NGỮ CẢNH TƯ VẤN (AI ➔ NHÂN VIÊN BÁN HÀNG)");
                if (isHandoffSummary) {
                  return (
                    <div key={message.id} className="ai-handoff-banner">
                      <div className="ai-handoff-banner__icon">🤝</div>
                      <div className="ai-handoff-banner__body">
                        <strong>Đã chuyển giao toàn bộ ngữ cảnh trao đổi cho nhân viên bán hàng</strong>
                        <p>Nhân viên đã nhận tóm tắt nhu cầu, mức ngân sách và cấu hình PC bạn vừa xem. Bạn không cần giải thích lại từ đầu!</p>
                      </div>
                    </div>
                  );
                }
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
                      <ChatBuildCard
                        build={message.build}
                        formatCurrency={formatCurrency}
                        getBuildComponents={getBuildComponents}
                        handlePcBuilder={handlePcBuilder}
                        handleLoadBuildToBuilder={handleLoadBuildToBuilder}
                        handleAddToCartFullBuild={handleAddToCartFullBuild}
                        loadingBuildCart={loadingBuildCart}
                      />
                    ) : null}

                    {!isUser && (message.products || []).length > 0 ? (
                      <ChatProductGrid
                        products={message.products}
                        formatCurrency={formatCurrency}
                        actionProductId={actionProductId}
                        handleAddToCart={handleAddToCart}
                        handleCompare={handleCompare}
                        handlePcBuilder={handlePcBuilder}
                      />
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
