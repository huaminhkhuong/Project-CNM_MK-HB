import { Request, Response } from "express";

import { prisma } from "../../config/prisma";
import { ROLES } from "../../constants/roles";
import { AppError } from "../../errors/app-error";
import { asyncHandler } from "../../utils/async-handler";
import {
  emitToTicketRoom,
  emitToTechQueue
} from "../../socket/socket.service";
import { sendTicketNotification } from "../notifications/notifications.service";
import {
  createTicketMessage,
  createTicket,
  getTicketById,
  getTicketsByReporter,
  getTicketQueueStats,
  listTickets,
  updateTicket
} from "./tickets.repository";
import { addTicketMessageSchema, createTicketSchema, updateTicketSchema } from "./tickets.validator";

export const postMyTicket = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const payload = createTicketSchema.parse(req.body);

  const ticket = await createTicket({
    userId: req.user.userId,
    title: payload.title,
    description: payload.description,
    priority: payload.priority
  });

  // 🔔 Real-time: Thông báo kỹ thuật viên có ticket mới
  emitToTechQueue("tickets:new_ticket", ticket);

  res.status(201).json({
    success: true,
    data: ticket
  });
});

export const getMyTickets = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const tickets = await getTicketsByReporter(req.user.userId);

  res.status(200).json({
    success: true,
    data: tickets
  });
});

function isTechRole(role?: string) {
  const normalized = String(role || "").toUpperCase();
  return normalized === ROLES.TECH_STAFF || normalized === "TECHNICIAN";
}

function canManageTicketRole(role?: string) {
  const normalized = String(role || "").toUpperCase();
  return (
    normalized === ROLES.ADMIN ||
    isTechRole(normalized) ||
    normalized === ROLES.SALES_STAFF ||
    normalized === "SALES"
  );
}

function isInternalMessage(message: { visibility?: string } | null | undefined) {
  return String(message?.visibility || "PUBLIC").toUpperCase() === "INTERNAL";
}

function filterTicketForViewer(ticket: any, user: { userId: string | number; role?: string }) {
  if (!ticket) return ticket;

  if (canManageTicketRole(user.role)) {
    return ticket;
  }

  return {
    ...ticket,
    messages: (ticket.messages || []).filter((message: any) => !isInternalMessage(message))
  };
}

function canAccessTicket(ticket: { user_id?: number | null }, user: { userId: string | number; role?: string }) {
  return Number(ticket.user_id) === Number(user.userId) || canManageTicketRole(user.role);
}

export const getTicketDetail = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const ticket = await getTicketById(req.params.id);
  if (!ticket) {
    throw new AppError("Ticket not found", 404);
  }

  if (!canAccessTicket(ticket, req.user)) {
    throw new AppError("Forbidden", 403);
  }

  res.status(200).json({
    success: true,
    data: filterTicketForViewer(ticket, req.user)
  });
});

export const getAllTickets = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const scope = String(req.query.scope || "ALL");
  const status = req.query.status ? String(req.query.status) : undefined;
  const priority = req.query.priority ? String(req.query.priority) : undefined;
  const keyword = req.query.keyword ? String(req.query.keyword) : undefined;

  const tickets = await listTickets({
    scope,
    status,
    priority,
    keyword,
    assignedToId: scope.toUpperCase() === "ASSIGNED" ? Number(req.user.userId) : undefined
  });

  res.status(200).json({
    success: true,
    data: tickets
  });
});

export const getTicketStats = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const stats = await getTicketQueueStats(Number(req.user.userId));

  res.status(200).json({
    success: true,
    data: stats
  });
});

export const patchTicket = asyncHandler(async (req: Request, res: Response) => {
  const payload = updateTicketSchema.parse(req.body);

  const ticket = await getTicketById(req.params.id);
  if (!ticket) {
    throw new AppError("Ticket not found", 404);
  }

  if (payload.assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: payload.assignedToId },
      include: { Role: true }
    });

    if (!assignee) {
      throw new AppError("Assignee not found", 404);
    }

    const assigneeRole = String((assignee as any).Role?.name || "").toUpperCase();
    const isValidAssignee =
      assigneeRole === ROLES.ADMIN || assigneeRole === ROLES.TECH_STAFF || assigneeRole === "TECHNICIAN";

    if (!isValidAssignee) {
      throw new AppError("Assignee must be technician or admin", 400);
    }
  }

  const updated = await updateTicket(req.params.id, {
    status: payload.status,
    priority: payload.priority,
    assigned_to_id: payload.assignedToId
  });

  // 🔔 Real-time: Thông báo trạng thái thay đổi cho client trong room ticket
  emitToTicketRoom(req.params.id, "ticket:status_changed", updated);
  // 🔔 Real-time: Cập nhật danh sách cho kỹ thuật viên
  emitToTechQueue("tickets:queue_updated", { ticketId: req.params.id, status: payload.status });

  // 🔔 Gửi thông báo in-app cho người tạo ticket khi có thay đổi trạng thái
  const ticketCreatorId = (ticket as any).userId || (ticket as any).user_id;
  if (payload.status && ticketCreatorId) {
    sendTicketNotification({
      userId: Number(ticketCreatorId),
      ticketId: req.params.id,
      ticketTitle: (ticket as any).title || "Yêu cầu hỗ trợ kỹ thuật",
      action: "STATUS_CHANGED",
      status: payload.status
    }).catch((err) => console.warn("[Notification] Ticket notification failed:", err.message));
  }

  res.status(200).json({
    success: true,
    data: updated
  });
});

export const postTicketMessage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const ticket = await getTicketById(req.params.id);
  if (!ticket) {
    throw new AppError("Ticket not found", 404);
  }

  if (!canAccessTicket(ticket, req.user)) {
    throw new AppError("Forbidden", 403);
  }

  const payload = addTicketMessageSchema.parse(req.body);
  const visibility = canManageTicketRole(req.user.role) && payload.visibility === "INTERNAL" ? "INTERNAL" : "PUBLIC";
  const updated = await createTicketMessage({
    ticketId: req.params.id,
    userId: req.user.userId,
    message: payload.message,
    visibility
  });

  const filtered = filterTicketForViewer(updated, req.user);

  // 🔔 Real-time: Tin nhắn mới trong ticket - đẩy đến tất cả clients đang xem ticket này
  emitToTicketRoom(req.params.id, "ticket:new_message", {
    ticketId: req.params.id,
    message: payload.message,
    visibility,
    userId: req.user.userId
  });

  // 🔔 Gửi thông báo in-app cho người tạo ticket khi kỹ thuật viên trả lời công khai
  const ticketCreatorId = (ticket as any).userId || (ticket as any).user_id;
  const senderId = Number(req.user.userId);
  if (visibility === "PUBLIC" && ticketCreatorId && Number(ticketCreatorId) !== senderId) {
    sendTicketNotification({
      userId: Number(ticketCreatorId),
      ticketId: req.params.id,
      ticketTitle: (ticket as any).title || "Yêu cầu hỗ trợ kỹ thuật",
      action: "NEW_REPLY",
      detailMessage: payload.message ? payload.message.slice(0, 150) : undefined
    }).catch((err) => console.warn("[Notification] Ticket reply notification failed:", err.message));
  }

  res.status(201).json({
    success: true,
    data: filtered
  });
});

export const ticketManageRoles = [ROLES.ADMIN, ROLES.TECHNICIAN, ROLES.SALES];
