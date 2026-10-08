const { query } = require("../../config/database");
const { env } = require("../../config/env");
const { createError, toPositiveInteger } = require("../../utils/service-helpers");
const { getTableColumns, pickColumn } = require("../../utils/schema-helpers");
const { ROLES, hasAnyRole, normalizeRole } = require("../../utils/role-helpers");

const ROLE_IDENTIFIER_COLUMNS = ["name", "code", "slug"];
const TICKET_TABLE_CANDIDATES = ["tickets", "support_tickets"];
const TICKET_MESSAGE_TABLE_CANDIDATES = ["ticket_messages", "ticket_replies"];
const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

let ticketSchemaCache = null;
let roleIdentifierColumnCache = null;
let tableNameCache = null;

function normalizeListParams(params = {}, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(Number(params.page) || 1, 1);
  const limit = Math.min(Math.max(Number(params.limit) || defaultLimit, 1), maxLimit);

  return {
    keyword: String(params.keyword || "").trim() || null,
    status: String(params.status || "").trim().toUpperCase() || null,
    priority: String(params.priority || "").trim().toUpperCase() || null,
    scope: String(params.scope || "ALL").trim().toUpperCase() || "ALL",
    assignedToId: params.assignedToId ? toPositiveInteger(params.assignedToId, "assignedToId") : null,
    page,
    limit,
    offset: (page - 1) * limit
  };
}

function normalizeActor(userOrUserId) {
  if (typeof userOrUserId === "object" && userOrUserId !== null) {
    return {
      id: userOrUserId.id,
      role: normalizeRole(userOrUserId.role)
    };
  }

  return {
    id: userOrUserId,
    role: ROLES.CUSTOMER
  };
}

function canManageTickets(role) {
  return hasAnyRole(role, [ROLES.ADMIN, ROLES.SALES_STAFF, ROLES.TECH_STAFF]);
}

async function resolveTableNames() {
  if (tableNameCache) {
    return tableNameCache;
  }

  const rows = await query(
    `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = COALESCE(DATABASE(), ?)
        AND TABLE_NAME IN (?, ?, ?, ?)
    `,
    [
      env.dbName,
      ...TICKET_TABLE_CANDIDATES,
      ...TICKET_MESSAGE_TABLE_CANDIDATES
    ]
  );

  const available = rows.map((row) => row.TABLE_NAME);
  const ticketTable = TICKET_TABLE_CANDIDATES.find((name) => available.includes(name)) || null;
  const messageTable = TICKET_MESSAGE_TABLE_CANDIDATES.find((name) => available.includes(name)) || null;

  tableNameCache = {
    ticketTable,
    messageTable
  };

  return tableNameCache;
}

async function getRoleIdentifierColumn() {
  if (roleIdentifierColumnCache) {
    return roleIdentifierColumnCache;
  }

  const rows = await query(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = COALESCE(DATABASE(), ?)
        AND TABLE_NAME = 'roles'
        AND COLUMN_NAME IN ('name', 'code', 'slug')
    `,
    [env.dbName]
  );

  const availableColumns = rows.map((row) => row.COLUMN_NAME);
  const matchedColumn = ROLE_IDENTIFIER_COLUMNS.find((column) => availableColumns.includes(column));

  if (!matchedColumn) {
    throw createError("Roles table must have one of these columns: name, code, slug", 500);
  }

  roleIdentifierColumnCache = matchedColumn;
  return matchedColumn;
}

async function getTicketSchema() {
  if (ticketSchemaCache) {
    return ticketSchemaCache;
  }

  const { ticketTable, messageTable } = await resolveTableNames();

  if (!ticketTable) {
    throw createError(
      "Ticket table is not configured. Please add tickets/support_tickets and ticket_messages tables before using the ticket workflow.",
      500
    );
  }

  const [ticketColumns, messageColumns, userColumns] = await Promise.all([
    getTableColumns(ticketTable),
    messageTable ? getTableColumns(messageTable) : Promise.resolve([]),
    getTableColumns("users")
  ]);

  const schema = {
    tickets: {
      table: ticketTable,
      id: pickColumn(ticketColumns, ["id"]),
      reporterId: pickColumn(ticketColumns, ["user_id", "reporter_id"]),
      title: pickColumn(ticketColumns, ["title", "subject"]),
      description: pickColumn(ticketColumns, ["description", "content"]),
      status: pickColumn(ticketColumns, ["status"], null),
      priority: pickColumn(ticketColumns, ["priority"], null),
      assignedToId: pickColumn(ticketColumns, ["assigned_to_id", "assignee_id"], null),
      createdAt: pickColumn(ticketColumns, ["created_at"], null),
      updatedAt: pickColumn(ticketColumns, ["updated_at"], null)
    },
    messages: {
      table: messageTable,
      id: pickColumn(messageColumns, ["id"], null),
      ticketId: pickColumn(messageColumns, ["ticket_id", "support_ticket_id"], null),
      userId: pickColumn(messageColumns, ["user_id", "sender_id", "author_id"], null),
      message: pickColumn(messageColumns, ["message", "content", "body"], null),
      createdAt: pickColumn(messageColumns, ["created_at"], null),
      updatedAt: pickColumn(messageColumns, ["updated_at"], null)
    },
    users: {
      fullName: pickColumn(userColumns, ["full_name", "name"]),
      email: pickColumn(userColumns, ["email"]),
      roleId: pickColumn(userColumns, ["role_id"], null)
    }
  };

  if (!schema.tickets.id || !schema.tickets.reporterId || !schema.tickets.title || !schema.tickets.description) {
    throw createError("Tickets table does not have the required columns", 500);
  }

  ticketSchemaCache = schema;
  return schema;
}

async function findUserById(userId) {
  const roleIdentifierColumn = await getRoleIdentifierColumn();
  const schema = await getTicketSchema();
  const rows = await query(
    `
      SELECT
        u.id,
        ${schema.users.fullName ? `u.${schema.users.fullName}` : "NULL"} AS fullName,
        ${schema.users.email ? `u.${schema.users.email}` : "NULL"} AS email,
        ${schema.users.roleId ? `u.${schema.users.roleId}` : "NULL"} AS roleId,
        r.${roleIdentifierColumn} AS role
      FROM users u
      LEFT JOIN roles r ON r.id = u.${schema.users.roleId}
      WHERE u.id = ?
      LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

function buildTicketSelect(schema, roleIdentifierColumn) {
  return `
    SELECT
      t.${schema.tickets.id} AS id,
      t.${schema.tickets.reporterId} AS reporterId,
      t.${schema.tickets.title} AS title,
      t.${schema.tickets.description} AS description,
      ${schema.tickets.status ? `t.${schema.tickets.status}` : "'OPEN'"} AS status,
      ${schema.tickets.priority ? `t.${schema.tickets.priority}` : "'MEDIUM'"} AS priority,
      ${schema.tickets.assignedToId ? `t.${schema.tickets.assignedToId}` : "NULL"} AS assignedToId,
      ${schema.tickets.createdAt ? `t.${schema.tickets.createdAt}` : "NULL"} AS createdAt,
      ${schema.tickets.updatedAt ? `t.${schema.tickets.updatedAt}` : "NULL"} AS updatedAt,
      reporter.id AS reporterUserId,
      ${schema.users.fullName ? `reporter.${schema.users.fullName}` : "NULL"} AS reporterFullName,
      ${schema.users.email ? `reporter.${schema.users.email}` : "NULL"} AS reporterEmail,
      reporter_role.${roleIdentifierColumn} AS reporterRole,
      assignee.id AS assigneeUserId,
      ${schema.users.fullName ? `assignee.${schema.users.fullName}` : "NULL"} AS assigneeFullName,
      ${schema.users.email ? `assignee.${schema.users.email}` : "NULL"} AS assigneeEmail,
      assignee_role.${roleIdentifierColumn} AS assigneeRole
    FROM ${schema.tickets.table} t
    LEFT JOIN users reporter ON reporter.id = t.${schema.tickets.reporterId}
    LEFT JOIN roles reporter_role ON reporter_role.id = reporter.${schema.users.roleId}
    ${schema.tickets.assignedToId ? `LEFT JOIN users assignee ON assignee.id = t.${schema.tickets.assignedToId}` : `LEFT JOIN users assignee ON 1 = 0`}
    ${schema.tickets.assignedToId ? `LEFT JOIN roles assignee_role ON assignee_role.id = assignee.${schema.users.roleId}` : `LEFT JOIN roles assignee_role ON 1 = 0`}
  `;
}

function formatTicket(row) {
  return {
    id: row.id,
    reporterId: row.reporterId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignedToId: row.assignedToId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reporter: row.reporterUserId
      ? {
          id: row.reporterUserId,
          fullName: row.reporterFullName,
          email: row.reporterEmail,
          role: row.reporterRole
        }
      : null,
    assignee: row.assigneeUserId
      ? {
          id: row.assigneeUserId,
          fullName: row.assigneeFullName,
          email: row.assigneeEmail,
          role: row.assigneeRole
        }
      : null
  };
}

async function getTicketMessages(ticket, schema, roleIdentifierColumn) {
  if (!schema.messages.table || !schema.messages.id || !schema.messages.ticketId || !schema.messages.userId || !schema.messages.message) {
    return [
      {
        id: `ticket-${ticket.id}-initial`,
        message: ticket.description,
        createdAt: ticket.createdAt,
        sender: ticket.reporter
      }
    ];
  }

  const rows = await query(
    `
      SELECT
        m.${schema.messages.id} AS id,
        m.${schema.messages.message} AS message,
        ${schema.messages.createdAt ? `m.${schema.messages.createdAt}` : "NULL"} AS createdAt,
        ${schema.messages.updatedAt ? `m.${schema.messages.updatedAt}` : "NULL"} AS updatedAt,
        sender.id AS senderId,
        ${schema.users.fullName ? `sender.${schema.users.fullName}` : "NULL"} AS senderFullName,
        ${schema.users.email ? `sender.${schema.users.email}` : "NULL"} AS senderEmail,
        sender_role.${roleIdentifierColumn} AS senderRole
      FROM ${schema.messages.table} m
      LEFT JOIN users sender ON sender.id = m.${schema.messages.userId}
      LEFT JOIN roles sender_role ON sender_role.id = sender.${schema.users.roleId}
      WHERE m.${schema.messages.ticketId} = ?
      ORDER BY ${schema.messages.createdAt ? `m.${schema.messages.createdAt}` : `m.${schema.messages.id}`} ASC
    `,
    [ticket.id]
  );

  if (rows.length === 0) {
    return [
      {
        id: `ticket-${ticket.id}-initial`,
        message: ticket.description,
        createdAt: ticket.createdAt,
        sender: ticket.reporter
      }
    ];
  }

  return rows.map((row) => ({
    id: row.id,
    message: row.message,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    sender: row.senderId
      ? {
          id: row.senderId,
          fullName: row.senderFullName,
          email: row.senderEmail,
          role: row.senderRole
        }
      : null
  }));
}

async function createTicket(userId, payload) {
  const schema = await getTicketSchema();
  const fields = [schema.tickets.reporterId, schema.tickets.title, schema.tickets.description];
  const values = ["?", "?", "?"];
  const params = [userId, payload.title, payload.description];

  if (schema.tickets.priority) {
    fields.push(schema.tickets.priority);
    values.push("?");
    params.push(payload.priority || "MEDIUM");
  }

  if (schema.tickets.status) {
    fields.push(schema.tickets.status);
    values.push("?");
    params.push("OPEN");
  }

  if (schema.tickets.createdAt) {
    fields.push(schema.tickets.createdAt);
    values.push("NOW()");
  }

  if (schema.tickets.updatedAt) {
    fields.push(schema.tickets.updatedAt);
    values.push("NOW()");
  }

  const result = await query(
    `INSERT INTO ${schema.tickets.table} (${fields.join(", ")}) VALUES (${values.join(", ")})`,
    params
  );

  if (schema.messages.table && schema.messages.ticketId && schema.messages.userId && schema.messages.message) {
    const messageFields = [schema.messages.ticketId, schema.messages.userId, schema.messages.message];
    const messageValues = ["?", "?", "?"];
    const messageParams = [result.insertId, userId, payload.description];

    if (schema.messages.createdAt) {
      messageFields.push(schema.messages.createdAt);
      messageValues.push("NOW()");
    }

    if (schema.messages.updatedAt) {
      messageFields.push(schema.messages.updatedAt);
      messageValues.push("NOW()");
    }

    await query(
      `INSERT INTO ${schema.messages.table} (${messageFields.join(", ")}) VALUES (${messageValues.join(", ")})`,
      messageParams
    );
  }

  return getTicketDetail({ id: userId, role: ROLES.CUSTOMER }, result.insertId);
}

async function listTickets(actor, params = {}) {
  const schema = await getTicketSchema();
  const roleIdentifierColumn = await getRoleIdentifierColumn();
  const filters = normalizeListParams(params);
  const whereClauses = [];
  const queryParams = [];

  if (!canManageTickets(actor.role)) {
    throw createError("Forbidden: you do not have permission to manage tickets", 403);
  }

  if (filters.keyword) {
    whereClauses.push(`(
      t.${schema.tickets.title} LIKE CONCAT('%', ?, '%')
      OR t.${schema.tickets.description} LIKE CONCAT('%', ?, '%')
    )`);
    queryParams.push(filters.keyword, filters.keyword);
  }

  if (filters.status && schema.tickets.status) {
    whereClauses.push(`t.${schema.tickets.status} = ?`);
    queryParams.push(filters.status);
  }

  if (filters.priority && schema.tickets.priority) {
    whereClauses.push(`t.${schema.tickets.priority} = ?`);
    queryParams.push(filters.priority);
  }

  if (filters.scope === "ASSIGNED" && schema.tickets.assignedToId) {
    whereClauses.push(`t.${schema.tickets.assignedToId} = ?`);
    queryParams.push(actor.id);
  } else if (filters.scope === "UNASSIGNED" && schema.tickets.assignedToId) {
    whereClauses.push(`t.${schema.tickets.assignedToId} IS NULL`);
  } else if (filters.assignedToId && schema.tickets.assignedToId) {
    whereClauses.push(`t.${schema.tickets.assignedToId} = ?`);
    queryParams.push(filters.assignedToId);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const rows = await query(
    `${buildTicketSelect(schema, roleIdentifierColumn)}
      ${whereSql}
      ORDER BY ${schema.tickets.createdAt ? `t.${schema.tickets.createdAt}` : `t.${schema.tickets.id}`} DESC
      LIMIT ? OFFSET ?`,
    [...queryParams, filters.limit, filters.offset]
  );

  return rows.map(formatTicket);
}

async function getTicketStats(actor) {
  const schema = await getTicketSchema();

  if (!canManageTickets(actor.role)) {
    throw createError("Forbidden: you do not have permission to manage tickets", 403);
  }

  const selectParts = [
    `COUNT(*) AS total`,
    schema.tickets.status ? `SUM(CASE WHEN ${schema.tickets.status} = 'OPEN' THEN 1 ELSE 0 END) AS open` : `COUNT(*) AS open`,
    schema.tickets.status ? `SUM(CASE WHEN ${schema.tickets.status} = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS inProgress` : `0 AS inProgress`,
    schema.tickets.status ? `SUM(CASE WHEN ${schema.tickets.status} = 'RESOLVED' THEN 1 ELSE 0 END) AS resolved` : `0 AS resolved`,
    schema.tickets.status ? `SUM(CASE WHEN ${schema.tickets.status} = 'CLOSED' THEN 1 ELSE 0 END) AS closed` : `0 AS closed`,
    schema.tickets.assignedToId ? `SUM(CASE WHEN ${schema.tickets.assignedToId} IS NULL THEN 1 ELSE 0 END) AS unassigned` : `COUNT(*) AS unassigned`,
    schema.tickets.assignedToId ? `SUM(CASE WHEN ${schema.tickets.assignedToId} = ? THEN 1 ELSE 0 END) AS assignedToMe` : `0 AS assignedToMe`
  ];

  const params = schema.tickets.assignedToId ? [actor.id] : [];
  const rows = await query(`SELECT ${selectParts.join(", ")} FROM ${schema.tickets.table}`, params);
  const stats = rows[0] || {};

  return {
    total: Number(stats.total || 0),
    open: Number(stats.open || 0),
    inProgress: Number(stats.inProgress || 0),
    resolved: Number(stats.resolved || 0),
    closed: Number(stats.closed || 0),
    unassigned: Number(stats.unassigned || 0),
    assignedToMe: Number(stats.assignedToMe || 0)
  };
}

async function getMyTickets(userId) {
  const schema = await getTicketSchema();
  const roleIdentifierColumn = await getRoleIdentifierColumn();
  const rows = await query(
    `${buildTicketSelect(schema, roleIdentifierColumn)}
      WHERE t.${schema.tickets.reporterId} = ?
      ORDER BY ${schema.tickets.createdAt ? `t.${schema.tickets.createdAt}` : `t.${schema.tickets.id}`} DESC`,
    [userId]
  );

  return rows.map(formatTicket);
}

async function getTicketDetail(actor, ticketId) {
  const schema = await getTicketSchema();
  const roleIdentifierColumn = await getRoleIdentifierColumn();
  const parsedTicketId = toPositiveInteger(ticketId, "ticketId");
  const rows = await query(
    `${buildTicketSelect(schema, roleIdentifierColumn)}
      WHERE t.${schema.tickets.id} = ?
      LIMIT 1`,
    [parsedTicketId]
  );

  const row = rows[0] || null;

  if (!row) {
    throw createError("Ticket not found", 404);
  }

  const ticket = formatTicket(row);
  const canAccess = Number(ticket.reporterId) === Number(actor.id) || canManageTickets(actor.role);

  if (!canAccess) {
    throw createError("Forbidden: you do not have permission to access this ticket", 403);
  }

  const messages = await getTicketMessages(ticket, schema, roleIdentifierColumn);

  return {
    ...ticket,
    messages
  };
}

async function updateTicket(actor, ticketId, payload) {
  const schema = await getTicketSchema();
  const parsedTicketId = toPositiveInteger(ticketId, "ticketId");

  if (!canManageTickets(actor.role)) {
    throw createError("Forbidden: you do not have permission to manage tickets", 403);
  }

  await getTicketDetail(actor, parsedTicketId);

  if (payload.assignedToId !== undefined) {
    if (!schema.tickets.assignedToId) {
      throw createError("Tickets table does not support assignee updates", 500);
    }

    if (payload.assignedToId !== null) {
      const assignee = await findUserById(payload.assignedToId);

      if (!assignee) {
        throw createError("Assignee not found", 404);
      }

      const isAllowedAssignee = hasAnyRole(assignee.role, [ROLES.ADMIN, ROLES.TECH_STAFF]);

      if (!isAllowedAssignee) {
        throw createError("Assignee must be admin or technical staff", 400);
      }
    }
  }

  const updates = [];
  const params = [];

  if (payload.status !== undefined && schema.tickets.status) {
    updates.push(`${schema.tickets.status} = ?`);
    params.push(payload.status);
  }

  if (payload.priority !== undefined && schema.tickets.priority) {
    updates.push(`${schema.tickets.priority} = ?`);
    params.push(payload.priority);
  }

  if (payload.assignedToId !== undefined && schema.tickets.assignedToId) {
    updates.push(`${schema.tickets.assignedToId} = ?`);
    params.push(payload.assignedToId);
  }

  if (updates.length === 0) {
    throw createError("No valid ticket fields provided for update", 400);
  }

  if (schema.tickets.updatedAt) {
    updates.push(`${schema.tickets.updatedAt} = NOW()`);
  }

  await query(
    `UPDATE ${schema.tickets.table} SET ${updates.join(", ")} WHERE ${schema.tickets.id} = ?`,
    [...params, parsedTicketId]
  );

  return getTicketDetail(actor, parsedTicketId);
}

async function addTicketMessage(actor, ticketId, payload) {
  const schema = await getTicketSchema();
  const parsedTicketId = toPositiveInteger(ticketId, "ticketId");
  const ticket = await getTicketDetail(actor, parsedTicketId);

  if (!schema.messages.table || !schema.messages.ticketId || !schema.messages.userId || !schema.messages.message) {
    throw createError(
      "Ticket messages table is not configured. Please add ticket_messages/ticket_replies before using ticket conversations.",
      500
    );
  }

  const fields = [schema.messages.ticketId, schema.messages.userId, schema.messages.message];
  const values = ["?", "?", "?"];
  const params = [parsedTicketId, actor.id, payload.message];

  if (schema.messages.createdAt) {
    fields.push(schema.messages.createdAt);
    values.push("NOW()");
  }

  if (schema.messages.updatedAt) {
    fields.push(schema.messages.updatedAt);
    values.push("NOW()");
  }

  await query(
    `INSERT INTO ${schema.messages.table} (${fields.join(", ")}) VALUES (${values.join(", ")})`,
    params
  );

  if (schema.tickets.updatedAt) {
    await query(
      `UPDATE ${schema.tickets.table} SET ${schema.tickets.updatedAt} = NOW() WHERE ${schema.tickets.id} = ?`,
      [parsedTicketId]
    );
  }

  return getTicketDetail(actor, parsedTicketId);
}

module.exports = {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  createTicket,
  listTickets,
  getTicketStats,
  getMyTickets,
  getTicketDetail,
  updateTicket,
  addTicketMessage
};
