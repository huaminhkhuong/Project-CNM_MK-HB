import { useEffect, useMemo, useRef, useState } from "react";

import { AdminAlerts, AdminPage, useAdminToast } from "../../components/admin/AdminUi";
import {
  createAdminAttribute,
  createAdminAttributeValue,
  deleteAdminAttribute,
  deleteAdminAttributeValue,
  getAdminAttributes,
  updateAdminAttribute,
  updateAdminAttributeValue
} from "../../services/admin-attributes.service";
import { formatAdminNumber, getAdminErrorMessage, normalizeAdminList } from "../../utils/adminUi";
import "../../styles/admin-ai-studio.css";
import "../../styles/admin-catalog-studio.css";

const PAGE_SIZE = 24;

export function AdminAttributesPage() {
  const [attributes, setAttributes] = useState([]);
  const [attributeName, setAttributeName] = useState("");
  const [editingAttributeId, setEditingAttributeId] = useState(null);
  const [valueForm, setValueForm] = useState({ attributeId: "", value: "" });
  const [editingValueId, setEditingValueId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Search, filter, sort & pagination for 2,690+ attributes
  const [searchKeyword, setSearchKeyword] = useState("");
  const [densityFilter, setDensityFilter] = useState("all"); // all | rich | compact | empty
  const [sortBy, setSortBy] = useState("name"); // name | values_desc | newest
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedAttrIds, setExpandedAttrIds] = useState({});

  const attrInputRef = useRef(null);
  const valueInputRef = useRef(null);

  useAdminToast(successMessage, () => setSuccessMessage(""));

  const totalValues = useMemo(
    () => attributes.reduce((sum, a) => sum + (a.values?.length || 0), 0),
    [attributes]
  );

  const avgValues = useMemo(
    () => (attributes.length ? (totalValues / attributes.length).toFixed(1) : "0.0"),
    [attributes.length, totalValues]
  );

  const filteredAttributes = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    const list = attributes.filter((attr) => {
      const count = attr.values?.length || 0;
      if (densityFilter === "rich" && count < 3) return false;
      if (densityFilter === "compact" && (count === 0 || count >= 3)) return false;
      if (densityFilter === "empty" && count !== 0) return false;
      if (!q) return true;
      if (String(attr.name || "").toLowerCase().includes(q)) return true;
      return (attr.values || []).some((v) => String(v.value || "").toLowerCase().includes(q));
    });

    const sorted = [...list];
    if (sortBy === "values_desc") {
      sorted.sort((a, b) => (b.values?.length || 0) - (a.values?.length || 0));
    } else if (sortBy === "newest") {
      sorted.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    } else {
      sorted.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "vi"));
    }
    return sorted;
  }, [attributes, searchKeyword, densityFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredAttributes.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedAttributes = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredAttributes.slice(start, start + PAGE_SIZE);
  }, [filteredAttributes, safePage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword, densityFilter, sortBy]);

  async function loadAttributes() {
    try {
      setLoading(true);
      const response = await getAdminAttributes();
      setAttributes(normalizeAdminList(response));
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể tải thuộc tính."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAttributes();
  }, []);

  function resetAttributeForm() {
    setAttributeName("");
    setEditingAttributeId(null);
  }

  function resetValueForm() {
    setValueForm({ attributeId: "", value: "" });
    setEditingValueId(null);
  }

  async function handleSubmitAttribute(event) {
    event.preventDefault();
    if (!attributeName.trim()) {
      setErrorMessage("Vui lòng nhập tên thuộc tính.");
      return;
    }
    try {
      setSubmitting(true);
      setErrorMessage("");
      if (editingAttributeId) {
        await updateAdminAttribute(editingAttributeId, { name: attributeName.trim() });
        setSuccessMessage("Đã cập nhật thuộc tính thành công.");
      } else {
        await createAdminAttribute({ name: attributeName.trim() });
        setSuccessMessage("Đã tạo thuộc tính mới thành công.");
      }
      resetAttributeForm();
      await loadAttributes();
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể lưu thuộc tính."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitValue(event) {
    event.preventDefault();
    if (!valueForm.attributeId || !String(valueForm.value || "").trim()) {
      setErrorMessage("Vui lòng chọn thuộc tính và nhập giá trị.");
      return;
    }
    try {
      setSubmitting(true);
      setErrorMessage("");
      const payload = { attributeId: Number(valueForm.attributeId), value: valueForm.value.trim() };
      if (editingValueId) {
        await updateAdminAttributeValue(editingValueId, payload);
        setSuccessMessage("Đã cập nhật giá trị thuộc tính.");
      } else {
        await createAdminAttributeValue(payload);
        setSuccessMessage("Đã thêm giá trị mới cho thuộc tính.");
      }
      resetValueForm();
      await loadAttributes();
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể lưu giá trị."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteAttribute(attr) {
    if (!window.confirm(`Bạn có chắc muốn xóa thuộc tính "${attr.name}" cùng các giá trị liên quan?`)) {
      return;
    }
    try {
      setErrorMessage("");
      await deleteAdminAttribute(attr.id);
      if (editingAttributeId === attr.id) resetAttributeForm();
      setSuccessMessage(`Đã xóa thuộc tính "${attr.name}".`);
      await loadAttributes();
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể xóa thuộc tính (có thể đang được gắn vào SKU)."));
    }
  }

  async function handleDeleteValue(val) {
    if (!window.confirm(`Xóa giá trị "${val.value}" khỏi thuộc tính này?`)) {
      return;
    }
    try {
      setErrorMessage("");
      await deleteAdminAttributeValue(val.id);
      if (editingValueId === val.id) resetValueForm();
      setSuccessMessage(`Đã xóa giá trị "${val.value}".`);
      await loadAttributes();
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể xóa giá trị (có thể đang được dùng trên SKU)."));
    }
  }

  function handleQuickAddValueFor(attr) {
    setEditingValueId(null);
    setValueForm({ attributeId: String(attr.id), value: "" });
    window.scrollTo({ top: 180, behavior: "smooth" });
    setTimeout(() => valueInputRef.current?.focus(), 220);
  }

  return (
    <AdminPage>
      <div className="cat-studio-shell">
        {/* ==================== EXECUTIVE SPEC MATRIX HERO ==================== */}
        <section className="ai-studio-hero">
          <div className="ai-studio-hero-top">
            <div>
              <div className="ai-studio-hero-badges">
                <span className="ai-studio-live-pill">
                  <span className="ai-studio-live-dot" />
                  Dynamic Hardware Spec Matrix
                </span>
                <span className="ai-studio-tech-pill">Faceted Search • SKU • PC Builder XAI</span>
              </div>
              <h1 className="ai-studio-hero-title">Kho Thuộc Tính Động &amp; Giá Trị Kỹ Thuật</h1>
              <p className="ai-studio-hero-desc">
                Quản trị thông số kỹ thuật chuẩn hóa (Socket, Chuẩn RAM, Chipset, Bus, Công suất PSU…) phục vụ trực tiếp cho bộ lọc đa chiều, biến thể SKU và động cơ kiểm tra tương thích PC Builder.
              </p>
            </div>
          </div>

          <div className="ai-studio-kpi-grid">
            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#38bdf8" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Tổng thuộc tính</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value">{formatAdminNumber(attributes.length)}</div>
              <div className="ai-studio-kpi-hint">Nhóm thông số phần cứng</div>
            </div>

            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#a78bfa" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Tổng giá trị</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value">{formatAdminNumber(totalValues)}</div>
              <div className="ai-studio-kpi-hint">Giá trị định chuẩn trong DB</div>
            </div>

            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#34d399" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Mật độ trung bình</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value" style={{ color: "#6ee7b7" }}>{avgValues}</div>
              <div className="ai-studio-kpi-hint">Giá trị / thuộc tính</div>
            </div>

            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#fbbf24" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Kết quả hiển thị</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value">{formatAdminNumber(filteredAttributes.length)}</div>
              <div className="ai-studio-kpi-hint">Trang {safePage} / {totalPages} ({PAGE_SIZE}/trang)</div>
            </div>
          </div>
        </section>

        <AdminAlerts errorMessage={errorMessage} successMessage={successMessage} />

        {/* ==================== DUAL QUICK-CREATE COMMAND BAR ==================== */}
        <div className="attr-create-bar">
          {/* Card 1: Thêm / Sửa Thuộc Tính */}
          <section className="ai-studio-panel">
            <div className="ai-studio-panel-head" style={{ padding: "14px 18px" }}>
              <div className="ai-studio-panel-title-wrap">
                <span className="ai-studio-panel-icon" style={{ width: 34, height: 34, background: "#eff6ff", color: "#2563eb", border: "1px solid #dbeafe" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M12 5v14M5 12h14" /></svg>
                </span>
                <div>
                  <h3 className="ai-studio-panel-title" style={{ fontSize: 14.5 }}>
                    {editingAttributeId ? "Chỉnh Sửa Tên Thuộc Tính" : "Thêm Thuộc Tính Mới"}
                  </h3>
                  <p className="ai-studio-panel-sub">Tạo nhóm thông số kỹ thuật mới (VD: Socket, Chipset, Bus RAM)</p>
                </div>
              </div>
              {editingAttributeId && (
                <button type="button" className="cat-btn-clear" style={{ padding: "5px 10px" }} onClick={resetAttributeForm}>
                  Hủy sửa
                </button>
              )}
            </div>
            <div className="ai-studio-panel-body" style={{ padding: "14px 18px" }}>
              <form onSubmit={handleSubmitAttribute} className="attr-inline-form">
                <input
                  ref={attrInputRef}
                  className="cat-input"
                  style={{ flex: 1, minWidth: 180 }}
                  value={attributeName}
                  onChange={(e) => setAttributeName(e.target.value)}
                  placeholder="Ví dụ: Socket, Chuẩn RAM, Công suất nguồn..."
                />
                <button
                  type="submit"
                  className="cat-btn-dark"
                  style={{ background: "linear-gradient(135deg, #2563eb, #4f46e5)" }}
                  disabled={submitting}
                >
                  {editingAttributeId ? "Lưu Cập Nhật" : "Thêm Thuộc Tính"}
                </button>
              </form>
            </div>
          </section>

          {/* Card 2: Thêm / Sửa Giá Trị */}
          <section className="ai-studio-panel">
            <div className="ai-studio-panel-head" style={{ padding: "14px 18px" }}>
              <div className="ai-studio-panel-title-wrap">
                <span className="ai-studio-panel-icon" style={{ width: 34, height: 34, background: "#ecfdf5", color: "#059669", border: "1px solid #bbf7d0" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                </span>
                <div>
                  <h3 className="ai-studio-panel-title" style={{ fontSize: 14.5 }}>
                    {editingValueId ? "Chỉnh Sửa Giá Trị Thuộc Tính" : "Gắn Giá Trị Cho Thuộc Tính"}
                  </h3>
                  <p className="ai-studio-panel-sub">Chọn thuộc tính (hoặc bấm "+ Giá trị" trên thẻ bên dưới) để thêm nhanh</p>
                </div>
              </div>
              {editingValueId && (
                <button type="button" className="cat-btn-clear" style={{ padding: "5px 10px" }} onClick={resetValueForm}>
                  Hủy sửa
                </button>
              )}
            </div>
            <div className="ai-studio-panel-body" style={{ padding: "14px 18px" }}>
              <form onSubmit={handleSubmitValue} className="attr-inline-form">
                <select
                  className="cat-select"
                  style={{ flex: "1 1 170px", minWidth: 150 }}
                  value={valueForm.attributeId}
                  onChange={(e) => setValueForm((p) => ({ ...p, attributeId: e.target.value }))}
                >
                  <option value="">Chọn thuộc tính...</option>
                  {attributes.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <input
                  ref={valueInputRef}
                  className="cat-input"
                  style={{ flex: "1.1 1 160px", minWidth: 150 }}
                  value={valueForm.value}
                  onChange={(e) => setValueForm((p) => ({ ...p, value: e.target.value }))}
                  placeholder="Ví dụ: LGA1700, AM5, DDR5..."
                />
                <button
                  type="submit"
                  className="cat-btn-dark"
                  style={{ background: "linear-gradient(135deg, #059669, #0d9488)" }}
                  disabled={submitting}
                >
                  {editingValueId ? "Cập Nhật" : "Thêm Giá Trị"}
                </button>
              </form>
            </div>
          </section>
        </div>

        {/* ==================== FULL-WIDTH ATTRIBUTES REPOSITORY ==================== */}
        <section className="ai-studio-panel">
          <div className="ai-studio-panel-head">
            <div className="ai-studio-panel-title-wrap">
              <span className="ai-studio-panel-icon" style={{ background: "#f5f3ff", color: "#6d28d9", border: "1px solid #ede9fe" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>
              </span>
              <div>
                <h3 className="ai-studio-panel-title">
                  Danh Sách Thuộc Tính &amp; Giá Trị{" "}
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", marginLeft: 4 }}>
                    {formatAdminNumber(filteredAttributes.length)} thuộc tính
                  </span>
                </h3>
                <p className="ai-studio-panel-sub">Tìm kiếm tức thì theo tên thuộc tính hoặc giá trị kỹ thuật — hiển thị gọn 24 mục mỗi trang</p>
              </div>
            </div>
          </div>

          {/* Search, Density Pills & Sort Bar */}
          <div className="cat-toolbar">
            <div className="cat-search-wrap">
              <svg className="cat-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="cat-input cat-input--search"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm nhanh thuộc tính hoặc giá trị (VD: Socket, DDR5, PCIe, TDP)..."
              />
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { id: "all", label: "Tất cả" },
                { id: "rich", label: "Nhiều giá trị (≥3)" },
                { id: "compact", label: "Ít giá trị (1–2)" },
                { id: "empty", label: "Chưa có giá trị" }
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setDensityFilter(pill.id)}
                  style={{
                    padding: "7px 11px",
                    borderRadius: 999,
                    border: densityFilter === pill.id ? "1px solid #0f172a" : "1px solid #e2e8f0",
                    background: densityFilter === pill.id ? "#0f172a" : "#ffffff",
                    color: densityFilter === pill.id ? "#ffffff" : "#475569",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <select
              className="cat-select"
              style={{ flex: "0 1 190px", minWidth: 165 }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name">Sắp xếp: Tên A → Z</option>
              <option value="values_desc">Nhiều giá trị nhất</option>
              <option value="newest">Mới tạo gần đây</option>
            </select>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "56px 24px", color: "#64748b", fontSize: 13.5 }}>
              Đang nạp danh sách thuộc tính động...
            </div>
          ) : paginatedAttributes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 24px", color: "#64748b" }}>
              <strong style={{ display: "block", fontSize: 15, color: "#0f172a", marginBottom: 4 }}>
                Không tìm thấy thuộc tính nào phù hợp
              </strong>
              <span style={{ fontSize: 13 }}>Thử từ khóa khác hoặc chuyển bộ lọc về "Tất cả".</span>
            </div>
          ) : (
            <>
              <div className="attr-grid">
                {paginatedAttributes.map((attribute) => {
                  const vals = attribute.values || [];
                  const isExpanded = Boolean(expandedAttrIds[attribute.id]);
                  const visibleVals = isExpanded ? vals : vals.slice(0, 10);
                  const hiddenCount = vals.length - visibleVals.length;

                  return (
                    <div
                      key={attribute.id}
                      className={`attr-card${editingAttributeId === attribute.id ? " is-editing" : ""}`}
                    >
                      <div className="attr-card-head">
                        <div className="attr-card-title-wrap">
                          <h4 className="attr-card-title">{attribute.name}</h4>
                          <div className="attr-card-meta">
                            <span style={{
                              padding: "1px 8px",
                              borderRadius: 999,
                              background: vals.length > 0 ? "#eff6ff" : "#f1f5f9",
                              color: vals.length > 0 ? "#1d4ed8" : "#64748b",
                              fontWeight: 700,
                              fontSize: 11
                            }}>
                              {vals.length} giá trị
                            </span>
                            <span>ID #{attribute.id}</span>
                          </div>
                        </div>

                        <div className="attr-card-actions">
                          <button
                            type="button"
                            className="ai-action-btn ai-action-btn--ghost"
                            style={{ padding: "5px 9px", fontSize: 11.5 }}
                            onClick={() => handleQuickAddValueFor(attribute)}
                            title="Thêm nhanh giá trị cho thuộc tính này"
                          >
                            + Giá trị
                          </button>
                          <button
                            type="button"
                            className="ai-action-btn ai-action-btn--ghost"
                            style={{ padding: "5px 9px", fontSize: 11.5 }}
                            onClick={() => {
                              setEditingAttributeId(attribute.id);
                              setAttributeName(attribute.name);
                              window.scrollTo({ top: 180, behavior: "smooth" });
                              setTimeout(() => attrInputRef.current?.focus(), 220);
                            }}
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            className="ai-action-btn ai-action-btn--danger"
                            style={{ padding: "5px 9px", fontSize: 11.5 }}
                            onClick={() => handleDeleteAttribute(attribute)}
                          >
                            Xóa
                          </button>
                        </div>
                      </div>

                      {vals.length === 0 ? (
                        <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>
                          Chưa có giá trị nào — bấm "+ Giá trị" để bổ sung.
                        </div>
                      ) : (
                        <div className="attr-values-wrap">
                          {visibleVals.map((val) => (
                            <span key={val.id} className="attr-value-chip">
                              <span className="attr-value-text">{val.value}</span>
                              <span className="attr-chip-btns">
                                <button
                                  type="button"
                                  className="attr-chip-btn"
                                  title="Sửa giá trị"
                                  onClick={() => {
                                    setEditingValueId(val.id);
                                    setValueForm({ attributeId: String(attribute.id), value: val.value });
                                    window.scrollTo({ top: 180, behavior: "smooth" });
                                    setTimeout(() => valueInputRef.current?.focus(), 220);
                                  }}
                                >
                                  ✎
                                </button>
                                <button
                                  type="button"
                                  className="attr-chip-btn attr-chip-btn--del"
                                  title="Xóa giá trị"
                                  onClick={() => handleDeleteValue(val)}
                                >
                                  ×
                                </button>
                              </span>
                            </span>
                          ))}

                          {hiddenCount > 0 && (
                            <button
                              type="button"
                              className="cat-warranty-chip"
                              onClick={() => setExpandedAttrIds((prev) => ({ ...prev, [attribute.id]: true }))}
                            >
                              + Xem thêm {hiddenCount} giá trị
                            </button>
                          )}
                          {isExpanded && vals.length > 10 && (
                            <button
                              type="button"
                              className="cat-warranty-chip"
                              onClick={() => setExpandedAttrIds((prev) => ({ ...prev, [attribute.id]: false }))}
                            >
                              Thu gọn
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination Footer */}
              <div className="cat-pagination">
                <span>
                  Trang <strong style={{ color: "#0f172a" }}>{safePage}</strong> /{" "}
                  <strong style={{ color: "#0f172a" }}>{totalPages}</strong> • Hiển thị{" "}
                  <strong style={{ color: "#0f172a" }}>{paginatedAttributes.length}</strong> /{" "}
                  <strong style={{ color: "#0f172a" }}>{formatAdminNumber(filteredAttributes.length)}</strong> thuộc tính
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="ai-action-btn ai-action-btn--ghost"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    style={{ opacity: safePage <= 1 ? 0.45 : 1 }}
                  >
                    ← Trang trước
                  </button>
                  <button
                    type="button"
                    className="ai-action-btn ai-action-btn--ghost"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    style={{ opacity: safePage >= totalPages ? 0.45 : 1 }}
                  >
                    Trang sau →
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </AdminPage>
  );
}
