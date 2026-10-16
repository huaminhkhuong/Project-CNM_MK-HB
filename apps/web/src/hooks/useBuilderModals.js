import { useState, useCallback } from "react";

/**
 * useBuilderModals — Quản lý tập trung toàn bộ trạng thái đóng/mở của các Modals và Drawers
 * trong không gian làm việc PC Builder.
 */
export function useBuilderModals() {
  const [isXaiDrawerOpen, setIsXaiDrawerOpen] = useState(false);
  const [isAiAdvisorDrawerOpen, setIsAiAdvisorDrawerOpen] = useState(false);
  const [detailModalProduct, setDetailModalProduct] = useState(null);
  const [isReqWizardOpen, setIsReqWizardOpen] = useState(false);
  const [whatIfModalOpen, setWhatIfModalOpen] = useState(false);
  const [whatIfCurrentSnapshot, setWhatIfCurrentSnapshot] = useState(null);
  const [whatIfSimulatedBuild, setWhatIfSimulatedBuild] = useState(null);
  const [whatIfDeltaBudget, setWhatIfDeltaBudget] = useState(5000000);
  const [isWhatIfLoading, setIsWhatIfLoading] = useState(false);
  const [isFinalReviewOpen, setIsFinalReviewOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [compareList, setCompareList] = useState([]);
  const [isCompareDrawerOpen, setIsCompareDrawerOpen] = useState(false);
  const [isMobileSummaryOpen, setIsMobileSummaryOpen] = useState(false);

  const openDetailModal = useCallback((product) => setDetailModalProduct(product), []);
  const closeDetailModal = useCallback(() => setDetailModalProduct(null), []);

  const openShareModal = useCallback((url) => {
    if (url) setShareUrl(url);
    setIsShareModalOpen(true);
  }, []);
  const closeShareModal = useCallback(() => setIsShareModalOpen(false), []);

  const openFinalReview = useCallback(() => setIsFinalReviewOpen(true), []);
  const closeFinalReview = useCallback(() => setIsFinalReviewOpen(false), []);

  const toggleCompareProduct = useCallback((product, isChecked, maxItems = 3) => {
    const productId = product.product_id || product.id;
    if (isChecked) {
      setCompareList((prev) => {
        if (prev.length >= maxItems) return prev;
        return [...prev.filter((p) => (p.product_id || p.id) !== productId), product];
      });
    } else {
      setCompareList((prev) => prev.filter((p) => (p.product_id || p.id) !== productId));
    }
  }, []);

  const clearCompareList = useCallback(() => {
    setCompareList([]);
    setIsCompareDrawerOpen(false);
  }, []);

  return {
    isXaiDrawerOpen,
    setIsXaiDrawerOpen,
    isAiAdvisorDrawerOpen,
    setIsAiAdvisorDrawerOpen,
    detailModalProduct,
    setDetailModalProduct,
    openDetailModal,
    closeDetailModal,
    isReqWizardOpen,
    setIsReqWizardOpen,
    whatIfModalOpen,
    setWhatIfModalOpen,
    whatIfCurrentSnapshot,
    setWhatIfCurrentSnapshot,
    whatIfSimulatedBuild,
    setWhatIfSimulatedBuild,
    whatIfDeltaBudget,
    setWhatIfDeltaBudget,
    isWhatIfLoading,
    setIsWhatIfLoading,
    isFinalReviewOpen,
    setIsFinalReviewOpen,
    openFinalReview,
    closeFinalReview,
    isShareModalOpen,
    setIsShareModalOpen,
    shareUrl,
    setShareUrl,
    openShareModal,
    closeShareModal,
    compareList,
    setCompareList,
    toggleCompareProduct,
    clearCompareList,
    isCompareDrawerOpen,
    setIsCompareDrawerOpen,
    isMobileSummaryOpen,
    setIsMobileSummaryOpen
  };
}
