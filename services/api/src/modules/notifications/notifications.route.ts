import { Request, Response, Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from "./notifications.service";

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

notificationsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.userId);
    const notifications = await getUserNotifications(userId);
    return res.json({ success: true, data: notifications });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Lỗi tải thông báo" });
  }
});

notificationsRouter.patch("/:id/read", async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.userId);
    const notificationId = Number(req.params.id);
    await markNotificationAsRead(userId, notificationId);
    return res.json({ success: true, message: "Đã đánh dấu đã đọc" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Lỗi cập nhật thông báo" });
  }
});

notificationsRouter.post("/read-all", async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.userId);
    await markAllNotificationsAsRead(userId);
    return res.json({ success: true, message: "Đã đánh dấu tất cả đã đọc" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Lỗi cập nhật tất cả thông báo" });
  }
});
