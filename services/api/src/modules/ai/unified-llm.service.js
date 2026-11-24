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
    const providerKeys = {
      gemini: config.providerKeys?.gemini || env.geminiApiKey || (env.llmProvider === "gemini" ? env.llmApiKey : "") || "",
      groq: config.providerKeys?.groq || env.groqApiKey || (env.llmProvider === "groq" ? env.llmApiKey : "") || "",
      openai: config.providerKeys?.openai || env.openaiApiKey || (env.llmProvider === "openai" ? env.llmApiKey : "") || "",
      deepseek: config.providerKeys?.deepseek || process.env.DEEPSEEK_API_KEY || (env.llmProvider === "deepseek" ? env.llmApiKey : "") || "",
      ollama: config.providerKeys?.ollama || ""
    };
    const initialProvider = String(config.provider !== undefined ? config.provider : (env.llmProvider || "gemini")).toLowerCase();
    this.config = {
      provider: initialProvider,
      apiKey: config.apiKey !== undefined ? config.apiKey : (providerKeys[initialProvider] || env.llmApiKey || env.geminiApiKey || env.groqApiKey || ""),
      providerKeys,
      model: config.model !== undefined ? config.model : (env.llmModel || this.getDefaultModelForProvider(initialProvider)),
      fallbackProvider: config.fallbackProvider !== undefined ? config.fallbackProvider : (process.env.LLM_FALLBACK_PROVIDER || (initialProvider === "gemini" ? "groq" : "gemini")),
      fallbackModel: config.fallbackModel !== undefined ? config.fallbackModel : (process.env.LLM_FALLBACK_MODEL || ""),
      autoFailover: config.autoFailover !== undefined ? Boolean(config.autoFailover) : true,
      endpoint: config.endpoint !== undefined ? config.endpoint : (env.llmEndpoint || ""),
      temperature: config.temperature !== undefined ? config.temperature : (env.llmTemperature || 0.7),
      maxTokens: config.maxTokens !== undefined ? config.maxTokens : (env.llmMaxTokens || 4096)
    };
  }

  getDefaultModelForProvider(provider) {
    const p = String(provider || "gemini").toLowerCase();
    if (p === "groq") return "llama-3.3-70b-versatile";
    if (p === "openai") return "gpt-4o-mini";
    if (p === "deepseek") return "deepseek-chat";
    if (p === "ollama") return "qwen2.5:7b";
    return "gemini-3.5-flash-lite";
  }

  resolveApiKeyForProvider(provider) {
    const p = String(provider || "gemini").toLowerCase();
    if (p === "ollama") return "";
    const keys = this.config.providerKeys || {};
    if (keys[p]) return keys[p];
    if (p === String(this.config.provider || "").toLowerCase() && this.config.apiKey) {
      return this.config.apiKey;
    }
    if (p === "gemini") return process.env.GEMINI_API_KEY || "";
    if (p === "groq") return process.env.GROQ_API_KEY || "";
    if (p === "openai") return process.env.OPENAI_API_KEY || "";
    if (p === "deepseek") return process.env.DEEPSEEK_API_KEY || "";
    return "";
  }

  getExecutionChain() {
    const primaryProvider = String(this.config.provider || "gemini").toLowerCase();
    const primaryKey = this.resolveApiKeyForProvider(primaryProvider);
    const chain = [];
    const seen = new Set();

    const addTarget = (provider, model, apiKey) => {
      const p = String(provider || "").toLowerCase().trim();
      if (!p || seen.has(p)) return;
      if (p !== "ollama" && !apiKey) return;
      seen.add(p);
      chain.push({
        provider: p,
        model: model || this.getDefaultModelForProvider(p),
        apiKey
      });
    };

    addTarget(primaryProvider, this.config.model, primaryKey);

    if (this.config.autoFailover !== false) {
      const fbProvider = String(this.config.fallbackProvider || "").toLowerCase().trim();
      if (fbProvider && fbProvider !== "none") {
        addTarget(fbProvider, this.config.fallbackModel || this.getDefaultModelForProvider(fbProvider), this.resolveApiKeyForProvider(fbProvider));
      }
      // Tự động rà thêm các provider khác đã cấu hình sẵn key (ví dụ có cả Groq & Gemini)
      for (const candidateProvider of ["groq", "gemini", "openai", "deepseek"]) {
        addTarget(candidateProvider, this.getDefaultModelForProvider(candidateProvider), this.resolveApiKeyForProvider(candidateProvider));
      }
    }

    return chain;
  }

  /**
   * Cập nhật cấu hình khi cần thiết (runtime reconfiguration)
   */
  configure(newConfig = {}) {
    const mergedKeys = {
      ...(this.config.providerKeys || {}),
      ...(newConfig.providerKeys || {})
    };
    const nextProvider = String(newConfig.provider || this.config.provider || "gemini").toLowerCase();
    if (newConfig.apiKey && !String(newConfig.apiKey).includes("••")) {
      mergedKeys[nextProvider] = String(newConfig.apiKey).trim();
    }
    this.config = {
      ...this.config,
      ...newConfig,
      provider: nextProvider,
      providerKeys: mergedKeys,
      apiKey: mergedKeys[nextProvider] || newConfig.apiKey || this.config.apiKey || ""
    };
    // Reset cooldown cache khi admin đổi cấu hình mới
    this.resolvedGeminiModel = null;
    if (this.modelCooldownUntil) this.modelCooldownUntil.clear();
  }

  /**
   * Trả về thông tin provider hiện tại
   */
  getProviderInfo() {
    const activeKey = this.resolveApiKeyForProvider(this.config.provider);
    return {
      provider: this.config.provider,
      model: this.config.model,
      fallbackProvider: this.config.fallbackProvider || "",
      autoFailover: this.config.autoFailover !== false,
      hasApiKey: this.config.provider === "ollama" || Boolean(activeKey),
      isConfigured: this.config.provider === "ollama" || Boolean(activeKey)
    };
  }

  /**
   * Kiểm tra kết nối trực tiếp & đo độ trễ tới 1 nhà cung cấp LLM cụ thể (dùng cho Admin UI)
   */
  async testConnection({ provider, model, apiKey } = {}) {
    const targetProvider = String(provider || this.config.provider || "gemini").toLowerCase().trim();
    const targetModel = String(model || (targetProvider === this.config.provider ? this.config.model : this.getDefaultModelForProvider(targetProvider))).trim();
    const rawKey = apiKey && !String(apiKey).includes("••")
      ? String(apiKey).trim()
      : this.resolveApiKeyForProvider(targetProvider);

    if (targetProvider !== "ollama" && !rawKey) {
      return {
        ok: false,
        provider: targetProvider,
        model: targetModel,
        latencyMs: 0,
        error: `Chưa có API Key cho nhà cung cấp ${targetProvider.toUpperCase()}. Vui lòng dán khóa API trước khi kiểm tra.`
      };
    }

    const t0 = Date.now();
    const timeoutCtrl = this.createTimeoutController(9000);
    try {
      const prompt = "Trả lời ngắn đúng 1 câu tiếng Việt: Kết nối AI PC Mall thành công.";
      const systemInstruction = "Trả lời cực ngắn, đúng yêu cầu.";
      let result;
      if (targetProvider === "gemini") {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${rawKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: timeoutCtrl.signal,
          body: this.buildGeminiRequestBody({ prompt, systemInstruction, temp: 0.1, maxTokens: 128, model: targetModel })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return {
            ok: false,
            provider: targetProvider,
            model: targetModel,
            statusCode: res.status,
            latencyMs: Date.now() - t0,
            error: data?.error?.message || `HTTP ${res.status}`
          };
        }
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const text = parts.filter((p) => !p?.thought && p?.text).map((p) => p.text).join("").trim();
        result = { text, model: targetModel };
      } else {
        result = await this.callOpenAiCompatibleAdapter({
          provider: targetProvider,
          model: targetModel,
          apiKey: rawKey,
          prompt,
          systemInstruction,
          temp: 0.1,
          maxTokens: 128,
          signal: timeoutCtrl.signal
        });
      }

      return {
        ok: true,
        provider: targetProvider,
        model: result?.model || targetModel,
        latencyMs: Date.now() - t0,
        replyPreview: String(result?.text || "OK").slice(0, 140)
      };
    } catch (err) {
      return {
        ok: false,
        provider: targetProvider,
        model: targetModel,
        latencyMs: Date.now() - t0,
        error: err?.message || "Không thể kết nối tới máy chủ LLM"
      };
    } finally {
      timeoutCtrl.clear();
    }
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
    // Timeout cứng: tránh treo request hàng phút khi nhà cung cấp LLM quá tải -> fallback offline nhanh
    const timeoutMs = Number(options.timeoutMs || this.config.timeoutMs || 30000);
    const timeoutCtrl = this.createTimeoutController(timeoutMs, options.signal);
    const signal = timeoutCtrl.signal;

    try {
      return await this.generateTextInternal({ options, prompt, systemInstruction, temp, maxTokens, signal });
    } finally {
      timeoutCtrl.clear();
    }
  }

  /**
   * Tạo AbortController có timeout (hỗ trợ reset khi nhận chunk cho streaming) và liên kết với signal bên ngoài.
   */
  createTimeoutController(timeoutMs, externalSignal = null) {
    const controller = new AbortController();
    let timer = null;
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => controller.abort(new Error(`LLM request timeout sau ${timeoutMs}ms`)), timeoutMs);
    };
    arm();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    return {
      signal: controller.signal,
      reset: arm,
      clear: () => timer && clearTimeout(timer)
    };
  }

  async generateTextInternal({ options, prompt, systemInstruction, temp, maxTokens, signal }) {
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

    // ── 2. XÂY DỰNG CHUỖI NHÀ CUNG CẤP ĐA TẦNG (PRIMARY -> AUTO-FAILOVER) ─────
    const chain = this.getExecutionChain();
    if (chain.length === 0) {
      return {
        text: "",
        model: "offline-rule-engine",
        provider: "offline",
        usage: null,
        isOfflineFallback: true,
        isGrounded: true
      };
    }

    // ── 3. ĐIỀU PHỐI TUẦN TỰ QUA TỪNG PROVIDER TRONG CHUỖI ────────────────────
    let lastError = null;
    for (const target of chain) {
      try {
        if (target.provider === "gemini") {
          const res = await this.callGeminiAdapter({
            apiKey: target.apiKey,
            prompt,
            systemInstruction,
            temp,
            maxTokens,
            signal
          });
          if (res?.text) return res;
        } else {
          const res = await this.callOpenAiCompatibleAdapter({
            provider: target.provider,
            model: target.model,
            apiKey: target.apiKey,
            prompt,
            systemInstruction,
            temp,
            maxTokens,
            signal
          });
          if (res?.text) return res;
        }
      } catch (err) {
        lastError = err;
        console.warn(`[Unified LLM] Lỗi gọi ${target.provider} (${target.model}):`, err.message || err);
        if (signal && signal.aborted) break;
      }
    }

    return {
      text: "",
      model: this.config.model,
      provider: `${this.config.provider}-error-fallback`,
      usage: null,
      error: lastError?.message || "All configured LLM providers failed",
      isOfflineFallback: true,
      isGrounded: true
    };
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
    // Timeout tổng cho streaming (mỗi model ứng viên có timeout riêng 10s để failover nhanh)
    const idleTimeoutMs = Number(options.timeoutMs || this.config.streamIdleTimeoutMs || 45000);
    const timeoutCtrl = this.createTimeoutController(idleTimeoutMs, options.signal);
    const signal = timeoutCtrl.signal;
    const userOnChunk = onChunk;
    onChunk = (chunk) => {
      timeoutCtrl.reset();
      if (typeof userOnChunk === "function") userOnChunk(chunk);
    };

    try {
      return await this.generateStreamTextInternal({ options, prompt, systemInstruction, temp, maxTokens, signal, onChunk });
    } finally {
      timeoutCtrl.clear();
    }
  }

  async generateStreamTextInternal({ options, prompt, systemInstruction, temp, maxTokens, signal, onChunk }) {
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

    // 2. Xây dựng chuỗi Provider (Primary -> Backup Auto-Failover)
    const chain = this.getExecutionChain();
    if (chain.length === 0) {
      return {
        text: "",
        model: "offline-rule-engine",
        provider: "offline",
        isOfflineFallback: true,
        isGrounded: true
      };
    }

    let lastError = null;
    for (const target of chain) {
      try {
        if (target.provider === "gemini") {
          return await this.callGeminiStreamAdapter({
            apiKey: target.apiKey,
            prompt,
            systemInstruction,
            temp,
            maxTokens,
            signal,
            onChunk
          });
        }

        return await this.callOpenAiStreamAdapter({
          provider: target.provider,
          model: target.model,
          apiKey: target.apiKey,
          prompt,
          systemInstruction,
          temp,
          maxTokens,
          signal,
          onChunk
        });
      } catch (err) {
        lastError = err;
        console.warn(`[Unified LLM Stream] Lỗi gọi ${target.provider} stream (${target.model}):`, err.message || err);
        if (signal && signal.aborted) break;
      }
    }

    return {
      text: "",
      model: this.config.model,
      provider: `${this.config.provider}-error-fallback`,
      error: lastError?.message || "All configured LLM stream providers failed",
      isOfflineFallback: true,
      isGrounded: true
    };
  }

  // ── HELPER: DANH SÁCH MODEL GEMINI ƯU TIÊN & CIRCUIT BREAKER ───────────────
  getGeminiCandidateModels() {
    if (!this.modelCooldownUntil) {
      this.modelCooldownUntil = new Map();
    }
    const configured = String(this.config.model || "").trim();
    const deprecated = new Set([
      "gemini-1.5-flash",
      "gemini-1.5-pro",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-flash-lite-latest" // trùng backend với gemini-3.5-flash-lite -> tránh nhân đôi thời gian chờ
    ]);
    // Chỉ giữ các model thực sự sống và nhanh (<3s), loại bỏ alias trùng lặp để không chờ nối tiếp
    const fastCandidates = [
      this.resolvedGeminiModel,
      "gemini-3.5-flash-lite",
      "gemini-3-flash-preview"
    ];
    if (configured && !deprecated.has(configured) && !fastCandidates.includes(configured)) {
      fastCandidates.splice(1, 0, configured);
    }
    const rawCandidates = Array.from(new Set(fastCandidates.filter(Boolean)));

    const now = Date.now();
    // Circuit Breaker: chỉ trả về các model KHÔNG nằm trong cooldown 429/503/504 -> fail-fast 0ms khi Google quá tải
    return rawCandidates.filter((m) => (this.modelCooldownUntil.get(m) || 0) <= now);
  }

  markGeminiModelCooldown(model, durationMs = 60000) {
    if (!this.modelCooldownUntil) {
      this.modelCooldownUntil = new Map();
    }
    this.modelCooldownUntil.set(model, Date.now() + durationMs);
  }

  buildGeminiRequestBody({ prompt, systemInstruction, temp, maxTokens, model }) {
    const generationConfig = {
      temperature: temp,
      maxOutputTokens: Math.max(Number(maxTokens || 2048), 8192)
    };
    // Tắt suy nghĩ ẩn dài trên gemini-3-flash-preview để stream nhanh (<7s) và không timeout
    if (/^gemini-3-flash/i.test(String(model || ""))) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }
    return JSON.stringify({
      system_instruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig
    });
  }

  // ── HELPER: XÓA TRÙNG LẶP ĐẦU CÂU KHI NỐI TIẾP STREAM BỊ NGẮT ─────────────
  stripContinuationOverlap(existingText, continuationText) {
    if (!existingText || !continuationText) return continuationText || "";
    const tail = existingText.slice(-120);
    const maxCheck = Math.min(tail.length, continuationText.length, 80);
    for (let len = maxCheck; len >= 6; len--) {
      if (tail.endsWith(continuationText.slice(0, len))) {
        return continuationText.slice(len);
      }
    }
    return continuationText;
  }

  // ── ADAPTER STREAM: GOOGLE GEMINI ──────────────────────────────────────────
  async callGeminiStreamAdapter({ apiKey: overrideApiKey, prompt, systemInstruction, temp, maxTokens, signal, onChunk }) {
    const apiKey = overrideApiKey || this.resolveApiKeyForProvider("gemini");
    const candidateModels = this.getGeminiCandidateModels();
    if (candidateModels.length === 0) {
      throw new Error("Google Gemini đang tạm quá tải (Circuit Breaker active) -> chuyển sang Expert Engine tức thì");
    }

    const streamOnce = async (candidate, promptText, emitChunk, perAttemptTimeoutMs = 3200) => {
      const attemptCtrl = this.createTimeoutController(perAttemptTimeoutMs, signal);
      try {
        const reqBody = this.buildGeminiRequestBody({
          prompt: promptText,
          systemInstruction,
          temp,
          maxTokens,
          model: candidate
        });

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${candidate}:streamGenerateContent?alt=sse&key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: attemptCtrl.signal,
          body: reqBody
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          return {
            ok: false,
            status: res.status,
            errorMessage: errData.error?.message || `Gemini stream API returned status ${res.status}`,
            text: "",
            finishReason: null
          };
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let text = "";
        let buffer = "";
        let finishReason = null;

        const processLine = (line) => {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) return;
          const dataStr = trimmed.substring(5).trim();
          if (dataStr === "[DONE]") return;
          try {
            const parsed = JSON.parse(dataStr);
            const candidateObj = parsed?.candidates?.[0];
            if (candidateObj?.finishReason) {
              finishReason = candidateObj.finishReason;
            }
            const parts = candidateObj?.content?.parts || [];
            for (const part of parts) {
              if (part?.thought) continue;
              const chunkText = part?.text || "";
              if (chunkText) {
                attemptCtrl.reset();
                text += chunkText;
                if (emitChunk && typeof onChunk === "function") {
                  onChunk(chunkText);
                }
              }
            }
          } catch (_ignore) {}
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            buffer += decoder.decode();
            if (buffer.trim()) {
              for (const line of buffer.split("\n")) processLine(line);
            }
            break;
          }
          attemptCtrl.reset();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            processLine(line);
          }
        }

        return { ok: true, status: 200, text, finishReason };
      } catch (attemptErr) {
        if (signal && signal.aborted) {
          throw attemptErr;
        }
        return {
          ok: false,
          status: 504,
          errorMessage: attemptErr?.message || `Gemini stream (${candidate}) timed out`,
          text: "",
          finishReason: null
        };
      } finally {
        attemptCtrl.clear();
      }
    };

    let activeModel = candidateModels[0];
    let accumulatedText = "";
    let finalFinishReason = null;
    let lastErrMsg = "Gemini stream API failed";
    let succeeded = false;

    for (const candidate of candidateModels) {
      activeModel = candidate;
      // Fast-fail 3.2s cho byte đầu tiên (tự reset ngay khi có chunk về) -> không bao giờ lag màn hình chờ
      const attempt = await streamOnce(candidate, prompt, true, 3200);
      if (attempt.ok && attempt.text.trim()) {
        accumulatedText = attempt.text;
        finalFinishReason = attempt.finishReason;
        succeeded = true;
        if (finalFinishReason === "STOP") {
          this.resolvedGeminiModel = candidate;
        } else {
          this.resolvedGeminiModel = null;
          console.warn(`[Unified LLM Stream] ${candidate} đóng stream sớm (finishReason=${finalFinishReason || "NONE"}, chars=${accumulatedText.length}), kích hoạt tự động nối tiếp...`);
        }
        break;
      }

      lastErrMsg = attempt.ok ? `Gemini stream (${candidate}) returned empty body` : attempt.errorMessage;
      this.markGeminiModelCooldown(candidate, attempt.status === 429 ? 600000 : 45000);
      console.warn(`[Unified LLM Stream] Model ${candidate} thất bại (${attempt.status}): ${lastErrMsg} -> chuyển sang dự phòng`);
      if (!attempt.ok && ![404, 429, 500, 502, 503, 504].includes(attempt.status)) {
        break;
      }
    }

    if (!succeeded) {
      throw new Error(lastErrMsg);
    }

    // ── BẢO VỆ CHỐNG ĐỨT CÂU GIỮA CHỪNG (TRUNCATION RESCUE - TỐI ĐA 2 LƯỢT NHANH) ──
    const cleanTerminalReasons = new Set(["STOP", "SAFETY", "RECITATION"]);
    for (let hop = 0; hop < 2; hop++) {
      if (!accumulatedText.trim() || cleanTerminalReasons.has(String(finalFinishReason || ""))) {
        break;
      }
      const rescueCandidates = Array.from(new Set([activeModel, ...this.getGeminiCandidateModels()])).slice(0, 2);
      const continuePrompt = `${prompt}\n\n[PHẦN BẠN ĐÃ TRẢ LỜI ĐẾN ĐÂY VÀ BỊ NGẮT KẾT NỐI GIỮA CHỪNG]:\n${accumulatedText}\n\n[YÊU CẦU NỐI TIẾP BẮT BUỘC]: Viết tiếp NGAY LẬP TỨC từ ký tự tiếp theo sau chữ cuối cùng ở trên để hoàn thiện trọn vẹn câu đang dang dở, kết luận ngắn gọn và khối JSON (nếu prompt yêu cầu). TUYỆT ĐỐI KHÔNG lặp lại phần đã viết, KHÔNG thêm dấu "..." hay "…" ở đầu.`;
      let rescuedThisHop = false;
      for (const rescueModel of rescueCandidates) {
        const cont = await streamOnce(rescueModel, continuePrompt, false, 3200);
        if (cont.ok && cont.text) {
          let deduped = this.stripContinuationOverlap(accumulatedText, cont.text);
          deduped = deduped.replace(/^(?:\.{2,}|…+)\s*/, "");
          if (deduped) {
            const needsSpace = /[A-Za-zÀ-ỹ0-9]$/.test(accumulatedText) && /^[A-Za-zÀ-ỹ0-9]/.test(deduped);
            const piece = (needsSpace ? " " : "") + deduped;
            accumulatedText += piece;
            if (typeof onChunk === "function") {
              onChunk(piece);
            }
          }
          finalFinishReason = cont.finishReason;
          activeModel = rescueModel;
          if (cont.finishReason === "STOP") {
            this.resolvedGeminiModel = rescueModel;
          }
          rescuedThisHop = true;
          break;
        } else {
          this.markGeminiModelCooldown(rescueModel, cont.status === 429 ? 600000 : 45000);
        }
      }
      if (!rescuedThisHop) break;
    }

    const isIncomplete = !cleanTerminalReasons.has(String(finalFinishReason || ""));
    return {
      text: accumulatedText.trim(),
      model: activeModel,
      provider: "gemini",
      finishReason: finalFinishReason,
      isIncomplete,
      isGrounded: true
    };
  }

  // ── ADAPTER STREAM: OPENAI-COMPATIBLE (GROQ / DEEPSEEK / OPENAI / OLLAMA) ──
  async callOpenAiStreamAdapter({ provider, model: overrideModel, apiKey: overrideApiKey, prompt, systemInstruction, temp, maxTokens, signal, onChunk }) {
    let endpoint = provider === this.config.provider ? this.config.endpoint : "";
    if (!endpoint) {
      if (provider === "groq") endpoint = "https://api.groq.com/openai/v1/chat/completions";
      else if (provider === "deepseek") endpoint = "https://api.deepseek.com/chat/completions";
      else if (provider === "ollama") endpoint = "http://localhost:11434/v1/chat/completions";
      else endpoint = "https://api.openai.com/v1/chat/completions";
    }

    const model = overrideModel || this.getDefaultModelForProvider(provider);
    const resolvedKey = overrideApiKey !== undefined ? overrideApiKey : this.resolveApiKeyForProvider(provider);
    const headers = { "Content-Type": "application/json" };
    if (resolvedKey) headers["Authorization"] = `Bearer ${resolvedKey}`;

    const attemptCtrl = this.createTimeoutController(8000, signal);
    let res;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers,
        signal: attemptCtrl.signal,
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

      const processLine = (line) => {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) return;
        const dataStr = trimmed.substring(5).trim();
        if (dataStr === "[DONE]") return;
        try {
          const parsed = JSON.parse(dataStr);
          const chunkText = parsed?.choices?.[0]?.delta?.content || "";
          if (chunkText) {
            attemptCtrl.reset();
            accumulatedText += chunkText;
            if (typeof onChunk === "function") {
              onChunk(chunkText);
            }
          }
        } catch (_ignore) {}
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          if (buffer.trim()) {
            for (const line of buffer.split("\n")) processLine(line);
          }
          break;
        }
        attemptCtrl.reset();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          processLine(line);
        }
      }

      return {
        text: accumulatedText.trim(),
        model,
        provider,
        isGrounded: true
      };
    } finally {
      attemptCtrl.clear();
    }
  }

  // ── ADAPTER 1: GOOGLE GEMINI ────────────────────────────────────────────────
  async callGeminiAdapter({ apiKey: overrideApiKey, prompt, systemInstruction, temp, maxTokens, signal }) {
    const apiKey = overrideApiKey || this.resolveApiKeyForProvider("gemini");
    const candidateModels = this.getGeminiCandidateModels();
    let res = null;
    let data = {};
    let activeModel = candidateModels[0];
    let lastErrMsg = "Gemini API failed";

    for (const candidate of candidateModels) {
      activeModel = candidate;
      const attemptCtrl = this.createTimeoutController(12000, signal);
      try {
        const reqBody = this.buildGeminiRequestBody({
          prompt,
          systemInstruction,
          temp,
          maxTokens,
          model: candidate
        });
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: attemptCtrl.signal,
          body: reqBody
        });
        data = await res.json().catch(() => ({}));
        if (res.ok) {
          this.resolvedGeminiModel = candidate;
          break;
        }
        lastErrMsg = data.error?.message || `Gemini API returned status ${res.status}`;
        if (![404, 429, 500, 502, 503, 504].includes(res.status)) {
          break;
        }
      } catch (attemptErr) {
        if (signal && signal.aborted) throw attemptErr;
        lastErrMsg = attemptErr?.message || `Gemini API (${candidate}) timed out`;
        res = null;
      } finally {
        attemptCtrl.clear();
      }
    }

    if (!res || !res.ok) {
      throw new Error(lastErrMsg);
    }

    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts
      .filter((p) => !p?.thought && typeof p?.text === "string")
      .map((p) => p.text)
      .join("");
    const usage = data.usageMetadata
      ? {
          promptTokens: data.usageMetadata.promptTokenCount || 0,
          completionTokens: data.usageMetadata.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata.totalTokenCount || 0
        }
      : null;

    return {
      text: text.trim(),
      model: activeModel,
      provider: "gemini",
      usage,
      isGrounded: true
    };
  }

  // ── ADAPTER 2: OPENAI-COMPATIBLE (GROQ / DEEPSEEK / OPENAI / OLLAMA) ──────
  async callOpenAiCompatibleAdapter({ provider, model: overrideModel, apiKey: overrideApiKey, prompt, systemInstruction, temp, maxTokens, signal }) {
    let endpoint = provider === this.config.provider ? this.config.endpoint : "";

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

    const model = overrideModel || this.getDefaultModelForProvider(provider);
    const resolvedKey = overrideApiKey !== undefined ? overrideApiKey : this.resolveApiKeyForProvider(provider);
    const headers = {
      "Content-Type": "application/json"
    };

    // Ollama chạy local không nhất thiết cần API key
    if (resolvedKey) {
      headers["Authorization"] = `Bearer ${resolvedKey}`;
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
