import { AdminBadge, AdminLinkBtn } from "../AdminUi";
import { formatAdminDateTime } from "../../../utils/adminUi";

const SETTING_KEYS = [
  "store_name",
  "support_email",
  "support_phone",
  "online_payment_mode",
  "shipping_mode"
];

function getSetting(settingsMap, key, fallback = "Chưa cấu hình") {
  const value = settingsMap?.[key];
  return value === undefined || value === null || value === "" ? fallback : value;
}

export function AdminAlertsPanel({ alerts = [] }) {
  return (
    <section className="admin-command-card admin-command-sticky">
      <div className="admin-command-card__head">
        <div>
          <h2>Cảnh báo vận hành</h2>
          <p>Ưu tiên xử lý trong ngày.</p>
        </div>
      </div>
      <div className="admin-command-alerts">
        {alerts.map((alert) => (
          <article key={alert.id} className={`admin-command-alert admin-command-alert--${alert.tone}`}>
            <div>
              <strong>{alert.title}</strong>
              <span>{alert.detail}</span>
            </div>
            <AdminBadge tone={alert.badgeTone}>{alert.badge}</AdminBadge>
          </article>
        ))}
      </div>
    </section>
  );
}

export function AdminRecentActivity({ recentActivity = [] }) {
  return (
    <section className="admin-command-card">
      <div className="admin-command-card__head">
        <div>
          <h2>Hoạt động gần đây</h2>
          <p>Nhật ký thao tác và hoạt động mới nhất.</p>
        </div>
      </div>
      {recentActivity.length ? (
        <div className="admin-command-timeline">
          {recentActivity.map((item) => (
            <article key={item.id} className="admin-command-timeline__item">
              <span className="admin-command-timeline__dot" />
              <div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
                <small>{item.meta} · {formatAdminDateTime(item.timestamp)}</small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-command-empty">Chưa có hoạt động gần đây.</div>
      )}
    </section>
  );
}

export function AdminSystemSettingsSummary({ settingsMap = {} }) {
  const items = SETTING_KEYS.map((key) => ({
    key,
    value: getSetting(settingsMap, key)
  }));

  return (
    <section className="admin-command-card">
      <div className="admin-command-card__head">
        <div>
          <h2>Cấu hình hệ thống</h2>
          <p>Cấu hình vận hành quan trọng.</p>
        </div>
        <AdminLinkBtn to="/admin/system" variant="secondary">Sửa</AdminLinkBtn>
      </div>
      <div className="admin-command-settings">
        {items.map((item) => (
          <div key={item.key} className="admin-command-setting-row">
            <span>{item.key}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
