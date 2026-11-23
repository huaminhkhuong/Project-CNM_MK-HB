const crypto = require("crypto");
const axios = require("axios");
const { getDbPool, query } = require("../../config/database");
const { env } = require("../../config/env");
const { createError, toPositiveInteger } = require("../../utils/service-helpers");
const { getPublicStoreInfo } = require("../admin/admin-system.service");
const { publishOrderEvent } = require("../../services/order-events");
const { recordAuditLog } = require("../../services/audit-log.service");

const BANK_CODE_MAP = {
  techcombank: "TCB",
  tcb: "TCB",
  vietcombank: "VCB",
  vcb: "VCB",
  mbbank: "MB",
  "mb bank": "MB",
  mb: "MB",
  acb: "ACB",
  vpbank: "VPB",
  vpb: "VPB",
  bidv: "BIDV",
  vietinbank: "ICB",
  icb: "ICB",
  ctg: "ICB",
  tpbank: "TPB",
  tpb: "TPB",
  ocb: "OCB",
  sacombank: "STB",
  stb: "STB",
  vib: "VIB",
  shb: "SHB",
  msb: "MSB",
  hdbank: "HDB",
  hdb: "HDB",
  agribank: "VBA",
  vba: "VBA"
};

const MIN_POLL_SYNC_COOLDOWN_MS = 3000;
let isSyncingSepay = false;
let lastSyncTimestampMs = 0;

function getActiveEnv() {
  return globalThis.__CNM_ENV__ || env;
}

function resolveBankCode(bankNameOrCode) {
  const raw = String(bankNameOrCode || "Techcombank").trim();
  const mapped = BANK_CODE_MAP[raw.toLowerCase()];
  return mapped || raw.toUpperCase();
}

function getTransferPrefix() {
  const activeEnv = getActiveEnv();
  const raw = String(activeEnv.sepayTransferPrefix || process.env.SEPAY_TRANSFER_PREFIX || "PCMALL").trim();
  const clean = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return clean || "PCMALL";
}

function buildOrderTransferCode(orderId) {
  return `${getTransferPrefix()}${orderId}`;
}

function buildSePayQrUrl({ bankCode, accountNumber, amount, memo }) {
  const params = new URLSearchParams();
  params.set("acc", String(accountNumber || "").trim());
  params.set("bank", resolveBankCode(bankCode));
  if (Number(amount) > 0) {
    params.set("amount", String(Math.round(Number(amount))));
  }
  if (memo) {
    params.set("des", String(memo).trim());
  }
  params.set("template", "compact");
  return `https://qr.sepay.vn/img?${params.toString()}`;
}

function buildFallbackVietQrUrl({ bankCode, accountNumber, accountHolder, amount, memo }) {
  const code = resolveBankCode(bankCode);
  const params = new URLSearchParams();
  if (Number(amount) > 0) {
    params.set("amount", String(Math.round(Number(amount))));
  }
  if (memo) {
    params.set("addInfo", String(memo).trim());
  }
  if (accountHolder) {
    params.set("accountName", String(accountHolder).trim());
  }
  return `https://img.vietqr.io/image/${code}-${String(accountNumber || "").trim()}-compact2.png?${params.toString()}`;
}

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a || ""), "utf8");
  const bufB = Buffer.from(String(b || ""), "utf8");
  if (bufA.length !== bufB.length || bufA.length === 0) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function extractApiKeyFromRequest(req) {
  const authHeader = String(req?.headers?.authorization || "").trim();
  if (authHeader) {
    const match = authHeader.match(/^(?:apikey|bearer)\s+(.+)$/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    return authHeader;
  }

  const customHeader = String(req?.headers?.["x-api-key"] || req?.headers?.["x-sepay-apikey"] || "").trim();
  return customHeader;
}

function verifySepayWebhookAuth(req) {
  const activeEnv = getActiveEnv();
  const expectedKey = String(activeEnv.sepayWebhookApiKey || process.env.SEPAY_WEBHOOK_API_KEY || "").trim();

  if (!expectedKey || expectedKey.toLowerCase().startsWith("your_")) {
    throw createError("SePay webhook API key is not configured", 503);
  }

  const providedKey = extractApiKeyFromRequest(req);
  if (!providedKey || !timingSafeStringEqual(providedKey, expectedKey)) {
    throw createError("Invalid SePay webhook API key", 401);
  }

  return true;
}

function extractOrderIdFromPayload(payload) {
  const prefix = getTransferPrefix();
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefixes = prefix === "DH" ? [escapedPrefix] : [escapedPrefix, "DH"];
  const pattern = new RegExp(`(?:^|[^a-zA-Z0-9])(?:${prefixes.join("|")})[\\s\\-_#]*(\\d+)(?!\\d)`, "i");

  const candidates = [payload?.code, payload?.content, payload?.transaction_content, payload?.description];
  for (const candidate of candidates) {
    const text = String(candidate || "").trim();
    if (!text) continue;
    const match = text.match(pattern);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return null;
}

function normalizeAccountDigits(value) {
  return String(value || "").replace(/[^0-9a-zA-Z]/g, "").trim().toUpperCase();
}

function normalizeSepayApiTransaction(rawTx) {
  if (!rawTx || typeof rawTx !== "object") return null;
  const amountIn = Number(rawTx.transferAmount ?? rawTx.amount_in ?? 0);
  const amountOut = Number(rawTx.amount_out ?? 0);
  const transferType = rawTx.transferType
    ? String(rawTx.transferType).trim().toLowerCase()
    : amountIn > 0 && amountOut <= 0
      ? "in"
      : "out";

  return {
    id: rawTx.id !== undefined && rawTx.id !== null ? String(rawTx.id).trim() : "",
    gateway: String(rawTx.gateway || rawTx.bank_brand_name || "VietQR").trim(),
    transactionDate: String(rawTx.transactionDate || rawTx.transaction_date || "").trim(),
    accountNumber: String(rawTx.accountNumber || rawTx.account_number || "").trim(),
    subAccount: String(rawTx.subAccount || rawTx.sub_account || "").trim(),
    code: rawTx.code ? String(rawTx.code).trim() : "",
    content: String(rawTx.content || rawTx.transaction_content || "").trim(),
    description: String(rawTx.description || "").trim(),
    transferType,
    transferAmount: Math.round(amountIn),
    referenceCode: String(rawTx.referenceCode || rawTx.reference_number || "").trim()
  };
}

function safeNotifyUser(payload) {
  try {
    const notificationsModule = require("../notifications/notifications.service");
    if (payload.customTitle && typeof notificationsModule.createNotification === "function") {
      notificationsModule
        .createNotification({
          userId: Number(payload.userId),
          type: "ORDER",
          title: payload.customTitle,
          message: payload.customMessage,
          referenceId: payload.orderId,
          referenceType: "ORDER",
          link: `/orders/${payload.orderId}`
        })
        .catch(() => {});
      return;
    }
    if (typeof notificationsModule.sendOrderStatusNotification === "function") {
      notificationsModule.sendOrderStatusNotification(payload).catch(() => {});
    }
  } catch (_err) {
    // ignore notification errors
  }
}

function safeEmitSocketPaymentUpdate(userId, eventData) {
  try {
    const socketModule = require("../../socket/socket.service");
    if (typeof socketModule.emitToUser === "function") {
      socketModule.emitToUser(Number(userId), "order:payment_updated", eventData);
    }
  } catch (_err) {
    // ignore socket errors
  }
}

async function safeSendPaymentSuccessEmail(order) {
  try {
    const users = await query(`SELECT email, full_name FROM users WHERE id = ? LIMIT 1`, [order.user_id]);
    const customer = users?.[0];
    if (!customer?.email) return;

    const { buildPaymentResultEmail } = require("../../templates/email-payment-result");
    const { sendEmailAsync } = require("../../services/email.service");
    const { subject, html } = buildPaymentResultEmail({
      customerName: customer.full_name || customer.email,
      customerEmail: customer.email,
      orderId: order.id,
      approved: true,
      finalAmount: Number(order.final_amount || order.total_amount || 0),
      reviewedAt: new Date()
    });
    sendEmailAsync({ to: customer.email, subject, html });
  } catch (err) {
    console.warn("[SePay Email Error]", err?.message || err);
  }
}

/**
 * Shared atomic, row-locked, deduplicated SePay transaction reconciler.
 * Used by BOTH Push Webhook (POST /api/payments/sepay/webhook) and Pull Sync API (syncPendingSepayOrders).
 */
async function reconcileIncomingSepayTransaction(rawPayload, options = {}) {
  const source = options.source || "WEBHOOK";
  const recordUnmatchedAudit = options.recordUnmatchedAudit !== false;
  const payload = normalizeSepayApiTransaction(rawPayload);

  if (!payload) {
    return { success: true, ignored: true, reason: "invalid_payload" };
  }

  const { id: sepayId, gateway, transferType, transferAmount, referenceCode, transactionDate } = payload;
  const incomingAccount = normalizeAccountDigits(payload.accountNumber);

  // 1. Ignore outgoing transfers
  if (transferType !== "in" || transferAmount <= 0) {
    return {
      success: true,
      ignored: true,
      reason: "outgoing_transfer"
    };
  }

  // 2. Verify bank account matches configured receiving account if SEPAY_ACCOUNT_NUMBER is set
  const activeEnv = getActiveEnv();
  const configuredAccount = normalizeAccountDigits(activeEnv.sepayAccountNumber || process.env.SEPAY_ACCOUNT_NUMBER);
  if (configuredAccount && incomingAccount && configuredAccount !== incomingAccount) {
    return {
      success: true,
      ignored: true,
      reason: "account_mismatch"
    };
  }

  // 3. Deduplicate by referenceCode or sepayId
  const txnCode = referenceCode || (sepayId ? `SEPAY-${sepayId}` : `SEPAY-${Date.now()}`);
  const sepayTag = sepayId ? `[sepay_id:${sepayId}]` : "";

  if (referenceCode || sepayId) {
    const dupRows = await query(
      `
        SELECT id, order_id, status
        FROM payments
        WHERE status = 'PAID'
          AND (transaction_code = ? ${sepayTag ? "OR note LIKE ?" : ""})
        LIMIT 1
      `,
      sepayTag ? [txnCode, `%${sepayTag}%`] : [txnCode]
    ).catch(() => []);

    if (dupRows && dupRows.length > 0) {
      return {
        success: true,
        duplicate: true,
        orderId: dupRows[0].order_id,
        transactionCode: txnCode
      };
    }
  }

  // 4. Extract orderId from code / content / description
  const orderId = extractOrderIdFromPayload(payload);
  if (!orderId) {
    if (recordUnmatchedAudit) {
      recordAuditLog({
        actorRole: "SYSTEM",
        action: "SEPAY_WEBHOOK_UNMATCHED",
        entityType: "PAYMENT",
        entityId: sepayId || txnCode,
        description: `Nhận chuyển khoản SePay (${source}) không chứa mã đơn hàng hợp lệ (${transferAmount.toLocaleString("vi-VN")}đ).`,
        metadata: {
          source,
          sepayId,
          gateway,
          transferAmount,
          referenceCode,
          code: payload.code || null,
          content: payload.content || null
        }
      }).catch(() => {});
    }

    return {
      success: true,
      matched: false,
      reason: "order_code_not_found"
    };
  }

  const pool = getDbPool();
  const connection = await pool.getConnection();

  let lockedOrder = null;
  let outcome = null;

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.execute(
      `
        SELECT id, user_id, status, payment_method, payment_status, total_amount, final_amount
        FROM orders
        WHERE id = ?
        FOR UPDATE
      `,
      [orderId]
    );

    lockedOrder = orderRows?.[0] || null;
    if (!lockedOrder) {
      await connection.rollback();
      if (recordUnmatchedAudit) {
        recordAuditLog({
          actorRole: "SYSTEM",
          action: "SEPAY_WEBHOOK_ORDER_NOT_FOUND",
          entityType: "ORDER",
          entityId: orderId,
          description: `Giao dịch SePay (${source}) khớp mã đơn #${orderId} nhưng đơn hàng không tồn tại.`,
          metadata: { source, sepayId, gateway, transferAmount, referenceCode }
        }).catch(() => {});
      }

      return {
        success: true,
        matched: false,
        reason: "order_not_found",
        orderId
      };
    }

    const currentOrderStatus = String(lockedOrder.status || "").toUpperCase();
    const currentPaymentStatus = String(lockedOrder.payment_status || "").toUpperCase();
    const expectedAmount = Math.round(Number(lockedOrder.final_amount ?? lockedOrder.total_amount ?? 0));

    if (currentPaymentStatus === "PAID") {
      await connection.commit();
      return {
        success: true,
        matched: true,
        alreadyPaid: true,
        orderId: lockedOrder.id
      };
    }

    if (currentOrderStatus === "CANCELED" || currentPaymentStatus === "EXPIRED") {
      await connection.commit();
      if (recordUnmatchedAudit) {
        recordAuditLog({
          actorRole: "SYSTEM",
          action: "SEPAY_WEBHOOK_CANCELED_ORDER",
          entityType: "ORDER",
          entityId: lockedOrder.id,
          description: `Nhận chuyển khoản SePay (${source}) ${transferAmount.toLocaleString("vi-VN")}đ cho đơn #${lockedOrder.id} đã hủy/hết hạn. Cần kiểm tra hoàn tiền.`,
          metadata: { source, sepayId, gateway, transferAmount, expectedAmount, referenceCode, transactionDate }
        }).catch(() => {});
      }

      return {
        success: true,
        matched: true,
        warning: "order_already_canceled",
        orderId: lockedOrder.id
      };
    }

    if (transferAmount < expectedAmount) {
      const shortfall = expectedAmount - transferAmount;
      const underpaidNote = `SePay nhận thiếu tiền: ${transferAmount.toLocaleString("vi-VN")}đ / ${expectedAmount.toLocaleString("vi-VN")}đ (thiếu ${shortfall.toLocaleString("vi-VN")}đ) ${sepayTag}`.trim();

      const [existingPayments] = await connection.execute(
        `SELECT id, note FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
        [lockedOrder.id]
      );
      const alreadyRecordedThisUnderpay = Boolean(
        sepayTag && existingPayments?.[0]?.note && String(existingPayments[0].note).includes(sepayTag)
      );

      if (!alreadyRecordedThisUnderpay) {
        if (existingPayments && existingPayments.length > 0) {
          await connection.execute(
            `UPDATE payments SET provider = 'SEPAY_VIETQR', note = ?, updated_at = NOW() WHERE id = ?`,
            [underpaidNote, existingPayments[0].id]
          );
        } else {
          await connection.execute(
            `
              INSERT INTO payments (order_id, user_id, provider, payment_method, amount, status, note, created_at, updated_at)
              VALUES (?, ?, 'SEPAY_VIETQR', 'BANK_TRANSFER', ?, 'PENDING_GATEWAY', ?, NOW(), NOW())
            `,
            [lockedOrder.id, lockedOrder.user_id || null, expectedAmount, underpaidNote]
          );
        }
      }

      await connection.commit();
      outcome = { type: "UNDERPAID", shortfall, expectedAmount, alreadyRecordedThisUnderpay };
    } else {
      const verifiedNote = `SePay tự động xác nhận (${source === "POLLING_API" ? "API Sync" : "Webhook"}) qua ${gateway}${transactionDate ? ` lúc ${transactionDate}` : ""} ${sepayTag}`.trim();

      await connection.execute(
        `
          UPDATE orders
          SET payment_status = 'PAID',
              status = 'PROCESSING',
              updated_at = NOW()
          WHERE id = ?
        `,
        [lockedOrder.id]
      );

      const [existingPayments] = await connection.execute(
        `SELECT id FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
        [lockedOrder.id]
      );

      if (existingPayments && existingPayments.length > 0) {
        await connection.execute(
          `
            UPDATE payments
            SET provider = 'SEPAY_VIETQR',
                payment_method = 'BANK_TRANSFER',
                status = 'PAID',
                transaction_code = ?,
                note = ?,
                updated_at = NOW()
            WHERE id = ?
          `,
          [txnCode, verifiedNote, existingPayments[0].id]
        );
      } else {
        await connection.execute(
          `
            INSERT INTO payments (order_id, user_id, provider, payment_method, amount, status, transaction_code, note, created_at, updated_at)
            VALUES (?, ?, 'SEPAY_VIETQR', 'BANK_TRANSFER', ?, 'PAID', ?, ?, NOW(), NOW())
          `,
          [lockedOrder.id, lockedOrder.user_id || null, expectedAmount, txnCode, verifiedNote]
        );
      }

      await connection.commit();
      outcome = { type: "PAID", expectedAmount };
    }
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  if (outcome?.type === "UNDERPAID") {
    if (!outcome.alreadyRecordedThisUnderpay) {
      recordAuditLog({
        actorRole: "SYSTEM",
        action: "SEPAY_PAYMENT_UNDERPAID",
        entityType: "ORDER",
        entityId: lockedOrder.id,
        description: `SePay (${source}) nhận thiếu tiền cho đơn #${lockedOrder.id}: nhận ${transferAmount.toLocaleString("vi-VN")}đ / cần ${outcome.expectedAmount.toLocaleString("vi-VN")}đ.`,
        metadata: { source, sepayId, gateway, transferAmount, expectedAmount: outcome.expectedAmount, shortfall: outcome.shortfall, referenceCode }
      }).catch(() => {});

      if (lockedOrder.user_id) {
        safeNotifyUser({
          userId: lockedOrder.user_id,
          orderId: lockedOrder.id,
          customTitle: `Thanh toán chưa đủ số tiền #${lockedOrder.id}`,
          customMessage: `Hệ thống nhận được ${transferAmount.toLocaleString("vi-VN")}đ nhưng đơn hàng #${lockedOrder.id} cần ${outcome.expectedAmount.toLocaleString("vi-VN")}đ (còn thiếu ${outcome.shortfall.toLocaleString("vi-VN")}đ). Vui lòng liên hệ hỗ trợ PC Mall.`
        });
      }
    }

    return {
      success: true,
      matched: true,
      underpaid: true,
      orderId: lockedOrder.id,
      paidAmount: transferAmount,
      expectedAmount: outcome.expectedAmount
    };
  }

  recordAuditLog({
    actorRole: "SYSTEM",
    action: "SEPAY_PAYMENT_AUTO_APPROVED",
    entityType: "ORDER",
    entityId: lockedOrder.id,
    description: `SePay (${source}) tự động duyệt thanh toán cho đơn #${lockedOrder.id} (${transferAmount.toLocaleString("vi-VN")}đ qua ${gateway}, mã GD: ${txnCode}).`,
    metadata: {
      source,
      sepayId,
      gateway,
      transferAmount,
      expectedAmount: outcome.expectedAmount,
      referenceCode,
      transactionCode: txnCode,
      transactionDate
    }
  }).catch(() => {});

  if (lockedOrder.user_id) {
    const realtimeEvent = {
      orderId: lockedOrder.id,
      status: "PROCESSING",
      paymentStatus: "PAID",
      provider: "SEPAY_VIETQR",
      transactionCode: txnCode
    };
    publishOrderEvent(lockedOrder.user_id, realtimeEvent);
    safeEmitSocketPaymentUpdate(lockedOrder.user_id, realtimeEvent);
    safeNotifyUser({
      userId: Number(lockedOrder.user_id),
      orderId: lockedOrder.id,
      status: "PROCESSING",
      paymentMethod: "BANK_TRANSFER",
      paymentStatus: "PAID"
    });
    safeSendPaymentSuccessEmail(lockedOrder).catch(() => {});
  }

  return {
    success: true,
    matched: true,
    orderId: lockedOrder.id,
    status: "PROCESSING",
    paymentStatus: "PAID",
    transactionCode: txnCode
  };
}

function getConfiguredSepayApiToken() {
  const activeEnv = getActiveEnv();
  const token = String(activeEnv.sepayApiToken || process.env.SEPAY_API_TOKEN || "").trim();
  if (!token || token.toLowerCase().startsWith("your_")) {
    return "";
  }
  return token;
}

/**
 * Pull Reconciliation Sync:
 * Actively polls SePay User API (v1/v2) ONLY when SEPAY_API_TOKEN is configured AND
 * there is at least 1 unpaid PENDING BANK_TRANSFER order.
 * Eliminates dependency on ngrok/cloudflared tunnels during local dev & thesis defense!
 */
async function syncPendingSepayOrders(options = {}) {
  const token = getConfiguredSepayApiToken();
  if (!token) {
    return { skipped: true, reason: "missing_api_token", processed: 0, approvedOrderIds: [] };
  }

  const now = Date.now();
  const force = Boolean(options.force);
  if (!force && (isSyncingSepay || now - lastSyncTimestampMs < MIN_POLL_SYNC_COOLDOWN_MS)) {
    return { skipped: true, reason: "cooldown_or_busy", processed: 0, approvedOrderIds: [] };
  }

  // Only query SePay API when at least 1 unpaid BANK_TRANSFER order exists
  const pendingRows = await query(
    `
      SELECT id
      FROM orders
      WHERE status = 'PENDING'
        AND payment_method = 'BANK_TRANSFER'
        AND payment_status IN ('PENDING_GATEWAY', 'UNPAID')
      LIMIT 1
    `
  ).catch(() => []);

  if (!pendingRows || pendingRows.length === 0) {
    return { skipped: true, reason: "no_pending_orders", processed: 0, approvedOrderIds: [] };
  }

  isSyncingSepay = true;
  lastSyncTimestampMs = now;

  try {
    const activeEnv = getActiveEnv();
    const apiUrl = String(
      options.apiUrl || activeEnv.sepayApiUrl || process.env.SEPAY_API_URL || "https://my.sepay.vn/userapi/transactions/list"
    ).trim();
    const accountNumber = String(activeEnv.sepayAccountNumber || process.env.SEPAY_ACCOUNT_NUMBER || "").trim();
    const limit = Number(options.limit || 20);

    const isV2 = apiUrl.includes("/v2/");
    const params = isV2
      ? { transfer_type: "in", per_page: limit }
      : { ...(accountNumber ? { account_number: accountNumber } : {}), limit };

    const fetcher = options.fetcher || axios.get;
    const response = await fetcher(apiUrl, {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      },
      timeout: 8000
    });

    const data = response?.data || {};
    const transactions = Array.isArray(data.transactions)
      ? data.transactions
      : Array.isArray(data.data)
        ? data.data
        : [];

    const approvedOrderIds = [];
    for (const tx of transactions) {
      const result = await reconcileIncomingSepayTransaction(tx, {
        source: "POLLING_API",
        recordUnmatchedAudit: false
      });
      if (result?.status === "PROCESSING" && result?.paymentStatus === "PAID" && result?.orderId) {
        approvedOrderIds.push(result.orderId);
      }
    }

    if (approvedOrderIds.length > 0) {
      console.log(
        `[SePaySync] Auto-approved ${approvedOrderIds.length} order(s) via SePay API pull sync: #${approvedOrderIds.join(", #")}`
      );
    }

    return {
      skipped: false,
      fetchedCount: transactions.length,
      approvedOrderIds
    };
  } catch (err) {
    const statusCode = err?.response?.status;
    console.warn(`[SePaySync] Pull sync failed${statusCode ? ` (HTTP ${statusCode})` : ""}:`, err?.message || err);
    return { skipped: false, error: err?.message || "sync_failed", approvedOrderIds: [] };
  } finally {
    isSyncingSepay = false;
  }
}

/**
 * GET /api/payments/sepay/order/:orderId
 * Triggers an on-demand rate-limited SePay API pull check if the order is still unpaid,
 * then returns QR details and up-to-date status.
 */
async function getSepayOrderPaymentInfo(actor, orderId) {
  const parsedOrderId = toPositiveInteger(orderId, "orderId");

  // Pre-check ownership & trigger on-demand pull sync if order is still waiting payment
  const preRows = await query(
    `SELECT id, user_id, status, payment_method, payment_status FROM orders WHERE id = ? LIMIT 1`,
    [parsedOrderId]
  );
  const preOrder = preRows?.[0];
  if (!preOrder) {
    throw createError("Order not found", 404);
  }

  const actorRole = String(actor?.role || "").trim().toUpperCase();
  const actorUserId = Number(actor?.id ?? actor?.userId ?? 0);
  const isStaffOrAdmin = ["ADMIN", "SALES_STAFF", "SALES"].includes(actorRole);
  if (!isStaffOrAdmin && Number(preOrder.user_id) !== actorUserId) {
    throw createError("Forbidden: you can only view payment details for your own orders", 403);
  }

  if (
    String(preOrder.status || "").toUpperCase() === "PENDING" &&
    String(preOrder.payment_method || "").toUpperCase() === "BANK_TRANSFER" &&
    String(preOrder.payment_status || "").toUpperCase() !== "PAID"
  ) {
    await syncPendingSepayOrders().catch(() => {});
  }

  const rows = await query(
    `
      SELECT
        id,
        user_id,
        status,
        payment_method,
        payment_status,
        total_amount,
        final_amount,
        created_at,
        updated_at
      FROM orders
      WHERE id = ?
      LIMIT 1
    `,
    [parsedOrderId]
  );

  const order = rows?.[0];
  const paymentRows = await query(
    `
      SELECT id, provider, status, transaction_code, note, updated_at
      FROM payments
      WHERE order_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [parsedOrderId]
  ).catch(() => []);
  const latestPayment = paymentRows?.[0] || null;

  const activeEnv = getActiveEnv();
  const storeInfo = await getPublicStoreInfo();
  const bankName = storeInfo.bankName || "Sacombank";
  const bankCode = resolveBankCode(bankName);
  const accountNumber = storeInfo.bankAccountNumber || "";
  const accountHolder = storeInfo.bankAccountHolder || "";
  const amount = Math.round(Number(order.final_amount ?? order.total_amount ?? 0));
  const transferContent = buildOrderTransferCode(order.id);
  const timeoutMinutes = Number(activeEnv.paymentTimeoutMinutes || process.env.PAYMENT_TIMEOUT_MINUTES || 30);
  const createdAtDate = order.created_at ? new Date(order.created_at) : new Date();
  const expiresAtDate = new Date(createdAtDate.getTime() + timeoutMinutes * 60 * 1000);
  const expectedWebhookKey = String(activeEnv.sepayWebhookApiKey || process.env.SEPAY_WEBHOOK_API_KEY || "").trim();

  return {
    orderId: order.id,
    orderStatus: order.status,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    amount,
    transferContent,
    transferPrefix: getTransferPrefix(),
    bankCode,
    bankName,
    accountNumber,
    accountHolder,
    qrUrl: buildSePayQrUrl({ bankCode, accountNumber, amount, memo: transferContent }),
    fallbackQrUrl: buildFallbackVietQrUrl({ bankCode, accountNumber, accountHolder, amount, memo: transferContent }),
    transactionCode: latestPayment?.transaction_code || null,
    paymentNote: latestPayment?.note || null,
    provider: latestPayment?.provider || "SEPAY_VIETQR",
    createdAt: createdAtDate.toISOString(),
    expiresAt: expiresAtDate.toISOString(),
    timeoutMinutes,
    webhookConfigured: Boolean(expectedWebhookKey && !expectedWebhookKey.toLowerCase().startsWith("your_")),
    apiSyncConfigured: Boolean(getConfiguredSepayApiToken())
  };
}

/**
 * POST /api/payments/sepay/webhook
 */
async function processSepayWebhook(req) {
  verifySepayWebhookAuth(req);
  return reconcileIncomingSepayTransaction(req.body || {}, {
    source: "WEBHOOK",
    recordUnmatchedAudit: true
  });
}

function resetSepaySyncCooldownForTest() {
  lastSyncTimestampMs = 0;
  isSyncingSepay = false;
}

module.exports = {
  resolveBankCode,
  getTransferPrefix,
  buildOrderTransferCode,
  buildSePayQrUrl,
  buildFallbackVietQrUrl,
  extractOrderIdFromPayload,
  normalizeSepayApiTransaction,
  verifySepayWebhookAuth,
  reconcileIncomingSepayTransaction,
  syncPendingSepayOrders,
  getSepayOrderPaymentInfo,
  processSepayWebhook,
  resetSepaySyncCooldownForTest
};
