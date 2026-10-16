import { getDbPool } from "../../config/database";

export interface UserNotification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export async function initNotificationsTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      link VARCHAR(255) NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_notif_user (user_id),
      INDEX idx_user_notif_read (user_id, is_read)
    )
  `);
}

export async function createNotification(payload: {
  userId: number;
  type?: string;
  title: string;
  message: string;
  link?: string;
}) {
  const pool = getDbPool();
  await initNotificationsTable();
  const [result]: any = await pool.query(
    `INSERT INTO user_notifications (user_id, type, title, message, link, is_read) VALUES (?, ?, ?, ?, ?, 0)`,
    [payload.userId, payload.type || "SYSTEM", payload.title, payload.message, payload.link || null]
  );
  return { id: result.insertId, ...payload, isRead: false };
}

export async function getUserNotifications(userId: number) {
  const pool = getDbPool();
  await initNotificationsTable();
  const [rows]: any = await pool.query(
    `SELECT id, user_id as userId, type, title, message, link, is_read as isRead, created_at as createdAt FROM user_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`,
    [userId]
  );
  return rows;
}

export async function markNotificationAsRead(userId: number, notificationId: number) {
  const pool = getDbPool();
  await pool.query(
    `UPDATE user_notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
    [notificationId, userId]
  );
  return { success: true };
}

export async function markAllNotificationsAsRead(userId: number) {
  const pool = getDbPool();
  await pool.query(
    `UPDATE user_notifications SET is_read = 1 WHERE user_id = ?`,
    [userId]
  );
  return { success: true };
}
