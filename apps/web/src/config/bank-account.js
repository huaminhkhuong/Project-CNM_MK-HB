// Cấu hình mặc định thông tin tài khoản ngân hàng & doanh nghiệp
// Được sử dụng làm giá trị dự phòng (fallback) khi API chưa phản hồi hoặc offline
export const BANK_ACCOUNT_CONFIG = {
  bankName: "Techcombank",
  accountNumber: "8686868991",
  accountHolder: "HỨA MINH KHƯƠNG",
  qrCodeImage: "/images/Screenshot 2026-05-25 123316.png", // Ảnh mã QR trong thư mục public
  transferNote: "DH", // Tiền tố nội dung chuyển khoản
  hotline: "1900 8888",
  taxId: "0316888999",
  address: "123 Nguyễn Thị Minh Khai, Q.1, TP. Hồ Chí Minh"
};

// Hàm tạo nội dung chuyển khoản chuẩn theo tiền tố và số điện thoại
export function generateTransferNote(userPhone, prefix = "DH") {
  return `${prefix || "DH"}${userPhone || "SDT"}`;
}

// Hàm sinh URL VietQR động theo chuẩn Napas 247
export function generateVietQrUrl({ bankName = "Techcombank", accountNumber = "8686868991", accountHolder = "HỨA MINH KHƯƠNG", amount = 0, memo = "" }) {
  const bankBinMap = {
    Techcombank: "TCB",
    Vietcombank: "VCB",
    MBBank: "MB",
    ACB: "ACB",
    VPBank: "VPB",
    BIDV: "BIDV",
    VietinBank: "CTG",
    TPBank: "TPB"
  };
  const bankBin = bankBinMap[bankName] || bankName || "TCB";
  const params = new URLSearchParams();
  if (amount > 0) params.set("amount", String(amount));
  if (memo) params.set("addInfo", memo);
  if (accountHolder) params.set("accountName", accountHolder);

  return `https://img.vietqr.io/image/${bankBin}-${accountNumber}-compact2.png?${params.toString()}`;
}
