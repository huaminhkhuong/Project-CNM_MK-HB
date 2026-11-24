function sendValidationError(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors
  });
}

function validateCreateShipment(req, res, next) {
  const { orderId, order_id } = req.body || {};
  const parsedOrderId = Number(orderId || order_id);
  const errors = [];

  if (!Number.isInteger(parsedOrderId) || parsedOrderId <= 0) {
    errors.push({ field: "orderId", message: "orderId must be a positive integer" });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

function validateUpdateShipmentStatus(req, res, next) {
  const { status } = req.body || {};
  const errors = [];

  if (!String(status || "").trim()) {
    errors.push({ field: "status", message: "status is required" });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

export {
  validateCreateShipment,
  validateUpdateShipmentStatus
};
export default {
  validateCreateShipment,
  validateUpdateShipmentStatus
};
