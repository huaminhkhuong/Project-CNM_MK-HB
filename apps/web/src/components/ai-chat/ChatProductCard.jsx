import React from "react";
import { Link } from "react-router-dom";
import { routeConfig } from "../../routes/routeConfig";
import { resolveProductImage } from "../../utils/productImage";

export function ChatProductCard({
  product,
  formatCurrency,
  actionProductId,
  handleAddToCart,
  handleCompare,
  handlePcBuilder
}) {
  return (
    <article className="ai-product-card" key={`${product.id}-${product.skuId || product.sku}`}>
      <div className="ai-product-card__image">
        <img src={resolveProductImage(product)} alt={product.name} loading="lazy" />
        <span>Còn {product.stock}</span>
      </div>
      <div className="ai-product-card__body">
        <small>{product.brandName || product.categoryName || "PC Mall"}</small>
        <strong>{product.name}</strong>
        <span>{formatCurrency(product.price)}đ</span>
        <div className="ai-product-actions">
          <Link to={routeConfig.public.productDetail.replace(":idOrSlug", String(product.slug || product.id))}>
            Chi tiết
          </Link>
          <button
            type="button"
            disabled={actionProductId === product.id}
            onClick={() => handleAddToCart(product)}
          >
            {actionProductId === product.id ? "Đang thêm..." : "Thêm giỏ"}
          </button>
          <button type="button" onClick={() => handleCompare(product)}>
            So sánh
          </button>
          <button type="button" onClick={() => handlePcBuilder(product)}>
            + Chọn vào Builder
          </button>
        </div>
      </div>
    </article>
  );
}

export function ChatProductGrid({
  products,
  formatCurrency,
  actionProductId,
  handleAddToCart,
  handleCompare,
  handlePcBuilder
}) {
  if (!products || products.length === 0) return null;

  return (
    <div className="ai-product-grid">
      {products.map((product) => (
        <ChatProductCard
          key={`${product.id}-${product.skuId || product.sku}`}
          product={product}
          formatCurrency={formatCurrency}
          actionProductId={actionProductId}
          handleAddToCart={handleAddToCart}
          handleCompare={handleCompare}
          handlePcBuilder={handlePcBuilder}
        />
      ))}
    </div>
  );
}
