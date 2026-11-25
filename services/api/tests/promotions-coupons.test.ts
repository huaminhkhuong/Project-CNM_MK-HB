import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/config/prisma";
import {
  listAvailableCoupons,
  validateAndCalculateCoupon
} from "../src/modules/coupons/coupons.service";
import ordersService from "../src/modules/orders/orders.service";

describe("Luồng Khuyến Mãi / Mã Giảm Giá (Voucher & Promotion System)", () => {
  let testUserId: number;
  let testSkuId: number;
  let testGpuSkuId: number;

  test.before(async () => {
    // 1. Tìm hoặc tạo test user
    let user = await prisma.user.findFirst({
      where: { email: "coupon-tester@example.com" }
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: "coupon-tester@example.com",
          full_name: "Coupon Tester",
          status: "ACTIVE"
        }
      });
    }
    testUserId = user.id;

    // Reset previous coupon usage for test user
    await prisma.couponUsage.deleteMany({
      where: { user_id: testUserId }
    });
    await prisma.coupon.updateMany({
      where: { code: "WELCOMEPC" },
      data: { used_count: 0 }
    });

    // 2. Tìm một SKU thông thường và một SKU thuộc danh mục GPU (category_id = 4)
    const gpuSku = await prisma.productSku.findFirst({
      where: {
        is_active: true,
        stock: { gte: 5 },
        Product: {
          category_id: 4 // GPU
        }
      },
      include: { Product: true }
    });

    if (gpuSku) {
      testGpuSkuId = gpuSku.id;
    }

    const anySku = await prisma.productSku.findFirst({
      where: {
        is_active: true,
        stock: { gte: 5 }
      },
      include: { Product: true }
    });

    if (anySku) {
      testSkuId = anySku.id;
    }
  });

  test("1. listAvailableCoupons: Trả về danh sách voucher hợp lệ còn hạn", async () => {
    const coupons = await listAvailableCoupons(testUserId);
    assert.ok(Array.isArray(coupons), "Vouchers should be an array");
    assert.ok(coupons.length >= 3, "At least 3 seeded vouchers should be returned");

    const codes = coupons.map((c) => c.code);
    assert.ok(codes.includes("WELCOMEPC"), "Must include WELCOMEPC");
    assert.ok(codes.includes("BUILDPC1TR"), "Must include BUILDPC1TR");
    assert.ok(codes.includes("VRAMPRO"), "Must include VRAMPRO");
  });

  test("2. validateAndCalculateCoupon: Áp dụng mã giảm theo tổng đơn (WELCOMEPC: giảm 100k cho đơn từ 1tr)", async () => {
    const validResult = await validateAndCalculateCoupon({
      code: "WELCOMEPC",
      userId: testUserId,
      items: [
        {
          productId: 1,
          categoryId: 1,
          unitPrice: 1500000,
          quantity: 1,
          lineTotal: 1500000
        }
      ],
      totalAmount: 1500000,
      shippingFee: 30000
    });

    assert.equal(validResult.valid, true);
    assert.equal(validResult.coupon?.code, "WELCOMEPC");
    assert.equal(validResult.discountAmount, 100000);
    assert.equal(validResult.finalAmount, 1500000 - 100000 + 30000);

    // Kiểm tra trường hợp đơn chưa đạt giá trị tối thiểu 1.000.000đ -> Báo lỗi
    await assert.rejects(
      async () => {
        await validateAndCalculateCoupon({
          code: "WELCOMEPC",
          userId: testUserId,
          items: [
            {
              productId: 1,
              categoryId: 1,
              unitPrice: 400000,
              quantity: 1,
              lineTotal: 400000
            }
          ],
          totalAmount: 400000
        });
      },
      {
        message: /chưa đạt giá trị tối thiểu/i
      }
    );
  });

  test("3. validateAndCalculateCoupon: Áp dụng mã theo linh kiện chuyên biệt (VRAMPRO: 10% tối đa 500k cho VGA)", async () => {
    // Trường hợp 1: Có card màn hình (categoryId: 4) trị giá 4.000.000đ -> Giảm 10% = 400.000đ
    const validResult = await validateAndCalculateCoupon({
      code: "VRAMPRO",
      userId: testUserId,
      items: [
        {
          productId: 10,
          categoryId: 4, // GPU
          unitPrice: 4000000,
          quantity: 1,
          lineTotal: 4000000
        },
        {
          productId: 20,
          categoryId: 3, // RAM
          unitPrice: 800000,
          quantity: 1,
          lineTotal: 800000
        }
      ],
      totalAmount: 4800000
    });

    assert.equal(validResult.valid, true);
    assert.equal(validResult.coupon?.code, "VRAMPRO");
    assert.equal(validResult.eligibleAmount, 4000000);
    assert.equal(validResult.discountAmount, 400000); // 10% của 4 triệu

    // Trường hợp 2: Giỏ hàng không có sản phẩm nào thuộc danh mục GPU -> Báo lỗi danh mục
    await assert.rejects(
      async () => {
        await validateAndCalculateCoupon({
          code: "VRAMPRO",
          userId: testUserId,
          items: [
            {
              productId: 20,
              categoryId: 3, // RAM
              unitPrice: 5000000,
              quantity: 1,
              lineTotal: 5000000
            }
          ],
          totalAmount: 5000000
        });
      },
      {
        message: /chỉ áp dụng cho nhóm linh kiện chuyên biệt/i
      }
    );
  });

  test("4. Checkout: Đặt hàng thành công có áp mã giảm giá và ghi nhận coupon_usages", async () => {
    if (!testSkuId) {
      return; // Skip if no sku in database
    }

    // Lấy hoặc tạo address cho test user
    let address = await prisma.address.findFirst({
      where: { user_id: testUserId }
    });
    if (!address) {
      address = await prisma.address.create({
        data: {
          user_id: testUserId,
          full_name: "Tester Coupon",
          phone: "0901234567",
          province: "TP Hồ Chí Minh",
          district: "Quận 1",
          ward: "Phường Bến Nghé",
          address_line: "123 Lê Lợi"
        }
      });
    }

    // Đưa hàng vào cart của user
    let cart = await prisma.cart.findFirst({
      where: { user_id: testUserId }
    });
    if (!cart) {
      cart = await prisma.cart.create({ data: { user_id: testUserId } });
    }

    // Xóa cart items cũ
    await prisma.cartItem.deleteMany({ where: { cart_id: cart.id } });

    // Thêm sản phẩm vào cart với số lượng đủ giá trị
    await prisma.cartItem.create({
      data: {
        cart_id: cart.id,
        product_variant_id: testSkuId,
        quantity: 2
      }
    });

    const couponBefore = await prisma.coupon.findUnique({
      where: { code: "WELCOMEPC" }
    });
    const usedCountBefore = couponBefore?.used_count || 0;

    // Đặt hàng qua createOrderFromCart có couponCode
    const createdOrder = await ordersService.createOrderFromCart(testUserId, {
      addressId: address.id,
      paymentMethod: "COD",
      shippingFee: 20000,
      couponCode: "WELCOMEPC"
    });

    assert.ok(createdOrder, "Order should be created");
    assert.equal(createdOrder.couponCode, "WELCOMEPC");
    assert.ok(Number(createdOrder.discountAmount) > 0, "Discount amount should be > 0");

    // Kiểm tra coupon used_count đã tăng lên 1
    const couponAfter = await prisma.coupon.findUnique({
      where: { code: "WELCOMEPC" }
    });
    assert.equal(couponAfter?.used_count, usedCountBefore + 1);

    // Kiểm tra bản ghi coupon_usages đã được lưu
    const usageRecord = await prisma.couponUsage.findFirst({
      where: {
        order_id: createdOrder.id,
        user_id: testUserId
      }
    });
    assert.ok(usageRecord, "Coupon usage record must exist in db");
    assert.equal(Number(usageRecord.discount_amount), Number(createdOrder.discountAmount));
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

