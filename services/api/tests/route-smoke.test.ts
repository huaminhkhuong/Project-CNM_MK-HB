import assert from "node:assert/strict";
import { describe, it, after } from "node:test";
import request from "supertest";

import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
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
});
