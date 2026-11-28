import { useEffect, useMemo, useState } from "react";
import './AdminDashboardPage.css';

import { Link } from "react-router-dom";

import {
  AdminAlerts,
  AdminLinkBtn,
  AdminPage
} from "../../components/admin/AdminUi";
import { getAdminSalesReport } from "../../services/admin-reports.service";
import { getAdminSystemOverview } from "../../services/admin-system.service";
import {
  formatAdminDateTime,
  formatAdminNumber,
  getAdminEnvelopeData,
  getAdminErrorMessage
} from "../../utils/adminUi";
import {
  AdminSalesReportSection as AdminSalesReportPanel,
  formatCurrency
} from "../../components/admin/dashboard/AdminSalesReportSection";
import {
  AdminModuleGrid,
  DEFAULT_ADMIN_MODULES as MODULES
} from "../../components/admin/dashboard/AdminModuleGrid";
import {
  AdminAlertsPanel,
  AdminRecentActivity,
  AdminSystemSettingsSummary
} from "../../components/admin/dashboard/AdminAlertsAndActivity";

function toNumber(value) {
  return Number(value || 0);
}

function getSetting(settingsMap, key, fallback = "Chưa cấu hình") {
  const value = settingsMap?.[key];
  return value === undefined || value === null || value === "" ? fallback : value;
}

function MetricSkeleton() {
  return (
    <div className="admin-command-kpi admin-command-skeleton">
      <div className="admin-command-skeleton__line admin-command-skeleton__line--short" />
      <div className="admin-command-skeleton__line admin-command-skeleton__line--value" />
      <div className="admin-command-skeleton__line" />
    </div>
  );
}

function AdminDashboardHeader({ healthItems, settingsMap, checkedAt }) {
  return (
    <section className="admin-command-header">
      <div className="admin-command-header__copy">
        <span className="admin-command-eyebrow">Trung tâm điều hành Admin</span>
        <h1>Tổng quan điều hành PC Mall</h1>
        <p>
          Theo dõi số liệu ecommerce, cảnh báo vận hành, health check và truy cập nhanh các module quản trị trong một màn hình gọn.
        </p>
      </div>

      <aside className="admin-command-health">
        <div className="admin-command-health__head">
          <div>
            <span>Tình trạng hệ thống</span>
            <strong>{formatAdminDateTime(checkedAt)}</strong>
            <div className="admin-command-header__meta">
              Thanh toán: {getSetting(settingsMap, "online_payment_mode", "sandbox")} · Vận chuyển: {getSetting(settingsMap, "shipping_mode", "mock")}
            </div>
          </div>
          <AdminLinkBtn to="/admin/system" variant="secondary">Cấu hình</AdminLinkBtn>
        </div>
        <div className="admin-command-health__grid">
          {healthItems.map((item) => (
            <div key={item.label} className="admin-command-health__item">
              <span>{item.label}</span>
              <strong className={`admin-command-health__state admin-command-health__state--${item.tone}`}>
                {item.status}
              </strong>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}

function AdminKpiGrid({ loading, kpis, activeKey, onKpiClick }) {
  if (loading) {
    return (
      <section className="admin-command-kpis">
        {Array.from({ length: 6 }).map((_, index) => <MetricSkeleton key={index} />)}
      </section>
    );
  }

  return (
    <section className="admin-command-kpis">
      {kpis.map((kpi) => (
        <Link
          key={kpi.label}
          to={kpi.to}
          className={`admin-command-kpi${activeKey === kpi.key ? " admin-command-kpi--active" : ""}`}
          onClick={(event) => {
            if (!kpi.key) return;
            event.preventDefault();
            onKpiClick(kpi.key);
          }}
        >
          <div className="admin-command-kpi__top">
            <span className={`admin-command-kpi__icon admin-command-kpi__icon--${kpi.accent}`}>{kpi.icon}</span>
            {kpi.trend ? (
              <span className={`admin-command-trend admin-command-trend--${kpi.trend.positive ? "up" : "down"}`}>
                {kpi.trend.positive ? "+" : "-"}{kpi.trend.value}%
              </span>
            ) : null}
          </div>
          <div>
            <strong>{kpi.value}</strong>
            <p>{kpi.label}</p>
          </div>
          <small>{kpi.hint}</small>
        </Link>
      ))}
    </section>
  );
}

export function AdminDashboardPage() {
  const currentDate = new Date();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [salesReport, setSalesReport] = useState(null);
  const [showSalesReport, setShowSalesReport] = useState(false);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState("");
  const [reportFilters, setReportFilters] = useState({
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
    status: "ALL",
    paymentMethod: "ALL"
  });

  useEffect(() => {
    async function loadOverview() {
      try {
        setLoading(true);
        setErrorMessage("");
        const response = await getAdminSystemOverview();
        setOverview(getAdminEnvelopeData(response, null));
      } catch (error) {
        setErrorMessage(getAdminErrorMessage(error, "Không thể tải tổng quan điều hành hệ thống."));
      } finally {
        setLoading(false);
      }
    }

    loadOverview();
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadSalesReport() {
      try {
        setReportLoading(true);
        setReportError("");
        const response = await getAdminSalesReport(reportFilters);
        if (isMounted) {
          setSalesReport(getAdminEnvelopeData(response, null));
        }
      } catch (error) {
        if (isMounted) {
          setReportError(getAdminErrorMessage(error, "Không thể tải báo cáo doanh thu."));
        }
      } finally {
        if (isMounted) {
          setReportLoading(false);
        }
      }
    }

    loadSalesReport();

    return () => {
      isMounted = false;
    };
  }, [reportFilters]);

  const metrics = overview?.metrics || {};
  const settings = overview?.settings || [];
  const health = overview?.health || {};
  const auditLogs = overview?.auditLogs || [];

  const settingsMap = useMemo(
    () => Object.fromEntries(settings.map((item) => [item.key, item.value])),
    [settings]
  );

  const reportSummary = salesReport?.summary || {};

  const apiUp = health?.api?.status === "UP";
  const dbUp = health?.database?.status === "UP";
  const aiUp = health?.aiService?.status === "UP";
  const aiVectors = toNumber(health?.aiService?.vectorsCount);
  const paymentMode = String(getSetting(settingsMap, "online_payment_mode", "sandbox")).toLowerCase();
  const shippingMode = String(getSetting(settingsMap, "shipping_mode", "mock")).toLowerCase();
  const monthlyRevenue = toNumber(reportSummary.revenue ?? 0);
  const pendingPayments = toNumber(metrics.pendingPaymentApprovals ?? 0);
  const pendingTickets = toNumber(metrics.pendingTickets ?? 0);
  const lowStockCount = toNumber(metrics.lowStockSkus ?? 0);
  const pendingOrderCount = toNumber(metrics.pendingOrders ?? 0);
  const unassignedTicketCount = toNumber(metrics.unassignedTickets ?? 0);
  const updateReportFilter = (key, value) => {
    setReportFilters((current) => ({ ...current, [key]: value }));
  };
  const refreshSalesReport = () => {
    setReportFilters((current) => ({ ...current }));
  };
  const handleKpiClick = (key) => {
    if (key === "salesReport") {
      setShowSalesReport((current) => !current);
    }
  };

  const paymentHealthy = paymentMode === "sandbox" || paymentMode === "live";
  const healthItems = [
    { label: "API", status: apiUp ? "Hoạt động" : "Gián đoạn", tone: apiUp ? "success" : "danger" },
    { label: "Cơ sở dữ liệu", status: dbUp ? "Hoạt động" : "Gián đoạn", tone: dbUp ? "success" : "danger" },
    { label: "Thanh toán", status: paymentHealthy ? `Sẵn sàng (${paymentMode})` : "Chế độ thử nghiệm", tone: paymentHealthy ? "success" : "warning" },
    {
      label: "Dịch vụ AI",
      status: aiUp
        ? aiVectors > 0
          ? `Hoạt động (${aiVectors} vectors)`
          : "Đang nạp chỉ mục (0 vectors)"
        : "Ngoại tuyến (Fallback)",
      tone: aiUp && aiVectors > 0 ? "success" : "warning"
    }
  ];

  const kpis = [
    {
      label: "Người dùng",
      value: formatAdminNumber(metrics.users),
      hint: "Tài khoản thực trong DB",
      icon: "US",
      accent: "blue",
      to: "/admin/users"
    },
    {
      label: "Sản phẩm",
      value: formatAdminNumber(metrics.products),
      hint: "Catalog đang quản lý",
      icon: "PR",
      accent: "violet",
      to: "/admin/products"
    },
    {
      label: "Đơn hàng",
      value: formatAdminNumber(metrics.orders),
      hint: `${formatAdminNumber(pendingOrderCount)} chờ / đang xử lý`,
      icon: "OD",
      accent: "indigo",
      to: "/staff/orders"
    },
    {
      label: "Doanh thu tháng",
      value: formatCurrency(monthlyRevenue),
      hint: "Theo báo cáo doanh thu thực",
      icon: "RV",
      accent: "emerald",
      key: "salesReport",
      to: "/admin/dashboard"
    },
    {
      label: "Ticket kỹ thuật",
      value: formatAdminNumber(metrics.tickets),
      hint: `${formatAdminNumber(pendingTickets)} đang mở · ${formatAdminNumber(unassignedTicketCount)} chưa nhận`,
      icon: "TK",
      accent: "amber",
      to: "/tech/tickets"
    },
    {
      label: "Thanh toán chuyển khoản",
      value: formatAdminNumber(pendingPayments),
      hint: `Chờ duyệt (${formatAdminNumber(metrics.bankTransferOrders ?? pendingPayments)} tổng QR)`,
      icon: "PM",
      accent: "rose",
      to: "/admin/payment-approval"
    }
  ];

  const alerts = [
    {
      id: "low-stock",
      title: "Sản phẩm sắp hết hàng",
      detail: `${formatAdminNumber(lowStockCount)} SKU cần kiểm tra bổ sung tồn kho (<= 5).`,
      tone: lowStockCount > 0 ? "warning" : "success",
      badgeTone: lowStockCount > 0 ? "warning" : "success",
      badge: "Tồn kho"
    },
    {
      id: "slow-orders",
      title: "Đơn chờ xử lý",
      detail: `${formatAdminNumber(pendingOrderCount)} đơn đang ở trạng thái chờ xử lý / đang xử lý.`,
      tone: pendingOrderCount > 0 ? "info" : "success",
      badgeTone: pendingOrderCount > 0 ? "info" : "success",
      badge: "Đơn hàng"
    },
    {
      id: "unassigned-tickets",
      title: "Ticket chưa ai nhận",
      detail: `${formatAdminNumber(unassignedTicketCount)} ticket kỹ thuật đang chờ phân công.`,
      tone: unassignedTicketCount > 0 ? "danger" : "success",
      badgeTone: unassignedTicketCount > 0 ? "danger" : "success",
      badge: "Helpdesk"
    },
    {
      id: "qr-payments",
      title: "Thanh toán QR chờ duyệt",
      detail: `${formatAdminNumber(pendingPayments)} giao dịch QR Banking chờ xác nhận.`,
      tone: pendingPayments > 0 ? "warning" : "success",
      badgeTone: pendingPayments > 0 ? "warning" : "success",
      badge: "Thanh toán"
    },
    {
      id: "health",
      title: "Kiểm tra hệ thống",
      detail: apiUp && dbUp ? "API và cơ sở dữ liệu đang online." : "Có dịch vụ cần kiểm tra ngay.",
      tone: apiUp && dbUp ? "success" : "danger",
      badgeTone: apiUp && dbUp ? "success" : "danger",
      badge: apiUp && dbUp ? "Ổn định" : "Lỗi"
    }
  ];

  const recentActivity = useMemo(() => {
    const mapped = auditLogs.slice(0, 6).map((log) => ({
      id: log.id,
      title: log.action || "Nhật ký thao tác",
      description: log.description || "Không có mô tả chi tiết.",
      meta: `${log.entityType || "HỆ THỐNG"}${log.entityId ? ` #${log.entityId}` : ""} · ${log.actorRole || "HỆ THỐNG"}`,
      timestamp: log.createdAt
    }));

    if (mapped.length > 0) return mapped;

    return [
      {
        id: "empty-activity",
        title: "Chưa có nhật ký mới",
        description: "Hoạt động mới của đơn hàng, thanh toán, ticket và người dùng sẽ hiển thị tại đây.",
        meta: "HỆ THỐNG",
        timestamp: new Date().toISOString()
      }
    ];
  }, [auditLogs]);

  return (
    <AdminPage className="admin-command-page">
      <AdminDashboardHeader
        healthItems={healthItems}
        settingsMap={settingsMap}
        checkedAt={health?.api?.timestamp || new Date().toISOString()}
      />

      <AdminAlerts errorMessage={errorMessage} />

      <AdminKpiGrid
        loading={loading}
        kpis={kpis}
        activeKey={showSalesReport ? "salesReport" : ""}
        onKpiClick={handleKpiClick}
      />

      <main className="admin-command-main-grid">
        <div className="admin-command-stack">
          {showSalesReport ? (
            <AdminSalesReportPanel
              report={salesReport}
              filters={reportFilters}
              onFilterChange={updateReportFilter}
              onRefresh={refreshSalesReport}
              loading={reportLoading}
              errorMessage={reportError}
            />
          ) : null}
          <AdminModuleGrid modules={MODULES} metrics={metrics} auditLogs={auditLogs} />
        </div>

        <aside className="admin-command-stack">
          <AdminAlertsPanel alerts={alerts} />
          <AdminRecentActivity recentActivity={recentActivity} />
          <AdminSystemSettingsSummary settingsMap={{ ...settingsMap, shipping_mode: shippingMode }} />
        </aside>
      </main>
    </AdminPage>
  );
}
