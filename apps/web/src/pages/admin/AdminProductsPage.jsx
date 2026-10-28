import { useEffect, useMemo, useState } from "react";

import {
  AdminAlerts,
  AdminBadge,
  AdminBtn,
  AdminCard,
  AdminEmpty,
  AdminField,
  AdminForm,
  AdminPage,
  AdminPageHead,
  AdminTableWrap,
  AdminWorkspace,
  useAdminToast
} from "../../components/admin/AdminUi";
import { getBrands, getCategories, getProductDetail } from "../../services/catalog.service";
import { getAdminErrorMessage, normalizeAdminList } from "../../utils/adminUi";
import {
  changeAdminProductStatus,
  createAdminProduct,
  deleteAdminProduct,
  getAdminProducts,
  updateAdminProduct
} from "../../services/admin-products.service";


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
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function validateForm(values) {
  const errors = {};

  if (!String(values.name || "").trim()) {
    errors.name = "Nhập tên sản phẩm.";
  }

  if (!String(values.slug || "").trim()) {
    errors.slug = "Slug không được để trống.";
  }

  if (!String(values.categoryId || "").trim()) {
    errors.categoryId = "Chọn danh mục cho sản phẩm.";
  }

  if (!String(values.brandId || "").trim()) {
    errors.brandId = "Chọn thương hiệu cho sản phẩm.";
  }

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
  const [searchKeyword, setSearchKeyword] = useState("");
  const [formValues, setFormValues] = useState(createInitialFormState());
  const [formErrors, setFormErrors] = useState({});
  const [editingProductId, setEditingProductId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useAdminToast(successMessage, () => setSuccessMessage(""));

  const filteredProducts = useMemo(() => {
    const normalizedKeyword = String(searchKeyword || "").trim().toLowerCase();

    if (!normalizedKeyword) {
      return products;
    }

    return products.filter((product) => {
      const haystack = [product.name, product.slug, product.categoryName, product.brandName].join(" ").toLowerCase();
      return haystack.includes(normalizedKeyword);
    });
  }, [products, searchKeyword]);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        setErrorMessage("");

        const [productsResponse, categoriesResponse, brandsResponse] = await Promise.all([
          getAdminProducts({ page: 1, limit: 100 }),
          getCategories(),
          getBrands()
        ]);

        setProducts(normalizeAdminList(productsResponse).map(normalizeProductRow));
        setCategories(normalizeEntityList(categoriesResponse));
        setBrands(normalizeEntityList(brandsResponse));
      } catch (error) {
        setErrorMessage(getAdminErrorMessage(error, "Không thể tải dữ liệu sản phẩm."));
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  function resetForm() {
    setFormValues(createInitialFormState());
    setFormErrors({});
    setEditingProductId(null);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    setSearchKeyword(keyword);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    setFormValues((prevState) => {
      const nextState = {
        ...prevState,
        [name]: value
      };

      if (name === "name" && !editingProductId && !String(prevState.slug || "").trim()) {
        nextState.slug = slugify(value);
      }

      return nextState;
    });

    setFormErrors((prevState) => ({
      ...prevState,
      [name]: ""
    }));

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

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

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

      setSuccessMessage(editingProductId ? "Đã cập nhật sản phẩm." : "Đã tạo sản phẩm mới.");
      resetForm();
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

    if (!confirmed) {
      return;
    }

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

    if (!confirmed) {
      return;
    }

    try {
      setDeleteLoadingId(product.id);
      setErrorMessage("");
      setSuccessMessage("");

      await deleteAdminProduct(product.id);
      setProducts((prevState) => prevState.filter((item) => item.id !== product.id));

      if (editingProductId === product.id) {
        resetForm();
      }

      setSuccessMessage("Đã xóa sản phẩm.");
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
      <AdminPageHead
        eyebrow="Catalog"
        title="Danh mục sản phẩm"
        description="Quản lý tên, slug, danh mục, thương hiệu và trạng thái hiển thị. Tiếp theo gán SKU tại module SKU."
      />

      <AdminAlerts errorMessage={errorMessage} successMessage={successMessage} />

      <AdminWorkspace columns="form-list">
        <AdminCard>
          <div className="admin-panel-head">
            <div className="admin-section-title">
              <h3>{editingProductId ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm"}</h3>
              <p>Thông tin cơ bản trước khi tạo biến thể SKU.</p>
            </div>
            {editingProductId ? (
              <AdminBtn variant="secondary" onClick={resetForm}>
                Tạo mới
              </AdminBtn>
            ) : null}
          </div>
          <AdminForm onSubmit={handleSubmitForm}>
            <AdminField label="Tên sản phẩm" htmlFor="name" error={formErrors.name}>
              <input id="name" name="name" className="admin-input" value={formValues.name} onChange={handleFormChange} />
            </AdminField>
            <AdminField label="Slug" htmlFor="slug" error={formErrors.slug}>
              <input id="slug" name="slug" className="admin-input" value={formValues.slug} onChange={handleFormChange} />
            </AdminField>
            <AdminField label="Mô tả" htmlFor="description">
              <textarea id="description" name="description" className="admin-input" rows={4} value={formValues.description} onChange={handleFormChange} />
            </AdminField>
            <AdminField label="Danh mục" htmlFor="categoryId" error={formErrors.categoryId}>
              <select id="categoryId" name="categoryId" className="admin-input" value={formValues.categoryId} onChange={handleFormChange}>
                <option value="">Chọn danh mục</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Thương hiệu" htmlFor="brandId" error={formErrors.brandId}>
              <select id="brandId" name="brandId" className="admin-input" value={formValues.brandId} onChange={handleFormChange}>
                <option value="">Chọn thương hiệu</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Thời hạn bảo hành (tháng)" htmlFor="warrantyMonths" error={formErrors.warrantyMonths}>
              <input
                id="warrantyMonths"
                name="warrantyMonths"
                type="number"
                min="0"
                max="240"
                className="admin-input"
                value={formValues.warrantyMonths}
                onChange={handleFormChange}
                placeholder="VD: 36 (CPU/GPU), 60 (SSD Pro), 120 (Nguồn cao cấp)"
              />
            </AdminField>
            <AdminBtn type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Đang lưu…" : editingProductId ? "Cập nhật" : "Thêm sản phẩm"}
            </AdminBtn>
          </AdminForm>
        </AdminCard>

        <AdminCard>
          <div className="admin-panel-head">
            <div className="admin-section-title">
              <h3>Danh sách ({filteredProducts.length})</h3>
              <p>Tìm theo tên, slug, danh mục hoặc thương hiệu.</p>
            </div>
            <form onSubmit={handleSearchSubmit} className="admin-search-row">
              <input className="admin-input" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm sản phẩm…" />
              <AdminBtn type="submit" variant="dark">
                Tìm
              </AdminBtn>
            </form>
          </div>
          {loading ? (
            <AdminEmpty>Đang tải…</AdminEmpty>
          ) : filteredProducts.length === 0 ? (
            <AdminEmpty>Không có sản phẩm phù hợp.</AdminEmpty>
          ) : (
            <AdminTableWrap>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Slug</th>
                    <th>Danh mục</th>
                    <th>Thương hiệu</th>
                    <th>Bảo hành</th>
                    <th>TT</th>
                    <th>Tác vụ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <strong>{product.name}</strong>
                        <div style={{ fontSize: 13, color: "#64748b" }}>{product.description || "—"}</div>
                      </td>
                      <td>{product.slug || "—"}</td>
                      <td>{product.categoryName || "—"}</td>
                      <td>{product.brandName || "—"}</td>
                      <td>
                        <strong>{product.warrantyMonths || 24} tháng</strong>
                      </td>
                      <td>
                        <AdminBadge tone={product.status === "ACTIVE" ? "success" : "neutral"}>
                          {getProductStatusLabel(product.status)}
                        </AdminBadge>
                      </td>
                      <td>
                        <div className="admin-action-row">
                          <AdminBtn variant="secondary" onClick={() => handleEditProduct(product.id)}>
                            Sửa
                          </AdminBtn>
                          <AdminBtn variant="secondary" disabled={statusLoadingId === product.id} onClick={() => handleToggleStatus(product)}>
                            {statusLoadingId === product.id ? "Đang xử lý..." : product.status === "ACTIVE" ? "Ẩn" : "Bật hiển thị"}
                          </AdminBtn>
                          <AdminBtn variant="secondary" disabled={deleteLoadingId === product.id} onClick={() => handleDeleteProduct(product)}>
                            {deleteLoadingId === product.id ? "Đang xóa..." : "Xóa"}
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
