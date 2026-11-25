import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getProductReviews, getReviewEligibility, submitProductReview } from "../services/catalog.service";
import { routeConfig } from "../routes/routeConfig";

const STAR_LABELS = {
  1: "Rất tệ",
  2: "Chưa hài lòng",
  3: "Bình thường",
  4: "Hài lòng",
  5: "Rất hài lòng"
};

export function ProductReviewsSection({ productId, idOrSlug }) {
  const { isAuthenticated, authState } = useAuth();
  const [reviewsData, setReviewsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);

  // Form state
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const identifier = idOrSlug || productId;

  // Load reviews
  async function loadReviews(page = 1) {
    if (!identifier) return;
    try {
      setLoading(true);
      const res = await getProductReviews(identifier, { page, limit: 6 });
      const data = res?.data || res;
      setReviewsData(data);
      setCurrentPage(page);
    } catch (err) {
      console.warn("Failed to load reviews:", err);
    } finally {
      setLoading(false);
    }
  }

  // Check eligibility for logged in user
  async function checkEligibility() {
    if (!identifier || !isAuthenticated) {
      setEligibility(null);
      return;
    }
    try {
      setEligibilityLoading(true);
      const res = await getReviewEligibility(identifier);
      const data = res?.data || res;
      setEligibility(data);
      if (data?.existingReview) {
        setRating(Number(data.existingReview.rating) || 5);
        setComment(data.existingReview.comment || "");
      }
    } catch (err) {
      console.warn("Failed to check review eligibility:", err);
    } finally {
      setEligibilityLoading(false);
    }
  }

  useEffect(() => {
    loadReviews(1);
  }, [identifier]);

  useEffect(() => {
    checkEligibility();
  }, [identifier, isAuthenticated]);

  // Handle submit review
  async function handleSubmit(e) {
    e.preventDefault();
    if (!comment.trim() || comment.trim().length < 3) {
      setSubmitError("Vui lòng nhập nhận xét ít nhất 3 ký tự.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError("");
      setSubmitSuccess("");
      await submitProductReview(identifier, {
        rating,
        comment: comment.trim()
      });
      setSubmitSuccess(eligibility?.hasReviewed ? "Cập nhật đánh giá thành công!" : "Cảm ơn bạn! Đánh giá đã được gửi thành công.");
      // Reload reviews and eligibility
      await Promise.all([loadReviews(1), checkEligibility()]);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Không thể gửi đánh giá. Vui lòng thử lại.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const summary = reviewsData?.summary || { totalReviews: 0, averageRating: 5.0, ratingCounts: {} };
  const reviews = reviewsData?.reviews || [];
  const totalReviews = summary.totalReviews || 0;
  const averageRating = summary.averageRating || 5.0;

  const totalPages = reviewsData?.pagination?.totalPages || 1;

  return (
    <section className="detail-section product-reviews-section">
      <div className="section-header-row">
        <div>
          <h2>Đánh giá từ khách hàng</h2>
          <p className="section-subtext">Đánh giá thực tế từ khách hàng đã mua và nhận sản phẩm tại PC Mall</p>
        </div>
        <div className="verified-shield-badge">
          <span>🛡️</span>
          <span>100% Verified Buyers</span>
        </div>
      </div>

      {/* 1. Rating Overview & Breakdown Card */}
      <div className="reviews-summary-card">
        <div className="score-column">
          <div className="big-rating-number">{averageRating}</div>
          <div className="stars-row">
            {"★".repeat(Math.round(averageRating))}
            {"☆".repeat(5 - Math.round(averageRating))}
          </div>
          <div className="rating-total-text">{totalReviews} lượt đánh giá thực tế</div>
        </div>

        <div className="distribution-column">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary.ratingCounts?.[star] || 0;
            const percentage = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
            return (
              <div key={star} className="rating-bar-row">
                <span className="star-label">{star} sao</span>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${percentage}%` }}></div>
                </div>
                <span className="count-label">{count} ({percentage}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Customer Review Form or Buyer Requirement Box */}
      <div className="review-action-container">
        {!isAuthenticated ? (
          <div className="auth-required-box">
            <div className="box-icon">💬</div>
            <div className="box-content">
              <strong>Bạn đã mua sản phẩm này và muốn chia sẻ cảm nhận?</strong>
              <p>Đăng nhập tài khoản đã mua hàng để gửi đánh giá và nhận điểm tích lũy.</p>
            </div>
            <Link to="/login" className="btn-review-login">
              Đăng nhập ngay
            </Link>
          </div>
        ) : eligibility?.canReview ? (
          <div className="verified-review-form-card">
            <div className="form-header">
              <span className="buyer-verified-chip">
                <span className="chip-check">✓</span> Khách hàng đã mua hàng (Đơn hàng #{eligibility.orderId})
              </span>
              <h3>{eligibility.hasReviewed ? "Cập nhật đánh giá của bạn" : "Gửi đánh giá trải nghiệm của bạn"}</h3>
            </div>

            {submitSuccess && <div className="review-alert review-alert--success">{submitSuccess}</div>}
            {submitError && <div className="review-alert review-alert--error">{submitError}</div>}

            <form onSubmit={handleSubmit} className="review-form">
              <div className="star-picker-row">
                <label>Đánh giá tổng quan:</label>
                <div className="interactive-stars" onMouseLeave={() => setHoverRating(0)}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (hoverRating || rating) >= star;
                    return (
                      <button
                        type="button"
                        key={star}
                        className={`star-btn ${active ? "active" : ""}`}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        title={`${star} sao - ${STAR_LABELS[star]}`}
                      >
                        ★
                      </button>
                    );
                  })}
                </div>
                <span className="star-feedback-label">
                  {STAR_LABELS[hoverRating || rating]}
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="review-comment">Nhận xét chi tiết:</label>
                <textarea
                  id="review-comment"
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Chia sẻ về hiệu năng sản phẩm, độ êm, nhiệt độ, chất lượng đóng gói và hỗ trợ của PC Mall..."
                  maxLength={2000}
                  required
                />
                <div className="char-count">{comment.length}/2000 ký tự</div>
              </div>

              <button type="submit" className="btn-submit-review" disabled={submitting}>
                {submitting ? "Đang gửi..." : eligibility.hasReviewed ? "Cập nhật đánh giá" : "Gửi đánh giá xác thực"}
              </button>
            </form>
          </div>
        ) : (
          <div className="buyer-restricted-box">
            <div className="restricted-icon">🛡️</div>
            <div className="restricted-text">
              <strong>Chính sách đánh giá xác thực (Verified Buyer Only)</strong>
              <p>
                Để bảo vệ quyền lợi người mua và ngăn chặn đánh giá ảo, PC Mall chỉ cho phép khách hàng <strong>đã đặt mua và nhận hàng thành công</strong> (đơn hàng DELIVERED) gửi đánh giá cho sản phẩm này.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Reviews List */}
      <div className="reviews-list-container">
        {loading ? (
          <div className="reviews-loading">Đang tải danh sách đánh giá...</div>
        ) : reviews.length === 0 ? (
          <div className="reviews-empty">
            <p>Chưa có đánh giá nào cho sản phẩm này.</p>
            <span className="muted-text">Hãy là khách hàng đầu tiên mua và đánh giá sản phẩm!</span>
          </div>
        ) : (
          <div className="reviews-items-grid">
            {reviews.map((rev) => (
              <div key={rev.id} className="review-item-card">
                <div className="review-item-header">
                  <div className="author-avatar">
                    {rev.author?.name ? rev.author.name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div className="author-meta">
                    <strong className="author-name">{rev.author?.name}</strong>
                    {rev.isVerifiedBuyer && (
                      <span className="verified-buyer-tag">
                        ✓ Đã mua hàng tại PC Mall
                      </span>
                    )}
                  </div>
                  <div className="review-date">
                    {new Date(rev.createdAt).toLocaleDateString("vi-VN")}
                  </div>
                </div>

                <div className="review-stars">
                  {"★".repeat(rev.rating)}
                  {"☆".repeat(5 - rev.rating)}
                </div>

                <p className="review-comment-body">{rev.comment}</p>
              </div>
            ))}
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="reviews-pagination">
            <button
              className="page-btn"
              disabled={currentPage <= 1 || loading}
              onClick={() => loadReviews(currentPage - 1)}
            >
              ← Trang trước
            </button>
            <span className="page-indicator">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              className="page-btn"
              disabled={currentPage >= totalPages || loading}
              onClick={() => loadReviews(currentPage + 1)}
            >
              Trang sau →
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
