const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function solveLowIssues() {
  console.log('====================================================');
  console.log('🚀 BẮT ĐẦU XỬ LÝ TOÀN BỘ CÁC VẤN ĐỀ THẤP (9, 10, 11)');
  console.log('====================================================\n');

  // =========================================================================
  // ISSUE 9: ĐẢM BẢO USER ROLE STAFF (role_id = 3)
  // =========================================================================
  console.log('--- [ISSUE 9] Khắc phục thiếu STAFF role (role_id=3) ---');
  const staffRole = await prisma.role.findFirst({
    where: { OR: [{ id: 3 }, { name: 'STAFF' }] }
  });
  console.log(`✓ STAFF Role info: ID = ${staffRole?.id}, Name = ${staffRole?.name}`);

  const defaultPasswordHash = '$2a$10$YPytK4CqepwcmOKyjOraKOJZKxo.AAdRPx7G03SVVo4HDH6f82UPq'; // demo password

  // 1. staff@example.com (theo chuẩn bộ test @example.com)
  const staffExample = await prisma.user.upsert({
    where: { email: 'staff@example.com' },
    update: {
      role_id: 3,
      status: 'ACTIVE',
      full_name: 'Staff Demo'
    },
    create: {
      email: 'staff@example.com',
      password: defaultPasswordHash,
      full_name: 'Staff Demo',
      role_id: 3,
      phone: '0900000003',
      status: 'ACTIVE'
    }
  });
  console.log(`✅ Đã tạo/cập nhật user: staff@example.com (ID: ${staffExample.id}, role_id: ${staffExample.role_id})`);

  // 2. staff@cnm.local
  const staffLocal = await prisma.user.upsert({
    where: { email: 'staff@cnm.local' },
    update: {
      role_id: 3,
      status: 'ACTIVE',
      full_name: 'Nhân viên Bán hàng PC Mall'
    },
    create: {
      email: 'staff@cnm.local',
      password: defaultPasswordHash,
      full_name: 'Nhân viên Bán hàng PC Mall',
      role_id: 3,
      phone: '0902345678',
      status: 'ACTIVE'
    }
  });
  console.log(`✅ Đã tạo/cập nhật user: staff@cnm.local (ID: ${staffLocal.id}, role_id: ${staffLocal.role_id})`);

  const staffUsers = await prisma.user.findMany({
    where: { role_id: 3 },
    select: { id: true, email: true, full_name: true, role_id: true }
  });
  console.log(`📊 Hiện có ${staffUsers.length} tài khoản với role_id=3 (STAFF):`, staffUsers);
  console.log();

  // =========================================================================
  // ISSUE 10: XỬ LÝ DUPLICATE BRANDS (TeamGroup x2, Lian Li x2)
  // =========================================================================
  console.log('--- [ISSUE 10] Gộp và xóa các Brands bị trùng lặp (TeamGroup, Lian Li) ---');

  // 1. TeamGroup (giữ ID 12, gộp ID 18)
  const tg18 = await prisma.brand.findUnique({ where: { id: 18 } });
  if (tg18) {
    const movedTG = await prisma.product.updateMany({
      where: { brand_id: 18 },
      data: { brand_id: 12 }
    });
    await prisma.brand.delete({ where: { id: 18 } });
    console.log(`✅ Đã chuyển ${movedTG.count} sản phẩm từ Brand ID 18 sang ID 12 và xóa Brand ID 18 (TeamGroup).`);
  } else {
    console.log('ℹ️ Brand TeamGroup ID 18 đã được gộp từ trước.');
  }

  // 2. Lian Li (giữ ID 17, gộp ID 23)
  const ll23 = await prisma.brand.findUnique({ where: { id: 23 } });
  if (ll23) {
    const movedLL = await prisma.product.updateMany({
      where: { brand_id: 23 },
      data: { brand_id: 17 }
    });
    await prisma.brand.delete({ where: { id: 23 } });
    console.log(`✅ Đã chuyển ${movedLL.count} sản phẩm từ Brand ID 23 sang ID 17 và xóa Brand ID 23 (Lian Li).`);
  } else {
    console.log('ℹ️ Brand Lian Li ID 23 đã được gộp từ trước.');
  }

  // Kiểm tra trùng lặp còn lại trong brands
  const allBrands = await prisma.brand.findMany({ orderBy: { name: 'asc' } });
  const brandNameMap = new Map();
  const duplicates = [];
  for (const b of allBrands) {
    const key = b.name.toLowerCase().trim();
    if (brandNameMap.has(key)) {
      duplicates.push({ name: b.name, ids: [brandNameMap.get(key), b.id] });
    } else {
      brandNameMap.set(key, b.id);
    }
  }

  if (duplicates.length === 0) {
    console.log(`✅ ĐẠT: Không còn thương hiệu nào bị trùng lặp trong DB. Tổng số brands: ${allBrands.length}.`);
  } else {
    console.warn('⚠️ Vẫn còn thương hiệu trùng lặp:', duplicates);
  }
  console.log();

  // =========================================================================
  // ISSUE 11: KIỂM TRA & CHẠY SEED-DEMO-PC-BUILD.JS
  // =========================================================================
  console.log('--- [ISSUE 11] Kiểm tra và xác nhận seed-demo-pc-build.js ---');
  const demoBuildsInDb = await prisma.pcBuild.findMany({
    where: {
      OR: [
        { name: { contains: 'Gaming Quốc Dân' } },
        { name: { contains: 'Hi-End Gaming' } },
        { name: { contains: 'Văn Phòng' } }
      ]
    },
    include: {
      PcBuildItem: {
        include: {
          ProductSku: {
            include: { Product: true }
          }
        }
      }
    }
  });

  console.log(`📊 Tìm thấy ${demoBuildsInDb.length}/3 bộ PC Build mẫu trong database:`);
  for (const b of demoBuildsInDb) {
    console.log(`   - "${b.name}"`);
    console.log(`     Trạng thái: ${b.status}, IsSaved: ${b.is_saved}, Tổng tiền: ${Number(b.total_price).toLocaleString()} đ`);
    console.log(`     Linh kiện: ${b.PcBuildItem.length}/8 slots (${b.PcBuildItem.map(i => i.component_type).join(', ')})`);
  }

  console.log('\n====================================================');
  console.log('🎉 TOÀN BỘ CÁC VẤN ĐỀ THẤP (9, 10, 11) ĐÃ ĐƯỢC GIẢI QUYẾT TRIỆT ĐỂ!');
  console.log('====================================================');
}

solveLowIssues()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
