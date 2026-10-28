import { prisma } from "../../config/prisma";

export interface AssignOrderItemSerialsInput {
  orderItemId: number;
  serials: string[];
}

export interface AssignOrderSerialsParams {
  orderId: number;
  items: AssignOrderItemSerialsInput[];
  assignedBy?: number;
}

export class OrderSerialsService {
  /**
   * Lấy danh sách Serial Number đã gán cho một đơn hàng
   */
  async getOrderSerials(orderId: number) {
    return prisma.orderItemSerial.findMany({
      where: { order_id: orderId },
      include: {
        OrderItem: {
          select: {
            id: true,
            product_variant_id: true,
            name_snapshot: true,
            sku_snapshot: true,
            quantity: true,
            serial_numbers: true
          }
        },
        WarrantyItem: {
          select: {
            id: true,
            warranty_code: true,
            status: true,
            activated_at: true,
            expires_at: true
          }
        }
      },
      orderBy: [{ order_item_id: "asc" }, { id: "asc" }]
    });
  }

  /**
   * Kiểm tra xem đơn hàng đã được gán đủ Serial Number cho tất cả linh kiện chưa
   */
  async checkOrderSerialsFulfilled(orderId: number): Promise<{
    fulfilled: boolean;
    totalRequired: number;
    totalAssigned: number;
    missingItems: Array<{
      orderItemId: number;
      productName: string;
      skuName: string | null;
      quantity: number;
      assignedCount: number;
    }>;
  }> {
    const orderItems = await prisma.orderItem.findMany({
      where: { order_id: orderId },
      include: {
        OrderItemSerial: true
      }
    });

    let totalRequired = 0;
    let totalAssigned = 0;
    const missingItems: Array<{
      orderItemId: number;
      productName: string;
      skuName: string | null;
      quantity: number;
      assignedCount: number;
    }> = [];

    for (const item of orderItems) {
      const required = item.quantity;
      const assigned = item.OrderItemSerial ? item.OrderItemSerial.length : 0;
      totalRequired += required;
      totalAssigned += assigned;

      if (assigned < required) {
        missingItems.push({
          orderItemId: item.id,
          productName: item.name_snapshot || "Linh kiện",
          skuName: item.sku_snapshot,
          quantity: required,
          assignedCount: assigned
        });
      }
    }

    return {
      fulfilled: missingItems.length === 0,
      totalRequired,
      totalAssigned,
      missingItems
    };
  }

  /**
   * Gán Serial Number thực tế cho các mặt hàng trong đơn hàng
   */
  async assignOrderSerials(params: AssignOrderSerialsParams) {
    const { orderId, items, assignedBy } = params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        OrderItem: true
      }
    });

    if (!order) {
      throw new Error(`Đơn hàng #${orderId} không tồn tại`);
    }

    if (order.status === "CANCELLED") {
      throw new Error(`Không thể gán Serial Number cho đơn hàng đã bị hủy (#${orderId})`);
    }

    const orderItemMap = new Map(order.OrderItem.map((item) => [item.id, item]));

    // 1. Kiểm tra trùng lặp serial number trong chính payload
    const allInputSerials: string[] = [];
    for (const entry of items) {
      const cleaned = (entry.serials || []).map((s) => s.trim()).filter(Boolean);
      for (const s of cleaned) {
        const lower = s.toLowerCase();
        if (allInputSerials.includes(lower)) {
          throw new Error(`Serial Number "${s}" bị trùng lặp trong danh sách gán`);
        }
        allInputSerials.push(lower);
      }
    }

    // 2. Validate từng mục linh kiện
    for (const entry of items) {
      const orderItem = orderItemMap.get(entry.orderItemId);
      if (!orderItem) {
        throw new Error(`Mặt hàng #${entry.orderItemId} không thuộc đơn hàng #${orderId}`);
      }

      const cleanedSerials = (entry.serials || []).map((s) => s.trim()).filter(Boolean);

      if (cleanedSerials.length !== orderItem.quantity) {
        throw new Error(
          `Sản phẩm "${orderItem.name_snapshot || "Linh kiện"}" có số lượng ${orderItem.quantity}, cần đúng ${orderItem.quantity} Serial Number (đã nhập: ${cleanedSerials.length})`
        );
      }
    }

    // 3. Kiểm tra xem các serial number này đã bị trùng trên hệ thống hay chưa
    // Ngoại lệ: serial number đó đã thuộc chính order này
    const existingSerials = await prisma.orderItemSerial.findMany({
      where: {
        serial_number: { in: allInputSerials },
        order_id: { not: orderId }
      }
    });

    if (existingSerials.length > 0) {
      const duplicateCodes = existingSerials.map((s) => s.serial_number).join(", ");
      throw new Error(`Serial Number đã tồn tại trên hệ thống ở đơn hàng khác: ${duplicateCodes}`);
    }

    // 4. Thực hiện transaction lưu S/N
    return await prisma.$transaction(async (tx) => {
      let totalAssigned = 0;

      for (const entry of items) {
        const orderItem = orderItemMap.get(entry.orderItemId)!;
        const cleanedSerials = (entry.serials || []).map((s) => s.trim()).filter(Boolean);

        // Xóa serials cũ của item này (nếu có)
        await tx.orderItemSerial.deleteMany({
          where: { order_item_id: entry.orderItemId }
        });

        // Tạo mới từng bản ghi serial
        for (const sn of cleanedSerials) {
          await tx.orderItemSerial.create({
            data: {
              order_id: orderId,
              order_item_id: entry.orderItemId,
              sku_id: orderItem.product_variant_id,
              serial_number: sn,
              status: "ASSIGNED",
              assigned_by: assignedBy || null,
              assigned_at: new Date()
            }
          });
          totalAssigned++;
        }

        // Cập nhật snapshot serial_numbers vào order_items
        await tx.orderItem.update({
          where: { id: entry.orderItemId },
          data: {
            serial_numbers: JSON.stringify(cleanedSerials)
          }
        });
      }

      return {
        orderId,
        totalAssigned,
        itemsCount: items.length
      };
    });
  }

  /**
   * Tự động sinh Serial Number mẫu cho các mặt hàng trong đơn (phục vụ test / demo)
   */
  async autoGenerateOrderSerials(orderId: number, assignedBy?: number) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        OrderItem: true
      }
    });

    if (!order) {
      throw new Error(`Đơn hàng #${orderId} không tồn tại`);
    }

    const items: AssignOrderItemSerialsInput[] = [];
    const timestamp = Date.now().toString().slice(-6);

    for (const item of order.OrderItem) {
      const serials: string[] = [];
      const prefix = (item.name_snapshot || "HARDWARE")
        .replace(/[^a-zA-Z0-9]/g, "")
        .substring(0, 4)
        .toUpperCase();

      for (let i = 1; i <= item.quantity; i++) {
        const rand = Math.floor(1000 + Math.random() * 9000);
        serials.push(`SN-${prefix}-${timestamp}-${item.id}-${i}-${rand}`);
      }

      items.push({
        orderItemId: item.id,
        serials
      });
    }

    return this.assignOrderSerials({
      orderId,
      items,
      assignedBy
    });
  }
}

export const orderSerialsService = new OrderSerialsService();
export default orderSerialsService;
