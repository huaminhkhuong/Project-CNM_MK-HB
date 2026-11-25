import { query } from "../../config/database";
import { createError } from "../../utils/service-helpers";

export interface TagRecord {
  id: number;
  code: string;
  label: string;
  group_name: string;
  description: string | null;
}

/**
 * Chuẩn hóa chuỗi tag theo quy chuẩn:
 * - Luôn lowercase
 * - Không có dấu tiếng Việt
 * - Không có khoảng trắng (thay bằng dấu gạch dưới `_`)
 */
export function normalizeTagCode(raw: string): string {
  const cleaned = String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return cleaned.slice(0, 64);
}

/**
 * Danh sách bộ tag chuẩn mặc định của hệ thống
 */
export const CANONICAL_TAGS: Array<{
  code: string;
  label: string;
  group_name: string;
  description: string;
}> = [
  { code: "gaming", label: "Gaming", group_name: "use_case", description: "Phù hợp chơi game phổ thông đến cao cấp" },
  { code: "esports", label: "eSports", group_name: "use_case", description: "Tối ưu FPS cao cho game cạnh tranh (Valorant, CS2, LoL)" },
  { code: "aaa", label: "Game AAA", group_name: "use_case", description: "Đáp ứng game đồ họa nặng, Ray Tracing, 2K/4K" },
  { code: "van_phong", label: "Văn phòng", group_name: "use_case", description: "Phù hợp học tập, làm việc văn phòng, tiết kiệm điện" },
  { code: "do_hoa", label: "Đồ họa / Render", group_name: "use_case", description: "Tối ưu thiết kế 2D/3D, dựng phim, render" },
  { code: "ai", label: "AI / Machine Learning", group_name: "use_case", description: "Phù hợp huấn luyện mô hình AI, VRAM/CUDA lớn" },
  { code: "workstation", label: "Workstation / Server", group_name: "use_case", description: "Linh kiện máy trạm / máy chủ chuyên dụng" },
  { code: "lap_trinh", label: "Lập trình", group_name: "use_case", description: "Đa nhiệm tốt cho lập trình, Docker, máy ảo" },
  { code: "white_theme", label: "Tone Trắng", group_name: "style", description: "Linh kiện màu trắng đồng bộ thẩm mỹ" },
  { code: "rgb", label: "LED RGB", group_name: "style", description: "Hỗ trợ đèn LED RGB / ARGB" }
];

export async function ensureCanonicalTags(): Promise<void> {
  for (const tag of CANONICAL_TAGS) {
    const code = normalizeTagCode(tag.code);
    await query(
      `
        INSERT INTO tags (code, label, group_name, description)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          label = VALUES(label),
          group_name = VALUES(group_name),
          description = VALUES(description)
      `,
      [code, tag.label, tag.group_name, tag.description]
    );
  }
}

export async function listTags(): Promise<Array<TagRecord & { productCount: number }>> {
  const rows = (await query(`
    SELECT
      t.id,
      t.code,
      t.label,
      t.group_name,
      t.description,
      COUNT(pt.product_id) AS productCount
    FROM tags t
    LEFT JOIN product_tags pt ON pt.tag_id = t.id
    GROUP BY t.id, t.code, t.label, t.group_name, t.description
    ORDER BY t.group_name ASC, t.code ASC
  `)) as any[];

  return rows.map((r) => ({
    id: Number(r.id),
    code: String(r.code),
    label: String(r.label),
    group_name: String(r.group_name),
    description: r.description ? String(r.description) : null,
    productCount: Number(r.productCount || 0)
  }));
}

export async function createTag(payload: {
  code?: string;
  label?: string;
  groupName?: string;
  group_name?: string;
  description?: string;
}): Promise<TagRecord> {
  const rawInput = payload.code || payload.label || "";
  const code = normalizeTagCode(rawInput);
  if (!code) {
    throw createError("Mã tag không hợp lệ (chỉ chấp nhận chữ, số, gạch dưới sau chuẩn hóa)", 400);
  }

  const label = String(payload.label || code).trim().slice(0, 100);
  const groupName = normalizeTagCode(payload.groupName || payload.group_name || "use_case") || "use_case";
  const description = payload.description ? String(payload.description).trim().slice(0, 255) : null;

  await query(
    `
      INSERT INTO tags (code, label, group_name, description)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        label = VALUES(label),
        group_name = VALUES(group_name),
        description = COALESCE(VALUES(description), description)
    `,
    [code, label, groupName, description]
  );

  const [row] = (await query(
    `SELECT id, code, label, group_name, description FROM tags WHERE code = ? LIMIT 1`,
    [code]
  )) as any[];

  return {
    id: Number(row.id),
    code: String(row.code),
    label: String(row.label),
    group_name: String(row.group_name),
    description: row.description ? String(row.description) : null
  };
}

export async function deleteTag(tagId: number): Promise<{ deleted: boolean; id: number }> {
  const parsedId = Number(tagId);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw createError("tagId không hợp lệ", 400);
  }
  const [existing] = (await query(`SELECT id FROM tags WHERE id = ? LIMIT 1`, [parsedId])) as any[];
  if (!existing) {
    throw createError("Tag không tồn tại", 404);
  }
  await query(`DELETE FROM tags WHERE id = ?`, [parsedId]);
  return { deleted: true, id: parsedId };
}

export async function getProductTags(productId: number): Promise<string[]> {
  const rows = (await query(
    `
      SELECT t.code
      FROM product_tags pt
      INNER JOIN tags t ON t.id = pt.tag_id
      WHERE pt.product_id = ?
      ORDER BY t.code ASC
    `,
    [productId]
  )) as any[];
  return rows.map((r) => String(r.code));
}

export async function getProductTagsMap(productIds: number[]): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>();
  if (!productIds || productIds.length === 0) return result;

  const placeholders = productIds.map(() => "?").join(", ");
  const rows = (await query(
    `
      SELECT pt.product_id AS productId, t.code
      FROM product_tags pt
      INNER JOIN tags t ON t.id = pt.tag_id
      WHERE pt.product_id IN (${placeholders})
      ORDER BY t.code ASC
    `,
    productIds
  )) as any[];

  for (const r of rows) {
    const pid = Number(r.productId);
    if (!result.has(pid)) result.set(pid, []);
    result.get(pid)!.push(String(r.code));
  }
  return result;
}

/**
 * Gán danh sách tag (0..N tag) cho sản phẩm.
 * Tự động chuẩn hóa code về lowercase, không dấu, không khoảng trắng.
 * Nếu danh sách rỗng ([]) => xóa hết tag (0 tag = dùng chung nhiều nhu cầu).
 */
export async function setProductTags(productId: number, rawTags: unknown): Promise<string[]> {
  if (!Array.isArray(rawTags)) {
    throw createError("tags phải là một mảng chuỗi", 400);
  }

  const normalizedUnique: string[] = [];
  const seen = new Set<string>();
  for (const item of rawTags) {
    const code = normalizeTagCode(String(item || ""));
    if (code && !seen.has(code)) {
      seen.add(code);
      normalizedUnique.push(code);
    }
  }

  await query(`DELETE FROM product_tags WHERE product_id = ?`, [productId]);

  if (normalizedUnique.length === 0) {
    return [];
  }

  for (const code of normalizedUnique) {
    await query(
      `
        INSERT INTO tags (code, label, group_name)
        VALUES (?, ?, 'use_case')
        ON DUPLICATE KEY UPDATE code = VALUES(code)
      `,
      [code, code]
    );
    await query(
      `
        INSERT IGNORE INTO product_tags (product_id, tag_id)
        SELECT ?, id FROM tags WHERE code = ? LIMIT 1
      `,
      [productId, code]
    );
  }

  return normalizedUnique;
}
