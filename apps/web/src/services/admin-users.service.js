import { httpClient } from "./http";

export async function getAdminUsers(params = {}) {
  const response = await httpClient.get("/admin/users", { params });
  return response.data;
}

export async function changeAdminUserStatus(userId, status) {
  const response = await httpClient.patch(`/admin/users/${userId}/status`, { status });
  return response.data;
}

export async function changeAdminUserRole(userId, role) {
  const response = await httpClient.patch(`/admin/users/${userId}/role`, { role });
  return response.data;
}
