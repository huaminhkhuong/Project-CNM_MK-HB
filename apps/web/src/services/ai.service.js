import { httpClient } from "./http";

export async function sendAiChat(payload) {
  const response = await httpClient.post("/ai/chat", payload);
  return response.data;
}

export async function getAiChatHistory() {
  const response = await httpClient.get("/ai/history");
  return response.data;
}

export async function clearAiChatHistory() {
  const response = await httpClient.delete("/ai/history");
  return response.data;
}

export async function getAiBuildAdvice(buildId, payload) {
  const response = await httpClient.post(`/ai/builds/${buildId}/advice`, payload);
  return response.data;
}

export async function sendAiFeedback(payload) {
  const response = await httpClient.post("/ai/feedback", payload);
  return response.data;
}

// ==================== ADMIN AI MANAGEMENT ====================

export async function getAdminAiRules(params = {}) {
  const response = await httpClient.get("/ai/admin/rules", { params });
  return response.data;
}

export async function getAdminAiRule(id) {
  const response = await httpClient.get(`/ai/admin/rules/${id}`);
  return response.data;
}

export async function createAdminAiRule(data) {
  const response = await httpClient.post("/ai/admin/rules", data);
  return response.data;
}

export async function updateAdminAiRule(id, data) {
  const response = await httpClient.put(`/ai/admin/rules/${id}`, data);
  return response.data;
}

export async function deleteAdminAiRule(id) {
  const response = await httpClient.delete(`/ai/admin/rules/${id}`);
  return response.data;
}

export async function toggleAdminAiRule(id) {
  const response = await httpClient.patch(`/ai/admin/rules/${id}/toggle`);
  return response.data;
}

export async function getAdminAiPrompts() {
  const response = await httpClient.get("/ai/admin/prompts");
  return response.data;
}

export async function updateAdminAiPrompt(scope, data) {
  const response = await httpClient.put(`/ai/admin/prompts/${scope}`, data);
  return response.data;
}

export async function testAdminAiFilter(data) {
  const response = await httpClient.post("/ai/admin/test-filter", data);
  return response.data;
}

export async function getAdminAiSystemConfig() {
  const response = await httpClient.get("/ai/admin/system-config");
  return response.data;
}

export async function updateAdminAiSystemConfig(data) {
  const response = await httpClient.put("/ai/admin/system-config", data);
  return response.data;
}
