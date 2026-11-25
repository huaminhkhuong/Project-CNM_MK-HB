import { httpClient } from "./http";
import { BANK_ACCOUNT_CONFIG } from "../config/bank-account";

let cachedStoreInfo = null;
let inFlightRequest = null;

/**
 * Lấy thông tin cấu hình cửa hàng & tài khoản ngân hàng công khai
 * Có bộ đệm bộ nhớ đệm và cơ chế tự động fallback về cấu hình mặc định
 */
export async function getPublicStoreInfo(forceReload = false) {
  if (cachedStoreInfo && !forceReload) {
    return cachedStoreInfo;
  }

  if (inFlightRequest && !forceReload) {
    return inFlightRequest;
  }

  inFlightRequest = httpClient
    .get("/system/public-info")
    .then((response) => {
      const data = response?.data?.data || response?.data || {};
      cachedStoreInfo = {
        storeName: data.storeName || "PC Mall",
        supportEmail: data.supportEmail || "support@pcmall.vn",
        supportPhone: data.supportPhone || data.storeHotline || BANK_ACCOUNT_CONFIG.hotline,
        storeAddress: data.storeAddress || BANK_ACCOUNT_CONFIG.address,
        storeTaxId: data.storeTaxId || BANK_ACCOUNT_CONFIG.taxId,
        storeHotline: data.storeHotline || data.supportPhone || BANK_ACCOUNT_CONFIG.hotline,
        bankName: data.bankName || BANK_ACCOUNT_CONFIG.bankName,
        bankAccountNumber: data.bankAccountNumber || BANK_ACCOUNT_CONFIG.accountNumber,
        bankAccountHolder: data.bankAccountHolder || BANK_ACCOUNT_CONFIG.accountHolder,
        transferNotePrefix: data.transferNotePrefix || BANK_ACCOUNT_CONFIG.transferNote
      };
      return cachedStoreInfo;
    })
    .catch((error) => {
      console.warn("⚠️ [StoreInfoService] Failed to fetch dynamic store info from API, using fallback:", error.message);
      return {
        storeName: "PC Mall",
        supportEmail: "support@pcmall.vn",
        supportPhone: BANK_ACCOUNT_CONFIG.hotline,
        storeAddress: BANK_ACCOUNT_CONFIG.address,
        storeTaxId: BANK_ACCOUNT_CONFIG.taxId,
        storeHotline: BANK_ACCOUNT_CONFIG.hotline,
        bankName: BANK_ACCOUNT_CONFIG.bankName,
        bankAccountNumber: BANK_ACCOUNT_CONFIG.accountNumber,
        bankAccountHolder: BANK_ACCOUNT_CONFIG.accountHolder,
        transferNotePrefix: BANK_ACCOUNT_CONFIG.transferNote
      };
    })
    .finally(() => {
      inFlightRequest = null;
    });

  return inFlightRequest;
}

/**
 * Xóa cache để làm mới thông tin sau khi cập nhật cấu hình ở Admin Portal
 */
export function invalidateStoreInfoCache() {
  cachedStoreInfo = null;
}

