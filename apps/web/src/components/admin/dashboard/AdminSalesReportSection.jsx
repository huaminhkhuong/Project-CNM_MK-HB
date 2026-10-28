import { AdminBadge } from "../AdminUi";
import { formatAdminNumber } from "../../../utils/adminUi";

export const REPORT_STATUS_OPTIONS = [
  { value: "ALL", label: "Tất cả trạng thái" },
  { value: "PENDING", label: "Chờ xử lý" },
  { value: "PROCESSING", label: "Đang xử lý" },
  { value: "SHIPPED", label: "Vận chuyển" },
  { value: "DELIVERED", label: "Đã giao" },
  { value: "COMPLETED", label: "Hoàn tất" },
  { value: "CANCELED", label: "Đã hủy" }
];

export const REPORT_PAYMENT_OPTIONS = [
  { value: "ALL", label: "Tất cả thanh toán" },
  { value: "COD", label: "COD" },
  { value: "VNPAY", label: "VNPay" },
  { value: "BANK_TRANSFER", label: "QR Banking" }
];

export const REPORT_MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: `Tháng ${index + 1}`
}));

export function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

export function getReportStatusLabel(status) {
  return REPORT_STATUS_OPTIONS.find((item) => item.value === status)?.label || status || "Không rõ";
}

export function getMaxValue(items) {
  return Math.max(...items.map((item) => Number(item.value || 0)), 1);
}

export function CompactDistribution({ title, items, maxValue }) {
  return (
    <article className="admin-command-mini-card">
      <h3>{title}</h3>
      <div className="admin-command-distribution">
        {items.map((item) => (
          <div key={item.label} className="admin-command-distribution__item">
            <div className="admin-command-distribution__row">
              <span>{item.label}</span>
              <strong>{formatAdminNumber(item.value)}</strong>
            </div>
            <div className="admin-command-progress">
              <div
                className={`admin-command-progress__fill admin-command-progress__fill--${item.tone}`}
                style={{ width: `${Math.max(14, Math.round((item.value / maxValue) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export function AdminSalesReportSection({
  report,
  filters,
  onFilterChange,
  onRefresh,
  loading,
  errorMessage
}) {
  const summary = report?.summary || {};
  const dailyRows = report?.dailyRows || [];
  const topProducts = report?.topProducts || [];
  const statusItems = (report?.statusBreakdown || []).map((item) => ({
    label: getReportStatusLabel(item.status),
    value: item.count,
    tone: item.status === "CANCELED" ? "danger" : item.status === "COMPLETED" ? "emerald" : "blue"
  }));
  const maxDailyRevenue = getMaxValue(dailyRows.map((item) => ({ value: item.revenue })));

  return (
    <section className="admin-command-card admin-command-analytics">
      <div className="admin-command-card__head">
        <div>
          <h2>Báo cáo doanh thu & đơn hàng</h2>
          <p>Lọc theo tháng để kiểm tra doanh thu, số lượng đơn, số hàng bán và sản phẩm bán chạy.</p>
        </div>
        <AdminBadge tone="info">Thống kê</AdminBadge>
      </div>

      <form
        className="admin-report-filters"
        onSubmit={(event) => {
          event.preventDefault();
          onRefresh();
        }}
      >
        <label>
          <span>Tháng</span>
          <select
            value={filters.month}
            onChange={(event) => onFilterChange("month", Number(event.target.value))}
          >
            {REPORT_MONTH_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Năm</span>
          <input
            type="number"
            min="2000"
            max="2100"
            value={filters.year}
            onChange={(event) => onFilterChange("year", Number(event.target.value))}
          />
        </label>
        <label>
          <span>Trạng thái</span>
          <select
            value={filters.status}
            onChange={(event) => onFilterChange("status", event.target.value)}
          >
            {REPORT_STATUS_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Thanh toán</span>
          <select
            value={filters.paymentMethod}
            onChange={(event) => onFilterChange("paymentMethod", event.target.value)}
          >
            {REPORT_PAYMENT_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Đang tải..." : "Lọc"}
        </button>
      </form>

      {errorMessage ? <div className="admin-report-error">{errorMessage}</div> : null}

      <div className="admin-report-summary">
        <div>
          <span>Doanh thu</span>
          <strong>{formatCurrency(summary.revenue)}</strong>
        </div>
        <div>
          <span>Số đơn</span>
          <strong>{formatAdminNumber(summary.orderCount)}</strong>
        </div>
        <div>
          <span>Sản phẩm bán</span>
          <strong>{formatAdminNumber(summary.itemCount)}</strong>
        </div>
        <div>
          <span>Giá trị TB/đơn</span>
          <strong>{formatCurrency(summary.averageOrderValue)}</strong>
        </div>
        <div>
          <span>Đơn hoàn tất</span>
          <strong>{formatAdminNumber(summary.completedOrders)}</strong>
        </div>
        <div>
          <span>Đơn còn hiệu lực</span>
          <strong>{formatAdminNumber(summary.activeOrders)}</strong>
        </div>
      </div>

      <div className="admin-report-grid">
        <article className="admin-command-chart">
          <div className="admin-command-section-label">
            <strong>Doanh thu theo ngày</strong>
            <span>
              {filters.month}/{filters.year}
            </span>
          </div>
          <div className="admin-command-bars admin-command-bars--month">
            {dailyRows.map((item) => (
              <div
                key={item.date}
                className="admin-command-bars__item"
                title={`${item.date}: ${formatCurrency(item.revenue)}`}
              >
                <div className="admin-command-bars__track">
                  <div
                    className="admin-command-bars__fill"
                    style={{
                      height: `${
                        item.revenue > 0
                          ? Math.max(12, Math.round((item.revenue / maxDailyRevenue) * 100))
                          : 0
                      }%`
                    }}
                  />
                </div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </article>

        <CompactDistribution
          title="Trạng thái đơn hàng"
          items={
            statusItems.length ? statusItems : [{ label: "Chưa có đơn", value: 0, tone: "neutral" }]
          }
          maxValue={getMaxValue(statusItems)}
        />
      </div>

      <div className="admin-report-tables">
        <div className="admin-report-table-wrap">
          <div className="admin-command-section-label">
            <strong>Bảng theo ngày</strong>
            <span>{dailyRows.length} ngày</span>
          </div>
          <table className="admin-report-table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Đơn</th>
                <th>SL hàng</th>
                <th>Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {dailyRows.map((item) => (
                <tr key={item.date}>
                  <td>{item.date}</td>
                  <td>{formatAdminNumber(item.orderCount)}</td>
                  <td>{formatAdminNumber(item.itemCount)}</td>
                  <td>{formatCurrency(item.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-report-table-wrap">
          <div className="admin-command-section-label">
            <strong>Sản phẩm bán nhiều nhất</strong>
            <span>Top {topProducts.length}</span>
          </div>
          <table className="admin-report-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Sản phẩm</th>
                <th>SL</th>
                <th>Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.length ? (
                topProducts.map((item) => (
                  <tr key={`${item.skuId}-${item.rank}`}>
                    <td>{item.rank}</td>
                    <td>
                      <strong>{item.productName}</strong>
                      <span>{item.sku}</span>
                    </td>
                    <td>{formatAdminNumber(item.quantitySold)}</td>
                    <td>{formatCurrency(item.revenue)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="admin-report-empty">
                    Chưa có sản phẩm bán trong bộ lọc này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
