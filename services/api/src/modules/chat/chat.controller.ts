import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

import { PrismaClient } from "@prisma/client";
import {
  emitToChatRoom,
  emitToStaffChatQueue
} from "../../socket/socket.service";

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
    const { customerName, linkedOrderId, initialMessage, conversationType } = req.body || {};
    const sessionId = uuidv4();
    const now = new Date();
    const normalizedType = normalizeConversationType(conversationType);
    const openingQuestion = String(initialMessage || "").trim();

    if (openingQuestion.length > 2000) {
      return res.status(400).json({ success: false, message: "Tin nhắn ban đầu vượt quá 2000 ký tự" });
    }

    const session = await prisma.chatSession.create({
      data: {
        session_id: sessionId,
        status: "waiting",
        customer_name: customerName || "Khach hang PC Mall",
        linked_order_id: linkedOrderId ? Number(linkedOrderId) : null,
        created_at: now,
        updated_at: now,
        messages: {
          create: [
            {
              sender: "system",
              text: "Yeu cau tu van da duoc gui. Nhan vien ban hang se phan hoi som nhat.",
              created_at: now
            },
            ...(openingQuestion
              ? [
                  {
                    sender: "customer",
                    text: openingQuestion,
                    created_at: now
                  }
                ]
              : [])
          ]
        }
      },
      include: { messages: { orderBy: { created_at: "asc" } } }
    });

    const sessionData = mapSession(session);

    // 🔔 Real-time: Thông báo đến tất cả nhân viên đang online có yêu cầu chat mới
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

    res.status(200).json({
      success: true,
      data: {
        waiting: all.filter((session) => ["waiting", "waiting_staff", "open"].includes(session.status)).length,
        active: all.filter((session) => ["active", "assigned", "waiting_customer"].includes(session.status)).length,
        total: all.length
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
 * POST /api/chat/ai-consultation
 * Controller tiếp nhận tư vấn AI, tiêu chí chọn, linh kiện có sẵn và thắc mắc lý thuyết phần cứng.
 */
export const handleAiConsultation = async (req: Request, res: Response) => {
  try {
    const { message, criteria } = req.body;
    const text = String(message || "").trim();

    if (text.length > 2000) {
      return res.status(400).json({ success: false, message: "Câu hỏi vượt quá 2000 ký tự" });
    }

    const { aiAssistantService } = await import("./ai-assistant.service");

    // 1. Check hardware theory questions (downclocking, PSU watt, bottleneck...)
    if (text) {
      const theoryExplanation = aiAssistantService.explainHardwareTheory(text);
      if (theoryExplanation) {
        return res.status(200).json({
          success: true,
          data: {
            text: theoryExplanation,
            type: "theory_explanation"
          }
        });
      }

      // 2. Database grounded query (e.g. "cpu đi", "RAM dưới 3tr", "gợi ý vga")
      try {
        // @ts-ignore
        const { askTechnicalAdvisor } = await import("../ai/ai.service");
        const advisorResult = await askTechnicalAdvisor({ message: text });
        if (advisorResult && (advisorResult.reply || advisorResult.products?.length)) {
          return res.status(200).json({
            success: true,
            data: {
              text: advisorResult.reply,
              products: advisorResult.products || [],
              buildPayload: advisorResult.build ? {
                label: "Cấu hình đề xuất từ DB",
                totalPrice: advisorResult.build.totalPrice,
                components: advisorResult.build.components
              } : null,
              type: advisorResult.products?.length ? "product_recommendation" : "advisor_reply"
            }
          });
        }
      } catch (dbAiErr) {
        console.warn("[ChatController] askTechnicalAdvisor failed, falling back:", dbAiErr);
      }
    }

    // 3. Fallback to Form criteria build generation
    const buildResult = await aiAssistantService.generateConsultationBuild(criteria || { budget: 25000000 });

    res.status(200).json({
      success: true,
      data: {
        text: buildResult.summaryText,
        buildPayload: {
          label: buildResult.label,
          totalPrice: buildResult.totalPrice,
          budgetUtilization: buildResult.budgetUtilization,
          components: buildResult.components,
          compatibilityScore: buildResult.compatibilityScore
        },
        type: "build_recommendation"
      }
    });
  } catch (error) {
    console.error("Error in AI Consultation controller:", error);
    res.status(500).json({ success: false, message: "AI Consultation failed" });
  }
};

