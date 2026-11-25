import { prisma } from "../../config/prisma";

function normalizeUser(user: any) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.Role?.name
  };
}

function normalizeTicket(ticket: any) {
  if (!ticket) return null;

  return {
    id: ticket.id,
    reporterId: ticket.user_id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    assignedToId: ticket.assigned_to_id,
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at,
    reporter: normalizeUser(ticket.users_tickets_user_idTousers),
    assignee: normalizeUser(ticket.users_tickets_assigned_to_idTousers),
    messages: (ticket.TicketMessage || []).map((message: any) => ({
      id: message.id,
      message: message.message,
      visibility: message.visibility,
      createdAt: message.created_at,
      updatedAt: message.updated_at,
      sender: normalizeUser(message.User)
    })),
    user_id: ticket.user_id,
    assigned_to_id: ticket.assigned_to_id
  };
}

export function createTicket(data: {
  userId: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}) {
  const numericUserId = parseInt(data.userId, 10);
  return prisma.ticket.create({
    data: {
      user_id: numericUserId,
      title: data.title,
      description: data.description,
      priority: data.priority
    }
  }).then((ticket: any) => getTicketById(ticket.id));
}

export function getTicketById(id: string | number) {
  return prisma.ticket.findUnique({
    where: { id: typeof id === "string" ? parseInt(id, 10) : id },
    include: {
      users_tickets_user_idTousers: { select: { id: true, email: true, full_name: true, Role: { select: { name: true } } } },
      users_tickets_assigned_to_idTousers: { select: { id: true, email: true, full_name: true, Role: { select: { name: true } } } },
      TicketMessage: {
        include: {
          User: { select: { id: true, email: true, full_name: true, Role: { select: { name: true } } } }
        },
        orderBy: { created_at: "asc" }
      }
    }
  }).then(normalizeTicket);
}

export function getTicketsByReporter(userId: string) {
  const numericUserId = parseInt(userId, 10);
  return prisma.ticket.findMany({
    where: { user_id: numericUserId },
    include: {
      users_tickets_user_idTousers: { select: { id: true, email: true, full_name: true, Role: { select: { name: true } } } },
      users_tickets_assigned_to_idTousers: { select: { id: true, email: true, full_name: true, Role: { select: { name: true } } } },
      TicketMessage: {
        where: { visibility: "PUBLIC" },
        include: {
          User: { select: { id: true, email: true, full_name: true, Role: { select: { name: true } } } }
        },
        orderBy: { created_at: "asc" }
      }
    },
    orderBy: { created_at: "desc" }
  }).then((tickets: any[]) => tickets.map(normalizeTicket));
}

export type TicketListFilters = {
  scope?: string;
  status?: string;
  priority?: string;
  keyword?: string;
  assignedToId?: number;
};

function buildTicketWhere(filters: TicketListFilters = {}) {
  const where: Record<string, unknown> = {};
  const scope = String(filters.scope || "ALL").trim().toUpperCase();
  const status = String(filters.status || "").trim().toUpperCase();
  const priority = String(filters.priority || "").trim().toUpperCase();
  const keyword = String(filters.keyword || "").trim();

  if (status) {
    where.status = status;
  }

  if (priority) {
    where.priority = priority;
  }

  if (keyword) {
    const ticketIdKeyword = keyword.match(/^(?:#|ticket\s*)?(\d+)$/i)?.[1];

    if (ticketIdKeyword) {
      where.id = Number(ticketIdKeyword);
    } else {
      where.OR = [
        { title: { contains: keyword } },
        { description: { contains: keyword } },
        {
          users_tickets_user_idTousers: {
            is: {
              OR: [
                { full_name: { contains: keyword } },
                { email: { contains: keyword } }
              ]
            }
          }
        },
        {
          users_tickets_assigned_to_idTousers: {
            is: {
              OR: [
                { full_name: { contains: keyword } },
                { email: { contains: keyword } }
              ]
            }
          }
        }
      ];
    }
  }

  if (scope === "ASSIGNED" && filters.assignedToId) {
    where.assigned_to_id = filters.assignedToId;
  } else if (scope === "UNASSIGNED") {
    where.assigned_to_id = null;
  }

  return where;
}

export function listTickets(filters: TicketListFilters = {}) {
  const where = buildTicketWhere(filters);

  return prisma.ticket
    .findMany({
      where,
      include: {
        users_tickets_user_idTousers: {
          select: { id: true, email: true, full_name: true, Role: { select: { name: true } } }
        },
        users_tickets_assigned_to_idTousers: {
          select: { id: true, email: true, full_name: true, Role: { select: { name: true } } }
        },
        TicketMessage: {
          include: {
            User: { select: { id: true, email: true, full_name: true, Role: { select: { name: true } } } }
          },
          orderBy: { created_at: "asc" }
        }
      },
      orderBy: { created_at: "desc" }
    })
    .then((tickets: any[]) => tickets.map(normalizeTicket));
}

export async function getTicketQueueStats(assignedToId?: number) {
  const [open, inProgress, unassigned, myActive] = await Promise.all([
    prisma.ticket.count({ where: { status: "OPEN" } }),
    prisma.ticket.count({ where: { status: "IN_PROGRESS" } }),
    prisma.ticket.count({ where: { status: "OPEN", assigned_to_id: null } }),
    assignedToId
      ? prisma.ticket.count({
          where: {
            assigned_to_id: assignedToId,
            status: { in: ["OPEN", "IN_PROGRESS"] }
          }
        })
      : Promise.resolve(0)
  ]);

  return { open, inProgress, unassigned, myActive, waiting: unassigned };
}

export function updateTicket(
  id: string | number,
  data: Partial<{
    status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    assigned_to_id: number | null;
  }>
) {
  return prisma.ticket.update({
    where: { id: typeof id === "string" ? parseInt(id, 10) : id },
    data
  }).then((ticket: any) => getTicketById(ticket.id));
}

export async function createTicketMessage(data: {
  ticketId: string | number;
  userId: string;
  message: string;
  visibility?: "PUBLIC" | "INTERNAL";
}) {
  const ticketId = typeof data.ticketId === "string" ? parseInt(data.ticketId, 10) : data.ticketId;
  await prisma.ticketMessage.create({
    data: {
      ticket_id: ticketId,
      user_id: parseInt(data.userId, 10),
      message: data.message,
      visibility: data.visibility || "PUBLIC"
    }
  });

  return getTicketById(ticketId);
}
