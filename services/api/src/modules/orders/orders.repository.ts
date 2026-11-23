import { prisma } from "../../config/prisma";
import { env } from "../../config/env";

let paymentProofColumnReady: boolean | null = null;

export function getPaymentProviderForMethod(paymentMethod: string | null | undefined) {
  const normalized = String(paymentMethod || "COD").trim().toUpperCase();
  if (normalized === "COD") return "COD";
  if (normalized === "BANK_TRANSFER") return "VIETQR";
  if (normalized === "VNPAY") return env.paymentMockMode ? "VNPAY_SANDBOX_MOCK" : "VNPAY_SANDBOX";
  if (normalized === "MOMO") return env.paymentMockMode ? "MOMO_SANDBOX_MOCK" : "MOMO_SANDBOX";
  return normalized || "COD";
}

export async function createOrderPaymentRecord(
  tx: any,
  order: {
    id: number;
    user_id?: number | null;
    payment_method?: string | null;
    final_amount?: any;
    total_amount?: any;
  },
  options?: {
    provider?: string;
    status?: string;
    redirectUrl?: string | null;
    note?: string | null;
  }
) {
  const method = String(order.payment_method || "COD").trim().toUpperCase();
  const provider = options?.provider || getPaymentProviderForMethod(method);
  const status = options?.status || (method === "COD" ? "UNPAID" : "PENDING_GATEWAY");
  const amount = Number(order.final_amount ?? order.total_amount ?? 0);

  return tx.payment.create({
    data: {
      order_id: Number(order.id),
      user_id: order.user_id ? Number(order.user_id) : null,
      provider,
      payment_method: method,
      amount,
      status,
      redirect_url: options?.redirectUrl || null,
      note: options?.note || null,
      created_at: new Date(),
      updated_at: new Date()
    }
  });
}

export async function syncGatewayPaymentOnRedirect(
  order: {
    id: number;
    user_id?: number | null;
    payment_method?: string | null;
    final_amount?: any;
    total_amount?: any;
  },
  options: {
    redirectUrl: string;
    provider?: string;
    note?: string;
  }
) {
  const numericId = Number(order.id);
  const method = String(order.payment_method || "VNPAY").trim().toUpperCase();
  const provider = options.provider || getPaymentProviderForMethod(method);
  const latest = await prisma.payment.findFirst({
    where: { order_id: numericId },
    orderBy: { id: "desc" }
  });

  // Reset failed/cancelled order payment_status back to PENDING_GATEWAY when retrying
  await prisma.order.updateMany({
    where: {
      id: numericId,
      status: "PENDING",
      payment_status: { in: ["FAILED", "PAYMENT_CANCELLED", "UNPAID"] }
    },
    data: {
      payment_status: "PENDING_GATEWAY",
      updated_at: new Date()
    }
  });

  if (latest && ["PENDING_GATEWAY", "UNPAID", "FAILED", "CANCELED"].includes(String(latest.status || "").toUpperCase())) {
    return prisma.payment.update({
      where: { id: latest.id },
      data: {
        provider,
        status: "PENDING_GATEWAY",
        redirect_url: options.redirectUrl,
        note: options.note || latest.note,
        updated_at: new Date()
      }
    });
  }

  return createOrderPaymentRecord(prisma, order, {
    provider,
    status: "PENDING_GATEWAY",
    redirectUrl: options.redirectUrl,
    note: options.note || "Gateway payment link generated"
  });
}

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

function parseItemSerialNumbers(item: any): string[] {
  if (Array.isArray(item?.OrderItemSerial) && item.OrderItemSerial.length > 0) {
    return item.OrderItemSerial.map((s: any) => s?.serial_number).filter(Boolean);
  }
  if (Array.isArray(item?.serialNumbers)) {
    return item.serialNumbers.filter(Boolean);
  }
  if (typeof item?.serial_numbers === "string" && item.serial_numbers.trim()) {
    try {
      const parsed = JSON.parse(item.serial_numbers);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      return item.serial_numbers.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export async function normalizeOrderRecord<T extends Record<string, any> | null>(order: T) {
  if (!order) {
    return order;
  }

  const { Shipment, Payment, ...rest } = order;
  const latestShipment = Array.isArray(Shipment) && Shipment.length > 0
    ? Shipment[0]
    : null;
  const latestPayment = Array.isArray(Payment) && Payment.length > 0
    ? Payment[0]
    : null;
  const customer = await getCustomerByUserId(rest.user_id);
  const paymentProof = rest.payment_proof || latestPayment?.proof_image_url || (await getPaymentProof(rest.id));
  const normalizedItems = Array.isArray(rest.OrderItem)
    ? rest.OrderItem.map((item: any) => ({
        ...item,
        serialNumbers: parseItemSerialNumbers(item)
      }))
    : rest.OrderItem;

  return {
    ...rest,
    ...(normalizedItems ? { OrderItem: normalizedItems } : {}),
    payment_proof: paymentProof,
    paymentProof,
    transactionCode: latestPayment?.transaction_code || null,
    shipment: normalizeShipment(latestShipment),
    customer
  };
}

export function getOrdersByUser(userId: string) {
  const numericId = parseInt(userId, 10);
  return prisma.order.findMany({
    where: { user_id: numericId },
    include: {
      Shipment: {
        orderBy: { id: "desc" },
        take: 1
      },
      Payment: {
        orderBy: { id: "desc" },
        take: 1
      },
      OrderItem: {
        include: {
          ProductSku: true,
          OrderItemSerial: {
            select: { id: true, serial_number: true, status: true },
            orderBy: { id: "asc" }
          }
        }
      }
    },
    orderBy: { created_at: "desc" }
  });
}

export function getOrderById(orderId: string | number) {
  return prisma.order.findUnique({
    where: { id: typeof orderId === "string" ? parseInt(orderId, 10) : orderId },
    include: {
      Shipment: {
        orderBy: { id: "desc" },
        take: 1
      },
      Payment: {
        orderBy: { id: "desc" },
        take: 1
      },
      OrderItem: {
        include: {
          ProductSku: true,
          OrderItemSerial: {
            select: { id: true, serial_number: true, status: true },
            orderBy: { id: "asc" }
          }
        }
      }
    }
  });
}

export function listOrders() {
  return prisma.order.findMany({
    include: {
      Shipment: {
        orderBy: { id: "desc" },
        take: 1
      },
      Payment: {
        orderBy: { id: "desc" },
        take: 1
      },
      OrderItem: {
        include: {
          ProductSku: true,
          OrderItemSerial: {
            select: { id: true, serial_number: true, status: true },
            orderBy: { id: "asc" }
          }
        }
      }
    },
    orderBy: { created_at: "desc" }
  });
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

export async function markOrderPaid(
  orderId: string | number,
  options?: {
    transactionCode?: string | null;
    provider?: string | null;
    note?: string | null;
  }
) {
  const numericId = typeof orderId === "string" ? parseInt(orderId, 10) : Number(orderId);
  return prisma.$transaction(async (tx: any) => {
    const updatedOrder = await tx.order.update({
      where: { id: numericId },
      data: {
        status: "PROCESSING",
        payment_status: "PAID",
        updated_at: new Date()
      }
    });

    const latestPayment = await tx.payment.findFirst({
      where: { order_id: numericId },
      orderBy: { id: "desc" }
    });

    const method = String(updatedOrder.payment_method || "VNPAY").trim().toUpperCase();
    const resolvedProvider = options?.provider || latestPayment?.provider || getPaymentProviderForMethod(method);
    const resolvedTxnCode =
      options?.transactionCode ||
      latestPayment?.transaction_code ||
      `${resolvedProvider}-${numericId}-${Date.now()}`;

    if (latestPayment) {
      await tx.payment.update({
        where: { id: latestPayment.id },
        data: {
          status: "PAID",
          provider: resolvedProvider,
          transaction_code: resolvedTxnCode,
          note: options?.note ?? latestPayment.note ?? "Payment confirmed",
          updated_at: new Date()
        }
      });
    } else {
      await tx.payment.create({
        data: {
          order_id: numericId,
          user_id: updatedOrder.user_id || null,
          provider: resolvedProvider,
          payment_method: method,
          amount: Number(updatedOrder.final_amount ?? updatedOrder.total_amount ?? 0),
          status: "PAID",
          transaction_code: resolvedTxnCode,
          note: options?.note || "Payment confirmed",
          proof_image_url: updatedOrder.payment_proof || null,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    }

    return updatedOrder;
  });
}

export async function markOrderPaymentFailed(
  orderId: string | number,
  options?: {
    transactionCode?: string | null;
    provider?: string | null;
    note?: string | null;
  }
) {
  const numericId = typeof orderId === "string" ? parseInt(orderId, 10) : Number(orderId);
  return prisma.$transaction(async (tx: any) => {
    const order = await tx.order.findUnique({ where: { id: numericId } });
    if (!order) return null;

    const updatedOrder =
      String(order.payment_status || "").toUpperCase() !== "PAID"
        ? await tx.order.update({
            where: { id: numericId },
            data: {
              payment_status: "FAILED",
              updated_at: new Date()
            }
          })
        : order;

    const latestPayment = await tx.payment.findFirst({
      where: { order_id: numericId },
      orderBy: { id: "desc" }
    });

    const method = String(updatedOrder.payment_method || "VNPAY").trim().toUpperCase();
    const resolvedProvider = options?.provider || latestPayment?.provider || getPaymentProviderForMethod(method);

    if (latestPayment) {
      await tx.payment.update({
        where: { id: latestPayment.id },
        data: {
          status: "FAILED",
          provider: resolvedProvider,
          transaction_code: options?.transactionCode || latestPayment.transaction_code,
          note: options?.note || latestPayment.note || "Gateway payment failed",
          updated_at: new Date()
        }
      });
    } else {
      await tx.payment.create({
        data: {
          order_id: numericId,
          user_id: updatedOrder.user_id || null,
          provider: resolvedProvider,
          payment_method: method,
          amount: Number(updatedOrder.final_amount ?? updatedOrder.total_amount ?? 0),
          status: "FAILED",
          transaction_code: options?.transactionCode || null,
          note: options?.note || "Gateway payment failed",
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    }

    return updatedOrder;
  });
}

export async function markOrderPaymentCancelled(orderId: string | number, note?: string) {
  const numericId = typeof orderId === "string" ? parseInt(orderId, 10) : Number(orderId);
  return prisma.$transaction(async (tx: any) => {
    const updatedOrder = await tx.order.update({
      where: { id: numericId },
      data: {
        payment_status: "PAYMENT_CANCELLED",
        updated_at: new Date()
      }
    });

    const latestPayment = await tx.payment.findFirst({
      where: { order_id: numericId },
      orderBy: { id: "desc" }
    });

    if (latestPayment && String(latestPayment.status || "").toUpperCase() !== "PAID") {
      await tx.payment.update({
        where: { id: latestPayment.id },
        data: {
          status: "CANCELED",
          note: note || latestPayment.note || "Payment cancelled by user",
          updated_at: new Date()
        }
      });
    } else if (!latestPayment) {
      await createOrderPaymentRecord(tx, updatedOrder, {
        status: "CANCELED",
        note: note || "Payment cancelled by user"
      });
    }

    return updatedOrder;
  });
}

export async function saveOrderPaymentProof(orderId: string | number, paymentProofUrl: string) {
  const numericId = typeof orderId === "string" ? parseInt(orderId, 10) : Number(orderId);
  return prisma.$transaction(async (tx: any) => {
    const updatedOrder = await tx.order.update({
      where: { id: numericId },
      data: {
        payment_proof: paymentProofUrl,
        payment_status: "AWAITING_ADMIN_CONFIRMATION",
        updated_at: new Date()
      }
    });

    const latestPayment = await tx.payment.findFirst({
      where: { order_id: numericId },
      orderBy: { id: "desc" }
    });

    if (latestPayment) {
      await tx.payment.update({
        where: { id: latestPayment.id },
        data: {
          provider: latestPayment.provider || "VIETQR",
          proof_image_url: paymentProofUrl,
          status: "AWAITING_ADMIN_CONFIRMATION",
          updated_at: new Date()
        }
      });
    } else {
      await tx.payment.create({
        data: {
          order_id: numericId,
          user_id: updatedOrder.user_id || null,
          provider: "VIETQR",
          payment_method: String(updatedOrder.payment_method || "BANK_TRANSFER").toUpperCase(),
          amount: Number(updatedOrder.final_amount ?? updatedOrder.total_amount ?? 0),
          status: "AWAITING_ADMIN_CONFIRMATION",
          proof_image_url: paymentProofUrl,
          note: "Customer uploaded VietQR transfer receipt",
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    }

    return updatedOrder;
  });
}

export async function updateOrderPaymentProofDecision(
  orderId: string | number,
  approved: boolean,
  options?: { reason?: string | null }
) {
  const numericId = typeof orderId === "string" ? parseInt(orderId, 10) : Number(orderId);

  if (approved) {
    return markOrderPaid(numericId, {
      transactionCode: `VIETQR-APPROVED-${numericId}-${Date.now()}`,
      provider: "VIETQR",
      note: "VietQR transfer receipt approved"
    });
  }

  return prisma.$transaction(async (tx: any) => {
    const updatedOrder = await tx.order.update({
      where: { id: numericId },
      data: {
        payment_status: "REJECTED",
        status: "PENDING",
        updated_at: new Date()
      }
    });

    const latestPayment = await tx.payment.findFirst({
      where: { order_id: numericId },
      orderBy: { id: "desc" }
    });

    if (latestPayment) {
      await tx.payment.update({
        where: { id: latestPayment.id },
        data: {
          status: "REJECTED",
          note: options?.reason || "Payment proof rejected",
          updated_at: new Date()
        }
      });
    } else {
      await tx.payment.create({
        data: {
          order_id: numericId,
          user_id: updatedOrder.user_id || null,
          provider: "VIETQR",
          payment_method: "BANK_TRANSFER",
          amount: Number(updatedOrder.final_amount ?? updatedOrder.total_amount ?? 0),
          status: "REJECTED",
          proof_image_url: updatedOrder.payment_proof || null,
          note: options?.reason || "Payment proof rejected",
          created_at: new Date(),
          updated_at: new Date()
        }
      });
    }

    return updatedOrder;
  });
}
