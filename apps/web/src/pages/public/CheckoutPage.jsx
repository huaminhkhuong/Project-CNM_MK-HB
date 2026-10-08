import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { getCart } from "../../services/cart.service";
import { createOrder, createVnpayUrl } from "../../services/order.service";
import { getMyAddresses, createMyAddress, updateCurrentProfile, updateMyAddress, deleteMyAddress } from "../../services/auth.service";
import { BANK_ACCOUNT_CONFIG, generateTransferNote } from "../../config/bank-account";
import { routeConfig } from "../../routes/routeConfig";

const ICON_SIZE = 18;

// SVG Icons
const UserIcon = () => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const MapPinIcon = () => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
);

const CreditCardIcon = () => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const CashIcon = () => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <circle cx="12" cy="12" r="3" />
    <path d="M6 9v.01M18 15v.01" />
  </svg>
);

const ShieldCardIcon = () => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-5" />
  </svg>
);

const QrIcon = () => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="6" height="6" rx="1" />
    <rect x="15" y="3" width="6" height="6" rx="1" />
    <rect x="3" y="15" width="6" height="6" rx="1" />
    <path d="M15 15h2v2h-2zM19 15h2M15 19h6M11 3v6M3 11h6M11 15v6" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="checkout-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

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

const PAYMENT_METHOD_OPTIONS = [
  { value: "COD", label: "Thanh toán khi nhận hàng (COD)" },
  { value: "VNPAY", label: "Chuyển khoản trực tuyến (VNPAY)" },
  { value: "BANK_TRANSFER", label: "Chuyển khoản ngân hàng (QR Code)" }
];

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
    const raw = sessionStorage.getItem(STORAGE_KEYS.directDraft);
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
    paymentMethod: localStorage.getItem(STORAGE_KEYS.paymentMethod) || "",
    shippingFee: "0",
    note: localStorage.getItem(STORAGE_KEYS.note) || ""
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
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
      refreshProfile().then(updatedUser => {
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
      setNewAddress(prev => ({
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
  const shippingFee = Number(formValues.shippingFee || 0);
  const finalAmount = useMemo(() => totalAmount + shippingFee, [shippingFee, totalAmount]);
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
          const isValidStored = addrData.some(a => String(a.id) === storedAddrId);
          if (isValidStored) {
            setFormValues(prev => ({ ...prev, addressId: storedAddrId }));
          } else {
            setFormValues(prev => ({ ...prev, addressId: String(addrData[0].id) }));
          }
        }
      } catch (error) {
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

  // Handle step 1 profile update
  async function handleSavePhone(e) {
    e.preventDefault();
    if (!phoneInput.trim()) {
      setErrors({ phone: "Vui lòng nhập số điện thoại" });
      return;
    }
    if (!validatePhone(phoneInput)) {
      setErrors({ phone: "Số điện thoại Việt Nam không hợp lệ (9-10 chữ số)" });
      return;
    }

    try {
      setIsUpdatingPhone(true);
      setErrors({});
      
      await updateCurrentProfile({
        full_name: currentFullName,
        phone: phoneInput.trim()
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
  }

  function handleStep1Next() {
    if (!hasPhoneValue) {
      setErrors({ phone: "Vui lòng cập nhật số điện thoại để tiếp tục giao hàng" });
      return;
    }
    setActiveStep(2);
  }

  // Handle changes in notes
  function handleChange(event) {
    const { name, value } = event.target;
    setFormValues(p => ({ ...p, [name]: value }));
    setErrors(p => ({ ...p, [name]: "" }));
  }

  function handlePaymentMethodChange(value) {
    if (isSubmitting || !VALID_PAYMENT_METHODS.includes(value)) return;
    setFormValues(p => ({ ...p, paymentMethod: value }));
    setErrors(p => ({ ...p, paymentMethod: "" }));
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
      setErrors(p => ({ ...p, addr_fullName: "Vui lòng nhập họ tên" }));
      return;
    }
    if (!newAddress.phone.trim() || !validatePhone(newAddress.phone)) {
      setErrors(p => ({ ...p, addr_phone: "Số điện thoại nhận hàng không hợp lệ" }));
      return;
    }
    if (!newAddress.province.trim() || !newAddress.district.trim() || !newAddress.ward.trim() || !newAddress.address_line.trim()) {
      setErrors(p => ({ ...p, addr_line: "Vui lòng cung cấp đầy đủ thông tin địa chỉ" }));
      return;
    }

    try {
      setIsSavingAddress(true);
      setErrorMessage("");
      setErrors({});

      if (editingAddressId) {
        // Edit address logic
        const res = await updateMyAddress(editingAddressId, {
          fullName: newAddress.full_name,
          phone: newAddress.phone,
          province: newAddress.province,
          district: newAddress.district,
          ward: newAddress.ward,
          addressLine: newAddress.address_line
        });
        const updatedDetails = res?.data || res;
        
        setAddresses(prev => prev.map(a => a.id === editingAddressId ? { ...a, ...updatedDetails } : a));
        setFormValues(prev => ({ ...prev, addressId: String(editingAddressId) }));
        setToast({ type: "success", message: "Cập nhật địa chỉ thành công!" });
      } else {
        // Create address logic
        const res = await createMyAddress(newAddress);
        const createdDetails = res?.data?.data || res.data || res;
        
        setAddresses(prev => [createdDetails, ...prev]);
        setFormValues(prev => ({ ...prev, addressId: String(createdDetails.id) }));
        setToast({ type: "success", message: "Đã thêm địa chỉ giao hàng mới thành công!" });
      }

      setShowAddressForm(false);
      setEditingAddressId(null);
      localStorage.removeItem(STORAGE_KEYS.addressDraft);
      setNewAddress({
        ...EMPTY_ADDRESS,
        full_name: currentFullName,
        phone: currentPhone
      });
    } catch(error) {
      setToast({ type: "error", message: axios.isAxiosError(error) ? (error.response?.data?.message || "Lỗi lưu địa chỉ") : error.message });
    } finally {
      setIsSavingAddress(false);
    }
  }

  // Load address into edit form
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
    // Smooth scroll to form
    setTimeout(() => {
      document.getElementById("address-form-section")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  // Delete address
  async function handleDeleteAddress(addressId, e) {
    e.stopPropagation();
    if (!window.confirm("Bạn có chắc chắn muốn xóa địa chỉ này?")) return;

    try {
      setToast({ type: "info", message: "Đang xóa địa chỉ..." });
      await deleteMyAddress(addressId);
      setAddresses(prev => prev.filter(a => a.id !== addressId));
      if (formValues.addressId === String(addressId)) {
        setFormValues(p => ({ ...p, addressId: "" }));
      }
      setToast({ type: "success", message: "Xóa địa chỉ thành công!" });
    } catch (err) {
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

  // Handle Order Submit (preserving existing payment flow logic)
  async function handleSubmit(event) {
    event.preventDefault();
    
    // Final check validations
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
        ...(orderItemsPayload ? { items: orderItemsPayload } : {})
      });

      const order = response?.data?.data || response?.data || response;

      // Clear local checkout storage on success
      localStorage.removeItem(STORAGE_KEYS.step);
      localStorage.removeItem(STORAGE_KEYS.addressId);
      localStorage.removeItem(STORAGE_KEYS.note);
      localStorage.removeItem(STORAGE_KEYS.addressDraft);
      sessionStorage.removeItem(STORAGE_KEYS.directDraft);
      setDirectCheckoutDraft(null);

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
        navigate(routeConfig.public.orderDetail.replace(":orderId", String(order.id)), {
          replace: true,
          state: { createdOrderId: order.id, paymentMethod: formValues.paymentMethod }
        });
        return;
      }

      // COD
      navigate("/orders", { replace: true, state: { createdOrderId: order.id, paymentMethod: formValues.paymentMethod } });
    } catch (error) {
      console.error("LỖI ĐẶT HÀNG:", error);
      let errMsg = error?.response?.data?.message || error?.message || "Đặt hàng thất bại. Vui lòng kiểm tra lại thông tin và thử lại.";
      setErrorMessage(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Not authenticated screen
  if (!isAuthenticated) return (
    <div style={{ minHeight: "65vh", display: "grid", placeItems: "center" }}>
        <div style={{...SECTION_STYLE, textAlign: 'center', maxWidth: 500}}>
            <div style={{ fontSize: 64, marginBottom: 24, padding: "20px", display: "inline-block", background: "#f1f5f9", borderRadius: "50%" }}>🔒</div>
            <h2 style={{ fontSize: 28, fontWeight: 900 }}>Yêu cầu đăng nhập</h2>
            <p style={{ color: "#64748b", margin: "16px 0 32px", fontSize: 16 }}>Bạn cần đăng nhập để thực hiện thanh toán và theo dõi siêu phẩm công nghệ.</p>
            <Link to="/login" style={{ padding: "14px 32px", borderRadius: 16, background: "var(--market-primary)", color: "#fff", textDecoration: "none", fontWeight: 800 }}>Đăng nhập ngay</Link>
        </div>
    </div>
  );

  if (loading) return <div style={{ minHeight: "80vh", display: "grid", placeItems: "center", fontSize: 18, color: "#64748b", fontWeight: 700 }}>Đang thiết lập đơn hàng hoàn hảo...</div>;

  if (items.length === 0) return (
     <div style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
         <div style={{...SECTION_STYLE, textAlign: 'center', maxWidth: 500}}>
             <div style={{ fontSize: 64, marginBottom: 24, opacity: 0.3 }}>🛒</div>
             <h2 style={{ fontSize: 28, fontWeight: 900 }}>Giỏ hàng bạn siêu nhẹ</h2>
             <p style={{ color: "#64748b", margin: "16px 0 32px", fontSize: 16 }}>Chưa có linh kiện nào chờ được rước về cả.</p>
             <Link to="/products" style={{ padding: "14px 32px", borderRadius: 16, background: "var(--market-primary)", color: "#fff", textDecoration: "none", fontWeight: 800 }}>Khám phá linh kiện</Link>
         </div>
     </div>
  );

  return (
    <div className="checkout-outer-container" style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 20px" }}>
      {/* Toast Alert popup */}
      {toast.message && (
        <div className={`checkout-toast ${toast.type}`} style={{
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
        }}>
          <span>{toast.type === "success" ? "🎉" : toast.type === "error" ? "❌" : "ℹ️"}</span>
          {toast.message}
        </div>
      )}

      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        
        .checkout-outer-container {
          font-family: 'Outfit', 'Inter', sans-serif;
        }

        /* Step Progress Bar Styles */
        .step-progress-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
          background: rgba(255,255,255,0.7);
          backdrop-filter: blur(20px);
          padding: 24px 32px;
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.6);
          box-shadow: 0 10px 30px rgba(0,0,0,0.02);
          margin-bottom: 32px;
        }
        .step-progress-line {
          position: absolute;
          top: 50%;
          left: 60px;
          right: 60px;
          height: 4px;
          background: #e2e8f0;
          z-index: 1;
          transform: translateY(-50%);
        }
        .step-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--market-primary), #3b82f6);
          transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .step-node {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          min-width: 100px;
        }
        .step-circle {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #fff;
          border: 3px solid #cbd5e1;
          display: grid;
          place-items: center;
          font-weight: 800;
          color: #64748b;
          font-size: 15px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 10px rgba(0,0,0,0.03);
        }
        .step-node.active .step-circle {
          border-color: var(--market-primary);
          background: var(--market-primary);
          color: #fff;
          box-shadow: 0 0 0 5px rgba(37,99,235,0.18), 0 8px 20px rgba(37,99,235,0.2);
          transform: scale(1.1);
        }
        .step-node.completed .step-circle {
          border-color: #10b981;
          background: #10b981;
          color: #fff;
          box-shadow: 0 4px 12px rgba(16,185,129,0.15);
        }
        .step-label {
          font-size: 13.5px;
          font-weight: 800;
          color: #64748b;
          transition: color 0.3s ease;
          text-align: center;
        }
        .step-node.active .step-label {
          color: #0f172a;
          font-weight: 900;
        }
        .step-node.completed .step-label {
          color: #10b981;
        }

        .responsive-two-cols {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .responsive-three-cols {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        /* Warnings & Alerts */
        .alert-gentle {
          background: #fffbeb;
          border: 1.5px solid #fde68a;
          border-radius: 20px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #b45309;
          font-weight: 700;
          font-size: 14.5px;
          margin-bottom: 24px;
          animation: fadeInUp 0.4s ease;
        }
        
        /* Address Card Styling */
        .address-grid-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }
        .address-card {
          cursor: pointer;
          border: 2px solid #e2e8f0;
          background: #fff;
          border-radius: 24px;
          padding: 24px;
          position: relative;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 10px rgba(0,0,0,0.01);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 170px;
        }
        .address-card:hover {
          transform: translateY(-3px);
          border-color: #cbd5e1;
          box-shadow: 0 16px 36px rgba(15,23,42,0.05);
        }
        .address-card.selected {
          border-color: #3b82f6;
          background: rgba(59, 130, 246, 0.02);
          box-shadow: 0 18px 40px rgba(37,99,235,0.08);
          transform: translateY(-3px);
        }
        .address-card__actions {
          display: flex;
          gap: 10px;
          margin-top: 18px;
          padding-top: 14px;
          border-top: 1px solid #f1f5f9;
        }
        .address-card__btn {
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 13px;
          font-weight: 800;
          padding: 6px 12px;
          border-radius: 10px;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .address-card__btn-select {
          background: rgba(37,99,235,0.1);
          color: var(--market-primary);
        }
        .address-card__btn-select:hover {
          background: var(--market-primary);
          color: #fff;
        }
        .address-card__btn-edit {
          background: #f1f5f9;
          color: #475569;
        }
        .address-card__btn-edit:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .address-card__btn-delete {
          background: #fef2f2;
          color: #ef4444;
        }
        .address-card__btn-delete:hover {
          background: #fee2e2;
        }

        .payment-method-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }
        .payment-method-card {
          position: relative;
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 16px;
          align-items: flex-start;
          padding: 22px 20px;
          border-radius: 24px;
          border: 1.5px solid #dbe4ef;
          background: linear-gradient(180deg, #ffffff, #f8fafc);
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.04);
          min-height: 164px;
        }
        .payment-method-card:hover {
          border-color: rgba(37, 99, 235, 0.35);
          box-shadow: 0 16px 36px rgba(37, 99, 235, 0.08);
          transform: translateY(-2px);
        }
        .payment-method-card.selected {
          border-color: var(--payment-tone);
          background: linear-gradient(135deg, rgba(255,255,255,0.98), color-mix(in srgb, var(--payment-tone) 10%, white));
          box-shadow: 0 18px 42px color-mix(in srgb, var(--payment-tone) 22%, transparent);
        }
        .payment-method-card.disabled {
          opacity: 0.72;
          cursor: not-allowed;
        }
        .payment-method-card input {
          position: absolute;
          inset: 0;
          opacity: 0;
          pointer-events: none;
        }
        .payment-method-card__icon {
          width: 56px;
          height: 56px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: color-mix(in srgb, var(--payment-tone) 14%, white);
          color: var(--payment-tone);
          flex-shrink: 0;
        }
        .payment-method-card__icon svg {
          width: 24px;
          height: 24px;
        }
        .payment-method-card__content {
          display: grid;
          gap: 10px;
          min-width: 0;
        }
        .payment-method-card__head {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .payment-method-card__head strong {
          font-size: 16px;
          line-height: 1.35;
          color: #0f172a;
        }
        .payment-method-card__head span {
          width: fit-content;
          padding: 6px 10px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--payment-tone) 12%, white);
          color: var(--payment-tone);
          font-size: 11px;
          font-weight: 900;
        }
        .payment-method-card__content small {
          color: #64748b;
          font-size: 13px;
          line-height: 1.55;
        }
        .payment-method-card__check {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          border: 1.5px solid #cbd5e1;
          display: grid;
          place-items: center;
          color: transparent;
          background: #fff;
          font-size: 15px;
          font-weight: 900;
          transition: all 0.25s ease;
          margin-left: auto;
        }
        .payment-method-card.selected .payment-method-card__check {
          border-color: var(--payment-tone);
          background: var(--payment-tone);
          color: #fff;
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--payment-tone) 18%, transparent);
        }
        .payment-method-guidance {
          padding: 18px 20px;
          border-radius: 20px;
          border: 1px solid rgba(37, 99, 235, 0.14);
          background: linear-gradient(135deg, rgba(239, 246, 255, 0.95), rgba(248, 250, 252, 0.95));
          color: #1e3a8a;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.6;
        }
        .payment-method-guidance strong {
          display: block;
          margin-bottom: 6px;
          color: #0f172a;
          font-size: 15px;
        }
        .field-error-inline {
          color: #dc2626;
          font-size: 13px;
          font-weight: 800;
          margin-top: 10px;
        }

        /* Buttons & Actions */
        .step-actions-footer {
          display: flex;
          justify-content: space-between;
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid #f1f5f9;
        }
        .btn-premium {
          height: 52px;
          padding: 0 28px;
          border-radius: 16px;
          font-weight: 900;
          font-size: 15px;
          border: none;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .btn-premium-primary {
          background: linear-gradient(135deg, var(--market-primary), #1e40af);
          color: #fff;
          box-shadow: 0 10px 24px rgba(37,99,235,0.2);
        }
        .btn-premium-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 15px 30px rgba(37,99,235,0.3);
        }
        .btn-premium-secondary {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }
        .btn-premium-secondary:hover:not(:disabled) {
          background: #e2e8f0;
          color: #0f172a;
        }
        .btn-premium:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }

        /* Sidebar Styling */
        .sidebar-product-item {
          display: flex;
          gap: 16px;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #f8fafc;
        }
        .sidebar-product-item:last-child {
          border-bottom: none;
        }
        .trust-badge-container {
          background: rgba(255, 255, 255, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.8);
          border-radius: 20px;
          padding: 18px;
          margin-top: 20px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.015);
        }
        .trust-badge-line {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          font-size: 13px;
        }
        .trust-badge-line:last-child {
          margin-bottom: 0;
        }
        .trust-badge-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(37, 99, 235, 0.08);
          color: var(--market-primary);
          display: grid;
          place-items: center;
          font-weight: 800;
          flex-shrink: 0;
        }

        @media (max-width: 1100px) {
          .checkout-layout {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 768px) {
          .address-grid-list {
            grid-template-columns: 1fr;
          }
          .payment-method-grid {
            grid-template-columns: 1fr;
          }
          .responsive-two-cols,
          .responsive-three-cols {
            grid-template-columns: 1fr;
          }
          .step-progress-container {
            padding: 16px;
          }
          .step-label {
            font-size: 11px;
          }
          .checkout-outer-container {
            padding: 24px 14px;
          }
        }
      `}</style>

      {/* Main Title Banner */}
      <div style={{ marginBottom: 40, animation: "fadeInUp 0.4s ease both" }}>
        <h1 style={{ fontSize: 40, fontWeight: 950, letterSpacing: "-0.05em", color: "#0f172a", marginBottom: 8 }}>Thanh toán an toàn</h1>
        <p style={{ color: "#64748b", fontSize: 16, fontWeight: 600 }}>Tối ưu hóa hành trình mua sắm của bạn qua 4 bước bảo mật tuyệt đối.</p>
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
          const stateClass = isActive ? "active" : isCompleted ? "completed" : "";
          
          return (
            <div 
              key={node.step} 
              className={`step-node ${stateClass}`} 
              onClick={() => {
                // Allow navigating back to completed steps
                if (isCompleted || node.step < activeStep) {
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

          {/* STEP 1: CUSTOMER INFO */}
          {activeStep === 1 && (
            <section style={{ ...SECTION_STYLE, animationDelay: "0.1s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ background: "rgba(37, 99, 235, 0.1)", color: "var(--market-primary)", width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center" }}><UserIcon /></div>
                <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: "#1e293b" }}>Bước 1: Thông tin khách hàng</h2>
              </div>

              {!hasPhoneValue && (
                <div className="alert-gentle">
                  <span>⚠️</span>
                  <div><strong>Thiếu số điện thoại.</strong> Vui lòng bổ sung số điện thoại để giao hàng nhanh hơn và kích hoạt bảo hành điện tử chính xác.</div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
                {[
                  { label: "Họ và tên", value: currentFullName || "Tài khoản PC Mall" },
                  { label: "Email", value: currentEmail || "Chưa có email" },
                  { label: "Trạng thái", value: hasPhoneValue ? "Đã đủ thông tin giao hàng" : "Cần bổ sung số điện thoại" }
                ].map((item) => (
                  <div key={item.label} style={{ padding: 18, borderRadius: 20, border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 6 }}>{item.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", lineHeight: 1.5 }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSavePhone} style={{ display: "grid", gap: 20 }}>
                <div>
                  <label style={{ fontSize: 13, color: "#64748b", fontWeight: 800, display: "block", marginBottom: 8, paddingLeft: 4 }}>Số điện thoại người mua</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={phoneInput}
                      onChange={(e) => {
                        setPhoneInput(e.target.value);
                        setErrors({});
                      }}
                      placeholder="Ví dụ: 0901234567"
                      style={inputStyle}
                    />
                    {hasPersistedPhone && normalizedPhoneInput !== currentPhone && (
                      <span style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", fontSize: "11px", background: "rgba(37,99,235,0.08)", color: "var(--market-primary)", padding: "4px 8px", borderRadius: "8px", fontWeight: 800 }}>Đã thay đổi</span>
                    )}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, color: "#64748b", fontWeight: 600 }}>
                    Số điện thoại này sẽ được tự động dùng cho người nhận nếu bạn chưa lưu địa chỉ giao hàng.
                  </div>
                  {errors.phone && <div style={{ color: "#ef4444", fontSize: 13, fontWeight: 800, marginTop: 6 }}>⚠ {errors.phone}</div>}
                </div>

                <div className="step-actions-footer" style={{ justifyContent: "flex-end" }}>
                  {(!hasPersistedPhone || normalizedPhoneInput !== currentPhone) ? (
                    <button type="submit" disabled={isUpdatingPhone} className="btn-premium btn-premium-primary">
                      {isUpdatingPhone ? "Đang lưu..." : "Lưu và tiếp tục"} →
                    </button>
                  ) : (
                    <button type="button" onClick={handleStep1Next} className="btn-premium btn-premium-primary">
                      Tiếp tục sang địa chỉ →
                    </button>
                  )}
                </div>
              </form>
            </section>
          )}

          {/* STEP 2: SHIPPING ADDRESS */}
          {activeStep === 2 && (
            <section style={{ ...SECTION_STYLE, animationDelay: "0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981", width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center" }}><MapPinIcon /></div>
                <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: "#1e293b" }}>Bước 2: Địa chỉ giao hàng</h2>
              </div>

              {(!hasPhoneValue || addresses.length === 0) && (
                <div className="alert-gentle" style={{ marginBottom: 20 }}>
                  <span>ℹ️</span>
                  <div>
                    {!hasPhoneValue
                      ? "Vui lòng bổ sung số điện thoại để giao hàng nhanh hơn."
                      : "Bạn chưa có địa chỉ giao hàng đã lưu. Hãy thêm địa chỉ để tiếp tục đặt hàng."}
                  </div>
                </div>
              )}

              {!showAddressForm && defaultAddress && (
                <div style={{ marginBottom: 20, padding: 20, borderRadius: 24, border: "1px solid rgba(37,99,235,0.14)", background: "linear-gradient(135deg, rgba(239,246,255,0.95), rgba(248,250,252,0.95))" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 900, color: "#1d4ed8", background: "rgba(37,99,235,0.12)", padding: "5px 10px", borderRadius: 999 }}>ĐỊA CHỈ ĐÃ LƯU</span>
                        {selectedAddress && (
                          <span style={{ fontSize: 11, fontWeight: 900, color: "#047857", background: "rgba(16,185,129,0.12)", padding: "5px 10px", borderRadius: 999 }}>ĐANG CHỌN</span>
                        )}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>{getAddressFullName(defaultAddress, currentUser)}</div>
                      <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, marginBottom: 6 }}>{formatAddressDisplay(defaultAddress)}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}>Số điện thoại: {defaultAddress.phone || effectivePhone || "Vui lòng cập nhật"}</div>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="address-card__btn address-card__btn-select"
                        onClick={() => setFormValues((prev) => ({ ...prev, addressId: String(defaultAddress.id) }))}
                      >
                        Dùng địa chỉ này
                      </button>
                      <button
                        type="button"
                        className="address-card__btn address-card__btn-edit"
                        onClick={(e) => handleStartEditAddress(defaultAddress, e)}
                      >
                        Chỉnh sửa
                      </button>
                      <button
                        type="button"
                        className="address-card__btn address-card__btn-edit"
                        onClick={handleOpenNewAddressForm}
                      >
                        Thêm địa chỉ mới
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!showAddressForm && addresses.length > 0 && (
                <div style={{ display: "grid", gap: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#475569" }}>Danh sách địa chỉ của bạn</h3>
                  <div className="address-grid-list">
                    {addresses.map((addr) => {
                      const isSelected = formValues.addressId === String(addr.id);
                      return (
                        <div
                          key={addr.id}
                          onClick={() => setFormValues((prev) => ({ ...prev, addressId: String(addr.id) }))}
                          className={`address-card ${isSelected ? "selected" : ""}`}
                        >
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 12 }}>
                              <strong style={{ fontSize: 16, color: "#0f172a" }}>{getAddressFullName(addr, currentUser)}</strong>
                              {isSelected && <span style={{ background: "rgba(37,99,235,0.1)", color: "var(--market-primary)", fontSize: "10px", padding: "2px 8px", borderRadius: "8px", fontWeight: 800 }}>Đang chọn</span>}
                            </div>
                            <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, marginBottom: 6 }}>
                              📍 {formatAddressDisplay(addr)}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>
                              📞 {addr.phone || effectivePhone || "Vui lòng cập nhật"}
                            </div>
                          </div>

                          <div className="address-card__actions">
                            <button
                              type="button"
                              className="address-card__btn address-card__btn-select"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFormValues((prev) => ({ ...prev, addressId: String(addr.id) }));
                              }}
                            >
                              {isSelected ? "Đang sử dụng" : "Dùng địa chỉ này"}
                            </button>
                            <button
                              type="button"
                              className="address-card__btn address-card__btn-edit"
                              onClick={(e) => handleStartEditAddress(addr, e)}
                            >
                              Chỉnh sửa
                            </button>
                            <button
                              type="button"
                              className="address-card__btn address-card__btn-delete"
                              onClick={(e) => handleDeleteAddress(addr.id, e)}
                            >
                              Xóa
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenNewAddressForm}
                    style={{
                      textAlign: "center",
                      width: "100%",
                      padding: "16px",
                      borderRadius: 16,
                      border: "1.5px dashed var(--market-primary)",
                      color: "var(--market-primary)",
                      background: "rgba(37,99,235,0.02)",
                      fontWeight: 800,
                      cursor: "pointer",
                      fontSize: 15,
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(37,99,235,0.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(37,99,235,0.02)"; }}
                  >
                    + Thêm địa chỉ giao hàng mới
                  </button>
                </div>
              )}

              {(showAddressForm || addresses.length === 0) && (
                <div id="address-form-section" style={{ background: "rgba(248, 250, 252, 0.6)", padding: 24, borderRadius: 24, border: "1px dashed #cbd5e1" }}>
                  <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 900, color: "#1e293b" }}>
                    {editingAddressId ? "Chỉnh sửa địa chỉ nhận hàng" : "Thêm địa chỉ giao hàng mới"}
                  </h3>
                  <form onSubmit={handleSaveAddress} style={{ display: "grid", gap: 16 }}>
                    <div className="responsive-two-cols">
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 800, color: "#475569", display: "block", marginBottom: 6 }}>Họ tên người nhận</label>
                        <input required placeholder="Ví dụ: Nguyễn Văn A" value={newAddress.full_name} onChange={(e) => setNewAddress((p) => ({ ...p, full_name: e.target.value }))} style={{ ...inputStyle, padding: "12px 16px" }} />
                        {errors.addr_fullName && <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 700 }}>{errors.addr_fullName}</span>}
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 800, color: "#475569", display: "block", marginBottom: 6 }}>Số điện thoại nhận hàng</label>
                        <input required placeholder="Ví dụ: 0901234567" value={newAddress.phone} onChange={(e) => setNewAddress((p) => ({ ...p, phone: e.target.value }))} style={{ ...inputStyle, padding: "12px 16px" }} />
                        {errors.addr_phone && <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 700 }}>{errors.addr_phone}</span>}
                      </div>
                    </div>

                    <div className="responsive-three-cols">
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 800, color: "#475569", display: "block", marginBottom: 6 }}>Tỉnh / Thành phố</label>
                        <input required placeholder="Hồ Chí Minh, Hà Nội..." value={newAddress.province} onChange={(e) => setNewAddress((p) => ({ ...p, province: e.target.value }))} style={{ ...inputStyle, padding: "12px 16px" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 800, color: "#475569", display: "block", marginBottom: 6 }}>Quận / Huyện</label>
                        <input required placeholder="Quận 1, Cầu Giấy..." value={newAddress.district} onChange={(e) => setNewAddress((p) => ({ ...p, district: e.target.value }))} style={{ ...inputStyle, padding: "12px 16px" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 800, color: "#475569", display: "block", marginBottom: 6 }}>Phường / Xã</label>
                        <input required placeholder="Phường Bến Nghé..." value={newAddress.ward} onChange={(e) => setNewAddress((p) => ({ ...p, ward: e.target.value }))} style={{ ...inputStyle, padding: "12px 16px" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 800, color: "#475569", display: "block", marginBottom: 6 }}>Địa chỉ cụ thể</label>
                      <input required placeholder="Số nhà, tên đường, tòa nhà..." value={newAddress.address_line} onChange={(e) => setNewAddress((p) => ({ ...p, address_line: e.target.value }))} style={{ ...inputStyle, padding: "12px 16px" }} />
                      {errors.addr_line && <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 700, marginTop: 4 }}>{errors.addr_line}</div>}
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 800, color: "#475569", display: "block", marginBottom: 6 }}>Ghi chú giao hàng</label>
                      <textarea
                        rows={3}
                        value={formValues.note}
                        onChange={(e) => setFormValues((prev) => ({ ...prev, note: e.target.value }))}
                        placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi đến..."
                        style={{ ...inputStyle, resize: "none", padding: "12px 16px" }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 12 }}>
                      {addresses.length > 0 && (
                        <button
                          type="button"
                          onClick={handleCloseAddressForm}
                          style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: "#e2e8f0", fontWeight: 800, cursor: "pointer" }}
                        >
                          Hủy
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={isSavingAddress}
                        style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: "var(--market-primary)", color: "#fff", fontWeight: 800, cursor: isSavingAddress ? "not-allowed" : "pointer" }}
                      >
                        {isSavingAddress ? "Đang lưu..." : editingAddressId ? "Cập nhật địa chỉ" : "Lưu địa chỉ và chọn"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="step-actions-footer">
                <button type="button" onClick={() => setActiveStep(1)} className="btn-premium btn-premium-secondary">
                  ← Quay lại bước 1
                </button>
                {addresses.length > 0 && !showAddressForm && (
                  <button
                    type="button"
                    disabled={!formValues.addressId}
                    onClick={() => setActiveStep(3)}
                    className="btn-premium btn-premium-primary"
                  >
                    Tiếp tục bước 3 →
                  </button>
                )}
              </div>
            </section>
          )}
          {/* STEP 3: PAYMENT METHOD */}
          {activeStep === 3 && (
            <section style={{ ...SECTION_STYLE, animationDelay: "0.2s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center" }}><CreditCardIcon /></div>
                <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: "#1e293b" }}>Bước 3: Phương thức thanh toán</h2>
              </div>

              <div style={{ display: "grid", gap: 20 }}>
                <div>
                  <label style={{ fontSize: 13, color: "#64748b", fontWeight: 800, display: "block", marginBottom: 12, paddingLeft: 4 }}>
                    Chọn phương thức thanh toán phù hợp với bạn:
                  </label>
                  <div className="payment-method-grid" role="radiogroup" aria-label="Phương thức thanh toán">
                    {PAYMENT_METHOD_CARDS.map((option) => {
                      const Icon = option.icon;
                      const selected = formValues.paymentMethod === option.value;

                      return (
                        <label
                          key={option.value}
                          className={`payment-method-card ${selected ? "selected" : ""} ${isSubmitting ? "disabled" : ""}`}
                          style={{ "--payment-tone": option.tone }}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={option.value}
                            checked={selected}
                            disabled={isSubmitting}
                            onChange={() => handlePaymentMethodChange(option.value)}
                          />
                          <span className="payment-method-card__icon"><Icon /></span>
                          <span className="payment-method-card__content">
                            <span className="payment-method-card__head">
                              <strong>{option.label}</strong>
                              <span>{option.badge}</span>
                            </span>
                            <small>{option.description}</small>
                          </span>
                          <span className="payment-method-card__check" aria-hidden="true">{selected ? "✓" : ""}</span>
                        </label>
                      );
                    })}
                  </div>
                  {errors.paymentMethod && <div className="field-error-inline">{errors.paymentMethod}</div>}
                </div>

                {selectedPaymentOption && (
                  <div className="payment-method-guidance">
                    <strong>Hướng dẫn thanh toán</strong>
                    {PAYMENT_METHOD_GUIDANCE[selectedPaymentOption.value]}
                  </div>
                )}

                {formValues.paymentMethod === "BANK_TRANSFER" && (
                  <div style={{ padding: 24, background: "rgba(37, 99, 235, 0.04)", borderRadius: 20, border: "2px dashed rgba(37, 99, 235, 0.3)", animation: "fadeInUp 0.4s ease" }}>
                    <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 280 }}>
                        <h3 style={{ fontSize: 17, fontWeight: 900, marginBottom: 16, color: "#1e293b" }}>Thông tin tài khoản nhận</h3>
                        <div style={{ display: "grid", gap: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                            <span style={{ color: "#64748b", fontWeight: 700, fontSize: "13px" }}>Ngân hàng:</span>
                            <span style={{ fontWeight: 800, color: "#1e293b", fontSize: "13px" }}>{BANK_ACCOUNT_CONFIG.bankName}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                            <span style={{ color: "#64748b", fontWeight: 700, fontSize: "13px" }}>Số tài khoản:</span>
                            <span style={{ fontWeight: 800, color: "var(--market-primary)", fontSize: "15px" }}>{BANK_ACCOUNT_CONFIG.accountNumber}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                            <span style={{ color: "#64748b", fontWeight: 700, fontSize: "13px" }}>Chủ tài khoản:</span>
                            <span style={{ fontWeight: 800, color: "#1e293b", fontSize: "13px" }}>{BANK_ACCOUNT_CONFIG.accountHolder}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                            <span style={{ color: "#64748b", fontWeight: 700, fontSize: "13px" }}>Số tiền chuyển:</span>
                            <span style={{ fontWeight: 900, color: "var(--market-primary)", fontSize: "15px" }}>{formatCurrency(finalAmount)} đ</span>
                          </div>
                          <div style={{ padding: "12px", background: "#fffbeb", borderRadius: 12, border: "1px solid #fef3c7", fontSize: "12.5px", fontWeight: 700, color: "#b45309" }}>
                            💡 Cú pháp: {generateTransferNote(currentUser?.phone || "SĐT của bạn")}
                          </div>
                        </div>
                      </div>
                      <div style={{ width: 160, margin: "0 auto" }}>
                        <div style={{ background: "#fff", padding: 12, borderRadius: 16, border: "1px solid #e2e8f0", textAlign: "center" }}>
                          <div style={{ width: 130, height: 130, background: "#f8fafc", margin: "0 auto", display: "grid", placeItems: "center", borderRadius: 10, border: "1px dashed #cbd5e1", overflow: "hidden" }}>
                            <img
                              src={BANK_ACCOUNT_CONFIG.qrCodeImage}
                              alt="QR Code"
                              style={{ width: "100%", height: "100%", objectFit: "contain" }}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                e.currentTarget.parentElement.innerHTML = `
                                  <div style="text-align: center">
                                    <div style="font-size: 40px; margin-bottom: 4px">📱</div>
                                    <div style="font-size: 10px; font-weight: 800; color: #64748b">QR CODE</div>
                                  </div>
                                `;
                              }}
                            />
                          </div>
                          <div style={{ marginTop: 8, fontSize: "11px", fontWeight: 750, color: "#64748b" }}>Quét mã chuyển nhanh</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="step-actions-footer">
                <button type="button" onClick={() => setActiveStep(2)} className="btn-premium btn-premium-secondary">
                  ← Quay lại bước 2
                </button>
                <button
                  type="button"
                  onClick={handleStep3Next}
                  disabled={!VALID_PAYMENT_METHODS.includes(formValues.paymentMethod)}
                  className="btn-premium btn-premium-primary"
                >
                  Tiếp tục bước 4 →
                </button>
              </div>
            </section>
          )}
          {/* STEP 4: CONFIRM & ORDER */}
          {activeStep === 4 && (
            <section style={{...SECTION_STYLE, animationDelay: "0.25s"}}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981", width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center" }}>🛡️</div>
                  <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: "#1e293b" }}>Bước 4: Xác nhận thông tin đơn hàng</h2>
              </div>

              {/* Info summary table for user review */}
              <div style={{ display: "grid", gap: 20, background: "#f8fafc", padding: 24, borderRadius: 24, border: "1px solid #e2e8f0", marginBottom: 24 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#1e293b" }}>Kiểm tra kỹ trước khi thanh toán:</h3>
                
                <div style={{ display: "grid", gap: 12, fontSize: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 10 }}>
                    <span style={{ color: "#64748b", fontWeight: 700 }}>Khách hàng mua:</span>
                    <strong style={{ color: "#0f172a" }}>{currentFullName} ({currentEmail})</strong>
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 10 }}>
                    <span style={{ color: "#64748b", fontWeight: 700 }}>Người nhận & SĐT:</span>
                    <strong style={{ color: "#0f172a" }}>
                      {getAddressFullName(selectedAddress, currentUser)}
                      {" - "}{selectedAddress?.phone || currentPhone}
                    </strong>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 10 }}>
                    <span style={{ color: "#64748b", fontWeight: 700 }}>Địa chỉ giao hàng:</span>
                    <span style={{ color: "#334155", fontWeight: 650 }}>
                      {selectedAddress ? formatAddressDisplay(selectedAddress) : "Chưa cấu hình địa chỉ"}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, paddingBottom: 6 }}>
                    <span style={{ color: "#64748b", fontWeight: 700 }}>Thanh toán qua:</span>
                    <span style={{ color: selectedPaymentOption?.tone || "#64748b", fontWeight: 900 }}>
                      {selectedPaymentOption ? `${selectedPaymentOption.label} (${selectedPaymentOption.shortLabel})` : "Chưa chọn phương thức thanh toán"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Note area (Requirement 7) */}
              <div style={{ marginBottom: 24 }}>
                 <label style={{ fontSize: 13, color: "#64748b", fontWeight: 800, display: "block", marginBottom: 8, paddingLeft: 4 }}>Ghi chú giao hàng đặc biệt (Ví dụ: Giao giờ hành chính, gọi trước...)</label>
                 <textarea 
                   name="note" 
                   rows={3} 
                   value={formValues.note} 
                   onChange={handleChange} 
                   placeholder="Nhập ghi chú của bạn tại đây để bên vận chuyển phục vụ tốt hơn..." 
                   style={{ ...inputStyle, resize: "none" }}
                 />
              </div>

              <div className="step-actions-footer">
                <button type="button" onClick={() => setActiveStep(3)} className="btn-premium btn-premium-secondary">
                  ← Quay lại bước 3
                </button>
                <button 
                  type="button" 
                  disabled={isSubmitting || items.length === 0}
                  onClick={handleSubmit} 
                  className="btn-premium btn-premium-primary"
                  style={{ height: 56, padding: "0 40px" }}
                >
                  {isSubmitting && <SpinnerIcon />}
                  {isSubmitting ? "Đang xử lý đơn hàng..." : `Đặt hàng ngay${selectedPaymentOption ? ` (${selectedPaymentOption.shortLabel})` : ""}`}
                </button>
              </div>

              {errorMessage && (
                  <div style={{ marginTop: 20, padding: 16, borderRadius: 16, background: "rgba(239,68,68,0.06)", color: "#b91c1c", fontSize: 14, fontWeight: 800, textAlign: "center", border: "1px solid rgba(239,68,68,0.2)" }}>
                      ⚠️ {errorMessage}
                  </div>
              )}
            </section>
          )}
        </div>

        {/* Sidebar Order Summary (Requirement 10) */}
        <aside style={{ position: "sticky", top: 40 }}>
            <div style={{ ...SECTION_STYLE, padding: 28, animationDelay: "0.3s" }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 20, letterSpacing: "-0.02em", color: "#0f172a" }}>Tóm tắt linh kiện</h2>
                
                {/* Product listing with scrolling support */}
                <div style={{ display: "grid", gap: 4, maxHeight: 320, overflowY: "auto", paddingRight: 6, marginBottom: 20, borderBottom: "1px solid #f1f5f9" }}>
                    {items.map(item => (
                        <div key={item.id} className="sidebar-product-item">
                            <div style={{ width: 64, height: 64, borderRadius: 12, background: "#f8fafc", overflow: "hidden", flexShrink: 0, border: "1.5px solid #f1f5f9", display: "grid", placeItems: "center" }}>
                                {item.product?.imageUrl || item.variant?.imageUrl ? (
                                    <img src={item.product?.imageUrl || item.variant?.imageUrl} alt="" style={{ width: "85%", height: "85%", objectFit: "contain" }} />
                                ) : (
                                    <span style={{ fontSize: 24, opacity: 0.2 }}>📦</span>
                                )}
                            </div>
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 850, color: "#1e293b", marginBottom: 4, lineHeight: 1.3, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{item.product?.name}</div>
                                <div style={{ fontSize: 12, color: "#64748b", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                                    <span>Số lượng: {item.quantity}</span>
                                    <span style={{ color: "var(--market-primary)", fontWeight: 800 }}>{formatCurrency(item.unitPrice)} đ</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontWeight: 700, fontSize: 14 }}>
                      <span>Tổng tiền hàng</span>
                      <span style={{ color: "#1e293b" }}>{formatCurrency(totalAmount)} đ</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontWeight: 700, fontSize: 14 }}>
                      <span>Phí giao hàng</span>
                      <span style={{ color: "#059669", background: "rgba(5, 150, 105, 0.08)", padding: "2px 8px", borderRadius: 6, fontSize: "12px", fontWeight: 800 }}>Miễn phí</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 8, alignItems: "flex-end" }}>
                      <span>Thành tiền</span>
                      <div style={{ textAlign: "right" }}>
                         <span style={{ color: "var(--market-primary)", fontSize: 22 }}>{formatCurrency(finalAmount)} đ</span>
                         <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, marginTop: 2 }}>(Đã gồm VAT & Thuế bảo vệ)</div>
                      </div>
                    </div>
                </div>
            </div>
            
            {/* Elegant Trust Badges */}
            <div className="trust-badge-container">
              <div className="trust-badge-line">
                <div className="trust-badge-icon">🛡️</div>
                <div>
                  <div style={{ fontWeight: 850, color: "#334155" }}>Bảo mật SSL 256-bit</div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: 2 }}>Mọi giao dịch và thông tin cá nhân đều mã hóa tuyệt đối</div>
                </div>
              </div>
              <div className="trust-badge-line">
                <div className="trust-badge-icon">🔄</div>
                <div>
                  <div style={{ fontWeight: 850, color: "#334155" }}>Cam kết bảo hành & Đổi trả</div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: 2 }}>Đổi trả miễn phí trong 30 ngày • Bảo hành chính hãng 100%</div>
                </div>
              </div>
            </div>
        </aside>

      </div>
    </div>
  );
}


