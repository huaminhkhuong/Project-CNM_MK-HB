const { getDbPool } = require("../src/config/database");

async function main() {
  const pool = getDbPool();

  console.log("Synchronizing product_variants with canonical product_skus...");
  await pool.execute("DELETE FROM product_variants");
  await pool.execute(`
    INSERT INTO product_variants (
      id, product_id, sku, price, stock_quantity, image_url, status, is_active, created_at, updated_at
    )
    SELECT
      id, product_id, sku, COALESCE(price, 0), COALESCE(stock, 0), image_url,
      COALESCE(status, 'ACTIVE'), COALESCE(is_active, 1),
      COALESCE(created_at, NOW()), COALESCE(updated_at, NOW())
    FROM product_skus
  `);

  console.log("Setting up automatic synchronization triggers on product_skus...");
  await pool.query("DROP TRIGGER IF EXISTS trg_product_skus_after_insert");
  await pool.query("DROP TRIGGER IF EXISTS trg_product_skus_after_update");
  await pool.query("DROP TRIGGER IF EXISTS trg_product_skus_after_delete");

  await pool.query(`
    CREATE TRIGGER trg_product_skus_after_insert
    AFTER INSERT ON product_skus
    FOR EACH ROW
    BEGIN
      INSERT INTO product_variants (
        id, product_id, sku, price, stock_quantity, image_url, status, is_active, created_at, updated_at
      )
      VALUES (
        NEW.id, NEW.product_id, NEW.sku, COALESCE(NEW.price, 0), COALESCE(NEW.stock, 0),
        NEW.image_url, COALESCE(NEW.status, 'ACTIVE'), COALESCE(NEW.is_active, 1),
        COALESCE(NEW.created_at, NOW()), COALESCE(NEW.updated_at, NOW())
      )
      ON DUPLICATE KEY UPDATE
        product_id = VALUES(product_id),
        sku = VALUES(sku),
        price = VALUES(price),
        stock_quantity = VALUES(stock_quantity),
        image_url = VALUES(image_url),
        status = VALUES(status),
        is_active = VALUES(is_active),
        updated_at = VALUES(updated_at);
    END;
  `);

  await pool.query(`
    CREATE TRIGGER trg_product_skus_after_update
    AFTER UPDATE ON product_skus
    FOR EACH ROW
    BEGIN
      UPDATE product_variants
      SET
        product_id = NEW.product_id,
        sku = NEW.sku,
        price = COALESCE(NEW.price, 0),
        stock_quantity = COALESCE(NEW.stock, 0),
        image_url = NEW.image_url,
        status = COALESCE(NEW.status, 'ACTIVE'),
        is_active = COALESCE(NEW.is_active, 1),
        updated_at = COALESCE(NEW.updated_at, NOW())
      WHERE id = NEW.id;
    END;
  `);

  await pool.query(`
    CREATE TRIGGER trg_product_skus_after_delete
    AFTER DELETE ON product_skus
    FOR EACH ROW
    BEGIN
      DELETE FROM product_variants WHERE id = OLD.id;
    END;
  `);

  const [[cSkus]] = await pool.query("SELECT COUNT(*) as c FROM product_skus");
  const [[cVars]] = await pool.query("SELECT COUNT(*) as c FROM product_variants");
  console.log(`Sync complete! product_skus: ${cSkus.c}, product_variants: ${cVars.c}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed to sync variant triggers:", err);
    process.exit(1);
  });
