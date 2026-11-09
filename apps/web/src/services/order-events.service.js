import { getStoredAuth } from "../utils/storage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export function subscribeToOrderEvents(onOrderUpdated) {
  const token = getStoredAuth()?.accessToken;
  if (!token || typeof EventSource === "undefined") {
    return () => {};
  }

  const url = `${API_BASE_URL}/orders/events?token=${encodeURIComponent(token)}`;
  const source = new EventSource(url);

  source.addEventListener("order.updated", (event) => {
    try {
      onOrderUpdated(JSON.parse(event.data));
    } catch (_error) {
      onOrderUpdated(null);
    }
  });

  source.onerror = () => {
    source.close();
  };

  return () => source.close();
}
