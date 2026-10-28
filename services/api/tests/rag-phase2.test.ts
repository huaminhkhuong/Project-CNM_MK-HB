import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

import { VectorStoreService } from "../src/modules/ai/vector-store.service";
import { EmbeddingService } from "../src/modules/ai/embedding.service";

describe("RAG Phase 2: ETL Synced Vector Catalogs & Knowledge Base", () => {
  it("products.json and knowledge.json must exist in data/vectors", () => {
    const productsFile = path.resolve(__dirname, "../data/vectors/products.json");
    const knowledgeFile = path.resolve(__dirname, "../data/vectors/knowledge.json");

    assert.ok(fs.existsSync(productsFile), "products.json vector store file must exist");
    assert.ok(fs.existsSync(knowledgeFile), "knowledge.json vector store file must exist");

    const statProd = fs.statSync(productsFile);
    const statKb = fs.statSync(knowledgeFile);

    assert.ok(statProd.size > 100000, `products.json should be substantial (>100KB), got ${statProd.size} bytes`);
    assert.ok(statKb.size > 10000, `knowledge.json should be substantial (>10KB), got ${statKb.size} bytes`);
  });

  it("VectorStoreService can load products and perform real semantic + metadata search", async () => {
    const loaded = VectorStoreService.load("products");
    assert.ok(loaded, "VectorStoreService should load products.json successfully");

    const count = VectorStoreService.count("products");
    assert.ok(count >= 200, `Products collection should contain at least 200 products, got ${count}`);

    // Query: Tìm CPU tầm giá dưới 6 triệu
    const queryVec = await EmbeddingService.generateEmbedding("CPU Intel Core i5 gaming");
    const results = VectorStoreService.query("products", queryVec, {
      topK: 5,
      filterFn: (meta: any) => meta.category === "cpu" && meta.price <= 6000000 && meta.stock > 0
    });

    assert.ok(results.length > 0, "Should return at least 1 matching CPU under 6M");
    const topDoc = results[0].document;

    assert.equal(topDoc.metadata.category, "cpu");
    assert.ok(topDoc.metadata.price <= 6000000);
    assert.ok(typeof topDoc.metadata.productId === "number");
    assert.ok(topDoc.metadata.name.length > 0);
  });

  it("VectorStoreService can load knowledge and retrieve hardware engineering rules", async () => {
    const loaded = VectorStoreService.load("knowledge");
    assert.ok(loaded, "VectorStoreService should load knowledge.json successfully");

    const count = VectorStoreService.count("knowledge");
    assert.ok(count >= 5, `Knowledge collection should contain multiple chunks, got ${count}`);

    // Query: Hỏi về hạ xung RAM và Downclocking
    const queryVec = await EmbeddingService.generateEmbedding("RAM 3200 cắm main 2666 có bị cháy không hay hạ xung downclocking");
    const results = VectorStoreService.query("knowledge", queryVec, {
      topK: 2
    });

    assert.ok(results.length > 0, "Should retrieve relevant knowledge sections");
    const matchedText = results[0].document.text;
    assert.ok(
      matchedText.includes("Downclocking") ||
      matchedText.includes("hạ xung") ||
      matchedText.includes("RAM") ||
      matchedText.includes("Tương thích"),
      "Retrieved section should be related to RAM or compatibility"
    );
  });
});
