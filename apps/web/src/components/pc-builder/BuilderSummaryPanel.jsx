import React from "react";

/**
 * BuilderSummaryPanel — Thanh Điều Khiển Cấu Hình Tối Giản, Nhất Quán (Pro Tech Clean)
 * Đảm bảo 1 Nút Duy Nhất "Build PC Của Bạn" để khởi tạo quy trình thu thập tiêu chí 5 bước,
 * sau đó rẽ nhánh ở bước cuối.
 * Các bộ PC mẫu đã được chuyển sang khu vực riêng biệt bên dưới.
 */
export function BuilderSummaryPanel({
  onOpenReqWizard,
  onOpenAiAudit,
  onOpenXaiDrawer,
  onRefreshCatalog,
  onClearAll,
  selectedCount = 0,
  onExportPdf,
}) {
  return (
    <header
      className="builder-topbar-clean"
      style={{
        position: "relative",
        zIndex: 90,
        background: "#ffffff",
        borderRadius: "14px",
        padding: "12px 20px",
        border: "1px solid #e2e8f0",
        boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        flexWrap: "wrap",
        marginBottom: "18px"
      }}
    >
      {/* ── Brand Logo ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "9px",
            background: "#0f172a",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "900",
            fontSize: "15px"
          }}
        >
          PC
        </div>
        <div>
          <div style={{ fontSize: "15px", fontWeight: "900", color: "#0f172a", letterSpacing: "-0.01em", lineHeight: "1.1" }}>
            PC MALL <span style={{ color: "#2563eb" }}>BUILDER</span>
          </div>
          <div style={{ fontSize: "10.5px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Workspace Lắp Ráp Máy Tính
          </div>
        </div>
      </div>

      {/* ── Center Hub: QUY HOẠCH 1 LUỒNG AI DUY NHẤT (UNIFIED AI FLOW) ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", flex: "1 1 auto", flexWrap: "wrap" }}>
        {selectedCount === 0 ? (
          <button
            type="button"
            onClick={onOpenReqWizard}
            title="Khởi động AI khảo sát nhu cầu để tự động tuyển chọn dàn PC tối ưu nhất"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 24px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: "#0f172a",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: "800",
              cursor: "pointer",
              boxShadow: "0 2px 10px rgba(15, 23, 42, 0.2)",
              letterSpacing: "-0.01em",
              transition: "transform 0.15s, background-color 0.15s"
            }}
          >
            <span style={{ fontSize: "17px" }}>✨</span>
            <span>Nhờ AI Xây Dựng Cấu Hình</span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "700",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                padding: "2px 8px",
                borderRadius: "6px",
                marginLeft: "2px"
              }}
            >
              Khảo Sát Nhanh
            </span>
          </button>
        ) : (
          <>
            {onOpenAiAudit && (
              <button
                type="button"
                onClick={onOpenAiAudit}
                title="Đánh giá chi tiết cấu hình hiện tại bằng AI: kiểm tra độ cân bằng, nguồn điện, tản nhiệt và tự động đề xuất đổi linh kiện"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 22px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  fontSize: "13.5px",
                  fontWeight: "800",
                  cursor: "pointer",
                  boxShadow: "0 2px 12px rgba(37, 99, 235, 0.3)",
                  transition: "transform 0.15s, background-color 0.15s"
                }}
              >
                <span style={{ fontSize: "16px" }}>🔬</span>
                <span>AI Thẩm Định & Tối Ưu Dàn Máy</span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    backgroundColor: "#1e40af",
                    color: "#ffffff",
                    padding: "2px 8px",
                    borderRadius: "6px"
                  }}
                >
                  {selectedCount} linh kiện
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenReqWizard}
              title="Nhờ AI tư vấn lại cấu hình mới từ đầu"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 15px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#f8fafc",
                color: "#475569",
                fontSize: "12.5px",
                fontWeight: "700",
                cursor: "pointer",
                transition: "background-color 0.15s"
              }}
            >
              <span>🔄</span>
              <span>Build Mới Bằng AI</span>
            </button>
          </>
        )}
      </div>

      {/* ── Right Action Tools ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
        {/* Phân tích XAI */}
        <button
          type="button"
          onClick={onOpenXaiDrawer}
          title="Báo cáo phân tích tương thích XAI"
          style={{
            padding: "8px 11px",
            borderRadius: "8px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#334155",
            fontSize: "12px",
            fontWeight: "700",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px"
          }}
        >
          <span>🧠</span>
          <span>XAI</span>
        </button>

        {/* Xuất PDF */}
        <button
          type="button"
          onClick={() => (onExportPdf ? onExportPdf() : window.print())}
          title="Xuất file PDF báo giá"
          style={{
            padding: "8px 11px",
            borderRadius: "8px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#334155",
            fontSize: "12px",
            fontWeight: "700",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px"
          }}
        >
          <span>📄</span>
          <span>PDF</span>
        </button>

        {/* Tải lại danh mục */}
        {onRefreshCatalog && (
          <button
            type="button"
            onClick={onRefreshCatalog}
            title="Làm mới danh mục linh kiện"
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontSize: "12px",
              cursor: "pointer"
            }}
          >
            🔄
          </button>
        )}

        {/* Xóa trắng cấu hình */}
        {onClearAll && (
          <button
            type="button"
            onClick={onClearAll}
            disabled={selectedCount === 0}
            title="Xóa trắng cấu hình đang ráp"
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              background: selectedCount === 0 ? "#f8fafc" : "#ffffff",
              color: selectedCount === 0 ? "#cbd5e1" : "#dc2626",
              fontSize: "12px",
              cursor: selectedCount === 0 ? "not-allowed" : "pointer"
            }}
          >
            🗑️
          </button>
        )}
      </div>
    </header>
  );
}

export default BuilderSummaryPanel;
