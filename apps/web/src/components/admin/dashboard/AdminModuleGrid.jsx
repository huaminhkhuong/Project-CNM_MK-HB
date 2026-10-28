import { AdminBadge, AdminLinkBtn } from "../AdminUi";
import { formatAdminNumber } from "../../../utils/adminUi";

export const DEFAULT_ADMIN_MODULES = [
  {
    to: "/admin/products",
    title: "Sản phẩm",
    desc: "Catalog, trạng thái hiển thị và nhóm sản phẩm.",
    icon: "PR",
    metricKey: "products",
    accent: "blue",
    status: "Ổn định"
  },
  {
    to: "/admin/skus",
    title: "SKU & tồn kho",
    desc: "Phiên bản, giá bán, ảnh và tồn kho.",
    icon: "SKU",
    metricKey: "products",
    accent: "violet",
    status: "Đồng bộ"
  },
  {
    to: "/admin/attributes",
    title: "Thuộc tính",
    desc: "Socket, RAM, chipset và bộ lọc linh kiện.",
    icon: "AT",
    metricKey: "products",
    accent: "indigo",
    status: "Sẵn sàng"
  },
  {
    to: "/admin/users",
    title: "Người dùng",
    desc: "Tài khoản, vai trò và quyền truy cập.",
    icon: "US",
    metricKey: "users",
    accent: "sky",
    status: "Theo dõi"
  },
  {
    to: "/admin/compatibility-rules",
    title: "Luật tương thích",
    desc: "Rule kiểm tra cấu hình PC Builder.",
    icon: "CP",
    metricKey: "products",
    accent: "purple",
    status: "Kỹ thuật"
  },
  {
    to: "/admin/system",
    title: "Hệ thống",
    desc: "Kiểm tra sức khỏe, thiết lập và cấu hình lõi.",
    icon: "SY",
    metricKey: "auditLogs",
    accent: "amber",
    status: "Giám sát"
  },
  {
    to: "/staff/orders",
    title: "Đơn hàng",
    desc: "Workspace xử lý đơn và vận hành bán hàng.",
    icon: "OD",
    metricKey: "orders",
    accent: "emerald",
    status: "Vận hành"
  },
  {
    to: "/admin/dashboard",
    title: "Ticket kỹ thuật",
    desc: "Chỉ số giám sát ticket; xử lý chi tiết thuộc workspace kỹ thuật.",
    icon: "TK",
    metricKey: "tickets",
    accent: "fuchsia",
    status: "Helpdesk"
  },
  {
    to: "/tech/warranties",
    title: "Duyệt bảo hành",
    desc: "Hồ sơ bảo hành và tiến trình kỹ thuật.",
    icon: "WR",
    metricKey: "tickets",
    accent: "rose",
    status: "Bảo hành"
  }
];

export function AdminModuleGrid({ modules = DEFAULT_ADMIN_MODULES, metrics = {}, auditLogs = [] }) {
  return (
    <section className="admin-command-card">
      <div className="admin-command-card__head">
        <div>
          <h2>Truy cập nhanh module</h2>
          <p>Mở nhanh khu vực quản trị chính, kèm số liệu liên quan.</p>
        </div>
        <AdminBadge tone="success">Sẵn sàng</AdminBadge>
      </div>

      <div className="admin-command-module-grid">
        {modules.map((module) => {
          const metric = module.metricKey === "auditLogs" ? auditLogs.length : metrics[module.metricKey];

          return (
            <article key={module.to} className="admin-command-module">
              <div className="admin-command-module__top">
                <span className={`admin-command-module__icon admin-command-module__icon--${module.accent}`}>{module.icon}</span>
                <AdminBadge tone="neutral">{module.status}</AdminBadge>
              </div>
              <div>
                <h3>{module.title}</h3>
                <p>{module.desc}</p>
              </div>
              <div className="admin-command-module__foot">
                <strong>{formatAdminNumber(metric)} mục</strong>
                <AdminLinkBtn to={module.to} variant="secondary">Mở</AdminLinkBtn>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
