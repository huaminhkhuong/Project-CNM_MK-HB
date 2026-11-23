import { env } from "../config/env";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sepayService = require("../modules/payments/sepay.service");

let sepayWorkerTimer: NodeJS.Timeout | null = null;

/**
 * Background reconciliation worker that polls SePay User API when unpaid BANK_TRANSFER orders exist.
 * Works seamlessly on localhost without requiring cloudflared/ngrok, and acts as a fallback reconciler in production.
 */
export function startSepaySyncWorker(intervalMs?: number) {
  const effectiveInterval = Math.max(3000, Number(intervalMs || env.sepaySyncIntervalMs || 5000));

  if (sepayWorkerTimer) {
    clearInterval(sepayWorkerTimer);
  }

  const hasToken = Boolean(env.sepayApiToken && !env.sepayApiToken.toLowerCase().startsWith("your_"));
  if (hasToken) {
    console.log(`[SePaySyncWorker] Started (poll interval: ${effectiveInterval / 1000}s when unpaid VietQR orders exist).`);
  } else {
    console.log(`[SePaySyncWorker] Standby (SEPAY_API_TOKEN not set yet — relying on SePay Webhook until token is added).`);
  }

  sepayWorkerTimer = setInterval(() => {
    sepayService.syncPendingSepayOrders().catch(() => {});
  }, effectiveInterval);

  if (typeof sepayWorkerTimer.unref === "function") {
    sepayWorkerTimer.unref();
  }

  return sepayWorkerTimer;
}

export function stopSepaySyncWorker() {
  if (sepayWorkerTimer) {
    clearInterval(sepayWorkerTimer);
    sepayWorkerTimer = null;
    console.log("[SePaySyncWorker] Stopped.");
  }
}

