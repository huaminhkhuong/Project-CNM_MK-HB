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

export async function getAiBuilderQuestions(purpose = "gaming", step = 1, budget = 20000000, previousAnswers = null) {
  const response = await httpClient.post("/ai/builder/questions", {
    purpose,
    step,
    budget,
    previous_answers: previousAnswers
  });
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

// ==================== ADMIN RAG & KNOWLEDGE DOCUMENTS ====================

export async function getAdminAiDocuments() {
  const response = await httpClient.get("/ai/admin/documents");
  return response.data;
}

export async function uploadAdminAiDocument(formData) {
  const response = await httpClient.post("/ai/admin/documents/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    },
    timeout: 120000
  });
  return response.data;
}

export async function deleteAdminAiDocument(filename) {
  const response = await httpClient.delete(`/ai/admin/documents/${encodeURIComponent(filename)}`);
  return response.data;
}

export async function getAdminAiDocumentChunks(filename) {
  const response = await httpClient.get(`/ai/admin/documents/${encodeURIComponent(filename)}/chunks`);
  return response.data;
}

export async function reindexAdminAiDocuments() {
  const response = await httpClient.post("/ai/admin/documents/reindex", {}, { timeout: 60000 });
  return response.data;
}

export async function getAdminAiReindexStatus() {
  const response = await httpClient.get("/ai/admin/documents/reindex-status");
  return response.data;
}

export async function getAdminAiEmbeddingModels() {
  const response = await httpClient.get("/ai/admin/embedding-models");
  return response.data;
}
