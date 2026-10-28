import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

import { PrismaClient } from "@prisma/client";
import {
  emitToChatRoom,
  emitToStaff,
  emitToStaffChatQueue,
  findNextAvailableStaff,
  getOnlineStaffList,
  releaseStaffSession
} from "../../socket/socket.service";
import { AiContextService } from "../ai/ai-context.service";

const prisma = new PrismaClient();

type ChatSender = "customer" | "staff" | "system";
type ChatStatus = "open" | "assigned" | "waiting_customer" | "waiting_staff" | "resolved" | "waiting" | "active" | "closed";
type ConversationType = "AI_CHAT" | "HUMAN_SUPPORT" | "SALES_CONSULTATION";

function normalizeStatus(status?: string | null): ChatStatus {
  if (status === "waiting") return "waiting_staff";
  if (status === "active") return "assigned";
  if (status === "closed") return "resolved";
  return (status || "waiting_staff") as ChatStatus;
}

function normalizeConversationType(value?: string | null): ConversationType {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "AI_CHAT" || normalized === "HUMAN_SUPPORT" || normalized === "SALES_CONSULTATION") {
    return normalized as ConversationType;
  }
  return "SALES_CONSULTATION";
}

function readBuildData(value?: string | null) {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function mapMessage(message: any) {
  return {
    id: String(message.id),
    sender: message.sender as ChatSender,
    text: message.text,
    timestamp: message.created_at.toISOString(),
    buildData: readBuildData(message.build_data)
  };
}

function mapSession(session: any) {
  const metaMessage = session?.messages?.find((message: any) => readBuildData(message.build_data)?.conversationType);
  const meta = readBuildData(metaMessage?.build_data);

  return {
    id: session.id,
    sessionId: session.session_id,
    status: normalizeStatus(session.status),
    conversationType: normalizeConversationType(meta?.conversationType),
    customerName: session.customer_name,
    staffName: session.staff_name,
    linkedOrderId: session.linked_order_id,
    createdAt: session.created_at.toISOString(),
    updatedAt: session.updated_at.toISOString(),
    messages: (session.messages || []).map(mapMessage)
  };
}

export const createSession = async (req: Request, res: Response) => {
  try {
    const {
      customerName,
      linkedOrderId,
      initialMessage,
      conversationType,
      aiHistory,
      criteria,
      clientBuild
    } = req.body || {};
    const sessionId = uuidv4();
    const now = new Date();
    const normalizedType = normalizeConversationType(conversationType);
    const openingQuestion = String(initialMessage || "").trim();

    if (openingQuestion.length > 2000) {
      return res.status(400).json({ success: false, message: "Tin nhắn ban đầu vượt quá 2000 ký tự" });
    }

    const userId = (req as any).user?.userId || (req as any).user?.id || req.body?.userId;

    // 1. Phân phối phiên chat (Queue / Round-robin / Least-busy routing) tới nhân viên đang online
    const isHumanSupport = normalizedType === "SALES_CONSULTATION" || normalizedType === "HUMAN_SUPPORT";
    const assignedStaff = isHumanSupport ? findNextAvailableStaff("SALES_STAFF") : null;
    const sessionStatus = assignedStaff ? "assigned" : "waiting";
    const staffName = assignedStaff ? assignedStaff.staffName : null;

    // 2. Chuyển toàn bộ tóm tắt ngữ cảnh (Context Summary) mà AI đã trao đổi trước đó sang cho nhân viên
    const messagesToCreate: any[] = [];

    // Nếu có lịch sử AI, tiêu chí criteria hoặc user đăng nhập có cấu hình PC/giỏ hàng
    if (aiHistory?.length || criteria || clientBuild || userId) {
      const userHardwareContext = await AiContextService.aggregateUserContext(
        userId ? Number(userId) : undefined,
        sessionId
      );

      const briefing = AiContextService.buildHandoffBriefing({
        userContext: userHardwareContext,
        aiHistory: Array.isArray(aiHistory) ? aiHistory : undefined,
        criteria,
        clientBuild,
        note: openingQuestion || undefined
      });

      // Tạo tin nhắn tóm tắt ngữ cảnh briefing hệ thống
      messagesToCreate.push({
        sender: "system",
        text: briefing.briefingText,
        build_data: JSON.stringify(briefing.metadata),
        created_at: now
      });
    }

    // Tin nhắn hệ thống thông báo trạng thái kết nối
    if (assignedStaff) {
      messagesToCreate.push({
        sender: "system",
        text: `Hệ thống đã tự động kết nối bạn với nhân viên tư vấn ${assignedStaff.staffName}. Nhân viên đang xem lại tóm tắt nhu cầu của bạn.`,
        created_at: new Date(now.getTime() + 10)
      });
    } else {
      messagesToCreate.push({
        sender: "system",
        text: "Yêu cầu tư vấn đã được gửi vào hàng đợi. Nhân viên bán hàng sẽ phản hồi sớm nhất.",
        created_at: new Date(now.getTime() + 10)
      });
    }

    if (openingQuestion) {
      messagesToCreate.push({
        sender: "customer",
        text: openingQuestion,
        created_at: new Date(now.getTime() + 20)
      });
    }

    const session = await prisma.chatSession.create({
      data: {
        session_id: sessionId,
        status: sessionStatus,
        customer_name: customerName || "Khach hang PC Mall",
        staff_name: staffName,
        linked_order_id: linkedOrderId ? Number(linkedOrderId) : null,
        created_at: now,
        updated_at: now,
        messages: {
          create: messagesToCreate
        }
      },
      include: { messages: { orderBy: { created_at: "asc" } } }
    });

    const sessionData = mapSession(session);

    // 🔔 Real-time: Nếu đã chỉ định nhân viên qua Round-robin, gửi trực tiếp tới socket của nhân viên đó
    if (assignedStaff?.socketId) {
      emitToStaff(assignedStaff.socketId, "staff:session_assigned", sessionData);
    }

    // 🔔 Real-time: Thông báo đến hàng đợi nhân viên bán hàng
    emitToStaffChatQueue("queue:new_session", sessionData);

    res.status(201).json({ success: true, data: sessionData });
  } catch (error) {
    console.error("Error creating chat session:", error);
    res.status(500).json({
      success: false,
      message: "Yeu cau tu van da duoc ghi nhan nhung he thong phan hoi cham. Vui long thu lai sau it phut.",
      detail: process.env.NODE_ENV === "production" ? undefined : error instanceof Error ? error.message : String(error)
    });
  }
};

export const getSession = async (req: Request, res: Response) => {
  try {
    const session = await prisma.chatSession.findUnique({
      where: { session_id: req.params.id },
      include: { messages: { orderBy: { created_at: "asc" } } }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    res.status(200).json({ success: true, data: mapSession(session) });
  } catch (error) {
    console.error("Error getting chat session:", error);
    res.status(500).json({ success: false, message: "Failed to get session" });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sender, text, buildData } = req.body || {};
    const trimmedText = String(text || "").trim();

    if (!trimmedText) {
      return res.status(400).json({ success: false, message: "Tin nhắn không được để trống" });
    }

    if (trimmedText.length > 2000) {
      return res.status(400).json({ success: false, message: "Tin nhắn vượt quá 2000 ký tự" });
    }

    const session = await prisma.chatSession.findUnique({
      where: { session_id: id }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    if (["closed", "resolved"].includes(session.status)) {
      return res.status(400).json({ success: false, message: "Phien tu van da ket thuc" });
    }

    const normalizedSender: ChatSender = sender === "staff" ? "staff" : sender === "system" ? "system" : "customer";
    const message = await prisma.chatMessage.create({
      data: {
        session_id: session.id,
        sender: normalizedSender,
        text: trimmedText,
        build_data: buildData ? JSON.stringify(buildData) : null,
        created_at: new Date()
      }
    });

    const nextStatus =
      normalizedSender === "staff"
        ? "active"
        : ["assigned", "waiting_customer", "active"].includes(session.status)
          ? "active"
          : session.status;

    await prisma.chatSession.update({
      where: { id: session.id },
      data: { status: nextStatus, updated_at: new Date() }
    });

    const messageData = mapMessage(message);

    // 🔔 Real-time: Đẩy tin nhắn mới ngay tức thì đến tất cả clients trong room này
    emitToChatRoom(id, "chat:new_message", messageData);
    // 🔔 Real-time: Cập nhật hàng đợi cho nhân viên (để cập nhật preview)
    emitToStaffChatQueue("queue:updated", { sessionId: id, status: nextStatus });

    res.status(201).json({ success: true, data: messageData });
  } catch (error) {
    console.error("Error sending chat message:", error);
    res.status(500).json({ success: false, message: "Failed to send message" });
  }
};

export const getQueue = async (_req: Request, res: Response) => {
  try {
    const sessions = await prisma.chatSession.findMany({
      where: { status: { notIn: ["closed", "resolved"] } },
      include: { messages: { orderBy: { created_at: "asc" } } },
      orderBy: [{ updated_at: "desc" }, { created_at: "asc" }]
    });

    res.status(200).json({ success: true, data: sessions.map(mapSession) });
  } catch (error) {
    console.error("Error getting chat queue:", error);
    res.status(500).json({ success: false, message: "Failed to get queue" });
  }
};

export const getQueueStats = async (_req: Request, res: Response) => {
  try {
    const all = await prisma.chatSession.findMany({
      where: { status: { notIn: ["closed", "resolved"] } }
    });
    const onlineStaff = getOnlineStaffList();

    res.status(200).json({
      success: true,
      data: {
        waiting: all.filter((session) => ["waiting", "waiting_staff", "open"].includes(session.status)).length,
        active: all.filter((session) => ["active", "assigned", "waiting_customer"].includes(session.status)).length,
        total: all.length,
        onlineStaffCount: onlineStaff.length,
        onlineStaff: onlineStaff.map((s) => ({
          staffId: s.staffId,
          staffName: s.staffName,
          activeSessionsCount: s.activeSessionsCount
        }))
      }
    });
  } catch (error) {
    console.error("Error getting chat queue stats:", error);
    res.status(500).json({ success: false, message: "Failed to get queue stats" });
  }
};

export const acceptSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { staffName } = req.body || {};

    const session = await prisma.chatSession.findUnique({
      where: { session_id: id }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    if (["waiting", "waiting_staff", "open"].includes(session.status)) {
      await prisma.chatSession.update({
        where: { id: session.id },
        data: {
          status: "active",
          staff_name: staffName || "Nhan vien ban hang",
          updated_at: new Date()
        }
      });

      await prisma.chatMessage.create({
        data: {
          session_id: session.id,
          sender: "system",
          text: `${staffName || "Nhan vien ban hang"} da tham gia phien tu van.`,
          created_at: new Date()
        }
      });
    }

    const refreshed = await prisma.chatSession.findUnique({
      where: { id: session.id },
      include: { messages: { orderBy: { created_at: "asc" } } }
    });

    const refreshedData = mapSession(refreshed);

    // 🔔 Real-time: Thông báo session được nhận cho cả khách và nhân viên
    emitToChatRoom(id, "chat:session_updated", refreshedData);
    emitToStaffChatQueue("queue:updated", { sessionId: id, status: "active" });

    res.status(200).json({ success: true, data: refreshedData });
  } catch (error) {
    console.error("Error accepting chat session:", error);
    res.status(500).json({ success: false, message: "Failed to accept session" });
  }
};

export const closeSession = async (req: Request, res: Response) => {
  try {
    const session = await prisma.chatSession.findUnique({
      where: { session_id: req.params.id }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    // Giảm số phiên đang xử lý của nhân viên trong routing registry
    if (session.staff_name) {
      releaseStaffSession(session.staff_name);
    }

    await prisma.chatSession.update({
      where: { id: session.id },
      data: {
        status: "closed",
        updated_at: new Date()
      }
    });

    await prisma.chatMessage.create({
      data: {
        session_id: session.id,
        sender: "system",
        text: "Phien tu van da ket thuc. Cam on ban da lien he PC Mall.",
        created_at: new Date()
      }
    });

    const refreshed = await prisma.chatSession.findUnique({
      where: { id: session.id },
      include: { messages: { orderBy: { created_at: "asc" } } }
    });

    const refreshedData = mapSession(refreshed);

    // 🔔 Real-time: Thông báo đóng session cho tất cả clients trong room
    emitToChatRoom(req.params.id, "chat:session_closed", refreshedData);
    emitToStaffChatQueue("queue:updated", { sessionId: req.params.id, status: "closed" });

    res.status(200).json({ success: true, data: refreshedData });
  } catch (error) {
    console.error("Error closing chat session:", error);
    res.status(500).json({ success: false, message: "Failed to close session" });
  }
};

/**
 * POST /api/chat/session/:id/handoff
 * Chuyển giao hỗ trợ từ AI sang Nhân viên bán hàng:
 * 1. Phân phối phiên chat (Round-robin / Least-busy routing) tới nhân viên đang online.
 * 2. Tổng hợp Context Summary (Nhu cầu, PC Builder, Giỏ hàng, Q&A AI) đưa vào luồng chat
 *    để nhân viên nắm bắt toàn bộ ngữ cảnh, không bắt khách phải giải thích lại từ đầu.
 */
export const handoffToHuman = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { aiHistory, criteria, clientBuild, note } = req.body || {};
    const userId = (req as any).user?.userId || (req as any).user?.id || req.body?.userId;

    const session = await prisma.chatSession.findUnique({
      where: { session_id: id },
      include: { messages: { orderBy: { created_at: "asc" } } }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    if (["closed", "resolved"].includes(session.status)) {
      return res.status(400).json({ success: false, message: "Phiên tư vấn đã kết thúc, không thể chuyển giao" });
    }

    // 1. Phân phối round-robin / least-busy tới nhân viên đang online (nếu chưa có nhân viên nhận)
    let assignedStaff = null;
    let staffName = session.staff_name;
    let nextStatus = session.status;

    if (!staffName || ["waiting", "waiting_staff", "open"].includes(session.status)) {
      assignedStaff = findNextAvailableStaff("SALES_STAFF");
      if (assignedStaff) {
        staffName = assignedStaff.staffName;
        nextStatus = "active";
      } else {
        nextStatus = "waiting_staff";
      }
    }

    // 2. Thu thập Context Summary (Cấu hình PC, Giỏ hàng, Lịch sử hỏi đáp AI)
    const userHardwareContext = await AiContextService.aggregateUserContext(
      userId ? Number(userId) : undefined,
      session.session_id
    );

    const briefing = AiContextService.buildHandoffBriefing({
      userContext: userHardwareContext,
      aiHistory: Array.isArray(aiHistory) ? aiHistory : undefined,
      criteria,
      clientBuild,
      note: note ? String(note).trim() : undefined
    });

    const now = new Date();

    // 3. Lưu tin nhắn Briefing tóm tắt ngữ cảnh vào ChatMessage
    await prisma.chatMessage.create({
      data: {
        session_id: session.id,
        sender: "system",
        text: briefing.briefingText,
        build_data: JSON.stringify(briefing.metadata),
        created_at: now
      }
    });

    // Thông báo điều phối nhân viên
    if (assignedStaff) {
      await prisma.chatMessage.create({
        data: {
          session_id: session.id,
          sender: "system",
          text: `Hệ thống đã tự động kết nối bạn với nhân viên tư vấn ${assignedStaff.staffName}.`,
          created_at: new Date(now.getTime() + 10)
        }
      });
    }

    // Nếu khách có lời nhắn mở đầu khi bấm gặp nhân viên
    if (note && String(note).trim()) {
      await prisma.chatMessage.create({
        data: {
          session_id: session.id,
          sender: "customer",
          text: String(note).trim(),
          created_at: new Date(now.getTime() + 20)
        }
      });
    }

    // Cập nhật trạng thái session
    await prisma.chatSession.update({
      where: { id: session.id },
      data: {
        status: nextStatus,
        staff_name: staffName,
        updated_at: new Date()
      }
    });

    const refreshed = await prisma.chatSession.findUnique({
      where: { id: session.id },
      include: { messages: { orderBy: { created_at: "asc" } } }
    });

    const refreshedData = mapSession(refreshed);

    // 🔔 Real-time notifications
    emitToChatRoom(id, "chat:session_updated", refreshedData);
    if (assignedStaff?.socketId) {
      emitToStaff(assignedStaff.socketId, "staff:session_assigned", refreshedData);
    }
    emitToStaffChatQueue("queue:updated", {
      sessionId: id,
      status: nextStatus,
      staffName
    });

    return res.status(200).json({ success: true, data: refreshedData });
  } catch (error) {
    console.error("Error handing off chat session:", error);
    res.status(500).json({ success: false, message: "Failed to handoff session" });
  }
};

/**
 * POST /api/chat/ai-consultation
 * Controller tiếp nhận tư vấn AI, tiêu chí chọn, linh kiện có sẵn và thắc mắc lý thuyết phần cứng qua RAG Engine.
 */
export const handleAiConsultation = async (req: Request, res: Response) => {
  try {
    const { message, criteria, sessionId } = req.body || {};
    const text = String(message || "").trim();

    if (text.length > 2000) {
      return res.status(400).json({ success: false, message: "Câu hỏi vượt quá 2000 ký tự" });
    }

    const userId = (req as any).user?.userId || (req as any).user?.id || req.body?.userId;

    const { aiAssistantService } = await import("./ai-assistant.service");

    // 🚀 Sử dụng RAG Engine toàn diện + Unified Shared Hardware Context (Active PC Build, Cart, Orders)
    const ragResult = await aiAssistantService.consultWithRag(text, criteria, {
      userId: userId ? Number(userId) : undefined,
      sessionId: sessionId ? String(sessionId) : undefined
    });

    return res.status(200).json({
      success: true,
      data: {
        text: ragResult.text,
        products: ragResult.products || [],
        buildPayload: ragResult.buildPayload || null,
        type: ragResult.type,
        userContextSummary: (ragResult as any).userContextSummary || null
      }
    });
  } catch (error) {
    console.error("Error in AI Consultation controller:", error);
    res.status(500).json({ success: false, message: "AI Consultation failed" });
  }
};


