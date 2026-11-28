import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app";
import { getDbPool } from "../src/config/database";
import { env, parseBooleanEnv } from "../src/config/env";
import { prisma } from "../src/config/prisma";
import { signAccessToken } from "../src/services/token.service";
import { generateVnpayUrl, getVnTime, sortObject, verifyVnpayReturn } from "../src/utils/vnpay";

function signVnpayParams(params: Record<string, string>, secretKey: string) {
  const sorted = sortObject(params);
  const signData = new URLSearchParams(sorted).toString();
  return crypto.createHmac("sha512", secretKey).update(Buffer.from(signData, "utf-8")).digest("hex");
}

describe("VNPay verification", () => {
  it("verifies a valid signed payload without mutating the original object", () => {
    process.env.VNPAY_HASH_SECRET = "test_vnpay_secret";
    const params = {
      vnp_Amount: "1000000",
      vnp_ResponseCode: "00",
      vnp_TmnCode: "TEST",
      vnp_TxnRef: "123"
    };
    const secureHash = signVnpayParams(params, process.env.VNPAY_HASH_SECRET);
    const payload = { ...params, vnp_SecureHash: secureHash };

    assert.equal(verifyVnpayReturn(payload), true);
    assert.equal(payload.vnp_SecureHash, secureHash);
  });

  it("rejects payloads without a secure hash", () => {
    process.env.VNPAY_HASH_SECRET = "test_vnpay_secret";

    assert.equal(verifyVnpayReturn({ vnp_TxnRef: "123" }), false);
  });

  it("generates VNPay redirect URL pointing vnp_ReturnUrl to backend /api/orders/vnpay/return with GMT+7 timestamps and clean OrderInfo", () => {
    const prevTmn = process.env.VNPAY_TMN_CODE;
    const prevSecret = process.env.VNPAY_HASH_SECRET;
    process.env.VNPAY_TMN_CODE = "TEST_TMN";
    process.env.VNPAY_HASH_SECRET = "test_vnpay_secret";
    try {
      const fixedUtcMs = Date.UTC(2026, 4, 10, 3, 15, 20); // 2026-05-10 03:15:20 UTC -> 10:15:20 GMT+7
      assert.equal(getVnTime(0, fixedUtcMs), "20260510101520");
      assert.equal(getVnTime(15, fixedUtcMs), "20260510103020");

      const url = generateVnpayUrl("::1", "9876", 250000, "Thanh toán đơn hàng #9876");
      const parsed = new URL(url);
      const returnUrl = parsed.searchParams.get("vnp_ReturnUrl") || "";
      assert.ok(
        returnUrl.endsWith("/api/orders/vnpay/return"),
        `Expected vnp_ReturnUrl to end with /api/orders/vnpay/return, got ${returnUrl}`
      );
      assert.equal(parsed.searchParams.get("vnp_Amount"), "25000000");
      assert.equal(parsed.searchParams.get("vnp_OrderInfo"), "Thanh toan don hang 9876");
      assert.equal(parsed.searchParams.get("vnp_IpAddr"), "127.0.0.1");
      assert.match(parsed.searchParams.get("vnp_CreateDate") || "", /^\d{14}$/);
      assert.match(parsed.searchParams.get("vnp_ExpireDate") || "", /^\d{14}$/);
      assert.ok(url.includes("vnp_OrderInfo=Thanh+toan+don+hang+9876"), "Spaces in vnp_OrderInfo must be encoded as +");

      // Signature produced by generateVnpayUrl must pass verifyVnpayReturn
      const queryObj: Record<string, string> = {};
      parsed.searchParams.forEach((v, k) => {
        queryObj[k] = v;
      });
      assert.equal(verifyVnpayReturn(queryObj), true);
    } finally {
      if (prevTmn === undefined) delete process.env.VNPAY_TMN_CODE;
      else process.env.VNPAY_TMN_CODE = prevTmn;
      if (prevSecret === undefined) delete process.env.VNPAY_HASH_SECRET;
      else process.env.VNPAY_HASH_SECRET = prevSecret;
    }
  });

  it("parses PAYMENT_MOCK_MODE boolean strings explicitly (false/0/empty -> false)", () => {
    assert.equal(parseBooleanEnv("false"), false);
    assert.equal(parseBooleanEnv("FALSE"), false);
    assert.equal(parseBooleanEnv("0"), false);
    assert.equal(parseBooleanEnv(""), false);
    assert.equal(parseBooleanEnv(undefined), false);
    assert.equal(parseBooleanEnv(false), false);
    assert.equal(parseBooleanEnv("true"), true);
    assert.equal(parseBooleanEnv("TRUE"), true);
    assert.equal(parseBooleanEnv("1"), true);
    assert.equal(parseBooleanEnv("yes"), true);
    assert.equal(parseBooleanEnv(true), true);
  });
});

describe("Payment Hardening - VNPay IPN/Return, Mock Guard & Payments SSOT", () => {
  const app = createApp();
  const pool = getDbPool();
  const createdOrderIds: number[] = [];
  const stockAdjustments: Array<{ skuId: number; delta: number }> = [];

  after(async () => {
    for (const adj of stockAdjustments) {
      await pool.execute("UPDATE product_skus SET stock = stock + ? WHERE id = ?", [adj.delta, adj.skuId]).catch(() => {});
    }
    for (const orderId of createdOrderIds) {
      await pool.execute("DELETE FROM notifications WHERE reference_type = 'ORDER' AND reference_id = ?", [String(orderId)]).catch(() => {});
      await pool.execute("DELETE FROM payments WHERE order_id = ?", [orderId]).catch(() => {});
      await pool.execute("DELETE FROM order_items WHERE order_id = ?", [orderId]).catch(() => {});
      await pool.execute("DELETE FROM orders WHERE id = ?", [orderId]).catch(() => {});
    }
    await prisma.$disconnect().catch(() => {});
    await pool.end().catch(() => {});
  });

  it("creates synced payments rows on checkout and validates VNPay guards + IPN/Return hardening", async () => {
    const [users]: any = await pool.execute("SELECT id, email FROM users ORDER BY id ASC LIMIT 1");
    assert.ok(users.length > 0, "Needs at least one user");
    const user = users[0];

    const [skus]: any = await pool.execute(
      "SELECT id, product_id, price, stock FROM product_skus WHERE is_active = 1 AND stock >= 3 ORDER BY id ASC LIMIT 1"
    );
    assert.ok(skus.length > 0, "Needs at least one active SKU with stock >= 3");
    const sku = skus[0];

    const customerToken = signAccessToken({
      userId: String(user.id),
      email: user.email,
      role: "CUSTOMER"
    });

    // 1. Checkout COD -> creates payments row (COD / UNPAID)
    const codRes = await request(app)
      .post("/api/orders/checkout")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        paymentMethod: "COD",
        shippingAddress: "Nguyen Van A - 0909123456 - 123 Le Loi, Q1",
        shippingFee: 0,
        items: [{ productId: sku.product_id, productVariantId: sku.id, quantity: 1 }]
      });
    assert.equal(codRes.status, 201, `COD checkout failed: ${JSON.stringify(codRes.body)}`);
    const codOrderId = Number(codRes.body.data.id);
    createdOrderIds.push(codOrderId);
    stockAdjustments.push({ skuId: sku.id, delta: 1 });

    const [codPayments]: any = await pool.execute("SELECT * FROM payments WHERE order_id = ?", [codOrderId]);
    assert.equal(codPayments.length, 1);
    assert.equal(codPayments[0].provider, "COD");
    assert.equal(codPayments[0].payment_method, "COD");
    assert.equal(codPayments[0].status, "UNPAID");

    // COD order cannot request VNPay URL
    const wrongMethodRes = await request(app)
      .post(`/api/orders/${codOrderId}/vnpay-url`)
      .set("Authorization", `Bearer ${customerToken}`);
    assert.equal(wrongMethodRes.status, 400);

    // 2. Checkout VNPAY -> creates payments row (PENDING_GATEWAY)
    const vnpayCheckoutRes = await request(app)
      .post("/api/orders/checkout")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        paymentMethod: "VNPAY",
        shippingAddress: "Nguyen Van A - 0909123456 - 123 Le Loi, Q1",
        shippingFee: 0,
        items: [{ productId: sku.product_id, productVariantId: sku.id, quantity: 1 }]
      });
    assert.equal(vnpayCheckoutRes.status, 201);
    const vnpayOrderId = Number(vnpayCheckoutRes.body.data.id);
    const expectedVnd = Math.round(Number(vnpayCheckoutRes.body.data.final_amount || sku.price));
    createdOrderIds.push(vnpayOrderId);
    stockAdjustments.push({ skuId: sku.id, delta: 1 });

    const [vnpayPayments]: any = await pool.execute("SELECT * FROM payments WHERE order_id = ?", [vnpayOrderId]);
    assert.equal(vnpayPayments.length, 1);
    assert.equal(vnpayPayments[0].payment_method, "VNPAY");
    assert.equal(vnpayPayments[0].status, "PENDING_GATEWAY");

    // 2b. Generating a real VNPay Sandbox URL (>500 chars) persists cleanly in payments.redirect_url (TEXT)
    const origMockForUrl = env.paymentMockMode;
    const prevTmnForUrl = process.env.VNPAY_TMN_CODE;
    const prevSecForUrl = process.env.VNPAY_HASH_SECRET;
    try {
      env.paymentMockMode = false;
      process.env.VNPAY_TMN_CODE = "V5N95J2H";
      process.env.VNPAY_HASH_SECRET = "test_vnpay_secret_1234567890123456";
      const realUrlRes = await request(app)
        .post(`/api/orders/${vnpayOrderId}/vnpay-url`)
        .set("Authorization", `Bearer ${customerToken}`);
      assert.equal(realUrlRes.status, 200, `Expected 200 generating real VNPay URL, got ${JSON.stringify(realUrlRes.body)}`);
      const generatedPaymentUrl = String(realUrlRes.body?.data?.paymentUrl || "");
      assert.ok(generatedPaymentUrl.startsWith("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?"));
      assert.ok(generatedPaymentUrl.length > 400, `Expected long VNPay URL, got length=${generatedPaymentUrl.length}`);

      const [updatedPayRows]: any = await pool.execute("SELECT redirect_url, provider FROM payments WHERE order_id = ?", [vnpayOrderId]);
      assert.equal(updatedPayRows[0].redirect_url, generatedPaymentUrl);
      assert.equal(updatedPayRows[0].provider, "VNPAY_SANDBOX");
    } finally {
      env.paymentMockMode = origMockForUrl;
      if (prevTmnForUrl === undefined) delete process.env.VNPAY_TMN_CODE;
      else process.env.VNPAY_TMN_CODE = prevTmnForUrl;
      if (prevSecForUrl === undefined) delete process.env.VNPAY_HASH_SECRET;
      else process.env.VNPAY_HASH_SECRET = prevSecForUrl;
    }

    // 3. Mock payment endpoints blocked with 403 when mock mode disabled outside test or in production
    const origMockMode = env.paymentMockMode;
    const origNodeEnv = env.nodeEnv;
    const origTmnForBlock = process.env.VNPAY_TMN_CODE;
    const origSecForBlock = process.env.VNPAY_HASH_SECRET;
    try {
      env.paymentMockMode = false;
      (env as any).nodeEnv = "development";
      process.env.VNPAY_TMN_CODE = process.env.VNPAY_TMN_CODE || "CI_TEST_TMN";
      process.env.VNPAY_HASH_SECRET = process.env.VNPAY_HASH_SECRET || "ci_test_vnpay_secret_1234567890";

      const blockedMockPay = await request(app)
        .post(`/api/orders/${vnpayOrderId}/mock-pay`)
        .set("Authorization", `Bearer ${customerToken}`);
      assert.equal(blockedMockPay.status, 403);
      assert.equal(blockedMockPay.body.message, "Mock payment is disabled");

      const blockedMockCancel = await request(app)
        .post(`/api/orders/${vnpayOrderId}/mock-cancel`)
        .set("Authorization", `Bearer ${customerToken}`);
      assert.equal(blockedMockCancel.status, 403);

      env.paymentMockMode = true;
      (env as any).nodeEnv = "production";
      const blockedInProd = await request(app)
        .post(`/api/orders/${vnpayOrderId}/mock-pay`)
        .set("Authorization", `Bearer ${customerToken}`);
      assert.equal(blockedInProd.status, 403);
    } finally {
      env.paymentMockMode = origMockMode;
      (env as any).nodeEnv = origNodeEnv;
      if (origTmnForBlock === undefined) delete process.env.VNPAY_TMN_CODE;
      else process.env.VNPAY_TMN_CODE = origTmnForBlock;
      if (origSecForBlock === undefined) delete process.env.VNPAY_HASH_SECRET;
      else process.env.VNPAY_HASH_SECRET = origSecForBlock;
    }

    // 4. VNPay IPN & Return signature, amount mismatch, failure, and idempotent success verification
    const prevSecret = process.env.VNPAY_HASH_SECRET;
    process.env.VNPAY_HASH_SECRET = "test_vnpay_secret";
    try {
      // 4a. Invalid signature
      const badSigIpn = await request(app)
        .get("/api/orders/vnpay/ipn")
        .query({
          vnp_TxnRef: String(vnpayOrderId),
          vnp_Amount: String(expectedVnd * 100),
          vnp_ResponseCode: "00",
          vnp_SecureHash: "deadbeef"
        });
      assert.equal(badSigIpn.status, 200);
      assert.equal(badSigIpn.body.RspCode, "97");

      const badSigReturn = await request(app)
        .get("/api/orders/vnpay/return")
        .query({
          vnp_TxnRef: String(vnpayOrderId),
          vnp_Amount: String(expectedVnd * 100),
          vnp_ResponseCode: "00",
          vnp_SecureHash: "deadbeef"
        });
      assert.equal(badSigReturn.status, 302);
      assert.ok(badSigReturn.headers.location.includes("reason=invalid_signature"));

      // 4b. Tampered vnp_Amount (valid signature but wrong amount)
      const tamperedParams = {
        vnp_Amount: String(Math.max(100, (expectedVnd - 1000) * 100)),
        vnp_ResponseCode: "00",
        vnp_TmnCode: "TEST",
        vnp_TransactionNo: "VNP_TAMPER_1",
        vnp_TxnRef: String(vnpayOrderId)
      };
      const tamperedSig = signVnpayParams(tamperedParams, process.env.VNPAY_HASH_SECRET);
      const tamperedIpn = await request(app)
        .get("/api/orders/vnpay/ipn")
        .query({ ...tamperedParams, vnp_SecureHash: tamperedSig });
      assert.equal(tamperedIpn.status, 200);
      assert.equal(tamperedIpn.body.RspCode, "04");

      const tamperedReturn = await request(app)
        .get("/api/orders/vnpay/return")
        .query({ ...tamperedParams, vnp_SecureHash: tamperedSig });
      assert.equal(tamperedReturn.status, 302);
      assert.ok(tamperedReturn.headers.location.includes("reason=invalid_amount"));

      // 4c. Failed VNPay response code ("24" - user cancelled at VNPay) -> payments=FAILED, order stays PENDING
      const failParams = {
        vnp_Amount: String(expectedVnd * 100),
        vnp_ResponseCode: "24",
        vnp_TmnCode: "TEST",
        vnp_TransactionNo: "0",
        vnp_TxnRef: String(vnpayOrderId)
      };
      const failSig = signVnpayParams(failParams, process.env.VNPAY_HASH_SECRET);
      const failReturn = await request(app)
        .get("/api/orders/vnpay/return")
        .query({ ...failParams, vnp_SecureHash: failSig });
      assert.equal(failReturn.status, 302);
      assert.ok(failReturn.headers.location.includes("success=false"));
      assert.ok(failReturn.headers.location.includes("reason=vnpay_24"));

      const [failedPayRows]: any = await pool.execute("SELECT status FROM payments WHERE order_id = ?", [vnpayOrderId]);
      assert.equal(failedPayRows[0].status, "FAILED");
      const [pendingOrderRows]: any = await pool.execute("SELECT status, payment_status FROM orders WHERE id = ?", [vnpayOrderId]);
      assert.equal(pendingOrderRows[0].status, "PENDING");
      assert.equal(pendingOrderRows[0].payment_status, "FAILED");

      // Verify notifications: checkout sent "đang chờ thanh toán" (NOT "Đặt hàng thành công"), code 24 sent "Thanh toán thất bại"
      await new Promise((r) => setTimeout(r, 100));
      const [vnpayNotifs]: any = await pool.execute(
        "SELECT title FROM notifications WHERE reference_type = 'ORDER' AND reference_id = ? ORDER BY id ASC",
        [String(vnpayOrderId)]
      );
      const titles = vnpayNotifs.map((n: any) => String(n.title));
      assert.ok(titles.some((t: string) => t.includes("đang chờ thanh toán")), `Expected waiting-payment notification, got ${JSON.stringify(titles)}`);
      assert.ok(!titles.some((t: string) => t.startsWith("Đặt hàng thành công")), `VNPay unpaid order must not emit Đặt hàng thành công: ${JSON.stringify(titles)}`);
      assert.ok(titles.some((t: string) => t.includes("Thanh toán thất bại")), `Expected failure notification on code 24, got ${JSON.stringify(titles)}`);

      // 4d. Valid signed success ("00") -> updates both orders & payments atomically + idempotent
      const okParams = {
        vnp_Amount: String(expectedVnd * 100),
        vnp_ResponseCode: "00",
        vnp_TmnCode: "TEST",
        vnp_TransactionNo: "VNP99887766",
        vnp_TxnRef: String(vnpayOrderId)
      };
      const okSig = signVnpayParams(okParams, process.env.VNPAY_HASH_SECRET);
      const okIpn = await request(app)
        .get("/api/orders/vnpay/ipn")
        .query({ ...okParams, vnp_SecureHash: okSig });
      assert.equal(okIpn.status, 200);
      assert.equal(okIpn.body.RspCode, "00");

      const [paidOrderRows]: any = await pool.execute("SELECT status, payment_status FROM orders WHERE id = ?", [vnpayOrderId]);
      assert.equal(paidOrderRows[0].status, "PROCESSING");
      assert.equal(paidOrderRows[0].payment_status, "PAID");

      const [paidPayRows]: any = await pool.execute("SELECT status, transaction_code FROM payments WHERE order_id = ?", [vnpayOrderId]);
      assert.equal(paidPayRows[0].status, "PAID");
      assert.equal(paidPayRows[0].transaction_code, "VNP99887766");

      // Idempotent second call
      const secondIpn = await request(app)
        .get("/api/orders/vnpay/ipn")
        .query({ ...okParams, vnp_SecureHash: okSig });
      assert.equal(secondIpn.status, 200);
      assert.equal(secondIpn.body.RspCode, "00");
      assert.ok(secondIpn.body.Message.includes("Already Paid"));
    } finally {
      if (prevSecret === undefined) delete process.env.VNPAY_HASH_SECRET;
      else process.env.VNPAY_HASH_SECRET = prevSecret;
    }
  });

  it("dynamically toggles mock vs sandbox via system_settings.online_payment_mode with instant cache invalidation and production lock", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { isMockPaymentEnabled, invalidatePaymentModeCache } = require("../src/services/payment-mode.service");

    const [users]: any = await pool.execute("SELECT id, email FROM users ORDER BY id ASC LIMIT 1");
    assert.ok(users.length > 0);
    const user = users[0];

    const [skus]: any = await pool.execute(
      "SELECT id, product_id, price, stock FROM product_skus WHERE is_active = 1 AND stock >= 2 ORDER BY id ASC LIMIT 1"
    );
    assert.ok(skus.length > 0);
    const sku = skus[0];

    const customerToken = signAccessToken({ userId: String(user.id), email: user.email, role: "CUSTOMER" });
    const adminToken = signAccessToken({ userId: String(user.id), email: user.email, role: "ADMIN" });

    const [origSettingRows]: any = await pool.execute(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'online_payment_mode' LIMIT 1"
    );
    const origDbMode = origSettingRows?.[0]?.setting_value || "sandbox";
    const origNodeEnv = env.nodeEnv;
    const origMockMode = env.paymentMockMode;
    const origTmnForToggle = process.env.VNPAY_TMN_CODE;
    const origSecForToggle = process.env.VNPAY_HASH_SECRET;

    // Create a VNPAY order to test live mode switching
    const orderRes = await request(app)
      .post("/api/orders/checkout")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        paymentMethod: "VNPAY",
        shippingAddress: "Switch Mode Test - 0909000111 - Q1",
        shippingFee: 0,
        items: [{ productId: sku.product_id, productVariantId: sku.id, quantity: 1 }]
      });
    assert.equal(orderRes.status, 201);
    const orderId = Number(orderRes.body.data.id);
    createdOrderIds.push(orderId);
    stockAdjustments.push({ skuId: sku.id, delta: 1 });

    try {
      process.env.VNPAY_TMN_CODE = process.env.VNPAY_TMN_CODE || "CI_TEST_TMN";
      process.env.VNPAY_HASH_SECRET = process.env.VNPAY_HASH_SECRET || "ci_test_vnpay_secret_1234567890";

      // 1. Invalid mode rejected with 400
      const invalidRes = await request(app)
        .patch("/api/admin/system/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ online_payment_mode: "invalid_mode" });
      assert.equal(invalidRes.status, 400);

      // 2. Switch to "mock" in development -> immediately enables mock payment (cache invalidated)
      (env as any).nodeEnv = "development";
      env.paymentMockMode = false;

      const toMockRes = await request(app)
        .patch("/api/admin/system/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ online_payment_mode: "mock" });
      assert.equal(toMockRes.status, 200);
      assert.equal(await isMockPaymentEnabled(), true);

      const mockUrlRes = await request(app)
        .post(`/api/orders/${orderId}/vnpay-url`)
        .set("Authorization", `Bearer ${customerToken}`);
      assert.equal(mockUrlRes.status, 200);
      assert.equal(mockUrlRes.body.data.isMock, true);
      assert.ok(String(mockUrlRes.body.data.paymentUrl).includes("/payment/mock?orderId="));

      const mockCancelAllowed = await request(app)
        .post(`/api/orders/${orderId}/mock-cancel`)
        .set("Authorization", `Bearer ${customerToken}`);
      assert.equal(mockCancelAllowed.status, 200);

      // 3. Production lock: even while DB is "mock", NODE_ENV=production MUST return false & 403
      (env as any).nodeEnv = "production";
      assert.equal(await isMockPaymentEnabled(), false);
      const blockedInProd = await request(app)
        .post(`/api/orders/${orderId}/mock-pay`)
        .set("Authorization", `Bearer ${customerToken}`);
      assert.equal(blockedInProd.status, 403);

      // 4. Switch back to "sandbox" in development -> immediately disables mock & returns real sandbox URL
      (env as any).nodeEnv = "development";
      const toSandboxRes = await request(app)
        .patch("/api/admin/system/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ online_payment_mode: "sandbox" });
      assert.equal(toSandboxRes.status, 200);
      assert.equal(await isMockPaymentEnabled(), false);

      const sandboxUrlRes = await request(app)
        .post(`/api/orders/${orderId}/vnpay-url`)
        .set("Authorization", `Bearer ${customerToken}`);
      assert.equal(sandboxUrlRes.status, 200);
      assert.ok(String(sandboxUrlRes.body.data.paymentUrl).startsWith("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?"));

      const mockBlockedAgain = await request(app)
        .post(`/api/orders/${orderId}/mock-pay`)
        .set("Authorization", `Bearer ${customerToken}`);
      assert.equal(mockBlockedAgain.status, 403);
    } finally {
      (env as any).nodeEnv = origNodeEnv;
      env.paymentMockMode = origMockMode;
      if (origTmnForToggle === undefined) delete process.env.VNPAY_TMN_CODE;
      else process.env.VNPAY_TMN_CODE = origTmnForToggle;
      if (origSecForToggle === undefined) delete process.env.VNPAY_HASH_SECRET;
      else process.env.VNPAY_HASH_SECRET = origSecForToggle;
      await pool.execute(
        "UPDATE system_settings SET setting_value = ? WHERE setting_key = 'online_payment_mode'",
        [origDbMode]
      ).catch(() => {});
      invalidatePaymentModeCache();
    }
  });
});
