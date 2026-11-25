const { query, getDbPool } = require("../src/config/database");

async function setupNotificationsSchema() {
  console.log("Setting up notifications schema in MySQL...");

  try {
    // 1. Create notifications table
    await query(`
      CREATE TABLE IF NOT EXISTS \`notifications\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`user_id\` INT NOT NULL,
        \`type\` VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
        \`title\` VARCHAR(255) NOT NULL,
        \`message\` TEXT NOT NULL,
        \`reference_id\` VARCHAR(100) NULL,
        \`reference_type\` VARCHAR(50) NULL,
        \`link\` VARCHAR(255) NULL,
        \`is_read\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_notifications_user_read\` (\`user_id\`, \`is_read\`),
        INDEX \`idx_notifications_created\` (\`created_at\` DESC),
        CONSTRAINT \`fk_notifications_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✅ Created table notifications");

    // 2. Migrate existing warranty notifications if not already migrated
    const [existingCount] = await query("SELECT COUNT(*) AS count FROM notifications");
    if (existingCount && Number(existingCount.count) === 0) {
      await query(`
        INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type, link, is_read, created_at)
        SELECT user_id, 'WARRANTY', title, message, CAST(request_id AS CHAR), 'WARRANTY', '/warranties', is_read, created_at
        FROM warranty_notifications
      `);
      console.log("✅ Migrated rows from warranty_notifications to notifications");
    }

    console.log("🎉 Notifications schema setup completed successfully!");
  } catch (error) {
    console.error("❌ Error setting up notifications schema:", error);
    process.exit(1);
  } finally {
    const pool = getDbPool();
    await pool.end();
  }
}

setupNotificationsSchema();
