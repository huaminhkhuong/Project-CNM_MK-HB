const { getDbPool } = require("../src/config/database");

async function setupPromotionsSchema() {
  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    console.log("Setting up promotions / coupons schema...");

    // 1. Create coupons table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        discount_type VARCHAR(20) NOT NULL DEFAULT 'FIXED_AMOUNT',
        discount_value DECIMAL(12, 2) NOT NULL,
        max_discount_amount DECIMAL(12, 2) NULL,
        min_order_value DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        target_type VARCHAR(20) NOT NULL DEFAULT 'ALL',
        target_ids TEXT NULL,
        usage_limit INT NULL,
        used_count INT NOT NULL DEFAULT 0,
        usage_limit_per_user INT NOT NULL DEFAULT 1,
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_coupons_code (code),
        INDEX idx_coupons_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✓ Created/verified 'coupons' table.");

    // 2. Add columns to orders table if they don't exist
    const [cols] = await connection.query(`DESCRIBE orders`);
    const colNames = cols.map((c) => c.Field);

    if (!colNames.includes("coupon_id")) {
      await connection.query(`ALTER TABLE orders ADD COLUMN coupon_id INT NULL`);
      console.log("✓ Added 'coupon_id' column to orders.");
    }
    if (!colNames.includes("coupon_code")) {
      await connection.query(`ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(50) NULL`);
      console.log("✓ Added 'coupon_code' column to orders.");
    }
    if (!colNames.includes("discount_amount")) {
      await connection.query(`ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(12, 2) DEFAULT 0.00`);
      console.log("✓ Added 'discount_amount' column to orders.");
    }

    // Add FK constraint if not exists
    try {
      await connection.query(`
        ALTER TABLE orders
        ADD CONSTRAINT fk_orders_coupon
        FOREIGN KEY (coupon_id) REFERENCES coupons (id)
        ON DELETE SET NULL
      `);
      console.log("✓ Added foreign key 'fk_orders_coupon' to orders.");
    } catch (e) {
      if (!e.message.includes("Duplicate foreign key constraint") && !e.message.includes("already exists")) {
        // ignore duplicate constraint
      }
    }

    // 3. Create coupon_usages table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS coupon_usages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        coupon_id INT NOT NULL,
        user_id INT NOT NULL,
        order_id INT NOT NULL,
        discount_amount DECIMAL(12, 2) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_coupon_usages_coupon (coupon_id),
        INDEX idx_coupon_usages_user (user_id),
        INDEX idx_coupon_usages_order (order_id),
        CONSTRAINT fk_coupon_usages_coupon FOREIGN KEY (coupon_id) REFERENCES coupons (id) ON DELETE CASCADE,
        CONSTRAINT fk_coupon_usages_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_coupon_usages_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✓ Created/verified 'coupon_usages' table.");

    // 4. Seed realistic promotional vouchers
    const now = new Date();
    const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday
    const endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now

    const seedCoupons = [
      {
        code: "WELCOMEPC",
        name: "Ưu đãi Khách hàng mới - Giảm 100.000đ",
        description: "Giảm ngay 100.000đ áp dụng cho mọi đơn hàng linh kiện máy tính từ 1.000.000đ",
        discount_type: "FIXED_AMOUNT",
        discount_value: 100000,
        max_discount_amount: null,
        min_order_value: 1000000,
        target_type: "ALL",
        target_ids: null,
        usage_limit: 500,
        usage_limit_per_user: 1
      },
      {
        code: "BUILDPC1TR",
        name: "Đại tiệc Build PC - Giảm 1.000.000đ",
        description: "Giảm trực tiếp 1.000.000đ khi mua dàn PC hoặc combo linh kiện tổng giá trị từ 15.000.000đ",
        discount_type: "FIXED_AMOUNT",
        discount_value: 1000000,
        max_discount_amount: null,
        min_order_value: 15000000,
        target_type: "ALL",
        target_ids: null,
        usage_limit: 200,
        usage_limit_per_user: 1
      },
      {
        code: "VRAMPRO",
        name: "Nâng cấp Đồ họa - Giảm 10% VGA",
        description: "Giảm 10% (tối đa 500.000đ) khi mua Card màn hình (GPU / VGA) giá trị từ 3.000.000đ",
        discount_type: "PERCENTAGE",
        discount_value: 10,
        max_discount_amount: 500000,
        min_order_value: 3000000,
        target_type: "CATEGORY",
        target_ids: JSON.stringify([4]), // Category 4: GPU
        usage_limit: 100,
        usage_limit_per_user: 2
      },
      {
        code: "RAMSUPER",
        name: "Combo RAM Siêu tốc - Giảm 50.000đ",
        description: "Giảm ngay 50.000đ khi mua RAM DDR4/DDR5 giá trị từ 500.000đ",
        discount_type: "FIXED_AMOUNT",
        discount_value: 50000,
        max_discount_amount: null,
        min_order_value: 500000,
        target_type: "CATEGORY",
        target_ids: JSON.stringify([3]), // Category 3: RAM
        usage_limit: 300,
        usage_limit_per_user: 2
      },
      {
        code: "FREESHIP50",
        name: "Trợ giá Vận chuyển - Giảm 50.000đ",
        description: "Hỗ trợ 50.000đ chi phí vận chuyển hoặc giảm trực tiếp cho đơn từ 300.000đ",
        discount_type: "FIXED_AMOUNT",
        discount_value: 50000,
        max_discount_amount: null,
        min_order_value: 300000,
        target_type: "ALL",
        target_ids: null,
        usage_limit: 1000,
        usage_limit_per_user: 3
      }
    ];

    for (const c of seedCoupons) {
      await connection.query(
        `
          INSERT INTO coupons (
            code, name, description, discount_type, discount_value,
            max_discount_amount, min_order_value, target_type, target_ids,
            usage_limit, used_count, usage_limit_per_user,
            start_date, end_date, is_active
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 1)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            description = VALUES(description),
            discount_type = VALUES(discount_type),
            discount_value = VALUES(discount_value),
            max_discount_amount = VALUES(max_discount_amount),
            min_order_value = VALUES(min_order_value),
            target_type = VALUES(target_type),
            target_ids = VALUES(target_ids),
            usage_limit = VALUES(usage_limit),
            usage_limit_per_user = VALUES(usage_limit_per_user),
            start_date = VALUES(start_date),
            end_date = VALUES(end_date),
            is_active = 1
        `,
        [
          c.code,
          c.name,
          c.description,
          c.discount_type,
          c.discount_value,
          c.max_discount_amount,
          c.min_order_value,
          c.target_type,
          c.target_ids,
          c.usage_limit,
          c.usage_limit_per_user,
          startDate,
          endDate
        ]
      );
    }

    console.log(`✓ Seeded ${seedCoupons.length} promotional vouchers successfully.`);
  } catch (error) {
    console.error("Error setting up promotions schema:", error);
    throw error;
  } finally {
    connection.release();
  }
}

setupPromotionsSchema()
  .then(() => {
    console.log("Promotions setup completed successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Promotions setup failed:", err);
    process.exit(1);
  });
