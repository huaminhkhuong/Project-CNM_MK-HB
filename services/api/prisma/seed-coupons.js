/**
 * Canonical Seed for Promotional Vouchers (Coupons)
 * Idempotent: Can be run multiple times safely without disrupting existing orders or coupon usages.
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const CANONICAL_COUPONS = [
  {
    code: "WELCOMEPC",
    name: "Ưu đãi Khách hàng mới - Giảm 100.000đ",
    description: "Giảm ngay 100.000đ áp dụng cho mọi đơn hàng linh kiện máy tính từ 1.000.000đ",
    discount_type: "FIXED_AMOUNT",
    discount_value: 100000,
    max_discount_amount: null,
    min_order_value: 1000000,
    target_type: "ALL",
    target_ids: null,
    usage_limit: 500,
    usage_limit_per_user: 1
  },
  {
    code: "BUILDPC1TR",
    name: "Đại tiệc Build PC - Giảm 1.000.000đ",
    description: "Giảm trực tiếp 1.000.000đ khi mua dàn PC hoặc combo linh kiện tổng giá trị từ 15.000.000đ",
    discount_type: "FIXED_AMOUNT",
    discount_value: 1000000,
    max_discount_amount: null,
    min_order_value: 15000000,
    target_type: "ALL",
    target_ids: null,
    usage_limit: 200,
    usage_limit_per_user: 1
  },
  {
    code: "VRAMPRO",
    name: "Nâng cấp Đồ họa - Giảm 10% VGA",
    description: "Giảm 10% (tối đa 500.000đ) khi mua Card màn hình (GPU / VGA) giá trị từ 3.000.000đ",
    discount_type: "PERCENTAGE",
    discount_value: 10,
    max_discount_amount: 500000,
    min_order_value: 3000000,
    target_type: "CATEGORY",
    target_ids: JSON.stringify([4]), // Category 4: GPU
    usage_limit: 100,
    usage_limit_per_user: 2
  },
  {
    code: "RAMSUPER",
    name: "Combo RAM Siêu tốc - Giảm 50.000đ",
    description: "Giảm ngay 50.000đ khi mua RAM DDR4/DDR5 giá trị từ 500.000đ",
    discount_type: "FIXED_AMOUNT",
    discount_value: 50000,
    max_discount_amount: null,
    min_order_value: 500000,
    target_type: "CATEGORY",
    target_ids: JSON.stringify([3]), // Category 3: RAM
    usage_limit: 300,
    usage_limit_per_user: 2
  },
  {
    code: "FREESHIP50",
    name: "Trợ giá Vận chuyển - Giảm 50.000đ",
    description: "Hỗ trợ 50.000đ chi phí vận chuyển hoặc giảm trực tiếp cho đơn từ 300.000đ",
    discount_type: "FIXED_AMOUNT",
    discount_value: 50000,
    max_discount_amount: null,
    min_order_value: 300000,
    target_type: "ALL",
    target_ids: null,
    usage_limit: 1000,
    usage_limit_per_user: 3
  }
];

async function seedCoupons() {
  console.log("🎟️ [Coupons Seed] Verifying & seeding canonical promotion coupons...");
  const now = new Date();
  const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
  const endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year ahead

  let inserted = 0;
  let updated = 0;

  for (const c of CANONICAL_COUPONS) {
    const existing = await prisma.coupon.findUnique({
      where: { code: c.code }
    });

    if (!existing) {
      await prisma.coupon.create({
        data: {
          code: c.code,
          name: c.name,
          description: c.description,
          discount_type: c.discount_type,
          discount_value: c.discount_value,
          max_discount_amount: c.max_discount_amount,
          min_order_value: c.min_order_value,
          target_type: c.target_type,
          target_ids: c.target_ids,
          usage_limit: c.usage_limit,
          used_count: 0,
          usage_limit_per_user: c.usage_limit_per_user,
          start_date: startDate,
          end_date: endDate,
          is_active: true
        }
      });
      inserted++;
    } else {
      await prisma.coupon.update({
        where: { id: existing.id },
        data: {
          name: c.name,
          description: c.description,
          discount_type: c.discount_type,
          discount_value: c.discount_value,
          max_discount_amount: c.max_discount_amount,
          min_order_value: c.min_order_value,
          target_type: c.target_type,
          target_ids: c.target_ids,
          end_date: endDate,
          is_active: true
        }
      });
      updated++;
    }
  }

  console.log(`✅ [Coupons Seed] Completed. ${inserted} inserted, ${updated} verified/updated.`);
}

if (require.main === module) {
  seedCoupons()
    .catch((err) => {
      console.error("❌ [Coupons Seed] Failed:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { seedCoupons };
