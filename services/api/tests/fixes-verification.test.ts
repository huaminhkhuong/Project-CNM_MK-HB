import assert from "node:assert/strict";
import { describe, it, after } from "node:test";
import request from "supertest";

import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { signAccessToken } from "../src/services/token.service";
const { closePool } = require("../src/config/database");

describe("Fixes Verification Test Suite", () => {
  const app = createApp();

  after(async () => {
    try {
      await prisma.$disconnect();
    } catch {}
    try {
      await closePool();
    } catch {}
  });

  // 1. Verify BigInt serialization
  it("BigInt.prototype.toJSON preserves precision for large numbers and returns number for safe integers", () => {
    const safeBigInt = 123456789n;
    const unsafeBigInt = 9007199254740993n; // Number.MAX_SAFE_INTEGER + 2

    const safeSerialized = JSON.stringify({ val: safeBigInt });
    assert.equal(safeSerialized, '{"val":123456789}');

    const unsafeSerialized = JSON.stringify({ val: unsafeBigInt });
    assert.equal(unsafeSerialized, '{"val":"9007199254740993"}');
  });

  // 2. Verify RBAC & requirePermission middleware
  it("requirePermission rejects unauthenticated requests with 401", async () => {
    const response = await request(app).get("/api/admin/dashboard");
    assert.equal(response.status, 401);
  });

  it("requirePermission rejects unauthorized customer role on admin route with 403", async () => {
    const customerToken = signAccessToken({
      userId: "999",
      email: "test_customer@cnm.local",
      role: "CUSTOMER"
    });

    const response = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${customerToken}`);

    assert.equal(response.status, 403);
    assert.ok(response.body.message.includes("Forbidden"));
  });

  it("requirePermission allows admin role on admin route", async () => {
    const adminToken = signAccessToken({
      userId: "1",
      email: "admin@cnm.local",
      role: "ADMIN"
    });

    const response = await request(app)
      .get("/api/admin/system/settings")
      .set("Authorization", `Bearer ${adminToken}`);

    // Status should not be 401 or 403
    assert.notEqual(response.status, 401);
    assert.notEqual(response.status, 403);
  });

  // 3. Verify Public Coupons Endpoint
  it("GET /api/coupons returns active coupons list without auth", async () => {
    const response = await request(app).get("/api/coupons");
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.ok(Array.isArray(response.body.data));
  });

  it("POST /api/coupons/validate calculates correct discount for PCMALL50K", async () => {
    const response = await request(app)
      .post("/api/coupons/validate")
      .send({ code: "PCMALL50K", orderAmount: 600000 });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.code, "PCMALL50K");
    assert.equal(response.body.data.discountAmount, 50000);
  });

  it("POST /api/coupons/validate rejects invalid coupon code with 400", async () => {
    const response = await request(app)
      .post("/api/coupons/validate")
      .send({ code: "NONEXISTENT_CODE_123", orderAmount: 600000 });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
  });

  // 4. Verify Public Route exemptions removed from auth (no URL pattern bypass)
  it("Protected routes cannot be bypassed using deceptive query params", async () => {
    const response = await request(app).get("/api/admin/users?dummy=/warranties/lookup/");
    assert.equal(response.status, 401);
  });

  // 5. Verify Database Health Check
  it("GET /api/health probes MySQL database latency and status", async () => {
    const response = await request(app).get("/api/health");
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "ok");
    assert.equal(response.body.database.connected, true);
    assert.equal(typeof response.body.database.latencyMs, "number");
  });
});
