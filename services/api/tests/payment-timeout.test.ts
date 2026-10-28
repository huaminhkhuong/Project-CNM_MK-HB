import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { getDbPool } from "../src/config/database";
import { env } from "../src/config/env";
import { processPaymentTimeouts } from "../src/workers/payment-timeout.worker";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const paymentsService = require("../src/modules/payments/payments.service");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ordersService = require("../src/modules/orders/orders.service");

describe("Payment Flow - Dynamic Callback URLs & Payment Timeout Recovery", () => {
  after(async () => {
    try {
      await getDbPool().end();
    } catch (_err) {
      // ignore
    }
  });
  it("generates dynamic API callback and redirect URLs without hardcoded localhost", async () => {
    const pool = getDbPool();

    // 1. Test URL generation with mock request headers (e.g. reverse proxy / domain)
    const mockReq = {
      protocol: "https",
      get: (header: string) => {
        if (header.toLowerCase() === "host") return "api.pcmall.vn";
        if (header.toLowerCase() === "origin") return "https://pcmall.vn";
        return null;
      }
    };

    // 1. Direct unit test of buildApiCallbackUrl
    const directUrlFromReq = paymentsService.buildApiCallbackUrl(101, "PAID", mockReq);
    assert.equal(directUrlFromReq, "https://api.pcmall.vn/api/payments/101/callback?result=PAID");

    const directUrlFromBase = paymentsService.buildApiCallbackUrl(102, "FAILED", "https://staging.pcmall.vn");
    assert.equal(directUrlFromBase, "https://staging.pcmall.vn/api/payments/102/callback?result=FAILED");

    const directUrlFromEnv = paymentsService.buildApiCallbackUrl(103, "PAID");
    assert.ok(directUrlFromEnv.includes(env.backendUrl || "http://localhost:4000"));

    // 2. End-to-end payment creation test
    const [users]: any = await pool.execute("SELECT id FROM users WHERE email NOT LIKE 'test_%' ORDER BY id ASC LIMIT 1");
    if (!users.length) return;
    const userId = users[0].id;

    // Create a dummy order for payment testing
    const [skus]: any = await pool.execute("SELECT id, sku, price, stock FROM product_skus WHERE is_active = 1 LIMIT 1");
    if (!skus.length) return;
    const sku = skus[0];

    const [orderInsert]: any = await pool.execute(
      `INSERT INTO orders (user_id, total_amount, final_amount, status, payment_status, payment_method, created_at, updated_at)
       VALUES (?, ?, ?, 'PENDING', 'PENDING_GATEWAY', 'VNPAY', NOW(), NOW())`,
      [userId, Number(sku.price || 100000), Number(sku.price || 100000)]
    );
    const orderId = orderInsert.insertId;

    try {
      const payment = await paymentsService.createPayment(userId, { orderId, paymentMethod: "VNPAY" }, mockReq);
      assert.ok(payment, "Payment should be created");
      assert.ok(payment.callbackSuccessUrl.includes("https://api.pcmall.vn/api/payments/"), "Success callback URL must use dynamic host header");
      assert.ok(payment.callbackSuccessUrl.includes("result=PAID"), "Success callback URL must contain result=PAID");
      assert.ok(payment.callbackFailedUrl.includes("https://api.pcmall.vn/api/payments/"), "Failed callback URL must use dynamic host header");
      assert.ok(payment.callbackFailedUrl.includes("result=FAILED"), "Failed callback URL must contain result=FAILED");
      assert.ok(!payment.callbackSuccessUrl.includes("localhost"), "Callback URL must not be hardcoded to localhost when proxy headers exist");
    } finally {
      // Clean up test order & payment
      await pool.execute("DELETE FROM payments WHERE order_id = ?", [orderId]).catch(() => {});
      await pool.execute("DELETE FROM orders WHERE id = ?", [orderId]).catch(() => {});
    }
  });

  it("automatically expires abandoned pending gateway orders and restores locked inventory", async () => {
    const pool = getDbPool();

    let [users]: any = await pool.execute("SELECT id FROM users WHERE email = 'timeout_user_test@pcmall.test' LIMIT 1");
    let userId: number;
    if (users.length > 0) {
      userId = users[0].id;
    } else {
      const [uInsert]: any = await pool.execute(
        "INSERT INTO users (email, full_name, password, role_id) VALUES ('timeout_user_test@pcmall.test', 'Timeout Test', 'hash', 2)"
      );
      userId = uInsert.insertId;
    }

    // Purge any preexisting expired orders to ensure a clean baseline for stock assertions
    await ordersService.cancelExpiredPendingOrders({ timeoutMinutes: 0 });

    const [skus]: any = await pool.execute(
      "SELECT id, sku, price, stock FROM product_skus WHERE is_active = 1 AND stock >= 5 LIMIT 1"
    );
    if (!skus.length) return;
    const sku = skus[0];
    const initialStock = Number(sku.stock);

    let [addresses]: any = await pool.execute("SELECT id FROM addresses WHERE user_id = ? LIMIT 1", [userId]);
    let addressId: number;
    if (addresses.length > 0) {
      addressId = addresses[0].id;
    } else {
      const [addrInsert]: any = await pool.execute(
        "INSERT INTO addresses (user_id, full_name, phone, address_line, ward, district, province) VALUES (?, 'Timeout User', '0988', 'Street', 'W', 'D', 'P')",
        [userId]
      );
      addressId = addrInsert.insertId;
    }

    let [carts]: any = await pool.execute("SELECT id FROM carts WHERE user_id = ? LIMIT 1", [userId]);
    let cartId: number;
    if (carts.length === 0) {
      const [c]: any = await pool.execute("INSERT INTO carts (user_id) VALUES (?)", [userId]);
      cartId = c.insertId;
    } else {
      cartId = carts[0].id;
    }

    // Prepare cart with 3 units of sku
    await pool.execute("DELETE FROM cart_items WHERE cart_id = ?", [cartId]);
    await pool.execute("INSERT INTO cart_items (cart_id, product_variant_id, quantity) VALUES (?, ?, 3)", [cartId, sku.id]);

    // Checkout with VNPAY (simulates customer selecting VNPAY)
    const order = await ordersService.createOrderFromCart(userId, { addressId, paymentMethod: "VNPAY" });
    assert.equal(order.status, "PENDING");
    assert.equal(order.paymentStatus, "PENDING_GATEWAY");

    // Stock was decremented by 3
    const [skuAfterCheckout]: any = await pool.execute("SELECT stock FROM product_skus WHERE id = ?", [sku.id]);
    assert.equal(Number(skuAfterCheckout[0].stock), initialStock - 3);

    // Simulate customer abandoning the payment session 20 minutes ago
    await pool.execute(
      "UPDATE orders SET created_at = (NOW() - INTERVAL 20 MINUTE), updated_at = (NOW() - INTERVAL 20 MINUTE) WHERE id = ?",
      [order.id]
    );

    // Run the payment timeout cleaner
    const cleanupResult = await ordersService.cancelExpiredPendingOrders({ timeoutMinutes: 15 });
    assert.ok(cleanupResult.success);
    assert.ok(cleanupResult.orderIds.includes(order.id), "Expired order ID must be in cleaned up list");

    // Verify order status is CANCELED and payment_status is EXPIRED
    const [orderAfterTimeout]: any = await pool.execute(
      "SELECT status, payment_status, note FROM orders WHERE id = ?",
      [order.id]
    );
    assert.equal(orderAfterTimeout[0].status, "CANCELED");
    assert.equal(orderAfterTimeout[0].payment_status, "EXPIRED");
    assert.ok(orderAfterTimeout[0].note.includes("Quá hạn thanh toán"));

    // Verify stock is atomically and fully restored!
    const [skuAfterRecovery]: any = await pool.execute("SELECT stock FROM product_skus WHERE id = ?", [sku.id]);
    assert.equal(Number(skuAfterRecovery[0].stock), initialStock);

    // Idempotency: Running cleanup again on same order should not restore stock again or re-cancel
    const secondCleanup = await ordersService.cancelExpiredPendingOrders({ timeoutMinutes: 15 });
    assert.ok(!secondCleanup.orderIds.includes(order.id));

    const [skuAfterSecondSweep]: any = await pool.execute("SELECT stock FROM product_skus WHERE id = ?", [sku.id]);
    assert.equal(Number(skuAfterSecondSweep[0].stock), initialStock);
  });

  it("does not cancel orders that are already PAID or within the timeout window", async () => {
    const pool = getDbPool();

    const [users]: any = await pool.execute("SELECT id FROM users WHERE email NOT LIKE 'test_%' ORDER BY id ASC LIMIT 1");
    if (!users.length) return;
    const userId = users[0].id;

    // 1. Order within 5 minutes (fresh order)
    const [freshOrder]: any = await pool.execute(
      `INSERT INTO orders (user_id, total_amount, final_amount, status, payment_status, payment_method, created_at, updated_at)
       VALUES (?, 50000, 50000, 'PENDING', 'PENDING_GATEWAY', 'VNPAY', (NOW() - INTERVAL 5 MINUTE), NOW())`,
      [userId]
    );

    // 2. Already PAID order
    const [paidOrder]: any = await pool.execute(
      `INSERT INTO orders (user_id, total_amount, final_amount, status, payment_status, payment_method, created_at, updated_at)
       VALUES (?, 50000, 50000, 'PROCESSING', 'PAID', 'VNPAY', (NOW() - INTERVAL 40 MINUTE), NOW())`,
      [userId]
    );

    try {
      const result = await processPaymentTimeouts(15);
      const expiredIds = result?.orderIds || [];

      assert.ok(!expiredIds.includes(freshOrder.insertId), "Fresh order (< 15m) must not be canceled");
      assert.ok(!expiredIds.includes(paidOrder.insertId), "Paid order must not be canceled");
    } finally {
      await pool.execute("DELETE FROM orders WHERE id IN (?, ?)", [freshOrder.insertId, paidOrder.insertId]).catch(() => {});
    }
  });
});
