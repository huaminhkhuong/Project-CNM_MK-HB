import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

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
  PAYMENT_MOCK_MODE: z.coerce.boolean().default(false),
  SHIPPING_MOCK_MODE: z.coerce.boolean().default(false),
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
  // AI Advisor LLM Engine
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional()
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(`Invalid environment configuration: ${parsedEnv.error.message}`);
}

let dbHost = process.env.DB_HOST || "127.0.0.1";
let dbPort = Number(process.env.DB_PORT || 3306);
let dbUser = process.env.DB_USER || "root";
let dbPassword = process.env.DB_PASSWORD || "";
let dbName = process.env.DB_NAME || "cnm_ecommerce";

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
  geminiApiKey: parsedEnv.data.GEMINI_API_KEY,
  openaiApiKey: parsedEnv.data.OPENAI_API_KEY
};
