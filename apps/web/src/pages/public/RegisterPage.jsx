import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

import { checkEmailAvailability, googleLoginMock, register } from "../../services/auth.service";
import { setAuthState } from "../../store/authStore";
import { runCustomerOnboarding } from "../../utils/customerOnboarding";

function getErrorMessage(error, fallback) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback;
  }
  return error?.message || fallback;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function validatePhone(phone) {
  return /^(0|\+84)(\d{9,10})$/.test(String(phone).replace(/\s/g, ""));
}

function getPasswordStrength(password) {
  const p = String(password || "");
  const criteria = {
    length: p.length >= 8,
    uppercase: /[A-Z]/.test(p),
    number: /[0-9]/.test(p),
    special: /[^A-Za-z0-9]/.test(p)
  };

  let score = 0;
  if (criteria.length) score += 1;
  if (criteria.uppercase) score += 1;
  if (criteria.number) score += 1;
  if (criteria.special) score += 1;

  const labels = ["Rất yếu", "Yếu", "Trung bình", "Khá", "Mạnh"];
  const tones = ["#94a3b8", "#ef4444", "#f97316", "#f59e0b", "#10b981"];
  const bgs = [
    "rgba(148, 163, 184, 0.15)",
    "rgba(239, 68, 68, 0.15)",
    "rgba(249, 115, 22, 0.15)",
    "rgba(245, 158, 11, 0.15)",
    "rgba(16, 185, 129, 0.15)"
  ];

  const percent = p.length === 0 ? 0 : Math.max(15, score * 25);
  return { score, criteria, label: labels[score], tone: tones[score], bg: bgs[score], percent };
}

function Spinner() {
  return <span className="register-spinner" aria-hidden />;
}

function EyeIcon({ hidden }) {
  return hidden ? "Hiện" : "Ẩn";
}

const initialForm = {
  full_name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: ""
};

export function RegisterPage() {
  const navigate = useNavigate();
  const [formValues, setFormValues] = useState(initialForm);
  const [touched, setTouched] = useState({});
  const [emailStatus, setEmailStatus] = useState({ checking: false, exists: false, message: "" });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showMockGoogle, setShowMockGoogle] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const strength = useMemo(() => getPasswordStrength(formValues.password), [formValues.password]);

  const errors = useMemo(() => {
    const next = {};
    if (!formValues.full_name.trim()) next.full_name = "Vui lòng nhập họ tên";
    if (!formValues.email.trim()) next.email = "Vui lòng nhập email";
    else if (!validateEmail(formValues.email)) next.email = "Email không hợp lệ";
    else if (emailStatus.exists) next.email = "Email đã tồn tại";
    if (!formValues.phone.trim()) next.phone = "Vui lòng nhập số điện thoại";
    else if (!validatePhone(formValues.phone)) next.phone = "Số điện thoại không hợp lệ";
    if (!formValues.password) next.password = "Vui lòng nhập mật khẩu";
    else if (formValues.password.length < 8) next.password = "Mật khẩu tối thiểu 8 ký tự";
    if (!formValues.confirmPassword) next.confirmPassword = "Vui lòng xác nhận mật khẩu";
    else if (formValues.confirmPassword !== formValues.password) next.confirmPassword = "Mật khẩu xác nhận không khớp";
    return next;
  }, [emailStatus.exists, formValues]);

  const canSubmit = Object.keys(errors).length === 0 && !emailStatus.checking && !isSubmitting;

  useEffect(() => {
    const email = formValues.email.trim();
    if (!validateEmail(email)) {
      setEmailStatus({ checking: false, exists: false, message: "" });
      return;
    }

    let cancelled = false;
    setEmailStatus({ checking: true, exists: false, message: "Đang kiểm tra email..." });
    const timer = setTimeout(async () => {
      try {
        const response = await checkEmailAvailability(email);
        const exists = Boolean(response?.data?.exists);
        if (!cancelled) {
          setEmailStatus({
            checking: false,
            exists,
            message: exists ? "Email đã tồn tại" : "Email có thể sử dụng"
          });
        }
      } catch (_error) {
        if (!cancelled) setEmailStatus({ checking: false, exists: false, message: "" });
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formValues.email]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
    setStatus({ type: "", message: "" });
  }

  async function completeLoginFromResponse(response) {
    const payload = response?.data || response;
    const accessToken = payload?.accessToken || "";
    const refreshToken = payload?.refreshToken || "";
    const user = payload?.user || null;
    if (!accessToken || !user) return false;

    setAuthState({ accessToken, refreshToken, user });
    try {
      await runCustomerOnboarding();
    } catch (_error) {
      // Registration should not fail because guest migration failed.
    }
    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setTouched({ full_name: true, email: true, phone: true, password: true, confirmPassword: true });
    if (!canSubmit) return;

    try {
      setIsSubmitting(true);
      const response = await register({
        full_name: formValues.full_name.trim(),
        email: formValues.email.trim(),
        phone: formValues.phone.trim(),
        password: formValues.password
      });
      const loggedIn = await completeLoginFromResponse(response);
      setStatus({ type: "success", message: loggedIn ? "Tạo tài khoản thành công. Đang đăng nhập..." : "Tạo tài khoản thành công. Đang chuyển đến đăng nhập..." });
      setTimeout(() => navigate(loggedIn ? "/" : "/login"), 900);
    } catch (error) {
      setStatus({ type: "error", message: getErrorMessage(error, "Đăng ký thất bại") });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleDemo(account) {
    try {
      setIsSubmitting(true);
      const response = await googleLoginMock(account);
      await completeLoginFromResponse(response);
      setStatus({ type: "success", message: "Đăng nhập Google demo thành công." });
      setTimeout(() => navigate("/"), 700);
    } catch (error) {
      setStatus({ type: "error", message: getErrorMessage(error, "Không thể đăng nhập Google demo") });
    } finally {
      setIsSubmitting(false);
      setShowMockGoogle(false);
    }
  }

  function fieldError(name) {
    return touched[name] ? errors[name] : "";
  }

  return (
    <div className="register-page">
      <style>{`
        .register-page { min-height: 100vh; padding: 56px 20px; background: radial-gradient(circle at 0% 0%, rgba(32, 120, 202, 0.09), transparent 44%), radial-gradient(circle at 100% 100%, rgba(15, 76, 63, 0.08), transparent 44%), #f8fafc; }
        .register-shell { max-width: 1160px; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(420px, 1fr); gap: 24px; align-items: stretch; }
        .register-brand, .register-form-card { border-radius: 32px; border: 1px solid rgba(255,255,255,0.75); background: rgba(255,255,255,0.86); box-shadow: 0 24px 70px rgba(15,23,42,0.08); backdrop-filter: blur(34px) saturate(180%); }
        .register-brand { padding: 38px; background: linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,64,175,0.88)); color: #fff; display: grid; align-content: space-between; gap: 28px; min-height: 620px; }
        .register-form-card { padding: 34px; }
        .register-field { display: grid; gap: 8px; }
        .register-field label { font-size: 13px; color: #475569; font-weight: 900; }
        .register-input-wrap { position: relative; }
        .register-input { width: 100%; height: 52px; box-sizing: border-box; border-radius: 16px; border: 1px solid #dbe4ef; background: #f8fafc; padding: 0 48px 0 16px; outline: none; color: #0f172a; font-size: 15px; font-weight: 700; transition: 0.2s ease; }
        .register-input:focus { background: #fff; border-color: var(--market-primary); box-shadow: 0 0 0 4px rgba(32,120,202,0.12); }
        .register-toggle { position: absolute; right: 10px; top: 8px; height: 36px; border: none; background: #e2e8f0; color: #334155; border-radius: 10px; font-weight: 900; cursor: pointer; padding: 0 10px; }
        .register-error { color: #dc2626; font-size: 12px; font-weight: 800; min-height: 16px; }
        .register-hint { color: #64748b; font-size: 12px; font-weight: 750; min-height: 16px; }
        .register-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .register-benefit { display: flex; gap: 12px; align-items: flex-start; padding: 14px; border-radius: 18px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.16); }
        .register-trust { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .register-trust span { padding: 12px; border-radius: 14px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 12px; font-weight: 900; color: #334155; text-align: center; }
        .register-submit { height: 56px; border-radius: 18px; border: none; background: linear-gradient(135deg, var(--market-primary), #1e40af); color: #fff; font-size: 16px; font-weight: 950; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 16px 30px rgba(32,120,202,0.22); }
        .register-submit:disabled { opacity: 0.68; cursor: not-allowed; box-shadow: none; }
        .register-spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.45); border-top-color: #fff; animation: registerSpin 0.8s linear infinite; }
        @keyframes registerSpin { to { transform: rotate(360deg); } }
        @media (max-width: 980px) { .register-shell { grid-template-columns: 1fr; } .register-brand { min-height: auto; } }
        @media (max-width: 640px) { .register-page { padding: 20px 12px 48px; } .register-form-card, .register-brand { padding: 22px; border-radius: 24px; } .register-grid-2, .register-trust { grid-template-columns: 1fr; } }
      `}</style>

      {showMockGoogle ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center", zIndex: 20, padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 430, borderRadius: 24, background: "#fff", padding: 24, boxShadow: "0 30px 80px rgba(15,23,42,0.24)" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 22 }}>Chọn tài khoản Google demo</h3>
            <div style={{ display: "grid", gap: 10 }}>
              {[
                { fullName: "Minh Khương", email: "khuong.minh@example.com" },
                { fullName: "Test User", email: "tester.pro@gmail.com" }
              ].map((account) => (
                <button key={account.email} type="button" onClick={() => handleGoogleDemo(account)} style={{ padding: 14, borderRadius: 14, border: "1px solid #e2e8f0", background: "#fff", textAlign: "left", cursor: "pointer" }}>
                  <strong>{account.fullName}</strong>
                  <div style={{ color: "#64748b", fontSize: 13 }}>{account.email}</div>
                </button>
              ))}
              <button type="button" onClick={() => setShowMockGoogle(false)} style={{ height: 42, borderRadius: 12, border: "none", background: "#f1f5f9", fontWeight: 900, cursor: "pointer" }}>Đóng</button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="register-shell">
        <aside className="register-brand">
          <div>
            <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.14em", color: "#bfdbfe", fontWeight: 950 }}>PC Mall Account</div>
            <h1 style={{ margin: "12px 0 16px", fontSize: 46, lineHeight: 1.02, letterSpacing: "-0.04em" }}>Tài khoản mua linh kiện thông minh</h1>
            <p style={{ margin: 0, color: "#dbeafe", lineHeight: 1.7, fontSize: 16 }}>Lưu cấu hình PC, theo dõi đơn hàng, bảo hành điện tử và nhận hỗ trợ kỹ thuật nhanh hơn.</p>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {[
              ["Theo dõi đơn hàng", "Cập nhật trạng thái thanh toán, giao hàng và lịch sử mua."],
              ["Bảo hành điện tử", "Tra cứu QR warranty, gửi yêu cầu bảo hành và theo dõi tiến trình."],
              ["PC Builder cloud", "Lưu cấu hình PC và đồng bộ khi đăng nhập."]
            ].map(([title, desc]) => (
              <div key={title} className="register-benefit">
                <div style={{ width: 34, height: 34, borderRadius: 12, background: "#60a5fa", display: "grid", placeItems: "center", fontWeight: 950 }}>✓</div>
                <div><strong>{title}</strong><div style={{ color: "#cbd5e1", marginTop: 3, fontSize: 13, lineHeight: 1.5 }}>{desc}</div></div>
              </div>
            ))}
          </div>
        </aside>

        <main className="register-form-card">
          <div style={{ display: "grid", gap: 8, marginBottom: 22 }}>
            <h2 style={{ margin: 0, fontSize: 32, letterSpacing: "-0.03em", color: "#0f172a" }}>Tạo tài khoản</h2>
            <p style={{ margin: 0, color: "#64748b" }}>Đăng ký để bắt đầu mua sắm và quản lý bảo hành tại PC Mall.</p>
          </div>

          {status.message ? (
            <div style={{ padding: "13px 15px", borderRadius: 14, marginBottom: 16, background: status.type === "success" ? "#ecfdf5" : "#fef2f2", color: status.type === "success" ? "#047857" : "#b91c1c", border: `1px solid ${status.type === "success" ? "#bbf7d0" : "#fecaca"}`, fontWeight: 850 }}>
              {status.message}
            </div>
          ) : null}

          <button type="button" onClick={() => setShowMockGoogle(true)} disabled={isSubmitting} style={{ width: "100%", height: 52, borderRadius: 16, border: "1px solid #dbe4ef", background: "#fff", fontWeight: 900, cursor: "pointer", marginBottom: 16 }}>
            Tiếp tục với Google <span style={{ color: "#64748b" }}>(DEMO)</span>
          </button>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
            <div className="register-field">
              <label>Họ và tên</label>
              <input className="register-input" name="full_name" value={formValues.full_name} onChange={handleChange} onBlur={() => setTouched((p) => ({ ...p, full_name: true }))} placeholder="Nguyễn Văn A" />
              <div className="register-error">{fieldError("full_name")}</div>
            </div>

            <div className="register-grid-2">
              <div className="register-field">
                <label>Email</label>
                <input className="register-input" name="email" type="email" value={formValues.email} onChange={handleChange} onBlur={() => setTouched((p) => ({ ...p, email: true }))} placeholder="you@example.com" />
                <div className={fieldError("email") ? "register-error" : "register-hint"}>{fieldError("email") || emailStatus.message}</div>
              </div>
              <div className="register-field">
                <label>Số điện thoại</label>
                <input className="register-input" name="phone" value={formValues.phone} onChange={handleChange} onBlur={() => setTouched((p) => ({ ...p, phone: true }))} placeholder="0901234567" />
                <div className="register-error">{fieldError("phone")}</div>
              </div>
            </div>

            <div className="register-grid-2">
              <div className="register-field">
                <label htmlFor="register-password">Mật khẩu</label>
                <div className="register-input-wrap">
                  <input
                    id="register-password"
                    data-testid="password-input"
                    className="register-input"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formValues.password}
                    onChange={handleChange}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={() => {
                      setIsPasswordFocused(false);
                      setTouched((p) => ({ ...p, password: true }));
                    }}
                    placeholder="Tối thiểu 8 ký tự"
                    autoComplete="new-password"
                  />
                  <button className="register-toggle" type="button" onClick={() => setShowPassword((p) => !p)}>
                    <EyeIcon hidden={!showPassword} />
                  </button>
                </div>

                {/* Realtime Strength Bar & Status [UX-004] */}
                {formValues.password.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Độ mạnh mật khẩu:</span>
                      <span
                        data-testid="password-strength-label"
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: strength.tone,
                          backgroundColor: strength.bg,
                          padding: "2px 8px",
                          borderRadius: 9999,
                          border: `1px solid ${strength.tone}35`
                        }}
                      >
                        {strength.label}
                      </span>
                    </div>
                    <div
                      data-testid="password-strength-bar"
                      style={{ height: 6, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}
                    >
                      <div
                        style={{
                          width: `${strength.percent}%`,
                          height: "100%",
                          background: strength.tone,
                          transition: "width 0.3s ease, background 0.3s ease"
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Realtime Checklist: Visible when password field has input or is focused [UX-004] */}
                {(formValues.password.length > 0 || isPasswordFocused) && (
                  <div
                    data-testid="password-criteria-list"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "6px 12px",
                      padding: "10px 12px",
                      borderRadius: 12,
                      background: "#f1f5f9",
                      border: "1px solid #e2e8f0",
                      marginTop: 4
                    }}
                  >
                    <div
                      data-testid="criterion-length"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11.5,
                        fontWeight: 650,
                        color: strength.criteria.length ? "#059669" : "#64748b",
                        transition: "color 0.2s ease"
                      }}
                    >
                      <span style={{ fontSize: 13, color: strength.criteria.length ? "#10b981" : "#94a3b8" }}>
                        {strength.criteria.length ? "✓" : "○"}
                      </span>
                      Từ 8 ký tự trở lên
                    </div>

                    <div
                      data-testid="criterion-uppercase"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11.5,
                        fontWeight: 650,
                        color: strength.criteria.uppercase ? "#059669" : "#64748b",
                        transition: "color 0.2s ease"
                      }}
                    >
                      <span style={{ fontSize: 13, color: strength.criteria.uppercase ? "#10b981" : "#94a3b8" }}>
                        {strength.criteria.uppercase ? "✓" : "○"}
                      </span>
                      Chữ hoa (A-Z)
                    </div>

                    <div
                      data-testid="criterion-number"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11.5,
                        fontWeight: 650,
                        color: strength.criteria.number ? "#059669" : "#64748b",
                        transition: "color 0.2s ease"
                      }}
                    >
                      <span style={{ fontSize: 13, color: strength.criteria.number ? "#10b981" : "#94a3b8" }}>
                        {strength.criteria.number ? "✓" : "○"}
                      </span>
                      Chữ số (0-9)
                    </div>

                    <div
                      data-testid="criterion-special"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11.5,
                        fontWeight: 650,
                        color: strength.criteria.special ? "#059669" : "#64748b",
                        transition: "color 0.2s ease"
                      }}
                    >
                      <span style={{ fontSize: 13, color: strength.criteria.special ? "#10b981" : "#94a3b8" }}>
                        {strength.criteria.special ? "✓" : "○"}
                      </span>
                      Ký tự đặc biệt (!@#$)
                    </div>
                  </div>
                )}

                {fieldError("password") && !isPasswordFocused && (
                  <div className="register-error">{fieldError("password")}</div>
                )}
              </div>

              <div className="register-field">
                <label htmlFor="register-confirm-password">Xác nhận mật khẩu</label>
                <div className="register-input-wrap">
                  <input
                    id="register-confirm-password"
                    data-testid="confirm-password-input"
                    className="register-input"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formValues.confirmPassword}
                    onChange={handleChange}
                    onBlur={() => setTouched((p) => ({ ...p, confirmPassword: true }))}
                    placeholder="Nhập lại mật khẩu"
                    autoComplete="new-password"
                  />
                  <button className="register-toggle" type="button" onClick={() => setShowConfirmPassword((p) => !p)}>
                    <EyeIcon hidden={!showConfirmPassword} />
                  </button>
                </div>

                {/* Realtime Confirm Password Feedback [UX-004] */}
                {formValues.confirmPassword.length > 0 && (
                  <div
                    data-testid="confirm-password-feedback"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 750,
                      marginTop: 4,
                      color: formValues.confirmPassword === formValues.password ? "#059669" : "#dc2626"
                    }}
                  >
                    <span>{formValues.confirmPassword === formValues.password ? "✓" : "✕"}</span>
                    {formValues.confirmPassword === formValues.password
                      ? "Mật khẩu xác nhận trùng khớp"
                      : "Mật khẩu xác nhận chưa khớp"}
                  </div>
                )}

                {fieldError("confirmPassword") && !formValues.confirmPassword && (
                  <div className="register-error">{fieldError("confirmPassword")}</div>
                )}
              </div>
            </div>

            <div className="register-trust">
              <span>SSL secure</span>
              <span>Bảo hành điện tử</span>
              <span>Hỗ trợ 24/7</span>
            </div>

            <button
              id="btn-register-submit"
              data-testid="register-submit-btn"
              className="register-submit"
              type="submit"
              disabled={!canSubmit}
            >
              {isSubmitting ? <><Spinner /> Đang tạo tài khoản...</> : "Tạo tài khoản PC Mall"}
            </button>
            <p style={{ margin: 0, textAlign: "center", color: "#64748b" }}>Đã có tài khoản? <Link to="/login" style={{ color: "var(--market-primary)", fontWeight: 900 }}>Đăng nhập</Link></p>
          </form>
        </main>
      </div>
    </div>
  );
}

