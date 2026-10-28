import { env } from "../config/env";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ordersService = require("../modules/orders/orders.service");

let workerTimer: NodeJS.Timeout | null = null;
let isProcessing = false;

export interface PaymentTimeoutWorkerOptions {
  intervalMs?: number;
  timeoutMinutes?: number;
}

/**
 * Sweeps the database for orders left in PENDING/PENDING_GATEWAY past the expiration threshold,
 * cancels them, and restores product inventory atomically.
 */
export async function processPaymentTimeouts(timeoutMinutes?: number) {
  if (isProcessing) {
    return null;
  }

  isProcessing = true;
  try {
    const targetTimeout = timeoutMinutes ?? env.paymentTimeoutMinutes ?? 30;
    const result = await ordersService.cancelExpiredPendingOrders({
      timeoutMinutes: targetTimeout
    });

    if (result && result.expiredCount > 0) {
      console.log(
        `[PaymentTimeoutWorker] Auto-canceled ${result.expiredCount} expired pending gateway order(s) (IDs: ${result.orderIds.join(
          ", "
        )}) after ${result.timeoutMinutes}m timeout. Stock atomically restored to inventory.`
      );
    }
    return result;
  } catch (error: any) {
    console.error("[PaymentTimeoutWorker] Error during expired order sweep:", error?.message || error);
    return null;
  } finally {
    isProcessing = false;
  }
}

/**
 * Starts the payment timeout background worker.
 * Default interval: every 60 seconds.
 * Default threshold: 30 minutes.
 */
export function startPaymentTimeoutWorker(options: PaymentTimeoutWorkerOptions = {}) {
  const intervalMs = options.intervalMs || 60000;
  const timeoutMinutes = options.timeoutMinutes || env.paymentTimeoutMinutes || 30;

  if (workerTimer) {
    clearInterval(workerTimer);
  }

  console.log(
    `[PaymentTimeoutWorker] Started (sweep interval: ${intervalMs / 1000}s, expiration threshold: ${timeoutMinutes} minutes).`
  );

  // Initial sweep after 5 seconds to catch orders left over from server downtime
  setTimeout(() => {
    processPaymentTimeouts(timeoutMinutes).catch(() => {});
  }, 5000);

  workerTimer = setInterval(() => {
    processPaymentTimeouts(timeoutMinutes).catch(() => {});
  }, intervalMs);

  if (typeof workerTimer.unref === "function") {
    workerTimer.unref();
  }

  return workerTimer;
}

/**
 * Gracefully shuts down the background worker.
 */
export function stopPaymentTimeoutWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
    console.log("[PaymentTimeoutWorker] Stopped.");
  }
}
