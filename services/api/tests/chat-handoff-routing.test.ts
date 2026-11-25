import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { getDbPool } from "../src/config/database";
import {
  clearOnlineStaffRegistry,
  findNextAvailableStaff,
  getOnlineStaffList,
  registerOnlineStaff,
  releaseStaffSession,
  unregisterOnlineStaff
} from "../src/socket/socket.service";
import { AiContextService } from "../src/modules/ai/ai-context.service";

describe("Luồng Chuyển Giao Hỗ Trợ (AI -> Human Staff Handoff & Auto-routing)", () => {
  beforeEach(() => {
    clearOnlineStaffRegistry();
  });

  after(async () => {
    try {
      await getDbPool().end();
    } catch {
      // ignore
    }
  });

  it("1. Phân phối phiên chat: Quản lý Online Staff & Round-robin / Least-busy routing", () => {
    // Chưa có nhân viên online -> findNextAvailableStaff trả về null
    assert.strictEqual(findNextAvailableStaff(), null);

    // Đăng ký 3 nhân viên bán hàng vào queue
    const staff1 = registerOnlineStaff("socket_nv1", {
      staffId: 101,
      staffName: "Nguyễn Văn Bán Hàng A",
      role: "SALES_STAFF"
    });
    const staff2 = registerOnlineStaff("socket_nv2", {
      staffId: 102,
      staffName: "Trần Thị Bán Hàng B",
      role: "SALES_STAFF"
    });
    const staff3 = registerOnlineStaff("socket_nv3", {
      staffId: 103,
      staffName: "Lê Kỹ Thuật C",
      role: "TECH_STAFF"
    });

    const onlineList = getOnlineStaffList();
    assert.strictEqual(onlineList.length, 3);

    // Phiên 1: Cả NV A và B đều 0 phiên -> Phân phối cho NV A
    const assigned1 = findNextAvailableStaff("SALES_STAFF");
    assert.ok(assigned1);
    assert.strictEqual(assigned1.staffName, "Nguyễn Văn Bán Hàng A");
    assert.strictEqual(assigned1.activeSessionsCount, 1);

    // Phiên 2: NV A có 1 phiên, NV B có 0 phiên -> Phân phối cho NV B (Least-busy)
    const assigned2 = findNextAvailableStaff("SALES_STAFF");
    assert.ok(assigned2);
    assert.strictEqual(assigned2.staffName, "Trần Thị Bán Hàng B");
    assert.strictEqual(assigned2.activeSessionsCount, 1);

    // Phiên 3: Cả 2 đều có 1 phiên -> Round-robin tie-breaker chọn NV A (assigned lâu hơn trước đó)
    const assigned3 = findNextAvailableStaff("SALES_STAFF");
    assert.ok(assigned3);
    assert.strictEqual(assigned3.staffName, "Nguyễn Văn Bán Hàng A");
    assert.strictEqual(assigned3.activeSessionsCount, 2);

    // Release phiên của NV A khi đóng session
    releaseStaffSession("Nguyễn Văn Bán Hàng A");
    assert.strictEqual(staff1.activeSessionsCount, 1);

    // Hủy đăng ký NV B khi disconnect
    unregisterOnlineStaff("socket_nv2");
    assert.strictEqual(getOnlineStaffList().length, 2);
  });

  it("2. Chuyển giao Context Summary: Tạo briefing tóm tắt ngữ cảnh AI trao đổi, cấu hình PC và giỏ hàng", () => {
    const fakeContext = {
      userId: 88,
      hasActiveBuild: true,
      buildId: 12,
      buildName: "Dàn máy Gaming i5 13400F + RTX 4060",
      buildTotalPrice: 24500000,
      buildComponents: [
        { type: "CPU", name: "Intel Core i5 13400F", price: 4200000, sku: "CPU-I5-13400F" },
        { type: "MAINBOARD", name: "ASUS TUF B760M-PLUS", price: 3800000, sku: "MB-B760M" },
        { type: "GPU", name: "MSI GeForce RTX 4060 8GB", price: 8900000, sku: "GPU-RTX-4060" }
      ],
      missingComponents: ["psu", "case"],
      hasCart: true,
      cartItemCount: 2,
      cartTotalPrice: 1500000,
      cartItems: [
        { name: "Chuột Logitech G102 Lightsync", quantity: 1, price: 450000 },
        { name: "Bàn phím cơ AKKO 3087", quantity: 1, price: 1050000 }
      ],
      formattedContextText: ""
    };

    const aiHistory = [
      { role: "user", content: "Mình có ngân sách 25 triệu cần build máy chơi Black Myth Wukong" },
      { role: "assistant", content: "Với ngân sách 25tr, mình khuyến nghị cấu hình i5 13400F kết hợp RTX 4060 8GB." },
      { role: "user", content: "Nguồn 650W có gánh nổi cấu hình này không bạn?" },
      { role: "assistant", content: "Nguồn 650W 80 Plus Bronze là hoàn toàn dư tải an toàn cho cấu hình này." }
    ];

    const briefing = AiContextService.buildHandoffBriefing({
      userContext: fakeContext,
      aiHistory,
      criteria: {
        purpose: "gaming",
        budget: 25000000,
        resolution: "2k",
        ownedList: ["RAM 16GB DDR4"],
        ownedNotes: "Có sẵn 2 thanh Corsair LPX 8GB"
      },
      note: "Khách cần kiểm tra kho xem sẵn nguồn 650W không để giao trong ngày"
    });

    assert.ok(briefing.briefingText);
    assert.strictEqual(briefing.metadata.isHandoffSummary, true);
    assert.strictEqual(briefing.metadata.hasActiveBuild, true);
    assert.strictEqual(briefing.metadata.componentsCount, 3);
    assert.strictEqual(briefing.metadata.aiTurnsCount, 2);

    // Kiểm tra nội dung text briefing chứa đầy đủ thông tin bàn giao cho nhân viên
    assert.ok(briefing.briefingText.includes("TÓM TẮT NGỮ CẢNH TƯ VẤN (AI ➔ NHÂN VIÊN BÁN HÀNG)"));
    assert.ok(briefing.briefingText.includes("Chơi Game & Esports"));
    assert.ok(briefing.briefingText.includes("25.000.000 đ"));
    assert.ok(briefing.briefingText.includes("2K QHD"));
    assert.ok(briefing.briefingText.includes("RAM 16GB DDR4"));
    assert.ok(briefing.briefingText.includes("Dàn máy Gaming i5 13400F + RTX 4060"));
    assert.ok(briefing.briefingText.includes("Linh kiện còn thiếu cần tư vấn: PSU, CASE"));
    assert.ok(briefing.briefingText.includes("Chuột Logitech G102 Lightsync"));
    assert.ok(briefing.briefingText.includes("Nguồn 650W có gánh nổi cấu hình này không bạn?"));
    assert.ok(briefing.briefingText.includes("Khách cần kiểm tra kho xem sẵn nguồn 650W không"));
    assert.ok(briefing.briefingText.includes("KHÔNG CẦN hỏi lại từ đầu!"));
  });

  it("3. Context Summary hỗ trợ Fallback sang clientBuild (khi khách vãng lai chưa lưu DB)", () => {
    const clientBuild = {
      name: "Dàn PC Khách Tự Ráp Trực Tiếp",
      totalPrice: 18000000,
      components: {
        cpu: { name: "AMD Ryzen 5 5600", price: 3200000 },
        mainboard: { name: "ASUS B550M-A", price: 2500000 },
        gpu: { name: "Radeon RX 6600 8GB", price: 5800000 }
      }
    };

    const briefing = AiContextService.buildHandoffBriefing({
      clientBuild,
      criteria: {
        purpose: "office",
        budget: 18000000
      }
    });

    assert.ok(briefing.briefingText);
    assert.strictEqual(briefing.metadata.hasActiveBuild, true);
    assert.strictEqual(briefing.metadata.componentsCount, 3);
    assert.ok(briefing.briefingText.includes("Dàn PC Khách Tự Ráp Trực Tiếp"));
    assert.ok(briefing.briefingText.includes("AMD Ryzen 5 5600"));
    assert.ok(briefing.briefingText.includes("18.000.000 đ"));
  });
});
