const { query, closePool } = require("../src/config/database");

async function mergeCategories() {
  console.log("🚀 Starting Category Merge & Normalization...");

  // 1. Check all current categories
  const currentCats = await query("SELECT id, name FROM categories");
  console.log("Current categories before merge:", currentCats);

  // 2. Handle VGA -> GPU
  const vgaCat = currentCats.find((c) => c.name.toUpperCase() === "VGA");
  const gpuCat = currentCats.find((c) => c.name.toUpperCase() === "GPU");

  if (vgaCat && gpuCat) {
    console.log(`Merging VGA (id: ${vgaCat.id}) into GPU (id: ${gpuCat.id})...`);
    await query("UPDATE products SET category_id = ? WHERE category_id = ?", [gpuCat.id, vgaCat.id]);
    await query("DELETE FROM categories WHERE id = ?", [vgaCat.id]);
    console.log("✓ Merged VGA products into GPU and removed duplicate VGA category.");
  } else if (vgaCat && !gpuCat) {
    console.log(`Renaming VGA (id: ${vgaCat.id}) to GPU...`);
    await query("UPDATE categories SET name = 'GPU' WHERE id = ?", [vgaCat.id]);
    console.log("✓ Renamed VGA to GPU.");
  }

  // 3. Handle STORAGE -> SSD
  const storageCat = currentCats.find((c) => c.name.toUpperCase() === "STORAGE");
  const ssdCat = currentCats.find((c) => c.name.toUpperCase() === "SSD");

  if (storageCat && ssdCat) {
    console.log(`Merging STORAGE (id: ${storageCat.id}) into SSD (id: ${ssdCat.id})...`);
    await query("UPDATE products SET category_id = ? WHERE category_id = ?", [ssdCat.id, storageCat.id]);
    await query("DELETE FROM categories WHERE id = ?", [storageCat.id]);
    console.log("✓ Merged STORAGE products into SSD and removed duplicate STORAGE category.");
  } else if (storageCat && !ssdCat) {
    console.log(`Renaming STORAGE (id: ${storageCat.id}) to SSD...`);
    await query("UPDATE categories SET name = 'SSD' WHERE id = ?", [storageCat.id]);
    console.log("✓ Renamed STORAGE to SSD.");
  }

  // 4. Verify after merge
  const finalCats = await query(`
    SELECT c.id, c.name, COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id, c.name
    ORDER BY c.id ASC
  `);

  console.log("\n📊 Final Categories in Database:");
  console.table(finalCats);

  await closePool();
}

mergeCategories().catch((err) => {
  console.error("Merge failed:", err);
  process.exit(1);
});
