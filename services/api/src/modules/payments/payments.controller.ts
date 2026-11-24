import { sendSuccess  } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import * as paymentsService from "./payments.service";
import { env  } from "../../config/env";

const createPayment = asyncHandler(async (req, res) => {
  const result = await paymentsService.createPayment(req.user.id, req.body || {});
  return sendSuccess(res, "Payment record created successfully", result, 201);
});

const getPaymentStatus = asyncHandler(async (req, res) => {
  const result = await paymentsService.getPaymentStatus(req.user.id, req.params.paymentId);
  return sendSuccess(res, "Payment status fetched successfully", result);
});

const confirmPayment = asyncHandler(async (req, res) => {
  const result = await paymentsService.confirmPayment(req.user.id, req.params.paymentId, req.body || {});
  return sendSuccess(res, "Payment confirmed successfully", result);
});

const handleMockCallback = asyncHandler(async (req, res) => {
  const result = await paymentsService.confirmPaymentByGateway(req.params.paymentId, req.query.result || "PAID", "Mock callback confirmed");
  return res.redirect(`${env.frontendUrl}/payment/result?paymentId=${result.id}`);
});

export {
  createPayment,
  getPaymentStatus,
  confirmPayment,
  handleMockCallback
};
export default {
  createPayment,
  getPaymentStatus,
  confirmPayment,
  handleMockCallback
};
