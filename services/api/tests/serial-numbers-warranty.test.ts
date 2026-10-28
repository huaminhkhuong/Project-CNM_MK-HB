import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/config/prisma";
import { orderSerialsService } from "../src/modules/orders/order-serials.service";
import warrantySyncService from "../src/modules/warranties/warranty-sync.service";

describe("Quản trị Serial Number / IMEI cho Linh kiện & Bảo hành (Fulfillment & Warranty S/N)", () => {
  let testUserId: number;
  let testOrderId: number;
  let testOrderItemId1: number; // Qty: 2 (e.g. RAM)
  let testOrderItemId2: number; // Qty: 1 (e.g. GPU)
  let testSkuId1: number;
  let testSkuId2: number;

  const testSerialRam1 = `TEST-RAM-SN-001-${Date.now()}`;
  const testSerialRam2 = `TEST-RAM-SN-002-${Date.now()}`;
  const testSerialGpu = `TEST-GPU-SN-888-${Date.now()}`;

  test.before(async () => {
    // 1. Tạo test user
    let user = await prisma.user.findFirst({
      where: { email: "serial-tester@example.com" }
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: "serial-tester@example.com",
          full_name: "Serial Number Tester",
          status: "ACTIVE"
        }
      });
    }
    testUserId = user.id;

    // 2. Tìm 2 SKUs
    const skus = await prisma.productSku.findMany({
      where: { is_active: true },
      take: 2,
      include: { Product: true }
    });
    assert.ok(skus.length >= 2, "Hệ thống cần ít nhất 2 SKU để chạy test S/N");
    testSkuId1 = skus[0].id;
    testSkuId2 = skus[1].id;

    // 3. Tạo một Order với 2 order items:
    // Item 1: quantity = 2
    // Item 2: quantity = 1
    const order = await prisma.order.create({
      data: {
        user_id: testUserId,
        status: "CONFIRMED",
        payment_status: "PAID",
        payment_method: "COD",
        shipping_fee: 30000,
        discount_amount: 0,
        final_amount: 5030000,
        shipping_address: "123 Tech Street, District 1, HCMC",
        OrderItem: {
          create: [
            {
              product_variant_id: testSkuId1,
              name_snapshot: skus[0].Product?.name || "Linh kiện 1",
              sku_snapshot: skus[0].name,
              unit_price: 1500000,
              quantity: 2,
              line_total: 3000000
            },
            {
              product_variant_id: testSkuId2,
              name_snapshot: skus[1].Product?.name || "Linh kiện 2",
              sku_snapshot: skus[1].name,
              unit_price: 2000000,
              quantity: 1,
              line_total: 2000000
            }
          ]
        }
      },
      include: {
        OrderItem: true
      }
    });

    testOrderId = order.id;
    testOrderItemId1 = order.OrderItem[0].id;
    testOrderItemId2 = order.OrderItem[1].id;
  });

  test.after(async () => {
    // Dọn dẹp dữ liệu test
    if (testOrderId) {
      await prisma.warrantyItem.deleteMany({
        where: { order_id: testOrderId }
      });
      await (prisma as any).orderItemSerial?.deleteMany({
        where: { order_id: testOrderId }
      });
      await prisma.orderItem.deleteMany({
        where: { order_id: testOrderId }
      });
      await prisma.order.delete({
        where: { id: testOrderId }
      });
    }
  });

  test("1. Validation: Không cho phép gán thiếu số lượng S/N cho sản phẩm có quantity > 1", async () => {
    // Item 1 có quantity = 2, nhưng nhân viên chỉ nhập 1 S/N
    await assert.rejects(
      async () => {
        await orderSerialsService.assignOrderSerials({
          orderId: testOrderId,
          items: [
            {
              orderItemId: testOrderItemId1,
              serials: [testSerialRam1] // Thiếu 1 S/N
            }
          ]
        });
      },
      (err: any) => {
        assert.ok(
          err.message.includes("cần đúng 2 Serial Number"),
          `Expected message about requiring 2 serials, got: ${err.message}`
        );
        return true;
      }
    );
  });

  test("2. Validation: Không cho phép trùng Serial Number trong cùng một lô gán", async () => {
    await assert.rejects(
      async () => {
        await orderSerialsService.assignOrderSerials({
          orderId: testOrderId,
          items: [
            {
              orderItemId: testOrderItemId1,
              serials: [testSerialRam1, testSerialRam1] // Trùng S/N
            }
          ]
        });
      },
      (err: any) => {
        assert.ok(
          err.message.includes("bị trùng lặp"),
          `Expected duplicate error, got: ${err.message}`
        );
        return true;
      }
    );
  });

  test("3. Gán thành công S/N đầy đủ cho đơn hàng: lưu order_item_serials & snapshot vào order_items", async () => {
    const result = await orderSerialsService.assignOrderSerials({
      orderId: testOrderId,
      items: [
        {
          orderItemId: testOrderItemId1,
          serials: [testSerialRam1, testSerialRam2]
        },
        {
          orderItemId: testOrderItemId2,
          serials: [testSerialGpu]
        }
      ],
      assignedBy: 1
    });

    assert.equal(result.totalAssigned, 3, "Phải gán đủ 3 Serial Number cho cả đơn");

    // Kiểm tra trạng thái fulfilled
    const fulfillmentCheck = await orderSerialsService.checkOrderSerialsFulfilled(testOrderId);
    assert.equal(fulfillmentCheck.fulfilled, true, "Đơn hàng phải đạt trạng thái đủ S/N");
    assert.equal(fulfillmentCheck.totalRequired, 3);
    assert.equal(fulfillmentCheck.totalAssigned, 3);

    // Kiểm tra bảng order_item_serials
    const dbSerials = await orderSerialsService.getOrderSerials(testOrderId);
    assert.equal(dbSerials.length, 3);
    const snList = dbSerials.map((s: any) => s.serial_number);
    assert.ok(snList.includes(testSerialRam1));
    assert.ok(snList.includes(testSerialRam2));
    assert.ok(snList.includes(testSerialGpu));

    // Kiểm tra snapshot trong order_items
    const orderItems = await prisma.orderItem.findMany({
      where: { order_id: testOrderId }
    });
    const ramItem = orderItems.find((i) => i.id === testOrderItemId1);
    assert.ok(ramItem?.serial_numbers);
    const parsedRamSerials = JSON.parse(ramItem!.serial_numbers!);
    assert.deepEqual(parsedRamSerials, [testSerialRam1, testSerialRam2]);
  });

  test("4. Kích hoạt bảo hành điện tử theo Serial Number thực tế (Fulfillment Sync)", async () => {
    // Chuyển order sang DELIVERED để đồng bộ bảo hành
    await prisma.order.update({
      where: { id: testOrderId },
      data: { status: "DELIVERED" }
    });

    const createdWarranties = await warrantySyncService.createWarrantyRecordsForDeliveredOrder(testOrderId);
    assert.ok(Array.isArray(createdWarranties));
    assert.equal(createdWarranties.length, 3, "Phải tạo đúng 3 phiếu bảo hành tương ứng với 3 Serial Number");

    // Kiểm tra các bản ghi trong warranties
    const warranties = await prisma.warrantyItem.findMany({
      where: { order_id: testOrderId }
    });
    assert.equal(warranties.length, 3);

    const createdSerials = warranties.map((w: any) => w.serial_number);
    assert.ok(createdSerials.includes(testSerialRam1), "Bảo hành phải lưu S/N RAM 1");
    assert.ok(createdSerials.includes(testSerialRam2), "Bảo hành phải lưu S/N RAM 2");
    assert.ok(createdSerials.includes(testSerialGpu), "Bảo hành phải lưu S/N GPU");

    // Kiểm tra order_item_serials đã được liên kết với warranty_id tương ứng
    const updatedSerials = await orderSerialsService.getOrderSerials(testOrderId);
    for (const s of updatedSerials) {
      assert.ok(s.warranty_id, `S/N ${s.serial_number} phải được gắn warranty_id`);
      assert.equal(s.status, "IN_WARRANTY");
    }
  });

  test("5. Khách hàng tra cứu bảo hành điện tử chính xác bằng Serial Number thực tế in trên vỏ hộp", async () => {
    // Tra cứu bằng S/N RAM 2
    const lookupRam = await prisma.warrantyItem.findFirst({
      where: { serial_number: testSerialRam2 }
    });
    assert.ok(lookupRam, "Phải tìm thấy thông tin bảo hành từ S/N RAM 2");
    assert.equal(lookupRam?.serial_number, testSerialRam2);
    assert.equal(lookupRam?.order_id, testOrderId);

    // Tra cứu bằng S/N GPU
    const lookupGpu = await prisma.warrantyItem.findFirst({
      where: { serial_number: testSerialGpu }
    });
    assert.ok(lookupGpu, "Phải tìm thấy thông tin bảo hành từ S/N GPU");
    assert.equal(lookupGpu?.serial_number, testSerialGpu);
    assert.equal(lookupGpu?.order_id, testOrderId);

    // Tra cứu S/N không tồn tại
    const notFound = await prisma.warrantyItem.findFirst({
      where: { serial_number: "NON-EXISTENT-SN-99999999" }
    });
    assert.equal(notFound, null, "Không được tìm thấy với S/N giả");
  });

  test.after(async () => {
    try {
      const { getDbPool } = await import("../src/config/database");
      await getDbPool().end();
    } catch {}
    try {
      await prisma.$disconnect();
    } catch {}
  });
});

