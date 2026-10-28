import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";

let io: SocketIOServer | null = null;

export interface OnlineStaff {
  socketId: string;
  staffId: string | number;
  staffName: string;
  role?: string;
  activeSessionsCount: number;
  lastAssignedAt: number;
}

// In-memory registry of online staff connected to the chat queue
const onlineStaffRegistry = new Map<string, OnlineStaff>();

/**
 * Register or update an online staff member in the queue registry
 */
export function registerOnlineStaff(
  socketId: string,
  data?: { staffId?: string | number; staffName?: string; role?: string }
): OnlineStaff {
  const existing = onlineStaffRegistry.get(socketId);
  const staffMember: OnlineStaff = {
    socketId,
    staffId: data?.staffId || existing?.staffId || socketId,
    staffName: data?.staffName || existing?.staffName || "Nhân viên bán hàng",
    role: data?.role || existing?.role || "SALES_STAFF",
    activeSessionsCount: existing?.activeSessionsCount || 0,
    lastAssignedAt: existing?.lastAssignedAt || 0
  };
  onlineStaffRegistry.set(socketId, staffMember);
  return staffMember;
}

/**
 * Unregister a staff member when socket disconnects or leaves queue
 */
export function unregisterOnlineStaff(socketId: string): void {
  onlineStaffRegistry.delete(socketId);
}

/**
 * Get all currently online staff members
 */
export function getOnlineStaffList(): OnlineStaff[] {
  return Array.from(onlineStaffRegistry.values());
}

/**
 * Clear online staff registry (useful in tests)
 */
export function clearOnlineStaffRegistry(): void {
  onlineStaffRegistry.clear();
}

/**
 * Find the next available staff member for auto-routing.
 * Algorithm: Least-Busy with Round-Robin tie breaker.
 * 1. Filter staff members by role (e.g. SALES_STAFF or ADMIN).
 * 2. Sort by activeSessionsCount ascending (least busy first).
 * 3. Tie-breaker: sort by lastAssignedAt ascending (longest time since last assignment = round-robin).
 * 4. Increment activeSessionsCount and update lastAssignedAt timestamp.
 */
export function findNextAvailableStaff(roleFilter?: string): OnlineStaff | null {
  if (onlineStaffRegistry.size === 0) return null;

  const candidates = Array.from(onlineStaffRegistry.values()).filter((s) => {
    if (!roleFilter) return true;
    const staffRole = String(s.role || "").toUpperCase();
    return staffRole === roleFilter.toUpperCase() || staffRole === "ADMIN" || staffRole === "SALES_STAFF";
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.activeSessionsCount !== b.activeSessionsCount) {
      return a.activeSessionsCount - b.activeSessionsCount;
    }
    return a.lastAssignedAt - b.lastAssignedAt;
  });

  const chosen = candidates[0];
  chosen.activeSessionsCount += 1;
  chosen.lastAssignedAt = Date.now();
  return chosen;
}

/**
 * Decrement active session count for a staff member when a session is closed or resolved
 */
export function releaseStaffSession(staffName?: string | null): void {
  if (!staffName) return;
  for (const staff of onlineStaffRegistry.values()) {
    if (staff.staffName === staffName) {
      staff.activeSessionsCount = Math.max(0, staff.activeSessionsCount - 1);
      break;
    }
  }
}

export function initSocketIO(httpServer: HttpServer, frontendUrl: string): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [frontendUrl, "http://localhost:5173", "http://localhost:3000"],
      methods: ["GET", "POST"],
      credentials: true
    },
    // Allow both WebSocket and HTTP long-polling fallback
    transports: ["websocket", "polling"]
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // ── CHAT ──────────────────────────────────────────────
    // Nhân viên / Khách hàng tham gia room của 1 chat session
    socket.on("join_chat", (sessionId: string) => {
      if (!sessionId) return;
      const room = `chat:${sessionId}`;
      socket.join(room);
      console.log(`[Socket.io] ${socket.id} joined room ${room}`);
    });

    socket.on("leave_chat", (sessionId: string) => {
      if (!sessionId) return;
      socket.leave(`chat:${sessionId}`);
    });

    // ── TICKET ────────────────────────────────────────────
    // Kỹ thuật viên / Khách hàng tham gia room của 1 ticket
    socket.on("join_ticket", (ticketId: string | number) => {
      if (!ticketId) return;
      const room = `ticket:${ticketId}`;
      socket.join(room);
      console.log(`[Socket.io] ${socket.id} joined room ${room}`);
    });

    socket.on("leave_ticket", (ticketId: string | number) => {
      if (!ticketId) return;
      socket.leave(`ticket:${ticketId}`);
    });

    // ── STAFF QUEUES ──────────────────────────────────────
    // Nhân viên bán hàng đăng ký nhận thông báo hàng đợi chat & tham gia routing pool
    socket.on("join_staff_queue", (data?: { staffId?: string | number; staffName?: string; role?: string }) => {
      socket.join("staff:chat_queue");
      const staffMember = registerOnlineStaff(socket.id, data);
      console.log(`[Socket.io] Staff "${staffMember.staffName}" (${socket.id}) joined staff:chat_queue`);
    });

    socket.on("leave_staff_queue", () => {
      socket.leave("staff:chat_queue");
      unregisterOnlineStaff(socket.id);
      console.log(`[Socket.io] ${socket.id} left staff:chat_queue`);
    });

    // Kỹ thuật viên đăng ký nhận thông báo hàng đợi ticket
    socket.on("join_tech_queue", () => {
      socket.join("staff:tech_queue");
      console.log(`[Socket.io] ${socket.id} joined staff:tech_queue`);
    });

    // ── USER IN-APP NOTIFICATIONS ─────────────────────────
    // Khách hàng hoặc người dùng đăng ký nhận thông báo cá nhân (đơn hàng, bảo hành, ticket...)
    socket.on("join_user", (userId: string | number) => {
      if (!userId) return;
      const room = `user:${userId}`;
      socket.join(room);
      console.log(`[Socket.io] ${socket.id} joined personal notification room ${room}`);
    });

    socket.on("leave_user", (userId: string | number) => {
      if (!userId) return;
      socket.leave(`user:${userId}`);
      console.log(`[Socket.io] ${socket.id} left personal notification room user:${userId}`);
    });

    socket.on("disconnect", (reason) => {
      unregisterOnlineStaff(socket.id);
      console.log(`[Socket.io] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log("[Socket.io] Server initialized");
  return io;
}

/**
 * Lấy instance Socket.io hiện tại.
 * Dùng trong controllers để emit events.
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("[Socket.io] Server not initialized. Call initSocketIO() first.");
  }
  return io;
}

/**
 * Emit an event to a specific chat session room
 */
export function emitToChatRoom(sessionId: string, event: string, data: unknown): void {
  try {
    getIO().to(`chat:${sessionId}`).emit(event, data);
  } catch {
    // Socket not initialized (e.g. during tests) — silently ignore
  }
}

/**
 * Emit an event directly to a specific staff member's socket
 */
export function emitToStaff(socketId: string, event: string, data: unknown): void {
  try {
    getIO().to(socketId).emit(event, data);
  } catch {
    // Silently ignore
  }
}

/**
 * Emit an event to a specific ticket room
 */
export function emitToTicketRoom(ticketId: string | number, event: string, data: unknown): void {
  try {
    getIO().to(`ticket:${ticketId}`).emit(event, data);
  } catch {
    // Socket not initialized — silently ignore
  }
}

/**
 * Notify all staff in the chat queue room (new session arrived, queue updated, etc.)
 */
export function emitToStaffChatQueue(event: string, data: unknown): void {
  try {
    getIO().to("staff:chat_queue").emit(event, data);
  } catch {
    // Silently ignore
  }
}

/**
 * Notify all tech staff in the tech queue room (new ticket, ticket updated, etc.)
 */
export function emitToTechQueue(event: string, data: unknown): void {
  try {
    getIO().to("staff:tech_queue").emit(event, data);
  } catch {
    // Silently ignore
  }
}

/**
 * Emit an in-app notification directly to a specific user's personal room
 */
export function emitToUser(userId: string | number, event: string, data: unknown): void {
  try {
    getIO().to(`user:${userId}`).emit(event, data);
  } catch {
    // Socket not initialized (e.g. during standalone tests) — silently ignore
  }
}
