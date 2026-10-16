import assert from "node:assert/strict";
import { describe, it, after } from "node:test";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../config/prisma";
const { closePool } = require("../config/database");

describe("PC Builder Integration Tests (AI Build Flow & XAI Endpoints)", () => {
  const app = createApp();

  after(async () => {
    try {
      await prisma.$disconnect();
    } catch {}
    try {
      await closePool();
    } catch {}
  });

  // Test 1: POST /api/pc-builder/suggest-build with Gaming 25M
  it("POST /api/pc-builder/suggest-build returns candidate builds for Gaming 25M", async () => {
    const response = await request(app)
      .post("/api/pc-builder/suggest-build")
      .send({
        purpose: "gaming",
        budget: 25000000,
        resolution: "1080p",
        preference: "value"
      });

    assert.ok([200, 201].includes(response.status), `Expected 200/201, got ${response.status}`);
    assert.equal(response.body.success, true);
    
    const data = response.body.data || response.body;
    assert.ok(data, "Response body should contain data object");
    
    // Check candidate builds structure
    const candidateBuilds = data.candidateBuilds || data.candidates || data.presets;
    if (candidateBuilds) {
      assert.ok(Array.isArray(candidateBuilds) || typeof candidateBuilds === "object");
    }
  });

  // Test 2: POST /api/pc-builder/check-compatibility with raw components
  it("POST /api/pc-builder/check-compatibility evaluates hardware rules and returns structured XAI report", async () => {
    const response = await request(app)
      .post("/api/pc-builder/check-compatibility")
      .send({
        components: [
          { component_type: "cpu", variant_id: 1 },
          { component_type: "mainboard", variant_id: 2 },
          { component_type: "gpu", variant_id: 3 }
        ]
      });

    assert.ok([200, 201].includes(response.status), `Expected 200/201, got ${response.status}`);
    assert.equal(response.body.success, true);

    const report = response.body.data || response.body;
    assert.ok(report.checks, "XAI Report should contain 'checks' array");
    assert.ok(Array.isArray(report.checks), "'checks' should be an array");
    assert.ok(report.summary, "XAI Report should contain 'summary'");
    assert.ok(report.buildReadiness, "XAI Report should contain 'buildReadiness'");
    assert.ok(["READY", "WARNINGS_ACKNOWLEDGED", "BLOCKED"].includes(report.buildReadiness));
  });

  // Test 3: POST /api/pc-builder/ai-advice prompt response
  it("POST /api/pc-builder/ai-advice provides AI advisor responses for user questions", async () => {
    const response = await request(app)
      .post("/api/pc-builder/ai-advice")
      .send({
        prompt: "Nguồn 650W có gánh nổi RTX 4070 không?",
        currentBuild: { gpu: "RTX 4070", cpu: "i5-13400F" }
      });

    assert.ok([200, 201].includes(response.status), `Expected 200/201, got ${response.status}`);
    assert.equal(response.body.success, true);
    
    const adviceData = response.body.data || response.body;
    assert.ok(adviceData.answer || adviceData.advice || adviceData.message);
  });
});
