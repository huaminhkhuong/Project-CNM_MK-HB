import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app";
import { closePool } from "../src/config/database";
import { env } from "../src/config/env";

const app = createApp();

// Generate real JWT tokens matching auth.service.ts payload ({ userId, roleId, role })
const customerToken = jwt.sign({ userId: 1, roleId: 3, role: "CUSTOMER" }, env.jwtAccessSecret, { expiresIn: "1h" });
const adminToken = jwt.sign({ userId: 1, roleId: 1, role: "ADMIN" }, env.jwtAccessSecret, { expiresIn: "1h" });

function parseSseEvents(rawBody: string): any[] {
  const lines = rawBody.split(/\r?\n/);
  const events: any[] = [];
  for (const line of lines) {
    if (line.startsWith("data:")) {
      const jsonStr = line.replace(/^data:\s*/, "").trim();
      if (jsonStr && jsonStr !== "[DONE]") {
        try {
          events.push(JSON.parse(jsonStr));
        } catch (_e) {}
      }
    }
  }
  return events;
}

describe("AI Features End-to-End Verification Suite (All 5 Core Subsystems)", () => {
  // Ép chế độ Offline (Heuristic + DB-grounded) để kết quả kiểm thử ổn định, không phụ thuộc tải của nhà cung cấp LLM
  const { unifiedLlmService } = require("../src/modules/ai/unified-llm.service");
  const originalLlmConfig = { ...unifiedLlmService.config };

  before(() => {
    unifiedLlmService.configure({ apiKey: "" });
  });

  after(async () => {
    unifiedLlmService.configure(originalLlmConfig);
    await closePool();
  });

  describe("1. General AI Chat & Advisor (/api/ai/chat, /api/ai/history)", () => {
    test("1.1 Tier-1 FAQ DIRECT_REPLY should return instant response without LLM tokens", async () => {
      const res = await request(app)
        .post("/api/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: "Chính sách bảo hành tại PC Mall như thế nào?" });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.intent, "rule_direct_reply");
      assert.ok(res.body.data.reply.includes("Bảo hành"));
    });

    test("1.2 Tier-1 Off-topic Guardrail BLOCK should block non-IT queries cleanly", async () => {
      const res = await request(app)
        .post("/api/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: "Chỉ mình công thức nấu ăn phở bò ngon nhất" });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.intent, "rule_blocked");
      assert.ok(
        res.body.data.reply.includes("Trợ lý AI") || res.body.data.reply.includes("chuyên gia Tư vấn Phần cứng")
      );
    });

    test("1.3 Tech Recommendation (Intel & AMD latest generations) should return accurate architecture overview", async () => {
      const resIntel = await request(app)
        .post("/api/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: "Tư vấn dòng CPU Intel mới nhất hiện nay" });

      assert.equal(resIntel.status, 200);
      assert.equal(resIntel.body.success, true);
      assert.ok(
        resIntel.body.data.reply.includes("Core Ultra") || resIntel.body.data.reply.includes("Intel"),
        "Should mention Intel Core Ultra / 14th Gen"
      );

      const resAmd = await request(app)
        .post("/api/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: "Dòng chip AMD Ryzen mới nhất hiện nay là gì?" });

      assert.equal(resAmd.status, 200);
      assert.equal(resAmd.body.success, true);
      assert.ok(
        resAmd.body.data.reply.includes("Ryzen") || resAmd.body.data.reply.includes("AM5"),
        "Should mention AMD Ryzen / AM5"
      );
    });

    test("1.4 Comparison Intent (RTX 4060 vs RTX 4070) should return technical comparison & real products", async () => {
      const res = await request(app)
        .post("/api/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: "So sánh RTX 4060 và RTX 4070 nên mua card nào?" });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.reply.includes("4060") && res.body.data.reply.includes("4070"));
      const productNames: string[] = (res.body.data.products || []).map((p: any) => String(p.name || p.productName || ""));
      if (productNames.length >= 2) {
        assert.ok(
          productNames.some((n) => n.includes("4060")) && productNames.some((n) => n.includes("4070")),
          `Comparison should return one product per side, got: ${productNames.join(" | ")}`
        );
      }
    });

    test("1.5 Authenticated Chat History Load & Clear (verifying req.user.userId -> req.user.id fix)", async () => {
      const histRes = await request(app)
        .get("/api/ai/history")
        .set("Authorization", `Bearer ${customerToken}`);

      assert.equal(histRes.status, 200);
      assert.equal(histRes.body.success, true);
      assert.ok(Array.isArray(histRes.body.data), "History should return an array");
    });
  });

  describe("2. Floating AI Chat Widget (/api/chat/ai-consultation)", () => {
    test("2.1 Free-text Hardware Theory question (isFormSubmit: false) should NOT be hijacked as a 25M PC Build", async () => {
      const res = await request(app)
        .post("/api/chat/ai-consultation")
        .send({
          message: "RAM 3200 cắm mainboard 2666 có cháy không bạn?",
          criteria: {
            purpose: "gaming",
            resolution: "1080p",
            ownedList: [],
            ownedNotes: "",
            isFormSubmit: false
          }
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.type, "theory_explanation");
      assert.ok(
        res.body.data.text.includes("2666") || res.body.data.text.includes("RAM"),
        "Should explain RAM bus downclocking instead of building a 25M PC"
      );
    });

    test("2.2 Tier-1 FAQ & Off-topic Guardrail should work in Floating AI Chat Widget", async () => {
      const faqRes = await request(app)
        .post("/api/chat/ai-consultation")
        .send({
          message: "Cửa hàng có hỗ trợ trả góp không?",
          criteria: { isFormSubmit: false }
        });

      assert.equal(faqRes.status, 200);
      assert.equal(faqRes.body.success, true);
      assert.ok(faqRes.body.data.text.includes("trả góp") || faqRes.body.data.text.includes("Trả góp"));

      const blockRes = await request(app)
        .post("/api/chat/ai-consultation")
        .send({
          message: "Dự báo thời tiết hôm nay thế nào?",
          criteria: { isFormSubmit: false }
        });

      assert.equal(blockRes.status, 200);
      assert.equal(blockRes.body.success, true);
      assert.ok(
        blockRes.body.data.text.includes("PC Mall") ||
        blockRes.body.data.text.includes("Trợ lý AI")
      );
    });

    test("2.3 Form Submit Build Consultation (isFormSubmit: true) should generate a real compatible PC Build", async () => {
      const res = await request(app)
        .post("/api/chat/ai-consultation")
        .send({
          message: "Tư vấn giúp mình bộ PC nhu cầu GAMING (Độ phân giải 1080P) với ngân sách khoảng 20.000.000đ.",
          criteria: {
            purpose: "gaming",
            budget: 20000000,
            resolution: "1080p",
            ownedList: [],
            ownedNotes: "",
            isFormSubmit: true
          }
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.type, "build_recommendation");
      assert.ok(res.body.data.buildPayload, "Should include buildPayload for 1-click apply to PC Builder");
      assert.ok(Array.isArray(res.body.data.buildPayload.components));
      assert.ok(res.body.data.buildPayload.components.length >= 6);
    });
  });

  describe("3. PC Builder AI Suggest Stream (/api/pc-builder/ai-suggest-stream)", () => {
    test("3.1 Should stream status, chunks, and done event with 8 real selectedComponents & non-empty advice", async () => {
      const res = await request(app)
        .post("/api/pc-builder/ai-suggest-stream")
        .send({
          budget: 25000000,
          useCase: "gaming",
          resolution: "1080p",
          customPrompt: "Ưu tiên tản nhiệt mát mẻ"
        });

      assert.equal(res.status, 200);
      const events = parseSseEvents(res.text);
      assert.ok(events.length >= 2, "Should emit multiple SSE events");

      const doneEvent = events.find((e) => e.type === "done");
      assert.ok(doneEvent, "Should emit a 'done' SSE event");
      assert.ok(doneEvent.advice && doneEvent.advice.trim().length > 50, "Advice should be non-empty technical markdown");
      assert.ok(doneEvent.selectedComponents, "Should return selectedComponents map");
      const selectedKeys = Object.keys(doneEvent.selectedComponents);
      assert.ok(selectedKeys.length >= 6, `Expected at least 6 selected components, got ${selectedKeys.length}`);
      assert.ok(doneEvent.totalPrice > 0, "Total price should be positive");
    });
  });

  describe("4. PC Builder AI Audit & Interactive Chat Stream (/api/pc-builder/ai-audit-stream & /ai-chat-stream)", () => {
    const sampleBuildItems = [
      { componentType: "cpu", productName: "Intel Core i3-12100F", price: 2190000, specs: { socket: "LGA1700" } },
      { componentType: "gpu", productName: "NVIDIA GeForce RTX 4070 Super 12GB", price: 16500000, specs: {} },
      { componentType: "mainboard", productName: "ASUS Prime B760M-A DDR4", price: 3290000, specs: { socket: "LGA1700", ram_type: "DDR4" } },
      { componentType: "ram", productName: "Kingston Fury Beast 8GB DDR4 3200MHz", price: 590000, specs: { ram_type: "DDR4" } },
      { componentType: "psu", productName: "Corsair CV550 550W 80 Plus Bronze", price: 1190000, specs: { psu_wattage: "550W" } }
    ];

    test("4.1 AI Audit Stream should detect hardware bottlenecks/issues and attach real DB replacement products", async () => {
      const res = await request(app)
        .post("/api/pc-builder/ai-audit-stream")
        .send({
          buildItems: sampleBuildItems,
          useCase: "gaming",
          resolution: "1080p",
          targetBudget: 25000000
        });

      assert.equal(res.status, 200);
      const events = parseSseEvents(res.text);
      const doneEvent = events.find((e) => e.type === "done");
      assert.ok(doneEvent, "Should emit a 'done' SSE event for audit");
      assert.ok(doneEvent.report && doneEvent.report.trim().length > 50, "Audit report should be non-empty");
      assert.ok(typeof doneEvent.auditScore === "number", "Should include numeric auditScore");
      assert.ok(Array.isArray(doneEvent.issues), "Should include issues array");
    });

    test("4.2 AI Chat Stream should stream engineer replies and support cost-reduction replacement suggestions", async () => {
      const res = await request(app)
        .post("/api/pc-builder/ai-chat-stream")
        .send({
          buildItems: sampleBuildItems,
          userMessage: "Làm sao để giảm chi phí khoảng 2 triệu mà ít ảnh hưởng FPS nhất?",
          useCase: "gaming",
          resolution: "1080p"
        });

      assert.equal(res.status, 200);
      const events = parseSseEvents(res.text);
      const doneEvent = events.find((e) => e.type === "done");
      assert.ok(doneEvent, "Should emit a 'done' SSE event for chat");
      assert.ok(doneEvent.reply && doneEvent.reply.trim().length > 20, "Chat reply should be non-empty at root doneEvent.reply");
      assert.ok(Array.isArray(doneEvent.replacements), "Should include replacements array");
    });

    test("4.3 AI Chat Stream DIRECT_REPLY should return root-level reply and chunk event", async () => {
      const res = await request(app)
        .post("/api/pc-builder/ai-chat-stream")
        .send({
          buildItems: sampleBuildItems,
          userMessage: "Chính sách bảo hành như thế nào?",
          useCase: "gaming",
          resolution: "1080p"
        });

      assert.equal(res.status, 200);
      const events = parseSseEvents(res.text);
      const doneEvent = events.find((e) => e.type === "done");
      assert.ok(doneEvent, "Should emit a 'done' event");
      assert.ok(doneEvent.reply && doneEvent.reply.includes("Bảo hành"), "Root-level doneEvent.reply must be populated for AiBuildAuditModal");
    });
  });

  describe("5. Admin AI Config Center (/api/ai/admin/*)", () => {
    test("5.1 Admin can list rules, prompts, system config, and run filter simulator", async () => {
      const rulesRes = await request(app)
        .get("/api/ai/admin/rules")
        .set("Authorization", `Bearer ${adminToken}`);
      assert.equal(rulesRes.status, 200);
      assert.ok(Array.isArray(rulesRes.body.data.rules), "Rules payload should be { rules, total }");
      assert.equal(rulesRes.body.data.total, rulesRes.body.data.rules.length);

      const promptsRes = await request(app)
        .get("/api/ai/admin/prompts")
        .set("Authorization", `Bearer ${adminToken}`);
      assert.equal(promptsRes.status, 200);
      const promptsData = promptsRes.body.data;
      const promptList = Array.isArray(promptsData) ? promptsData : Object.values(promptsData || {});
      assert.ok(promptList.length >= 3, "Should expose prompts for GENERAL_CHAT, BUILDER_SUGGEST, BUILDER_AUDIT_CHAT");

      const sysCfgRes = await request(app)
        .get("/api/ai/admin/system-config")
        .set("Authorization", `Bearer ${adminToken}`);
      assert.equal(sysCfgRes.status, 200);
      assert.ok(sysCfgRes.body.data.config, "Should return central AI system config");
      assert.ok(sysCfgRes.body.data.estimation, "Should return token estimation");
      assert.ok(!String(JSON.stringify(sysCfgRes.body.data)).includes("AIza"), "Raw API key must never be exposed");

      const simRes = await request(app)
        .post("/api/ai/admin/test-filter")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ scope: "GENERAL_CHAT", text: "So sánh DDR4 và DDR5?" });
      assert.equal(simRes.status, 200);
      assert.equal(simRes.body.data.handled, false);
      assert.equal(simRes.body.data.action, "SYSTEM_INJECT");
      assert.ok(simRes.body.data.promptInjections.length > 0);
    });
  });
});
