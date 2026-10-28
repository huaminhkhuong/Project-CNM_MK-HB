import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { getDbPool } from "../src/config/database";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ordersService = require("../src/modules/orders/orders.service");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const warrantiesService = require("../src/modules/warranties/warranties.service");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createWarrantyRecordsForDeliveredOrder } = require("../src/modules/warranties/warranty-sync.service");

describe("Product SKUs / Variants Architecture Consolidation", () => {
  after(async () => {
    try {
      await getDbPool().end();
    } catch (_err) {
      // ignore
    }
  });
  it("enforces product_skus as the canonical table and ensures foreign key integrity for order items and warranties", async () => {
    const pool = getDbPool();

    // 1. Verify foreign key constraints exist on order_items and warranties
    const [fkRows]: any = await pool.execute(`
      SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('order_items', 'warranties', 'cart_items')
        AND REFERENCED_TABLE_NAME = 'product_skus'
    `);

    const hasOrderItemFk = fkRows.some((fk: any) => fk.TABLE_NAME === "order_items" && fk.COLUMN_NAME === "product_variant_id");
    const hasCartItemFk = fkRows.some((fk: any) => fk.TABLE_NAME === "cart_items" && fk.COLUMN_NAME === "product_variant_id");
    const hasWarrantyFk = fkRows.some((fk: any) => fk.TABLE_NAME === "warranties" && fk.COLUMN_NAME === "sku_id");

    assert.ok(hasOrderItemFk, "order_items.product_variant_id must reference product_skus.id");
    assert.ok(hasCartItemFk, "cart_items.product_variant_id must reference product_skus.id");
    assert.ok(hasWarrantyFk, "warranties.sku_id must reference product_skus.id");

    // 2. Test Order Creation -> OrderItem -> Warranty Activation Flow
    // Create isolated test user
    const [roles]: any = await pool.execute("SELECT id FROM roles WHERE name = 'CUSTOMER' LIMIT 1");
    const roleId = roles?.[0]?.id || 1;
    const uniqueEmail = `test_schema_unif_${Date.now()}@example.com`;
    const [userRes]: any = await pool.execute(
      "INSERT INTO users (email, password, full_name, role_id, status) VALUES (?, 'hash', 'Schema Tester', ?, 'ACTIVE')",
      [uniqueEmail, roleId]
    );
    const testUserId = userRes.insertId;

    // Create address
    const [addrRes]: any = await pool.execute(
      "INSERT INTO addresses (user_id, full_name, phone, address_line, ward, district, province) VALUES (?, 'Tester', '0900000000', '123 St', 'W', 'D', 'P')",
      [testUserId]
    );
    const addressId = addrRes.insertId;

    // Pick an active SKU from product_skus
    const [skus]: any = await pool.execute(
      "SELECT id, product_id, sku, stock, price FROM product_skus WHERE is_active = 1 AND stock >= 5 ORDER BY id DESC LIMIT 1"
    );
    assert.ok(skus.length > 0, "Must have at least one active product SKU");
    const targetSku = skus[0];
    const initialStock = Number(targetSku.stock);

    // Create cart with 1 unit of targetSku
    const [cartRes]: any = await pool.execute("INSERT INTO carts (user_id) VALUES (?)", [testUserId]);
    const cartId = cartRes.insertId;
    await pool.execute(
      "INSERT INTO cart_items (cart_id, product_variant_id, quantity) VALUES (?, ?, 1)",
      [cartId, targetSku.id]
    );

    // Place order using ordersService
    const order = await ordersService.createOrderFromCart(testUserId, {
      addressId,
      paymentMethod: "COD"
    });

    assert.ok(order && order.id, "Order should be created");

    // Verify stock decremented on product_skus
    const [skuAfterOrder]: any = await pool.execute("SELECT stock FROM product_skus WHERE id = ?", [targetSku.id]);
    assert.equal(Number(skuAfterOrder[0].stock), initialStock - 1, "Stock on product_skus must decrement by 1");

    // Verify order item has correct product_variant_id
    const orderDetail = await ordersService.getOrderDetail({ id: testUserId, role: "CUSTOMER" }, order.id);
    assert.ok(orderDetail.items.length > 0, "Order must have items");
    const orderItem = orderDetail.items[0];
    assert.equal(Number(orderItem.variantId), targetSku.id, "OrderItem variantId must match product_skus.id");
    assert.equal(orderItem.sku, targetSku.sku, "OrderItem sku must match product_skus.sku");

    // Update order status to DELIVERED to activate warranty flow
    await pool.execute("UPDATE orders SET status = 'DELIVERED' WHERE id = ?", [order.id]);

    // Test automatic warranty creation
    const syncedItems = await createWarrantyRecordsForDeliveredOrder(order.id);
    assert.equal(syncedItems.length, 1, "Should create warranty for the delivered item");

    // Verify warranty in database
    const [warranties]: any = await pool.execute("SELECT * FROM warranties WHERE order_id = ?", [order.id]);
    assert.equal(warranties.length, 1, "Warranty record must exist");
    assert.equal(Number(warranties[0].sku_id), targetSku.id, "Warranty sku_id must match targetSku.id");
    assert.equal(Number(warranties[0].order_item_id), orderItem.id, "Warranty order_item_id must match order_item.id");

    // Clean up test data
    await pool.execute("DELETE FROM warranties WHERE order_id = ?", [order.id]);
    await pool.execute("DELETE FROM warranty_notifications WHERE user_id = ?", [testUserId]);
    await pool.execute("DELETE FROM order_items WHERE order_id = ?", [order.id]);
    await pool.execute("DELETE FROM orders WHERE id = ?", [order.id]);
    await pool.execute("DELETE FROM cart_items WHERE cart_id = ?", [cartId]);
    await pool.execute("DELETE FROM carts WHERE id = ?", [cartId]);
    await pool.execute("DELETE FROM addresses WHERE user_id = ?", [testUserId]);
    await pool.execute("DELETE FROM users WHERE id = ?", [testUserId]);

    // Restore stock
    await pool.execute("UPDATE product_skus SET stock = ? WHERE id = ?", [initialStock, targetSku.id]);
  });

  it("verifies product_variants table is eliminated and product_skus is the sole single source of truth", async () => {
    const pool = getDbPool();

    // Verify product_variants table no longer exists in MySQL
    const [tables]: any = await pool.execute("SHOW TABLES LIKE 'product_variants'");
    assert.equal(tables.length, 0, "Redundant table product_variants must be completely dropped");

    // Verify product_skus is intact with all variant records
    const [[cSkus]]: any = await pool.execute("SELECT COUNT(*) as c FROM product_skus");
    assert.ok(cSkus.c > 0, "product_skus must contain all product variants");

    // Verify synchronization triggers are cleaned up
    const [triggers]: any = await pool.execute("SHOW TRIGGERS WHERE `Table` = 'product_skus'");
    const variantTriggers = triggers.filter((t: any) => t.Trigger && t.Trigger.includes("product_variants"));
    assert.equal(variantTriggers.length, 0, "Triggers syncing to product_variants must be removed");
  });
});
