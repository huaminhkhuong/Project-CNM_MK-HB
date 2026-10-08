const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { SKU_IMAGE_MAP } = require('./sku-image-map');

async function seedMediumIssues() {
  console.log('====================================================');
  console.log('🚀 BẮT ĐẦU XỬ LÝ TOÀN BỘ CÁC VẤN ĐỀ TRUNG BÌNH (5 - 8)');
  console.log('====================================================\n');

  // =========================================================================
  // ISSUE 7: UPDATE IMAGE_URL CHO CÁC SẢN PHẨM CŨ (21 SKUs & PRODUCT_VARIANTS)
  // =========================================================================
  console.log('--- [ISSUE 7] Cập nhật image_url cho 21 SKUs và variants cũ ---');
  let updatedSkuImagesCount = 0;
  for (const [skuCode, imageUrl] of Object.entries(SKU_IMAGE_MAP)) {
    const updated = await prisma.productSku.updateMany({
      where: { sku: skuCode },
      data: { image_url: imageUrl }
    });
    if (updated.count > 0) {
      updatedSkuImagesCount += updated.count;
    }
  }
  console.log(`✅ Đã cập nhật ảnh thành công cho ${updatedSkuImagesCount} SKUs demo.`);

  // Đồng bộ sang product_variants có sku trùng hoặc cùng product_id
  for (const [skuCode, imageUrl] of Object.entries(SKU_IMAGE_MAP)) {
    await prisma.productVariant.updateMany({
      where: { sku: skuCode },
      data: { image_url: imageUrl }
    });
  }

  // Cập nhật tất cả các product_variants còn null bằng ảnh của product_skus cùng product_id
  const allSkusWithImages = await prisma.productSku.findMany({
    where: { NOT: [{ image_url: null }, { image_url: '' }] },
    select: { product_id: true, image_url: true }
  });
  const productImgMap = new Map();
  for (const item of allSkusWithImages) {
    if (item.product_id && !productImgMap.has(item.product_id)) {
      productImgMap.set(item.product_id, item.image_url);
    }
  }

  const nullVariants = await prisma.productVariant.findMany({
    where: { OR: [{ image_url: null }, { image_url: '' }] },
    select: { id: true, product_id: true }
  });

  let syncedVariants = 0;
  for (const v of nullVariants) {
    const img = productImgMap.get(v.product_id) || 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=600&q=80';
    await prisma.productVariant.update({
      where: { id: v.id },
      data: { image_url: img }
    });
    syncedVariants++;
  }
  console.log(`✅ Đã đồng bộ ảnh cho ${syncedVariants} product_variants còn thiếu.`);

  const remainingNullSkus = await prisma.productSku.count({ where: { OR: [{ image_url: null }, { image_url: '' }] } });
  const remainingNullPv = await prisma.productVariant.count({ where: { OR: [{ image_url: null }, { image_url: '' }] } });
  console.log(`📊 Kiểm tra lại: SKU có ảnh null = ${remainingNullSkus}, Variant có ảnh null = ${remainingNullPv}.\n`);

  // =========================================================================
  // ISSUE 6: SEED ORDERS PHONG PHÚ (10 - 15 ĐƠN HÀNG THỰC TẾ)
  // =========================================================================
  console.log('--- [ISSUE 6] Tạo dữ liệu mẫu Đơn hàng (Orders) phong phú đa dạng ---');

  // Đảm bảo địa chỉ cho user 5 nếu chưa có
  let user5Addr = await prisma.address.findFirst({ where: { user_id: 5 } });
  if (!user5Addr) {
    user5Addr = await prisma.address.create({
      data: {
        user_id: 5,
        full_name: 'Hứa Minh Khương',
        phone: '0987654321',
        address_line: 'Khu Công Nghệ Cao, Xa lộ Hà Nội',
        ward: 'Phường Linh Trung',
        district: 'TP. Thủ Đức',
        province: 'TP. Hồ Chí Minh'
      }
    });
    console.log(`📍 Đã tạo địa chỉ cho User 5 (ID: ${user5Addr.id})`);
  }

  // Cập nhật lại 2 đơn test cũ của user 2 để hiển thị đẹp
  await prisma.order.updateMany({
    where: { id: 1 },
    data: {
      total_price: 11000000,
      total_amount: 11000000,
      shipping_fee: 0,
      final_amount: 11000000,
      shipping_address: '123 Nguyen Van Linh, Ward 1, District 7, Ho Chi Minh',
      note: 'Khách hàng yêu cầu hủy đơn do đổi cấu hình máy',
      payment_method: 'COD',
      payment_status: 'UNPAID'
    }
  });

  await prisma.order.updateMany({
    where: { id: 2 },
    data: {
      total_price: 8900000,
      total_amount: 8900000,
      shipping_fee: 30000,
      final_amount: 8930000,
      shipping_address: '123 Nguyen Van Linh, Ward 1, District 7, Ho Chi Minh',
      note: 'Giao giờ hành chính, gọi trước khi đến 15 phút',
      payment_method: 'COD',
      payment_status: 'UNPAID'
    }
  });

  // Lấy các SKU linh kiện thực tế từ database
  const getSku = async (code) => {
    const item = await prisma.productSku.findFirst({
      where: { sku: code },
      include: { Product: true }
    });
    return item;
  };

  const skuI5_13400F = await getSku('CPU-INTEL-I5-13400F');
  const skuR7_7800X3D = await getSku('CPU-AMD-R7-7800X3D');
  const skuI3_12100F = await getSku('CPU-INTEL-I3-12100F');
  const skuB760M = await getSku('MB-ASUS-B760M-A-D5');
  const skuB650M = await getSku('MB-MSI-PRO-B650M-A');
  const skuH610M = await getSku('MB-ASUS-H610M-K-D4');
  const skuRam16D5 = await getSku('RAM-CORSAIR-16G-D5-5600');
  const skuRam32D5 = await getSku('RAM-CORSAIR-32G-D5-6000');
  const skuRam16D4 = await getSku('RAM-KINGSTON-16G-D4-3200');
  const skuRTX4060 = await getSku('GPU-MSI-RTX4060-VENTUS-8G');
  const skuRTX4070TI = await getSku('GPU-GIGABYTE-RTX4070TI-16G');
  const skuRX6500XT = await getSku('GPU-GIGABYTE-RX6500XT-4G');
  const skuSSD990 = await getSku('SSD-SAMSUNG-990EVO-1TB');
  const skuSSDNV2 = await getSku('SSD-KINGSTON-NV2-500GB');
  const skuPSU650 = await getSku('PSU-CM-MWE-650-BRONZE');
  const skuPSU750 = await getSku('PSU-CM-MWE-750-GOLD');
  const skuPSU500 = await getSku('PSU-CM-ELITE-500W');
  const skuCase4000D = await getSku('CASE-CORSAIR-4000D-AIRFLOW');
  const skuCaseLV12 = await getSku('CASE-MIK-LV12-WHITE');
  const skuCoolX120 = await getSku('COOL-THERMALRIGHT-X120-ARGB');
  const skuCoolLS720 = await getSku('COOL-DEEPCOOL-LS720-360');

  // Danh sách kịch bản đơn hàng thực tế
  const orderTemplates = [
    {
      userId: 2,
      status: 'COMPLETED',
      paymentMethod: 'VNPAY',
      paymentStatus: 'PAID',
      shippingFee: 0,
      shippingAddress: '123 Nguyen Van Linh, Phường Tân Phong, Quận 7, TP. Hồ Chí Minh',
      note: 'Dàn PC Gaming i5-13400F + RTX 4060 lắp ráp sẵn, cài Windows 11',
      createdAt: new Date('2026-09-15T09:30:00Z'),
      items: [
        { sku: skuI5_13400F, qty: 1 },
        { sku: skuB760M, qty: 1 },
        { sku: skuRam16D5, qty: 1 },
        { sku: skuRTX4060, qty: 1 },
        { sku: skuSSD990, qty: 1 },
        { sku: skuPSU650, qty: 1 },
        { sku: skuCase4000D, qty: 1 },
        { sku: skuCoolX120, qty: 1 }
      ],
      trackingCode: 'VNP981240192',
      shipmentStatus: 'DELIVERED'
    },
    {
      userId: 5,
      status: 'COMPLETED',
      paymentMethod: 'BANKING',
      paymentStatus: 'PAID',
      shippingFee: 0,
      shippingAddress: 'Khu Công Nghệ Cao, Xa lộ Hà Nội, Phường Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh',
      note: 'Bộ PC Đồ họa Ryzen 7 7800X3D + RTX 4070 Ti, bọc chống sốc kỹ',
      createdAt: new Date('2026-09-20T14:15:00Z'),
      items: [
        { sku: skuR7_7800X3D, qty: 1 },
        { sku: skuB650M, qty: 1 },
        { sku: skuRam32D5, qty: 1 },
        { sku: skuRTX4070TI, qty: 1 },
        { sku: skuSSD990, qty: 1 },
        { sku: skuPSU750, qty: 1 },
        { sku: skuCaseLV12, qty: 1 },
        { sku: skuCoolLS720, qty: 1 }
      ],
      trackingCode: 'GHTK771920481',
      shipmentStatus: 'DELIVERED'
    },
    {
      userId: 10,
      status: 'COMPLETED',
      paymentMethod: 'MOMO',
      paymentStatus: 'PAID',
      shippingFee: 30000,
      shippingAddress: 'Số 123 Đường Công Nghệ Mới, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      note: 'Combo nâng cấp lưu trữ SSD Samsung 1TB + Kingston 500GB',
      createdAt: new Date('2026-09-28T11:00:00Z'),
      items: [
        { sku: skuSSD990, qty: 1 },
        { sku: skuSSDNV2, qty: 1 }
      ],
      trackingCode: 'JNT662019482',
      shipmentStatus: 'DELIVERED'
    },
    {
      userId: 2,
      status: 'DELIVERING',
      paymentMethod: 'COD',
      paymentStatus: 'PAID',
      shippingFee: 40000,
      shippingAddress: '123 Nguyen Van Linh, Phường Tân Phong, Quận 7, TP. Hồ Chí Minh',
      note: 'Card MSI RTX 4060 + Nguồn CM 650W Bronze',
      createdAt: new Date('2026-10-06T10:00:00Z'),
      items: [
        { sku: skuRTX4060, qty: 1 },
        { sku: skuPSU650, qty: 1 }
      ],
      trackingCode: 'VNP882014920',
      shipmentStatus: 'DELIVERING'
    },
    {
      userId: 5,
      status: 'DELIVERING',
      paymentMethod: 'VNPAY',
      paymentStatus: 'PAID',
      shippingFee: 25000,
      shippingAddress: 'Khu Công Nghệ Cao, Xa lộ Hà Nội, TP. Thủ Đức, TP. Hồ Chí Minh',
      note: 'Kit RAM Corsair Dominator Titanium 32GB DDR5 6000MHz',
      createdAt: new Date('2026-10-07T08:30:00Z'),
      items: [
        { sku: skuRam32D5, qty: 1 }
      ],
      trackingCode: 'GHTK881029412',
      shipmentStatus: 'DELIVERING'
    },
    {
      userId: 10,
      status: 'PROCESSING',
      paymentMethod: 'VNPAY',
      paymentStatus: 'PAID',
      shippingFee: 35000,
      shippingAddress: 'Số 123 Đường Công Nghệ Mới, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      note: 'Đang chuẩn bị hàng và kiểm tra tản nhiệt nước trước khi xuất kho',
      createdAt: new Date('2026-10-07T15:20:00Z'),
      items: [
        { sku: skuRam16D5, qty: 1 },
        { sku: skuCoolLS720, qty: 1 }
      ],
      trackingCode: null,
      shipmentStatus: null
    },
    {
      userId: 2,
      status: 'PROCESSING',
      paymentMethod: 'BANKING',
      paymentStatus: 'PAID',
      shippingFee: 50000,
      shippingAddress: '123 Nguyen Van Linh, Phường Tân Phong, Quận 7, TP. Hồ Chí Minh',
      note: 'Vỏ case Mik LV12 White bể cá + Nguồn 750W Gold',
      createdAt: new Date('2026-10-08T02:10:00Z'),
      items: [
        { sku: skuCaseLV12, qty: 1 },
        { sku: skuPSU750, qty: 1 }
      ],
      trackingCode: null,
      shipmentStatus: null
    },
    {
      userId: 5,
      status: 'CONFIRMED',
      paymentMethod: 'COD',
      paymentStatus: 'UNPAID',
      shippingFee: 35000,
      shippingAddress: 'Khu Công Nghệ Cao, Xa lộ Hà Nội, TP. Thủ Đức, TP. Hồ Chí Minh',
      note: 'Combo văn phòng tiết kiệm i3 12100F + Asus H610M + RAM 16GB Kingston',
      createdAt: new Date('2026-10-08T04:45:00Z'),
      items: [
        { sku: skuI3_12100F, qty: 1 },
        { sku: skuH610M, qty: 1 },
        { sku: skuRam16D4, qty: 1 },
        { sku: skuPSU500, qty: 1 }
      ],
      trackingCode: null,
      shipmentStatus: null
    },
    {
      userId: 10,
      status: 'PENDING',
      paymentMethod: 'VNPAY',
      paymentStatus: 'UNPAID',
      shippingFee: 0,
      shippingAddress: 'Số 123 Đường Công Nghệ Mới, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      note: 'Chờ khách hàng thanh toán qua cổng VNPAY-QR',
      createdAt: new Date('2026-10-08T07:15:00Z'),
      items: [
        { sku: skuRTX4070TI, qty: 1 }
      ],
      trackingCode: null,
      shipmentStatus: null
    },
    {
      userId: 2,
      status: 'CANCELED',
      paymentMethod: 'COD',
      paymentStatus: 'UNPAID',
      shippingFee: 30000,
      shippingAddress: '123 Nguyen Van Linh, Phường Tân Phong, Quận 7, TP. Hồ Chí Minh',
      note: 'Khách đổi ý muốn lấy tản nước thay vì tản khí',
      createdAt: new Date('2026-10-05T16:00:00Z'),
      items: [
        { sku: skuCoolX120, qty: 1 },
        { sku: skuPSU500, qty: 1 }
      ],
      trackingCode: null,
      shipmentStatus: null
    }
  ];

  // Kiểm tra xem các orders này đã từng được seed chưa
  const existingRichOrders = await prisma.order.findMany({
    where: { note: { contains: 'i5-13400F' } }
  });

  const createdOrderItems = [];
  const completedOrdersList = [];

  if (existingRichOrders.length === 0) {
    for (const tpl of orderTemplates) {
      let subTotal = 0;
      for (const it of tpl.items) {
        const price = Number(it.sku?.price || 1500000);
        subTotal += price * it.qty;
      }
      const shippingFee = tpl.shippingFee;
      const finalAmount = subTotal + shippingFee;

      const newOrder = await prisma.order.create({
        data: {
          user_id: tpl.userId,
          total_price: subTotal,
          total_amount: subTotal,
          shipping_fee: shippingFee,
          final_amount: finalAmount,
          status: tpl.status,
          payment_method: tpl.paymentMethod,
          payment_status: tpl.paymentStatus,
          shipping_address: tpl.shippingAddress,
          note: tpl.note,
          created_at: tpl.createdAt,
          updated_at: tpl.createdAt
        }
      });

      for (const it of tpl.items) {
        const unitPrice = Number(it.sku?.price || 1500000);
        const lineTotal = unitPrice * it.qty;
        const oItem = await prisma.orderItem.create({
          data: {
            order_id: newOrder.id,
            product_variant_id: it.sku.id,
            quantity: it.qty,
            unit_price: unitPrice,
            line_total: lineTotal,
            product_id: it.sku.product_id,
            sku_snapshot: it.sku.sku,
            name_snapshot: it.sku.Product?.name || it.sku.sku,
            created_at: tpl.createdAt,
            updated_at: tpl.createdAt
          }
        });

        if (tpl.status === 'COMPLETED') {
          createdOrderItems.push({
            orderItem: oItem,
            order: newOrder,
            sku: it.sku,
            userId: tpl.userId
          });
        }
      }

      if (tpl.trackingCode) {
        await prisma.shipment.create({
          data: {
            order_id: newOrder.id,
            status: tpl.shipmentStatus,
            tracking_code: tpl.trackingCode
          }
        });
      }

      if (tpl.status === 'COMPLETED') {
        completedOrdersList.push(newOrder);
      }
    }
    console.log(`✅ Đã tạo thành công ${orderTemplates.length} đơn hàng thực tế phong phú.`);
  } else {
    console.log(`ℹ️ Các đơn hàng phong phú đã tồn tại (${existingRichOrders.length} đơn).`);
    // Lấy các completed items để sẵn sàng cho warranties
    const completedOrders = await prisma.order.findMany({
      where: { status: 'COMPLETED' },
      include: {
        OrderItem: {
          include: { ProductSku: { include: { Product: true } } }
        }
      }
    });
    for (const ord of completedOrders) {
      for (const oi of ord.OrderItem) {
        createdOrderItems.push({
          orderItem: oi,
          order: ord,
          sku: oi.ProductSku,
          userId: ord.user_id
        });
      }
    }
  }

  const totalOrdersNow = await prisma.order.count();
  console.log(`📊 Tổng số đơn hàng trong DB hiện tại: ${totalOrdersNow} đơn.\n`);

  // =========================================================================
  // ISSUE 5: SEED WARRANTIES & WARRANTY_REQUESTS & NOTIFICATIONS
  // =========================================================================
  console.log('--- [ISSUE 5] Tạo dữ liệu mẫu Bảo hành điện tử (Warranties) & Khiếu nại (Requests) ---');

  let warrantiesCreated = 0;
  const warrantyRecords = [];

  for (const item of createdOrderItems) {
    // Kiểm tra xem order_item_id đã có warranty chưa
    const existingWar = await prisma.warrantyItem.findUnique({
      where: { order_item_id: item.orderItem.id }
    });
    if (!existingWar) {
      const code = `WAR-2026-${String(item.order.id).padStart(3, '0')}-${String(item.orderItem.id).padStart(3, '0')}`;
      const activatedAt = item.order.created_at || new Date('2026-09-15T09:30:00Z');
      const expiresAt = new Date(activatedAt);
      expiresAt.setMonth(expiresAt.getMonth() + 36); // Bảo hành 36 tháng

      const war = await prisma.warrantyItem.create({
        data: {
          user_id: item.userId,
          order_id: item.order.id,
          order_item_id: item.orderItem.id,
          sku_id: item.sku?.id || null,
          warranty_code: code,
          status: 'ACTIVE',
          note: `Bảo hành chính hãng NPP 36 tháng cho ${item.orderItem.name_snapshot}`,
          activated_at: activatedAt,
          expires_at: expiresAt,
          created_at: activatedAt
        }
      });
      warrantiesCreated++;
      warrantyRecords.push(war);
    } else {
      warrantyRecords.push(existingWar);
    }
  }
  console.log(`✅ Đã tạo mới ${warrantiesCreated} sổ bảo hành điện tử.`);

  // Tạo thêm các yêu cầu bảo hành (warranty_requests) thực tế
  const existingReqs = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM warranty_requests WHERE lookup_value LIKE 'BH-REQ-%'`;
  if (Number(existingReqs[0].cnt) === 0) {
    const war1 = warrantyRecords.find(w => w.user_id === 2);
    const war2 = warrantyRecords.find(w => w.user_id === 5);
    const war3 = warrantyRecords.find(w => w.user_id === 10);

    const mockRequests = [
      {
        warrantyId: war1?.id || 1,
        userId: 2,
        lookupValue: 'BH-REQ-2026-001',
        customerName: 'Customer Demo',
        customerPhone: '0901234567',
        customerEmail: 'customer@example.com',
        productName: 'MSI GeForce RTX 4060 Ventus 2X Black 8GB',
        serialNumber: 'SN-MSI-4060V-882910',
        orderId: war1?.order_id || 1,
        severity: 'HIGH',
        issueDescription: 'Quạt làm mát thứ 2 của card phát tiếng kêu rít cơ học khi tải nặng trên 70 độ C.',
        status: 'IN_PROGRESS',
        lastStaffNote: 'Kỹ thuật viên đã tiếp nhận tại trạm bảo hành, đang thay thế cụm quạt chính hãng MSI.',
        events: [
          { status: 'RECEIVED', note: 'Hệ thống tiếp nhận yêu cầu bảo hành từ khách hàng.', role: 'HỆ THỐNG', name: 'System Auto' },
          { status: 'IN_PROGRESS', note: 'Kỹ thuật viên tiếp nhận máy, xác nhận lỗi bearing quạt card màn hình.', role: 'KỸ THUẬT', name: 'Technician One' }
        ]
      },
      {
        warrantyId: war2?.id || 2,
        userId: 5,
        lookupValue: 'BH-REQ-2026-002',
        customerName: 'Hứa Minh Khương',
        customerPhone: '0987654321',
        customerEmail: 'khuongminhhua11062004@gmail.com',
        productName: 'Cooler Master MWE Gold 750W V2 Full Modular',
        serialNumber: 'SN-CM-750GOLD-991244',
        orderId: war2?.order_id || 2,
        severity: 'CRITICAL',
        issueDescription: 'Nguồn phát ra tiếng tạch tạch và sập máy đột ngột khi chạy đồ họa Blender.',
        status: 'APPROVED',
        lastStaffNote: 'Đã thẩm định lỗi cuộn cảm, duyệt đổi mới 1:1 bộ nguồn mới 100% nguyên seal.',
        events: [
          { status: 'RECEIVED', note: 'Khách hàng tạo yêu cầu trực tuyến kèm video quay tiếng kêu nguồn.', role: 'HỆ THỐNG', name: 'System Auto' },
          { status: 'IN_REVIEW', note: 'Bộ phận thẩm định kỹ thuật kiểm tra và phát hiện lỗi cuộn cảm nguồn.', role: 'KỸ THUẬT', name: 'Tech Staff Demo' },
          { status: 'APPROVED', note: 'Trưởng bộ phận phê duyệt chính sách đổi mới 1 đổi 1 trong 30 ngày.', role: 'QUẢN LÝ', name: 'Admin Demo' }
        ]
      },
      {
        warrantyId: war3?.id || 1,
        userId: 10,
        lookupValue: 'BH-REQ-2026-003',
        customerName: 'Khách hàng Mẫu PC Mall',
        customerPhone: '0988123456',
        customerEmail: 'customer@cnm.local',
        productName: 'Samsung 990 EVO 1TB PCIe 4.0 NVMe',
        serialNumber: 'SN-SS-990EVO-554123',
        orderId: war3?.order_id || 3,
        severity: 'MEDIUM',
        issueDescription: 'Tốc độ đọc ghi bị tụt đột ngột từ 5000MB/s xuống còn 800MB/s và nhiệt độ lên 75 độ C.',
        status: 'COMPLETED',
        lastStaffNote: 'Đã cập nhật firmware Samsung Magician mới nhất và dán lại thermal pad, kiểm tra hoàn tất đạt 5000MB/s.',
        events: [
          { status: 'RECEIVED', note: 'Tiếp nhận sản phẩm tại chi nhánh Quận 1.', role: 'LỄ TÂN', name: 'Sales Staff' },
          { status: 'IN_PROGRESS', note: 'Nâng cấp firmware điều khiển controller của ổ SSD.', role: 'KỸ THUẬT', name: 'Technician One' },
          { status: 'COMPLETED', note: 'Đã test ghi 500GB dữ liệu liên tục không tụt tốc độ, hoàn trả thiết bị cho khách.', role: 'KỸ THUẬT', name: 'Technician One' }
        ]
      },
      {
        warrantyId: war1?.id || 1,
        userId: 2,
        lookupValue: 'BH-REQ-2026-004',
        customerName: 'Customer Demo',
        customerPhone: '0901234567',
        customerEmail: 'customer@example.com',
        productName: 'Corsair Vengeance 16GB DDR5 5600MHz',
        serialNumber: 'SN-COR-D5-334455',
        orderId: war1?.order_id || 1,
        severity: 'MEDIUM',
        issueDescription: 'Khi bật EXPO/XMP 5600MHz máy không thể post khởi động được vào Windows.',
        status: 'RECEIVED',
        lastStaffNote: 'Đang chờ khách mang máy đến trung tâm bảo hành để test tương thích mainboard.',
        events: [
          { status: 'RECEIVED', note: 'Tiếp nhận thông tin lỗi XMP từ khách hàng.', role: 'HỆ THỐNG', name: 'System Auto' }
        ]
      }
    ];

    for (const req of mockRequests) {
      const res = await prisma.$queryRaw`
        INSERT INTO warranty_requests (
          warranty_id, user_id, lookup_value, customer_name, customer_phone, customer_email,
          product_name, serial_number, order_id, severity, issue_description, status, last_staff_note
        ) VALUES (
          ${req.warrantyId}, ${req.userId}, ${req.lookupValue}, ${req.customerName}, ${req.customerPhone}, ${req.customerEmail},
          ${req.productName}, ${req.serialNumber}, ${req.orderId}, ${req.severity}, ${req.issueDescription}, ${req.status}, ${req.lastStaffNote}
        )
      `;

      // Lấy id vừa insert
      const lastIdRes = await prisma.$queryRaw`SELECT LAST_INSERT_ID() as id`;
      const requestId = Number(lastIdRes[0].id);

      for (const ev of req.events) {
        await prisma.$queryRaw`
          INSERT INTO warranty_request_events (request_id, status, note, actor_role, actor_name)
          VALUES (${requestId}, ${ev.status}, ${ev.note}, ${ev.role}, ${ev.name})
        `;
      }

      // Thêm thông báo bảo hành vào warranty_notifications
      await prisma.$queryRaw`
        INSERT INTO warranty_notifications (user_id, request_id, title, message, is_read)
        VALUES (
          ${req.userId}, ${requestId},
          ${'Cập nhật tiến độ bảo hành ' + req.lookupValue},
          ${req.lastStaffNote || req.issueDescription},
          0
        )
      `;
    }
    console.log(`✅ Đã tạo thành công ${mockRequests.length} hồ sơ bảo hành (warranty_requests) với đầy đủ tiến trình và thông báo.`);
  }

  const finalWarrantyCount = await prisma.warrantyItem.count();
  const finalReqCount = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM warranty_requests`;
  console.log(`📊 Tổng số Warranties: ${finalWarrantyCount}, Tổng số Warranty Requests: ${finalReqCount[0].cnt}.\n`);

  // =========================================================================
  // ISSUE 8: SEED AI CHAT SESSIONS & MESSAGES (LỊCH SỬ TƯ VẤN THỰC TẾ)
  // =========================================================================
  console.log('--- [ISSUE 8] Tạo dữ liệu mẫu Lịch sử tư vấn AI Chat (ai_chats + ai_messages) ---');

  const aiChatTemplates = [
    {
      userId: 2,
      sessions: [
        {
          userMsg: 'Tư vấn cho mình cấu hình PC khoảng 20 đến 25 triệu để chơi Black Myth: Wukong mượt mà ở độ phân giải 2K với.',
          assistantData: {
            reply: 'Chào bạn! Với ngân sách từ 20 đến 25 triệu đồng để trải nghiệm Black Myth: Wukong mượt mà ở độ phân giải 2K, cấu hình tối ưu nhất hiện nay là sự kết hợp giữa CPU Intel Core i5-13400F (10 nhân 16 luồng) cùng card đồ họa NVIDIA GeForce RTX 4060 8GB. Nhờ hỗ trợ công nghệ DLSS 3 và Frame Generation, bạn có thể đạt mức khung hình ổn định 60-80 FPS ở thiết lập đồ họa High tại độ phân giải 1440p (2K).\n\nCấu hình chi tiết đề xuất bao gồm:\n- CPU: Intel Core i5-13400F\n- Mainboard: ASUS Prime B760M-A WIFI DDR5\n- RAM: Corsair Vengeance 16GB DDR5 5600MHz\n- VGA: MSI GeForce RTX 4060 Ventus 2X Black 8GB\n- SSD: Samsung 990 EVO 1TB PCIe 4.0 NVMe\n- Nguồn: Cooler Master MWE 650W 80 Plus Bronze V2\n- Vỏ case: Corsair 4000D Airflow Black\n- Tản nhiệt: Thermalright Assassin X120 SE ARGB\n\nTổng chi phí ước tính khoảng 22.800.000 đ, hoàn toàn đáp ứng trọn vẹn yêu cầu và có khả năng nâng cấp lâu dài.',
            intent: 'PC_BUILD_ADVICE',
            products: [
              { id: skuI5_13400F?.id, name: 'Intel Core i5-13400F', price: skuI5_13400F?.price, category: 'CPU' },
              { id: skuRTX4060?.id, name: 'MSI GeForce RTX 4060 Ventus 2X Black 8GB', price: skuRTX4060?.price, category: 'GPU' },
              { id: skuB760M?.id, name: 'ASUS Prime B760M-A WIFI DDR5', price: skuB760M?.price, category: 'MAINBOARD' },
              { id: skuRam16D5?.id, name: 'Corsair Vengeance 16GB DDR5 5600MHz', price: skuRam16D5?.price, category: 'RAM' },
              { id: skuSSD990?.id, name: 'Samsung 990 EVO 1TB PCIe 4.0 NVMe', price: skuSSD990?.price, category: 'SSD' }
            ]
          }
        },
        {
          userMsg: 'So sánh RTX 4060 và RX 7600 thì con nào chơi game tốt hơn trong tầm giá 8-9 triệu?',
          assistantData: {
            reply: 'So sánh chi tiết giữa MSI GeForce RTX 4060 8GB và AMD Radeon RX 7600 8GB:\n\n1. Hiệu năng thuần (Rasterization 1080p):\n- Cả hai card có hiệu năng tương đương nhau ở các tựa game eSports (CS2, Valorant, Dota 2, LMHT).\n\n2. Công nghệ hình ảnh & Upscaling:\n- RTX 4060 vượt trội nhờ DLSS 3 + Frame Generation thế hệ mới, hỗ trợ mượt mà hơn trong các tựa game bom tấn AAA (Cyberpunk 2077, Black Myth Wukong).\n- RX 7600 sử dụng FSR 3 nhưng chất lượng tái tạo hình ảnh và độ ổn định chưa bằng DLSS 3.\n\n3. Tiêu thụ điện năng và nhiệt độ:\n- RTX 4060 TDP chỉ khoảng 115W, cực kỳ mát mẻ, chỉ cần nguồn 500W-550W.\n- RX 7600 TDP khoảng 165W, tiêu thụ nhiều điện hơn.\n\n👉 Kết luận: Nếu bạn ưu tiên chơi game AAA, đồ họa Ray Tracing và livestream/render video, RTX 4060 là lựa chọn toàn diện hơn rất nhiều.',
            intent: 'COMPARISON',
            products: [
              { id: skuRTX4060?.id, name: 'MSI GeForce RTX 4060 Ventus 2X Black 8GB', price: skuRTX4060?.price, category: 'GPU' },
              { id: skuRX6500XT?.id, name: 'Gigabyte Radeon RX 6500 XT EAGLE 4GB', price: skuRX6500XT?.price, category: 'GPU' }
            ]
          }
        }
      ]
    },
    {
      userId: 10,
      sessions: [
        {
          userMsg: 'Máy mình đang dùng 16GB RAM DDR4 và SSD 500GB, giờ muốn nâng cấp để render video 4K thì nên chọn loại nào?',
          assistantData: {
            reply: 'Đối với nhu cầu dựng và xuất video 4K (trên Premiere Pro, After Effects, DaVinci Resolve):\n\n1. Về RAM: 16GB là mức tối thiểu và thường xuyên bị tràn bộ nhớ khi chạy timeline 4K nhiều lớp hiệu ứng. Bạn nên nâng cấp lên tối thiểu 32GB (lắp thêm 1 thanh 16GB DDR4 cùng bus 3200MHz hoặc đổi sang kit 32GB). Điều này sẽ chấm dứt hiện tượng giật lag khi preview timeline.\n\n2. Về SSD: Để timeline 4K mượt mà, bạn nên trang bị thêm 1 ổ SSD NVMe tốc độ cao 1TB riêng biệt (như Samsung 990 EVO 1TB) dùng làm Scratch Disk và chứa Source Footage. Không nên dùng chung 1 ổ 500GB cho cả Windows và Cache vì rất nhanh đầy và giảm tuổi thọ ổ đĩa.',
            intent: 'UPGRADE_ADVICE',
            products: [
              { id: skuSSD990?.id, name: 'Samsung 990 EVO 1TB PCIe 4.0 NVMe', price: skuSSD990?.price, category: 'SSD' },
              { id: skuRam16D4?.id, name: 'Kingston Fury Beast 16GB DDR4 3200MHz', price: skuRam16D4?.price, category: 'RAM' }
            ]
          }
        }
      ]
    },
    {
      userId: 5,
      sessions: [
        {
          userMsg: 'Tư vấn cấu hình máy trạm workstation chuyên render 3D kiến trúc và Blender ngân sách tầm 45-50 triệu.',
          assistantData: {
            reply: 'Với ngân sách 45 - 50 triệu dành cho Workstation dựng hình 3D, phối cảnh kiến trúc (3ds Max, V-Ray, Blender, Lumion), cấu hình mạnh mẽ nhất hiện nay:\n\n- CPU: AMD Ryzen 7 7800X3D hoặc Intel Core i7 thế hệ mới (xử lý render đa nhân và tính toán vật lý cực nhanh).\n- VGA: Gigabyte GeForce RTX 4070 Ti SUPER EAGLE OC 16GB VRAM (VRAM 16GB là yếu tố sống còn để load toàn bộ scene 3D nặng vào bộ nhớ đồ họa mà không bị crash out of memory).\n- RAM: 32GB Corsair Dominator Titanium DDR5 6000MHz (có thể nâng cấp lên 64GB khi cần).\n- SSD: Samsung 990 EVO 1TB NVMe Gen 4 tốc độ đọc ghi 5000MB/s.\n- Tản nhiệt nước AIO: DeepCool LS720 SE ARGB 360mm giúp duy trì nhiệt độ CPU dưới 70 độ C khi render liên tục nhiều giờ.\n- Nguồn: Cooler Master MWE Gold 750W Full Modular chuẩn 80 Plus Gold đảm bảo điện áp ổn định cao.',
            intent: 'PC_BUILD_ADVICE',
            products: [
              { id: skuR7_7800X3D?.id, name: 'AMD Ryzen 7 7800X3D', price: skuR7_7800X3D?.price, category: 'CPU' },
              { id: skuRTX4070TI?.id, name: 'Gigabyte GeForce RTX 4070 Ti SUPER EAGLE OC 16GB', price: skuRTX4070TI?.price, category: 'GPU' },
              { id: skuRam32D5?.id, name: 'Corsair Dominator Titanium 32GB DDR5 6000MHz', price: skuRam32D5?.price, category: 'RAM' },
              { id: skuCoolLS720?.id, name: 'DeepCool LS720 SE ARGB 360mm', price: skuCoolLS720?.price, category: 'COOLING' }
            ]
          }
        }
      ]
    }
  ];

  let totalChatsSeeded = 0;
  let totalMsgsSeeded = 0;

  for (const tpl of aiChatTemplates) {
    let chat = await prisma.aiChat.findFirst({
      where: { user_id: tpl.userId }
    });

    if (!chat) {
      chat = await prisma.aiChat.create({
        data: { user_id: tpl.userId }
      });
      totalChatsSeeded++;
    }

    for (const sess of tpl.sessions) {
      // User message
      await prisma.aiMessage.create({
        data: {
          chat_id: chat.id,
          sender: 'user',
          message: sess.userMsg
        }
      });
      totalMsgsSeeded++;

      // Assistant message
      await prisma.aiMessage.create({
        data: {
          chat_id: chat.id,
          sender: 'assistant',
          message: JSON.stringify(sess.assistantData)
        }
      });
      totalMsgsSeeded++;
    }
  }

  const finalAiChats = await prisma.aiChat.count();
  const finalAiMessages = await prisma.aiMessage.count();
  console.log(`✅ Đã seed thành công các phiên hội thoại AI.`);
  console.log(`📊 Tổng số ai_chats: ${finalAiChats}, Tổng số ai_messages: ${finalAiMessages}.\n`);

  console.log('====================================================');
  console.log('🎉 TOÀN BỘ CÁC VẤN ĐỀ TRUNG BÌNH ĐÃ ĐƯỢC GIẢI QUYẾT XONG!');
  console.log('====================================================');
}

seedMediumIssues()
  .catch((e) => {
    console.error('❌ Lỗi khi thực thi seed-medium-issues:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
