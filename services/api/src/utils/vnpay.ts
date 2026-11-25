import crypto from "crypto";
import { env } from "../config/env";

export function getVnTime(): string {
  const date = new Date(new Date().toUTCString());
  date.setHours(date.getHours() + 7);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(
    date.getHours()
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
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

export function generateVnpayUrl(
  ipAddr: string,
  orderId: string,
  amountInVnd: number,
  orderInfo: string
) {
  const tmnCode = process.env.VNPAY_TMN_CODE || env.vnpayTmnCode;
  const secretKey = process.env.VNPAY_HASH_SECRET || env.vnpayHashSecret;
  let vnpUrl = env.vnpayUrl || process.env.VNPAY_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
  const returnUrl = `${env.frontendUrl || process.env.FRONTEND_URL}/payment/result`;

  if (!tmnCode || !secretKey) {
    throw new Error("Missing VNPAY config in .env");
  }

  const createDate = getVnTime();

  let vnp_Params: Record<string, string | number> = {};
  vnp_Params["vnp_Version"] = "2.1.0";
  vnp_Params["vnp_Command"] = "pay";
  vnp_Params["vnp_TmnCode"] = tmnCode;
  vnp_Params["vnp_Locale"] = "vn";
  vnp_Params["vnp_CurrCode"] = "VND";
  vnp_Params["vnp_TxnRef"] = orderId;
  vnp_Params["vnp_OrderInfo"] = orderInfo;
  vnp_Params["vnp_OrderType"] = "other";
  vnp_Params["vnp_Amount"] = amountInVnd * 100;
  vnp_Params["vnp_ReturnUrl"] = returnUrl;
  vnp_Params["vnp_IpAddr"] = ipAddr || "127.0.0.1";
  vnp_Params["vnp_CreateDate"] = createDate;

  vnp_Params = sortObject(vnp_Params);

  const signData = new URLSearchParams(vnp_Params as any).toString();
  const hmac = crypto.createHmac("sha512", secretKey);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
  
  vnp_Params["vnp_SecureHash"] = signed;
  vnpUrl += "?" + new URLSearchParams(vnp_Params as any).toString();

  return vnpUrl;
}

export function verifyVnpayReturn(vnp_Params: any) {
  const params = { ...(vnp_Params || {}) };
  const secureHash = params["vnp_SecureHash"];
  const secretKey = process.env.VNPAY_HASH_SECRET || env.vnpayHashSecret;

  if (!secureHash || !secretKey) {
    return false;
  }

  delete params["vnp_SecureHash"];
  delete params["vnp_SecureHashType"];

  const sortedParams = sortObject(params);
  const signData = new URLSearchParams(sortedParams).toString();
  const hmac = crypto.createHmac("sha512", secretKey);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  return secureHash === signed;
}
