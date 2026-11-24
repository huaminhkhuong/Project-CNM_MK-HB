import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import "../../styles/admin-ai-studio.css";
import { useAuth } from "../../hooks/useAuth";
import {
  AdminAlerts,
  AdminBtn,
  AdminCard,
  AdminField,
  AdminForm,
  AdminMetric,
  AdminMetrics,
  AdminPage,
  AdminPageHead,
  AdminWorkspace,
  useAdminToast
} from "../../components/admin/AdminUi";
import {
  createAdminAiRule,
  deleteAdminAiRule,
  getAdminAiPrompts,
  getAdminAiRules,
  getAdminAiSystemConfig,
  testAdminAiFilter,
  toggleAdminAiRule,
  updateAdminAiPrompt,
  updateAdminAiRule,
  updateAdminAiSystemConfig,
  testAdminAiConnection,
  getAdminAiDocuments,
  uploadAdminAiDocument,
  deleteAdminAiDocument,
  getAdminAiDocumentChunks,
  reindexAdminAiDocuments,
  getAdminAiReindexStatus,
  getAdminAiEmbeddingModels
} from "../../services/ai.service";

const SCOPES = [
  { id: "ALL", label: "Tất cả phạm vi" },
  { id: "GENERAL_CHAT", label: "1. AI Chat Tư Vấn Chung", color: "#2563eb" },
  { id: "BUILDER_SUGGEST", label: "2. AI Đề Xuất Build PC (32 linh kiện)", color: "#7c3aed" },
  { id: "BUILDER_AUDIT_CHAT", label: "3. AI Giám Định & Chat Build PC", color: "#d97706" }
];

const ACTIONS = [
  { id: "ALL", label: "Tất cả hành động" },
  { id: "DIRECT_REPLY", label: "⚡ Tự trả lời ngay (0ms, 0$)", color: "#059669" },
  { id: "BLOCK", label: "🛡️ Chặn / Từ chối (Guardrail)", color: "#dc2626" },
  { id: "SYSTEM_INJECT", label: "💉 Tiêm chỉ thị Prompt cho AI", color: "#2563eb" }
];

const MATCH_TYPES = [
  { id: "contains", label: "Chứa từ khóa (contains - phân tách bằng dấu phẩy)" },
  { id: "regex", label: "Biểu thức chính quy (Regular Expression)" },
  { id: "exact", label: "Khớp chính xác từng chữ (exact)" },
  { id: "budget_threshold", label: "Ngưỡng ngân sách (ví dụ: < 5000000 hoặc > 200000000)" }
];

const LLM_PROVIDER_PRESETS = {
  groq: {
    id: "groq",
    title: "⚡ Groq Cloud (Llama 3.3)",
    badge: "Khuyên dùng • Siêu mượt ~0,4s",
    badgeBg: "#dcfce7",
    badgeColor: "#15803d",
    desc: "Miễn phí ~14.400 lượt/ngày, tốc độ ~500 token/giây, không bị đứt câu hay 503 giờ cao điểm.",
    defaultModel: "llama-3.3-70b-versatile",
    keyUrl: "https://console.groq.com/keys",
    keyPlaceholder: "gsk_... (Lấy miễn phí tại console.groq.com/keys)",
    models: [
      { value: "llama-3.3-70b-versatile", label: "llama-3.3-70b-versatile (Khuyên dùng - Thông minh & Siêu nhanh)" },
      { value: "llama-3.1-8b-instant", label: "llama-3.1-8b-instant (Cực nhanh <0,2s, hạn mức cực cao)" },
      { value: "qwen/qwen3-32b", label: "qwen/qwen3-32b (Mạnh về tiếng Việt & suy luận kỹ thuật)" }
    ]
  },
  gemini: {
    id: "gemini",
    title: "🔷 Google Gemini",
    badge: "Mặc định • Tích hợp RAG",
    badgeBg: "#dbeafe",
    badgeColor: "#1d4ed8",
    desc: "Tốt cho tiếng Việt & đồng bộ với Gemini Embedding. Nên bật kèm dự phòng Groq tránh lỗi 503/429 Free Tier.",
    defaultModel: "gemini-3.5-flash-lite",
    keyUrl: "https://aistudio.google.com/apikey",
    keyPlaceholder: "AIza... (Lấy tại aistudio.google.com/apikey)",
    models: [
      { value: "gemini-3.5-flash-lite", label: "gemini-3.5-flash-lite (Nhanh ~1,4s - Khuyên dùng trên Gemini)" },
      { value: "gemini-3-flash-preview", label: "gemini-3-flash-preview (Sâu sắc - giới hạn 20 lượt/ngày Free)" },
      { value: "gemini-3.1-flash-lite", label: "gemini-3.1-flash-lite (Dự phòng)" }
    ]
  },
  openai: {
    id: "openai",
    title: "🧠 OpenAI GPT",
    badge: "Ổn định Production",
    badgeBg: "#f3e8ff",
    badgeColor: "#7e22ce",
    desc: "Độ ổn định thương mại cao, tuân thủ cấu trúc JSON nghiêm ngặt (cần nạp credit trên platform.openai.com).",
    defaultModel: "gpt-4o-mini",
    keyUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-... (Lấy tại platform.openai.com/api-keys)",
    models: [
      { value: "gpt-4o-mini", label: "gpt-4o-mini (Nhanh, chi phí thấp, rất ổn định)" },
      { value: "gpt-4.1-mini", label: "gpt-4.1-mini (Đời mới, cân bằng chất lượng & giá)" },
      { value: "gpt-4o", label: "gpt-4o (Cao cấp nhất)" }
    ]
  },
  ollama: {
    id: "ollama",
    title: "💻 Ollama Local",
    badge: "Offline 100% • 0đ",
    badgeBg: "#f1f5f9",
    badgeColor: "#334155",
    desc: "Chạy ngay trên máy cá nhân tại localhost:11434, không cần API Key, không lo giới hạn quota hay mất mạng.",
    defaultModel: "qwen2.5:7b",
    keyUrl: "https://ollama.com/download",
    keyPlaceholder: "Không cần API Key (chạy trực tiếp trên máy cục bộ)",
    models: [
      { value: "qwen2.5:7b", label: "qwen2.5:7b (Mạnh tiếng Việt trên máy 8-16GB RAM)" },
      { value: "llama3.1:8b", label: "llama3.1:8b (Phổ biến, cân bằng)" },
      { value: "gemma3:4b", label: "gemma3:4b (Siêu nhẹ cho laptop 8GB RAM)" }
    ]
  }
};

export function AdminAiConfigPage({ initialTab }) {
  const { authState, isAuthenticated } = useAuth();
  const role = String(authState?.user?.role || "").toUpperCase();

  const [searchParams] = useSearchParams();
  const queryTab = searchParams.get("tab") || initialTab || "rules";

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  const [activeTab, setActiveTab] = useState(queryTab);

  useEffect(() => {
    const targetTab = searchParams.get("tab") || initialTab;
    if (targetTab && targetTab !== activeTab) {
      setActiveTab(targetTab);
    }
  }, [initialTab, searchParams]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Data States
  const [rules, setRules] = useState([]);
  const [prompts, setPrompts] = useState({});

  // Filter States for Rules Table
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [searchKeyword, setSearchKeyword] = useState("");

  // Modal State for Rule Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleFormData, setRuleFormData] = useState({
    name: "",
    scope: "GENERAL_CHAT",
    matchType: "contains",
    pattern: "",
    action: "DIRECT_REPLY",
    directReply: "",
    blockReason: "",
    promptInjection: "",
    priority: 50,
    isActive: true
  });

  // Prompt Form States
  const [savingPromptScope, setSavingPromptScope] = useState(null);

  // Test Simulator State
  const [testScope, setTestScope] = useState("GENERAL_CHAT");
  const [testText, setTestText] = useState("");
  const [testBudget, setTestBudget] = useState(15000000);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  // System AI Config & Token Estimation States
  const [systemConfig, setSystemConfig] = useState({
    provider: "gemini",
    model: "gemini-3.5-flash-lite",
    fallbackProvider: "groq",
    fallbackModel: "llama-3.3-70b-versatile",
    autoFailover: true,
    temperature: 0.4,
    maxTokens: 4096,
    maxCatalogProducts: 35,
    retrievalMode: "keyword_and_category",
    apiKeyMasked: "",
    hasApiKey: false,
    apiKey: "",
    fallbackApiKeyMasked: "",
    hasFallbackApiKey: false,
    fallbackApiKey: "",
    providerKeyStatus: {}
  });
  const [tokenEstimation, setTokenEstimation] = useState(null);
  const [savingSystemConfig, setSavingSystemConfig] = useState(false);
  const [testingConnTarget, setTestingConnTarget] = useState(null); // "primary" | "fallback" | null
  const [connTestResult, setConnTestResult] = useState(null);

  // RAG Knowledge Document Management States
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTargetService, setUploadTargetService] = useState("all");
  const [isUploading, setIsUploading] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [embeddingModelInfo, setEmbeddingModelInfo] = useState(null);
  const [previewChunksData, setPreviewChunksData] = useState(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [docSearchKeyword, setDocSearchKeyword] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef(null);

  const filteredDocuments = useMemo(() => {
    const q = docSearchKeyword.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d) =>
      String(d.title || "").toLowerCase().includes(q) ||
      String(d.fileName || "").toLowerCase().includes(q) ||
      String(d.format || "").toLowerCase().includes(q)
    );
  }, [documents, docSearchKeyword]);

  const totalRagChunks = useMemo(
    () => documents.reduce((acc, d) => acc + (d.chunkCount || 0), 0),
    [documents]
  );

  useAdminToast(successMessage, () => setSuccessMessage(""));

  // Load Rules, Prompts, and Central System Config on mount
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setErrorMessage("");
      const [rulesRes, promptsRes, sysRes] = await Promise.all([
        getAdminAiRules(),
        getAdminAiPrompts(),
        getAdminAiSystemConfig()
      ]);
      setRules(rulesRes?.data?.rules || rulesRes?.rules || []);
      setPrompts(promptsRes?.data || promptsRes || {});
      const sysData = sysRes?.data || sysRes || {};
      if (sysData.config) {
        setSystemConfig((prev) => ({ ...prev, ...sysData.config }));
      }
      if (sysData.estimation) {
        setTokenEstimation(sysData.estimation);
      }
      // Also preload documents for Tab 5 badge
      loadDocuments();
    } catch (err) {
      setErrorMessage("Không thể tải cấu hình AI: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSystemConfig(e) {
    if (e) e.preventDefault();
    try {
      setSavingSystemConfig(true);
      setErrorMessage("");
      const res = await updateAdminAiSystemConfig(systemConfig);
      const data = res?.data || res || {};
      if (data.config) {
        setSystemConfig((prev) => ({ ...prev, ...data.config, apiKey: "", fallbackApiKey: "" }));
      }
      if (data.estimation) {
        setTokenEstimation(data.estimation);
      }
      setSuccessMessage("Đã lưu và đồng bộ cấu hình hệ thống AI + Failover đa nhà cung cấp thành công!");
    } catch (err) {
      setErrorMessage("Lỗi khi lưu cấu hình AI: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingSystemConfig(false);
    }
  }

  function handleSelectProvider(nextProvider) {
    const preset = LLM_PROVIDER_PRESETS[nextProvider] || LLM_PROVIDER_PRESETS.gemini;
    const keyInfo = systemConfig.providerKeyStatus?.[nextProvider];
    setConnTestResult(null);
    setSystemConfig((prev) => {
      const nextFallback = prev.fallbackProvider === nextProvider
        ? (nextProvider === "groq" ? "gemini" : "groq")
        : prev.fallbackProvider;
      const fbPreset = LLM_PROVIDER_PRESETS[nextFallback];
      const fbKeyInfo = prev.providerKeyStatus?.[nextFallback];
      return {
        ...prev,
        provider: nextProvider,
        model: preset.defaultModel,
        apiKey: "",
        hasApiKey: nextProvider === "ollama" || Boolean(keyInfo?.hasKey),
        apiKeyMasked: keyInfo?.masked || "",
        fallbackProvider: nextFallback,
        fallbackModel: fbPreset ? (prev.fallbackProvider === nextProvider ? fbPreset.defaultModel : prev.fallbackModel) : "",
        hasFallbackApiKey: nextFallback === "ollama" || Boolean(fbKeyInfo?.hasKey),
        fallbackApiKeyMasked: fbKeyInfo?.masked || ""
      };
    });
  }

  function handleSelectFallbackProvider(nextFb) {
    const preset = LLM_PROVIDER_PRESETS[nextFb];
    const keyInfo = systemConfig.providerKeyStatus?.[nextFb];
    setSystemConfig((prev) => ({
      ...prev,
      fallbackProvider: nextFb,
      fallbackModel: preset ? preset.defaultModel : "",
      fallbackApiKey: "",
      hasFallbackApiKey: nextFb === "ollama" || Boolean(keyInfo?.hasKey),
      fallbackApiKeyMasked: keyInfo?.masked || ""
    }));
  }

  async function handleTestConnection(target = "primary") {
    const isFb = target === "fallback";
    const provider = isFb ? systemConfig.fallbackProvider : systemConfig.provider;
    const model = isFb ? systemConfig.fallbackModel : systemConfig.model;
    const apiKey = isFb ? systemConfig.fallbackApiKey : systemConfig.apiKey;
    if (!provider || provider === "none") {
      setErrorMessage("Vui lòng chọn nhà cung cấp dự phòng trước khi kiểm tra kết nối.");
      return;
    }
    try {
      setTestingConnTarget(target);
      setConnTestResult(null);
      setErrorMessage("");
      const res = await testAdminAiConnection({ provider, model, apiKey });
      const result = res?.data || res;
      setConnTestResult({ ...result, target });
      if (result?.ok) {
        setSuccessMessage(`Kết nối ${provider.toUpperCase()} (${result.model}) thành công trong ${result.latencyMs}ms!`);
      }
    } catch (err) {
      setConnTestResult({
        ok: false,
        target,
        provider,
        model,
        latencyMs: 0,
        error: err.response?.data?.message || err.message || "Không thể gọi kiểm tra kết nối"
      });
    } finally {
      setTestingConnTarget(null);
    }
  }

  // Effect to clear errors on tab change
  useEffect(() => {
    setErrorMessage("");
  }, [activeTab]);

  // Effect to load RAG documents and models when RAG tab is selected
  useEffect(() => {
    if (activeTab === "rag") {
      loadDocuments();
      loadEmbeddingModels();
    }
  }, [activeTab]);

  async function loadDocuments() {
    try {
      setLoadingDocs(true);
      const res = await getAdminAiDocuments();
      if (res?.success) {
        setDocuments(res.documents || []);
      }
    } catch (err) {
      setErrorMessage("Không thể nạp danh sách tài liệu RAG: " + (err.response?.data?.message || err.message));
    } finally {
      setLoadingDocs(false);
    }
  }

  async function loadEmbeddingModels() {
    try {
      const res = await getAdminAiEmbeddingModels();
      if (res?.success) {
        setEmbeddingModelInfo(res);
      }
    } catch (err) {
      console.error("Lỗi lấy thông số mô hình:", err);
    }
  }

  async function handleUploadDocument(e) {
    if (e) e.preventDefault();
    if (!uploadFile) {
      setErrorMessage("Vui lòng chọn file (.pdf, .md, .txt) để tải lên.");
      return;
    }
    try {
      setIsUploading(true);
      setErrorMessage("");
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("target_service", uploadTargetService);
      const res = await uploadAdminAiDocument(formData);
      if (res?.success) {
        setSuccessMessage(res.message || "Tải lên và vector hóa tài liệu thành công!");
        setUploadFile(null);
        await loadDocuments();
      }
    } catch (err) {
      setErrorMessage("Lỗi khi tải tài liệu: " + (err.response?.data?.message || err.message));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteDocument(fileName) {
    if (!window.confirm(`Bạn có chắc muốn xóa vĩnh viễn tài liệu "${fileName}" và cập nhật lại Vector DB?`)) {
      return;
    }
    try {
      setErrorMessage("");
      const res = await deleteAdminAiDocument(fileName);
      if (res?.success) {
        setSuccessMessage(res.message || "Đã xóa tài liệu thành công!");
        await loadDocuments();
      }
    } catch (err) {
      setErrorMessage("Lỗi xóa tài liệu: " + (err.response?.data?.message || err.message));
    }
  }

  async function handlePreviewChunks(fileName) {
    try {
      setErrorMessage("");
      const res = await getAdminAiDocumentChunks(fileName);
      const data = res?.data || res;
      if (data?.success || data?.chunks) {
        setPreviewChunksData(data);
        setIsPreviewModalOpen(true);
      }
    } catch (err) {
      setErrorMessage("Lỗi đọc chunks tài liệu: " + (err.response?.data?.message || err.message));
    }
  }

  async function handleReindexAll() {
    if (!window.confirm("Kích hoạt tái lập chỉ mục toàn bộ tài liệu và sản phẩm vào Vector DB?")) {
      return;
    }
    try {
      setIsReindexing(true);
      setErrorMessage("");
      const res = await reindexAdminAiDocuments();
      if (res?.success) {
        setSuccessMessage(res.message || "Đã kích hoạt tái lập chỉ mục trong nền...");
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await getAdminAiReindexStatus();
            const status = statusRes?.status;
            if (status && !status.is_running) {
              clearInterval(pollInterval);
              setIsReindexing(false);
              setSuccessMessage(status.message || "Đã hoàn tất tái lập chỉ mục Vector DB!");
              await loadDocuments();
            }
          } catch {
            clearInterval(pollInterval);
            setIsReindexing(false);
          }
        }, 3000);
      }
    } catch (err) {
      setIsReindexing(false);
      setErrorMessage("Lỗi khi tái lập chỉ mục: " + (err.response?.data?.message || err.message));
    }
  }

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (scopeFilter !== "ALL" && r.scope !== scopeFilter && r.scope !== "GLOBAL") return false;
      if (actionFilter !== "ALL" && r.action !== actionFilter) return false;
      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase();
        const n = String(r.name || "").toLowerCase();
        const p = String(r.pattern || "").toLowerCase();
        if (!n.includes(q) && !p.includes(q)) return false;
      }
      return true;
    });
  }, [rules, scopeFilter, actionFilter, searchKeyword]);

  // Statistics
  const totalHitCount = useMemo(() => {
    return rules.reduce((sum, r) => sum + (r.hitCount || 0), 0);
  }, [rules]);

  const directReplyCount = useMemo(() => {
    return rules.filter((r) => r.action === "DIRECT_REPLY").length;
  }, [rules]);

  const blockCount = useMemo(() => {
    return rules.filter((r) => r.action === "BLOCK").length;
  }, [rules]);

  // Handle Toggle Rule
  async function handleToggleRule(rule) {
    try {
      const res = await toggleAdminAiRule(rule.id);
      const updated = res?.data || res;
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, isActive: updated.isActive } : r)));
      setSuccessMessage(`Đã ${updated.isActive ? "bật" : "tắt"} quy tắc "${rule.name}"`);
    } catch (err) {
      setErrorMessage("Lỗi khi thay đổi trạng thái: " + (err.response?.data?.message || err.message));
    }
  }

  // Handle Delete Rule
  async function handleDeleteRule(rule) {
    if (!confirm(`Bạn có chắc muốn xóa vĩnh viễn quy tắc "${rule.name}"?`)) return;
    try {
      await deleteAdminAiRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      setSuccessMessage(`Đã xóa quy tắc "${rule.name}" thành công`);
    } catch (err) {
      setErrorMessage("Lỗi khi xóa quy tắc: " + (err.response?.data?.message || err.message));
    }
  }

  // Open Create Modal
  function handleOpenCreateModal() {
    setEditingRule(null);
    setRuleFormData({
      name: "",
      scope: scopeFilter !== "ALL" ? scopeFilter : "GENERAL_CHAT",
      matchType: "contains",
      pattern: "",
      action: "DIRECT_REPLY",
      directReply: "",
      blockReason: "",
      promptInjection: "",
      priority: 50,
      isActive: true
    });
    setIsModalOpen(true);
  }

  // Open Edit Modal
  function handleOpenEditModal(rule) {
    setEditingRule(rule);
    setRuleFormData({
      name: rule.name || "",
      scope: rule.scope || "GENERAL_CHAT",
      matchType: rule.matchType || "contains",
      pattern: rule.pattern || "",
      action: rule.action || "DIRECT_REPLY",
      directReply: rule.directReply || "",
      blockReason: rule.blockReason || "",
      promptInjection: rule.promptInjection || "",
      priority: rule.priority || 50,
      isActive: rule.isActive !== false
    });
    setIsModalOpen(true);
  }

  // Save Rule (Create or Update)
  async function handleSaveRule(e) {
    e.preventDefault();
    if (!ruleFormData.name.trim() || !ruleFormData.pattern.trim()) {
      alert("Vui lòng điền đầy đủ Tên quy tắc và Mẫu khớp");
      return;
    }

    try {
      if (editingRule) {
        const res = await updateAdminAiRule(editingRule.id, ruleFormData);
        const updated = res?.data || res;
        setRules((prev) => prev.map((r) => (r.id === editingRule.id ? updated : r)));
        setSuccessMessage(`Cập nhật quy tắc "${updated.name}" thành công`);
      } else {
        const res = await createAdminAiRule(ruleFormData);
        const created = res?.data || res;
        setRules((prev) => [created, ...prev]);
        setSuccessMessage(`Tạo quy tắc mới "${created.name}" thành công`);
      }
      setIsModalOpen(false);
    } catch (err) {
      setErrorMessage("Lỗi khi lưu quy tắc: " + (err.response?.data?.message || err.message));
    }
  }

  // Save Prompt Config for a specific scope
  async function handleSavePrompt(scope) {
    const config = prompts[scope];
    if (!config) return;
    try {
      setSavingPromptScope(scope);
      await updateAdminAiPrompt(scope, config);
      setSuccessMessage(`Đã lưu cấu hình Prompt cho [${config.name || scope}] thành công!`);
    } catch (err) {
      setErrorMessage("Lỗi khi lưu cấu hình prompt: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingPromptScope(null);
    }
  }

  // Run Test Filter Simulation
  async function handleRunTest(e) {
    e.preventDefault();
    try {
      setIsTesting(true);
      setTestResult(null);
      const res = await testAdminAiFilter({
        scope: testScope,
        text: testText,
        budget: testBudget
      });
      setTestResult(res?.data || res);
    } catch (err) {
      setErrorMessage("Lỗi kiểm thử: " + (err.response?.data?.message || err.message));
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <AdminPage>
      <div className="ai-studio-shell">
        {/* ==================== EXECUTIVE OBSIDIAN HERO HEADER ==================== */}
        <section className="ai-studio-hero">
          <div className="ai-studio-hero-top">
            <div>
              <div className="ai-studio-hero-badges">
                <span className="ai-studio-live-pill">
                  <span className="ai-studio-live-dot" />
                  {activeTab === "rag" ? "Vector Engine Online • Port 5001" : "AI Gateway & Guardrail Active"}
                </span>
                <span className="ai-studio-tech-pill">
                  {activeTab === "rag"
                    ? "ChromaDB 3072d + BM25Okapi RRF"
                    : `Primary: ${String(systemConfig.provider || "gemini").toUpperCase()} (${systemConfig.model || "auto"})`}
                </span>
              </div>
              <h1 className="ai-studio-hero-title">
                {activeTab === "rag"
                  ? "Trung Tâm Tri Thức RAG & Vector Database"
                  : "Trung Tâm Quản Trị AI, Bộ Lọc & Đa Nhà Cung Cấp"}
              </h1>
              <p className="ai-studio-hero-desc">
                {activeTab === "rag"
                  ? "Nạp tài liệu kỹ thuật, chính sách cửa hàng và luật phần cứng cho Chatbot & Smart PC Builder bằng mô hình Google Gemini Embedding (0MB RAM server) kết hợp truy hồi lai ChromaDB + BM25Okapi."
                  : "Kiểm soát toàn diện bộ lọc 2 tầng, Prompt chuyên môn, chuyển mạch nhanh đa nhà cung cấp (Groq / Gemini / OpenAI / Ollama) và dự toán chi phí Token tập trung."}
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {activeTab === "rules" ? (
                <button type="button" className="ai-studio-hero-cta" onClick={handleOpenCreateModal}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                  <span>Thêm Quy Tắc Lọc Mới</span>
                </button>
              ) : activeTab === "rag" ? (
                <button
                  type="button"
                  className="ai-studio-hero-cta"
                  onClick={handleReindexAll}
                  disabled={isReindexing}
                >
                  <svg className={isReindexing ? "ai-studio-spin" : ""} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                  </svg>
                  <span>{isReindexing ? "Đang tái lập chỉ mục..." : "Tái Lập Chỉ Mục Toàn Bộ"}</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* 4 Glassmorphic KPI Tiles Integrated in Hero */}
          {activeTab === "rag" ? (
            <div className="ai-studio-kpi-grid">
              <div className="ai-studio-kpi" style={{ "--kpi-accent": "#38bdf8" }}>
                <div className="ai-studio-kpi-head">
                  <span className="ai-studio-kpi-label">Tài liệu tri thức</span>
                  <span className="ai-studio-kpi-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  </span>
                </div>
                <div className="ai-studio-kpi-value">{documents.length}</div>
                <div className="ai-studio-kpi-hint">Định dạng PDF, Markdown, TXT</div>
              </div>

              <div className="ai-studio-kpi" style={{ "--kpi-accent": "#a78bfa" }}>
                <div className="ai-studio-kpi-head">
                  <span className="ai-studio-kpi-label">Phân đoạn (Chunks)</span>
                  <span className="ai-studio-kpi-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>
                  </span>
                </div>
                <div className="ai-studio-kpi-value">{totalRagChunks}</div>
                <div className="ai-studio-kpi-hint">Cắt ngữ nghĩa 600 ký tự • overlap 120</div>
              </div>

              <div className="ai-studio-kpi" style={{ "--kpi-accent": "#34d399" }}>
                <div className="ai-studio-kpi-head">
                  <span className="ai-studio-kpi-label">Vector Embedding</span>
                  <span className="ai-studio-kpi-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                  </span>
                </div>
                <div className="ai-studio-kpi-value" style={{ fontSize: 18, color: "#6ee7b7" }}>Gemini 001</div>
                <div className="ai-studio-kpi-hint">3072 chiều • 0MB RAM máy chủ</div>
              </div>

              <div className="ai-studio-kpi" style={{ "--kpi-accent": "#fbbf24" }}>
                <div className="ai-studio-kpi-head">
                  <span className="ai-studio-kpi-label">Phạm vi phục vụ</span>
                  <span className="ai-studio-kpi-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                  </span>
                </div>
                <div className="ai-studio-kpi-value" style={{ fontSize: 19 }}>2 Phân Hệ</div>
                <div className="ai-studio-kpi-hint">AI Chatbot & Smart PC Builder</div>
              </div>
            </div>
          ) : (
            <div className="ai-studio-kpi-grid">
              <div className="ai-studio-kpi" style={{ "--kpi-accent": "#38bdf8" }}>
                <div className="ai-studio-kpi-head">
                  <span className="ai-studio-kpi-label">Tổng quy tắc</span>
                  <span className="ai-studio-kpi-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 3v18M3 12h18" /></svg>
                  </span>
                </div>
                <div className="ai-studio-kpi-value">{rules.length}</div>
                <div className="ai-studio-kpi-hint">{rules.filter((r) => r.isActive).length} quy tắc đang kích hoạt</div>
              </div>

              <div className="ai-studio-kpi" style={{ "--kpi-accent": "#34d399" }}>
                <div className="ai-studio-kpi-head">
                  <span className="ai-studio-kpi-label">Tự trả lời (0ms)</span>
                  <span className="ai-studio-kpi-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                  </span>
                </div>
                <div className="ai-studio-kpi-value" style={{ color: "#6ee7b7" }}>{directReplyCount}</div>
                <div className="ai-studio-kpi-hint">Bypass LLM cho FAQ & chính sách</div>
              </div>

              <div className="ai-studio-kpi" style={{ "--kpi-accent": "#f87171" }}>
                <div className="ai-studio-kpi-head">
                  <span className="ai-studio-kpi-label">Lá chắn Guardrail</span>
                  <span className="ai-studio-kpi-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  </span>
                </div>
                <div className="ai-studio-kpi-value" style={{ color: "#fca5a5" }}>{blockCount}</div>
                <div className="ai-studio-kpi-hint">Chặn ngoài lề & ngân sách ảo</div>
              </div>

              <div className="ai-studio-kpi" style={{ "--kpi-accent": "#a78bfa" }}>
                <div className="ai-studio-kpi-head">
                  <span className="ai-studio-kpi-label">Lượt tiết kiệm Token</span>
                  <span className="ai-studio-kpi-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                  </span>
                </div>
                <div className="ai-studio-kpi-value">{totalHitCount}</div>
                <div className="ai-studio-kpi-hint">Câu hỏi xử lý cục bộ 0đ chi phí</div>
              </div>
            </div>
          )}
        </section>

        <AdminAlerts errorMessage={errorMessage} successMessage={successMessage} />

        {/* ==================== SINGLE-ROW SEGMENTED TAB BAR ==================== */}
        <nav className="ai-studio-tabs-wrap" aria-label="AI Studio Navigation">
          <button
            type="button"
            className={`ai-studio-tab${activeTab === "rules" ? " is-active" : ""}`}
            onClick={() => setActiveTab("rules")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            <span>Quy Tắc & FAQ</span>
            <span className="ai-studio-tab-count">{rules.length}</span>
          </button>

          <button
            type="button"
            className={`ai-studio-tab${activeTab === "prompts" ? " is-active" : ""}`}
            onClick={() => setActiveTab("prompts")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            <span>Prompt AI</span>
            <span className="ai-studio-tab-count">3</span>
          </button>

          <button
            type="button"
            className={`ai-studio-tab${activeTab === "test" ? " is-active" : ""}`}
            onClick={() => setActiveTab("test")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 3h6M10 3v6.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V3" /></svg>
            <span>Kiểm Thử Bộ Lọc</span>
          </button>

          <button
            type="button"
            className={`ai-studio-tab${activeTab === "system" ? " is-active" : ""}`}
            onClick={() => setActiveTab("system")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            <span>Hệ Thống & Failover</span>
          </button>

          <button
            type="button"
            className={`ai-studio-tab${activeTab === "rag" ? " is-active" : ""}`}
            onClick={() => setActiveTab("rag")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>
            <span>Tài Liệu RAG & Tri Thức</span>
            <span className="ai-studio-tab-count">{documents.length}</span>
          </button>
        </nav>

      {/* ==================== TAB 1: QUY TẮC LỌC ==================== */}
      {activeTab === "rules" && (
        <div style={{ width: "100%" }}>
          <AdminCard title="Danh Sách Quy Tắc Lọc Đầu Vào & Tự Động Phản Hồi">
            {/* Bộ Lọc Thanh Công Cụ */}
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 12, marginBottom: 18 }}>
              <input
                type="text"
                placeholder="🔍 Tìm theo tên quy tắc hoặc từ khóa/pattern..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                style={{
                  padding: "9px 14px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13
                }}
              />

              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
                style={{
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                {SCOPES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>

              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                style={{
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                {ACTIONS.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
            </div>

            {/* Bảng Danh Sách Rules */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                    <th style={{ padding: "12px 14px" }}>Quy Tắc & Pattern</th>
                    <th style={{ padding: "12px 14px" }}>Phạm Vi (Scope)</th>
                    <th style={{ padding: "12px 14px" }}>Hành Động</th>
                    <th style={{ padding: "12px 14px", textAlign: "center" }}>Ưu Tiên</th>
                    <th style={{ padding: "12px 14px", textAlign: "center" }}>Bắt Trúng</th>
                    <th style={{ padding: "12px 14px", textAlign: "center" }}>Trạng Thái</th>
                    <th style={{ padding: "12px 14px", textAlign: "right" }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: 30, color: "#64748b" }}>
                        Không tìm thấy quy tắc nào khớp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : null}

                  {filteredRules.map((rule) => {
                    const scopeItem = SCOPES.find((s) => s.id === rule.scope) || { label: rule.scope, color: "#475569" };
                    const actionItem = ACTIONS.find((a) => a.id === rule.action) || { label: rule.action, color: "#475569" };

                    return (
                      <tr key={rule.id} style={{ borderBottom: "1px solid #f1f5f9", background: rule.isActive ? "transparent" : "#fbfbfb" }}>
                        <td style={{ padding: "12px 14px", maxWidth: 360 }}>
                          <strong style={{ display: "block", color: rule.isActive ? "#0f172a" : "#94a3b8", marginBottom: 4 }}>
                            {rule.name}
                          </strong>
                          <div
                            title={`${rule.pattern} (Nhấn để sao chép)`}
                            onClick={() => {
                              navigator.clipboard?.writeText(rule.pattern);
                              setSuccessMessage(`Đã sao chép pattern của "${rule.name}"!`);
                            }}
                            style={{
                              fontSize: 11,
                              background: "#f1f5f9",
                              padding: "4px 8px",
                              borderRadius: 6,
                              color: "#475569",
                              fontFamily: "monospace",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: 340,
                              display: "block",
                              border: "1px solid #e2e8f0",
                              cursor: "pointer"
                            }}
                          >
                            <span style={{ fontWeight: 700, color: "#2563eb" }}>[{rule.matchType}]</span> {rule.pattern}
                          </div>
                        </td>

                        <td style={{ padding: "12px 14px" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background: `${scopeItem.color}15`,
                            color: scopeItem.color,
                            border: `1px solid ${scopeItem.color}40`
                          }}>
                            {scopeItem.label.split(". ")[1] || scopeItem.label}
                          </span>
                        </td>

                        <td style={{ padding: "12px 14px" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background: `${actionItem.color}15`,
                            color: actionItem.color,
                            border: `1px solid ${actionItem.color}40`
                          }}>
                            {actionItem.label.split(" ")[0]} {actionItem.label.split(" ")[1] || ""}
                          </span>
                        </td>

                        <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 700, color: "#334155" }}>
                          {rule.priority || 50}
                        </td>

                        <td style={{ padding: "12px 14px", textAlign: "center" }}>
                          <span style={{
                            background: rule.hitCount > 0 ? "#eff6ff" : "#f1f5f9",
                            color: rule.hitCount > 0 ? "#1d4ed8" : "#94a3b8",
                            fontWeight: 800,
                            padding: "3px 8px",
                            borderRadius: 12,
                            fontSize: 11
                          }}>
                            {rule.hitCount || 0}
                          </span>
                        </td>

                        <td style={{ padding: "12px 14px", textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleToggleRule(rule)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 20,
                              border: "none",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              background: rule.isActive ? "#ecfdf5" : "#fef2f2",
                              color: rule.isActive ? "#059669" : "#dc2626"
                            }}
                          >
                            {rule.isActive ? "● BẬT" : "○ TẮT"}
                          </button>
                        </td>

                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(rule)}
                              style={{
                                padding: "4px 8px",
                                background: "#f8fafc",
                                border: "1px solid #cbd5e1",
                                borderRadius: 6,
                                cursor: "pointer",
                                fontSize: 12
                              }}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRule(rule)}
                              style={{
                                padding: "4px 8px",
                                background: "#fff1f2",
                                border: "1px solid #fecaca",
                                color: "#e11d48",
                                borderRadius: 6,
                                cursor: "pointer",
                                fontSize: 12
                              }}
                            >
                              Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </AdminCard>
        </div>
      )}

      {/* ==================== TAB 2: TÙY BIẾN PROMPT CHO 3 CHỨC NĂNG ==================== */}
      {activeTab === "prompts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
            {["GENERAL_CHAT", "BUILDER_SUGGEST", "BUILDER_AUDIT_CHAT"].map((scopeKey) => {
              const promptData = prompts[scopeKey] || {};
              const scopeInfo = SCOPES.find((s) => s.id === scopeKey) || {};

              return (
                <AdminCard
                  key={scopeKey}
                  title={`${scopeInfo.label || scopeKey}`}
                >
                  <div style={{ display: "grid", gap: 16 }}>
                    <AdminField label="Tên chức năng & Định danh">
                      <input
                        type="text"
                        value={promptData.name || ""}
                        onChange={(e) => {
                          setPrompts((prev) => ({
                            ...prev,
                            [scopeKey]: { ...prev[scopeKey], name: e.target.value }
                          }));
                        }}
                        style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                      />
                    </AdminField>

                    <AdminField label="System Prompt (Chỉ thị tối cao hướng dẫn hành vi của AI)">
                      <textarea
                        rows={6}
                        value={promptData.systemPrompt || ""}
                        onChange={(e) => {
                          setPrompts((prev) => ({
                            ...prev,
                            [scopeKey]: { ...prev[scopeKey], systemPrompt: e.target.value }
                          }));
                        }}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          fontFamily: "monospace",
                          fontSize: 13,
                          lineHeight: 1.5
                        }}
                      />
                    </AdminField>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                      <AdminField label="AI Model Engine">
                        <select
                          value={promptData.model || "gemini-3.5-flash-lite"}
                          onChange={(e) => {
                            setPrompts((prev) => ({
                              ...prev,
                              [scopeKey]: { ...prev[scopeKey], model: e.target.value }
                            }));
                          }}
                          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                        >
                          <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite (Khuyên dùng - Siêu tốc, phản hồi tức thì)</option>
                          <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (Dự phòng ổn định / Fallback)</option>
                        </select>
                      </AdminField>

                      <AdminField label={`Nhiệt độ (Temperature: ${promptData.temperature ?? 0.3})`}>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={promptData.temperature ?? 0.3}
                          onChange={(e) => {
                            setPrompts((prev) => ({
                              ...prev,
                              [scopeKey]: { ...prev[scopeKey], temperature: parseFloat(e.target.value) }
                            }));
                          }}
                        />
                      </AdminField>

                      <AdminField label="Giới hạn Token (Max Tokens)">
                        <input
                          type="number"
                          value={promptData.maxTokens || 1024}
                          onChange={(e) => {
                            setPrompts((prev) => ({
                              ...prev,
                              [scopeKey]: { ...prev[scopeKey], maxTokens: parseInt(e.target.value, 10) }
                            }));
                          }}
                          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                        />
                      </AdminField>
                    </div>

                    <div style={{ textAlign: "right", marginTop: 8 }}>
                      <AdminBtn
                        variant="primary"
                        onClick={() => handleSavePrompt(scopeKey)}
                        disabled={savingPromptScope === scopeKey}
                      >
                        {savingPromptScope === scopeKey ? "Đang lưu..." : "💾 Lưu Cấu Hình Prompt Này"}
                      </AdminBtn>
                    </div>
                  </div>
                </AdminCard>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== TAB 3: TEST SIMULATOR ==================== */}
      {activeTab === "test" && (
        <div style={{ width: "100%" }}>
          <AdminCard title="🧪 Công Cụ Kiểm Thử Bộ Lọc Đầu Vào Trực Quan">
            <p style={{ color: "#64748b", fontSize: 13, marginTop: 0 }}>
              Mô phỏng chính xác cách hệ thống tiếp nhận và phân luồng câu hỏi trước khi quyết định Tự Trả Lời (Local 0ms) hay Chuyển Tiếp Cho AI Engine.
            </p>

            <form onSubmit={handleRunTest} style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <AdminField label="Chọn Chức Năng Cần Kiểm Thử">
                  <select
                    value={testScope}
                    onChange={(e) => setTestScope(e.target.value)}
                    style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontWeight: 700 }}
                  >
                    <option value="GENERAL_CHAT">1. AI Chat Tư Vấn Chung</option>
                    <option value="BUILDER_SUGGEST">2. AI Đề Xuất Cấu Hình (32 linh kiện)</option>
                    <option value="BUILDER_AUDIT_CHAT">3. AI Giám Định & Chat Build PC</option>
                  </select>
                </AdminField>

                <AdminField label="Ngân sách giả lập (VNĐ)">
                  <input
                    type="number"
                    step="500000"
                    value={testBudget}
                    onChange={(e) => setTestBudget(Number(e.target.value))}
                    style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                </AdminField>
              </div>

              <AdminField label="Nội dung câu hỏi hoặc yêu cầu kiểm thử">
                <textarea
                  rows={3}
                  placeholder="Nhập thử: 'Chính sách bảo hành thế nào', 'Nguồn có nổ không', 'Nấu canh bí đỏ', hoặc 'Build PC gaming 3 triệu'..."
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
                />
              </AdminField>

              <div>
                <AdminBtn
                  variant="primary"
                  type="submit"
                  disabled={isTesting || (!testText.trim() && testScope !== "BUILDER_SUGGEST")}
                >
                  {isTesting ? "Đang kiểm tra..." : "🚀 Chạy Kiểm Thử Bộ Lọc"}
                </AdminBtn>
              </div>
            </form>

            {/* Kết Quả Mô Phỏng */}
            {testResult && (
              <div style={{
                marginTop: 24,
                padding: 20,
                borderRadius: 12,
                background: testResult.handled
                  ? testResult.action === "BLOCK"
                    ? "#fef2f2"
                    : "#ecfdf5"
                  : "#eff6ff",
                border: "2px solid " + (testResult.handled ? (testResult.action === "BLOCK" ? "#fca5a5" : "#6ee7b7") : "#93c5fd")
              }}>
                <h4 style={{ margin: "0 0 10px", fontSize: 16 }}>
                  {testResult.handled ? (
                    testResult.action === "BLOCK" ? (
                      <span style={{ color: "#dc2626" }}>🛡️ ĐÃ BỊ CHẶN BỞI BỘ LỌC (BLOCK)</span>
                    ) : (
                      <span style={{ color: "#059669" }}>⚡ TỰ TRẢ LỜI NGAY TẠI CHỖ (DIRECT REPLY - 0ms, 0$ TOKEN)</span>
                    )
                  ) : (
                    <span style={{ color: "#1d4ed8" }}>🤖 VƯỢT QUA BỘ LỌC TẦNG 1 ➔ CHUYỂN TIẾP CHO AI LLM API</span>
                  )}
                </h4>

                <div style={{ display: "grid", gap: 8, fontSize: 13.5 }}>
                  <div>
                    <strong>Quy tắc bắt trúng:</strong>{" "}
                    {testResult.ruleName ? (
                      <span style={{ fontWeight: 700, color: "#0f172a" }}>{testResult.ruleName} (ID: {testResult.ruleId})</span>
                    ) : (
                      <span style={{ color: "#64748b" }}>Không khớp quy tắc tĩnh nào ➔ Cần trí tuệ nhân tạo suy luận</span>
                    )}
                  </div>

                  <div>
                    <strong>Mô hình phụ trách:</strong> <code>{testResult.model}</code>
                  </div>

                  {testResult.reply ? (
                    <div style={{ marginTop: 10, background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <strong>Nội dung phản hồi cho khách:</strong>
                      <p style={{ margin: "6px 0 0", whiteSpace: "pre-line", color: "#334155" }}>{testResult.reply}</p>
                    </div>
                  ) : null}

                  {testResult.promptInjections && testResult.promptInjections.length > 0 ? (
                    <div style={{ marginTop: 10, background: "#fffbeb", padding: 14, borderRadius: 8, border: "1px solid #fde68a" }}>
                      <strong>Chỉ thị đặc biệt được tiêm vào System Prompt:</strong>
                      <ul style={{ margin: "6px 0 0", paddingLeft: 20, color: "#92400e" }}>
                        {testResult.promptInjections.map((inj, idx) => (
                          <li key={idx}>{inj}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </AdminCard>
        </div>
      )}

      {/* ==================== TAB 5: QUẢN LÝ TÀI LIỆU RAG & TRI THỨC (EXECUTIVE STUDIO) ==================== */}
      {activeTab === "rag" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
          <div className="ai-rag-workspace">
            {/* CỘT TRÁI: NẠP TRI THỨC MỚI (DRAG & DROP INGESTION STUDIO) */}
            <section className="ai-studio-panel">
              <div className="ai-studio-panel-head">
                <div className="ai-studio-panel-title-wrap">
                  <span className="ai-studio-panel-icon" style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #dbeafe" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="ai-studio-panel-title">Nạp & Vector Hóa Tri Thức Mới</h3>
                    <p className="ai-studio-panel-sub">Tự động trích xuất, cắt đoạn ngữ nghĩa và nạp vào ChromaDB</p>
                  </div>
                </div>
              </div>

              <div className="ai-studio-panel-body">
                <form onSubmit={handleUploadDocument} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.md,.txt"
                    style={{ display: "none" }}
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />

                  {!uploadFile ? (
                    <div
                      role="button"
                      tabIndex={0}
                      className={`ai-dropzone${isDraggingFile ? " is-dragging" : ""}`}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          fileInputRef.current?.click();
                        }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingFile(true);
                      }}
                      onDragLeave={() => setIsDraggingFile(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingFile(false);
                        const dropped = e.dataTransfer.files?.[0];
                        if (dropped) setUploadFile(dropped);
                      }}
                    >
                      <span className="ai-dropzone-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="12" y1="18" x2="12" y2="12" />
                          <polyline points="9 15 12 12 15 15" />
                        </svg>
                      </span>
                      <div className="ai-dropzone-title">Kéo thả tài liệu vào đây hoặc bấm để chọn tệp</div>
                      <div className="ai-dropzone-sub">Hỗ trợ tài liệu kỹ thuật, chính sách bảo hành, hướng dẫn lắp ráp</div>
                      <div className="ai-format-pills">
                        <span className="ai-format-pill">PDF</span>
                        <span className="ai-format-pill">MARKDOWN</span>
                        <span className="ai-format-pill">TXT</span>
                        <span className="ai-format-pill">≤ 15MB</span>
                      </div>
                    </div>
                  ) : (
                    <div className="ai-selected-file">
                      <div className="ai-selected-file-meta">
                        <span className={`ai-doc-ext-badge ${uploadFile.name.toLowerCase().endsWith(".pdf") ? "is-pdf" : uploadFile.name.toLowerCase().endsWith(".md") ? "is-md" : "is-txt"}`}>
                          {uploadFile.name.split(".").pop()?.toUpperCase() || "DOC"}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="ai-selected-file-name" title={uploadFile.name}>{uploadFile.name}</div>
                          <div className="ai-selected-file-size">
                            {(uploadFile.size / 1024).toFixed(1)} KB • Sẵn sàng trích xuất & vector hóa
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="ai-selected-file-clear"
                        title="Bỏ chọn tệp này"
                        onClick={() => {
                          setUploadFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Visual Scope Selector Cards */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
                      Phạm vi nghiệp vụ áp dụng
                    </div>
                    <div className="ai-scope-grid">
                      {[
                        { id: "all", title: "Toàn hệ thống", desc: "Chatbot & PC Builder" },
                        { id: "chatbot", title: "AI Chatbot", desc: "Chính sách & CSKH" },
                        { id: "pc_builder", title: "PC Builder", desc: "Thông số & luật ráp" }
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          className={`ai-scope-option${uploadTargetService === opt.id ? " is-active" : ""}`}
                          onClick={() => setUploadTargetService(opt.id)}
                        >
                          <strong>{opt.title}</strong>
                          <span>{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4-Step Visual AIO2026 Ingestion Pipeline */}
                  <div className="ai-pipeline-box">
                    <div className="ai-pipeline-label">Quy trình xử lý tự động (AIO2026 Pipeline)</div>
                    <div className="ai-pipeline-steps">
                      <div className="ai-pipeline-step">
                        <span className="ai-pipeline-num">01</span>
                        <div>
                          <strong>Trích xuất văn bản</strong>
                          <small>Đọc cấu trúc PDF / MD / TXT</small>
                        </div>
                      </div>
                      <div className="ai-pipeline-step">
                        <span className="ai-pipeline-num">02</span>
                        <div>
                          <strong>Chuẩn hóa NFC</strong>
                          <small>Giữ nguyên W, GHz, Socket</small>
                        </div>
                      </div>
                      <div className="ai-pipeline-step">
                        <span className="ai-pipeline-num">03</span>
                        <div>
                          <strong>Smart Chunking</strong>
                          <small>600 ký tự • Overlap 120</small>
                        </div>
                      </div>
                      <div className="ai-pipeline-step">
                        <span className="ai-pipeline-num">04</span>
                        <div>
                          <strong>Hybrid Indexing</strong>
                          <small>ChromaDB + BM25Okapi</small>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="ai-upload-submit"
                    disabled={isUploading || !uploadFile}
                  >
                    <svg className={isUploading ? "ai-studio-spin" : ""} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                      {isUploading ? (
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      ) : (
                        <>
                          <path d="M22 2L11 13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </>
                      )}
                    </svg>
                    <span>{isUploading ? "Đang trích xuất & Vector hóa..." : "Tiến Hành Tải Lên & Vector Hóa"}</span>
                  </button>
                </form>
              </div>
            </section>

            {/* CỘT PHẢI: KHO TÀI LIỆU ĐÃ VECTOR HÓA */}
            <section className="ai-studio-panel">
              <div className="ai-studio-panel-head">
                <div className="ai-studio-panel-title-wrap">
                  <span className="ai-studio-panel-icon" style={{ background: "#f5f3ff", color: "#6d28d9", border: "1px solid #ede9fe" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="ai-studio-panel-title">
                      Kho Tài Liệu Đã Vector Hóa{" "}
                      <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", marginLeft: 4 }}>
                        {documents.length} tệp
                      </span>
                    </h3>
                    <p className="ai-studio-panel-sub">Đồng bộ trực tiếp với ChromaDB & BM25Okapi tại AI Service</p>
                  </div>
                </div>

                <div style={{ position: "relative" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.3" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    className="ai-doc-search"
                    placeholder="Tìm tài liệu theo tên..."
                    value={docSearchKeyword}
                    onChange={(e) => setDocSearchKeyword(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ padding: 0 }}>
                {loadingDocs ? (
                  <div style={{ textAlign: "center", padding: "52px 24px", color: "#64748b", fontSize: 13.5 }}>
                    Đang tải danh sách tài liệu RAG từ AI Service...
                  </div>
                ) : filteredDocuments.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "54px 24px", color: "#64748b" }}>
                    <div style={{
                      width: 52,
                      height: 52,
                      margin: "0 auto 12px",
                      borderRadius: 14,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#94a3b8"
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                    </div>
                    <strong style={{ display: "block", fontSize: 14, color: "#0f172a", marginBottom: 4 }}>
                      {documents.length === 0 ? "Kho tài liệu mở rộng đang trống" : "Không tìm thấy tài liệu phù hợp"}
                    </strong>
                    <span style={{ fontSize: 12.5, color: "#94a3b8" }}>
                      {documents.length === 0
                        ? "Kéo thả tệp .pdf, .md hoặc .txt ở khung bên trái để nạp tri thức đầu tiên."
                        : "Thử xóa từ khóa tìm kiếm để xem toàn bộ tài liệu."}
                    </span>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="ai-doc-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left" }}>Tài Liệu</th>
                          <th style={{ textAlign: "center" }}>Phân Đoạn</th>
                          <th style={{ textAlign: "center" }}>Phạm Vi</th>
                          <th style={{ textAlign: "right" }}>Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDocuments.map((doc, idx) => {
                          const extClass = doc.format === "PDF" ? "is-pdf" : doc.format === "MD" ? "is-md" : "is-txt";
                          return (
                            <tr key={doc.fileName || idx}>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                                  <span className={`ai-doc-ext-badge ${extClass}`}>{doc.format}</span>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13.5, lineHeight: 1.3 }}>
                                      {doc.title || doc.fileName}
                                    </div>
                                    <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                                      <code>{doc.fileName}</code> • {doc.fileSizeKb} KB
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td style={{ textAlign: "center" }}>
                                <span style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  background: "#eff6ff",
                                  color: "#1d4ed8",
                                  border: "1px solid #dbeafe",
                                  fontWeight: 800,
                                  padding: "3px 10px",
                                  borderRadius: 999,
                                  fontSize: 11.5
                                }}>
                                  {doc.chunkCount} chunks
                                </span>
                              </td>

                              <td style={{ textAlign: "center" }}>
                                <span style={{
                                  display: "inline-block",
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  padding: "3px 10px",
                                  borderRadius: 999,
                                  background: doc.targetService === "chatbot" ? "#dcfce7" : doc.targetService === "pc_builder" ? "#fef3c7" : "#f3e8ff",
                                  color: doc.targetService === "chatbot" ? "#166534" : doc.targetService === "pc_builder" ? "#92400e" : "#6b21a8"
                                }}>
                                  {doc.targetService === "chatbot" ? "Chatbot" : doc.targetService === "pc_builder" ? "PC Builder" : "Cả 2 hệ thống"}
                                </span>
                              </td>

                              <td style={{ textAlign: "right" }}>
                                <div style={{ display: "inline-flex", gap: 6 }}>
                                  <button
                                    type="button"
                                    className="ai-action-btn ai-action-btn--ghost"
                                    onClick={() => handlePreviewChunks(doc.fileName)}
                                    title="Xem chi tiết phân đoạn chunks"
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                    <span>Xem Chunks</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="ai-action-btn ai-action-btn--danger"
                                    onClick={() => handleDeleteDocument(doc.fileName)}
                                    title="Xóa tài liệu và vector"
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                                    <span>Xóa</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* PHẦN DƯỚI: KIẾN TRÚC EMBEDDING & TELEMETRY TÀI NGUYÊN SERVER 4GB RAM */}
          <section className="ai-studio-panel">
            <div className="ai-studio-panel-head">
              <div className="ai-studio-panel-title-wrap">
                <span className="ai-studio-panel-icon" style={{ background: "#ecfdf5", color: "#059669", border: "1px solid #bbf7d0" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" /></svg>
                </span>
                <div>
                  <h3 className="ai-studio-panel-title">Kiến Trúc Vector Embedding & Tối Ưu Tài Nguyên Server (4GB RAM + Swap)</h3>
                  <p className="ai-studio-panel-sub">So sánh thực nghiệm các mô hình nhúng vector và phân bổ bộ nhớ thực tế khi triển khai sản phẩm</p>
                </div>
              </div>
              <span style={{ padding: "5px 12px", borderRadius: 999, background: "#ecfdf5", border: "1px solid #86efac", color: "#15803d", fontSize: 11.5, fontWeight: 700 }}>
                Active: models/gemini-embedding-001 (3072d)
              </span>
            </div>

            <div className="ai-studio-panel-body">
              {/* Visual 4GB RAM Telemetry Bar */}
              <div className="ai-ram-bar-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <strong style={{ fontSize: 13, color: "#0f172a" }}>Phân bổ bộ nhớ dự toán trên máy chủ chuẩn 4.0 GB RAM</strong>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>Dư tải an toàn: ~1.74 GB RAM trống (43.5%)</span>
                </div>
                <div className="ai-ram-track">
                  <div style={{ width: "30%", background: "#475569" }} title="OS & System Services: 1.2GB" />
                  <div style={{ width: "15%", background: "#2563eb" }} title="MySQL 8.0: 600MB" />
                  <div style={{ width: "4.5%", background: "#8b5cf6" }} title="Node.js Express API: 180MB" />
                  <div style={{ width: "7%", background: "#06b6d4" }} title="Python FastAPI + ChromaDB: 280MB" />
                  <div style={{ width: "43.5%", background: "#10b981" }} title="RAM trống dự phòng: 1.74GB" />
                </div>
                <div className="ai-ram-legend">
                  <span className="ai-ram-legend-item"><span className="ai-ram-dot" style={{ background: "#475569" }} /> OS & Base (1.2GB)</span>
                  <span className="ai-ram-legend-item"><span className="ai-ram-dot" style={{ background: "#2563eb" }} /> MySQL 8.0 (600MB)</span>
                  <span className="ai-ram-legend-item"><span className="ai-ram-dot" style={{ background: "#8b5cf6" }} /> Express API (180MB)</span>
                  <span className="ai-ram-legend-item"><span className="ai-ram-dot" style={{ background: "#06b6d4" }} /> AI RAG Service (280MB)</span>
                  <span className="ai-ram-legend-item"><span className="ai-ram-dot" style={{ background: "#10b981" }} /> <strong>Dự phòng an toàn (1.74GB)</strong></span>
                </div>
              </div>

              {/* Clean Executive Comparison Table */}
              <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <table className="ai-doc-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Mô Hình Embedding</th>
                      <th style={{ textAlign: "center" }}>Số Chiều</th>
                      <th style={{ textAlign: "center" }}>Tiêu Thụ RAM</th>
                      <th style={{ textAlign: "center" }}>Độ Trễ</th>
                      <th style={{ textAlign: "center" }}>Quota / Chi Phí</th>
                      <th style={{ textAlign: "left" }}>Đánh Giá Triển Khai</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: "#f0fdf4" }}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <strong style={{ color: "#14532d" }}>Google Gemini Embedding</strong>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 999, background: "#16a34a", color: "#fff", letterSpacing: "0.04em" }}>
                            ĐANG CHẠY
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "#15803d", marginTop: 2 }}><code>models/gemini-embedding-001</code></div>
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 800, color: "#14532d" }}>3072d</td>
                      <td style={{ textAlign: "center", fontWeight: 800, color: "#15803d" }}>0 MB (Cloud TPU)</td>
                      <td style={{ textAlign: "center", color: "#166534" }}>100–250ms</td>
                      <td style={{ textAlign: "center", fontWeight: 700, color: "#15803d" }}>Gemini API</td>
                      <td style={{ fontSize: 12, color: "#166534", lineHeight: 1.45 }}>
                        <strong>Tối ưu số 1:</strong> Không tốn RAM máy chủ, nắm bắt sâu ngữ nghĩa tiếng Việt & mã linh kiện phần cứng.
                      </td>
                    </tr>

                    <tr>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <strong style={{ color: "#0f172a" }}>all-MiniLM-L6-v2 (ONNX)</strong>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
                            DỰ PHÒNG OFFLINE
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>Tự kích hoạt khi mất mạng / lỗi API</div>
                      </td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>384d</td>
                      <td style={{ textAlign: "center", color: "#334155" }}>~150 MB</td>
                      <td style={{ textAlign: "center", color: "#059669", fontWeight: 600 }}>5–15ms</td>
                      <td style={{ textAlign: "center" }}>Không giới hạn (0đ)</td>
                      <td style={{ fontSize: 12, color: "#475569", lineHeight: 1.45 }}>
                        Chạy cục bộ qua ONNX Runtime (&lt;4% RAM), bảo đảm truy hồi không bao giờ gián đoạn.
                      </td>
                    </tr>

                    <tr>
                      <td><strong style={{ color: "#0f172a" }}>BAAI/bge-small-en-v1.5 (FastEmbed)</strong></td>
                      <td style={{ textAlign: "center" }}>384d</td>
                      <td style={{ textAlign: "center" }}>~180 MB</td>
                      <td style={{ textAlign: "center" }}>8–20ms</td>
                      <td style={{ textAlign: "center" }}>Không giới hạn</td>
                      <td style={{ fontSize: 12, color: "#475569", lineHeight: 1.45 }}>
                        Benchmark MTEB cao, lõi Rust nhẹ nhưng thiên về ngữ liệu tiếng Anh.
                      </td>
                    </tr>

                    <tr>
                      <td><strong style={{ color: "#0f172a" }}>paraphrase-multilingual-MiniLM-L12-v2</strong></td>
                      <td style={{ textAlign: "center" }}>384d</td>
                      <td style={{ textAlign: "center", color: "#b45309", fontWeight: 700 }}>~380 MB</td>
                      <td style={{ textAlign: "center" }}>25–40ms</td>
                      <td style={{ textAlign: "center" }}>Không giới hạn</td>
                      <td style={{ fontSize: 12, color: "#475569", lineHeight: 1.45 }}>
                        Đa ngôn ngữ tốt nhưng tiêu thụ RAM gấp 2,5 lần so với MiniLM-L6.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}
      {activeTab === "system" && (() => {
        const activePreset = LLM_PROVIDER_PRESETS[systemConfig.provider] || LLM_PROVIDER_PRESETS.gemini;
        const fallbackPreset = LLM_PROVIDER_PRESETS[systemConfig.fallbackProvider] || null;
        const activeModels = activePreset.models || [];
        const fallbackModels = fallbackPreset?.models || [];
        const activeHasKey = systemConfig.provider === "ollama" || Boolean(systemConfig.apiKey?.trim()) || Boolean(systemConfig.providerKeyStatus?.[systemConfig.provider]?.hasKey) || Boolean(systemConfig.hasApiKey);
        const fbHasKey = systemConfig.fallbackProvider === "ollama" || Boolean(systemConfig.fallbackApiKey?.trim()) || Boolean(systemConfig.providerKeyStatus?.[systemConfig.fallbackProvider]?.hasKey) || Boolean(systemConfig.hasFallbackApiKey);

        return (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* ⚡ BẢNG CHUYỂN ĐỔI NHANH ENGINE AI (1-CLICK QUICK SWITCH) */}
          <AdminCard title="⚡ Chuyển Đổi Nhanh Engine AI (1-Click Quick-Switch)">
            <p style={{ color: "#64748b", fontSize: 13, marginTop: 0, marginBottom: 14 }}>
              Chọn nhanh nhà cung cấp AI chỉ với 1 cú nhấp. Hệ thống lưu riêng API Key cho từng nhà cung cấp nên bạn có thể chuyển đổi qua lại giữa <strong>Groq</strong> và <strong>Gemini</strong> tức thì mà không lo mất khóa cũ.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {Object.values(LLM_PROVIDER_PRESETS).map((preset) => {
                const isSelected = systemConfig.provider === preset.id;
                const st = systemConfig.providerKeyStatus?.[preset.id];
                const ready = preset.id === "ollama" || Boolean(st?.hasKey);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectProvider(preset.id)}
                    style={{
                      textAlign: "left",
                      padding: "14px 16px",
                      borderRadius: 12,
                      border: isSelected ? "2px solid #2563eb" : "1px solid #e2e8f0",
                      background: isSelected ? "#eff6ff" : "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      transition: "all 0.15s",
                      boxShadow: isSelected ? "0 4px 12px rgba(37,99,235,0.12)" : "none"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                      <strong style={{ fontSize: 14, color: "#0f172a" }}>{preset.title}</strong>
                      <span style={{ fontSize: 11, fontWeight: 700, color: ready ? "#059669" : "#94a3b8" }}>
                        {ready ? "🟢 Sẵn key" : "⚪ Chưa key"}
                      </span>
                    </div>
                    <span style={{
                      display: "inline-block",
                      alignSelf: "flex-start",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: preset.badgeBg,
                      color: preset.badgeColor
                    }}>
                      {preset.badge}
                    </span>
                    <span style={{ fontSize: 12, color: "#475569", lineHeight: 1.45 }}>{preset.desc}</span>
                  </button>
                );
              })}
            </div>
          </AdminCard>

          <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 20 }}>
            {/* Cột 1: Cấu hình tập trung + Failover đa tầng */}
            <AdminCard title="⚙️ Cấu Hình Chi Tiết & Cơ Chế Tự Động Dự Phòng (Auto-Failover)">
              <p style={{ color: "#64748b", fontSize: 13, marginTop: 0 }}>
                Tinh chỉnh model, khóa API riêng từng hãng, và kích hoạt chuyển mạch tự động 3 tầng để chatbot & PC Builder luôn phản hồi tức thì dưới 1 giây.
              </p>

              {/* Sơ đồ luồng Failover 3 tầng trực quan */}
              <div style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 10,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                marginBottom: 16,
                fontSize: 12
              }}>
                <span style={{ fontWeight: 700, color: "#0f172a" }}>Luồng chống nghẽn:</span>
                <span style={{ background: "#dbeafe", color: "#1d4ed8", padding: "3px 9px", borderRadius: 6, fontWeight: 700 }}>
                  1. {systemConfig.provider.toUpperCase()} ({systemConfig.model})
                </span>
                <span style={{ color: "#64748b", fontWeight: 700 }}>➔</span>
                <span style={{
                  background: systemConfig.autoFailover && systemConfig.fallbackProvider && systemConfig.fallbackProvider !== "none" ? "#dcfce7" : "#f1f5f9",
                  color: systemConfig.autoFailover && systemConfig.fallbackProvider && systemConfig.fallbackProvider !== "none" ? "#15803d" : "#64748b",
                  padding: "3px 9px",
                  borderRadius: 6,
                  fontWeight: 700
                }}>
                  2. {systemConfig.autoFailover && systemConfig.fallbackProvider && systemConfig.fallbackProvider !== "none"
                    ? `${systemConfig.fallbackProvider.toUpperCase()} (${systemConfig.fallbackModel || "auto"})`
                    : "Không dùng dự phòng Cloud"}
                </span>
                <span style={{ color: "#64748b", fontWeight: 700 }}>➔</span>
                <span style={{ background: "#fef3c7", color: "#92400e", padding: "3px 9px", borderRadius: 6, fontWeight: 700 }}>
                  3. Expert XAI Engine (&lt;0,1s)
                </span>
              </div>

              <form onSubmit={handleSaveSystemConfig} style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <AdminField label="Nhà Cung Cấp Chính (Primary Provider)">
                    <select
                      value={systemConfig.provider}
                      onChange={(e) => handleSelectProvider(e.target.value)}
                      style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontWeight: 600 }}
                    >
                      <option value="groq">⚡ Groq Cloud (Siêu nhanh ~0,4s, 14.400 lượt/ngày)</option>
                      <option value="gemini">🔷 Google Gemini (gemini-3.5-flash-lite)</option>
                      <option value="openai">🧠 OpenAI (GPT-4o-mini / GPT-4o)</option>
                      <option value="ollama">💻 Ollama Local (Chạy máy chủ nội bộ)</option>
                    </select>
                  </AdminField>

                  <AdminField label="Mô Hình Chính (Model Name)">
                    <select
                      value={activeModels.some((m) => m.value === systemConfig.model) ? systemConfig.model : activePreset.defaultModel}
                      onChange={(e) => setSystemConfig((prev) => ({ ...prev, model: e.target.value }))}
                      style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontWeight: 600 }}
                    >
                      {activeModels.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </AdminField>
                </div>

                {/* API KEY NHÀ CUNG CẤP CHÍNH + NÚT PING ĐO TỐC ĐỘ */}
                <div style={{ background: "#f8fafc", padding: 14, borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <AdminField label={`Khóa API cho ${activePreset.title} (Lưu riêng, không ghi đè hãng khác)`}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        type="password"
                        disabled={systemConfig.provider === "ollama"}
                        placeholder={systemConfig.providerKeyStatus?.[systemConfig.provider]?.masked || systemConfig.apiKeyMasked || activePreset.keyPlaceholder}
                        value={systemConfig.apiKey}
                        onChange={(e) => setSystemConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                        style={{ flex: 1, minWidth: 200, padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                      />
                      <button
                        type="button"
                        onClick={() => handleTestConnection("primary")}
                        disabled={testingConnTarget !== null}
                        style={{
                          padding: "9px 14px",
                          borderRadius: 8,
                          border: "1px solid #2563eb",
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: testingConnTarget ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {testingConnTarget === "primary" ? "⏳ Đang đo..." : "⚡ Test kết nối"}
                      </button>
                      <span style={{ fontSize: 12, color: activeHasKey ? "#059669" : "#dc2626", fontWeight: 700 }}>
                        {activeHasKey ? "🟢 Đã có Key" : "🔴 Chưa có Key"}
                      </span>
                    </div>
                    <small style={{ color: "#64748b", fontSize: 11.5, display: "block", marginTop: 6 }}>
                      🔒 Khóa API được che mờ an toàn.{" "}
                      {systemConfig.provider !== "ollama" && (
                        <a href={activePreset.keyUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontWeight: 600 }}>
                          Mở trang lấy khóa {systemConfig.provider.toUpperCase()} ↗
                        </a>
                      )}
                    </small>
                  </AdminField>
                </div>

                {/* CẤU HÌNH NHÀ CUNG CẤP DỰ PHÒNG (AUTO-FAILOVER) */}
                <div style={{ background: "#f0fdf4", padding: 14, borderRadius: 10, border: "1px solid #bbf7d0", display: "grid", gap: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 700, fontSize: 13.5, color: "#166534" }}>
                    <input
                      type="checkbox"
                      checked={systemConfig.autoFailover !== false}
                      onChange={(e) => setSystemConfig((prev) => ({ ...prev, autoFailover: e.target.checked }))}
                    />
                    🛡️ Bật Tự Động Chuyển Dự Phòng (Auto-Failover) khi nhà cung cấp chính quá tải (503 / 429 / chậm &gt;3s)
                  </label>

                  {systemConfig.autoFailover !== false && (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <AdminField label="Nhà Cung Cấp Dự Phòng (Backup Provider)">
                          <select
                            value={systemConfig.fallbackProvider || "none"}
                            onChange={(e) => handleSelectFallbackProvider(e.target.value)}
                            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #86efac", background: "#fff", fontSize: 13 }}
                          >
                            <option value="groq">⚡ Groq Cloud (Khuyên dùng làm dự phòng/chính)</option>
                            <option value="gemini">🔷 Google Gemini</option>
                            <option value="openai">🧠 OpenAI</option>
                            <option value="ollama">💻 Ollama Local</option>
                            <option value="none">— Tắt (Chỉ chuyển sang Expert XAI Engine)</option>
                          </select>
                        </AdminField>

                        <AdminField label="Model Dự Phòng">
                          <select
                            disabled={!fallbackPreset}
                            value={fallbackPreset && fallbackModels.some((m) => m.value === systemConfig.fallbackModel) ? systemConfig.fallbackModel : (fallbackPreset?.defaultModel || "")}
                            onChange={(e) => setSystemConfig((prev) => ({ ...prev, fallbackModel: e.target.value }))}
                            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #86efac", background: "#fff", fontSize: 13 }}
                          >
                            {fallbackPreset ? (
                              fallbackModels.map((m) => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))
                            ) : (
                              <option value="">Không kích hoạt</option>
                            )}
                          </select>
                        </AdminField>
                      </div>

                      {fallbackPreset && (
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <input
                            type="password"
                            disabled={systemConfig.fallbackProvider === "ollama"}
                            placeholder={systemConfig.providerKeyStatus?.[systemConfig.fallbackProvider]?.masked || systemConfig.fallbackApiKeyMasked || fallbackPreset.keyPlaceholder}
                            value={systemConfig.fallbackApiKey || ""}
                            onChange={(e) => setSystemConfig((prev) => ({ ...prev, fallbackApiKey: e.target.value }))}
                            style={{ flex: 1, minWidth: 190, padding: "8px 10px", borderRadius: 8, border: "1px solid #86efac", background: "#fff", fontSize: 13 }}
                          />
                          <button
                            type="button"
                            onClick={() => handleTestConnection("fallback")}
                            disabled={testingConnTarget !== null}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: "1px solid #16a34a",
                              background: "#ffffff",
                              color: "#15803d",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: testingConnTarget ? "not-allowed" : "pointer",
                              whiteSpace: "nowrap"
                            }}
                          >
                            {testingConnTarget === "fallback" ? "⏳ Đang đo..." : "⚡ Test dự phòng"}
                          </button>
                          <span style={{ fontSize: 12, color: fbHasKey ? "#15803d" : "#b45309", fontWeight: 700 }}>
                            {fbHasKey ? "🟢 Dự phòng sẵn sàng" : "⚠️ Chưa nhập key dự phòng"}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* KẾT QUẢ KIỂM TRA KẾT NỐI TRỰC TIẾP (LIVE PING RESULT) */}
                {connTestResult && (
                  <div style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: connTestResult.ok ? "#ecfdf5" : "#fef2f2",
                    border: `1.5px solid ${connTestResult.ok ? "#6ee7b7" : "#fca5a5"}`,
                    fontSize: 13,
                    color: connTestResult.ok ? "#065f46" : "#991b1b"
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                      {connTestResult.ok
                        ? `✅ Kết nối ${String(connTestResult.provider || "").toUpperCase()} (${connTestResult.model}) THÀNH CÔNG • Tốc độ: ${connTestResult.latencyMs}ms`
                        : `❌ Kết nối ${String(connTestResult.provider || "").toUpperCase()} (${connTestResult.model}) THẤT BẠI (${connTestResult.latencyMs}ms)`}
                    </div>
                    {connTestResult.ok && connTestResult.replyPreview && (
                      <div style={{ fontSize: 12, color: "#047857" }}>
                        Phản hồi thử: <em>"{connTestResult.replyPreview}"</em>
                      </div>
                    )}
                    {!connTestResult.ok && (
                      <div style={{ fontSize: 12 }}>
                        <strong>Chi tiết:</strong> {connTestResult.error}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <AdminField label={`Độ Sáng Tạo (Temperature: ${systemConfig.temperature})`}>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={systemConfig.temperature}
                      onChange={(e) => setSystemConfig((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                    />
                    <small style={{ color: "#64748b", fontSize: 11 }}>0.2 - 0.4: Chính xác, trung thực (Khuyên dùng cho linh kiện)</small>
                  </AdminField>

                  <AdminField label="Giới Hạn Token Đầu Ra (Max Output Tokens)">
                    <select
                      value={systemConfig.maxTokens}
                      onChange={(e) => setSystemConfig((prev) => ({ ...prev, maxTokens: parseInt(e.target.value, 10) }))}
                      style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                    >
                      <option value={1024}>1024 tokens (~750 từ tiếng Việt)</option>
                      <option value={1536}>1536 tokens (~1150 từ tiếng Việt)</option>
                      <option value={2048}>2048 tokens (~1500 từ tiếng Việt - Chuẩn)</option>
                      <option value={4096}>4096 tokens (~3000 từ tiếng Việt - Chuyên sâu)</option>
                    </select>
                  </AdminField>
                </div>

                <AdminField label="Số Lượng Sản Phẩm Kho Hàng Gửi Kèm (Max Grounded Products)">
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input
                      type="number"
                      min={10}
                      max={100}
                      step={5}
                      value={systemConfig.maxCatalogProducts}
                      onChange={(e) => setSystemConfig((prev) => ({ ...prev, maxCatalogProducts: parseInt(e.target.value, 10) || 35 }))}
                      style={{ width: 120, padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                    />
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      sản phẩm (Khuyên dùng: 25 - 35 để chống hiện tượng "Lost-in-the-middle")
                    </span>
                  </div>
                </AdminField>

                <div style={{ textAlign: "right", marginTop: 6 }}>
                  <AdminBtn variant="primary" type="submit" disabled={savingSystemConfig}>
                    {savingSystemConfig ? "Đang lưu..." : "💾 Lưu & Đồng Bộ Hệ Thống AI Ngay"}
                  </AdminBtn>
                </div>
              </form>
            </AdminCard>

            {/* Cột 2: Hướng dẫn chuyển đổi 30 giây + Dự toán Token */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <AdminCard title="🚀 Hướng Dẫn Chuyển Sang Groq Miễn Phí (30 Giây — Hết Lỗi 503/429)">
                <p style={{ color: "#475569", fontSize: 13, marginTop: 0, lineHeight: 1.55 }}>
                  Google Gemini Free Tier thường bị giới hạn <strong>20 lượt/ngày</strong> hoặc quá tải <strong>503</strong> vào giờ cao điểm. Bạn có thể kích hoạt <strong>Groq Cloud</strong> miễn phí (không cần thẻ tín dụng) để AI trả lời mượt dưới <strong>0,5 giây</strong>:
                </p>
                <ol style={{ margin: "0 0 12px", paddingLeft: 20, fontSize: 13, color: "#1e293b", lineHeight: 1.7 }}>
                  <li>
                    Mở{" "}
                    <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontWeight: 700 }}>
                      console.groq.com/keys ↗
                    </a>{" "}
                    và đăng nhập nhanh bằng tài khoản Google/GitHub.
                  </li>
                  <li>
                    Bấm <strong>Create API Key</strong> → đặt tên <code>pcmall</code> → sao chép chuỗi bắt đầu bằng <code>gsk_...</code>.
                  </li>
                  <li>
                    Bấm thẻ <strong>⚡ Groq Cloud (Llama 3.3)</strong> phía trên (hoặc dán vào ô <strong>Dự Phòng</strong> nếu vẫn muốn giữ Gemini làm chính) → bấm <strong>⚡ Test kết nối</strong> → bấm <strong>💾 Lưu & Đồng Bộ</strong> (áp dụng ngay lập tức, không cần khởi động lại server!).
                  </li>
                </ol>
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: "10px 12px", borderRadius: 8, fontSize: 12, color: "#92400e", lineHeight: 1.55 }}>
                  💡 <strong>Khuyến nghị tối ưu khi Demo / Bảo vệ KLTN:</strong> Đặt <strong>Groq (llama-3.3-70b-versatile)</strong> làm <em>Provider Chính</em> + giữ <strong>Gemini</strong> làm <em>Provider Dự Phòng</em> + bật <strong>Auto-Failover</strong>. Hệ thống sẽ có 3 lớp bảo vệ liên hoàn (Groq ➔ Gemini ➔ Expert XAI Engine) đảm bảo <strong>0% chết demo</strong>!
                </div>
              </AdminCard>

              <AdminCard title="📊 Bảng Phân Tích & Dự Toán Token (100 Sản Phẩm)">
                <p style={{ color: "#64748b", fontSize: 13, marginTop: 0 }}>
                  Đánh giá chi phí token và hiệu năng giữa các phương thức đóng gói dữ liệu kho hàng gửi vào LLM API.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: 14, borderRadius: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <strong style={{ color: "#166534", fontSize: 14 }}>✅ Định Dạng Dòng Nén (Đang áp dụng)</strong>
                      <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                        Khuyên dùng
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                      <div>• <strong>Token / sản phẩm:</strong> ~28 tokens (Mã, Tên, Giá, Tồn, Specs)</div>
                      <div>• <strong>Tổng Input Tokens (100 SP + Prompt):</strong> <strong>~3.750 tokens</strong></div>
                      <div>• <strong>Chi phí (1.000 câu hỏi):</strong> ~$0.0003 / câu (~8 VNĐ)</div>
                    </div>
                  </div>

                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: 14, borderRadius: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <strong style={{ color: "#991b1b", fontSize: 14 }}>❌ Định Dạng Raw JSON Phân Cấp</strong>
                      <span style={{ background: "#fee2e2", color: "#b91c1c", padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                        Không khuyến khích
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                      <div>• <strong>Token / sản phẩm:</strong> ~95 tokens (tốn gấp 3,5 lần)</div>
                      <div>• <strong>Nhược điểm:</strong> Dễ gây hiện tượng Lost-in-the-middle.</div>
                    </div>
                  </div>

                  <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: 14, borderRadius: 12 }}>
                    <strong style={{ color: "#1e40af", fontSize: 13.5, display: "block", marginBottom: 4 }}>
                      💡 Cấu Hình Đầu Ra Hiện Tại
                    </strong>
                    <div style={{ fontSize: 13, color: "#1e3a8a", lineHeight: 1.5 }}>
                      <div>• <strong>Giới hạn sinh ra (Max Output):</strong> <strong>{systemConfig.maxTokens} tokens</strong> (~{Math.round(systemConfig.maxTokens * 0.75)} từ tiếng Việt)</div>
                    </div>
                  </div>
                </div>
              </AdminCard>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ==================== MODAL THÊM / SỬA QUY TẮC ==================== */}
      {isModalOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: 16,
            width: "100%",
            maxWidth: 680,
            maxHeight: "90vh",
            overflowY: "auto",
            padding: 24,
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)"
          }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18, color: "#0f172a" }}>
              {editingRule ? `✏️ Chỉnh Sửa Quy Tắc: ${editingRule.name}` : "➕ Thêm Quy Tắc Lọc Đầu Vào Mới"}
            </h3>

            <form onSubmit={handleSaveRule} style={{ display: "grid", gap: 14 }}>
              <AdminField label="Tên quy tắc">
                <input
                  type="text"
                  placeholder="Ví dụ: Chính sách bảo hành, Chặn câu hỏi nấu ăn..."
                  value={ruleFormData.name}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, name: e.target.value })}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  required
                />
              </AdminField>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <AdminField label="Phạm vi áp dụng (Scope)">
                  <select
                    value={ruleFormData.scope}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, scope: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  >
                    <option value="GENERAL_CHAT">1. AI Chat Tư Vấn Chung</option>
                    <option value="BUILDER_SUGGEST">2. AI Đề Xuất Build PC (32 linh kiện)</option>
                    <option value="BUILDER_AUDIT_CHAT">3. AI Giám Định & Chat Build PC</option>
                    <option value="GLOBAL">Toàn bộ hệ thống</option>
                  </select>
                </AdminField>

                <AdminField label="Kiểu so khớp (Match Type)">
                  <select
                    value={ruleFormData.matchType}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, matchType: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  >
                    {MATCH_TYPES.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </AdminField>
              </div>

              <AdminField label="Mẫu khớp (Pattern / Từ khóa / Regex / Ngưỡng ngân sách)">
                <input
                  type="text"
                  placeholder="Ví dụ: bao hanh,doi tra  HOẶC  < 5000000  HOẶC  ^(chao|hi)\\b"
                  value={ruleFormData.pattern}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, pattern: e.target.value })}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontFamily: "monospace" }}
                  required
                />
              </AdminField>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <AdminField label="Hành động khi khớp (Action)">
                  <select
                    value={ruleFormData.action}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, action: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontWeight: 700 }}
                  >
                    <option value="DIRECT_REPLY">⚡ Tự trả lời ngay (DIRECT_REPLY - 0ms, 0$ token)</option>
                    <option value="BLOCK">🛡️ Chặn câu hỏi (BLOCK - Không phục vụ)</option>
                    <option value="SYSTEM_INJECT">💉 Tiêm chỉ thị vào Prompt (SYSTEM_INJECT)</option>
                  </select>
                </AdminField>

                <AdminField label="Độ ưu tiên (1 - 100, số lớn ưu tiên trước)">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={ruleFormData.priority}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, priority: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                </AdminField>
              </div>

              {ruleFormData.action === "DIRECT_REPLY" && (
                <AdminField label="Nội dung câu trả lời tự động (Hệ thống xuất trực tiếp cho người dùng)">
                  <textarea
                    rows={4}
                    placeholder="Nhập nội dung câu trả lời chuẩn xác. Hỗ trợ định dạng markdown..."
                    value={ruleFormData.directReply}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, directReply: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                    required
                  />
                </AdminField>
              )}

              {ruleFormData.action === "BLOCK" && (
                <AdminField label="Lý do từ chối (Hiển thị cảnh báo cho người dùng)">
                  <textarea
                    rows={3}
                    placeholder="Ví dụ: Rất tiếc, hệ thống chỉ hỗ trợ tư vấn máy tính và linh kiện..."
                    value={ruleFormData.blockReason}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, blockReason: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                    required
                  />
                </AdminField>
              )}

              {ruleFormData.action === "SYSTEM_INJECT" && (
                <AdminField label="Chỉ thị đặc biệt tiêm vào System Prompt của AI">
                  <textarea
                    rows={3}
                    placeholder="Ví dụ: Bắt buộc chỉ ra phần trăm nghẽn và đề xuất linh kiện thay thế..."
                    value={ruleFormData.promptInjection}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, promptInjection: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                    required
                  />
                </AdminField>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: "8px 16px",
                    background: "#f1f5f9",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                >
                  Hủy
                </button>
                <AdminBtn variant="primary" type="submit">
                  {editingRule ? "Lưu Thay Đổi" : "Tạo Quy Tắc"}
                </AdminBtn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL XEM CHI TIẾT CHUNKS (LUXURY INSPECTOR) ==================== */}
      {isPreviewModalOpen && previewChunksData && (
        <div
          className="ai-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPreviewModalOpen(false);
          }}
        >
          <div className="ai-chunk-modal">
            <div className="ai-chunk-modal-head">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: "rgba(56,189,248,0.18)", color: "#7dd3fc", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    Smart Semantic Chunking Inspector
                  </span>
                  <span style={{ fontSize: 11, color: "#cbd5e1" }}>600 chars • Overlap 120 • Unicode NFC</span>
                </div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
                  {previewChunksData.fileName}
                </h3>
                <div style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 3 }}>
                  Tổng cộng <strong style={{ color: "#e2e8f0" }}>{previewChunksData.totalChunks} phân đoạn (chunks)</strong> đã đồng bộ vào ChromaDB & BM25Okapi
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 10,
                  width: 34,
                  height: 34,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: 15,
                  color: "#e2e8f0"
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "grid", gap: 14, background: "#f8fafc" }}>
              {previewChunksData.chunks?.map((chunk, idx) => (
                <div key={idx} className="ai-chunk-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{
                        background: "linear-gradient(135deg, #0f172a, #1e293b)",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 11,
                        padding: "3px 9px",
                        borderRadius: 7
                      }}>
                        Chunk #{chunk.index || idx + 1}
                      </span>
                      <code style={{ fontSize: 11, color: "#64748b", background: "#f1f5f9", padding: "2px 7px", borderRadius: 5 }}>
                        {chunk.id}
                      </code>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11.5, color: "#475569", fontWeight: 600 }}>
                        {chunk.length} ký tự
                      </span>
                      <button
                        type="button"
                        className="ai-action-btn ai-action-btn--ghost"
                        style={{ padding: "3px 8px", fontSize: 11 }}
                        onClick={() => {
                          navigator.clipboard?.writeText(chunk.text || "");
                          setSuccessMessage(`Đã sao chép nội dung Chunk #${chunk.index || idx + 1}`);
                        }}
                      >
                        Sao chép
                      </button>
                    </div>
                  </div>
                  <pre style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontFamily: "inherit",
                    fontSize: 13,
                    color: "#1e293b",
                    lineHeight: 1.65,
                    background: "#fafcff",
                    padding: "12px 14px",
                    borderRadius: 8,
                    border: "1px solid #edf2f7"
                  }}>
                    {chunk.text}
                  </pre>
                </div>
              ))}
            </div>

            <div style={{ padding: "14px 24px", borderTop: "1px solid #e2e8f0", background: "#ffffff", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                style={{
                  padding: "9px 22px",
                  background: "#0f172a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer"
                }}
              >
                Đóng Trình Kiểm Tra
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminPage>
  );
}
