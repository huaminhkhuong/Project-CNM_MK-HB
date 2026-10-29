import { VectorStoreService, QueryResult } from "./vector-store.service";
import { EmbeddingService } from "./embedding.service";

export interface ProductFilters {
  category?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  brand?: string;
  socket?: string;
  ramType?: string;
  formFactor?: string;
}

export interface RetrievedProduct {
  productId: number;
  skuId?: number;
  sku?: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  stock: number;
  socket?: string;
  tdp?: number;
  ramType?: string;
  formFactor?: string;
  score: number;
  snippet: string;
}

export interface RetrievedKnowledge {
  id: string;
  title: string;
  category: "hardware_rule" | "store_policy";
  text: string;
  score: number;
}

export interface AugmentedContextResult {
  hasKnowledge: boolean;
  knowledgeText: string;
  hasProducts: boolean;
  productsText: string;
  rawProducts: RetrievedProduct[];
  rawKnowledge: RetrievedKnowledge[];
}

/**
 * Chuẩn hóa tên danh mục về chuẩn nội bộ
 */
function normalizeCategory(cat?: string): string | undefined {
  if (!cat) return undefined;
  const lower = cat.toLowerCase().trim();
  if (lower === "vga" || lower === "card" || lower === "card màn hình" || lower === "card đồ họa") return "gpu";
  if (lower === "bo mạch" || lower === "bo mạch chủ" || lower === "main") return "mainboard";
  if (lower === "bộ nhớ" || lower === "thanh ram") return "ram";
  if (lower === "ổ cứng" || lower === "ổ ssd" || lower === "ổ hdd" || lower === "storage") return "ssd";
  if (lower === "nguồn" || lower === "bộ nguồn" || lower === "power") return "psu";
  if (lower === "vỏ" || lower === "vỏ case" || lower === "thùng máy") return "case";
  if (lower === "tản" || lower === "tản nhiệt" || lower === "quạt" || lower === "aio") return "cooling";
  if (lower === "chip" || lower === "vi xử lý" || lower === "processor") return "cpu";
  return lower;
}

/**
 * RetrieverService — Bộ máy Tìm Kiếm Kết Hợp (Hybrid Search: Dense Vector + Metadata Filter)
 * Đảm nhiệm việc truy xuất linh kiện thật và tri thức kỹ thuật từ Vector Store phục vụ RAG.
 */
export class RetrieverService {
  /**
   * Đảm bảo Vector Store đã nạp dữ liệu từ file JSON vào RAM
   */
  public static ensureLoaded(): void {
    if (VectorStoreService.count("products") === 0) {
      VectorStoreService.load("products");
    }
    if (VectorStoreService.count("knowledge") === 0) {
      VectorStoreService.load("knowledge");
    }
  }

  /**
   * Tìm kiếm linh kiện bằng Hybrid Search (Vector Similarity + Metadata Filter)
   */
  public static async searchSimilarProducts(
    queryText: string,
    filters: ProductFilters = {},
    topK = 5
  ): Promise<RetrievedProduct[]> {
    this.ensureLoaded();

    const targetCategory = normalizeCategory(filters.category);
    const queryVec = await EmbeddingService.generateEmbedding(queryText);

    const results = VectorStoreService.query("products", queryVec, {
      topK: topK * 2, // Lấy dư để lọc chi tiết
      minScore: -1.0,
      filterFn: (meta: any) => {
        // 1. Lọc theo Danh mục (nếu có)
        if (targetCategory && meta.category) {
          const itemCat = normalizeCategory(meta.category);
          if (itemCat !== targetCategory) return false;
        }

        // 2. Lọc theo Category ID (nếu có)
        if (filters.categoryId && meta.categoryId && meta.categoryId !== filters.categoryId) {
          return false;
        }

        // 3. Lọc theo Ngân sách (minPrice, maxPrice)
        if (filters.minPrice !== undefined && meta.price < filters.minPrice) {
          return false;
        }
        if (filters.maxPrice !== undefined && meta.price > filters.maxPrice) {
          return false;
        }

        // 4. Lọc theo tình trạng còn hàng (mặc định chỉ lấy còn hàng trừ khi có chỉ định khác)
        if (filters.inStockOnly !== false && meta.stock <= 0) {
          return false;
        }

        // 5. Lọc theo Thương hiệu (Brand)
        if (filters.brand && meta.brand) {
          if (!meta.brand.toLowerCase().includes(filters.brand.toLowerCase())) {
            return false;
          }
        }

        // 6. Lọc theo Socket CPU / Mainboard (ví dụ: LGA1700, AM5, AM4)
        if (filters.socket && meta.socket) {
          const targetSocket = filters.socket.toLowerCase();
          const itemSocket = meta.socket.toLowerCase();
          if (!itemSocket.includes(targetSocket)) {
            return false;
          }
        }

        // 7. Lọc theo chuẩn RAM (DDR4 / DDR5)
        if (filters.ramType && meta.ramType) {
          const targetRam = filters.ramType.toLowerCase();
          const itemRam = meta.ramType.toLowerCase();
          if (!itemRam.includes(targetRam)) {
            return false;
          }
        }

        // 8. Lọc theo Kích thước Form Factor (ATX, Micro-ATX)
        if (filters.formFactor && meta.formFactor) {
          const targetFf = filters.formFactor.toLowerCase();
          const itemFf = meta.formFactor.toLowerCase();
          if (!itemFf.includes(targetFf)) {
            return false;
          }
        }

        return true;
      }
    });

    return results.slice(0, topK).map((res) => ({
      productId: res.document.metadata.productId,
      skuId: res.document.metadata.skuId,
      sku: res.document.metadata.sku,
      name: res.document.metadata.name,
      category: res.document.metadata.category,
      brand: res.document.metadata.brand,
      price: res.document.metadata.price,
      stock: res.document.metadata.stock,
      socket: res.document.metadata.socket,
      tdp: res.document.metadata.tdp,
      ramType: res.document.metadata.ramType,
      formFactor: res.document.metadata.formFactor,
      score: res.score,
      snippet: res.document.text
    }));
  }

  /**
   * Tìm kiếm các đoạn tri thức kỹ thuật hoặc chính sách trong Knowledge Base
   */
  public static async searchDomainKnowledge(
    queryText: string,
    options: { topK?: number; category?: "hardware_rule" | "store_policy"; minScore?: number } = {}
  ): Promise<RetrievedKnowledge[]> {
    this.ensureLoaded();

    const { topK = 3, category, minScore = 0.0 } = options;
    const queryVec = await EmbeddingService.generateEmbedding(queryText);

    const results = VectorStoreService.query("knowledge", queryVec, {
      topK,
      minScore,
      filterFn: category ? (meta: any) => meta.category === category : undefined
    });

    return results.map((res) => ({
      id: String(res.document.id),
      title: res.document.metadata.title || "Tri thức phần cứng",
      category: res.document.metadata.category,
      text: res.document.text,
      score: res.score
    }));
  }

  /**
   * Tạo văn bản ngữ cảnh tổng hợp (Augmented Context) để nạp trực tiếp vào Prompt của LLM
   */
  public static async retrieveRelevantContext(
    userMessage: string,
    criteria?: {
      category?: string;
      budget?: number;
      ownedList?: string[];
      socket?: string;
      ramType?: string;
    }
  ): Promise<AugmentedContextResult> {
    this.ensureLoaded();

    // 1. Tìm tri thức liên quan (Quy tắc kỹ thuật, chính sách)
    const knowledgeList = await this.searchDomainKnowledge(userMessage, { topK: 2, minScore: 0.15 });

    // 2. Tìm linh kiện liên quan theo câu hỏi và bộ lọc
    const filters: ProductFilters = {
      category: criteria?.category,
      maxPrice: criteria?.budget ? Math.round(criteria.budget * 1.1) : undefined,
      socket: criteria?.socket,
      ramType: criteria?.ramType,
      inStockOnly: true
    };

    const productList = await this.searchSimilarProducts(userMessage, filters, 6);

    // 3. Chuẩn bị định dạng văn bản cho System Prompt
    let knowledgeText = "";
    if (knowledgeList.length > 0) {
      knowledgeText = knowledgeList
        .map((k, i) => `[Tri thức ${i + 1}: ${k.title}]\n${k.text}`)
        .join("\n\n");
    }

    let productsText = "";
    if (productList.length > 0) {
      productsText = productList
        .map((p, i) => {
          const priceVnd = p.price.toLocaleString("vi-VN") + "đ";
          const specs = [
            p.socket ? `Socket: ${p.socket}` : "",
            p.tdp ? `TDP: ${p.tdp}W` : "",
            p.ramType ? `RAM: ${p.ramType}` : ""
          ].filter(Boolean).join(" | ");

          return `[SP ${i + 1}] ID: ${p.productId} - ${p.name}\n- Danh mục: ${p.category.toUpperCase()} | Giá: ${priceVnd} | Còn hàng: ${p.stock}\n${specs ? `- Thông số: ${specs}\n` : ""}`;
        })
        .join("\n");
    }

    return {
      hasKnowledge: knowledgeList.length > 0,
      knowledgeText,
      hasProducts: productList.length > 0,
      productsText,
      rawProducts: productList,
      rawKnowledge: knowledgeList
    };
  }
}
