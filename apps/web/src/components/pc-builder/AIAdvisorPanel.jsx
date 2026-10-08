import { useState, useEffect, useRef } from "react";
import { httpClient } from "../../services/http";
import { parseNaturalLanguageQuery, generateStructuredBuildAdvice } from "../../utils/aiConstraintParser";

const PROMPT_CATEGORIES = [
  {
    id: "game",
    label: "🎮 Tựa Game",
    prompts: [
      "🎮 Build PC 20Tr chơi mượt Black Myth Wukong 2K",
      "🚗 Tư vấn máy 15Tr quất mượt GTA V & Roleplay",
      "⚡ Cấu hình 12Tr quạt mượt 240 FPS Valorant / CS2",
      "⚽ Build PC 10Tr đá mượt FC Online 4K"
    ]
  },
  {
    id: "style",
    label: "🎨 Phong Cách",
    prompts: [
      "⚪ Build PC 25Tr Tone Trắng Full White sang xịn",
      "🐠 Tư vấn máy 20Tr Vỏ Case Bể Cá Panorama Kính",
      "🖤 Cấu hình Đơn giản Tối giản không LED RGB",
      "❄️ Tối ưu máy Siêu êm & Mát mẻ 24/7"
    ]
  },
  {
    id: "owned",
    label: "🛠️ Đã Có Đồ Cũ",
    prompts: [
      "💾 Nhà có sẵn SSD 1TB — Build phần còn lại 18Tr",
      "🎮 Đã có sẵn Card RTX 3060 — Build bộ máy 12Tr",
      "🧠 Đã có 32GB RAM DDR4 — Tư vấn CPU & Mainboard",
      "⚡ Có sẵn Nguồn 750W cũ — Tư vấn linh kiện gánh tốt"
    ]
  },
  {
    id: "tech",
    label: "⚖️ So Sánh & Kỹ Thuật",
    prompts: [
      "⚖️ So sánh i5-13400F vs Ryzen 5 7500F nên chọn con nào?",
      "⚡ Nguồn 650W có gánh nổi RTX 4070 Super không?",
      "🔍 CPU i5-13400F cắm RTX 4070 có bị nghẽn cổ chai không?",
      "📐 Case này có gắn vừa Tản nước AIO 360mm ở nóc không?"
    ]
  }
];

function RecommendedComponentCard({ comp, onViewProductDetail, onSelectSingleComponent }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => {
        if (onViewProductDetail) onViewProductDetail(comp);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="🔍 Nhấn để xem chi tiết thông số, đánh giá & phân tích XAI hợp chuẩn"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "6px",
        padding: "8px 10px",
        borderRadius: "10px",
        backgroundColor: hovered ? "#eff6ff" : "#f8fafc",
        border: `1.5px solid ${hovered ? "#3b82f6" : "#cbd5e1"}`,
        boxShadow: hovered ? "0 4px 12px rgba(59, 130, 246, 0.15)" : "none",
        cursor: "pointer",
        transition: "all 0.2s ease"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden", flex: 1 }}>
        <span style={{ fontSize: "18px", flexShrink: 0 }}>{comp.icon || "🧩"}</span>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          <strong style={{ fontSize: "11.5px", color: hovered ? "#1d4ed8" : "#1e293b", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {comp.name}
          </strong>
          <span style={{ fontSize: "10.5px", color: "#64748b", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {comp.specSummary || (comp.price ? `${comp.price.toLocaleString("vi-VN")}đ` : "")}
          </span>
        </div>
      </div>

      <button
        type="button"
        title="Nạp duy nhất linh kiện này vào cấu hình PC"
        onClick={(e) => {
          e.stopPropagation();
          if (onSelectSingleComponent) {
            onSelectSingleComponent(comp.componentType || comp.type, comp);
          }
        }}
        style={{
          flexShrink: 0,
          padding: "4px 8px",
          borderRadius: "6px",
          background: hovered ? "#2563eb" : "#ffffff",
          color: hovered ? "#ffffff" : "#2563eb",
          border: "1px solid #2563eb",
          fontSize: "10.5px",
          fontWeight: "700",
          cursor: "pointer",
          transition: "all 0.15s ease"
        }}
      >
        + Chọn
      </button>
    </div>
  );
}

/**
 * AIAdvisorPanel — Khung tư vấn AI nhúng trực tiếp trong trang PC Builder
 * Biết rõ ngữ cảnh (Context-Aware) các linh kiện đang được chọn trong Builder.
 * Tự động tạo Proactive AI Warnings khi linh kiện được thêm/thay đổi.
 */
export function AIAdvisorPanel({
  selectedItems = {},
  totalPrice = 0,
  budget = "25000000",
  xaiReport,
  onOpenReqWizard,
  onAutoBuild,
  onViewProductDetail,
  onSelectSingleComponent
}) {
  const [activeCategory, setActiveCategory] = useState("game");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "👋 Chào bạn! Tôi là Trợ Lý AI PC Mall. Tôi sẽ tự động phân tích và đưa ra cảnh báo kỹ thuật ngay khi bạn chọn linh kiện."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [proactiveAlert, setProactiveAlert] = useState(null);
  const lastNoticeKeyRef = useRef("");

  const safeTotalPrice = Number(totalPrice || 0);
  const selectedCount = Object.keys(selectedItems || {}).length;

  // Proactive AI Warning Generator khi component thay đổi
  useEffect(() => {
    if (!selectedItems || Object.keys(selectedItems).length === 0) {
      setProactiveAlert(null);
      return;
    }

    const alert = generateProactiveNotice(selectedItems, xaiReport);
    if (alert) {
      const noticeKey = `${alert.title}:${alert.text}`;
      if (noticeKey !== lastNoticeKeyRef.current) {
        lastNoticeKeyRef.current = noticeKey;
        setProactiveAlert(alert);
      }
    } else {
      setProactiveAlert(null);
    }
  }, [selectedItems, xaiReport]);

  function generateProactiveNotice(itemsMap, report) {
    const cpu = itemsMap.cpu?.product || itemsMap.cpu;
    const gpu = itemsMap.gpu?.product || itemsMap.gpu;
    const mainboard = itemsMap.mainboard?.product || itemsMap.mainboard;
    const ram = itemsMap.ram?.product || itemsMap.ram;
    const psu = itemsMap.psu?.product || itemsMap.psu;
    const cooling = itemsMap.cooling?.product || itemsMap.cooling;

    const cpuName = String(cpu?.name || cpu?.productName || "").toLowerCase();
    const gpuName = String(gpu?.name || gpu?.productName || "").toLowerCase();
    const mbName = String(mainboard?.name || mainboard?.productName || "").toLowerCase();
    const ramName = String(ram?.name || ram?.productName || "").toLowerCase();
    const psuName = String(psu?.name || psu?.productName || "").toLowerCase();
    const coolingName = String(cooling?.name || cooling?.productName || "").toLowerCase();

    // 1. High-end CPU Thermal warning (i9 / i7 / Ryzen 9 / X3D)
    if (cpuName.includes("14900") || cpuName.includes("13900") || cpuName.includes("7950x") || cpuName.includes("7900x") || cpuName.includes("i9")) {
      if (!cooling || (!coolingName.includes("360") && !coolingName.includes("aio"))) {
        return {
          type: "warning",
          title: "⚠️ AI Proactive Warning: CPU Flagship Tỏa Nhiệt Cao",
          text: `CPU ${cpu?.name || cpu?.productName || "Core i9/Ryzen 9"} tỏa nhiệt rất lớn (>250W). Gợi ý: Hãy chọn Tản nhiệt nước AIO 360mm để tránh tụt xung khi full load.`
        };
      }
    }

    // 2. High-end GPU Power & Clearance warning (RTX 4090 / 4080 / 7900 XTX)
    if (gpuName.includes("4090") || gpuName.includes("4080") || gpuName.includes("7900 xtx")) {
      if (!psu || (!psuName.includes("850") && !psuName.includes("1000") && !psuName.includes("1200"))) {
        return {
          type: "warning",
          title: "⚠️ AI Proactive Warning: GPU Đỉnh Bảng Cần PSU Lớn",
          text: `Card đồ họa ${gpu?.name || gpu?.productName || "RTX 4090/4080"} yêu cầu Nguồn tối thiểu 850W-1000W chuẩn ATX 3.0 có cáp 12VHPWR cắm trực tiếp.`
        };
      }
    }

    // 3. Mainboard vs RAM Socket / Type Mismatch
    if (mbName.includes("ddr5") && ramName && !ramName.includes("ddr5")) {
      return {
        type: "error",
        title: "🔴 AI Proactive Alert: Xung Đột Chuẩn RAM",
        text: "Mainboard hỗ trợ RAM DDR5 nhưng bạn vừa chọn RAM DDR4. Vui lòng đổi sang thanh RAM DDR5 để lắp vừa chân cắm."
      };
    }

    // 4. Report Blocker Warnings
    if (report?.summary?.blockerCount > 0) {
      const firstBlocker = report.checks?.find((c) => c.severity === "BLOCKER");
      return {
        type: "error",
        title: "⛔ AI Proactive Alert: Phát Hiện Lỗi Xung Đột Phân Cấp",
        text: firstBlocker?.explanation?.short || `Phát hiện ${report.summary.blockerCount} xung đột phần cứng nghiêm trọng cần khắc phục trước khi mua.`
      };
    }

    // 5. Positive Combo Insight
    if (cpu && gpu) {
      return {
        type: "success",
        title: "💡 AI Proactive Insight: Cân Bằng Cấu Hình",
        text: `Đã phối hợp CPU ${cpu.name || cpu.productName} + GPU ${gpu.name || gpu.productName}. Cấu hình rất cân bằng cho Gaming 1080p/2K và đồ họa!`
      };
    }

    return null;
  }

  async function handleSend(questionText) {
    const textToSend = questionText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg = { role: "user", text: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Chuẩn bị ngữ cảnh cấu hình hiện tại
      const buildContext = {
        selectedCount,
        totalPrice: safeTotalPrice,
        budget,
        items: Object.entries(selectedItems || {}).map(([type, item]) => ({
          type: type.toUpperCase(),
          name: item?.product?.name || item?.name || "Linh kiện"
        })),
        xaiScore: xaiReport?.score || 80,
        compatible: xaiReport?.compatible ?? true
      };

      const res = await httpClient.post("/pc-builder/ai-advice", {
        question: textToSend,
        buildContext
      });

      const resData = res.data?.data || res.data;
      const replyText = resData?.advice;
      const structuredAdvice = generateStructuredBuildAdvice(textToSend, buildContext);

      // Nếu backend trả về recommendedBuild với linh kiện thực từ DB:
      if (resData?.recommendedBuild?.components) {
        const iconMap = {
          cpu: "🖥",
          mainboard: "🔌",
          ram: "🧠",
          gpu: "🎮",
          storage: "💾",
          psu: "⚡",
          case: "📦",
          cooling: "❄️"
        };
        const dbComponents = Object.entries(resData.recommendedBuild.components).map(([type, c]) => ({
          componentType: type,
          id: c.productId,
          productId: c.productId,
          variantId: c.variantId,
          name: c.name,
          price: c.price,
          imageUrl: c.imageUrl,
          specSummary: c.explanation || `${Number(c.price || 0).toLocaleString("vi-VN")}đ`,
          icon: iconMap[type] || "🧩"
        }));
        structuredAdvice.recommendedComponents = dbComponents;
        structuredAdvice.totalPrice = resData.recommendedBuild.totalPrice;
        if (resData.detectedBudget) {
          structuredAdvice.parsed.budget = resData.detectedBudget;
        }
        if (resData.detectedUseCase) {
          structuredAdvice.parsed.purpose = resData.detectedUseCase;
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: replyText || structuredAdvice.summaryText,
          structuredAdvice,
          canAutoBuild: true,
          detectedBudget: resData?.detectedBudget || structuredAdvice.parsed.budget,
          detectedPurpose: resData?.detectedUseCase || structuredAdvice.parsed.purpose,
          recommendedBuild: resData?.recommendedBuild
        }
      ]);
    } catch (_err) {
      const structuredAdvice = generateStructuredBuildAdvice(textToSend, {
        selectedCount,
        totalPrice: safeTotalPrice,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: structuredAdvice.summaryText,
          structuredAdvice,
          canAutoBuild: true,
          detectedBudget: structuredAdvice.parsed.budget,
          detectedPurpose: structuredAdvice.parsed.purpose
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function parseBudgetFromQuery(q) {
    const m = q.match(/(\d+)\s*(tr|triệu|trieu|m)/i);
    if (m) {
      const val = parseInt(m[1], 10);
      if (val > 0 && val < 200) return val * 1000000;
    }
    return 20000000;
  }

  function parsePurposeFromQuery(q) {
    const l = q.toLowerCase();
    if (l.includes("đồ họa") || l.includes("dựng phim") || l.includes("render")) return "editing";
    if (l.includes("văn phòng") || l.includes("học tập")) return "office";
    if (l.includes("ai") || l.includes("lập trình")) return "ai";
    return "gaming";
  }

  function generateSmartFallbackAdvice(q, ctx) {
    const query = q.toLowerCase();
    const cpuItem = ctx.items?.find((i) => i.type === "CPU");
    const gpuItem = ctx.items?.find((i) => i.type === "GPU");

    if (query.includes("wukong") || query.includes("gta") || query.includes("chơi")) {
      if (gpuItem) {
        return `🎮 Với card đồ họa ${gpuItem.name} và CPU ${cpuItem?.name || "hiện tại"}, bộ PC của bạn đạt mức hiệu năng tối ưu. Bạn có thể chơi mượt các tựa game AAA ở 1080p High Settings (trên 60 FPS).`;
      }
      return "🎮 Để chơi mượt các tựa game nặng như Wukong hay GTA V, bạn nên chọn thêm một Card đồ họa rời (GPU) như RTX 4060 hoặc RX 7600.";
    }

    if (query.includes("render") || query.includes("dựng phim") || query.includes("premiere")) {
      return `🎬 Cho nhu cầu dựng phim 4K: Bộ PC của bạn có tổng giá trị ${(ctx.totalPrice || 0).toLocaleString("vi-VN")}đ. ${cpuItem ? `CPU ${cpuItem.name} xử lý render rất tốt.` : "Nên ưu tiên CPU từ 10 nhân trở lên và 32GB RAM để preview mượt mà."}`;
    }

    if (query.includes("nguồn") || query.includes("điện") || query.includes("psu")) {
      return `⚡ Tổng công suất ước tính của ${ctx.selectedCount} linh kiện hiện tại vào khoảng 350W - 420W. Sử dụng nguồn 600W - 650W 80 Plus sẽ đảm bảo dư tải 30% an toàn tuyệt đối.`;
    }

    return `🤖 Dựa trên cấu hình ${ctx.selectedCount} linh kiện (Tổng tiền: ${(ctx.totalPrice || 0).toLocaleString("vi-VN")}đ), bộ máy của bạn được đánh giá có độ tương thích cao. Bạn có thể tự tin đặt hàng hoặc tinh chỉnh thêm.`;
  }

  function getDynamicSuggestedQuestions(itemsMap) {
    const questions = [];

    const cpu = itemsMap.cpu?.product || itemsMap.cpu;
    const gpu = itemsMap.gpu?.product || itemsMap.gpu;
    const psu = itemsMap.psu?.product || itemsMap.psu;
    const ram = itemsMap.ram?.product || itemsMap.ram;
    const cooling = itemsMap.cooling?.product || itemsMap.cooling;

    const cpuName = String(cpu?.name || cpu?.productName || "").toLowerCase();
    const gpuName = String(gpu?.name || gpu?.productName || "").toLowerCase();
    const ramName = String(ram?.name || ram?.productName || "").toLowerCase();
    const psuName = String(psu?.name || psu?.productName || "").toLowerCase();

    // 1. High-end CPU without separate cooling selected
    if (cpu && (!cooling || (!cooling.name && !cooling.productName))) {
      if (cpuName.includes("k") || cpuName.includes("x") || cpuName.includes("i7") || cpuName.includes("i9") || cpuName.includes("7800x3d")) {
        questions.push(`❄️ CPU ${cpu.name || cpu.productName || "này"} có bắt buộc phải mua tản nhiệt rời không?`);
      } else {
        questions.push(`❄️ CPU này dùng tản kèm hộp hay nên mua thêm tản rời?`);
      }
    }

    // 2. Powerful GPU with low/medium or unselected PSU
    if (gpu) {
      if (!psu || (!psuName.includes("850") && !psuName.includes("1000") && (gpuName.includes("4070") || gpuName.includes("4080") || gpuName.includes("4090")))) {
        questions.push(`⚡ Bộ nguồn hiện tại có đủ điện an toàn cho Card đồ họa chưa?`);
      } else {
        questions.push(`🎮 Card ${gpu.name || gpu.productName || "GPU"} này có chiến mượt Wukong ở 2K không?`);
      }
    } else {
      questions.push("🎮 Chưa chọn Card màn hình, chip này có đồ họa tích hợp chơi game được không?");
    }

    // 3. RAM capacity query
    if (!ram || ramName.includes("8gb") || ramName.includes("16gb")) {
      questions.push("🧠 Cấu hình gaming/đồ họa này có cần nâng cấp thêm RAM không?");
    } else {
      questions.push("⚡ Tốc độ bus RAM này đã tối ưu cho CPU chưa?");
    }

    // 4. Default / General questions
    questions.push("🎬 Dựng phim 4K Premiere Pro với cấu hình này có mượt không?");
    questions.push("⚖️ Nếu muốn tối ưu thêm ngân sách thì nên đổi linh kiện nào?");

    return questions.slice(0, 4);
  }

  const dynamicQuestions = getDynamicSuggestedQuestions(selectedItems);

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.botIcon}>🤖</span>
        <div>
          <h4 style={styles.title}>AI Advisor — Tư Vấn Ngữ Cảnh Build PC</h4>
          <span style={styles.contextBadge}>
            Đang nắm giữ ngữ cảnh ({selectedCount} linh kiện • {safeTotalPrice.toLocaleString("vi-VN")}đ)
          </span>
        </div>
      </div>

      {/* 🔰 BEGINNER HELP BANNER */}
      <div style={{
        marginBottom: "14px",
        padding: "12px 14px",
        borderRadius: "14px",
        background: "linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)",
        border: "1.5px solid #93c5fd",
        boxShadow: "0 2px 8px rgba(37, 99, 235, 0.08)",
      }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px" }}>
          <span style={{ fontSize: "24px", background: "#fff", padding: "4px 8px", borderRadius: "10px" }}>🎯</span>
          <div>
            <strong style={{ fontSize: "13px", color: "#1e3a8a", display: "block" }}>
              Bạn mới bắt đầu & chưa biết chọn linh kiện?
            </strong>
            <span style={{ fontSize: "11.5px", color: "#2563eb", fontWeight: "500" }}>
              Hệ thống sẽ tự chọn sẵn 8 linh kiện chuẩn 100% theo nhu cầu & ngân sách!
            </span>
          </div>
        </div>

        {onOpenReqWizard && (
          <button
            type="button"
            onClick={onOpenReqWizard}
            style={{
              width: "100%",
              padding: "9px 12px",
              background: "#1d4ed8",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              fontWeight: "700",
              fontSize: "12px",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(29, 78, 216, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              marginBottom: "8px"
            }}
          >
            ⚡ Nút Build 1-Click Cho Người Mới (Wizard 3 Bước)
          </button>
        )}

        {/* Presets 1-Click */}
        <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingTop: "4px" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#1e4ed8", whiteSpace: "nowrap", alignSelf: "center" }}>Preset sẵn:</span>
          <button
            type="button"
            onClick={() => onAutoBuild && onAutoBuild({ purpose: "gaming", budget: 15000000 })}
            style={{ padding: "4px 9px", borderRadius: "16px", background: "#ffffff", border: "1px solid #93c5fd", fontSize: "11px", fontWeight: "600", color: "#1d4ed8", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            🎮 Gaming 15Tr 🚀
          </button>
          <button
            type="button"
            onClick={() => onAutoBuild && onAutoBuild({ purpose: "editing", budget: 25000000 })}
            style={{ padding: "4px 9px", borderRadius: "16px", background: "#ffffff", border: "1px solid #93c5fd", fontSize: "11px", fontWeight: "600", color: "#1d4ed8", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            🎬 Đồ Họa 25Tr 🚀
          </button>
          <button
            type="button"
            onClick={() => onAutoBuild && onAutoBuild({ purpose: "office", budget: 10000000 })}
            style={{ padding: "4px 9px", borderRadius: "16px", background: "#ffffff", border: "1px solid #93c5fd", fontSize: "11px", fontWeight: "600", color: "#1d4ed8", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            💼 Học Tập 10Tr 🚀
          </button>
        </div>
      </div>

      {/* PROACTIVE AI WARNING BANNER */}
      {proactiveAlert && (
        <div style={{
          marginBottom: "14px",
          padding: "12px 16px",
          borderRadius: "14px",
          backgroundColor: proactiveAlert.type === "error" ? "#fff1f2" : proactiveAlert.type === "warning" ? "#fff7ed" : "#f0fdf4",
          border: `1px solid ${proactiveAlert.type === "error" ? "#fecdd3" : proactiveAlert.type === "warning" ? "#ffedd5" : "#bbf7d0"}`,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.02)"
        }}>
          <strong style={{
            fontSize: "13px",
            display: "block",
            marginBottom: "3px",
            color: proactiveAlert.type === "error" ? "#be123c" : proactiveAlert.type === "warning" ? "#c2410c" : "#15803d"
          }}>
            {proactiveAlert.title}
          </strong>
          <p style={{ margin: 0, fontSize: "12.5px", color: "#334155", lineHeight: "1.5" }}>
            {proactiveAlert.text}
          </p>
        </div>
      )}

      {/* 🎯 CATEGORIZED PROMPT TABS */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", marginBottom: "8px", overflowX: "auto" }}>
          {PROMPT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: "4px 10px",
                borderRadius: "8px",
                border: "none",
                background: activeCategory === cat.id ? "#eff6ff" : "transparent",
                color: activeCategory === cat.id ? "#1d4ed8" : "#64748b",
                fontSize: "12px",
                fontWeight: activeCategory === cat.id ? "700" : "500",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px" }}>
          {PROMPT_CATEGORIES.find((c) => c.id === activeCategory)?.prompts.map((q, idx) => (
            <button key={idx} style={styles.quickChip} onClick={() => handleSend(q)}>
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* PROACTIVE AI WARNING BANNER */}
      {proactiveAlert && (
        <div style={{
          marginBottom: "14px",
          padding: "12px 16px",
          borderRadius: "14px",
          backgroundColor: proactiveAlert.type === "error" ? "#fff1f2" : proactiveAlert.type === "warning" ? "#fff7ed" : "#f0fdf4",
          border: `1px solid ${proactiveAlert.type === "error" ? "#fecdd3" : proactiveAlert.type === "warning" ? "#ffedd5" : "#bbf7d0"}`,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.02)"
        }}>
          <strong style={{
            fontSize: "13px",
            display: "block",
            marginBottom: "3px",
            color: proactiveAlert.type === "error" ? "#be123c" : proactiveAlert.type === "warning" ? "#c2410c" : "#15803d"
          }}>
            {proactiveAlert.title}
          </strong>
          <p style={{ margin: 0, fontSize: "12.5px", color: "#334155", lineHeight: "1.5" }}>
            {proactiveAlert.text}
          </p>
        </div>
      )}

      {/* CHAT MESSAGES */}
      <div style={styles.chatBox}>
        {messages.map((m, idx) => (
          <div key={idx} style={styles.msgRow(m.role === "user")}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
              
              {/* Structured Badge if available */}
              {m.structuredAdvice?.qnaBadge && (
                <div style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  backgroundColor: m.structuredAdvice.qnaBadge.type === "success" ? "#ecfdf5" : "#eff6ff",
                  color: m.structuredAdvice.qnaBadge.type === "success" ? "#15803d" : "#1d4ed8",
                  border: `1px solid ${m.structuredAdvice.qnaBadge.type === "success" ? "#bbf7d0" : "#bfdbfe"}`,
                  marginBottom: "4px"
                }}>
                  {m.structuredAdvice.qnaBadge.title}
                </div>
              )}

              {/* Rich Formatted Text */}
              <div style={styles.bubble(m.role === "user")}>
                {m.text.split("\n").map((line, lIdx) => {
                  if (!line.trim()) return <br key={lIdx} />;
                  if (line.startsWith("🤖") || line.startsWith("🎯") || line.startsWith("📊") || line.startsWith("⚡") || line.startsWith("📐")) {
                    return (
                      <div key={lIdx} style={{ fontWeight: "700", marginBottom: "4px", color: m.role === "user" ? "#ffffff" : "#1e293b" }}>
                        {line}
                      </div>
                    );
                  }
                  return <div key={lIdx} style={{ marginBottom: "3px" }}>{line}</div>;
                })}
              </div>

              {/* Rich 8-Component Hardware Breakdown Card */}
              {m.role === "assistant" && m.structuredAdvice?.recommendedComponents && (
                <div style={{
                  marginTop: "8px",
                  padding: "12px 14px",
                  borderRadius: "14px",
                  backgroundColor: "#ffffff",
                  border: "1.5px solid #bfdbfe",
                  boxShadow: "0 4px 14px rgba(37, 99, 235, 0.08)",
                  width: "100%",
                  boxSizing: "border-box"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", paddingBottom: "6px", borderBottom: "1px solid #eff6ff" }}>
                    <span style={{ fontSize: "12px", fontWeight: "800", color: "#1d4ed8", display: "flex", alignItems: "center", gap: "6px" }}>
                      🧩 Chi Tiết 8 Linh Kiện AI Xuất Cấu Hình
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: "#059669", background: "#ecfdf5", padding: "2px 8px", borderRadius: "10px" }}>
                      {((m.structuredAdvice.totalPrice || 20000000) / 1000000).toFixed(1)} Trđ
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "8px", marginBottom: "10px" }}>
                    {m.structuredAdvice.recommendedComponents.map((comp, cIdx) => (
                      <RecommendedComponentCard
                        key={cIdx}
                        comp={comp}
                        onViewProductDetail={onViewProductDetail}
                        onSelectSingleComponent={onSelectSingleComponent}
                      />
                    ))}
                  </div>

                  {/* Benchmark & Readiness Footer */}
                  {m.structuredAdvice.fpsEstimate && (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px", padding: "6px 10px", background: "#f0f9ff", borderRadius: "8px", border: "1px solid #bae6fd" }}>
                      <span style={{ fontSize: "10.5px", color: "#0369a1", fontWeight: "700" }}>🎮 Wukong 1080p: {m.structuredAdvice.fpsEstimate.wukong1080p}</span>
                      <span style={{ fontSize: "10.5px", color: "#0369a1", fontWeight: "700" }}>• ⚡ Valorant: {m.structuredAdvice.fpsEstimate.valorant2k}</span>
                    </div>
                  )}

                  {/* 1-Click Workspace Auto-Fill Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onAutoBuild) {
                        onAutoBuild({ 
                          purpose: m.detectedPurpose || m.structuredAdvice.parsed?.purpose || "gaming", 
                          budget: m.detectedBudget || m.structuredAdvice.parsed?.budget || 20000000,
                          recommendedBuild: m.recommendedBuild || m.structuredAdvice?.recommendedComponents
                        });
                      } else if (onOpenReqWizard) {
                        onOpenReqWizard();
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "9px 14px",
                      background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: "800",
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "all 0.18s ease"
                    }}
                  >
                    🚀 Tự Động Chọn & Nạp Dàn PC {(m.detectedBudget || m.structuredAdvice.parsed?.budget ? ((m.detectedBudget || m.structuredAdvice.parsed?.budget) / 1000000).toFixed(0) : "20")}Tr Này Về Máy Cho Tôi (8/8 Linh Kiện) →
                  </button>
                </div>
              )}

              {/* Generic 1-Click Action Button for simple text replies */}
              {m.role === "assistant" && !m.structuredAdvice?.recommendedComponents && (m.canAutoBuild || onAutoBuild) && idx > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (onAutoBuild) {
                      onAutoBuild({ purpose: m.detectedPurpose || "gaming", budget: m.detectedBudget || 20000000 });
                    } else if (onOpenReqWizard) {
                      onOpenReqWizard();
                    }
                  }}
                  style={{
                    marginTop: "6px",
                    padding: "7px 12px",
                    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "11.5px",
                    fontWeight: "700",
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(37, 99, 235, 0.3)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px"
                  }}
                >
                  🚀 Tự Động Chọn & Nạp Dàn PC {(m.detectedBudget ? (m.detectedBudget / 1000000).toFixed(0) : "20")}Tr Này Về Máy Cho Tôi →
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && <div style={styles.typing}>🤖 AI đang suy nghĩ câu trả lời...</div>}
      </div>

      {/* INPUT FORM */}
      <form
        style={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <input
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Hỏi AI về cấu hình đang chọn (ví dụ: 'Bộ này chơi Wukong mượt không?')"
        />
        <button style={styles.sendBtn} type="submit" disabled={loading || !input.trim()}>
          Gửi
        </button>
      </form>
    </div>
  );
}

const styles = {
  panel: {
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    padding: "20px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
    marginBottom: "20px"
  },
  header: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    marginBottom: "14px"
  },
  botIcon: {
    fontSize: "28px",
    backgroundColor: "#eff6ff",
    padding: "8px",
    borderRadius: "14px"
  },
  title: {
    margin: 0,
    fontSize: "16px",
    fontWeight: "700",
    color: "#0f172a"
  },
  contextBadge: {
    fontSize: "12px",
    color: "#059669",
    fontWeight: "600"
  },
  quickBar: {
    display: "flex",
    gap: "8px",
    overflowX: "auto",
    paddingBottom: "10px",
    marginBottom: "12px"
  },
  quickChip: {
    backgroundColor: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderRadius: "20px",
    padding: "6px 14px",
    fontSize: "12px",
    color: "#334155",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontWeight: "500"
  },
  chatBox: {
    maxHeight: "450px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "12px",
    backgroundColor: "#f8fafc",
    borderRadius: "14px",
    marginBottom: "12px"
  },
  msgRow: (isUser) => ({
    display: "flex",
    justifyContent: isUser ? "flex-end" : "flex-start"
  }),
  bubble: (isUser) => ({
    maxWidth: "85%",
    padding: "10px 14px",
    borderRadius: isUser ? "16px 16px 2px 16px" : "16px 16px 16px 2px",
    backgroundColor: isUser ? "#1d4ed8" : "#ffffff",
    color: isUser ? "#ffffff" : "#0f172a",
    fontSize: "13px",
    lineHeight: "1.5",
    border: isUser ? "none" : "1px solid #e2e8f0",
    boxShadow: isUser ? "none" : "0 2px 6px rgba(15, 23, 42, 0.03)"
  }),
  typing: {
    fontSize: "12px",
    color: "#64748b",
    fontStyle: "italic",
    padding: "4px"
  },
  form: {
    display: "flex",
    gap: "8px"
  },
  input: {
    flex: 1,
    padding: "10px 16px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    fontSize: "13px"
  },
  sendBtn: {
    backgroundColor: "#1d4ed8",
    color: "#ffffff",
    border: "none",
    padding: "10px 20px",
    borderRadius: "12px",
    fontWeight: "700",
    fontSize: "13px",
    cursor: "pointer"
  }
};
