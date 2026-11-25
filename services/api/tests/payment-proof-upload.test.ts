import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";
import request from "supertest";

import { createApp } from "../src/app";
import { getDbPool } from "../src/config/database";
import { prisma } from "../src/config/prisma";
import { signAccessToken } from "../src/services/token.service";

describe("Payment Proof Upload API (Step 3)", () => {
  const app = createApp();
  const pool = getDbPool();
  let testOrderId: number | null = null;
  let createdFilePath: string | null = null;

  after(async () => {
    // Clean up created test order and payments
    if (testOrderId) {
      try {
        await pool.execute("DELETE FROM payments WHERE order_id = ?", [testOrderId]);
        await pool.execute("DELETE FROM orders WHERE id = ?", [testOrderId]);
      } catch (_e) {
        // ignore
      }
    }
    // Clean up uploaded file if any
    if (createdFilePath && fs.existsSync(createdFilePath)) {
      try {
        fs.unlinkSync(createdFilePath);
      } catch (_e) {
        // ignore
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
    createdFilePath = diskPath;
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
});
