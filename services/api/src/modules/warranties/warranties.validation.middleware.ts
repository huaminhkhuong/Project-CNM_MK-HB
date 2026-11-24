function sendValidationError(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors
  });
}

function validateActivateWarranty(req, res, next) {
  const { orderItemId, order_item_id } = req.body || {};
  const errors = [];
  const parsed = Number(orderItemId || order_item_id);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    errors.push({ field: "orderItemId", message: "orderItemId must be a positive integer" });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

export {
  validateActivateWarranty
};
export default {
  validateActivateWarranty
};
