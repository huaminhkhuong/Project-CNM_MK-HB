import assert from "node:assert/strict";
import { describe, it } from "node:test";

const { aiRuleService, AiRuleService } = require("../src/modules/ai/ai-rule.service");
const { normalizeVietnamese, cleanSearchText } = require("../src/modules/ai/ai-normalize-helpers");
const { getSynthesizedBuildByBudget } = require("../src/modules/ai/ai.service");

describe("AI Rule Engine, Normalization & Guardrails Unit Test Suite", () => {
  describe("1. Vietnamese Text Normalization Helpers", () => {
    it("normalizeVietnamese strips diacritics and converts d/D correctly", () => {
      assert.strictEqual(normalizeVietnamese("Chào bạn, tôi muốn hỏi về Bảo Hành!"), "chao ban, toi muon hoi ve bao hanh!");
      assert.strictEqual(normalizeVietnamese("Đơn hàng ĐÃ ĐƯỢC thanh toán"), "don hang da duoc thanh toan");
      assert.strictEqual(normalizeVietnamese("Nấu Ăn Món Xào Chua Ngọt"), "nau an mon xao chua ngot");
    });

    it("cleanSearchText replaces punctuation with spaces and collapses whitespace", () => {
      assert.strictEqual(cleanSearchText("ram-ddr4/ddr5???"), "ram ddr4 ddr5");
      assert.strictEqual(cleanSearchText("   chính   sách    bảo hành...   "), "chinh sach bao hanh");
      assert.strictEqual(cleanSearchText("sườn xào, chua ngọt!"), "suon xao chua ngot");
    });
  });

  describe("2. Tier-1 FAQ & Direct Reply Evaluation (0ms, 0$ Token)", () => {
    it("returns DIRECT_REPLY for basic greetings with accents and without accents", () => {
      const accented = aiRuleService.evaluateInput("GENERAL_CHAT", "Xin chào shop ơi, bạn là ai thế?");
      assert.strictEqual(accented.handled, true);
      assert.strictEqual(accented.action, "DIRECT_REPLY");
      assert.strictEqual(accented.model, "system-local-faq");
      assert.ok(accented.reply.includes("PC Mall"));

      const unaccented = aiRuleService.evaluateInput("GENERAL_CHAT", "chao shop");
      assert.strictEqual(unaccented.handled, true);
      assert.strictEqual(unaccented.action, "DIRECT_REPLY");
    });

    it("returns DIRECT_REPLY for Warranty inquiries with/without accents", () => {
      const accented = aiRuleService.evaluateInput("GENERAL_CHAT", "Chính sách bảo hành điện tử của bên mình như thế nào?");
      assert.strictEqual(accented.handled, true);
      assert.strictEqual(accented.action, "DIRECT_REPLY");
      assert.ok(accented.reply.includes("12 đến 36 tháng"));

      const unaccented = aiRuleService.evaluateInput("GENERAL_CHAT", "cho minh hoi thoi han bao hanh may tinh");
      assert.strictEqual(unaccented.handled, true);
      assert.strictEqual(unaccented.action, "DIRECT_REPLY");
    });

    it("returns DIRECT_REPLY for Payment inquiries (VNPay, trả góp, COD)", () => {
      const res = aiRuleService.evaluateInput("GENERAL_CHAT", "bên shop có hỗ trợ trả góp qua VNPay hoặc quẹt thẻ tín dụng không?");
      assert.strictEqual(res.handled, true);
      assert.strictEqual(res.action, "DIRECT_REPLY");
      assert.ok(res.reply.includes("VNPay"));
    });

    it("injects system prompt instructions for DDR4 vs DDR5 comparison to LLM", () => {
      const resUserPrompt = aiRuleService.evaluateInput("GENERAL_CHAT", "Nên chọn RAM DDR4 hay DDR5?");
      assert.strictEqual(resUserPrompt.handled, false);
      assert.ok(resUserPrompt.promptInjections.length > 0);
      assert.ok(resUserPrompt.promptInjections.some(inj => inj.includes("DDR4")));

      const res1 = aiRuleService.evaluateInput("GENERAL_CHAT", "So sánh RAM DDR4 và DDR5 khác nhau thế nào?");
      assert.strictEqual(res1.handled, false);
      assert.ok(res1.promptInjections.length > 0);

      const res2 = aiRuleService.evaluateInput("GENERAL_CHAT", "ram ddr4 va ddr5");
      assert.strictEqual(res2.handled, false);
      assert.ok(res2.promptInjections.length > 0);
    });

    it("returns DIRECT_REPLY for Showroom address and working hours", () => {
      const res = aiRuleService.evaluateInput("GENERAL_CHAT", "dia chi showroom o dau va may gio mo cua?");
      assert.strictEqual(res.handled, true);
      assert.strictEqual(res.action, "DIRECT_REPLY");
      assert.ok(res.reply.includes("Showroom"));
    });
  });

  describe("3. Off-Topic Guardrail Filter Blocking (All 8 Domains)", () => {
    it("blocks Culinary / Cooking inquiries (accented and unaccented)", () => {
      const res1 = aiRuleService.evaluateInput("GENERAL_CHAT", "Chỉ mình công thức nấu sườn xào chua ngọt với");
      assert.strictEqual(res1.handled, true);
      assert.strictEqual(res1.action, "BLOCK");
      assert.ok(res1.reply.includes("không thể giải đáp"));

      const res2 = aiRuleService.evaluateInput("GENERAL_CHAT", "chi minh cach nau mon suon xao chua ngot");
      assert.strictEqual(res2.handled, true);
      assert.strictEqual(res2.action, "BLOCK");
    });

    it("blocks Academic / Homework / Poetry inquiries", () => {
      const res1 = aiRuleService.evaluateInput("GENERAL_CHAT", "Giải hộ mình bài tập toán lớp 12 phần tích phân này");
      assert.strictEqual(res1.handled, true);
      assert.strictEqual(res1.action, "BLOCK");

      const res2 = aiRuleService.evaluateInput("GENERAL_CHAT", "lam tho tinh tang ban gai di bot");
      assert.strictEqual(res2.handled, true);
      assert.strictEqual(res2.action, "BLOCK");
    });

    it("blocks Fortune-telling / Astrology / Tarot inquiries", () => {
      const res = aiRuleService.evaluateInput("GENERAL_CHAT", "xem boi tu vi tuoi giap tuat nam 2026");
      assert.strictEqual(res.handled, true);
      assert.strictEqual(res.action, "BLOCK");
    });

    it("blocks Gambling / Lottery / Casino inquiries", () => {
      const res = aiRuleService.evaluateInput("GENERAL_CHAT", "hom nay danh de con gi, cho soi cau lo de");
      assert.strictEqual(res.handled, true);
      assert.strictEqual(res.action, "BLOCK");
    });

    it("blocks Medical / Prescription inquiries", () => {
      const res = aiRuleService.evaluateInput("GENERAL_CHAT", "Tôi bị sốt đau đầu thì uống thuốc kháng sinh gì?");
      assert.strictEqual(res.handled, true);
      assert.strictEqual(res.action, "BLOCK");
    });

    it("blocks Beauty / Fashion inquiries", () => {
      const res = aiRuleService.evaluateInput("GENERAL_CHAT", "tu van son moi va kem chong nang cho da dau");
      assert.strictEqual(res.handled, true);
      assert.strictEqual(res.action, "BLOCK");
    });

    it("blocks Politics / Military inquiries", () => {
      const res = aiRuleService.evaluateInput("GENERAL_CHAT", "tin tuc bau cu tong thong va chien tranh");
      assert.strictEqual(res.handled, true);
      assert.strictEqual(res.action, "BLOCK");
    });

    it("blocks Sports / Match scores inquiries", () => {
      const res = aiRuleService.evaluateInput("GENERAL_CHAT", "cho xem ket qua bong da ngoai hang anh hom qua");
      assert.strictEqual(res.handled, true);
      assert.strictEqual(res.action, "BLOCK");
    });
  });

  describe("4. PC Builder Scope Evaluation (BUILDER_SUGGEST & BUILDER_AUDIT_CHAT)", () => {
    it("blocks budget under 5,000,000 VND in BUILDER_SUGGEST", () => {
      const res = aiRuleService.evaluateInput("BUILDER_SUGGEST", "Build PC gaming", { budget: 3500000 });
      assert.strictEqual(res.handled, true);
      assert.strictEqual(res.action, "BLOCK");
      assert.ok(res.reply.includes("5.000.000đ"));
    });

    it("blocks budget over 250,000,000 VND in BUILDER_SUGGEST", () => {
      const res = aiRuleService.evaluateInput("BUILDER_SUGGEST", "Build PC khủng", { budget: 300000000 });
      assert.strictEqual(res.handled, true);
      assert.strictEqual(res.action, "BLOCK");
      assert.ok(res.reply.includes("250.000.000đ"));
    });

    it("injects system prompt instructions for Bottleneck inquiries in BUILDER_AUDIT_CHAT", () => {
      const res = aiRuleService.evaluateInput("BUILDER_AUDIT_CHAT", "Dàn máy này có bị nghẽn cổ chai bottleneck không?");
      assert.strictEqual(res.handled, false);
      assert.strictEqual(res.action, "PASS_THROUGH");
      assert.ok(res.promptInjections.length > 0);
      assert.ok(res.promptInjections.some((inj: string) => inj.includes("Bottleneck")));
    });

    it("injects system prompt instructions for PSU power safety inquiries in BUILDER_AUDIT_CHAT", () => {
      const res = aiRuleService.evaluateInput("BUILDER_AUDIT_CHAT", "nguon co no khong va can bao nhieu watt");
      assert.strictEqual(res.handled, false);
      assert.strictEqual(res.action, "PASS_THROUGH");
      assert.ok(res.promptInjections.length > 0);
      assert.ok(res.promptInjections.some((inj: string) => inj.includes("PSU")));
    });

    it("allows valid hardware purchase questions to pass through to LLM (PASS_THROUGH)", () => {
      const res = aiRuleService.evaluateInput("GENERAL_CHAT", "Tư vấn cấu hình PC gaming 15 triệu chơi mượt GTA V");
      assert.strictEqual(res.handled, false);
      assert.strictEqual(res.action, "PASS_THROUGH");
      assert.strictEqual(res.model, "llm-ready");
    });
  });

  describe("5. Rule CRUD & Prompt Customization Operations", () => {
    it("getAllRules filters properly by scope and action", () => {
      const generalRules = aiRuleService.getAllRules({ scope: "GENERAL_CHAT" });
      assert.ok(generalRules.length > 0);
      assert.ok(generalRules.every((r: any) => r.scope === "GENERAL_CHAT" || r.scope === "GLOBAL"));

      const blockedRules = aiRuleService.getAllRules({ action: "BLOCK" });
      assert.ok(blockedRules.length > 0);
      assert.ok(blockedRules.every((r: any) => r.action === "BLOCK"));
    });

    it("getPrompts returns prompts for all 3 scopes", () => {
      const prompts = aiRuleService.getPrompts();
      assert.ok(prompts.GENERAL_CHAT);
      assert.ok(prompts.BUILDER_SUGGEST);
      assert.ok(prompts.BUILDER_AUDIT_CHAT);
      assert.ok(prompts.GENERAL_CHAT.systemPrompt);
      assert.ok(prompts.BUILDER_SUGGEST.systemPrompt);
      assert.ok(prompts.BUILDER_AUDIT_CHAT.systemPrompt);
    });

    it("can create, toggle, update, and delete a custom rule", () => {
      const created = aiRuleService.createRule({
        scope: "GENERAL_CHAT",
        name: "Test Promo Discount Rule",
        matchType: "contains",
        pattern: "ma giam gia test, voucher test",
        action: "DIRECT_REPLY",
        directReply: "Mã giảm giá thử nghiệm: TEST2026",
        priority: 77
      });

      assert.ok(created.id);
      assert.strictEqual(created.name, "Test Promo Discount Rule");

      // Verify rule can be evaluated
      const evalRes = aiRuleService.evaluateInput("GENERAL_CHAT", "cho xin ma giam gia test");
      assert.strictEqual(evalRes.handled, true);
      assert.strictEqual(evalRes.reply, "Mã giảm giá thử nghiệm: TEST2026");

      // Toggle off
      const toggled = aiRuleService.toggleRule(created.id);
      assert.strictEqual(toggled.isActive, false);

      // Verify it no longer triggers when inactive
      const evalInactive = aiRuleService.evaluateInput("GENERAL_CHAT", "cho xin ma giam gia test");
      assert.strictEqual(evalInactive.handled, false);

      // Delete rule
      const deleted = aiRuleService.deleteRule(created.id);
      assert.strictEqual(deleted, true);

      // Verify rule no longer exists
      assert.strictEqual(aiRuleService.getRuleById(created.id), null);
    });
  });

  describe("6. Synthesized Build Fallback Generator", () => {
    it("generates a complete 8-component build within realistic budget limits", () => {
      const components = getSynthesizedBuildByBudget(15000000, "gaming");
      assert.ok(Array.isArray(components), "Must return an array of components");
      assert.strictEqual(components.length, 8, "Must contain exactly 8 parts");

      const totalPrice = components.reduce((sum: number, c: any) => sum + Number(c.price || 0), 0);
      assert.ok(totalPrice > 0);
      assert.ok(totalPrice <= 17000000, "Total price should be close to 15M target");

      const types = components.map((c: any) => c.componentType);
      assert.ok(types.includes("cpu"), "Must include CPU");
      assert.ok(types.includes("mainboard"), "Must include Mainboard");
      assert.ok(types.includes("ram"), "Must include RAM");
      assert.ok(types.includes("gpu"), "Must include GPU");
      assert.ok(types.includes("storage"), "Must include Storage");
      assert.ok(types.includes("psu"), "Must include PSU");
      assert.ok(types.includes("case"), "Must include Case");
      assert.ok(types.includes("cooling"), "Must include Cooling");
    });

    it("adjusts specs appropriately between 15M budget and 50M high-end budget", () => {
      const entryComponents = getSynthesizedBuildByBudget(15000000, "office");
      const highEndComponents = getSynthesizedBuildByBudget(50000000, "gaming");

      const entryTotal = entryComponents.reduce((sum: number, c: any) => sum + Number(c.price || 0), 0);
      const highTotal = highEndComponents.reduce((sum: number, c: any) => sum + Number(c.price || 0), 0);

      assert.ok(highTotal > entryTotal, "50M build total must exceed 15M build total");

      const entryGpu = entryComponents.find((c: any) => c.componentType === "gpu");
      const highGpu = highEndComponents.find((c: any) => c.componentType === "gpu");
      assert.ok(highGpu && entryGpu && highGpu.price > entryGpu.price, "High-end GPU price must exceed entry GPU price");
    });
  });
});
