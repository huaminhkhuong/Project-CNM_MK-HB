import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  AdminAlerts,
  AdminBadge,
  AdminBtn,
  AdminCard,
  AdminEmpty,
  AdminField,
  AdminForm,
  AdminLinkBtn,
  AdminPage,
  AdminPageHead,
  AdminTableWrap,
  AdminWorkspace,
  useAdminToast
} from "../../components/admin/AdminUi";
import {
  changeAdminCompatibilityRuleStatus,
  createAdminCompatibilityRule,
  getAdminCompatibilityRules,
  updateAdminCompatibilityRule
} from "../../services/admin-compatibility.service";
import { getAdminErrorMessage, normalizeAdminList } from "../../utils/adminUi";

const COMPONENT_OPTIONS = ["CPU", "MAINBOARD", "RAM", "GPU", "STORAGE", "SSD", "HDD", "PSU", "CASE", "COOLING"];
const RULE_TYPE_OPTIONS = ["ATTRIBUTE_MATCH", "ATTRIBUTE_NOT_MATCH"];

function createInitialFormState() {
  return {
    name: "",
    sourceComponentType: "CPU",
    targetComponentType: "MAINBOARD",
    ruleType: "ATTRIBUTE_MATCH",
    sourceAttributeKey: "socket",
    targetAttributeKey: "socket",
    description: ""
  };
}

function normalizeRule(rule) {
  return {
    id: rule?.id,
    name: rule?.name || rule?.description || "Rule",
    sourceComponentType: String(rule?.sourceComponentType || rule?.source_component_type || "").toUpperCase(),
    targetComponentType: String(rule?.targetComponentType || rule?.target_component_type || "").toUpperCase(),
    ruleType: String(rule?.ruleType || rule?.rule_type || "ATTRIBUTE_MATCH").toUpperCase(),
    sourceAttributeKey: rule?.sourceAttributeKey || rule?.source_attribute_key || "",
    targetAttributeKey: rule?.targetAttributeKey || rule?.target_attribute_key || "",
    description: rule?.description || "",
    status: String(rule?.status || "ACTIVE").toUpperCase()
  };
}

function validateForm(values) {
  const errors = {};
  if (!String(values.name || "").trim()) errors.name = "Nhập tên rule.";
  if (!String(values.ruleType || "").trim()) errors.ruleType = "Chọn loại rule.";
  if (!String(values.sourceAttributeKey || "").trim()) errors.sourceAttributeKey = "Nhập source key.";
  if (!String(values.targetAttributeKey || "").trim()) errors.targetAttributeKey = "Nhập target key.";
  return errors;
}

export function AdminCompatibilityRulesPage() {
  const [rules, setRules] = useState([]);
  const [formValues, setFormValues] = useState(createInitialFormState());
  const [formErrors, setFormErrors] = useState({});
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useAdminToast(successMessage, () => setSuccessMessage(""));

  const sortedRules = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    return [...rules]
      .filter((r) => {
        if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
        if (!q) return true;
        return [
          r.name,
          r.sourceComponentType,
          r.targetComponentType,
          r.sourceAttributeKey,
          r.targetAttributeKey,
          r.description
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  }, [rules, searchKeyword, statusFilter]);

  useEffect(() => {
    async function loadRules() {
      try {
        setLoading(true);
        const response = await getAdminCompatibilityRules();
        setRules(normalizeAdminList(response).map(normalizeRule));
      } catch (error) {
        setErrorMessage(getAdminErrorMessage(error, "Không thể tải rules."));
      } finally {
        setLoading(false);
      }
    }
    loadRules();
  }, []);

  function resetForm() {
    setFormValues(createInitialFormState());
    setFormErrors({});
    setEditingRuleId(null);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function handleEditRule(rule) {
    setEditingRuleId(rule.id);
    setFormValues({
      name: rule.name,
      sourceComponentType: rule.sourceComponentType,
      targetComponentType: rule.targetComponentType,
      ruleType: rule.ruleType,
      sourceAttributeKey: rule.sourceAttributeKey,
      targetAttributeKey: rule.targetAttributeKey,
      description: rule.description
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateForm(formValues);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      setSubmitting(true);
      const payload = {
        name: formValues.name.trim(),
        sourceComponentType: formValues.sourceComponentType,
        targetComponentType: formValues.targetComponentType,
        ruleType: formValues.ruleType,
        sourceAttributeKey: formValues.sourceAttributeKey.trim(),
        targetAttributeKey: formValues.targetAttributeKey.trim(),
        description: String(formValues.description || "").trim()
      };
      const response = editingRuleId
        ? await updateAdminCompatibilityRule(editingRuleId, payload)
        : await createAdminCompatibilityRule(payload);
      const saved = normalizeRule(response?.data || response);
      setRules((prev) => (editingRuleId ? prev.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...prev]));
      setSuccessMessage(editingRuleId ? "Đã cập nhật rule." : "Đã tạo rule.");
      resetForm();
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể lưu rule."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(rule) {
    const nextStatus = rule.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      setStatusLoadingId(rule.id);
      const response = await changeAdminCompatibilityRuleStatus(rule.id, nextStatus);
      const updated = normalizeRule(response?.data || response);
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setSuccessMessage(`Rule #${rule.id} → ${nextStatus}`);
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể đổi trạng thái."));
    } finally {
      setStatusLoadingId(null);
    }
  }

  return (
    <AdminPage>
      <AdminPageHead
        eyebrow="PC Builder"
        title="Luật tương thích linh kiện"
        description="Định nghĩa quy tắc khớp socket, RAM, PSU… áp dụng khi khách dùng trình dựng cấu hình."
        actions={
          <>
            <AdminLinkBtn to="/pc-builder" variant="secondary">
              Mở PC Builder
            </AdminLinkBtn>
            <Link to="/tech/compatibility" className="admin-btn admin-btn--secondary">
              Xem (Tech)
            </Link>
          </>
        }
      />

      <AdminAlerts errorMessage={errorMessage} successMessage={successMessage} />

      <AdminWorkspace columns="form-list">
        <AdminCard>
          <div className="admin-panel-head">
            <div className="admin-section-title">
              <h3>{editingRuleId ? `Sửa rule #${editingRuleId}` : "Thêm rule"}</h3>
              <p>Cặp linh kiện nguồn → đích và khóa thuộc tính cần so khớp.</p>
            </div>
            {editingRuleId ? (
              <AdminBtn variant="secondary" onClick={resetForm}>
                Tạo mới
              </AdminBtn>
            ) : null}
          </div>
          <AdminForm onSubmit={handleSubmit}>
            <AdminField label="Tên rule" htmlFor="name" error={formErrors.name}>
              <input id="name" name="name" className="admin-input" value={formValues.name} onChange={handleFormChange} />
            </AdminField>
            <div className="admin-form admin-form--grid">
              <AdminField label="Linh kiện nguồn" htmlFor="sourceComponentType">
                <select id="sourceComponentType" name="sourceComponentType" className="admin-input" value={formValues.sourceComponentType} onChange={handleFormChange}>
                  {COMPONENT_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Linh kiện đích" htmlFor="targetComponentType">
                <select id="targetComponentType" name="targetComponentType" className="admin-input" value={formValues.targetComponentType} onChange={handleFormChange}>
                  {COMPONENT_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Loại rule" htmlFor="ruleType" error={formErrors.ruleType}>
                <select id="ruleType" name="ruleType" className="admin-input" value={formValues.ruleType} onChange={handleFormChange}>
                  {RULE_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Source key" htmlFor="sourceAttributeKey" error={formErrors.sourceAttributeKey}>
                <input id="sourceAttributeKey" name="sourceAttributeKey" className="admin-input" value={formValues.sourceAttributeKey} onChange={handleFormChange} />
              </AdminField>
              <AdminField label="Target key" htmlFor="targetAttributeKey" error={formErrors.targetAttributeKey} span>
                <input id="targetAttributeKey" name="targetAttributeKey" className="admin-input" value={formValues.targetAttributeKey} onChange={handleFormChange} />
              </AdminField>
              <AdminField label="Mô tả" htmlFor="description" span>
                <textarea id="description" name="description" className="admin-input" rows={4} value={formValues.description} onChange={handleFormChange} />
              </AdminField>
            </div>
            <AdminBtn type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Đang lưu…" : editingRuleId ? "Cập nhật" : "Thêm rule"}
            </AdminBtn>
          </AdminForm>
        </AdminCard>

        <AdminCard>
          <div className="admin-panel-head" style={{ marginBottom: 14 }}>
            <div className="admin-section-title">
              <h3>Danh sách ({sortedRules.length})</h3>
              <p>Bật/tắt rule để kiểm soát PC Builder ngay lập tức.</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                className="admin-input"
                placeholder="Tìm tên rule, linh kiện, key..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                style={{ minWidth: 200 }}
              />
              <select
                className="admin-input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: 130 }}
              >
                <option value="ALL">Tất cả</option>
                <option value="ACTIVE">Đang bật</option>
                <option value="INACTIVE">Đang tắt</option>
              </select>
            </div>
          </div>
          {loading ? (
            <AdminEmpty>Đang tải…</AdminEmpty>
          ) : sortedRules.length === 0 ? (
            <AdminEmpty>Chưa có rule.</AdminEmpty>
          ) : (
            <AdminTableWrap>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Cặp linh kiện</th>
                    <th>Keys</th>
                    <th>Trạng thái</th>
                    <th>Tác vụ</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRules.map((rule) => (
                    <tr key={rule.id}>
                      <td>
                        <strong>#{rule.id} {rule.name}</strong>
                        <div style={{ color: "#64748b", fontSize: 13 }}>{rule.description || "—"}</div>
                      </td>
                      <td>
                        {rule.sourceComponentType} → {rule.targetComponentType}
                        <div style={{ fontSize: 13, color: "#64748b" }}>{rule.ruleType}</div>
                      </td>
                      <td>
                        {rule.sourceAttributeKey} ↔ {rule.targetAttributeKey}
                      </td>
                      <td>
                        <AdminBadge tone={rule.status === "ACTIVE" ? "success" : "neutral"}>{rule.status}</AdminBadge>
                      </td>
                      <td>
                        <div className="admin-action-row">
                          <AdminBtn variant="secondary" onClick={() => handleEditRule(rule)}>
                            Sửa
                          </AdminBtn>
                          <AdminBtn variant="secondary" disabled={statusLoadingId === rule.id} onClick={() => handleToggleStatus(rule)}>
                            {rule.status === "ACTIVE" ? "Tắt" : "Bật"}
                          </AdminBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTableWrap>
          )}
        </AdminCard>
      </AdminWorkspace>
    </AdminPage>
  );
}
