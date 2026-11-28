/**
 * Canonical Database Migration Script
 * Runs all consolidated schema definitions and table migrations independently before application boot.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { getDbPool } = require("../src/config/database");

const DEFAULT_SETTINGS = [
  { key: "store_name", value: "PC Mall", description: "Tên hiển thị của hệ thống" },
  { key: "support_email", value: "support@pcmall.vn", description: "Email hỗ trợ khách hàng" },
  { key: "support_phone", value: "0900000000", description: "Số điện thoại hỗ trợ" },
  { key: "online_payment_mode", value: "sandbox", description: "Chế độ thanh toán online: sandbox/mock/live" },
  { key: "shipping_mode", value: "mock", description: "Chế độ vận chuyển: mock/live" },
  { key: "free_shipping_threshold", value: "5000000", description: "Ngưỡng miễn phí giao hàng (VNĐ)" },
  { key: "default_shipping_fee", value: "30000", description: "Phí giao hàng tiêu chuẩn cho đơn dưới ngưỡng miễn phí (VNĐ)" },
  { key: "maintenance_mode", value: "off", description: "Bật/tắt chế độ bảo trì" },
  { key: "bank_name", value: "Techcombank", description: "Tên ngân hàng nhận chuyển khoản" },
  { key: "bank_account_number", value: "8686868991", description: "Số tài khoản ngân hàng nhận thanh toán" },
  { key: "bank_account_holder", value: "HỨA MINH KHƯƠNG", description: "Tên chủ tài khoản ngân hàng" },
  { key: "store_hotline", value: "1900 8888", description: "Hotline tổng đài tư vấn" },
  { key: "store_tax_id", value: "0316888999", description: "Mã số thuế doanh nghiệp" },
  { key: "store_address", value: "123 Nguyễn Thị Minh Khai, Q.1, TP. Hồ Chí Minh", description: "Địa chỉ trụ sở / Showroom chính" }
];

async function hasTable(connection, tableName) {
  const [rows] = await connection.query(
    `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `,
    [tableName]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function executeSqlFileIfExists(connection, relativeMigrationPath, label) {
  const fullPath = path.join(__dirname, "..", "prisma", "migrations", relativeMigrationPath);
  if (!fs.existsSync(fullPath)) return;

  const sqlContent = fs.readFileSync(fullPath, "utf-8");
  const cleanSql = sqlContent
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "");
  const statements = cleanSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await connection.query(statement);
  }
  console.log(`✅ [Migration] Executed ${label} (${statements.length} statements).`);
}

async function hasColumn(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [tableName, columnName]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function hasIndex(connection, tableName, indexName) {
  const [rows] = await connection.query(
    `
      SELECT INDEX_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `,
    [tableName, indexName]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function hasConstraint(connection, tableName, constraintName) {
  const [rows] = await connection.query(
    `
      SELECT CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND CONSTRAINT_NAME = ?
    `,
    [tableName, constraintName]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function runCanonicalMigrations() {
  console.log("🚀 [Migration] Starting Canonical Database Migration...");
  const pool = getDbPool();
  let connection;
  try {
    connection = await pool.getConnection();
  } catch (err) {
    console.warn(`⚠️ [Migration] Could not connect to MySQL at ${process.env.DB_HOST || "127.0.0.1"}:${process.env.DB_PORT || 3307} (${err.message}).`);
    console.warn("⚠️ [Migration] Skipping schema migration for now. Backend server will start and wait for MySQL.");
    return;
  }

  try {
    // 0. Fresh database bootstrap: if core tables (users/orders/order_items) do not exist yet,
    // push the canonical Prisma schema first so FK-dependent migrations never fail on empty volumes.
    const [hasUsers, hasOrders, hasOrderItems] = await Promise.all([
      hasTable(connection, "users"),
      hasTable(connection, "orders"),
      hasTable(connection, "order_items")
    ]);

    if (!hasUsers || !hasOrders || !hasOrderItems) {
      console.log("📦 [Migration] Fresh/empty database detected. Bootstrapping base schema via Prisma db push...");
      const apiRoot = path.resolve(__dirname, "..");
      const prismaCli = path.join(apiRoot, "node_modules", "prisma", "build", "index.js");
      if (fs.existsSync(prismaCli)) {
        execFileSync(process.execPath, [prismaCli, "db", "push", "--skip-generate"], {
          cwd: apiRoot,
          stdio: "inherit",
          env: process.env
        });
      } else {
        execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], {
          cwd: apiRoot,
          stdio: "inherit",
          env: process.env,
          shell: process.platform === "win32"
        });
      }
      console.log("✅ [Migration] Base Prisma schema bootstrapped successfully.");
    }

    // 1. Execute consolidated DDL from canonical, audit_logs, and warranty_lifecycle migration files
    await executeSqlFileIfExists(
      connection,
      path.join("20261022170000_canonical_schema_consolidation", "migration.sql"),
      "canonical schema consolidation DDL"
    );
    await executeSqlFileIfExists(
      connection,
      path.join("20260601170000_create_audit_logs", "migration.sql"),
      "audit_logs DDL"
    );
    await executeSqlFileIfExists(
      connection,
      path.join("20261021100000_warranty_lifecycle_master_schema", "migration.sql"),
      "warranty_lifecycle master DDL"
    );

    // 2. Ensure orders table columns
    if (!(await hasColumn(connection, "orders", "payment_proof"))) {
      await connection.query("ALTER TABLE orders ADD COLUMN payment_proof VARCHAR(500) NULL");
      console.log("✅ [Migration] Added payment_proof to orders.");
    }
    if (!(await hasColumn(connection, "orders", "payment_status"))) {
      await connection.query("ALTER TABLE orders ADD COLUMN payment_status VARCHAR(50) DEFAULT 'UNPAID'");
      console.log("✅ [Migration] Added payment_status to orders.");
    }
    if (!(await hasColumn(connection, "orders", "coupon_id"))) {
      await connection.query("ALTER TABLE orders ADD COLUMN coupon_id INT NULL");
      console.log("✅ [Migration] Added coupon_id to orders.");
    }
    if (!(await hasColumn(connection, "orders", "coupon_code"))) {
      await connection.query("ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(50) NULL");
      console.log("✅ [Migration] Added coupon_code to orders.");
    }
    if (!(await hasColumn(connection, "orders", "discount_amount"))) {
      await connection.query("ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(12, 2) DEFAULT 0.00");
      console.log("✅ [Migration] Added discount_amount to orders.");
    }

    // 2b. Ensure payments columns support long gateway URLs (VNPay > 500 chars) & proof image URLs
    if (await hasColumn(connection, "payments", "redirect_url")) {
      await connection.query("ALTER TABLE payments MODIFY COLUMN redirect_url TEXT NULL");
    }
    if (!(await hasColumn(connection, "payments", "proof_image_url"))) {
      await connection.query("ALTER TABLE payments ADD COLUMN proof_image_url VARCHAR(500) NULL");
    }
    if (await hasColumn(connection, "orders", "payment_proof")) {
      await connection.query("ALTER TABLE orders MODIFY COLUMN payment_proof VARCHAR(500) NULL");
    }

    // 3. Ensure order_items serial_numbers column
    if (!(await hasColumn(connection, "order_items", "serial_numbers"))) {
      await connection.query("ALTER TABLE order_items ADD COLUMN serial_numbers TEXT NULL");
      console.log("✅ [Migration] Added serial_numbers to order_items.");
    }

    // 4. Ensure warranties serial_number column & index
    if (!(await hasColumn(connection, "warranties", "serial_number"))) {
      await connection.query("ALTER TABLE warranties ADD COLUMN serial_number VARCHAR(100) NULL");
      console.log("✅ [Migration] Added serial_number to warranties.");
    }
    if (!(await hasIndex(connection, "warranties", "idx_warranties_serial"))) {
      await connection.query("ALTER TABLE warranties ADD INDEX idx_warranties_serial (serial_number)");
      console.log("✅ [Migration] Added idx_warranties_serial to warranties.");
    }
    if ((await hasTable(connection, "warranties")) && (await hasTable(connection, "product_skus")) && (await hasColumn(connection, "warranties", "sku_id"))) {
      const [existingSkuFk] = await connection.query(
        `
          SELECT CONSTRAINT_NAME
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'warranties'
            AND COLUMN_NAME = 'sku_id'
            AND REFERENCED_TABLE_NAME = 'product_skus'
        `
      );
      if (!Array.isArray(existingSkuFk) || existingSkuFk.length === 0) {
        await connection.query(
          "UPDATE warranties SET sku_id = NULL WHERE sku_id IS NOT NULL AND sku_id NOT IN (SELECT id FROM product_skus)"
        );
        if (!(await hasIndex(connection, "warranties", "idx_warranties_sku"))) {
          await connection.query("ALTER TABLE warranties ADD INDEX idx_warranties_sku (sku_id)");
        }
        await connection.query(
          "ALTER TABLE warranties ADD CONSTRAINT fk_warranties_sku FOREIGN KEY (sku_id) REFERENCES product_skus(id) ON DELETE SET NULL ON UPDATE RESTRICT"
        );
        console.log("✅ [Migration] Added fk_warranties_sku foreign key to warranties.");
      }
    }

    // 5. Ensure pc_builds columns
    if (!(await hasColumn(connection, "pc_builds", "share_token"))) {
      await connection.query("ALTER TABLE pc_builds ADD COLUMN share_token VARCHAR(36) NULL UNIQUE");
      console.log("✅ [Migration] Added share_token to pc_builds.");
    }
    if (!(await hasColumn(connection, "pc_builds", "is_public"))) {
      await connection.query("ALTER TABLE pc_builds ADD COLUMN is_public TINYINT(1) DEFAULT 0");
      console.log("✅ [Migration] Added is_public to pc_builds.");
    }
    if (!(await hasColumn(connection, "pc_builds", "description"))) {
      await connection.query("ALTER TABLE pc_builds ADD COLUMN description TEXT NULL");
      console.log("✅ [Migration] Added description to pc_builds.");
    }
    if (!(await hasColumn(connection, "pc_builds", "use_case"))) {
      await connection.query("ALTER TABLE pc_builds ADD COLUMN use_case VARCHAR(50) NULL");
      console.log("✅ [Migration] Added use_case to pc_builds.");
    }
    if (!(await hasColumn(connection, "pc_builds", "budget"))) {
      await connection.query("ALTER TABLE pc_builds ADD COLUMN budget DECIMAL(12, 2) DEFAULT 0.00");
      console.log("✅ [Migration] Added budget to pc_builds.");
    }

    // 5b. Ensure pc_build_items quantity column
    if (!(await hasColumn(connection, "pc_build_items", "quantity"))) {
      await connection.query("ALTER TABLE pc_build_items ADD COLUMN quantity INT DEFAULT 1");
      console.log("✅ [Migration] Added quantity to pc_build_items.");
    }

    // 6. Ensure compatibility_rules name column & fix key-only rule edge cases (id=172 GT vs GTE, id=183 null is_compatible)
    if (!(await hasColumn(connection, "compatibility_rules", "name"))) {
      await connection.query("ALTER TABLE compatibility_rules ADD COLUMN name VARCHAR(255) NULL");
      console.log("✅ [Migration] Added name to compatibility_rules.");
    }
    if (await hasTable(connection, "compatibility_rules")) {
      await connection.query(
        `UPDATE compatibility_rules SET operator = 'GT' WHERE source_attribute_key = 'radiator_size' AND target_attribute_key = 'case_radiator_support' AND operator = 'GTE' AND is_compatible = 0`
      );
      await connection.query(
        `UPDATE compatibility_rules SET is_compatible = 1 WHERE source_attribute_key = 'interface' AND target_attribute_key = 'm2_slot' AND is_compatible IS NULL`
      );
      // Deactivate corrupted seeded rules where attribute_value_1/2 contradict actual compatibility
      // (e.g., Micro-ATX vs Micro-ATX/Mini-ITX case or 360mm AIO vs 240mm/360mm radiator case)
      await connection.query(
        `UPDATE compatibility_rules r
         INNER JOIN attribute_values av1 ON av1.id = r.attribute_value_1
         INNER JOIN attribute_values av2 ON av2.id = r.attribute_value_2
         SET r.is_active = 0
         WHERE r.is_compatible = 0
           AND (
             (r.source_category_id = 2 AND r.target_category_id = 7 AND av1.value LIKE '%Micro-ATX%' AND av2.value LIKE '%Micro-ATX%')
             OR (r.source_category_id = 8 AND r.target_category_id = 7 AND av1.value LIKE '%360mm%' AND av2.value LIKE '%360mm%')
           )`
      );
    }

    // 7. Ensure product_reviews table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        user_id INT NOT NULL,
        order_id INT NULL,
        rating TINYINT NOT NULL,
        comment TEXT NULL,
        is_verified_buyer TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_product_reviews_product (product_id),
        KEY idx_product_reviews_user (user_id),
        KEY idx_product_reviews_order (order_id),
        CONSTRAINT fk_product_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        CONSTRAINT fk_product_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_product_reviews_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✅ [Migration] Ensured product_reviews table.");

    // 8. Ensure token_blacklist table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS token_blacklist (
        id INT AUTO_INCREMENT PRIMARY KEY,
        token VARCHAR(500) NOT NULL UNIQUE,
        user_id INT NULL,
        expires_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_token (token),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✅ [Migration] Ensured token_blacklist table.");

    // 8b. Ensure tags and product_tags tables for normalized component tagging
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(64) NOT NULL UNIQUE,
        label VARCHAR(100) NOT NULL,
        group_name VARCHAR(50) NOT NULL DEFAULT 'use_case',
        description VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tags_group (group_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS product_tags (
        product_id INT NOT NULL,
        tag_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (product_id, tag_id),
        INDEX idx_product_tags_tag (tag_id),
        CONSTRAINT fk_product_tags_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        CONSTRAINT fk_product_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✅ [Migration] Ensured tags and product_tags tables.");

    // 8c. Ensure warranty_months column exists on products and product_skus to match schema.prisma
    if (!(await hasColumn(connection, "products", "warranty_months"))) {
      await connection.query(`ALTER TABLE products ADD COLUMN warranty_months INT NULL DEFAULT 24`);
      console.log("✅ [Migration] Added products.warranty_months column.");
    }
    if (!(await hasColumn(connection, "product_skus", "warranty_months"))) {
      await connection.query(`ALTER TABLE product_skus ADD COLUMN warranty_months INT NULL DEFAULT 24`);
      console.log("✅ [Migration] Added product_skus.warranty_months column.");
    }

    // 8d. Widen Product.price & ProductSku.price from DECIMAL(10,2) to DECIMAL(12,2) (support >= 100M VND workstations/GPUs)
    if (await hasColumn(connection, "products", "price")) {
      await connection.query(`ALTER TABLE products MODIFY COLUMN price DECIMAL(12, 2) NULL`);
    }
    if (await hasColumn(connection, "product_skus", "price")) {
      await connection.query(`ALTER TABLE product_skus MODIFY COLUMN price DECIMAL(12, 2) NULL`);
    }

    // 8e. [P2-02] Integrity constraints, unique keys, composite indexes, WarrantyRequest FK alignment & Y2038-safe DATETIME
    // Deduplicate product_reviews (keep newest id per product_id + user_id) before adding unique constraint
    if (await hasTable(connection, "product_reviews")) {
      await connection.query(`
        DELETE pr1 FROM product_reviews pr1
        INNER JOIN product_reviews pr2
          ON pr1.product_id = pr2.product_id
         AND pr1.user_id = pr2.user_id
         AND pr1.id < pr2.id
      `);
      if (!(await hasIndex(connection, "product_reviews", "uq_product_reviews_product_user"))) {
        await connection.query(`ALTER TABLE product_reviews ADD UNIQUE INDEX uq_product_reviews_product_user (product_id, user_id)`);
      }
    }
    if ((await hasTable(connection, "product_skus")) && !(await hasIndex(connection, "product_skus", "uq_product_skus_sku"))) {
      await connection.query(`ALTER TABLE product_skus ADD UNIQUE INDEX uq_product_skus_sku (sku)`);
    }
    if ((await hasTable(connection, "products")) && !(await hasIndex(connection, "products", "uq_products_slug"))) {
      await connection.query(`ALTER TABLE products ADD UNIQUE INDEX uq_products_slug (slug)`);
    }
    if ((await hasTable(connection, "carts")) && !(await hasIndex(connection, "carts", "uq_carts_user_id"))) {
      await connection.query(`ALTER TABLE carts ADD UNIQUE INDEX uq_carts_user_id (user_id)`);
    }
    if ((await hasTable(connection, "cart_items")) && !(await hasIndex(connection, "cart_items", "uq_cart_items_cart_variant"))) {
      await connection.query(`ALTER TABLE cart_items ADD UNIQUE INDEX uq_cart_items_cart_variant (cart_id, product_variant_id)`);
    }
    if ((await hasTable(connection, "sku_attributes")) && !(await hasIndex(connection, "sku_attributes", "uq_sku_attributes_sku_val"))) {
      await connection.query(`ALTER TABLE sku_attributes ADD UNIQUE INDEX uq_sku_attributes_sku_val (sku_id, attribute_value_id)`);
    }
    if ((await hasTable(connection, "orders")) && !(await hasIndex(connection, "orders", "idx_orders_status_payment_created"))) {
      await connection.query(`ALTER TABLE orders ADD INDEX idx_orders_status_payment_created (status, payment_status, created_at)`);
    }
    if (await hasTable(connection, "coupons")) {
      await connection.query(`ALTER TABLE coupons MODIFY COLUMN start_date DATETIME NOT NULL, MODIFY COLUMN end_date DATETIME NOT NULL`);
    }
    if (await hasTable(connection, "warranty_requests")) {
      if (!(await hasIndex(connection, "warranty_requests", "idx_warranty_requests_status_created"))) {
        await connection.query(`ALTER TABLE warranty_requests ADD INDEX idx_warranty_requests_status_created (status, created_at)`);
      }
      if (await hasTable(connection, "warranty_request_events")) {
        await connection.query(`DELETE FROM warranty_request_events WHERE request_id NOT IN (SELECT id FROM warranty_requests)`);
        await connection.query(`ALTER TABLE warranty_request_events MODIFY COLUMN request_id BIGINT NOT NULL`);
        if (!(await hasIndex(connection, "warranty_request_events", "idx_warranty_request_events_req"))) {
          await connection.query(`ALTER TABLE warranty_request_events ADD INDEX idx_warranty_request_events_req (request_id)`);
        }
        if (!(await hasConstraint(connection, "warranty_request_events", "fk_warranty_events_request"))) {
          await connection.query(`ALTER TABLE warranty_request_events ADD CONSTRAINT fk_warranty_events_request FOREIGN KEY (request_id) REFERENCES warranty_requests(id) ON DELETE CASCADE ON UPDATE RESTRICT`);
        }
      }
      if (await hasTable(connection, "warranty_request_attachments")) {
        await connection.query(`DELETE FROM warranty_request_attachments WHERE request_id NOT IN (SELECT id FROM warranty_requests)`);
        await connection.query(`ALTER TABLE warranty_request_attachments MODIFY COLUMN request_id BIGINT NOT NULL`);
        if (!(await hasIndex(connection, "warranty_request_attachments", "idx_warranty_request_attachments_req"))) {
          await connection.query(`ALTER TABLE warranty_request_attachments ADD INDEX idx_warranty_request_attachments_req (request_id)`);
        }
        if (!(await hasConstraint(connection, "warranty_request_attachments", "fk_warranty_attachments_request"))) {
          await connection.query(`ALTER TABLE warranty_request_attachments ADD CONSTRAINT fk_warranty_attachments_request FOREIGN KEY (request_id) REFERENCES warranty_requests(id) ON DELETE CASCADE ON UPDATE RESTRICT`);
        }
      }
      if (await hasTable(connection, "warranty_notifications")) {
        await connection.query(`UPDATE warranty_notifications SET request_id = NULL WHERE request_id IS NOT NULL AND request_id NOT IN (SELECT id FROM warranty_requests)`);
        await connection.query(`ALTER TABLE warranty_notifications MODIFY COLUMN request_id BIGINT NULL`);
        if (!(await hasIndex(connection, "warranty_notifications", "idx_warranty_notifications_req"))) {
          await connection.query(`ALTER TABLE warranty_notifications ADD INDEX idx_warranty_notifications_req (request_id)`);
        }
        if (!(await hasConstraint(connection, "warranty_notifications", "fk_warranty_notifications_request"))) {
          await connection.query(`ALTER TABLE warranty_notifications ADD CONSTRAINT fk_warranty_notifications_request FOREIGN KEY (request_id) REFERENCES warranty_requests(id) ON DELETE SET NULL ON UPDATE RESTRICT`);
        }
      }
    }
    console.log("✅ [Migration] Ensured P2-02 integrity constraints, unique indexes, WarrantyRequest FKs & DATETIME coupons.");

    // 9. Seed default system_settings
    for (const item of DEFAULT_SETTINGS) {
      await connection.query(
        `
          INSERT INTO system_settings (setting_key, setting_value, description)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE
            description = VALUES(description),
            updated_at = CURRENT_TIMESTAMP
        `,
        [item.key, item.value, item.description]
      );
    }
    console.log("✅ [Migration] Ensured default system_settings records.");

    // 8. Auto-heal / Ensure Essential Seed Data (Coupons & Hardware Specs)
    await ensureEssentialSeedData(connection);

    console.log("🎉 [Migration] Database migration completed successfully!");
  } catch (err) {
    console.error("❌ [Migration] Error during migration:", err);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

async function ensureEssentialSeedData(connection) {
  try {
    // 1. Check & Auto-seed Coupons if empty
    const [couponRows] = await connection.query("SELECT COUNT(*) AS total FROM coupons");
    if (couponRows && couponRows[0] && couponRows[0].total === 0) {
      console.log("⚠️ [Migration] 'coupons' table is empty. Auto-seeding canonical promotion vouchers...");
      const { seedCoupons } = require("../prisma/seed-coupons");
      await seedCoupons();
    }

    // 2. Check & Auto-seed SKU Attributes if empty while products exist
    const [productRows] = await connection.query("SELECT COUNT(*) AS total FROM products");
    const [skuAttrRows] = await connection.query("SELECT COUNT(*) AS total FROM sku_attributes");
    if (productRows && productRows[0].total > 0 && skuAttrRows && skuAttrRows[0].total === 0) {
      console.log("⚠️ [Migration] 'sku_attributes' is empty while products exist. Auto-seeding hardware specs...");
      const { seedHardwareSpecs } = require("../prisma/seed-hardware-specs");
      await seedHardwareSpecs();
    }

    // 3. Check & Auto-seed Reviews if empty (only when users and products already exist)
    const [userRows] = await connection.query("SELECT COUNT(*) AS total FROM users");
    const [reviewRows] = await connection.query("SELECT COUNT(*) AS total FROM product_reviews");
    if (
      productRows && productRows[0].total > 0 &&
      userRows && userRows[0].total > 0 &&
      reviewRows && reviewRows[0].total === 0
    ) {
      console.log("⚠️ [Migration] 'product_reviews' is empty. Auto-seeding verified reviews...");
      const { seedReviews } = require("../prisma/seed-reviews");
      await seedReviews();
    }
  } catch (err) {
    console.warn("⚠️ [Migration] Auto-seed essential data notice:", err.message);
  }
}

if (require.main === module) {
  runCanonicalMigrations();
}

module.exports = { runCanonicalMigrations };
