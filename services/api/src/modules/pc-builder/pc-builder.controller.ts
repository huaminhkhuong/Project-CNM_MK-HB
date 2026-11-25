import { Request, Response } from "express";
import { sendSuccess } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import pcBuilderService from "./pc-builder.service";

function getAuthUserId(req: Request) {
  const rawUserId = (req as any)?.user?.userId;
  if (!rawUserId) {
    throw new Error("Authenticated user id is missing");
  }
  return Number(rawUserId);
}

/**
 * Controller for PC Builder module.
 * Maps HTTP requests to service layer methods.
 */
export const createBuild = asyncHandler(async (req: Request, res: Response) => {
  const result = await pcBuilderService.createBuild(getAuthUserId(req), req.body || {});
  return sendSuccess(res, "PC build created successfully", result, 201);
});

export const getCurrentBuild = asyncHandler(async (req: Request, res: Response) => {
  const result = await pcBuilderService.getCurrentBuild(getAuthUserId(req));
  return sendSuccess(res, "Current PC build fetched successfully", result);
});

export const addBuildItem = asyncHandler(async (req: Request, res: Response) => {
  const result = await pcBuilderService.upsertBuildItem(getAuthUserId(req), req.params.buildId, req.body || {});
  return sendSuccess(res, "PC build item added successfully", result, 201);
});

export const getBuildDetail = asyncHandler(async (req: Request, res: Response) => {
  const result = await pcBuilderService.getBuildDetail(getAuthUserId(req), req.params.buildId);
  return sendSuccess(res, "PC build detail fetched successfully", result);
});

export const removeBuildItem = asyncHandler(async (req: Request, res: Response) => {
  const result = await pcBuilderService.removeBuildItem(getAuthUserId(req), req.params.buildId, req.params.componentType);
  return sendSuccess(res, "PC build item removed successfully", result);
});

export const saveBuild = asyncHandler(async (req: Request, res: Response) => {
  const result = await pcBuilderService.saveBuild(getAuthUserId(req), req.params.buildId, req.body || {});
  return sendSuccess(res, "PC build saved successfully", result);
});

export const suggestBuild = asyncHandler(async (req: Request, res: Response) => {
  const result = await pcBuilderService.suggestBuild(req.body || {});
  return sendSuccess(res, "PC build suggestion generated successfully", result);
});

export const checkRawCompatibility = asyncHandler(async (req: Request, res: Response) => {
  const result = await pcBuilderService.checkRawCompatibility(req.body || {});
  return sendSuccess(res, "PC build compatibility checked successfully", result);
});

export const getMyBuilds = asyncHandler(async (req: Request, res: Response) => {
  const result = await pcBuilderService.getMyBuilds(getAuthUserId(req));
  return sendSuccess(res, "Saved PC builds fetched successfully", result);
});

export const publishBuild = asyncHandler(async (req: Request, res: Response) => {
  const result = await pcBuilderService.publishBuild(getAuthUserId(req), req.params.buildId);
  return sendSuccess(res, "PC build published successfully", result);
});

export const getSharedBuild = asyncHandler(async (req: Request, res: Response) => {
  const result = await pcBuilderService.getSharedBuild(req.params.shareToken);
  return sendSuccess(res, "Shared PC build fetched successfully", result);
});

export const cloneBuild = asyncHandler(async (req: Request, res: Response) => {
  const result = await pcBuilderService.cloneBuild(getAuthUserId(req), req.params.buildId);
  return sendSuccess(res, "PC build cloned successfully", result, 201);
});

export const getAiAdvice = asyncHandler(async (req: Request, res: Response) => {
  const result = await pcBuilderService.getAiAdvice(req.body || {});
  return sendSuccess(res, "AI advice generated successfully", result);
});

export const streamAiSuggestBuild = async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // TẦNG 1: Kiểm tra quy tắc lọc đầu vào BUILDER_SUGGEST
    const { aiRuleService } = require("../ai/ai-rule.service");
    const userCustomPrompt = String(req.body?.customPrompt || req.body?.rawPrompt || req.body?.promptText || "");
    const evalResult = aiRuleService.evaluateInput("BUILDER_SUGGEST", userCustomPrompt, { budget: req.body?.budget });
    if (evalResult.handled && evalResult.action === "BLOCK") {
      sendEvent({
        type: "error",
        error: evalResult.reply || "Yêu cầu cấu hình không hợp lệ."
      });
      res.end();
      return;
    }

    const rulePromptInjection = Array.isArray(evalResult.promptInjections)
      ? evalResult.promptInjections.join("\n")
      : (evalResult.promptInjection || "");

    await pcBuilderService.streamAiSuggestBuild(
      { ...(req.body || {}), rulePromptInjection },
      (chunk: string) => sendEvent({ type: "chunk", text: chunk }),
      sendEvent
    );
  } catch (err: any) {
    sendEvent({ type: "error", error: err.message || "Lỗi xử lý AI suggest stream" });
  } finally {
    res.end();
  }
};

export const streamAiAuditBuild = async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { aiRuleService } = require("../ai/ai-rule.service");
    const auditContextText = JSON.stringify(req.body?.buildItems || []);
    const evalResult = aiRuleService.evaluateInput("BUILDER_AUDIT_CHAT", auditContextText, req.body || {});
    const rulePromptInjection = Array.isArray(evalResult.promptInjections)
      ? evalResult.promptInjections.join("\n")
      : (evalResult.promptInjection || "");

    await pcBuilderService.streamAiAuditBuild(
      { ...(req.body || {}), rulePromptInjection },
      (chunk: string) => sendEvent({ type: "chunk", text: chunk }),
      sendEvent
    );
  } catch (err: any) {
    sendEvent({ type: "error", error: err.message || "Lỗi xử lý AI audit stream" });
  } finally {
    res.end();
  }
};

export const streamAiChatBuild = async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // TẦNG 1: Kiểm tra quy tắc lọc đầu vào BUILDER_AUDIT_CHAT (kèm fallback FAQ / Guardrail từ GENERAL_CHAT)
    const { aiRuleService } = require("../ai/ai-rule.service");
    let evalResult = aiRuleService.evaluateInput("BUILDER_AUDIT_CHAT", req.body?.userMessage || "", req.body || {});
    if (!evalResult.handled) {
      const generalEval = aiRuleService.evaluateInput("GENERAL_CHAT", req.body?.userMessage || "", req.body || {});
      if (generalEval.handled) {
        evalResult = generalEval;
      }
    }
    if (evalResult.handled && evalResult.action === "DIRECT_REPLY") {
      sendEvent({ type: "chunk", text: evalResult.reply });
      sendEvent({
        type: "done",
        reply: evalResult.reply,
        replacements: [],
        model: "system-local-faq"
      });
      res.end();
      return;
    }
    if (evalResult.handled && evalResult.action === "BLOCK") {
      sendEvent({
        type: "error",
        error: evalResult.reply || "Yêu cầu không thuộc phạm vi giám định."
      });
      res.end();
      return;
    }

    const rulePromptInjection = Array.isArray(evalResult.promptInjections)
      ? evalResult.promptInjections.join("\n")
      : (evalResult.promptInjection || "");

    await pcBuilderService.streamAiChatBuild(
      { ...(req.body || {}), rulePromptInjection },
      (chunk: string) => sendEvent({ type: "chunk", text: chunk }),
      sendEvent
    );
  } catch (err: any) {
    sendEvent({ type: "error", error: err.message || "Lỗi xử lý AI chat stream" });
  } finally {
    res.end();
  }
};

export const getRules = asyncHandler(async (_req: Request, res: Response) => {
  const result = pcBuilderService.getCentralizedRules();
  return sendSuccess(res, "Centralized rules fetched successfully", result);
});

export default {
  createBuild,
  getCurrentBuild,
  addBuildItem,
  getBuildDetail,
  removeBuildItem,
  saveBuild,
  suggestBuild,
  checkRawCompatibility,
  getMyBuilds,
  publishBuild,
  getSharedBuild,
  cloneBuild,
  getAiAdvice,
  streamAiSuggestBuild,
  streamAiAuditBuild,
  streamAiChatBuild,
  getRules
};
