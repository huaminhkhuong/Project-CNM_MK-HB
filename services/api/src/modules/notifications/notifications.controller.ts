import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { AppError } from "../../errors/app-error";
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
} from "./notifications.service";

/**
 * GET /api/notifications
 * Lấy danh sách thông báo của người dùng hiện tại
 */
export const getMyNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = Number(req.user?.userId || (req.user as any)?.id);
  if (!userId) {
    throw new AppError("Unauthorized", 401);
  }

  const { page, limit, unreadOnly, type } = req.query;

  const result = await getUserNotifications(userId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    unreadOnly: unreadOnly === "true" || unreadOnly === "1",
    type: type ? String(type) : undefined
  });

  res.status(200).json({
    success: true,
    data: result.items,
    pagination: result.pagination
  });
});

/**
 * GET /api/notifications/unread-count
 * Đếm số thông báo chưa đọc để hiển thị badge chuông thông báo
 */
export const getMyUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const userId = Number(req.user?.userId || (req.user as any)?.id);
  if (!userId) {
    throw new AppError("Unauthorized", 401);
  }

  const count = await getUnreadCount(userId);

  res.status(200).json({
    success: true,
    data: {
      unreadCount: count
    }
  });
});

/**
 * PATCH /api/notifications/:id/read
 * Đánh dấu một thông báo là đã đọc
 */
export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = Number(req.user?.userId || (req.user as any)?.id);
  if (!userId) {
    throw new AppError("Unauthorized", 401);
  }

  const notificationId = Number(req.params.id);
  if (!Number.isFinite(notificationId) || notificationId <= 0) {
    throw new AppError("Mã thông báo không hợp lệ", 400);
  }

  const updated = await markAsRead(userId, notificationId);
  if (!updated) {
    throw new AppError("Không tìm thấy thông báo hoặc bạn không có quyền", 404);
  }

  const newUnreadCount = await getUnreadCount(userId);

  res.status(200).json({
    success: true,
    message: "Đã đánh dấu thông báo là đã đọc",
    data: {
      id: notificationId,
      isRead: true,
      unreadCount: newUnreadCount
    }
  });
});

/**
 * PATCH /api/notifications/read-all
 * Đánh dấu tất cả thông báo của người dùng là đã đọc
 */
export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = Number(req.user?.userId || (req.user as any)?.id);
  if (!userId) {
    throw new AppError("Unauthorized", 401);
  }

  const updatedCount = await markAllAsRead(userId);

  res.status(200).json({
    success: true,
    message: `Đã đánh dấu ${updatedCount} thông báo là đã đọc`,
    data: {
      updatedCount,
      unreadCount: 0
    }
  });
});

/**
 * DELETE /api/notifications/:id
 * Xóa một thông báo
 */
export const removeNotification = asyncHandler(async (req: Request, res: Response) => {
  const userId = Number(req.user?.userId || (req.user as any)?.id);
  if (!userId) {
    throw new AppError("Unauthorized", 401);
  }

  const notificationId = Number(req.params.id);
  const deleted = await deleteNotification(userId, notificationId);

  if (!deleted) {
    throw new AppError("Không tìm thấy thông báo để xóa", 404);
  }

  const newUnreadCount = await getUnreadCount(userId);

  res.status(200).json({
    success: true,
    message: "Đã xóa thông báo thành công",
    data: {
      id: notificationId,
      unreadCount: newUnreadCount
    }
  });
});
