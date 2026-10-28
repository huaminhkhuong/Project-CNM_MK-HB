const { prisma } = require("../../config/prisma");
const { createError } = require("../../utils/service-helpers");

/**
 * Get serial numbers requirement and current assignments for an order
 */
async function getOrderSerialInfo(orderId) {
  const parsedOrderId = Number(orderId);
  if (!Number.isFinite(parsedOrderId) || parsedOrderId <= 0) {
    throw createError("Invalid orderId", 400);
  }

  const order = await prisma.order.findUnique({
    where: { id: parsedOrderId },
    select: { id: true, status: true, user_id: true }
  });

  if (!order) {
    throw createError("Order not found", 404);
  }

  const items = await prisma.orderItem.findMany({
    where: { order_id: parsedOrderId },
    include: {
      ProductSku: {
        select: { image_url: true }
      }
    },
    orderBy: { id: "asc" }
  });

  const assignedSerials = await prisma.orderItemSerial.findMany({
    where: { order_id: parsedOrderId },
    orderBy: { id: "asc" }
  });

  const serialsByItem = new Map();
  for (const s of assignedSerials) {
    if (!serialsByItem.has(s.order_item_id)) {
      serialsByItem.set(s.order_item_id, []);
    }
    serialsByItem.get(s.order_item_id).push({
      id: s.id,
      serialNumber: s.serial_number,
      status: s.status,
      warrantyId: s.warranty_id,
      assignedBy: s.assigned_by,
      assignedAt: s.assigned_at
    });
  }

  let totalRequiredSerials = 0;
  let totalAssignedSerials = 0;

  const itemDetails = items.map((item) => {
    const assigned = serialsByItem.get(item.id) || [];
    const required = Number(item.quantity || 1);
    totalRequiredSerials += required;
    totalAssignedSerials += assigned.length;

    return {
      orderItemId: item.id,
      productName: item.name_snapshot || item.sku_snapshot || `Sản phẩm #${item.id}`,
      sku: item.sku_snapshot || "N/A",
      variantId: item.product_variant_id,
      skuImageUrl: item.ProductSku?.image_url || null,
      requiredQuantity: required,
      assignedSerials: assigned,
      isComplete: assigned.length >= required
    };
  });

  return {
    orderId: parsedOrderId,
    orderStatus: order.status,
    totalItems: itemDetails.length,
    totalRequiredSerials,
    totalAssignedSerials,
    isFullyAssigned: totalAssignedSerials >= totalRequiredSerials && totalRequiredSerials > 0,
    items: itemDetails
  };
}

/**
 * Assign serial numbers to order items
 * @param {Object} params
 * @param {number} params.orderId
 * @param {Array<{ orderItemId: number, serials: string[] }>} params.assignments
 * @param {number|null} params.staffUserId
 */
async function assignOrderSerials({ orderId, assignments, staffUserId }) {
  const parsedOrderId = Number(orderId);
  if (!Number.isFinite(parsedOrderId) || parsedOrderId <= 0) {
    throw createError("Invalid orderId", 400);
  }

  if (!Array.isArray(assignments) || assignments.length === 0) {
    throw createError("Danh sách gán Serial Number không hợp lệ hoặc rỗng", 400);
  }

  await prisma.$transaction(async (tx) => {
    // 1. Verify order
    const order = await tx.order.findUnique({
      where: { id: parsedOrderId },
      select: { id: true, status: true }
    });
    if (!order) {
      throw createError("Đơn hàng không tồn tại", 404);
    }

    // 2. Load order items
    const itemRows = await tx.orderItem.findMany({
      where: { order_id: parsedOrderId },
      select: {
        id: true,
        product_variant_id: true,
        quantity: true,
        sku_snapshot: true,
        name_snapshot: true
      }
    });
    const itemMap = new Map(itemRows.map((it) => [it.id, it]));

    // 3. Normalize & validate input
    const allInputSerials = [];
    const normalizedAssignments = [];

    for (const assign of assignments) {
      const orderItemId = Number(assign.orderItemId || assign.id);
      const targetItem = itemMap.get(orderItemId);

      if (!targetItem) {
        throw createError(`Mặt hàng #${orderItemId} không thuộc đơn hàng #${parsedOrderId}`, 400);
      }

      const rawSerials = Array.isArray(assign.serials)
        ? assign.serials
        : (typeof assign.serialNumber === "string" ? [assign.serialNumber] : []);

      const cleanedSerials = rawSerials
        .map((s) => String(s || "").trim())
        .filter((s) => s.length > 0);

      if (cleanedSerials.length > targetItem.quantity) {
        throw createError(
          `Số lượng Serial Number (${cleanedSerials.length}) vượt quá số lượng đặt mua (${targetItem.quantity}) cho sản phẩm "${targetItem.name_snapshot || targetItem.sku_snapshot}"`,
          400
        );
      }

      // Check intra-assignment duplicates
      const itemSerialSet = new Set();
      for (const sn of cleanedSerials) {
        const upper = sn.toUpperCase();
        if (itemSerialSet.has(upper)) {
          throw createError(`Serial Number "${sn}" bị trùng lặp trong cùng một mặt hàng`, 400);
        }
        itemSerialSet.add(upper);
        allInputSerials.push({ serialNumber: sn, orderItemId, variantId: targetItem.product_variant_id });
      }

      normalizedAssignments.push({
        orderItemId,
        variantId: targetItem.product_variant_id,
        quantity: targetItem.quantity,
        serials: cleanedSerials
      });
    }

    // Check duplicate serials across all items in this request
    const globalInputSet = new Set();
    for (const item of allInputSerials) {
      const upper = item.serialNumber.toUpperCase();
      if (globalInputSet.has(upper)) {
        throw createError(`Serial Number "${item.serialNumber}" xuất hiện nhiều lần trong yêu cầu gán này`, 400);
      }
      globalInputSet.add(upper);
    }

    // 4. Check uniqueness against database (must not belong to any other order)
    if (allInputSerials.length > 0) {
      const serialValues = allInputSerials.map((i) => i.serialNumber);

      const existingSerials = await tx.orderItemSerial.findMany({
        where: {
          serial_number: { in: serialValues },
          order_id: { not: parsedOrderId }
        },
        select: {
          serial_number: true,
          order_id: true,
          order_item_id: true
        }
      });

      if (existingSerials && existingSerials.length > 0) {
        const conflict = existingSerials[0];
        throw createError(
          `Serial Number "${conflict.serial_number}" đã tồn tại trên hệ thống và đã được gán cho đơn hàng #${conflict.order_id}! Vui lòng kiểm tra lại tem nhãn sản phẩm.`,
          409
        );
      }
    }

    // 5. Update database for each assignment
    const now = new Date();
    for (const assign of normalizedAssignments) {
      // Remove existing serial records for this specific order_item
      await tx.orderItemSerial.deleteMany({
        where: { order_item_id: assign.orderItemId }
      });

      // Insert new serial records
      if (assign.serials.length > 0) {
        await tx.orderItemSerial.createMany({
          data: assign.serials.map((sn) => ({
            order_id: parsedOrderId,
            order_item_id: assign.orderItemId,
            sku_id: assign.variantId,
            serial_number: sn,
            status: "ASSIGNED",
            assigned_by: staffUserId || null,
            assigned_at: now
          }))
        });
      }

      // Snapshot to order_items.serial_numbers column for fast read access
      await tx.orderItem.update({
        where: { id: assign.orderItemId },
        data: { serial_numbers: JSON.stringify(assign.serials) }
      });
    }
  });

  // Return updated serials state
  return getOrderSerialInfo(parsedOrderId);
}

/**
 * Auto-generate realistic mock serial numbers for fast warehouse testing/demo
 * @param {number} orderId
 * @param {number|null} staffUserId
 */
async function autoGenerateMockSerials(orderId, staffUserId) {
  const currentInfo = await getOrderSerialInfo(orderId);
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

  const assignments = [];

  for (const item of currentInfo.items) {
    const existingCount = item.assignedSerials.length;
    const required = item.requiredQuantity;
    const serials = item.assignedSerials.map((s) => s.serialNumber);

    const cleanSku = String(item.sku || "HW").replace(/[^a-zA-Z0-9]/g, "").substring(0, 8).toUpperCase();

    // Fill remaining missing serials
    for (let i = existingCount; i < required; i++) {
      const randHex = Math.random().toString(36).substring(2, 7).toUpperCase();
      const mockSerial = `SN-${cleanSku}-${yearMonth}-${orderId}-${item.orderItemId}-${i + 1}-${randHex}`;
      serials.push(mockSerial);
    }

    assignments.push({
      orderItemId: item.orderItemId,
      serials
    });
  }

  return assignOrderSerials({ orderId, assignments, staffUserId });
}

/**
 * Check if all items in order have sufficient serial numbers
 */
async function checkOrderSerialsFulfilled(orderId) {
  const info = await getOrderSerialInfo(orderId);
  return {
    isFulfilled: info.isFullyAssigned,
    totalRequired: info.totalRequiredSerials,
    totalAssigned: info.totalAssignedSerials,
    missingItems: info.items.filter((i) => !i.isComplete)
  };
}

module.exports = {
  getOrderSerialInfo,
  assignOrderSerials,
  autoGenerateMockSerials,
  checkOrderSerialsFulfilled
};
