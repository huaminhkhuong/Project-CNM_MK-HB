import crypto from "crypto";
import axios from "axios";
import { env } from "../config/env";

export interface MomoPaymentResponse {
  partnerCode: string;
  requestId: string;
  orderId: string;
  amount: number;
  responseTime: number;
  message: string;
  resultCode: number;
  payUrl?: string;
  deeplink?: string;
  qrCodeUrl?: string;
}

// ─── Default MoMo Test Credentials (Cấu hình mặc định cho Sandbox Test) ──────
const DEFAULT_PARTNER_CODE = "MOMO";
const DEFAULT_ACCESS_KEY = "F8BBA842ECF82";
const DEFAULT_SECRET_KEY = "K951B6PE1waDMi680xqZrqH3fi6WrStj";
const DEFAULT_MOMO_ENDPOINT = "https://test-payment.momo.vn/v2/gateway/api/create";

export function getMomoConfig() {
  return {
    partnerCode: env.momoPartnerCode || process.env.MOMO_PARTNER_CODE || DEFAULT_PARTNER_CODE,
    accessKey: env.momoAccessKey || process.env.MOMO_ACCESS_KEY || DEFAULT_ACCESS_KEY,
    secretKey: env.momoSecretKey || process.env.MOMO_SECRET_KEY || DEFAULT_SECRET_KEY,
    endpoint: env.momoApiUrl || process.env.MOMO_API_URL || DEFAULT_MOMO_ENDPOINT
  };
}

/**
 * Tạo yêu cầu thanh toán tới cổng MoMo (API v2 - HMAC SHA256)
 */
export async function generateMomoUrl(
  orderId: string,
  amountInVnd: number,
  orderInfo: string
): Promise<{ payUrl: string; requestId: string }> {
  const { partnerCode, accessKey, secretKey, endpoint } = getMomoConfig();
  const requestId = `MOMO_${orderId}_${Date.now()}`;
  const redirectUrl = `${env.frontendUrl || process.env.FRONTEND_URL || "http://localhost:5173"}/payment/result`;
  const backendBase = (env.backendUrl || process.env.BACKEND_URL || process.env.API_BASE_URL || `http://localhost:${env.port || 4000}`).replace(/\/+$/, "");
  const ipnUrl = `${backendBase}/api/orders/momo/ipn`;
  const requestType = "captureWallet";
  const extraData = ""; // base64 encoded strings if needed

  // Tạo raw signature theo đúng chuẩn MoMo v2
  const rawSignature = `accessKey=${accessKey}&amount=${amountInVnd}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(rawSignature)
    .digest("hex");

  const requestBody = {
    partnerCode,
    partnerName: "PC Mall E-Commerce",
    storeId: "PC_MALL_STORE_1",
    requestId,
    amount: amountInVnd,
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    requestType,
    extraData,
    lang: "vi",
    signature
  };

  try {
    const response = await axios.post<MomoPaymentResponse>(endpoint, requestBody, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000
    });

    if (response.data && response.data.resultCode === 0 && response.data.payUrl) {
      return { payUrl: response.data.payUrl, requestId };
    }

    throw new Error(response.data?.message || `MoMo Gateway Error (Code: ${response.data?.resultCode})`);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error("[MoMo Gateway Error]", error.response.data);
      throw new Error(`MoMo response: ${error.response.data?.message || error.message}`);
    }
    throw error;
  }
}

/**
 * Xác minh chữ ký số trả về từ MoMo (IPN / Return URL)
 */
export function verifyMomoSignature(payload: Record<string, any>): boolean {
  const { accessKey, secretKey } = getMomoConfig();
  const {
    partnerCode,
    orderId,
    requestId,
    amount,
    orderInfo,
    orderType,
    transId,
    resultCode,
    message,
    responseTime,
    extraData,
    signature
  } = payload;

  if (!signature) return false;

  const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData || ""}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

  const expectedSignature = crypto
    .createHmac("sha256", secretKey)
    .update(rawSignature)
    .digest("hex");

  return signature === expectedSignature;
}
