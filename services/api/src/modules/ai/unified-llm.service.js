/**
 * 🌐 UNIFIED LLM SERVICE (ADAPTER & STRATEGY PATTERN)
 * ==============================================================================
 * Kiến trúc trừu tượng hóa toàn bộ nhà cung cấp LLM:
 * - Hỗ trợ chuẩn hóa: Google Gemini, Groq, DeepSeek, OpenAI, Ollama (Local), v.v.
 * - Cho phép chuyển đổi linh hoạt nhà cung cấp hoặc đổi model chỉ bằng 1 dòng cấu hình trong .env.
 * - Tích hợp sẵn AI Guardrail Content Filter: Chặn câu hỏi lạc đề trước khi gửi mạng.
 * - Tự động fallback sang Rule Engine & Offline Database khi không có API key hoặc lỗi mạng.
 * ==============================================================================
 */

const { env } = require("../../config/env");
const { validateChatMessageDomain } = require("./ai-guardrail.service");

class UnifiedLlmService {
  constructor(config = {}) {
    this.config = {
      provider: config.provider !== undefined ? config.provider : (env.llmProvider || "gemini"),
      apiKey: config.apiKey !== undefined ? config.apiKey : (env.llmApiKey || env.geminiApiKey || env.groqApiKey || ""),
      model: config.model !== undefined ? config.model : (env.llmModel || "gemini-3.5-flash-lite"),
      endpoint: config.endpoint !== undefined ? config.endpoint : (env.llmEndpoint || ""),
      temperature: config.temperature !== undefined ? config.temperature : (env.llmTemperature || 0.7),
      maxTokens: config.maxTokens !== undefined ? config.maxTokens : (env.llmMaxTokens || 2048)
    };
  }

  /**
   * Cập nhật cấu hình khi cần thiết (runtime reconfiguration)
   */
  configure(newConfig = {}) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Trả về thông tin provider hiện tại
   */
  getProviderInfo() {
    return {
      provider: this.config.provider,
      model: this.config.model,
      hasApiKey: Boolean(this.config.apiKey),
      isConfigured: Boolean(this.config.apiKey)
    };
  }

  /**
   * Gọi LLM để sinh văn bản / nhận xét / câu trả lời kỹ thuật
   * @param {Object} options
   * @param {string} options.prompt Câu hỏi hoặc nội dung đầu vào từ người dùng
   * @param {string} [options.systemInstruction] Chỉ thị hệ thống (System Prompt)
   * @param {number} [options.temperature]
   * @param {number} [options.maxTokens]
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<{ text: string, model: string, provider: string, usage: any, isGrounded: boolean }>}
   */
  async generateText(options = {}) {
    const prompt = String(options.prompt || "").trim();
    if (!prompt) {
      throw new Error("Prompt is required for LLM generation");
    }

    const systemInstruction = options.systemInstruction || "Bạn là Chuyên gia Tư vấn Máy tính và Linh kiện Phần cứng PC Mall.";
    const temp = options.temperature !== undefined ? options.temperature : this.config.temperature;
    const maxTokens = options.maxTokens !== undefined ? options.maxTokens : this.config.maxTokens;
    const signal = options.signal || null;

    // ── 1. TÍCH HỢP GUARDRAIL BẢO VỆ TOKEN ──────────────────────────────────────
    if (!options.skipGuardrail) {
      const guard = validateChatMessageDomain(prompt);
      if (!guard.isAllowed) {
        return {
          text: guard.fallbackReply,
          model: "pc-mall-guardrail-filter",
          provider: "guardrail",
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          isBlocked: true,
          isGrounded: false
        };
      }
    }

    // ── 2. NẾU KHÔNG CÓ API KEY -> FALLBACK OFFLINE GRACEFULLY ─────────────────
    if (!this.config.apiKey) {
      return {
        text: "",
        model: "offline-rule-engine",
        provider: "offline",
        usage: null,
        isOfflineFallback: true,
        isGrounded: true
      };
    }

    const provider = String(this.config.provider || "gemini").toLowerCase();

    // ── 3. ĐIỀU PHỐI ĐẾN ADAPTER PHÙ HỢP (STRATEGY PATTERN) ───────────────────
    try {
      if (provider === "gemini") {
        return await this.callGeminiAdapter({ prompt, systemInstruction, temp, maxTokens, signal });
      }

      // Các provider tương thích chuẩn OpenAI Chat Completions: Groq, DeepSeek, OpenAI, Ollama, OpenRouter, vLLM
      return await this.callOpenAiCompatibleAdapter({
        provider,
        prompt,
        systemInstruction,
        temp,
        maxTokens,
        signal
      });
    } catch (err) {
      console.warn(`[Unified LLM] Lỗi gọi ${provider} (${this.config.model}):`, err.message || err);
      // Fallback mềm không làm sập ứng dụng
      return {
        text: "",
        model: this.config.model,
        provider: `${provider}-error-fallback`,
        usage: null,
        error: err.message,
        isOfflineFallback: true,
        isGrounded: true
      };
    }
  }

  /**
   * Gọi LLM để sinh văn bản dạng STREAMING (Server-Sent Events)
   * @param {Object} options
   * @param {string} options.prompt
   * @param {string} [options.systemInstruction]
   * @param {number} [options.temperature]
   * @param {number} [options.maxTokens]
   * @param {AbortSignal} [options.signal]
   * @param {function(string): void} [onChunk] Callback nhận từng mẩu text nhỏ
   * @returns {Promise<{ text: string, model: string, provider: string, isGrounded: boolean }>}
   */
  async generateStreamText(options = {}, onChunk = null) {
    const prompt = String(options.prompt || "").trim();
    if (!prompt) {
      throw new Error("Prompt is required for LLM stream generation");
    }

    const systemInstruction = options.systemInstruction || "Bạn là Chuyên gia Tư vấn Máy tính và Linh kiện Phần cứng PC Mall.";
    const temp = options.temperature !== undefined ? options.temperature : this.config.temperature;
    const maxTokens = options.maxTokens !== undefined ? options.maxTokens : this.config.maxTokens;
    const signal = options.signal || null;

    // 1. Guardrail filter
    if (!options.skipGuardrail) {
      const guard = validateChatMessageDomain(prompt);
      if (!guard.isAllowed) {
        if (typeof onChunk === "function") {
          onChunk(guard.fallbackReply);
        }
        return {
          text: guard.fallbackReply,
          model: "pc-mall-guardrail-filter",
          provider: "guardrail",
          isBlocked: true,
          isGrounded: false
        };
      }
    }

    // 2. Offline fallback if no API key
    if (!this.config.apiKey) {
      return {
        text: "",
        model: "offline-rule-engine",
        provider: "offline",
        isOfflineFallback: true,
        isGrounded: true
      };
    }

    const provider = String(this.config.provider || "gemini").toLowerCase();

    try {
      if (provider === "gemini") {
        return await this.callGeminiStreamAdapter({ prompt, systemInstruction, temp, maxTokens, signal, onChunk });
      }

      return await this.callOpenAiStreamAdapter({
        provider,
        prompt,
        systemInstruction,
        temp,
        maxTokens,
        signal,
        onChunk
      });
    } catch (err) {
      console.warn(`[Unified LLM Stream] Lỗi gọi ${provider} stream (${this.config.model}):`, err.message || err);
      return {
        text: "",
        model: this.config.model,
        provider: `${provider}-error-fallback`,
        error: err.message,
        isOfflineFallback: true,
        isGrounded: true
      };
    }
  }

  // ── ADAPTER STREAM: GOOGLE GEMINI ──────────────────────────────────────────
  async callGeminiStreamAdapter({ prompt, systemInstruction, temp, maxTokens, signal, onChunk }) {
    const model = this.config.model || "gemini-3.5-flash-lite";
    const apiKey = this.config.apiKey;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: temp,
          maxOutputTokens: maxTokens
        }
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Gemini stream API returned status ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const dataStr = trimmed.substring(5).trim();
        if (dataStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(dataStr);
          const chunkText = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (chunkText) {
            accumulatedText += chunkText;
            if (typeof onChunk === "function") {
              onChunk(chunkText);
            }
          }
        } catch (_ignore) {}
      }
    }

    return {
      text: accumulatedText.trim(),
      model,
      provider: "gemini",
      isGrounded: true
    };
  }

  // ── ADAPTER STREAM: OPENAI-COMPATIBLE (GROQ / DEEPSEEK / OPENAI / OLLAMA) ──
  async callOpenAiStreamAdapter({ provider, prompt, systemInstruction, temp, maxTokens, signal, onChunk }) {
    let endpoint = this.config.endpoint;
    if (!endpoint) {
      if (provider === "groq") endpoint = "https://api.groq.com/openai/v1/chat/completions";
      else if (provider === "deepseek") endpoint = "https://api.deepseek.com/chat/completions";
      else if (provider === "ollama") endpoint = "http://localhost:11434/v1/chat/completions";
      else endpoint = "https://api.openai.com/v1/chat/completions";
    }

    const model = this.config.model || (provider === "groq" ? "llama-3.3-70b-versatile" : provider === "deepseek" ? "deepseek-chat" : "gpt-4o-mini");
    const headers = { "Content-Type": "application/json" };
    if (this.config.apiKey) headers["Authorization"] = `Bearer ${this.config.apiKey}`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ],
        temperature: temp,
        max_tokens: maxTokens,
        stream: true
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `${provider} API returned status ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const dataStr = trimmed.substring(5).trim();
        if (dataStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(dataStr);
          const chunkText = parsed?.choices?.[0]?.delta?.content || "";
          if (chunkText) {
            accumulatedText += chunkText;
            if (typeof onChunk === "function") {
              onChunk(chunkText);
            }
          }
        } catch (_ignore) {}
      }
    }

    return {
      text: accumulatedText.trim(),
      model,
      provider,
      isGrounded: true
    };
  }

  // ── ADAPTER 1: GOOGLE GEMINI ────────────────────────────────────────────────
  async callGeminiAdapter({ prompt, systemInstruction, temp, maxTokens, signal }) {
    const model = this.config.model || "gemini-3.5-flash-lite";
    const apiKey = this.config.apiKey;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: temp,
          maxOutputTokens: maxTokens
        }
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || `Gemini API returned status ${res.status}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const usage = data.usageMetadata
      ? {
          promptTokens: data.usageMetadata.promptTokenCount || 0,
          completionTokens: data.usageMetadata.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata.totalTokenCount || 0
        }
      : null;

    return {
      text: text.trim(),
      model,
      provider: "gemini",
      usage,
      isGrounded: true
    };
  }

  // ── ADAPTER 2: OPENAI-COMPATIBLE (GROQ / DEEPSEEK / OPENAI / OLLAMA) ──────
  async callOpenAiCompatibleAdapter({ provider, prompt, systemInstruction, temp, maxTokens, signal }) {
    let endpoint = this.config.endpoint;

    if (!endpoint) {
      if (provider === "groq") {
        endpoint = "https://api.groq.com/openai/v1/chat/completions";
      } else if (provider === "deepseek") {
        endpoint = "https://api.deepseek.com/chat/completions";
      } else if (provider === "ollama") {
        endpoint = "http://localhost:11434/v1/chat/completions";
      } else {
        endpoint = "https://api.openai.com/v1/chat/completions";
      }
    }

    const model = this.config.model || (provider === "groq" ? "llama-3.3-70b-versatile" : provider === "deepseek" ? "deepseek-chat" : "gpt-4o-mini");
    const headers = {
      "Content-Type": "application/json"
    };

    // Ollama chạy local không nhất thiết cần API key
    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ],
        temperature: temp,
        max_tokens: maxTokens
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || `${provider} API returned status ${res.status}`);
    }

    const text = data.choices?.[0]?.message?.content || "";
    const usage = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0
        }
      : null;

    return {
      text: text.trim(),
      model: data.model || model,
      provider,
      usage,
      isGrounded: true
    };
  }
}

// Singleton instance
const unifiedLlmService = new UnifiedLlmService();

module.exports = {
  UnifiedLlmService,
  unifiedLlmService
};
