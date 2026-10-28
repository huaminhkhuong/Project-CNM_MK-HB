import React from "react";
import { ProductFilterBar } from "./ProductFilterBar";
import { BuilderProductCard, SkeletonCard } from "./BuilderProductCard";
import { COMPONENT_SECTIONS } from "./pcBuilderConstants";
import { getProductId, getSelectedProduct } from "./pcBuilderUtils";

export function BuilderProductWorkspace({
  activeComponent,
  activeSection,
  activeIndex,
  searchTerm,
  setSearchTerm,
  showFilters,
  setShowFilters,
  availableBrands,
  filterPriceRange,
  setFilterPriceRange,
  filterBrands,
  setFilterBrands,
  filterAiScoreMin,
  setFilterAiScoreMin,
  activeFilterCount,
  activeProducts,
  totalProductsBeforeFilter,
  catalogLoading,
  insights,
  selectedItems,
  handlePickCoolingRecommendation,
  processingComponent,
  loading,
  handleSelectProduct,
  setDetailModalProduct,
  suggestionForm,
  totalPrice,
  compareList,
  setCompareList,
  actions
}) {
  return (
    <>
      {/* Sticky workspace header */}
      <div className="workspace-header">
        <div>
          <span className="workspace-step-badge">
            Bước {activeIndex + 1} / {COMPONENT_SECTIONS.length} — {activeSection.label}
          </span>
          <h2 className="workspace-title">Chọn {activeSection.label} Cho Cấu Hình</h2>
          <p className="workspace-desc">
            {activeComponent === "cooling"
              ? insights.coolingState.required
                ? "CPU của bạn cần tản nhiệt riêng. Chọn Air Cooler hoặc AIO phù hợp."
                : "CPU đã có tản nhiệt đi kèm. Bạn có thể nâng cấp để mát và êm hơn."
              : `Chọn ${activeSection.label} tương thích với cấu hình hiện tại.`}
          </p>
        </div>
        <div className="workspace-search-wrap">
          <span className="workspace-search-icon" aria-hidden>🔍</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Tìm ${activeSection.label}...`}
            aria-label={`Tìm kiếm ${activeSection.label}`}
          />
        </div>
      </div>

      {/* Product workspace body */}
      <div className="workspace-body">
        {/* Advanced Filter Bar */}
        <ProductFilterBar
          isOpen={showFilters}
          onToggle={() => setShowFilters((v) => !v)}
          availableBrands={availableBrands}
          filterPriceRange={filterPriceRange}
          setFilterPriceRange={setFilterPriceRange}
          filterBrands={filterBrands}
          setFilterBrands={setFilterBrands}
          filterAiScoreMin={filterAiScoreMin}
          setFilterAiScoreMin={setFilterAiScoreMin}
          activeFilterCount={activeFilterCount}
          filteredCount={activeProducts.length}
          totalCount={totalProductsBeforeFilter}
        />

        {activeComponent === "cooling" && (
          <div
            className={`context-guide context-guide--${insights?.coolingState?.tone || "info"}`}
            role="note"
          >
            <div>
              <strong className="context-guide__title">{insights?.coolingState?.title}</strong>
              <p className="context-guide__text">
                {selectedItems.cooling
                  ? "Cooling requirement satisfied. Bạn có thể đổi cooler nếu muốn."
                  : insights?.coolingState?.text}
              </p>
            </div>
            {!selectedItems.cooling && (
              <button
                type="button"
                className="context-guide__btn"
                onClick={handlePickCoolingRecommendation}
                disabled={processingComponent === "cooling" || activeProducts.length === 0}
              >
                AI Gợi ý Cooling
              </button>
            )}
          </div>
        )}

        {/* Product Grid */}
        {catalogLoading ? (
          <div className="product-grid">
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : activeProducts.length === 0 ? (
          <div className="product-grid">
            <div className="workspace-state">
              <div className="workspace-state__icon">🔍</div>
              <div className="workspace-state__title">Không tìm thấy sản phẩm</div>
              <p className="workspace-state__desc">
                Thử từ khóa khác hoặc xóa bộ lọc để xem toàn bộ {activeSection.label}.
              </p>
            </div>
          </div>
        ) : (
          <div
            className="product-grid"
            role="list"
            aria-label={`Danh sách ${activeSection.label}`}
          >
            {activeProducts.map((product) => {
              const productId = getProductId(product);
              const selected = selectedItems[activeComponent];
              const isSelected =
                String(getProductId(getSelectedProduct(selected))) === String(productId);
              return (
                <div key={`${activeComponent}-${productId}`} role="listitem">
                  <BuilderProductCard
                    activeComponent={activeComponent}
                    isSelected={isSelected}
                    loading={loading}
                    onSelect={handleSelectProduct}
                    onOpenDetail={(prod) => setDetailModalProduct(prod)}
                    processingComponent={processingComponent}
                    product={product}
                    selectedItems={selectedItems}
                    suggestionForm={suggestionForm}
                    totalPrice={totalPrice}
                    isCompared={compareList.some(
                      (p) => (p.product_id || p.id) === productId
                    )}
                    onToggleCompare={(prod, isChecked) => {
                      if (isChecked) {
                        if (compareList.length >= 3) {
                          if (actions?.setError) {
                            actions.setError("Chỉ hỗ trợ so sánh tối đa 3 sản phẩm cùng lúc.");
                          }
                          return;
                        }
                        setCompareList((prev) => [
                          ...prev.filter((p) => (p.product_id || p.id) !== productId),
                          prod
                        ]);
                      } else {
                        setCompareList((prev) =>
                          prev.filter((p) => (p.product_id || p.id) !== productId)
                        );
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
