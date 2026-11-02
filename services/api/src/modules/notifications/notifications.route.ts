import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import {
  getMyNotifications,
  getMyUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  removeNotification
} from "./notifications.controller";

export const notificationsRouter = Router();

// Tất cả endpoints thông báo đều yêu cầu đăng nhập
notificationsRouter.use(authenticate);

notificationsRouter.get("/", getMyNotifications);
notificationsRouter.get("/unread-count", getMyUnreadCount);
notificationsRouter.patch("/read-all", markAllNotificationsRead);
notificationsRouter.patch("/:id/read", markNotificationRead);
notificationsRouter.delete("/:id", removeNotification);

export default notificationsRouter;
