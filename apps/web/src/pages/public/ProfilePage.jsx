import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

import { useAuth } from "../../hooks/useAuth";
import {
  changePassword,
  createMyAddress,
  deleteMyAddress,
  getCurrentProfile,
  updateCurrentProfile,
  updateMyAddress
} from "../../services/auth.service";
import { getMyOrders } from "../../services/order.service";
import { getMyWarranties } from "../../services/warranty.service";

function getErrorMessage(error, fallbackMessage) {
  if (axios.isAxiosError(error)) return error.response?.data?.message || fallbackMessage;
  return error?.message || fallbackMessage;
}

function normalizeProfile(response) {
  return response?.data || response;
}

function createAddressFormState(address) {
  return {
    id: address?.id || null,
    fullName: address?.fullName || "",
    phone: address?.phone || "",
    addressLine: address?.addressLine || "",
    ward: address?.ward || "",
    district: address?.district || "",
    province: address?.province || ""
  };
}

function getInitials(name, email) {
  const source = String(name || email || "PC").trim();
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "PC";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa cập nhật";
}

function getPasswordStrength(password) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const labels = ["Yếu", "Trung bình", "Khá", "Mạnh", "Rất mạnh"];
  const tones = ["#ef4444", "#f97316", "#f59e0b", "#22c55e", "#047857"];
  return { score, label: labels[score], tone: tones[score], percent: Math.max(12, score * 25) };
}

function PasswordInput({ label, value, onChange, visible, onToggle, placeholder }) {
  return (
    <label className="profile-field">
      <span>{label}</span>
      <div className="profile-password-wrap">
        <input className="profile-input" type={visible ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder} />
        <button type="button" onClick={onToggle}>{visible ? "Ẩn" : "Hiện"}</button>
      </div>
    </label>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { authState, isAuthenticated, refreshProfile, logout } = useAuth();
  const [profile, setProfile] = useState(authState.user || null);
  const [orders, setOrders] = useState([]);
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ type: "", message: "" });
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    phone: "",
    birthDate: "",
    gender: "",
    defaultAddressId: ""
  });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState({ current: false, next: false, confirm: false });
  const [addressForm, setAddressForm] = useState(createAddressFormState());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    async function loadDashboard() {
      try {
        setLoading(true);
        setToast({ type: "", message: "" });
        const [profileResponse, orderResponse, warrantyResponse] = await Promise.all([
          getCurrentProfile(),
          getMyOrders().catch(() => ({ data: [] })),
          getMyWarranties().catch(() => ({ data: [] }))
        ]);
        const data = normalizeProfile(profileResponse);
        const orderData = orderResponse?.data || orderResponse || [];
        const warrantyData = warrantyResponse?.data || warrantyResponse || [];
        setProfile(data);
        setOrders(Array.isArray(orderData) ? orderData : []);
        setWarranties(Array.isArray(warrantyData) ? warrantyData : []);
        const storedDefaultAddr = localStorage.getItem("checkout_addressId") || "";
        const validStoredDefault = (data?.addresses || []).some((a) => String(a.id) === storedDefaultAddr);
        setProfileForm((prev) => ({
          ...prev,
          fullName: data?.fullName || "",
          phone: data?.phone || "",
          defaultAddressId: validStoredDefault ? storedDefaultAddr : String(data?.addresses?.[0]?.id || "")
        }));
      } catch (error) {
        setToast({ type: "error", message: getErrorMessage(error, "Không thể tải tài khoản hiện tại.") });
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [isAuthenticated]);

  const memberSince = profile?.createdAt || profile?.created_at || authState?.user?.createdAt;
  const memberLevel = useMemo(() => {
    if (orders.length >= 20) return "Diamond";
    if (orders.length >= 10) return "Gold";
    if (orders.length >= 4) return "Silver";
    return "Member";
  }, [orders.length]);
  const strength = useMemo(() => getPasswordStrength(passwordForm.newPassword), [passwordForm.newPassword]);
  const defaultAddress = useMemo(
    () => (profile?.addresses || []).find((address) => String(address.id) === String(profileForm.defaultAddressId)) || profile?.addresses?.[0],
    [profile?.addresses, profileForm.defaultAddressId]
  );

  function showToast(type, message) {
    setToast({ type, message });
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast({ type: "", message: "" }), 3200);
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    try {
      setSubmitting(true);
      const response = await updateCurrentProfile({
        full_name: profileForm.fullName,
        phone: profileForm.phone
      });
      const data = normalizeProfile(response);
      if (profileForm.defaultAddressId) {
        localStorage.setItem("checkout_addressId", String(profileForm.defaultAddressId));
      }
      setProfile(data);
      await refreshProfile();
      showToast("success", "Thông tin hồ sơ đã được cập nhật.");
    } catch (error) {
      showToast("error", getErrorMessage(error, "Không thể cập nhật thông tin cá nhân."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    if (passwordForm.newPassword.length < 8) {
      showToast("error", "Mật khẩu mới tối thiểu 8 ký tự.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast("error", "Mật khẩu xác nhận không khớp.");
      return;
    }

    try {
      setSubmitting(true);
      await changePassword({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      showToast("success", "Mật khẩu đã được đổi thành công.");
    } catch (error) {
      showToast("error", getErrorMessage(error, "Không thể đổi mật khẩu."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddressSubmit(event) {
    event.preventDefault();
    try {
      setSubmitting(true);
      const response = addressForm.id ? await updateMyAddress(addressForm.id, addressForm) : await createMyAddress(addressForm);
      const address = normalizeProfile(response);
      setProfile((prev) => {
        const current = Array.isArray(prev?.addresses) ? prev.addresses : [];
        const nextAddresses = addressForm.id ? current.map((item) => (item.id === address.id ? address : item)) : [address, ...current];
        return { ...(prev || {}), addresses: nextAddresses };
      });
      setAddressForm(createAddressFormState());
      showToast("success", addressForm.id ? "Địa chỉ đã được cập nhật." : "Đã thêm địa chỉ mới.");
    } catch (error) {
      showToast("error", getErrorMessage(error, "Không thể lưu địa chỉ."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteAddress(addressId) {
    try {
      setSubmitting(true);
      await deleteMyAddress(addressId);
      setProfile((prev) => ({ ...(prev || {}), addresses: (prev?.addresses || []).filter((item) => item.id !== addressId) }));
      showToast("success", "Địa chỉ đã được xóa.");
    } catch (error) {
      showToast("error", getErrorMessage(error, "Không thể xóa địa chỉ."));
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/");
  }

  if (!isAuthenticated) {
    return (
      <div className="profile-page">
        <div className="profile-card" style={{ padding: 28 }}>
          <h1>Hồ sơ tài khoản</h1>
          <p style={{ color: "#64748b" }}>Bạn cần đăng nhập để xem khu vực này.</p>
          <Link to="/login" className="profile-primary-btn">Đi đến trang đăng nhập</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <style>{`
        .profile-page { min-height: 100vh; padding: 32px 20px 80px; background: radial-gradient(circle at 0% 0%, rgba(37,99,235,0.08), transparent 40%), #f8fafc; }
        .profile-shell { max-width: 1240px; margin: 0 auto; display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 22px; align-items: start; }
        .profile-sidebar, .profile-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 24px; box-shadow: 0 18px 48px rgba(15,23,42,0.06); }
        .profile-sidebar { position: sticky; top: 20px; overflow: hidden; }
        .profile-sidebar-head { padding: 24px; background: linear-gradient(135deg, #0f172a, #1d4ed8); color: #fff; display: grid; justify-items: center; text-align: center; gap: 10px; }
        .profile-avatar { width: 76px; height: 76px; border-radius: 24px; display: grid; place-items: center; background: linear-gradient(135deg, #60a5fa, #22c55e); color: #fff; font-size: 24px; font-weight: 950; box-shadow: 0 14px 30px rgba(15,23,42,0.22); }
        .profile-menu { padding: 12px; display: grid; gap: 6px; }
        .profile-menu a, .profile-menu button { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 14px; border: none; background: transparent; color: #334155; font-weight: 850; text-decoration: none; cursor: pointer; transition: 0.18s ease; width: 100%; text-align: left; }
        .profile-menu a:hover, .profile-menu button:hover, .profile-menu .active { background: #eff6ff; color: #1d4ed8; transform: translateX(3px); }
        .profile-content { display: grid; gap: 22px; }
        .profile-hero { padding: 28px; border-radius: 26px; background: linear-gradient(135deg, #0f172a, #1e40af); color: #fff; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 20px; align-items: center; }
        .profile-hero-avatar { width: 104px; height: 104px; border-radius: 30px; display: grid; place-items: center; background: linear-gradient(135deg, #60a5fa, #14b8a6); font-size: 34px; font-weight: 950; }
        .profile-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
        .profile-stat { padding: 14px; border-radius: 16px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.14); }
        .profile-card { padding: 24px; }
        .profile-section-title { margin: 0 0 16px; font-size: 22px; color: #0f172a; letter-spacing: -0.02em; }
        .profile-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .profile-field { display: grid; gap: 8px; color: #475569; font-weight: 850; font-size: 13px; }
        .profile-input, .profile-select { width: 100%; height: 46px; border-radius: 14px; border: 1px solid #dbe4ef; background: #f8fafc; padding: 0 13px; color: #0f172a; font-weight: 700; box-sizing: border-box; outline: none; }
        .profile-input:focus, .profile-select:focus { background: #fff; border-color: #2563eb; box-shadow: 0 0 0 4px rgba(37,99,235,0.1); }
        .profile-password-wrap { position: relative; }
        .profile-password-wrap button { position: absolute; top: 6px; right: 6px; height: 34px; border: none; border-radius: 10px; background: #e2e8f0; color: #334155; font-weight: 900; cursor: pointer; padding: 0 10px; }
        .profile-primary-btn { height: 46px; display: inline-flex; align-items: center; justify-content: center; border-radius: 14px; border: none; background: linear-gradient(135deg, #2563eb, #1e40af); color: #fff; font-weight: 950; padding: 0 16px; text-decoration: none; cursor: pointer; }
        .profile-secondary-btn { height: 40px; border-radius: 12px; border: 1px solid #dbe4ef; background: #fff; color: #334155; font-weight: 850; padding: 0 12px; cursor: pointer; }
        .profile-address-list { display: grid; gap: 12px; }
        .profile-address { padding: 15px; border-radius: 16px; border: 1px solid #edf2f7; background: #fff; transition: 0.18s ease; }
        .profile-address:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(15,23,42,0.06); }
        .profile-toast { position: fixed; right: 24px; bottom: 24px; z-index: 40; padding: 14px 16px; border-radius: 16px; font-weight: 900; box-shadow: 0 18px 48px rgba(15,23,42,0.16); }
        .profile-toast.success { background: #ecfdf5; color: #047857; border: 1px solid #bbf7d0; }
        .profile-toast.error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        @media (max-width: 980px) { .profile-shell { grid-template-columns: 1fr; } .profile-sidebar { position: static; } .profile-menu { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        @media (max-width: 680px) { .profile-page { padding: 18px 12px 60px; } .profile-hero, .profile-form-grid { grid-template-columns: 1fr; } .profile-stats, .profile-menu { grid-template-columns: 1fr; } .profile-card { padding: 18px; } }
      `}</style>

      {toast.message ? <div className={`profile-toast ${toast.type}`}>{toast.message}</div> : null}

      <div className="profile-shell">
        <aside className="profile-sidebar">
          <div className="profile-sidebar-head">
            <div className="profile-avatar">{getInitials(profile?.fullName, profile?.email)}</div>
            <div>
              <div style={{ fontWeight: 950, fontSize: 18 }}>{profile?.fullName || "PC Mall Member"}</div>
              <div style={{ color: "#bfdbfe", fontSize: 13 }}>Member since {formatDate(memberSince)}</div>
            </div>
          </div>
          <nav className="profile-menu">
            <a className="active" href="#profile">Hồ sơ</a>
            <Link to="/orders">Đơn hàng</Link>
            <a href="#addresses">Địa chỉ</a>
            <Link to="/checkout">Thanh toán</Link>
            <Link to="/warranties">Bảo hành</Link>
            <Link to="/products">Wishlist</Link>
            <button type="button" onClick={handleLogout}>Đăng xuất</button>
          </nav>
        </aside>

        <main className="profile-content">
          {loading ? (
            <section className="profile-card">Đang tải thông tin tài khoản...</section>
          ) : (
            <>
              <section className="profile-hero">
                <div className="profile-hero-avatar">{getInitials(profile?.fullName, profile?.email)}</div>
                <div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <h1 style={{ margin: 0, fontSize: 34, letterSpacing: "-0.04em" }}>{profile?.fullName || "Tài khoản PC Mall"}</h1>
                    <span style={{ padding: "5px 9px", borderRadius: 999, background: "#dcfce7", color: "#047857", fontSize: 12, fontWeight: 950 }}>Email verified</span>
                  </div>
                  <div style={{ color: "#cbd5e1", marginTop: 6 }}>{profile?.email}</div>
                  <div className="profile-stats">
                    <div className="profile-stat"><div style={{ color: "#bfdbfe", fontSize: 12, fontWeight: 850 }}>Số đơn hàng</div><strong style={{ fontSize: 24 }}>{orders.length}</strong></div>
                    <div className="profile-stat"><div style={{ color: "#bfdbfe", fontSize: 12, fontWeight: 850 }}>Sản phẩm bảo hành</div><strong style={{ fontSize: 24 }}>{warranties.length}</strong></div>
                    <div className="profile-stat"><div style={{ color: "#bfdbfe", fontSize: 12, fontWeight: 850 }}>Cấp độ</div><strong style={{ fontSize: 24 }}>{memberLevel}</strong></div>
                  </div>
                </div>
              </section>

              <section id="profile" className="profile-card">
                <h2 className="profile-section-title">Thông tin hồ sơ</h2>
                <form onSubmit={handleProfileSubmit} className="profile-form-grid">
                  <label className="profile-field"><span>Họ tên</span><input className="profile-input" value={profileForm.fullName} onChange={(event) => setProfileForm((prev) => ({ ...prev, fullName: event.target.value }))} /></label>
                  <label className="profile-field"><span>Email</span><input className="profile-input" value={profile?.email || ""} disabled /></label>
                  <label className="profile-field"><span>Số điện thoại</span><input className="profile-input" value={profileForm.phone} onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))} /></label>
                  <label className="profile-field"><span>Ngày sinh</span><input className="profile-input" type="date" value={profileForm.birthDate} onChange={(event) => setProfileForm((prev) => ({ ...prev, birthDate: event.target.value }))} /></label>
                  <label className="profile-field"><span>Giới tính</span><select className="profile-select" value={profileForm.gender} onChange={(event) => setProfileForm((prev) => ({ ...prev, gender: event.target.value }))}><option value="">Chưa cập nhật</option><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option></select></label>
                  <label className="profile-field"><span>Địa chỉ mặc định</span><select className="profile-select" value={profileForm.defaultAddressId} onChange={(event) => setProfileForm((prev) => ({ ...prev, defaultAddressId: event.target.value }))}><option value="">Chưa chọn</option>{(profile?.addresses || []).map((address) => <option key={address.id} value={address.id}>{address.addressLine || address.province || `Địa chỉ #${address.id}`}</option>)}</select></label>
                  <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ color: "#64748b", fontSize: 14 }}>Địa chỉ mặc định: <strong>{defaultAddress ? [defaultAddress.addressLine, defaultAddress.ward, defaultAddress.district, defaultAddress.province].filter(Boolean).join(", ") : "Chưa cập nhật"}</strong></div>
                    <button className="profile-primary-btn" type="submit" disabled={submitting}>{submitting ? "Đang lưu..." : "Lưu hồ sơ"}</button>
                  </div>
                </form>
              </section>

              <section className="profile-card">
                <h2 className="profile-section-title">Bảo mật tài khoản</h2>
                <form onSubmit={handlePasswordSubmit} className="profile-form-grid">
                  <PasswordInput label="Current password" value={passwordForm.currentPassword} visible={showPassword.current} onToggle={() => setShowPassword((prev) => ({ ...prev, current: !prev.current }))} onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))} placeholder="Mật khẩu hiện tại" />
                  <PasswordInput label="New password" value={passwordForm.newPassword} visible={showPassword.next} onToggle={() => setShowPassword((prev) => ({ ...prev, next: !prev.next }))} onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))} placeholder="Tối thiểu 8 ký tự" />
                  <div style={{ display: "grid", gap: 8 }}>
                    <PasswordInput label="Confirm password" value={passwordForm.confirmPassword} visible={showPassword.confirm} onToggle={() => setShowPassword((prev) => ({ ...prev, confirm: !prev.confirm }))} onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))} placeholder="Nhập lại mật khẩu mới" />
                  </div>
                  <div style={{ display: "grid", gap: 8, alignSelf: "end" }}>
                    <div style={{ height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}><div style={{ width: `${strength.percent}%`, height: "100%", background: strength.tone }} /></div>
                    <div style={{ color: strength.tone, fontWeight: 900, fontSize: 13 }}>Độ mạnh: {strength.label}</div>
                    <button className="profile-primary-btn" type="submit" disabled={submitting}>{submitting ? "Đang cập nhật..." : "Cập nhật mật khẩu"}</button>
                  </div>
                </form>
              </section>

              <section id="addresses" className="profile-card">
                <h2 className="profile-section-title">Địa chỉ giao hàng</h2>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 0.8fr)", gap: 18 }}>
                  <div className="profile-address-list">
                    {(profile?.addresses || []).length > 0 ? (profile.addresses || []).map((address) => (
                      <article key={address.id} className="profile-address">
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                          <strong>{address.fullName || profile?.fullName || "Người nhận"}</strong>
                          {String(profileForm.defaultAddressId) === String(address.id) ? <span style={{ color: "#047857", fontWeight: 900, fontSize: 12 }}>Mặc định</span> : null}
                        </div>
                        <div style={{ color: "#64748b", marginTop: 6 }}>{[address.addressLine, address.ward, address.district, address.province].filter(Boolean).join(", ") || "Chưa có địa chỉ đầy đủ"}</div>
                        <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>{address.phone || "Chưa có số điện thoại"}</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                          <button type="button" className="profile-secondary-btn" onClick={() => setAddressForm(createAddressFormState(address))}>Chỉnh sửa</button>
                          <button type="button" className="profile-secondary-btn" onClick={() => handleDeleteAddress(address.id)} style={{ color: "#b91c1c" }}>Xóa</button>
                        </div>
                      </article>
                    )) : <div style={{ color: "#64748b" }}>Bạn chưa có địa chỉ nào được lưu.</div>}
                  </div>
                  <form onSubmit={handleAddressSubmit} style={{ display: "grid", gap: 10 }}>
                    <input className="profile-input" value={addressForm.fullName} onChange={(event) => setAddressForm((prev) => ({ ...prev, fullName: event.target.value }))} placeholder="Họ tên người nhận" />
                    <input className="profile-input" value={addressForm.phone} onChange={(event) => setAddressForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="Số điện thoại" />
                    <input className="profile-input" value={addressForm.addressLine} onChange={(event) => setAddressForm((prev) => ({ ...prev, addressLine: event.target.value }))} placeholder="Số nhà, đường..." />
                    <input className="profile-input" value={addressForm.ward} onChange={(event) => setAddressForm((prev) => ({ ...prev, ward: event.target.value }))} placeholder="Phường / Xã" />
                    <input className="profile-input" value={addressForm.district} onChange={(event) => setAddressForm((prev) => ({ ...prev, district: event.target.value }))} placeholder="Quận / Huyện" />
                    <input className="profile-input" value={addressForm.province} onChange={(event) => setAddressForm((prev) => ({ ...prev, province: event.target.value }))} placeholder="Tỉnh / Thành phố" />
                    <button type="submit" className="profile-primary-btn" disabled={submitting}>{addressForm.id ? "Lưu địa chỉ" : "Thêm địa chỉ"}</button>
                  </form>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
