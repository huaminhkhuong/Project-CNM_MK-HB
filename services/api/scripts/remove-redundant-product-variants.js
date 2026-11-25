const { getDbPool } = require("../src/config/database");

async function removeRedundantProductVariants() {
  const pool = getDbPool();
  console.log("Removing redundant triggers and product_variants table...");

  try {
    // 1. Drop synchronization triggers
    await pool.query("DROP TRIGGER IF EXISTS trg_product_skus_after_insert");
    await pool.query("DROP TRIGGER IF EXISTS trg_product_skus_after_update");
    await pool.query("DROP TRIGGER IF EXISTS trg_product_skus_after_delete");
    console.log("Dropped synchronization triggers.");

    // 2. Drop table product_variants
    await pool.query("DROP TABLE IF EXISTS product_variants");
    console.log("Dropped redundant table product_variants.");

    // 3. Verify product_skus is intact
    const [[skuCount]] = await pool.query("SELECT COUNT(*) as count FROM product_skus");
    console.log(`Canonical product_skus table intact with ${skuCount.count} records.`);

    const [tables] = await pool.query("SHOW TABLES LIKE 'product_variants'");
    if (tables.length === 0) {
      console.log("SUCCESS: product_variants table completely eliminated.");
    } else {
      console.error("WARNING: product_variants table still detected.");
    }
  } catch (err) {
    console.error("Error removing product_variants:", err);
    throw err;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  removeRedundantProductVariants()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { removeRedundantProductVariants };
