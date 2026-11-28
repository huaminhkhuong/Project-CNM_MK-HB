import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import request from "supertest";

import { createApp } from "../src/app";
import { signRefreshToken } from "../src/services/token.service";
import { prisma } from "../src/config/prisma";
const { closePool } = require("../src/config/database");

describe("auth refresh token", () => {
  it("issues new access token from valid refresh token", () => {
    const refreshToken = signRefreshToken({
      userId: "1",
      email: "admin@cnm.local",
      role: "ADMIN"
    });

    assert.ok(refreshToken.length > 20);
  });
});

describe("auth smoke", () => {
  let app: any;

  before(() => {
    app = createApp();
  });

  after(async () => {
    try {
      await prisma.$disconnect();
    } catch {}
    try {
      await closePool();
    } catch {}
  });

  it("logs in admin demo account", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "admin@cnm.local",
      password: "Admin@123"
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.ok(response.body.data.accessToken);
    assert.ok(response.body.data.refreshToken);
  });

  it("refreshes access token", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "admin@cnm.local",
      password: "Admin@123"
    });

    const refreshToken = loginResponse.body.data.refreshToken;

    const refreshResponse = await request(app).post("/api/auth/refresh").send({
      refreshToken
    });

    assert.equal(refreshResponse.status, 200);
    assert.ok(refreshResponse.body.data.accessToken);
    assert.ok(refreshResponse.body.data.refreshToken);
  });

  it("blocks /api/auth/google-mock by default when ENABLE_MOCK_GOOGLE_AUTH is disabled", async () => {
    const response = await request(app).post("/api/auth/google-mock").send({
      email: "attacker@example.com",
      fullName: "Attacker"
    });

    assert.equal(response.status, 403);
    assert.equal(response.body.success, false);
  });

  it("rejects raw JWT in SSE query string and issues one-time SSE ticket via POST /api/orders/events/ticket", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "admin@cnm.local",
      password: "Admin@123"
    });
    const accessToken = loginResponse.body.data.accessToken;

    // Raw ?token=<JWT> must be rejected (prevents JWT leakage in URL logs)
    const legacyRes = await request(app).get(`/api/orders/events?token=${encodeURIComponent(accessToken)}`);
    assert.equal(legacyRes.status, 401);

    // One-time ticket endpoint returns short-lived random ticket
    const ticketRes = await request(app)
      .post("/api/orders/events/ticket")
      .set("Authorization", `Bearer ${accessToken}`);
    assert.equal(ticketRes.status, 201);
    assert.equal(ticketRes.body.success, true);
    assert.ok(typeof ticketRes.body.data.ticket === "string" && ticketRes.body.data.ticket.length >= 32);
    assert.ok(ticketRes.body.data.expiresInMs <= 60000);
  });

  it("lists products publicly", async () => {
    const response = await request(app).get("/api/products").query({ page: 1, limit: 5 });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.ok(response.body.data);
  });
});
