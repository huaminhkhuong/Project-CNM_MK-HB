import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/config/prisma";
import notificationsService, {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  sendOrderStatusNotification,
  sendTicketNotification,
  sendWarrantyNotification
} from "../src/modules/notifications/notifications.service";

describe("Hệ thống Thông báo In-App & Real-Time Notification Center", () => {
  let testUserId: number;

  test.before(async () => {
    // 1. Tìm hoặc tạo user kiểm thử
    let user = await prisma.user.findFirst({
      where: { email: "notif-tester@example.com" }
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: "notif-tester@example.com",
          full_name: "Notification Tester",
          phone: "0911222333",
          status: "ACTIVE"
        }
      });
    }
    testUserId = user.id;

    // Dọn sạch thông báo cũ của test user
    await prisma.notification.deleteMany({
      where: { user_id: testUserId }
    });
  });

  test.after(async () => {
    // Dọn dẹp sau khi test
    await prisma.notification.deleteMany({
      where: { user_id: testUserId }
    });
  });

  test("1. Tạo thông báo mới và kiểm tra các thuộc tính lưu trữ", async () => {
    const notif = await createNotification({
      userId: testUserId,
      type: "SYSTEM",
      title: "Chào mừng bạn đến với PC Mall!",
      message: "Tài khoản của bạn đã được kích hoạt thành công.",
      link: "/products"
    });

    assert.ok(notif, "Thông báo phải được tạo thành công");
    assert.equal(notif.userId, testUserId);
    assert.equal(notif.type, "SYSTEM");
    assert.equal(notif.title, "Chào mừng bạn đến với PC Mall!");
    assert.equal(notif.isRead, false);
    assert.equal(notif.link, "/products");

    // Kiểm tra unread count
    const unread = await getUnreadCount(testUserId);
    assert.equal(unread, 1, "Số thông báo chưa đọc phải là 1");
  });

  test("2. Gửi thông báo chuyển đổi trạng thái đơn hàng (sendOrderStatusNotification)", async () => {
    // Đơn hàng chuyển sang SHIPPED
    const notifShipped = await sendOrderStatusNotification({
      userId: testUserId,
      orderId: 9901,
      status: "SHIPPED",
      carrier: "Giao Hàng Nhanh",
      trackingCode: "GHN-HCM-9901"
    });

    assert.ok(notifShipped);
    assert.equal(notifShipped.type, "ORDER");
    assert.equal(String(notifShipped.referenceId), "9901");
    assert.equal(notifShipped.referenceType, "ORDER");
    assert.equal(notifShipped.link, "/orders/9901");
    assert.ok(notifShipped.message.includes("GHN-HCM-9901"));
    assert.ok(notifShipped.message.includes("Giao Hàng Nhanh"));

    // Đơn hàng chuyển sang DELIVERED
    const notifDelivered = await sendOrderStatusNotification({
      userId: testUserId,
      orderId: 9901,
      status: "DELIVERED"
    });

    assert.ok(notifDelivered);
    assert.equal(notifDelivered.type, "ORDER");
    assert.ok(notifDelivered.title.includes("giao thành công"));
  });

  test("3. Gửi thông báo tiến độ Ticket hỗ trợ kỹ thuật (sendTicketNotification)", async () => {
    // Đổi trạng thái ticket
    const notifStatus = await sendTicketNotification({
      userId: testUserId,
      ticketId: "TCK-8801",
      ticketTitle: "Lỗi màn hình xanh khi lắp RAM",
      action: "STATUS_CHANGED",
      status: "IN_PROGRESS"
    });

    assert.ok(notifStatus);
    assert.equal(notifStatus.type, "TICKET");
    assert.equal(String(notifStatus.referenceId), "TCK-8801");
    assert.ok(notifStatus.title.includes("Đang xử lý"));

    // Kỹ thuật viên phản hồi
    const notifReply = await sendTicketNotification({
      userId: testUserId,
      ticketId: "TCK-8801",
      ticketTitle: "Lỗi màn hình xanh khi lắp RAM",
      action: "NEW_REPLY",
      detailMessage: "Chào bạn, vui lòng kiểm tra lại khe cắm RAM số 2 và số 4."
    });

    assert.ok(notifReply);
    assert.ok(notifReply.message.includes("khe cắm RAM"));
  });

  test("4. Gửi thông báo bảo hành điện tử chính hãng (sendWarrantyNotification)", async () => {
    const notif = await sendWarrantyNotification({
      userId: testUserId,
      requestId: 7701,
      title: "Bảo hành đã tiếp nhận",
      message: "Linh kiện RTX 4070 của bạn đã được kỹ thuật viên tiếp nhận kiểm tra."
    });

    assert.ok(notif);
    assert.equal(notif.type, "WARRANTY");
    assert.equal(String(notif.referenceId), "7701");
    assert.equal(notif.link, "/warranties");
  });

  test("5. Lấy danh sách thông báo và lọc theo danh mục", async () => {
    // Lấy tất cả
    const all = await getUserNotifications(testUserId, { limit: 20 });
    assert.ok(all.items.length >= 5, "Phải có ít nhất 5 thông báo đã tạo");

    // Lọc theo ORDER
    const ordersOnly = await getUserNotifications(testUserId, { type: "ORDER" });
    assert.ok(ordersOnly.items.length >= 2);
    assert.ok(ordersOnly.items.every((n) => n.type === "ORDER"));

    // Lọc theo TICKET
    const ticketsOnly = await getUserNotifications(testUserId, { type: "TICKET" });
    assert.ok(ticketsOnly.items.length >= 2);
    assert.ok(ticketsOnly.items.every((n) => n.type === "TICKET"));
  });

  test("6. Đánh dấu đã đọc từng thông báo (markAsRead) và tất cả (markAllAsRead)", async () => {
    const listBefore = await getUserNotifications(testUserId, { unreadOnly: true });
    const countBefore = listBefore.items.length;
    assert.ok(countBefore >= 5);

    // Đánh dấu đọc 1 cái
    const target = listBefore.items[0];
    const markOneRes = await markAsRead(testUserId, target.id);
    assert.ok(markOneRes);

    const countAfterOne = await getUnreadCount(testUserId);
    assert.equal(countAfterOne, countBefore - 1);

    // Đánh dấu đọc tất cả
    const markAllRes = await markAllAsRead(testUserId);
    assert.ok(markAllRes);

    const countAfterAll = await getUnreadCount(testUserId);
    assert.equal(countAfterAll, 0, "Sau khi markAllAsRead, unreadCount phải là 0");
  });

  test("7. Xóa thông báo (deleteNotification)", async () => {
    const all = await getUserNotifications(testUserId, { limit: 1 });
    assert.ok(all.items.length > 0);

    const targetId = all.items[0].id;
    const deleted = await deleteNotification(testUserId, targetId);
    assert.ok(deleted);

    // Xác nhận đã không còn trong danh sách
    const checkList = await getUserNotifications(testUserId, { limit: 50 });
    const found = checkList.items.find((n) => n.id === targetId);
    assert.equal(found, undefined, "Thông báo đã xóa không được xuất hiện lại");
  });
});
