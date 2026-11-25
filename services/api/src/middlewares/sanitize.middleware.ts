import { NextFunction, Request, Response } from "express";

/**
 * XSS & HTML Tag Sanitizer Helper
 * Recursively cleans string values in request payloads to prevent Cross-Site Scripting (XSS)
 * while preserving legitimate Vietnamese Unicode characters, punctuation, and markdown formatting.
 */
export function sanitizeString(value: string): string {
  if (typeof value !== "string") return value;

  return value
    // 1. Strip full script tags and their inner content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // 1b. Strip standalone open/close or malformed script tags
    .replace(/<\/?script\b[^>]*>/gi, "")
    // 2. Strip dangerous embed/iframe/object tags
    .replace(/<\/?(iframe|object|embed|applet|meta|link|style)\b[^>]*>/gi, "")
    // 3. Strip inline JavaScript protocol URLs (e.g. href="javascript:...")
    .replace(/javascript\s*:/gi, "no-javascript:")
    // 4. Strip dangerous inline DOM event handlers (e.g. onerror=..., onload=...)
    .replace(/\s+on[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*[^ >]+/gi, "");
}

/**
 * Whitelist các trường mật khẩu và khóa bí mật nhạy cảm:
 * Tuyệt đối giữ nguyên vẹn 100% mật khẩu phức tạp của người dùng (chứa ký tự đặc biệt, dấu ngoặc nhọn, protocol)
 * để đưa vào hàm băm bcrypt hoặc xác thực chữ ký số, tránh làm biến dạng mật khẩu khi đăng ký, đăng nhập hoặc đổi mật khẩu.
 */
const WHITELISTED_EXACT_KEYS = new Set([
  "password",
  "confirmpassword",
  "currentpassword",
  "newpassword",
  "oldpassword",
  "current_password",
  "new_password",
  "confirm_password",
  "token",
  "refreshtoken",
  "accesstoken",
  "refresh_token",
  "access_token",
  "secret",
  "hashsecret",
  "vnpay_hash_secret"
]);

export function isWhitelistedField(key?: string): boolean {
  if (!key) return false;
  const lowerKey = key.toLowerCase();
  return (
    WHITELISTED_EXACT_KEYS.has(lowerKey) ||
    lowerKey.endsWith("password") ||
    lowerKey.endsWith("_password") ||
    lowerKey.endsWith("secret") ||
    lowerKey.endsWith("_secret") ||
    lowerKey.endsWith("token") ||
    lowerKey.endsWith("_token")
  );
}

/**
 * Recursively sanitize objects, arrays, and primitive strings
 */
export function sanitizeDeep<T>(input: T, currentKey?: string): T {
  if (input === null || input === undefined) {
    return input;
  }

  // Nếu là trường mật khẩu hoặc token/khóa bí mật, giữ nguyên vẹn không can thiệp
  if (currentKey && isWhitelistedField(currentKey)) {
    return input;
  }

  if (typeof input === "string") {
    return sanitizeString(input) as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeDeep(item)) as unknown as T;
  }

  if (typeof input === "object" && !(input instanceof Date) && !(input instanceof RegExp)) {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(input)) {
      cleaned[key] = sanitizeDeep(val, key);
    }
    return cleaned as T;
  }

  return input;
}

/**
 * Express Middleware: Automatic input sanitization across body, query, and params
 */
export function sanitizeInputMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeDeep(req.body);
  }

  if (req.query && typeof req.query === "object") {
    req.query = sanitizeDeep(req.query);
  }

  if (req.params && typeof req.params === "object") {
    req.params = sanitizeDeep(req.params);
  }

  next();
}

