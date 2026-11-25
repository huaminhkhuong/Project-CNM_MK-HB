const { getDbPool } = require("../src/config/database");

async function setupSerialNumbersSchema() {
  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    console.log("Setting up Serial Number / IMEI management schema...");

    // 1. Create order_item_serials table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_item_serials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        order_item_id INT NOT NULL,
        sku_id INT NOT NULL,
        serial_number VARCHAR(100) NOT NULL UNIQUE,
        status VARCHAR(50) NOT NULL DEFAULT 'ASSIGNED',
        warranty_id INT NULL,
        assigned_by INT NULL,
        assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ois_order_id (order_id),
        INDEX idx_ois_order_item_id (order_item_id),
        INDEX idx_ois_sku_id (sku_id),
        INDEX idx_ois_serial (serial_number),
        CONSTRAINT fk_ois_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
        CONSTRAINT fk_ois_order_item FOREIGN KEY (order_item_id) REFERENCES order_items (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✓ Created/verified 'order_item_serials' table.");

    // 2. Add serial_number column to warranties table
    const [warrantyCols] = await connection.query(`DESCRIBE warranties`);
    const wColNames = warrantyCols.map((c) => c.Field);

    if (!wColNames.includes("serial_number")) {
      await connection.query(`ALTER TABLE warranties ADD COLUMN serial_number VARCHAR(100) NULL`);
      console.log("✓ Added 'serial_number' column to warranties.");
    }

    // Add index on serial_number in warranties
    const [warrantyIndexes] = await connection.query(`SHOW INDEX FROM warranties`);
    const wIndexNames = warrantyIndexes.map((i) => i.Key_name);

    if (!wIndexNames.includes("idx_warranties_serial")) {
      await connection.query(`ALTER TABLE warranties ADD INDEX idx_warranties_serial (serial_number)`);
      console.log("✓ Added index 'idx_warranties_serial' on warranties.");
    }

    // Allow multiple warranty items per order_item (1 per serial number) by converting uq_warranty_order_item to standard index
    if (wIndexNames.includes("uq_warranty_order_item")) {
      try {
        await connection.query(`ALTER TABLE warranties DROP INDEX uq_warranty_order_item`);
        await connection.query(`ALTER TABLE warranties ADD INDEX idx_warranties_order_item (order_item_id)`);
        console.log("✓ Converted 'uq_warranty_order_item' to non-unique index to support multiple serial numbers per item.");
      } catch (err) {
        console.warn("Could not alter uq_warranty_order_item index:", err.message);
      }
    }

    // 3. Add serial_numbers JSON column to order_items for fast retrieval
    const [orderItemCols] = await connection.query(`DESCRIBE order_items`);
    const oiColNames = orderItemCols.map((c) => c.Field);

    if (!oiColNames.includes("serial_numbers")) {
      await connection.query(`ALTER TABLE order_items ADD COLUMN serial_numbers TEXT NULL`);
      console.log("✓ Added 'serial_numbers' column to order_items.");
    }

    console.log("Serial numbers schema setup completed successfully.");
  } catch (error) {
    console.error("Error setting up serial numbers schema:", error);
    throw error;
  } finally {
    connection.release();
  }
}

setupSerialNumbersSchema()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
