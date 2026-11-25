const { query } = require("../src/config/database");

async function seedWarrantyMasterData() {
  console.log("Seeding warranty master data...");

  // Update categories base defaults
  await query(`
    UPDATE products p
    LEFT JOIN categories c ON c.id = p.category_id
    SET p.warranty_months = 36
    WHERE c.name IN ('CPU', 'MAINBOARD', 'RAM', 'GPU', 'SSD')
  `);

  await query(`
    UPDATE products p
    LEFT JOIN categories c ON c.id = p.category_id
    SET p.warranty_months = 24
    WHERE c.name IN ('COOLING')
  `);

  await query(`
    UPDATE products p
    LEFT JOIN categories c ON c.id = p.category_id
    SET p.warranty_months = 12
    WHERE c.name IN ('CASE')
  `);

  await query(`
    UPDATE products p
    LEFT JOIN categories c ON c.id = p.category_id
    SET p.warranty_months = 36
    WHERE c.name IN ('PSU')
  `);

  // Premium PSUs: Corsair RM, Seasonic -> 120 months (10 years)
  await query(`
    UPDATE products
    SET warranty_months = 120
    WHERE name LIKE '%RM750%'
       OR name LIKE '%RM850%'
       OR name LIKE '%RM1000%'
       OR name LIKE '%Seasonic%'
       OR (name LIKE '%RM%' AND name LIKE '%Corsair%')
  `);

  // High-tier Gold PSUs -> 60 months (5 years)
  await query(`
    UPDATE products
    SET warranty_months = 60
    WHERE name LIKE '%MWE Gold%'
  `);

  // Premium SSDs: Samsung 980 Pro, 990 Pro, WD Black SN850X -> 60 months (5 years)
  await query(`
    UPDATE products
    SET warranty_months = 60
    WHERE name LIKE '%980 Pro%'
       OR name LIKE '%990 Pro%'
       OR name LIKE '%SN850%'
  `);

  // Sync to product_skus where specified or leave NULL for inheritance
  // Let's verify specific key items
  const checkRows = await query(`
    SELECT id, name, warranty_months
    FROM products
    WHERE name LIKE '%RM%'
       OR name LIKE '%980 Pro%'
       OR name LIKE '%14400F%'
       OR name LIKE '%CMP 520%'
    LIMIT 10
  `);
  console.log("Updated sample products:", checkRows);
  console.log("Warranty master data seed complete!");
}

seedWarrantyMasterData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  });
