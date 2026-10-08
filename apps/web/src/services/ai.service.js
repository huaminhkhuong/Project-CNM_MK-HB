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
