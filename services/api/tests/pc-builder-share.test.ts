import test, { describe, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/services/token.service";
import { prisma } from "../src/config/prisma";
const { closePool } = require("../src/config/database");

describe("PC Builder - Share & Public Token Verification", () => {
  const app = createApp();

  let customerToken: string;
  let customerUser: any;
  let sampleCpuSku: any;
  let createdBuildId: number;
  let generatedShareToken: string;

  test.before(async () => {
    // 1. Ensure customer user
    customerUser = await prisma.user.findFirst({
      where: { email: "customer@cnm.local" }
    });
    if (!customerUser) {
      customerUser = await prisma.user.create({
        data: {
          email: "customer@cnm.local",
          full_name: "Demo Customer",
          status: "ACTIVE"
        }
      });
    }

    customerToken = signAccessToken({
      userId: String(customerUser.id),
      email: customerUser.email,
      role: "CUSTOMER"
    });

    // 2. Find a valid CPU SKU
    sampleCpuSku = await prisma.productSku.findFirst({
      where: {
        is_active: true,
        Product: {
          category_id: 1 // CPU
        }
      },
      include: { Product: true }
    });
  });

  after(async () => {
    try {
      if (createdBuildId) {
        await prisma.$executeRawUnsafe(
          "DELETE FROM pc_build_items WHERE build_id = ?",
          createdBuildId
        );
        await prisma.$executeRawUnsafe(
          "DELETE FROM pc_builds WHERE id = ?",
          createdBuildId
        );
      }
    } catch {}
    try {
      await prisma.$disconnect();
    } catch {}
    try {
      await closePool();
    } catch {}
  });

  test("1. POST /api/pc-builder: Tạo cấu hình PC mới cho khách hàng", async () => {
    const res = await request(app)
      .post("/api/pc-builder")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        name: "Dàn PC Gaming 2026 Test Share",
        budget: 25000000,
        description: "Cấu hình thử nghiệm chia sẻ công khai"
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.id);
    createdBuildId = res.body.data.id;
  });

  test("2. POST /api/pc-builder/:buildId/items: Thêm linh kiện vào bộ cấu hình", async () => {
    assert.ok(sampleCpuSku, "Phải có ít nhất 1 SKU CPU trong hệ thống");

    const res = await request(app)
      .post(`/api/pc-builder/${createdBuildId}/items`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        componentType: "cpu",
        productVariantId: sampleCpuSku.id
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.items);
    assert.equal(res.body.data.items.length >= 1, true);
  });

  test("3. POST /api/pc-builder/:buildId/publish: Công khai cấu hình và sinh share_token", async () => {
    const res = await request(app)
      .post(`/api/pc-builder/${createdBuildId}/publish`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send();

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.shareToken, "Phải sinh ra shareToken");
    assert.equal(res.body.data.isPublic, true);
    assert.ok(res.body.data.shareUrl);

    generatedShareToken = res.body.data.shareToken;
  });

  test("4. GET /api/pc-builder/shared/:shareToken: Truy cập công khai KHÔNG cần đăng nhập", async () => {
    assert.ok(generatedShareToken, "Cần có shareToken từ bước 3");

    const res = await request(app)
      .get(`/api/pc-builder/shared/${generatedShareToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.shareToken, generatedShareToken);
    assert.equal(res.body.data.isPublic, true);
    assert.ok(Array.isArray(res.body.data.items));
    assert.equal(res.body.data.items.length >= 1, true);
    assert.equal(res.body.data.items[0].componentType, "cpu");
  });

  test("5. POST /api/pc-builder/:buildId/clone: Nhân bản cấu hình PC đã chia sẻ", async () => {
    const res = await request(app)
      .post(`/api/pc-builder/${createdBuildId}/clone`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send();

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.notEqual(res.body.data.id, createdBuildId, "ID cấu hình nhân bản phải khác ID gốc");
    assert.ok(res.body.data.name.includes("Bản sao"));

    // Cleanup cloned build
    try {
      await prisma.$executeRawUnsafe(
        "DELETE FROM pc_build_items WHERE build_id = ?",
        res.body.data.id
      );
      await prisma.$executeRawUnsafe(
        "DELETE FROM pc_builds WHERE id = ?",
        res.body.data.id
      );
    } catch {}
  });
});
