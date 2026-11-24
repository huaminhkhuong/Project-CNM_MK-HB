import { env  } from "../../../config/env";

function generateTrackingCode(orderId, carrier = "GHTK") {
  const prefix = String(carrier || "GHTK")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8) || "MOCK";
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-MOCK-${orderId}-${timestamp}-${random}`;
}

function createShipmentPayload(orderId, payload: any = {}) {
  const carrier = String(payload.carrier || payload.provider || env.shippingProvider || "manual").trim();
  const providedTrackingCode = String(payload.trackingCode || "").trim();
  const canGenerateMockTracking = env.shippingMockMode || env.nodeEnv !== "production";

  if (!providedTrackingCode && !canGenerateMockTracking) {
    const error = new Error("Tracking code is required when shipping mock mode is disabled");
    (error as any).statusCode = 503;
    throw error;
  }

  return {
    trackingCode: providedTrackingCode || generateTrackingCode(orderId, carrier),
    status: String(payload.status || "CREATED").trim().toUpperCase() || "CREATED",
    provider: carrier || "manual"
  };
}

export {
  createShipmentPayload,
  generateTrackingCode
};
export default {
  createShipmentPayload,
  generateTrackingCode
};
