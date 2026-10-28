import { prisma } from "../../config/prisma";

let paymentProofColumnReady: boolean | null = null;

async function repairLegacyPaidOrders(orderId?: number | string | null) {
  const numericId = orderId !== undefined && orderId !== null ? Number(orderId) : undefined;
  await prisma.order.updateMany({
    where: {
      payment_status: "PAID",
      status: "PAID",
      ...(numericId !== undefined ? { id: numericId } : {})
    },
    data: {
      status: "PROCESSING",
      updated_at: new Date()
    }
  });
}

async function getPaymentProof(orderId: number | string | null | undefined) {
  if (!orderId) return null;
  const numericId = typeof orderId === "string" ? parseInt(orderId, 10) : Number(orderId);
  const order = await prisma.order.findUnique({
    where: { id: numericId },
    select: { payment_proof: true }
  });
  return order?.payment_proof || null;
}

function normalizeShipment(shipment: any) {
  if (!shipment) {
    return null;
  }

  return {
    id: shipment.id,
    orderId: shipment.order_id,
    status: shipment.status,
    trackingCode: shipment.tracking_code
  };
}

function normalizeCustomer(user: any) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone
  };
}

async function getCustomerByUserId(userId: number | null | undefined) {
  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  return normalizeCustomer(user);
}

export async function normalizeOrderRecord<T extends Record<string, any> | null>(order: T) {
  if (!order) {
    return order;
  }

  const { Shipment, ...rest } = order;
  const latestShipment = Array.isArray(Shipment) && Shipment.length > 0
    ? Shipment[0]
    : null;
  const customer = await getCustomerByUserId(rest.user_id);
  const paymentProof = await getPaymentProof(rest.id);

  return {
    ...rest,
    payment_proof: paymentProof,
    paymentProof,
    shipment: normalizeShipment(latestShipment),
    customer
  };
}

export function getOrdersByUser(userId: string) {
  const numericId = parseInt(userId, 10);
  return repairLegacyPaidOrders().then(() =>
    prisma.order.findMany({
    where: { user_id: numericId },
    include: {
      Shipment: {
        orderBy: { id: "desc" },
        take: 1
      },
      OrderItem: {
        include: {
          ProductSku: true
        }
      }
    },
    orderBy: { created_at: "desc" }
    })
  );
}

export function getOrderById(orderId: string | number) {
  return repairLegacyPaidOrders(orderId).then(() =>
    prisma.order.findUnique({
    where: { id: typeof orderId === "string" ? parseInt(orderId, 10) : orderId },
    include: {
      Shipment: {
        orderBy: { id: "desc" },
        take: 1
      },
      OrderItem: {
        include: {
          ProductSku: true
        }
      }
    }
    })
  );
}

export function listOrders() {
  return repairLegacyPaidOrders().then(() =>
    prisma.order.findMany({
    include: {
      Shipment: {
        orderBy: { id: "desc" },
        take: 1
      },
      OrderItem: {
        include: {
          ProductSku: true
        }
      }
    },
    orderBy: { created_at: "desc" }
    })
  );
}

export async function updateOrderStatus(orderId: string | number, status: string) {
  const numericId = typeof orderId === "string" ? parseInt(orderId, 10) : Number(orderId);
  return prisma.$transaction(async (tx: any) => {
    if (status === "CANCELED") {
      const order = await tx.order.findUnique({
        where: { id: numericId },
        include: { OrderItem: true }
      });
      if (order && order.status !== "CANCELED") {
        for (const item of order.OrderItem || []) {
          const variantId = item.product_variant_id;
          const quantity = Number(item.quantity || 0);
          if (variantId && quantity > 0) {
            await tx.productSku.update({
              where: { id: variantId },
              data: {
                stock: { increment: quantity }
              }
            });
          }
        }
        await tx.shipment.updateMany({
          where: { order_id: numericId },
          data: { status: "CANCELED" }
        });
      }
    }
    return tx.order.update({
      where: { id: numericId },
      data: { status, updated_at: new Date() }
    });
  });
}

export function completeDeliveredOrder(orderId: string | number, userId: string | number) {
  return prisma.order.updateMany({
    where: {
      id: typeof orderId === "string" ? parseInt(orderId, 10) : orderId,
      user_id: typeof userId === "string" ? parseInt(userId, 10) : userId,
      status: "DELIVERED"
    },
    data: {
      status: "COMPLETED",
      updated_at: new Date()
    }
  });
}

export function markOrderPaid(orderId: string | number) {
  return prisma.order.update({
    where: { id: typeof orderId === "string" ? parseInt(orderId, 10) : orderId },
    data: {
      status: "PROCESSING",
      payment_status: "PAID",
      updated_at: new Date()
    }
  });
}

export function markOrderPaymentCancelled(orderId: string | number) {
  return prisma.order.update({
    where: { id: typeof orderId === "string" ? parseInt(orderId, 10) : orderId },
    data: {
      payment_status: "PAYMENT_CANCELLED",
      updated_at: new Date()
    }
  });
}

export async function saveOrderPaymentProof(orderId: string | number, paymentProofUrl: string) {
  const numericId = typeof orderId === "string" ? parseInt(orderId, 10) : orderId;
  return prisma.order.update({
    where: { id: numericId },
    data: {
      payment_proof: paymentProofUrl,
      payment_status: "AWAITING_ADMIN_CONFIRMATION",
      updated_at: new Date()
    }
  });
}
