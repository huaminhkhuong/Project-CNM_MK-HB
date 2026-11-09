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
import { sanitizeInputMiddleware } from "./middlewares/sanitize.middleware";
import { apiRouter } from "./routes";

(BigInt.prototype as any).toJSON = function () {
  const num = Number(this);
  return Number.isSafeInteger(num) ? num : this.toString();
};

export function createApp() {
  const app = express();
  const uploadsDirs = [
    path.resolve(process.cwd(), "services/api/uploads"),
    path.resolve(__dirname, "../uploads")
  ];

  app.set("etag", false);

  // 1. Production-grade Helmet Security Headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
      frameguard: { action: "sameorigin" },
      hidePoweredBy: true,
      ieNoOpen: true,
      noSniff: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" }
    })
  );

  // 2. Strict CORS Configuration (Production vs Dev/Test)
  const isProd = process.env.NODE_ENV === "production";
  const configuredFrontend = (env.frontendUrl || "").replace(/\/+$/, "");
  const extraOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  const allowedOrigins = isProd
    ? Array.from(new Set([configuredFrontend, ...extraOrigins].filter(Boolean)))
    : Array.from(new Set([configuredFrontend, "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", ...extraOrigins].filter(Boolean)));

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow mobile apps, curl, postman, and same-origin requests with no origin header
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        if (!isProd && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked for unauthorized origin: ${origin}`));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
    })
  );

  app.use(requestLogger);
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true, limit: "5mb" }));

  // 3. Input Sanitization against XSS & script injection
  app.use(sanitizeInputMiddleware);

  // Swagger API Documentation Page
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });
  
  // Serve static files from uploads and data directories.
  uploadsDirs.forEach((uploadsDir) => {
    app.use("/uploads", express.static(uploadsDir));
  });
  const dataDirCandidates = [
    path.resolve(process.cwd(), "data"),
    path.resolve(process.cwd(), "../../data"),
    path.resolve(__dirname, "../../data"),
    path.resolve(__dirname, "../../../data")
  ];
  dataDirCandidates.forEach((d) => {
    app.use("/data", express.static(d));
    app.use("/data/images", express.static(path.join(d, "images")));
  });
  
  app.use("/api", apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
