import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { getDbPool } from "../src/config/database";
import { ROLES } from "../src/utils/role-helpers";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ordersService = require("../src/modules/orders/orders.service");

describe("Order Cancellation Stock Restoration (Inventory Leak Fix)", () => {
  after(async () => {
    try {
      await getDbPool().end();
    } catch (_err) {
      // ignore
    }
  });
  it("restores product SKU stock atomically when customer cancels PENDING order", async () => {
    const pool = getDbPool();

    const [users]: any = await pool.execute("SELECT id FROM users WHERE email NOT LIKE 'test_%' ORDER BY id ASC LIMIT 1");
    if (!users.length) return;
    const userId = users[0].id;

    const [skus]: any = await pool.execute(
      "SELECT id, sku, stock FROM product_skus WHERE is_active = 1 AND stock >= 5 LIMIT 1"
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
        "INSERT INTO addresses (user_id, full_name, phone, address_line, ward, district, province) VALUES (?, 'Test', '0901', 'Street', 'W', 'D', 'P')",
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

    // Prepare cart with 2 units
    await pool.execute("DELETE FROM cart_items WHERE cart_id = ?", [cartId]);
    await pool.execute("INSERT INTO cart_items (cart_id, product_variant_id, quantity) VALUES (?, ?, 2)", [cartId, sku.id]);

    // Create order
    const order = await ordersService.createOrderFromCart(userId, { addressId, paymentMethod: "COD" });
    const [skuAfterOrder]: any = await pool.execute("SELECT stock FROM product_skus WHERE id = ?", [sku.id]);
    assert.equal(Number(skuAfterOrder[0].stock), initialStock - 2);

    // Cancel order as customer
    const canceledOrder = await ordersService.cancelOrder(userId, order.id);
    assert.equal(canceledOrder.status, "CANCELED");

    const [skuAfterCancel]: any = await pool.execute("SELECT stock FROM product_skus WHERE id = ?", [sku.id]);
    assert.equal(Number(skuAfterCancel[0].stock), initialStock);

    // Idempotency: second cancel attempt must fail and not increment stock
    await assert.rejects(
      async () => {
        await ordersService.cancelOrder(userId, order.id);
      },
      /Only pending orders can be canceled|Order was already updated/
    );

    const [skuAfterDoubleCancel]: any = await pool.execute("SELECT stock FROM product_skus WHERE id = ?", [sku.id]);
    assert.equal(Number(skuAfterDoubleCancel[0].stock), initialStock);
  });

  it("restores product SKU stock when staff cancels PROCESSING order", async () => {
    const pool = getDbPool();

    const [users]: any = await pool.execute("SELECT id FROM users WHERE email NOT LIKE 'test_%' ORDER BY id ASC LIMIT 1");
    if (!users.length) return;
    const userId = users[0].id;

    const [skus]: any = await pool.execute(
      "SELECT id, sku, stock FROM product_skus WHERE is_active = 1 AND stock >= 5 LIMIT 1"
    );
    if (!skus.length) return;
    const sku = skus[0];
    const initialStock = Number(sku.stock);

    const [addresses]: any = await pool.execute("SELECT id FROM addresses WHERE user_id = ? LIMIT 1", [userId]);
    const addressId = addresses[0].id;

    const [carts]: any = await pool.execute("SELECT id FROM carts WHERE user_id = ? LIMIT 1", [userId]);
    const cartId = carts[0].id;

    await pool.execute("DELETE FROM cart_items WHERE cart_id = ?", [cartId]);
    await pool.execute("INSERT INTO cart_items (cart_id, product_variant_id, quantity) VALUES (?, ?, 1)", [cartId, sku.id]);

    const order = await ordersService.createOrderFromCart(userId, { addressId, paymentMethod: "COD" });
    const [skuAfterOrder]: any = await pool.execute("SELECT stock FROM product_skus WHERE id = ?", [sku.id]);
    assert.equal(Number(skuAfterOrder[0].stock), initialStock - 1);

    const staffActor = { id: 9999, role: ROLES.ADMIN };

    // Move to PROCESSING
    await ordersService.updateOrderStatus(staffActor, order.id, { status: "PROCESSING" });

    // Cancel from PROCESSING
    const canceled = await ordersService.updateOrderStatus(staffActor, order.id, {
      status: "CANCELED",
      reason: "Staff cancel test"
    });
    assert.equal(canceled.status, "CANCELED");

    const [skuAfterStaffCancel]: any = await pool.execute("SELECT stock FROM product_skus WHERE id = ?", [sku.id]);
    assert.equal(Number(skuAfterStaffCancel[0].stock), initialStock);
  });

  it("automatically cancels unpaid online orders exceeding 30 minutes and restores inventory atomically", async () => {
    const pool = getDbPool();

    const [users]: any = await pool.execute("SELECT id FROM users WHERE email NOT LIKE 'test_%' ORDER BY id ASC LIMIT 1");
    if (!users.length) return;
    const userId = users[0].id;

    // Pre-sweep to clear any abandoned orders left by previous interrupted tests
    await ordersService.cancelExpiredPendingOrders({ timeoutMinutes: 1 });

    const [skus]: any = await pool.execute(
      "SELECT id, sku, stock FROM product_skus WHERE is_active = 1 AND stock >= 5 LIMIT 1"
    );
    if (!skus.length) return;
    const sku = skus[0];
    const initialStock = Number(sku.stock);

    const [addresses]: any = await pool.execute("SELECT id FROM addresses WHERE user_id = ? LIMIT 1", [userId]);
    const addressId = addresses[0].id;

    const [carts]: any = await pool.execute("SELECT id FROM carts WHERE user_id = ? LIMIT 1", [userId]);
    const cartId = carts[0].id;

    await pool.execute("DELETE FROM cart_items WHERE cart_id = ?", [cartId]);
    await pool.execute("INSERT INTO cart_items (cart_id, product_variant_id, quantity) VALUES (?, ?, 2)", [cartId, sku.id]);

    // 1. Order abandoned > 30 minutes
    const expiredOrder = await ordersService.createOrderFromCart(userId, { addressId, paymentMethod: "VNPAY" });
    const [skuAfterExpiredOrder]: any = await pool.execute("SELECT stock FROM product_skus WHERE id = ?", [sku.id]);
    assert.equal(Number(skuAfterExpiredOrder[0].stock), initialStock - 2);

    await pool.execute(
      "UPDATE orders SET created_at = (NOW() - INTERVAL 35 MINUTE), updated_at = (NOW() - INTERVAL 35 MINUTE) WHERE id = ?",
      [expiredOrder.id]
    );

    // 2. Fresh order < 30 minutes (10 minutes)
    await pool.execute("INSERT INTO cart_items (cart_id, product_variant_id, quantity) VALUES (?, ?, 1)", [cartId, sku.id]);
    const freshOrder = await ordersService.createOrderFromCart(userId, { addressId, paymentMethod: "MOMO" });
    await pool.execute(
      "UPDATE orders SET created_at = (NOW() - INTERVAL 10 MINUTE), updated_at = (NOW() - INTERVAL 10 MINUTE) WHERE id = ?",
      [freshOrder.id]
    );

    try {
      // Execute sweep with default 30 minutes threshold
      const sweepResult = await ordersService.cancelExpiredPendingOrders();
      assert.ok(sweepResult.success);
      assert.ok(sweepResult.orderIds.includes(expiredOrder.id), "Expired order (>30m) must be canceled");
      assert.ok(!sweepResult.orderIds.includes(freshOrder.id), "Fresh order (<30m) must not be canceled");

      // Verify expired order is CANCELED and paymentStatus is EXPIRED
      const [orderRow]: any = await pool.execute("SELECT status, payment_status FROM orders WHERE id = ?", [expiredOrder.id]);
      assert.equal(orderRow[0].status, "CANCELED");
      assert.equal(orderRow[0].payment_status, "EXPIRED");

      // Verify stock was restored for expired order (+2) while fresh order still holds its 1 unit
      const [skuAfterSweep]: any = await pool.execute("SELECT stock FROM product_skus WHERE id = ?", [sku.id]);
      assert.equal(Number(skuAfterSweep[0].stock), initialStock - 1);
    } finally {
      // Cleanup fresh order to avoid leaking stock
      await pool.execute("UPDATE product_skus SET stock = stock + 1 WHERE id = ?", [sku.id]).catch(() => {});
      await pool.execute("DELETE FROM orders WHERE id = ?", [freshOrder.id]).catch(() => {});
      await pool.execute("DELETE FROM orders WHERE id = ?", [expiredOrder.id]).catch(() => {});
    }
  });
});
