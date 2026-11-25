import { httpClient } from "./http";

/**
 * Lấy danh sách thông báo của người dùng hiện tại
 * @param {Object} params { page, limit, unreadOnly, type }
 */
export async function getMyNotifications(params = {}) {
  const response = await httpClient.get("/notifications", { params });
  return response.data;
}

/**
 * Lấy số lượng thông báo chưa đọc
 */
export async function getMyUnreadCount() {
  const response = await httpClient.get("/notifications/unread-count");
  return response.data?.data?.unreadCount || 0;
}

/**
 * Đánh dấu một thông báo là đã đọc
 * @param {number|string} id
 */
export async function markNotificationAsRead(id) {
  const response = await httpClient.patch(`/notifications/${id}/read`);
  return response.data;
}

/**
 * Đánh dấu tất cả thông báo là đã đọc
 */
export async function markAllNotificationsAsRead() {
  const response = await httpClient.patch("/notifications/read-all");
  return response.data;
}

/**
 * Xóa một thông báo
 * @param {number|string} id
 */
export async function deleteNotification(id) {
  const response = await httpClient.delete(`/notifications/${id}`);
  return response.data;
}

export default {
  getMyNotifications,
  getMyUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
};
