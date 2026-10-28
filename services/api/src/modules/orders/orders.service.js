/**
 * Orders Service Module (Unified Orchestration Façade)
 * Refactored from monolithic 1,800 lines into specialized domain sub-services:
 *   - orders.common.js: Shared schema config, DTO formatting, and common helpers
 *   - order-creation.service.js: Checkout validation, pricing, coupons, order placement
 *   - order-query.service.js: Customer, staff, admin order detail & listing queries
 *   - order-inventory.service.js: Atomic inventory deduction and stock restoration
 *   - order-cancellation.service.js: Customer cancellation and automated gateway timeout expiration
 *   - order-status.service.js: Order lifecycle transitions, payments, shipments, proof approvals
 */

const {
  ORDER_STATUSES,
  STAFF_VISIBLE_STATUSES,
  ORDER_STATUS_TRANSITIONS,
  toMoney,
  toActor,
  canManageOrders,
  normalizeOrderStatus,
  repairLegacyPaidOrdersForStaff,
  getSchemaConfig,
  buildAddressText,
  getCartByUserId,
  getAddressById,
  getCartItemsForCheckout,
  buildOrderInsertData,
  buildOrderItemInsertData,
  baseOrderSelect,
  getOrderRowById,
  getOrderRowByIdAny,
  getShipmentByOrderId,
  getCustomerByUserId,
  getOrderItemsByOrderId,
  formatOrderSummary,
  formatShipment
} = require("./orders.common");

const { createOrderFromCart } = require("./order-creation.service");
const { getMyOrders, getAllOrders, getProcessingOrders, getOrderDetail } = require("./order-query.service");
const { restoreOrderInventory } = require("./order-inventory.service");
const { cancelOrder, cancelExpiredPendingOrders } = require("./order-cancellation.service");
const {
  updateOrderStatus,
  markOrderPaid,
  createMockShipment,
  updateConsultationNote,
  uploadPaymentProof,
  approvePaymentProof
} = require("./order-status.service");

module.exports = {
  // Public Order APIs
  createOrderFromCart,
  getMyOrders,
  getAllOrders,
  getProcessingOrders,
  getOrderDetail,
  cancelOrder,
  updateOrderStatus,
  markOrderPaid,
  createMockShipment,
  updateConsultationNote,
  uploadPaymentProof,
  approvePaymentProof,
  cancelExpiredPendingOrders,
  restoreOrderInventory,

  // Common Helpers & Schema Config (for backward compatibility)
  getSchemaConfig,
  ORDER_STATUSES,
  STAFF_VISIBLE_STATUSES,
  ORDER_STATUS_TRANSITIONS
};
