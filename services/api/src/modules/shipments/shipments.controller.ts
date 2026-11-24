import { sendSuccess  } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import * as shipmentsService from "./shipments.service";

const createShipment = asyncHandler(async (req, res) => {
  const result = await shipmentsService.createShipment(req.user, req.body || {});
  return sendSuccess(res, "Shipment created successfully", result, 201);
});

const updateShipmentStatus = asyncHandler(async (req, res) => {
  const result = await shipmentsService.updateShipmentStatus(req.user, req.params.shipmentId, req.body || {});
  return sendSuccess(res, "Shipment status updated successfully", result);
});

const getShipmentByOrder = asyncHandler(async (req, res) => {
  const result = await shipmentsService.getShipmentByOrder(req.user, req.params.orderId);
  return sendSuccess(res, "Shipment fetched successfully", result);
});

export {
  createShipment,
  updateShipmentStatus,
  getShipmentByOrder
};
export default {
  createShipment,
  updateShipmentStatus,
  getShipmentByOrder
};
