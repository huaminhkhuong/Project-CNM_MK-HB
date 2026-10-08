import React from "react";
import { AIAdvisorPanel } from "./AIAdvisorPanel";

/**
 * AIAdvisorDrawer — Drawer trượt từ cạnh phải màn hình hiển thị Trợ Lý AI Advisor.
 * Giúp giao diện PC Builder cực kỳ gọn gàng, không bị chồng chéo hay rối thông tin.
 */
export function AIAdvisorDrawer({
  isOpen,
  onClose,
  selectedItems = {},
  totalPrice = 0,
  budget = "25000000",
  xaiReport,
  onOpenReqWizard,
  onAutoBuild,
  onViewProductDetail,
  onSelectSingleComponent
}) {
  React.useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedCount = Object.keys(selectedItems || {}).length;
  const safeTotalPrice = Number(totalPrice || 0);

  return (
    <div
      className="ai-advisor-drawer-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "stretch",
      }}
    >
      <div
        className="ai-advisor-drawer-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "640px",
          backgroundColor: "#ffffff",
          boxShadow: "-8px 0 32px rgba(15, 23, 42, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "slideLeft 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: "18px 24px",
            background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #4f46e5 100%)",
            color: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: "28px", background: "rgba(255,255,255,0.15)", padding: "6px 10px", borderRadius: "12px" }}>
              🤖
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#ffffff", display: "flex", alignItems: "center", gap: 8 }}>
                AI Advisor — Tư Vấn PC
                <span style={{
                  fontSize: "10px",
                  fontWeight: "800",
                  padding: "2px 7px",
                  borderRadius: "12px",
                  backgroundColor: "#22c55e",
                  color: "#ffffff",
                  letterSpacing: "0.05em",
                }}>LIVE</span>
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "rgba(255,255,255,0.85)" }}>
                Hiểu rõ {selectedCount} linh kiện đang chọn • {safeTotalPrice.toLocaleString("vi-VN")}đ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              border: "none",
              color: "#ffffff",
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              cursor: "pointer",
              fontSize: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s",
            }}
          >
            ✕
          </button>
        </div>

        {/* BODY CONTAINING AI ADVISOR PANEL */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          <AIAdvisorPanel
            selectedItems={selectedItems}
            totalPrice={totalPrice}
            budget={budget}
            xaiReport={xaiReport}
            onOpenReqWizard={onOpenReqWizard}
            onAutoBuild={onAutoBuild}
            onViewProductDetail={onViewProductDetail}
            onSelectSingleComponent={onSelectSingleComponent}
          />
        </div>

        {/* FOOTER */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            💡 Nhấn Esc hoặc bấm ra ngoài để đóng
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: "#2563eb",
              color: "#ffffff",
              border: "none",
              padding: "8px 18px",
              borderRadius: "10px",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
