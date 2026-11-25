import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { httpClient } from "../../services/http";
import { PerformanceScoreWidget } from "../../components/pc-builder/PerformanceScoreWidget";
import { XAIExplanationDrawer } from "../../components/pc-builder/XAIExplanationDrawer";
import { useAuth } from "../../hooks/useAuth";
import { routeConfig } from "../../routes/routeConfig";
import { usePageSeo } from "../../hooks/usePageSeo";

const formatCurrency = (val) => Number(val || 0).toLocaleString("vi-VN");

export function SharedBuildPage() {
  const { shareToken } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [build, setBuild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [cloning, setCloning] = useState(false);
  const [isXaiDrawerOpen, setIsXaiDrawerOpen] = useState(false);

  usePageSeo({
    title: build?.name ? `Cấu Hình: ${build.name}` : "Cấu Hình PC Được Chia Sẻ",
    description: build?.name
      ? `Xem chi tiết cấu hình máy tính ${build.name} gồm ${build.items?.length || 0} linh kiện với tổng giá trị ${formatCurrency(build.totalPrice)}đ trên PC Mall.`
      : "Chi tiết cấu hình PC tự ráp được chia sẻ trên hệ thống PC Mall.",
    type: "article"
  });

  useEffect(() => {
    async function fetchSharedBuild() {
      try {
        setLoading(true);
        setError("");
        const res = await httpClient.get(`/pc-builder/shared/${shareToken}`);
        const data = res.data?.data || res.data;
        setBuild(data);
      } catch (err) {
        setError(err.response?.data?.message || "Bộ cấu hình không tồn tại hoặc đã bị gỡ bỏ.");
      } finally {
        setLoading(false);
      }
    }

    if (shareToken) {
      fetchSharedBuild();
    }
  }, [shareToken]);

  function buildLoadPayload() {
    const rawItems = build?.items || [];
    return {
      loadBuild: {
        components: rawItems.map((item) => ({
          componentType: item.componentType,
          id: item.product?.id,
          productId: item.product?.id,
          name: item.product?.name,
          productName: item.product?.name,
          slug: item.product?.slug,
          price: item.unitPrice,
          skuId: item.variant?.id,
          sku: item.variant?.sku,
          imageUrl: item.variant?.imageUrl,
          quantity: item.quantity || 1
        }))
      }
    };
  }

  function handleLoadIntoWorkspace() {
    navigate(routeConfig.public.pcBuilder, { state: buildLoadPayload() });
  }

  async function handleCloneBuild() {
    if (!isAuthenticated) {
      navigate(`${routeConfig.public.login}?redirect=/pc-builder/shared/${shareToken}`);
      return;
    }

    try {
      setCloning(true);
      setActionError("");
      await httpClient.post(`/pc-builder/${build.id}/clone`);
      navigate(routeConfig.public.pcBuilder, { state: buildLoadPayload() });
    } catch (err) {
      setActionError(err.response?.data?.message || "Không thể sao chép cấu hình.");
    } finally {
      setCloning(false);
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingBox}>⏳ Đang tải bộ cấu hình chia sẻ...</div>
      </div>
    );
  }

  if (error || !build) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBox}>
          <h2>❌ Không tìm thấy bộ cấu hình</h2>
          <p>{error}</p>
          <Link to="/pc-builder" style={styles.btnPrimary}>Quay lại Trình Build PC</Link>
        </div>
      </div>
    );
  }

  const items = build.items || [];
  const xaiReport = build.xaiReport;

  return (
    <div style={styles.container}>
      {/* HEADER CARD */}
      <div style={styles.headerCard}>
        <div style={{ flex: 1 }}>
          <span style={styles.badge}>🖥️ CẤU HÌNH ĐƯỢC CHIA SẺ CÔNG KHAI</span>
          <h1 style={styles.title}>{build.name || "Bộ PC Mall Custom"}</h1>
          <p style={styles.meta}>Tạo lúc: {new Date(build.createdAt).toLocaleDateString("vi-VN")}</p>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.priceTag}>
            <span>Tổng giá trị</span>
            <strong>{formatCurrency(build.totalPrice)}đ</strong>
          </div>
          <button style={styles.btnPrimary} type="button" onClick={handleLoadIntoWorkspace}>
            ⚙️ Nạp Vào Không Gian Lắp Ráp
          </button>
          <button style={styles.cloneBtn} type="button" onClick={handleCloneBuild} disabled={cloning}>
            {cloning ? "Đang sao chép..." : "📋 Clone về Tài Khoản của Tôi"}
          </button>
        </div>
      </div>

      {actionError && (
        <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecdd3", color: "#be123c", padding: "12px 16px", borderRadius: "12px", marginBottom: "16px", fontWeight: 600, fontSize: "13px" }}>
          ⛔ {actionError}
        </div>
      )}

      {/* PERFORMANCE WIDGET */}
      {xaiReport?.performanceEstimate && (
        <PerformanceScoreWidget
          performanceEstimate={xaiReport.performanceEstimate}
          onOpenXaiDrawer={() => setIsXaiDrawerOpen(true)}
        />
      )}

      {/* COMPONENT LIST TABLE */}
      <div style={styles.tableCard}>
        <h3 style={styles.tableTitle}>🛠️ Danh sách Linh kiện ({items.length} món)</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Loại linh kiện</th>
              <th style={styles.th}>Tên sản phẩm</th>
              <th style={styles.th}>Mã SKU</th>
              <th style={styles.th}>Đơn giá</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} style={styles.tr}>
                <td style={styles.tdCategory}>{String(item.componentType).toUpperCase()}</td>
                <td style={styles.tdName}>
                  <strong>{item.product?.name || "Linh kiện"}</strong>
                  {item.quantity > 1 && (
                    <span style={{ marginLeft: 8, padding: "2px 6px", borderRadius: 4, background: "#dbeafe", color: "#1d4ed8", fontSize: 11, fontWeight: 800 }}>
                      x{item.quantity}
                    </span>
                  )}
                </td>
                <td style={styles.tdSku}>{item.variant?.sku || "—"}</td>
                <td style={styles.tdPrice}>{formatCurrency(item.lineTotal || item.unitPrice * (item.quantity || 1))}đ</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ACTION BAR */}
      <div style={styles.actionBar}>
        <button style={styles.btnSecondary} onClick={() => setIsXaiDrawerOpen(true)}>
          🧠 Xem Giải Thích XAI Chi Tiết
        </button>
        <Link to="/pc-builder" style={styles.btnPrimary}>
          ⚙️ Tự Lắp Ráp Cấu Hình Mới →
        </Link>
      </div>

      {/* XAI DRAWER */}
      {xaiReport && (
        <XAIExplanationDrawer
          isOpen={isXaiDrawerOpen}
          onClose={() => setIsXaiDrawerOpen(false)}
          xaiReport={xaiReport}
        />
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "32px 16px",
    fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  loadingBox: {
    textAlign: "center",
    padding: "80px 0",
    fontSize: "18px",
    color: "#64748b"
  },
  errorBox: {
    textAlign: "center",
    padding: "60px 20px",
    backgroundColor: "#fff1f2",
    borderRadius: "20px",
    border: "1px solid #fecdd3",
    color: "#be123c"
  },
  headerCard: {
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    padding: "24px 28px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "24px",
    marginBottom: "20px",
    flexWrap: "wrap"
  },
  badge: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#1d4ed8",
    backgroundColor: "#eff6ff",
    padding: "4px 12px",
    borderRadius: "99px",
    letterSpacing: "0.5px"
  },
  title: {
    margin: "8px 0 4px 0",
    fontSize: "24px",
    color: "#0f172a",
    fontWeight: "800"
  },
  meta: {
    margin: 0,
    fontSize: "13px",
    color: "#64748b"
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "20px"
  },
  priceTag: {
    textAlign: "right",
    display: "flex",
    flexDirection: "column",
    gap: "2px"
  },
  cloneBtn: {
    backgroundColor: "#059669",
    color: "#ffffff",
    border: "none",
    padding: "12px 24px",
    borderRadius: "14px",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(5, 150, 105, 0.3)",
    transition: "all 0.2s"
  },
  tableCard: {
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    padding: "24px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 4px 16px rgba(15, 23, 42, 0.04)",
    marginBottom: "24px"
  },
  tableTitle: {
    margin: "0 0 16px 0",
    fontSize: "18px",
    color: "#0f172a",
    fontWeight: "700"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse"
  },
  th: {
    textAlign: "left",
    padding: "12px 16px",
    backgroundColor: "#f8fafc",
    color: "#64748b",
    fontSize: "13px",
    fontWeight: "700",
    borderBottom: "1px solid #e2e8f0"
  },
  tr: {
    borderBottom: "1px solid #f1f5f9"
  },
  tdCategory: {
    padding: "14px 16px",
    fontWeight: "700",
    color: "#1d4ed8",
    fontSize: "13px"
  },
  tdName: {
    padding: "14px 16px",
    color: "#0f172a",
    fontSize: "14px"
  },
  tdSku: {
    padding: "14px 16px",
    color: "#94a3b8",
    fontSize: "13px"
  },
  tdPrice: {
    padding: "14px 16px",
    fontWeight: "700",
    color: "#0f172a",
    fontSize: "14px"
  },
  actionBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px"
  },
  btnPrimary: {
    backgroundColor: "#1d4ed8",
    color: "#ffffff",
    textDecoration: "none",
    padding: "12px 24px",
    borderRadius: "12px",
    fontWeight: "700",
    fontSize: "14px"
  },
  btnSecondary: {
    backgroundColor: "#ffffff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    padding: "12px 24px",
    borderRadius: "12px",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer"
  }
};
