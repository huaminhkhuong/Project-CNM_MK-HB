const { query } = require("../src/config/database");

async function run() {
  try {
    const cols = await query("SHOW COLUMNS FROM payments LIKE 'proof_image_url'");
    if (cols.length === 0) {
      await query("ALTER TABLE payments ADD COLUMN proof_image_url VARCHAR(500) NULL AFTER note");
      console.log("Successfully added proof_image_url to payments table.");
    } else {
      console.log("proof_image_url column already exists in payments table.");
    }
  } catch (err) {
    console.error("Migration error:", err.message);
    process.exit(1);
  }
  process.exit(0);
}

run();
