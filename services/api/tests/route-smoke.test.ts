import assert from "node:assert/strict";
import { describe, it, after } from "node:test";
import request from "supertest";

import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { signAccessToken } from "../src/services/token.service";
const { closePool } = require("../src/config/database");

describe("API route smoke coverage", () => {
  const app = createApp();

  after(async () => {
    try {
      await prisma.$disconnect();
    } catch {}
    try {
      await closePool();
    } catch {}
  });

  it("exposes protected profile mutation routes", async () => {
    const routes = [
      request(app).patch("/api/auth/me").send({ fullName: "Test User" }),
      request(app).patch("/api/auth/me/password").send({ currentPassword: "old", newPassword: "newpass1" }),
      request(app).patch("/api/auth/me/addresses/1").send({
        fullName: "Test User",
        phone: "0900000000",
        addressLine: "1 Test Street",
        ward: "Ward",
        district: "District",
        province: "Province"
      }),
      request(app).delete("/api/auth/me/addresses/1")
    ];

    const responses = await Promise.all(routes);

    for (const response of responses) {
      assert.equal(response.status, 401);
      assert.notEqual(response.status, 404);
    }
  });

  it("exposes protected compatibility build route", async () => {
    const response = await request(app).get("/api/compatibility/builds/1");

    assert.equal(response.status, 401);
    assert.notEqual(response.status, 404);
  });

  it("exposes protected PC Builder replace item route", async () => {
    const response = await request(app)
      .patch("/api/pc-builder/1/items/cpu")
      .send({ productVariantId: 1 });

    assert.equal(response.status, 401);
    assert.notEqual(response.status, 404);
  });

  it("keeps public PC Builder compatibility route mounted", async () => {
    const response = await request(app)
      .post("/api/pc-builder/check-compatibility")
      .send({ components: [] });

    assert.notEqual(response.status, 404);
  });

  it("exposes public store info endpoint with dynamic bank and contact details", async () => {
    const response = await request(app).get("/api/system/public-info");

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.ok(response.body.data);
    assert.equal(response.body.data.bankName, "Techcombank");
    assert.equal(response.body.data.bankAccountNumber, "8686868991");
    assert.equal(response.body.data.bankAccountHolder, "HỨA MINH KHƯƠNG");
    assert.ok(response.body.data.storeHotline);
    assert.ok(response.body.data.storeAddress);
    assert.ok(response.body.data.storeTaxId);
  });

  it("allows SALES_STAFF to query /api/staff/orders with status filter and /api/chat/queue", async () => {
    const salesToken = signAccessToken({
      userId: "2",
      email: "sales@cnm.local",
      role: "SALES_STAFF"
    });

    const [ordersRes, allOrdersRes, chatQueueRes] = await Promise.all([
      request(app).get("/api/staff/orders?status=PENDING").set("Authorization", `Bearer ${salesToken}`),
      request(app).get("/api/staff/orders").set("Authorization", `Bearer ${salesToken}`),
      request(app).get("/api/chat/queue").set("Authorization", `Bearer ${salesToken}`)
    ]);

    assert.equal(ordersRes.status, 200);
    assert.equal(ordersRes.body.success, true);
    assert.ok(Array.isArray(ordersRes.body.data));

    assert.equal(allOrdersRes.status, 200);
    assert.equal(allOrdersRes.body.success, true);

    assert.equal(chatQueueRes.status, 200);
    assert.equal(chatQueueRes.body.success, true);
  });

  it("verifies ADMIN dashboard, system overview metrics, self-lockout protection, and AI simulator", async () => {
    const adminUser = await prisma.user.findFirst({
      where: { Role: { name: "ADMIN" } },
      select: { id: true, email: true }
    });
    const adminId = String(adminUser?.id || 1);
    const adminToken = signAccessToken({
      userId: adminId,
      email: adminUser?.email || "admin@cnm.local",
      role: "ADMIN"
    });

    const [dashboardRes, overviewRes, selfLockRes, selfDemoteRes, aiSimRes] = await Promise.all([
      request(app).get("/api/admin/dashboard").set("Authorization", `Bearer ${adminToken}`),
      request(app).get("/api/admin/system/overview").set("Authorization", `Bearer ${adminToken}`),
      request(app)
        .patch(`/api/admin/users/${adminId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "BLOCKED" }),
      request(app)
        .patch(`/api/admin/users/${adminId}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "CUSTOMER" }),
      request(app)
        .post("/api/ai/admin/test-filter")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ scope: "BUILDER_AUDIT_CHAT", text: "Cấu hình này có bị nghẽn cổ chai không?", budget: 20000000 })
    ]);

    assert.equal(dashboardRes.status, 200);
    assert.ok(Number(dashboardRes.body.data.totalProducts) > 0, "Dashboard totalProducts should be > 0");

    assert.equal(overviewRes.status, 200);
    assert.ok(typeof overviewRes.body.data.metrics.lowStockSkus === "number");
    assert.ok(typeof overviewRes.body.data.metrics.pendingOrders === "number");
    assert.ok(typeof overviewRes.body.data.metrics.unassignedTickets === "number");
    assert.ok(typeof overviewRes.body.data.metrics.skus === "number");

    assert.equal(selfLockRes.status, 400, "Admin should not be able to lock their own account");
    assert.equal(selfDemoteRes.status, 400, "Admin should not be able to demote their own account");

    assert.equal(aiSimRes.status, 200);
    assert.equal(aiSimRes.body.data.action, "SYSTEM_INJECT");
    assert.ok(aiSimRes.body.data.ruleName, "AI simulator should return matched SYSTEM_INJECT ruleName");
  });
});
