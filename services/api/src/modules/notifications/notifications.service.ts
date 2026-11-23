import { prisma } from "../../config/prisma";
import { emitToUser } from "../../socket/socket.service";

export interface CreateNotificationInput {
  userId: number;
  type?: "ORDER" | "WARRANTY" | "TICKET" | "SYSTEM";
  title: string;
  message: string;
  referenceId?: string | number | null;
  referenceType?: "ORDER" | "WARRANTY" | "TICKET" | "SYSTEM" | null;
  link?: string | null;
}

export interface GetNotificationsQuery {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: string;
}

/**
 * Tạo một thông báo in-app mới, lưu vào CSDL và đẩy Realtime Socket.io tới user
 */
export async function createNotification(input: CreateNotificationInput) {
  const userId = Number(input.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    return null;
  }

  const notification = await prisma.notification.create({
    data: {
      user_id: userId,
      type: input.type || "SYSTEM",
      title: input.title,
      message: input.message,
      reference_id: input.referenceId ? String(input.referenceId) : null,
      reference_type: input.referenceType || (input.type || "SYSTEM"),
      link: input.link || null,
      is_read: false
    }
  });

  const payload = {
    id: notification.id,
    userId: notification.user_id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    referenceId: notification.reference_id,
    referenceType: notification.reference_type,
    link: notification.link,
    isRead: notification.is_read,
    createdAt: notification.created_at
  };

  // 🔔 Emit real-time socket event trực tiếp tới room của user
  emitToUser(userId, "notification:new", payload);

  return payload;
}

/**
 * Lấy danh sách thông báo phân trang của người dùng
 */
export async function getUserNotifications(userId: number, queryParams: GetNotificationsQuery = {}) {
  const page = Math.max(Number(queryParams.page) || 1, 1);
  const limit = Math.min(Math.max(Number(queryParams.limit) || 15, 1), 50);
  const skip = (page - 1) * limit;

  const whereClause: any = {
    user_id: Number(userId)
  };

  if (queryParams.unreadOnly) {
    whereClause.is_read = false;
  }

  if (queryParams.type && queryParams.type !== "ALL") {
    whereClause.type = String(queryParams.type).toUpperCase();
  }

  const [totalCount, unreadCount, items] = await Promise.all([
    prisma.notification.count({ where: whereClause }),
    prisma.notification.count({ where: { user_id: Number(userId), is_read: false } }),
    prisma.notification.findMany({
      where: whereClause,
      orderBy: { created_at: "desc" },
      skip,
      take: limit
    })
  ]);

  return {
    items: items.map((item) => ({
      id: item.id,
      userId: item.user_id,
      type: item.type,
      title: item.title,
      message: item.message,
      referenceId: item.reference_id,
      referenceType: item.reference_type,
      link: item.link,
      isRead: item.is_read,
      createdAt: item.created_at
    })),
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
      unreadCount
    }
  };
}

/**
 * Lấy số lượng thông báo chưa đọc của user
 */
export async function getUnreadCount(userId: number): Promise<number> {
  return await prisma.notification.count({
    where: {
      user_id: Number(userId),
      is_read: false
    }
  });
}

/**
 * Đánh dấu một thông báo là đã đọc
 */
export async function markAsRead(userId: number, notificationId: number) {
  const parsedId = Number(notificationId);
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    return null;
  }

  const result = await prisma.notification.updateMany({
    where: {
      id: parsedId,
      user_id: Number(userId)
    },
    data: {
      is_read: true
    }
  });

  return result.count > 0;
}

/**
 * Đánh dấu tất cả thông báo của người dùng là đã đọc
 */
export async function markAllAsRead(userId: number) {
  const result = await prisma.notification.updateMany({
    where: {
      user_id: Number(userId),
      is_read: false
    },
    data: {
      is_read: true
    }
  });

  return result.count;
}

/**
 * Xóa một thông báo
 */
export async function deleteNotification(userId: number, notificationId: number) {
  const parsedId = Number(notificationId);
  const result = await prisma.notification.deleteMany({
    where: {
      id: parsedId,
      user_id: Number(userId)
    }
  });

  return result.count > 0;
}

/**
 * Gửi thông báo chuyển đổi trạng thái đơn hàng tới khách hàng
 */
export async function sendOrderStatusNotification(params: {
  userId: number;
  orderId: number | string;
  status: string;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  carrier?: string | null;
  trackingCode?: string | null;
  reason?: string | null;
}) {
  const { userId, orderId, status, paymentMethod, paymentStatus, carrier, trackingCode, reason } = params;
  if (!userId || !orderId) return null;

  const parsedUserId = Number(userId);
  const parsedOrderId = Number(orderId);
  const normalizedStatus = String(status || "").trim().toUpperCase();
  const normalizedMethod = String(paymentMethod || "").trim().toUpperCase();
  const normalizedPaymentStatus = String(paymentStatus || "").trim().toUpperCase();

  let title = `Đơn hàng #${parsedOrderId}: Cập nhật trạng thái`;
  let message = `Đơn hàng #${parsedOrderId} vừa chuyển sang trạng thái ${normalizedStatus}.`;

  switch (normalizedStatus) {
    case "PENDING":
      if (normalizedPaymentStatus === "FAILED" || normalizedPaymentStatus === "PAYMENT_CANCELLED") {
        title = `Thanh toán thất bại #${parsedOrderId}`;
        message = `Giao dịch thanh toán cho đơn hàng #${parsedOrderId} chưa thành công${reason ? ` (${reason})` : ""}. Bạn có thể thử thanh toán lại trong 30 phút hoặc hủy đơn.`;
      } else if (normalizedPaymentStatus === "REJECTED") {
        title = `Minh chứng thanh toán bị từ chối #${parsedOrderId}`;
        message = `Ảnh biên lai chuyển khoản của đơn hàng #${parsedOrderId} chưa được duyệt.${reason ? ` Lý do: ${reason}` : ""} Vui lòng kiểm tra và tải lại minh chứng.`;
      } else if (normalizedMethod === "VNPAY" || normalizedMethod === "MOMO") {
        const gatewayLabel = normalizedMethod === "MOMO" ? "MoMo" : "VNPay";
        title = `Đơn hàng #${parsedOrderId} đang chờ thanh toán`;
        message = `Đơn hàng #${parsedOrderId} đã được khởi tạo và giữ tồn kho tạm thời. Vui lòng hoàn tất thanh toán ${gatewayLabel} trong 30 phút để xác nhận đơn hàng.`;
      } else if (normalizedMethod === "BANK_TRANSFER") {
        const prefix = String(process.env.SEPAY_TRANSFER_PREFIX || "PCMALL").trim() || "PCMALL";
        title = `Đơn hàng #${parsedOrderId} đang chờ chuyển khoản VietQR`;
        message = `Đơn hàng #${parsedOrderId} đã được khởi tạo. Vui lòng quét mã VietQR với nội dung ${prefix}${parsedOrderId} trong 30 phút — hệ thống sẽ tự động xác nhận ngay khi tiền vào tài khoản.`;
      } else {
        title = `Đặt hàng thành công #${parsedOrderId}`;
        message = `Đơn hàng #${parsedOrderId} đã được tạo thành công và đang chờ xác nhận.`;
      }
      break;
    case "PROCESSING":
      if (normalizedPaymentStatus === "PAID") {
        title = `Thanh toán & đặt hàng thành công #${parsedOrderId}`;
        message = `Đơn hàng #${parsedOrderId} đã thanh toán thành công và đang được cửa hàng chuẩn bị đóng gói linh kiện.`;
      } else {
        title = `Đơn hàng #${parsedOrderId} đã được xác nhận`;
        message = `Đơn hàng #${parsedOrderId} đã được nhân viên xác nhận và đang đóng gói linh kiện.`;
      }
      break;
    case "SHIPPED":
      title = `Đơn hàng #${parsedOrderId} đang trên đường giao`;
      message = `Đơn hàng #${parsedOrderId} đã xuất kho${carrier ? ` qua ${carrier}` : ""}${trackingCode ? ` (Mã vận đơn: ${trackingCode})` : ""}. Vui lòng chú ý điện thoại.`;
      break;
    case "DELIVERED":
      title = `Đơn hàng #${parsedOrderId} đã giao thành công`;
      message = `Kiện hàng #${parsedOrderId} đã được giao tới bạn. Vui lòng bấm xác nhận đã nhận hàng để kích hoạt thẻ bảo hành chính hãng.`;
      break;
    case "COMPLETED":
      title = `Đơn hàng #${parsedOrderId} đã hoàn tất`;
      message = `Đơn hàng #${parsedOrderId} đã hoàn tất. Cảm ơn bạn đã mua sắm tại PC Mall! Thẻ bảo hành điện tử chính hãng đã được kích hoạt.`;
      break;
    case "CANCELED":
      title = `Đơn hàng #${parsedOrderId} đã bị hủy`;
      message = `Đơn hàng #${parsedOrderId} đã bị hủy.${reason ? ` Lý do: ${reason}` : ""}`;
      break;
  }

  return await createNotification({
    userId: parsedUserId,
    type: "ORDER",
    title,
    message,
    referenceId: parsedOrderId,
    referenceType: "ORDER",
    link: `/orders/${parsedOrderId}`
  });
}

/**
 * Gửi thông báo tiến độ xử lý ticket hỗ trợ kỹ thuật tới khách hàng
 */
export async function sendTicketNotification(params: {
  userId: number;
  ticketId: number | string;
  ticketTitle: string;
  action: "STATUS_CHANGED" | "NEW_REPLY" | "ASSIGNED";
  status?: string;
  detailMessage?: string;
}) {
  const { userId, ticketId, ticketTitle, action, status, detailMessage } = params;
  if (!userId || !ticketId) return null;

  const parsedUserId = Number(userId);
  let title = `Ticket #${ticketId}: Cập nhật hỗ trợ`;
  let message = `Ticket "${ticketTitle}" vừa có cập nhật mới.`;

  if (action === "STATUS_CHANGED") {
    const statusLabels: Record<string, string> = {
      OPEN: "Mở mới",
      IN_PROGRESS: "Đang xử lý",
      WAITING_CUSTOMER: "Chờ khách hàng phản hồi",
      RESOLVED: "Đã giải quyết",
      CLOSED: "Đã đóng"
    };
    const label = statusLabels[String(status).toUpperCase()] || status;
    title = `Ticket #${ticketId}: Trạng thái ${label}`;
    message = `Yêu cầu hỗ trợ "${ticketTitle}" đã được chuyển sang trạng thái: ${label}.`;
  } else if (action === "NEW_REPLY") {
    title = `Ticket #${ticketId}: Phản hồi mới từ Kỹ thuật viên`;
    message = detailMessage || `Kỹ thuật viên đã trả lời yêu cầu hỗ trợ "${ticketTitle}".`;
  }

  return await createNotification({
    userId: parsedUserId,
    type: "TICKET",
    title,
    message,
    referenceId: ticketId,
    referenceType: "TICKET",
    link: `/tickets/${ticketId}`
  });
}

/**
 * Gửi thông báo tiến độ bảo hành linh kiện tới khách hàng
 */
export async function sendWarrantyNotification(params: {
  userId: number;
  requestId?: number | string | null;
  title: string;
  message: string;
}) {
  const { userId, requestId, title, message } = params;
  if (!userId) return null;

  return await createNotification({
    userId: Number(userId),
    type: "WARRANTY",
    title: `Bảo hành: ${title}`,
    message,
    referenceId: requestId || null,
    referenceType: "WARRANTY",
    link: `/warranties`
  });
}

export default {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  sendOrderStatusNotification,
  sendTicketNotification,
  sendWarrantyNotification
};
