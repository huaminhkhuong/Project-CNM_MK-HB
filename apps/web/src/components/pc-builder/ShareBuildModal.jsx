import React, { useState } from "react";
import { formatCurrency, getProductName, getSelectedProduct, getItemPrice } from "./pcBuilderUtils";

/**
 * ShareBuildModal — Modal chia sẻ cấu hình PC chuyên nghiệp & trực quan:
 * - Mã QR Code trực tiếp (quét để mở ngay trên điện thoại hoặc chia sẻ nhanh).
 * - 1-Click sao chép link chia sẻ công khai.
 * - 1-Click sao chép tóm tắt cấu hình text format.
 * - Nút liên kết xuất PDF Báo Giá chuẩn PC Mall.
 */
export function ShareBuildModal({
  isOpen,
  onClose,
  shareUrl = "",
  buildName = "Cấu hình AI PC Mall",
  totalPrice = 0,
  selectedItems = {},
  sections = [],
  insights = {},
  onExportPdf
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  if (!isOpen) return null;

  const currentUrl = shareUrl || (typeof window !== "undefined" ? window.location.href : "");
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(currentUrl)}&margin=8`;

  const selectedCount = Object.keys(selectedItems || {}).length;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      console.warn("Failed to copy link", e);
    }
  };

  const handleCopySummary = async () => {
    const lines = [
      `🖥️ CẤU HÌNH: ${buildName}`,
      `💰 Tổng giá: ${formatCurrency(totalPrice)}đ`,
      `📊 Đánh giá tương thích: ${insights?.compatibilityScore || 100}/100`,
      "----------------------------------------",
      ...sections.map((s, idx) => {
        const item = selectedItems[s.componentType];
        if (!item) return `${idx + 1}. ${s.label}: [Chưa chọn]`;
        const prod = getSelectedProduct(item);
        const name = getProductName(prod);
        const qty = item.quantity > 1 ? ` (x${item.quantity})` : "";
        const price = formatCurrency(getItemPrice(item));
        return `${idx + 1}. ${s.label}: ${name}${qty} — ${price}đ`;
      }),
      "----------------------------------------",
      `🔗 Xem chi tiết tại: ${currentUrl}`
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch (e) {
      console.warn("Failed to copy summary", e);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px"
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          maxWidth: "540px",
          width: "100%",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          animation: "fadeIn 0.2s ease-out"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #1e3a8a, #2563eb)",
            color: "#ffffff",
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>📱</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "800", letterSpacing: "-0.01em" }}>
                Chia Sẻ Cấu Hình PC
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", opacity: 0.85 }}>
                Quét mã QR bằng camera điện thoại hoặc gửi link cho bạn bè
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              color: "#ffffff",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              fontSize: "18px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s"
            }}
            title="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "24px" }}>
          <div style={{ display: "flex", gap: "20px", alignItems: "center", marginBottom: "20px" }}>
            {/* QR Card */}
            <div
              style={{
                width: "140px",
                height: "140px",
                flexShrink: 0,
                border: "2px solid #e2e8f0",
                borderRadius: "14px",
                padding: "6px",
                backgroundColor: "#ffffff",
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <img
                src={qrCodeUrl}
                alt="QR Code Cấu hình"
                style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "8px" }}
              />
            </div>

            {/* Quick Specs Highlight Card */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Tóm Tắt Cấu Hình ({selectedCount}/8 linh kiện)
              </div>
              <h4 style={{ margin: "4px 0 8px 0", fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
                {buildName}
              </h4>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "8px" }}>
                <span style={{ fontSize: "20px", fontWeight: "900", color: "#1e3a8a" }}>
                  {formatCurrency(totalPrice)}đ
                </span>
                <span style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  backgroundColor: "#dcfce7",
                  color: "#15803d",
                  padding: "2px 8px",
                  borderRadius: "999px"
                }}>
                  {insights?.compatibilityScore || 100}% Tương thích
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b", lineHeight: "1.4" }}>
                Quét mã để mở cấu hình trên điện thoại hoặc lưu lại danh sách linh kiện báo giá.
              </p>
            </div>
          </div>

          {/* Share Link Input Box */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
              🔗 Đường dẫn chia sẻ trực tiếp:
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                readOnly
                value={currentUrl}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  fontSize: "12.5px",
                  backgroundColor: "#f8fafc",
                  color: "#1e293b",
                  outline: "none"
                }}
              />
              <button
                type="button"
                onClick={handleCopyLink}
                style={{
                  backgroundColor: copiedLink ? "#16a34a" : "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "10px",
                  padding: "0 16px",
                  fontSize: "12.5px",
                  fontWeight: "700",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "background 0.2s"
                }}
              >
                {copiedLink ? "✓ Đã Chép" : "Sao Chép"}
              </button>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "16px" }}>
            <button
              type="button"
              onClick={handleCopySummary}
              style={{
                backgroundColor: copiedSummary ? "#dcfce7" : "#f1f5f9",
                color: copiedSummary ? "#16a34a" : "#334155",
                border: `1px solid ${copiedSummary ? "#86efac" : "#cbd5e1"}`,
                borderRadius: "12px",
                padding: "10px 14px",
                fontSize: "12.5px",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "all 0.15s"
              }}
            >
              <span>{copiedSummary ? "✓" : "📋"}</span>
              <span>{copiedSummary ? "Đã Chép Tóm Tắt" : "Chép Tóm Tắt Text"}</span>
            </button>

            {onExportPdf && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onExportPdf();
                }}
                style={{
                  backgroundColor: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                  borderRadius: "12px",
                  padding: "10px 14px",
                  fontSize: "12.5px",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px"
                }}
              >
                <span>📄</span>
                <span>Xuất PDF Báo Giá</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            backgroundColor: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
            padding: "12px 24px",
            display: "flex",
            justifyContent: "flex-end"
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              padding: "6px 16px",
              fontSize: "12px",
              fontWeight: "600",
              color: "#475569",
              cursor: "pointer"
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
