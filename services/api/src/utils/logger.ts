import pino from "pino";
import { env } from "../config/env";

export const pinoLogger = pino({
  level: env.nodeEnv === "production" ? "info" : "debug",
  transport:
    env.nodeEnv === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname"
          }
        }
      : undefined
});

export const logger = {
  error(err: Error | any, context: Record<string, any> = {}) {
    pinoLogger.error(
      {
        err: err instanceof Error ? { message: err.message, stack: err.stack, name: err.name } : err,
        ...context
      },
      err?.message || String(err)
    );

    // Optional Sentry integration when SENTRY_DSN environment variable is present
    if (process.env.SENTRY_DSN) {
      try {
        const Sentry = require("@sentry/node");
        Sentry.captureException(err, { extra: context });
      } catch (_e) {
        // Sentry package optional
      }
    }
  },

  warn(message: string, context: Record<string, any> = {}) {
    pinoLogger.warn(context, message);
  },

  info(message: string, context: Record<string, any> = {}) {
    pinoLogger.info(context, message);
  },

  debug(message: string, context: Record<string, any> = {}) {
    pinoLogger.debug(context, message);
  }
};
