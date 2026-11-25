import { httpClient } from "./http";

export async function createChatSession(payload = {}) {
  const response = await httpClient.post("/chat/session", payload);
  return response.data;
}

export async function getChatQueue() {
  const response = await httpClient.get("/chat/queue");
  return response.data;
}

export async function getChatQueueStats() {
  const response = await httpClient.get("/chat/queue/stats");
  return response.data;
}

export async function acceptChatSession(sessionId, payload = {}) {
  const response = await httpClient.post(`/chat/session/${sessionId}/accept`, payload);
  return response.data;
}

export async function closeChatSession(sessionId) {
  const response = await httpClient.post(`/chat/session/${sessionId}/close`);
  return response.data;
}

export async function getChatSession(sessionId) {
  const response = await httpClient.get(`/chat/session/${sessionId}`);
  return response.data;
}

export async function sendChatMessage(sessionId, payload) {
  const response = await httpClient.post(`/chat/session/${sessionId}/message`, payload);
  return response.data;
}

export async function handoffChatSession(sessionId, payload = {}) {
  const response = await httpClient.post(`/chat/session/${sessionId}/handoff`, payload);
  return response.data;
}

