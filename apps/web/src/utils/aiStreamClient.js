/**
 * ⚡ aiStreamClient.js
 * ==============================================================================
 * Helper chuyên dụng xử lý Server-Sent Events (SSE) Streaming từ Backend
 * dành cho các tính năng AI PC Builder:
 * - Chức năng 1: AI Đề xuất từ Pool 32 linh kiện (streamAiSuggestBuild)
 * - Chức năng 2: AI Thẩm định & Đề xuất đổi linh kiện (streamAiAuditBuild)
 * - Chức năng 3: Chat tương tác trực tiếp với AI về cấu hình (streamAiChatBuild)
 * ==============================================================================
 */

import { getStoredAuth } from "./storage";

export async function streamAiResponse(endpoint, payload, { onChunk, onDone, onError, signal }) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  try {
    const auth = getStoredAuth();
    const headers = {
      "Content-Type": "application/json"
    };
    if (auth?.accessToken) {
      headers["Authorization"] = `Bearer ${auth.accessToken}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Lỗi máy chủ AI (${res.status})`);
    }

    if (!res.body) {
      throw new Error("Trình duyệt không hỗ trợ đọc Stream phản hồi.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    const processLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) return;
      const jsonStr = trimmed.substring(5).trim();
      if (jsonStr === "[DONE]") return;

      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.type === "chunk" && parsed.text) {
          if (typeof onChunk === "function") {
            onChunk(parsed.text);
          }
        } else if (parsed.type === "done") {
          if (typeof onDone === "function") {
            onDone(parsed);
          }
        } else if (parsed.type === "error") {
          if (typeof onError === "function") {
            onError(new Error(parsed.error || "Lỗi xử lý AI"));
          }
        }
      } catch (_jsonErr) {
        // Bỏ qua nếu dòng JSON chưa trọn vẹn
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        if (buffer.trim()) {
          for (const line of buffer.split("\n")) processLine(line);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Giữ lại dòng cuối nếu chưa hoàn thiện

      for (const line of lines) {
        processLine(line);
      }
    }
  } catch (err) {
    if (err?.name === "AbortError" || err?.name === "CanceledError") {
      console.log("AI Stream request canceled by user.");
      return;
    }
    if (typeof onError === "function") {
      onError(err);
    }
  }
}
