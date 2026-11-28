import { useEffect, useMemo, useState } from "react";
import {
  AdminAlerts,
  AdminBadge,
  AdminBtn,
  AdminCard,
  AdminEmpty,
  AdminField,
  AdminForm,
  AdminMetric,
  AdminMetrics,
  AdminPage,
  AdminPageHead,
  AdminTableWrap
} from "../../components/admin/AdminUi";
import { createAdminCoupon, getAdminCoupons, updateAdminCoupon } from "../../services/coupon.service";
import { formatAdminNumber, getAdminEnvelopeData, getAdminErrorMessage } from "../../utils/adminUi";

const EMPTY_FORM = {
  code: "",
  name: "",
  description: "",
  discount_type: "FIXED_AMOUNT",
  discount_value: "",
  max_discount_amount: "",
  min_order_value: "0",
  target_type: "ALL",
  usage_limit: "",
  usage_limit_per_user: "1",
  start_date: "",
  end_date: "",
  is_active: true
};

function toDateInputValue(raw) {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function formatVnd(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}₫`;
}

export function AdminCouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadCoupons() {
    try {
      setLoading(true);
      setErrorMessage("");
      const res = await getAdminCoupons();
      const list = getAdminEnvelopeData(res, []);
      setCoupons(Array.isArray(list) ? list : []);
    } catch (err) {
      setErrorMessage(getAdminErrorMessage(err, "Không thể tải danh sách mã giảm giá."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCoupons();
  }, []);

  const filteredCoupons = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    return coupons.filter((c) => {
      const isExpired = c.end_date && new Date(c.end_date).getTime() < now;
      if (statusFilter === "ACTIVE" && (!c.is_active || isExpired)) return false;
      if (statusFilter === "INACTIVE" && c.is_active) return false;
      if (statusFilter === "EXPIRED" && !isExpired) return false;
      if (!q) return true;
      return (
        String(c.code || "").toLowerCase().includes(q) ||
        String(c.name || "").toLowerCase().includes(q) ||
        String(c.description || "").toLowerCase().includes(q)
      );
    });
  }, [coupons, search, statusFilter]);

  const stats = useMemo(() => {
    const now = Date.now();
    const active = coupons.filter((c) => c.is_active && (!c.end_date || new Date(c.end_date).getTime() >= now)).length;
    const totalUsed = coupons.reduce((sum, c) => sum + Number(c.used_count || 0), 0);
    return { total: coupons.length, active, totalUsed };
  }, [coupons]);

  function openCreateDrawer() {
    const today = new Date().toISOString().slice(0, 10);
    const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    setEditingCoupon(null);
    setForm({ ...EMPTY_FORM, start_date: today, end_date: nextMonth });
    setErrorMessage("");
    setDrawerOpen(true);
  }

  function openEditDrawer(coupon) {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code || "",
      name: coupon.name || "",
      description: coupon.description || "",
      discount_type: coupon.discount_type || "FIXED_AMOUNT",
      discount_value: String(coupon.discount_value ?? ""),
      max_discount_amount: coupon.max_discount_amount != null ? String(coupon.max_discount_amount) : "",
      min_order_value: String(coupon.min_order_value ?? 0),
      target_type: coupon.target_type || "ALL",
      usage_limit: coupon.usage_limit != null ? String(coupon.usage_limit) : "",
      usage_limit_per_user: String(coupon.usage_limit_per_user ?? 1),
      start_date: toDateInputValue(coupon.start_date),
      end_date: toDateInputValue(coupon.end_date),
      is_active: Boolean(coupon.is_active)
    });
    setErrorMessage("");
    setDrawerOpen(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.code.trim() || !form.name.trim() || !form.discount_value || !form.start_date || !form.end_date) {
      setErrorMessage("Vui lòng nhập đầy đủ Mã, Tên, Giá trị giảm, Ngày bắt đầu và Ngày kết thúc.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        max_discount_amount: form.max_discount_amount !== "" ? Number(form.max_discount_amount) : null,
        min_order_value: Number(form.min_order_value || 0),
        target_type: form.target_type,
        usage_limit: form.usage_limit !== "" ? Number(form.usage_limit) : null,
        usage_limit_per_user: Number(form.usage_limit_per_user || 1),
        start_date: `${form.start_date}T00:00:00.000Z`,
        end_date: `${form.end_date}T23:59:59.000Z`,
        is_active: Boolean(form.is_active)
      };

      if (editingCoupon) {
        await updateAdminCoupon(editingCoupon.id, payload);
        setSuccessMessage(`Đã cập nhật mã giảm giá ${payload.code}.`);
      } else {
        await createAdminCoupon(payload);
        setSuccessMessage(`Đã tạo mới mã giảm giá ${payload.code}.`);
      }

      setDrawerOpen(false);
      await loadCoupons();
    } catch (err) {
      setErrorMessage(getAdminErrorMessage(err, "Không thể lưu mã giảm giá."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(coupon) {
    try {
      setErrorMessage("");
      setSuccessMessage("");
      await updateAdminCoupon(coupon.id, { is_active: !coupon.is_active });
      setSuccessMessage(`Đã ${coupon.is_active ? "tắt" : "kích hoạt"} mã ${coupon.code}.`);
      await loadCoupons();
    } catch (err) {
      setErrorMessage(getAdminErrorMessage(err, "Không thể đổi trạng thái mã giảm giá."));
    }
  }

  return (
    <AdminPage>
      <AdminPageHead
        eyebrow="Khuyến mãi & Voucher"
        title="Quản lý Mã giảm giá (Coupons)"
        description="Tạo mới, chỉnh sửa điều kiện đơn tối thiểu, giới hạn lượt dùng và bật/tắt mã giảm giá trực tiếp."
        actions={
          <div style={{ display: "flex", gap: 10 }}>
            <AdminBtn variant="secondary" onClick={loadCoupons} disabled={loading}>
              Làm mới
            </AdminBtn>
            <AdminBtn variant="primary" onClick={openCreateDrawer}>
              + Tạo mã giảm giá
            </AdminBtn>
          </div>
        }
      />

      <AdminAlerts errorMessage={errorMessage} successMessage={successMessage} />

      <AdminMetrics>
        <AdminMetric label="Tổng mã giảm giá" value={formatAdminNumber(stats.total)} hint="Tất cả voucher trong DB" />
        <AdminMetric label="Đang hoạt động" value={formatAdminNumber(stats.active)} hint="Còn hạn & đang bật" tone="success" />
        <AdminMetric label="Tổng lượt đã dùng" value={formatAdminNumber(stats.totalUsed)} hint="Đơn hàng đã áp mã" />
      </AdminMetrics>

      <AdminCard title="Danh sách Voucher" description="Lọc theo mã, tên chương trình hoặc trạng thái hiệu lực.">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <input
            type="text"
            placeholder="Tìm theo mã, tên chương trình..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: "1 1 240px", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Đã tắt</option>
            <option value="EXPIRED">Đã hết hạn</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: 28, textAlign: "center", color: "#64748b" }}>Đang tải danh sách mã giảm giá...</div>
        ) : filteredCoupons.length === 0 ? (
          <AdminEmpty>Chưa có mã giảm giá nào khớp bộ lọc. Bấm &quot;+ Tạo mã giảm giá&quot; để thêm voucher mới.</AdminEmpty>
        ) : (
          <AdminTableWrap>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mã Voucher</th>
                  <th>Tên chương trình</th>
                  <th>Mức giảm</th>
                  <th>Đơn tối thiểu</th>
                  <th>Lượt dùng</th>
                  <th>Hiệu lực</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredCoupons.map((c) => {
                  const isExpired = c.end_date && new Date(c.end_date).getTime() < Date.now();
                  return (
                    <tr key={c.id}>
                      <td><strong>{c.code}</strong></td>
                      <td>
                        <div>{c.name}</div>
                        {c.description ? <small style={{ color: "#64748b" }}>{c.description}</small> : null}
                      </td>
                      <td>
                        {c.discount_type === "PERCENTAGE"
                          ? `${Number(c.discount_value || 0)}%${c.max_discount_amount ? ` (tối đa ${formatVnd(c.max_discount_amount)})` : ""}`
                          : formatVnd(c.discount_value)}
                      </td>
                      <td>{formatVnd(c.min_order_value)}</td>
                      <td>
                        {c.used_count || 0} / {c.usage_limit ?? "∞"}
                      </td>
                      <td>
                        <small>
                          {toDateInputValue(c.start_date)} → {toDateInputValue(c.end_date)}
                        </small>
                      </td>
                      <td>
                        {isExpired ? (
                          <AdminBadge tone="warning">Hết hạn</AdminBadge>
                        ) : c.is_active ? (
                          <AdminBadge tone="success">Đang bật</AdminBadge>
                        ) : (
                          <AdminBadge tone="danger">Đã tắt</AdminBadge>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <AdminBtn variant="secondary" onClick={() => openEditDrawer(c)}>
                            Sửa
                          </AdminBtn>
                          <AdminBtn variant={c.is_active ? "danger" : "primary"} onClick={() => handleToggleActive(c)}>
                            {c.is_active ? "Tắt" : "Bật"}
                          </AdminBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </AdminTableWrap>
        )}
      </AdminCard>

      {drawerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            justifyContent: "flex-end",
            zIndex: 1000
          }}
          onClick={() => setDrawerOpen(false)}
        >
          <div
            style={{
              width: "min(520px, 95vw)",
              height: "100%",
              overflowY: "auto",
              background: "#ffffff",
              padding: 24,
              boxShadow: "-8px 0 32px rgba(15, 23, 42, 0.2)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>
                {editingCoupon ? `Chỉnh sửa mã ${editingCoupon.code}` : "Tạo mã giảm giá mới"}
              </h2>
              <AdminBtn variant="secondary" onClick={() => setDrawerOpen(false)}>Đóng</AdminBtn>
            </div>

            <AdminForm onSubmit={handleSubmit}>
              <AdminField label="Mã Voucher (CODE) *">
                <input
                  type="text"
                  value={form.code}
                  disabled={Boolean(editingCoupon)}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="VD: PCMALL500K"
                  required
                />
              </AdminField>

              <AdminField label="Tên chương trình *">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="VD: Giảm 500K build PC gaming"
                  required
                />
              </AdminField>

              <AdminField label="Mô tả">
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </AdminField>

              <AdminField label="Loại giảm giá">
                <select
                  value={form.discount_type}
                  onChange={(e) => setForm((p) => ({ ...p, discount_type: e.target.value }))}
                >
                  <option value="FIXED_AMOUNT">Giảm tiền cố định (VNĐ)</option>
                  <option value="PERCENTAGE">Giảm theo phần trăm (%)</option>
                </select>
              </AdminField>

              <AdminField label={form.discount_type === "PERCENTAGE" ? "Phần trăm giảm (%) *" : "Số tiền giảm (VNĐ) *"}>
                <input
                  type="number"
                  min="1"
                  value={form.discount_value}
                  onChange={(e) => setForm((p) => ({ ...p, discount_value: e.target.value }))}
                  required
                />
              </AdminField>

              <AdminField label="Giảm tối đa (VNĐ, tùy chọn)">
                <input
                  type="number"
                  min="0"
                  value={form.max_discount_amount}
                  onChange={(e) => setForm((p) => ({ ...p, max_discount_amount: e.target.value }))}
                />
              </AdminField>

              <AdminField label="Đơn tối thiểu (VNĐ)">
                <input
                  type="number"
                  min="0"
                  value={form.min_order_value}
                  onChange={(e) => setForm((p) => ({ ...p, min_order_value: e.target.value }))}
                />
              </AdminField>

              <AdminField label="Tổng giới hạn lượt dùng (để trống = không giới hạn)">
                <input
                  type="number"
                  min="1"
                  value={form.usage_limit}
                  onChange={(e) => setForm((p) => ({ ...p, usage_limit: e.target.value }))}
                />
              </AdminField>

              <AdminField label="Giới hạn / mỗi khách">
                <input
                  type="number"
                  min="1"
                  value={form.usage_limit_per_user}
                  onChange={(e) => setForm((p) => ({ ...p, usage_limit_per_user: e.target.value }))}
                />
              </AdminField>

              <AdminField label="Ngày bắt đầu *">
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                  required
                />
              </AdminField>

              <AdminField label="Ngày kết thúc *">
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                  required
                />
              </AdminField>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
                Kích hoạt mã giảm giá ngay
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <AdminBtn type="button" variant="secondary" onClick={() => setDrawerOpen(false)}>
                  Hủy
                </AdminBtn>
                <AdminBtn type="submit" variant="primary" disabled={submitting}>
                  {submitting ? "Đang lưu..." : editingCoupon ? "Lưu thay đổi" : "Tạo mã giảm giá"}
                </AdminBtn>
              </div>
            </AdminForm>
          </div>
        </div>
      ) : null}
    </AdminPage>
  );
}
