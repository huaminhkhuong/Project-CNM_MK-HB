import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { RetrieverService } from "../src/modules/ai/retriever.service";

describe("RAG Phase 3: Hybrid Search & Augmented Context Retrieval", () => {
  it("searchSimilarProducts performs accurate metadata filtering on GPU within budget", async () => {
    const results = await RetrieverService.searchSimilarProducts(
      "Card đồ họa chơi game mượt mà",
      {
        category: "vga", // Test synonym mapping to 'gpu'
        maxPrice: 12000000,
        inStockOnly: true
      },
      4
    );

    assert.ok(results.length > 0, "Should return matching GPUs");
    for (const prod of results) {
      assert.equal(prod.category, "gpu", `Product ${prod.name} must belong to category 'gpu'`);
      assert.ok(prod.price <= 12000000, `Price ${prod.price} must be <= 12M`);
      assert.ok(prod.stock > 0, `Stock ${prod.stock} must be > 0`);
      assert.ok(prod.productId > 0, "ProductId must be positive");
    }
  });

  it("searchSimilarProducts can filter by CPU socket compatibility (LGA1700)", async () => {
    const results = await RetrieverService.searchSimilarProducts(
      "CPU Intel Core đa nhân render",
      {
        category: "cpu",
        socket: "LGA1700",
        inStockOnly: true
      },
      3
    );

    assert.ok(results.length > 0, "Should return matching LGA1700 CPUs");
    for (const cpu of results) {
      assert.equal(cpu.category, "cpu");
      assert.ok(
        (cpu.socket || "").toLowerCase().includes("lga1700") ||
        (cpu.name || "").toLowerCase().includes("intel") ||
        (cpu.snippet || "").toLowerCase().includes("lga1700"),
        "CPU must be LGA1700 compatible"
      );
    }
  });

  it("searchDomainKnowledge retrieves PSU wattage formula and Downclocking rules", async () => {
    // 1. Tìm kiếm công thức nguồn
    const psuKnowledge = await RetrieverService.searchDomainKnowledge("Cách tính nguồn PSU cho card màn hình và CPU", {
      topK: 1
    });

    assert.ok(psuKnowledge.length > 0, "Should retrieve PSU knowledge chunk");
    assert.ok(
      psuKnowledge[0].text.includes("PSU") ||
      psuKnowledge[0].text.includes("Công suất") ||
      psuKnowledge[0].text.includes("Nguồn"),
      "Retrieved chunk must relate to PSU calculation"
    );

    // 2. Tìm kiếm chính sách đổi mới
    const policyKnowledge = await RetrieverService.searchDomainKnowledge("Chính sách bảo hành đổi mới 1 đổi 1 trong bao nhiêu ngày", {
      topK: 2
    });

    assert.ok(policyKnowledge.length > 0, "Should retrieve store policy chunk");
    const combinedPolicyText = policyKnowledge.map((p) => p.text).join("\n");
    assert.ok(
      combinedPolicyText.includes("30 ngày") ||
      combinedPolicyText.includes("Bảo hành"),
      "Retrieved chunks must include warranty and replacement policy"
    );
  });

  it("retrieveRelevantContext generates ready-to-inject augmented prompt context", async () => {
    const userMessage = "Tư vấn case 15 triệu chơi game eSports, có sẵn RAM DDR4 ở nhà";
    const context = await RetrieverService.retrieveRelevantContext(userMessage, {
      budget: 15000000,
      ramType: "DDR4"
    });

    assert.equal(typeof context.knowledgeText, "string");
    assert.equal(typeof context.productsText, "string");
    assert.ok(context.productsText.length > 0, "Products context should not be empty");
    assert.ok(context.rawProducts.length > 0, "Raw products list should contain items");
    assert.ok(context.productsText.includes("ID:"), "Products context must include Product ID for frontend linking");
  });
});
