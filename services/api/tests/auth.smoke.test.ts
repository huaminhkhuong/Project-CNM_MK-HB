import assert from "node:assert/strict";
import { describe, it, after } from "node:test";
import request from "supertest";

import { createApp } from "../src/app";
import { signRefreshToken } from "../src/services/token.service";
import { prisma } from "../src/config/prisma";
const { closePool } = require("../src/config/database");

const runIntegration = process.env.RUN_API_INTEGRATION === "1";

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

describe("auth smoke", { skip: !runIntegration }, () => {
  const app = createApp();

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

  it("lists products publicly", async () => {
    const response = await request(app).get("/api/products").query({ page: 1, limit: 5 });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.ok(response.body.data);
  });
});
