import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

export function AuthRequiredModal({
  isOpen,
  onClose,
  onSuccess,
  pendingPrompt = ""
}) {
  const { login, loginAsDemo } = useAuth();
  const [email, setEmail] = useState("customer@pcmall.vn");
  const [password, setPassword] = useState("password123");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleFormSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Vui lòng nhập đầy đủ Email và Mật khẩu.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await login({ email: email.trim(), password: password.trim() });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleQuickDemoLogin() {
    setIsLoading(true);
    setError("");
    try {
      await loginAsDemo();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError("Không thể đăng nhập bằng tài khoản Demo. Vui lòng nhập thông tin đăng nhập.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className="auth-modal-overlay"
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(6px)",
        zIndex: 10001,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        animation: "fadeIn 0.2s ease-out"
      }}
      onClick={onClose}
    >
      <div
        className="auth-modal-container"
        style={{
          width: "100%",
          maxWidth: "460px",
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.35)",
          overflow: "hidden",
          border: "1px solid #e2e8f0"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header với Gradient AI sang trọng */}
        <div
          style={{
            padding: "22px 24px 18px",
            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
            color: "#ffffff",
            position: "relative"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "24px", background: "rgba(255,255,255,0.2)", padding: "6px 10px", borderRadius: "10px" }}>
                🤖
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", letterSpacing: "-0.01em" }}>
                  Đăng Nhập Để Dùng AI Builder
                </h3>
                <span style={{ fontSize: "11px", opacity: 0.9, fontWeight: "500" }}>
                  Tối ưu ngân sách & đồng bộ cấu hình vào tài khoản
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "rgba(255, 255, 255, 0.18)",
                border: "none",
                color: "#ffffff",
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                cursor: "pointer",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              ✕
            </button>
          </div>

          {/* Pending Prompt Badge */}
          {pendingPrompt && (
            <div
              style={{
                marginTop: "14px",
                padding: "8px 12px",
                background: "rgba(255, 255, 255, 0.15)",
                borderRadius: "10px",
                fontSize: "12px",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <span>💬</span>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <strong>Yêu cầu đang chờ:</strong> "{pendingPrompt}"
              </div>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div style={{ padding: "24px" }}>
          <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b", lineHeight: "1.5" }}>
            Hệ thống cần xác thực tài khoản để ghi nhận cấu hình đề xuất từ AI vào giỏ hàng và lưu lịch sử lắp ráp của bạn.
          </p>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecdd3",
                borderRadius: "10px",
                color: "#e11d48",
                fontSize: "12.5px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                Email đăng nhập
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1.5px solid #cbd5e1",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                Mật khẩu
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1.5px solid #cbd5e1",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                marginTop: "6px",
                padding: "12px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                color: "#ffffff",
                fontSize: "13.5px",
                fontWeight: "800",
                cursor: isLoading ? "not-allowed" : "pointer",
                boxShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
            >
              {isLoading ? "⏳ Đang xác thực..." : "🚀 Đăng Nhập & Tiếp Tục Build AI"}
            </button>
          </form>

          {/* Quick Demo Login Option */}
          <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px dashed #e2e8f0" }}>
            <button
              type="button"
              onClick={handleQuickDemoLogin}
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid #e0e7ff",
                background: "#f5f3ff",
                color: "#6d28d9",
                fontSize: "12.5px",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.2s ease"
              }}
            >
              <span>⚡</span>
              <span>Đăng nhập nhanh 1-Click (Tài khoản Khách Demo)</span>
            </button>
            <div style={{ textAlign: "center", marginTop: "8px", fontSize: "11px", color: "#94a3b8" }}>
              Tài khoản mẫu: <code>customer@pcmall.vn</code> / <code>password123</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
