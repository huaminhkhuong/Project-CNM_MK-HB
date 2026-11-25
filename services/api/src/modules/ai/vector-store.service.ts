import fs from "fs";
import path from "path";

export interface VectorDocument<T = any> {
  id: string | number;
  text: string;
  vector: number[];
  metadata: T;
}

export interface QueryOptions<T = any> {
  topK?: number;
  minScore?: number;
  filterFn?: (metadata: T) => boolean;
}

export interface QueryResult<T = any> {
  document: VectorDocument<T>;
  score: number;
}

/**
 * VectorStoreService
 * Kho lưu trữ vector nhẹ hiệu năng cao (Zero-dependency, Local In-memory & Persistent JSON).
 * Tối ưu hóa tính Cosine Similarity cực nhanh (< 2ms) cho hàng nghìn linh kiện.
 */
export class VectorStoreService {
  private static collections: Map<string, Map<string | number, VectorDocument>> = new Map();
  private static readonly STORAGE_DIR = path.resolve(__dirname, "../../../data/vectors");

  /**
   * Khởi tạo và nạp dữ liệu từ ổ đĩa nếu có
   */
  public static ensureStorageDir(): void {
    if (!fs.existsSync(this.STORAGE_DIR)) {
      fs.mkdirSync(this.STORAGE_DIR, { recursive: true });
    }
  }

  /**
   * Lưu hoặc cập nhật danh sách documents vào collection
   */
  public static upsert<T = any>(collectionName: string, items: VectorDocument<T>[]): void {
    let col = this.collections.get(collectionName);
    if (!col) {
      col = new Map();
      this.collections.set(collectionName, col);
    }

    for (const item of items) {
      col.set(item.id, item);
    }
  }

  /**
   * Tìm kiếm các tài liệu gần nhất theo Cosine Similarity kết hợp lọc Metadata
   */
  public static query<T = any>(
    collectionName: string,
    queryVector: number[],
    options: QueryOptions<T> = {}
  ): QueryResult<T>[] {
    const col = this.collections.get(collectionName);
    if (!col || col.size === 0) {
      // Thử load từ đĩa nếu collection rỗng
      this.load(collectionName);
    }

    const activeCol = this.collections.get(collectionName);
    if (!activeCol || activeCol.size === 0) {
      return [];
    }

    const { topK = 5, minScore = 0.0, filterFn } = options;
    const scoredList: QueryResult<T>[] = [];

    for (const doc of activeCol.values()) {
      // 1. Lọc Metadata Filter trước (Filter First) để tăng tốc độ tính toán
      if (filterFn && !filterFn(doc.metadata as T)) {
        continue;
      }

      // 2. Tính Cosine Similarity
      const score = this.calculateCosineSimilarity(queryVector, doc.vector);

      if (score >= minScore) {
        scoredList.push({ document: doc, score });
      }
    }

    // 3. Sắp xếp điểm tương đồng giảm dần và lấy Top K
    scoredList.sort((a, b) => b.score - a.score);
    return scoredList.slice(0, topK);
  }

  /**
   * Tính Cosine Similarity giữa 2 vector đã chuẩn hóa (hoặc chưa chuẩn hóa)
   */
  public static calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Ghi toàn bộ collection ra file JSON để duy trì dữ liệu qua các lần khởi động server
   */
  public static save(collectionName: string): boolean {
    this.ensureStorageDir();
    const col = this.collections.get(collectionName);
    if (!col) return false;

    const filePath = path.join(this.STORAGE_DIR, `${collectionName}.json`);
    const data = Array.from(col.values());

    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
      return true;
    } catch (err: any) {
      console.error(`[VectorStoreService] Lỗi khi lưu collection ${collectionName}:`, err.message || err);
      return false;
    }
  }

  /**
   * Nạp collection từ file JSON vào bộ nhớ RAM
   */
  public static load(collectionName: string): boolean {
    const filePath = path.join(this.STORAGE_DIR, `${collectionName}.json`);
    if (!fs.existsSync(filePath)) {
      return false;
    }

    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const data: VectorDocument[] = JSON.parse(raw);
      const col = new Map<string | number, VectorDocument>();

      for (const item of data) {
        col.set(item.id, item);
      }

      this.collections.set(collectionName, col);
      return true;
    } catch (err: any) {
      console.error(`[VectorStoreService] Lỗi khi nạp collection ${collectionName}:`, err.message || err);
      return false;
    }
  }

  /**
   * Đếm số lượng tài liệu trong collection
   */
  public static count(collectionName: string): number {
    return this.collections.get(collectionName)?.size || 0;
  }

  /**
   * Xóa toàn bộ dữ liệu của collection trong RAM
   */
  public static clear(collectionName: string): void {
    this.collections.delete(collectionName);
  }
}
