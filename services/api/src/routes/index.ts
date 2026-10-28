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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const aiRouter = require("../modules/ai/ai.route");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const productsRouter = require("../modules/products/products.route");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const adminRouter = require("../modules/admin/admin.route");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const staffRouter = require("../modules/staff/staff.route");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const shipmentsRouter = require("../modules/shipments/shipments.route");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const paymentsRouter = require("../modules/payments/payments.route");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const compatibilityRouter = require("../modules/compatibility/compatibility.route");

import { authRateLimiter, aiRateLimiter, generalApiLimiter } from "../middlewares/rate-limiter.middleware";

export const apiRouter = Router();

apiRouter.use(generalApiLimiter);

apiRouter.get("/health", async (_req, res) => {
  const database = await checkDatabaseConnection();
  const isReady = database.connected;

  res.status(isReady ? 200 : 503).json({
    status: isReady ? "ok" : "degraded",
    service: "api",
    timestamp: new Date().toISOString(),
    database
  });
});

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
apiRouter.use("/ai", aiRateLimiter, aiRouter);
apiRouter.use("/warranties", warrantiesRouter);
apiRouter.use("/chat", aiRateLimiter, chatRouter);
apiRouter.use("/coupons", couponsRouter);
apiRouter.use("/notifications", notificationsRouter);


