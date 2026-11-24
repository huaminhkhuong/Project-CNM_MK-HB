function sendValidationError(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors
  });
}

function validateCreatePayment(req, res, next) {
  const { orderId, order_id } = req.body || {};
  const value = Number(orderId || order_id);
  const errors = [];

  if (!Number.isInteger(value) || value <= 0) {
    errors.push({ field: "orderId", message: "orderId must be a positive integer" });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  return next();
}

function validateConfirmPayment(req, res, next) {
  const status = String(req.body?.status || req.body?.result || "").trim().toUpperCase();
  const allowed = ["PAID", "FAILED", "CANCELED"];
  const errors = [];

  if (status && !allowed.includes(status)) {
    errors.push({ field: "status", message: `status must be one of: ${allowed.join(", ")}` });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  return next();
}

export {
  validateCreatePayment,
  validateConfirmPayment
};
export default {
  validateCreatePayment,
  validateConfirmPayment
};
