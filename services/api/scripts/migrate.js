/**
 * Canonical Database Migration Script
 * Runs all consolidated schema definitions and table migrations independently before application boot.
 */
const fs = require("fs");
const path = require("path");
const { getDbPool } = require("../src/config/database");

const DEFAULT_SETTINGS = [
  { key: "store_name", value: "CNM PC Store", description: "Ten hien thi cua he thong" },
  { key: "support_email", value: "support@example.com", description: "Email ho tro khach hang" },
  { key: "support_phone", value: "0900000000", description: "So dien thoai ho tro" },
  { key: "online_payment_mode", value: "sandbox", description: "Che do thanh toan online: sandbox/live" },
  { key: "shipping_mode", value: "mock", description: "Che do van chuyen: mock/live" },
  { key: "maintenance_mode", value: "off", description: "Bat/tat che do bao tri" }
];

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

async function runCanonicalMigrations() {
  console.log("🚀 [Migration] Starting Canonical Database Migration...");
  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    // 1. Execute consolidated DDL from canonical migration file
    const migrationSqlPath = path.join(
      __dirname,
      "..",
      "prisma",
      "migrations",
      "20261022170000_canonical_schema_consolidation",
      "migration.sql"
    );

    if (fs.existsSync(migrationSqlPath)) {
      const sqlContent = fs.readFileSync(migrationSqlPath, "utf-8");
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
      console.log(`✅ [Migration] Executed canonical schema consolidation DDL (${statements.length} statements).`);
    }

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

    // 6. Ensure compatibility_rules name column
    if (!(await hasColumn(connection, "compatibility_rules", "name"))) {
      await connection.query("ALTER TABLE compatibility_rules ADD COLUMN name VARCHAR(255) NULL");
      console.log("✅ [Migration] Added name to compatibility_rules.");
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

    // 8. Seed default system_settings
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

    // 3. Check & Auto-seed Reviews if empty
    const [reviewRows] = await connection.query("SELECT COUNT(*) AS total FROM product_reviews");
    if (reviewRows && reviewRows[0] && reviewRows[0].total === 0) {
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
