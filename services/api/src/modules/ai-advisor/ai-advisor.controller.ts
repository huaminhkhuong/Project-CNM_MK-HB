import { Request, Response } from "express";
import { AppError } from "../../errors/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { env } from "../../config/env";
import pcBuilderService from "../pc-builder/pc-builder.service";

function detectUseCase(requirements: string): string {
  const req = (requirements || "").toLowerCase();
  if (/game|gaming|chơi game|fps|esport|pubg|lol|valorant/i.test(req)) return "gaming";
  if (/render|3d|blender|video|dựng phim|đồ họa|design/i.test(req)) return "render";
  if (/văn phòng|office|word|excel|học|sinh viên/i.test(req)) return "office";
  if (/lập trình|code|dev|programming|work|workstation/i.test(req)) return "workstation";
  if (/tiết kiệm|rẻ|budget|giới hạn/i.test(req)) return "gaming";
  return "gaming";
}

export const suggestBuild = asyncHandler(async (req: Request, res: Response) => {
  const { requirements, budget, resolution, preference, futureNeed } = req.body;
  const numericBudget = Number(budget);

  if (!requirements || !Number.isFinite(numericBudget) || numericBudget <= 0) {
    throw new AppError("Vui lòng cung cấp 'requirements' và 'budget' hợp lệ", 400);
  }

  const useCase = detectUseCase(String(requirements));

  // Delegate directly to the Unified PC Builder Engine (Rule Engine + 100% DB Compatibility Verification)
  const buildResult = await pcBuilderService.suggestBuild({
    budget: numericBudget,
    useCase,
    resolution: resolution || "1080p",
    preference: preference || "value",
    futureNeed: futureNeed || "none"
  });

  const bestVal = buildResult.candidates?.bestValue || buildResult;
  const items = Object.entries(bestVal.components || {}).map(([type, item]: [string, any]) => ({
    componentType: type,
    product: {
      id: item.productId || item.variantId,
      name: item.name || item.productName,
      categoryName: item.categoryName || type
    },
    variant: {
      id: item.variantId,
      sku: `SKU-${item.variantId}`,
      price: Number(item.price || 0),
      imageUrl: item.imageUrl || null
    },
    explanation: item.explanation || ""
  }));

  let customAiAdvice: string | null = null;
  try {
    const { unifiedLlmService } = require("../ai/unified-llm.service");
    const summaryText = items
      .map((i) => `${i.componentType.toUpperCase()}: ${i.product.name} (${Number(i.variant.price).toLocaleString("vi-VN")}đ)`)
      .join("\n");
    const promptText = `Bạn là chuyên gia tư vấn phần cứng PC Mall. Hãy đưa ra 1 đoạn nhận xét ngắn gọn (khoảng 3 câu), súc tích về hiệu năng tổng thể và khả năng nâng cấp của bộ PC sau:
Ngân sách: ${numericBudget.toLocaleString("vi-VN")}đ. Nhu cầu: ${requirements}.
Danh sách linh kiện đã được kiểm tra 100% tương thích phần cứng:
${summaryText}`;

    const aiRes = await unifiedLlmService.generateText({
      prompt: promptText,
      temperature: 0.3,
      maxTokens: 350
    });
    if (aiRes.text && !aiRes.isBlocked) {
      customAiAdvice = aiRes.text;
    }
  } catch (_err) {
    // LLM failure is non-blocking in Hybrid architecture
  }

  const defaultExplanation =
    `🤖 AI Engine đã tối ưu cấu hình ${useCase.toUpperCase()} với tổng ngân sách ${Number(bestVal.totalPrice || numericBudget).toLocaleString("vi-VN")}đ. ` +
    `Toàn bộ linh kiện đảm bảo 100% tương thích socket, chuẩn RAM, TDP và công suất nguồn.`;

  res.status(200).json({
    success: true,
    data: {
      budget: numericBudget,
      totalPrice: bestVal.totalPrice,
      useCase,
      explanation: customAiAdvice || defaultExplanation,
      items,
      candidates: buildResult.candidates,
      tradeoffs: buildResult.tradeoffs || [],
      whatIfSimulation: buildResult.whatIfSimulation,
      compatibilityReport: bestVal.compatibilityReport,
      mode: openAiApiKey && customAiAdvice ? "hybrid-llm-engine" : "hybrid-rule-engine"
    }
  });
});
