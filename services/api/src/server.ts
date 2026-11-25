import { createServer } from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { initSocketIO } from "./socket/socket.service";
import { verifyEmailConnection } from "./services/email.service";
import { startPaymentTimeoutWorker, stopPaymentTimeoutWorker } from "./workers/payment-timeout.worker";
import { logger } from "./utils/logger";

import { pcBuilderService } from "./modules/pc-builder/pc-builder.service";

(global as any).pcBuilderService = pcBuilderService;

const app = createApp();
const httpServer = createServer(app);

// Initialize Socket.io on the same HTTP server as Express
initSocketIO(httpServer, env.frontendUrl);

httpServer.listen(env.port, () => {
  logger.info(`API running at http://localhost:${env.port}`);
  logger.info(`Socket.io ready at ws://localhost:${env.port}`);
  
  try {
    const { unifiedLlmService } = require("./modules/ai/unified-llm.service");
    const llmInfo = unifiedLlmService.getProviderInfo();
    if (llmInfo.hasApiKey) {
      logger.info(`[AI Advisor] Unified LLM Engine active: ${llmInfo.provider.toUpperCase()} (${llmInfo.model})`);
    } else {
      logger.info(`[AI Advisor] Operating in 100% local Rule Engine & Database grounded mode (LLM_API_KEY empty).`);
    }
  } catch {}

  // Verify email config on startup (non-blocking)
  verifyEmailConnection();

  // Start Payment Timeout Worker to sweep expired pending gateway orders and release inventory
  startPaymentTimeoutWorker();
});

// Graceful shutdown handling
async function gracefulShutdown(signal: string) {
  stopPaymentTimeoutWorker();
  logger.info(`[Server] Received ${signal}. Closing HTTP server, Socket.io, and database pools...`);
  
  try {
    const { closeSocketIO } = await import("./socket/socket.service");
    await closeSocketIO();
  } catch {}

  httpServer.close(async () => {
    try {
      const { prisma } = await import("./config/prisma");
      await prisma.$disconnect();
    } catch {}
    try {
      const { closePool } = require("./config/database");
      await closePool();
    } catch {}
    logger.info("[Server] Graceful shutdown completed. Exiting.");
    process.exit(0);
  });

  // Force exit after 10s if connections do not drain
  setTimeout(() => {
    logger.error(new Error("[Server] Forcefully shutting down due to timeout."));
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
