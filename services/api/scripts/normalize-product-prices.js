const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/database');
const { calculateRealisticMarketPrice } = require('./calculate_prices');

const DATA_DIR = path.resolve(__dirname, '../../../data');
const JSON_DIR = path.join(DATA_DIR, 'json');
const CSV_DIR = path.join(DATA_DIR, 'csv');

function jsonToCsv(items) {
  if (!items || items.length === 0) return '';
  const headers = Object.keys(items[0]).filter(k => k !== 'specifications' && k !== 'images');
  const allHeaders = [...headers, 'specifications', 'images'];
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };
  const csvRows = [
    allHeaders.join(','),
    ...items.map(it => allHeaders.map(h => escapeCell(it[h])).join(','))
  ];
  return csvRows.join('\n');
}

async function run() {
  console.log('⚡ [1/3] Bắt đầu chuẩn hóa giá linh kiện trong MySQL Database...');
  const rows = await query(`
    SELECT s.id AS sku_id, p.id AS product_id, p.name, p.slug, p.category_id, c.name AS category_name, s.price
    FROM product_skus s
    JOIN products p ON p.id = s.product_id
    JOIN categories c ON c.id = p.category_id
  `);

  let updatedSkus = 0;
  let updatedProducts = 0;

  for (const r of rows) {
    const newPrice = calculateRealisticMarketPrice(r.category_id, r.name, r.price);
    if (newPrice !== Number(r.price)) {
      await query('UPDATE product_skus SET price = ? WHERE id = ?', [newPrice, r.sku_id]);
      await query('UPDATE products SET price = ? WHERE id = ?', [newPrice, r.product_id]);
      updatedSkus++;
      updatedProducts++;
      console.log(`  ✓ [${r.category_name}] ${r.name.substring(0, 50)}...: ${Number(r.price).toLocaleString('vi-VN')}đ => ${newPrice.toLocaleString('vi-VN')}đ`);
    }
  }

  console.log(`✅ [1/3] Đã cập nhật thành công ${updatedSkus} SKUs và ${updatedProducts} Products trong MySQL!\n`);

  console.log('⚡ [2/3] Đồng bộ giá vào thư mục data/json và data/csv...');
  const allJsonPath = path.join(JSON_DIR, 'pc_components_all.json');
  if (fs.existsSync(allJsonPath)) {
    const allItems = JSON.parse(fs.readFileSync(allJsonPath, 'utf8'));
    let fileUpdated = 0;
    const itemsByCategory = {};

    for (const it of allItems) {
      const oldPrice = it.price;
      const catId = it.category_id || it.category;
      const newPrice = calculateRealisticMarketPrice(catId, it.name, oldPrice);
      if (newPrice !== oldPrice) {
        it.price = newPrice;
        it.price_formatted = newPrice.toLocaleString('vi-VN') + 'đ';
        fileUpdated++;
      }
      const catKey = it.category || 'other';
      if (!itemsByCategory[catKey]) itemsByCategory[catKey] = [];
      itemsByCategory[catKey].push(it);
    }

    fs.writeFileSync(allJsonPath, JSON.stringify(allItems, null, 2), 'utf8');

    const allCsvPath = path.join(CSV_DIR, 'pc_components_all.csv');
    if (fs.existsSync(CSV_DIR)) {
      fs.writeFileSync(allCsvPath, jsonToCsv(allItems), 'utf8');
    }

    for (const [catName, catItems] of Object.entries(itemsByCategory)) {
      const catJsonFile = path.join(JSON_DIR, `${catName}.json`);
      const catCsvFile = path.join(CSV_DIR, `${catName}.csv`);
      if (fs.existsSync(catJsonFile)) {
        fs.writeFileSync(catJsonFile, JSON.stringify(catItems, null, 2), 'utf8');
      }
      if (fs.existsSync(catCsvFile)) {
        fs.writeFileSync(catCsvFile, jsonToCsv(catItems), 'utf8');
      }
    }
    console.log(`✅ [2/3] Đã cập nhật ${fileUpdated} sản phẩm trong data/json và data/csv!\n`);
  } else {
    console.log('ℹ️ Không có thư mục data/json, bỏ qua bước 2.');
  }

  console.log('🎉 Hoàn tất quá trình chuẩn hóa giá linh kiện toàn hệ thống!');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
