import { httpClient } from "./http";

export async function getAdminSystemOverview() {
  const response = await httpClient.get("/admin/system/overview");
  return response.data;
}

export async function getAdminSystemSettings() {
  const response = await httpClient.get("/admin/system/settings");
  return response.data;
}

export async function updateAdminSystemSettings(payload) {
  const response = await httpClient.patch("/admin/system/settings", payload);
  return response.data;
}

export async function getAdminAuditLogs(params = {}) {
  const response = await httpClient.get("/admin/system/audit-logs", { params });
  return response.data;
}
