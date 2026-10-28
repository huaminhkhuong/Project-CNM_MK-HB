const { query } = require("../src/config/database");

async function run() {
  try {
    await query(`
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
    console.log("Successfully created token_blacklist table in MySQL.");
  } catch (err) {
    console.error("Migration error:", err.message);
    process.exit(1);
  }
  process.exit(0);
}

run();
