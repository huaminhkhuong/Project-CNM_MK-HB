import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { usePcBuilder } from "../../hooks/usePcBuilder";
import { routeConfig } from "../../routes/routeConfig";
import { addItemToCart } from "../../services/cart.service";
import { getProductDetail } from "../../services/catalog.service";
import {
  calculateBuilderInsights,
  pickRecommendedCoolingProduct
} from "../../components/pc-builder/builderInsightsCalculator";
import {
  loadWorkspaceSession,
  saveWorkspaceSession,
  formatSessionTimeAgo
} from "../../components/pc-builder/builderSessionStorage";
import {
  loadBuilderCatalog,
  extractAvailableBrands,
  filterProducts
} from "../../components/pc-builder/builderCatalogLoader";
import { useBuilderRecommendation } from "../../components/pc-builder/useBuilderRecommendation";
import { BuilderProductWorkspace } from "../../components/pc-builder/BuilderProductWorkspace";
import { BuilderBudgetExceededBanner } from "../../components/pc-builder/BuilderBudgetExceededBanner";
import { BuilderFloatingCompareBar } from "../../components/pc-builder/BuilderFloatingCompareBar";
import { BuilderBatchOverlay } from "../../components/pc-builder/BuilderBatchOverlay";
import { XAIExplanationDrawer } from "../../components/pc-builder/XAIExplanationDrawer";
import { AIAdvisorDrawer } from "../../components/pc-builder/AIAdvisorDrawer";
import { ProductDetailModal } from "../../components/pc-builder/ProductDetailModal";
import { RequirementWizardModal } from "../../components/pc-builder/RequirementWizardModal";
import { CandidateBuildsPanel } from "../../components/pc-builder/CandidateBuildsPanel";
import { WhatIfComparisonPanel } from "../../components/pc-builder/WhatIfComparisonPanel";
import { FinalReviewModal } from "../../components/pc-builder/FinalReviewModal";
import { CompareDrawer } from "../../components/pc-builder/CompareDrawer";
import { BuilderSummaryPanel } from "../../components/pc-builder/BuilderSummaryPanel";
import { ComponentSectionList } from "../../components/pc-builder/ComponentSectionList";
import { InsightsPanel } from "../../components/pc-builder/InsightsPanel";
import { AIControlPanel } from "../../components/pc-builder/AIControlPanel";
import { exportBuildToPdf } from "../../components/pc-builder/BuildExportService";
import { CompatibilityToast } from "../../components/pc-builder/CompatibilityToast";
import { GuestBuildsAndHistory } from "../../components/pc-builder/GuestBuildsAndHistory";
import { BuildSummarySidebar } from "../../components/pc-builder/BuildSummarySidebar";
import { httpClient } from "../../services/http";
import {
  COMPONENT_SECTIONS,
  PRESET_BUILDS
} from "../../components/pc-builder/pcBuilderConstants";
import {
  formatCurrency,
  getEnvelopeData,
  getProductId,
  getProductName,
  getProductPrice,
  getSelectedProduct,
  getVariantId,
  getItemPrice
} from "../../components/pc-builder/pcBuilderUtils";
import "./PcBuilderPage.css";

export { calculateBuilderInsights };

/* ── MAIN PAGE COMPONENT ─────────────────────────────────────── */
export function PcBuilderPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationHandledRef = useRef(false);

  const {
    buildName,
    totalPrice,
    selectedItems,
    selectedCount,
    activeBuildId,
    loading,
    error,
    success,
    compatibility,
    guestBuildList,
    actions
  } = usePcBuilder();

  // Handle incoming build state navigation (e.g. from catalog or AI chat)
  useEffect(() => {
    if (locationHandledRef.current) return;
    const state = location?.state;
    if (!state) return;

    if (state.loadBuild) {
      locationHandledRef.current = true;
      const comps = state.loadBuild.components || [];
      const itemsList = (Array.isArray(comps) ? comps : Object.values(comps))
        .map((item) => ({
          componentType: item.componentType || (item.categoryName || "").toLowerCase(),
          product: {
            id: item.id || item.productId,
            name: item.name || item.productName,
            slug: item.slug,
            price: item.price,
            categoryName: item.categoryName,
            brandName: item.brandName
          },
          variant: {
            variant_id: item.skuId || item.id,
            sku: item.sku || "",
            price: Number(item.price || 0),
            image_url: item.imageUrl || ""
          }
        }))
        .filter((x) => x.componentType && x.product.id);

      if (itemsList.length > 0) {
        actions.batchApplyComponents(itemsList);
        setLocalMessage(`🤖 Đã tự động nạp cấu hình đề xuất (${itemsList.length} linh kiện) từ AI vào Workspace!`);
      }
    } else if (state.loadItem || state.productId) {
      locationHandledRef.current = true;
      const p = state.loadItem || {
        id: state.productId,
        name: state.productName,
        skuId: state.skuId
      };
      const cType = p.componentType || (p.categoryName || "").toLowerCase();
      if (cType && (p.id || p.productId)) {
        actions.applyComponent(
          cType,
          p.skuId || p.id,
          {
            id: p.id || p.productId,
            name: p.name || p.productName,
            slug: p.slug,
            price: p.price,
            categoryName: p.categoryName,
            brandName: p.brandName
          },
          [
            {
              variant_id: p.skuId || p.id,
              sku: p.sku || "",
              price: Number(p.price || 0),
              image_url: p.imageUrl || ""
            }
          ]
        );
        setLocalMessage(`Đã nạp ${p.name || p.productName} vào khe ${cType.toUpperCase()}.`);
      }
    }
  }, [location?.state, actions]);

  const [optionsByComponent, setOptionsByComponent] = useState({});
  const [catalogLoading, setCatalogLoading] = useState(true);

  /* ── WORKSPACE SESSION — Lazy initializers từ localStorage ─── */
  const [activeComponent, setActiveComponent] = useState(() => {
    const s = loadWorkspaceSession();
    return COMPONENT_SECTIONS.some((c) => c.componentType === s.activeComponent)
      ? s.activeComponent
      : "cpu";
  });
  const [processingComponent, setProcessingComponent] = useState("");
  const [searchTerm, setSearchTerm] = useState(() => {
    const s = loadWorkspaceSession();
    return typeof s.searchTerm === "string" ? s.searchTerm : "";
  });
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  // Debounce search input (200ms) for 60fps typing
  useEffect(() => {
    if (!searchTerm) {
      setDebouncedSearchTerm("");
      return;
    }
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 200);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const [suggestionForm, setSuggestionForm] = useState(() => {
    const DEFAULTS = { purpose: "gaming", budget: "25000000", resolution: "1080p", preference: "value", futureNeed: "none" };
    const s = loadWorkspaceSession();
    return s.suggestionForm ? { ...DEFAULTS, ...s.suggestionForm } : DEFAULTS;
  });

  const [localMessage, setLocalMessage] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState(() => {
    const s = loadWorkspaceSession();
    return PRESET_BUILDS.some((p) => p.id === s.selectedPresetId) ? s.selectedPresetId : "gaming";
  });

  const [isXaiDrawerOpen, setIsXaiDrawerOpen] = useState(false);
  const [isAiAdvisorDrawerOpen, setIsAiAdvisorDrawerOpen] = useState(false);
  const [backendXaiReport, setBackendXaiReport] = useState(null);
  const [isXaiLoading, setIsXaiLoading] = useState(false);
  const [detailModalProduct, setDetailModalProduct] = useState(null);
  const [isReqWizardOpen, setIsReqWizardOpen] = useState(false);
  const [isFinalReviewOpen, setIsFinalReviewOpen] = useState(false);
  const [compareList, setCompareList] = useState([]);
  const [isCompareDrawerOpen, setIsCompareDrawerOpen] = useState(false);
  const [userBuildsHistory, setUserBuildsHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const sessionSaveTimerRef = useRef(null);

  /* ── ADVANCED FILTER STATE ──────────────────────────────── */
  const [showFilters, setShowFilters] = useState(false);
  const [filterPriceRange, setFilterPriceRange] = useState({ min: 0, max: 0 });
  const [filterBrands, setFilterBrands] = useState([]);
  const [filterAiScoreMin, setFilterAiScoreMin] = useState(0);

  /* ── COMPATIBILITY CHANGE TOAST DETECTOR ────────────────────── */
  const [activeCompatToast, setActiveCompatToast] = useState(null);
  const prevChecksRef = useRef(null);

  // Debounced session save (800ms)
  useEffect(() => {
    clearTimeout(sessionSaveTimerRef.current);
    sessionSaveTimerRef.current = setTimeout(() => {
      saveWorkspaceSession({ activeComponent, searchTerm, suggestionForm, selectedPresetId });
    }, 800);
    return () => clearTimeout(sessionSaveTimerRef.current);
  }, [activeComponent, searchTerm, suggestionForm, selectedPresetId]);

  // Session restore notification on initial mount
  useEffect(() => {
    const s = loadWorkspaceSession();
    if (!s.savedAt) return;
    const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - s.savedAt > SESSION_MAX_AGE_MS) return;

    const isNonDefault =
      (s.activeComponent && s.activeComponent !== "cpu") ||
      (typeof s.searchTerm === "string" && s.searchTerm.length > 0) ||
      (s.selectedPresetId && s.selectedPresetId !== "gaming") ||
      (s.suggestionForm?.budget && s.suggestionForm.budget !== "25000000") ||
      (s.suggestionForm?.purpose && s.suggestionForm.purpose !== "gaming");

    if (isNonDefault) {
      const timeAgo = formatSessionTimeAgo(s.savedAt);
      setLocalMessage(
        `🔄 Workspace đã khôi phục từ phiên ${timeAgo}` +
        (s.activeComponent && s.activeComponent !== "cpu"
          ? ` (đang xem: ${s.activeComponent.toUpperCase()})`
          : "")
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSection = COMPONENT_SECTIONS.find((s) => s.componentType === activeComponent) || COMPONENT_SECTIONS[0];
  const activeIndex = COMPONENT_SECTIONS.findIndex((s) => s.componentType === activeComponent);
  const insights = useMemo(
    () => calculateBuilderInsights(selectedItems, selectedCount, suggestionForm),
    [selectedItems, selectedCount, suggestionForm]
  );
  const completionPercent = Math.round(
    (Math.min(selectedCount, insights.requiredCount) / insights.requiredCount) * 100
  );

  // Realtime compatibility transition watcher
  useEffect(() => {
    const currentChecks = insights.checks || [];
    const prevChecksMap = prevChecksRef.current;
    const currentChecksMap = new Map();
    currentChecks.forEach((c) => currentChecksMap.set(c.label, c));

    if (prevChecksMap) {
      const newlyFailed = currentChecks.find((c) => {
        if (c.ok) return false;
        const prev = prevChecksMap.get(c.label);
        return prev && prev.ok === true;
      });

      if (newlyFailed) {
        let title = "Phát Hiện Xung Đột Tương Thích!";
        let message = newlyFailed.detail || "Linh kiện mới vừa chọn gây ra mất tương thích với cấu hình hiện tại.";
        const type = newlyFailed.severity === "BLOCKER" || newlyFailed.ok === false ? "error" : "warning";

        if (newlyFailed.label.includes("COMP-001") || newlyFailed.label.includes("Socket")) {
          title = "⛔ Xung Đột Socket CPU ↔ Mainboard";
          message = "CPU vừa chọn có chân cắm (Socket) không tương thích với Mainboard hiện tại. Vui lòng đổi CPU hoặc Mainboard cùng socket!";
        } else if (newlyFailed.label.includes("COMP-002") || newlyFailed.label.includes("RAM")) {
          title = "⛔ Chuẩn RAM Không Tương Thích Mainboard";
          message = "Loại RAM vừa chọn không cắm vừa khe Mainboard hiện tại (ví dụ: RAM DDR5 trên Mainboard DDR4).";
        } else if (newlyFailed.label.includes("COMP-007") || newlyFailed.label.includes("Nguồn")) {
          title = "⚠️ PSU Nguồn Không Đủ Công Suất";
          message = "Bộ nguồn PSU đã chọn có công suất thấp hơn tổng điện năng yêu cầu của cấu hình.";
        } else if (newlyFailed.label.includes("COMP-010") || newlyFailed.label.includes("Form Factor")) {
          title = "⛔ Kích Thước Mainboard ↔ Case Không Vừa";
          message = "Kích thước Mainboard quá lớn so với chuẩn vỏ Case đã chọn.";
        } else if (newlyFailed.label.includes("COMP-004") || newlyFailed.label.includes("GPU")) {
          title = "⛔ Card Màn Hình Quá Dài So Với Case";
          message = "Chiều dài Card GPU vượt quá chiều dài khoang chứa khả dụng của vỏ Case.";
        }

        setActiveCompatToast({
          id: Date.now(),
          type,
          title,
          message,
          detail: newlyFailed.detail ? `Chi tiết: ${newlyFailed.detail}` : null,
        });
      } else {
        const prevFailedCount = Array.from(prevChecksMap.values()).filter((c) => c.ok === false).length;
        const currentFailedCount = currentChecks.filter((c) => c.ok === false).length;

        if (prevFailedCount > 0 && currentFailedCount === 0 && selectedCount > 0) {
          setActiveCompatToast({
            id: Date.now(),
            type: "success",
            title: "✅ Đã Khắc Phục Xung Đột Tương Thích",
            message: "Tất cả linh kiện trong cấu hình hiện tại đã đạt trạng thái 100% tương thích!",
          });
        }
      }
    }

    prevChecksRef.current = currentChecksMap;
  }, [insights.checks, selectedCount]);

  /* Budget Calculation */
  const BUDGET_WARN_THRESHOLD = 1.05;
  const BUDGET_BLOCK_THRESHOLD = 1.10;
  const userBudget = Number(suggestionForm.budget || 25000000);
  const isBudgetWarning = totalPrice > 0 && userBudget > 0 && totalPrice > userBudget * BUDGET_WARN_THRESHOLD;
  const isBudgetBlocked = totalPrice > 0 && userBudget > 0 && totalPrice > userBudget * BUDGET_BLOCK_THRESHOLD;
  const isBudgetExceeded = isBudgetWarning;
  const budgetDiff = totalPrice - userBudget;
  const budgetExceededPercent = Math.round((budgetDiff / userBudget) * 100);

  const mostExpensiveComponent = useMemo(() => {
    if (!selectedItems) return null;
    let highest = null;
    let maxPrice = 0;
    Object.entries(selectedItems).forEach(([type, item]) => {
      const p = getSelectedProduct(item);
      const price = getItemPrice(item);
      if (price > maxPrice) {
        maxPrice = price;
        highest = { type: type.toUpperCase(), name: getProductName(p), price };
      }
    });
    return highest;
  }, [selectedItems]);

  /* Backend XAI Check-Compatibility */
  async function fetchBackendXaiCompatibility() {
    const rawComponents = Object.entries(selectedItems || {})
      .map(([type, item]) => {
        const vId = getVariantId(item);
        return vId ? { component_type: type, variant_id: Number(vId) } : null;
      })
      .filter(Boolean);

    if (rawComponents.length < 2) {
      setBackendXaiReport(null);
      return;
    }

    setIsXaiLoading(true);
    try {
      const res = await httpClient.post("/pc-builder/check-compatibility", {
        components: rawComponents
      });
      const data = res?.data?.data || res?.data || res;
      if (data?.checks) {
        setBackendXaiReport(data);
      }
    } catch (err) {
      console.warn("Backend XAI compatibility check failed, using frontend fallback", err);
    } finally {
      setIsXaiLoading(false);
    }
  }

  async function handleOpenXaiDrawer() {
    setIsXaiDrawerOpen(true);
    await fetchBackendXaiCompatibility();
  }

  const xaiReport = useMemo(() => {
    if (backendXaiReport?.checks) return backendXaiReport;
    if (compatibility?.checks) return compatibility;
    const si = insights || { checks: [], warningCount: 0, compatibilityScore: 100, fps: 120, recommendation: "", buildReadiness: "READY", scores: {} };
    const fps = Number(si.fps || 120);
    return {
      compatible: si.warningCount === 0,
      score: Number(si.compatibilityScore || 100),
      buildReadiness: si.buildReadiness || "READY",
      scores: si.scores || { compatibilityScore: 90, performanceScore: 85, valueScore: 88, powerThermalScore: 92, upgradeScore: 80, requirementMatchScore: 88 },
      checks: (Array.isArray(si?.checks) ? si.checks : []).map((c) => ({
        key: c?.label || "Kiểm tra", ok: Boolean(c?.ok), detail: c?.detail || "",
        explanation: {
          short: c?.ok ? `✅ ${c?.label}: Hoạt động tốt` : `⚠️ ${c?.label}: Cần xem xét`,
          long: c?.detail || "Không có xung đột kỹ thuật phát hiện.",
          level: c?.ok ? "success" : "warning",
          suggestion: c?.ok ? undefined : "Vui lòng kiểm tra lại linh kiện này để tối ưu hơn."
        }
      })),
      summary: {
        passedChecks: (si.checks || []).filter((c) => c?.ok).length,
        failedChecks: 0,
        warningChecks: (si.checks || []).filter((c) => !c?.ok).length,
        overallMessage: si.recommendation || "Cấu hình được đánh giá tối ưu."
      },
      performanceEstimate: {
        score: Math.min(99, Math.round(fps / 2.2)),
        grade: fps > 180 ? "Enthusiast" : fps > 120 ? "High-end" : "Mid-range",
        estimatedFps: { esports1080p: fps, aaa1080p: Math.round(fps * 0.45), rendering4k: fps > 140 ? "Rất mượt (< 5 phút)" : "Khá mượt (5–15 phút)" }
      }
    };
  }, [backendXaiReport, compatibility, insights]);

  const hasBlockerSeverity = useMemo(() => {
    const checks = xaiReport?.checks || [];
    return checks.some((c) => c.severity === "BLOCKER" || (c.ok === false && c.severity !== "WARNING" && c.severity !== "ADVISORY"));
  }, [xaiReport]);

  const blockerReasonTooltip = useMemo(() => {
    if (!hasBlockerSeverity) return "";
    const checks = xaiReport?.checks || [];
    const blockerCheck = checks.find((c) => c.severity === "BLOCKER" || (c.ok === false && c.severity !== "WARNING" && c.severity !== "ADVISORY"));
    let label = blockerCheck?.explanation?.short || blockerCheck?.key || blockerCheck?.label || "Vấn đề tương thích";
    label = label.replace(/\[COMP-\d+\]/gi, "").replace(/\[BLOCKER\]/gi, "").replace(/^[❌⚠️⛔\s]+/, "").trim();
    let detail = blockerCheck?.detail || "";
    detail = detail.replace(/\[COMP-\d+\]/gi, "").replace(/\[BLOCKER\]/gi, "").replace(/^[❌⚠️⛔\s]+/, "").trim();
    return `Lưu ý kỹ thuật: ${label}${detail ? ` (${detail})` : ""}. Vui lòng đổi linh kiện để tối ưu mua hàng.`;
  }, [hasBlockerSeverity, xaiReport]);

  /* Catalog loader integration */
  const loadCatalog = useCallback(async (forceRefresh = false) => {
    setCatalogLoading(true);
    const result = await loadBuilderCatalog(forceRefresh);
    setOptionsByComponent(result.data);
    setCatalogLoading(false);
    return result.data;
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  async function handleRefreshCatalog() {
    setLocalMessage("🔄 Đang làm mới danh mục linh kiện trực tiếp từ máy chủ...");
    await loadCatalog(true);
    setLocalMessage("✅ Đã cập nhật danh mục linh kiện mới nhất từ máy chủ!");
  }

  /* Brands & Filter derived state */
  const availableBrands = useMemo(
    () => extractAvailableBrands(optionsByComponent, activeComponent),
    [optionsByComponent, activeComponent]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterPriceRange.min > 0 || filterPriceRange.max > 0) count++;
    count += filterBrands.length;
    if (filterAiScoreMin > 0) count++;
    return count;
  }, [filterPriceRange, filterBrands, filterAiScoreMin]);

  const activeProducts = useMemo(() => {
    return filterProducts(optionsByComponent, activeComponent, {
      searchTerm: debouncedSearchTerm,
      filterPriceRange,
      filterBrands,
      filterAiScoreMin
    });
  }, [optionsByComponent, activeComponent, debouncedSearchTerm, filterPriceRange, filterBrands, filterAiScoreMin]);

  const totalProductsBeforeFilter = useMemo(() => {
    return filterProducts(optionsByComponent, activeComponent, {
      searchTerm: debouncedSearchTerm
    }).length;
  }, [optionsByComponent, activeComponent, debouncedSearchTerm]);

  useEffect(() => {
    setFilterBrands([]);
    setFilterPriceRange({ min: 0, max: 0 });
    setFilterAiScoreMin(0);
    setShowFilters(false);
  }, [activeComponent]);

  const visibleChecks = useMemo(() => insights.checks.slice(0, 6), [insights.checks]);

  const aiInsightText = useMemo(() => {
    if (selectedCount === 0) {
      return (
        <span>
          Bắt đầu cấu hình bằng cách chọn <strong>CPU</strong> hoặc sử dụng <strong>Gợi Ý Cấu Hình AI</strong> để hoàn thiện nhanh.
        </span>
      );
    }
    if (selectedCount < insights.requiredCount) {
      return (
        <span>
          Đã chọn <strong>{selectedCount}/{insights.requiredCount} linh kiện</strong>. Tiếp tục bổ sung để hoàn thiện cấu hình và nhận đánh giá hiệu năng chính xác.
        </span>
      );
    }
    return (
      <span>
        Cấu hình đạt trạng thái <strong>BUILD READY</strong> với điểm tương thích <strong>{xaiReport?.score || 96}/100</strong>. Hiệu năng ước tính: <strong>{insights?.fps || 165} FPS</strong> Gaming. Sẵn sàng đặt hàng!
      </span>
    );
  }, [selectedCount, insights, xaiReport]);

  /* Fetch User Saved Builds History */
  useEffect(() => {
    if (!isAuthenticated) {
      setUserBuildsHistory([]);
      return;
    }
    let isMounted = true;
    async function fetchHistory() {
      setIsHistoryLoading(true);
      try {
        const res = await httpClient.get("/pc-builder/my-builds");
        const data = res.data?.data || res.data;
        if (isMounted && Array.isArray(data)) {
          setUserBuildsHistory(data);
        }
      } catch (err) {
        console.warn("Failed to fetch user build history:", err);
      } finally {
        if (isMounted) setIsHistoryLoading(false);
      }
    }
    fetchHistory();
    return () => { isMounted = false; };
  }, [isAuthenticated]);

  /* Select product handler */
  async function handleSelectProduct(type, product, isBatchApply = false) {
    const productId = getProductId(product);
    if (!productId) return;

    if (!isBatchApply) {
      setProcessingComponent(type);
      setLocalMessage("");
    }

    try {
      const response = await getProductDetail(productId);
      const detail = getEnvelopeData(response, product);
      const rawVariants = detail?.variants || detail?.skus || detail?.ProductSku || detail?.productSkus || [];
      const safeVariantsArray = Array.isArray(rawVariants) ? rawVariants : [];
      let variants = safeVariantsArray.map((v) => ({
        ...v,
        variant_id: v.variant_id || v.id,
        sku: v.sku || `SKU-${v.id}`,
        price: Number(v.price || getProductPrice(product) || 0),
        stock: Number(v.stock !== undefined ? v.stock : v.stock_quantity !== undefined ? v.stock_quantity : 0)
      }));

      if (variants.length === 0) {
        variants = [{
          variant_id: productId || product.id || 1,
          sku: `SKU-${productId || 1}`,
          price: getProductPrice(product) || 1000000,
          stock: 10
        }];
      }

      let selectedVariant = variants.find((v) => v.stock > 0) || variants[0];
      if (!selectedVariant?.variant_id) {
        selectedVariant = {
          variant_id: productId || product.id || 1,
          sku: `SKU-${productId || 1}`,
          price: getProductPrice(product) || 1000000,
          stock: 10
        };
      }

      await actions.applyComponent(type, selectedVariant.variant_id, { ...product, ...detail }, variants);
    } catch (err) {
      console.warn("Product detail fetch warning, fallback applying product", err);
      const fallbackVariant = {
        variant_id: productId || product.id || 1,
        sku: `SKU-${productId || 1}`,
        price: getProductPrice(product) || 1000000,
        stock: 10
      };
      await actions.applyComponent(type, fallbackVariant.variant_id, product, [fallbackVariant]);
    } finally {
      if (!isBatchApply) {
        setProcessingComponent("");
      }
    }
  }

  /* Recommendation Hook (AI Auto-Build, What-If simulation, Candidate Builds) */
  const {
    isAutoBuilding,
    candidateBuilds,
    activeCandidateTab,
    setActiveCandidateTab,
    whatIfModalOpen,
    setWhatIfModalOpen,
    whatIfCurrentSnapshot,
    whatIfSimulatedBuild,
    whatIfDeltaBudget,
    isWhatIfLoading,
    handleAutoRecommend,
    handleRunWhatIf,
    handleApplyCandidateBuild
  } = useBuilderRecommendation({
    optionsByComponent,
    selectedItems,
    totalPrice,
    selectedCount,
    selectedPresetId,
    suggestionForm,
    actions,
    insights,
    backendXaiReport,
    setLocalMessage,
    setProcessingComponent,
    loadCatalog,
    handleSelectProduct,
    setActiveComponent,
    setSearchTerm
  });

  function handleRequirementSubmit(profile) {
    setSuggestionForm({
      purpose: profile.purpose || "gaming",
      budget: String(profile.budget || 25000000),
      resolution: profile.resolution || "1080p",
      preference: profile.preference || "value",
      futureNeed: profile.futureNeed || "none"
    });
    handleAutoRecommend(profile);
  }

  async function handlePickCoolingRecommendation() {
    const products = optionsByComponent.cooling || [];
    const target = Number(suggestionForm.budget || 0) * 0.03;
    const product = pickRecommendedCoolingProduct(products, selectedItems, target);
    if (!product) {
      if (actions.setError) actions.setError("Chưa tìm thấy tản nhiệt phù hợp trong danh mục.");
      return;
    }
    await handleSelectProduct("cooling", product);
  }

  async function handleAddAllToCart() {
    const ids = Object.values(selectedItems).map(getVariantId).filter(Boolean);
    if (ids.length === 0) {
      if (actions.setError) actions.setError("Chưa có linh kiện để thêm vào giỏ hàng.");
      return;
    }
    if (!isAuthenticated) {
      navigate(routeConfig.public.login);
      return;
    }
    setProcessingComponent("cart");
    try {
      await Promise.all(ids.map((productVariantId) => addItemToCart({ productVariantId, quantity: 1 })));
      setLocalMessage("✅ Đã thêm toàn bộ linh kiện vào giỏ hàng.");
    } catch {
      if (actions.setError) actions.setError("Không thể thêm toàn bộ linh kiện vào giỏ hàng.");
    } finally {
      setProcessingComponent("");
    }
  }

  async function handleBuyWholeBuild() {
    const ids = Object.values(selectedItems).map(getVariantId).filter(Boolean);
    if (ids.length === 0) {
      if (actions.setError) actions.setError("Chưa có linh kiện để mua.");
      return;
    }
    if (!isAuthenticated) {
      navigate(routeConfig.public.login);
      return;
    }
    setIsFinalReviewOpen(true);
  }

  async function executeBuyWholeBuild() {
    const ids = Object.values(selectedItems).map(getVariantId).filter(Boolean);
    setProcessingComponent("cart");
    setIsFinalReviewOpen(false);
    try {
      await Promise.all(ids.map((productVariantId) => addItemToCart({ productVariantId, quantity: 1 })));
      setLocalMessage("✅ Đã xác nhận & nạp toàn bộ linh kiện vào giỏ hàng. Đang chuyển đến trang thanh toán...");
      navigate(routeConfig.public.checkout);
    } catch {
      if (actions.setError) actions.setError("Không thể mua nguyên bộ cấu hình.");
    } finally {
      setProcessingComponent("");
    }
  }

  async function handleShareBuild() {
    setLocalMessage("Đang tạo link chia sẻ...");
    const targetBuildId = activeBuildId || actions.activeBuildId;
    try {
      if (isAuthenticated && targetBuildId) {
        const response = await httpClient.post(`/pc-builder/${targetBuildId}/publish`);
        const shareToken = response.data?.data?.shareToken || response.data?.shareToken;
        if (shareToken) {
          const url = `${window.location.origin}/pc-builder/shared/${shareToken}`;
          await navigator.clipboard.writeText(url);
          setLocalMessage(`🔗 Đã sao chép link chia sẻ: ${url}`);
          return;
        }
      }
      const text = `${buildName} — ${formatCurrency(totalPrice)}đ\n${COMPONENT_SECTIONS.map((s) => {
        const item = selectedItems[s.componentType];
        return `${s.label}: ${item ? getProductName(getSelectedProduct(item)) : "Chưa chọn"}`;
      }).join("\n")}`;
      await navigator.clipboard.writeText(text);
      setLocalMessage("✅ Đã sao chép thông tin cấu hình vào clipboard.");
    } catch {
      setLocalMessage("Vui lòng đăng nhập và lưu cấu hình để tạo link chia sẻ công khai.");
    }
  }

  function handlePreset(preset) {
    if (!preset) return;
    const presetId = preset.id || "gaming";
    setSelectedPresetId(presetId);
    setActiveCompatToast(null);
    const parsedBudget = Number(preset.budget) || 25000000;
    const nextForm = {
      purpose: preset.useCase || preset.category || "gaming",
      budget: parsedBudget
    };
    setSuggestionForm((prev) => ({
      ...prev,
      ...nextForm
    }));
    handleAutoRecommend(preset);
  }

  useEffect(() => {
    if (localMessage) {
      const timer = setTimeout(() => setLocalMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [localMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        if (actions.setError) actions.setError("");
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [error, actions]);

  function handleExportPdf() {
    exportBuildToPdf({
      buildName: buildName || "Cấu hình AI PC Mall",
      selectedItems,
      totalPrice,
      insights,
      xaiReport: backendXaiReport || {},
      suggestionForm
    });
  }

  /* ── RENDER ──────────────────────────────────────────────── */
  return (
    <div className="builder-page">
      {/* ── FLOATING COMPATIBILITY TOAST NOTIFICATION ──────────── */}
      <CompatibilityToast
        toast={activeCompatToast}
        onClose={() => setActiveCompatToast(null)}
        onOpenXai={handleOpenXaiDrawer}
      />

      {/* ── TOPBAR SUMMARY PANEL ──────────────────────────── */}
      <BuilderSummaryPanel
        selectedPresetId={selectedPresetId}
        onSelectPreset={handlePreset}
        presets={PRESET_BUILDS}
        onOpenReqWizard={() => setIsReqWizardOpen(true)}
        onOpenXaiDrawer={handleOpenXaiDrawer}
        onAutoBuild={handleAutoRecommend}
        isAutoBuilding={isAutoBuilding}
        budget={suggestionForm.budget}
        onRefreshCatalog={handleRefreshCatalog}
        onClearAll={actions.clearAll}
        selectedCount={selectedCount}
        onExportPdf={handleExportPdf}
      />

      {/* ── INDEPENDENT NOTIFICATION BANNERS ───────────────────── */}
      {(error || success || localMessage) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
          {error && (
            <div
              className="builder-alert builder-alert--danger"
              role="alert"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <span>⛔ {error}</span>
              <button
                type="button"
                onClick={() => {
                  if (actions.setError) actions.setError("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#be123c",
                  fontWeight: "800",
                  cursor: "pointer",
                  fontSize: "16px",
                  marginLeft: "10px"
                }}
              >
                ×
              </button>
            </div>
          )}

          {(success || localMessage) && !error && (
            <div
              className="builder-alert builder-alert--success"
              role="alert"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <span>{success || localMessage}</span>
              <button
                type="button"
                onClick={() => setLocalMessage("")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#047857",
                  fontWeight: "800",
                  cursor: "pointer",
                  fontSize: "16px",
                  marginLeft: "10px"
                }}
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MAIN BODY ─────────────────────────────────────── */}
      <div className="builder-body">
        <div className="builder-layout">
          {/* ═══ COLUMN 1: LEFT SIDEBAR — BUILD PROGRESS ═══════ */}
          <aside className="builder-sidebar" aria-label="Build progress">
            <ComponentSectionList
              sections={COMPONENT_SECTIONS}
              selectedItems={selectedItems}
              activeComponent={activeComponent}
              setActiveComponent={setActiveComponent}
              setSearchTerm={setSearchTerm}
              insights={insights}
              onRemoveComponent={actions.removeComponent}
              onClearAll={actions.clearAll}
              completionPercent={completionPercent}
            />

            <div className="sidebar-divider" />

            <AIControlPanel
              suggestionForm={suggestionForm}
              setSuggestionForm={setSuggestionForm}
              onAutoRecommend={handleAutoRecommend}
              isAutoBuilding={isAutoBuilding}
            />

            <div className="sidebar-divider" />

            <InsightsPanel insights={insights} />

            <GuestBuildsAndHistory
              isAuthenticated={isAuthenticated}
              guestBuildList={guestBuildList}
              userBuildsHistory={userBuildsHistory}
              isHistoryLoading={isHistoryLoading}
              onLoadGuestBuild={actions.loadGuestBuildById}
              onCreateGuestBuild={actions.createNewGuestBuild}
              onApplyUserBuild={handleApplyCandidateBuild}
              formatCurrency={formatCurrency}
            />
          </aside>

          {/* ═══ COLUMN 2: CENTER WORKSPACE ════════════════════ */}
          <main className="builder-center" id="workspace">
            {candidateBuilds && (
              <CandidateBuildsPanel
                candidateBuilds={candidateBuilds}
                activeCandidateTab={activeCandidateTab}
                onSelectCandidateTab={setActiveCandidateTab}
                onApplyCandidateBuild={handleApplyCandidateBuild}
                isApplying={processingComponent === "apply-candidate"}
              />
            )}

            <BuilderBudgetExceededBanner
              isBudgetExceeded={isBudgetExceeded}
              isBudgetBlocked={isBudgetBlocked}
              budgetExceededPercent={budgetExceededPercent}
              budgetDiff={budgetDiff}
              userBudget={userBudget}
              totalPrice={totalPrice}
              mostExpensiveComponent={mostExpensiveComponent}
              candidateBuilds={candidateBuilds}
              onApplyBudgetSafe={() => {
                setActiveCandidateTab("budgetSafe");
                handleApplyCandidateBuild(candidateBuilds.budgetSafe);
              }}
              onRunWhatIf={handleRunWhatIf}
              isWhatIfLoading={isWhatIfLoading}
              formatCurrency={formatCurrency}
            />

            <BuilderProductWorkspace
              activeComponent={activeComponent}
              activeSection={activeSection}
              activeIndex={activeIndex}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              showFilters={showFilters}
              setShowFilters={setShowFilters}
              availableBrands={availableBrands}
              filterPriceRange={filterPriceRange}
              setFilterPriceRange={setFilterPriceRange}
              filterBrands={filterBrands}
              setFilterBrands={setFilterBrands}
              filterAiScoreMin={filterAiScoreMin}
              setFilterAiScoreMin={setFilterAiScoreMin}
              activeFilterCount={activeFilterCount}
              activeProducts={activeProducts}
              totalProductsBeforeFilter={totalProductsBeforeFilter}
              catalogLoading={catalogLoading}
              insights={insights}
              selectedItems={selectedItems}
              handlePickCoolingRecommendation={handlePickCoolingRecommendation}
              processingComponent={processingComponent}
              loading={loading}
              handleSelectProduct={handleSelectProduct}
              setDetailModalProduct={setDetailModalProduct}
              suggestionForm={suggestionForm}
              totalPrice={totalPrice}
              compareList={compareList}
              setCompareList={setCompareList}
              actions={actions}
            />
          </main>

          {/* ═══ COLUMN 3: RIGHT SUMMARY SIDEBAR ═══════════════ */}
          <BuildSummarySidebar
            xaiReport={xaiReport}
            totalPrice={totalPrice}
            selectedCount={selectedCount}
            insights={insights}
            handleBuyWholeBuild={handleBuyWholeBuild}
            processingComponent={processingComponent}
            hasBlockerSeverity={hasBlockerSeverity || isBudgetBlocked}
            xaiBuildReadiness={isBudgetBlocked ? "BLOCKED" : xaiReport.buildReadiness}
            blockerReasonTooltip={
              isBudgetBlocked
                ? `⛔ Không thể đặt hàng: Cấu hình vượt ngân sách ${budgetExceededPercent}% (+${formatCurrency(budgetDiff)}đ). Vượt quá 10% — vui lòng giảm chi phí hoặc áp dụng Budget Safe trước khi mua.`
                : blockerReasonTooltip
            }
            isAuthenticated={isAuthenticated}
            onSaveBuild={actions.commitSave}
            onAddAllToCart={handleAddAllToCart}
            onShareBuild={handleShareBuild}
            onClearAll={actions.clearAll}
            handleAutoRecommend={handleAutoRecommend}
            suggestionFormBudget={suggestionForm.budget}
            visibleChecks={visibleChecks}
            onOpenXaiDrawer={setIsXaiDrawerOpen}
            onOpenAiDrawer={() => setIsAiAdvisorDrawerOpen(true)}
            handleRunWhatIf={handleRunWhatIf}
            isWhatIfLoading={isWhatIfLoading}
            aiInsightText={aiInsightText}
            selectedItems={selectedItems}
            formatCurrency={formatCurrency}
          />
        </div>
      </div>

      {/* ── XAI DRAWER ──────────────────────────────────────── */}
      <XAIExplanationDrawer
        isOpen={isXaiDrawerOpen}
        onClose={() => setIsXaiDrawerOpen(false)}
        xaiReport={xaiReport}
        isLoading={isXaiLoading}
        onRecheck={fetchBackendXaiCompatibility}
      />

      {/* ── AI ADVISOR DRAWER ────────────────────────────────── */}
      <AIAdvisorDrawer
        isOpen={isAiAdvisorDrawerOpen}
        onClose={() => setIsAiAdvisorDrawerOpen(false)}
        selectedItems={selectedItems}
        totalPrice={totalPrice}
        budget={suggestionForm.budget}
        xaiReport={xaiReport}
        onOpenReqWizard={() => setIsReqWizardOpen(true)}
        onAutoBuild={async (opts) => {
          setIsAiAdvisorDrawerOpen(false);
          await handleAutoRecommend(opts);
        }}
        onViewProductDetail={(compItem) => {
          if (!compItem) return;
          const type = compItem.componentType || "cpu";
          setActiveComponent(type);
          const catalogList = optionsByComponent[type] || [];
          const matchedProduct =
            catalogList.find((p) => {
              const pName = (p?.name || p?.product_name || "").toLowerCase();
              const targetName = (compItem.name || "").toLowerCase();
              return pName.includes(targetName) || targetName.includes(pName);
            }) ||
            catalogList[0] || {
              id: compItem.id || 999,
              name: compItem.name,
              price: compItem.price,
              attributes: [{ name: "Thông số AI", value: compItem.specSummary || "Đạt chuẩn tương thích 100%" }]
            };
          setDetailModalProduct(matchedProduct);
        }}
        onSelectSingleComponent={(type, productItem) => {
          if (!type || !productItem) return;
          const compType = type || productItem.componentType || "cpu";
          const catalogList = optionsByComponent[compType] || [];
          const targetId = Number(getProductId(productItem) || productItem.productId || productItem.id || 0);
          const matchedProduct =
            (targetId ? catalogList.find((p) => Number(getProductId(p)) === targetId) : null) ||
            catalogList.find((p) => {
              const pName = (p?.name || p?.product_name || "").toLowerCase();
              const targetName = (productItem.name || productItem.product_name || "").toLowerCase();
              return pName.includes(targetName) || targetName.includes(pName);
            }) ||
            (getProductId(productItem) ? productItem : catalogList[0]);

          if (matchedProduct) {
            handleSelectProduct(compType, matchedProduct);
          }
        }}
      />

      {/* ── PRODUCT QUICK VIEW DETAIL MODAL ────────────────── */}
      <ProductDetailModal
        isOpen={Boolean(detailModalProduct)}
        onClose={() => setDetailModalProduct(null)}
        product={detailModalProduct}
        activeComponent={activeComponent}
        isSelected={
          String(getProductId(getSelectedProduct(selectedItems[activeComponent]))) ===
          String(getProductId(detailModalProduct))
        }
        onSelectProduct={handleSelectProduct}
        selectedItems={selectedItems}
        catalogOptions={optionsByComponent[activeComponent] || []}
      />

      {/* ── FLOATING COMPARE BAR ───────────────────────────── */}
      <BuilderFloatingCompareBar
        compareList={compareList}
        activeComponent={activeComponent}
        onOpenCompare={() => setIsCompareDrawerOpen(true)}
        onClearCompare={() => setCompareList([])}
      />

      {/* ── COMPARE MATRIX DRAWER MODAL ─────────────────────── */}
      <CompareDrawer
        isOpen={isCompareDrawerOpen}
        onClose={() => setIsCompareDrawerOpen(false)}
        compareList={compareList}
        activeComponent={activeComponent}
        onSelectProduct={handleSelectProduct}
        onRemoveFromCompare={(pId) => setCompareList((prev) => prev.filter((p) => (p.product_id || p.id) !== pId))}
        onClearCompare={() => {
          setCompareList([]);
          setIsCompareDrawerOpen(false);
        }}
      />

      {/* ── FINAL PRE-PURCHASE AI REVIEW MODAL ──────────────── */}
      <FinalReviewModal
        isOpen={isFinalReviewOpen}
        onClose={() => setIsFinalReviewOpen(false)}
        selectedItems={selectedItems}
        totalPrice={totalPrice}
        xaiReport={backendXaiReport || insights}
        insights={insights}
        suggestionForm={suggestionForm}
        onConfirmPurchase={executeBuyWholeBuild}
        isProcessing={processingComponent === "cart"}
        isBlocked={hasBlockerSeverity || isBudgetBlocked}
        blockerReason={blockerReasonTooltip}
      />

      {/* ── REQUIREMENT WIZARD MODAL ───────────────────────── */}
      <RequirementWizardModal
        isOpen={isReqWizardOpen}
        onClose={() => setIsReqWizardOpen(false)}
        suggestionForm={suggestionForm}
        onSubmitProfile={handleRequirementSubmit}
      />

      {/* ── WHAT-IF SIMULATION COMPARISON MODAL ──────────────── */}
      {whatIfModalOpen && (
        <WhatIfComparisonPanel
          currentBuildSnapshot={
            whatIfCurrentSnapshot || { selectedItems, totalPrice, selectedCount, xaiReport: insights }
          }
          simulatedBuild={whatIfSimulatedBuild}
          deltaBudget={whatIfDeltaBudget}
          onClose={() => setWhatIfModalOpen(false)}
          onResetToCurrentBuild={() => setWhatIfModalOpen(false)}
          onApplySimulatedBuild={async (simBuild) => {
            await handleApplyCandidateBuild(simBuild);
            setWhatIfModalOpen(false);
          }}
          isApplying={processingComponent === "apply-candidate"}
        />
      )}

      {/* ── BATCH APPLY / AI BUILD FULL WORKSPACE LOADING OVERLAY ── */}
      {(processingComponent === "apply-candidate" ||
        processingComponent === "auto-build" ||
        isAutoBuilding) && (
        <BuilderBatchOverlay isAutoBuilding={isAutoBuilding} />
      )}
    </div>
  );
}