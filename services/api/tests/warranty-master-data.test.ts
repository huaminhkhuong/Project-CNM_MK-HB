import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { getDbPool } from "../src/config/database";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  getWarrantyMonthsFromItem,
  createWarrantyRecordsForDeliveredOrder
} = require("../src/modules/warranties/warranty-sync.service");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const warrantiesService = require("../src/modules/warranties/warranties.service");

describe("Warranty Master Data Resolution & Sync Engine", () => {
  after(async () => {
    try {
      await getDbPool().end();
    } catch (_err) {
      // ignore
    }
  });
  it("resolves warranty months accurately according to master data priority hierarchy", () => {
    // 1. SKU master data takes highest precedence
    const skuOverride = getWarrantyMonthsFromItem({
      skuWarrantyMonths: 12,
      productWarrantyMonths: 36,
      productName: "Intel Core i7-14700K Tray",
      categoryName: "CPU"
    });
    assert.strictEqual(skuOverride, 12, "SKU warranty (12m) must override Product warranty (36m)");

    // 2. Product master data is used when SKU warranty is null
    const productMaster = getWarrantyMonthsFromItem({
      skuWarrantyMonths: null,
      productWarrantyMonths: 120,
      productName: "Nguồn Corsair RM850e 850W 80 Plus Gold",
      categoryName: "Nguồn máy tính (PSU)"
    });
    assert.strictEqual(productMaster, 120, "High-end PSU with master data 120m must resolve to 120 months (10 years)");

    // 3. Samsung SSD Pro with master data 60m
    const ssdMaster = getWarrantyMonthsFromItem({
      skuWarrantyMonths: null,
      productWarrantyMonths: 60,
      productName: "Ổ cứng SSD Samsung 980 PRO 1TB PCIe Gen 4.0",
      categoryName: "Ổ cứng SSD"
    });
    assert.strictEqual(ssdMaster, 60, "Samsung 980 Pro with master data 60m must resolve to 60 months (5 years)");

    // 4. Default fallback when no master data is present
    const fallbackItem = getWarrantyMonthsFromItem({
      skuWarrantyMonths: null,
      productWarrantyMonths: null,
      productName: "Bàn phím cơ Custom",
      categoryName: "Phụ kiện"
    });
    assert.strictEqual(fallbackItem, 24, "Default fallback must be 24 months");
  });

  it("creates accurate warranty records with master data durations upon delivered order", async () => {
    const pool = getDbPool();

    // 1. Create a test user & address
    const [roles]: any = await pool.execute("SELECT id FROM roles WHERE name = 'CUSTOMER' LIMIT 1");
    const roleId = roles?.[0]?.id || 1;
    const uniqueEmail = `test_warranty_${Date.now()}@example.com`;
    const [userRes]: any = await pool.execute(
      "INSERT INTO users (email, password, full_name, role_id, status) VALUES (?, 'hash', 'Warranty Tester', ?, 'ACTIVE')",
      [uniqueEmail, roleId]
    );
    const testUserId = userRes.insertId;

    const [addrRes]: any = await pool.execute(
      "INSERT INTO addresses (user_id, full_name, phone, address_line, ward, district, province) VALUES (?, 'Tester', '0900000000', '123 St', 'W', 'D', 'P')",
      [testUserId]
    );
    const addressId = addrRes.insertId;

    // 2. Ensure test product & skus with distinct warranty master data
    // Product A: Corsair RM850e (120 months master data)
    const [prodARes]: any = await pool.execute(
      `INSERT INTO products (category_id, brand_id, name, slug, description, warranty_months, status)
       VALUES (
         (SELECT id FROM categories LIMIT 1),
         (SELECT id FROM brands LIMIT 1),
         'Test PSU Corsair RM850e',
         'test-psu-corsair-${Date.now()}',
         'High end PSU 10 year warranty',
         120,
         'ACTIVE'
       )`
    );
    const prodAId = prodARes.insertId;

    const [skuARes]: any = await pool.execute(
      `INSERT INTO product_skus (product_id, sku, price, stock, is_active, warranty_months)
       VALUES (?, 'TEST-PSU-120M', 3500000, 10, 1, NULL)`,
      [prodAId]
    );
    const skuAId = skuARes.insertId;

    // Product B: Intel CPU Box (36m) with Tray SKU (12m override)
    const [prodBRes]: any = await pool.execute(
      `INSERT INTO products (category_id, brand_id, name, slug, description, warranty_months, status)
       VALUES (
         (SELECT id FROM categories LIMIT 1),
         (SELECT id FROM brands LIMIT 1),
         'Test Intel CPU Core i7',
         'test-intel-cpu-${Date.now()}',
         'Intel Core CPU 36m warranty',
         36,
         'ACTIVE'
       )`
    );
    const prodBId = prodBRes.insertId;

    const [skuBRes]: any = await pool.execute(
      `INSERT INTO product_skus (product_id, sku, price, stock, is_active, warranty_months)
       VALUES (?, 'TEST-CPU-TRAY-12M', 7500000, 10, 1, 12)`,
      [prodBId]
    );
    const skuBId = skuBRes.insertId;

    // 3. Create an order with these 2 items
    const [orderRes]: any = await pool.execute(
      `INSERT INTO orders (user_id, address_id, status, payment_status, total_amount, shipping_fee)
       VALUES (?, ?, 'DELIVERED', 'PAID', 11000000, 0)`,
      [testUserId, addressId]
    );
    const orderId = orderRes.insertId;

    const [itemARes]: any = await pool.execute(
      `INSERT INTO order_items (order_id, product_variant_id, product_id, sku_snapshot, name_snapshot, quantity, unit_price, line_total)
       VALUES (?, ?, ?, 'TEST-PSU-120M', 'Test PSU Corsair RM850e', 1, 3500000, 3500000)`,
      [orderId, skuAId, prodAId]
    );
    const itemAId = itemARes.insertId;

    const [itemBRes]: any = await pool.execute(
      `INSERT INTO order_items (order_id, product_variant_id, product_id, sku_snapshot, name_snapshot, quantity, unit_price, line_total)
       VALUES (?, ?, ?, 'TEST-CPU-TRAY-12M', 'Test Intel CPU Core i7', 1, 7500000, 7500000)`,
      [orderId, skuBId, prodBId]
    );
    const itemBId = itemBRes.insertId;

    try {
      // 4. Trigger warranty creation engine for delivered order
      const syncResult = await createWarrantyRecordsForDeliveredOrder(orderId);
      assert.strictEqual(syncResult.length, 2, "Must create 2 warranty records for 2 order items");

      // 5. Verify records created in database
      const [warranties]: any = await pool.execute(
        `SELECT w.id, w.sku_id, w.warranty_code, w.status, w.activated_at, w.expires_at,
                TIMESTAMPDIFF(MONTH, w.activated_at, w.expires_at) AS diff_months
         FROM warranties w
         WHERE w.order_id = ?
         ORDER BY w.sku_id ASC`,
        [orderId]
      );

      assert.strictEqual(warranties.length, 2, "Should find 2 warranties in DB");

      const warrantyA = warranties.find((w: any) => Number(w.sku_id) === Number(skuAId));
      const warrantyB = warranties.find((w: any) => Number(w.sku_id) === Number(skuBId));

      assert.ok(warrantyA, "Warranty A for PSU must exist");
      assert.ok(warrantyB, "Warranty B for Tray CPU must exist");

      // Seasonic/Corsair RM PSU: 120 months (10 years)
      assert.strictEqual(Number(warrantyA.diff_months), 120, "PSU warranty must be exactly 120 months (10 years)");

      // Tray CPU SKU override: 12 months (1 year)
      assert.strictEqual(Number(warrantyB.diff_months), 12, "Tray CPU SKU warranty must be exactly 12 months override");

      // 6. Test getMyWarranties service
      const myWarranties = await warrantiesService.getMyWarranties(testUserId);
      assert.strictEqual(myWarranties.length, 2, "Should return 2 warranties for the test user");

      const myWarrA = myWarranties.find((w: any) => Number(w.skuId) === Number(skuAId));
      assert.ok(myWarrA, "User warranty for PSU exists");
      assert.ok(myWarrA.expiresAt, "User warranty has expiresAt");
    } finally {
      // Cleanup test data
      await pool.execute("DELETE FROM warranties WHERE order_id = ?", [orderId]);
      await pool.execute("DELETE FROM warranty_notifications WHERE user_id = ?", [testUserId]);
      await pool.execute("DELETE FROM order_items WHERE order_id = ?", [orderId]);
      await pool.execute("DELETE FROM orders WHERE id = ?", [orderId]);
      await pool.execute("DELETE FROM product_skus WHERE id IN (?, ?)", [skuAId, skuBId]);
      await pool.execute("DELETE FROM products WHERE id IN (?, ?)", [prodAId, prodBId]);
      await pool.execute("DELETE FROM addresses WHERE id = ?", [addressId]);
      await pool.execute("DELETE FROM users WHERE id = ?", [testUserId]);
    }
  });

  it("applies master data warranty duration when manually activating eligible order item", async () => {
    const pool = getDbPool();

    // 1. Create user and address
    const [roles]: any = await pool.execute("SELECT id FROM roles WHERE name = 'CUSTOMER' LIMIT 1");
    const roleId = roles?.[0]?.id || 1;
    const uniqueEmail = `test_manual_warr_${Date.now()}@example.com`;
    const [userRes]: any = await pool.execute(
      "INSERT INTO users (email, password, full_name, role_id, status) VALUES (?, 'hash', 'Manual Warranty Tester', ?, 'ACTIVE')",
      [uniqueEmail, roleId]
    );
    const testUserId = userRes.insertId;

    const [addrRes]: any = await pool.execute(
      "INSERT INTO addresses (user_id, full_name, phone, address_line, ward, district, province) VALUES (?, 'Tester', '0900000000', '123 St', 'W', 'D', 'P')",
      [testUserId]
    );
    const addressId = addrRes.insertId;

    // 2. Create product: Samsung 980 Pro (60 months)
    const [prodRes]: any = await pool.execute(
      `INSERT INTO products (category_id, brand_id, name, slug, description, warranty_months, status)
       VALUES (
         (SELECT id FROM categories LIMIT 1),
         (SELECT id FROM brands LIMIT 1),
         'Test SSD Samsung 980 PRO 1TB',
         'test-ssd-samsung-${Date.now()}',
         'High end NVMe SSD 5 year warranty',
         60,
         'ACTIVE'
       )`
    );
    const prodId = prodRes.insertId;

    const [skuRes]: any = await pool.execute(
      `INSERT INTO product_skus (product_id, sku, price, stock, is_active, warranty_months)
       VALUES (?, 'TEST-SSD-980PRO-60M', 2800000, 10, 1, NULL)`,
      [prodId]
    );
    const skuId = skuRes.insertId;

    // 3. Create completed order with this item
    const [orderRes]: any = await pool.execute(
      `INSERT INTO orders (user_id, address_id, status, payment_status, total_amount, shipping_fee)
       VALUES (?, ?, 'DELIVERED', 'PAID', 2800000, 0)`,
      [testUserId, addressId]
    );
    const orderId = orderRes.insertId;

    const [itemRes]: any = await pool.execute(
      `INSERT INTO order_items (order_id, product_variant_id, product_id, sku_snapshot, name_snapshot, quantity, unit_price, line_total)
       VALUES (?, ?, ?, 'TEST-SSD-980PRO-60M', 'Test SSD Samsung 980 PRO 1TB', 1, 2800000, 2800000)`,
      [orderId, skuId, prodId]
    );
    const itemId = itemRes.insertId;

    try {
      // 4. Manually activate warranty
      const activated = await warrantiesService.activateWarranty(testUserId, {
        orderItemId: itemId,
        note: "Manual customer activation"
      });
      assert.ok(activated, "Warranty activation should succeed");

      // 5. Verify duration in DB
      const [warranties]: any = await pool.execute(
        `SELECT w.id, w.sku_id, w.activated_at, w.expires_at,
                TIMESTAMPDIFF(MONTH, w.activated_at, w.expires_at) AS diff_months
         FROM warranties w
         WHERE w.order_item_id = ?`,
        [itemId]
      );
      assert.strictEqual(warranties.length, 1, "Must find 1 activated warranty");
      assert.strictEqual(Number(warranties[0].diff_months), 60, "Samsung 980 Pro warranty must be 60 months (5 years)");
    } finally {
      // Cleanup
      await pool.execute("DELETE FROM warranties WHERE order_id = ?", [orderId]);
      await pool.execute("DELETE FROM warranty_notifications WHERE user_id = ?", [testUserId]);
      await pool.execute("DELETE FROM order_items WHERE order_id = ?", [orderId]);
      await pool.execute("DELETE FROM orders WHERE id = ?", [orderId]);
      await pool.execute("DELETE FROM product_skus WHERE id = ?", [skuId]);
      await pool.execute("DELETE FROM products WHERE id = ?", [prodId]);
      await pool.execute("DELETE FROM addresses WHERE id = ?", [addressId]);
      await pool.execute("DELETE FROM users WHERE id = ?", [testUserId]);
    }
  });

  it("processes warranty RMA requests, notifications, and events with clean DML and zero runtime DDL", async () => {
    const pool = getDbPool();

    // 1. Create user
    const uniqueEmail = `test_rma_ddl_${Date.now()}@example.com`;
    const [userRes]: any = await pool.execute(
      "INSERT INTO users (email, password, full_name, status) VALUES (?, 'hash', 'RMA DDL Tester', 'ACTIVE')",
      [uniqueEmail]
    );
    const testUserId = userRes.insertId;

    // 2. Direct DML insert into warranty_requests (verifying table structure works without any runtime DDL)
    const [reqRes]: any = await pool.execute(
      `INSERT INTO warranty_requests 
        (user_id, lookup_value, customer_name, customer_phone, customer_email, product_name, severity, issue_description, status)
       VALUES (?, 'BH-TEST-999', 'RMA Tester', '0901234567', ?, 'VGA RTX 4090', 'HIGH', 'Không lên nguồn', 'RECEIVED')`,
      [testUserId, uniqueEmail]
    );
    const requestId = reqRes.insertId;
    assert.ok(requestId > 0, "Warranty request record must be created");

    // 3. Insert notification and event
    await pool.execute(
      `INSERT INTO warranty_notifications (user_id, request_id, title, message, is_read)
       VALUES (?, ?, 'Tiếp nhận bảo hành', 'Yêu cầu của bạn đã được tiếp nhận', 0)`,
      [testUserId, requestId]
    );

    await pool.execute(
      `INSERT INTO warranty_request_events (request_id, status, note, actor_role, actor_name)
       VALUES (?, 'RECEIVED', 'Nhận thiết bị tại quầy', 'TECH_STAFF', 'Tech Guy')`,
      [requestId]
    );

    // 4. Query via DML
    const [requests]: any = await pool.execute(
      "SELECT id, status, customer_name, product_name FROM warranty_requests WHERE id = ?",
      [requestId]
    );
    assert.strictEqual(requests.length, 1);
    assert.strictEqual(requests[0].status, "RECEIVED");
    assert.strictEqual(requests[0].product_name, "VGA RTX 4090");

    const [events]: any = await pool.execute(
      "SELECT id, status, note, actor_name FROM warranty_request_events WHERE request_id = ?",
      [requestId]
    );
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].actor_name, "Tech Guy");

    const [notifs]: any = await pool.execute(
      "SELECT id, title, is_read FROM warranty_notifications WHERE request_id = ?",
      [requestId]
    );
    assert.strictEqual(notifs.length, 1);
    assert.strictEqual(notifs[0].title, "Tiếp nhận bảo hành");

    // Cleanup
    await pool.execute("DELETE FROM warranty_notifications WHERE user_id = ?", [testUserId]);
    await pool.execute("DELETE FROM warranty_request_events WHERE request_id = ?", [requestId]);
    await pool.execute("DELETE FROM warranty_requests WHERE id = ?", [requestId]);
    await pool.execute("DELETE FROM users WHERE id = ?", [testUserId]);
  });
});
