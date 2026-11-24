import { useEffect, useMemo, useState } from "react";

import { AdminAlerts, AdminPage, useAdminToast } from "../../components/admin/AdminUi";
import { getBrands, getCategories, getProductDetail } from "../../services/catalog.service";
import { formatAdminNumber, getAdminErrorMessage, normalizeAdminList } from "../../utils/adminUi";
import {
  changeAdminProductStatus,
  createAdminProduct,
  deleteAdminProduct,
  getAdminProducts,
  updateAdminProduct
} from "../../services/admin-products.service";
import "../../styles/admin-ai-studio.css";
import "../../styles/admin-catalog-studio.css";

function normalizeEntityList(response) {
  const payload = response?.data || response;
  return Array.isArray(payload) ? payload : [];
}

function normalizeProductRow(product) {
  return {
    id: product?.product_id || product?.id,
    name: product?.product_name || product?.name || "",
    slug: product?.slug || "",
    description: product?.description || "",
    warrantyMonths: Number(product?.warranty_months || product?.warrantyMonths || 24),
    categoryId: product?.category_id || product?.category?.id || "",
    categoryName: product?.category_name || product?.category?.name || "",
    brandId: product?.brand_id || product?.brand?.id || "",
    brandName: product?.brand_name || product?.brand?.name || "",
    status: String(product?.status || "ACTIVE").toUpperCase(),
    variants: Array.isArray(product?.variants) ? product.variants : []
  };
}

function createInitialFormState() {
  return {
    name: "",
    slug: "",
    description: "",
    warrantyMonths: "24",
    categoryId: "",
    brandId: ""
  };
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function validateForm(values) {
  const errors = {};
  if (!String(values.name || "").trim()) errors.name = "Nhập tên sản phẩm.";
  if (!String(values.slug || "").trim()) errors.slug = "Slug không được để trống.";
  if (!String(values.categoryId || "").trim()) errors.categoryId = "Chọn danh mục cho sản phẩm.";
  if (!String(values.brandId || "").trim()) errors.brandId = "Chọn thương hiệu cho sản phẩm.";
  return errors;
}

function getProductStatusLabel(status) {
  return String(status || "").toUpperCase() === "ACTIVE" ? "Đang hiển thị" : "Đã ẩn";
}

export function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 30, totalItems: 0, totalPages: 1 });
  const [formValues, setFormValues] = useState(createInitialFormState());
  const [formErrors, setFormErrors] = useState({});
  const [editingProductId, setEditingProductId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useAdminToast(successMessage, () => setSuccessMessage(""));

  const activeOnPage = useMemo(
    () => products.filter((p) => p.status === "ACTIVE").length,
    [products]
  );

  const hasActiveFilters = Boolean(keyword.trim() || selectedCategoryId || selectedBrandId);

  async function loadProductsData(targetPage = 1, catId = selectedCategoryId, bId = selectedBrandId, kw = keyword) {
    try {
      setLoading(true);
      setErrorMessage("");

      const params = { page: targetPage, limit: 30 };
      if (catId) params.categoryId = catId;
      if (bId) params.brandId = bId;
      if (kw?.trim()) params.keyword = kw.trim();

      const response = await getAdminProducts(params);
      const items = normalizeAdminList(response).map(normalizeProductRow);
      setProducts(items);

      const payload = response?.data || response;
      if (payload?.pagination) {
        setPagination(payload.pagination);
      } else {
        setPagination({
          page: targetPage,
          limit: 30,
          totalItems: items.length,
          totalPages: 1
        });
      }
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể tải danh sách sản phẩm."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        setErrorMessage("");
        const [categoriesResponse, brandsResponse] = await Promise.all([
          getCategories(),
          getBrands()
        ]);
        setCategories(normalizeEntityList(categoriesResponse));
        setBrands(normalizeEntityList(brandsResponse));
        await loadProductsData(1, "", "", "");
      } catch (error) {
        setErrorMessage(getAdminErrorMessage(error, "Không thể tải dữ liệu ban đầu."));
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  function handleCategoryFilterChange(newCatId) {
    setSelectedCategoryId(newCatId);
    setPage(1);
    loadProductsData(1, newCatId, selectedBrandId, keyword);
  }

  function handleBrandFilterChange(newBrandId) {
    setSelectedBrandId(newBrandId);
    setPage(1);
    loadProductsData(1, selectedCategoryId, newBrandId, keyword);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    setPage(1);
    loadProductsData(1, selectedCategoryId, selectedBrandId, keyword);
  }

  function handleClearFilters() {
    setKeyword("");
    setSelectedCategoryId("");
    setSelectedBrandId("");
    setPage(1);
    loadProductsData(1, "", "", "");
  }

  function handlePageChange(newPage) {
    if (newPage < 1 || (pagination.totalPages && newPage > pagination.totalPages)) return;
    setPage(newPage);
    loadProductsData(newPage, selectedCategoryId, selectedBrandId, keyword);
  }

  function resetForm() {
    setEditingProductId(null);
    setFormValues(createInitialFormState());
    setFormErrors({});
  }

  function openCreateDrawer() {
    resetForm();
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
    resetForm();
  }

  function handleFormChange(event) {
    const { name, value } = event.target;
    setFormValues((prevState) => {
      const nextState = { ...prevState, [name]: value };
      if (name === "name" && !editingProductId && !String(prevState.slug || "").trim()) {
        nextState.slug = slugify(value);
      }
      return nextState;
    });
    setFormErrors((prevState) => ({ ...prevState, [name]: "" }));
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleEditProduct(productId) {
    try {
      setSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      const response = await getProductDetail(productId);
      const detail = response?.data || response;
      const detailName = detail.name || detail.product_name || "";
      const detailCategoryId = detail.category?.id || detail.category_id || "";
      const detailBrandId = detail.brand?.id || detail.brand_id || "";

      setEditingProductId(detail.id);
      setFormValues({
        name: detailName,
        slug: detail.slug || "",
        description: detail.description || "",
        warrantyMonths: String(detail.warrantyMonths ?? detail.warranty_months ?? 24),
        categoryId: String(detailCategoryId),
        brandId: String(detailBrandId)
      });
      setFormErrors({});
      setIsDrawerOpen(true);
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể tải chi tiết sản phẩm."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitForm(event) {
    event.preventDefault();
    const nextErrors = validateForm(formValues);
    setFormErrors(nextErrors);
    setErrorMessage("");
    setSuccessMessage("");

    if (Object.keys(nextErrors).length > 0) return;

    try {
      setSubmitting(true);
      const payload = {
        name: formValues.name.trim(),
        slug: formValues.slug.trim(),
        description: String(formValues.description || "").trim(),
        warrantyMonths: Number(formValues.warrantyMonths) || 24,
        categoryId: Number(formValues.categoryId),
        brandId: Number(formValues.brandId)
      };

      const response = editingProductId
        ? await updateAdminProduct(editingProductId, payload)
        : await createAdminProduct(payload);

      const savedProduct = normalizeProductRow(response?.data || response);

      setProducts((prevState) => {
        if (editingProductId) {
          return prevState.map((product) => (product.id === savedProduct.id ? savedProduct : product));
        }
        return [savedProduct, ...prevState];
      });

      setSuccessMessage(editingProductId ? "Đã cập nhật thông tin sản phẩm thành công." : "Đã tạo sản phẩm mới thành công.");
      closeDrawer();
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể lưu sản phẩm."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(product) {
    const nextStatus = product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const nextActionLabel = nextStatus === "INACTIVE" ? "ẩn" : "bật hiển thị lại";
    const confirmed = window.confirm(
      `Bạn có chắc muốn ${nextActionLabel} sản phẩm "${product.name}"?\n\nThao tác này chỉ đổi trạng thái hiển thị, không xóa dữ liệu sản phẩm.`
    );
    if (!confirmed) return;

    try {
      setStatusLoadingId(product.id);
      setErrorMessage("");
      setSuccessMessage("");
      const response = await changeAdminProductStatus(product.id, nextStatus);
      const updatedProduct = normalizeProductRow(response?.data || response);
      setProducts((prevState) => prevState.map((item) => (item.id === updatedProduct.id ? updatedProduct : item)));
      setSuccessMessage(`Đã chuyển trạng thái sản phẩm sang "${getProductStatusLabel(nextStatus)}".`);
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error, "Không thể cập nhật trạng thái sản phẩm."));
    } finally {
      setStatusLoadingId(null);
    }
  }

  async function handleDeleteProduct(product) {
    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa vĩnh viễn sản phẩm "${product.name}"?\n\nChỉ nên xóa sản phẩm tạo nhầm/chưa có SKU. Nếu sản phẩm đã có SKU hoặc phát sinh dữ liệu liên quan, hệ thống sẽ chặn xóa và bạn nên dùng nút "Ẩn".`
    );
    if (!confirmed) return;

    try {
      setDeleteLoadingId(product.id);
      setErrorMessage("");
      setSuccessMessage("");
      await deleteAdminProduct(product.id);
      setProducts((prevState) => prevState.filter((item) => item.id !== product.id));
      if (editingProductId === product.id) closeDrawer();
      setSuccessMessage("Đã xóa sản phẩm thành công.");
    } catch (error) {
      setErrorMessage(
        getAdminErrorMessage(
          error,
          "Không thể xóa sản phẩm. Nếu sản phẩm đã có SKU hoặc dữ liệu liên quan, hãy dùng nút Ẩn thay vì xóa."
        )
      );
    } finally {
      setDeleteLoadingId(null);
    }
  }

  return (
    <AdminPage>
      <div className="cat-studio-shell">
        {/* ==================== EXECUTIVE CATALOG HERO BANNER ==================== */}
        <section className="ai-studio-hero">
          <div className="ai-studio-hero-top">
            <div>
              <div className="ai-studio-hero-badges">
                <span className="ai-studio-live-pill">
                  <span className="ai-studio-live-dot" />
                  Catalog Master Repository
                </span>
                <span className="ai-studio-tech-pill">Phân trang 30 sản phẩm / trang</span>
                <span className="ai-studio-tech-pill">Đồng bộ PC Builder &amp; SKU</span>
              </div>
              <h1 className="ai-studio-hero-title">Trung Tâm Danh Mục Sản Phẩm</h1>
              <p className="ai-studio-hero-desc">
                Quản lý tập trung toàn bộ linh kiện PC Mall: tên chuẩn hóa, đường dẫn slug, phân loại danh mục, thương hiệu, thời hạn bảo hành chính hãng và trạng thái hiển thị storefront.
              </p>
            </div>

            <button type="button" className="ai-studio-hero-cta" onClick={openCreateDrawer}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              <span>Thêm Sản Phẩm Mới</span>
            </button>
          </div>

          <div className="ai-studio-kpi-grid">
            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#38bdf8" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Tổng sản phẩm</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value">{formatAdminNumber(pagination.totalItems || products.length)}</div>
              <div className="ai-studio-kpi-hint">Khớp với bộ lọc hiện tại</div>
            </div>

            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#a78bfa" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Danh mục chuẩn</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value">{formatAdminNumber(categories.length)}</div>
              <div className="ai-studio-kpi-hint">CPU, GPU, RAM, Mainboard…</div>
            </div>

            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#22d3ee" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Thương hiệu</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value">{formatAdminNumber(brands.length)}</div>
              <div className="ai-studio-kpi-hint">Hãng linh kiện chính hãng</div>
            </div>

            <div className="ai-studio-kpi" style={{ "--kpi-accent": "#34d399" }}>
              <div className="ai-studio-kpi-head">
                <span className="ai-studio-kpi-label">Trang hiện tại</span>
                <span className="ai-studio-kpi-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
              </div>
              <div className="ai-studio-kpi-value" style={{ color: "#6ee7b7" }}>
                {page} / {pagination.totalPages || 1}
              </div>
              <div className="ai-studio-kpi-hint">{activeOnPage}/{products.length} đang hiển thị trên trang</div>
            </div>
          </div>
        </section>

        <AdminAlerts errorMessage={errorMessage} successMessage={successMessage} />

        {/* ==================== FULL-WIDTH PRODUCT CATALOG TABLE ==================== */}
        <section className="ai-studio-panel">
          <div className="ai-studio-panel-head">
            <div className="ai-studio-panel-title-wrap">
              <span className="ai-studio-panel-icon" style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #dbeafe" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
              </span>
              <div>
                <h3 className="ai-studio-panel-title">
                  Danh Sách Linh Kiện{" "}
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", marginLeft: 4 }}>
                    {formatAdminNumber(pagination.totalItems || products.length)} sản phẩm
                  </span>
                </h3>
                <p className="ai-studio-panel-sub">Lọc tức thì theo danh mục chuẩn, thương hiệu hoặc mã sản phẩm. Bấm "Sửa" để mở bảng chỉnh sửa nhanh.</p>
              </div>
            </div>

            <button
              type="button"
              className="ai-action-btn ai-action-btn--ghost"
              onClick={openCreateDrawer}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
              <span>Tạo sản phẩm</span>
            </button>
          </div>

          {/* Filter & Search Toolbar */}
          <form onSubmit={handleSearchSubmit} className="cat-toolbar">
            <div className="cat-search-wrap">
              <svg className="cat-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="cat-input cat-input--search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm tên sản phẩm, slug, mã linh kiện..."
              />
            </div>

            <select
              className="cat-select"
              value={selectedCategoryId}
              onChange={(e) => handleCategoryFilterChange(e.target.value)}
            >
              <option value="">Tất cả danh mục ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              className="cat-select"
              value={selectedBrandId}
              onChange={(e) => handleBrandFilterChange(e.target.value)}
            >
              <option value="">Tất cả thương hiệu ({brands.length})</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <button type="submit" className="cat-btn-dark">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <span>Tìm kiếm</span>
            </button>

            {hasActiveFilters && (
              <button type="button" className="cat-btn-clear" onClick={handleClearFilters}>
                Xóa lọc
              </button>
            )}
          </form>

          {loading ? (
            <div style={{ textAlign: "center", padding: "56px 24px", color: "#64748b", fontSize: 13.5 }}>
              Đang tải dữ liệu sản phẩm từ cơ sở dữ liệu...
            </div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 24px", color: "#64748b" }}>
              <strong style={{ display: "block", fontSize: 15, color: "#0f172a", marginBottom: 4 }}>
                Không tìm thấy sản phẩm nào khớp bộ lọc
              </strong>
              <span style={{ fontSize: 13 }}>Thử đổi danh mục, thương hiệu hoặc xóa từ khóa tìm kiếm.</span>
            </div>
          ) : (
            <>
              <div className="cat-table-scroll">
                <table className="cat-table">
                  <thead>
                    <tr>
                      <th>Sản Phẩm &amp; Slug</th>
                      <th>Danh Mục</th>
                      <th>Thương Hiệu</th>
                      <th>Bảo Hành</th>
                      <th>Trạng Thái</th>
                      <th style={{ textAlign: "right" }}>Tác Vụ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td style={{ minWidth: 300 }}>
                          <div className="cat-prod-title">{product.name}</div>
                          {product.slug && <span className="cat-prod-slug">{product.slug}</span>}
                          {product.description && (
                            <div className="cat-prod-desc" title={product.description}>
                              {product.description}
                            </div>
                          )}
                        </td>

                        <td>
                          <span className="cat-cat-pill">{product.categoryName || "—"}</span>
                        </td>

                        <td>
                          <span className="cat-brand-pill">{product.brandName || "—"}</span>
                        </td>

                        <td>
                          <span className="cat-warranty-pill">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                            <span>{product.warrantyMonths || 24} tháng</span>
                          </span>
                        </td>

                        <td>
                          <span className={`cat-status-pill ${product.status === "ACTIVE" ? "is-active" : "is-hidden"}`}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: product.status === "ACTIVE" ? "#10b981" : "#94a3b8" }} />
                            <span>{getProductStatusLabel(product.status)}</span>
                          </span>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <div className="cat-row-actions">
                            <button
                              type="button"
                              className="ai-action-btn ai-action-btn--ghost"
                              onClick={() => handleEditProduct(product.id)}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="ai-action-btn ai-action-btn--ghost"
                              disabled={statusLoadingId === product.id}
                              onClick={() => handleToggleStatus(product)}
                            >
                              {statusLoadingId === product.id ? "Đang xử lý..." : product.status === "ACTIVE" ? "Ẩn" : "Bật"}
                            </button>
                            <button
                              type="button"
                              className="ai-action-btn ai-action-btn--danger"
                              disabled={deleteLoadingId === product.id}
                              onClick={() => handleDeleteProduct(product)}
                            >
                              {deleteLoadingId === product.id ? "Đang xóa..." : "Xóa"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Clean Pagination Footer */}
              <div className="cat-pagination">
                <span>
                  Trang <strong style={{ color: "#0f172a" }}>{page}</strong> /{" "}
                  <strong style={{ color: "#0f172a" }}>{pagination.totalPages || 1}</strong> • Tổng{" "}
                  <strong style={{ color: "#0f172a" }}>{formatAdminNumber(pagination.totalItems || products.length)}</strong> sản phẩm
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="ai-action-btn ai-action-btn--ghost"
                    disabled={page <= 1 || loading}
                    onClick={() => handlePageChange(page - 1)}
                    style={{ opacity: page <= 1 || loading ? 0.45 : 1 }}
                  >
                    ← Trang trước
                  </button>
                  <button
                    type="button"
                    className="ai-action-btn ai-action-btn--ghost"
                    disabled={page >= (pagination.totalPages || 1) || loading}
                    onClick={() => handlePageChange(page + 1)}
                    style={{ opacity: page >= (pagination.totalPages || 1) || loading ? 0.45 : 1 }}
                  >
                    Trang sau →
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* ==================== SLIDE-OVER PRODUCT EDITOR DRAWER ==================== */}
        {isDrawerOpen && (
          <div
            className="cat-drawer-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget && !submitting) closeDrawer();
            }}
          >
            <div className="cat-drawer">
              <div className="cat-drawer-head">
                <div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#7dd3fc" }}>
                    {editingProductId ? `Chỉnh sửa #${editingProductId}` : "Tạo bản ghi mới"}
                  </span>
                  <h3 style={{ margin: "3px 0 0", fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
                    {editingProductId ? "Cập Nhật Thông Tin Sản Phẩm" : "Thêm Sản Phẩm Mới Vào Kho"}
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

              <form onSubmit={handleSubmitForm} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                <div className="cat-drawer-body">
                  <div className="sys-field">
                    <label htmlFor="name" className="sys-field-label">Tên sản phẩm *</label>
                    <input
                      id="name"
                      name="name"
                      className="cat-input"
                      value={formValues.name}
                      onChange={handleFormChange}
                      placeholder="VD: Card màn hình ASUS Dual GeForce RTX 4060 OC 8GB"
                    />
                    {formErrors.name && <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{formErrors.name}</span>}
                  </div>

                  <div className="sys-field">
                    <div className="sys-field-label-row">
                      <label htmlFor="slug" className="sys-field-label">Đường dẫn (Slug) *</label>
                      <button
                        type="button"
                        className="cat-warranty-chip"
                        onClick={() => setFormValues((prev) => ({ ...prev, slug: slugify(prev.name) }))}
                      >
                        Tạo tự động từ tên
                      </button>
                    </div>
                    <input
                      id="slug"
                      name="slug"
                      className="cat-input"
                      style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}
                      value={formValues.slug}
                      onChange={handleFormChange}
                      placeholder="asus-dual-geforce-rtx-4060-oc-8gb"
                    />
                    {formErrors.slug && <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{formErrors.slug}</span>}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="sys-field">
                      <label htmlFor="categoryId" className="sys-field-label">Danh mục *</label>
                      <select id="categoryId" name="categoryId" className="cat-input" value={formValues.categoryId} onChange={handleFormChange}>
                        <option value="">Chọn danh mục</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      {formErrors.categoryId && <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{formErrors.categoryId}</span>}
                    </div>

                    <div className="sys-field">
                      <label htmlFor="brandId" className="sys-field-label">Thương hiệu *</label>
                      <select id="brandId" name="brandId" className="cat-input" value={formValues.brandId} onChange={handleFormChange}>
                        <option value="">Chọn thương hiệu</option>
                        {brands.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                      {formErrors.brandId && <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{formErrors.brandId}</span>}
                    </div>
                  </div>

                  <div className="sys-field">
                    <label htmlFor="warrantyMonths" className="sys-field-label">Thời hạn bảo hành chính hãng (tháng)</label>
                    <input
                      id="warrantyMonths"
                      name="warrantyMonths"
                      type="number"
                      min="0"
                      max="240"
                      className="cat-input"
                      value={formValues.warrantyMonths}
                      onChange={handleFormChange}
                      placeholder="VD: 36 (CPU/GPU), 60 (SSD Pro)"
                    />
                    <div className="cat-warranty-presets">
                      {["12", "24", "36", "60", "120"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`cat-warranty-chip${String(formValues.warrantyMonths) === m ? " is-active" : ""}`}
                          onClick={() => setFormValues((prev) => ({ ...prev, warrantyMonths: m }))}
                        >
                          {m} tháng
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="sys-field">
                    <label htmlFor="description" className="sys-field-label">Mô tả sản phẩm</label>
                    <textarea
                      id="description"
                      name="description"
                      className="cat-input"
                      rows={5}
                      value={formValues.description}
                      onChange={handleFormChange}
                      placeholder="Mô tả tóm tắt thông số nổi bật của linh kiện..."
                    />
                  </div>
                </div>

                <div className="cat-drawer-foot">
                  <button type="button" className="cat-btn-clear" onClick={closeDrawer} disabled={submitting}>
                    Hủy bỏ
                  </button>
                  <button type="submit" className="cat-btn-dark" style={{ background: "linear-gradient(135deg, #2563eb, #4f46e5)" }} disabled={submitting}>
                    {submitting ? "Đang lưu..." : editingProductId ? "Lưu Thay Đổi" : "Tạo Sản Phẩm"}
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
