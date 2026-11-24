/**
 * Email Service — Nodemailer + Gmail SMTP
 *
 * Graceful fallback: nếu MAIL_USER / MAIL_PASS chưa cấu hình,
 * tất cả hàm send* sẽ log cảnh báo và return false mà không crash server.
 *
 * Cấu hình trong services/api/.env:
 *   MAIL_USER=your-gmail@gmail.com
 *   MAIL_PASS=xxxx-xxxx-xxxx-xxxx   ← Gmail App Password (16 ký tự)
 *   MAIL_FROM="PC Mall <your-gmail@gmail.com>"
 */
import nodemailer from "nodemailer";
import { env } from "../config/env";

// ─── Transporter (lazy init) ───────────────────────────────────────────────

let _transporter: nodemailer.Transporter | null = null;
let _transporterReady = false;

function getTransporter(): nodemailer.Transporter | null {
  if (!env.mailUser || !env.mailPass) {
    return null; // Email not configured — skip silently
  }

  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // TLS
      auth: {
        user: env.mailUser,
        pass: env.mailPass
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  return _transporter;
}

// ─── Verify connection (call on startup, optional) ─────────────────────────

export async function verifyEmailConnection(): Promise<void> {
  if (_transporterReady) return;

  const transporter = getTransporter();
  if (!transporter) {
    console.log("[Email] ⚠️  MAIL_USER / MAIL_PASS not configured — email notifications disabled.");
    return;
  }

  try {
    await transporter.verify();
    _transporterReady = true;
    console.log(`[Email] ✅ Gmail SMTP connected as ${env.mailUser}`);
  } catch (err: any) {
    console.warn("[Email] ⚠️  Gmail SMTP connection failed:", (err as Error).message);
    console.warn("[Email] Make sure MAIL_USER / MAIL_PASS are set correctly in .env");
  }
}

// ─── Core send function ────────────────────────────────────────────────────

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[Email] Skipped (not configured): to=${options.to}, subject="${options.subject}"`);
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: env.mailFrom || `"PC Mall" <${env.mailUser}>`,
      to: options.to,
      subject: options.subject,
      html: options.html
    });
    console.log(`[Email] ✅ Sent to ${options.to}: ${info.messageId}`);
    return true;
  } catch (err: any) {
    console.error(`[Email] ❌ Failed to send to ${options.to}:`, (err as Error).message);
    return false;
  }
}

// ─── Fire-and-forget wrapper ───────────────────────────────────────────────
// Dùng để gọi trong controllers — không await, không block response

export function sendEmailAsync(options: {
  to: string;
  subject: string;
  html: string;
}): void {
  sendEmail(options).catch(() => {
    // Already logged in sendEmail
  });
}

// ─── Currency formatter ────────────────────────────────────────────────────

export function formatCurrency(amount: number | string): string {
  return Number(amount || 0).toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND"
  });
}

// ─── Date formatter ────────────────────────────────────────────────────────

export function formatDateTime(date?: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh"
  });
}
