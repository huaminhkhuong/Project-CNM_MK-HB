import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export function parseBooleanEnv(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (val === undefined || val === null) return false;
  const normalized = String(val).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

const booleanEnvSchema = z.preprocess((val) => parseBooleanEnv(val), z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default("7d"),
  VNPAY_TMN_CODE: z.string().optional(),
  VNPAY_HASH_SECRET: z.string().optional(),
  VNPAY_URL: z.string().optional(),
  PAYMENT_MOCK_MODE: booleanEnvSchema.default(false),
  SHIPPING_MOCK_MODE: booleanEnvSchema.default(false),
  SHIPPING_PROVIDER: z.string().default("manual"),
  CHAT_STORAGE_PATH: z.string().default("./data/chat-sessions.json"),
  // Email (Nodemailer / Gmail SMTP) — optional, server works without it
  MAIL_USER: z.string().optional(),
  MAIL_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  // MoMo Payment API
  MOMO_PARTNER_CODE: z.string().optional(),
  MOMO_ACCESS_KEY: z.string().optional(),
  MOMO_SECRET_KEY: z.string().optional(),
  MOMO_API_URL: z.string().optional(),
  // SePay Auto-VietQR Webhook & Pull Sync API Configuration
  SEPAY_WEBHOOK_API_KEY: z.string().optional(),
  SEPAY_API_TOKEN: z.string().optional(),
  SEPAY_API_URL: z.string().default("https://my.sepay.vn/userapi/transactions/list"),
  SEPAY_SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  SEPAY_BANK_CODE: z.string().optional(),
  SEPAY_ACCOUNT_NUMBER: z.string().optional(),
  SEPAY_ACCOUNT_NAME: z.string().optional(),
  SEPAY_TRANSFER_PREFIX: z.string().default("PCMALL"),
  // Unified LLM Engine Settings (Provider-Agnostic)
  LLM_PROVIDER: z.string().default("gemini"),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  LLM_ENDPOINT: z.string().optional(),
  LLM_TEMPERATURE: z.coerce.number().default(0.7),
  LLM_MAX_TOKENS: z.coerce.number().default(2048),
  // Backward compatibility keys
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GROQ_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  // Public/Gateway URLs, internal service auth, and feature flags
  BACKEND_URL: z.string().optional(),
  API_BASE_URL: z.string().optional(),
  AI_SERVICE_URL: z.string().default("http://127.0.0.1:5001"),
  AI_SERVICE_INTERNAL_KEY: z.string().optional(),
  ENABLE_MOCK_GOOGLE_AUTH: booleanEnvSchema.default(false),
  PAYMENT_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(30)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(`Invalid environment configuration: ${parsedEnv.error.message}`);
}

if (parsedEnv.data.NODE_ENV === "production") {
  const weakPrefixes = ["change_me", "your_", "replace_", "dev_", "test_"];
  for (const [key, val] of [
    ["JWT_ACCESS_SECRET", parsedEnv.data.JWT_ACCESS_SECRET],
    ["JWT_REFRESH_SECRET", parsedEnv.data.JWT_REFRESH_SECRET]
  ] as const) {
    const trimmed = String(val || "").trim();
    const isWeak = trimmed.length < 24 || weakPrefixes.some((p) => trimmed.toLowerCase().startsWith(p));
    if (isWeak) {
      throw new Error(
        `[Security Alert] ${key} must be a strong production secret (minimum 24 characters, cannot use default/placeholder values).`
      );
    }
  }
}

let dbHost = process.env.DB_HOST || "127.0.0.1";
let dbPort = Number(process.env.DB_PORT || 3306);
let dbUser = process.env.DB_USER || "root";
let dbPassword = process.env.DB_PASSWORD || "";
let dbName = process.env.DB_NAME || "cnm_mk_hb";

if (parsedEnv.data.DATABASE_URL) {
  try {
    const parsedDbUrl = new URL(parsedEnv.data.DATABASE_URL);
    dbHost = parsedDbUrl.hostname || dbHost;
    dbPort = parsedDbUrl.port ? Number(parsedDbUrl.port) : dbPort;
    dbUser = decodeURIComponent(parsedDbUrl.username || dbUser);
    dbPassword = decodeURIComponent(parsedDbUrl.password || dbPassword);
    dbName = parsedDbUrl.pathname.replace(/^\//, "") || dbName;
  } catch {}
}

export const env = {
  nodeEnv: parsedEnv.data.NODE_ENV,
  port: parsedEnv.data.PORT,
  databaseUrl: parsedEnv.data.DATABASE_URL,
  dbHost,
  dbPort,
  dbUser,
  dbPassword,
  dbName,
  frontendUrl: parsedEnv.data.FRONTEND_URL,
  jwtAccessSecret: parsedEnv.data.JWT_ACCESS_SECRET,
  jwtRefreshSecret: parsedEnv.data.JWT_REFRESH_SECRET,
  jwtAccessExpiresIn: parsedEnv.data.JWT_ACCESS_EXPIRES_IN,
  jwtRefreshExpiresIn: parsedEnv.data.JWT_REFRESH_EXPIRES_IN,
  vnpayTmnCode: parsedEnv.data.VNPAY_TMN_CODE,
  vnpayHashSecret: parsedEnv.data.VNPAY_HASH_SECRET,
  vnpayUrl: parsedEnv.data.VNPAY_URL,
  paymentMockMode: parsedEnv.data.PAYMENT_MOCK_MODE,
  shippingMockMode: parsedEnv.data.SHIPPING_MOCK_MODE,
  chatStoragePath: parsedEnv.data.CHAT_STORAGE_PATH,
  shippingProvider: parsedEnv.data.SHIPPING_PROVIDER,
  mailUser: parsedEnv.data.MAIL_USER,
  mailPass: parsedEnv.data.MAIL_PASS,
  mailFrom: parsedEnv.data.MAIL_FROM,
  momoPartnerCode: parsedEnv.data.MOMO_PARTNER_CODE,
  momoAccessKey: parsedEnv.data.MOMO_ACCESS_KEY,
  momoSecretKey: parsedEnv.data.MOMO_SECRET_KEY,
  momoApiUrl: parsedEnv.data.MOMO_API_URL,
  sepayWebhookApiKey: parsedEnv.data.SEPAY_WEBHOOK_API_KEY,
  sepayApiToken: parsedEnv.data.SEPAY_API_TOKEN,
  sepayApiUrl: parsedEnv.data.SEPAY_API_URL,
  sepaySyncIntervalMs: parsedEnv.data.SEPAY_SYNC_INTERVAL_MS,
  sepayBankCode: parsedEnv.data.SEPAY_BANK_CODE,
  sepayAccountNumber: parsedEnv.data.SEPAY_ACCOUNT_NUMBER,
  sepayAccountName: parsedEnv.data.SEPAY_ACCOUNT_NAME,
  sepayTransferPrefix: parsedEnv.data.SEPAY_TRANSFER_PREFIX || "PCMALL",
  llmProvider: parsedEnv.data.LLM_PROVIDER || "gemini",
  llmApiKey: parsedEnv.data.LLM_API_KEY || parsedEnv.data.GEMINI_API_KEY || parsedEnv.data.GROQ_API_KEY || parsedEnv.data.OPENAI_API_KEY || "",
  llmModel: parsedEnv.data.LLM_MODEL || parsedEnv.data.GEMINI_MODEL || "gemini-2.5-flash",
  llmEndpoint: parsedEnv.data.LLM_ENDPOINT || "",
  llmTemperature: parsedEnv.data.LLM_TEMPERATURE,
  llmMaxTokens: parsedEnv.data.LLM_MAX_TOKENS,
  geminiApiKey: parsedEnv.data.GEMINI_API_KEY,
  geminiModel: parsedEnv.data.GEMINI_MODEL,
  groqApiKey: parsedEnv.data.GROQ_API_KEY,
  openaiApiKey: parsedEnv.data.OPENAI_API_KEY,
  backendUrl: parsedEnv.data.BACKEND_URL || parsedEnv.data.API_BASE_URL || `http://localhost:${parsedEnv.data.PORT}`,
  apiBaseUrl: parsedEnv.data.API_BASE_URL || parsedEnv.data.BACKEND_URL || `http://localhost:${parsedEnv.data.PORT}`,
  aiServiceUrl: parsedEnv.data.AI_SERVICE_URL || "http://127.0.0.1:5001",
  aiServiceInternalKey: parsedEnv.data.AI_SERVICE_INTERNAL_KEY || "",
  enableMockGoogleAuth: parsedEnv.data.ENABLE_MOCK_GOOGLE_AUTH,
  paymentTimeoutMinutes: parsedEnv.data.PAYMENT_TIMEOUT_MINUTES
};

// Expose parsed env singleton so CommonJS modules (e.g., payments.service.js) share the exact same instance
(globalThis as any).__CNM_ENV__ = env;
