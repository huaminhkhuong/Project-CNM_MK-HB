import crypto from "crypto";
import { env } from "../config/env";

const VN_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

export function getVnTime(offsetMinutes = 0, baseMs = Date.now()): string {
  const vnDate = new Date(baseMs + VN_UTC_OFFSET_MS + offsetMinutes * 60 * 1000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${vnDate.getUTCFullYear()}${pad(vnDate.getUTCMonth() + 1)}${pad(vnDate.getUTCDate())}${pad(
    vnDate.getUTCHours()
  )}${pad(vnDate.getUTCMinutes())}${pad(vnDate.getUTCSeconds())}`;
}

export function sanitizeVnpayOrderInfo(orderInfo: string, orderId: string): string {
  const normalized = String(orderInfo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (ch) => (ch === "đ" ? "d" : "D"))
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || `Thanh toan don hang ${orderId}`;
}

function normalizeVnpayIpAddr(ipAddr: string | string[] | undefined): string {
  const raw = Array.isArray(ipAddr) ? ipAddr[0] : String(ipAddr || "");
  const first = raw.split(",")[0]?.trim() || "";
  if (!first || first === "::1" || first === "0:0:0:0:0:0:0:1") {
    return "127.0.0.1";
  }
  return first.replace(/^::ffff:/i, "");
}

export function sortObject(obj: Record<string, any>) {
  const sorted: Record<string, string> = {};
  const str = [];
  let key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
}

function serializeSortedVnpayParams(sorted: Record<string, string>) {
  return Object.entries(sorted)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

export function generateVnpayUrl(
  ipAddr: string,
  orderId: string,
  amountInVnd: number,
  orderInfo: string
) {
  const tmnCode = process.env.VNPAY_TMN_CODE || env.vnpayTmnCode;
  const secretKey = process.env.VNPAY_HASH_SECRET || env.vnpayHashSecret;
  let vnpUrl = env.vnpayUrl || process.env.VNPAY_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
  const backendBase = (
    env.backendUrl ||
    env.apiBaseUrl ||
    process.env.BACKEND_URL ||
    process.env.API_BASE_URL ||
    `http://localhost:${env.port || 4000}`
  ).replace(/\/+$/, "");
  const returnUrl = `${backendBase}/api/orders/vnpay/return`;

  if (!tmnCode || !secretKey) {
    throw new Error("Missing VNPAY config in .env");
  }

  const nowMs = Date.now();
  const createDate = getVnTime(0, nowMs);
  const expireDate = getVnTime(15, nowMs);
  const cleanOrderInfo = sanitizeVnpayOrderInfo(orderInfo, orderId);
  const cleanIpAddr = normalizeVnpayIpAddr(ipAddr);

  let vnp_Params: Record<string, string | number> = {};
  vnp_Params["vnp_Version"] = "2.1.0";
  vnp_Params["vnp_Command"] = "pay";
  vnp_Params["vnp_TmnCode"] = tmnCode;
  vnp_Params["vnp_Locale"] = "vn";
  vnp_Params["vnp_CurrCode"] = "VND";
  vnp_Params["vnp_TxnRef"] = orderId;
  vnp_Params["vnp_OrderInfo"] = cleanOrderInfo;
  vnp_Params["vnp_OrderType"] = "other";
  vnp_Params["vnp_Amount"] = Math.round(amountInVnd * 100);
  vnp_Params["vnp_ReturnUrl"] = returnUrl;
  vnp_Params["vnp_IpAddr"] = cleanIpAddr;
  vnp_Params["vnp_CreateDate"] = createDate;
  vnp_Params["vnp_ExpireDate"] = expireDate;

  const sortedParams = sortObject(vnp_Params);

  const signData = serializeSortedVnpayParams(sortedParams);
  const hmac = crypto.createHmac("sha512", secretKey);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  sortedParams["vnp_SecureHash"] = signed;
  vnpUrl += "?" + serializeSortedVnpayParams(sortedParams);

  return vnpUrl;
}

export function verifyVnpayReturn(vnp_Params: any) {
  const params = { ...(vnp_Params || {}) };
  const secureHash = String(params["vnp_SecureHash"] || "").trim();
  const secretKey = process.env.VNPAY_HASH_SECRET || env.vnpayHashSecret;

  if (!secureHash || !secretKey) {
    return false;
  }

  delete params["vnp_SecureHash"];
  delete params["vnp_SecureHashType"];

  const sortedParams = sortObject(params);
  const signData = serializeSortedVnpayParams(sortedParams);
  const hmac = crypto.createHmac("sha512", secretKey);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  const expectedBuf = Buffer.from(signed.toLowerCase(), "utf8");
  const actualBuf = Buffer.from(secureHash.toLowerCase(), "utf8");
  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
