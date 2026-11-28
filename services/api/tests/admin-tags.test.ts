import assert from "node:assert/strict";
import { describe, it, after } from "node:test";
import request from "supertest";

import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { signAccessToken } from "../src/services/token.service";
import { normalizeTagCode } from "../src/modules/admin/admin-tags.service";
const { closePool } = require("../src/config/database");

describe("Admin Product Tags & GPU-First PC Builder Integration", () => {
  const app = createApp();
  const adminToken = signAccessToken({
    userId: 1,
    email: "admin@cnm.local",
    role: "ADMIN"
  });
  const customerToken = signAccessToken({
    userId: 99999,
    email: "customer@cnm.local",
    role: "CUSTOMER"
  });

  let createdTagId: number | null = null;
  let testedProductId: number | null = null;
  let originalProductTags: string[] = [];

  after(async () => {
    try {
      if (testedProductId) {
        await request(app)
          .put(`/api/admin/products/${testedProductId}/tags`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ tags: originalProductTags });
      }
      if (createdTagId) {
        await request(app)
          .delete(`/api/admin/tags/${createdTagId}`)
          .set("Authorization", `Bearer ${adminToken}`);
      }
    } catch {}
    try {
      await prisma.$disconnect();
    } catch {}
    try {
      await closePool();
    } catch {}
  });

  it("normalizes Vietnamese tag codes to lowercase snake_case", () => {
    assert.equal(normalizeTagCode("Đồ họa / Render 3D"), "do_hoa_render_3d");
    assert.equal(normalizeTagCode("  Văn Phòng & Kế Toán "), "van_phong_ke_toan");
    assert.equal(normalizeTagCode("eSports FPS"), "esports_fps");
  });

  it("enforces ADMIN RBAC on /api/admin/tags", async () => {
    const unauth = await request(app).get("/api/admin/tags");
    assert.equal(unauth.status, 401);

    const forbidden = await request(app)
      .get("/api/admin/tags")
      .set("Authorization", `Bearer ${customerToken}`);
    assert.equal(forbidden.status, 403);
  });

  it("lists canonical tags and supports full CRUD + product tag assignment", async () => {
    const listRes = await request(app)
      .get("/api/admin/tags")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.success, true);
    assert.ok(Array.isArray(listRes.body.data));
    assert.ok(listRes.body.data.length >= 10, "Should auto-seed >= 10 canonical tags");
    assert.ok(listRes.body.data.some((t: any) => t.code === "gaming"));
    assert.ok(listRes.body.data.some((t: any) => t.code === "do_hoa"));

    // Create a temporary custom tag
    const uniqueCode = `test_tag_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/admin/tags")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ label: `Test Tag ${uniqueCode}`, code: uniqueCode, groupName: "use_case" });
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.data.code, uniqueCode);
    createdTagId = Number(createRes.body.data.id);

    // Fetch a real product and assign the new tag + "gaming"
    const prodListRes = await request(app)
      .get("/api/admin/products?limit=1")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(prodListRes.status, 200);
    const firstProd = prodListRes.body.data?.items?.[0];
    assert.ok(firstProd?.id, "Expected at least one product in DB");
    testedProductId = Number(firstProd.id);
    originalProductTags = Array.isArray(firstProd.tags) ? firstProd.tags : [];

    const assignRes = await request(app)
      .put(`/api/admin/products/${testedProductId}/tags`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tags: ["Gaming", uniqueCode] });
    assert.equal(assignRes.status, 200);
    assert.deepEqual(assignRes.body.data.tags, ["gaming", uniqueCode]);

    // Filter products by the newly assigned tag
    const filteredRes = await request(app)
      .get(`/api/admin/products?tag=${uniqueCode}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(filteredRes.status, 200);
    assert.ok(
      filteredRes.body.data.items.some((p: any) => Number(p.id) === testedProductId),
      "Product should appear when filtered by assigned tag"
    );

    // Restore original tags and delete temporary tag
    const clearRes = await request(app)
      .put(`/api/admin/products/${testedProductId}/tags`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tags: originalProductTags });
    assert.equal(clearRes.status, 200);
    testedProductId = null;

    const delRes = await request(app)
      .delete(`/api/admin/tags/${createdTagId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.data.deleted, true);
    createdTagId = null;
  });

  it("suggests a valid GPU-first build for AAA / Render profiles within budget", async () => {
    const res = await request(app)
      .post("/api/pc-builder/suggest-build")
      .send({
        budget: 28000000,
        useCase: "aaa",
        resolution: "2k"
      });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const data = res.body.data;
    const primary = data?.recommended || data?.builds?.[0] || data;
    const comps = primary?.components || primary?.selectedComponents || primary?.items;
    assert.ok(comps, "Expected suggested build components");
  });
});

