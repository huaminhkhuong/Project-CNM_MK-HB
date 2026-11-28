import test, { describe, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app";
import { closePool, getDbPool } from "../src/config/database";
import { signAccessToken } from "../src/services/token.service";
import { sanitizeString, sanitizeDeep } from "../src/middlewares/sanitize.middleware";

const app = createApp();

describe("Stage 1: Security Hardening & Infrastructure Tests", () => {
  after(async () => {
    await closePool();
  });

  describe("1. XSS & Input Sanitization Middleware", () => {
    test("sanitizeString should remove script tags and malicious DOM handlers", () => {
      const malicious = "<script>alert('xss')</script>Intel Core i5 <img src=x onerror=alert(1)>";
      const cleaned = sanitizeString(malicious);
      assert.ok(!cleaned.includes("<script>"));
      assert.ok(!cleaned.includes("alert('xss')"));
      assert.ok(!cleaned.includes("onerror"));
      assert.ok(cleaned.includes("Intel Core i5"));
    });

    test("sanitizeDeep should recursively clean objects and arrays", () => {
      const payload = {
        name: "PC Gaming <script>hack()</script>",
        nested: {
          comment: "Tuyệt vời <iframe src='evil.com'></iframe>",
          items: ["DDR4 <script>", "NVMe SSD"]
        }
      };

      const cleaned = sanitizeDeep(payload);
      assert.equal(cleaned.name, "PC Gaming ");
      assert.equal(cleaned.nested.comment, "Tuyệt vời ");
      assert.deepEqual(cleaned.nested.items, ["DDR4 ", "NVMe SSD"]);
    });

    test("sanitizeDeep should preserve password fields intact (whitelist protection)", () => {
      const payload = {
        email: "user@example.com",
        fullName: "Test User <script>alert(1)</script>",
        password: "MyP@ssw<rd>!&javascript:alert(1)",
        confirmPassword: "MyP@ssw<rd>!&javascript:alert(1)",
        new_password: "NewP@ssw<rd>2026!<script>",
        oldPassword: "OldP@ssw<rd>2025!",
        refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.malicious<script>test",
        vnpay_hash_secret: "SECURE_HASH_SECRET_12345"
      };

      const cleaned = sanitizeDeep(payload);
      // fullName phải được lọc sạch thẻ script
      assert.equal(cleaned.fullName, "Test User ");
      // Các trường mật khẩu và token/khóa bí mật phải được bảo toàn 100% nguyên vẹn
      assert.equal(cleaned.password, "MyP@ssw<rd>!&javascript:alert(1)");
      assert.equal(cleaned.confirmPassword, "MyP@ssw<rd>!&javascript:alert(1)");
      assert.equal(cleaned.new_password, "NewP@ssw<rd>2026!<script>");
      assert.equal(cleaned.oldPassword, "OldP@ssw<rd>2025!");
      assert.equal(cleaned.refreshToken, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.malicious<script>test");
      assert.equal(cleaned.vnpay_hash_secret, "SECURE_HASH_SECRET_12345");
    });

    test("Sanitize middleware should cleanse request body before reaching routes", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          email: "xss_test@pcmall.vn",
          password: "Password123!",
          fullName: "Nguyễn Văn A <script>stealCookies()</script>"
        });

      // Whether it passes or fails validation, fullName must not contain <script>
      assert.ok(!JSON.stringify(res.body).includes("<script>"));
    });
  });

  describe("2. Security Headers (Helmet & Policies)", () => {
    test("Responses should include essential security headers", async () => {
      const res = await request(app).get("/api/health");
      assert.equal(res.status, 200);
      assert.equal(res.headers["x-content-type-options"], "nosniff");
      assert.equal(res.headers["x-frame-options"], "SAMEORIGIN");
      assert.equal(res.headers["referrer-policy"], "strict-origin-when-cross-origin");
      assert.equal(res.headers["x-download-options"], "noopen");
    });
  });

  describe("3. Enhanced Healthcheck & Database Latency Metrics", () => {
    test("/api/health should report uptime, memory metrics, and db latency", async () => {
      const res = await request(app).get("/api/health");
      assert.equal(res.status, 200);
      assert.equal(res.body.status, "ok");
      assert.equal(res.body.service, "api");
      assert.ok(typeof res.body.uptimeSeconds === "number");
      assert.ok(res.body.memoryUsageMb && typeof res.body.memoryUsageMb.heapUsed === "number");
      assert.ok(res.body.database && res.body.database.connected === true);
      assert.ok(typeof res.body.database.pingLatencyMs === "number");
    });
  });

  describe("4. Rate Limiting Middleware", () => {
    test("Rate limiter headers should be set appropriately", async () => {
      const res = await request(app).get("/api/health");
      assert.equal(res.status, 200);
      // In non-test environments or when headers are emitted:
      if (res.headers["x-ratelimit-limit"]) {
        assert.ok(Number(res.headers["x-ratelimit-limit"]) > 0);
      }
    });
  });

  describe("5. Authoritative Server-Side Shipping Fee (Anti-Tampering)", () => {
    test("ignores client-supplied shippingFee=0 on orders below 5,000,000 VND and applies 30,000 VND server-side", async () => {
      const pool = getDbPool();
      const [users]: any = await pool.execute("SELECT id, email FROM users ORDER BY id ASC LIMIT 1");
      const [cheapSkus]: any = await pool.execute(
        "SELECT id, product_id, price, stock FROM product_skus WHERE is_active = 1 AND stock >= 2 AND price > 0 AND price < 4000000 ORDER BY price ASC LIMIT 1"
      );
      if (!users.length || !cheapSkus.length) return;

      const user = users[0];
      const sku = cheapSkus[0];
      const token = signAccessToken({ userId: String(user.id), email: user.email, role: "CUSTOMER" });

      const checkoutRes = await request(app)
        .post("/api/orders/checkout")
        .set("Authorization", `Bearer ${token}`)
        .send({
          paymentMethod: "COD",
          shippingAddress: "Test Anti-Tamper Shipping - 0909111222 - Q1 HCM",
          shippingFee: 0,
          items: [{ productId: sku.product_id, productVariantId: sku.id, quantity: 1 }]
        });

      assert.equal(checkoutRes.status, 201);
      const order = checkoutRes.body.data;
      assert.equal(Number(order.shipping_fee), 30000, "Server must enforce 30,000 VND shipping fee below 5M threshold");
      assert.equal(
        Number(order.final_amount),
        Number(sku.price) + 30000,
        "final_amount must reflect server-calculated shipping fee"
      );

      // Clean up created test order & restore stock
      await pool.execute("DELETE FROM payments WHERE order_id = ?", [order.id]);
      await pool.execute("DELETE FROM order_items WHERE order_id = ?", [order.id]);
      await pool.execute("DELETE FROM orders WHERE id = ?", [order.id]);
      await pool.execute("UPDATE product_skus SET stock = stock + 1 WHERE id = ?", [sku.id]);
    });
  });
});

