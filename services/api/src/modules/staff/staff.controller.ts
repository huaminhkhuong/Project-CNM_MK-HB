import { sendSuccess  } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import * as ordersService from "../orders/orders.service";
import { recordAuditLog  } from "../../services/audit-log.service";

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

export {
  getProcessingOrders,
  getStaffOrderDetail,
  updateStaffOrderStatus,
  createShipment,
  updateConsultationNote
};
export default {
  getProcessingOrders,
  getStaffOrderDetail,
  updateStaffOrderStatus,
  createShipment,
  updateConsultationNote
};
