const { sendSuccess } = require("../../utils/api-response");
const asyncHandler = require("../../utils/async-handler");
const adminService = require("./admin.service");
const attributeService = require("./admin-attributes.service");
const skuService = require("./admin-skus.service");
const adminSystemService = require("./admin-system.service");
const adminReportsService = require("./admin-reports.service");
const { recordAuditLog } = require("../../services/audit-log.service");

function getActorUserId(req) {
  return req.user?.userId ?? req.user?.id ?? null;
}

const getDashboardSummary = asyncHandler(async (_req, res) => {
  const result = await adminService.getDashboardSummary();
  return sendSuccess(res, "Admin dashboard fetched successfully", result);
});

const getProducts = asyncHandler(async (req, res) => {
  const result = await adminService.getProducts(req.query || {});
  return sendSuccess(res, "Admin products fetched successfully", result);
});

const createProduct = asyncHandler(async (req, res) => {
  const result = await adminService.createProduct(req.body || {});
  await recordAuditLog({
    actorUserId: getActorUserId(req),
    actorRole: req.user?.role,
    action: "PRODUCT_CREATED",
    entityType: "PRODUCT",
    entityId: result?.id,
    description: `Created product ${result?.name || ""}`.trim()
  });
  return sendSuccess(res, "Product created successfully", result, 201);
});

const updateProduct = asyncHandler(async (req, res) => {
  const result = await adminService.updateProduct(req.params.productId, req.body || {});
  await recordAuditLog({
    actorUserId: getActorUserId(req),
    actorRole: req.user?.role,
    action: "PRODUCT_UPDATED",
    entityType: "PRODUCT",
    entityId: req.params.productId,
    description: `Updated product #${req.params.productId}`
  });
  return sendSuccess(res, "Product updated successfully", result);
});

const changeProductStatus = asyncHandler(async (req, res) => {
  const result = await adminService.changeProductStatus(req.params.productId, req.body.status);
  await recordAuditLog({
    actorUserId: getActorUserId(req),
    actorRole: req.user?.role,
    action: "PRODUCT_STATUS_UPDATED",
    entityType: "PRODUCT",
    entityId: req.params.productId,
    description: `Changed product #${req.params.productId} status to ${req.body.status}`
  });
  return sendSuccess(res, "Product status updated successfully", result);
});

const deleteProduct = asyncHandler(async (req, res) => {
  const result = await adminService.deleteProduct(req.params.productId);
  await recordAuditLog({
    actorUserId: getActorUserId(req),
    actorRole: req.user?.role,
    action: "PRODUCT_DELETED",
    entityType: "PRODUCT",
    entityId: req.params.productId,
    description: `Deleted product #${req.params.productId}`
  });
  return sendSuccess(res, "Product deleted successfully", result);
});

const createVariant = asyncHandler(async (req, res) => {
  const result = await adminService.createVariant(req.params.productId, req.body || {});
  await recordAuditLog({
    actorUserId: getActorUserId(req),
    actorRole: req.user?.role,
    action: "PRODUCT_VARIANT_CREATED",
    entityType: "PRODUCT",
    entityId: req.params.productId,
    description: `Created variant for product #${req.params.productId}`
  });
  return sendSuccess(res, "Product variant created successfully", result, 201);
});

const getUsers = asyncHandler(async (req, res) => {
  const result = await adminService.getUsers(req.query || {});
  return sendSuccess(res, "Admin users fetched successfully", result);
});

const changeUserStatus = asyncHandler(async (req, res) => {
  const actorUserId = getActorUserId(req);
  const result = await adminService.changeUserStatus(req.params.userId, req.body.status, actorUserId);
  await recordAuditLog({
    actorUserId,
    actorRole: req.user?.role,
    action: "USER_STATUS_UPDATED",
    entityType: "USER",
    entityId: req.params.userId,
    description: `Changed user #${req.params.userId} status to ${req.body.status}`
  });
  return sendSuccess(res, "User status updated successfully", result);
});

const changeUserRole = asyncHandler(async (req, res) => {
  const actorUserId = getActorUserId(req);
  const result = await adminService.changeUserRole(req.params.userId, req.body.role, actorUserId);
  await recordAuditLog({
    actorUserId,
    actorRole: req.user?.role,
    action: "USER_ROLE_UPDATED",
    entityType: "USER",
    entityId: req.params.userId,
    description: `Changed user #${req.params.userId} role to ${req.body.role}`
  });
  return sendSuccess(res, "User role updated successfully", result);
});

const getCompatibilityRules = asyncHandler(async (_req, res) => {
  const result = await adminService.getCompatibilityRules();
  return sendSuccess(res, "Compatibility rules fetched successfully", result);
});

const createCompatibilityRule = asyncHandler(async (req, res) => {
  const result = await adminService.createCompatibilityRule(req.body || {});
  await recordAuditLog({
    actorUserId: getActorUserId(req),
    actorRole: req.user?.role,
    action: "COMPATIBILITY_RULE_CREATED",
    entityType: "COMPATIBILITY_RULE",
    entityId: result?.id,
    description: "Created compatibility rule"
  });
  return sendSuccess(res, "Compatibility rule created successfully", result, 201);
});

const updateCompatibilityRule = asyncHandler(async (req, res) => {
  const result = await adminService.updateCompatibilityRule(req.params.ruleId, req.body || {});
  await recordAuditLog({
    actorUserId: getActorUserId(req),
    actorRole: req.user?.role,
    action: "COMPATIBILITY_RULE_UPDATED",
    entityType: "COMPATIBILITY_RULE",
    entityId: req.params.ruleId,
    description: `Updated compatibility rule #${req.params.ruleId}`
  });
  return sendSuccess(res, "Compatibility rule updated successfully", result);
});

const changeCompatibilityRuleStatus = asyncHandler(async (req, res) => {
  const result = await adminService.changeCompatibilityRuleStatus(req.params.ruleId, req.body.status);
  await recordAuditLog({
    actorUserId: getActorUserId(req),
    actorRole: req.user?.role,
    action: "COMPATIBILITY_RULE_STATUS_UPDATED",
    entityType: "COMPATIBILITY_RULE",
    entityId: req.params.ruleId,
    description: `Changed compatibility rule #${req.params.ruleId} status to ${req.body.status}`
  });
  return sendSuccess(res, "Compatibility rule status updated successfully", result);
});

const getAttributes = asyncHandler(async (_req, res) => {
  const result = await attributeService.getAttributes();
  return sendSuccess(res, "Attributes fetched successfully", result);
});

const createAttribute = asyncHandler(async (req, res) => {
  const result = await attributeService.createAttribute(req.body || {});
  await recordAuditLog({
    actorUserId: getActorUserId(req),
    actorRole: req.user?.role,
    action: "ATTRIBUTE_CREATED",
    entityType: "ATTRIBUTE",
    entityId: result?.id,
    description: `Created attribute ${result?.name || ""}`.trim()
  });
  return sendSuccess(res, "Attribute created successfully", result, 201);
});

const updateAttribute = asyncHandler(async (req, res) => {
  const result = await attributeService.updateAttribute(req.params.attributeId, req.body || {});
  await recordAuditLog({
    actorUserId: getActorUserId(req),
    actorRole: req.user?.role,
    action: "ATTRIBUTE_UPDATED",
    entityType: "ATTRIBUTE",
    entityId: req.params.attributeId,
    description: `Updated attribute #${req.params.attributeId}`
  });
  return sendSuccess(res, "Attribute updated successfully", result);
});

const deleteAttribute = asyncHandler(async (req, res) => {
  const result = await attributeService.deleteAttribute(req.params.attributeId);
  await recordAuditLog({
    actorUserId: getActorUserId(req),
    actorRole: req.user?.role,
    action: "ATTRIBUTE_DELETED",
    entityType: "ATTRIBUTE",
    entityId: req.params.attributeId,
    description: `Deleted attribute #${req.params.attributeId}`
  });
  return sendSuccess(res, "Attribute deleted successfully", result);
});

const getAttributeValues = asyncHandler(async (req, res) => {
  const result = await attributeService.getAttributeValues(req.query || {});
  return sendSuccess(res, "Attribute values fetched successfully", result);
});

const createAttributeValue = asyncHandler(async (req, res) => {
  const result = await attributeService.createAttributeValue(req.body || {});
  await recordAuditLog({
    actorUserId: getActorUserId(req),
    actorRole: req.user?.role,
    action: "ATTRIBUTE_VALUE_CREATED",
    entityType: "ATTRIBUTE_VALUE",
    entityId: result?.id,
    description: "Created attribute value"
  });
  return sendSuccess(res, "Attribute value created successfully", result, 201);
});

const updateAttributeValue = asyncHandler(async (req, res) => {
  const result = await attributeService.updateAttributeValue(req.params.attributeValueId, req.body || {});
  await recordAuditLog({
    actorUserId: getActorUserId(req),
    actorRole: req.user?.role,
    action: "ATTRIBUTE_VALUE_UPDATED",
    entityType: "ATTRIBUTE_VALUE",
    entityId: req.params.attributeValueId,
    description: `Updated attribute value #${req.params.attributeValueId}`
  });
  return sendSuccess(res, "Attribute value updated successfully", result);
});

const deleteAttributeValue = asyncHandler(async (req, res) => {
  const result = await attributeService.deleteAttributeValue(req.params.attributeValueId);
  await recordAuditLog({
    actorUserId: getActorUserId(req),
    actorRole: req.user?.role,
    action: "ATTRIBUTE_VALUE_DELETED",
    entityType: "ATTRIBUTE_VALUE",
    entityId: req.params.attributeValueId,
    description: `Deleted attribute value #${req.params.attributeValueId}`
  });
  return sendSuccess(res, "Attribute value deleted successfully", result);
});

const getSkus = asyncHandler(async (req, res) => {
  const result = await skuService.getSkus(req.query || {});
  return sendSuccess(res, "SKUs fetched successfully", result);
});

const getSkuDetail = asyncHandler(async (req, res) => {
  const result = await skuService.getSkuDetail(req.params.skuId);
  return sendSuccess(res, "SKU fetched successfully", result);
});

const createSku = asyncHandler(async (req, res) => {
  const result = await skuService.createSku(req.body || {});
  await recordAuditLog({
    actorUserId: getActorUserId(req),
    actorRole: req.user?.role,
    action: "SKU_CREATED",
    entityType: "SKU",
    entityId: result?.id,
    description: `Created SKU ${result?.sku || ""}`.trim()
  });
  return sendSuccess(res, "SKU created successfully", result, 201);
});

const updateSku = asyncHandler(async (req, res) => {
  const result = await skuService.updateSku(req.params.skuId, req.body || {});
  await recordAuditLog({
    actorUserId: getActorUserId(req),
    actorRole: req.user?.role,
    action: "SKU_UPDATED",
    entityType: "SKU",
    entityId: req.params.skuId,
    description: `Updated SKU #${req.params.skuId}`
  });
  return sendSuccess(res, "SKU updated successfully", result);
});

const deleteSku = asyncHandler(async (req, res) => {
  const result = await skuService.deleteSku(req.params.skuId);
  await recordAuditLog({
    actorUserId: getActorUserId(req),
    actorRole: req.user?.role,
    action: "SKU_DELETED",
    entityType: "SKU",
    entityId: req.params.skuId,
    description: `Deleted SKU #${req.params.skuId}`
  });
  return sendSuccess(res, "SKU deleted successfully", result);
});

const assignSkuAttributes = asyncHandler(async (req, res) => {
  const result = await skuService.assignAttributesToSku(req.params.skuId, req.body.attributeValueIds || []);
  await recordAuditLog({
    actorUserId: getActorUserId(req),
    actorRole: req.user?.role,
    action: "SKU_ATTRIBUTES_UPDATED",
    entityType: "SKU",
    entityId: req.params.skuId,
    description: `Updated SKU attributes for #${req.params.skuId}`,
    metadata: { attributeValueIds: req.body.attributeValueIds || [] }
  });
  return sendSuccess(res, "SKU attributes updated successfully", result);
});

const getSystemOverview = asyncHandler(async (_req, res) => {
  const result = await adminSystemService.getSystemOverview();
  return sendSuccess(res, "System overview fetched successfully", result);
});

const getSalesReport = asyncHandler(async (req, res) => {
  const result = await adminReportsService.getSalesReport(req.query || {});
  return sendSuccess(res, "Sales report fetched successfully", result);
});

const getSystemSettings = asyncHandler(async (_req, res) => {
  const result = await adminSystemService.getSettings();
  return sendSuccess(res, "System settings fetched successfully", result);
});

const updateSystemSettings = asyncHandler(async (req, res) => {
  const result = await adminSystemService.updateSettings(req.body || {});
  await recordAuditLog({
    actorUserId: getActorUserId(req),
    actorRole: req.user?.role,
    action: "SYSTEM_SETTINGS_UPDATED",
    entityType: "SYSTEM_SETTINGS",
    entityId: "global",
    description: "Updated system settings",
    metadata: req.body || {}
  });
  return sendSuccess(res, "System settings updated successfully", result);
});

const getPublicStoreInfo = asyncHandler(async (_req, res) => {
  const result = await adminSystemService.getPublicStoreInfo();
  return sendSuccess(res, "Public store info fetched successfully", result);
});

module.exports = {
  getDashboardSummary,
  getProducts,
  createProduct,
  updateProduct,
  changeProductStatus,
  deleteProduct,
  createVariant,
  getUsers,
  changeUserStatus,
  changeUserRole,
  getCompatibilityRules,
  createCompatibilityRule,
  updateCompatibilityRule,
  changeCompatibilityRuleStatus,
  getAttributes,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  getAttributeValues,
  createAttributeValue,
  updateAttributeValue,
  deleteAttributeValue,
  getSkus,
  getSkuDetail,
  createSku,
  updateSku,
  deleteSku,
  assignSkuAttributes,
  getSystemOverview,
  getSalesReport,
  getSystemSettings,
  updateSystemSettings,
  getPublicStoreInfo
};
