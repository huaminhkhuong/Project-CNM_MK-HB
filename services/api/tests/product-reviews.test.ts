import test, { describe, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/services/token.service";
import { prisma } from "../src/config/prisma";
const { closePool } = require("../src/config/database");

describe("Product Reviews - Verified Buyer Enforcement (AUD-010)", () => {
  const app = createApp();

  let verifiedBuyerUser: any;
  let verifiedBuyerToken: string;

  let nonBuyerUser: any;
  let nonBuyerToken: string;

  let targetProductId: number;
  let testOrderId: number;

  test.before(async () => {
    // 1. Get or create verified buyer user
    verifiedBuyerUser = await prisma.user.findFirst({
      where: { email: "customer@cnm.local" }
    });
    if (!verifiedBuyerUser) {
      verifiedBuyerUser = await prisma.user.create({
        data: {
          email: "customer@cnm.local",
          full_name: "Demo Customer",
          status: "ACTIVE"
        }
      });
    }

    verifiedBuyerToken = signAccessToken({
      userId: String(verifiedBuyerUser.id),
      email: verifiedBuyerUser.email,
      role: "CUSTOMER"
    });

    // 2. Create a non-buyer test user
    const nonBuyerEmail = `non-buyer-${Date.now()}@pcmall.test`;
    nonBuyerUser = await prisma.user.create({
      data: {
        email: nonBuyerEmail,
        full_name: "Non Buyer Test User",
        status: "ACTIVE"
      }
    });

    nonBuyerToken = signAccessToken({
      userId: String(nonBuyerUser.id),
      email: nonBuyerUser.email,
      role: "CUSTOMER"
    });

    // 3. Find target product (Product #1 or any active product)
    const product = await prisma.product.findFirst({
      where: { is_active: true }
    });
    assert.ok(product, "At least one active product must exist");
    targetProductId = product.id;

    // 4. Ensure verifiedBuyerUser has a DELIVERED order containing targetProductId
    const existingDelivered = await prisma.order.findFirst({
      where: {
        user_id: verifiedBuyerUser.id,
        status: "DELIVERED",
        OrderItem: {
          some: {
            product_id: targetProductId
          }
        }
      }
    });

    if (existingDelivered) {
      testOrderId = existingDelivered.id;
    } else {
      const sku = await prisma.productSku.findFirst({
        where: { product_id: targetProductId }
      });
      const order = await prisma.order.create({
        data: {
          user_id: verifiedBuyerUser.id,
          status: "DELIVERED",
          total_amount: 1000000,
          final_amount: 1000000,
          shipping_address: "123 Test Street, HCM",
          payment_method: "COD",
          payment_status: "PAID",
          OrderItem: {
            create: {
              product_id: targetProductId,
              product_variant_id: sku ? sku.id : 1,
              quantity: 1,
              unit_price: 1000000,
              line_total: 1000000
            }
          }
        }
      });
      testOrderId = order.id;
    }
  });

  after(async () => {
    try {
      // Clean up test nonBuyerUser
      if (nonBuyerUser) {
        await prisma.productReview.deleteMany({
          where: { user_id: nonBuyerUser.id }
        });
        await prisma.user.delete({
          where: { id: nonBuyerUser.id }
        });
      }
    } catch {
      // ignore cleanup errors
    } finally {
      await prisma.$disconnect();
      await closePool();
    }
  });

  test("1. GET /api/products/:id/reviews: Truy cập công khai danh sách đánh giá", async () => {
    const res = await request(app)
      .get(`/api/products/${targetProductId}/reviews`)
      .expect(200);

    assert.equal(res.body.success, true);
    assert.ok(res.body.data.summary, "Must have summary rating breakdown");
    assert.ok(Array.isArray(res.body.data.reviews), "Reviews must be an array");
    assert.equal(typeof res.body.data.summary.averageRating, "number");
  });

  test("2. GET /api/products/:id/reviews/eligibility: Khách chưa đăng nhập không đủ điều kiện", async () => {
    const res = await request(app)
      .get(`/api/products/${targetProductId}/reviews/eligibility`)
      .expect(200);

    assert.equal(res.body.success, true);
    assert.equal(res.body.data.canReview, false);
    assert.equal(res.body.data.hasDeliveredOrder, false);
    assert.ok(res.body.data.reason.includes("đăng nhập"));
  });

  test("3. POST /api/products/:id/reviews: Chặn 401 khi không truyền auth token", async () => {
    const res = await request(app)
      .post(`/api/products/${targetProductId}/reviews`)
      .send({ rating: 5, comment: "Đánh giá không token" })
      .expect(401);

    assert.equal(res.body.success, false);
  });

  test("4. POST /api/products/:id/reviews: Chặn 403 khi khách hàng CHƯA mua/nhận sản phẩm (AUD-010)", async () => {
    const res = await request(app)
      .post(`/api/products/${targetProductId}/reviews`)
      .set("Authorization", `Bearer ${nonBuyerToken}`)
      .send({
        rating: 5,
        comment: "Tôi chưa từng mua sản phẩm này nhưng vẫn muốn đánh giá sp"
      })
      .expect(403);

    assert.equal(res.body.success, false);
    assert.ok(
      res.body.message.includes("Chỉ khách hàng đã mua và nhận sản phẩm thành công mới có thể gửi đánh giá"),
      `Expected error message about verified buyer requirement, got: ${res.body.message}`
    );
  });

  test("5. POST /api/products/:id/reviews: Cho phép gửi đánh giá khi đã có đơn hàng DELIVERED", async () => {
    const res = await request(app)
      .post(`/api/products/${targetProductId}/reviews`)
      .set("Authorization", `Bearer ${verifiedBuyerToken}`)
      .send({
        rating: 5,
        comment: "Sản phẩm thực tế sử dụng rất tốt, đóng gói kỹ càng và đúng hẹn."
      })
      .expect(201);

    assert.equal(res.body.success, true);
    assert.equal(res.body.data.isVerifiedBuyer, true);
    assert.equal(res.body.data.rating, 5);
  });

  test("6. GET /api/products/:id/reviews: Đánh giá mới xuất hiện với cờ isVerifiedBuyer", async () => {
    const res = await request(app)
      .get(`/api/products/${targetProductId}/reviews`)
      .expect(200);

    assert.equal(res.body.success, true);
    assert.ok(res.body.data.reviews.length > 0);
    const verifiedReview = res.body.data.reviews.find(
      (r: any) => r.userId === verifiedBuyerUser.id
    );
    assert.ok(verifiedReview, "Verified review should exist in the list");
    assert.equal(verifiedReview.isVerifiedBuyer, true);
  });
});
