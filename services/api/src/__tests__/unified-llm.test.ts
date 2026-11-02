import assert from "node:assert/strict";
import { describe, it } from "node:test";
// @ts-ignore
import { UnifiedLlmService, unifiedLlmService } from "../modules/ai/unified-llm.service";

describe("Unified LLM Adapter & Multi-Provider Strategy Test Suite", () => {
  it("UnifiedLlmService initializes with default provider and model", () => {
    const service = new UnifiedLlmService();
    const info = service.getProviderInfo();

    assert.ok(info.provider, "Provider should exist");
    assert.ok(info.model, "Model should exist");
  });

  it("Allows runtime reconfiguration of provider and model (e.g., DeepSeek, Groq, Ollama)", () => {
    const service = new UnifiedLlmService({
      provider: "deepseek",
      apiKey: "sk-test-deepseek-key",
      model: "deepseek-chat"
    });

    let info = service.getProviderInfo();
    assert.equal(info.provider, "deepseek");
    assert.equal(info.model, "deepseek-chat");
    assert.equal(info.hasApiKey, true);

    // Switch to Groq
    service.configure({
      provider: "groq",
      apiKey: "gsk_test_groq_key",
      model: "llama-3.3-70b-versatile"
    });

    info = service.getProviderInfo();
    assert.equal(info.provider, "groq");
    assert.equal(info.model, "llama-3.3-70b-versatile");
    assert.equal(info.hasApiKey, true);
  });

  it("Automatically blocks off-topic prompt through Guardrail without making network call", async () => {
    const service = new UnifiedLlmService({
      provider: "gemini",
      apiKey: "test-fake-key",
      model: "gemini-1.5-flash"
    });

    const res = await service.generateText({
      prompt: "Hướng dẫn làm món phở bò Nam Định"
    });

    assert.equal(res.isBlocked, true);
    assert.equal(res.provider, "guardrail");
    assert.ok(res.text.includes("PC Mall"), "Should return friendly PC Mall guidance");
  });

  it("Falls back to offline mode when API key is empty without throwing exception", async () => {
    const service = new UnifiedLlmService({
      provider: "gemini",
      apiKey: "",
      model: "gemini-1.5-flash"
    });

    const res = await service.generateText({
      prompt: "Tư vấn cấu hình PC 15 triệu chơi game"
    });

    assert.equal(res.isOfflineFallback, true);
    assert.equal(res.provider, "offline");
    assert.equal(res.isGrounded, true);
  });
});
