const { query } = require("../../config/database");
const { createError } = require("../../utils/service-helpers");

/**
 * Mask email for privacy (e.g. "minh.khuong@gmail.com" -> "m***g@gmail.com")
 */
function maskEmail(email) {
  if (!email || typeof email !== "string") return "Khách hàng";
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const [name, domain] = parts;
  if (name.length <= 2) return `${name[0]}***@${domain}`;
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

/**
 * Resolve product by numeric ID or slug string
 */
async function resolveProduct(idOrSlug) {
  const identifier = String(idOrSlug || "").trim();
  if (!identifier) {
    throw createError("Mã hoặc slug sản phẩm là bắt buộc", 400);
  }

  const isNumeric = /^[0-9]+$/.test(identifier);
  let rows;
  if (isNumeric) {
    rows = await query(
      "SELECT id, name, slug FROM products WHERE id = ? LIMIT 1",
      [Number(identifier)]
    );
  } else {
    rows = await query(
      "SELECT id, name, slug FROM products WHERE slug = ? OR id = ? LIMIT 1",
      [identifier, Number(identifier) || 0]
    );
  }

  if (!rows || rows.length === 0) {
    throw createError("Sản phẩm không tồn tại trong hệ thống", 404);
  }

  return rows[0];
}

/**
 * Get reviews list and rating summary for a product
 */
async function getProductReviews(idOrSlug, queryParams = {}) {
  const product = await resolveProduct(idOrSlug);
  const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 10));
  const offset = (page - 1) * limit;

  // 1. Calculate overall rating summary
  const summaryRows = await query(
    `
      SELECT
        COUNT(*) AS total_reviews,
        COALESCE(AVG(rating), 5.0) AS avg_rating,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS star_5,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS star_4,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS star_3,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS star_2,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS star_1
      FROM product_reviews
      WHERE product_id = ?
    `,
    [product.id]
  );

  const summary = summaryRows[0] || {};
  const totalReviews = Number(summary.total_reviews || 0);
  const averageRating = totalReviews > 0 ? Number(parseFloat(summary.avg_rating || 5.0).toFixed(1)) : 5.0;

  // 2. Fetch paginated reviews with user details
  const reviewRows = await query(
    `
      SELECT
        pr.id,
        pr.product_id,
        pr.user_id,
        pr.order_id,
        pr.rating,
        pr.comment,
        pr.is_verified_buyer,
        pr.created_at,
        pr.updated_at,
        u.full_name AS user_name,
        u.email AS user_email
      FROM product_reviews pr
      LEFT JOIN users u ON u.id = pr.user_id
      WHERE pr.product_id = ?
      ORDER BY pr.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    [product.id]
  );

  const formattedReviews = reviewRows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    userId: r.user_id,
    orderId: r.order_id,
    rating: Number(r.rating),
    comment: r.comment,
    isVerifiedBuyer: Boolean(r.is_verified_buyer),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    author: {
      name: r.user_name || (r.user_email ? maskEmail(r.user_email) : "Khách hàng PC Mall"),
      maskedEmail: maskEmail(r.user_email)
    }
  }));

  return {
    productId: product.id,
    productName: product.name,
    productSlug: product.slug,
    summary: {
      totalReviews,
      averageRating,
      ratingCounts: {
        5: Number(summary.star_5 || 0),
        4: Number(summary.star_4 || 0),
        3: Number(summary.star_3 || 0),
        2: Number(summary.star_2 || 0),
        1: Number(summary.star_1 || 0)
      }
    },
    pagination: {
      page,
      limit,
      totalItems: totalReviews,
      totalPages: Math.ceil(totalReviews / limit) || 1
    },
    reviews: formattedReviews
  };
}

/**
 * Check if a user is eligible to review a product
 * Verification rule: User MUST have at least one order with status 'DELIVERED' or 'COMPLETED'
 * containing this product (via order_items.product_id or product_skus.product_id).
 */
async function checkReviewEligibility(userId, idOrSlug) {
  if (!userId) {
    return {
      canReview: false,
      hasDeliveredOrder: false,
      hasReviewed: false,
      existingReview: null,
      orderId: null,
      reason: "Vui lòng đăng nhập để gửi đánh giá sản phẩm."
    };
  }

  const product = await resolveProduct(idOrSlug);
  const numericUserId = Number(userId);

  // 1. Query for delivered orders containing this product
  const deliveredOrderRows = await query(
    `
      SELECT o.id AS order_id, o.status, o.created_at
      FROM orders o
      INNER JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN product_skus ps ON ps.id = oi.product_variant_id
      WHERE o.user_id = ?
        AND (oi.product_id = ? OR ps.product_id = ?)
        AND o.status IN ('DELIVERED', 'COMPLETED')
      ORDER BY o.id DESC
      LIMIT 1
    `,
    [numericUserId, product.id, product.id]
  );

  const hasDeliveredOrder = Array.isArray(deliveredOrderRows) && deliveredOrderRows.length > 0;
  const matchingOrder = hasDeliveredOrder ? deliveredOrderRows[0] : null;

  // 2. Check if user already reviewed this product
  const existingReviewRows = await query(
    `
      SELECT id, rating, comment, is_verified_buyer, created_at, updated_at
      FROM product_reviews
      WHERE product_id = ? AND user_id = ?
      LIMIT 1
    `,
    [product.id, numericUserId]
  );

  const hasReviewed = Array.isArray(existingReviewRows) && existingReviewRows.length > 0;
  const existingReview = hasReviewed ? existingReviewRows[0] : null;

  if (!hasDeliveredOrder) {
    return {
      canReview: false,
      hasDeliveredOrder: false,
      hasReviewed,
      existingReview,
      orderId: null,
      reason: "Chỉ khách hàng đã mua và nhận sản phẩm thành công mới có thể gửi đánh giá."
    };
  }

  return {
    canReview: true,
    hasDeliveredOrder: true,
    hasReviewed,
    existingReview,
    orderId: matchingOrder.order_id,
    reason: null
  };
}

/**
 * Create or update a product review after verifying the user is a delivered buyer
 */
async function createProductReview(userId, idOrSlug, payload = {}) {
  if (!userId) {
    throw createError("Yêu cầu đăng nhập để gửi đánh giá", 401);
  }

  const rating = Number(payload.rating);
  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw createError("Điểm đánh giá phải là số nguyên từ 1 đến 5 sao", 400);
  }

  const comment = String(payload.comment || "").trim();
  if (!comment || comment.length < 3) {
    throw createError("Nội dung đánh giá phải có ít nhất 3 ký tự", 400);
  }
  if (comment.length > 2000) {
    throw createError("Nội dung đánh giá không được vượt quá 2000 ký tự", 400);
  }

  const product = await resolveProduct(idOrSlug);
  const eligibility = await checkReviewEligibility(userId, product.id);

  if (!eligibility.canReview) {
    throw createError(
      eligibility.reason || "Chỉ khách hàng đã mua và nhận sản phẩm thành công mới có thể gửi đánh giá.",
      403
    );
  }

  const numericUserId = Number(userId);

  if (eligibility.hasReviewed) {
    // Update existing review
    await query(
      `
        UPDATE product_reviews
        SET rating = ?, comment = ?, order_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [rating, comment, eligibility.orderId, eligibility.existingReview.id]
    );

    return {
      reviewId: eligibility.existingReview.id,
      productId: product.id,
      userId: numericUserId,
      orderId: eligibility.orderId,
      rating,
      comment,
      isVerifiedBuyer: true,
      isUpdated: true
    };
  }

  // Insert new review
  const insertResult = await query(
    `
      INSERT INTO product_reviews (product_id, user_id, order_id, rating, comment, is_verified_buyer)
      VALUES (?, ?, ?, ?, ?, 1)
    `,
    [product.id, numericUserId, eligibility.orderId, rating, comment]
  );

  return {
    reviewId: insertResult.insertId,
    productId: product.id,
    userId: numericUserId,
    orderId: eligibility.orderId,
    rating,
    comment,
    isVerifiedBuyer: true,
    isUpdated: false
  };
}

module.exports = {
  getProductReviews,
  checkReviewEligibility,
  createProductReview,
  resolveProduct
};
