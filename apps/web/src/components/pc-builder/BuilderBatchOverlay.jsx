import React from "react";

export function BuilderBatchOverlay({ isAutoBuilding }) {
  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(15, 23, 42, 0.75)",
      backdropFilter: "blur(8px)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10000,
      color: "#ffffff"
    }}>
      <div style={{
        backgroundColor: "#0f172a",
        border: "1px solid rgba(59, 130, 246, 0.4)",
        borderRadius: "24px",
        padding: "36px 44px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        boxShadow: "0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(37, 99, 235, 0.25)",
        maxWidth: "480px",
        textAlign: "center",
        animation: "fadeIn 0.25s ease-out"
      }}>
        <div style={{ position: "relative", marginBottom: "20px" }}>
          <div className="builder-batch-spinner" style={{
            width: "60px",
            height: "60px",
            border: "4px solid rgba(59, 130, 246, 0.2)",
            borderTopColor: "#3b82f6",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite"
          }} />
          <span style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: "20px"
          }}>⚡</span>
        </div>

        <h3 style={{ margin: 0, fontSize: "19px", fontWeight: "800", color: "#f8fafc", letterSpacing: "-0.01em" }}>
          {isAutoBuilding ? "⚡ System AI Auto-Build Engine" : "⚡ Đang Nạp Phương Án AI Vào Workspace..."}
        </h3>

        <p style={{ margin: "10px 0 20px 0", fontSize: "13px", color: "#94a3b8", lineHeight: "1.5" }}>
          Hệ thống đang tự động tối ưu & nạp 8/8 linh kiện chuẩn 100% tương thích trực tiếp vào thao tác của bạn.
        </p>

        {/* Live Progress Steps Badge Container */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          width: "100%",
          background: "rgba(30, 41, 59, 0.6)",
          borderRadius: "14px",
          padding: "12px 16px",
          border: "1px solid rgba(255,255,255,0.06)",
          textAlign: "left"
        }}>
          <div style={{ fontSize: "12px", color: "#38bdf8", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>✓</span> Quét danh mục & cân bằng ngân sách tối ưu
          </div>
          <div style={{ fontSize: "12px", color: "#818cf8", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>✓</span> Kiểm tra Socket, RAM DDR, Nguồn PSU & Case Clearance
          </div>
          <div style={{ fontSize: "12px", color: "#4ade80", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>✨</span> Nạp trực tiếp 8/8 linh kiện vào workspace hiển thị tức thì
          </div>
        </div>
      </div>
    </div>
  );
}

export default BuilderBatchOverlay;
