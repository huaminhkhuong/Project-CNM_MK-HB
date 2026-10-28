import { createServer } from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { initSocketIO } from "./socket/socket.service";
import { verifyEmailConnection } from "./services/email.service";
import { startPaymentTimeoutWorker, stopPaymentTimeoutWorker } from "./workers/payment-timeout.worker";

const app = createApp();
const httpServer = createServer(app);

// Initialize Socket.io on the same HTTP server as Express
initSocketIO(httpServer, env.frontendUrl);

httpServer.listen(env.port, () => {
  console.log(`API running at http://localhost:${env.port}`);
  console.log(`Socket.io ready at ws://localhost:${env.port}`);
  
  if (env.geminiApiKey || env.openaiApiKey) {
    console.log(`[AI Advisor] LLM API Engine active (${env.geminiApiKey ? "Google Gemini 1.5 Flash" : "OpenAI GPT-4o-mini"})`);
  } else {
    console.log(`[AI Advisor] Notice: GEMINI_API_KEY & OPENAI_API_KEY are empty. AI Advisor will fallback to PC Mall Rule-Based Knowledge Engine.`);
  }

  // Verify email config on startup (non-blocking)
  verifyEmailConnection();

  // Start Payment Timeout Worker to sweep expired pending gateway orders and release inventory
  startPaymentTimeoutWorker();
});

process.on("SIGTERM", () => {
  stopPaymentTimeoutWorker();
});

process.on("SIGINT", () => {
  stopPaymentTimeoutWorker();
});

