import React, { useState, useEffect } from "react";
import { getAiBuilderQuestions } from "../../services/ai.service";

const POPULAR_PRESETS = [
  {
    id: "gaming",
    label: "🎮 Chơi Game (Gaming)",
    query: "Chơi game AAA & Esports",
    defaultBudget: 22000000,
    desc: "Tối ưu hóa GPU & FPS mượt mà cho game"
  },
  {
    id: "office",
    label: "💼 Văn Phòng & Kế Toán",
    query: "Văn phòng kế toán Excel nặng",
    defaultBudget: 12000000,
    desc: "Đa nhiệm mượt, khởi động nhanh, êm ái"
  },
  {
    id: "editing",
    label: "🎬 Đồ Họa & Dựng Video",
    query: "Dựng video Premiere Photoshop 4K",
    defaultBudget: 32000000,
    desc: "Nhiều RAM, CPU mạnh, màu sắc chuẩn"
  },
  {
    id: "ai",
    label: "🧠 Trí Tuệ Nhân Tạo (AI / Code)",
    query: "Deep Learning Python AI Docker",
    defaultBudget: 45000000,
    desc: "VRAM lớn, CUDA cores, nguồn tải nặng"
  }
];

const BUDGET_PRESETS = [
  { label: "10 Triệu", value: 10000000 },
  { label: "15 Triệu", value: 15000000 },
  { label: "20 Triệu", value: 20000000 },
  { label: "25 Triệu", value: 25000000 },
  { label: "35 Triệu", value: 35000000 },
  { label: "50 Triệu+", value: 55000000 }
];

export function RequirementWizardModal({
  isOpen,
  onClose,
  onSubmitProfile,
  suggestionForm
}) {
  // Navigation Phases: "input" | "loading_step1" | "step1_quiz" | "loading_step2" | "step2_quiz" | "analyzing"
  const [phase, setPhase] = useState("input");

  // Input states
  const [purposeQuery, setPurposeQuery] = useState("");
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [budget, setBudget] = useState(20000000);

  // Questionnaire states
  const [step1Questions, setStep1Questions] = useState([]);
  const [step2Questions, setStep2Questions] = useState([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [step1Answers, setStep1Answers] = useState({});
  const [step2Answers, setStep2Answers] = useState({});
  const [allAnswers, setAllAnswers] = useState({});
  const [quizMetadata, setQuizMetadata] = useState({ title: "", description: "" });
  const [loadingError, setLoadingError] = useState("");

  // Real-time RAG Analyzing step animation
  const [analysisStep, setAnalysisStep] = useState(1);

  // Synchronize initial suggestion form
  useEffect(() => {
    if (isOpen) {
      setPhase("input");
      setActiveQuestionIndex(0);
      setStep1Questions([]);
      setStep2Questions([]);
      setStep1Answers({});
      setStep2Answers({});
      setAllAnswers({});
      setLoadingError("");
      setAnalysisStep(1);

      if (suggestionForm?.customPrompt) {
        setSelectedPreset(null);
        setPurposeQuery(suggestionForm.customPrompt);
      } else if (suggestionForm?.purpose && suggestionForm.purpose !== "gaming") {
        const found = POPULAR_PRESETS.find((p) => p.id === suggestionForm.purpose || p.query === suggestionForm.purpose);
        if (found) {
          setSelectedPreset(found.id);
          setPurposeQuery(found.query);
        } else {
          setSelectedPreset(null);
          setPurposeQuery(suggestionForm.purpose);
        }
      } else {
        setSelectedPreset(null);
        setPurposeQuery("");
      }

      if (suggestionForm?.budget) {
        setBudget(Number(suggestionForm.budget));
      }
    }
  }, [isOpen, suggestionForm]);

  if (!isOpen) return null;

  function handleSelectPreset(preset) {
    if (selectedPreset === preset.id && purposeQuery.trim() === preset.query) {
      setSelectedPreset(null);
      setPurposeQuery("");
    } else {
      setSelectedPreset(preset.id);
      setPurposeQuery(preset.query);
      if (!budget || budget === 20000000) {
        setBudget(preset.defaultBudget);
      }
    }
  }

  // ── PHASE 0 -> PHASE 1: Sinh câu hỏi Step 1 (Khảo sát ban đầu) ──
  async function handleStartQuiz() {
    const queryText = purposeQuery.trim() || (selectedPreset ? POPULAR_PRESETS.find((p) => p.id === selectedPreset)?.query : "") || "";
    if (!queryText) {
      setLoadingError("Vui lòng nhập hoặc chọn mục đích sử dụng máy tính.");
      return;
    }

    try {
      setPhase("loading_step1");
      setLoadingError("");

      const res = await getAiBuilderQuestions(queryText, 1, budget, null);
      const data = res?.data || res;

      // Kiểm tra Guardrail Filter
      if (data?.is_valid === false) {
        setLoadingError(data?.error || "Nội dung yêu cầu không hợp lệ hoặc ngoài phạm vi tư vấn phần cứng.");
        setPhase("input");
        return;
      }

      const qList = data?.questions || [];
      if (qList.length === 0) {
        setLoadingError("AI không thể sinh câu hỏi cho yêu cầu này. Vui lòng nhập rõ hơn!");
        setPhase("input");
        return;
      }

      setStep1Questions(qList);
      setQuizMetadata({
        title: data.title || `Tối ưu hóa cấu hình cho: ${queryText}`,
        description: data.description || "Khảo sát giúp xác định phân khúc phần cứng"
      });
      setActiveQuestionIndex(0);
      setPhase("step1_quiz");
    } catch (err) {
      console.warn("Lỗi tải câu hỏi khảo sát Step 1:", err);
      setLoadingError("Không thể kết nối AI Service để sinh câu hỏi động. Vui lòng thử lại!");
      setPhase("input");
    }
  }

  // ── PHASE 1 -> PHASE 2: Gửi câu trả lời Step 1 -> Sinh câu hỏi Step 2 (Chuyên sâu) ──
  async function handleTransitionToStep2(currentAnswers) {
    const queryText = purposeQuery.trim() || selectedPreset || "Tư vấn cấu hình máy tính";
    try {
      setPhase("loading_step2");
      setLoadingError("");

      // Đóng gói chi tiết: { [câu_hỏi]: [lựa_chọn_hiển_thị] } để AI hiểu trọn vẹn ngữ cảnh
      const structuredAnswers = {};
      step1Questions.forEach((q) => {
        const val = currentAnswers[q.id];
        const opt = q.options?.find((o) => o.value === val);
        if (val) {
          structuredAnswers[q.label || q.id] = opt?.label || val;
        }
      });

      const res = await getAiBuilderQuestions(queryText, 2, budget, structuredAnswers);
      const data = res?.data || res;

      const qList = data?.questions || [];
      if (qList.length === 0) {
        // Nếu không có câu hỏi step 2 thì chuyển thẳng tới RAG build
        handleFinishQuiz(currentAnswers);
        return;
      }

      setStep2Questions(qList);
      setActiveQuestionIndex(0);
      setPhase("step2_quiz");
    } catch (err) {
      console.warn("Lỗi tải câu hỏi khảo sát Step 2:", err);
      // Nếu lỗi thì vẫn tiếp tục với các câu trả lời hiện tại
      handleFinishQuiz(currentAnswers);
    }
  }

  // Handle user selecting an option for the active question
  function handleSelectOption(questionId, value, recommendedBudget, optObj) {
    if (phase === "step1_quiz") {
      setStep1Answers((prev) => ({ ...prev, [questionId]: value }));
    } else if (phase === "step2_quiz") {
      setStep2Answers((prev) => ({ ...prev, [questionId]: value }));
    }

    const currentList = phase === "step1_quiz" ? step1Questions : step2Questions;
    const qObj = currentList.find((q) => q.id === questionId);
    const ansLabel = optObj?.label || value;
    setAllAnswers((prev) => ({
      ...prev,
      [questionId]: value,
      [qObj?.label || questionId]: ansLabel
    }));
    // Giữ nguyên 100% ngân sách ban đầu của người dùng, tuyệt đối không tự ý ghi đè
  }

  // Next Question Button Click
  function handleNextQuestion() {
    const currentList = phase === "step1_quiz" ? step1Questions : step2Questions;
    const currentQ = currentList[activeQuestionIndex];
    const currentAns = phase === "step1_quiz" ? step1Answers : step2Answers;

    if (currentQ?.required && !currentAns[currentQ.id]) {
      alert("Vui lòng chọn 1 phương án để AI hiểu rõ nhu cầu của bạn.");
      return;
    }

    if (activeQuestionIndex < currentList.length - 1) {
      setActiveQuestionIndex((prev) => prev + 1);
    } else {
      // Đã xong bộ câu hỏi hiện tại
      if (phase === "step1_quiz") {
        // Chuyển sang Step 2 (Deep Dive)
        handleTransitionToStep2({ ...step1Answers, [currentQ.id]: currentAns[currentQ.id] });
      } else {
        // Hoàn tất cả 2 bước -> Truy vấn Vector DB & Tạo Build
        handleFinishQuiz({ ...allAnswers, [currentQ.id]: currentAns[currentQ.id] });
      }
    }
  }

  // Previous Question Button Click
  function handlePrevQuestion() {
    if (phase === "step1_quiz") {
      if (activeQuestionIndex > 0) {
        setActiveQuestionIndex((prev) => prev - 1);
      } else {
        setPhase("input");
      }
    } else if (phase === "step2_quiz") {
      if (activeQuestionIndex > 0) {
        setActiveQuestionIndex((prev) => prev - 1);
      } else {
        // Quay lại câu cuối của Step 1
        setPhase("step1_quiz");
        setActiveQuestionIndex(Math.max(0, step1Questions.length - 1));
      }
    }
  }

  // Final Phase: RAG Search + AI Build Synthesis
  async function handleFinishQuiz(finalAnswers = null) {
    setPhase("analyzing");
    setAnalysisStep(1);

    // Animation timeline for user visual feedback
    setTimeout(() => setAnalysisStep(2), 700);
    setTimeout(() => setAnalysisStep(3), 1500);

    const mergedAnswers = finalAnswers || { ...step1Answers, ...step2Answers, ...allAnswers };

    // Build the profile payload
    const profile = {
      purpose: purposeQuery.trim() || selectedPreset,
      customPrompt: purposeQuery.trim(),
      budget: Number(budget) || 20000000,
      resolution: mergedAnswers.target_resolution || mergedAnswers.refresh_rate || mergedAnswers.screen_resolution || mergedAnswers.resolution || "1080p",
      preference: "value",
      engineType: "ai",
      step1Answers,
      step2Answers,
      answers: mergedAnswers
    };

    setTimeout(() => {
      if (onSubmitProfile) {
        onSubmitProfile(profile);
      }
      onClose();
    }, 2200);
  }

  const currentQuestionsList = phase === "step1_quiz" ? step1Questions : step2Questions;
  const currentQuestion = currentQuestionsList[activeQuestionIndex];
  const progressPercent = currentQuestionsList.length > 0
    ? Math.round(((activeQuestionIndex + 1) / currentQuestionsList.length) * 100)
    : 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        animation: "fadeIn 0.2s ease-out"
      }}
    >
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes spinReverse {
          to { transform: rotate(-360deg); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.8; transform: scale(0.92); }
          50% { opacity: 1; transform: scale(1.08); }
        }
      `}</style>
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "680px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          maxHeight: "92vh"
        }}
      >
        {/* ================= MODAL HEADER ================= */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f8fafc"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                display: "grid",
                placeItems: "center",
                color: "#ffffff",
                fontSize: "18px"
              }}
            >
              🤖
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                Trợ Lý AI Đề Xuất Cấu Hình PC (Smart Builder)
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                Khảo sát tương tác 2 vòng • Tối ưu chính xác theo nhu cầu thực tế
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "20px",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "6px"
            }}
          >
            ✕
          </button>
        </div>

        {/* ================= STEP INDICATOR BAR ================= */}
        {(phase === "step1_quiz" || phase === "step2_quiz" || phase.startsWith("loading")) && (
          <div
            style={{
              padding: "10px 24px",
              background: "#f1f5f9",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "12px",
              fontWeight: 700
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: "12px",
                  background: phase === "step1_quiz" || phase === "loading_step1" ? "#2563eb" : "#059669",
                  color: "#ffffff"
                }}
              >
                {phase === "step2_quiz" || phase === "loading_step2" ? "Vòng 1: Xong ✓" : "Vòng 1: Nhu Cầu"}
              </span>
              <span style={{ color: "#94a3b8" }}>→</span>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: "12px",
                  background: phase === "step2_quiz" || phase === "loading_step2" ? "#2563eb" : "#cbd5e1",
                  color: phase === "step2_quiz" || phase === "loading_step2" ? "#ffffff" : "#475569"
                }}
              >
                Vòng 2: Thói Quen & Không Gian
              </span>
              <span style={{ color: "#94a3b8" }}>→</span>
              <span style={{ color: "#94a3b8" }}>Tổng Hợp Cấu Hình</span>
            </div>
            <span style={{ color: "#64748b" }}>
              {phase === "step1_quiz" && `Câu ${activeQuestionIndex + 1}/${step1Questions.length}`}
              {phase === "step2_quiz" && `Câu ${activeQuestionIndex + 1}/${step2Questions.length}`}
            </span>
          </div>
        )}

        {/* ================= MODAL BODY ================= */}
        <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
          {/* ── PHASE 0: INPUT & PURPOSE ── */}
          {phase === "input" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>
                  1. Mục đích sử dụng hoặc nhu cầu cụ thể của bạn:
                </label>
                <input
                  type="text"
                  value={purposeQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPurposeQuery(val);
                    if (loadingError) setLoadingError("");
                    const matched = POPULAR_PRESETS.find((p) => p.query.toLowerCase() === val.trim().toLowerCase());
                    setSelectedPreset(matched ? matched.id : null);
                  }}
                  placeholder="Ví dụ: Chơi game GTA V mượt mà, Làm kế toán Excel nặng, Dựng phim 4K..."
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    border: loadingError ? "2px solid #ef4444" : "2px solid #cbd5e1",
                    fontSize: "15px",
                    fontWeight: 600,
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.15s"
                  }}
                  onFocus={(e) => (e.target.style.borderColor = loadingError ? "#ef4444" : "#2563eb")}
                  onBlur={(e) => (e.target.style.borderColor = loadingError ? "#ef4444" : "#cbd5e1")}
                />
                <small style={{ color: "#64748b", fontSize: "12px", marginTop: "4px", display: "block" }}>
                  💡 Bạn có thể nhập tự do bất kỳ tựa game hoặc phần mềm nào, AI sẽ phân tích nhu cầu và tối ưu cấu hình cho bạn.
                </small>
              </div>

              {/* Preset Buttons */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#475569", marginBottom: "8px" }}>
                  Hoặc chọn nhanh mục đích tiêu chuẩn:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {POPULAR_PRESETS.map((preset) => {
                    const isSelected = selectedPreset === preset.id && purposeQuery.trim().toLowerCase() === preset.query.toLowerCase();
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "10px",
                          border: isSelected ? "2px solid #2563eb" : "1px solid #e2e8f0",
                          background: isSelected ? "#eff6ff" : "#f8fafc",
                          textAlign: "left",
                          cursor: "pointer",
                          transition: "all 0.15s"
                        }}
                      >
                        <strong style={{ display: "block", fontSize: "13px", color: isSelected ? "#1d4ed8" : "#0f172a" }}>
                          {preset.label}
                        </strong>
                        <span style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", display: "block" }}>
                          {preset.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Budget Input & Presets */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>
                    2. Ngân sách dự kiến của bạn:
                  </label>
                  <span style={{ fontSize: "16px", fontWeight: 800, color: "#2563eb" }}>
                    {Number(budget).toLocaleString("vi-VN")} đ
                  </span>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                  {BUDGET_PRESETS.map((b) => (
                    <button
                      key={b.value}
                      type="button"
                      onClick={() => setBudget(b.value)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: 700,
                        border: budget === b.value ? "1px solid #2563eb" : "1px solid #cbd5e1",
                        background: budget === b.value ? "#2563eb" : "#ffffff",
                        color: budget === b.value ? "#ffffff" : "#475569",
                        cursor: "pointer"
                      }}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>

                <input
                  type="range"
                  min="6000000"
                  max="80000000"
                  step="1000000"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#2563eb" }}
                />
              </div>

              {loadingError && (
                <div
                  style={{
                    padding: "12px 16px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#dc2626",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 600,
                    lineHeight: 1.4
                  }}
                >
                  🛡️ {loadingError}
                </div>
              )}
            </div>
          )}

          {/* ── PHASE 1 LOADING: GENERATING STEP 1 QUESTIONS ── */}
          {phase === "loading_step1" && (
            <div style={{ textAlign: "center", padding: "48px 20px" }}>
              <div style={{ position: "relative", width: "72px", height: "72px", margin: "0 auto 20px" }}>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: "3px solid transparent",
                    borderTopColor: "#2563eb",
                    borderRightColor: "#3b82f6",
                    animation: "spin 0.9s cubic-bezier(0.5, 0.1, 0.2, 0.9) infinite"
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: "8px",
                    borderRadius: "50%",
                    border: "3px solid transparent",
                    borderBottomColor: "#7c3aed",
                    borderLeftColor: "#a855f7",
                    animation: "spinReverse 1.3s linear infinite"
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: "22px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                    boxShadow: "0 0 16px rgba(37,99,235,0.4)",
                    animation: "pulseGlow 2s ease-in-out infinite"
                  }}
                />
              </div>
              <h4 style={{ margin: "0 0 8px", fontSize: "17px", color: "#0f172a", fontWeight: 800 }}>
                Hệ Thống Đang Phân Tích Nhu Cầu & Khởi Tạo Câu Hỏi...
              </h4>
              <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                Đang cá nhân hóa bộ câu hỏi cho "{purposeQuery}" (Mục tiêu: {Number(budget).toLocaleString("vi-VN")}đ)
              </p>
            </div>
          )}

          {/* ── PHASE 2 LOADING: GENERATING STEP 2 DEEP QUESTIONS ── */}
          {phase === "loading_step2" && (
            <div style={{ textAlign: "center", padding: "48px 20px" }}>
              <div style={{ position: "relative", width: "72px", height: "72px", margin: "0 auto 20px" }}>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: "3px solid transparent",
                    borderTopColor: "#7c3aed",
                    borderRightColor: "#a855f7",
                    animation: "spin 0.9s cubic-bezier(0.5, 0.1, 0.2, 0.9) infinite"
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: "8px",
                    borderRadius: "50%",
                    border: "3px solid transparent",
                    borderBottomColor: "#2563eb",
                    borderLeftColor: "#3b82f6",
                    animation: "spinReverse 1.3s linear infinite"
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: "22px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #7c3aed, #2563eb)",
                    boxShadow: "0 0 16px rgba(124,58,237,0.4)",
                    animation: "pulseGlow 2s ease-in-out infinite"
                  }}
                />
              </div>
              <h4 style={{ margin: "0 0 8px", fontSize: "17px", color: "#0f172a", fontWeight: 800 }}>
                Đang Phân Tích Sở Thích & Phong Cách Cấu Hình...
              </h4>
              <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                Đang chuyển tiếp sở thích của bạn để chọn lọc dung lượng lưu trữ, thương hiệu và thùng máy
              </p>
            </div>
          )}

          {/* ── CONVERSATIONAL QUIZ (1 QUESTION AT A TIME) ── */}
          {(phase === "step1_quiz" || phase === "step2_quiz") && currentQuestion && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Progress Header */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 800, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {phase === "step1_quiz" ? "Vòng 1: Mục Đích & Nhu Cầu" : "Vòng 2: Thói Quen & Không Gian"} • Câu {activeQuestionIndex + 1} / {currentQuestionsList.length}
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>
                    {progressPercent}% Hoàn thành
                  </span>
                </div>
                {/* Smooth Progress Bar */}
                <div style={{ width: "100%", height: "6px", background: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${progressPercent}%`,
                      height: "100%",
                      background: phase === "step1_quiz"
                        ? "linear-gradient(90deg, #2563eb, #3b82f6)"
                        : "linear-gradient(90deg, #7c3aed, #2563eb)",
                      transition: "width 0.3s ease-out"
                    }}
                  />
                </div>
              </div>

              {/* Question Text */}
              <div style={{ background: "#f8fafc", padding: "16px 20px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0f172a", lineHeight: 1.4 }}>
                  {currentQuestion.label}
                </h4>
              </div>

              {/* Question Options: Cards format */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {currentQuestion.options?.map((opt, oIdx) => {
                  const currentSelected = phase === "step1_quiz" ? step1Answers[currentQuestion.id] : step2Answers[currentQuestion.id];
                  const isSelected = currentSelected === opt.value;
                  return (
                    <div
                      key={opt.value || oIdx}
                      onClick={() => handleSelectOption(currentQuestion.id, opt.value, opt.recommendedBudget, opt)}
                      style={{
                        padding: "14px 18px",
                        borderRadius: "12px",
                        border: isSelected ? "2px solid #2563eb" : "1px solid #e2e8f0",
                        background: isSelected ? "#eff6ff" : "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        boxShadow: isSelected ? "0 4px 12px rgba(37,99,235,0.12)" : "0 1px 2px rgba(0,0,0,0.04)",
                        transition: "all 0.15s"
                      }}
                    >
                      {/* Radio Circle */}
                      <div
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          border: isSelected ? "6px solid #2563eb" : "2px solid #cbd5e1",
                          background: "#ffffff",
                          flexShrink: 0
                        }}
                      />

                      {/* Content */}
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: "14px", fontWeight: isSelected ? 700 : 500, color: isSelected ? "#1e3a8a" : "#1e293b" }}>
                          {opt.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── PHASE 3: SEARCH & SYNTHESIZING PROPOSAL ── */}
          {phase === "analyzing" && (
            <div style={{ textAlign: "center", padding: "36px 16px" }}>
              <div style={{ position: "relative", width: "80px", height: "80px", margin: "0 auto 24px" }}>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: "3px solid transparent",
                    borderTopColor: "#2563eb",
                    borderRightColor: "#3b82f6",
                    animation: "spin 0.9s cubic-bezier(0.5, 0.1, 0.2, 0.9) infinite"
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: "8px",
                    borderRadius: "50%",
                    border: "3px solid transparent",
                    borderBottomColor: "#7c3aed",
                    borderLeftColor: "#a855f7",
                    animation: "spinReverse 1.3s linear infinite"
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: "20px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "20px",
                    color: "#ffffff",
                    boxShadow: "0 4px 16px rgba(37,99,235,0.35)",
                    animation: "pulseGlow 2s ease-in-out infinite"
                  }}
                >
                  ⚡
                </div>
              </div>

              <h3 style={{ margin: "0 0 8px", fontSize: "19px", fontWeight: 800, color: "#0f172a" }}>
                Hệ Thống Đang Tìm Kiếm & Tối Ưu Hóa Cấu Hình Phù Hợp Nhất
              </h3>
              <p style={{ margin: "0 0 24px", fontSize: "13px", color: "#64748b" }}>
                Đối chiếu kho linh kiện, kiểm tra chuẩn RAM, kích thước vỏ case và nguồn điện ({Number(budget).toLocaleString("vi-VN")}đ ±5%)
              </p>

              {/* Steps Progress Animation */}
              <div style={{ maxWidth: "460px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "12px", textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
                  <span>{analysisStep >= 1 ? "✅" : "⏳"}</span>
                  <span style={{ color: analysisStep >= 1 ? "#059669" : "#64748b", fontWeight: analysisStep === 1 ? 700 : 500 }}>
                    1. Quét kho linh kiện & chọn lọc các sản phẩm hàng đầu phù hợp nhu cầu
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
                  <span>{analysisStep >= 2 ? "✅" : "⏳"}</span>
                  <span style={{ color: analysisStep >= 2 ? "#059669" : "#64748b", fontWeight: analysisStep === 2 ? 700 : 500 }}>
                    2. Thẩm định 100% độ tương thích vật lý, socket CPU, chuẩn RAM và nguồn điện
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
                  <span>{analysisStep >= 3 ? "✅" : "⏳"}</span>
                  <span style={{ color: analysisStep >= 3 ? "#059669" : "#64748b", fontWeight: analysisStep === 3 ? 700 : 500 }}>
                    3. Tinh chỉnh cấu hình hoàn hảo & xuất báo cáo phân tích chuyên gia
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= MODAL FOOTER ================= */}
        {!phase.startsWith("loading") && phase !== "analyzing" && (
          <div
            style={{
              padding: "16px 24px",
              borderTop: "1px solid #f1f5f9",
              background: "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            {phase === "input" ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#475569",
                    cursor: "pointer"
                  }}
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleStartQuiz}
                  style={{
                    padding: "10px 24px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(37,99,235,0.25)"
                  }}
                >
                  🚀 Bắt Đầu AI Khảo Sát Nhu Cầu →
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handlePrevQuestion}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#475569",
                    cursor: "pointer"
                  }}
                >
                  ← {activeQuestionIndex === 0 && phase === "step1_quiz" ? "Chọn lại nhu cầu" : "Câu trước"}
                </button>
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  style={{
                    padding: "10px 24px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(37,99,235,0.25)"
                  }}
                >
                  {activeQuestionIndex < currentQuestionsList.length - 1
                    ? "Câu tiếp theo →"
                    : phase === "step1_quiz"
                    ? "Tiếp tục sang Vòng 2 (Thói quen sử dụng) →"
                    : "⚡ Xuất Cấu Hình Đề Xuất →"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
export default RequirementWizardModal;
