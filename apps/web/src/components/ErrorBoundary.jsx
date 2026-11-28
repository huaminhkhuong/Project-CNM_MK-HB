import React from "react";
import { errorLogger } from "../utils/errorLogger";

const SAFE_CACHE_KEY_PREFIXES = [
  "pc_builder_",
  "pcmall_ai_chat_",
  "compare_",
  "direct_checkout_"
];

function clearNonAuthCacheStorage() {
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key) keys.push(key);
    }
    keys.forEach((key) => {
      if (SAFE_CACHE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        window.localStorage.removeItem(key);
      }
    });
  } catch {
    // ignore storage restrictions
  }
}

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    errorLogger.captureError(error, { componentStack: errorInfo?.componentStack });
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      const isDev = Boolean(import.meta.env.DEV);
      return (
        <div style={{
          padding: "36px",
          maxWidth: "760px",
          margin: "40px auto",
          fontFamily: "'Inter', system-ui, sans-serif",
          backgroundColor: "#fff1f2",
          border: "1px solid #fecdd3",
          borderRadius: "16px",
          color: "#881337"
        }}>
          <h2 style={{ fontSize: "20px", marginBottom: "10px", color: "#be123c" }}>
            ⚠️ Đã xảy ra lỗi hiển thị giao diện
          </h2>
          <p style={{ fontSize: "14px", marginBottom: "12px", lineHeight: 1.6 }}>
            {isDev && this.state.error
              ? this.state.error.toString()
              : "Rất tiếc, trang gặp sự cố ngoài ý muốn. Phiên đăng nhập của bạn vẫn được giữ nguyên."}
          </p>
          {isDev && this.state.errorInfo?.componentStack ? (
            <pre style={{
              backgroundColor: "#ffe4e6",
              padding: "14px",
              borderRadius: "8px",
              overflowX: "auto",
              fontSize: "12px",
              lineHeight: "1.5",
              fontFamily: "monospace"
            }}>
              {this.state.errorInfo.componentStack}
            </pre>
          ) : null}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "16px" }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 18px",
                backgroundColor: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              🔄 Tải lại trang
            </button>
            <button
              type="button"
              onClick={() => {
                clearNonAuthCacheStorage();
                window.location.reload();
              }}
              style={{
                padding: "10px 18px",
                backgroundColor: "#e11d48",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              🧹 Xóa bộ nhớ đệm tạm & Tải lại
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
