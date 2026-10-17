const fs = require('fs');
const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection('mysql://root:root@127.0.0.1:3307/cnm_mk_hb');
    const queryStr = [
      'SELECT',
      '  cr.id,',
      '  cr.name,',
      '  cr.source_attribute_key,',
      '  cr.target_attribute_key,',
      '  cr.operator,',
      '  cr.is_compatible,',
      '  cr.description,',
      '  av1.value as val1,',
      '  av2.value as val2,',
      '  c1.name as cat1,',
      '  c2.name as cat2',
      'FROM compatibility_rules cr',
      'LEFT JOIN attribute_values av1 ON av1.id = cr.attribute_value_1',
      'LEFT JOIN attribute_values av2 ON av2.id = cr.attribute_value_2',
      'LEFT JOIN categories c1 ON c1.id = cr.source_category_id',
      'LEFT JOIN categories c2 ON c2.id = cr.target_category_id',
      'WHERE cr.is_active = 1',
      'ORDER BY cr.source_attribute_key, cr.id'
    ].join(' ');

    const [rules] = await conn.execute(queryStr);
    console.log('Fetched ' + rules.length + ' rules from MySQL database.');

    let md = '# 📚 TÀI LIỆU TOÀN BỘ QUY TẮC TƯƠNG THÍCH PHẦN CỨNG (COMPATIBILITY RULES SPECIFICATION)\n\n';
    md += '> **Hệ thống**: PC Mall Knowledge-Based Expert Engine\n';
    md += '> **Tổng số quy tắc**: ' + rules.length + ' quy tắc active trong cơ sở dữ liệu và 10 bộ quy tắc logic nghiệp vụ cốt lõi (COMP-001 -> COMP-010).\n';
    md += '> **Cập nhật ngày**: ' + new Date().toISOString() + '\n\n';

    md += '---\n\n';
    md += '## PHẦN 1: 10 QUY TẮC CỐT LÕI (CORE HARDWARE LOGIC COMP-001 -> COMP-010)\n\n';
    md += 'Các quy tắc này được định nghĩa và đồng bộ trực tiếp giữa Client (`calculateBuilderInsights.js`) và Server (`pc-builder.service.ts`):\n\n';
    md += '| Mã Luật | Tên Quy Tắc | Linh Kiện Kiểm Tra | Tiêu Chí Đánh Giá | Mức Độ (Severity) |\n';
    md += '| :--- | :--- | :--- | :--- | :---: |\n';
    md += '| **COMP-001** | Socket CPU ↔ Mainboard | CPU + Bo Mạch Chủ | Chuẩn socket CPU (LGA1700, LGA1851, AM4, AM5) phải trùng khớp 100% với socket bo mạch chủ. | 🔴 BLOCKER |\n';
    md += '| **COMP-002** | Thế hệ RAM ↔ Mainboard | RAM + Bo Mạch Chủ | Chuẩn bộ nhớ DDR4 / DDR5 của RAM phải khớp với khe cắm trên bo mạch chủ. | 🔴 BLOCKER |\n';
    md += '| **COMP-002B** | Số thanh RAM vật lý | RAM + Bo Mạch Chủ | Số thanh RAM (`sticksPerUnit * quantity`) không được vượt quá số khe RAM vật lý (`ram_slots`). | 🔴 BLOCKER |\n';
    md += '| **COMP-003** | Băng thông khe cắm PCIe | CPU + GPU + Mainboard | Card đồ họa PCIe x16; Bắt cảnh báo nghẽn bus lane khi kết hợp APU cũ (chỉ có PCIe x8 lane) với GPU cao cấp (RTX 4070+ / 5070+). | ⚠️ WARNING |\n';
    md += '| **COMP-004** | Chiều dài GPU ↔ Khoang Case | Card đồ họa + Vỏ Case | Chiều dài Card đồ họa (`gpu_length` mm) <= Khoang chứa tối đa của Case (`case_gpu_clearance` mm). | 🔴 BLOCKER |\n';
    md += '| **COMP-005** | Yêu cầu tản nhiệt rời cho CPU | CPU + Tản nhiệt | CPU dòng K/KF/KS/Ultra/X/X3D/Tray bắt buộc phải chọn tản nhiệt rời. Chỉ chip phổ thông kèm box mới có tản zin. | 🔴 BLOCKER |\n';
    md += '| **COMP-006** | Hiệu năng & Kích thước tản | Tản nhiệt + CPU + Case | - Công suất tản (`cooling_capacity` W) >= TDP CPU (W)<br>- Chiều cao tản khí (`cooler_height` mm) <= Khoảng trống case (`case_cooler_clearance` mm)<br>- Kích thước Rad (`radiator_size` mm) <= Hỗ trợ rad của case (`case_radiator_support` mm). | 🔴 BLOCKER |\n';
    md += '| **COMP-007** | Công suất Nguồn (PSU Wattage) | Nguồn + Toàn hệ thống | - `psuWatt < power`: Thiếu nguồn gây sập máy (BLOCKER)<br>- `0 <= psuMargin < 20%`: Thiếu biên độ an toàn dự phòng (WARNING)<br>- `psuMargin >= 20%`: Đạt chuẩn an toàn (OK). | 🔴 BLOCKER / ⚠️ WARNING |\n';
    md += '| **COMP-008** | Cáp nguồn phụ GPU / CPU | Nguồn + GPU cao cấp | Card đồ họa công suất cao (TDP > 250W) yêu cầu nguồn tối thiểu 650W - 850W ATX 3.0 có đầu cấp nguồn phụ PCIe / 12V-2x6. | ⚠️ WARNING |\n';
    md += '| **COMP-009** | Số khe cắm ổ M.2 NVMe | Bo Mạch Chủ + Ổ 1 + Ổ 2 | Tổng số ổ SSD chuẩn M.2 NVMe (`storage` + `storage_2`) không được vượt quá số khe cắm `m2_slots` trên bo mạch chủ. | 🔴 BLOCKER |\n';
    md += '| **COMP-010** | Chuẩn kích thước Main ↔ Case | Bo Mạch Chủ + Vỏ Case | Kích thước bo mạch (E-ATX, ATX, mATX, ITX) phải vừa với form factor thùng máy hỗ trợ. Case nhỏ (ITX) không thể gắn Mainboard to (ATX). | 🔴 BLOCKER |\n\n';

    md += '---\n\n';
    md += '## PHẦN 2: CÁC LUẬT TỔ HỢP ĐA LINH KIỆN NÂNG CAO (MULTI-COMPONENT RULES)\n\n';
    md += '| Mã Luật | Tên Luật | Tổ Hợp Linh Kiện | Mô Tả Xử Lý Nghiệp Vụ Chuyên Sâu |\n';
    md += '| :--- | :--- | :--- | :--- |\n';
    md += '| **RULE-MULTI-001** | CPU High-Power ↔ Mainboard VRM | CPU + Mainboard | CPU công suất cao (TDP > 125W như i7/i9, Ultra 7/9, Ryzen 9) đi cùng Mainboard phổ thông không tản VRM (H610/A620) sẽ quá nhiệt mạch cấp nguồn gây tụt xung nghiêm trọng. Bắt buộc dùng Mainboard dòng B/Z/X có VRM tối thiểu 10+2 phase. |\n';
    md += '| **RULE-MULTI-002** | GPU High-End ↔ PSU Non-ATX 3.0 | GPU + Nguồn | Card đồ họa cao cấp (RTX 4070Ti/4080/4090/5070/5080/5090) có dòng xung kích (transient spikes) gấp 2-3 lần. Bắt buộc dùng nguồn chuẩn ATX 3.0/PCIe 5.0 có cổng 12VHPWR / 12V-2x6. |\n';
    md += '| **RULE-MULTI-003** | CPU High-Heat + Case Mini ↔ AIO 360mm | CPU + Case + Tản | CPU công suất nhiệt lớn trong thùng máy nhỏ kín khí đòi hỏi tản nhiệt nước AIO 240/360mm gắn nóc thổi nhiệt trực tiếp ra ngoài. Không dùng tản khí tháp đơn vì khí nóng tích tụ gây quá nhiệt. |\n';
    md += '| **RULE-MULTI-004** | RAM DDR5 Quad-Stick Stability | RAM + Bo Mạch Chủ | Chạy 4 thanh RAM DDR5 ở bus cao >6000MHz vượt quá độ ổn định của bộ điều khiển bộ nhớ (IMC). Khuyến nghị ưu tiên kit 2 thanh Dual-Channel (2x16GB hoặc 2x32GB). |\n';
    md += '| **RULE-MULTI-005** | SSD NVMe PCIe 5.0 Heatsink | SSD + Bo Mạch Chủ | SSD chuẩn PCIe 5.0 đọc ghi >10,000 MB/s tỏa lượng nhiệt cực lớn (controller > 80°C). Bắt buộc phải gắn tản nhiệt heatsink nhôm dày để tránh tụt băng thông về SATA. |\n\n';

    md += '---\n\n';
    md += '## PHẦN 3: BẢNG TRA CỨU TOÀN BỘ 441 QUY TẮC CHI TIẾT TRONG DATABASE\n\n';

    const groups = {};
    for (const r of rules) {
      const key = (r.source_attribute_key || 'multi') + ' ↔ ' + (r.target_attribute_key || 'multi');
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }

    for (const [groupName, groupRules] of Object.entries(groups)) {
      md += '### Nhóm Quy Tắc: ' + groupName.toUpperCase() + ' (' + groupRules.length + ' quy tắc)\n\n';
      md += '| ID | Tên Quy Tắc | Giá Trị Nguồn | Toán Tử | Giá Trị Đích | Tương Thích | Mô Tả Chi Tiết |\n';
      md += '| :--- | :--- | :--- | :---: | :--- | :---: | :--- |\n';
      for (const r of groupRules) {
        const isCompat = r.is_compatible === 1 ? '✅ Hợp lệ' : '❌ Xung đột';
        const v1 = r.val1 || r.source_attribute_key || '-';
        const v2 = r.val2 || r.target_attribute_key || '-';
        const desc = String(r.description || '').replace(/\|/g, '/').replace(/\r?\n/g, ' ');
        md += '| ' + r.id + ' | ' + r.name + ' | ' + v1 + ' | `' + r.operator + '` | ' + v2 + ' | ' + isCompat + ' | ' + desc + ' |\n';
      }
      md += '\n';
    }

    fs.writeFileSync('t:/Khoa_luan/docs/03-database/COMPREHENSIVE_COMPATIBILITY_RULES_SPEC.md', md, 'utf8');
    console.log('Successfully wrote full specification file to docs/03-database/COMPREHENSIVE_COMPATIBILITY_RULES_SPEC.md');
    await conn.end();
  } catch (err) {
    console.error('Error exporting rules:', err);
  }
})();
