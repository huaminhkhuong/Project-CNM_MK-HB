import { httpClient } from "./http";

export async function getAdminProducts(params = {}) {
  const response = await httpClient.get("/admin/products", { params });
  return response.data;
}

export async function createAdminProduct(payload) {
  const response = await httpClient.post("/admin/products", payload);
  return response.data;
}

export async function updateAdminProduct(productId, payload) {
  const response = await httpClient.patch(`/admin/products/${productId}`, payload);
  return response.data;
}

export async function changeAdminProductStatus(productId, status) {
  const response = await httpClient.patch(`/admin/products/${productId}/status`, { status });
  return response.data;
}

export async function deleteAdminProduct(productId) {
  const response = await httpClient.delete(`/admin/products/${productId}`);
  return response.data;
}

export async function getAdminTags() {
  const response = await httpClient.get("/admin/tags");
  return response.data;
}

export async function createAdminTag(payload) {
  const response = await httpClient.post("/admin/tags", payload);
  return response.data;
}

export async function deleteAdminTag(tagId) {
  const response = await httpClient.delete(`/admin/tags/${tagId}`);
  return response.data;
}

export async function setAdminProductTags(productId, tags) {
  const response = await httpClient.put(`/admin/products/${productId}/tags`, { tags });
  return response.data;
}
