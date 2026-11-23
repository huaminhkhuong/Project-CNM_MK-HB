import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app";
import { getDbPool } from "../src/config/database";
import { env } from "../src/config/env";
import { prisma } from "../src/config/prisma";
import { signAccessToken } from "../src/services/token.service";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sepayService = require("../src/modules/payments/sepay.service");

describe("SePay Auto-VietQR Payment & Webhook Integration", () => {
  const app = createApp();
  const pool = getDbPool();
  const createdOrderIds: number[] = [];
  const stockAdjustments: Array<{ skuId: number; delta: number }> = [];

  after(async () => {
    for (const adj of stockAdjustments) {
      await pool.execute("UPDATE product_skus SET stock = stock + ? WHERE id = ?", [adj.delta, adj.skuId]).catch(() => {});
    }
    for (const orderId of createdOrderIds) {
      await pool.execute("DELETE FROM audit_logs WHERE entity_type = 'ORDER' AND entity_id = ?", [String(orderId)]).catch(() => {});
      await pool.execute("DELETE FROM notifications WHERE reference_type = 'ORDER' AND reference_id = ?", [String(orderId)]).catch(() => {});
      await pool.execute("DELETE FROM payments WHERE order_id = ?", [orderId]).catch(() => {});
      await pool.execute("DELETE FROM order_items WHERE order_id = ?", [orderId]).catch(() => {});
      await pool.execute("DELETE FROM orders WHERE id = ?", [orderId]).catch(() => {});
    }
    await prisma.$disconnect().catch(() => {});
    await pool.end().catch(() => {});
  });

  it("extracts PCMALL and legacy DH order IDs accurately from real bank transfer memos", () => {
    assert.equal(sepayService.extractOrderIdFromPayload({ code: "PCMALL768" }), 768);
    assert.equal(
      sepayService.extractOrderIdFromPayload({ content: "MBVCB.6543210.PCMALL768.CHUYEN TIEN" }),
      768
    );
    assert.equal(
      sepayService.extractOrderIdFromPayload({ content: "NGUYEN VAN A thanh toan pcmall 1024" }),
      1024
    );
    assert.equal(sepayService.extractOrderIdFromPayload({ content: "DH995 0909123456" }), 995);
    assert.equal(sepayService.extractOrderIdFromPayload({ content: "Chuyen tien ca phe 50000" }), null);
  });

  it("enforces webhook API key auth, owner QR info access, underpaid guard, auto-approval & deduplication", async () => {
    const [users]: any = await pool.execute("SELECT id, email FROM users ORDER BY id ASC LIMIT 1");
    assert.ok(users.length > 0, "Needs at least one user");
    const user = users[0];

    const [skus]: any = await pool.execute(
      "SELECT id, product_id, price, stock FROM product_skus WHERE is_active = 1 AND stock >= 2 ORDER BY id ASC LIMIT 1"
    );
    assert.ok(skus.length > 0, "Needs an active SKU with stock >= 2");
    const sku = skus[0];

    const customerToken = signAccessToken({
      userId: String(user.id),
      email: user.email,
      role: "CUSTOMER"
    });
    const attackerToken = signAccessToken({
      userId: String(Number(user.id) + 888888),
      email: "other@example.com",
      role: "CUSTOMER"
    });

    // 1. Checkout with BANK_TRANSFER
    const checkoutRes = await request(app)
      .post("/api/orders/checkout")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        paymentMethod: "BANK_TRANSFER",
        shippingAddress: "Test SePay - 0909888777 - Q1, HCM",
        shippingFee: 0,
        items: [{ productId: sku.product_id, productVariantId: sku.id, quantity: 1 }]
      });
    assert.equal(checkoutRes.status, 201);
    const orderId = Number(checkoutRes.body.data.id);
    const expectedAmount = Math.round(Number(checkoutRes.body.data.final_amount || sku.price));
    createdOrderIds.push(orderId);
    stockAdjustments.push({ skuId: sku.id, delta: 1 });

    // 2. Owner can fetch SePay QR payment info; another customer gets 403 (IDOR blocked)
    const qrInfoRes = await request(app)
      .get(`/api/payments/sepay/order/${orderId}`)
      .set("Authorization", `Bearer ${customerToken}`);
    assert.equal(qrInfoRes.status, 200);
    assert.equal(qrInfoRes.body.data.orderId, orderId);
    assert.equal(qrInfoRes.body.data.transferContent, `PCMALL${orderId}`);
    assert.equal(qrInfoRes.body.data.amount, expectedAmount);
    assert.ok(String(qrInfoRes.body.data.qrUrl).startsWith("https://qr.sepay.vn/img?"));

    const idorQrRes = await request(app)
      .get(`/api/payments/sepay/order/${orderId}`)
      .set("Authorization", `Bearer ${attackerToken}`);
    assert.equal(idorQrRes.status, 403);

    // 3. Configure temporary SePay Webhook API key for webhook tests
    const origKey = env.sepayWebhookApiKey;
    const origProcessKey = process.env.SEPAY_WEBHOOK_API_KEY;
    const testApiKey = "sepay_test_webhook_secret_key_987654";
    (env as any).sepayWebhookApiKey = testApiKey;
    process.env.SEPAY_WEBHOOK_API_KEY = testApiKey;

    try {
      // 3a. Missing or invalid Authorization header -> 401
      const noAuthRes = await request(app)
        .post("/api/payments/sepay/webhook")
        .send({ id: 1, transferType: "in", transferAmount: expectedAmount, content: `PCMALL${orderId}` });
      assert.equal(noAuthRes.status, 401);

      const badAuthRes = await request(app)
        .post("/api/payments/sepay/webhook")
        .set("Authorization", "Apikey wrong_key")
        .send({ id: 1, transferType: "in", transferAmount: expectedAmount, content: `PCMALL${orderId}` });
      assert.equal(badAuthRes.status, 401);

      // 3b. Outgoing transfer ("out") -> ignored cleanly (200)
      const outRes = await request(app)
        .post("/api/payments/sepay/webhook")
        .set("Authorization", `Apikey ${testApiKey}`)
        .send({ id: 50001, transferType: "out", transferAmount: expectedAmount, content: `PCMALL${orderId}` });
      assert.equal(outRes.status, 200);
      assert.equal(outRes.body.ignored, true);

      // 3c. Unrelated personal transfer -> 200 matched=false
      const unmatchedRes = await request(app)
        .post("/api/payments/sepay/webhook")
        .set("Authorization", `Apikey ${testApiKey}`)
        .send({ id: 50002, transferType: "in", transferAmount: 25000, content: "Tien an trua" });
      assert.equal(unmatchedRes.status, 200);
      assert.equal(unmatchedRes.body.matched, false);

      // 3d. Underpaid transfer -> order remains PENDING, NOT PAID, audit log recorded
      const underpaidAmount = Math.max(1000, expectedAmount - 50000);
      const underpaidRes = await request(app)
        .post("/api/payments/sepay/webhook")
        .set("Authorization", `Apikey ${testApiKey}`)
        .send({
          id: 50003,
          gateway: "MBBank",
          transactionDate: "2026-11-23 09:30:00",
          transferType: "in",
          transferAmount: underpaidAmount,
          content: `MBVCB.111.PCMALL${orderId}.CHUYEN THIEU`,
          referenceCode: `FT_UNDER_${orderId}`
        });
      assert.equal(underpaidRes.status, 200);
      assert.equal(underpaidRes.body.underpaid, true);

      const [stillPendingRows]: any = await pool.execute("SELECT status, payment_status FROM orders WHERE id = ?", [orderId]);
      assert.equal(stillPendingRows[0].status, "PENDING");
      assert.notEqual(stillPendingRows[0].payment_status, "PAID");

      // 3e. Exact transfer -> auto-approved atomically (orders: PAID/PROCESSING, payments: SEPAY_VIETQR/PAID + referenceCode)
      const refCode = `FT261123SEPAY${orderId}`;
      const paidRes = await request(app)
        .post("/api/payments/sepay/webhook")
        .set("Authorization", `Apikey ${testApiKey}`)
        .send({
          id: 50004,
          gateway: "Techcombank",
          transactionDate: "2026-11-23 09:35:00",
          transferType: "in",
          transferAmount: expectedAmount,
          code: `PCMALL${orderId}`,
          content: `TCB.998877.PCMALL${orderId}.CT NHANH 247`,
          referenceCode: refCode
        });
      assert.equal(paidRes.status, 200);
      assert.equal(paidRes.body.success, true);
      assert.equal(paidRes.body.status, "PROCESSING");
      assert.equal(paidRes.body.paymentStatus, "PAID");
      assert.equal(paidRes.body.transactionCode, refCode);

      const [paidOrderRows]: any = await pool.execute("SELECT status, payment_status FROM orders WHERE id = ?", [orderId]);
      assert.equal(paidOrderRows[0].status, "PROCESSING");
      assert.equal(paidOrderRows[0].payment_status, "PAID");

      const [paidPaymentRows]: any = await pool.execute(
        "SELECT provider, status, transaction_code FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1",
        [orderId]
      );
      assert.equal(paidPaymentRows[0].provider, "SEPAY_VIETQR");
      assert.equal(paidPaymentRows[0].status, "PAID");
      assert.equal(paidPaymentRows[0].transaction_code, refCode);

      // 3f. Duplicate replay -> idempotent 200 (duplicate: true)
      const replayRes = await request(app)
        .post("/api/payments/sepay/webhook")
        .set("Authorization", `Apikey ${testApiKey}`)
        .send({
          id: 50004,
          gateway: "Techcombank",
          transactionDate: "2026-11-23 09:35:00",
          transferType: "in",
          transferAmount: expectedAmount,
          code: `PCMALL${orderId}`,
          content: `TCB.998877.PCMALL${orderId}.CT NHANH 247`,
          referenceCode: refCode
        });
      assert.equal(replayRes.status, 200);
      assert.equal(replayRes.body.duplicate, true);

      // Verify audit logs + notification created
      await new Promise((r) => setTimeout(r, 100));
      const [auditRows]: any = await pool.execute(
        "SELECT action FROM audit_logs WHERE entity_type = 'ORDER' AND entity_id = ?",
        [String(orderId)]
      );
      const auditActions = auditRows.map((r: any) => r.action);
      assert.ok(auditActions.includes("SEPAY_PAYMENT_UNDERPAID"));
      assert.ok(auditActions.includes("SEPAY_PAYMENT_AUTO_APPROVED"));

      const [notifRows]: any = await pool.execute(
        "SELECT title FROM notifications WHERE reference_type = 'ORDER' AND reference_id = ?",
        [String(orderId)]
      );
      const titles = notifRows.map((n: any) => String(n.title));
      assert.ok(titles.some((t: string) => t.includes("Thanh toán & đặt hàng thành công")));
    } finally {
      (env as any).sepayWebhookApiKey = origKey;
      if (origProcessKey === undefined) delete process.env.SEPAY_WEBHOOK_API_KEY;
      else process.env.SEPAY_WEBHOOK_API_KEY = origProcessKey;
    }
  });

  it("auto-approves pending BANK_TRANSFER orders via SePay Pull Sync API (no tunnel required) and deduplicates against subsequent webhook", async () => {
    const [users]: any = await pool.execute("SELECT id, email FROM users ORDER BY id ASC LIMIT 1");
    assert.ok(users.length > 0);
    const user = users[0];

    const [skus]: any = await pool.execute(
      "SELECT id, product_id, price, stock FROM product_skus WHERE is_active = 1 AND stock >= 2 ORDER BY id ASC LIMIT 1"
    );
    assert.ok(skus.length > 0);
    const sku = skus[0];

    const customerToken = signAccessToken({ userId: String(user.id), email: user.email, role: "CUSTOMER" });

    // Create unpaid BANK_TRANSFER order
    const checkoutRes = await request(app)
      .post("/api/orders/checkout")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        paymentMethod: "BANK_TRANSFER",
        shippingAddress: "Pull Sync Test - 0356565991 - HCM",
        shippingFee: 0,
        items: [{ productId: sku.product_id, productVariantId: sku.id, quantity: 1 }]
      });
    assert.equal(checkoutRes.status, 201);
    const orderId = Number(checkoutRes.body.data.id);
    const expectedAmount = Math.round(Number(checkoutRes.body.data.final_amount || sku.price));
    createdOrderIds.push(orderId);
    stockAdjustments.push({ skuId: sku.id, delta: 1 });

    const origToken = env.sepayApiToken;
    const origProcessToken = process.env.SEPAY_API_TOKEN;
    const origWebhookKey = env.sepayWebhookApiKey;
    const origProcessWebhookKey = process.env.SEPAY_WEBHOOK_API_KEY;
    const fakeToken = "sepay_bearer_token_test_12345";
    const fakeWebhookKey = "sepay_webhook_key_test_12345";
    (env as any).sepayApiToken = fakeToken;
    process.env.SEPAY_API_TOKEN = fakeToken;
    (env as any).sepayWebhookApiKey = fakeWebhookKey;
    process.env.SEPAY_WEBHOOK_API_KEY = fakeWebhookKey;
    sepayService.resetSepaySyncCooldownForTest();

    try {
      const refNo = `FT261123POLL${orderId}`;
      let capturedAuthHeader = "";
      const mockFetcher = async (_url: string, config: any) => {
        capturedAuthHeader = config?.headers?.Authorization || "";
        return {
          data: {
            status: 200,
            transactions: [
              {
                id: `77${orderId}`,
                bank_brand_name: "Sacombank",
                account_number: "0356565991",
                transaction_date: "2026-11-23 10:45:00",
                amount_out: "0.00",
                amount_in: `${expectedAmount}.00`,
                transaction_content: `STB.8888.PCMALL${orderId}.CHUYEN KHOAN NHANH`,
                reference_number: refNo,
                code: null
              }
            ]
          }
        };
      };

      const syncResult = await sepayService.syncPendingSepayOrders({ force: true, fetcher: mockFetcher });
      assert.equal(capturedAuthHeader, `Bearer ${fakeToken}`);
      assert.equal(syncResult.skipped, false);
      assert.ok(syncResult.approvedOrderIds.includes(orderId));

      const [orderRows]: any = await pool.execute("SELECT status, payment_status FROM orders WHERE id = ?", [orderId]);
      assert.equal(orderRows[0].status, "PROCESSING");
      assert.equal(orderRows[0].payment_status, "PAID");

      const [paymentRows]: any = await pool.execute(
        "SELECT provider, status, transaction_code FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1",
        [orderId]
      );
      assert.equal(paymentRows[0].provider, "SEPAY_VIETQR");
      assert.equal(paymentRows[0].status, "PAID");
      assert.equal(paymentRows[0].transaction_code, refNo);

      // If the same transaction later arrives via Webhook, it MUST be deduplicated cleanly
      const dupWebhookRes = await request(app)
        .post("/api/payments/sepay/webhook")
        .set("Authorization", `Apikey ${fakeWebhookKey}`)
        .send({
          id: Number(`77${orderId}`),
          gateway: "Sacombank",
          transferType: "in",
          transferAmount: expectedAmount,
          content: `STB.8888.PCMALL${orderId}.CHUYEN KHOAN NHANH`,
          referenceCode: refNo
        });
      assert.equal(dupWebhookRes.status, 200);
      assert.equal(dupWebhookRes.body.duplicate, true);
    } finally {
      (env as any).sepayApiToken = origToken;
      if (origProcessToken === undefined) delete process.env.SEPAY_API_TOKEN;
      else process.env.SEPAY_API_TOKEN = origProcessToken;
      (env as any).sepayWebhookApiKey = origWebhookKey;
      if (origProcessWebhookKey === undefined) delete process.env.SEPAY_WEBHOOK_API_KEY;
      else process.env.SEPAY_WEBHOOK_API_KEY = origProcessWebhookKey;
      sepayService.resetSepaySyncCooldownForTest();
    }
  });
});

