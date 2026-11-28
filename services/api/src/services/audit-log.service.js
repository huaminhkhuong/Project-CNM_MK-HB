const { query } = require("../config/database");
const { getTableColumns } = require("../utils/schema-helpers");

let auditLogTableAvailable = null;

async function hasAuditLogTable() {
  if (auditLogTableAvailable === true) {
    return auditLogTableAvailable;
  }

  const columns = await getTableColumns("audit_logs").catch(() => []);
  auditLogTableAvailable = columns.length > 0 ? true : null;
  return auditLogTableAvailable === true;
}

async function recordAuditLog(entry = {}) {
  try {
    const available = await hasAuditLogTable();
    if (!available) {
      return null;
    }

    await query(
      `
        INSERT INTO audit_logs (
          actor_user_id,
          actor_role,
          action,
          entity_type,
          entity_id,
          description,
          metadata_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        entry.actorUserId || null,
        entry.actorRole || null,
        String(entry.action || "UNKNOWN_ACTION"),
        String(entry.entityType || "UNKNOWN_ENTITY"),
        entry.entityId === undefined || entry.entityId === null ? null : String(entry.entityId),
        entry.description ? String(entry.description) : null,
        entry.metadata ? JSON.stringify(entry.metadata) : null
      ]
    );
  } catch (_error) {
    return null;
  }

  return true;
}

async function getRecentAuditLogs(limit = 20) {
  const available = await hasAuditLogTable();
  if (!available) {
    return [];
  }

  const safeLimit = Math.max(1, Math.min(Number(limit || 20), 100));
  const rows = await query(
    `
      SELECT
        id,
        actor_user_id AS actorUserId,
        actor_role AS actorRole,
        action,
        entity_type AS entityType,
        entity_id AS entityId,
        description,
        metadata_json AS metadataJson,
        created_at AS createdAt
      FROM audit_logs
      ORDER BY created_at DESC, id DESC
      LIMIT ${safeLimit}
    `
  );

  return rows.map((row) => ({
    ...row,
    metadata: (() => {
      if (!row.metadataJson) {
        return null;
      }

      try {
        return JSON.parse(row.metadataJson);
      } catch (_error) {
        return null;
      }
    })()
  }));
}

async function getPaginatedAuditLogs(options = {}) {
  const available = await hasAuditLogTable();
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.max(1, Math.min(Number(options.limit) || 20, 100));
  const offset = (page - 1) * limit;

  if (!available) {
    return {
      items: [],
      pagination: { page, limit, total: 0, totalPages: 1 }
    };
  }

  const whereClauses = [];
  const params = [];

  if (options.role && String(options.role).trim() && String(options.role).toUpperCase() !== "ALL") {
    const normalizedRole = String(options.role).trim().toUpperCase();
    if (normalizedRole === "SALES_STAFF") {
      whereClauses.push("UPPER(COALESCE(actor_role, '')) IN ('SALES_STAFF', 'SALES', 'STAFF')");
    } else if (normalizedRole === "TECH_STAFF") {
      whereClauses.push("UPPER(COALESCE(actor_role, '')) IN ('TECH_STAFF', 'TECH', 'TECHNICIAN')");
    } else if (normalizedRole === "SYSTEM") {
      whereClauses.push("(actor_role IS NULL OR actor_role = '' OR UPPER(actor_role) = 'SYSTEM')");
    } else {
      whereClauses.push("UPPER(actor_role) = ?");
      params.push(normalizedRole);
    }
  }

  if (options.entityType && String(options.entityType).trim() && String(options.entityType).toUpperCase() !== "ALL") {
    whereClauses.push("UPPER(entity_type) = ?");
    params.push(String(options.entityType).trim().toUpperCase());
  }

  if (options.search && String(options.search).trim()) {
    const kw = `%${String(options.search).trim()}%`;
    whereClauses.push("(action LIKE ? OR entity_type LIKE ? OR entity_id LIKE ? OR description LIKE ?)");
    params.push(kw, kw, kw, kw);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const [countRows, rows] = await Promise.all([
    query(`SELECT COUNT(*) AS total FROM audit_logs ${whereSql}`, params),
    query(
      `
        SELECT
          id,
          actor_user_id AS actorUserId,
          actor_role AS actorRole,
          action,
          entity_type AS entityType,
          entity_id AS entityId,
          description,
          metadata_json AS metadataJson,
          created_at AS createdAt
        FROM audit_logs
        ${whereSql}
        ORDER BY created_at DESC, id DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      params
    )
  ]);

  const total = Number(countRows?.[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    items: rows.map((row) => ({
      ...row,
      metadata: (() => {
        if (!row.metadataJson) return null;
        try {
          return JSON.parse(row.metadataJson);
        } catch (_error) {
          return null;
        }
      })()
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages
    }
  };
}

module.exports = {
  recordAuditLog,
  getRecentAuditLogs,
  getPaginatedAuditLogs
};
