function sendValidationError(res, errors) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors
  });
}

function isNonEmpty(value) {
  return String(value || "").trim().length > 0;
}

function isPositiveInteger(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

function isNonNegativeNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0;
}

function validateCreateProduct(req, res, next) {
  const { name, categoryId, brandId, warrantyMonths } = req.body || {};
  const errors = [];

  if (!isNonEmpty(name)) {
    errors.push({ field: "name", message: "Name is required" });
  }

  if (!isPositiveInteger(categoryId)) {
    errors.push({ field: "categoryId", message: "categoryId must be a positive integer" });
  }

  if (!isPositiveInteger(brandId)) {
    errors.push({ field: "brandId", message: "brandId must be a positive integer" });
  }

  if (warrantyMonths !== undefined && warrantyMonths !== null && warrantyMonths !== "" && !isPositiveInteger(warrantyMonths)) {
    errors.push({ field: "warrantyMonths", message: "warrantyMonths must be a positive integer" });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

function validateUpdateProduct(req, res, next) {
  const { name, categoryId, brandId, slug, warrantyMonths } = req.body || {};
  const allowedKeys = ["name", "categoryId", "brandId", "slug", "description", "warrantyMonths", "warranty_months"];
  const hasAnyField = allowedKeys.some((key) => Object.prototype.hasOwnProperty.call(req.body || {}, key));
  const errors = [];

  if (!hasAnyField) {
    errors.push({ field: "body", message: "At least one field is required to update product" });
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "name") && !isNonEmpty(name)) {
    errors.push({ field: "name", message: "Name cannot be empty" });
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "categoryId") && !isPositiveInteger(categoryId)) {
    errors.push({ field: "categoryId", message: "categoryId must be a positive integer" });
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "brandId") && !isPositiveInteger(brandId)) {
    errors.push({ field: "brandId", message: "brandId must be a positive integer" });
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "slug") && !isNonEmpty(slug)) {
    errors.push({ field: "slug", message: "Slug cannot be empty" });
  }

  const rawMonths = req.body?.warrantyMonths ?? req.body?.warranty_months;
  if (rawMonths !== undefined && rawMonths !== null && rawMonths !== "" && !isPositiveInteger(rawMonths)) {
    errors.push({ field: "warrantyMonths", message: "warrantyMonths must be a positive integer" });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

function validateChangeProductStatus(req, res, next) {
  let status = req.body?.status;
  if (!status && typeof req.body?.isActive === "boolean") {
    status = req.body.isActive ? "ACTIVE" : "INACTIVE";
  }
  const normalizedStatus = String(status || "").trim().toUpperCase();
  const allowedStatuses = ["ACTIVE", "INACTIVE"];

  if (!allowedStatuses.includes(normalizedStatus)) {
    return sendValidationError(res, [{ field: "status", message: "status must be ACTIVE or INACTIVE" }]);
  }

  req.body.status = normalizedStatus;
  next();
}

function validateCreateVariant(req, res, next) {
  const { sku, price, stock } = req.body || {};
  const errors = [];

  if (!isNonEmpty(sku)) {
    errors.push({ field: "sku", message: "SKU is required" });
  }

  if (!isNonNegativeNumber(price)) {
    errors.push({ field: "price", message: "price must be a non-negative number" });
  }

  if (stock !== undefined && !isNonNegativeNumber(stock)) {
    errors.push({ field: "stock", message: "stock must be a non-negative number" });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

function validateCreateCompatibilityRule(req, res, next) {
  const { name, sourceComponentType, targetComponentType, ruleType, sourceAttributeKey, targetAttributeKey } = req.body || {};
  const errors = [];

  if (!isNonEmpty(name)) errors.push({ field: "name", message: "Name is required" });
  if (!isNonEmpty(sourceComponentType)) errors.push({ field: "sourceComponentType", message: "sourceComponentType is required" });
  if (!isNonEmpty(targetComponentType)) errors.push({ field: "targetComponentType", message: "targetComponentType is required" });
  if (!isNonEmpty(ruleType)) errors.push({ field: "ruleType", message: "ruleType is required" });
  if (!isNonEmpty(sourceAttributeKey)) errors.push({ field: "sourceAttributeKey", message: "sourceAttributeKey is required" });
  if (!isNonEmpty(targetAttributeKey)) errors.push({ field: "targetAttributeKey", message: "targetAttributeKey is required" });

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  req.body.ruleType = String(ruleType).trim().toUpperCase();
  next();
}

function validateUpdateCompatibilityRule(req, res, next) {
  const allowedKeys = ["name", "sourceComponentType", "targetComponentType", "ruleType", "sourceAttributeKey", "targetAttributeKey", "description"];
  const hasAnyField = allowedKeys.some((key) => Object.prototype.hasOwnProperty.call(req.body || {}, key));
  const errors = [];

  if (!hasAnyField) {
    errors.push({ field: "body", message: "At least one field is required to update compatibility rule" });
  }

  for (const key of ["name", "sourceComponentType", "targetComponentType", "ruleType", "sourceAttributeKey", "targetAttributeKey"]) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, key) && !isNonEmpty(req.body[key])) {
      errors.push({ field: key, message: `${key} cannot be empty` });
    }
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "ruleType")) {
    req.body.ruleType = String(req.body.ruleType).trim().toUpperCase();
  }

  next();
}

function validateChangeCompatibilityRuleStatus(req, res, next) {
  const allowedStatuses = ["ACTIVE", "INACTIVE"];
  const status = String(req.body?.status || "").trim().toUpperCase();

  if (!allowedStatuses.includes(status)) {
    return sendValidationError(res, [{ field: "status", message: "status must be ACTIVE or INACTIVE" }]);
  }

  req.body.status = status;
  next();
}

function validateChangeUserStatus(req, res, next) {
  const allowedStatuses = ["ACTIVE", "BLOCKED", "INACTIVE"];
  const status = String(req.body?.status || "").trim().toUpperCase();

  if (!allowedStatuses.includes(status)) {
    return sendValidationError(res, [{ field: "status", message: "status must be ACTIVE, BLOCKED or INACTIVE" }]);
  }

  req.body.status = status;
  next();
}

function validateAttribute(req, res, next) {
  if (!isNonEmpty(req.body?.name)) {
    return sendValidationError(res, [{ field: "name", message: "name is required" }]);
  }

  next();
}

function validateAttributeValue(req, res, next) {
  const errors = [];

  if (!isPositiveInteger(req.body?.attributeId)) {
    errors.push({ field: "attributeId", message: "attributeId must be a positive integer" });
  }

  if (!isNonEmpty(req.body?.value)) {
    errors.push({ field: "value", message: "value is required" });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

function validateSku(req, res, next) {
  const { productId, sku, price, stock, attributeValueIds } = req.body || {};
  const rawMonths = req.body?.warrantyMonths ?? req.body?.warranty_months;
  const errors = [];

  if (!isPositiveInteger(productId)) errors.push({ field: "productId", message: "productId must be a positive integer" });
  if (!isNonEmpty(sku)) errors.push({ field: "sku", message: "sku is required" });
  if (!isNonNegativeNumber(price)) errors.push({ field: "price", message: "price must be a non-negative number" });
  if (stock !== undefined && !isNonNegativeNumber(stock)) errors.push({ field: "stock", message: "stock must be a non-negative number" });
  if (attributeValueIds !== undefined && !Array.isArray(attributeValueIds)) errors.push({ field: "attributeValueIds", message: "attributeValueIds must be an array" });
  if (rawMonths !== undefined && rawMonths !== null && rawMonths !== "" && !isPositiveInteger(rawMonths)) {
    errors.push({ field: "warrantyMonths", message: "warrantyMonths must be a positive integer" });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

function validateUpdateSku(req, res, next) {
  const allowedKeys = ["productId", "sku", "price", "stock", "imageUrl", "status", "attributeValueIds", "warrantyMonths", "warranty_months"];
  const body = req.body || {};
  const hasAnyField = allowedKeys.some((key) => Object.prototype.hasOwnProperty.call(body, key));
  const errors = [];

  if (!hasAnyField) errors.push({ field: "body", message: "At least one field is required to update SKU" });
  if (Object.prototype.hasOwnProperty.call(body, "productId") && !isPositiveInteger(body.productId)) errors.push({ field: "productId", message: "productId must be a positive integer" });
  if (Object.prototype.hasOwnProperty.call(body, "sku") && !isNonEmpty(body.sku)) errors.push({ field: "sku", message: "sku cannot be empty" });
  if (Object.prototype.hasOwnProperty.call(body, "price") && !isNonNegativeNumber(body.price)) errors.push({ field: "price", message: "price must be a non-negative number" });
  if (Object.prototype.hasOwnProperty.call(body, "stock") && !isNonNegativeNumber(body.stock)) errors.push({ field: "stock", message: "stock must be a non-negative number" });
  if (Object.prototype.hasOwnProperty.call(body, "attributeValueIds") && !Array.isArray(body.attributeValueIds)) errors.push({ field: "attributeValueIds", message: "attributeValueIds must be an array" });
  const rawMonths = body.warrantyMonths ?? body.warranty_months;
  if (rawMonths !== undefined && rawMonths !== null && rawMonths !== "" && !isPositiveInteger(rawMonths)) {
    errors.push({ field: "warrantyMonths", message: "warrantyMonths must be a positive integer" });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

function validateAssignSkuAttributes(req, res, next) {
  if (!Array.isArray(req.body?.attributeValueIds)) {
    return sendValidationError(res, [{ field: "attributeValueIds", message: "attributeValueIds must be an array" }]);
  }

  next();
}

function validateSystemSettings(req, res, next) {
  const allowedKeys = ["store_name", "support_email", "support_phone", "online_payment_mode", "shipping_mode", "maintenance_mode"];
  const body = req.body || {};
  const hasAnyField = allowedKeys.some((key) => Object.prototype.hasOwnProperty.call(body, key));

  if (!hasAnyField) {
    return sendValidationError(res, [{ field: "body", message: "At least one system setting is required" }]);
  }

  return next();
}

module.exports = {
  validateCreateProduct,
  validateUpdateProduct,
  validateChangeProductStatus,
  validateCreateVariant,
  validateCreateCompatibilityRule,
  validateUpdateCompatibilityRule,
  validateChangeCompatibilityRuleStatus,
  validateChangeUserStatus,
  validateAttribute,
  validateAttributeValue,
  validateSku,
  validateUpdateSku,
  validateAssignSkuAttributes,
  validateSystemSettings
};
