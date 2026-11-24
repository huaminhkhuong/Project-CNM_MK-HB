import React from "react";

/**
 * AIControlPanel — Trợ Lý AI Đồng Hành Dành Cho Người Dùng Mới
 * Thay thế bảng cấu hình kỹ thuật phức tạp bằng thẻ hướng dẫn tương tác thân thiện
 */
export function AIControlPanel({
  onOpenWizard,
  onAutoRecommend,
  isAutoBuilding
}) {
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.avatar}>🤖</div>
        <div>
          <h4 style={styles.title}>Trợ Lý AI Đồng Hành</h4>
          <span style={styles.subtitle}>Tư vấn cấu hình cho người mới</span>
        </div>
      </div>

      <p style={styles.description}>
        Bạn không am hiểu kỹ thuật phần cứng? Đừng lo lắng! Trợ lý AI sẽ hỏi bạn vài câu trắc nghiệm đơn giản và tự động tìm kiếm linh kiện tối ưu nhất.
      </p>

      {/* Prominent Button to open AI Wizard */}
      <button
        type="button"
        onClick={onOpenWizard || onAutoRecommend}
        disabled={isAutoBuilding}
        style={styles.mainBtn}
      >
        <span style={{ fontSize: "16px" }}>✨</span>
        <span>{isAutoBuilding ? "Đang xử lý..." : "Khởi Động AI Đề Xuất Cấu Hình"}</span>
      </button>

      {/* 4 Cam Kết Cho Người Mới */}
      <div style={styles.featureList}>
        <div style={styles.featureItem}>
          <span style={styles.featureIcon}>🛡️</span>
          <div>
            <strong style={styles.featureTitle}>Cam kết 100% tương thích</strong>
            <p style={styles.featureDesc}>Socket CPU, chuẩn RAM và nguồn điện được AI đối chiếu tự động.</p>
          </div>
        </div>

        <div style={styles.featureItem}>
          <span style={styles.featureIcon}>💰</span>
          <div>
            <strong style={styles.featureTitle}>Bám sát ngân sách (±5%)</strong>
            <p style={styles.featureDesc}>Không đội chi phí, tối ưu từng đồng bạn đầu tư vào hiệu năng.</p>
          </div>
        </div>

        <div style={styles.featureItem}>
          <span style={styles.featureIcon}>🎮</span>
          <div>
            <strong style={styles.featureTitle}>Đúng tựa game & phần mềm</strong>
            <p style={styles.featureDesc}>Chỉ cần nhập tên game hoặc công việc bạn muốn làm.</p>
          </div>
        </div>

        <div style={styles.featureItem}>
          <span style={styles.featureIcon}>⚡</span>
          <div>
            <strong style={styles.featureTitle}>1 Click nạp trọn bộ linh kiện</strong>
            <p style={styles.featureDesc}>Tự động điền đầy đủ 8 món vào bảng để bạn sẵn sàng đặt mua.</p>
          </div>
        </div>
      </div>

      <div style={styles.tipBox}>
        <span>💡</span>
        <span>Bấm nút trên để bắt đầu ngay chỉ trong 1 phút!</span>
      </div>
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    padding: "16px",
    border: "1px solid #e2e8f0",
    marginBottom: "14px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "10px"
  },
  avatar: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #2563eb, #7c3aed)",
    display: "grid",
    placeItems: "center",
    fontSize: "18px",
    color: "#ffffff",
    flexShrink: 0
  },
  title: {
    margin: 0,
    fontSize: "13.5px",
    fontWeight: "800",
    color: "#0f172a"
  },
  subtitle: {
    fontSize: "11px",
    color: "#64748b",
    fontWeight: "500"
  },
  description: {
    fontSize: "11.5px",
    color: "#475569",
    lineHeight: "1.45",
    margin: "0 0 12px 0"
  },
  mainBtn: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#ffffff",
    border: "none",
    fontWeight: "800",
    fontSize: "12.5px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    boxShadow: "0 4px 12px rgba(37,99,235,0.25)",
    transition: "all 0.15s ease",
    marginBottom: "14px"
  },
  featureList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    borderTop: "1px solid #f1f5f9",
    paddingTop: "12px"
  },
  featureItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px"
  },
  featureIcon: {
    fontSize: "14px",
    lineHeight: 1.2,
    flexShrink: 0,
    marginTop: "1px"
  },
  featureTitle: {
    display: "block",
    fontSize: "11.5px",
    fontWeight: "700",
    color: "#1e293b",
    lineHeight: 1.3
  },
  featureDesc: {
    margin: 0,
    fontSize: "10.5px",
    color: "#64748b",
    lineHeight: 1.35
  },
  tipBox: {
    marginTop: "12px",
    padding: "8px 10px",
    backgroundColor: "#eff6ff",
    borderRadius: "8px",
    border: "1px solid #dbeafe",
    fontSize: "11px",
    color: "#1e40af",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "6px"
  }
};
export default AIControlPanel;
