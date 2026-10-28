import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { getCart } from "../../services/cart.service";
import { createOrder, createVnpayUrl, uploadPaymentReceipt } from "../../services/order.service";
import {
  getMyAddresses,
  createMyAddress,
  updateCurrentProfile,
  updateMyAddress,
  deleteMyAddress
} from "../../services/auth.service";
import { BANK_ACCOUNT_CONFIG, generateTransferNote } from "../../config/bank-account";
import { routeConfig } from "../../routes/routeConfig";

import { CashIcon, ShieldCardIcon, QrIcon } from "../../components/checkout/CheckoutIcons";
import { StepCustomerInfo } from "../../components/checkout/StepCustomerInfo";
import { StepShippingAddress } from "../../components/checkout/StepShippingAddress";
import { StepPaymentMethod } from "../../components/checkout/StepPaymentMethod";
import { StepOrderConfirmation } from "../../components/checkout/StepOrderConfirmation";
import { CheckoutOrderSummary } from "../../components/checkout/CheckoutOrderSummary";

import "./CheckoutPage.css";

const SECTION_STYLE = {
  padding: "32px",
  background: "rgba(255, 255, 255, 0.85)",
  backdropFilter: "blur(30px) saturate(180%)",
  borderRadius: "32px",
  border: "1px solid rgba(255, 255, 255, 0.7)",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.04), inset 0 0 0 1px rgba(255,255,255,1)",
  animation: "fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both"
};

const inputStyle = {
  padding: "16px 20px",
  borderRadius: "16px",
  border: "1px solid rgba(0, 0, 0, 0.06)",
  outline: "none",
  width: "100%",
  background: "rgba(248, 250, 252, 0.7)",
  color: "#1e293b",
  fontSize: "15px",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  fontWeight: "600"
};

const EMPTY_ADDRESS = {
  full_name: "",
  phone: "",
  province: "",
  district: "",
  ward: "",
  address_line: ""
};

const STORAGE_KEYS = {
  step: "checkout_step",
  addressId: "checkout_address_id",
  paymentMethod: "checkout_payment_method",
  note: "checkout_note",
  addressDraft: "checkout_address_draft_v2",
  directDraft: "checkout_direct_draft_v1"
};

const PAYMENT_METHOD_CARDS = [
  {
    value: "COD",
    label: "Thanh toán khi nhận hàng",
    shortLabel: "COD",
    description: "Kiểm tra hàng và thanh toán trực tiếp cho nhân viên giao hàng.",
    badge: "Phổ biến",
    icon: CashIcon,
    tone: "#059669"
  },
  {
    value: "VNPAY",
    label: "Thanh toán qua VNPay",
    shortLabel: "VNPay",
    description: "Chuyển sang cổng VNPay an toàn sau khi tạo đơn hàng.",
    badge: "Online",
    icon: ShieldCardIcon,
    tone: "#2563eb"
  },
  {
    value: "BANK_TRANSFER",
    label: "QR Banking",
    shortLabel: "QR",
    description: "Quét QR chuyển khoản, sau đó tải chứng từ ở chi tiết đơn hàng.",
    badge: "Xác minh",
    icon: QrIcon,
    tone: "#7c3aed"
  }
];

const PAYMENT_METHOD_GUIDANCE = {
  COD: "Bạn sẽ thanh toán khi nhận hàng cho nhân viên giao hàng.",
  VNPAY: "Bạn sẽ được chuyển sang cổng thanh toán VNPay Sandbox để hoàn tất giao dịch.",
  BANK_TRANSFER: "Bạn sẽ quét mã QR hoặc chuyển khoản và tải minh chứng để admin xác nhận."
};

const VALID_PAYMENT_METHODS = PAYMENT_METHOD_CARDS.map((option) => option.value);

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function getUserFullName(user) {
  return user?.fullName || user?.full_name || "";
}

function getUserPhone(user) {
  return user?.phone || "";
}

function getAddressFullName(address, fallbackUser) {
  return address?.fullName || address?.full_name || getUserFullName(fallbackUser) || "";
}

function getAddressLine(address) {
  return address?.addressLine || address?.address_line || "";
}

function formatAddressDisplay(address) {
  if (!address) return "";
  return [getAddressLine(address), address.ward, address.district, address.province].filter(Boolean).join(", ");
}

function loadStoredAddressDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.addressDraft);
    if (!raw) return null;
    return { ...EMPTY_ADDRESS, ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

function loadDirectCheckoutDraft() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.directDraft) || localStorage.getItem(STORAGE_KEYS.directDraft);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const { isAuthenticated, authState, refreshProfile } = useAuth();
  const [currentUser, setCurrentUser] = useState(authState?.user);

  // States
  const [cart, setCart] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [directCheckoutDraft, setDirectCheckoutDraft] = useState(() => loadDirectCheckoutDraft());
  const [activeStep, setActiveStep] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.step);
    return saved ? Math.min(Math.max(Number(saved), 1), 4) : 1;
  });

  const [formValues, setFormValues] = useState({
    addressId: localStorage.getItem(STORAGE_KEYS.addressId) || "",
    paymentMethod: localStorage.getItem(STORAGE_KEYS.paymentMethod) || "COD",
    shippingFee: "0",
    note: localStorage.getItem(STORAGE_KEYS.note) || ""
  });


  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [paymentProofFile, setPaymentProofFile] = useState(null);

  // Custom toast notification state
  const [toast, setToast] = useState({ type: "", message: "" });

  // Step 1 inline phone editing state
  const [phoneInput, setPhoneInput] = useState(() => getUserPhone(authState?.user));
  const [isUpdatingPhone, setIsUpdatingPhone] = useState(false);

  // Step 2 address form state
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState(() => loadStoredAddressDraft() || EMPTY_ADDRESS);

  // Load custom toast timer reference
  useEffect(() => {
    if (toast.message) {
      const timer = setTimeout(() => setToast({ type: "", message: "" }), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Persist step and notes locally
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.step, String(activeStep));
  }, [activeStep]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.paymentMethod, formValues.paymentMethod);
  }, [formValues.paymentMethod]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.note, formValues.note);
  }, [formValues.note]);

  useEffect(() => {
    if (formValues.addressId) {
      localStorage.setItem(STORAGE_KEYS.addressId, formValues.addressId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.addressId);
    }
  }, [formValues.addressId]);

  // Refresh user profile to get latest phone number and update local state
  useEffect(() => {
    if (isAuthenticated) {
      refreshProfile().then((updatedUser) => {
        if (updatedUser) {
          setCurrentUser(updatedUser);
          setPhoneInput(updatedUser.phone || "");
        }
      });
    }
  }, [isAuthenticated, refreshProfile]);

  // Update currentUser when authState changes
  useEffect(() => {
    if (authState?.user) {
      setCurrentUser(authState.user);
      if (!phoneInput) {
        setPhoneInput(getUserPhone(authState.user));
      }
    }
  }, [authState?.user]);

  // Auto-populate new address form with user details
  useEffect(() => {
    if (currentUser) {
      setNewAddress((prev) => ({
        ...prev,
        full_name: prev.full_name || getUserFullName(currentUser),
        phone: prev.phone || getUserPhone(currentUser)
      }));
    }
  }, [currentUser]);

  useEffect(() => {
    const hasDraft = Object.values(newAddress).some((value) => String(value || "").trim());

    if (hasDraft) {
      localStorage.setItem(STORAGE_KEYS.addressDraft, JSON.stringify(newAddress));
    } else {
      localStorage.removeItem(STORAGE_KEYS.addressDraft);
    }
  }, [newAddress]);

  const items = useMemo(() => cart?.items || [], [cart]);
  const totalAmount = Number(cart?.totalAmount || 0);

  const [appliedCoupon, setAppliedCoupon] = useState(() => {
    try {
      const saved = sessionStorage.getItem("cnm_applied_coupon");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [loadingCoupons, setLoadingCoupons] = useState(false);

  const discountAmount = appliedCoupon ? Number(appliedCoupon.discountAmount || 0) : 0;
  const shippingFee = Number(formValues.shippingFee || 0);
  const finalAmount = useMemo(() => Math.max(0, totalAmount - discountAmount + shippingFee), [shippingFee, totalAmount, discountAmount]);
  const selectedPaymentOption = useMemo(
    () => PAYMENT_METHOD_CARDS.find((option) => option.value === formValues.paymentMethod) || null,
    [formValues.paymentMethod]
  );
  const selectedAddress = useMemo(
    () => addresses.find((address) => String(address.id) === String(formValues.addressId)) || null,
    [addresses, formValues.addressId]
  );
  const defaultAddress = useMemo(() => selectedAddress || addresses[0] || null, [addresses, selectedAddress]);
  const currentFullName = getUserFullName(currentUser);
  const currentEmail = currentUser?.email || "";
  const currentPhone = getUserPhone(currentUser);
  const normalizedPhoneInput = String(phoneInput || "").trim();
  const effectivePhone = normalizedPhoneInput || currentPhone;
  const hasPersistedPhone = Boolean(currentPhone);
  const hasPhoneValue = Boolean(effectivePhone);

  // Initialize Checkout data
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    async function initCheckout() {
      try {
        setLoading(true);
        const addrRes = await getMyAddresses();
        const addrData = addrRes?.data || addrRes;

        if (directCheckoutDraft?.items?.length) {
          setCart({
            items: directCheckoutDraft.items,
            subtotal: Number(directCheckoutDraft.totalAmount || 0),
            itemCount: Number(directCheckoutDraft.totalItems || directCheckoutDraft.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)),
            totalAmount: Number(directCheckoutDraft.totalAmount || 0),
            totalItems: Number(directCheckoutDraft.totalItems || directCheckoutDraft.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0))
          });
        } else {
          const cartRes = await getCart();
          const cartData = cartRes?.data || cartRes;
          setCart(cartData);
        }

        setAddresses(addrData || []);

        // Auto-select address if not set or invalid
        if (addrData && addrData.length > 0) {
          const storedAddrId = localStorage.getItem(STORAGE_KEYS.addressId);
          const isValidStored = addrData.some((a) => String(a.id) === storedAddrId);
          if (isValidStored) {
            setFormValues((prev) => ({ ...prev, addressId: storedAddrId }));
          } else {
            setFormValues((prev) => ({ ...prev, addressId: String(addrData[0].id) }));
          }
        }
      } catch (_error) {
        setErrorMessage("Không thể tải thông tin thanh toán");
      } finally {
        setLoading(false);
      }
    }

    initCheckout();
  }, [isAuthenticated, directCheckoutDraft]);

  // Phone validation
  function validatePhone(phone) {
    return /^(0|\+84)(\d{9,10})$/.test(String(phone).replace(/\s/g, ""));
  }

  // Handle step 1 profile update or navigation to Step 2
  async function handleSubmitStep1(e) {
    if (e && e.preventDefault) e.preventDefault();

    const trimmedPhone = String(phoneInput || "").trim();
    if (!trimmedPhone) {
      setErrors({ phone: "Vui lòng nhập số điện thoại" });
      return;
    }
    if (!validatePhone(trimmedPhone)) {
      setErrors({ phone: "Số điện thoại Việt Nam không hợp lệ (9-10 chữ số)" });
      return;
    }

    if (!hasPersistedPhone || normalizedPhoneInput !== currentPhone) {
      try {
        setIsUpdatingPhone(true);
        setErrors({});

        await updateCurrentProfile({
          full_name: currentFullName,
          phone: trimmedPhone
        });

        const updated = await refreshProfile();
        if (updated) {
          setCurrentUser(updated);
          setPhoneInput(getUserPhone(updated));
        }

        setToast({ type: "success", message: "Cập nhật số điện thoại thành công!" });
        setActiveStep(2);
      } catch (err) {
        setToast({ type: "error", message: "Lỗi cập nhật số điện thoại. Vui lòng thử lại." });
      } finally {
        setIsUpdatingPhone(false);
      }
    } else {
      setErrors({});
      setActiveStep(2);
    }
  }

  // Handle changes in notes
  function handleChange(event) {
    const { name, value } = event.target;
    setFormValues((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: "" }));
  }

  function handlePaymentMethodChange(value) {
    if (isSubmitting || !VALID_PAYMENT_METHODS.includes(value)) return;
    setFormValues((p) => ({ ...p, paymentMethod: value }));
    setErrors((p) => ({ ...p, paymentMethod: "" }));
    setErrorMessage("");
  }

  function handleStep3Next() {
    if (!VALID_PAYMENT_METHODS.includes(formValues.paymentMethod)) {
      setErrors((prev) => ({ ...prev, paymentMethod: "Vui lòng chọn phương thức thanh toán." }));
      return;
    }

    setErrors((prev) => ({ ...prev, paymentMethod: "" }));
    setActiveStep(4);
  }

  // Address operations: create or update
  async function handleSaveAddress(e) {
    e.preventDefault();
    if (!newAddress.full_name.trim()) {
      setErrors((p) => ({ ...p, addr_fullName: "Vui lòng nhập họ tên" }));
      return;
    }
    if (!newAddress.phone.trim() || !validatePhone(newAddress.phone)) {
      setErrors((p) => ({ ...p, addr_phone: "Số điện thoại nhận hàng không hợp lệ" }));
      return;
    }
    if (!newAddress.province.trim() || !newAddress.district.trim() || !newAddress.ward.trim() || !newAddress.address_line.trim()) {
      setErrors((p) => ({ ...p, addr_line: "Vui lòng cung cấp đầy đủ thông tin địa chỉ" }));
      return;
    }

    try {
      setIsSavingAddress(true);
      setErrorMessage("");
      setErrors({});

      if (editingAddressId) {
        const res = await updateMyAddress(editingAddressId, {
          fullName: newAddress.full_name,
          phone: newAddress.phone,
          province: newAddress.province,
          district: newAddress.district,
          ward: newAddress.ward,
          addressLine: newAddress.address_line
        });
        const updatedDetails = res?.data || res;

        setAddresses((prev) => prev.map((a) => (a.id === editingAddressId ? { ...a, ...updatedDetails } : a)));
        setFormValues((prev) => ({ ...prev, addressId: String(editingAddressId) }));
        setToast({ type: "success", message: "Cập nhật địa chỉ thành công!" });
      } else {
        const res = await createMyAddress(newAddress);
        const createdDetails = res?.data?.data || res.data || res;

        setAddresses((prev) => [createdDetails, ...prev]);
        setFormValues((prev) => ({ ...prev, addressId: String(createdDetails.id) }));
        setToast({ type: "success", message: "Đã thêm địa chỉ giao hàng mới thành công!" });
        setActiveStep(3);
      }

      setShowAddressForm(false);
      setEditingAddressId(null);
      localStorage.removeItem(STORAGE_KEYS.addressDraft);
      setNewAddress({
        ...EMPTY_ADDRESS,
        full_name: currentFullName,
        phone: currentPhone
      });
    } catch (error) {
      setToast({ type: "error", message: error?.response?.data?.message || error?.message || "Lỗi lưu địa chỉ" });
    } finally {
      setIsSavingAddress(false);
    }
  }

  function handleStartEditAddress(addr, e) {
    e.stopPropagation();
    setEditingAddressId(addr.id);
    setNewAddress({
      full_name: addr.fullName || addr.full_name || "",
      phone: addr.phone || "",
      province: addr.province || "",
      district: addr.district || "",
      ward: addr.ward || "",
      address_line: addr.addressLine || addr.address_line || ""
    });
    setShowAddressForm(true);
    setTimeout(() => {
      document.getElementById("address-form-section")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  async function handleDeleteAddress(addressId, e) {
    e.stopPropagation();
    if (!window.confirm("Bạn có chắc chắn muốn xóa địa chỉ này?")) return;

    try {
      setToast({ type: "info", message: "Đang xóa địa chỉ..." });
      await deleteMyAddress(addressId);
      setAddresses((prev) => prev.filter((a) => a.id !== addressId));
      if (formValues.addressId === String(addressId)) {
        setFormValues((p) => ({ ...p, addressId: "" }));
      }
      setToast({ type: "success", message: "Xóa địa chỉ thành công!" });
    } catch (_err) {
      setToast({ type: "error", message: "Không thể xóa địa chỉ. Vui lòng thử lại." });
    }
  }

  function resetAddressDraft() {
    localStorage.removeItem(STORAGE_KEYS.addressDraft);
    setNewAddress({
      ...EMPTY_ADDRESS,
      full_name: currentFullName,
      phone: currentPhone
    });
  }

  function handleOpenNewAddressForm() {
    setEditingAddressId(null);
    resetAddressDraft();
    setShowAddressForm(true);
  }

  function handleCloseAddressForm() {
    setShowAddressForm(false);
    setEditingAddressId(null);
    resetAddressDraft();
    setErrors((prev) => ({
      ...prev,
      addr_fullName: "",
      addr_phone: "",
      addr_line: ""
    }));
  }

  // Handle Order Submit
  async function handleSubmit(event) {
    event.preventDefault();

    if (!String(phoneInput || "").trim()) {
      setErrorMessage("Vui lòng bổ sung số điện thoại trong Bước 1 trước khi đặt hàng");
      setActiveStep(1);
      return;
    }
    if (!formValues.addressId) {
      setErrorMessage("Vui lòng chọn địa chỉ giao hàng trong Bước 2 trước khi đặt hàng");
      setActiveStep(2);
      return;
    }
    if (!VALID_PAYMENT_METHODS.includes(formValues.paymentMethod)) {
      setErrorMessage("Vui lòng chọn phương thức thanh toán hợp lệ trong Bước 3");
      setActiveStep(3);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      const shippingAddressStr = selectedAddress
        ? `${getAddressFullName(selectedAddress, currentUser)} - ${selectedAddress.phone || effectivePhone} - ${formatAddressDisplay(selectedAddress)}`
        : "";

      const orderItemsPayload = directCheckoutDraft?.items?.length
        ? directCheckoutDraft.items.map((item) => ({
            productId: Number(item.productId || item.product?.id || 0),
            productVariantId: Number(item.productVariantId || item.variant?.id || 0),
            quantity: Number(item.quantity || 1)
          }))
        : undefined;

      const response = await createOrder({
        shippingAddress: shippingAddressStr,
        addressId: Number(formValues.addressId),
        paymentMethod: formValues.paymentMethod,
        shippingFee: Number(formValues.shippingFee || 0),
        note: String(formValues.note || "").trim() || undefined,
        couponCode: appliedCoupon?.coupon?.code || appliedCoupon?.code || undefined,
        ...(orderItemsPayload ? { items: orderItemsPayload } : {})
      });

      const order = response?.data?.data || response?.data || response;

      // Clear local checkout storage on success
      localStorage.removeItem(STORAGE_KEYS.step);
      localStorage.removeItem(STORAGE_KEYS.addressId);
      localStorage.removeItem(STORAGE_KEYS.note);
      localStorage.removeItem(STORAGE_KEYS.addressDraft);
      sessionStorage.removeItem(STORAGE_KEYS.directDraft);
      localStorage.removeItem(STORAGE_KEYS.directDraft);
      sessionStorage.removeItem("cnm_applied_coupon");
      setDirectCheckoutDraft(null);

      window.dispatchEvent(new CustomEvent("cnm_cart_updated"));
      window.dispatchEvent(new CustomEvent("cnm_cart_changed"));

      if (formValues.paymentMethod === "VNPAY") {
        const urlRes = await createVnpayUrl(order.id, { amount: finalAmount });
        const urlData = urlRes?.data?.data || urlRes?.data || urlRes;

        if (urlData?.paymentUrl) {
          window.location.href = urlData.paymentUrl;
        } else {
          throw new Error("Lỗi VNPAY: Không lấy được paymentUrl");
        }
        return;
      }

      if (formValues.paymentMethod === "BANK_TRANSFER") {
        if (paymentProofFile) {
          try {
            await uploadPaymentReceipt(order.id, paymentProofFile);
          } catch (proofErr) {
            console.warn("Không thể tải biên lai lúc checkout, người dùng có thể tải tại Order Detail:", proofErr);
          }
        }
        navigate(routeConfig.public.orderDetail.replace(":orderId", String(order.id)), {
          replace: true,
          state: { createdOrderId: order.id, paymentMethod: formValues.paymentMethod, proofUploaded: !!paymentProofFile }
        });
        return;
      }

      // COD
      navigate("/orders", { replace: true, state: { createdOrderId: order.id, paymentMethod: formValues.paymentMethod } });
    } catch (error) {
      console.error("LỖI ĐẶT HÀNG:", error);
      const errMsg = error?.response?.data?.message || error?.message || "Đặt hàng thất bại. Vui lòng kiểm tra lại thông tin và thử lại.";
      setErrorMessage(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Not authenticated screen
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "65vh", display: "grid", placeItems: "center" }}>
        <div style={{ ...SECTION_STYLE, textAlign: "center", maxWidth: 500 }}>
          <div style={{ fontSize: 64, marginBottom: 24, padding: "20px", display: "inline-block", background: "#f1f5f9", borderRadius: "50%" }}>🔒</div>
          <h2 style={{ fontSize: 28, fontWeight: 900 }}>Yêu cầu đăng nhập</h2>
          <p style={{ color: "#64748b", margin: "16px 0 32px", fontSize: 16 }}>Bạn cần đăng nhập để thực hiện thanh toán và theo dõi siêu phẩm công nghệ.</p>
          <Link to="/login?redirect=/checkout" style={{ padding: "14px 32px", borderRadius: 16, background: "var(--market-primary)", color: "#fff", textDecoration: "none", fontWeight: 800 }}>
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={{ minHeight: "80vh", display: "grid", placeItems: "center", fontSize: 18, color: "#64748b", fontWeight: 700 }}>Đang thiết lập đơn hàng hoàn hảo...</div>;
  }

  if (items.length === 0) {
    return (
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <div style={{ ...SECTION_STYLE, textAlign: "center", maxWidth: 500 }}>
          <div style={{ fontSize: 64, marginBottom: 24, opacity: 0.3 }}>🛒</div>
          <h2 style={{ fontSize: 28, fontWeight: 900 }}>Giỏ hàng bạn siêu nhẹ</h2>
          <p style={{ color: "#64748b", margin: "16px 0 32px", fontSize: 16 }}>Chưa có linh kiện nào chờ được rước về cả.</p>
          <Link to="/products" style={{ padding: "14px 32px", borderRadius: 16, background: "var(--market-primary)", color: "#fff", textDecoration: "none", fontWeight: 800 }}>
            Khám phá linh kiện
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-outer-container" style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 20px" }}>
      {/* Toast Alert popup */}
      {toast.message && (
        <div
          className={`checkout-toast ${toast.type}`}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            padding: "16px 24px",
            borderRadius: "16px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.12)",
            fontWeight: 800,
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: toast.type === "success" ? "#ecfdf5" : toast.type === "error" ? "#fef2f2" : "#f0f9ff",
            color: toast.type === "success" ? "#047857" : toast.type === "error" ? "#b91c1c" : "#0369a1",
            border: `1.5px solid ${toast.type === "success" ? "#bbf7d0" : toast.type === "error" ? "#fecaca" : "#bae6fd"}`,
            animation: "fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
        >
          <span>{toast.type === "success" ? "🎉" : toast.type === "error" ? "❌" : "ℹ️"}</span>
          {toast.message}
        </div>
      )}

      {/* Main Title Banner */}
      <div style={{ marginBottom: 40, animation: "fadeInUp 0.4s ease both" }}>
        <h1 style={{ fontSize: 40, fontWeight: 950, letterSpacing: "-0.05em", color: "#0f172a", marginBottom: 8 }}>
          Thanh toán an toàn
        </h1>
        <p style={{ color: "#64748b", fontSize: 16, fontWeight: 600 }}>
          Tối ưu hóa hành trình mua sắm của bạn qua 4 bước bảo mật tuyệt đối.
        </p>
      </div>

      {/* Visual Step Progress Bar */}
      <div className="step-progress-container" aria-label="Tiến trình thanh toán">
        <div className="step-progress-line">
          <div className="step-progress-fill" style={{ width: `${((activeStep - 1) / 3) * 100}%` }} />
        </div>
        {[
          { step: 1, label: "Khách hàng", icon: "👤" },
          { step: 2, label: "Địa chỉ nhận", icon: "📍" },
          { step: 3, label: "Thanh toán", icon: "💳" },
          { step: 4, label: "Xác nhận", icon: "✓" }
        ].map((node) => {
          const isActive = activeStep === node.step;
          const isCompleted = activeStep > node.step;
          const isEligible =
            node.step === 1 ||
            (node.step === 2 && hasPhoneValue) ||
            (node.step === 3 && hasPhoneValue && formValues.addressId) ||
            (node.step === 4 && hasPhoneValue && formValues.addressId && formValues.paymentMethod);
          const isClickable = isCompleted || node.step <= activeStep || isEligible;
          const stateClass = isActive ? "active" : isCompleted ? "completed" : "";

          return (
            <div
              key={node.step}
              id={`step-indicator-${node.step}`}
              className={`step-node ${stateClass}`}
              style={{ cursor: isClickable ? "pointer" : "default" }}
              onClick={() => {
                if (isClickable) {
                  setActiveStep(node.step);
                }
              }}
            >
              <div className="step-circle">
                {isCompleted ? "✓" : node.icon}
              </div>
              <span className="step-label">{node.step}. {node.label}</span>
            </div>
          );
        })}
      </div>

      {/* Two Column Content */}
      <div className="checkout-layout" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 32, alignItems: "start" }}>
        {/* Step Content Side */}
        <div style={{ display: "grid", gap: 32 }}>
          {activeStep === 1 && (
            <StepCustomerInfo
              sectionStyle={SECTION_STYLE}
              inputStyle={inputStyle}
              hasPhoneValue={hasPhoneValue}
              currentFullName={currentFullName}
              currentEmail={currentEmail}
              currentPhone={currentPhone}
              phoneInput={phoneInput}
              setPhoneInput={setPhoneInput}
              setErrors={setErrors}
              errors={errors}
              hasPersistedPhone={hasPersistedPhone}
              normalizedPhoneInput={normalizedPhoneInput}
              isUpdatingPhone={isUpdatingPhone}
              handleSavePhone={handleSubmitStep1}
              handleStep1Next={handleSubmitStep1}
              handleSubmitStep1={handleSubmitStep1}
            />
          )}

          {activeStep === 2 && (
            <StepShippingAddress
              sectionStyle={SECTION_STYLE}
              inputStyle={inputStyle}
              hasPhoneValue={hasPhoneValue}
              addresses={addresses}
              showAddressForm={showAddressForm}
              defaultAddress={defaultAddress}
              selectedAddress={selectedAddress}
              currentUser={currentUser}
              effectivePhone={effectivePhone}
              formValues={formValues}
              setFormValues={setFormValues}
              handleStartEditAddress={handleStartEditAddress}
              handleOpenNewAddressForm={handleOpenNewAddressForm}
              handleDeleteAddress={handleDeleteAddress}
              editingAddressId={editingAddressId}
              handleSaveAddress={handleSaveAddress}
              newAddress={newAddress}
              setNewAddress={setNewAddress}
              errors={errors}
              handleCloseAddressForm={handleCloseAddressForm}
              isSavingAddress={isSavingAddress}
              setActiveStep={setActiveStep}
              getAddressFullName={getAddressFullName}
              formatAddressDisplay={formatAddressDisplay}
            />
          )}

          {activeStep === 3 && (
            <StepPaymentMethod
              sectionStyle={SECTION_STYLE}
              formValues={formValues}
              handlePaymentMethodChange={handlePaymentMethodChange}
              isSubmitting={isSubmitting}
              errors={errors}
              paymentMethodCards={PAYMENT_METHOD_CARDS}
              selectedPaymentOption={selectedPaymentOption}
              paymentMethodGuidance={PAYMENT_METHOD_GUIDANCE}
              bankAccountConfig={BANK_ACCOUNT_CONFIG}
              currentUser={currentUser}
              formatCurrency={formatCurrency}
              finalAmount={finalAmount}
              generateTransferNote={generateTransferNote}
              setActiveStep={setActiveStep}
              handleStep3Next={handleStep3Next}
              validPaymentMethods={VALID_PAYMENT_METHODS}
              paymentProofFile={paymentProofFile}
              onPaymentProofChange={setPaymentProofFile}
            />
          )}

          {activeStep === 4 && (
            <StepOrderConfirmation
              sectionStyle={SECTION_STYLE}
              inputStyle={inputStyle}
              currentFullName={currentFullName}
              currentEmail={currentEmail}
              currentPhone={currentPhone}
              selectedAddress={selectedAddress}
              currentUser={currentUser}
              formatAddressDisplay={formatAddressDisplay}
              getAddressFullName={getAddressFullName}
              selectedPaymentOption={selectedPaymentOption}
              formValues={formValues}
              handleChange={handleChange}
              setActiveStep={setActiveStep}
              isSubmitting={isSubmitting}
              items={items}
              handleSubmit={handleSubmit}
              errorMessage={errorMessage}
            />
          )}
        </div>

        {/* Sidebar Order Summary */}
        <CheckoutOrderSummary
          sectionStyle={SECTION_STYLE}
          items={items}
          formatCurrency={formatCurrency}
          appliedCoupon={appliedCoupon}
          setAppliedCoupon={setAppliedCoupon}
          couponInput={couponInput}
          setCouponInput={setCouponInput}
          couponLoading={couponLoading}
          setCouponLoading={setCouponLoading}
          couponError={couponError}
          setCouponError={setCouponError}
          showCouponModal={showCouponModal}
          setShowCouponModal={setShowCouponModal}
          availableCoupons={availableCoupons}
          setAvailableCoupons={setAvailableCoupons}
          loadingCoupons={loadingCoupons}
          setLoadingCoupons={setLoadingCoupons}
          totalAmount={totalAmount}
          discountAmount={discountAmount}
          finalAmount={finalAmount}
        />
      </div>
    </div>
  );
}
