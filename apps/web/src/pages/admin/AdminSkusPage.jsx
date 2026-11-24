import { useEffect, useMemo, useState } from "react";

import { AdminAlerts, AdminPage, useAdminToast } from "../../components/admin/AdminUi";
import { getAdminAttributes } from "../../services/admin-attributes.service";
import { formatAdminNumber, getAdminErrorMessage, normalizeAdminList } from "../../utils/adminUi";
import {
  createAdminSku,
  deleteAdminSku,
  getAdminSkuDetail,
  getAdminSkus,
  updateAdminSku
} from "../../services/admin-skus.service";
import { getAdminProducts } from "../../services/admin-products.service";
import "../../styles/admin-ai-studio.css";
import "../../styles/admin-catalog-studio.css";

const PAGE_SIZE = 25;

function createInitialSkuForm() {
  return {
    productId: "",
    sku: "",
    price: "",
    stock: "",
    warrantyMonths: "",
    imageUrl: "",
    status: "ACTIVE",
    attributeValueIds: []
  };
}

function replaceAttributeSelection(currentIds, attribute, nextValueId) {
  const cleaned = currentIds.filter(
    (valueId) => !(attribute.values || []).some((value) => Number(value.id) === Number(valueId))
  );
  if (!nextValueId) return cleaned;
  return [...cleaned, Number(nextValueId)];
}

function getSkuStatusLabel(status) {
  return String(status || "").toUpperCase() === "ACTIVE" ? "Đang bán" : "Ngừng bán";
}

export function AdminSkusPage() {
  const [skus, setSkus] = useState([]);
  const [products, setProducts] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | ACTIVE | INACTIVE | LOW_STOCK
  const [currentPage, setCurrentPage] = useState(1);

  // Slide-over drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [formValues, setFormValues] = useState(createInitialSkuForm());
  const [editingSkuId, setEditingSkuId] = useState(null);
  const [attrPickerSearch, setAttrPickerSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useAdminToast(successMessage, () => setSuccessMessage(""));

  const activeSkusCount = useMemo(
    () => skus.filter((s) => String(s.status || "").toUpperCase() === "ACTIVE").length,
    [skus]
  );

  const lowStockCount = useMemo(
    () => skus.filter((s) => Number(s.stock || 0) <= 5).length,
    [skus]
  );

  const totalStockUnits = useMemo(
    () => skus.reduce((sum, s) => sum + Number(s.stock || 0), 0),
    [skus]
  );

  const filteredSkus = useMemo(() => {
    const q = String(searchKeyword || "").trim().toLowerCase();
    return skus.filter((sku) => {
      const st = String(sku.status || "ACTIVE").toUpperCase();
      if (statusFilter === "ACTIVE" && st !== "ACTIVE") return false;
      if (statusFilter === "INACTIVE" && st === "ACTIVE") return false;
      if (statusFilter === "LOW_STOCK" && Number(sku.stock || 0) > 5) return false;
      if (!q) return true;
      return [sku.sku, sku.product?.name, sku.product?.categoryName, sku.product?.brandName]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [searchKeyword, statusFilter, skus]);

  const totalPages = Math.max(1, Math.ceil(filteredSkus.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSkus = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredSkus.slice(start, start + PAGE_SIZE);
  }, [filteredSkus, safePage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword, statusFilter]);

  // Selected attribute pills inside Drawer (fast lookup)
  const selectedAttrEntries = useMemo(() => {
    const idSet = new Set((formValues.attributeValueIds || []).map(Number));
    const entries = [];
    for (const attr of attributes) {
      for (const v of attr.values || []) {
        if (idSet.has(Number(v.id))) {
          entries.push({ attr, value: v });
        }
      }
    }
    return entries;
  }, [attributes, formValues.attributeValueIds]);

  // Searchable attribute list in Drawer (cap 15 so DOM never renders 2,690 selects!)
  const visiblePickerAttributes = useMemo(() => {
    const q = attrPickerSearch.trim().toLowerCase();
    const matched = q
      ? attributes.filter(
          (a) =>
            String(a.name || "").toLowerCase().includes(q) ||
            (a.values || []).some((v) => String(v.value || "").toLowerCase().includes(q))
        )
      : attributes.filter((a) => (a.values?.length || 0) > 0);
    return matched.slice(0, 15);
  }, [attributes, attrPickerSearch]);

  async function loadInitialData() {
    try {
      setLoading(true);
      setErrorMessage("");
      const [skuResponse, productResponse, attributeResponse] = await Promise.all([
        getAdminSkus(),
        getAdminProducts({ page: 1, limit: 200 }),
        getAdminAttributes()
      ]);

      setSkus(normalizeAdminList(skuResponse));
      setProducts(normalizeAdminList(productResponse));
      setAttributes(normalizeAdminList(attributeResponse));
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể tải dữ liệu SKU."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  function resetForm() {
    setFormValues(createInitialSkuForm());
    setEditingSkuId(null);
    setAttrPickerSearch("");
  }

  function openCreateDrawer() {
    resetForm();
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
    resetForm();
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    setSearchKeyword(keyword);
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  }

  function handleAttributeSelect(attribute, valueId) {
    setFormValues((prev) => ({
      ...prev,
      attributeValueIds: replaceAttributeSelection(prev.attributeValueIds, attribute, valueId)
    }));
  }

  function fillSkuForm(sku) {
    setEditingSkuId(sku.id);
    setFormValues({
      productId: String(sku.productId || sku.product?.id || ""),
      sku: sku.sku || "",
      price: String(sku.price ?? ""),
      stock: String(sku.stock ?? ""),
      warrantyMonths: sku.warrantyMonths !== null && sku.warrantyMonths !== undefined ? String(sku.warrantyMonths) : "",
      imageUrl: sku.imageUrl || "",
      status: sku.status || "ACTIVE",
      attributeValueIds: Array.isArray(sku.attributes) ? sku.attributes.map((item) => Number(item.attributeValueId)) : []
    });
  }

  async function handleEditSku(skuId) {
    const selectedSku = skus.find((item) => Number(item.id) === Number(skuId));
    if (selectedSku) {
      fillSkuForm(selectedSku);
      setIsDrawerOpen(true);
      setErrorMessage("");
    }
    try {
      setSubmitting(true);
      const response = await getAdminSkuDetail(skuId);
      const sku = response?.data || response;
      fillSkuForm(sku);
      setIsDrawerOpen(true);
      setErrorMessage("");
    } catch (error) {
      if (!selectedSku) {
        setErrorMessage(getAdminErrorMessage(error, "Không thể tải chi tiết SKU."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      const payload = {
        productId: Number(formValues.productId),
        sku: formValues.sku,
        price: Number(formValues.price),
        stock: Number(formValues.stock || 0),
        warrantyMonths:
          formValues.warrantyMonths !== "" && formValues.warrantyMonths !== null && !isNaN(Number(formValues.warrantyMonths))
            ? Number(formValues.warrantyMonths)
            : null,
        imageUrl: formValues.imageUrl,
        status: formValues.status,
        attributeValueIds: formValues.attributeValueIds
      };

      if (editingSkuId) {
        await updateAdminSku(editingSkuId, payload);
        setSuccessMessage("Đã cập nhật SKU thành công.");
      } else {
        await createAdminSku(payload);
        setSuccessMessage("Đã tạo SKU mới thành công.");
      }

      closeDrawer();
      await loadInitialData();
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể lưu SKU."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteSku(skuId) {
    const targetSku = skus.find((item) => item.id === skuId);
    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa SKU "${targetSku?.sku || skuId}"?\n\nThao tác này sẽ xóa biến thể SKU khỏi danh sách quản trị.`
    );
    if (!confirmed) return;

    try {
      setErrorMessage("");
      setSuccessMessage("");
      await deleteAdminSku(skuId);
      setSuccessMessage("Đã xóa SKU thành công.");
      await loadInitialData();
      if (editingSkuId === skuId) closeDrawer();
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể xóa SKU."));
    }
  }

  return (
    <AdminPage>
      <div className="cat-studio-shell">
        {/* ==================== EXECUTIVE SKU & INVENTORY HERO ==================== */}
        <section className="ai-studio-hero">
          <div className="ai-studio-hero-top">
            <div>
              <div className="ai-studio-hero-badges">
                <span className="ai-studio-live-pill">
                  <span className="ai-studio-live-dot" />
                  SKU &amp; Inventory Engine
                </span>
                <span className="ai-studio-tech-pill">Giá bán • Tồn kho • Thông số kỹ thuật</span>
              </div>
              <h1 className="ai-studio-hero-title">Quản Trị SKU, Biến Thể &amp; Tồn Kho</h1>
              <p className="ai-studio-hero-desc">
                Quản lý đơn vị lưu kho SKU, giá niêm yết, số lượng tồn thực tế, thời hạn bảo hành riêng và gắn thuộc tính kỹ thuật phục vụ trực tiếp cho Storefront &amp; Smart PC Builder.
              </p>
            </div>

            <button type="button" className="ai-studio-hero-cta" onClick={openCreateDrawer}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              <span>Thêm SKU Mới</span>
            </button>
          </div>

          <div className="ai-studio-kpi-grid">
            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#38bdf8" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Tổng biến thể SKU</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value">{formatAdminNumber(skus.length)}</div>
              <div className="ai-studio-kpi-hint">Mã SKU đã khởi tạo trong kho</div>
            </div>

            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#34d399" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Đang kinh doanh</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value" style={{ color: "#6ee7b7" }}>{formatAdminNumber(activeSkusCount)}</div>
              <div className="ai-studio-kpi-hint">{formatAdminNumber(skus.length - activeSkusCount)} SKU đang ngừng bán</div>
            </div>

            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#a78bfa" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Tổng tồn kho</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value">{formatAdminNumber(totalStockUnits)}</div>
              <div className="ai-studio-kpi-hint">Đơn vị sản phẩm sẵn giao</div>
            </div>

            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#fbbf24" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Cảnh báo tồn thấp</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value" style={{ color: lowStockCount > 0 ? "#fcd34d" : "#6ee7b7" }}>
                {formatAdminNumber(lowStockCount)}
              </div>
              <div className="ai-studio-kpi-hint">SKU có tồn kho ≤ 5 chiếc</div>
            </div>
          </div>
        </section>

        <AdminAlerts errorMessage={errorMessage} successMessage={successMessage} />

        {/* ==================== FULL-WIDTH SKU TABLE ==================== */}
        <section className="ai-studio-panel">
          <div className="ai-studio-panel-head">
            <div className="ai-studio-panel-title-wrap">
              <span className="ai-studio-panel-icon" style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #dbeafe" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
              </span>
              <div>
                <h3 className="ai-studio-panel-title">
                  Danh Sách SKU Biến Thể{" "}
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", marginLeft: 4 }}>
                    {formatAdminNumber(filteredSkus.length)} SKU
                  </span>
                </h3>
                <p className="ai-studio-panel-sub">Hiển thị gọn 25 SKU/trang • Nhấp "Sửa" để cập nhật giá, tồn kho hoặc gắn thông số kỹ thuật</p>
              </div>
            </div>

            <button type="button" className="ai-action-btn ai-action-btn--ghost" onClick={openCreateDrawer}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
              <span>Tạo SKU</span>
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="cat-toolbar">
            <div className="cat-search-wrap">
              <svg className="cat-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="cat-input cat-input--search"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setSearchKeyword(e.target.value);
                }}
                placeholder="Tìm theo mã SKU, tên sản phẩm, danh mục, thương hiệu..."
              />
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { id: "ALL", label: "Tất cả" },
                { id: "ACTIVE", label: "Đang bán" },
                { id: "LOW_STOCK", label: `Sắp hết (${lowStockCount})` },
                { id: "INACTIVE", label: "Ngừng bán" }
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setStatusFilter(pill.id)}
                  style={{
                    padding: "7px 11px",
                    borderRadius: 999,
                    border: statusFilter === pill.id ? "1px solid #0f172a" : "1px solid #e2e8f0",
                    background: statusFilter === pill.id ? "#0f172a" : "#ffffff",
                    color: statusFilter === pill.id ? "#ffffff" : "#475569",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <button type="submit" className="cat-btn-dark">Tìm</button>
          </form>

          {loading ? (
            <div style={{ textAlign: "center", padding: "56px 24px", color: "#64748b", fontSize: 13.5 }}>
              Đang tải danh sách SKU từ kho dữ liệu...
            </div>
          ) : paginatedSkus.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 24px", color: "#64748b" }}>
              <strong style={{ display: "block", fontSize: 15, color: "#0f172a", marginBottom: 4 }}>
                Không có SKU nào khớp bộ lọc
              </strong>
              <span style={{ fontSize: 13 }}>Thử xóa từ khóa hoặc chuyển bộ lọc trạng thái về "Tất cả".</span>
            </div>
          ) : (
            <>
              <div className="cat-table-scroll">
                <table className="cat-table">
                  <thead>
                    <tr>
                      <th>SKU &amp; Sản Phẩm</th>
                      <th>Giá Bán &amp; Tồn Kho</th>
                      <th>Bảo Hành</th>
                      <th>Thuộc Tính</th>
                      <th>Trạng Thái</th>
                      <th style={{ textAlign: "right" }}>Tác Vụ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSkus.map((sku) => {
                      const stockNum = Number(sku.stock || 0);
                      const attrs = sku.attributes || [];
                      const isActive = String(sku.status || "").toUpperCase() === "ACTIVE";
                      return (
                        <tr key={sku.id}>
                          <td style={{ maxWidth: 340 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                              <div style={{
                                width: 42,
                                height: 42,
                                borderRadius: 10,
                                border: "1px solid #e2e8f0",
                                background: "#f8fafc",
                                overflow: "hidden",
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                              }}>
                                {sku.imageUrl ? (
                                  <img
                                    src={sku.imageUrl}
                                    alt={sku.sku}
                                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                                  />
                                ) : (
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                                )}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div className="cat-prod-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 270 }} title={sku.product?.name}>
                                  {sku.product?.name || "Chưa gắn sản phẩm"}
                                </div>
                                <div
                                  className="cat-prod-slug"
                                  style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                  title={sku.sku}
                                >
                                  {sku.sku}
                                </div>
                                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                                  {sku.product?.categoryName || "—"} · {sku.product?.brandName || "—"}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td style={{ whiteSpace: "nowrap" }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                              {Number(sku.price || 0).toLocaleString("vi-VN")} đ
                            </div>
                            <span style={{
                              display: "inline-block",
                              marginTop: 4,
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                              background: stockNum <= 0 ? "#fef2f2" : stockNum <= 5 ? "#fffbeb" : "#ecfdf5",
                              color: stockNum <= 0 ? "#b91c1c" : stockNum <= 5 ? "#b45309" : "#047857",
                              border: `1px solid ${stockNum <= 0 ? "#fecaca" : stockNum <= 5 ? "#fde68a" : "#a7f3d0"}`
                            }}>
                              {stockNum <= 0 ? "Hết hàng" : `Tồn kho: ${stockNum}`}
                            </span>
                          </td>

                          <td style={{ whiteSpace: "nowrap" }}>
                            <div className="cat-warranty-pill">
                              <span>{sku.effectiveWarrantyMonths || sku.warrantyMonths || sku.product?.warrantyMonths || 24} tháng</span>
                            </div>
                            <div style={{ fontSize: 11, color: sku.warrantyMonths !== null && sku.warrantyMonths !== undefined ? "#2563eb" : "#94a3b8", marginTop: 3, fontWeight: 600 }}>
                              {sku.warrantyMonths !== null && sku.warrantyMonths !== undefined ? "Bảo hành riêng SKU" : "Theo sản phẩm"}
                            </div>
                          </td>

                          <td style={{ maxWidth: 230 }}>
                            {attrs.length === 0 ? (
                              <span style={{ fontSize: 12, color: "#94a3b8" }}>Chưa gắn</span>
                            ) : (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {attrs.slice(0, 3).map((a) => (
                                  <span
                                    key={`${sku.id}-${a.attributeValueId}`}
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      padding: "2px 7px",
                                      borderRadius: 6,
                                      background: "#f1f5f9",
                                      color: "#334155",
                                      border: "1px solid #e2e8f0",
                                      maxWidth: 160,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap"
                                    }}
                                    title={a.label}
                                  >
                                    {a.label}
                                  </span>
                                ))}
                                {attrs.length > 3 && (
                                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: "#eff6ff", color: "#1d4ed8" }}>
                                    +{attrs.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          <td>
                            <span className={`cat-status-pill ${isActive ? "is-active" : "is-hidden"}`}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: isActive ? "#10b981" : "#94a3b8" }} />
                              <span>{getSkuStatusLabel(sku.status)}</span>
                            </span>
                          </td>

                          <td style={{ textAlign: "right" }}>
                            <div className="cat-row-actions">
                              <button
                                type="button"
                                className="ai-action-btn ai-action-btn--ghost"
                                onClick={() => handleEditSku(sku.id)}
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                className="ai-action-btn ai-action-btn--danger"
                                onClick={() => handleDeleteSku(sku.id)}
                              >
                                Xóa
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="cat-pagination">
                <span>
                  Trang <strong style={{ color: "#0f172a" }}>{safePage}</strong> /{" "}
                  <strong style={{ color: "#0f172a" }}>{totalPages}</strong> • Tổng{" "}
                  <strong style={{ color: "#0f172a" }}>{formatAdminNumber(filteredSkus.length)}</strong> SKU
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

        {/* ==================== SLIDE-OVER SKU EDITOR DRAWER ==================== */}
        {isDrawerOpen && (
          <div
            className="cat-drawer-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget && !submitting) closeDrawer();
            }}
          >
            <div className="cat-drawer" style={{ maxWidth: 580 }}>
              <div className="cat-drawer-head">
                <div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#7dd3fc" }}>
                    {editingSkuId ? `Chỉnh sửa SKU #${editingSkuId}` : "Khởi tạo biến thể mới"}
                  </span>
                  <h3 style={{ margin: "3px 0 0", fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
                    {editingSkuId ? `Cập Nhật SKU ${formValues.sku}` : "Thêm Biến Thể SKU Mới"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.1)",
                    color: "#e2e8f0",
                    cursor: "pointer",
                    fontSize: 15
                  }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                <div className="cat-drawer-body">
                  <div className="sys-field">
                    <label className="sys-field-label">Sản phẩm gốc *</label>
                    <select name="productId" className="cat-input" value={formValues.productId} onChange={handleChange} required>
                      <option value="">Chọn sản phẩm...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sys-field">
                    <label className="sys-field-label">Mã SKU *</label>
                    <input
                      name="sku"
                      className="cat-input"
                      style={{ fontFamily: "ui-monospace, monospace" }}
                      value={formValues.sku}
                      onChange={handleChange}
                      placeholder="VD: VGA-ASUS-RTX4060-DUAL-8G"
                      required
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="sys-field">
                      <label className="sys-field-label">Giá bán (VNĐ) *</label>
                      <input name="price" type="number" min="0" className="cat-input" value={formValues.price} onChange={handleChange} placeholder="VD: 8490000" required />
                    </div>
                    <div className="sys-field">
                      <label className="sys-field-label">Số lượng tồn kho *</label>
                      <input name="stock" type="number" min="0" className="cat-input" value={formValues.stock} onChange={handleChange} placeholder="VD: 20" required />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="sys-field">
                      <label className="sys-field-label">Bảo hành riêng SKU (tháng)</label>
                      <input
                        name="warrantyMonths"
                        type="number"
                        min="0"
                        max="240"
                        className="cat-input"
                        value={formValues.warrantyMonths}
                        onChange={handleChange}
                        placeholder="Để trống để theo sản phẩm"
                      />
                    </div>
                    <div className="sys-field">
                      <label className="sys-field-label">Trạng thái kinh doanh</label>
                      <select name="status" className="cat-input" value={formValues.status} onChange={handleChange}>
                        <option value="ACTIVE">Đang bán</option>
                        <option value="INACTIVE">Ngừng bán</option>
                      </select>
                    </div>
                  </div>

                  <div className="sys-field">
                    <label className="sys-field-label">URL Ảnh đại diện SKU</label>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input name="imageUrl" className="cat-input" value={formValues.imageUrl} onChange={handleChange} placeholder="https://... hoặc /data/images/..." />
                      {formValues.imageUrl && (
                        <img
                          src={formValues.imageUrl}
                          alt="Preview"
                          style={{ width: 40, height: 40, borderRadius: 8, objectFit: "contain", border: "1px solid #e2e8f0", flexShrink: 0 }}
                        />
                      )}
                    </div>
                  </div>

                  {/* SMART SEARCHABLE ATTRIBUTE PICKER (NO 2,690-SELECT LAG!) */}
                  <div style={{ padding: 14, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: 13, color: "#0f172a" }}>Thuộc tính kỹ thuật đã gắn ({selectedAttrEntries.length})</strong>
                      <span style={{ fontSize: 11, color: "#64748b" }}>Hỗ trợ tìm nhanh trong {formatAdminNumber(attributes.length)} thuộc tính</span>
                    </div>

                    {selectedAttrEntries.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {selectedAttrEntries.map(({ attr, value }) => (
                          <span key={value.id} className="attr-value-chip" style={{ background: "#eff6ff", borderColor: "#bfdbfe", color: "#1d4ed8" }}>
                            <span style={{ fontSize: 11.5 }}>{attr.name}: <strong>{value.value}</strong></span>
                            <button
                              type="button"
                              className="attr-chip-btn attr-chip-btn--del"
                              onClick={() => handleAttributeSelect(attr, "")}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <input
                      type="text"
                      className="cat-input"
                      value={attrPickerSearch}
                      onChange={(e) => setAttrPickerSearch(e.target.value)}
                      placeholder="Gõ tên thuộc tính để gắn (VD: Socket, RAM, Chipset, TDP)..."
                    />

                    <div style={{ display: "grid", gap: 8, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
                      {visiblePickerAttributes.map((attribute) => {
                        const selectedValueId =
                          attribute.values?.find((v) => formValues.attributeValueIds.includes(Number(v.id)))?.id || "";
                        return (
                          <div key={attribute.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 8, alignItems: "center", background: "#fff", padding: "7px 10px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={attribute.name}>
                              {attribute.name}
                            </span>
                            <select
                              className="cat-input"
                              style={{ padding: "5px 8px", fontSize: 12 }}
                              value={selectedValueId}
                              onChange={(e) => handleAttributeSelect(attribute, e.target.value)}
                            >
                              <option value="">— Không gán —</option>
                              {(attribute.values || []).map((v) => (
                                <option key={v.id} value={v.id}>{v.value}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="cat-drawer-foot">
                  <button type="button" className="cat-btn-clear" onClick={closeDrawer} disabled={submitting}>
                    Hủy bỏ
                  </button>
                  <button type="submit" className="cat-btn-dark" style={{ background: "linear-gradient(135deg, #2563eb, #4f46e5)" }} disabled={submitting}>
                    {submitting ? "Đang lưu..." : editingSkuId ? "Lưu Cập Nhật SKU" : "Tạo Biến Thể SKU"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
