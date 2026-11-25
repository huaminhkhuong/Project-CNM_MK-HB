import test, { describe, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app";
import { closePool } from "../src/config/database";
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
});

