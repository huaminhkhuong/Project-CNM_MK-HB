const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const prisma = new PrismaClient();

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function main() {
  console.log("🚀 Starting Clean, Rich Database Seeding (seed-rich.js)...");

  // ── 1. Roles ──────────────────────────────────────────
  console.log("1. Seeding Roles...");
  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: { name: "ADMIN" }
  });

  const staffRole = await prisma.role.upsert({
    where: { name: "STAFF" },
    update: {},
    create: { name: "STAFF" }
  });

  const customerRole = await prisma.role.upsert({
    where: { name: "CUSTOMER" },
    update: {},
    create: { name: "CUSTOMER" }
  });
  console.log("   ✓ Roles verified: ADMIN, STAFF, CUSTOMER");

  // ── 2. Users ──────────────────────────────────────────
  console.log("2. Seeding Users...");
  const adminPassword = await bcrypt.hash("Admin@123", 10);
  const staffPassword = await bcrypt.hash("Staff@123", 10);
  const customerPassword = await bcrypt.hash("Auth@123", 10);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@cnm.local" },
    update: { full_name: "Quản trị viên Hệ thống", role_id: adminRole.id, status: "ACTIVE" },
    create: {
      email: "admin@cnm.local",
      password: adminPassword,
      full_name: "Quản trị viên Hệ thống",
      role_id: adminRole.id,
      phone: "0901234567",
      status: "ACTIVE"
    }
  });

  const staffUser = await prisma.user.upsert({
    where: { email: "staff@cnm.local" },
    update: { full_name: "Nhân viên Bán hàng PC Mall", role_id: staffRole.id, status: "ACTIVE" },
    create: {
      email: "staff@cnm.local",
      password: staffPassword,
      full_name: "Nhân viên Bán hàng PC Mall",
      role_id: staffRole.id,
      phone: "0902345678",
      status: "ACTIVE"
    }
  });

  const staffExampleUser = await prisma.user.upsert({
    where: { email: "staff@example.com" },
    update: { full_name: "Staff Demo", role_id: staffRole.id, status: "ACTIVE" },
    create: {
      email: "staff@example.com",
      password: staffPassword,
      full_name: "Staff Demo",
      role_id: staffRole.id,
      phone: "0900000003",
      status: "ACTIVE"
    }
  });

  const customerUser = await prisma.user.upsert({
    where: { email: "customer@cnm.local" },
    update: { full_name: "Khách hàng Mẫu PC Mall", role_id: customerRole.id, status: "ACTIVE" },
    create: {
      email: "customer@cnm.local",
      password: customerPassword,
      full_name: "Khách hàng Mẫu PC Mall",
      role_id: customerRole.id,
      phone: "0988123456",
      status: "ACTIVE"
    }
  });
  console.log("   ✓ Users verified: admin@cnm.local, staff@cnm.local, staff@example.com, customer@cnm.local");

  // ── 3. Categories ─────────────────────────────────────
  console.log("3. Seeding Categories...");
  const categoriesList = ["CPU", "MAINBOARD", "RAM", "GPU", "SSD", "PSU", "CASE", "COOLING"];
  const categoryMap = {};

  for (const catName of categoriesList) {
    let cat = await prisma.category.findFirst({ where: { name: catName } });
    if (!cat) {
      cat = await prisma.category.create({ data: { name: catName } });
    }
    categoryMap[catName.toLowerCase()] = cat.id;
  }
  console.log(`   ✓ ${categoriesList.length} Categories verified`);

  // ── 4. Brands ─────────────────────────────────────────
  console.log("4. Seeding Brands...");
  const brandsList = [
    { name: "Intel", logo_url: "https://upload.wikimedia.org/wikipedia/commons/7/7d/Intel_logo_%282020%29.svg" },
    { name: "AMD", logo_url: "https://upload.wikimedia.org/wikipedia/commons/7/7c/AMD_Logo.svg" },
    { name: "ASUS", logo_url: "https://upload.wikimedia.org/wikipedia/commons/2/2e/ASUS_Logo.svg" },
    { name: "MSI", logo_url: "https://upload.wikimedia.org/wikipedia/commons/0/06/MSI_Logo.svg" },
    { name: "Gigabyte", logo_url: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Gigabyte_Technology_logo_2008.svg" },
    { name: "Corsair", logo_url: "https://upload.wikimedia.org/wikipedia/commons/d/dd/Corsair_Memory_logo.svg" },
    { name: "Samsung", logo_url: "https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg" },
    { name: "Kingston", logo_url: "https://upload.wikimedia.org/wikipedia/commons/9/94/Kingston_Technology_logo.svg" },
    { name: "Cooler Master", logo_url: "" },
    { name: "DeepCool", logo_url: "" },
    { name: "Thermalright", logo_url: "" }
  ];

  for (const b of brandsList) {
    let brand = await prisma.brand.findFirst({ where: { name: b.name } });
    if (!brand) {
      await prisma.brand.create({
        data: {
          name: b.name,
          slug: slugify(b.name),
          logo_url: b.logo_url || null,
          status: "ACTIVE",
          is_active: true
        }
      });
    }
  }
  console.log(`   ✓ ${brandsList.length} Brands verified`);

  // ── 5. User Shipping Address ──────────────────────────
  console.log("5. Seeding User Addresses...");
  let addr = await prisma.address.findFirst({ where: { user_id: customerUser.id } });
  if (!addr) {
    addr = await prisma.address.create({
      data: {
        user_id: customerUser.id,
        full_name: "Khách hàng Mẫu PC Mall",
        phone: "0988123456",
        address_line: "Số 123 Đường Công Nghệ Mới",
        ward: "Phường Bến Nghé",
        district: "Quận 1",
        province: "TP. Hồ Chí Minh"
      }
    });
  }
  console.log("   ✓ Default customer address verified");

  // ── 6. Realistic Demo Orders & Warranties ─────────────
  console.log("6. Seeding Demo Orders & Warranties...");
  const sampleSkus = await prisma.productSku.findMany({
    take: 6,
    include: { Product: true }
  });

  if (sampleSkus.length >= 2) {
    const existingOrders = await prisma.order.findMany({
      where: { user_id: customerUser.id }
    });

    if (existingOrders.length === 0) {
      // Order 1: Completed Gaming Upgrade
      const item1 = sampleSkus[0];
      const item2 = sampleSkus[1];
      const p1Price = Number(item1.price || 5000000);
      const p2Price = Number(item2.price || 3000000);
      const total1 = p1Price + p2Price;

      const order1 = await prisma.order.create({
        data: {
          user_id: customerUser.id,
          status: "COMPLETED",
          payment_status: "PAID",
          payment_method: "VNPAY",
          address_id: addr.id,
          total_price: total1,
          total_amount: total1,
          shipping_fee: 0,
          final_amount: total1,
          shipping_address: "Số 123 Đường Công Nghệ Mới, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
          note: "Giao giờ hành chính, gọi trước khi đến"
        }
      });

      const oItem1 = await prisma.orderItem.create({
        data: {
          order_id: order1.id,
          product_variant_id: item1.id,
          product_id: item1.product_id,
          quantity: 1,
          unit_price: p1Price,
          line_total: p1Price,
          sku_snapshot: item1.sku || "SKU-001",
          name_snapshot: item1.Product?.name || "Linh kiện PC Mall 1"
        }
      });

      const oItem2 = await prisma.orderItem.create({
        data: {
          order_id: order1.id,
          product_variant_id: item2.id,
          product_id: item2.product_id,
          quantity: 1,
          unit_price: p2Price,
          line_total: p2Price,
          sku_snapshot: item2.sku || "SKU-002",
          name_snapshot: item2.Product?.name || "Linh kiện PC Mall 2"
        }
      });

      // Electronic Warranty for Completed Order Items
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 3);

      await prisma.warrantyItem.create({
        data: {
          user_id: customerUser.id,
          order_id: order1.id,
          order_item_id: oItem1.id,
          sku_id: item1.id,
          warranty_code: `WAR-${Date.now()}-001`,
          status: "ACTIVE",
          note: "Bảo hành chính hãng 36 tháng",
          activated_at: new Date(),
          expires_at: expiresAt
        }
      });

      await prisma.warrantyItem.create({
        data: {
          user_id: customerUser.id,
          order_id: order1.id,
          order_item_id: oItem2.id,
          sku_id: item2.id,
          warranty_code: `WAR-${Date.now()}-002`,
          status: "ACTIVE",
          note: "Bảo hành chính hãng 36 tháng",
          activated_at: new Date(),
          expires_at: expiresAt
        }
      });

      // Order 2: Processing Order
      const item3 = sampleSkus[2] || sampleSkus[0];
      const p3Price = Number(item3.price || 1500000);

      await prisma.order.create({
        data: {
          user_id: customerUser.id,
          status: "DELIVERING",
          payment_status: "PAID",
          payment_method: "COD",
          address_id: addr.id,
          total_price: p3Price + 30000,
          total_amount: p3Price,
          shipping_fee: 30000,
          final_amount: p3Price + 30000,
          shipping_address: "Số 123 Đường Công Nghệ Mới, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
          note: "Đang được chuyển qua đơn vị vận chuyển GHN"
        }
      });

      console.log("   ✓ Sample Orders & Electronic Warranties seeded successfully");
    } else {
      console.log(`   ✓ Customer already has ${existingOrders.length} orders`);
    }
  }

  // ── 7. Support Tickets ────────────────────────────────
  console.log("7. Seeding Support Tickets...");
  const existingTickets = await prisma.ticket.findMany({
    where: { user_id: customerUser.id }
  });

  if (existingTickets.length === 0) {
    const t1 = await prisma.ticket.create({
      data: {
        user_id: customerUser.id,
        title: "Tư vấn nâng cấp RAM DDR5 cho Mainboard B760",
        description: "Mình đang dùng mainboard ASUS Prime B760M-A, muốn hỏi nên chọn RAM DDR5 bus 5600 hay 6000 thì tối ưu nhất?",
        status: "RESOLVED",
        priority: "MEDIUM",
        assigned_to_id: staffUser.id
      }
    });

    await prisma.ticketMessage.create({
      data: {
        ticket_id: t1.id,
        user_id: customerUser.id,
        message: "Chào shop, mình cần tư vấn kit RAM DDR5 32GB bus 6000MHz cho main ASUS B760 ạ.",
        visibility: "PUBLIC"
      }
    });

    await prisma.ticketMessage.create({
      data: {
        ticket_id: t1.id,
        user_id: staffUser.id,
        message: "Dạ chào bạn! Với mainboard ASUS B760, bạn chọn kit Corsair Vengeance hoặc Dominator 6000MHz là chuẩn tối ưu nhất, bật XMP 1 click là chạy mượt mà không lo quá nhiệt ạ.",
        visibility: "PUBLIC"
      }
    });

    console.log("   ✓ Sample Support Tickets & Conversation seeded");
  } else {
    console.log(`   ✓ Customer already has ${existingTickets.length} support tickets`);
  }

  console.log("🎉 seed-rich.js completed successfully with 100% database compatibility!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
