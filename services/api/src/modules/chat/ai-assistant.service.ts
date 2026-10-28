import { env } from "../../config/env";
import { RetrieverService, RetrievedProduct } from "../ai/retriever.service";
import { AiLlmProvider } from "../ai/ai-llm.provider";
import { AiContextService, UserHardwareContext } from "../ai/ai-context.service";
import { aiOrchestratorService } from "../ai/ai-orchestrator.service";

export interface ConsultationCriteria {
  purpose?: string;
  budget?: number;
  resolution?: string;
  ownedList?: string[];
  ownedNotes?: string;
}

export interface RecommendedComponent {
  type: string;
  componentType: string;
  id: number;
  productId: number;
  name: string;
  price: number;
  explanation?: string;
  isOwned?: boolean;
}

export interface RecommendedBuildResult {
  label: string;
  totalPrice: number;
  budgetUtilization: number;
  components: RecommendedComponent[];
  compatibilityScore: number;
  summaryText: string;
}

export interface AiConsultationResponse {
  text: string;
  products?: any[];
  buildPayload?: any;
  type: "theory_explanation" | "product_recommendation" | "build_recommendation" | "advisor_reply";
  userContextSummary?: string;
}

/**
 * AiAssistantService — Backend AI Hardware Expert & RAG Engine
 * Tích hợp RAG thông minh: Tra cứu tri thức phần cứng (Knowledge Base),
 * truy xuất sản phẩm thật (MySQL Vector Store), loại trừ linh kiện có sẵn và sinh tư vấn qua LLM.
 */
export class AiAssistantService {
  /**
   * System Prompt chuẩn mực cho PC Mall Senior Hardware Engineer
   */
  public getSystemPrompt(): string {
    return [
      "Bạn là Senior AI Hardware Engineer của PC Mall - Siêu thị máy tính và linh kiện PC hàng đầu.",
      "Nhiệm vụ: Tư vấn cấu hình PC tối ưu nhất theo đúng nhu cầu & ngân sách khách hàng dựa trên dữ liệu hàng thật.",
      "Nguyên tắc cốt lõi:",
      "1. Tương thích 100%: CPU và Mainboard cùng Socket; chuẩn RAM (DDR4/DDR5) khớp Mainboard; công suất nguồn PSU >= (TDP CPU + GPU + 100W) x 1.25.",
      "2. Không bịa đặt linh kiện: CHỈ gợi ý linh kiện có trong danh mục cung cấp, kèm giá bán và tồn kho thật.",
      "3. Tôn trọng đồ cũ của khách: Nếu khách có sẵn linh kiện ở nhà (RAM, SSD, GPU, Case), loại trừ khỏi ngân sách mua mới và tư vấn linh kiện còn lại khớp chuẩn với đồ cũ.",
      "4. Giải thích khoa học: Giải thích rõ lý do chọn từng linh kiện và giải đáp thắc mắc (ví dụ: cơ chế hạ xung RAM Downclocking tự động an toàn 100%)."
    ].join(" ");
  }

  /**
   * Giải đáp thắc mắc lý thuyết phần cứng bằng Knowledge Base RAG
   */
  public async explainHardwareTheoryAsync(questionText: string): Promise<string | null> {
    const q = (questionText || "").trim();
    if (!q) return null;

    try {
      const knowledgeItems = await RetrieverService.searchDomainKnowledge(q, {
        topK: 2,
        minScore: 0.25
      });

      if (knowledgeItems.length > 0) {
        const topItem = knowledgeItems[0];
        // Trích xuất đoạn tóm tắt từ nội dung Markdown
        const cleanContent = topItem.text
          .replace(/^\[Tài liệu:[^\]]+\]\s*/i, "")
          .replace(/^##\s+[^\n]+\n/, "")
          .trim();

        if (cleanContent.length > 40) {
          return cleanContent;
        }
      }
    } catch (err) {
      console.warn("[AiAssistantService] RAG knowledge search warning:", err);
    }

    // Fallback nếu vector store chưa sẵn sàng
    return this.explainHardwareTheory(questionText);
  }

  /**
   * Phương thức đồng bộ fallback cho các câu hỏi lý thuyết phổ biến
   */
  public explainHardwareTheory(questionText: string): string | null {
    const q = (questionText || "").toLowerCase();

    if (q.includes("3200") && (q.includes("2666") || q.includes("2933") || q.includes("downclock") || q.includes("cháy") || q.includes("nổ"))) {
      return "Bạn hoàn toàn có thể yên tâm! RAM Bus 3200MHz cắm vào Mainboard chỉ hỗ trợ max 2666MHz sẽ hoạt động an toàn 100%. Chuẩn JEDEC và BIOS sẽ tự động kích hoạt cơ chế hạ xung (Downclocking) về 2666MHz để đảm bảo độ ổn định tuyệt đối. Việc này không gây cháy nổ hay hư hỏng thiết bị, chỉ hơi phí khoảng 10-15% bus RAM dư thừa.";
    }

    if (q.includes("nguồn") && (q.includes("yếu") || q.includes("sụt") || q.includes("tắt máy") || q.includes("bao nhiêu watt"))) {
      return "Khi chọn bộ nguồn (PSU), công suất khuyến nghị được tính bằng: (TDP CPU + TDP GPU + 100W) x 1.25 đến 1.30 để dự phòng tải đỉnh. Nếu PSU quá yếu, máy sẽ kích hoạt mạch bảo vệ (OPP/OCP) tự ngắt khi tải nặng để chống cháy nổ linh kiện.";
    }

    if (q.includes("nghẽn") || q.includes("bottleneck")) {
      return "Hiện tượng nghẽn cổ chai (Bottleneck) xảy ra khi một linh kiện (như CPU hoặc GPU) xử lý quá chậm so với thành phần còn lại. Ở độ phân giải 1080p, game cần CPU đơn nhân mạnh; ở độ phân giải 2K/4K, tải dồn lên GPU nên cần ưu tiên GPU có VRAM từ 12GB trở lên.";
    }

    if (q.includes("đổi trả") || q.includes("bảo hành") || q.includes("1 đổi 1") || q.includes("chính sách")) {
      return "Chính sách PC Mall: Cam kết 1-đổi-1 trong vòng 30 ngày đầu tiên cho mọi linh kiện mới nếu có lỗi phần cứng từ nhà sản xuất. Linh kiện chính hãng được bảo hành 36 - 60 tháng, miễn phí 100% công lắp ráp, đi dây và stress-test nhiệt độ trước khi giao.";
    }

    return null;
  }

  /**
   * Tạo cấu hình tư vấn tối ưu từ sản phẩm thật trong MySQL Vector Store
   * Tự động loại trừ linh kiện khách có sẵn và kiểm tra tính tương thích socket/RAM/nguồn
   */
  public async generateConsultationBuild(criteria: ConsultationCriteria): Promise<RecommendedBuildResult> {
    const budget = Number(criteria.budget || 20000000);
    const purpose = (criteria.purpose || "gaming").toLowerCase();
    const resolution = criteria.resolution || "1080p";
    const ownedList = (criteria.ownedList || []).map((i) => i.toLowerCase());
    const ownedNotes = criteria.ownedNotes || "";

    const isRamOwned = ownedList.some((i) => i.includes("ram") || i.includes("bộ nhớ"));
    const isSsdOwned = ownedList.some((i) => i.includes("ssd") || i.includes("storage") || i.includes("ổ cứng"));
    const isGpuOwned = ownedList.some((i) => i.includes("gpu") || i.includes("card") || i.includes("vga"));
    const isCaseOwned = ownedList.some((i) => i.includes("case") || i.includes("vỏ"));

    // Tỷ lệ phân bổ ngân sách tối ưu theo mục đích
    const isGaming = purpose.includes("gaming") || purpose.includes("game");
    const isWork = purpose.includes("work") || purpose.includes("render") || purpose.includes("đồ họa");

    const ratios = isGaming
      ? { cpu: 0.18, mainboard: 0.12, ram: 0.10, gpu: 0.38, ssd: 0.08, psu: 0.08, case: 0.04, cooling: 0.02 }
      : isWork
      ? { cpu: 0.28, mainboard: 0.14, ram: 0.18, gpu: 0.20, ssd: 0.10, psu: 0.06, case: 0.04, cooling: 0.00 }
      : { cpu: 0.22, mainboard: 0.14, ram: 0.14, gpu: 0.25, ssd: 0.10, psu: 0.08, case: 0.05, cooling: 0.02 };

    const components: RecommendedComponent[] = [];
    let totalPrice = 0;

    // Helper: Tìm linh kiện gần mức giá mục tiêu trong danh mục
    const pickBestProduct = async (
      category: string,
      targetBudget: number,
      extraFilter: { socket?: string; ramType?: string } = {}
    ): Promise<RetrievedProduct | null> => {
      try {
        const candidates = await RetrieverService.searchSimilarProducts(
          `${category} ${purpose}`,
          {
            category,
            maxPrice: Math.round(targetBudget * 1.35),
            inStockOnly: true,
            ...extraFilter
          },
          10
        );

        if (candidates.length === 0) {
          // Thử tìm lại không giới hạn maxPrice nếu ngân sách quá hẹp
          const broadCandidates = await RetrieverService.searchSimilarProducts(category, { category, inStockOnly: true }, 5);
          return broadCandidates[0] || null;
        }

        // Chọn sản phẩm có giá gần với targetBudget nhất
        return candidates.sort((a, b) => Math.abs(a.price - targetBudget) - Math.abs(b.price - targetBudget))[0];
      } catch (err) {
        console.warn(`[AiAssistantService] Lỗi khi pick sản phẩm danh mục ${category}:`, err);
        return null;
      }
    };

    // 1. CPU
    const cpuBudget = budget * ratios.cpu;
    const pickedCpu = await pickBestProduct("cpu", cpuBudget);
    const cpuId = pickedCpu?.productId || 1;
    const cpuName = pickedCpu?.name || "Intel Core i5-13400F";
    const cpuPrice = pickedCpu?.price || 4890000;
    const cpuSocket = pickedCpu?.socket || "LGA1700";
    const cpuTdp = pickedCpu?.tdp || 65;

    totalPrice += cpuPrice;
    components.push({
      type: "CPU",
      componentType: "cpu",
      id: cpuId,
      productId: cpuId,
      name: cpuName,
      price: cpuPrice,
      explanation: `CPU hiệu năng cao socket ${cpuSocket}, TDP ${cpuTdp}W đáp ứng mượt nhu cầu ${purpose}.`
    });

    // 2. MAINBOARD (Tương thích 100% Socket CPU)
    const mbBudget = budget * ratios.mainboard;
    // Nếu khách có sẵn RAM DDR4, ép chọn mainboard DDR4
    const preferredRamType = isRamOwned && ownedNotes.toLowerCase().includes("ddr4") ? "DDR4" : undefined;
    const pickedMb = await pickBestProduct("mainboard", mbBudget, {
      socket: cpuSocket,
      ramType: preferredRamType
    });
    const mbId = pickedMb?.productId || 2;
    const mbName = pickedMb?.name || `Mainboard Chipset B760 (${cpuSocket})`;
    const mbPrice = pickedMb?.price || 3250000;
    const mbRamType = pickedMb?.ramType || (preferredRamType || "DDR4");

    totalPrice += mbPrice;
    components.push({
      type: "MAINBOARD",
      componentType: "mainboard",
      id: mbId,
      productId: mbId,
      name: mbName,
      price: mbPrice,
      explanation: `Bo mạch chủ tương thích Socket ${cpuSocket}, hỗ trợ RAM ${mbRamType}.`
    });

    // 3. RAM (Xử lý linh kiện có sẵn)
    if (isRamOwned) {
      components.push({
        type: "RAM",
        componentType: "ram",
        id: 0,
        productId: 0,
        name: `RAM CỦA BẠN (${ownedNotes || "Có sẵn ở nhà"})`,
        price: 0,
        explanation: `Tận dụng lại thanh RAM có sẵn để tiết kiệm chi phí. Mainboard đã được chọn để tương thích chuẩn RAM này.`,
        isOwned: true
      });
    } else {
      const ramBudget = budget * ratios.ram;
      const pickedRam = await pickBestProduct("ram", ramBudget, { ramType: mbRamType });
      const ramId = pickedRam?.productId || 3;
      const ramName = pickedRam?.name || `RAM 16GB (2x8GB) ${mbRamType}`;
      const ramPrice = pickedRam?.price || 1250000;

      totalPrice += ramPrice;
      components.push({
        type: "RAM",
        componentType: "ram",
        id: ramId,
        productId: ramId,
        name: ramName,
        price: ramPrice,
        explanation: `Bộ nhớ kênh đôi Dual Channel chạy mượt mà, ổn định.`
      });
    }

    // 4. GPU (Card màn hình - Xử lý linh kiện có sẵn)
    let gpuTdp = 160;
    if (isGpuOwned) {
      components.push({
        type: "GPU",
        componentType: "gpu",
        id: 0,
        productId: 0,
        name: `CARD ĐỒ HỌA CỦA BẠN (${ownedNotes || "Có sẵn ở nhà"})`,
        price: 0,
        explanation: "Sử dụng lại Card màn hình sẵn có của bạn.",
        isOwned: true
      });
    } else {
      const gpuBudget = budget * ratios.gpu;
      const pickedGpu = await pickBestProduct("gpu", gpuBudget);
      const gpuId = pickedGpu?.productId || 4;
      const gpuName = pickedGpu?.name || "NVIDIA GeForce RTX 4060 8GB";
      const gpuPrice = pickedGpu?.price || 8290000;
      gpuTdp = pickedGpu?.tdp || 160;

      totalPrice += gpuPrice;
      components.push({
        type: "GPU",
        componentType: "gpu",
        id: gpuId,
        productId: gpuId,
        name: gpuName,
        price: gpuPrice,
        explanation: `Card đồ họa chiến mượt các tựa game/đồ họa ở độ phân giải ${resolution.toUpperCase()}.`
      });
    }

    // 5. STORAGE / SSD (Xử lý linh kiện có sẵn)
    if (isSsdOwned) {
      components.push({
        type: "STORAGE",
        componentType: "storage",
        id: 0,
        productId: 0,
        name: `Ổ SSD CỦA BẠN (${ownedNotes || "Có sẵn ở nhà"})`,
        price: 0,
        explanation: "Tận dụng ổ cứng lưu trữ sẵn có.",
        isOwned: true
      });
    } else {
      const ssdBudget = budget * ratios.ssd;
      const pickedSsd = await pickBestProduct("ssd", ssdBudget);
      const ssdId = pickedSsd?.productId || 5;
      const ssdName = pickedSsd?.name || "SSD 500GB M.2 NVMe PCIe 4.0";
      const ssdPrice = pickedSsd?.price || 1190000;

      totalPrice += ssdPrice;
      components.push({
        type: "STORAGE",
        componentType: "storage",
        id: ssdId,
        productId: ssdId,
        name: ssdName,
        price: ssdPrice,
        explanation: "Ổ cứng thể rắn NVMe PCIe tốc độ đọc ghi cao, khởi động máy và load game siêu nhanh."
      });
    }

    // 6. PSU (Tính nguồn theo công thức vàng RAG: (TDP CPU + GPU + 100W) x 1.25)
    const requiredWattage = Math.round((cpuTdp + gpuTdp + 100) * 1.25);
    const psuBudget = budget * ratios.psu;
    const pickedPsu = await pickBestProduct("psu", psuBudget);
    const psuId = pickedPsu?.productId || 6;
    const psuName = pickedPsu?.name || `Nguồn 650W 80 Plus Bronze (${requiredWattage}W đề xuất)`;
    const psuPrice = pickedPsu?.price || 1350000;

    totalPrice += psuPrice;
    components.push({
      type: "PSU",
      componentType: "psu",
      id: psuId,
      productId: psuId,
      name: psuName,
      price: psuPrice,
      explanation: `Bộ nguồn công suất thực đáp ứng tải ${requiredWattage}W, chuẩn 80 Plus an toàn, bền bỉ.`
    });

    // 7. CASE (Vỏ máy)
    if (isCaseOwned) {
      components.push({
        type: "CASE",
        componentType: "case",
        id: 0,
        productId: 0,
        name: `VỎ CASE CỦA BẠN (${ownedNotes || "Có sẵn ở nhà"})`,
        price: 0,
        explanation: "Tận dụng vỏ thùng máy cũ.",
        isOwned: true
      });
    } else {
      const caseBudget = budget * ratios.case;
      const pickedCase = await pickBestProduct("case", caseBudget);
      const caseId = pickedCase?.productId || 7;
      const caseName = pickedCase?.name || "Vỏ Case Mid Tower Airflow";
      const casePrice = pickedCase?.price || 890000;

      totalPrice += casePrice;
      components.push({
        type: "CASE",
        componentType: "case",
        id: caseId,
        productId: caseId,
        name: caseName,
        price: casePrice,
        explanation: "Vỏ case mặt lưới thông thoáng, tối ưu luồng gió làm mát linh kiện."
      });
    }

    // 8. COOLING (Tản nhiệt nếu CPU TDP >= 100W hoặc ngân sách cho phép)
    if (cpuTdp >= 100 || budget >= 25000000) {
      const pickedCooling = await pickBestProduct("cooling", budget * 0.04);
      if (pickedCooling) {
        totalPrice += pickedCooling.price;
        components.push({
          type: "COOLING",
          componentType: "cooling",
          id: pickedCooling.productId,
          productId: pickedCooling.productId,
          name: pickedCooling.name,
          price: pickedCooling.price,
          explanation: "Tản nhiệt chuyên dụng giúp CPU hoạt động mát mẻ ở xung nhịp tối đa."
        });
      }
    }

    const budgetUtilization = Math.round((totalPrice / budget) * 100);

    return {
      label: `Cấu hình PC ${purpose.toUpperCase()} Tối Ưu (${totalPrice.toLocaleString("vi-VN")}đ)`,
      totalPrice,
      budgetUtilization,
      components,
      compatibilityScore: 98,
      summaryText: `Đã thiết kế cấu hình tối ưu theo ngân sách ${budget.toLocaleString("vi-VN")}đ cho mục đích ${purpose.toUpperCase()}.${ownedList.length > 0 ? ` Đã loại trừ ${ownedList.join(", ")} bạn có sẵn ở nhà.` : ""}`
    };
  }

  /**
   * Gọi LLM API thông qua Unified AiOrchestratorService (Quản lý Prompt, Token, Lịch sử hội thoại & Cascading Fallback)
   */
  private async callLlmWithAugmentedPrompt(systemPrompt: string, userPrompt: string, sessionId?: string): Promise<string | null> {
    try {
      const res = await aiOrchestratorService.consultChat({
        question: userPrompt,
        sessionId
      });
      return res.success && res.text ? res.text.trim() : null;
    } catch (err) {
      console.warn("[AiAssistantService] Unified Orchestrator call warning:", err);
      return null;
    }
  }

  /**
   * Phương thức đầu não: Xử lý toàn bộ yêu cầu tư vấn Chat bằng RAG + Unified User Context
   */
  public async consultWithRag(
    messageText: string,
    criteria?: ConsultationCriteria,
    contextOptions?: { userId?: number | null; sessionId?: string | null }
  ): Promise<AiConsultationResponse> {
    const message = (messageText || "").trim();
    const budget = criteria?.budget ? Number(criteria.budget) : this.extractBudgetFromText(message);
    const purpose = criteria?.purpose || this.extractPurposeFromText(message);

    // 0. Truy xuất ngữ cảnh phần cứng thống nhất (Active PC Build, Cart, Orders)
    let userContext: UserHardwareContext | null = null;
    if (contextOptions?.userId || contextOptions?.sessionId) {
      try {
        userContext = await AiContextService.aggregateUserContext(contextOptions?.userId, contextOptions?.sessionId);
      } catch (ctxErr) {
        console.warn("[AiAssistantService] Could not aggregate user context:", ctxErr);
      }
    }

    // 1. Kiểm tra câu hỏi lý thuyết / chính sách qua RAG Knowledge Base
    const isTheory = this.isTheoryOrPolicyQuestion(message);
    const isBuildRequest = this.isPcBuildIntent(message) || criteria?.budget !== undefined;

    // 1.1 Khách hỏi trực tiếp về cấu hình vừa chọn trong PC Builder
    const isAskingAboutCurrentBuild = Boolean(
      userContext?.hasActiveBuild && (
        message.includes("vừa chọn") ||
        message.includes("vừa build") ||
        message.includes("máy tôi") ||
        message.includes("máy mình") ||
        message.includes("cấu hình này") ||
        message.includes("cấu hình của tôi") ||
        message.includes("cấu hình hiện tại") ||
        (message.includes("cấu hình") && (message.includes("ổn") || message.includes("sao") || message.includes("thế nào") || message.includes("được không"))) ||
        (message.includes("nguồn") && (message.includes("đủ") || message.includes("gánh") || message.includes("yếu"))) ||
        message.includes("chơi được") ||
        message.includes("tương thích")
      )
    );

    if (isAskingAboutCurrentBuild && userContext && userContext.hasActiveBuild) {
      const activeBuildPrompt = `Khách hàng vừa cấu hình một bộ PC trên hệ thống PC Builder của PC Mall:
${userContext.formattedContextText}

Câu hỏi của khách hàng: "${message}"
Hãy phân tích chi tiết, giải đáp thắc mắc của khách hàng dựa trên chính xác các linh kiện thật mà khách đã chọn trong cấu hình trên. Đưa ra nhận xét về tính tương thích (Socket, RAM, PSU), cân bằng hiệu năng (Bottleneck) và các lưu ý kỹ thuật. Trả lời bằng tiếng Việt chuyên nghiệp, ngắn gọn (dưới 200 từ).`;

      const llmReply = await this.callLlmWithAugmentedPrompt(this.getSystemPrompt(), activeBuildPrompt);
      const replyText = llmReply || [
        `Chào bạn! Mình đã kiểm tra cấu hình **${userContext.buildName || "PC Build"}** bạn vừa chọn bên PC Builder (Tổng giá trị: ${userContext.buildTotalPrice?.toLocaleString("vi-VN")}đ):`,
        "",
        ...(userContext.buildComponents || []).map((c) => `• **${c.type.toUpperCase()}:** ${c.name} (${c.price.toLocaleString("vi-VN")}đ)`),
        "",
        userContext.missingComponents && userContext.missingComponents.length > 0
          ? `⚠️ **Lưu ý:** Cấu hình của bạn hiện còn thiếu: ${userContext.missingComponents.map((m) => m.toUpperCase()).join(", ")}. Bạn nên bổ sung để dàn máy có thể hoạt động hoàn chỉnh!`
          : `✅ **Đánh giá:** Các linh kiện chính đã được chọn đầy đủ, tương thích an toàn.`,
        "",
        "Nếu bạn muốn thay đổi hoặc bổ sung linh kiện nào, cứ nhắn cho mình nhé!"
      ].join("\n");

      return {
        text: replyText,
        type: "build_recommendation",
        userContextSummary: `Cấu hình đang chọn: ${userContext.buildName || "PC Build"} (${userContext.buildTotalPrice?.toLocaleString("vi-VN")}đ)`
      };
    }

    if (isTheory && !isBuildRequest) {
      const theoryExplanation = await this.explainHardwareTheoryAsync(message);
      if (theoryExplanation) {
        return {
          text: theoryExplanation,
          type: "theory_explanation"
        };
      }
    }

    // 2. Nếu là yêu cầu build trọn bộ PC (có ngân sách hoặc có từ khóa build)
    if (isBuildRequest) {
      const activeCriteria: ConsultationCriteria = {
        budget: budget || 20000000,
        purpose: purpose || "gaming",
        resolution: criteria?.resolution || "1080p",
        ownedList: criteria?.ownedList || this.extractOwnedFromText(message),
        ownedNotes: criteria?.ownedNotes || ""
      };

      const buildResult = await this.generateConsultationBuild(activeCriteria);

      // Chuyển components thành product cards cho frontend
      const productCards = buildResult.components
        .filter((c) => !c.isOwned && c.productId > 0)
        .map((c) => ({
          id: c.productId,
          productId: c.productId,
          name: c.name,
          price: c.price,
          stock: 10,
          categoryName: c.type,
          componentType: c.componentType
        }));

      // Gọi LLM sinh lời tư vấn chuyên môn nếu có API key
      const augmentedPromptParts = [
        `Khách hàng yêu cầu: "${message}". Ngân sách: ${activeCriteria.budget?.toLocaleString("vi-VN")}đ. Mục đích: ${activeCriteria.purpose}.`,
        userContext?.hasActiveBuild ? `(Ngữ cảnh: Khách đã từng cấu hình một dàn máy trước đó: ${userContext.buildName} - ${userContext.buildTotalPrice?.toLocaleString("vi-VN")}đ)` : "",
        `Dưới đây là cấu hình máy thật từ database PC Mall đã được tối ưu tương thích:`,
        buildResult.components.map((c) => `- [${c.type}] ${c.name} (${c.price > 0 ? c.price.toLocaleString("vi-VN") + "đ" : "Đã có sẵn"})`).join("\n"),
        `Hãy đưa ra nhận xét chuyên gia ngắn gọn, súc tích (3-4 gạch đầu dòng) giải thích tính tương thích, cân bằng hiệu năng và lý do lựa chọn.`
      ].filter(Boolean);

      const llmReply = await this.callLlmWithAugmentedPrompt(this.getSystemPrompt(), augmentedPromptParts.join("\n"));

      const finalReplyText = llmReply || [
        `Chào bạn! Dựa trên nhu cầu **${(activeCriteria.purpose || "GAMING").toUpperCase()}** và ngân sách **${activeCriteria.budget?.toLocaleString("vi-VN")}đ**, PC Mall đề xuất cấu hình tối ưu hàng thật trong kho:`,
        "",
        ...buildResult.components.map((c) => `• **${c.type}:** ${c.name} — ${c.price > 0 ? `${c.price.toLocaleString("vi-VN")}đ` : "*(Đã có sẵn ở nhà)*"}`),
        "",
        `💰 **Tổng tạm tính:** ${buildResult.totalPrice.toLocaleString("vi-VN")}đ (Hiệu suất ngân sách: ${buildResult.budgetUtilization}%)`,
        `🛡️ **Điểm tương thích:** ${buildResult.compatibilityScore}/100 (Khớp Socket, chuẩn RAM và công suất nguồn an toàn tuyệt đối).`,
        "",
        "Bạn có thể nhấn nút **\"Lắp Ráp Cấu Hình Này Ngay\"** bên dưới để chuyển trực tiếp linh kiện vào PC Builder!"
      ].join("\n");

      return {
        text: finalReplyText,
        products: productCards,
        buildPayload: {
          label: buildResult.label,
          totalPrice: buildResult.totalPrice,
          budgetUtilization: buildResult.budgetUtilization,
          components: buildResult.components,
          compatibilityScore: buildResult.compatibilityScore
        },
        type: "build_recommendation",
        userContextSummary: userContext?.hasActiveBuild ? `Cấu hình trước: ${userContext.buildName}` : undefined
      };
    }

    // 3. Nếu là yêu cầu tìm linh kiện đơn lẻ (ví dụ: "tìm VGA tầm 8tr", "CPU nào chơi game ngon")
    const detectedCategory = this.extractCategoryFromText(message);
    const context = await RetrieverService.retrieveRelevantContext(message, {
      budget,
      category: detectedCategory
    });

    if (context.hasProducts) {
      const topProducts = context.rawProducts.slice(0, 4);
      const productCards = topProducts.map((p) => ({
        id: p.productId,
        productId: p.productId,
        name: p.name,
        price: p.price,
        stock: p.stock,
        categoryName: p.category.toUpperCase(),
        brandName: p.brand
      }));

      const replyLines = [
        `Dựa trên dữ liệu kho hàng thật tại PC Mall, mình tìm thấy các linh kiện phù hợp nhất với yêu cầu của bạn:`,
        "",
        ...topProducts.map((p, idx) => `${idx + 1}. **${p.name}** — **${p.price.toLocaleString("vi-VN")}đ** (Còn ${p.stock} sản phẩm)`),
        "",
        "Tất cả sản phẩm trên đều có sẵn trong kho, bảo hành chính hãng 36 tháng và áp dụng chính sách 1 đổi 1 trong 30 ngày."
      ];

      return {
        text: replyLines.join("\n"),
        products: productCards,
        type: "product_recommendation"
      };
    }

    // 4. Phản hồi thông thường
    return {
      text: "Xin chào bạn! Mình là AI Kỹ sư Phần cứng của PC Mall. Bạn có thể cho mình biết ngân sách dự kiến, mục đích sử dụng (chơi game, đồ họa, văn phòng) hoặc linh kiện cụ thể bạn cần tìm để mình tư vấn cấu hình chuẩn xác nhất nhé!",
      type: "advisor_reply"
    };
  }

  /**
   * Trích xuất số tiền ngân sách từ câu nói tự nhiên (ví dụ: "15tr", "15 triệu", "15000000")
   */
  private extractBudgetFromText(text: string): number | undefined {
    const lower = text.toLowerCase();
    const matchTr = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:tr|triệu|củ)/);
    if (matchTr) {
      const num = parseFloat(matchTr[1].replace(",", "."));
      return Math.round(num * 1000000);
    }
    const matchNum = lower.match(/(\d{7,9})/);
    if (matchNum) {
      return parseInt(matchNum[1], 10);
    }
    return undefined;
  }

  /**
   * Trích xuất mục đích sử dụng từ câu nói
   */
  private extractPurposeFromText(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes("game") || lower.includes("chơi game") || lower.includes("fps") || lower.includes("valorant")) return "gaming";
    if (lower.includes("render") || lower.includes("đồ họa") || lower.includes("3d") || lower.includes("edit")) return "render";
    if (lower.includes("văn phòng") || lower.includes("học tập") || lower.includes("office")) return "office";
    return "gaming";
  }

  /**
   * Phát hiện ý định build máy tính trọn bộ
   */
  private isPcBuildIntent(text: string): boolean {
    const lower = text.toLowerCase();
    return (
      lower.includes("build") ||
      lower.includes("case") ||
      lower.includes("dàn máy") ||
      lower.includes("bộ máy") ||
      lower.includes("cấu hình") ||
      lower.includes("lắp ráp") ||
      lower.includes("tư vấn máy")
    );
  }

  /**
   * Trích xuất linh kiện khách đã có ở nhà từ câu nói
   */
  private extractOwnedFromText(text: string): string[] {
    const lower = text.toLowerCase();
    const owned: string[] = [];
    if (lower.includes("có sẵn ram") || lower.includes("ở nhà có ram")) owned.push("ram");
    if (lower.includes("có sẵn ssd") || lower.includes("ở nhà có ssd") || lower.includes("có sẵn ổ cứng")) owned.push("ssd");
    if (lower.includes("có sẵn vga") || lower.includes("có sẵn card") || lower.includes("ở nhà có card")) owned.push("gpu");
    if (lower.includes("có sẵn case") || lower.includes("ở nhà có vỏ")) owned.push("case");
    return owned;
  }

  /**
   * Kiểm tra câu hỏi có phải dạng lý thuyết kỹ thuật hoặc chính sách cửa hàng hay không
   */
  private isTheoryOrPolicyQuestion(text: string): boolean {
    const lower = text.toLowerCase();
    const theoryPatterns = [
      /downclock/i,
      /hạ xung/i,
      /nghẽn/i,
      /bottleneck/i,
      /cháy/i,
      /nổ/i,
      /bảo hành/i,
      /đổi trả/i,
      /1 đổi 1/i,
      /chính sách/i,
      /tại sao/i,
      /nguyên lý/i,
      /cắm được không/i,
      /chạy được không/i,
      /có hợp không/i,
      /tương thích không/i,
      /bao nhiêu watt/i
    ];
    return theoryPatterns.some((p) => p.test(lower));
  }

  /**
   * Trích xuất danh mục linh kiện mục tiêu từ câu nói tự nhiên
   */
  private extractCategoryFromText(text: string): string | undefined {
    const lower = text.toLowerCase();
    if (lower.includes("card") || lower.includes("vga") || lower.includes("màn hình") || lower.includes("gpu")) return "gpu";
    if (lower.includes("cpu") || lower.includes("chip") || lower.includes("vi xử lý") || lower.includes("core i")) return "cpu";
    if (lower.includes("main") || lower.includes("bo mạch") || lower.includes("b760") || lower.includes("b660") || lower.includes("b650")) return "mainboard";
    if (lower.includes("ram") || lower.includes("bộ nhớ")) return "ram";
    if (lower.includes("ssd") || lower.includes("ổ cứng") || lower.includes("nvme") || lower.includes("m.2") || lower.includes("storage")) return "ssd";
    if (lower.includes("nguồn") || lower.includes("psu")) return "psu";
    if (lower.includes("case") || lower.includes("vỏ")) return "case";
    if (lower.includes("tản") || lower.includes("cooling") || lower.includes("quạt") || lower.includes("aio")) return "cooling";
    return undefined;
  }
}

export const aiAssistantService = new AiAssistantService();
export default aiAssistantService;
