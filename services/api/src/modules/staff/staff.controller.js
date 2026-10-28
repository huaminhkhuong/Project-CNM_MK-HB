const { sendSuccess } = require("../../utils/api-response");
const asyncHandler = require("../../utils/async-handler");
const ordersService = require("../orders/orders.service");
const serialsService = require("../serials/serials.service");
const { recordAuditLog } = require("../../services/audit-log.service");

const getProcessingOrders = asyncHandler(async (req, res) => {
  const result = await ordersService.getProcessingOrders(req.query || {});
  return sendSuccess(res, "Orders for staff fetched successfully", result);
});

const getStaffOrderDetail = asyncHandler(async (req, res) => {
  const result = await ordersService.getOrderDetail(req.user, req.params.orderId);
  return sendSuccess(res, "Staff order detail fetched successfully", result);
});

const updateStaffOrderStatus = asyncHandler(async (req, res) => {
  const result = await ordersService.updateOrderStatus(req.user, req.params.orderId, req.body || {});
  await recordAuditLog({
    actorUserId: req.user?.id,
    actorRole: req.user?.role,
    action: "STAFF_ORDER_STATUS_UPDATED",
    entityType: "ORDER",
    entityId: req.params.orderId,
    description: `Staff updated order #${req.params.orderId} to ${req.body?.status}`,
    metadata: { status: req.body?.status, reason: req.body?.reason || null }
  });
  return sendSuccess(res, "Order status updated successfully", result);
});

const createShipment = asyncHandler(async (req, res) => {
  const result = await ordersService.createMockShipment(req.user, req.params.orderId, req.body || {});
  await recordAuditLog({
    actorUserId: req.user?.id,
    actorRole: req.user?.role,
    action: "SHIPMENT_CREATED_OR_UPDATED",
    entityType: "ORDER",
    entityId: req.params.orderId,
    description: `Created or updated shipment for order #${req.params.orderId}`,
    metadata: {
      trackingCode: req.body?.trackingCode || result?.shipment?.trackingCode || null,
      status: req.body?.status || result?.shipment?.status || null
    }
  });
  return sendSuccess(res, "Shipment created successfully", result, 201);
});

const updateConsultationNote = asyncHandler(async (req, res) => {
  const result = await ordersService.updateConsultationNote(req.user, req.params.orderId, req.body?.note);
  await recordAuditLog({
    actorUserId: req.user?.id,
    actorRole: req.user?.role,
    action: "ORDER_CONSULTATION_NOTE_UPDATED",
    entityType: "ORDER",
    entityId: req.params.orderId,
    description: `Updated consultation note for order #${req.params.orderId}`
  });
  return sendSuccess(res, "Consultation note updated successfully", result);
});

const getOrderSerials = asyncHandler(async (req, res) => {
  const result = await serialsService.getOrderSerialInfo(req.params.orderId);
  return sendSuccess(res, "Thông tin Serial Number của đơn hàng", result);
});

const assignOrderSerials = asyncHandler(async (req, res) => {
  const result = await serialsService.assignOrderSerials({
    orderId: req.params.orderId,
    assignments: req.body?.assignments || [],
    staffUserId: req.user?.id
  });
  await recordAuditLog({
    actorUserId: req.user?.id,
    actorRole: req.user?.role,
    action: "ORDER_SERIALS_ASSIGNED",
    entityType: "ORDER",
    entityId: req.params.orderId,
    description: `Gán Serial Number cho đơn hàng #${req.params.orderId}`,
    metadata: {
      totalAssigned: result.totalAssignedSerials,
      isFullyAssigned: result.isFullyAssigned
    }
  });
  return sendSuccess(res, "Gán Serial Number cho đơn hàng thành công", result);
});

const autoGenerateMockSerials = asyncHandler(async (req, res) => {
  const result = await serialsService.autoGenerateMockSerials(req.params.orderId, req.user?.id);
  await recordAuditLog({
    actorUserId: req.user?.id,
    actorRole: req.user?.role,
    action: "ORDER_SERIALS_AUTO_GENERATED",
    entityType: "ORDER",
    entityId: req.params.orderId,
    description: `Tự động sinh Serial Number mẫu cho đơn hàng #${req.params.orderId}`,
    metadata: { totalAssigned: result.totalAssignedSerials }
  });
  return sendSuccess(res, "Tự động sinh Serial Number mẫu thành công", result);
});

module.exports = {
  getProcessingOrders,
  getStaffOrderDetail,
  updateStaffOrderStatus,
  createShipment,
  updateConsultationNote,
  getOrderSerials,
  assignOrderSerials,
  autoGenerateMockSerials
};
