const { query } = require('../src/config/database');

async function comprehensivePriceAudit() {
  console.log('================================================================');
  console.log('     BÁO CÁO TOÀN DIỆN: RÀ SOÁT GIÁ SẢN PHẨM & SKU TOÀN HỆ THỐNG');
  console.log('================================================================\n');

  // 1. Kiểm tra NULL, ZERO hoặc ÂM
  const zeroPrices = await query(`
    SELECT p.id, p.name, p.price as prod_price, s.id as sku_id, s.price as sku_price, c.name as category
    FROM products p
    JOIN product_skus s ON s.product_id = p.id
    JOIN categories c ON c.id = p.category_id
    WHERE p.price <= 0 OR p.price IS NULL OR s.price <= 0 OR s.price IS NULL
  `);

  console.log(`[1] Sản phẩm/SKU có giá <= 0 hoặc NULL: ${zeroPrices.length} sản phẩm`);
  if (zeroPrices.length > 0) {
    console.table(zeroPrices);
  }

  // 2. Kiểm tra lệch giá giữa products.price và product_skus.price
  const mismatchedPrices = await query(`
    SELECT p.id as prod_id, p.name, c.name as category, p.price as prod_price, s.id as sku_id, s.price as sku_price
    FROM products p
    JOIN product_skus s ON s.product_id = p.id
    JOIN categories c ON c.id = p.category_id
    WHERE p.price != s.price
  `);
  console.log(`\n[2] Số sản phẩm lệch giá giữa bảng products và product_skus: ${mismatchedPrices.length} trường hợp`);
  if (mismatchedPrices.length > 0) {
    console.log('Các trường hợp lệch giá:');
    console.table(mismatchedPrices.slice(0, 10));
  }

  // 3. Phân bổ thống kê theo từng danh mục
  const categoryStats = await query(`
    SELECT 
      c.id as cat_id,
      c.name as category_name,
      COUNT(s.id) as sku_count,
      MIN(s.price) as min_price,
      ROUND(AVG(s.price)) as avg_price,
      MAX(s.price) as max_price
    FROM categories c
    JOIN products p ON p.category_id = c.id
    JOIN product_skus s ON s.product_id = p.id
    WHERE s.is_active = 1 AND p.is_active = 1
    GROUP BY c.id, c.name
    ORDER BY c.id ASC
  `);

  console.log('\n[3] Thống kê giá theo danh mục (Min - Avg - Max):');
  console.table(categoryStats.map(cs => ({
    'ID': cs.cat_id,
    'Danh mục': cs.category_name,
    'Số SKU': cs.sku_count,
    'Giá thấp nhất': Number(cs.min_price).toLocaleString('vi-VN') + 'đ',
    'Giá trung bình': Number(cs.avg_price).toLocaleString('vi-VN') + 'đ',
    'Giá cao nhất': Number(cs.max_price).toLocaleString('vi-VN') + 'đ'
  })));

  // 4. Tìm các sản phẩm có giá min và max trong từng danh mục để thẩm định tính hợp lý
  console.log('\n[4] Thẩm định sản phẩm cận biên (Giá rẻ nhất & đắt nhất mỗi danh mục):');
  for (const cs of categoryStats) {
    const minItems = await query(`
      SELECT p.name, s.price FROM product_skus s 
      JOIN products p ON p.id = s.product_id 
      WHERE p.category_id = ? ORDER BY s.price ASC LIMIT 1
    `, [cs.cat_id]);
    const maxItems = await query(`
      SELECT p.name, s.price FROM product_skus s 
      JOIN products p ON p.id = s.product_id 
      WHERE p.category_id = ? ORDER BY s.price DESC LIMIT 1
    `, [cs.cat_id]);

    console.log(`-- ${cs.category_name} --`);
    if (minItems[0]) {
      console.log(`   Rẻ nhất: [${Number(minItems[0].price).toLocaleString('vi-VN')}đ] ${minItems[0].name.substring(0, 60)}...`);
    }
    if (maxItems[0]) {
      console.log(`   Đắt nhất: [${Number(maxItems[0].price).toLocaleString('vi-VN')}đ] ${maxItems[0].name.substring(0, 60)}...`);
    }
  }

  // 5. Kiểm tra các dòng card đồ họa cao cấp hoặc CPU cao cấp có bị bán rẻ không
  const suspiciousHighEnd = await query(`
    SELECT p.name, s.price, c.name as category
    FROM product_skus s
    JOIN products p ON p.id = s.product_id
    JOIN categories c ON c.id = p.category_id
    WHERE (
      (p.name LIKE '%4090%' AND s.price < 40000000) OR
      (p.name LIKE '%4080%' AND s.price < 25000000) OR
      (p.name LIKE '%4070%' AND s.price < 12000000) OR
      (p.name LIKE '%14900%' AND s.price < 10000000) OR
      (p.name LIKE '%13900%' AND s.price < 9000000) OR
      (p.name LIKE '%7800X3D%' AND s.price < 7000000) OR
      (p.name LIKE '%9800X3D%' AND s.price < 9000000) OR
      (p.name LIKE '%285K%' AND s.price < 10000000) OR
      (p.name LIKE '%5090%' AND s.price < 40000000)
    )
  `);
  console.log(`\n[5] Kiểm tra chéo High-End / Flagship bất thường: ${suspiciousHighEnd.length} sản phẩm`);
  if (suspiciousHighEnd.length > 0) {
    console.table(suspiciousHighEnd);
  } else {
    console.log('   => Tất cả High-End / Flagship CPU & GPU đều có mức giá hợp lý chuẩn thị trường!');
  }

  process.exit(0);
}

comprehensivePriceAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
