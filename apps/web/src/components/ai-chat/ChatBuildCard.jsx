import React from "react";

export function ChatBuildCard({
  build,
  formatCurrency,
  getBuildComponents,
  handlePcBuilder,
  handleLoadBuildToBuilder,
  handleAddToCartFullBuild,
  loadingBuildCart
}) {
  if (!build) return null;

  const components = getBuildComponents(build);

  return (
    <div className="ai-build-card">
      <div className="ai-card-head">
        <strong>Cấu hình đề xuất (Chuẩn 100% Tương thích)</strong>
        <span>{formatCurrency(build.totalPrice)}đ</span>
      </div>
      <div className="ai-build-list">
        {components.map((item) => (
          <div key={`${item.componentType}-${item.skuId || item.name}`} className="ai-build-item-row">
            <span className="ai-build-slot">{String(item.componentType || "").toUpperCase()}</span>
            <strong className="ai-build-pname" title={item.name}>{item.name}</strong>
            <small className="ai-build-price">{formatCurrency(item.price)}đ{item.stock !== "" ? ` · còn ${item.stock}` : ""}</small>
            <button
              type="button"
              className="ai-build-item-pick"
              title="Nạp linh kiện này vào Workspace Builder"
              onClick={() => handlePcBuilder(item)}
            >
              + Chọn
            </button>
          </div>
        ))}
      </div>
      <div className="ai-build-actions">
        <button
          type="button"
          className="ai-btn-builder"
          onClick={() => handleLoadBuildToBuilder(build)}
        >
          🧩 Nạp Dàn PC vào Builder
        </button>
        <button
          type="button"
          className="ai-btn-cart"
          disabled={loadingBuildCart}
          onClick={() => handleAddToCartFullBuild(build)}
        >
          {loadingBuildCart ? "Đang thêm..." : "🛒 Thêm cả dàn vào Giỏ"}
        </button>
      </div>
    </div>
  );
}
