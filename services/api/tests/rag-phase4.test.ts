import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app";
import { aiAssistantService } from "../src/modules/chat/ai-assistant.service";

describe("RAG Phase 4: End-to-End AI Consultation & PC Builder Integration", () => {
  it("consultWithRag handles hardware theory queries using RAG knowledge", async () => {
    const res = await aiAssistantService.consultWithRag("RAM 3200 cắm main 2666 có bị cháy không hay tự hạ xung?");

    assert.equal(res.type, "theory_explanation");
    assert.ok(
      res.text.includes("Downclocking") ||
      res.text.includes("hạ xung") ||
      res.text.includes("an toàn"),
      "Response text must explain downclocking safety"
    );
  });

  it("consultWithRag builds a complete PC and excludes user-owned RAM (Exclusion Engine)", async () => {
    const res = await aiAssistantService.consultWithRag("Tư vấn case 15 triệu chơi game eSports", {
      budget: 15000000,
      purpose: "gaming",
      ownedList: ["ram"],
      ownedNotes: "RAM DDR4 16GB Kingston"
    });

    assert.equal(res.type, "build_recommendation");
    assert.ok(res.buildPayload, "Build payload must be present");
    assert.ok(Array.isArray(res.buildPayload.components), "Components must be an array");

    const components = res.buildPayload.components;
    assert.ok(components.length >= 6, `Should have at least 6 components, got ${components.length}`);

    // Check RAM is marked as owned with price 0
    const ramComp = components.find((c: any) => c.componentType === "ram");
    assert.ok(ramComp, "RAM component slot must exist");
    assert.equal(ramComp.isOwned, true, "RAM must be marked as owned");
    assert.equal(ramComp.price, 0, "Owned RAM must have price 0");

    // Check other components are real products with positive IDs and prices
    const nonOwned = components.filter((c: any) => !c.isOwned);
    for (const comp of nonOwned) {
      assert.ok(comp.productId > 0, `Component ${comp.name} must have valid productId`);
      assert.ok(comp.price > 0, `Component ${comp.name} must have positive price`);
    }

    assert.ok(res.buildPayload.totalPrice > 0, "Total price must be positive");
    assert.ok(res.buildPayload.totalPrice <= 16500000, `Total price ${res.buildPayload.totalPrice} should not excessively exceed budget 15M`);
  });

  it("POST /api/chat/ai-consultation HTTP endpoint returns RAG product recommendations", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/chat/ai-consultation")
      .send({ message: "Tìm card màn hình tầm 8 triệu" });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.ok(response.body.data.text.length > 0);
    assert.ok(Array.isArray(response.body.data.products));
    assert.ok(response.body.data.products.length > 0, "Should return product cards");

    const firstProduct = response.body.data.products[0];
    assert.ok(firstProduct.productId || firstProduct.id);
    assert.ok(firstProduct.price);
  });

  it("POST /api/chat/ai-consultation HTTP endpoint returns PC Builder payload for 1-click apply", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/chat/ai-consultation")
      .send({
        message: "Build case 12tr văn phòng",
        criteria: {
          budget: 12000000,
          purpose: "office"
        }
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.type, "build_recommendation");
    assert.ok(response.body.data.buildPayload);
    assert.ok(response.body.data.buildPayload.components.length >= 6);

    // Verify all components have componentType matching PC Builder slots (cpu, mainboard, ram, gpu, storage, psu, case)
    const types = response.body.data.buildPayload.components.map((c: any) => c.componentType);
    assert.ok(types.includes("cpu"));
    assert.ok(types.includes("mainboard"));
    assert.ok(types.includes("ram"));
    assert.ok(types.includes("storage"));
    assert.ok(types.includes("psu"));
    assert.ok(types.includes("case"));
  });
});
