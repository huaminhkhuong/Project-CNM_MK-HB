import { NextFunction, Request, Response } from "express";

interface RateLimitOptions {
  windowMs: number; // Time window in ms
  max: number; // Max requests allowed per IP in windowMs
  message?: string;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

/**
 * Lightweight, zero-dependency sliding window rate limiter middleware
 */
export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, message = "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút." } = options;
  const clients = new Map<string, ClientRecord>();

  // Periodically clean up expired entries every 5 minutes to prevent memory leak
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of clients.entries()) {
      if (now > record.resetTime) {
        clients.delete(ip);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === "test") {
      return next();
    }
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const now = Date.now();

    let record = clients.get(ip);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      clients.set(ip, record);
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", max - 1);
      return next();
    }

    record.count += 1;
    const remaining = Math.max(0, max - record.count);
    const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);

    if (record.count > max) {
      res.setHeader("Retry-After", retryAfterSec);
      return res.status(429).json({
        success: false,
        message,
        retryAfterSeconds: retryAfterSec
      });
    }

    next();
  };
}

// 1. Auth Rate Limiter: Max 10 attempts per 15 minutes per IP (protects login/register/forgot-password)
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "⛔ Quá nhiều lần thử đăng nhập/đăng ký. Vui lòng thử lại sau 15 phút."
});

// 2. AI Rate Limiter: Max 20 requests per minute per IP (protects AI Chat & PC Builder AI Suggestion)
export const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: "⚡ Bạn đã vượt quá giới hạn gọi AI Advisor. Vui lòng chờ 1 phút trước khi tiếp tục."
});

// 3. General API Rate Limiter: Max 200 requests per minute per IP
export const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 200,
  message: "⚠️ Thao tác quá nhanh. Vui lòng giãn cách các yêu cầu."
});
