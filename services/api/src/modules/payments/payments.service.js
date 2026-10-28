const { createError, toPositiveInteger } = require("../../utils/service-helpers");
const { query } = require("../../config/database");
const { getTableColumns, pickColumn } = require("../../utils/schema-helpers");
const { env } = require("../../config/env");

let schemaCache = null;

const PAYMENT_STATUSES = ["PENDING_GATEWAY", "PAID", "FAILED", "CANCELED"];
const ONLINE_METHODS = ["VNPAY", "BANK_TRANSFER", "ONLINE", "MOMO"];

function normalizePaymentStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();

  if (!PAYMENT_STATUSES.includes(normalized)) {
    throw createError(`Payment status must be one of: ${PAYMENT_STATUSES.join(", ")}`, 400);
  }

  return normalized;
}

function getBackendBaseUrl(reqOrBaseUrl = null) {
  if (typeof reqOrBaseUrl === "string" && reqOrBaseUrl.trim()) {
    return reqOrBaseUrl.trim().replace(/\/+$/, "");
  }

  if (reqOrBaseUrl && typeof reqOrBaseUrl.get === "function") {
    const proto = reqOrBaseUrl.get("x-forwarded-proto") || reqOrBaseUrl.protocol || "http";
    const host = reqOrBaseUrl.get("x-forwarded-host") || reqOrBaseUrl.get("host");
    if (host) {
      return `${proto}://${host}`.replace(/\/+$/, "");
    }
  }

  const backend = env.backendUrl || env.apiBaseUrl || process.env.BACKEND_URL || process.env.API_BASE_URL;
  if (backend) {
    return backend.trim().replace(/\/+$/, "");
  }

  const port = env.port || process.env.PORT || 4000;
  return `http://localhost:${port}`;
}

function getFrontendBaseUrl(reqOrBaseUrl = null) {
  if (typeof reqOrBaseUrl === "string" && reqOrBaseUrl.trim()) {
    return reqOrBaseUrl.trim().replace(/\/+$/, "");
  }

  if (reqOrBaseUrl && typeof reqOrBaseUrl.get === "function") {
    const origin = reqOrBaseUrl.get("origin") || reqOrBaseUrl.get("referer");
    if (origin) {
      try {
        const u = new URL(origin);
        return `${u.protocol}//${u.host}`.replace(/\/+$/, "");
      } catch {}
    }
  }

  const frontend = env.frontendUrl || process.env.FRONTEND_URL;
  if (frontend) {
    return frontend.trim().replace(/\/+$/, "");
  }

  return "http://localhost:5173";
}

function buildFrontendResultUrl(paymentId, reqOrBaseUrl = null) {
  const base = getFrontendBaseUrl(reqOrBaseUrl);
  return `${base}/payment/result?paymentId=${paymentId}`;
}

function buildApiCallbackUrl(paymentId, result, reqOrBaseUrl = null) {
  const base = getBackendBaseUrl(reqOrBaseUrl);
  return `${base}/api/payments/${paymentId}/callback?result=${result}`;
}

async function getSchema() {
  if (schemaCache) {
    return schemaCache;
  }

  const [paymentColumns, orderColumns] = await Promise.all([
    getTableColumns("payments").catch(() => []),
    getTableColumns("orders")
  ]);

  if (paymentColumns.length === 0) {
    throw createError("Payments table is not available. Please import phase8_payments_migration.sql", 500);
  }

  const schema = {
    payments: {
      table: "payments",
      id: pickColumn(paymentColumns, ["id"]),
      orderId: pickColumn(paymentColumns, ["order_id"]),
      userId: pickColumn(paymentColumns, ["user_id"], null),
      provider: pickColumn(paymentColumns, ["provider"], null),
      paymentMethod: pickColumn(paymentColumns, ["payment_method"], null),
      amount: pickColumn(paymentColumns, ["amount"]),
      status: pickColumn(paymentColumns, ["status"]),
      transactionCode: pickColumn(paymentColumns, ["transaction_code"], null),
      redirectUrl: pickColumn(paymentColumns, ["redirect_url"], null),
      note: pickColumn(paymentColumns, ["note"], null),
      proofImageUrl: pickColumn(paymentColumns, ["proof_image_url"], null),
      createdAt: pickColumn(paymentColumns, ["created_at"], null),
      updatedAt: pickColumn(paymentColumns, ["updated_at"], null)
    },
    orders: {
      table: "orders",
      id: pickColumn(orderColumns, ["id"]),
      userId: pickColumn(orderColumns, ["user_id"]),
      paymentMethod: pickColumn(orderColumns, ["payment_method"], null),
      paymentStatus: pickColumn(orderColumns, ["payment_status"], null),
      finalAmount: pickColumn(orderColumns, ["final_amount", "total_amount"]),
      status: pickColumn(orderColumns, ["status"], null),
      updatedAt: pickColumn(orderColumns, ["updated_at"], null)
    }
  };

  if (!schema.payments.id || !schema.payments.orderId || !schema.payments.amount || !schema.payments.status) {
    throw createError("Payments table does not have required columns", 500);
  }

  if (!schema.orders.id || !schema.orders.userId || !schema.orders.finalAmount) {
    throw createError("Orders table does not have required columns", 500);
  }

  schemaCache = schema;
  return schema;
}

function mapPayment(row, reqOrBaseUrl = null) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    orderId: row.orderId,
    userId: row.userId,
    provider: row.provider || "VNPAY_SANDBOX_MOCK",
    paymentMethod: row.paymentMethod || "VNPAY",
    amount: Number(row.amount || 0),
    status: row.status,
    transactionCode: row.transactionCode || null,
    redirectUrl: row.redirectUrl || buildFrontendResultUrl(row.id, reqOrBaseUrl),
    note: row.note || null,
    proofImageUrl: row.proofImageUrl || row.proof_image_url || null,
    proof_image_url: row.proofImageUrl || row.proof_image_url || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    paymentUrl: buildFrontendResultUrl(row.id, reqOrBaseUrl),
    callbackSuccessUrl: buildApiCallbackUrl(row.id, "PAID", reqOrBaseUrl),
    callbackFailedUrl: buildApiCallbackUrl(row.id, "FAILED", reqOrBaseUrl)
  };
}

async function getOrderById(orderId) {
  const schema = await getSchema();
  const rows = await query(
    `
      SELECT
        o.${schema.orders.id} AS id,
        o.${schema.orders.userId} AS userId,
        ${schema.orders.paymentMethod ? `o.${schema.orders.paymentMethod}` : "NULL"} AS paymentMethod,
        ${schema.orders.paymentStatus ? `o.${schema.orders.paymentStatus}` : "NULL"} AS paymentStatus,
        o.${schema.orders.finalAmount} AS amount,
        ${schema.orders.status ? `o.${schema.orders.status}` : "NULL"} AS status
      FROM ${schema.orders.table} o
      WHERE o.${schema.orders.id} = ?
      LIMIT 1
    `,
    [orderId]
  );

  return rows[0] || null;
}

async function getPaymentRowById(paymentId) {
  const schema = await getSchema();
  const rows = await query(
    `
      SELECT
        p.${schema.payments.id} AS id,
        p.${schema.payments.orderId} AS orderId,
        ${schema.payments.userId ? `p.${schema.payments.userId}` : "NULL"} AS userId,
        ${schema.payments.provider ? `p.${schema.payments.provider}` : "NULL"} AS provider,
        ${schema.payments.paymentMethod ? `p.${schema.payments.paymentMethod}` : "NULL"} AS paymentMethod,
        p.${schema.payments.amount} AS amount,
        p.${schema.payments.status} AS status,
        ${schema.payments.transactionCode ? `p.${schema.payments.transactionCode}` : "NULL"} AS transactionCode,
        ${schema.payments.redirectUrl ? `p.${schema.payments.redirectUrl}` : "NULL"} AS redirectUrl,
        ${schema.payments.note ? `p.${schema.payments.note}` : "NULL"} AS note,
        ${schema.payments.proofImageUrl ? `p.${schema.payments.proofImageUrl}` : "NULL"} AS proofImageUrl,
        ${schema.payments.createdAt ? `p.${schema.payments.createdAt}` : "NULL"} AS createdAt,
        ${schema.payments.updatedAt ? `p.${schema.payments.updatedAt}` : "NULL"} AS updatedAt
      FROM ${schema.payments.table} p
      WHERE p.${schema.payments.id} = ?
      LIMIT 1
    `,
    [paymentId]
  );

  return rows[0] || null;
}

async function getPaymentRowByOrderId(orderId) {
  const schema = await getSchema();
  const rows = await query(
    `
      SELECT
        p.${schema.payments.id} AS id,
        p.${schema.payments.orderId} AS orderId,
        ${schema.payments.userId ? `p.${schema.payments.userId}` : "NULL"} AS userId,
        ${schema.payments.provider ? `p.${schema.payments.provider}` : "NULL"} AS provider,
        ${schema.payments.paymentMethod ? `p.${schema.payments.paymentMethod}` : "NULL"} AS paymentMethod,
        p.${schema.payments.amount} AS amount,
        p.${schema.payments.status} AS status,
        ${schema.payments.transactionCode ? `p.${schema.payments.transactionCode}` : "NULL"} AS transactionCode,
        ${schema.payments.redirectUrl ? `p.${schema.payments.redirectUrl}` : "NULL"} AS redirectUrl,
        ${schema.payments.note ? `p.${schema.payments.note}` : "NULL"} AS note,
        ${schema.payments.proofImageUrl ? `p.${schema.payments.proofImageUrl}` : "NULL"} AS proofImageUrl,
        ${schema.payments.createdAt ? `p.${schema.payments.createdAt}` : "NULL"} AS createdAt,
        ${schema.payments.updatedAt ? `p.${schema.payments.updatedAt}` : "NULL"} AS updatedAt
      FROM ${schema.payments.table} p
      WHERE p.${schema.payments.orderId} = ?
      ORDER BY p.${schema.payments.id} DESC
      LIMIT 1
    `,
    [orderId]
  );

  return rows[0] || null;
}

async function syncOrderPayment(orderId, paymentStatus) {
  const schema = await getSchema();

  if (!schema.orders.paymentStatus) {
    return;
  }

  const updates = [`${schema.orders.paymentStatus} = ?`];
  const params = [paymentStatus];

  if (schema.orders.updatedAt) {
    updates.push(`${schema.orders.updatedAt} = NOW()`);
  }

  params.push(orderId);
  await query(`UPDATE ${schema.orders.table} SET ${updates.join(", ")} WHERE ${schema.orders.id} = ?`, params);
}

async function createPayment(userId, payload = {}, reqOrBaseUrl = null) {
  const schema = await getSchema();
  const orderId = toPositiveInteger(payload.orderId || payload.order_id, "orderId");
  const order = await getOrderById(orderId);

  if (!order) {
    throw createError("Order not found", 404);
  }

  if (Number(order.userId) !== Number(userId)) {
    throw createError("Forbidden: you do not have permission to create payment for this order", 403);
  }

  const method = String(payload.paymentMethod || order.paymentMethod || "VNPAY").trim().toUpperCase();

  if (!ONLINE_METHODS.includes(method)) {
    throw createError("This order is not configured for online payment", 400);
  }

  const existingPayment = await getPaymentRowByOrderId(orderId);
  if (existingPayment && existingPayment.status === "PAID") {
    return mapPayment(existingPayment, reqOrBaseUrl);
  }

  if (existingPayment) {
    const updates = [`${schema.payments.status} = ?`];
    const params = ["PENDING_GATEWAY"];

    if (schema.payments.redirectUrl) {
      updates.push(`${schema.payments.redirectUrl} = ?`);
      params.push(buildFrontendResultUrl(existingPayment.id, reqOrBaseUrl));
    }

    if (schema.payments.updatedAt) {
      updates.push(`${schema.payments.updatedAt} = NOW()`);
    }

    params.push(existingPayment.id);
    await query(`UPDATE ${schema.payments.table} SET ${updates.join(", ")} WHERE ${schema.payments.id} = ?`, params);
    await syncOrderPayment(orderId, "PENDING_GATEWAY");
    const refreshed = await getPaymentRowById(existingPayment.id);
    return mapPayment(refreshed, reqOrBaseUrl);
  }

  const fields = [schema.payments.orderId, schema.payments.amount, schema.payments.status];
  const values = ["?", "?", "?"];
  const params = [orderId, Number(order.amount || 0), "PENDING_GATEWAY"];

  if (schema.payments.userId) {
    fields.push(schema.payments.userId);
    values.push("?");
    params.push(userId);
  }

  if (schema.payments.provider) {
    fields.push(schema.payments.provider);
    values.push("?");
    params.push(method === "MOMO" ? "MOMO_SANDBOX_MOCK" : "VNPAY_SANDBOX_MOCK");
  }

  if (schema.payments.paymentMethod) {
    fields.push(schema.payments.paymentMethod);
    values.push("?");
    params.push(method);
  }

  if (schema.payments.redirectUrl) {
    fields.push(schema.payments.redirectUrl);
    values.push("?");
    params.push("");
  }

  if (schema.payments.note) {
    fields.push(schema.payments.note);
    values.push("?");
    params.push(payload.note || "Created via sandbox gateway");
  }

  if (schema.payments.createdAt) {
    fields.push(schema.payments.createdAt);
    values.push("NOW()");
  }

  if (schema.payments.updatedAt) {
    fields.push(schema.payments.updatedAt);
    values.push("NOW()");
  }

  const result = await query(`INSERT INTO ${schema.payments.table} (${fields.join(", ")}) VALUES (${values.join(", ")})`, params);
  const paymentId = result.insertId;

  if (schema.payments.redirectUrl) {
    await query(`UPDATE ${schema.payments.table} SET ${schema.payments.redirectUrl} = ?${schema.payments.updatedAt ? `, ${schema.payments.updatedAt} = NOW()` : ""} WHERE ${schema.payments.id} = ?`, [buildFrontendResultUrl(paymentId, reqOrBaseUrl), paymentId]);
  }

  await syncOrderPayment(orderId, "PENDING_GATEWAY");
  const created = await getPaymentRowById(paymentId);
  return mapPayment(created, reqOrBaseUrl);
}

async function getPaymentStatus(userId, paymentId, reqOrBaseUrl = null) {
  const parsedPaymentId = toPositiveInteger(paymentId, "paymentId");
  const payment = await getPaymentRowById(parsedPaymentId);

  if (!payment) {
    throw createError("Payment not found", 404);
  }

  if (payment.userId && Number(payment.userId) !== Number(userId)) {
    throw createError("Forbidden: you do not have permission to view this payment", 403);
  }

  return mapPayment(payment, reqOrBaseUrl);
}

async function confirmPayment(userId, paymentId, payload = {}, reqOrBaseUrl = null) {
  const parsedPaymentId = toPositiveInteger(paymentId, "paymentId");
  const payment = await getPaymentRowById(parsedPaymentId);

  if (!payment) {
    throw createError("Payment not found", 404);
  }

  if (payment.userId && Number(payment.userId) !== Number(userId)) {
    throw createError("Forbidden: you do not have permission to confirm this payment", 403);
  }

  return confirmPaymentByGateway(parsedPaymentId, payload.status || payload.result || "PAID", payload.note || null, reqOrBaseUrl);
}

async function confirmPaymentByGateway(paymentId, status, note = null, reqOrBaseUrl = null) {
  const schema = await getSchema();
  const parsedPaymentId = toPositiveInteger(paymentId, "paymentId");
  const payment = await getPaymentRowById(parsedPaymentId);

  if (!payment) {
    throw createError("Payment not found", 404);
  }

  const nextStatus = normalizePaymentStatus(status);
  const transactionCode = nextStatus === "PAID" ? `MOCKTXN-${payment.orderId}-${Date.now()}` : null;
  const updates = [`${schema.payments.status} = ?`];
  const params = [nextStatus];

  if (schema.payments.transactionCode) {
    updates.push(`${schema.payments.transactionCode} = ?`);
    params.push(transactionCode);
  }

  if (schema.payments.note) {
    updates.push(`${schema.payments.note} = ?`);
    params.push(note || payment.note || null);
  }

  if (schema.payments.updatedAt) {
    updates.push(`${schema.payments.updatedAt} = NOW()`);
  }

  params.push(parsedPaymentId);
  await query(`UPDATE ${schema.payments.table} SET ${updates.join(", ")} WHERE ${schema.payments.id} = ?`, params);
  await syncOrderPayment(payment.orderId, nextStatus);
  const refreshed = await getPaymentRowById(parsedPaymentId);
  return mapPayment(refreshed, reqOrBaseUrl);
}

async function uploadPaymentProof(orderOrPaymentId, file, reqOrBaseUrl = null) {
  if (!file) {
    throw createError("Vui lòng tải lên file ảnh biên lai thanh toán (JPG, PNG, GIF)", 400);
  }

  const proofUrl = `/uploads/payment-proofs/${file.filename}`;
  const id = toPositiveInteger(orderOrPaymentId, "orderId");
  const schema = await getSchema();

  // Determine whether id is orderId or paymentId
  let orderId = id;
  const orderRows = await query(`SELECT id FROM orders WHERE id = ? LIMIT 1`, [id]);
  if (!orderRows || orderRows.length === 0) {
    const paymentRows = await query(`SELECT order_id FROM ${schema.payments.table} WHERE id = ? LIMIT 1`, [id]);
    if (paymentRows && paymentRows.length > 0) {
      orderId = paymentRows[0].order_id;
    } else {
      throw createError(`Không tìm thấy đơn hàng hoặc thanh toán với mã #${id}`, 404);
    }
  }

  // Update payments table if record exists
  if (schema.payments.proofImageUrl) {
    await query(
      `UPDATE ${schema.payments.table} SET ${schema.payments.proofImageUrl} = ? WHERE ${schema.payments.orderId} = ? OR ${schema.payments.id} = ?`,
      [proofUrl, orderId, id]
    );
  }

  // Update orders table
  await query(
    `UPDATE orders SET payment_proof = ?, payment_status = 'AWAITING_ADMIN_CONFIRMATION' WHERE id = ?`,
    [proofUrl, orderId]
  );

  return {
    success: true,
    orderId,
    proof_image_url: proofUrl,
    proofImageUrl: proofUrl
  };
}

module.exports = {
  PAYMENT_STATUSES,
  createPayment,
  getPaymentStatus,
  confirmPayment,
  confirmPaymentByGateway,
  uploadPaymentProof,
  buildApiCallbackUrl,
  buildFrontendResultUrl,
  getBackendBaseUrl,
  getFrontendBaseUrl
};
