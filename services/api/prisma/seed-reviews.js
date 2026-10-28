const { getDbPool } = require("../src/config/database");

const SEED_REVIEWS = [
  {
    productId: 1,
    userName: "Minh Khương",
    rating: 5,
    comment: "Hiệu năng CPU i5-13400F rất ấn tượng trong tầm giá, 10 nhân 16 luồng render video và chơi game AAA cực mượt mà. Đóng gói cẩn thận, giao hàng nhanh."
  },
  {
    productId: 1,
    userName: "Anh Tuấn",
    rating: 5,
    comment: "Mua về lắp cùng main B760 và tản nhiệt khí chạy rất êm và mát, nhiệt độ không quá 65 độ khi full load. Tư vấn cấu hình của PC Mall rất chuyên nghiệp."
  },
  {
    productId: 1,
    userName: "Hoàng Phúc",
    rating: 4,
    comment: "Sản phẩm chính hãng mới 100% nguyên seal, bảo hành điện tử 36 tháng tra cứu trên hệ thống rất nhanh. Rất an tâm khi mua hàng."
  },
  {
    productId: 2,
    userName: "Đức Thịnh",
    rating: 5,
    comment: "Card màn hình đóng gói chống sốc 3 lớp, hiệu năng ổn định, chiến max setting Cyberpunk 2077 và CS2 fps rất cao."
  },
  {
    productId: 3,
    userName: "Thanh Tùng",
    rating: 5,
    comment: "Mainboard hỗ trợ đầy đủ cổng kết nối, VRM mát mẻ, bios dễ cập nhật. Nhân viên hỗ trợ tận tình qua chat."
  }
];

async function seedReviews() {
  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    console.log("🌱 [Seed] Seeding verified product reviews & delivered order for demo customer...");

    // 1. Ensure customer user (user 4) has a DELIVERED order for product 1
    const [custUsers] = await connection.query("SELECT id FROM users WHERE id = 4 OR email = 'customer@cnm.local' LIMIT 1");
    let customerUserId = 4;
    if (custUsers && custUsers.length > 0) {
      customerUserId = custUsers[0].id;
    }

    // Check if user has delivered order for product 1
    const [existingDelivered] = await connection.query(
      `
        SELECT o.id
        FROM orders o
        INNER JOIN order_items oi ON oi.order_id = o.id
        WHERE o.user_id = ? AND oi.product_id = 1 AND o.status = 'DELIVERED'
        LIMIT 1
      `,
      [customerUserId]
    );

    let deliveredOrderId = null;
    if (existingDelivered && existingDelivered.length > 0) {
      deliveredOrderId = existingDelivered[0].id;
    } else {
      // Find a SKU for product 1
      const [skus] = await connection.query("SELECT id, price FROM product_skus WHERE product_id = 1 LIMIT 1");
      const skuId = skus && skus.length > 0 ? skus[0].id : 1;
      const price = skus && skus.length > 0 ? skus[0].price : 4500000;

      // Create a delivered order
      const [orderRes] = await connection.query(
        `
          INSERT INTO orders (user_id, status, total_amount, final_amount, shipping_address, payment_method, payment_status, created_at)
          VALUES (?, 'DELIVERED', ?, ?, '123 Đường Ba Tháng Hai, Quận 10, TP.HCM', 'COD', 'PAID', DATE_SUB(NOW(), INTERVAL 5 DAY))
        `,
        [customerUserId, price, price]
      );
      deliveredOrderId = orderRes.insertId;

      await connection.query(
        `
          INSERT INTO order_items (order_id, product_id, product_variant_id, quantity, unit_price, line_total, sku_snapshot, name_snapshot)
          VALUES (?, 1, ?, 1, ?, ?, 'INTEL-I5-13400F', 'Intel Core i5-13400F')
        `,
        [deliveredOrderId, skuId, price, price]
      );
      console.log(`✅ [Seed] Created DELIVERED order #${deliveredOrderId} for customer user #${customerUserId}`);
    }

    // 2. Check if product_reviews has records
    const [reviewCount] = await connection.query("SELECT COUNT(*) AS total FROM product_reviews");
    if (reviewCount && reviewCount[0] && reviewCount[0].total > 0) {
      console.log(`ℹ️ [Seed] product_reviews already contains ${reviewCount[0].total} reviews. Skipping initial seed.`);
      return;
    }

    // 3. Insert canonical reviews
    for (const item of SEED_REVIEWS) {
      // Verify product exists
      const [prod] = await connection.query("SELECT id FROM products WHERE id = ? LIMIT 1", [item.productId]);
      if (!prod || prod.length === 0) continue;

      await connection.query(
        `
          INSERT INTO product_reviews (product_id, user_id, order_id, rating, comment, is_verified_buyer, created_at)
          VALUES (?, ?, ?, ?, ?, 1, DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 10 + 1) DAY))
        `,
        [item.productId, customerUserId, deliveredOrderId, item.rating, item.comment]
      );
    }

    console.log(`✅ [Seed] Successfully seeded ${SEED_REVIEWS.length} verified buyer reviews.`);
  } catch (err) {
    console.error("❌ [Seed] Error seeding reviews:", err);
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  (async () => {
    await seedReviews();
    const { getDbPool } = require("../src/config/database");
    await getDbPool().end();
  })();
}

module.exports = { seedReviews };
