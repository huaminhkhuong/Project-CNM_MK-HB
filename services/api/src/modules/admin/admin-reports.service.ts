import { query  } from "../../config/database";

const ORDER_STATUSES = new Set(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELED"]);
const PAYMENT_METHODS = new Set(["COD", "VNPAY", "BANK_TRANSFER"]);
const PAID_STATUSES = ["PAID", "CAPTURED"];

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeFilters(filters: any = {}) {
  const now = new Date();
  const month = Math.min(12, Math.max(1, toInt(filters.month, now.getMonth() + 1)));
  const year = Math.min(2100, Math.max(2000, toInt(filters.year, now.getFullYear())));
  const status = String(filters.status || "ALL").toUpperCase();
  const paymentMethod = String(filters.paymentMethod || "ALL").toUpperCase();
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  return {
    month,
    year,
    status: ORDER_STATUSES.has(status) ? status : "ALL",
    paymentMethod: PAYMENT_METHODS.has(paymentMethod) ? paymentMethod : "ALL",
    from: formatDate(startDate),
    to: formatDate(endDate),
    daysInMonth: new Date(year, month, 0).getDate()
  };
}

function buildOrderWhere(filters) {
  const clauses = ["o.created_at >= ?", "o.created_at < ?"];
  const params = [filters.from, filters.to];

  if (filters.status !== "ALL") {
    clauses.push("o.status = ?");
    params.push(filters.status);
  }

  if (filters.paymentMethod !== "ALL") {
    clauses.push("o.payment_method = ?");
    params.push(filters.paymentMethod);
  }

  return { sql: clauses.join(" AND "), params };
}

function buildPaidWhere(filters) {
  const base = buildOrderWhere(filters);
  const clauses = [
    base.sql,
    "o.status <> 'CANCELED'",
    `o.payment_status IN (${PAID_STATUSES.map(() => "?").join(", ")})`
  ];

  return {
    sql: clauses.join(" AND "),
    params: [...base.params, ...PAID_STATUSES]
  };
}

function buildDailyRows(filters, rows, itemRows = []) {
  const map = new Map(rows.map((row) => [row.reportDate, row]));
  const itemMap = new Map(itemRows.map((row) => [row.reportDate, row]));

  return Array.from({ length: filters.daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = `${filters.year}-${String(filters.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const row = map.get(date);

    return {
      date,
      label: String(day).padStart(2, "0"),
      revenue: toNumber((row as any)?.revenue),
      orderCount: toNumber((row as any)?.orderCount),
      itemCount: toNumber((itemMap.get(date) as any)?.itemCount)
    };
  });
}

async function getSalesReport(rawFilters = {}) {
  const filters = normalizeFilters(rawFilters);
  const orderWhere = buildOrderWhere(filters);
  const paidWhere = buildPaidWhere(filters);

  const [summaryRows, dailyRows, dailyItemRows, topProductRows, statusRows, itemRows] = await Promise.all([
    query(
      `
        SELECT
          COUNT(*) AS orderCount,
          SUM(CASE WHEN o.status <> 'CANCELED' THEN 1 ELSE 0 END) AS activeOrders,
          SUM(CASE WHEN o.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completedOrders,
          SUM(CASE WHEN o.payment_status IN (${PAID_STATUSES.map(() => "?").join(", ")}) AND o.status <> 'CANCELED'
            THEN 1 ELSE 0 END) AS paidOrders,
          SUM(CASE WHEN o.payment_status IN (${PAID_STATUSES.map(() => "?").join(", ")}) AND o.status <> 'CANCELED'
            THEN COALESCE(o.final_amount, o.total_amount, o.total_price, 0) ELSE 0 END) AS revenue
        FROM orders o
        WHERE ${orderWhere.sql}
      `,
      [...PAID_STATUSES, ...PAID_STATUSES, ...orderWhere.params]
    ),
    query(
      `
        SELECT
          DATE_FORMAT(o.created_at, '%Y-%m-%d') AS reportDate,
          COUNT(DISTINCT o.id) AS orderCount,
          SUM(CASE WHEN o.payment_status IN (${PAID_STATUSES.map(() => "?").join(", ")}) AND o.status <> 'CANCELED'
            THEN COALESCE(o.final_amount, o.total_amount, o.total_price, 0) ELSE 0 END) AS revenue
        FROM orders o
        WHERE ${orderWhere.sql}
        GROUP BY DATE_FORMAT(o.created_at, '%Y-%m-%d')
        ORDER BY reportDate ASC
      `,
      [...PAID_STATUSES, ...orderWhere.params]
    ),
    query(
      `
        SELECT
          DATE_FORMAT(o.created_at, '%Y-%m-%d') AS reportDate,
          COALESCE(SUM(oi.quantity), 0) AS itemCount
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        WHERE ${paidWhere.sql}
        GROUP BY DATE_FORMAT(o.created_at, '%Y-%m-%d')
        ORDER BY reportDate ASC
      `,
      paidWhere.params
    ),
    query(
      `
        SELECT
          COALESCE(oi.product_id, ps.product_id) AS productId,
          oi.product_variant_id AS skuId,
          COALESCE(oi.sku_snapshot, ps.sku, CONCAT('SKU-', oi.product_variant_id)) AS sku,
          COALESCE(oi.name_snapshot, p.name, oi.sku_snapshot, 'Sản phẩm') AS productName,
          SUM(oi.quantity) AS quantitySold,
          SUM(COALESCE(oi.line_total, oi.quantity * oi.unit_price, 0)) AS revenue
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        LEFT JOIN product_skus ps ON ps.id = oi.product_variant_id
        LEFT JOIN products p ON p.id = COALESCE(oi.product_id, ps.product_id)
        WHERE ${paidWhere.sql}
        GROUP BY
          COALESCE(oi.product_id, ps.product_id),
          oi.product_variant_id,
          COALESCE(oi.sku_snapshot, ps.sku, CONCAT('SKU-', oi.product_variant_id)),
          COALESCE(oi.name_snapshot, p.name, oi.sku_snapshot, 'Sản phẩm')
        ORDER BY quantitySold DESC, revenue DESC
        LIMIT 10
      `,
      paidWhere.params
    ),
    query(
      `
        SELECT COALESCE(o.status, 'UNKNOWN') AS status, COUNT(*) AS count
        FROM orders o
        WHERE ${orderWhere.sql}
        GROUP BY COALESCE(o.status, 'UNKNOWN')
        ORDER BY count DESC
      `,
      orderWhere.params
    ),
    query(
      `
        SELECT COALESCE(SUM(oi.quantity), 0) AS itemCount
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        WHERE ${paidWhere.sql}
      `,
      paidWhere.params
    )
  ]);

  const summary = summaryRows[0] || {};
  const paidOrders = toNumber(summary.paidOrders);
  const revenue = toNumber(summary.revenue);

  return {
    filters,
    summary: {
      revenue,
      orderCount: toNumber(summary.orderCount),
      itemCount: toNumber(itemRows[0]?.itemCount),
      paidOrders,
      completedOrders: toNumber(summary.completedOrders),
      activeOrders: toNumber(summary.activeOrders),
      averageOrderValue: paidOrders > 0 ? Math.round(revenue / paidOrders) : 0
    },
    dailyRows: buildDailyRows(filters, dailyRows, dailyItemRows),
    topProducts: topProductRows.map((item, index) => ({
      rank: index + 1,
      productId: item.productId,
      skuId: item.skuId,
      sku: item.sku,
      productName: item.productName,
      quantitySold: toNumber(item.quantitySold),
      revenue: toNumber(item.revenue)
    })),
    statusBreakdown: statusRows.map((item) => ({
      status: item.status,
      count: toNumber(item.count)
    }))
  };
}

export {
  getSalesReport
};
export default {
  getSalesReport
};
