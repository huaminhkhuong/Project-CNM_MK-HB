import test, { describe, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/services/token.service";
import { prisma } from "../src/config/prisma";
const { closePool } = require("../src/config/database");

describe("Tickets RMA & Customer Support Authorization", () => {
  const app = createApp();

  let customerToken: string;
  let customerUser: any;
  let techToken: string;
  let techUser: any;
  let createdTicketId: number;

  test.before(async () => {
    // 1. Ensure customer user
    customerUser = await prisma.user.findFirst({
      where: { email: "customer@cnm.local" }
    });
    if (!customerUser) {
      customerUser = await prisma.user.create({
        data: {
          email: "customer@cnm.local",
          full_name: "Demo Customer",
          status: "ACTIVE"
        }
      });
    }

    customerToken = signAccessToken({
      userId: String(customerUser.id),
      email: customerUser.email,
      role: "CUSTOMER"
    });

    // 2. Ensure tech staff user
    techUser = await prisma.user.findFirst({
      where: { email: "tech1@cnm.local" }
    });
    if (!techUser) {
      techUser = await prisma.user.create({
        data: {
          email: "tech1@cnm.local",
          full_name: "Technician One",
          status: "ACTIVE"
        }
      });
    }

    techToken = signAccessToken({
      userId: String(techUser.id),
      email: techUser.email,
      role: "TECH_STAFF"
    });
  });

  after(async () => {
    try {
      if (createdTicketId) {
        await (prisma as any).ticketMessage?.deleteMany({
          where: { ticket_id: createdTicketId }
        });
        await (prisma as any).ticket?.delete({
          where: { id: createdTicketId }
        });
      }
    } catch {}
    try {
      await prisma.$disconnect();
    } catch {}
    try {
      await closePool();
    } catch {}
  });

  test("1. POST /api/tickets: Khách hàng tạo ticket RMA khiếu nại kỹ thuật thành công", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        title: "Lỗi card màn hình không xuất tín hiệu",
        description: "VGA mới nhận không lên hình khi cắm cổng DP, quạt quay ngắt quãng",
        priority: "HIGH"
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.id);
    assert.equal(res.body.data.title, "Lỗi card màn hình không xuất tín hiệu");
    assert.equal(res.body.data.status, "OPEN");

    createdTicketId = res.body.data.id;
  });

  test("2. GET /api/tickets/my: Khách hàng xem danh sách ticket của chính mình", async () => {
    const res = await request(app)
      .get("/api/tickets/my")
      .set("Authorization", `Bearer ${customerToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    const found = res.body.data.find((t: any) => t.id === createdTicketId);
    assert.ok(found, "Danh sách ticket của khách phải chứa ticket vừa tạo");
  });

  test("3. POST /api/tickets/:id/messages: Khách hàng gửi tin nhắn phản hồi vào ticket", async () => {
    const res = await request(app)
      .post(`/api/tickets/${createdTicketId}/messages`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        message: "Em đã thử đổi cáp HDMI và khe PCIe khác nhưng vẫn không lên tín hiệu"
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.id);
  });

  test("4. Phân quyền RBAC: Khách hàng thường KHÔNG được truy cập /api/tickets/stats", async () => {
    const res = await request(app)
      .get("/api/tickets/stats")
      .set("Authorization", `Bearer ${customerToken}`);

    assert.equal(res.status, 403, "Khách hàng thường phải bị chặn 403 Forbidden");
  });

  test("5. GET /api/tickets/stats: Kỹ thuật viên xem thống kê hàng chờ ticket", async () => {
    const res = await request(app)
      .get("/api/tickets/stats")
      .set("Authorization", `Bearer ${techToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data !== undefined);
  });

  test("6. PATCH /api/tickets/:id: Kỹ thuật viên tiếp nhận và cập nhật trạng thái ticket", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${createdTicketId}`)
      .set("Authorization", `Bearer ${techToken}`)
      .send({
        status: "IN_PROGRESS",
        priority: "URGENT"
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, "IN_PROGRESS");
    assert.equal(res.body.data.priority, "URGENT");
  });
});
