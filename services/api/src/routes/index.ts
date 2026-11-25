import { Router } from "express";

import { checkDatabaseConnection } from "../utils/health-check";
import { authRouter } from "../modules/auth/auth.route";
import { cartRouter } from "../modules/cart/cart.route";
import { catalogRouter } from "../modules/catalog/catalog.route";
import { ordersRouter } from "../modules/orders/orders.route";
import pcBuilderRouter from "../modules/pc-builder/pc-builder.route";
import { ticketsRouter } from "../modules/tickets/tickets.route";
import { usersRouter } from "../modules/users/users.route";
import { aiAdvisorRouter } from "../modules/ai-advisor/ai-advisor.route";
import { warrantiesRouter } from "../modules/warranties/warranties.route";
import { chatRouter } from "../modules/chat/chat.route";
import { couponsRouter } from "../modules/coupons/coupons.route";
import { notificationsRouter } from "../modules/notifications/notifications.route";

import aiRouter from "../modules/ai/ai.route";
import productsRouter from "../modules/products/products.route";
import adminRouter from "../modules/admin/admin.route";
import adminController from "../modules/admin/admin.controller";
import staffRouter from "../modules/staff/staff.route";
import shipmentsRouter from "../modules/shipments/shipments.route";
import paymentsRouter from "../modules/payments/payments.route";
import compatibilityRouter from "../modules/compatibility/compatibility.route";

import { authRateLimiter, aiRateLimiter, generalApiLimiter } from "../middlewares/rate-limiter.middleware";

export const apiRouter = Router();

apiRouter.use(generalApiLimiter);

apiRouter.get("/health", async (_req, res) => {
  const startedAt = Date.now();
  const database = await checkDatabaseConnection();
  const isReady = database.connected;
  const memory = process.memoryUsage();

  res.status(isReady ? 200 : 503).json({
    status: isReady ? "ok" : "degraded",
    service: "api",
    version: "0.1.0",
    env: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    memoryUsageMb: {
      rss: Math.round(memory.rss / 1024 / 1024),
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024)
    },
    database: {
      ...database,
      pingLatencyMs: database.latencyMs ?? (Date.now() - startedAt)
    }
  });
});

apiRouter.get("/system/public-info", adminController.getPublicStoreInfo);

apiRouter.use("/auth", authRateLimiter, authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/staff", staffRouter);
apiRouter.use("/products", productsRouter);
apiRouter.use("/", catalogRouter);
apiRouter.use("/cart", cartRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/shipments", shipmentsRouter);
apiRouter.use("/payments", paymentsRouter);
apiRouter.use("/pc-builder", pcBuilderRouter);
apiRouter.use("/compatibility", compatibilityRouter);
apiRouter.use("/tickets", ticketsRouter);
apiRouter.use("/ai-advisor", aiRateLimiter, aiAdvisorRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/warranties", warrantiesRouter);
apiRouter.use("/chat", aiRateLimiter, chatRouter);
apiRouter.use("/coupons", couponsRouter);
apiRouter.use("/notifications", notificationsRouter);


