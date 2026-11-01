const path = require("path");
const dotenv = require("dotenv");

const envFilePath = path.resolve(__dirname, "../../.env");

dotenv.config({ path: envFilePath });

function getRequiredProductionEnv(key) {
  const value = process.env[key];

  if (!value || value.trim() === "") {
    throw new Error(`Missing required production environment variable: ${key}`);
  }

  return value;
}

function getProductionSecret(key, defaultValue) {
  const value = getRequiredProductionEnv(key);

  if (value === defaultValue || value.length < 24 || value.startsWith("your_") || value.startsWith("replace_")) {
    throw new Error(`${key} must be a strong production secret`);
  }

  return value;
}

const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  [
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
    "FRONTEND_URL"
  ].forEach(getRequiredProductionEnv);
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  dbHost: process.env.DB_HOST || "127.0.0.1",
  dbPort: Number(process.env.DB_PORT || 3306),
  dbUser: process.env.DB_USER || "root",
  dbPassword: process.env.DB_PASSWORD || "",
  dbName: process.env.DB_NAME || "cnm_mk_hb",
  jwtAccessSecret: isProduction
    ? getProductionSecret("JWT_ACCESS_SECRET", "change_me_access")
    : process.env.JWT_ACCESS_SECRET || "change_me_access",
  jwtRefreshSecret: isProduction
    ? getProductionSecret("JWT_REFRESH_SECRET", "change_me_refresh")
    : process.env.JWT_REFRESH_SECRET || "change_me_refresh",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  llmProvider: process.env.LLM_PROVIDER || "gemini",
  llmApiKey: process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || "",
  llmModel: process.env.LLM_MODEL || process.env.GEMINI_MODEL || "gemini-1.5-flash",
  llmEndpoint: process.env.LLM_ENDPOINT || "",
  llmTemperature: Number(process.env.LLM_TEMPERATURE || 0.7),
  llmMaxTokens: Number(process.env.LLM_MAX_TOKENS || 2048),
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-1.5-flash",
  groqApiKey: process.env.GROQ_API_KEY || "",
  paymentMockMode: process.env.PAYMENT_MOCK_MODE === "true",
  shippingMockMode: process.env.SHIPPING_MOCK_MODE === "true",
  shippingProvider: process.env.SHIPPING_PROVIDER || "manual",
  chatStoragePath: process.env.CHAT_STORAGE_PATH || "./data/chat-sessions.json"
};

module.exports = { env };
