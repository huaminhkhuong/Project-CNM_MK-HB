import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { AiLlmProvider, LlmResponse } from "./ai-llm.provider";
import { AiContextService, UserHardwareContext } from "./ai-context.service";
import { RetrieverService } from "./retriever.service";

export interface ConversationTurn {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

export interface OrchestratorConsultOptions {
  question: string;
  sessionId?: string;
  userId?: number | null;
  history?: ConversationTurn[];
  criteria?: {
    purpose?: string;
    budget?: number;
    resolution?: string;
    ownedList?: string[];
  };
}

export interface OrchestratorRecommendOptions {
  budget: number;
  requirements?: string;
  useCase?: string;
  userId?: number | null;
  excludedTypes?: string[];
  colorScheme?: string;
  caseStyle?: string;
}

export interface OrchestratorAdviceOptions {
  question: string;
  buildContext: {
    items?: any[];
    totalPrice?: number;
    budget?: number;
    [key: string]: any;
  };
  userId?: number | null;
}

export interface OrchestratedResponse<T = any> {
  success: boolean;
  text: string;
  data?: T;
  parsedJson?: any;
  provider: "gemini" | "groq" | "openai" | "fallback";
  model: string;
  tokenEstimate: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  userContextSummary?: string;
  sessionId?: string;
}

/**
 * In-Memory Conversation History Manager with Sliding Window & TTL
 */
class ConversationHistoryManager {
  private sessions = new Map<string, { turns: ConversationTurn[]; lastUpdated: number }>();
  private readonly MAX_TURNS = 10;
  private readonly TTL_MS = 60 * 60 * 1000; // 1 hour

  public getHistory(sessionId: string): ConversationTurn[] {
    this.cleanExpired();
    const entry = this.sessions.get(sessionId);
    return entry ? entry.turns : [];
  }

  public recordTurn(sessionId: string, turn: ConversationTurn): void {
    let entry = this.sessions.get(sessionId);
    if (!entry) {
      entry = { turns: [], lastUpdated: Date.now() };
      this.sessions.set(sessionId, entry);
    }
    entry.turns.push({ ...turn, timestamp: Date.now() });
    if (entry.turns.length > this.MAX_TURNS) {
      entry.turns = entry.turns.slice(-this.MAX_TURNS);
    }
    entry.lastUpdated = Date.now();
  }

  public clear(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, value] of this.sessions.entries()) {
      if (now - value.lastUpdated > this.TTL_MS) {
        this.sessions.delete(key);
      }
    }
  }
}

/**
 * Unified AI Orchestrator Service
 * Centralizes Prompt Management, Token Optimization, Conversation Memory,
 * and Multi-tier Fallback for all 4 AI subsystems (Chat, Advisor, PC Builder, Explainability).
 */
export class AiOrchestratorService {
  private static instance: AiOrchestratorService;
  private historyManager = new ConversationHistoryManager();

  public static getInstance(): AiOrchestratorService {
    if (!AiOrchestratorService.instance) {
      AiOrchestratorService.instance = new AiOrchestratorService();
    }
    return AiOrchestratorService.instance;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. CENTRALIZED SYSTEM PROMPTS
  // ─────────────────────────────────────────────────────────────────────────────
  public getSystemPrompt(capability: "consult_chat" | "recommend_build" | "builder_advice" | "theory_explainer"): string {
    switch (capability) {
      case "consult_chat":
        return [
          "Bạn là Senior AI Hardware Engineer của PC Mall - Siêu thị máy tính và linh kiện PC hàng đầu Việt Nam.",
          "Nhiệm vụ: Tư vấn cấu hình PC và giải đáp kỹ thuật chuẩn xác theo đúng nhu cầu & ngân sách khách hàng.",
          "Nguyên tắc cốt lõi:",
          "1. Tương thích 100%: CPU & Mainboard phải cùng socket, chuẩn RAM (DDR4/DDR5) khớp Mainboard, PSU đủ công suất an toàn.",
          "2. Dữ liệu thực: Chỉ gợi ý các linh kiện có thật trong kho hàng của PC Mall, bám sát giá trị thực tế.",
          "3. Tôn trọng linh kiện sẵn có: Nếu khách hàng đã có linh kiện ở nhà, hãy tối ưu ngân sách mua mới cho các linh kiện còn lại.",
          "4. Phong cách: Ngắn gọn, chuyên nghiệp, tiếng Việt chuẩn mực, có giải thích kỹ thuật dễ hiểu."
        ].join(" ");

      case "recommend_build":
        return [
          "Bạn là Chuyên gia Lựa chọn Cấu hình PC Mall.",
          "Dựa trên danh sách sản phẩm và ngân sách được cung cấp, hãy lựa chọn cấu hình tối ưu nhất.",
          "Output BẮT BUỘC là một JSON array chứa các PRODUCT_ID dạng số nguyên, ví dụ: [101, 102, 103, 104, 105, 106, 107].",
          "Không trả về text phụ, markdown khác ngoài mảng JSON."
        ].join(" ");

      case "builder_advice":
        return [
          "Bạn là Chuyên gia Tư vấn Phần cứng PC Mall AI Advisor tích hợp trong công cụ PC Builder.",
          "Hãy phân tích cấu hình người dùng đang dựng, chỉ ra điểm tối ưu, điểm nghẽn (bottleneck) hoặc gợi ý nâng cấp cần thiết.",
          "Trả lời ngắn gọn bằng tiếng Việt dưới 150 từ, bám sát 100% linh kiện thực tế được cung cấp."
        ].join(" ");

      case "theory_explainer":
        return [
          "Bạn là Kỹ sư Trưởng Phòng Công nghệ PC Mall.",
          "Giải thích thắc mắc lý thuyết Phần cứng máy tính (cơ chế RAM downclocking, chuẩn PCIe, TDP nguồn, bottleneck) một cách khoa học, thực tế và dễ hiểu."
        ].join(" ");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. TOKEN MANAGEMENT & ESTIMATION HELPERS
  // ─────────────────────────────────────────────────────────────────────────────
  public estimateTokens(text: string): number {
    if (!text) return 0;
    // Heuristic: ~4 characters per token in multi-lingual Vietnamese/English text
    return Math.ceil(text.length / 3.8);
  }

  public truncateToTokenLimit(text: string, maxTokens: number): string {
    const est = this.estimateTokens(text);
    if (est <= maxTokens) return text;
    const maxChars = Math.floor(maxTokens * 3.8);
    return text.substring(0, maxChars) + "... [cắt ngắn để tối ưu ngữ cảnh]";
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. CAPABILITY 1: UNIFIED CHAT & CONSULTATION (Customer Chatbot + RAG)
  // ─────────────────────────────────────────────────────────────────────────────
  public async consultChat(options: OrchestratorConsultOptions): Promise<OrchestratedResponse> {
    const { question, sessionId, userId, criteria } = options;
    const cleanQ = (question || "").trim();

    // 1. Aggregate User Context (Active Build, Cart)
    let userContext: UserHardwareContext | null = null;
    if (userId) {
      try {
        userContext = await AiContextService.aggregateUserContext(Number(userId));
      } catch (_e) {}
    }

    // 2. Retrieve Conversation Memory
    let historyTurns: ConversationTurn[] = [];
    if (sessionId) {
      historyTurns = this.historyManager.getHistory(sessionId);
    } else if (options.history) {
      historyTurns = options.history.slice(-8);
    }

    // 3. RAG Knowledge Lookup
    let retrievedTheory: string | null = null;
    try {
      const knowledgeItems = await RetrieverService.searchDomainKnowledge(cleanQ, {
        topK: 2,
        minScore: 0.25
      });
      if (knowledgeItems.length > 0) {
        retrievedTheory = knowledgeItems[0].text
          .replace(/^\[Tài liệu:[^\]]+\]\s*/i, "")
          .replace(/^##\s+[^\n]+\n/, "")
          .trim();
      }
    } catch (_ragErr) {}

    // 4. Construct Prompt
    const historyText = historyTurns
      .map((t) => `${t.role === "user" ? "Khách hàng" : "AI"}: ${t.content}`)
      .join("\n");

    const promptParts = [
      this.getSystemPrompt("consult_chat"),
      userContext?.hasActiveBuild ? `\n${userContext.formattedContextText}` : "",
      retrievedTheory ? `\n[Tài liệu Kỹ thuật PC Mall]:\n${this.truncateToTokenLimit(retrievedTheory, 300)}` : "",
      historyText ? `\n[Lịch sử trao đổi gần nhất]:\n${this.truncateToTokenLimit(historyText, 400)}` : "",
      criteria?.budget ? `\nNgân sách: ${Number(criteria.budget).toLocaleString("vi-VN")} VNĐ` : "",
      criteria?.purpose ? `\nMục đích sử dụng: ${criteria.purpose}` : "",
      criteria?.ownedList && criteria.ownedList.length > 0 ? `\nLinh kiện khách đã có sẵn ở nhà: ${criteria.ownedList.join(", ")}` : "",
      `\nKhách hàng hỏi: "${cleanQ}"\nHãy đưa ra câu trả lời chi tiết, tận tâm và chính xác:`
    ].filter(Boolean);

    const userPrompt = promptParts.join("\n");
    const promptTokens = this.estimateTokens(userPrompt);

    // 5. Execute with Cascading Providers (Gemini -> Groq -> OpenAI -> Smart Heuristics)
    const llmRes = await AiLlmProvider.generate({
      systemPrompt: this.getSystemPrompt("consult_chat"),
      userPrompt,
      temperature: 0.3,
      maxTokens: 800,
      timeoutMs: 8500
    });

    const completionTokens = this.estimateTokens(llmRes.text);

    // 6. Record turn in conversation memory
    if (sessionId) {
      this.historyManager.recordTurn(sessionId, { role: "user", content: cleanQ });
      this.historyManager.recordTurn(sessionId, { role: "assistant", content: llmRes.text });
    }

    return {
      success: llmRes.success,
      text: llmRes.text,
      provider: llmRes.provider,
      model: llmRes.model,
      tokenEstimate: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      },
      userContextSummary: userContext?.hasActiveBuild ? `Cấu hình trước: ${userContext.buildName}` : undefined,
      sessionId
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. CAPABILITY 2: BUILD RECOMMENDATION (Budget & Ground-Truth Allocation)
  // ─────────────────────────────────────────────────────────────────────────────
  public async recommendBuild(options: OrchestratorRecommendOptions): Promise<OrchestratedResponse> {
    const { budget, requirements = "gaming", userId, excludedTypes, colorScheme, caseStyle } = options;
    const numericBudget = Math.max(5000000, Number(budget) || 20000000);

    let userContext: UserHardwareContext | null = null;
    if (userId) {
      try {
        userContext = await AiContextService.aggregateUserContext(Number(userId));
      } catch (_e) {}
    }

    // Query real active inventory from MySQL
    const products = await prisma.product.findMany({
      where: { is_active: true },
      include: {
        Category: { select: { name: true } },
        ProductSku: {
          take: 1,
          orderBy: { id: "asc" },
          where: { is_active: true, stock: { gt: 0 } }
        }
      },
      orderBy: { category_id: "asc" },
      take: 80
    });

    const productsCatalogText = products
      .filter((p) => (p.ProductSku?.length || 0) > 0)
      .map((p) => {
        const sku = p.ProductSku[0];
        const cat = p.Category?.name || "Khác";
        const price = Number(sku.price || p.price || 0);
        return `[ID: ${p.id}] ${p.name} | Loại: ${cat} | Giá: ${price.toLocaleString("vi-VN")}đ | SKU: ${sku.sku}`;
      })
      .join("\n");

    const prompt = [
      `Danh mục sản phẩm trong kho:`,
      this.truncateToTokenLimit(productsCatalogText, 1500),
      `Ngân sách khách hàng: ${numericBudget.toLocaleString("vi-VN")} VNĐ`,
      `Yêu cầu: ${requirements}`,
      excludedTypes && excludedTypes.length > 0 ? `Linh kiện đã có sẵn (bỏ qua): ${excludedTypes.join(", ")}` : "",
      userContext?.hasActiveBuild ? `Khách có cấu hình dở dang: ${userContext.buildName}` : "",
      `Hãy chọn 1 dàn máy tối ưu (CPU, Mainboard, RAM, GPU, Storage, PSU, Case, Cooling).`,
      `Output CHỈ là mảng JSON số nguyên PRODUCT_ID (VD: [12, 18, 25, 34, 45, 52, 60]).`
    ].filter(Boolean).join("\n\n");

    const promptTokens = this.estimateTokens(prompt);

    const llmRes = await AiLlmProvider.generate({
      systemPrompt: this.getSystemPrompt("recommend_build"),
      userPrompt: prompt,
      temperature: 0.2,
      jsonMode: true,
      maxTokens: 400
    });

    const completionTokens = this.estimateTokens(llmRes.text);

    return {
      success: llmRes.success,
      text: llmRes.text,
      data: llmRes.parsedJson,
      parsedJson: llmRes.parsedJson,
      provider: llmRes.provider,
      model: llmRes.model,
      tokenEstimate: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      },
      userContextSummary: userContext?.hasActiveBuild ? `Cấu hình trước: ${userContext.buildName}` : undefined
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. CAPABILITY 3: PC BUILDER REALTIME ADVICE (Live Build Evaluation)
  // ─────────────────────────────────────────────────────────────────────────────
  public async getBuildAdvice(options: OrchestratorAdviceOptions): Promise<OrchestratedResponse> {
    const { question, buildContext, userId } = options;
    const cleanQ = (question || "").trim() || "Cấu hình này có ổn không và nên lưu ý gì?";
    const items = Array.isArray(buildContext?.items) ? buildContext.items : [];
    const totalPrice = Number(buildContext?.totalPrice || 0);

    const itemsStr = items.length > 0
      ? items.map((i: any) => `- ${i.type || i.componentType || 'Linh kiện'}: ${i.name || i.productName} (${Number(i.price || 0).toLocaleString("vi-VN")}đ)`).join("\n")
      : "Chưa chọn linh kiện.";

    const prompt = [
      `Cấu hình PC khách đang chọn trong PC Builder:`,
      itemsStr,
      `- Tổng giá trị: ${totalPrice.toLocaleString("vi-VN")} VNĐ`,
      `Câu hỏi khách hàng: "${cleanQ}"`,
      `Hãy phân tích về tính tương thích, độ nghẽn cổ chai (bottleneck), nguồn điện PSU và đưa ra lời khuyên kỹ thuật ngắn gọn:`
    ].join("\n");

    const promptTokens = this.estimateTokens(prompt);

    const llmRes = await AiLlmProvider.generate({
      systemPrompt: this.getSystemPrompt("builder_advice"),
      userPrompt: prompt,
      temperature: 0.4,
      maxTokens: 450,
      timeoutMs: 8000
    });

    const completionTokens = this.estimateTokens(llmRes.text);

    return {
      success: llmRes.success,
      text: llmRes.text,
      provider: llmRes.provider,
      model: llmRes.model,
      tokenEstimate: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. CLEAR CONVERSATION SESSION
  // ─────────────────────────────────────────────────────────────────────────────
  public resetSession(sessionId: string): void {
    this.historyManager.clear(sessionId);
  }
}

export const aiOrchestratorService = AiOrchestratorService.getInstance();
export default aiOrchestratorService;
