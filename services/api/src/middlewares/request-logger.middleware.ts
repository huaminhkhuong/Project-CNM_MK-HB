import { NextFunction, Request, Response } from "express";

import { env } from "../config/env";
import { pinoLogger } from "../utils/logger";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const entry = {
      service: "api",
      env: env.nodeEnv,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs
    };

    const message = `${req.method} ${req.originalUrl} ${res.statusCode} (${durationMs}ms)`;
    if (res.statusCode >= 500) {
      pinoLogger.error(entry, message);
    } else if (res.statusCode >= 400) {
      pinoLogger.warn(entry, message);
    } else {
      pinoLogger.info(entry, message);
    }
  });

  next();
}
