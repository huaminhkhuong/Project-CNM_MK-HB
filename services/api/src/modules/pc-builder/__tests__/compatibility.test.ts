import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { xaiExplanationService } from "../xai-explanation.service";
import { pcBuilderService } from "../pc-builder.service";
import { prisma } from "../../../config/prisma";
const { closePool } = require("../../../config/database");

describe("Compatibility Engine & XAI Rules (COMP-001 -> COMP-010)", () => {
  // Test 1: COMP-001 Socket Mismatch (CPU AM5 + Mainboard AM4)
  it("[COMP-001] CPU AM5 + Mainboard AM4 triggers BLOCKER severity", () => {
    const rawCheck = {
      key: "socket",
      ok: false,
      detail: "AM5 / AM4"
    };

    const explanation = xaiExplanationService.generateCheckExplanation(rawCheck);
    assert.equal(explanation.ruleId, "COMP-001");
    assert.equal(explanation.severity, "BLOCKER");
    assert.equal(explanation.level, "error");
    assert.ok(explanation.short.includes("COMP-001"));
    assert.ok(explanation.short.includes("BLOCKER"));
  });

  // Test 2: COMP-004 GPU Clearance Exceeded (GPU 350mm + Case 320mm)
  it("[COMP-004] GPU 350mm + Case 320mm clearance triggers BLOCKER severity", () => {
    const rawCheck = {
      key: "gpu_clearance",
      ok: false,
      detail: "350mm / 320mm"
    };

    const explanation = xaiExplanationService.generateCheckExplanation(rawCheck);
    assert.equal(explanation.ruleId, "COMP-004");
    assert.equal(explanation.severity, "BLOCKER");
    assert.equal(explanation.level, "error");
    assert.ok(explanation.short.includes("COMP-004"));
  });

  // Test 3: COMP-005 Insufficient Cooling Capacity (CPU 125W + Cooler 65W)
  it("[COMP-005] CPU 125W + Cooler 65W TDP capacity triggers WARNING severity", () => {
    const rawCheck = {
      key: "cooling_tdp",
      ok: false,
      detail: "65W cooler / 125W CPU"
    };

    const explanation = xaiExplanationService.generateCheckExplanation(rawCheck);
    assert.equal(explanation.ruleId, "COMP-005");
    assert.equal(explanation.severity, "WARNING");
    assert.equal(explanation.level, "warning");
    assert.ok(explanation.short.includes("COMP-005"));
  });

  // Test 4: COMP-002 RAM Type Mismatch (DDR5 RAM + DDR4 Mainboard)
  it("[COMP-002] RAM Type DDR5 + Mainboard DDR4 triggers BLOCKER severity", () => {
    const rawCheck = {
      key: "ram",
      ok: false,
      detail: "DDR5 / DDR4"
    };

    const explanation = xaiExplanationService.generateCheckExplanation(rawCheck);
    assert.equal(explanation.ruleId, "COMP-002");
    assert.equal(explanation.severity, "BLOCKER");
    assert.equal(explanation.level, "error");
  });

  // Test 5: COMP-006 Cooler Height Exceeded
  it("[COMP-006] Cooler Height 170mm + Case Clearance 155mm triggers BLOCKER severity", () => {
    const rawCheck = {
      key: "cooler_height",
      ok: false,
      detail: "170mm cooler / 155mm case"
    };

    const explanation = xaiExplanationService.generateCheckExplanation(rawCheck);
    assert.equal(explanation.ruleId, "COMP-006");
    assert.equal(explanation.severity, "BLOCKER");
  });

  // Test 6: COMP-007 Insufficient PSU Wattage
  it("[COMP-007] System need 650W + PSU 500W triggers BLOCKER severity", () => {
    const rawCheck = {
      key: "psu",
      ok: false,
      detail: "500W / need 650W"
    };

    const explanation = xaiExplanationService.generateCheckExplanation(rawCheck);
    assert.equal(explanation.ruleId, "COMP-007");
    assert.equal(explanation.severity, "BLOCKER");
  });

  // Test 7: COMP-008 PSU Connectors Insufficient
  it("[COMP-008] High GPU TDP 320W + Low PSU connectors triggers BLOCKER severity", () => {
    const rawCheck = {
      key: "psu_connectors",
      ok: false,
      detail: "Lack 12VHPWR connector"
    };

    const explanation = xaiExplanationService.generateCheckExplanation(rawCheck);
    assert.equal(explanation.ruleId, "COMP-008");
    assert.equal(explanation.severity, "BLOCKER");
  });

  // Test 8: COMP-009 M.2 Slots Exceeded
  it("[COMP-009] 3 M.2 NVMe SSDs + 2 Mainboard Slots triggers WARNING severity", () => {
    const rawCheck = {
      key: "storage_m2",
      ok: false,
      detail: "3 SSDs / 2 slots"
    };

    const explanation = xaiExplanationService.generateCheckExplanation(rawCheck);
    assert.equal(explanation.ruleId, "COMP-009");
    assert.equal(explanation.severity, "WARNING");
  });

  // Test 9: COMP-010 Form Factor Incompatible
  it("[COMP-010] E-ATX Mainboard + mATX Case triggers BLOCKER severity", () => {
    const rawCheck = {
      key: "case_form_factor",
      ok: false,
      detail: "E-ATX board / mATX case"
    };

    const explanation = xaiExplanationService.generateCheckExplanation(rawCheck);
    assert.equal(explanation.ruleId, "COMP-010");
    assert.equal(explanation.severity, "BLOCKER");
  });

  // Test 10: Full Compatibility Report Enrichment & Summary Stats
  it("buildCompleteReport correctly sets buildReadiness to BLOCKED when BLOCKER rules fail", () => {
    const rawChecks = [
      { key: "socket", ok: false, detail: "AM5 / AM4" },
      { key: "cooling_tdp", ok: false, detail: "65W cooler / 125W CPU" },
      { key: "ram", ok: true, detail: "DDR5 / DDR5" }
    ];

    const report = xaiExplanationService.buildCompleteReport(rawChecks);

    assert.equal(report.buildReadiness, "BLOCKED");
    assert.equal(report.summary.blockerCount, 1);
    assert.equal(report.summary.warningCount, 1);
    assert.equal(report.summary.passedChecks, 1);
    assert.ok(report.checks.some((c: any) => c.severity === "BLOCKER"));
    assert.ok(report.checks.some((c: any) => c.severity === "WARNING"));
  });
});

describe("PC Builder Engine Real Integration (DB Rules, Form Factor & RTX 5000 Bottleneck)", () => {
  after(async () => {
    try {
      await prisma.$disconnect();
    } catch {}
    try {
      await closePool();
    } catch {}
  });

  it("suggestBuild(20tr, gaming) returns 3 compatible candidates with score >= 95 and realistic RTX 5000 bottleneck", async () => {
    const result = await pcBuilderService.suggestBuild({
      budget: 20000000,
      useCase: "gaming"
    });

    const candidates = result?.candidates || {};
    const keys = ["budgetSafe", "bestValue", "bestPerformance"] as const;

    for (const key of keys) {
      const cand = candidates[key];
      assert.ok(cand, `Missing candidate ${key}`);
      const report = cand.compatibilityReport || cand.compatibility;
      assert.ok(report, `Missing compatibilityReport for ${key}`);
      const score = Number(report.score ?? report.compatibilityScore ?? 0);
      assert.ok(
        score >= 95,
        `Candidate ${key} expected compatibility score >= 95, got ${score} (failed: ${JSON.stringify(
          (report.checks || []).filter((c: any) => !c.ok)
        )})`
      );
      assert.equal(report.compatible, true, `Candidate ${key} must be compatible`);
      assert.notEqual(
        report.buildReadiness,
        "BLOCKED",
        `Candidate ${key} must not be BLOCKED`
      );
      const dbRuleChecks = (report.checks || []).filter((c: any) =>
        String(c.key || "").startsWith("rule_")
      );
      assert.ok(
        dbRuleChecks.length > 0,
        `Candidate ${key} must evaluate live compatibility_rules from DB (dbRuleChecks.length > 0)`
      );
    }
  });

  it("calculateDynamicBottleneck scores RTX 5060 Ti accurately and respects 1080p vs 4K physics", () => {
    const cpu = { name: "Intel Core Ultra 5 245K" };
    const gpu = { name: "Asus DUAL RTX 5060 Ti 16G OC" };

    const bn1080 = pcBuilderService.calculateDynamicBottleneck(cpu, gpu, "1080p");
    const bn4k = pcBuilderService.calculateDynamicBottleneck(cpu, gpu, "4k");

    assert.ok(
      bn1080.bottleneckPercentage < 25,
      `Expected RTX 5060 Ti + Core Ultra 5 at 1080p to be well-balanced (<25%), got ${bn1080.bottleneckPercentage}%`
    );
    assert.ok(
      bn4k.bottleneckComponent === "GPU" && bn4k.bottleneckPercentage > bn1080.bottleneckPercentage,
      `Expected 4K to shift load toward GPU (4K=${bn4k.bottleneckComponent}:${bn4k.bottleneckPercentage}%, 1080p=${bn1080.bottleneckPercentage}%)`
    );
  });

  it("getMainboardFormFactor correctly classifies H610M-K as Micro-ATX", () => {
    assert.equal(pcBuilderService.getMainboardFormFactor({ name: "Mainboard ASUS Prime H610M-K DDR4" }), "Micro-ATX");
    assert.equal(pcBuilderService.getMainboardFormFactor({ name: "Mainboard MSI PRO B760M-A WIFI" }), "Micro-ATX");
  });

  it("findReplacementProducts enforces currentBuild socket and RAM constraints", async () => {
    const replacements = await pcBuilderService.findReplacementProducts(
      { category: "ram", priceMin: 500000, priceMax: 5000000 },
      { mainboard: { name: "Mainboard MSI PRO B760M-A DDR5", specs: [{ name: "Chuẩn RAM", value: "DDR5" }] } }
    );
    assert.ok(Array.isArray(replacements));
    if (replacements.length > 0) {
      assert.ok(
        replacements.every((r: any) =>
          String(r.specs?.ram_type || r.specs?.["chuẩn ram"] || r.name || "").toUpperCase().includes("DDR5")
        ),
        "All replacement RAM modules must match currentBuild mainboard DDR5 constraint"
      );
    }
  });
});
