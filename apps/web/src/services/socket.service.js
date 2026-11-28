/**
 * Socket.io Client Service — True Singleton pattern with dynamic JWT auth & auto room re-join
 * Quản lý 1 kết nối duy nhất đến Socket.io server, không rò rỉ socket khi re-render,
 * và tự động re-join tất cả các room đã đăng ký khi reconnect hoặc xoay vòng JWT.
 */
import { io } from "socket.io-client";
import { getAuthState, subscribeAuth } from "../store/authStore";

const RAW_API_URL = String(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "").trim();
const SOCKET_URL = /^https?:\/\//i.test(RAW_API_URL)
  ? RAW_API_URL.replace(/\/api\/?$/, "")
  : (typeof window !== "undefined" ? window.location.origin : "http://localhost:4000");

let socket = null;
let lastAuthToken = getAuthState()?.accessToken || "";
let authSubscriptionAttached = false;

/**
 * Ref-counted registry of active room join subscriptions:
 * key -> { roomEvent: string, payload: any, count: number }
 */
const activeRoomSubscriptions = new Map();

function buildRoomKey(roomEvent, payload) {
  return `${String(roomEvent || "")}::${payload === undefined || payload === null ? "" : JSON.stringify(payload)}`;
}

function emitRoomJoin(sock, roomEvent, payload) {
  if (!sock) return;
  if (payload !== undefined && payload !== null) {
    sock.emit(roomEvent, payload);
  } else {
    sock.emit(roomEvent);
  }
}

function rejoinAllRegisteredRooms(sock) {
  if (!sock || activeRoomSubscriptions.size === 0) return;
  for (const entry of activeRoomSubscriptions.values()) {
    emitRoomJoin(sock, entry.roomEvent, entry.payload);
  }
}

export function registerRoomSubscription(roomEvent, payload) {
  const key = buildRoomKey(roomEvent, payload);
  const existing = activeRoomSubscriptions.get(key);
  if (existing) {
    existing.count += 1;
    // Update latest payload (e.g., updated staffName metadata on join_staff_queue)
    existing.payload = payload;
  } else {
    activeRoomSubscriptions.set(key, { roomEvent, payload, count: 1 });
  }
}

export function unregisterRoomSubscription(roomEvent, payload) {
  const key = buildRoomKey(roomEvent, payload);
  const existing = activeRoomSubscriptions.get(key);
  if (!existing) return;
  existing.count -= 1;
  if (existing.count <= 0) {
    activeRoomSubscriptions.delete(key);
  }
}

function ensureAuthSync() {
  if (authSubscriptionAttached) return;
  authSubscriptionAttached = true;
  subscribeAuth((nextState) => {
    const nextToken = nextState?.accessToken || "";
    if (nextToken === lastAuthToken) return;
    lastAuthToken = nextToken;
    if (socket) {
      socket.auth = { token: nextToken };
      if (socket.connected) {
        socket.disconnect().connect();
      } else if (!socket.active) {
        socket.connect();
      }
    }
  });
}

/**
 * Lấy hoặc khởi tạo 1 Socket.io connection duy nhất
 * @returns {import("socket.io-client").Socket} socket instance
 */
export function getSocket() {
  ensureAuthSync();

  if (!socket) {
    lastAuthToken = getAuthState()?.accessToken || "";
    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      auth: (cb) => {
        cb({ token: getAuthState()?.accessToken || "" });
      }
    });

    socket.on("connect", () => {
      console.log("[Socket.io] Connected:", socket.id);
      rejoinAllRegisteredRooms(socket);
    });

    socket.on("connect_error", (err) => {
      console.warn("[Socket.io] Connection error:", err.message);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket.io] Disconnected:", reason);
    });
  } else if (socket.disconnected && !socket.active) {
    socket.connect();
  }

  return socket;
}

/**
 * Ngắt kết nối và xóa socket instance
 */
export function disconnectSocket() {
  activeRoomSubscriptions.clear();
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log("[Socket.io] Manually disconnected");
  }
}

export default {
  getSocket,
  disconnectSocket,
  registerRoomSubscription,
  unregisterRoomSubscription
};
