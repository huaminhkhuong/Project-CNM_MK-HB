/**
 * BuildExportService.js — Xuất PDF cấu hình PC đẹp có logo PC Mall
 *
 * Mở một cửa sổ in riêng với layout A4 chuẩn, không in toàn bộ trang web.
 * Sau khi render xong, tự động mở hộp thoại In / Lưu PDF.
 */

/* ── PRIVATE UTILITY FUNCTIONS ──────────────────────────────────── */
const _fmt  = (v) => Number(v || 0).toLocaleString("vi-VN");
const _name = (p) => p?.product_name || p?.name || "Đang cập nhật";
const _brand = (p) => p?.brand_name || p?.brand?.name || String(_name(p)).split(" ")[0] || "—";
const _price = (p) =>
  Number(
    p?.price ?? p?.pricing?.minPrice ?? p?.defaultVariant?.price ??
    p?.variants?.[0]?.price ?? p?.skus?.[0]?.price ?? 0
  );
const _product = (item) =>
  item?.product || item?.Product || item?.variant?.product || item || null;
const _itemPrice = (item) => {
  const unit = Number(item?.variant?.price || item?.price || _price(_product(item)) || 0);
  const qty = Math.max(1, Number(item?.quantity || 1));
  return unit * qty;
};

const SECTIONS = [
  { type: "cpu",       label: "CPU",              icon: "💻" },
  { type: "mainboard", label: "Mainboard",         icon: "🔌" },
  { type: "ram",       label: "RAM",               icon: "🧠" },
  { type: "gpu",       label: "GPU / VGA",         icon: "🎮" },
  { type: "storage",   label: "Ổ cứng chính (SSD)", icon: "💾" },
  { type: "storage_2", label: "Ổ phụ (SSD 2/HDD)",  icon: "💽" },
  { type: "psu",       label: "Nguồn (PSU)",       icon: "⚡" },
  { type: "case",      label: "Case / Vỏ máy",     icon: "📦" },
  { type: "cooling",   label: "Tản nhiệt",         icon: "❄️" },
];

const PURPOSE_VI = {
  gaming:    "Gaming / Chơi game",
  office:    "Văn phòng",
  editing:   "Dựng phim / Đồ hoạ",
  streaming: "Streaming / Livestream",
  ai:        "AI Workstation",
  default:   "Đa năng",
};

const RESOLUTION_VI = {
  "1080p": "Full HD 1080p",
  "2k":    "2K / 1440p",
  "4k":    "4K Ultra HD",
};

/* ── HTML TEMPLATE GENERATOR ─────────────────────────────────────── */
function generateBuildHtml({ buildName, selectedItems, totalPrice, insights, xaiReport, suggestionForm }) {
  const now       = new Date();
  const dateStr   = now.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr   = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const docNumber = `PCM-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}-${String(Math.floor(Math.random()*9000)+1000)}`;

  const si       = selectedItems || {};
  const budget   = Number(suggestionForm?.budget || 0);
  const purpose  = PURPOSE_VI[suggestionForm?.purpose] || "Đa năng";
  const resolution = RESOLUTION_VI[suggestionForm?.resolution] || "Full HD 1080p";
  const preference = suggestionForm?.preference === "performance" ? "Tối đa hiệu năng"
    : suggestionForm?.preference === "quiet"       ? "Yên lặng / Tản nhiệt tốt"
    : suggestionForm?.preference === "future"      ? "Dễ nâng cấp"
    : "Tối ưu giá / hiệu năng";

  const selectedCount = Object.values(si).filter(Boolean).length;
  const score     = xaiReport?.score ?? insights?.compatibilityScore ?? 100;
  const fps       = insights?.fps ?? 0;
  const power     = insights?.power ?? 0;
  const temp      = insights?.temp ?? 0;
  const readiness = insights?.buildReadiness ?? "READY";
  const recommendation = insights?.recommendation ?? xaiReport?.summary?.overallMessage ?? "";

  const readinessColor = readiness === "READY" ? "#059669"
    : readiness === "BLOCKED" ? "#dc2626" : "#d97706";
  const readinessText = readiness === "READY" ? "✅ BUILD READY"
    : readiness === "BLOCKED" ? "⛔ CÓ XỬ LÝ TRƯỚC" : "⚠️ CẦN KIỂM TRA";

  const scoreColor = score >= 80 ? "#059669" : score >= 50 ? "#d97706" : "#dc2626";

  /* ─ Component Rows ─ */
  const componentRows = SECTIONS.map((sec, idx) => {
    const item    = si[sec.type];
    const product = _product(item);
    const qty     = Math.max(1, Number(item?.quantity || 1));
    const qtyBadge = qty > 1 ? `<span style="display:inline-block;background:#dbeafe;color:#1d4ed8;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;margin-left:6px">x${qty} (Dual Channel)</span>` : "";
    const priceTd = product ? `<strong class="price-val">${_fmt(_itemPrice(item))}</strong><span class="price-unit">đ</span>` : `<span class="empty-dash">—</span>`;
    const nameTd  = product ? `<span class="product-name">${_name(product)}</span>${qtyBadge}` : `<span class="not-selected">Chưa chọn linh kiện</span>`;
    const brandTd = product ? `<span class="brand-tag">${_brand(product)}</span>` : "";
    const rowCls  = !product ? "row-empty" : idx % 2 === 0 ? "row-even" : "row-odd";

    return `
      <tr class="${rowCls}">
        <td class="td-num">${idx + 1}</td>
        <td class="td-icon">${sec.icon}</td>
        <td class="td-type">${sec.label}</td>
        <td class="td-name">${nameTd} ${brandTd}</td>
        <td class="td-price">${priceTd}</td>
      </tr>`;
  }).join("");

  /* ─ Compatibility Checks ─ */
  const checks = insights?.checks || [];
  const checksHtml = checks.map((c) => `
    <tr class="${c.ok ? "check-ok" : "check-fail"}">
      <td class="check-status">${c.ok ? "✅" : "⚠️"}</td>
      <td class="check-label">${(c.label || "").replace(/\s*\[COMP-\d+\]\s*/g, "")}</td>
      <td class="check-detail">${c.detail || ""}</td>
    </tr>`).join("");

  /* ─ 5-Score Grid ─ */
  const scores = xaiReport?.scores || insights?.scores || {};
  const scoreItems = [
    { label: "Tương thích",   val: scores.compatibilityScore   ?? score,  icon: "🔌" },
    { label: "Hiệu năng",     val: scores.performanceScore     ?? 85,     icon: "🚀" },
    { label: "Giá trị P/P",   val: scores.valueScore           ?? 88,     icon: "⭐" },
    { label: "Điện / Tản",    val: scores.powerThermalScore    ?? 90,     icon: "⚡" },
    { label: "Nâng cấp",      val: scores.upgradeScore         ?? 80,     icon: "🔮" },
    { label: "Đáp ứng nhu cầu", val: scores.requirementMatchScore ?? 85,  icon: "🎯" },
  ];
  const scoresHtml = scoreItems.map((s) => {
    const c = s.val >= 80 ? "#059669" : s.val >= 60 ? "#d97706" : "#dc2626";
    return `<div class="score-box">
      <div class="score-icon">${s.icon}</div>
      <div class="score-num" style="color:${c}">${s.val}<span class="score-sub">/100</span></div>
      <div class="score-label">${s.label}</div>
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Báo giá PC – ${buildName || "Cấu hình AI"} – PC Mall</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', 'Be Vietnam Pro', Arial, sans-serif;
      background: #f0f4f8;
      color: #1e293b;
      font-size: 13px;
      line-height: 1.5;
    }

    /* ── PRINT CONTROLS (not printed) ─────────────────────────── */
    .print-toolbar {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: #1e3a8a;
      color: #fff;
      padding: 10px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      z-index: 9999;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    }
    .print-toolbar-title { font-size: 14px; font-weight: 700; }
    .print-toolbar-hint  { font-size: 12px; opacity: 0.8; }
    .btn-print {
      background: #059669;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 8px 20px;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-print:hover { background: #047857; }
    .btn-close {
      background: rgba(255,255,255,0.15);
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }

    /* ── PAGE WRAPPER ──────────────────────────────────────────── */
    .page-wrap {
      max-width: 820px;
      margin: 68px auto 40px;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,0.12);
    }

    /* ── DOCUMENT HEADER ───────────────────────────────────────── */
    .doc-header {
      background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 60%, #2563eb 100%);
      padding: 28px 32px 24px;
      color: #fff;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
    }

    .brand-logo {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .brand-name {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: 0.06em;
      color: #fff;
      text-transform: uppercase;
      text-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .brand-name span { color: #60a5fa; }
    .brand-tagline {
      font-size: 10px;
      font-weight: 600;
      color: rgba(255,255,255,0.7);
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .brand-contact {
      font-size: 11px;
      color: rgba(255,255,255,0.8);
      margin-top: 8px;
      line-height: 1.6;
    }

    .doc-title-block {
      text-align: right;
    }
    .doc-title {
      font-size: 18px;
      font-weight: 900;
      color: #fff;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      text-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .doc-number {
      font-size: 11px;
      color: rgba(255,255,255,0.75);
      margin-top: 4px;
      font-weight: 600;
    }
    .doc-date {
      font-size: 12px;
      color: rgba(255,255,255,0.85);
      margin-top: 2px;
    }
    .readiness-pill {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 12px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 800;
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.3);
      color: #fff;
    }

    /* ── BUILD INFO BAR ─────────────────────────────────────────── */
    .build-info-bar {
      background: #f0f7ff;
      border-bottom: 2px solid #bfdbfe;
      padding: 14px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }
    .build-name-block { display: flex; align-items: center; gap: 10px; }
    .build-name-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
    .build-name-val   { font-size: 15px; font-weight: 900; color: #1e3a8a; }
    .build-meta { display: flex; gap: 16px; flex-wrap: wrap; }
    .build-meta-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11.5px;
      font-weight: 600;
      color: #475569;
    }
    .build-meta-item strong { color: #1e293b; }
    .count-badge {
      background: #1e3a8a;
      color: #fff;
      padding: 2px 9px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 800;
    }

    /* ── SECTION LABEL ──────────────────────────────────────────── */
    .section-label {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      color: #fff;
      background: #1e40af;
      padding: 7px 32px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* ── COMPONENT TABLE ────────────────────────────────────────── */
    .component-table {
      width: 100%;
      border-collapse: collapse;
    }
    .component-table th {
      background: #1e3a8a;
      color: #fff;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      padding: 10px 14px;
      text-align: left;
    }
    .component-table th.th-price  { text-align: right; padding-right: 28px; }
    .component-table th.th-num    { width: 36px; text-align: center; }
    .component-table th.th-icon   { width: 40px; text-align: center; }
    .component-table th.th-type   { width: 160px; }

    .row-even { background: #ffffff; }
    .row-odd  { background: #f8fafc; }
    .row-empty { background: #f8fafc; opacity: 0.65; }

    .component-table td { padding: 11px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .td-num  { text-align: center; font-size: 11px; font-weight: 700; color: #94a3b8; }
    .td-icon { text-align: center; font-size: 18px; }
    .td-type { font-size: 12px; font-weight: 700; color: #475569; }
    .td-name { }
    .td-price { text-align: right; padding-right: 28px; white-space: nowrap; }

    .product-name   { font-size: 13px; font-weight: 700; color: #0f172a; display: block; }
    .brand-tag      { display: inline-block; font-size: 10px; font-weight: 700; color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 1px 6px; margin-top: 2px; }
    .not-selected   { font-size: 12px; color: #94a3b8; font-style: italic; }
    .price-val      { font-size: 14px; font-weight: 900; color: #1e293b; }
    .price-unit     { font-size: 11px; color: #64748b; margin-left: 1px; }
    .empty-dash     { color: #cbd5e1; font-size: 14px; }

    /* TOTAL ROW */
    .row-total { background: linear-gradient(135deg, #1e3a8a, #2563eb); }
    .row-total td {
      padding: 14px 14px;
      color: #fff;
      border-bottom: none;
      font-weight: 800;
    }
    .total-label {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .total-price {
      text-align: right;
      padding-right: 28px;
      font-size: 20px;
      font-weight: 900;
      color: #fff;
      white-space: nowrap;
    }
    .total-sub {
      font-size: 10px;
      color: rgba(255,255,255,0.7);
      font-weight: 600;
    }

    /* ── PERFORMANCE SUMMARY ────────────────────────────────────── */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0;
    }
    .summary-stat {
      padding: 16px 20px;
      border-right: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
    }
    .summary-stat:last-child { border-right: none; }
    .summary-stat-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #64748b;
      margin-bottom: 4px;
    }
    .summary-stat-val {
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
      line-height: 1;
    }
    .summary-stat-unit { font-size: 13px; color: #64748b; font-weight: 600; }
    .summary-stat-sub  { font-size: 11px; color: #94a3b8; margin-top: 3px; }

    /* ── 6-SCORE GRID ───────────────────────────────────────────── */
    .score-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 0;
      border-top: 1px solid #e2e8f0;
    }
    .score-box {
      padding: 12px 8px;
      text-align: center;
      border-right: 1px solid #f1f5f9;
    }
    .score-box:last-child { border-right: none; }
    .score-icon  { font-size: 16px; margin-bottom: 4px; }
    .score-num   { font-size: 18px; font-weight: 900; line-height: 1; }
    .score-sub   { font-size: 10px; color: #94a3b8; font-weight: 600; }
    .score-label { font-size: 10px; color: #64748b; margin-top: 3px; font-weight: 600; }

    /* ── AI RECOMMENDATION ──────────────────────────────────────── */
    .ai-rec {
      background: linear-gradient(135deg, rgba(37,99,235,0.04), rgba(5,150,105,0.03));
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      margin: 16px 24px;
      padding: 14px 18px;
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .ai-rec-icon { font-size: 20px; flex-shrink: 0; }
    .ai-rec-title { font-size: 10px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 4px; }
    .ai-rec-text  { font-size: 12.5px; color: #334155; line-height: 1.5; font-weight: 500; }

    /* ── CHECKS TABLE ───────────────────────────────────────────── */
    .checks-table { width: 100%; border-collapse: collapse; }
    .checks-table td { padding: 8px 14px; font-size: 11.5px; border-bottom: 1px solid #f1f5f9; }
    .check-ok   .check-status { color: #059669; font-size: 14px; }
    .check-fail .check-status { color: #dc2626; font-size: 14px; }
    .check-ok   { background: #f0fdf4; }
    .check-fail { background: #fff1f2; }
    .check-status { width: 28px; text-align: center; }
    .check-label  { font-weight: 700; color: #0f172a; width: 280px; }
    .check-detail { color: #475569; font-size: 11px; }

    /* ── FOOTER ─────────────────────────────────────────────────── */
    .doc-footer {
      background: linear-gradient(135deg, #0f172a, #1e3a8a);
      color: rgba(255,255,255,0.8);
      padding: 20px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }
    .footer-brand { font-size: 15px; font-weight: 900; color: #fff; letter-spacing: 0.06em; }
    .footer-brand span { color: #60a5fa; }
    .footer-info  { font-size: 11px; line-height: 1.6; text-align: center; }
    .footer-note  { font-size: 11px; line-height: 1.6; text-align: right; color: rgba(255,255,255,0.65); }

    /* ── PRINT MEDIA ─────────────────────────────────────────────── */
    @media print {
      body { background: #fff; }
      .print-toolbar { display: none !important; }
      .page-wrap {
        margin: 0;
        max-width: 100%;
        border-radius: 0;
        box-shadow: none;
      }
      @page {
        size: A4;
        margin: 0;
      }
    }
  </style>
</head>
<body>

  <!-- ── PRINT TOOLBAR (hidden when printing) ─────────────────── -->
  <div class="print-toolbar">
    <div>
      <div class="print-toolbar-title">📄 Xem trước Báo giá Cấu hình PC</div>
      <div class="print-toolbar-hint">Nhấn "In / Lưu PDF" → Chọn "Save as PDF" để xuất file PDF</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <button class="btn-print" onclick="window.print()">🖨️ In / Lưu PDF</button>
      <button class="btn-close" onclick="window.close()">✕ Đóng</button>
    </div>
  </div>

  <!-- ── DOCUMENT ─────────────────────────────────────────────── -->
  <div class="page-wrap">

    <!-- HEADER -->
    <div class="doc-header">
      <div class="brand-logo">
        <div class="brand-name">PC<span> MALL</span></div>
        <div class="brand-tagline">AI-Powered PC Building Platform</div>
        <div class="brand-contact">
          🌐 pcmall.vn &nbsp;|&nbsp; 📞 1800-6789 &nbsp;|&nbsp; 📧 support@pcmall.vn<br>
          🏢 Hệ thống cửa hàng linh kiện máy tính toàn quốc
        </div>
      </div>
      <div class="doc-title-block">
        <div class="doc-title">📋 Phiếu Báo Giá</div>
        <div class="doc-title">Cấu Hình Máy Tính</div>
        <div class="doc-number">Mã phiếu: ${docNumber}</div>
        <div class="doc-date">🗓️ ${dateStr} lúc ${timeStr}</div>
        <div class="readiness-pill" style="background:${readinessColor}30;border-color:${readinessColor}80;color:#fff">${readinessText}</div>
      </div>
    </div>

    <!-- BUILD INFO BAR -->
    <div class="build-info-bar">
      <div class="build-name-block">
        <div>
          <div class="build-name-label">Tên cấu hình</div>
          <div class="build-name-val">🖥️ ${buildName || "Cấu hình AI tự động"}</div>
        </div>
        <span class="count-badge">${selectedCount}/8 linh kiện</span>
      </div>
      <div class="build-meta">
        <div class="build-meta-item">🎯 Mục đích: <strong>${purpose}</strong></div>
        <div class="build-meta-item">🖥️ Màn hình: <strong>${resolution}</strong></div>
        <div class="build-meta-item">💡 Ưu tiên: <strong>${preference}</strong></div>
        ${budget > 0 ? `<div class="build-meta-item">💰 Ngân sách: <strong>${_fmt(budget)}đ</strong></div>` : ""}
      </div>
    </div>

    <!-- SECTION: COMPONENT LIST -->
    <div class="section-label">🔩 Danh sách linh kiện (${selectedCount}/8 đã chọn)</div>
    <table class="component-table">
      <thead>
        <tr>
          <th class="th-num">#</th>
          <th class="th-icon"></th>
          <th class="th-type">Loại linh kiện</th>
          <th>Tên sản phẩm / Thương hiệu</th>
          <th class="th-price">Đơn giá</th>
        </tr>
      </thead>
      <tbody>
        ${componentRows}
      </tbody>
      <tfoot>
        <tr class="row-total">
          <td colspan="3">
            <div class="total-label">🧾 Tổng cộng (${selectedCount} linh kiện)</div>
            <div class="total-sub">Chưa bao gồm VAT 10% và phí lắp ráp</div>
          </td>
          <td></td>
          <td class="total-price">${_fmt(totalPrice)}<span style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.8)">đ</span></td>
        </tr>
      </tfoot>
    </table>

    <!-- SECTION: PERFORMANCE SUMMARY -->
    <div class="section-label">📊 Tổng quan hiệu năng</div>
    <div class="summary-grid">
      <div class="summary-stat">
        <div class="summary-stat-label">💰 Tổng chi phí</div>
        <div class="summary-stat-val" style="color:#1e3a8a">${_fmt(totalPrice)}<span class="summary-stat-unit">đ</span></div>
        <div class="summary-stat-sub">${budget > 0 ? `Ngân sách: ${_fmt(budget)}đ` : "—"}</div>
      </div>
      <div class="summary-stat">
        <div class="summary-stat-label">⚡ Điểm tương thích</div>
        <div class="summary-stat-val" style="color:${scoreColor}">${score}<span class="summary-stat-unit">/100</span></div>
        <div class="summary-stat-sub">${score >= 80 ? "Tương thích tốt" : score >= 50 ? "Cần kiểm tra" : "Có xung đột"}</div>
      </div>
      <div class="summary-stat" style="border-right:none">
        <div class="summary-stat-label">🎮 FPS Gaming ước tính</div>
        <div class="summary-stat-val" style="color:#7c3aed">${fps > 0 ? fps : "—"}<span class="summary-stat-unit">${fps > 0 ? " FPS" : ""}</span></div>
        <div class="summary-stat-sub">${fps >= 144 ? "Mượt mà 144Hz+" : fps >= 60 ? "Full HD 60fps+" : fps > 0 ? "Cơ bản" : "Chọn đủ linh kiện"}</div>
      </div>
    </div>

    <!-- 6-SCORE GRID -->
    <div class="score-grid">${scoresHtml}</div>

    <!-- AI RECOMMENDATION -->
    ${recommendation ? `
    <div class="ai-rec">
      <div class="ai-rec-icon">🤖</div>
      <div>
        <div class="ai-rec-title">Nhận xét AI Builder</div>
        <div class="ai-rec-text">${recommendation}</div>
      </div>
    </div>` : ""}

    <!-- SECTION: COMPATIBILITY CHECKS -->
    ${checks.length > 0 ? `
    <div class="section-label">🔍 Kiểm tra tương thích chi tiết</div>
    <table class="checks-table">
      <tbody>${checksHtml}</tbody>
    </table>` : ""}

    <!-- SECTION: TERMS -->
    <div style="padding:16px 24px;background:#fffbeb;border-top:2px solid #fde68a">
      <div style="font-size:10px;font-weight:800;color:#92400e;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">⚠️ Điều khoản báo giá</div>
      <div style="font-size:11px;color:#78350f;line-height:1.7">
        • Báo giá có hiệu lực trong vòng <strong>7 ngày</strong> kể từ ngày phát hành.
        Giá sản phẩm có thể thay đổi tùy theo biến động thị trường.<br>
        • Giá trên <strong>chưa bao gồm VAT 10%</strong> và phí lắp ráp (nếu có).
        Bảo hành chính hãng theo từng sản phẩm (12–36 tháng).<br>
        • Để đặt hàng hoặc được tư vấn thêm, vui lòng liên hệ
        <strong>1800-6789</strong> hoặc truy cập <strong>pcmall.vn</strong>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="doc-footer">
      <div>
        <div class="footer-brand">PC<span> MALL</span></div>
        <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:3px">AI-Powered PC Building Platform</div>
      </div>
      <div class="footer-info">
        🌐 pcmall.vn &nbsp;|&nbsp; 📞 1800-6789<br>
        📧 support@pcmall.vn<br>
        Được tạo bởi PC Mall Smart Builder AI
      </div>
      <div class="footer-note">
        Phiếu báo giá: ${docNumber}<br>
        Ngày xuất: ${dateStr}<br>
        © ${now.getFullYear()} PC Mall. Mọi quyền được bảo lưu.
      </div>
    </div>

  </div><!-- end .page-wrap -->

  <script>
    // Auto-print after page fully renders
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 900);
    });
  </script>
</body>
</html>`;
}

/* ── PUBLIC API ──────────────────────────────────────────────────── */

/**
 * Mở cửa sổ in mới với layout Báo Giá đẹp có logo PC Mall.
 *
 * @param {object} config
 * @param {string}  config.buildName
 * @param {object}  config.selectedItems
 * @param {number}  config.totalPrice
 * @param {object}  config.insights       — từ calculateBuilderInsights()
 * @param {object}  config.xaiReport      — từ XAI compatibility check
 * @param {object}  config.suggestionForm — { purpose, budget, resolution, preference }
 */
export function exportBuildToPdf(config) {
  const html = generateBuildHtml(config);

  const win = window.open("", "_blank", "width=960,height=820,scrollbars=yes,resizable=yes");
  if (!win) {
    // Popup blocked — fallback alert
    alert(
      "Trình duyệt đang chặn cửa sổ popup.\n" +
      'Vui lòng nhấp vào biểu tượng "Popup bị chặn" trên thanh địa chỉ và chọn "Luôn cho phép".'
    );
    return;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
}
