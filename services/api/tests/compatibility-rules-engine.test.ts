import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app";
import { getDbPool } from "../src/config/database";
import { pcBuilderService } from "../src/modules/pc-builder/pc-builder.service";

describe("PC Builder Database Compatibility Rules Engine", () => {
  after(async () => {
    try {
      await getDbPool().end();
    } catch (_err) {
      // ignore
    }
  });

  it("getActiveCompatibilityRules loads active rules from compatibility_rules table", async () => {
    pcBuilderService.invalidateRulesCache();
    const rules = await pcBuilderService.getActiveCompatibilityRules();

    assert.ok(Array.isArray(rules), "Rules must be an array");
    assert.ok(rules.length >= 20, `Expected at least 20 active rules in DB, got ${rules.length}`);

    // Verify schema structure of rules
    const sampleRule = rules[0];
    assert.ok(sampleRule.id > 0, "Rule must have a positive ID");
    assert.ok(typeof sampleRule.name === "string" && sampleRule.name.length > 0, "Rule must have a name");
    assert.ok(typeof sampleRule.isCompatible === "boolean", "Rule isCompatible must be boolean");
    assert.ok(typeof sampleRule.operator === "string", "Rule operator must be string");
  });

  it("detects socket incompatibility via DB rule (Intel LGA1700 CPU + AMD AM5 Mainboard) as BLOCKED", async () => {
    // CPU SKU 1: Intel Core i5-14400F (LGA1700)
    // Mainboard SKU 4: MSI PRO B650M-A WIFI (AM5)
    const result = await pcBuilderService.checkRawCompatibility({
      components: [
        { componentType: "cpu", variantId: 1 },
        { componentType: "mainboard", variantId: 4 }
      ]
    });

    assert.equal(result.compatible, false, "Build must be incompatible");
    assert.equal(result.buildReadiness, "BLOCKED", "Readiness must be BLOCKED");
    assert.ok(result.scores.compatibilityScore === 0, "Compatibility score must be 0 for blockers");

    // Check that socket check failed
    const socketCheck = result.checks.find((c: any) => c.key === "socket");
    assert.ok(socketCheck, "Socket check must be present");
    assert.equal(socketCheck.ok, false, "Socket check must fail");
    assert.equal(socketCheck.severity, "BLOCKER", "Socket check must be a BLOCKER");

    // Check that DB rule check is included
    const dbRuleCheck = result.checks.find((c: any) => c.key.startsWith("rule_") && !c.ok);
    assert.ok(dbRuleCheck, "A failed DB rule check must be present");
    assert.equal(dbRuleCheck.severity, "BLOCKER", "DB rule violation must be BLOCKER");
    assert.ok(
      dbRuleCheck.explanation?.short?.includes("Không tương thích") ||
      dbRuleCheck.detail?.includes("Khác hãng") ||
      dbRuleCheck.detail?.includes("xung đột") ||
      dbRuleCheck.explanation?.level === "error",
      "Explanation must indicate technical incompatibility"
    );
  });

  it("approves compatible pair via DB rule (Intel LGA1700 CPU + Intel LGA1700 Mainboard) as READY", async () => {
    // CPU SKU 1: Intel Core i5-14400F (LGA1700)
    // Mainboard SKU 3: ASUS Prime B760M-A WIFI DDR5 (LGA1700)
    const result = await pcBuilderService.checkRawCompatibility({
      components: [
        { componentType: "cpu", variantId: 1 },
        { componentType: "mainboard", variantId: 3 }
      ]
    });

    assert.equal(result.compatible, true, "Build must be compatible");
    assert.equal(result.buildReadiness, "READY", "Readiness must be READY");
    assert.ok(result.scores.compatibilityScore > 80, "Compatibility score must be high");

    const socketCheck = result.checks.find((c: any) => c.key === "socket");
    assert.ok(socketCheck, "Socket check must exist");
    assert.equal(socketCheck.ok, true, "Socket check must pass");

    // Check that DB rule check for LGA1700 evaluated ok
    const dbRulePassed = result.checks.find((c: any) => c.key.startsWith("rule_") && c.ok);
    assert.ok(dbRulePassed, "A passed DB rule check must be present");
    assert.equal(dbRulePassed.severity, "INFO", "Passed DB rule must have INFO severity");
  });

  it("POST /api/pc-builder/check-compatibility endpoint reflects dynamic database rules", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/pc-builder/check-compatibility")
      .send({
        components: [
          { component_type: "cpu", variant_id: 1 },
          { component_type: "mainboard", variant_id: 4 }
        ]
      });

    assert.equal(response.status, 200, "Endpoint must return 200");
    const data = response.body.data;
    assert.equal(data.compatible, false, "Must flag incompatibility");
    assert.equal(data.buildReadiness, "BLOCKED", "Must return BLOCKED status to frontend");
    assert.ok(Array.isArray(data.checks), "Must include array of checks");

    // Check that checks contain DB rule explanations
    const ruleChecks = data.checks.filter((c: any) => c.key.startsWith("rule_"));
    assert.ok(ruleChecks.length > 0, "Response must include dynamic DB rule checks");
  });

  it("invalidateRulesCache allows immediate reloading of database rules", async () => {
    pcBuilderService.invalidateRulesCache();
    const rulesFirst = await pcBuilderService.getActiveCompatibilityRules();
    assert.ok(rulesFirst.length > 0);

    // Invalidate again and verify it reloads cleanly
    pcBuilderService.invalidateRulesCache();
    const rulesSecond = await pcBuilderService.getActiveCompatibilityRules();
    assert.equal(rulesFirst.length, rulesSecond.length);
  });
});
