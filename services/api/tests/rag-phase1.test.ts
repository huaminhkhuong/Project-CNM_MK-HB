import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

import { EmbeddingService } from "../src/modules/ai/embedding.service";
import { VectorStoreService } from "../src/modules/ai/vector-store.service";

describe("RAG Phase 1: Knowledge Base, Embeddings & Vector Store", () => {
  it("Knowledge Base markdown files must exist and be non-empty", () => {
    const hwPath = path.resolve(__dirname, "../knowledge/hardware-rules.md");
    const policyPath = path.resolve(__dirname, "../knowledge/store-policies.md");

    assert.ok(fs.existsSync(hwPath), "hardware-rules.md should exist");
    assert.ok(fs.existsSync(policyPath), "store-policies.md should exist");

    const hwContent = fs.readFileSync(hwPath, "utf-8");
    const policyContent = fs.readFileSync(policyPath, "utf-8");

    assert.ok(hwContent.includes("LGA1700"), "hardware-rules should contain LGA1700 rules");
    assert.ok(hwContent.includes("Downclocking"), "hardware-rules should contain RAM Downclocking explanation");
    assert.ok(policyContent.includes("30 ngày"), "store-policies should contain 30-day warranty rule");
  });

  it("EmbeddingService generates normalized 768-dimensional vector", async () => {
    const text = "Intel Core i5-13400F LGA1700 10 nhân 16 luồng";
    const vector = await EmbeddingService.generateEmbedding(text);

    assert.equal(vector.length, 768, "Embedding vector length must be 768");

    // L2 norm must be approximately 1.0
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    assert.ok(Math.abs(norm - 1.0) < 0.001, `Vector should be normalized: norm is ${norm}`);
  });

  it("VectorStoreService can upsert, query with metadata filter, and score similarity", async () => {
    const collectionName = "test-phase1-products";
    VectorStoreService.clear(collectionName);

    const vecCpu1 = EmbeddingService.generateDeterministicVector("Intel Core i5 13400F CPU Socket LGA1700");
    const vecCpu2 = EmbeddingService.generateDeterministicVector("AMD Ryzen 5 7600 CPU Socket AM5 DDR5");
    const vecGpu = EmbeddingService.generateDeterministicVector("NVIDIA GeForce RTX 4060 GPU 8GB VRAM");

    VectorStoreService.upsert(collectionName, [
      {
        id: "cpu-1",
        text: "Intel Core i5-13400F",
        vector: vecCpu1,
        metadata: { category: "cpu", price: 4890000, socket: "LGA1700" }
      },
      {
        id: "cpu-2",
        text: "AMD Ryzen 5 7600",
        vector: vecCpu2,
        metadata: { category: "cpu", price: 5490000, socket: "AM5" }
      },
      {
        id: "gpu-1",
        text: "ASUS Dual RTX 4060",
        vector: vecGpu,
        metadata: { category: "gpu", price: 8290000 }
      }
    ]);

    assert.equal(VectorStoreService.count(collectionName), 3);

    // Query 1: Tìm kiếm CPU Intel socket LGA1700
    const queryVec = EmbeddingService.generateDeterministicVector("Cần mua CPU Intel LGA1700");
    const results = VectorStoreService.query(collectionName, queryVec, {
      topK: 2,
      filterFn: (meta) => meta.category === "cpu" && meta.socket === "LGA1700"
    });

    assert.equal(results.length, 1);
    assert.equal(results[0].document.id, "cpu-1");
    assert.ok(results[0].score > 0.3, "Score should be positive");

    // Cleanup
    VectorStoreService.clear(collectionName);
  });
});
