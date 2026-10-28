import { Request, Response } from "express";

import { prisma } from "../../config/prisma";
import { AppError } from "../../errors/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendWarrantyNotification } from "../notifications/notifications.service";

type UploadedWarrantyFile = {
  filename: string;
  mimetype: string;
};

const WARRANTY_LIFECYCLE_STEPS = [
  "RECEIVED",
  "INSPECTING",
  "REPAIRING",
  "WAITING_PARTS",
  "REPLACEMENT",
  "COMPLETED"
] as const;

const REQUEST_STATUS_LABELS: Record<string, string> = {
  RECEIVED: "Đã tiếp nhận",
  INSPECTING: "Đang kiểm tra",
  REPAIRING: "Đang sửa",
  WAITING_PARTS: "Chờ linh kiện",
  REPLACEMENT: "Đổi mới",
  COMPLETED: "Hoàn tất"
};

const SEVERITY_LABELS: Record<string, string> = {
  LOW: "Nhẹ",
  MEDIUM: "Trung bình",
  HIGH: "Nghiêm trọng",
  CRITICAL: "Khẩn cấp"
};

function addWarrantyPeriod(date = new Date(), months = 12) {
  const expiresAt = new Date(date);
  expiresAt.setMonth(expiresAt.getMonth() + months);
  return expiresAt;
}

function getWarrantyMonthsFromItem(item: any): number {
  if (!item) return 24;

  // 1. SKU Master data (override at SKU level)
  const skuMonths = Number(
    item?.ProductSku?.warranty_months ||
    item?.sku_warranty_months ||
    item?.skuWarrantyMonths
  );
  if (Number.isFinite(skuMonths) && skuMonths > 0) {
    return skuMonths;
  }

  // 2. Product Master data (base product warranty)
  const productMonths = Number(
    item?.ProductSku?.Product?.warranty_months ||
    item?.Product?.warranty_months ||
    item?.product_warranty_months ||
    item?.productWarrantyMonths
  );
  if (Number.isFinite(productMonths) && productMonths > 0) {
    return productMonths;
  }

  // 3. Explicit warrantyMonths on item snapshot
  const explicitMonths = Number(item?.warranty_months || item?.warrantyMonths);
  if (Number.isFinite(explicitMonths) && explicitMonths > 0) {
    return explicitMonths;
  }

  // 4. Fallback for legacy records without master data: keyword heuristics
  const catName = String(
    item?.ProductSku?.Product?.Category?.name ||
    item?.Category?.name ||
    item?.category_name ||
    item?.categoryName ||
    ""
  ).toLowerCase();

  const prodName = String(
    item?.ProductSku?.Product?.name ||
    item?.Product?.name ||
    item?.product_name ||
    item?.productName ||
    item?.name_snapshot ||
    ""
  ).toLowerCase();

  const combined = `${catName} ${prodName}`;

  if (/psu|nguồn|power supply/i.test(combined) && (/seasonic|rm750|rm850|rm1000|corsair rm/i.test(combined))) {
    return 120;
  }
  if (/ssd|nvme/i.test(combined) && (/980 pro|990 pro|sn850/i.test(combined))) {
    return 60;
  }
  if (/cpu|vi xử lý|processor|mainboard|bo mạch|motherboard|ram|bộ nhớ|gpu|vga|card đồ họa|graphics/i.test(combined)) {
    return 36;
  }
  if (/ssd|nvme|storage|ổ cứng|psu|nguồn|power supply/i.test(combined)) {
    return 36;
  }
  if (/cooling|tản nhiệt|aio|fan|quạt/i.test(combined)) {
    return 24;
  }
  if (/case|vỏ case|vỏ máy tính|màn hình|monitor/i.test(combined)) {
    return 12;
  }

  return 24;
}

function generateWarrantyCode(orderItemId: number) {
  return `BH-${orderItemId}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

function normalizeRequestStatus(status = "RECEIVED") {
  const normalized = String(status || "RECEIVED").trim().toUpperCase();
  return WARRANTY_LIFECYCLE_STEPS.includes(normalized as any) ? normalized : "RECEIVED";
}

function normalizeSeverity(severity = "MEDIUM") {
  const normalized = String(severity || "MEDIUM").trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(SEVERITY_LABELS, normalized) ? normalized : "MEDIUM";
}

function getUserIdFromRequest(req: Request) {
  const userId = req.user?.userId;
  if (!userId) throw new AppError("Unauthorized", 401);
  return Number(userId);
}

function getAuthenticatedUserId(req: Request) {
  return req.user?.userId ? Number(req.user.userId) : null;
}

function assertWarrantyOwnership(req: Request, warranty: any) {
  const userId = getAuthenticatedUserId(req);
  if (!userId) return;
  if (!warranty || Number(warranty.user_id) !== userId) {
    throw new AppError("Báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p báº£o hÃ nh nÃ y", 403);
  }
}

function isWarrantyRequestable(warranty: any) {
  const status = String(warranty?.status || "ACTIVE").toUpperCase();
  const expiresAt = warranty?.expires_at ? new Date(warranty.expires_at) : null;
  return status === "ACTIVE" && (!expiresAt || expiresAt.getTime() >= Date.now());
}

function sanitizeBigInts(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return Number(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeBigInts);
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      res[key] = sanitizeBigInts(obj[key]);
    }
    return res;
  }
  return obj;
}

function replacePlaceholders(sql: string) {
  return sql;
}

async function queryRows<T = any>(sql: string, ...params: any[]) {
  const formattedSql = replacePlaceholders(sql);
  const rows = await prisma.$queryRawUnsafe<T[]>(formattedSql, ...params);
  return sanitizeBigInts(rows);
}

async function execute(sql: string, ...params: any[]) {
  const formattedSql = replacePlaceholders(sql);
  return prisma.$executeRawUnsafe(formattedSql, ...params);
}

function buildFallbackTimeline(status = "RECEIVED") {
  const normalized = normalizeRequestStatus(status);
  const activeIndex = Math.max(WARRANTY_LIFECYCLE_STEPS.indexOf(normalized as any), 0);

  return WARRANTY_LIFECYCLE_STEPS.map((step, index) => ({
    key: step,
    label: REQUEST_STATUS_LABELS[step],
    done: index <= activeIndex,
    timestamp: null,
    note: null,
    actorName: null
  }));
}

function buildTimelineFromEvents(status: string, events: any[]) {
  if (!Array.isArray(events) || events.length === 0) {
    return buildFallbackTimeline(status);
  }

  const byStatus = new Map<string, any>();
  events.forEach((event) => {
    if (!byStatus.has(event.status)) {
      byStatus.set(event.status, event);
    }
  });

  const activeIndex = Math.max(WARRANTY_LIFECYCLE_STEPS.indexOf(normalizeRequestStatus(status) as any), 0);
  return WARRANTY_LIFECYCLE_STEPS.map((step, index) => {
    const event = byStatus.get(step);
    return {
      key: step,
      label: REQUEST_STATUS_LABELS[step],
      done: index <= activeIndex,
      timestamp: event?.createdAt || null,
      note: event?.note || null,
      actorName: event?.actorName || null
    };
  });
}

async function createWarrantyNotification(userId: number | null, requestId: number | null, title: string, message: string) {
  if (!userId) return;
  await execute(
    `
      INSERT INTO warranty_notifications (user_id, request_id, title, message, is_read)
      VALUES (?, ?, ?, ?, 0)
    `,
    userId,
    requestId,
    title,
    message
  );

  // 🔔 Đẩy vào hệ thống thông báo thống nhất In-App & Real-Time Socket
  sendWarrantyNotification({
    userId,
    requestId,
    title,
    message
  }).catch((err) => console.warn("[Notification] Warranty notification sync failed:", err.message));
}

async function addRequestEvent(requestId: number, status: string, note: string | null, actorRole: string | null, actorName: string | null) {
  await execute(
    `
      INSERT INTO warranty_request_events (request_id, status, note, actor_role, actor_name)
      VALUES (?, ?, ?, ?, ?)
    `,
    requestId,
    normalizeRequestStatus(status),
    note,
    actorRole,
    actorName
  );
}

async function attachFilesToRequest(requestId: number, files: UploadedWarrantyFile[], source: "CUSTOMER" | "STAFF") {
  if (!Array.isArray(files) || files.length === 0) return [];

  const attachments = files.map((file) => ({
    fileUrl: `/uploads/warranty-requests/${file.filename}`,
    mimeType: file.mimetype || null
  }));

  await Promise.all(
    attachments.map((attachment) =>
      execute(
        `
          INSERT INTO warranty_request_attachments (request_id, source, file_url, mime_type)
          VALUES (?, ?, ?, ?)
        `,
        requestId,
        source,
        attachment.fileUrl,
        attachment.mimeType
      )
    )
  );

  return attachments;
}

function getCategoryNameFromWarranty(warranty: any) {
  return warranty?.OrderItem?.ProductSku?.Product?.Category?.name || null;
}

function calculateMonthsBetween(start?: Date | string | null, end?: Date | string | null): number {
  if (!start || !end) return 24;
  const d1 = new Date(start);
  const d2 = new Date(end);
  const diffMonths = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
  return diffMonths > 0 ? diffMonths : 24;
}

function formatWarranty(warranty: any, latestRequest?: any) {
  const expiresAt = warranty.expires_at ? new Date(warranty.expires_at) : null;
  const remainingDays = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)) : null;
  const status = expiresAt && expiresAt.getTime() < Date.now() ? "EXPIRED" : warranty.status;

  const masterMonths = Number(
    warranty.OrderItem?.ProductSku?.warranty_months ||
    warranty.OrderItem?.ProductSku?.Product?.warranty_months
  );

  const resolvedMonths = (warranty.activated_at && warranty.expires_at)
    ? calculateMonthsBetween(warranty.activated_at, warranty.expires_at)
    : (masterMonths > 0 ? masterMonths : 24);

  return {
    id: warranty.id,
    productId: warranty.OrderItem?.product_id || null,
    orderId: warranty.order_id,
    orderItemId: warranty.order_item_id,
    skuId: warranty.sku_id,
    warrantyCode: warranty.warranty_code,
    serialNumber: warranty.serial_number || warranty.OrderItem?.sku_snapshot || null,
    status,
    warrantyMonths: resolvedMonths,
    startDate: warranty.activated_at,
    endDate: warranty.expires_at,
    activatedAt: warranty.activated_at,
    expiresAt: warranty.expires_at,
    note: warranty.note,
    remainingDays,
    qrUrl: `/warranties?lookup=${encodeURIComponent(warranty.warranty_code)}`,
    imageUrl: warranty.OrderItem?.ProductSku?.image_url || null,
    categoryName: getCategoryNameFromWarranty(warranty),
    orderNumber: warranty.order_id ? `#${warranty.order_id}` : null,
    timeline: buildFallbackTimeline(latestRequest?.status || "RECEIVED"),
    latestRequest: latestRequest || null,
    item: {
      productName: warranty.OrderItem?.name_snapshot,
      sku: warranty.OrderItem?.sku_snapshot,
      unitPrice: warranty.OrderItem?.unit_price,
      quantity: warranty.OrderItem?.quantity ?? 1
    }
  };
}

function buildLookupWhere(value: string) {
  const clauses: any[] = [
    { warranty_code: value },
    { serial_number: value },
    { serial_number: { contains: value } },
    { warranty_code: { contains: value } },
    { OrderItem: { sku_snapshot: { contains: value } } },
    { User: { phone: { contains: value } } }
  ];

  if (/^\d+$/.test(value)) {
    clauses.push({ order_id: Number(value) });
  }

  return { OR: clauses };
}

async function getWarrantyRequestsBase(whereSql: string, params: any[]) {
  const rows = await queryRows<any>(
    `
      SELECT
        wr.id,
        wr.warranty_id AS warrantyId,
        wr.user_id AS userId,
        wr.lookup_value AS lookupValue,
        wr.customer_name AS customerName,
        wr.customer_phone AS customerPhone,
        wr.customer_email AS customerEmail,
        wr.product_name AS productName,
        wr.serial_number AS serialNumber,
        wr.order_id AS orderId,
        wr.severity,
        wr.issue_description AS issueDescription,
        wr.extra_note AS extraNote,
        wr.status,
        wr.last_staff_note AS lastStaffNote,
        wr.last_email_mock AS lastEmailMock,
        wr.created_at AS createdAt,
        wr.updated_at AS updatedAt,
        w.warranty_code AS warrantyCode,
        w.expires_at AS warrantyExpiresAt,
        oi.name_snapshot AS orderItemProductName,
        oi.sku_snapshot AS orderItemSku,
        ps.image_url AS productImage,
        c.name AS categoryName,
        u.email AS accountEmail,
        u.full_name AS accountName,
        u.phone AS accountPhone,
        (
          SELECT mu.email
          FROM users mu
          WHERE wr.user_id IS NULL
            AND (
              (
                wr.customer_email IS NOT NULL
                AND LOWER(mu.email) = LOWER(wr.customer_email)
              )
              OR (
                wr.customer_phone IS NOT NULL
                AND wr.customer_phone <> ''
                AND mu.phone = wr.customer_phone
              )
            )
          ORDER BY
            CASE
              WHEN wr.customer_email IS NOT NULL
                AND wr.customer_email <> ''
                AND LOWER(mu.email) = LOWER(wr.customer_email)
              THEN 0
              ELSE 1
            END,
            mu.id DESC
          LIMIT 1
        ) AS matchedEmail,
        (
          SELECT mu.full_name
          FROM users mu
          WHERE wr.user_id IS NULL
            AND (
              (
                wr.customer_email IS NOT NULL
                AND wr.customer_email <> ''
                AND LOWER(mu.email) = LOWER(wr.customer_email)
              )
              OR (
                wr.customer_phone IS NOT NULL
                AND wr.customer_phone <> ''
                AND mu.phone = wr.customer_phone
              )
            )
          ORDER BY
            CASE
              WHEN wr.customer_email IS NOT NULL
                AND wr.customer_email <> ''
                AND LOWER(mu.email) = LOWER(wr.customer_email)
              THEN 0
              ELSE 1
            END,
            mu.id DESC
          LIMIT 1
        ) AS matchedName,
        (
          SELECT mu.phone
          FROM users mu
          WHERE wr.user_id IS NULL
            AND (
              (
                wr.customer_email IS NOT NULL
                AND wr.customer_email <> ''
                AND LOWER(mu.email) = LOWER(wr.customer_email)
              )
              OR (
                wr.customer_phone IS NOT NULL
                AND wr.customer_phone <> ''
                AND mu.phone = wr.customer_phone
              )
            )
          ORDER BY
            CASE
              WHEN wr.customer_email IS NOT NULL
                AND wr.customer_email <> ''
                AND LOWER(mu.email) = LOWER(wr.customer_email)
              THEN 0
              ELSE 1
            END,
            mu.id DESC
          LIMIT 1
        ) AS matchedPhone
      FROM warranty_requests wr
      LEFT JOIN warranties w ON w.id = wr.warranty_id
      LEFT JOIN order_items oi ON oi.id = w.order_item_id
      LEFT JOIN product_skus ps ON ps.id = COALESCE(w.sku_id, oi.product_variant_id)
      LEFT JOIN products p ON p.id = COALESCE(ps.product_id, oi.product_id)
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN users u ON u.id = wr.user_id
      WHERE ${whereSql}
      ORDER BY wr.updated_at DESC, wr.created_at DESC
    `,
    ...params
  );

  if (rows.length === 0) return [];

  const requestIds = rows.map((row: any) => row.id);
  const placeholders = requestIds.map(() => "?").join(", ");
  const attachments = await queryRows<any>(
    `
      SELECT id, request_id AS requestId, source, file_url AS fileUrl, mime_type AS mimeType, created_at AS createdAt
      FROM warranty_request_attachments
      WHERE request_id IN (${placeholders})
      ORDER BY created_at ASC, id ASC
    `,
    ...requestIds
  );
  const events = await queryRows<any>(
    `
      SELECT id, request_id AS requestId, status, note, actor_role AS actorRole, actor_name AS actorName, created_at AS createdAt
      FROM warranty_request_events
      WHERE request_id IN (${placeholders})
      ORDER BY created_at ASC, id ASC
    `,
    ...requestIds
  );

  const attachmentMap = new Map<number, any[]>();
  attachments.forEach((attachment: any) => {
    const bucket = attachmentMap.get(attachment.requestId) || [];
    bucket.push(attachment);
    attachmentMap.set(attachment.requestId, bucket);
  });

  const eventMap = new Map<number, any[]>();
  events.forEach((event: any) => {
    const bucket = eventMap.get(event.requestId) || [];
    bucket.push(event);
    eventMap.set(event.requestId, bucket);
  });

  return rows.map((row: any) => ({
    id: row.id,
    warrantyId: row.warrantyId,
    userId: row.userId,
    lookupValue: row.lookupValue,
    customerName: row.customerName || row.accountName || row.matchedName || null,
    customerPhone: row.customerPhone || row.accountPhone || row.matchedPhone || null,
    customerEmail: row.customerEmail || row.accountEmail || row.matchedEmail || null,
    productName: row.productName || row.orderItemProductName || "Sản phẩm",
    serialNumber: row.serialNumber || row.orderItemSku || null,
    orderId: row.orderId,
    severity: normalizeSeverity(row.severity),
    severityLabel: SEVERITY_LABELS[normalizeSeverity(row.severity)],
    issueDescription: row.issueDescription,
    extraNote: row.extraNote,
    status: normalizeRequestStatus(row.status),
    statusLabel: REQUEST_STATUS_LABELS[normalizeRequestStatus(row.status)],
    lastStaffNote: row.lastStaffNote,
    lastEmailMock: row.lastEmailMock,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    warrantyCode: row.warrantyCode,
    warrantyExpiresAt: row.warrantyExpiresAt,
    imageUrl: row.productImage || null,
    categoryName: row.categoryName || null,
    attachments: attachmentMap.get(row.id) || [],
    timeline: buildTimelineFromEvents(row.status, eventMap.get(row.id) || [])
  }));
}

async function getLatestRequestMapByWarrantyIds(warrantyIds: number[]) {
  if (warrantyIds.length === 0) return new Map<number, any>();

  const placeholders = warrantyIds.map(() => "?").join(", ");
  const rows = await queryRows<any>(
    `
      SELECT wr.*
      FROM warranty_requests wr
      INNER JOIN (
        SELECT warranty_id, MAX(id) AS latest_id
        FROM warranty_requests
        WHERE warranty_id IN (${placeholders})
        GROUP BY warranty_id
      ) latest ON latest.latest_id = wr.id
    `,
    ...warrantyIds
  );

  return new Map<number, any>(rows.map((row: any) => [row.warranty_id, row]));
}

export const getEligibleWarrantyItems = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);

  const eligibleItems = await prisma.orderItem.findMany({
    where: {
      Order: { user_id: userId, status: "DELIVERED" },
      WarrantyItem: { none: {} }
    }
  });

  res.status(200).json({
    success: true,
    data: eligibleItems.map((item: any) => ({
      id: item.id,
      orderId: item.order_id,
      productName: item.name_snapshot,
      sku: item.sku_snapshot
    }))
  });
});

export const getMyWarranties = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);

  const warranties = await prisma.warrantyItem.findMany({
    where: { user_id: userId },
    include: {
      OrderItem: {
        include: {
          ProductSku: {
            include: {
              Product: {
                include: {
                  Category: true
                }
              }
            }
          }
        }
      },
      Order: true
    },
    orderBy: { created_at: "desc" }
  });

  const latestRequestMap = await getLatestRequestMapByWarrantyIds(warranties.map((item) => item.id));
  res.status(200).json({
    success: true,
    data: warranties.map((warranty) => formatWarranty(warranty, latestRequestMap.get(warranty.id) || null))
  });
});

export const activateWarranty = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);
  const { orderItemId, note } = req.body;
  if (!orderItemId) throw new AppError("Thiáº¿u orderItemId", 400);

  const id = typeof orderItemId === "string" ? parseInt(orderItemId, 10) : orderItemId;
  const orderItem = await prisma.orderItem.findUnique({
    where: { id },
    include: {
      Order: true,
      ProductSku: {
        include: {
          Product: {
            include: {
              Category: true
            }
          }
        }
      }
    }
  });

  if (!orderItem || orderItem.Order.user_id !== userId || orderItem.Order.status !== "DELIVERED") {
    throw new AppError("Sáº£n pháº©m khÃ´ng há»£p lá»‡ Ä‘á»ƒ kÃ­ch hoáº¡t báº£o hÃ nh", 400);
  }

  const existing = await prisma.warrantyItem.findFirst({ where: { order_item_id: id } });
  if (existing) {
    throw new AppError("Sản phẩm này đã được kích hoạt bảo hành", 400);
  }

  const assignedSerial = await prisma.orderItemSerial.findFirst({
    where: { order_item_id: id }
  });
  const serialNum = assignedSerial?.serial_number || null;
  const warrantyCode = serialNum ? `BH-${serialNum}` : generateWarrantyCode(id);

  const now = new Date();
  const warranty = await prisma.warrantyItem.create({
    data: {
      user_id: userId,
      order_item_id: id,
      order_id: orderItem.order_id,
      sku_id: orderItem.product_variant_id,
      serial_number: serialNum,
      warranty_code: warrantyCode,
      note: note || (serialNum ? `Kích hoạt theo S/N ${serialNum}` : null),
      status: "ACTIVE",
      activated_at: now,
      expires_at: addWarrantyPeriod(now, getWarrantyMonthsFromItem(orderItem))
    },
    include: {
      OrderItem: {
        include: {
          ProductSku: {
            include: {
              Product: {
                include: {
                  Category: true
                }
              }
            }
          }
        }
      },
      Order: true
    }
  });

  if (assignedSerial) {
    await prisma.orderItemSerial.update({
      where: { id: assignedSerial.id },
      data: { warranty_id: warranty.id, status: "IN_WARRANTY" }
    });
  }

  res.status(201).json({ success: true, data: formatWarranty(warranty) });
});

export const lookupWarranty = asyncHandler(async (req: Request, res: Response) => {
  const lookupValue = String(req.params.code || req.query.q || req.query.code || req.query.orderId || req.query.phone || "").trim();
  if (!lookupValue) throw new AppError("Thiếu thông tin tra cứu bảo hành", 400);

  const include = {
    OrderItem: {
      include: {
        ProductSku: {
          include: {
            Product: {
              include: {
                Category: true
              }
            }
          }
        }
      }
    },
    Order: true,
    User: true
  };

  const currentUserId = getAuthenticatedUserId(req);
  const where = currentUserId
    ? {
        AND: [
          buildLookupWhere(lookupValue),
          { user_id: currentUserId }
        ]
      }
    : buildLookupWhere(lookupValue);

  const warranty = await prisma.warrantyItem.findFirst({
    where,
    include
  });

  if (!warranty) {
    throw new AppError("Không tìm thấy thông tin bảo hành cho dữ liệu này", 404);
  }

  assertWarrantyOwnership(req, warranty);

  const requestRows = await getWarrantyRequestsBase("wr.warranty_id = ?", [warranty.id]);
  const latestRequest = requestRows[0] || null;

  res.status(200).json({
    success: true,
    data: {
      ...formatWarranty(warranty, latestRequest),
      productName: warranty.OrderItem?.name_snapshot,
      sku: warranty.OrderItem?.sku_snapshot,
      categoryName: getCategoryNameFromWarranty(warranty),
      request: latestRequest
    }
  });
});

export const submitWarrantyRequest = asyncHandler(async (req: Request, res: Response) => {
  const files = (((req as Request & { files?: UploadedWarrantyFile[] }).files) || []) as UploadedWarrantyFile[];
  const lookupValue = String(req.body?.lookupValue || req.body?.warrantyCode || req.body?.serial || req.body?.orderId || "").trim();
  const issueDescription = String(req.body?.issueDescription || req.body?.description || "").trim();
  const severity = normalizeSeverity(req.body?.severity || "MEDIUM");
  const extraNote = String(req.body?.extraNote || req.body?.additionalNote || "").trim() || null;

  if (!issueDescription) {
    throw new AppError("Vui lÃ²ng mÃ´ táº£ lá»—i cáº§n báº£o hÃ nh", 400);
  }

  let warrantyId: number | null = req.body?.warrantyId ? Number(req.body.warrantyId) : null;
  let warranty: any = null;

  if (!warrantyId && lookupValue) {
    warranty = await prisma.warrantyItem.findFirst({
      where: buildLookupWhere(lookupValue),
      include: {
        OrderItem: {
          include: {
            ProductSku: {
              include: {
                Product: {
                  include: {
                    Category: true
                  }
                }
              }
            }
          }
        },
        User: true
      }
    });
    warrantyId = warranty?.id || null;
  } else if (warrantyId) {
    warranty = await prisma.warrantyItem.findFirst({
      where: { id: warrantyId },
      include: {
        OrderItem: {
          include: {
            ProductSku: {
              include: {
                Product: {
                  include: {
                    Category: true
                  }
                }
              }
            }
          }
        },
        User: true
      }
    });
  }

  if (!warranty) {
    throw new AppError("KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m báº£o hÃ nh phÃ¹ há»£p", 404);
  }

  assertWarrantyOwnership(req, warranty);

  if (!isWarrantyRequestable(warranty)) {
    throw new AppError("Sáº£n pháº©m Ä‘Ã£ háº¿t háº¡n hoáº·c khÃ´ng cÃ²n hiá»‡u lá»±c báº£o hÃ nh", 400);
  }

  const openRequests = await queryRows<{ id: number; status: string }>(
    `
      SELECT id, status
      FROM warranty_requests
      WHERE warranty_id = ?
        AND status <> 'COMPLETED'
      ORDER BY id DESC
      LIMIT 1
    `,
    warranty.id
  );

  if (openRequests.length > 0) {
    throw new AppError("Sáº£n pháº©m nÃ y Ä‘Ã£ cÃ³ yÃªu cáº§u báº£o hÃ nh Ä‘ang Ä‘Æ°á»£c xá»­ lÃ½", 409);
  }

  const userId = getAuthenticatedUserId(req) || warranty.user_id || null;
  const customerName = String(req.body?.customerName || req.body?.fullName || warranty?.User?.full_name || "").trim() || null;
  const customerPhone = String(req.body?.customerPhone || req.body?.phone || warranty?.User?.phone || "").trim() || null;
  const customerEmail = String(req.body?.customerEmail || req.body?.email || warranty?.User?.email || "").trim() || null;
  const productName = String(warranty?.OrderItem?.name_snapshot || req.body?.productName || "").trim() || null;
  const serialNumber = String(warranty?.OrderItem?.sku_snapshot || req.body?.serialNumber || lookupValue || "").trim() || null;
  const orderId = warranty?.order_id || (req.body?.orderId ? Number(req.body.orderId) : null);

  await execute(
    `
      INSERT INTO warranty_requests
        (warranty_id, user_id, lookup_value, customer_name, customer_phone, customer_email, product_name, serial_number, order_id, severity, issue_description, extra_note, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED')
    `,
    warrantyId,
    userId,
    lookupValue || warranty.warranty_code || null,
    customerName,
    customerPhone,
    customerEmail,
    productName,
    serialNumber,
    orderId,
    severity,
    issueDescription,
    extraNote
  );

  const insertedRow = await queryRows<{ id: number }>("SELECT LAST_INSERT_ID() AS id");
  const requestId = Number(insertedRow[0]?.id || 0);

  await attachFilesToRequest(requestId, files, "CUSTOMER");
  await addRequestEvent(requestId, "RECEIVED", issueDescription, "CUSTOMER", customerName || "KhÃ¡ch hÃ ng");
  await createWarrantyNotification(userId, requestId, "YÃªu cáº§u báº£o hÃ nh Ä‘Ã£ Ä‘Æ°á»£c tiáº¿p nháº­n", `YÃªu cáº§u báº£o hÃ nh cho ${productName || "sáº£n pháº©m"} Ä‘Ã£ Ä‘Æ°á»£c ghi nháº­n.`);

  const requests = await getWarrantyRequestsBase("wr.id = ?", [requestId]);
  res.status(201).json({
    success: true,
    data: requests[0] || {
      id: requestId,
      warrantyId,
      lookupValue,
      status: "RECEIVED",
      statusLabel: REQUEST_STATUS_LABELS.RECEIVED,
      timeline: buildFallbackTimeline("RECEIVED")
    }
  });
});

export const getMyWarrantyRequests = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);
  const rows = await getWarrantyRequestsBase("wr.user_id = ?", [userId]);
  res.status(200).json({ success: true, data: rows });
});

export const getMyWarrantyNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserIdFromRequest(req);
  const rows = await queryRows<any>(
    `
      SELECT id, request_id AS requestId, title, message, is_read AS isRead, created_at AS createdAt
      FROM warranty_notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `,
    userId
  );
  res.status(200).json({ success: true, data: rows });
});

export const getAdminWarrantyRequests = asyncHandler(async (req: Request, res: Response) => {
  const status = String(req.query.status || "").trim().toUpperCase();
  const keyword = String(req.query.q || req.query.keyword || "").trim();

  const clauses = ["1 = 1"];
  const params: any[] = [];

  if (status) {
    clauses.push("wr.status = ?");
    params.push(status);
  }

  if (keyword) {
    clauses.push("(wr.customer_name LIKE CONCAT('%', ?, '%') OR wr.customer_phone LIKE CONCAT('%', ?, '%') OR wr.product_name LIKE CONCAT('%', ?, '%') OR wr.lookup_value LIKE CONCAT('%', ?, '%') OR wr.serial_number LIKE CONCAT('%', ?, '%'))");
    params.push(keyword, keyword, keyword, keyword, keyword);
  }

  const rows = await getWarrantyRequestsBase(clauses.join(" AND "), params);
  res.status(200).json({ success: true, data: rows });
});

export const updateAdminWarrantyRequest = asyncHandler(async (req: Request, res: Response) => {
  const requestId = Number(req.params.requestId);
  if (!requestId) throw new AppError("Thiáº¿u requestId", 400);

  const status = req.body?.status ? normalizeRequestStatus(req.body.status) : "";
  const note = String(req.body?.note || req.body?.technicianNote || "").trim() || null;
  const actorName = String(req.user?.email || "tech@pcmall.local");
  const actorRole = String(req.user?.role || "TECH_STAFF");
  const files = (((req as Request & { files?: UploadedWarrantyFile[] }).files) || []) as UploadedWarrantyFile[];

  const existing = await getWarrantyRequestsBase("wr.id = ?", [requestId]);
  const current = existing[0];
  if (!current) throw new AppError("KhÃ´ng tÃ¬m tháº¥y yÃªu cáº§u báº£o hÃ nh", 404);

  const nextStatus = status || current.status;
  const emailMock = `Mock email sent to ${current.customerEmail || current.customerPhone || "customer"}: ${REQUEST_STATUS_LABELS[nextStatus]} - ${note || "YÃªu cáº§u cá»§a báº¡n Ä‘ang Ä‘Æ°á»£c cáº­p nháº­t."}`;

  await execute(
    `
      UPDATE warranty_requests
      SET status = ?, last_staff_note = ?, last_email_mock = ?
      WHERE id = ?
    `,
    nextStatus,
    note,
    emailMock,
    requestId
  );

  if (note || status) {
    await addRequestEvent(requestId, nextStatus, note, actorRole, actorName);
  }
  await attachFilesToRequest(requestId, files, "STAFF");
  await createWarrantyNotification(current.userId || null, requestId, "Cáº­p nháº­t báº£o hÃ nh", `${current.productName}: ${REQUEST_STATUS_LABELS[nextStatus]}`);

  const updated = await getWarrantyRequestsBase("wr.id = ?", [requestId]);

  // 📧 Email: Gửi thông báo thực khi bảo hành hoàn tất
  if (nextStatus === "COMPLETED") {
    try {
      const emailRecipient = current.customerEmail || null;
      if (emailRecipient) {
        const { buildWarrantyDoneEmail } = require("../../templates/email-warranty-done");
        const { sendEmailAsync: sendAsync } = require("../../services/email.service");
        const { subject, html } = buildWarrantyDoneEmail({
          customerName: current.customerName || emailRecipient,
          customerEmail: emailRecipient,
          warrantyCode: current.warrantyCode || current.lookupValue || String(current.id),
          productName: current.productName || "Linh kiện",
          serialNumber: current.serialNumber || current.lookupValue,
          status: "COMPLETED",
          diagnosis: note || undefined,
          resolution: note || undefined,
          technicianName: actorName,
          completedAt: new Date(),
          notes: note || undefined
        });
        sendAsync({ to: emailRecipient, subject, html });
        console.log(`[Email] 📧 Warranty completion email queued for ${emailRecipient}`);
      }
    } catch (emailErr) {
      console.warn("[Email] Warranty done email failed:", (emailErr as Error).message);
    }
  }

  res.status(200).json({
    success: true,
    data: updated[0],
    notification: {
      title: "Cập nhật bảo hành",
      message: `${current.productName}: ${REQUEST_STATUS_LABELS[nextStatus]}`
    },
    emailMock: nextStatus === "COMPLETED" ? `Real email sent to ${current.customerEmail || "N/A"}` : emailMock
  });
});
