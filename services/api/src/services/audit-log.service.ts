import { query } from "../config/database";
import { getTableColumns } from "../utils/schema-helpers";

let auditLogTableAvailable: boolean | null = null;

async function hasAuditLogTable(): Promise<boolean> {
  if (auditLogTableAvailable === true) {
    return auditLogTableAvailable;
  }

  const columns = await getTableColumns("audit_logs").catch(() => []);
  auditLogTableAvailable = columns.length > 0 ? true : null;
  return auditLogTableAvailable === true;
}

export interface AuditLogEntry {
  actorUserId?: string | number | null;
  actorRole?: string | null;
  action?: string;
  entityType?: string;
  entityId?: string | number | null;
  description?: string | null;
  metadata?: any;
}

export async function recordAuditLog(entry: AuditLogEntry = {}): Promise<boolean | null> {
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

export async function getRecentAuditLogs(limit: number = 20): Promise<any[]> {
  const available = await hasAuditLogTable();
  if (!available) {
    return [];
  }

  const safeLimit = Math.max(1, Math.min(Number(limit || 20), 100));
  const rows = await query<any[]>(
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

export default {
  recordAuditLog,
  getRecentAuditLogs
};
