import crypto from "crypto";
import axios from "axios";
import { env } from "../config/env";
import { AppError } from "../errors/app-error";

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

const DEFAULT_MOMO_ENDPOINT = "https://test-payment.momo.vn/v2/gateway/api/create";

export function getMomoConfig() {
  return {
    partnerCode: String(env.momoPartnerCode || process.env.MOMO_PARTNER_CODE || "").trim(),
    accessKey: String(env.momoAccessKey || process.env.MOMO_ACCESS_KEY || "").trim(),
    secretKey: String(env.momoSecretKey || process.env.MOMO_SECRET_KEY || "").trim(),
    endpoint: String(env.momoApiUrl || process.env.MOMO_API_URL || DEFAULT_MOMO_ENDPOINT).trim()
  };
}

export function isMomoConfigured(): boolean {
  const { partnerCode, accessKey, secretKey } = getMomoConfig();
  return Boolean(partnerCode && accessKey && secretKey);
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
  if (!partnerCode || !accessKey || !secretKey) {
    throw new AppError("Cổng thanh toán MoMo chưa được cấu hình đầy đủ (thiếu MOMO_PARTNER_CODE/ACCESS_KEY/SECRET_KEY)", 503);
  }
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
  const { partnerCode: configuredPartnerCode, accessKey, secretKey } = getMomoConfig();
  if (!accessKey || !secretKey) {
    return false;
  }

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

  if (!signature || typeof signature !== "string") return false;
  if (configuredPartnerCode && String(partnerCode || "") !== configuredPartnerCode) return false;

  const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData || ""}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

  const expectedSignature = crypto
    .createHmac("sha256", secretKey)
    .update(rawSignature)
    .digest("hex");

  const actualBuf = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expectedSignature, "utf8");
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}
