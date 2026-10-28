import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import "./AnnouncementBar.css";

export const ANNOUNCEMENT_ITEMS = [
  {
    id: "promo",
    badge: "HOT DEAL",
    badgeColor: "#ef4444",
    badgeBg: "rgba(239, 68, 68, 0.15)",
    icon: "🎁",
    fullText: "Khuyến mãi cực hot: Giảm ngay 2.000.000đ khi lắp ráp trọn bộ PC",
    shortText: "Khuyến mãi: Giảm đến 2 triệu khi build trọn bộ PC",
    miniText: "Giảm đến 2Tr build full bộ PC",
    link: "/pc-builder",
  },
  {
    id: "warranty",
    badge: "BẢO HÀNH",
    badgeColor: "#10b981",
    badgeBg: "rgba(16, 185, 129, 0.15)",
    icon: "🛡️",
    fullText: "Chính sách bảo hành: 1 đổi 1 tận nơi trong 30 ngày, bảo hành chính hãng 36 tháng",
    shortText: "Chính sách bảo hành: 1 đổi 1 tận nơi, chính hãng 36T",
    miniText: "Bảo hành 1 đổi 1 tận nơi 36T",
    link: "/warranties",
  },
  {
    id: "shipping",
    badge: "GIAO NHANH",
    badgeColor: "#f5a623",
    badgeBg: "rgba(245, 166, 35, 0.15)",
    icon: "🚀",
    fullText: "Miễn phí giao hàng: Siêu tốc 2h nội thành TP.HCM & Hà Nội",
    shortText: "Miễn phí giao hàng: Siêu tốc 2h nội thành TP.HCM & HN",
    miniText: "Giao siêu tốc 2h nội thành",
    link: "/products",
  },
  {
    id: "ai-support",
    badge: "AI 24/7",
    badgeColor: "#8b5cf6",
    badgeBg: "rgba(139, 92, 246, 0.15)",
    icon: "✨",
    fullText: "Trợ lý AI Gemini: Tự động kiểm tra tương thích & tư vấn tối ưu cấu hình 24/7",
    shortText: "Trợ lý AI Gemini: Kiểm tra tương thích linh kiện 24/7",
    miniText: "Tư vấn tương thích AI 24/7",
    link: "/ai-chat",
  },
];

export function AnnouncementBar() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const total = ANNOUNCEMENT_ITEMS.length;

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      handleNext();
    }, 4500);
    return () => clearInterval(timer);
  }, [isPaused, handleNext]);

  const currentItem = useMemo(() => ANNOUNCEMENT_ITEMS[currentIndex], [currentIndex]);

  return (
    <div
      className="announcement-bar"
      data-testid="announcement-bar"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-label="Thông báo khuyến mãi và chính sách bảo hành"
    >
      {/* ── Slide Track ── */}
      <div className="announcement-bar__track">
        <Link
          key={currentItem.id}
          to={currentItem.link}
          className="announcement-bar__item"
          data-testid="announcement-item"
        >
          {/* Badge */}
          <span
            className="announcement-bar__badge"
            style={{
              color: currentItem.badgeColor,
              backgroundColor: currentItem.badgeBg,
              borderColor: `${currentItem.badgeColor}40`,
            }}
          >
            {currentItem.badge}
          </span>

          {/* Icon */}
          <span className="announcement-bar__icon" aria-hidden="true">
            {currentItem.icon}
          </span>

          {/* Text with responsive variations (never truncated with ...) */}
          <span className="announcement-bar__text" data-testid="announcement-text">
            <span className="announcement-bar__text--full">{currentItem.fullText}</span>
            <span className="announcement-bar__text--short">{currentItem.shortText}</span>
            <span className="announcement-bar__text--mini">{currentItem.miniText}</span>
          </span>
        </Link>
      </div>

      {/* ── Prev / Next Controls ── */}
      <div className="announcement-bar__controls">
        <button
          type="button"
          className="announcement-bar__btn"
          onClick={handlePrev}
          aria-label="Thông báo trước"
          data-testid="announcement-prev"
        >
          ‹
        </button>
        <button
          type="button"
          className="announcement-bar__btn"
          onClick={handleNext}
          aria-label="Thông báo kế tiếp"
          data-testid="announcement-next"
        >
          ›
        </button>
      </div>
    </div>
  );
}
