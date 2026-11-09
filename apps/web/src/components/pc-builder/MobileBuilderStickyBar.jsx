import React from "react";
import { formatCurrency } from "./pcBuilderUtils";

/**
 * MobileBuilderStickyBar — Thanh tác vụ cố định mép dưới dành riêng cho thiết bị di động (viewport < 992px)
 * Giúp người dùng mobile luôn theo dõi được:
 * - Tổng chi phí hiện tại
 * - Tiến độ hoàn thành (số linh kiện đã chọn / tổng số)
 * - Trạng thái tương thích / Cảnh báo
 * - Nút "Xem tóm tắt & Đặt hàng" kích hoạt Bottom Sheet / Summary
 */
export function MobileBuilderStickyBar({
  totalPrice = 0,
  selectedCount = 0,
  requiredCount = 8,
  completionPercent = 0,
  hasBlockerSeverity = false,
  isBudgetBlocked = false,
  onOpenSummary,
  onBuyWholeBuild,
  processingComponent = ""
}) {
  const isBlocked = hasBlockerSeverity || isBudgetBlocked;

  return (
    <div className="mobile-builder-sticky-bar">
      <div className="mobile-bar-left">
        <div className="mobile-bar-price-row">
          <span className="mobile-bar-price">{formatCurrency(totalPrice)}đ</span>
          <span className={`mobile-bar-badge ${isBlocked ? "is-blocked" : "is-ready"}`}>
            {isBlocked ? "⛔ Cần xử lý" : `${completionPercent}% Hoàn tất`}
          </span>
        </div>
        <div className="mobile-bar-meta">
          <span>{selectedCount}/{requiredCount} linh kiện đã chọn</span>
        </div>
      </div>

      <div className="mobile-bar-actions">
        <button
          type="button"
          className="btn-mobile-summary"
          onClick={onOpenSummary}
          title="Xem danh sách linh kiện đã chọn và chi tiết tương thích"
        >
          📋 Cấu Hình
        </button>

        <button
          type="button"
          className={`btn-mobile-order ${isBlocked ? "is-disabled" : ""}`}
          onClick={onBuyWholeBuild}
          disabled={processingComponent === "cart" || selectedCount === 0 || isBlocked}
        >
          {processingComponent === "cart" ? "⏳ Đang xử lý" : isBlocked ? "Bị Chặn" : "🚀 Mua Ngay"}
        </button>
      </div>
    </div>
  );
}
