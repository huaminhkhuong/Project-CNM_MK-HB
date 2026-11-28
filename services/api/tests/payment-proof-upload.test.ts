import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app";
import { getDbPool } from "../src/config/database";
import { env } from "../src/config/env";
import { prisma } from "../src/config/prisma";
import { signAccessToken } from "../src/services/token.service";

describe("Payment Proof Upload API (Step 3)", () => {
  const app = createApp();
  const pool = getDbPool();
  let testOrderId: number | null = null;
  let extraOrderIds: number[] = [];
  const createdFilePaths: string[] = [];

  after(async () => {
    const allOrderIds = [...(testOrderId ? [testOrderId] : []), ...extraOrderIds];
    for (const orderId of allOrderIds) {
      try {
        await pool.execute("DELETE FROM audit_logs WHERE entity_type = 'ORDER' AND entity_id = ?", [String(orderId)]);
        await pool.execute("DELETE FROM payments WHERE order_id = ?", [orderId]);
        await pool.execute("DELETE FROM orders WHERE id = ?", [orderId]);
      } catch (_e) {
        // ignore
      }
    }
    for (const filePath of createdFilePaths) {
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (_e) {
          // ignore
        }
      }
    }
    try {
      await prisma.$disconnect();
    } catch (_e) {}
    try {
      await pool.end();
    } catch (_e) {}
  });

  it("rejects proof upload when unauthenticated", async () => {
    const res = await request(app)
      .post("/api/payments/99999/proof")
      .attach("proof_image", Buffer.from("fake-image"), "receipt.png");

    assert.equal(res.status, 401);
  });

  it("uploads proof image to /api/payments/:orderId/proof and updates payments + orders", async () => {
    // 1. Get an existing user
    const [users]: any = await pool.execute("SELECT id, email FROM users LIMIT 1");
    assert.ok(users.length > 0, "Needs at least one user");
    const user = users[0];

    const token = signAccessToken({
      userId: String(user.id),
      email: user.email,
      role: "CUSTOMER"
    });

    // 2. Create a test order and payment record
    const [orderRes]: any = await pool.execute(
      `INSERT INTO orders (user_id, total_amount, final_amount, status, payment_method, payment_status, shipping_address)
       VALUES (?, 500000, 500000, 'PENDING', 'BANK_TRANSFER', 'AWAITING_ADMIN_CONFIRMATION', 'Test Address')`,
      [user.id]
    );
    testOrderId = orderRes.insertId;

    await pool.execute(
      `INSERT INTO payments (order_id, user_id, provider, payment_method, amount, status)
       VALUES (?, ?, 'BANK_TRANSFER', 'BANK_TRANSFER', 500000, 'PENDING_GATEWAY')`,
      [testOrderId, user.id]
    );

    // 3. Upload a mock image receipt via POST /api/payments/:orderId/proof
    const dummyImageBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    const uploadRes = await request(app)
      .post(`/api/payments/${testOrderId}/proof`)
      .set("Authorization", `Bearer ${token}`)
      .attach("proof_image", dummyImageBuffer, "test_receipt.png");

    assert.equal(uploadRes.status, 200);
    assert.equal(uploadRes.body.success, true);
    assert.ok(uploadRes.body.data.proof_image_url);

    const proofUrl = uploadRes.body.data.proof_image_url;
    assert.ok(proofUrl.startsWith("/uploads/payment-proofs/"));

    // Check that the file was written to disk
    const diskPath = path.resolve(__dirname, "../../..", proofUrl.replace(/^\//, "services/api/"));
    createdFilePaths.push(diskPath);
    assert.ok(fs.existsSync(diskPath), `File should exist on disk at ${diskPath}`);

    // Verify DB update in payments table
    const [paymentRows]: any = await pool.execute(
      "SELECT proof_image_url FROM payments WHERE order_id = ?",
      [testOrderId]
    );
    assert.ok(paymentRows.length > 0);
    assert.equal(paymentRows[0].proof_image_url, proofUrl);

    // Verify DB update in orders table
    const [orderRows]: any = await pool.execute(
      "SELECT payment_proof, payment_status FROM orders WHERE id = ?",
      [testOrderId]
    );
    assert.ok(orderRows.length > 0);
    assert.equal(orderRows[0].payment_proof, proofUrl);
    assert.equal(orderRows[0].payment_status, "AWAITING_ADMIN_CONFIRMATION");
  });

  it("enforces IDOR ownership, BANK_TRANSFER method, Multer 400 validation, approval sync & mock guards", async () => {
    assert.ok(testOrderId, "Requires testOrderId from previous test");
    const [orderOwnerRows]: any = await pool.execute(
      "SELECT o.user_id, u.email FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?",
      [testOrderId]
    );
    const owner = orderOwnerRows[0];
    const ownerToken = signAccessToken({
      userId: String(owner.user_id),
      email: owner.email,
      role: "CUSTOMER"
    });
    const otherCustomerToken = signAccessToken({
      userId: String(Number(owner.user_id) + 999999),
      email: "attacker@example.com",
      role: "CUSTOMER"
    });
    const adminToken = signAccessToken({
      userId: String(owner.user_id),
      email: owner.email,
      role: "ADMIN"
    });

    const dummyPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    // 1. IDOR check: another customer uploading proof to /api/payments/:orderId/proof -> 403
    const idorRes = await request(app)
      .post(`/api/payments/${testOrderId}/proof`)
      .set("Authorization", `Bearer ${otherCustomerToken}`)
      .attach("proof_image", dummyPng, "stolen.png");
    assert.equal(idorRes.status, 403);

    // 2. Non-BANK_TRANSFER (COD) order -> 400
    const [codRes]: any = await pool.execute(
      `INSERT INTO orders (user_id, total_amount, final_amount, status, payment_method, payment_status, shipping_address)
       VALUES (?, 300000, 300000, 'PENDING', 'COD', 'UNPAID', 'COD Test Address')`,
      [owner.user_id]
    );
    const codOrderId = codRes.insertId;
    extraOrderIds.push(codOrderId);

    const codUploadRes = await request(app)
      .post(`/api/payments/${codOrderId}/proof`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .attach("proof_image", dummyPng, "cod.png");
    assert.equal(codUploadRes.status, 400);

    // 3. Invalid MIME type returns HTTP 400 (never 500) on both endpoints
    const badMimePayments = await request(app)
      .post(`/api/payments/${testOrderId}/proof`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .attach("proof_image", Buffer.from("not an image"), { filename: "notes.txt", contentType: "text/plain" });
    assert.equal(badMimePayments.status, 400);

    const badMimeOrders = await request(app)
      .post(`/api/orders/${testOrderId}/payment-proof`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .attach("paymentProof", Buffer.from("not an image"), { filename: "notes.txt", contentType: "text/plain" });
    assert.equal(badMimeOrders.status, 400);

    // 4. Upload via POST /api/orders/:id/payment-proof (single field paymentProof)
    const orderUploadRes = await request(app)
      .post(`/api/orders/${testOrderId}/payment-proof`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .attach("paymentProof", dummyPng, "order_receipt.png");
    assert.equal(orderUploadRes.status, 200);
    const secondProofUrl = orderUploadRes.body.data.paymentProof;
    assert.ok(secondProofUrl.startsWith("/uploads/payment-proofs/"));
    createdFilePaths.push(path.resolve(__dirname, "../../..", secondProofUrl.replace(/^\//, "services/api/")));

    // 5. Reject proof with rejectionReason -> syncs orders + payments + audit_logs
    const rejectRes = await request(app)
      .patch(`/api/orders/${testOrderId}/payment-proof/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ approved: false, rejectionReason: "Ảnh mờ không thấy mã giao dịch" });
    assert.equal(rejectRes.status, 200);

    const [rejectedOrders]: any = await pool.execute("SELECT status, payment_status FROM orders WHERE id = ?", [testOrderId]);
    assert.equal(rejectedOrders[0].status, "PENDING");
    assert.equal(rejectedOrders[0].payment_status, "REJECTED");

    const [rejectedPayments]: any = await pool.execute("SELECT id, status, note FROM payments WHERE order_id = ?", [testOrderId]);
    assert.equal(rejectedPayments[0].status, "REJECTED");
    assert.equal(rejectedPayments[0].note, "Ảnh mờ không thấy mã giao dịch");
    const paymentId = rejectedPayments[0].id;

    // 6. Legacy /api/payments/:paymentId/confirm & /callback blocked with 403 when mock mode disabled outside test
    const origMock = env.paymentMockMode;
    const origNode = env.nodeEnv;
    const origTmn = process.env.VNPAY_TMN_CODE;
    const origSec = process.env.VNPAY_HASH_SECRET;
    try {
      env.paymentMockMode = false;
      (env as any).nodeEnv = "development";
      process.env.VNPAY_TMN_CODE = process.env.VNPAY_TMN_CODE || "CI_TEST_TMN";
      process.env.VNPAY_HASH_SECRET = process.env.VNPAY_HASH_SECRET || "ci_test_vnpay_secret_1234567890";

      const confirmBlocked = await request(app)
        .post(`/api/payments/${paymentId}/confirm`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ status: "PAID" });
      assert.equal(confirmBlocked.status, 403);

      const callbackBlocked = await request(app)
        .get(`/api/payments/${paymentId}/callback?result=PAID`);
      assert.equal(callbackBlocked.status, 403);
    } finally {
      env.paymentMockMode = origMock;
      (env as any).nodeEnv = origNode;
      if (origTmn === undefined) delete process.env.VNPAY_TMN_CODE;
      else process.env.VNPAY_TMN_CODE = origTmn;
      if (origSec === undefined) delete process.env.VNPAY_HASH_SECRET;
      else process.env.VNPAY_HASH_SECRET = origSec;
    }

    // 7. Approve proof -> syncs orders (PAID / PROCESSING) + payments (PAID / VIETQR-APPROVED-*) + audit_logs
    const approveRes = await request(app)
      .patch(`/api/orders/${testOrderId}/payment-proof/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ approved: true });
    assert.equal(approveRes.status, 200);

    const [approvedOrders]: any = await pool.execute("SELECT status, payment_status FROM orders WHERE id = ?", [testOrderId]);
    assert.equal(approvedOrders[0].status, "PROCESSING");
    assert.equal(approvedOrders[0].payment_status, "PAID");

    const [approvedPayments]: any = await pool.execute("SELECT status, transaction_code FROM payments WHERE order_id = ?", [testOrderId]);
    assert.equal(approvedPayments[0].status, "PAID");
    assert.ok(String(approvedPayments[0].transaction_code || "").startsWith("VIETQR-APPROVED-"));

    const [auditRows]: any = await pool.execute(
      "SELECT action FROM audit_logs WHERE entity_type = 'ORDER' AND entity_id = ? ORDER BY id ASC",
      [String(testOrderId)]
    );
    const actions = auditRows.map((r: any) => r.action);
    assert.ok(actions.includes("PAYMENT_PROOF_REJECTED"), `Expected PAYMENT_PROOF_REJECTED in ${JSON.stringify(actions)}`);
    assert.ok(actions.includes("PAYMENT_PROOF_APPROVED"), `Expected PAYMENT_PROOF_APPROVED in ${JSON.stringify(actions)}`);

    // 8. Canceled BANK_TRANSFER order cannot be approved/rejected (400)
    const [canceledRes]: any = await pool.execute(
      `INSERT INTO orders (user_id, total_amount, final_amount, status, payment_method, payment_status, shipping_address)
       VALUES (?, 400000, 400000, 'CANCELED', 'BANK_TRANSFER', 'EXPIRED', 'Canceled Test Address')`,
      [owner.user_id]
    );
    const canceledOrderId = canceledRes.insertId;
    extraOrderIds.push(canceledOrderId);

    const approveCanceledRes = await request(app)
      .patch(`/api/orders/${canceledOrderId}/payment-proof/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ approved: true });
    assert.equal(approveCanceledRes.status, 400);
  });
});
