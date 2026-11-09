/**
 * 🌟 AI FEEDBACK SERVICE (Vòng lặp học tập & Giám sát chất lượng AI)
 * ==============================================================================
 * Ghi nhận đánh giá Thumbs Up (👍) / Thumbs Down (👎) từ khách hàng
 * để tính toán chỉ số hài lòng (CSAT) và liên tục tinh chỉnh Prompt/Knowledge Base.
 * ==============================================================================
 */

export interface AiFeedbackEntry {
  id: string;
  userId?: number | string | null;
  query: string;
  response: string;
  rating: 1 | -1; // 1 = Thumbs Up, -1 = Thumbs Down
  reason?: string | null;
  category?: string | null; // e.g., "PC_BUILDER", "TECH_SUPPORT", "GENERAL"
  createdAt: string;
}

export class AiFeedbackService {
  private feedbackList: AiFeedbackEntry[] = [];
  private maxStoredEntries = 1000;

  /**
   * Ghi nhận phản hồi từ người dùng
   */
  public recordFeedback(options: {
    userId?: number | string | null;
    query: string;
    response: string;
    rating: 1 | -1;
    reason?: string | null;
    category?: string | null;
  }): AiFeedbackEntry {
    const entry: AiFeedbackEntry = {
      id: "fb_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      userId: options.userId || null,
      query: String(options.query || "").slice(0, 1000),
      response: String(options.response || "").slice(0, 2000),
      rating: options.rating === 1 ? 1 : -1,
      reason: options.reason ? String(options.reason).slice(0, 500) : null,
      category: options.category || "GENERAL",
      createdAt: new Date().toISOString()
    };

    if (this.feedbackList.length >= this.maxStoredEntries) {
      this.feedbackList.shift(); // FIFO rotation
    }

    this.feedbackList.push(entry);
    return entry;
  }

  /**
   * Thống kê tổng quan CSAT (Customer Satisfaction Score)
   */
  public getStats() {
    const total = this.feedbackList.length;
    const positive = this.feedbackList.filter((f) => f.rating === 1).length;
    const negative = this.feedbackList.filter((f) => f.rating === -1).length;
    const satisfactionRate = total > 0 ? ((positive / total) * 100).toFixed(1) + "%" : "100.0%";

    return {
      total,
      positive,
      negative,
      satisfactionRate
    };
  }

  /**
   * Lấy danh sách phản hồi gần nhất để Admin audit
   */
  public getRecent(limit = 50): AiFeedbackEntry[] {
    return [...this.feedbackList].reverse().slice(0, limit);
  }

  /**
   * Xóa toàn bộ dữ liệu feedback (dành cho test)
   */
  public clear(): void {
    this.feedbackList = [];
  }
}

// Singleton instance
export const aiFeedbackService = new AiFeedbackService();

