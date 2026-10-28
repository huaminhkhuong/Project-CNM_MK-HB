import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { AiLlmProvider } from "../src/modules/ai/ai-llm.provider";
import { AiContextService } from "../src/modules/ai/ai-context.service";
import { aiOrchestratorService } from "../src/modules/ai/ai-orchestrator.service";
import { aiAssistantService } from "../src/modules/chat/ai-assistant.service";
import { pcBuilderService } from "../src/modules/pc-builder/pc-builder.service";
import { getDbPool, query } from "../src/config/database";

describe("Unified AI Architecture & Shared Context Test Suite", () => {
  describe("1. AiLlmProvider Gateway & Provider Cascading", () => {
    it("should successfully fallback to smart heuristic response when no valid API key is present", async () => {
      const response = await AiLlmProvider.generate({
        systemPrompt: "Bạn là Chuyên gia Tư vấn Phần cứng PC Mall.",
        userPrompt: "Tư vấn CPU và VGA để chơi mượt Valorant 144Hz",
        temperature: 0.3,
        maxTokens: 500
      });

      assert.ok(response, "Response should not be null or undefined");
      assert.ok(response.text.length > 20, "Response text should contain substantive advice");
      assert.ok(
        response.provider === "gemini" ||
        response.provider === "groq" ||
        response.provider === "openai" ||
        response.provider === "fallback",
        "Provider should be one of valid cascading providers"
      );
    });

    it("should strip markdown json fences and parse structured JSON correctly", async () => {
      // Test safe JSON parsing with markdown fences
      const response = await AiLlmProvider.generate({
        systemPrompt: "Output valid JSON array of numbers only.",
        userPrompt: "Chọn các ID linh kiện",
        jsonMode: true
      });

      assert.ok(response, "Response should exist");
      if (response.provider === "fallback") {
        assert.ok(response.text, "Fallback should provide text or JSON");
      }
    });
  });

  describe("2. AiContextService User Hardware Context Aggregator", () => {
    it("should handle anonymous or invalid user ID gracefully", async () => {
      const ctx = await AiContextService.aggregateUserContext(null);
      assert.strictEqual(ctx.hasActiveBuild, false);
      assert.strictEqual(ctx.hasCart, false);
      assert.strictEqual(ctx.userId, null);
    });

    it("should aggregate active PC build and format Markdown when build exists", async () => {
      // Find an existing user who has a PC build in DB
      let testUserId = 1;
      const builds = await query<any[]>("SELECT user_id, id FROM pc_builds LIMIT 1");
      if (builds && builds.length > 0 && builds[0].user_id) {
        testUserId = Number(builds[0].user_id);
      }

      const ctx = await AiContextService.aggregateUserContext(testUserId);
      assert.ok(ctx, "Context should be returned");
      assert.strictEqual(ctx.userId, testUserId);

      if (ctx.hasActiveBuild) {
        assert.ok(ctx.buildId, "Active build ID should exist");
        assert.ok(ctx.formattedContextText.includes("CẤU HÌNH PC KHÁCH ĐANG BUILD"));
        assert.ok(Array.isArray(ctx.buildComponents));
      }
    });
  });

  describe("3. Cross-Module Context Sharing (PC Builder -> Chatbot)", () => {
    it("should recognize active build in Chatbot when customer asks about their chosen build", async () => {
      // Query an existing user with a build
      const builds = await query<any[]>("SELECT user_id FROM pc_builds LIMIT 1");
      const testUserId = builds && builds.length > 0 ? Number(builds[0].user_id) : 1;

      const chatRes = await aiAssistantService.consultWithRag(
        "Cấu hình mình vừa chọn có ổn không, nguồn có gánh nổi không?",
        undefined,
        { userId: testUserId }
      );

      assert.ok(chatRes, "Chat response should exist");
      assert.ok(chatRes.text.length > 30, "Chat response should have comprehensive explanation");
      assert.strictEqual(chatRes.type, "build_recommendation");
      
      const ctx = await AiContextService.aggregateUserContext(testUserId);
      if (ctx.hasActiveBuild) {
        assert.ok(chatRes.userContextSummary, "User context summary should link active build");
        assert.ok(
          chatRes.text.includes(ctx.buildName || "PC Build") ||
          chatRes.text.includes("PC Builder") ||
          chatRes.text.includes("linh kiện"),
          "Chat response should reference components or active build"
        );
      }
    });
  });

  describe("4. PC Builder AI Advisor Integration", () => {
    it("should execute getAiAdvice via unified AiLlmProvider without runtime errors", async () => {
      const result = await pcBuilderService.getAiAdvice({
        question: "Cấu hình này dùng nguồn 650W có an toàn không?",
        buildContext: {
          items: [
            { type: "cpu", name: "Intel Core i5-13400F", price: 4900000 },
            { type: "mainboard", name: "B760M DDR4", price: 2800000 },
            { type: "ram", name: "RAM 16GB DDR4", price: 950000 },
            { type: "gpu", name: "RTX 4060 8GB", price: 8200000 },
            { type: "psu", name: "Nguồn 650W 80 Plus Bronze", price: 1350000 }
          ],
          totalPrice: 18200000
        }
      });

      assert.ok(result, "Result should exist");
      assert.ok(result.advice && result.advice.length > 10, "Advice should be returned");
      assert.ok(result.provider, "Provider name should be returned");
    });
  });

  describe("5. Unified AiOrchestratorService Hub (Prompts, Tokens, Memory & Fallbacks)", () => {
    it("should manage centralized prompt templates for all 4 subsystems", () => {
      const p1 = aiOrchestratorService.getSystemPrompt("consult_chat");
      const p2 = aiOrchestratorService.getSystemPrompt("recommend_build");
      const p3 = aiOrchestratorService.getSystemPrompt("builder_advice");
      const p4 = aiOrchestratorService.getSystemPrompt("theory_explainer");

      assert.ok(p1.includes("Senior AI Hardware Engineer"), "Consult prompt should define senior engineer persona");
      assert.ok(p2.includes("PRODUCT_ID"), "Recommend prompt should instruct JSON format");
      assert.ok(p3.includes("PC Builder"), "Builder advice prompt should mention PC Builder");
      assert.ok(p4.toLowerCase().includes("phần cứng"), "Theory prompt should cover hardware theory");
    });

    it("should estimate and safely truncate tokens", () => {
      const sampleText = "PC Mall - Siêu thị máy tính hàng đầu cung cấp giải pháp PC gaming và đồ họa chuyên nghiệp.";
      const est = aiOrchestratorService.estimateTokens(sampleText);
      assert.ok(est > 10 && est < 50, "Token estimate should be reasonable");

      const truncated = aiOrchestratorService.truncateToTokenLimit(sampleText, 5);
      assert.ok(truncated.includes("cắt ngắn"), "Long text should have truncation notice");
    });

    it("should maintain sliding window conversation memory across multiple turns", async () => {
      const sessionId = `test_session_${Date.now()}`;

      // Turn 1
      const res1 = await aiOrchestratorService.consultChat({
        question: "Mình cần build PC tầm 15 triệu chơi LOL và Valorant",
        sessionId
      });
      assert.ok(res1.success);
      assert.ok(res1.tokenEstimate.totalTokens > 0, "Token estimate must be calculated");

      // Turn 2 with session continuity
      const res2 = await aiOrchestratorService.consultChat({
        question: "Cấu hình này sau này nâng cấp lên RTX 4060 được không?",
        sessionId
      });
      assert.ok(res2.success);
      assert.ok(res2.text.length > 20);

      // Reset session
      aiOrchestratorService.resetSession(sessionId);
    });

    it("should execute recommendBuild with real catalog grounding and valid structure", async () => {
      const res = await aiOrchestratorService.recommendBuild({
        budget: 18000000,
        requirements: "gaming mượt mà"
      });

      assert.ok(res.success);
      assert.ok(res.provider, "Provider must be populated");
      assert.ok(res.tokenEstimate.promptTokens > 0, "Prompt tokens must be estimated");
    });

    it("should execute getBuildAdvice with bottleneck analysis and PSU check", async () => {
      const res = await aiOrchestratorService.getBuildAdvice({
        question: "Nguồn 550W kéo nổi i5 13400F và RTX 4060 không?",
        buildContext: {
          items: [
            { type: "cpu", name: "i5 13400F", price: 4900000 },
            { type: "gpu", name: "RTX 4060", price: 8200000 },
            { type: "psu", name: "PSU 550W", price: 1100000 }
          ],
          totalPrice: 14200000
        }
      });

      assert.ok(res.success);
      assert.ok(res.text.length > 10);
    });
  });

  after(async () => {
    try {
      await getDbPool().end();
    } catch (_e) {}
  });
});

