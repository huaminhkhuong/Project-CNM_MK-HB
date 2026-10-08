import assert from "node:assert/strict";
import { describe, it, after } from "node:test";
import request from "supertest";

import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";

describe("GET /api/health", () => {
  after(async () => {
    try {
      await prisma.$disconnect();
    } catch {}
  });

  it("returns service status and database probe", async () => {
    const app = createApp();
    const response = await request(app).get("/api/health");

    assert.ok([200, 503].includes(response.status));
    assert.equal(response.body.service, "api");
    assert.ok(response.body.database);
    assert.equal(typeof response.body.database.connected, "boolean");
  });
});

