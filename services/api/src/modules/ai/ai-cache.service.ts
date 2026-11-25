/**
 * ⚡ AI QUERY CACHE SERVICE (LRU + TTL In-Memory Memory Cache)
 * ==============================================================================
 * Tiết kiệm 100% token LLM, giảm 100% chi phí API và phản hồi tức thì 0ms
 * cho các câu hỏi phần cứng lặp đi lặp lại từ người dùng.
 * ==============================================================================
 */

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  createdAt: number;
  expiresAt: number;
  hits: number;
}

export class AiQueryCacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private maxEntries: number;
  private defaultTtlMs: number;
  private hitsCount = 0;
  private missesCount = 0;

  constructor(maxEntries = 500, defaultTtlMinutes = 30) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMinutes * 60 * 1000;
  }

  /**
   * Chuẩn hóa text câu hỏi để tăng xác suất trùng khớp cache:
   * Chuyển chữ thường, bỏ dấu cách thừa, bỏ ký tự đặc biệt ở đầu/cuối
   */
  public normalizeKey(prompt: string, contextPrefix = ""): string {
    const cleaned = String(prompt || "")
      .trim()
      .toLowerCase()
      .replace(/[\s\t\n]+/g, " ")
      .replace(/[?!.,;:]+$/g, "");
    
    return contextPrefix ? `${contextPrefix}::${cleaned}` : cleaned;
  }

  /**
   * Lấy kết quả từ Cache nếu còn hạn (TTL)
   */
  public get<T = any>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.missesCount++;
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.missesCount++;
      return null;
    }

    // Cập nhật LRU: đưa key lên cuối Map
    entry.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.hitsCount++;
    return entry.data as T;
  }

  /**
   * Lưu kết quả vào Cache
   */
  public set<T = any>(key: string, data: T, ttlMs?: number): void {
    if (!key || data === undefined || data === null) return;

    // Nếu vượt quá dung lượng tối đa, xóa phần tử đầu tiên (LRU oldest)
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const now = Date.now();
    const duration = ttlMs !== undefined ? ttlMs : this.defaultTtlMs;

    this.cache.set(key, {
      key,
      data,
      createdAt: now,
      expiresAt: now + duration,
      hits: 0
    });
  }

  /**
   * Xóa toàn bộ Cache
   */
  public clear(): void {
    this.cache.clear();
    this.hitsCount = 0;
    this.missesCount = 0;
  }

  /**
   * Lấy số liệu thống kê hiệu quả bộ nhớ đệm
   */
  public getStats() {
    const totalRequests = this.hitsCount + this.missesCount;
    const hitRate = totalRequests > 0 ? ((this.hitsCount / totalRequests) * 100).toFixed(1) + "%" : "0.0%";

    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      hits: this.hitsCount,
      misses: this.missesCount,
      totalRequests,
      hitRate
    };
  }
}

// Singleton instance
export const aiQueryCache = new AiQueryCacheService();

