import { env } from "../../config/env";

export interface EmbeddingOptions {
  model?: string;
}

/**
 * EmbeddingService
 * Cung cấp vector embeddings cho RAG sử dụng Google Gemini (text-embedding-004)
 * hoặc OpenAI (text-embedding-3-small), kèm cơ chế Fallback Deterministic Vector
 * khi chạy offline/test để hệ thống không bao giờ bị dừng hoạt động.
 */
export class EmbeddingService {
  private static readonly VECTOR_DIMENSION = 768;

  /**
   * Sinh vector embedding cho một đoạn văn bản
   */
  public static async generateEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]> {
    const cleanText = (text || "").trim();
    if (!cleanText) {
      return new Array(this.VECTOR_DIMENSION).fill(0);
    }

    const geminiKey = process.env.GEMINI_API_KEY || (env as any).geminiApiKey;
    const openAiKey = process.env.OPENAI_API_KEY || (env as any).openaiApiKey;

    // 1. Thử Google Gemini Embedding (text-embedding-004) nếu có key
    if (geminiKey && geminiKey.trim() !== "") {
      try {
        const vector = await this.embedWithGemini(cleanText, geminiKey);
        if (vector && vector.length > 0) {
          return vector;
        }
      } catch (err: any) {
        console.warn(`[EmbeddingService] Gemini embedding warning: ${err.message || err}. Thử fallback tiếp theo.`);
      }
    }

    // 2. Thử OpenAI Embedding (text-embedding-3-small) nếu có key
    if (openAiKey && openAiKey.trim() !== "") {
      try {
        const vector = await this.embedWithOpenAI(cleanText, openAiKey);
        if (vector && vector.length > 0) {
          return vector;
        }
      } catch (err: any) {
        console.warn(`[EmbeddingService] OpenAI embedding warning: ${err.message || err}. Thử fallback tiếp theo.`);
      }
    }

    // 3. Fallback: Deterministic Semantic Vector (chạy offline / local dev / unit tests)
    return this.generateDeterministicVector(cleanText);
  }

  /**
   * Gọi Google Gemini REST API để lấy embedding
   */
  private static async embedWithGemini(text: string, apiKey: string): Promise<number[]> {
    const candidateModels = ["gemini-embedding-001", "text-embedding-004"];
    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;
        const payload = {
          model: `models/${model}`,
          content: {
            parts: [{ text }]
          }
        };

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) continue;

        const data: any = await response.json();
        const values: number[] = data?.embedding?.values || [];
        if (values.length > 0) {
          return this.normalizeVector(values);
        }
      } catch (_e) {}
    }
    return this.generateDeterministicVector(text);
  }

  /**
   * Gọi OpenAI REST API để lấy embedding
   */
  private static async embedWithOpenAI(text: string, apiKey: string): Promise<number[]> {
    const url = "https://api.openai.com/v1/embeddings";
    const payload = {
      model: "text-embedding-3-small",
      input: text
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const values: number[] = data?.data?.[0]?.embedding || [];
    return this.normalizeVector(values);
  }

  /**
   * Sinh vector giả định chuẩn hóa từ chuỗi từ khóa (Deterministic Projection)
   * Giúp hệ thống hoạt động 100% trong môi trường test/dev mà không cần internet/API Key.
   */
  public static generateDeterministicVector(text: string, dim = this.VECTOR_DIMENSION): number[] {
    const vector = new Array(dim).fill(0);
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/gi, " ");
    const words = normalized.split(/\s+/).filter(Boolean);

    if (words.length === 0) return vector;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let hash = 0;
      for (let j = 0; j < word.length; j++) {
        hash = (hash << 5) - hash + word.charCodeAt(j);
        hash |= 0;
      }
      const slot = Math.abs(hash) % dim;
      vector[slot] += 1.0 / (1 + (i % 3));
    }

    return this.normalizeVector(vector);
  }

  /**
   * Chuẩn hóa vector về độ dài đơn vị (L2 norm = 1) để tính Cosine Similarity tức thì bằng Dot Product
   */
  public static normalizeVector(vector: number[]): number[] {
    let sumSq = 0;
    for (let i = 0; i < vector.length; i++) {
      sumSq += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sumSq);
    if (norm === 0) return vector;
    return vector.map((v) => v / norm);
  }

  /**
   * Sinh embedding cho nhiều đoạn văn bản theo lô (batch) kèm độ trễ an toàn
   */
  public static async generateBatchEmbeddings(texts: string[], batchSize = 10): Promise<number[][]> {
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map((text) => this.generateEmbedding(text));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      if (i + batchSize < texts.length) {
        // Giãn cách 200ms để tránh rate limit của API
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    return results;
  }
}
