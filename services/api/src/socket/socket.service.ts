import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { isTokenBlacklisted } from "../services/token-blacklist.service";
import { getLiveUserAuthState } from "../middlewares/auth.middleware";

let io: SocketIOServer | null = null;

interface SocketAuthUser {
  userId: string;
  email: string;
  role: string;
}

function normalizeSocketRole(role?: string | null): string {
  return String(role || "").trim().toUpperCase();
}

function isStaffOrAdminRole(role?: string | null): boolean {
  const r = normalizeSocketRole(role);
  return r === "ADMIN" || r === "SALES_STAFF" || r === "SALES";
}

function isTechOrAdminRole(role?: string | null): boolean {
  const r = normalizeSocketRole(role);
  return r === "ADMIN" || r === "TECH_STAFF" || r === "TECH";
}

function isAnyStaffRole(role?: string | null): boolean {
  return isStaffOrAdminRole(role) || isTechOrAdminRole(role);
}

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
  const allowedOrigins =
    env.nodeEnv === "production"
      ? [frontendUrl].filter(Boolean)
      : Array.from(new Set([frontendUrl, "http://localhost:5173", "http://localhost:3000"].filter(Boolean)));

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true
    },
    // Allow both WebSocket and HTTP long-polling fallback
    transports: ["websocket", "polling"]
  });

  // Authenticate JWT on Socket.io handshake (guests remain allowed ONLY for chat room subscriptions)
  io.use(async (socket, next) => {
    try {
      const authToken = typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token.trim() : "";
      const headerAuth = typeof socket.handshake.headers?.authorization === "string"
        ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, "").trim()
        : "";
      const token = authToken || headerAuth;

      if (token) {
        const blacklisted = await isTokenBlacklisted(token).catch(() => false);
        if (!blacklisted) {
          const decoded = jwt.verify(token, env.jwtAccessSecret) as any;
          const uid = decoded?.userId ?? decoded?.id;
          if (uid) {
            const numericUid = Number(uid);
            let effectiveRole = normalizeSocketRole(decoded?.role);
            let isAllowed = true;
            if (Number.isInteger(numericUid) && numericUid > 0) {
              const liveUser = await getLiveUserAuthState(numericUid);
              if (liveUser) {
                if (liveUser.status !== "ACTIVE") {
                  isAllowed = false;
                } else if (
                  liveUser.roleName &&
                  (!decoded?.email || !liveUser.email || String(decoded.email).toLowerCase() === liveUser.email.toLowerCase())
                ) {
                  effectiveRole = normalizeSocketRole(liveUser.roleName);
                }
              }
            }
            if (isAllowed) {
              socket.data.user = {
                userId: String(uid),
                email: String(decoded?.email || ""),
                role: effectiveRole
              } as SocketAuthUser;
            } else {
              socket.data.user = null;
            }
          }
        }
      }
    } catch {
      socket.data.user = null;
    }
    next();
  });

  io.on("connection", (socket: Socket) => {
    const authUser = (socket.data.user || null) as SocketAuthUser | null;
    console.log(`[Socket.io] Client connected: ${socket.id} (${authUser ? `${authUser.role}#${authUser.userId}` : "guest"})`);

    // ── CHAT ──────────────────────────────────────────────
    // Nhân viên / Khách hàng tham gia room của 1 chat session (chỉ cho phép session UUID tồn tại thật)
    socket.on("join_chat", async (sessionId: string) => {
      const cleanId = typeof sessionId === "string" ? sessionId.trim() : "";
      if (!cleanId || cleanId.length < 8 || cleanId.length > 80) return;
      try {
        const existingSession = await prisma.chatSession.findUnique({
          where: { session_id: cleanId },
          select: { id: true }
        });
        if (!existingSession) {
          socket.emit("socket:error", { code: "NOT_FOUND", message: "Chat session not found" });
          return;
        }
        const room = `chat:${cleanId}`;
        socket.join(room);
        console.log(`[Socket.io] ${socket.id} joined room ${room}`);
      } catch {
        socket.emit("socket:error", { code: "INTERNAL_ERROR", message: "Unable to verify chat session" });
      }
    });

    socket.on("leave_chat", (sessionId: string) => {
      if (!sessionId) return;
      socket.leave(`chat:${sessionId}`);
    });

    // ── TICKET ────────────────────────────────────────────
    // Kỹ thuật viên / Chủ ticket tham gia room của 1 ticket (bắt buộc xác thực JWT + sở hữu/vai trò)
    socket.on("join_ticket", async (ticketId: string | number) => {
      const numericId = Number(ticketId);
      if (!Number.isInteger(numericId) || numericId <= 0) return;
      if (!authUser) {
        socket.emit("socket:error", { code: "UNAUTHORIZED", message: "Authentication required to join ticket room" });
        return;
      }
      if (!isAnyStaffRole(authUser.role)) {
        const ownsTicket = await prisma.ticket.findFirst({
          where: { id: numericId, user_id: Number(authUser.userId) },
          select: { id: true }
        }).catch(() => null);
        if (!ownsTicket) {
          socket.emit("socket:error", { code: "FORBIDDEN", message: "Forbidden: cannot join another user's ticket room" });
          return;
        }
      }
      const room = `ticket:${numericId}`;
      socket.join(room);
      console.log(`[Socket.io] ${socket.id} joined room ${room}`);
    });

    socket.on("leave_ticket", (ticketId: string | number) => {
      if (!ticketId) return;
      socket.leave(`ticket:${ticketId}`);
    });

    // ── STAFF QUEUES ──────────────────────────────────────
    // Chỉ SALES_STAFF / ADMIN đã xác thực JWT mới được tham gia routing pool hàng đợi chat
    socket.on("join_staff_queue", (data?: { staffId?: string | number; staffName?: string; role?: string }) => {
      if (!authUser || !isStaffOrAdminRole(authUser.role)) {
        socket.emit("socket:error", { code: "FORBIDDEN", message: "Forbidden: staff authentication required" });
        return;
      }
      socket.join("staff:chat_queue");
      const staffMember = registerOnlineStaff(socket.id, {
        staffId: authUser.userId,
        staffName: data?.staffName || authUser.email || "Nhân viên bán hàng",
        role: authUser.role
      });
      console.log(`[Socket.io] Staff "${staffMember.staffName}" (${socket.id}) joined staff:chat_queue`);
    });

    socket.on("leave_staff_queue", () => {
      socket.leave("staff:chat_queue");
      unregisterOnlineStaff(socket.id);
      console.log(`[Socket.io] ${socket.id} left staff:chat_queue`);
    });

    // Chỉ TECH_STAFF / ADMIN đã xác thực JWT mới được vào hàng đợi ticket kỹ thuật
    socket.on("join_tech_queue", () => {
      if (!authUser || !isTechOrAdminRole(authUser.role)) {
        socket.emit("socket:error", { code: "FORBIDDEN", message: "Forbidden: tech staff authentication required" });
        return;
      }
      socket.join("staff:tech_queue");
      console.log(`[Socket.io] ${socket.id} joined staff:tech_queue`);
    });

    // ── USER IN-APP NOTIFICATIONS ─────────────────────────
    // Chỉ cho phép tham gia room thông báo của CHÍNH tài khoản trong JWT
    socket.on("join_user", (userId: string | number) => {
      if (!userId) return;
      if (!authUser || String(authUser.userId) !== String(userId)) {
        socket.emit("socket:error", { code: "FORBIDDEN", message: "Forbidden: cannot join another user's notification room" });
        return;
      }
      const room = `user:${authUser.userId}`;
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

/**
 * Close Socket.io server and disconnect all sockets cleanly during Graceful Shutdown
 */
export async function closeSocketIO(): Promise<void> {
  if (io) {
    try {
      await new Promise<void>((resolve) => {
        io?.close(() => {
          console.log("[Socket.io] All connections closed cleanly.");
          resolve();
        });
      });
      io = null;
    } catch (err) {
      console.warn("[Socket.io] Error closing server:", err);
    }
  }
}
