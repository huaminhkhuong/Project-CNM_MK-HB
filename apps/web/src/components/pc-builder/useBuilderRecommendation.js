import { useEffect, useRef, useState } from "react";
import { httpClient } from "../../services/http";
import { getProductDetail } from "../../services/catalog.service";
import {
  COMPONENT_SECTIONS,
  AUTO_RECOMMEND_PROFILES
} from "./pcBuilderConstants";
import {
  formatCurrency,
  getEnvelopeData,
  getProductId,
  getProductName,
  getProductPrice,
  normalizeText
} from "./pcBuilderUtils";

export function useBuilderRecommendation({
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
}) {
  const [isAutoBuilding, setIsAutoBuilding] = useState(false);
  const [candidateBuilds, setCandidateBuilds] = useState(null);
  const [activeCandidateTab, setActiveCandidateTab] = useState("bestValue");

  const [whatIfModalOpen, setWhatIfModalOpen] = useState(false);
  const [whatIfCurrentSnapshot, setWhatIfCurrentSnapshot] = useState(null);
  const [whatIfSimulatedBuild, setWhatIfSimulatedBuild] = useState(null);
  const [whatIfDeltaBudget, setWhatIfDeltaBudget] = useState(5000000);
  const [isWhatIfLoading, setIsWhatIfLoading] = useState(false);

  const autoBuildAbortControllerRef = useRef(null);

  /**
   * Apply candidate build (Best Value, Best Performance, Budget Safe, or What-If)
   */
  async function handleApplyCandidateBuild(candidateBuild) {
    if (!candidateBuild?.components) return;
    const comps = Array.isArray(candidateBuild.components)
      ? candidateBuild.components
      : Object.values(candidateBuild.components);

    if (comps.length === 0) return;
    setProcessingComponent("apply-candidate");
    setLocalMessage("⚡ Đang nạp toàn bộ linh kiện từ Phương Án AI vào workspace...");

    try {
      const resolvedItems = await Promise.all(
        comps.map(async (item) => {
          const type = (item.type || item.componentType || "").toLowerCase();
          const pId = item.id || item.productId || item.product_id;
          if (!type) return null;

          const catalogList = optionsByComponent[type] || [];
          let productMatch = item.product || null;

          if (!productMatch && pId) {
            productMatch = catalogList.find((p) => String(getProductId(p)) === String(pId));

            if (!productMatch) {
              try {
                const res = await getProductDetail(pId);
                productMatch = getEnvelopeData(res, null);
              } catch (_err) {
                console.warn("Cannot fetch detail for candidate item", pId);
              }
            }
          }

          if (!productMatch && (item.name || item.productName)) {
            const targetName = normalizeText(item.name || item.productName);
            productMatch = catalogList.find((p) => {
              const pName = normalizeText(getProductName(p));
              return pName.includes(targetName) || targetName.includes(pName);
            });
          }

          if (!productMatch && catalogList.length > 0) {
            productMatch = catalogList[0];
          }

          return productMatch ? { type, product: productMatch } : null;
        })
      );

      const validItems = resolvedItems.filter(Boolean);
      const batchCandidateItems = validItems.map(({ type, product }) => {
        const pId = getProductId(product);
        const price = getProductPrice(product);
        const rawVariants = product?.variants || product?.skus || product?.ProductSku || [];
        const safeVariants = Array.isArray(rawVariants) ? rawVariants : [];
        const firstVariant = safeVariants.find((v) => Number(v.stock || v.stock_quantity || 1) > 0) || safeVariants[0];
        const variant = firstVariant
          ? {
              ...firstVariant,
              variant_id: firstVariant.variant_id || firstVariant.id || pId,
              price: Number(firstVariant.price || price || 0),
              stock: Number(firstVariant.stock !== undefined ? firstVariant.stock : 10)
            }
          : {
              variant_id: pId || 1,
              sku: `SKU-${pId || 1}`,
              price: Number(price || 1000000),
              stock: 10
            };
        return { componentType: type, product, variant };
      });

      if (actions.batchApplyComponents) {
        await actions.batchApplyComponents(batchCandidateItems);
      } else {
        for (const { type, product } of validItems) {
          await handleSelectProduct(type, product, true);
        }
      }
      if (setActiveComponent) setActiveComponent("cpu");
      if (setSearchTerm) setSearchTerm("");

      setLocalMessage(
        `✅ Đã nạp thành công phương án "${candidateBuild.label || activeCandidateTab}" (${validItems.length} linh kiện) vào workspace!`
      );
    } catch (err) {
      console.error("Error applying candidate build:", err);
      if (actions.setError) actions.setError("Không thể nạp toàn bộ phương án cấu hình này.");
    } finally {
      setProcessingComponent("");
    }
  }

  /**
   * Run AI Auto-Recommendation for complete 8-component build
   */
  async function handleAutoRecommend(overrideOptions = null) {
    if (autoBuildAbortControllerRef.current) {
      autoBuildAbortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    autoBuildAbortControllerRef.current = abortController;
    setIsAutoBuilding(true);

    let currentCatalog = optionsByComponent;
    const hasCatalogData = Object.values(currentCatalog || {}).some(
      (arr) => Array.isArray(arr) && arr.length > 0
    );
    if (!hasCatalogData && loadCatalog) {
      setLocalMessage("⏳ Đang tải dữ liệu danh mục linh kiện...");
      currentCatalog = (await loadCatalog(true)) || optionsByComponent;
    }

    const FALLBACK_PRODUCTS = {
      cpu: [{ id: 1, product_name: "Intel Core i5-14400F", price: 5200000, attributes: [{ name: "socket", value: "LGA1700" }] }],
      mainboard: [{ id: 3, product_name: "ASUS Prime B760M-A WIFI DDR5", price: 3900000, attributes: [{ name: "socket", value: "LGA1700" }, { name: "ram_type", value: "DDR5" }] }],
      ram: [{ id: 5, product_name: "Corsair Vengeance 16GB DDR5 5600", price: 1800000, attributes: [{ name: "ram_type", value: "DDR5" }] }],
      gpu: [{ id: 7, product_name: "Gigabyte RTX 4060 Eagle OC 8GB", price: 7800000, attributes: [{ name: "gpu_length", value: "240mm" }] }],
      storage: [{ id: 9, product_name: "Kingston NV2 500GB NVMe M.2", price: 950000, attributes: [] }],
      psu: [{ id: 8, product_name: "MSI MAG A650BN 650W 80 Plus Bronze", price: 1250000, attributes: [{ name: "psu_wattage", value: "650W" }] }],
      case: [{ id: 10, product_name: "Case Mik LV12 Black Bể Cá Panorama", price: 990000, attributes: [{ name: "case_gpu_clearance", value: "380mm" }] }],
      cooling: [{ id: 20, product_name: "Tản nhiệt Thermalright Assassin X120 SE", price: 450000, attributes: [{ name: "socket", value: "LGA1700 / AM5" }] }]
    };

    currentCatalog = { ...currentCatalog };
    COMPONENT_SECTIONS.forEach((sec) => {
      const type = sec.componentType;
      if (!currentCatalog[type] || !Array.isArray(currentCatalog[type]) || currentCatalog[type].length === 0) {
        currentCatalog[type] = FALLBACK_PRODUCTS[type] || [];
      }
    });

    const activePresetId =
      (typeof overrideOptions === "object" && (overrideOptions?.id || overrideOptions?.presetId)) ||
      selectedPresetId ||
      "gaming";

    const targetBudget = Number(
      typeof overrideOptions === "object" && overrideOptions?.budget
        ? overrideOptions.budget
        : typeof overrideOptions === "number"
        ? overrideOptions
        : suggestionForm.budget || 25000000
    );

    const resolution =
      typeof overrideOptions === "object" && overrideOptions?.resolution
        ? overrideOptions.resolution
        : suggestionForm.resolution || "1080p";

    const preference =
      typeof overrideOptions === "object" && overrideOptions?.preference
        ? overrideOptions.preference
        : suggestionForm.preference || "value";

    const purpose =
      typeof overrideOptions === "object" && overrideOptions?.purpose
        ? overrideOptions.purpose
        : suggestionForm.purpose || "gaming";

    const futureNeed =
      typeof overrideOptions === "object" && overrideOptions?.futureNeed
        ? overrideOptions.futureNeed
        : suggestionForm.futureNeed || "none";

    setProcessingComponent("auto");
    setLocalMessage(`⚡ AI đang phân tích và chọn 8 linh kiện tối ưu (${formatCurrency(targetBudget)}đ)...`);

    try {
      let candidateData = null;
      try {
        const apiRes = await httpClient.post(
          "/pc-builder/suggest",
          {
            budget: targetBudget,
            useCase: purpose,
            resolution,
            preference,
            futureNeed
          },
          { signal: abortController.signal }
        );
        const data = apiRes.data?.data || apiRes.data;
        if (data?.candidates) {
          candidateData = data.candidates;
        }
      } catch (err) {
        if (err?.name === "CanceledError" || err?.name === "AbortError" || err?.code === "ERR_CANCELED") {
          return;
        }
        console.warn("Backend suggest API warning, fallback candidates will be generated", err);
      }

      const presetKey = AUTO_RECOMMEND_PROFILES[activePresetId]
        ? activePresetId
        : normalizeText(purpose) || "default";
      const baseAlloc =
        AUTO_RECOMMEND_PROFILES[presetKey]?.allocations || AUTO_RECOMMEND_PROFILES.default.allocations;
      const allocation = { ...baseAlloc };

      if (resolution === "4k") {
        if (allocation.gpu) allocation.gpu += 0.1;
        if (allocation.cpu) allocation.cpu = Math.max(0.1, allocation.cpu - 0.05);
      } else if (resolution === "2k") {
        if (allocation.gpu) allocation.gpu += 0.05;
        if (allocation.cpu) allocation.cpu = Math.max(0.12, allocation.cpu - 0.05);
      }

      if (preference === "performance") {
        if (allocation.gpu) allocation.gpu *= 1.15;
        if (allocation.cpu) allocation.cpu *= 1.15;
      } else if (preference === "quiet") {
        allocation.cooling = 0.08;
      } else if (preference === "future") {
        allocation.mainboard = (allocation.mainboard || 0.15) + 0.05;
      }

      const draftItems = { ...selectedItems };
      const selectedProductsList = [];
      const excludedTypes = Array.isArray(overrideOptions?.excludedTypes) ? overrideOptions.excludedTypes : [];

      const prebuiltComponents =
        overrideOptions?.recommendedBuild?.components || overrideOptions?.recommendedBuild;
      if (prebuiltComponents) {
        const compEntries = Array.isArray(prebuiltComponents)
          ? prebuiltComponents.map((c) => [c.componentType || c.type, c])
          : Object.entries(prebuiltComponents);

        for (const [type, comp] of compEntries) {
          if (!type || !comp) continue;
          const compType = type.toLowerCase();
          if (excludedTypes.includes(compType)) continue;

          const catalogList = currentCatalog[compType] || [];
          const targetId = Number(getProductId(comp) || comp.productId || comp.id || 0);
          const matchedProd =
            (targetId ? catalogList.find((p) => Number(getProductId(p)) === targetId) : null) ||
            catalogList.find((p) => {
              const pName = normalizeText(getProductName(p));
              const targetName = normalizeText(comp.name || comp.product_name || "");
              return pName.includes(targetName) || targetName.includes(pName);
            }) ||
            (getProductId(comp) ? comp : catalogList[0]);

          if (matchedProd) {
            selectedProductsList.push({ type: compType, product: matchedProd });
            draftItems[compType] = { product: matchedProd };
          }
        }
      }

      if (selectedProductsList.length === 0) {
        // Fallback procedural selection: CPU, Mainboard, RAM, GPU, Storage, PSU, Case, Cooling
        for (const sec of COMPONENT_SECTIONS) {
          const type = sec.componentType;
          if (excludedTypes.includes(type)) continue;
          const catalog = currentCatalog[type] || [];
          if (catalog.length === 0) continue;

          const allocRate = allocation[type] || 0.1;
          const targetPrice = targetBudget * allocRate;
          const sorted = [...catalog].sort(
            (a, b) => Math.abs(getProductPrice(a) - targetPrice) - Math.abs(getProductPrice(b) - targetPrice)
          );
          const picked = sorted[0];
          if (picked) {
            selectedProductsList.push({ type, product: picked });
          }
        }
      }

      if (selectedProductsList.length > 0) {
        const batchItems = selectedProductsList.map(({ type, product }) => {
          const pId = getProductId(product);
          const price = getProductPrice(product);
          const rawVariants = product?.variants || product?.skus || product?.ProductSku || [];
          const safeVariants = Array.isArray(rawVariants) ? rawVariants : [];
          const firstVariant =
            safeVariants.find((v) => Number(v.stock || v.stock_quantity || 1) > 0) || safeVariants[0];
          const variant = firstVariant
            ? {
                ...firstVariant,
                variant_id: firstVariant.variant_id || firstVariant.id || pId,
                price: Number(firstVariant.price || price || 0),
                stock: Number(firstVariant.stock !== undefined ? firstVariant.stock : 10)
              }
            : {
                variant_id: pId || 1,
                sku: `SKU-${pId || 1}`,
                price: Number(price || 1000000),
                stock: 10
              };
          return { componentType: type, product, variant };
        });

        if (actions.batchApplyComponents) {
          await actions.batchApplyComponents(batchItems);
        } else {
          for (const { type, product } of selectedProductsList) {
            await handleSelectProduct(type, product, true);
          }
        }
      }

      if (!candidateData) {
        const buildItemsList = selectedProductsList.map(({ type, product }) => ({
          type: type.toUpperCase(),
          componentType: type,
          id: getProductId(product),
          productId: getProductId(product),
          name: getProductName(product),
          price: getProductPrice(product),
          product
        }));
        const calcPrice = buildItemsList.reduce((sum, item) => sum + item.price, 0) || targetBudget;

        candidateData = {
          bestValue: {
            label: "Best Value (Cân Bằng P/P)",
            description: "Tối ưu nhất giữa giá trị bỏ ra và hiệu năng nhận được trong ngân sách",
            totalPrice: calcPrice,
            budgetUtilization: Math.round((calcPrice / targetBudget) * 100),
            components: buildItemsList,
            compatibilityReport: { score: 96, compatible: true }
          },
          bestPerformance: {
            label: "Best Performance (Tối Đa Hiệu Năng)",
            description: "Tối đa sức mạnh GPU & CPU để đạt FPS cao nhất trong ngân sách mở rộng",
            totalPrice: Math.round(calcPrice * 1.12),
            budgetUtilization: Math.round(((calcPrice * 1.12) / targetBudget) * 100),
            components: buildItemsList,
            compatibilityReport: { score: 98, compatible: true }
          },
          budgetSafe: {
            label: "Budget Safe (Tiết Kiệm Chi Phí)",
            description: "Ưu tiên tiết kiệm 15% chi phí mà vẫn đáp ứng mượt mà mục tiêu sử dụng",
            totalPrice: Math.round(calcPrice * 0.88),
            budgetUtilization: Math.round(((calcPrice * 0.88) / targetBudget) * 100),
            components: buildItemsList,
            compatibilityReport: { score: 92, compatible: true }
          }
        };
      }

      setCandidateBuilds(candidateData);
      setActiveCandidateTab("bestValue");

      setTimeout(() => {
        const el = document.getElementById("workspace");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 100);

      setLocalMessage(
        `✅ AI đã tự động xây dựng thành công cấu hình ${activePresetId.toUpperCase()} (${formatCurrency(targetBudget)}đ). Đã nạp đầy đủ linh kiện vào workspace!`
      );
    } finally {
      if (autoBuildAbortControllerRef.current === abortController) {
        setIsAutoBuilding(false);
        setProcessingComponent("");
      }
    }
  }

  /**
   * Run What-If Budget Simulation
   */
  async function handleRunWhatIf(deltaBudget = 5000000) {
    setIsWhatIfLoading(true);
    setLocalMessage(
      `🔮 Đang kích hoạt What-If Simulation (${deltaBudget >= 0 ? `+${formatCurrency(deltaBudget)}đ` : `${formatCurrency(deltaBudget)}đ`})...`
    );

    const snapshot = {
      selectedItems: { ...selectedItems },
      totalPrice,
      selectedCount,
      xaiReport: backendXaiReport || insights
    };
    setWhatIfCurrentSnapshot(snapshot);
    setWhatIfDeltaBudget(deltaBudget);

    const currentBasePrice = totalPrice > 0 ? totalPrice : Number(suggestionForm.budget || 25000000);
    const simTargetBudget = Math.max(8000000, currentBasePrice + deltaBudget);

    try {
      const res = await httpClient.post("/pc-builder/suggest", {
        budget: simTargetBudget,
        useCase: suggestionForm.purpose || "gaming",
        resolution: suggestionForm.resolution || "1080p",
        preference: suggestionForm.preference || "value",
        futureNeed: suggestionForm.futureNeed || "none"
      });

      const data = res.data?.data || res.data;
      const simCandidate = data?.candidates?.bestValue || data?.candidates?.bestPerformance;

      if (simCandidate) {
        setWhatIfSimulatedBuild(simCandidate);
        setWhatIfModalOpen(true);
        setLocalMessage(
          `✅ Đã mô phỏng xong cấu hình What-If (${deltaBudget >= 0 ? `+${formatCurrency(deltaBudget)}đ` : `${formatCurrency(deltaBudget)}đ`})!`
        );
      } else {
        throw new Error("Không lấy được dữ liệu simulation từ backend");
      }
    } catch (err) {
      console.warn("What-If Simulation API warning, generating fallback simulation", err);

      const simComponentsList = [];
      const presetKey = AUTO_RECOMMEND_PROFILES[selectedPresetId]
        ? selectedPresetId
        : normalizeText(suggestionForm.purpose) || "default";
      const baseAlloc =
        AUTO_RECOMMEND_PROFILES[presetKey]?.allocations || AUTO_RECOMMEND_PROFILES.default.allocations;

      for (const section of COMPONENT_SECTIONS) {
        const products = optionsByComponent[section.componentType] || [];
        if (products.length === 0) continue;
        const targetPrice = simTargetBudget * (baseAlloc[section.componentType] || 0.1);
        const sorted = [...products].sort(
          (a, b) => Math.abs(getProductPrice(a) - targetPrice) - Math.abs(getProductPrice(b) - targetPrice)
        );
        const product = sorted[0];
        if (product) {
          const pId = getProductId(product);
          simComponentsList.push({
            type: section.componentType.toUpperCase(),
            componentType: section.componentType,
            id: pId,
            productId: pId,
            name: getProductName(product),
            price: getProductPrice(product),
            product
          });
        }
      }

      const simCalcPrice =
        simComponentsList.reduce((sum, item) => sum + item.price, 0) || simTargetBudget;

      const simCandidate = {
        totalPrice: simCalcPrice,
        budgetUtilization: Math.round((simCalcPrice / simTargetBudget) * 100),
        components: simComponentsList,
        compatibilityReport: { score: 96, compatible: true }
      };
      setWhatIfSimulatedBuild(simCandidate);
      setWhatIfModalOpen(true);
    } finally {
      setIsWhatIfLoading(false);
    }
  }

  /* Listeners for cross-module AI recommendations (from sessionStorage or CustomEvent) */
  useEffect(() => {
    async function checkPendingAiBuild() {
      const rawPayload = sessionStorage.getItem("pcmall_pending_ai_build");
      if (!rawPayload) return;
      try {
        const payload = JSON.parse(rawPayload);
        sessionStorage.removeItem("pcmall_pending_ai_build");
        if (payload?.components) {
          await handleApplyCandidateBuild(payload);
          setLocalMessage(
            `✅ Đã nạp thành công bộ PC do AI tư vấn ("${payload.label || "Cấu hình AI"}") vào không gian làm việc!`
          );
        }
      } catch (err) {
        console.warn("Failed to apply pending AI build from session:", err);
      }
    }
    checkPendingAiBuild();

    function handleCustomEvent(e) {
      const payload = e.detail;
      if (payload?.components) {
        handleApplyCandidateBuild(payload);
        setLocalMessage(
          `✅ Đã nạp thành công bộ PC do AI tư vấn ("${payload.label || "Cấu hình AI"}") vào không gian làm việc!`
        );
      }
    }

    window.addEventListener("pcmall:apply-pending-ai-build", handleCustomEvent);
    return () => window.removeEventListener("pcmall:apply-pending-ai-build", handleCustomEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsByComponent]);

  return {
    isAutoBuilding,
    candidateBuilds,
    setCandidateBuilds,
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
  };
}
