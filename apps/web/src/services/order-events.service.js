import { getStoredAuth } from "../utils/storage";
import { httpClient } from "./http";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const MAX_RECONNECT_ATTEMPTS = 5;

export function subscribeToOrderEvents(onOrderUpdated) {
  if (typeof EventSource === "undefined") {
    return () => {};
  }

  let closed = false;
  let source = null;
  let reconnectTimer = null;
  let attempts = 0;

  function scheduleReconnect() {
    if (closed || attempts >= MAX_RECONNECT_ATTEMPTS) return;
    attempts += 1;
    const delayMs = Math.min(16000, 2000 * Math.pow(2, attempts - 1));
    reconnectTimer = window.setTimeout(connect, delayMs);
  }

  async function connect() {
    if (closed) return;
    const token = getStoredAuth()?.accessToken;
    if (!token) return;

    let ticket = "";
    try {
      const response = await httpClient.post("/orders/events/ticket");
      ticket = String(response?.data?.data?.ticket || "").trim();
    } catch {
      scheduleReconnect();
      return;
    }

    if (closed || !ticket) return;

    const url = `${API_BASE_URL}/orders/events?ticket=${encodeURIComponent(ticket)}`;
    source = new EventSource(url);

    source.onopen = () => {
      attempts = 0;
    };

    source.addEventListener("order.updated", (event) => {
      attempts = 0;
      try {
        onOrderUpdated(JSON.parse(event.data));
      } catch (_error) {
        onOrderUpdated(null);
      }
    });

    source.onerror = () => {
      if (source) {
        source.close();
        source = null;
      }
      scheduleReconnect();
    };
  }

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (source) {
      source.close();
      source = null;
    }
  };
}
