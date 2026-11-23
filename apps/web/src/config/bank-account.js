// Cấu hình mặc định thông tin tài khoản ngân hàng & doanh nghiệp
// Được sử dụng làm giá trị dự phòng (fallback) khi API chưa phản hồi hoặc offline
export const BANK_ACCOUNT_CONFIG = {
  bankName: "Techcombank",
  accountNumber: "8686868991",
  accountHolder: "HỨA MINH KHƯƠNG",
  qrCodeImage: "/images/Screenshot 2026-05-25 123316.png", // Ảnh mã QR dự phòng
  transferNote: "PCMALL", // Tiền tố nội dung chuyển khoản chuẩn SePay
  hotline: "1900 8888",
  taxId: "0316888999",
  address: "123 Nguyễn Thị Minh Khai, Q.1, TP. Hồ Chí Minh"
};

const BANK_BIN_MAP = {
  techcombank: "TCB",
  tcb: "TCB",
  vietcombank: "VCB",
  vcb: "VCB",
  mbbank: "MB",
  "mb bank": "MB",
  mb: "MB",
  acb: "ACB",
  vpbank: "VPB",
  vpb: "VPB",
  bidv: "BIDV",
  vietinbank: "ICB",
  icb: "ICB",
  ctg: "ICB",
  tpbank: "TPB",
  tpb: "TPB",
  ocb: "OCB",
  sacombank: "STB",
  stb: "STB",
  vib: "VIB",
  shb: "SHB",
  msb: "MSB",
  hdbank: "HDB",
  hdb: "HDB",
  agribank: "VBA",
  vba: "VBA"
};

export function resolveBankCode(bankName = "Techcombank") {
  const raw = String(bankName || "Techcombank").trim();
  return BANK_BIN_MAP[raw.toLowerCase()] || raw.toUpperCase() || "TCB";
}

// Hàm tạo nội dung chuyển khoản chuẩn theo tiền tố và số điện thoại (backward-compat)
export function generateTransferNote(userPhone, prefix = "PCMALL") {
  return `${prefix || "PCMALL"}${userPhone || ""}`;
}

// Hàm tạo nội dung chuyển khoản gắn mã đơn hàng chuẩn SePay (VD: PCMALL768)
export function generateOrderTransferNote(orderId, _userPhone = "", prefix = "PCMALL") {
  const cleanPrefix = String(prefix || "PCMALL").replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || "PCMALL";
  if (orderId) {
    return `${cleanPrefix}${orderId}`;
  }
  return cleanPrefix;
}

// Hàm sinh URL QR chính thức từ SePay (qr.sepay.vn)
export function generateSePayQrUrl({
  bankName = "Techcombank",
  accountNumber = "8686868991",
  amount = 0,
  memo = ""
}) {
  const bankCode = resolveBankCode(bankName);
  const params = new URLSearchParams();
  params.set("acc", String(accountNumber || "").trim());
  params.set("bank", bankCode);
  if (Number(amount) > 0) params.set("amount", String(Math.round(Number(amount))));
  if (memo) params.set("des", String(memo).trim());
  params.set("template", "compact");
  return `https://qr.sepay.vn/img?${params.toString()}`;
}

// Hàm sinh URL VietQR động theo chuẩn Napas 247 (dự phòng khi qr.sepay.vn không tải được)
export function generateVietQrUrl({
  bankName = "Techcombank",
  accountNumber = "8686868991",
  accountHolder = "HỨA MINH KHƯƠNG",
  amount = 0,
  memo = ""
}) {
  const bankBin = resolveBankCode(bankName);
  const params = new URLSearchParams();
  if (Number(amount) > 0) params.set("amount", String(Math.round(Number(amount))));
  if (memo) params.set("addInfo", memo);
  if (accountHolder) params.set("accountName", accountHolder);

  return `https://img.vietqr.io/image/${bankBin}-${accountNumber}-compact2.png?${params.toString()}`;
}
