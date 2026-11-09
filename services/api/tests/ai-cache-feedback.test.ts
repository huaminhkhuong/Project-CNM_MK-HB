import assert from "node:assert/strict";
import { describe, it, after } from "node:test";
import request from "supertest";

import { createApp } from "../src/app";
import { aiQueryCache } from "../src/modules/ai/ai-cache.service";
import { aiFeedbackService } from "../src/modules/ai/ai-feedback.service";
import { prisma } from "../src/config/prisma";
const { closePool } = require("../src/config/database");

describe("AI In-Memory Query Cache & Feedback Loop Test Suite", () => {
  after(async () => {
    try {
      await prisma.$disconnect();
    } catch {}
    try {
      await closePool();
    } catch {}
  });

  describe("1. AiQueryCache Unit Behavior", () => {
    it("normalizes search prompt text correctly", () => {
      const key1 = aiQueryCache.normalizeKey("  RTX 4060 CÓ NÊN MUA KHÔNG???  ");
      const key2 = aiQueryCache.normalizeKey("rtx 4060 có nên mua không");
      assert.equal(key1, key2);
      assert.equal(key1, "rtx 4060 có nên mua không");
    });

    it("stores and retrieves data with cache hit", () => {
      aiQueryCache.clear();
      const mockResult = { advice: "Nên mua RTX 4060 cho cấu hình Full HD", score: 90 };
      aiQueryCache.set("test-gpu-rtx4060", mockResult, 5000);

      const cached = aiQueryCache.get("test-gpu-rtx4060");
      assert.deepEqual(cached, mockResult);

      const stats = aiQueryCache.getStats();
      assert.equal(stats.hits, 1);
      assert.equal(stats.size, 1);
    });

    it("expires entries beyond TTL", async () => {
      aiQueryCache.clear();
      aiQueryCache.set("short-lived-key", { text: "expired soon" }, 20); // 20ms TTL

      await new Promise((resolve) => setTimeout(resolve, 35));

      const expired = aiQueryCache.get("short-lived-key");
      assert.equal(expired, null);
    });
  });

  describe("2. AiFeedbackService Unit Behavior", () => {
    it("records thumbs up and thumbs down ratings and computes satisfaction", () => {
      aiFeedbackService.clear();

      aiFeedbackService.recordFeedback({
        userId: 1,
        query: "Tư vấn cấu hình i5 13400F",
        response: "Cấu hình đề xuất...",
        rating: 1
      });

      aiFeedbackService.recordFeedback({
        userId: 2,
        query: "So sánh RTX 3060 và 4060",
        response: "RTX 4060 vượt trội...",
        rating: 1
      });

      aiFeedbackService.recordFeedback({
        userId: null,
        query: "Nguồn 500W đủ không?",
        response: "Chưa đủ chi tiết",
        rating: -1,
        reason: "Cần hỏi thêm CPU là gì"
      });

      const stats = aiFeedbackService.getStats();
      assert.equal(stats.total, 3);
      assert.equal(stats.positive, 2);
      assert.equal(stats.negative, 1);
      assert.equal(stats.satisfactionRate, "66.7%");

      const recent = aiFeedbackService.getRecent(2);
      assert.equal(recent.length, 2);
      assert.equal(recent[0].rating, -1);
    });
  });

  describe("3. HTTP Endpoints for AI Cache & Feedback", () => {
    const app = createApp();

    it("POST /api/ai/feedback records client satisfaction feedback", async () => {
      const response = await request(app)
        .post("/api/ai/feedback")
        .send({
          query: "Nguồn 650W có cân được RTX 4070 không?",
          response: "Hoàn toàn đủ công suất và đạt vùng tối ưu 55% tải.",
          rating: 1,
          category: "PC_BUILDER"
        });

      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.ok(response.body.data.id.startsWith("fb_"));
      assert.equal(response.body.data.rating, 1);
    });

    it("POST /api/ai/chat serves subsequent duplicate query from cache (0ms)", async () => {
      aiQueryCache.clear();
      const testQuery = "Chào bạn, showroom PC Mall ở đâu?";

      // Lần 1: Gọi bình thường (miss cache hoặc fallback rule engine)
      const res1 = await request(app)
        .post("/api/ai/chat")
        .send({ message: testQuery });

      assert.equal(res1.status, 200);
      assert.equal(res1.body.success, true);
      assert.equal(res1.body.data.cached, false);

      // Lần 2: Gọi cùng câu hỏi -> Phải trả về cached: true
      const res2 = await request(app)
        .post("/api/ai/chat")
        .send({ message: testQuery });

      assert.equal(res2.status, 200);
      assert.equal(res2.body.success, true);
      assert.equal(res2.body.data.cached, true);
    });

    it("POST /api/ai/chat bypasses cache for personalized queries with user context", async () => {
      aiQueryCache.clear();
      // Câu hỏi có ngữ cảnh riêng hoặc đính kèm buildContext
      const personalQuery = "Chính sách bảo hành dàn PC của tôi như thế nào?";

      // Lần 1: Gọi câu hỏi cá nhân với buildContext
      const res1 = await request(app)
        .post("/api/ai/chat")
        .send({ message: personalQuery, userId: 1, buildContext: { cpu: "i5 13400F" } });

      assert.equal(res1.status, 200);
      assert.equal(res1.body.data.cached, false);

      // Lần 2: Gọi lại cùng câu hỏi cá nhân -> Vẫn KHÔNG được lấy từ cache chung
      const res2 = await request(app)
        .post("/api/ai/chat")
        .send({ message: personalQuery, userId: 1, buildContext: { cpu: "i5 13400F" } });

      assert.equal(res2.status, 200);
      assert.equal(res2.body.data.cached, false);
      assert.equal(aiQueryCache.getStats().size, 0); // Không lưu vào cache chung
    });

    it("POST /api/ai/chat strictly avoids cross-user data leakage for order & hardware context", async () => {
      aiQueryCache.clear();
      const queryWithOrder = "Kiểm tra tiến độ đơn hàng và bảo hành của em";

      const res = await request(app)
        .post("/api/ai/chat")
        .send({ message: queryWithOrder, orderId: 999 });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.cached, false);
      assert.equal(aiQueryCache.getStats().size, 0, "Personalized order query must not pollute global cache");
    });
  });
});

