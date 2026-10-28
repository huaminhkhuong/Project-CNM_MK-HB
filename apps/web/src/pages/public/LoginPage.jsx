import { useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

import { PageCard } from "../../components/common/PageCard";
import { useAuth } from "../../hooks/useAuth";

const inputStyle = {
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid rgba(122, 92, 48, 0.18)",
  outline: "none",
  width: "100%",
  background: "rgba(255,255,255,0.88)",
  color: "var(--text)"
};

function validateForm(values) {
  const errors = {};

  if (!String(values.email || "").trim()) {
    errors.email = "Vui lòng nhập email";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(values.email).trim())) {
    errors.email = "Email không hợp lệ";
  }

  if (!String(values.password || "").trim()) {
    errors.password = "Vui lòng nhập mật khẩu";
  } else if (String(values.password).length < 6) {
    errors.password = "Mật khẩu phải có ít nhất 6 ký tự";
  }

  return errors;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  
  const isExpired = useMemo(() => new URLSearchParams(location.search).get("expired") === "true", [location.search]);

  const [formValues, setFormValues] = useState({
    email: "",
    password: ""
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDisabled = useMemo(() => isSubmitting, [isSubmitting]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormValues((prevState) => ({
      ...prevState,
      [name]: value
    }));

    setErrors((prevState) => ({
      ...prevState,
      [name]: ""
    }));

    setServerError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validateForm(formValues);
    setErrors(nextErrors);
    setServerError("");

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await login({
        email: formValues.email.trim(),
        password: formValues.password
      });

      const redirectParam = new URLSearchParams(location.search).get("redirect");
      const returnPath = location.state?.from?.pathname || redirectParam || result.redirectPath;
      const state = {
        ...(result.onboarding?.buildsMigrated > 0 ? { buildsMigrated: result.onboarding.buildsMigrated } : {}),
        ...(result.onboarding?.cartItemsMerged > 0 ? { cartItemsMerged: result.onboarding.cartItemsMerged } : {})
      };

      navigate(returnPath, { replace: true, state: Object.keys(state).length > 0 ? state : undefined });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setServerError(error.response?.data?.message || "Đăng nhập thất bại");
      } else {
        setServerError(error.message || "Đăng nhập thất bại");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "36px auto" }}>
      <PageCard title="Đăng nhập" description="Đăng nhập để mua hàng, theo dõi đơn hàng và tiếp tục các cấu hình đang lưu.">
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          {isExpired && (
            <div style={{ padding: '16px 20px', borderRadius: 16, background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>⏳</span> Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.
            </div>
          )}
          <div style={{ display: "grid", gap: 8 }}>
            <label htmlFor="email" style={{ fontWeight: 700 }}>Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formValues.email}
              onChange={handleChange}
              placeholder="customer@example.com"
              style={inputStyle}
            />
            {errors.email ? <span style={{ color: "var(--danger)", fontSize: 14 }}>{errors.email}</span> : null}
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <label htmlFor="password" style={{ fontWeight: 700 }}>Mật khẩu</label>
            <input
              id="password"
              name="password"
              type="password"
              value={formValues.password}
              onChange={handleChange}
              placeholder="Nhập mật khẩu của bạn"
              style={inputStyle}
            />
            {errors.password ? <span style={{ color: "var(--danger)", fontSize: 14 }}>{errors.password}</span> : null}
          </div>

          {serverError ? (
            <div style={{ padding: 14, borderRadius: 16, background: "rgba(255, 240, 236, 0.92)", color: "var(--danger)", border: "1px solid rgba(182, 64, 44, 0.22)" }}>
              {serverError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isDisabled}
            style={{
              padding: 14,
              borderRadius: 16,
              border: "none",
              background: isDisabled ? "#9ca3af" : "linear-gradient(135deg, var(--primary), #2b6b58)",
              color: "#ffffff",
              fontWeight: 800,
              cursor: isDisabled ? "not-allowed" : "pointer"
            }}
          >
            {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>

          <div style={{ fontSize: 15, color: "var(--muted)" }}>
            Chưa có tài khoản? <Link to="/register" style={{ color: "var(--primary)", fontWeight: 700 }}>Tạo tài khoản</Link>
          </div>
        </form>
      </PageCard>
    </div>
  );
}
