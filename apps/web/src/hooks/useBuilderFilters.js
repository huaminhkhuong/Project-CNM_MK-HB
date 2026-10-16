import { useState, useMemo } from "react";
import { getProductPrice, getProductBrand, estimateProductPerformance } from "../components/pc-builder/pcBuilderUtils";

/**
 * useBuilderFilters — Quản lý bộ lọc sản phẩm (khoảng giá, thương hiệu, điểm hiệu năng AI)
 */
export function useBuilderFilters(catalogProducts = [], activeComponent = "cpu") {
  const [showFilters, setShowFilters] = useState(false);
  const [filterPriceRange, setFilterPriceRange] = useState({ min: 0, max: 0 });
  const [filterBrands, setFilterBrands] = useState([]);
  const [filterAiScoreMin, setFilterAiScoreMin] = useState(0);

  // Danh sách thương hiệu khả dụng dựa trên sản phẩm trong danh mục hiện tại
  const availableBrands = useMemo(() => {
    const brandSet = new Set();
    catalogProducts.forEach((p) => {
      const b = getProductBrand(p);
      if (b && b !== "PC Mall") brandSet.add(b);
    });
    return Array.from(brandSet).sort();
  }, [catalogProducts]);

  // Đếm số lượng bộ lọc đang kích hoạt
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterPriceRange.min > 0 || filterPriceRange.max > 0) count++;
    if (filterBrands.length > 0) count++;
    if (filterAiScoreMin > 0) count++;
    return count;
  }, [filterPriceRange, filterBrands, filterAiScoreMin]);

  // Lọc sản phẩm
  const filterProducts = (products = []) => {
    return products.filter((product) => {
      const price = getProductPrice(product);
      if (filterPriceRange.min > 0 && price < filterPriceRange.min) return false;
      if (filterPriceRange.max > 0 && price > filterPriceRange.max) return false;

      if (filterBrands.length > 0) {
        const brand = getProductBrand(product);
        if (!filterBrands.includes(brand)) return false;
      }

      if (filterAiScoreMin > 0) {
        const score = estimateProductPerformance(product, activeComponent);
        if (score < filterAiScoreMin) return false;
      }

      return true;
    });
  };

  const resetFilters = () => {
    setFilterPriceRange({ min: 0, max: 0 });
    setFilterBrands([]);
    setFilterAiScoreMin(0);
  };

  return {
    showFilters,
    setShowFilters,
    filterPriceRange,
    setFilterPriceRange,
    filterBrands,
    setFilterBrands,
    filterAiScoreMin,
    setFilterAiScoreMin,
    availableBrands,
    activeFilterCount,
    filterProducts,
    resetFilters
  };
}
