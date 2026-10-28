const { sendSuccess } = require("../../utils/api-response");
const asyncHandler = require("../../utils/async-handler");
const paymentsService = require("./payments.service");
const { env } = require("../../config/env");

const createPayment = asyncHandler(async (req, res) => {
  const result = await paymentsService.createPayment(req.user.id, req.body || {}, req);
  return sendSuccess(res, "Payment record created successfully", result, 201);
});

const getPaymentStatus = asyncHandler(async (req, res) => {
  const result = await paymentsService.getPaymentStatus(req.user.id, req.params.paymentId, req);
  return sendSuccess(res, "Payment status fetched successfully", result);
});

const confirmPayment = asyncHandler(async (req, res) => {
  const result = await paymentsService.confirmPayment(req.user.id, req.params.paymentId, req.body || {}, req);
  return sendSuccess(res, "Payment confirmed successfully", result);
});

const handleMockCallback = asyncHandler(async (req, res) => {
  const result = await paymentsService.confirmPaymentByGateway(req.params.paymentId, req.query.result || "PAID", "Mock callback confirmed", req);
  const frontend = env.frontendUrl || process.env.FRONTEND_URL || "http://localhost:5173";
  return res.redirect(`${frontend.replace(/\/+$/, "")}/payment/result?paymentId=${result.id}`);
});

const uploadPaymentProof = asyncHandler(async (req, res) => {
  const result = await paymentsService.uploadPaymentProof(req.params.orderId, req.file, req);
  return sendSuccess(res, "Payment proof uploaded successfully", result, 200);
});

module.exports = {
  createPayment,
  getPaymentStatus,
  confirmPayment,
  handleMockCallback,
  uploadPaymentProof
};
