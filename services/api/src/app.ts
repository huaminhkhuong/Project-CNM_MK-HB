import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { swaggerSpec } from "./config/swagger";
import { errorHandler } from "./middlewares/error.middleware";
import { notFoundHandler } from "./middlewares/not-found.middleware";
import { requestLogger } from "./middlewares/request-logger.middleware";
import { apiRouter } from "./routes";

(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

export function createApp() {
  const app = express();
  const uploadsDirs = [
    path.resolve(process.cwd(), "services/api/uploads"),
    path.resolve(__dirname, "../uploads")
  ];

  app.set("etag", false);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false
    })
  );
  app.use(cors({ origin: [env.frontendUrl, "http://localhost:5173", "http://127.0.0.1:5173"], credentials: true }));
  app.use(requestLogger);
  app.use(express.json());

  // Swagger API Documentation Page
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });
  
  // Serve static files from uploads directory.
  uploadsDirs.forEach((uploadsDir) => {
    app.use("/uploads", express.static(uploadsDir));
  });
  
  app.use("/api", apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
