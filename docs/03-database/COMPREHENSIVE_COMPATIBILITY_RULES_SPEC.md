# 📚 TÀI LIỆU TOÀN BỘ QUY TẮC TƯƠNG THÍCH PHẦN CỨNG (COMPATIBILITY RULES SPECIFICATION)

> **Hệ thống**: PC Mall Knowledge-Based Expert Engine
> **Tổng số quy tắc**: 441 quy tắc active trong cơ sở dữ liệu và 10 bộ quy tắc logic nghiệp vụ cốt lõi (COMP-001 -> COMP-010).
> **Cập nhật ngày**: 2026-10-17T12:19:23.437Z

---

## PHẦN 1: 10 QUY TẮC CỐT LÕI (CORE HARDWARE LOGIC COMP-001 -> COMP-010)

Các quy tắc này được định nghĩa và đồng bộ trực tiếp giữa Client (`calculateBuilderInsights.js`) và Server (`pc-builder.service.ts`):

| Mã Luật | Tên Quy Tắc | Linh Kiện Kiểm Tra | Tiêu Chí Đánh Giá | Mức Độ (Severity) |
| :--- | :--- | :--- | :--- | :---: |
| **COMP-001** | Socket CPU ↔ Mainboard | CPU + Bo Mạch Chủ | Chuẩn socket CPU (LGA1700, LGA1851, AM4, AM5) phải trùng khớp 100% với socket bo mạch chủ. | 🔴 BLOCKER |
| **COMP-002** | Thế hệ RAM ↔ Mainboard | RAM + Bo Mạch Chủ | Chuẩn bộ nhớ DDR4 / DDR5 của RAM phải khớp với khe cắm trên bo mạch chủ. | 🔴 BLOCKER |
| **COMP-002B** | Số thanh RAM vật lý | RAM + Bo Mạch Chủ | Số thanh RAM (`sticksPerUnit * quantity`) không được vượt quá số khe RAM vật lý (`ram_slots`). | 🔴 BLOCKER |
| **COMP-003** | Băng thông khe cắm PCIe | CPU + GPU + Mainboard | Card đồ họa PCIe x16; Bắt cảnh báo nghẽn bus lane khi kết hợp APU cũ (chỉ có PCIe x8 lane) với GPU cao cấp (RTX 4070+ / 5070+). | ⚠️ WARNING |
| **COMP-004** | Chiều dài GPU ↔ Khoang Case | Card đồ họa + Vỏ Case | Chiều dài Card đồ họa (`gpu_length` mm) <= Khoang chứa tối đa của Case (`case_gpu_clearance` mm). | 🔴 BLOCKER |
| **COMP-005** | Yêu cầu tản nhiệt rời cho CPU | CPU + Tản nhiệt | CPU dòng K/KF/KS/Ultra/X/X3D/Tray bắt buộc phải chọn tản nhiệt rời. Chỉ chip phổ thông kèm box mới có tản zin. | 🔴 BLOCKER |
| **COMP-006** | Hiệu năng & Kích thước tản | Tản nhiệt + CPU + Case | - Công suất tản (`cooling_capacity` W) >= TDP CPU (W)<br>- Chiều cao tản khí (`cooler_height` mm) <= Khoảng trống case (`case_cooler_clearance` mm)<br>- Kích thước Rad (`radiator_size` mm) <= Hỗ trợ rad của case (`case_radiator_support` mm). | 🔴 BLOCKER |
| **COMP-007** | Công suất Nguồn (PSU Wattage) | Nguồn + Toàn hệ thống | - `psuWatt < power`: Thiếu nguồn gây sập máy (BLOCKER)<br>- `0 <= psuMargin < 20%`: Thiếu biên độ an toàn dự phòng (WARNING)<br>- `psuMargin >= 20%`: Đạt chuẩn an toàn (OK). | 🔴 BLOCKER / ⚠️ WARNING |
| **COMP-008** | Cáp nguồn phụ GPU / CPU | Nguồn + GPU cao cấp | Card đồ họa công suất cao (TDP > 250W) yêu cầu nguồn tối thiểu 650W - 850W ATX 3.0 có đầu cấp nguồn phụ PCIe / 12V-2x6. | ⚠️ WARNING |
| **COMP-009** | Số khe cắm ổ M.2 NVMe | Bo Mạch Chủ + Ổ 1 + Ổ 2 | Tổng số ổ SSD chuẩn M.2 NVMe (`storage` + `storage_2`) không được vượt quá số khe cắm `m2_slots` trên bo mạch chủ. | 🔴 BLOCKER |
| **COMP-010** | Chuẩn kích thước Main ↔ Case | Bo Mạch Chủ + Vỏ Case | Kích thước bo mạch (E-ATX, ATX, mATX, ITX) phải vừa với form factor thùng máy hỗ trợ. Case nhỏ (ITX) không thể gắn Mainboard to (ATX). | 🔴 BLOCKER |

---

## PHẦN 2: CÁC LUẬT TỔ HỢP ĐA LINH KIỆN NÂNG CAO (MULTI-COMPONENT RULES)

| Mã Luật | Tên Luật | Tổ Hợp Linh Kiện | Mô Tả Xử Lý Nghiệp Vụ Chuyên Sâu |
| :--- | :--- | :--- | :--- |
| **RULE-MULTI-001** | CPU High-Power ↔ Mainboard VRM | CPU + Mainboard | CPU công suất cao (TDP > 125W như i7/i9, Ultra 7/9, Ryzen 9) đi cùng Mainboard phổ thông không tản VRM (H610/A620) sẽ quá nhiệt mạch cấp nguồn gây tụt xung nghiêm trọng. Bắt buộc dùng Mainboard dòng B/Z/X có VRM tối thiểu 10+2 phase. |
| **RULE-MULTI-002** | GPU High-End ↔ PSU Non-ATX 3.0 | GPU + Nguồn | Card đồ họa cao cấp (RTX 4070Ti/4080/4090/5070/5080/5090) có dòng xung kích (transient spikes) gấp 2-3 lần. Bắt buộc dùng nguồn chuẩn ATX 3.0/PCIe 5.0 có cổng 12VHPWR / 12V-2x6. |
| **RULE-MULTI-003** | CPU High-Heat + Case Mini ↔ AIO 360mm | CPU + Case + Tản | CPU công suất nhiệt lớn trong thùng máy nhỏ kín khí đòi hỏi tản nhiệt nước AIO 240/360mm gắn nóc thổi nhiệt trực tiếp ra ngoài. Không dùng tản khí tháp đơn vì khí nóng tích tụ gây quá nhiệt. |
| **RULE-MULTI-004** | RAM DDR5 Quad-Stick Stability | RAM + Bo Mạch Chủ | Chạy 4 thanh RAM DDR5 ở bus cao >6000MHz vượt quá độ ổn định của bộ điều khiển bộ nhớ (IMC). Khuyến nghị ưu tiên kit 2 thanh Dual-Channel (2x16GB hoặc 2x32GB). |
| **RULE-MULTI-005** | SSD NVMe PCIe 5.0 Heatsink | SSD + Bo Mạch Chủ | SSD chuẩn PCIe 5.0 đọc ghi >10,000 MB/s tỏa lượng nhiệt cực lớn (controller > 80°C). Bắt buộc phải gắn tản nhiệt heatsink nhôm dày để tránh tụt băng thông về SATA. |

---

## PHẦN 3: BẢNG TRA CỨU TOÀN BỘ 441 QUY TẮC CHI TIẾT TRONG DATABASE

### Nhóm Quy Tắc: COOLER_HEIGHT ↔ CASE_COOLER_CLEARANCE (42 quy tắc)

| ID | Tên Quy Tắc | Giá Trị Nguồn | Toán Tử | Giá Trị Đích | Tương Thích | Mô Tả Chi Tiết |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| 1487 | Tản khí 148mm ↔ Case giới hạn 148mm | 148mm | `LTE` | 148mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 148mm nằm trong giới hạn cho phép 148mm của nắp hông case. |
| 1488 | Tản khí 148mm ↔ Case giới hạn 154mm | 148mm | `LTE` | 154mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 148mm nằm trong giới hạn cho phép 154mm của nắp hông case. |
| 1489 | Tản khí 148mm ↔ Case giới hạn 155mm | 148mm | `LTE` | 155mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 148mm nằm trong giới hạn cho phép 155mm của nắp hông case. |
| 1490 | Tản khí 148mm ↔ Case giới hạn 157mm | 148mm | `LTE` | 157mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 148mm nằm trong giới hạn cho phép 157mm của nắp hông case. |
| 1491 | Tản khí 148mm ↔ Case giới hạn 160mm | 148mm | `LTE` | 160mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 148mm nằm trong giới hạn cho phép 160mm của nắp hông case. |
| 1492 | Tản khí 148mm ↔ Case giới hạn 165mm | 148mm | `LTE` | 165mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 148mm nằm trong giới hạn cho phép 165mm của nắp hông case. |
| 1493 | Tản khí 148mm ↔ Case giới hạn 170mm | 148mm | `LTE` | 170mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 148mm nằm trong giới hạn cho phép 170mm của nắp hông case. |
| 1494 | Tản khí 154mm ↔ Case giới hạn 148mm | 154mm | `GT` | 148mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 154mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 148mm). |
| 1495 | Tản khí 154mm ↔ Case giới hạn 154mm | 154mm | `LTE` | 154mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 154mm nằm trong giới hạn cho phép 154mm của nắp hông case. |
| 1496 | Tản khí 154mm ↔ Case giới hạn 155mm | 154mm | `LTE` | 155mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 154mm nằm trong giới hạn cho phép 155mm của nắp hông case. |
| 1497 | Tản khí 154mm ↔ Case giới hạn 157mm | 154mm | `LTE` | 157mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 154mm nằm trong giới hạn cho phép 157mm của nắp hông case. |
| 1498 | Tản khí 154mm ↔ Case giới hạn 160mm | 154mm | `LTE` | 160mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 154mm nằm trong giới hạn cho phép 160mm của nắp hông case. |
| 1499 | Tản khí 154mm ↔ Case giới hạn 165mm | 154mm | `LTE` | 165mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 154mm nằm trong giới hạn cho phép 165mm của nắp hông case. |
| 1500 | Tản khí 154mm ↔ Case giới hạn 170mm | 154mm | `LTE` | 170mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 154mm nằm trong giới hạn cho phép 170mm của nắp hông case. |
| 1501 | Tản khí 157mm ↔ Case giới hạn 148mm | 157mm | `GT` | 148mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 157mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 148mm). |
| 1502 | Tản khí 157mm ↔ Case giới hạn 154mm | 157mm | `GT` | 154mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 157mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 154mm). |
| 1503 | Tản khí 157mm ↔ Case giới hạn 155mm | 157mm | `GT` | 155mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 157mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 155mm). |
| 1504 | Tản khí 157mm ↔ Case giới hạn 157mm | 157mm | `LTE` | 157mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 157mm nằm trong giới hạn cho phép 157mm của nắp hông case. |
| 1505 | Tản khí 157mm ↔ Case giới hạn 160mm | 157mm | `LTE` | 160mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 157mm nằm trong giới hạn cho phép 160mm của nắp hông case. |
| 1506 | Tản khí 157mm ↔ Case giới hạn 165mm | 157mm | `LTE` | 165mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 157mm nằm trong giới hạn cho phép 165mm của nắp hông case. |
| 1507 | Tản khí 157mm ↔ Case giới hạn 170mm | 157mm | `LTE` | 170mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 157mm nằm trong giới hạn cho phép 170mm của nắp hông case. |
| 1508 | Tản khí 160mm ↔ Case giới hạn 148mm | 160mm | `GT` | 148mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 160mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 148mm). |
| 1509 | Tản khí 160mm ↔ Case giới hạn 154mm | 160mm | `GT` | 154mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 160mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 154mm). |
| 1510 | Tản khí 160mm ↔ Case giới hạn 155mm | 160mm | `GT` | 155mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 160mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 155mm). |
| 1511 | Tản khí 160mm ↔ Case giới hạn 157mm | 160mm | `GT` | 157mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 160mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 157mm). |
| 1512 | Tản khí 160mm ↔ Case giới hạn 160mm | 160mm | `LTE` | 160mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 160mm nằm trong giới hạn cho phép 160mm của nắp hông case. |
| 1513 | Tản khí 160mm ↔ Case giới hạn 165mm | 160mm | `LTE` | 165mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 160mm nằm trong giới hạn cho phép 165mm của nắp hông case. |
| 1514 | Tản khí 160mm ↔ Case giới hạn 170mm | 160mm | `LTE` | 170mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 160mm nằm trong giới hạn cho phép 170mm của nắp hông case. |
| 1515 | Tản khí 165mm ↔ Case giới hạn 148mm | 165mm | `GT` | 148mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 165mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 148mm). |
| 1516 | Tản khí 165mm ↔ Case giới hạn 154mm | 165mm | `GT` | 154mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 165mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 154mm). |
| 1517 | Tản khí 165mm ↔ Case giới hạn 155mm | 165mm | `GT` | 155mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 165mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 155mm). |
| 1518 | Tản khí 165mm ↔ Case giới hạn 157mm | 165mm | `GT` | 157mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 165mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 157mm). |
| 1519 | Tản khí 165mm ↔ Case giới hạn 160mm | 165mm | `GT` | 160mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 165mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 160mm). |
| 1520 | Tản khí 165mm ↔ Case giới hạn 165mm | 165mm | `LTE` | 165mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 165mm nằm trong giới hạn cho phép 165mm của nắp hông case. |
| 1521 | Tản khí 165mm ↔ Case giới hạn 170mm | 165mm | `LTE` | 170mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 165mm nằm trong giới hạn cho phép 170mm của nắp hông case. |
| 1522 | Tản khí 170mm ↔ Case giới hạn 148mm | 170mm | `GT` | 148mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 170mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 148mm). |
| 1523 | Tản khí 170mm ↔ Case giới hạn 154mm | 170mm | `GT` | 154mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 170mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 154mm). |
| 1524 | Tản khí 170mm ↔ Case giới hạn 155mm | 170mm | `GT` | 155mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 170mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 155mm). |
| 1525 | Tản khí 170mm ↔ Case giới hạn 157mm | 170mm | `GT` | 157mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 170mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 157mm). |
| 1526 | Tản khí 170mm ↔ Case giới hạn 160mm | 170mm | `GT` | 160mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 170mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 160mm). |
| 1527 | Tản khí 170mm ↔ Case giới hạn 165mm | 170mm | `GT` | 165mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tháp tản nhiệt khí cao 170mm sẽ bị cấn nắp kính hông case (giới hạn tối đa 165mm). |
| 1528 | Tản khí 170mm ↔ Case giới hạn 170mm | 170mm | `LTE` | 170mm | ✅ Hợp lệ | TƯƠNG THÍCH: Chiều cao tản nhiệt khí 170mm nằm trong giới hạn cho phép 170mm của nắp hông case. |

### Nhóm Quy Tắc: COOLING_CAPACITY ↔ TDP (90 quy tắc)

| ID | Tên Quy Tắc | Giá Trị Nguồn | Toán Tử | Giá Trị Đích | Tương Thích | Mô Tả Chi Tiết |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| 1529 | Tản nhiệt 180W ↔ CPU TDP 35W | 180W | `GTE` | 35W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 180W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 35W. |
| 1530 | Tản nhiệt 180W ↔ CPU TDP 65W | 180W | `GTE` | 65W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 180W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 65W. |
| 1531 | Tản nhiệt 180W ↔ CPU TDP 95W | 180W | `GTE` | 95W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 180W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 95W. |
| 1532 | Tản nhiệt 180W ↔ CPU TDP 105W | 180W | `GTE` | 105W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 180W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 105W. |
| 1533 | Tản nhiệt 180W ↔ CPU TDP 120W | 180W | `GTE` | 120W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 180W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 120W. |
| 1534 | Tản nhiệt 180W ↔ CPU TDP 125W | 180W | `GTE` | 125W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 180W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 125W. |
| 1535 | Tản nhiệt 180W ↔ CPU TDP 150W | 180W | `GTE` | 150W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 180W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 150W. |
| 1536 | Tản nhiệt 180W ↔ CPU TDP 160W | 180W | `GTE` | 160W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 180W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 160W. |
| 1537 | Tản nhiệt 180W ↔ CPU TDP 170W | 180W | `GTE` | 170W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 180W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 170W. |
| 1538 | Tản nhiệt 180W ↔ CPU TDP 180W | 180W | `GTE` | 180W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 180W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 180W. |
| 1539 | Tản nhiệt 180W ↔ CPU TDP 200W | 180W | `LT` | 200W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 180W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 200W. |
| 1540 | Tản nhiệt 180W ↔ CPU TDP 220W | 180W | `LT` | 220W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 180W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 220W. |
| 1541 | Tản nhiệt 180W ↔ CPU TDP 250W | 180W | `LT` | 250W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 180W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 250W. |
| 1542 | Tản nhiệt 180W ↔ CPU TDP 260W | 180W | `LT` | 260W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 180W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 260W. |
| 1543 | Tản nhiệt 180W ↔ CPU TDP 300W | 180W | `LT` | 300W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 180W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 300W. |
| 1544 | Tản nhiệt 180W ↔ CPU TDP 320W | 180W | `LT` | 320W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 180W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 320W. |
| 1545 | Tản nhiệt 180W ↔ CPU TDP 350W | 180W | `LT` | 350W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 180W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 350W. |
| 1546 | Tản nhiệt 180W ↔ CPU TDP 450W | 180W | `LT` | 450W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 180W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 450W. |
| 1547 | Tản nhiệt 220W ↔ CPU TDP 35W | 220W | `GTE` | 35W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 35W. |
| 1548 | Tản nhiệt 220W ↔ CPU TDP 65W | 220W | `GTE` | 65W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 65W. |
| 1549 | Tản nhiệt 220W ↔ CPU TDP 95W | 220W | `GTE` | 95W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 95W. |
| 1550 | Tản nhiệt 220W ↔ CPU TDP 105W | 220W | `GTE` | 105W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 105W. |
| 1551 | Tản nhiệt 220W ↔ CPU TDP 120W | 220W | `GTE` | 120W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 120W. |
| 1552 | Tản nhiệt 220W ↔ CPU TDP 125W | 220W | `GTE` | 125W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 125W. |
| 1553 | Tản nhiệt 220W ↔ CPU TDP 150W | 220W | `GTE` | 150W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 150W. |
| 1554 | Tản nhiệt 220W ↔ CPU TDP 160W | 220W | `GTE` | 160W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 160W. |
| 1555 | Tản nhiệt 220W ↔ CPU TDP 170W | 220W | `GTE` | 170W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 170W. |
| 1556 | Tản nhiệt 220W ↔ CPU TDP 180W | 220W | `GTE` | 180W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 180W. |
| 1557 | Tản nhiệt 220W ↔ CPU TDP 200W | 220W | `GTE` | 200W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 200W. |
| 1558 | Tản nhiệt 220W ↔ CPU TDP 220W | 220W | `GTE` | 220W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 220W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 220W. |
| 1559 | Tản nhiệt 220W ↔ CPU TDP 250W | 220W | `LT` | 250W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 220W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 250W. |
| 1560 | Tản nhiệt 220W ↔ CPU TDP 260W | 220W | `LT` | 260W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 220W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 260W. |
| 1561 | Tản nhiệt 220W ↔ CPU TDP 300W | 220W | `LT` | 300W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 220W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 300W. |
| 1562 | Tản nhiệt 220W ↔ CPU TDP 320W | 220W | `LT` | 320W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 220W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 320W. |
| 1563 | Tản nhiệt 220W ↔ CPU TDP 350W | 220W | `LT` | 350W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 220W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 350W. |
| 1564 | Tản nhiệt 220W ↔ CPU TDP 450W | 220W | `LT` | 450W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 220W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 450W. |
| 1565 | Tản nhiệt 260W ↔ CPU TDP 35W | 260W | `GTE` | 35W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 35W. |
| 1566 | Tản nhiệt 260W ↔ CPU TDP 65W | 260W | `GTE` | 65W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 65W. |
| 1567 | Tản nhiệt 260W ↔ CPU TDP 95W | 260W | `GTE` | 95W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 95W. |
| 1568 | Tản nhiệt 260W ↔ CPU TDP 105W | 260W | `GTE` | 105W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 105W. |
| 1569 | Tản nhiệt 260W ↔ CPU TDP 120W | 260W | `GTE` | 120W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 120W. |
| 1570 | Tản nhiệt 260W ↔ CPU TDP 125W | 260W | `GTE` | 125W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 125W. |
| 1571 | Tản nhiệt 260W ↔ CPU TDP 150W | 260W | `GTE` | 150W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 150W. |
| 1572 | Tản nhiệt 260W ↔ CPU TDP 160W | 260W | `GTE` | 160W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 160W. |
| 1573 | Tản nhiệt 260W ↔ CPU TDP 170W | 260W | `GTE` | 170W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 170W. |
| 1574 | Tản nhiệt 260W ↔ CPU TDP 180W | 260W | `GTE` | 180W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 180W. |
| 1575 | Tản nhiệt 260W ↔ CPU TDP 200W | 260W | `GTE` | 200W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 200W. |
| 1576 | Tản nhiệt 260W ↔ CPU TDP 220W | 260W | `GTE` | 220W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 220W. |
| 1577 | Tản nhiệt 260W ↔ CPU TDP 250W | 260W | `GTE` | 250W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 250W. |
| 1578 | Tản nhiệt 260W ↔ CPU TDP 260W | 260W | `GTE` | 260W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 260W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 260W. |
| 1579 | Tản nhiệt 260W ↔ CPU TDP 300W | 260W | `LT` | 300W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 260W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 300W. |
| 1580 | Tản nhiệt 260W ↔ CPU TDP 320W | 260W | `LT` | 320W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 260W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 320W. |
| 1581 | Tản nhiệt 260W ↔ CPU TDP 350W | 260W | `LT` | 350W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 260W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 350W. |
| 1582 | Tản nhiệt 260W ↔ CPU TDP 450W | 260W | `LT` | 450W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 260W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 450W. |
| 1583 | Tản nhiệt 300W ↔ CPU TDP 35W | 300W | `GTE` | 35W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 35W. |
| 1584 | Tản nhiệt 300W ↔ CPU TDP 65W | 300W | `GTE` | 65W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 65W. |
| 1585 | Tản nhiệt 300W ↔ CPU TDP 95W | 300W | `GTE` | 95W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 95W. |
| 1586 | Tản nhiệt 300W ↔ CPU TDP 105W | 300W | `GTE` | 105W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 105W. |
| 1587 | Tản nhiệt 300W ↔ CPU TDP 120W | 300W | `GTE` | 120W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 120W. |
| 1588 | Tản nhiệt 300W ↔ CPU TDP 125W | 300W | `GTE` | 125W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 125W. |
| 1589 | Tản nhiệt 300W ↔ CPU TDP 150W | 300W | `GTE` | 150W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 150W. |
| 1590 | Tản nhiệt 300W ↔ CPU TDP 160W | 300W | `GTE` | 160W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 160W. |
| 1591 | Tản nhiệt 300W ↔ CPU TDP 170W | 300W | `GTE` | 170W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 170W. |
| 1592 | Tản nhiệt 300W ↔ CPU TDP 180W | 300W | `GTE` | 180W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 180W. |
| 1593 | Tản nhiệt 300W ↔ CPU TDP 200W | 300W | `GTE` | 200W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 200W. |
| 1594 | Tản nhiệt 300W ↔ CPU TDP 220W | 300W | `GTE` | 220W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 220W. |
| 1595 | Tản nhiệt 300W ↔ CPU TDP 250W | 300W | `GTE` | 250W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 250W. |
| 1596 | Tản nhiệt 300W ↔ CPU TDP 260W | 300W | `GTE` | 260W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 260W. |
| 1597 | Tản nhiệt 300W ↔ CPU TDP 300W | 300W | `GTE` | 300W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 300W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 300W. |
| 1598 | Tản nhiệt 300W ↔ CPU TDP 320W | 300W | `LT` | 320W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 300W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 320W. |
| 1599 | Tản nhiệt 300W ↔ CPU TDP 350W | 300W | `LT` | 350W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 300W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 350W. |
| 1600 | Tản nhiệt 300W ↔ CPU TDP 450W | 300W | `LT` | 450W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 300W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 450W. |
| 1601 | Tản nhiệt 350W ↔ CPU TDP 35W | 350W | `GTE` | 35W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 35W. |
| 1602 | Tản nhiệt 350W ↔ CPU TDP 65W | 350W | `GTE` | 65W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 65W. |
| 1603 | Tản nhiệt 350W ↔ CPU TDP 95W | 350W | `GTE` | 95W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 95W. |
| 1604 | Tản nhiệt 350W ↔ CPU TDP 105W | 350W | `GTE` | 105W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 105W. |
| 1605 | Tản nhiệt 350W ↔ CPU TDP 120W | 350W | `GTE` | 120W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 120W. |
| 1606 | Tản nhiệt 350W ↔ CPU TDP 125W | 350W | `GTE` | 125W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 125W. |
| 1607 | Tản nhiệt 350W ↔ CPU TDP 150W | 350W | `GTE` | 150W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 150W. |
| 1608 | Tản nhiệt 350W ↔ CPU TDP 160W | 350W | `GTE` | 160W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 160W. |
| 1609 | Tản nhiệt 350W ↔ CPU TDP 170W | 350W | `GTE` | 170W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 170W. |
| 1610 | Tản nhiệt 350W ↔ CPU TDP 180W | 350W | `GTE` | 180W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 180W. |
| 1611 | Tản nhiệt 350W ↔ CPU TDP 200W | 350W | `GTE` | 200W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 200W. |
| 1612 | Tản nhiệt 350W ↔ CPU TDP 220W | 350W | `GTE` | 220W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 220W. |
| 1613 | Tản nhiệt 350W ↔ CPU TDP 250W | 350W | `GTE` | 250W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 250W. |
| 1614 | Tản nhiệt 350W ↔ CPU TDP 260W | 350W | `GTE` | 260W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 260W. |
| 1615 | Tản nhiệt 350W ↔ CPU TDP 300W | 350W | `GTE` | 300W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 300W. |
| 1616 | Tản nhiệt 350W ↔ CPU TDP 320W | 350W | `GTE` | 320W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 320W. |
| 1617 | Tản nhiệt 350W ↔ CPU TDP 350W | 350W | `GTE` | 350W | ✅ Hợp lệ | TƯƠNG THÍCH: Hiệu năng giải nhiệt 350W đủ đáp ứng làm mát an toàn cho vi xử lý tỏa nhiệt 350W. |
| 1618 | Tản nhiệt 350W ↔ CPU TDP 450W | 350W | `LT` | 450W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt chỉ thiết kế cho mức công suất 350W, không đủ giải nhiệt cho CPU tỏa nhiệt tới 450W. |

### Nhóm Quy Tắc: CPU_THERMAL_OUTPUT ↔ COOLING_TYPE (1 quy tắc)

| ID | Tên Quy Tắc | Giá Trị Nguồn | Toán Tử | Giá Trị Đích | Tương Thích | Mô Tả Chi Tiết |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| 1850 | RULE-MULTI-003: CPU High-Heat + Case ITX/Mini ↔ Tản Nhiệt AIO 360mm Bắt Buộc | cpu_thermal_output | `EQ` | cooling_type | ❌ Xung đột | QUÁ NHIỆT KHÔNG GIAN HẸP: CPU công suất nhiệt lớn trong thùng máy nhỏ kín khí đòi hỏi tản nhiệt nước AIO 240/360mm gắn nóc thổi nhiệt trực tiếp ra ngoài. Không dùng tản khí tháp đơn vì khí nóng tích tụ gây nghẽn nhiệt toàn thùng máy. |

### Nhóm Quy Tắc: FORM_FACTOR ↔ FORM_FACTOR (16 quy tắc)

| ID | Tên Quy Tắc | Giá Trị Nguồn | Toán Tử | Giá Trị Đích | Tương Thích | Mô Tả Chi Tiết |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| 1446 | Mainboard E-ATX ↔ Case E-ATX | E-ATX | `LTE` | E-ATX | ✅ Hợp lệ | TƯƠNG THÍCH: Thùng máy E-ATX đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ E-ATX. |
| 1447 | Mainboard E-ATX ↔ Case ATX | E-ATX | `GT` | ATX | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Bo mạch chủ E-ATX kích thước quá lớn, không thể lắp vào thùng máy nhỏ gọn chuẩn ATX. |
| 1448 | Mainboard E-ATX ↔ Case mATX | E-ATX | `GT` | mATX | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Bo mạch chủ E-ATX kích thước quá lớn, không thể lắp vào thùng máy nhỏ gọn chuẩn mATX. |
| 1449 | Mainboard E-ATX ↔ Case ITX | E-ATX | `GT` | ITX | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Bo mạch chủ E-ATX kích thước quá lớn, không thể lắp vào thùng máy nhỏ gọn chuẩn ITX. |
| 1450 | Mainboard ATX ↔ Case E-ATX | ATX | `LTE` | E-ATX | ✅ Hợp lệ | TƯƠNG THÍCH: Thùng máy E-ATX đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ ATX. |
| 1451 | Mainboard ATX ↔ Case ATX | ATX | `LTE` | ATX | ✅ Hợp lệ | TƯƠNG THÍCH: Thùng máy ATX đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ ATX. |
| 1452 | Mainboard ATX ↔ Case mATX | ATX | `GT` | mATX | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Bo mạch chủ ATX kích thước quá lớn, không thể lắp vào thùng máy nhỏ gọn chuẩn mATX. |
| 1453 | Mainboard ATX ↔ Case ITX | ATX | `GT` | ITX | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Bo mạch chủ ATX kích thước quá lớn, không thể lắp vào thùng máy nhỏ gọn chuẩn ITX. |
| 1454 | Mainboard mATX ↔ Case E-ATX | mATX | `LTE` | E-ATX | ✅ Hợp lệ | TƯƠNG THÍCH: Thùng máy E-ATX đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ mATX. |
| 1455 | Mainboard mATX ↔ Case ATX | mATX | `LTE` | ATX | ✅ Hợp lệ | TƯƠNG THÍCH: Thùng máy ATX đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ mATX. |
| 1456 | Mainboard mATX ↔ Case mATX | mATX | `LTE` | mATX | ✅ Hợp lệ | TƯƠNG THÍCH: Thùng máy mATX đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ mATX. |
| 1457 | Mainboard mATX ↔ Case ITX | mATX | `GT` | ITX | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Bo mạch chủ mATX kích thước quá lớn, không thể lắp vào thùng máy nhỏ gọn chuẩn ITX. |
| 1458 | Mainboard ITX ↔ Case E-ATX | ITX | `LTE` | E-ATX | ✅ Hợp lệ | TƯƠNG THÍCH: Thùng máy E-ATX đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ ITX. |
| 1459 | Mainboard ITX ↔ Case ATX | ITX | `LTE` | ATX | ✅ Hợp lệ | TƯƠNG THÍCH: Thùng máy ATX đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ ITX. |
| 1460 | Mainboard ITX ↔ Case mATX | ITX | `LTE` | mATX | ✅ Hợp lệ | TƯƠNG THÍCH: Thùng máy mATX đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ ITX. |
| 1461 | Mainboard ITX ↔ Case ITX | ITX | `LTE` | ITX | ✅ Hợp lệ | TƯƠNG THÍCH: Thùng máy ITX đủ diện tích và vị trí ốc standoff lắp vừa vặn bo mạch chủ ITX. |

### Nhóm Quy Tắc: GPU_TDP ↔ PSU_STANDARD (1 quy tắc)

| ID | Tên Quy Tắc | Giá Trị Nguồn | Toán Tử | Giá Trị Đích | Tương Thích | Mô Tả Chi Tiết |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| 1849 | RULE-MULTI-002: GPU High-End ↔ PSU Non-ATX3.0 Transient Spike Risk | gpu_tdp | `NEQ` | psu_standard | ❌ Xung đột | CẢNH BÁO NGUỒN XUNG KÍCH: Card đồ họa cao cấp (RTX 4070Ti/4080/4090/5070/5080/5090) có dòng xung kích (transient spikes) gấp 2-3 lần công suất danh định. Bắt buộc dùng nguồn chuẩn ATX 3.0/PCIe 5.0 có cổng 12V-2x6 / 12VHPWR nguyên bản để tránh sập nguồn hoặc nóng chảy jack chuyển đổi. |

### Nhóm Quy Tắc: PCIE_GEN ↔ M2_HEATSINK_REQUIREMENT (1 quy tắc)

| ID | Tên Quy Tắc | Giá Trị Nguồn | Toán Tử | Giá Trị Đích | Tương Thích | Mô Tả Chi Tiết |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| 1852 | RULE-MULTI-005: SSD NVMe PCIe 5.0 Thermal Throttling Protection | pcie_gen | `EQ` | m2_heatsink_requirement | ✅ Hợp lệ | YÊU CẦU TẢN NHIỆT SSD: SSD chuẩn PCIe 5.0 có tốc độ đọc ghi >10,000 MB/s tỏa lượng nhiệt cực lớn (controller > 80°C). Bắt buộc phải gắn tản nhiệt hợp kim nhôm dày đi kèm bo mạch chủ hoặc heatsink quạt chủ động để tránh tụt băng thông về tốc độ SATA. |

### Nhóm Quy Tắc: PSU_WATTAGE ↔ TDP (180 quy tắc)

| ID | Tên Quy Tắc | Giá Trị Nguồn | Toán Tử | Giá Trị Đích | Tương Thích | Mô Tả Chi Tiết |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| 1619 | Nguồn 350W ↔ GPU TDP 95W (GTX 1650 / RX 6400) | 350W | `GTE` | 95W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 350W đáp ứng khuyến nghị tối thiểu (350W) cho GPU GTX 1650 / RX 6400 (TDP 95W). |
| 1620 | Nguồn 350W ↔ GPU TDP 120W (RTX 3050 / GTX 1660S) | 350W | `LT` | 120W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 3050 / GTX 1660S (TDP 120W, yêu cầu tối thiểu 450W). Nguy cơ sập nguồn khi full tải. |
| 1621 | Nguồn 350W ↔ GPU TDP 150W (RTX 4060 / RX 6600) | 350W | `LT` | 150W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 4060 / RX 6600 (TDP 150W, yêu cầu tối thiểu 500W). Nguy cơ sập nguồn khi full tải. |
| 1622 | Nguồn 350W ↔ GPU TDP 160W (RTX 4060 Ti / RX 7600) | 350W | `LT` | 160W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 4060 Ti / RX 7600 (TDP 160W, yêu cầu tối thiểu 500W). Nguy cơ sập nguồn khi full tải. |
| 1623 | Nguồn 350W ↔ GPU TDP 200W (RTX 4070 / RTX 3060Ti) | 350W | `LT` | 200W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 4070 / RTX 3060Ti (TDP 200W, yêu cầu tối thiểu 550W). Nguy cơ sập nguồn khi full tải. |
| 1624 | Nguồn 350W ↔ GPU TDP 220W (RTX 3070 / RX 7700XT) | 350W | `LT` | 220W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 3070 / RX 7700XT (TDP 220W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn khi full tải. |
| 1625 | Nguồn 350W ↔ GPU TDP 250W (RTX 4070 Ti / RX 6800) | 350W | `LT` | 250W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 4070 Ti / RX 6800 (TDP 250W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn khi full tải. |
| 1626 | Nguồn 350W ↔ GPU TDP 260W (RTX 3080 / RTX 5070 / RX 7800XT) | 350W | `LT` | 260W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 3080 / RTX 5070 / RX 7800XT (TDP 260W, yêu cầu tối thiểu 700W). Nguy cơ sập nguồn khi full tải. |
| 1627 | Nguồn 350W ↔ GPU TDP 300W (RTX 4070 Ti Super) | 350W | `LT` | 300W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 4070 Ti Super (TDP 300W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn khi full tải. |
| 1628 | Nguồn 350W ↔ GPU TDP 320W (RTX 4080 Super) | 350W | `LT` | 320W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 4080 Super (TDP 320W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn khi full tải. |
| 1629 | Nguồn 350W ↔ GPU TDP 350W (RTX 3090 / RX 7900 XT) | 350W | `LT` | 350W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 3090 / RX 7900 XT (TDP 350W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải. |
| 1630 | Nguồn 350W ↔ GPU TDP 450W (RTX 4090 / RX 7900 XTX) | 350W | `LT` | 450W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 350W không đủ công suất cho card đồ họa RTX 4090 / RX 7900 XTX (TDP 450W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải. |
| 1631 | Nguồn 450W ↔ GPU TDP 95W (GTX 1650 / RX 6400) | 450W | `GTE` | 95W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 450W đáp ứng khuyến nghị tối thiểu (350W) cho GPU GTX 1650 / RX 6400 (TDP 95W). |
| 1632 | Nguồn 450W ↔ GPU TDP 120W (RTX 3050 / GTX 1660S) | 450W | `GTE` | 120W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 450W đáp ứng khuyến nghị tối thiểu (450W) cho GPU RTX 3050 / GTX 1660S (TDP 120W). |
| 1633 | Nguồn 450W ↔ GPU TDP 150W (RTX 4060 / RX 6600) | 450W | `LT` | 150W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 450W không đủ công suất cho card đồ họa RTX 4060 / RX 6600 (TDP 150W, yêu cầu tối thiểu 500W). Nguy cơ sập nguồn khi full tải. |
| 1634 | Nguồn 450W ↔ GPU TDP 160W (RTX 4060 Ti / RX 7600) | 450W | `LT` | 160W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 450W không đủ công suất cho card đồ họa RTX 4060 Ti / RX 7600 (TDP 160W, yêu cầu tối thiểu 500W). Nguy cơ sập nguồn khi full tải. |
| 1635 | Nguồn 450W ↔ GPU TDP 200W (RTX 4070 / RTX 3060Ti) | 450W | `LT` | 200W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 450W không đủ công suất cho card đồ họa RTX 4070 / RTX 3060Ti (TDP 200W, yêu cầu tối thiểu 550W). Nguy cơ sập nguồn khi full tải. |
| 1636 | Nguồn 450W ↔ GPU TDP 220W (RTX 3070 / RX 7700XT) | 450W | `LT` | 220W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 450W không đủ công suất cho card đồ họa RTX 3070 / RX 7700XT (TDP 220W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn khi full tải. |
| 1637 | Nguồn 450W ↔ GPU TDP 250W (RTX 4070 Ti / RX 6800) | 450W | `LT` | 250W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 450W không đủ công suất cho card đồ họa RTX 4070 Ti / RX 6800 (TDP 250W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn khi full tải. |
| 1638 | Nguồn 450W ↔ GPU TDP 260W (RTX 3080 / RTX 5070 / RX 7800XT) | 450W | `LT` | 260W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 450W không đủ công suất cho card đồ họa RTX 3080 / RTX 5070 / RX 7800XT (TDP 260W, yêu cầu tối thiểu 700W). Nguy cơ sập nguồn khi full tải. |
| 1639 | Nguồn 450W ↔ GPU TDP 300W (RTX 4070 Ti Super) | 450W | `LT` | 300W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 450W không đủ công suất cho card đồ họa RTX 4070 Ti Super (TDP 300W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn khi full tải. |
| 1640 | Nguồn 450W ↔ GPU TDP 320W (RTX 4080 Super) | 450W | `LT` | 320W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 450W không đủ công suất cho card đồ họa RTX 4080 Super (TDP 320W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn khi full tải. |
| 1641 | Nguồn 450W ↔ GPU TDP 350W (RTX 3090 / RX 7900 XT) | 450W | `LT` | 350W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 450W không đủ công suất cho card đồ họa RTX 3090 / RX 7900 XT (TDP 350W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải. |
| 1642 | Nguồn 450W ↔ GPU TDP 450W (RTX 4090 / RX 7900 XTX) | 450W | `LT` | 450W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 450W không đủ công suất cho card đồ họa RTX 4090 / RX 7900 XTX (TDP 450W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải. |
| 1643 | Nguồn 500W ↔ GPU TDP 95W (GTX 1650 / RX 6400) | 500W | `GTE` | 95W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 500W đáp ứng khuyến nghị tối thiểu (350W) cho GPU GTX 1650 / RX 6400 (TDP 95W). |
| 1644 | Nguồn 500W ↔ GPU TDP 120W (RTX 3050 / GTX 1660S) | 500W | `GTE` | 120W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 500W đáp ứng khuyến nghị tối thiểu (450W) cho GPU RTX 3050 / GTX 1660S (TDP 120W). |
| 1645 | Nguồn 500W ↔ GPU TDP 150W (RTX 4060 / RX 6600) | 500W | `GTE` | 150W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 500W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 / RX 6600 (TDP 150W). |
| 1646 | Nguồn 500W ↔ GPU TDP 160W (RTX 4060 Ti / RX 7600) | 500W | `GTE` | 160W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 500W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 Ti / RX 7600 (TDP 160W). |
| 1647 | Nguồn 500W ↔ GPU TDP 200W (RTX 4070 / RTX 3060Ti) | 500W | `LT` | 200W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 500W không đủ công suất cho card đồ họa RTX 4070 / RTX 3060Ti (TDP 200W, yêu cầu tối thiểu 550W). Nguy cơ sập nguồn khi full tải. |
| 1648 | Nguồn 500W ↔ GPU TDP 220W (RTX 3070 / RX 7700XT) | 500W | `LT` | 220W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 500W không đủ công suất cho card đồ họa RTX 3070 / RX 7700XT (TDP 220W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn khi full tải. |
| 1649 | Nguồn 500W ↔ GPU TDP 250W (RTX 4070 Ti / RX 6800) | 500W | `LT` | 250W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 500W không đủ công suất cho card đồ họa RTX 4070 Ti / RX 6800 (TDP 250W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn khi full tải. |
| 1650 | Nguồn 500W ↔ GPU TDP 260W (RTX 3080 / RTX 5070 / RX 7800XT) | 500W | `LT` | 260W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 500W không đủ công suất cho card đồ họa RTX 3080 / RTX 5070 / RX 7800XT (TDP 260W, yêu cầu tối thiểu 700W). Nguy cơ sập nguồn khi full tải. |
| 1651 | Nguồn 500W ↔ GPU TDP 300W (RTX 4070 Ti Super) | 500W | `LT` | 300W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 500W không đủ công suất cho card đồ họa RTX 4070 Ti Super (TDP 300W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn khi full tải. |
| 1652 | Nguồn 500W ↔ GPU TDP 320W (RTX 4080 Super) | 500W | `LT` | 320W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 500W không đủ công suất cho card đồ họa RTX 4080 Super (TDP 320W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn khi full tải. |
| 1653 | Nguồn 500W ↔ GPU TDP 350W (RTX 3090 / RX 7900 XT) | 500W | `LT` | 350W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 500W không đủ công suất cho card đồ họa RTX 3090 / RX 7900 XT (TDP 350W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải. |
| 1654 | Nguồn 500W ↔ GPU TDP 450W (RTX 4090 / RX 7900 XTX) | 500W | `LT` | 450W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 500W không đủ công suất cho card đồ họa RTX 4090 / RX 7900 XTX (TDP 450W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải. |
| 1655 | Nguồn 550W ↔ GPU TDP 95W (GTX 1650 / RX 6400) | 550W | `GTE` | 95W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 550W đáp ứng khuyến nghị tối thiểu (350W) cho GPU GTX 1650 / RX 6400 (TDP 95W). |
| 1656 | Nguồn 550W ↔ GPU TDP 120W (RTX 3050 / GTX 1660S) | 550W | `GTE` | 120W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 550W đáp ứng khuyến nghị tối thiểu (450W) cho GPU RTX 3050 / GTX 1660S (TDP 120W). |
| 1657 | Nguồn 550W ↔ GPU TDP 150W (RTX 4060 / RX 6600) | 550W | `GTE` | 150W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 550W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 / RX 6600 (TDP 150W). |
| 1658 | Nguồn 550W ↔ GPU TDP 160W (RTX 4060 Ti / RX 7600) | 550W | `GTE` | 160W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 550W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 Ti / RX 7600 (TDP 160W). |
| 1659 | Nguồn 550W ↔ GPU TDP 200W (RTX 4070 / RTX 3060Ti) | 550W | `GTE` | 200W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 550W đáp ứng khuyến nghị tối thiểu (550W) cho GPU RTX 4070 / RTX 3060Ti (TDP 200W). |
| 1660 | Nguồn 550W ↔ GPU TDP 220W (RTX 3070 / RX 7700XT) | 550W | `LT` | 220W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 550W không đủ công suất cho card đồ họa RTX 3070 / RX 7700XT (TDP 220W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn khi full tải. |
| 1661 | Nguồn 550W ↔ GPU TDP 250W (RTX 4070 Ti / RX 6800) | 550W | `LT` | 250W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 550W không đủ công suất cho card đồ họa RTX 4070 Ti / RX 6800 (TDP 250W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn khi full tải. |
| 1662 | Nguồn 550W ↔ GPU TDP 260W (RTX 3080 / RTX 5070 / RX 7800XT) | 550W | `LT` | 260W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 550W không đủ công suất cho card đồ họa RTX 3080 / RTX 5070 / RX 7800XT (TDP 260W, yêu cầu tối thiểu 700W). Nguy cơ sập nguồn khi full tải. |
| 1663 | Nguồn 550W ↔ GPU TDP 300W (RTX 4070 Ti Super) | 550W | `LT` | 300W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 550W không đủ công suất cho card đồ họa RTX 4070 Ti Super (TDP 300W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn khi full tải. |
| 1664 | Nguồn 550W ↔ GPU TDP 320W (RTX 4080 Super) | 550W | `LT` | 320W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 550W không đủ công suất cho card đồ họa RTX 4080 Super (TDP 320W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn khi full tải. |
| 1665 | Nguồn 550W ↔ GPU TDP 350W (RTX 3090 / RX 7900 XT) | 550W | `LT` | 350W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 550W không đủ công suất cho card đồ họa RTX 3090 / RX 7900 XT (TDP 350W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải. |
| 1666 | Nguồn 550W ↔ GPU TDP 450W (RTX 4090 / RX 7900 XTX) | 550W | `LT` | 450W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 550W không đủ công suất cho card đồ họa RTX 4090 / RX 7900 XTX (TDP 450W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải. |
| 1667 | Nguồn 650W ↔ GPU TDP 95W (GTX 1650 / RX 6400) | 650W | `GTE` | 95W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 650W đáp ứng khuyến nghị tối thiểu (350W) cho GPU GTX 1650 / RX 6400 (TDP 95W). |
| 1668 | Nguồn 650W ↔ GPU TDP 120W (RTX 3050 / GTX 1660S) | 650W | `GTE` | 120W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 650W đáp ứng khuyến nghị tối thiểu (450W) cho GPU RTX 3050 / GTX 1660S (TDP 120W). |
| 1669 | Nguồn 650W ↔ GPU TDP 150W (RTX 4060 / RX 6600) | 650W | `GTE` | 150W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 650W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 / RX 6600 (TDP 150W). |
| 1670 | Nguồn 650W ↔ GPU TDP 160W (RTX 4060 Ti / RX 7600) | 650W | `GTE` | 160W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 650W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 Ti / RX 7600 (TDP 160W). |
| 1671 | Nguồn 650W ↔ GPU TDP 200W (RTX 4070 / RTX 3060Ti) | 650W | `GTE` | 200W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 650W đáp ứng khuyến nghị tối thiểu (550W) cho GPU RTX 4070 / RTX 3060Ti (TDP 200W). |
| 1672 | Nguồn 650W ↔ GPU TDP 220W (RTX 3070 / RX 7700XT) | 650W | `GTE` | 220W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 650W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 3070 / RX 7700XT (TDP 220W). |
| 1673 | Nguồn 650W ↔ GPU TDP 250W (RTX 4070 Ti / RX 6800) | 650W | `GTE` | 250W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 650W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 4070 Ti / RX 6800 (TDP 250W). |
| 1674 | Nguồn 650W ↔ GPU TDP 260W (RTX 3080 / RTX 5070 / RX 7800XT) | 650W | `LT` | 260W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 650W không đủ công suất cho card đồ họa RTX 3080 / RTX 5070 / RX 7800XT (TDP 260W, yêu cầu tối thiểu 700W). Nguy cơ sập nguồn khi full tải. |
| 1675 | Nguồn 650W ↔ GPU TDP 300W (RTX 4070 Ti Super) | 650W | `LT` | 300W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 650W không đủ công suất cho card đồ họa RTX 4070 Ti Super (TDP 300W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn khi full tải. |
| 1676 | Nguồn 650W ↔ GPU TDP 320W (RTX 4080 Super) | 650W | `LT` | 320W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 650W không đủ công suất cho card đồ họa RTX 4080 Super (TDP 320W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn khi full tải. |
| 1677 | Nguồn 650W ↔ GPU TDP 350W (RTX 3090 / RX 7900 XT) | 650W | `LT` | 350W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 650W không đủ công suất cho card đồ họa RTX 3090 / RX 7900 XT (TDP 350W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải. |
| 1678 | Nguồn 650W ↔ GPU TDP 450W (RTX 4090 / RX 7900 XTX) | 650W | `LT` | 450W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 650W không đủ công suất cho card đồ họa RTX 4090 / RX 7900 XTX (TDP 450W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải. |
| 1679 | Nguồn 750W ↔ GPU TDP 95W (GTX 1650 / RX 6400) | 750W | `GTE` | 95W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 750W đáp ứng khuyến nghị tối thiểu (350W) cho GPU GTX 1650 / RX 6400 (TDP 95W). |
| 1680 | Nguồn 750W ↔ GPU TDP 120W (RTX 3050 / GTX 1660S) | 750W | `GTE` | 120W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 750W đáp ứng khuyến nghị tối thiểu (450W) cho GPU RTX 3050 / GTX 1660S (TDP 120W). |
| 1681 | Nguồn 750W ↔ GPU TDP 150W (RTX 4060 / RX 6600) | 750W | `GTE` | 150W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 750W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 / RX 6600 (TDP 150W). |
| 1682 | Nguồn 750W ↔ GPU TDP 160W (RTX 4060 Ti / RX 7600) | 750W | `GTE` | 160W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 750W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 Ti / RX 7600 (TDP 160W). |
| 1683 | Nguồn 750W ↔ GPU TDP 200W (RTX 4070 / RTX 3060Ti) | 750W | `GTE` | 200W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 750W đáp ứng khuyến nghị tối thiểu (550W) cho GPU RTX 4070 / RTX 3060Ti (TDP 200W). |
| 1684 | Nguồn 750W ↔ GPU TDP 220W (RTX 3070 / RX 7700XT) | 750W | `GTE` | 220W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 750W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 3070 / RX 7700XT (TDP 220W). |
| 1685 | Nguồn 750W ↔ GPU TDP 250W (RTX 4070 Ti / RX 6800) | 750W | `GTE` | 250W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 750W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 4070 Ti / RX 6800 (TDP 250W). |
| 1686 | Nguồn 750W ↔ GPU TDP 260W (RTX 3080 / RTX 5070 / RX 7800XT) | 750W | `GTE` | 260W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 750W đáp ứng khuyến nghị tối thiểu (700W) cho GPU RTX 3080 / RTX 5070 / RX 7800XT (TDP 260W). |
| 1687 | Nguồn 750W ↔ GPU TDP 300W (RTX 4070 Ti Super) | 750W | `GTE` | 300W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 750W đáp ứng khuyến nghị tối thiểu (750W) cho GPU RTX 4070 Ti Super (TDP 300W). |
| 1688 | Nguồn 750W ↔ GPU TDP 320W (RTX 4080 Super) | 750W | `GTE` | 320W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 750W đáp ứng khuyến nghị tối thiểu (750W) cho GPU RTX 4080 Super (TDP 320W). |
| 1689 | Nguồn 750W ↔ GPU TDP 350W (RTX 3090 / RX 7900 XT) | 750W | `LT` | 350W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 750W không đủ công suất cho card đồ họa RTX 3090 / RX 7900 XT (TDP 350W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải. |
| 1690 | Nguồn 750W ↔ GPU TDP 450W (RTX 4090 / RX 7900 XTX) | 750W | `LT` | 450W | ❌ Xung đột | CẢNH BÁO THIẾU NGUỒN: Nguồn 750W không đủ công suất cho card đồ họa RTX 4090 / RX 7900 XTX (TDP 450W, yêu cầu tối thiểu 850W). Nguy cơ sập nguồn khi full tải. |
| 1691 | Nguồn 850W ↔ GPU TDP 95W (GTX 1650 / RX 6400) | 850W | `GTE` | 95W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (350W) cho GPU GTX 1650 / RX 6400 (TDP 95W). |
| 1692 | Nguồn 850W ↔ GPU TDP 120W (RTX 3050 / GTX 1660S) | 850W | `GTE` | 120W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (450W) cho GPU RTX 3050 / GTX 1660S (TDP 120W). |
| 1693 | Nguồn 850W ↔ GPU TDP 150W (RTX 4060 / RX 6600) | 850W | `GTE` | 150W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 / RX 6600 (TDP 150W). |
| 1694 | Nguồn 850W ↔ GPU TDP 160W (RTX 4060 Ti / RX 7600) | 850W | `GTE` | 160W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 Ti / RX 7600 (TDP 160W). |
| 1695 | Nguồn 850W ↔ GPU TDP 200W (RTX 4070 / RTX 3060Ti) | 850W | `GTE` | 200W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (550W) cho GPU RTX 4070 / RTX 3060Ti (TDP 200W). |
| 1696 | Nguồn 850W ↔ GPU TDP 220W (RTX 3070 / RX 7700XT) | 850W | `GTE` | 220W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 3070 / RX 7700XT (TDP 220W). |
| 1697 | Nguồn 850W ↔ GPU TDP 250W (RTX 4070 Ti / RX 6800) | 850W | `GTE` | 250W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 4070 Ti / RX 6800 (TDP 250W). |
| 1698 | Nguồn 850W ↔ GPU TDP 260W (RTX 3080 / RTX 5070 / RX 7800XT) | 850W | `GTE` | 260W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (700W) cho GPU RTX 3080 / RTX 5070 / RX 7800XT (TDP 260W). |
| 1699 | Nguồn 850W ↔ GPU TDP 300W (RTX 4070 Ti Super) | 850W | `GTE` | 300W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (750W) cho GPU RTX 4070 Ti Super (TDP 300W). |
| 1700 | Nguồn 850W ↔ GPU TDP 320W (RTX 4080 Super) | 850W | `GTE` | 320W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (750W) cho GPU RTX 4080 Super (TDP 320W). |
| 1701 | Nguồn 850W ↔ GPU TDP 350W (RTX 3090 / RX 7900 XT) | 850W | `GTE` | 350W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (850W) cho GPU RTX 3090 / RX 7900 XT (TDP 350W). |
| 1702 | Nguồn 850W ↔ GPU TDP 450W (RTX 4090 / RX 7900 XTX) | 850W | `GTE` | 450W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 850W đáp ứng khuyến nghị tối thiểu (850W) cho GPU RTX 4090 / RX 7900 XTX (TDP 450W). |
| 1703 | Nguồn 1000W ↔ GPU TDP 95W (GTX 1650 / RX 6400) | 1000W | `GTE` | 95W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (350W) cho GPU GTX 1650 / RX 6400 (TDP 95W). |
| 1704 | Nguồn 1000W ↔ GPU TDP 120W (RTX 3050 / GTX 1660S) | 1000W | `GTE` | 120W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (450W) cho GPU RTX 3050 / GTX 1660S (TDP 120W). |
| 1705 | Nguồn 1000W ↔ GPU TDP 150W (RTX 4060 / RX 6600) | 1000W | `GTE` | 150W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 / RX 6600 (TDP 150W). |
| 1706 | Nguồn 1000W ↔ GPU TDP 160W (RTX 4060 Ti / RX 7600) | 1000W | `GTE` | 160W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 Ti / RX 7600 (TDP 160W). |
| 1707 | Nguồn 1000W ↔ GPU TDP 200W (RTX 4070 / RTX 3060Ti) | 1000W | `GTE` | 200W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (550W) cho GPU RTX 4070 / RTX 3060Ti (TDP 200W). |
| 1708 | Nguồn 1000W ↔ GPU TDP 220W (RTX 3070 / RX 7700XT) | 1000W | `GTE` | 220W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 3070 / RX 7700XT (TDP 220W). |
| 1709 | Nguồn 1000W ↔ GPU TDP 250W (RTX 4070 Ti / RX 6800) | 1000W | `GTE` | 250W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 4070 Ti / RX 6800 (TDP 250W). |
| 1710 | Nguồn 1000W ↔ GPU TDP 260W (RTX 3080 / RTX 5070 / RX 7800XT) | 1000W | `GTE` | 260W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (700W) cho GPU RTX 3080 / RTX 5070 / RX 7800XT (TDP 260W). |
| 1711 | Nguồn 1000W ↔ GPU TDP 300W (RTX 4070 Ti Super) | 1000W | `GTE` | 300W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (750W) cho GPU RTX 4070 Ti Super (TDP 300W). |
| 1712 | Nguồn 1000W ↔ GPU TDP 320W (RTX 4080 Super) | 1000W | `GTE` | 320W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (750W) cho GPU RTX 4080 Super (TDP 320W). |
| 1713 | Nguồn 1000W ↔ GPU TDP 350W (RTX 3090 / RX 7900 XT) | 1000W | `GTE` | 350W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (850W) cho GPU RTX 3090 / RX 7900 XT (TDP 350W). |
| 1714 | Nguồn 1000W ↔ GPU TDP 450W (RTX 4090 / RX 7900 XTX) | 1000W | `GTE` | 450W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1000W đáp ứng khuyến nghị tối thiểu (850W) cho GPU RTX 4090 / RX 7900 XTX (TDP 450W). |
| 1715 | Nguồn 1200W ↔ GPU TDP 95W (GTX 1650 / RX 6400) | 1200W | `GTE` | 95W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (350W) cho GPU GTX 1650 / RX 6400 (TDP 95W). |
| 1716 | Nguồn 1200W ↔ GPU TDP 120W (RTX 3050 / GTX 1660S) | 1200W | `GTE` | 120W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (450W) cho GPU RTX 3050 / GTX 1660S (TDP 120W). |
| 1717 | Nguồn 1200W ↔ GPU TDP 150W (RTX 4060 / RX 6600) | 1200W | `GTE` | 150W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 / RX 6600 (TDP 150W). |
| 1718 | Nguồn 1200W ↔ GPU TDP 160W (RTX 4060 Ti / RX 7600) | 1200W | `GTE` | 160W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 Ti / RX 7600 (TDP 160W). |
| 1719 | Nguồn 1200W ↔ GPU TDP 200W (RTX 4070 / RTX 3060Ti) | 1200W | `GTE` | 200W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (550W) cho GPU RTX 4070 / RTX 3060Ti (TDP 200W). |
| 1720 | Nguồn 1200W ↔ GPU TDP 220W (RTX 3070 / RX 7700XT) | 1200W | `GTE` | 220W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 3070 / RX 7700XT (TDP 220W). |
| 1721 | Nguồn 1200W ↔ GPU TDP 250W (RTX 4070 Ti / RX 6800) | 1200W | `GTE` | 250W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 4070 Ti / RX 6800 (TDP 250W). |
| 1722 | Nguồn 1200W ↔ GPU TDP 260W (RTX 3080 / RTX 5070 / RX 7800XT) | 1200W | `GTE` | 260W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (700W) cho GPU RTX 3080 / RTX 5070 / RX 7800XT (TDP 260W). |
| 1723 | Nguồn 1200W ↔ GPU TDP 300W (RTX 4070 Ti Super) | 1200W | `GTE` | 300W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (750W) cho GPU RTX 4070 Ti Super (TDP 300W). |
| 1724 | Nguồn 1200W ↔ GPU TDP 320W (RTX 4080 Super) | 1200W | `GTE` | 320W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (750W) cho GPU RTX 4080 Super (TDP 320W). |
| 1725 | Nguồn 1200W ↔ GPU TDP 350W (RTX 3090 / RX 7900 XT) | 1200W | `GTE` | 350W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (850W) cho GPU RTX 3090 / RX 7900 XT (TDP 350W). |
| 1726 | Nguồn 1200W ↔ GPU TDP 450W (RTX 4090 / RX 7900 XTX) | 1200W | `GTE` | 450W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1200W đáp ứng khuyến nghị tối thiểu (850W) cho GPU RTX 4090 / RX 7900 XTX (TDP 450W). |
| 1727 | Nguồn 1600W ↔ GPU TDP 95W (GTX 1650 / RX 6400) | 1600W | `GTE` | 95W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (350W) cho GPU GTX 1650 / RX 6400 (TDP 95W). |
| 1728 | Nguồn 1600W ↔ GPU TDP 120W (RTX 3050 / GTX 1660S) | 1600W | `GTE` | 120W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (450W) cho GPU RTX 3050 / GTX 1660S (TDP 120W). |
| 1729 | Nguồn 1600W ↔ GPU TDP 150W (RTX 4060 / RX 6600) | 1600W | `GTE` | 150W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 / RX 6600 (TDP 150W). |
| 1730 | Nguồn 1600W ↔ GPU TDP 160W (RTX 4060 Ti / RX 7600) | 1600W | `GTE` | 160W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (500W) cho GPU RTX 4060 Ti / RX 7600 (TDP 160W). |
| 1731 | Nguồn 1600W ↔ GPU TDP 200W (RTX 4070 / RTX 3060Ti) | 1600W | `GTE` | 200W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (550W) cho GPU RTX 4070 / RTX 3060Ti (TDP 200W). |
| 1732 | Nguồn 1600W ↔ GPU TDP 220W (RTX 3070 / RX 7700XT) | 1600W | `GTE` | 220W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 3070 / RX 7700XT (TDP 220W). |
| 1733 | Nguồn 1600W ↔ GPU TDP 250W (RTX 4070 Ti / RX 6800) | 1600W | `GTE` | 250W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (650W) cho GPU RTX 4070 Ti / RX 6800 (TDP 250W). |
| 1734 | Nguồn 1600W ↔ GPU TDP 260W (RTX 3080 / RTX 5070 / RX 7800XT) | 1600W | `GTE` | 260W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (700W) cho GPU RTX 3080 / RTX 5070 / RX 7800XT (TDP 260W). |
| 1735 | Nguồn 1600W ↔ GPU TDP 300W (RTX 4070 Ti Super) | 1600W | `GTE` | 300W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (750W) cho GPU RTX 4070 Ti Super (TDP 300W). |
| 1736 | Nguồn 1600W ↔ GPU TDP 320W (RTX 4080 Super) | 1600W | `GTE` | 320W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (750W) cho GPU RTX 4080 Super (TDP 320W). |
| 1737 | Nguồn 1600W ↔ GPU TDP 350W (RTX 3090 / RX 7900 XT) | 1600W | `GTE` | 350W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (850W) cho GPU RTX 3090 / RX 7900 XT (TDP 350W). |
| 1738 | Nguồn 1600W ↔ GPU TDP 450W (RTX 4090 / RX 7900 XTX) | 1600W | `GTE` | 450W | ✅ Hợp lệ | TƯƠNG THÍCH: Nguồn công suất 1600W đáp ứng khuyến nghị tối thiểu (850W) cho GPU RTX 4090 / RX 7900 XTX (TDP 450W). |
| 1764 | Nguồn 350W ↔ CPU TDP 65W (CPU Non-K / Ryzen 5) | 350W | `GTE` | 65W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 350W đáp ứng đường 12V EPS và công suất ổn định cho CPU Non-K / Ryzen 5 (TDP 65W). |
| 1765 | Nguồn 350W ↔ CPU TDP 105W (Ryzen 7 / Core i7 Non-K) | 350W | `LT` | 105W | ❌ Xung đột | CẢNH BÁO CÔNG SUẤT: Nguồn 350W quá yếu cho Ryzen 7 / Core i7 Non-K (TDP 105W, yêu cầu tối thiểu 450W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM. |
| 1766 | Nguồn 350W ↔ CPU TDP 125W (Intel K-series / Ryzen 9) | 350W | `LT` | 125W | ❌ Xung đột | CẢNH BÁO CÔNG SUẤT: Nguồn 350W quá yếu cho Intel K-series / Ryzen 9 (TDP 125W, yêu cầu tối thiểu 500W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM. |
| 1767 | Nguồn 350W ↔ CPU TDP 170W (Ryzen 7950X / 7900X Extreme) | 350W | `LT` | 170W | ❌ Xung đột | CẢNH BÁO CÔNG SUẤT: Nguồn 350W quá yếu cho Ryzen 7950X / 7900X Extreme (TDP 170W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM. |
| 1768 | Nguồn 350W ↔ CPU TDP 200W (Core i7-14700K Boost PL2) | 350W | `LT` | 200W | ❌ Xung đột | CẢNH BÁO CÔNG SUẤT: Nguồn 350W quá yếu cho Core i7-14700K Boost PL2 (TDP 200W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM. |
| 1769 | Nguồn 350W ↔ CPU TDP 250W (Core i9-14900K Unlimited PL2) | 350W | `LT` | 250W | ❌ Xung đột | CẢNH BÁO CÔNG SUẤT: Nguồn 350W quá yếu cho Core i9-14900K Unlimited PL2 (TDP 250W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM. |
| 1770 | Nguồn 450W ↔ CPU TDP 65W (CPU Non-K / Ryzen 5) | 450W | `GTE` | 65W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 450W đáp ứng đường 12V EPS và công suất ổn định cho CPU Non-K / Ryzen 5 (TDP 65W). |
| 1771 | Nguồn 450W ↔ CPU TDP 105W (Ryzen 7 / Core i7 Non-K) | 450W | `GTE` | 105W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 450W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7 / Core i7 Non-K (TDP 105W). |
| 1772 | Nguồn 450W ↔ CPU TDP 125W (Intel K-series / Ryzen 9) | 450W | `LT` | 125W | ❌ Xung đột | CẢNH BÁO CÔNG SUẤT: Nguồn 450W quá yếu cho Intel K-series / Ryzen 9 (TDP 125W, yêu cầu tối thiểu 500W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM. |
| 1773 | Nguồn 450W ↔ CPU TDP 170W (Ryzen 7950X / 7900X Extreme) | 450W | `LT` | 170W | ❌ Xung đột | CẢNH BÁO CÔNG SUẤT: Nguồn 450W quá yếu cho Ryzen 7950X / 7900X Extreme (TDP 170W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM. |
| 1774 | Nguồn 450W ↔ CPU TDP 200W (Core i7-14700K Boost PL2) | 450W | `LT` | 200W | ❌ Xung đột | CẢNH BÁO CÔNG SUẤT: Nguồn 450W quá yếu cho Core i7-14700K Boost PL2 (TDP 200W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM. |
| 1775 | Nguồn 450W ↔ CPU TDP 250W (Core i9-14900K Unlimited PL2) | 450W | `LT` | 250W | ❌ Xung đột | CẢNH BÁO CÔNG SUẤT: Nguồn 450W quá yếu cho Core i9-14900K Unlimited PL2 (TDP 250W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM. |
| 1776 | Nguồn 500W ↔ CPU TDP 65W (CPU Non-K / Ryzen 5) | 500W | `GTE` | 65W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 500W đáp ứng đường 12V EPS và công suất ổn định cho CPU Non-K / Ryzen 5 (TDP 65W). |
| 1777 | Nguồn 500W ↔ CPU TDP 105W (Ryzen 7 / Core i7 Non-K) | 500W | `GTE` | 105W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 500W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7 / Core i7 Non-K (TDP 105W). |
| 1778 | Nguồn 500W ↔ CPU TDP 125W (Intel K-series / Ryzen 9) | 500W | `GTE` | 125W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 500W đáp ứng đường 12V EPS và công suất ổn định cho Intel K-series / Ryzen 9 (TDP 125W). |
| 1779 | Nguồn 500W ↔ CPU TDP 170W (Ryzen 7950X / 7900X Extreme) | 500W | `LT` | 170W | ❌ Xung đột | CẢNH BÁO CÔNG SUẤT: Nguồn 500W quá yếu cho Ryzen 7950X / 7900X Extreme (TDP 170W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM. |
| 1780 | Nguồn 500W ↔ CPU TDP 200W (Core i7-14700K Boost PL2) | 500W | `LT` | 200W | ❌ Xung đột | CẢNH BÁO CÔNG SUẤT: Nguồn 500W quá yếu cho Core i7-14700K Boost PL2 (TDP 200W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM. |
| 1781 | Nguồn 500W ↔ CPU TDP 250W (Core i9-14900K Unlimited PL2) | 500W | `LT` | 250W | ❌ Xung đột | CẢNH BÁO CÔNG SUẤT: Nguồn 500W quá yếu cho Core i9-14900K Unlimited PL2 (TDP 250W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM. |
| 1782 | Nguồn 550W ↔ CPU TDP 65W (CPU Non-K / Ryzen 5) | 550W | `GTE` | 65W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 550W đáp ứng đường 12V EPS và công suất ổn định cho CPU Non-K / Ryzen 5 (TDP 65W). |
| 1783 | Nguồn 550W ↔ CPU TDP 105W (Ryzen 7 / Core i7 Non-K) | 550W | `GTE` | 105W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 550W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7 / Core i7 Non-K (TDP 105W). |
| 1784 | Nguồn 550W ↔ CPU TDP 125W (Intel K-series / Ryzen 9) | 550W | `GTE` | 125W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 550W đáp ứng đường 12V EPS và công suất ổn định cho Intel K-series / Ryzen 9 (TDP 125W). |
| 1785 | Nguồn 550W ↔ CPU TDP 170W (Ryzen 7950X / 7900X Extreme) | 550W | `LT` | 170W | ❌ Xung đột | CẢNH BÁO CÔNG SUẤT: Nguồn 550W quá yếu cho Ryzen 7950X / 7900X Extreme (TDP 170W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM. |
| 1786 | Nguồn 550W ↔ CPU TDP 200W (Core i7-14700K Boost PL2) | 550W | `LT` | 200W | ❌ Xung đột | CẢNH BÁO CÔNG SUẤT: Nguồn 550W quá yếu cho Core i7-14700K Boost PL2 (TDP 200W, yêu cầu tối thiểu 650W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM. |
| 1787 | Nguồn 550W ↔ CPU TDP 250W (Core i9-14900K Unlimited PL2) | 550W | `LT` | 250W | ❌ Xung đột | CẢNH BÁO CÔNG SUẤT: Nguồn 550W quá yếu cho Core i9-14900K Unlimited PL2 (TDP 250W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM. |
| 1788 | Nguồn 650W ↔ CPU TDP 65W (CPU Non-K / Ryzen 5) | 650W | `GTE` | 65W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 650W đáp ứng đường 12V EPS và công suất ổn định cho CPU Non-K / Ryzen 5 (TDP 65W). |
| 1789 | Nguồn 650W ↔ CPU TDP 105W (Ryzen 7 / Core i7 Non-K) | 650W | `GTE` | 105W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 650W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7 / Core i7 Non-K (TDP 105W). |
| 1790 | Nguồn 650W ↔ CPU TDP 125W (Intel K-series / Ryzen 9) | 650W | `GTE` | 125W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 650W đáp ứng đường 12V EPS và công suất ổn định cho Intel K-series / Ryzen 9 (TDP 125W). |
| 1791 | Nguồn 650W ↔ CPU TDP 170W (Ryzen 7950X / 7900X Extreme) | 650W | `GTE` | 170W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 650W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7950X / 7900X Extreme (TDP 170W). |
| 1792 | Nguồn 650W ↔ CPU TDP 200W (Core i7-14700K Boost PL2) | 650W | `GTE` | 200W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 650W đáp ứng đường 12V EPS và công suất ổn định cho Core i7-14700K Boost PL2 (TDP 200W). |
| 1793 | Nguồn 650W ↔ CPU TDP 250W (Core i9-14900K Unlimited PL2) | 650W | `LT` | 250W | ❌ Xung đột | CẢNH BÁO CÔNG SUẤT: Nguồn 650W quá yếu cho Core i9-14900K Unlimited PL2 (TDP 250W, yêu cầu tối thiểu 750W). Nguy cơ sập nguồn hoặc quá nhiệt dàn VRM. |
| 1794 | Nguồn 750W ↔ CPU TDP 65W (CPU Non-K / Ryzen 5) | 750W | `GTE` | 65W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 750W đáp ứng đường 12V EPS và công suất ổn định cho CPU Non-K / Ryzen 5 (TDP 65W). |
| 1795 | Nguồn 750W ↔ CPU TDP 105W (Ryzen 7 / Core i7 Non-K) | 750W | `GTE` | 105W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 750W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7 / Core i7 Non-K (TDP 105W). |
| 1796 | Nguồn 750W ↔ CPU TDP 125W (Intel K-series / Ryzen 9) | 750W | `GTE` | 125W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 750W đáp ứng đường 12V EPS và công suất ổn định cho Intel K-series / Ryzen 9 (TDP 125W). |
| 1797 | Nguồn 750W ↔ CPU TDP 170W (Ryzen 7950X / 7900X Extreme) | 750W | `GTE` | 170W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 750W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7950X / 7900X Extreme (TDP 170W). |
| 1798 | Nguồn 750W ↔ CPU TDP 200W (Core i7-14700K Boost PL2) | 750W | `GTE` | 200W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 750W đáp ứng đường 12V EPS và công suất ổn định cho Core i7-14700K Boost PL2 (TDP 200W). |
| 1799 | Nguồn 750W ↔ CPU TDP 250W (Core i9-14900K Unlimited PL2) | 750W | `GTE` | 250W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 750W đáp ứng đường 12V EPS và công suất ổn định cho Core i9-14900K Unlimited PL2 (TDP 250W). |
| 1800 | Nguồn 850W ↔ CPU TDP 65W (CPU Non-K / Ryzen 5) | 850W | `GTE` | 65W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 850W đáp ứng đường 12V EPS và công suất ổn định cho CPU Non-K / Ryzen 5 (TDP 65W). |
| 1801 | Nguồn 850W ↔ CPU TDP 105W (Ryzen 7 / Core i7 Non-K) | 850W | `GTE` | 105W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 850W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7 / Core i7 Non-K (TDP 105W). |
| 1802 | Nguồn 850W ↔ CPU TDP 125W (Intel K-series / Ryzen 9) | 850W | `GTE` | 125W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 850W đáp ứng đường 12V EPS và công suất ổn định cho Intel K-series / Ryzen 9 (TDP 125W). |
| 1803 | Nguồn 850W ↔ CPU TDP 170W (Ryzen 7950X / 7900X Extreme) | 850W | `GTE` | 170W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 850W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7950X / 7900X Extreme (TDP 170W). |
| 1804 | Nguồn 850W ↔ CPU TDP 200W (Core i7-14700K Boost PL2) | 850W | `GTE` | 200W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 850W đáp ứng đường 12V EPS và công suất ổn định cho Core i7-14700K Boost PL2 (TDP 200W). |
| 1805 | Nguồn 850W ↔ CPU TDP 250W (Core i9-14900K Unlimited PL2) | 850W | `GTE` | 250W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 850W đáp ứng đường 12V EPS và công suất ổn định cho Core i9-14900K Unlimited PL2 (TDP 250W). |
| 1806 | Nguồn 1000W ↔ CPU TDP 65W (CPU Non-K / Ryzen 5) | 1000W | `GTE` | 65W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 1000W đáp ứng đường 12V EPS và công suất ổn định cho CPU Non-K / Ryzen 5 (TDP 65W). |
| 1807 | Nguồn 1000W ↔ CPU TDP 105W (Ryzen 7 / Core i7 Non-K) | 1000W | `GTE` | 105W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 1000W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7 / Core i7 Non-K (TDP 105W). |
| 1808 | Nguồn 1000W ↔ CPU TDP 125W (Intel K-series / Ryzen 9) | 1000W | `GTE` | 125W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 1000W đáp ứng đường 12V EPS và công suất ổn định cho Intel K-series / Ryzen 9 (TDP 125W). |
| 1809 | Nguồn 1000W ↔ CPU TDP 170W (Ryzen 7950X / 7900X Extreme) | 1000W | `GTE` | 170W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 1000W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7950X / 7900X Extreme (TDP 170W). |
| 1810 | Nguồn 1000W ↔ CPU TDP 200W (Core i7-14700K Boost PL2) | 1000W | `GTE` | 200W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 1000W đáp ứng đường 12V EPS và công suất ổn định cho Core i7-14700K Boost PL2 (TDP 200W). |
| 1811 | Nguồn 1000W ↔ CPU TDP 250W (Core i9-14900K Unlimited PL2) | 1000W | `GTE` | 250W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 1000W đáp ứng đường 12V EPS và công suất ổn định cho Core i9-14900K Unlimited PL2 (TDP 250W). |
| 1812 | Nguồn 1200W ↔ CPU TDP 65W (CPU Non-K / Ryzen 5) | 1200W | `GTE` | 65W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 1200W đáp ứng đường 12V EPS và công suất ổn định cho CPU Non-K / Ryzen 5 (TDP 65W). |
| 1813 | Nguồn 1200W ↔ CPU TDP 105W (Ryzen 7 / Core i7 Non-K) | 1200W | `GTE` | 105W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 1200W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7 / Core i7 Non-K (TDP 105W). |
| 1814 | Nguồn 1200W ↔ CPU TDP 125W (Intel K-series / Ryzen 9) | 1200W | `GTE` | 125W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 1200W đáp ứng đường 12V EPS và công suất ổn định cho Intel K-series / Ryzen 9 (TDP 125W). |
| 1815 | Nguồn 1200W ↔ CPU TDP 170W (Ryzen 7950X / 7900X Extreme) | 1200W | `GTE` | 170W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 1200W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7950X / 7900X Extreme (TDP 170W). |
| 1816 | Nguồn 1200W ↔ CPU TDP 200W (Core i7-14700K Boost PL2) | 1200W | `GTE` | 200W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 1200W đáp ứng đường 12V EPS và công suất ổn định cho Core i7-14700K Boost PL2 (TDP 200W). |
| 1817 | Nguồn 1200W ↔ CPU TDP 250W (Core i9-14900K Unlimited PL2) | 1200W | `GTE` | 250W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 1200W đáp ứng đường 12V EPS và công suất ổn định cho Core i9-14900K Unlimited PL2 (TDP 250W). |
| 1818 | Nguồn 1600W ↔ CPU TDP 65W (CPU Non-K / Ryzen 5) | 1600W | `GTE` | 65W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 1600W đáp ứng đường 12V EPS và công suất ổn định cho CPU Non-K / Ryzen 5 (TDP 65W). |
| 1819 | Nguồn 1600W ↔ CPU TDP 105W (Ryzen 7 / Core i7 Non-K) | 1600W | `GTE` | 105W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 1600W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7 / Core i7 Non-K (TDP 105W). |
| 1820 | Nguồn 1600W ↔ CPU TDP 125W (Intel K-series / Ryzen 9) | 1600W | `GTE` | 125W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 1600W đáp ứng đường 12V EPS và công suất ổn định cho Intel K-series / Ryzen 9 (TDP 125W). |
| 1821 | Nguồn 1600W ↔ CPU TDP 170W (Ryzen 7950X / 7900X Extreme) | 1600W | `GTE` | 170W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 1600W đáp ứng đường 12V EPS và công suất ổn định cho Ryzen 7950X / 7900X Extreme (TDP 170W). |
| 1822 | Nguồn 1600W ↔ CPU TDP 200W (Core i7-14700K Boost PL2) | 1600W | `GTE` | 200W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 1600W đáp ứng đường 12V EPS và công suất ổn định cho Core i7-14700K Boost PL2 (TDP 200W). |
| 1823 | Nguồn 1600W ↔ CPU TDP 250W (Core i9-14900K Unlimited PL2) | 1600W | `GTE` | 250W | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nguồn 1600W đáp ứng đường 12V EPS và công suất ổn định cho Core i9-14900K Unlimited PL2 (TDP 250W). |

### Nhóm Quy Tắc: RADIATOR_SIZE ↔ CASE_RADIATOR_SUPPORT (25 quy tắc)

| ID | Tên Quy Tắc | Giá Trị Nguồn | Toán Tử | Giá Trị Đích | Tương Thích | Mô Tả Chi Tiết |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| 1462 | Radiator AIO 120mm ↔ Case hỗ trợ 120mm | 120mm | `LTE` | 120mm | ✅ Hợp lệ | TƯƠNG THÍCH: Két nước tản AIO 120mm lắp đặt vừa vặn với khoang hỗ trợ rad 120mm của case. |
| 1463 | Radiator AIO 120mm ↔ Case hỗ trợ 240mm | 120mm | `LTE` | 240mm | ✅ Hợp lệ | TƯƠNG THÍCH: Két nước tản AIO 120mm lắp đặt vừa vặn với khoang hỗ trợ rad 240mm của case. |
| 1464 | Radiator AIO 120mm ↔ Case hỗ trợ 280mm | 120mm | `LTE` | 280mm | ✅ Hợp lệ | TƯƠNG THÍCH: Két nước tản AIO 120mm lắp đặt vừa vặn với khoang hỗ trợ rad 280mm của case. |
| 1465 | Radiator AIO 120mm ↔ Case hỗ trợ 360mm | 120mm | `LTE` | 360mm | ✅ Hợp lệ | TƯƠNG THÍCH: Két nước tản AIO 120mm lắp đặt vừa vặn với khoang hỗ trợ rad 360mm của case. |
| 1466 | Radiator AIO 120mm ↔ Case hỗ trợ 420mm | 120mm | `LTE` | 420mm | ✅ Hợp lệ | TƯƠNG THÍCH: Két nước tản AIO 120mm lắp đặt vừa vặn với khoang hỗ trợ rad 420mm của case. |
| 1467 | Radiator AIO 240mm ↔ Case hỗ trợ 120mm | 240mm | `GT` | 120mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Két làm mát 240mm quá dài, khoang case tối đa chỉ hỗ trợ 120mm. |
| 1468 | Radiator AIO 240mm ↔ Case hỗ trợ 240mm | 240mm | `LTE` | 240mm | ✅ Hợp lệ | TƯƠNG THÍCH: Két nước tản AIO 240mm lắp đặt vừa vặn với khoang hỗ trợ rad 240mm của case. |
| 1469 | Radiator AIO 240mm ↔ Case hỗ trợ 280mm | 240mm | `LTE` | 280mm | ✅ Hợp lệ | TƯƠNG THÍCH: Két nước tản AIO 240mm lắp đặt vừa vặn với khoang hỗ trợ rad 280mm của case. |
| 1470 | Radiator AIO 240mm ↔ Case hỗ trợ 360mm | 240mm | `LTE` | 360mm | ✅ Hợp lệ | TƯƠNG THÍCH: Két nước tản AIO 240mm lắp đặt vừa vặn với khoang hỗ trợ rad 360mm của case. |
| 1471 | Radiator AIO 240mm ↔ Case hỗ trợ 420mm | 240mm | `LTE` | 420mm | ✅ Hợp lệ | TƯƠNG THÍCH: Két nước tản AIO 240mm lắp đặt vừa vặn với khoang hỗ trợ rad 420mm của case. |
| 1472 | Radiator AIO 280mm ↔ Case hỗ trợ 120mm | 280mm | `GT` | 120mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Két làm mát 280mm quá dài, khoang case tối đa chỉ hỗ trợ 120mm. |
| 1473 | Radiator AIO 280mm ↔ Case hỗ trợ 240mm | 280mm | `GT` | 240mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Két làm mát 280mm quá dài, khoang case tối đa chỉ hỗ trợ 240mm. |
| 1474 | Radiator AIO 280mm ↔ Case hỗ trợ 280mm | 280mm | `LTE` | 280mm | ✅ Hợp lệ | TƯƠNG THÍCH: Két nước tản AIO 280mm lắp đặt vừa vặn với khoang hỗ trợ rad 280mm của case. |
| 1475 | Radiator AIO 280mm ↔ Case hỗ trợ 360mm | 280mm | `LTE` | 360mm | ✅ Hợp lệ | TƯƠNG THÍCH: Két nước tản AIO 280mm lắp đặt vừa vặn với khoang hỗ trợ rad 360mm của case. |
| 1476 | Radiator AIO 280mm ↔ Case hỗ trợ 420mm | 280mm | `LTE` | 420mm | ✅ Hợp lệ | TƯƠNG THÍCH: Két nước tản AIO 280mm lắp đặt vừa vặn với khoang hỗ trợ rad 420mm của case. |
| 1477 | Radiator AIO 360mm ↔ Case hỗ trợ 120mm | 360mm | `GT` | 120mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Két làm mát 360mm quá dài, khoang case tối đa chỉ hỗ trợ 120mm. |
| 1478 | Radiator AIO 360mm ↔ Case hỗ trợ 240mm | 360mm | `GT` | 240mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Két làm mát 360mm quá dài, khoang case tối đa chỉ hỗ trợ 240mm. |
| 1479 | Radiator AIO 360mm ↔ Case hỗ trợ 280mm | 360mm | `GT` | 280mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Két làm mát 360mm quá dài, khoang case tối đa chỉ hỗ trợ 280mm. |
| 1480 | Radiator AIO 360mm ↔ Case hỗ trợ 360mm | 360mm | `LTE` | 360mm | ✅ Hợp lệ | TƯƠNG THÍCH: Két nước tản AIO 360mm lắp đặt vừa vặn với khoang hỗ trợ rad 360mm của case. |
| 1481 | Radiator AIO 360mm ↔ Case hỗ trợ 420mm | 360mm | `LTE` | 420mm | ✅ Hợp lệ | TƯƠNG THÍCH: Két nước tản AIO 360mm lắp đặt vừa vặn với khoang hỗ trợ rad 420mm của case. |
| 1482 | Radiator AIO 420mm ↔ Case hỗ trợ 120mm | 420mm | `GT` | 120mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Két làm mát 420mm quá dài, khoang case tối đa chỉ hỗ trợ 120mm. |
| 1483 | Radiator AIO 420mm ↔ Case hỗ trợ 240mm | 420mm | `GT` | 240mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Két làm mát 420mm quá dài, khoang case tối đa chỉ hỗ trợ 240mm. |
| 1484 | Radiator AIO 420mm ↔ Case hỗ trợ 280mm | 420mm | `GT` | 280mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Két làm mát 420mm quá dài, khoang case tối đa chỉ hỗ trợ 280mm. |
| 1485 | Radiator AIO 420mm ↔ Case hỗ trợ 360mm | 420mm | `GT` | 360mm | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Két làm mát 420mm quá dài, khoang case tối đa chỉ hỗ trợ 360mm. |
| 1486 | Radiator AIO 420mm ↔ Case hỗ trợ 420mm | 420mm | `LTE` | 420mm | ✅ Hợp lệ | TƯƠNG THÍCH: Két nước tản AIO 420mm lắp đặt vừa vặn với khoang hỗ trợ rad 420mm của case. |

### Nhóm Quy Tắc: RAM_STICKS_COUNT ↔ DDR5_IMC_SUPPORT (1 quy tắc)

| ID | Tên Quy Tắc | Giá Trị Nguồn | Toán Tử | Giá Trị Đích | Tương Thích | Mô Tả Chi Tiết |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| 1851 | RULE-MULTI-004: RAM DDR5 Quad-Stick Bus Stability Limit | ram_sticks_count | `LTE` | ddr5_imc_support | ❌ Xung đột | GIỚI HẠN TẦN SỐ DDR5: Chạy 4 thanh RAM DDR5 ở mức bus cao >6000MHz thường vượt quá khả năng ổn định của bộ điều khiển bộ nhớ (IMC) trên CPU/Mainboard phổ thông. Khuyến nghị ưu tiên kit 2 thanh Dual-Channel (2x16GB hoặc 2x32GB) để đạt xung nhịp tối đa ổn định 100%. |

### Nhóm Quy Tắc: RAM_TYPE ↔ RAM_TYPE (9 quy tắc)

| ID | Tên Quy Tắc | Giá Trị Nguồn | Toán Tử | Giá Trị Đích | Tương Thích | Mô Tả Chi Tiết |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| 1437 | RAM DDR5 ↔ Mainboard DDR5 | DDR5 | `EQ` | DDR5 | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nhớ RAM DDR5 tương thích chuẩn với khe cắm DDR5 trên bo mạch chủ. |
| 1438 | RAM DDR5 ↔ Mainboard DDR4 | DDR5 | `NEQ` | DDR4 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: RAM DDR5 có rãnh khóa (notch) và điện áp khác biệt, không thể cắm vào khe DDR4. |
| 1439 | RAM DDR5 ↔ Mainboard DDR3 | DDR5 | `NEQ` | DDR3 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: RAM DDR5 có rãnh khóa (notch) và điện áp khác biệt, không thể cắm vào khe DDR3. |
| 1440 | RAM DDR4 ↔ Mainboard DDR5 | DDR4 | `NEQ` | DDR5 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: RAM DDR4 có rãnh khóa (notch) và điện áp khác biệt, không thể cắm vào khe DDR5. |
| 1441 | RAM DDR4 ↔ Mainboard DDR4 | DDR4 | `EQ` | DDR4 | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nhớ RAM DDR4 tương thích chuẩn với khe cắm DDR4 trên bo mạch chủ. |
| 1442 | RAM DDR4 ↔ Mainboard DDR3 | DDR4 | `NEQ` | DDR3 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: RAM DDR4 có rãnh khóa (notch) và điện áp khác biệt, không thể cắm vào khe DDR3. |
| 1443 | RAM DDR3 ↔ Mainboard DDR5 | DDR3 | `NEQ` | DDR5 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: RAM DDR3 có rãnh khóa (notch) và điện áp khác biệt, không thể cắm vào khe DDR5. |
| 1444 | RAM DDR3 ↔ Mainboard DDR4 | DDR3 | `NEQ` | DDR4 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: RAM DDR3 có rãnh khóa (notch) và điện áp khác biệt, không thể cắm vào khe DDR4. |
| 1445 | RAM DDR3 ↔ Mainboard DDR3 | DDR3 | `EQ` | DDR3 | ✅ Hợp lệ | TƯƠNG THÍCH: Bộ nhớ RAM DDR3 tương thích chuẩn với khe cắm DDR3 trên bo mạch chủ. |

### Nhóm Quy Tắc: SOCKET ↔ SOCKET (25 quy tắc)

| ID | Tên Quy Tắc | Giá Trị Nguồn | Toán Tử | Giá Trị Đích | Tương Thích | Mô Tả Chi Tiết |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| 1412 | CPU LGA1851 ↔ Mainboard LGA1851 | LGA1851 | `EQ` | LGA1851 | ✅ Hợp lệ | TƯƠNG THÍCH: CPU LGA1851 (Intel Arrow Lake Core Ultra Series 2) tương thích hoàn hảo với Mainboard chuẩn socket LGA1851. |
| 1413 | CPU LGA1851 ↔ Mainboard LGA1700 | LGA1851 | `NEQ` | LGA1700 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: CPU socket LGA1851 không thể lắp vào bo mạch chủ socket LGA1700 do khác biệt cơ học và chân cắm. |
| 1414 | CPU LGA1851 ↔ Mainboard LGA1200 | LGA1851 | `NEQ` | LGA1200 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: CPU socket LGA1851 không thể lắp vào bo mạch chủ socket LGA1200 do khác biệt cơ học và chân cắm. |
| 1415 | CPU LGA1851 ↔ Mainboard AM5 | LGA1851 | `NEQ` | AM5 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: CPU socket LGA1851 không thể lắp vào bo mạch chủ socket AM5 do khác biệt cơ học và chân cắm. |
| 1416 | CPU LGA1851 ↔ Mainboard AM4 | LGA1851 | `NEQ` | AM4 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: CPU socket LGA1851 không thể lắp vào bo mạch chủ socket AM4 do khác biệt cơ học và chân cắm. |
| 1417 | CPU LGA1700 ↔ Mainboard LGA1851 | LGA1700 | `NEQ` | LGA1851 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: CPU socket LGA1700 không thể lắp vào bo mạch chủ socket LGA1851 do khác biệt cơ học và chân cắm. |
| 1418 | CPU LGA1700 ↔ Mainboard LGA1700 | LGA1700 | `EQ` | LGA1700 | ✅ Hợp lệ | TƯƠNG THÍCH: CPU LGA1700 (Intel Gen 12/13/14 Raptor Lake / Alder Lake) tương thích hoàn hảo với Mainboard chuẩn socket LGA1700. |
| 1419 | CPU LGA1700 ↔ Mainboard LGA1200 | LGA1700 | `NEQ` | LGA1200 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: CPU socket LGA1700 không thể lắp vào bo mạch chủ socket LGA1200 do khác biệt cơ học và chân cắm. |
| 1420 | CPU LGA1700 ↔ Mainboard AM5 | LGA1700 | `NEQ` | AM5 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: CPU socket LGA1700 không thể lắp vào bo mạch chủ socket AM5 do khác biệt cơ học và chân cắm. |
| 1421 | CPU LGA1700 ↔ Mainboard AM4 | LGA1700 | `NEQ` | AM4 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: CPU socket LGA1700 không thể lắp vào bo mạch chủ socket AM4 do khác biệt cơ học và chân cắm. |
| 1422 | CPU LGA1200 ↔ Mainboard LGA1851 | LGA1200 | `NEQ` | LGA1851 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: CPU socket LGA1200 không thể lắp vào bo mạch chủ socket LGA1851 do khác biệt cơ học và chân cắm. |
| 1423 | CPU LGA1200 ↔ Mainboard LGA1700 | LGA1200 | `NEQ` | LGA1700 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: CPU socket LGA1200 không thể lắp vào bo mạch chủ socket LGA1700 do khác biệt cơ học và chân cắm. |
| 1424 | CPU LGA1200 ↔ Mainboard LGA1200 | LGA1200 | `EQ` | LGA1200 | ✅ Hợp lệ | TƯƠNG THÍCH: CPU LGA1200 (Intel Gen 10/11 Comet Lake / Rocket Lake) tương thích hoàn hảo với Mainboard chuẩn socket LGA1200. |
| 1425 | CPU LGA1200 ↔ Mainboard AM5 | LGA1200 | `NEQ` | AM5 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: CPU socket LGA1200 không thể lắp vào bo mạch chủ socket AM5 do khác biệt cơ học và chân cắm. |
| 1426 | CPU LGA1200 ↔ Mainboard AM4 | LGA1200 | `NEQ` | AM4 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: CPU socket LGA1200 không thể lắp vào bo mạch chủ socket AM4 do khác biệt cơ học và chân cắm. |
| 1427 | CPU AM5 ↔ Mainboard LGA1851 | AM5 | `NEQ` | LGA1851 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: CPU socket AM5 không thể lắp vào bo mạch chủ socket LGA1851 do khác biệt cơ học và chân cắm. |
| 1428 | CPU AM5 ↔ Mainboard LGA1700 | AM5 | `NEQ` | LGA1700 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: CPU socket AM5 không thể lắp vào bo mạch chủ socket LGA1700 do khác biệt cơ học và chân cắm. |
| 1429 | CPU AM5 ↔ Mainboard LGA1200 | AM5 | `NEQ` | LGA1200 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: CPU socket AM5 không thể lắp vào bo mạch chủ socket LGA1200 do khác biệt cơ học và chân cắm. |
| 1430 | CPU AM5 ↔ Mainboard AM5 | AM5 | `EQ` | AM5 | ✅ Hợp lệ | TƯƠNG THÍCH: CPU AM5 (AMD Ryzen 7000/8000/9000 Series) tương thích hoàn hảo với Mainboard chuẩn socket AM5. |
| 1431 | CPU AM5 ↔ Mainboard AM4 | AM5 | `NEQ` | AM4 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: CPU socket AM5 không thể lắp vào bo mạch chủ socket AM4 do khác biệt cơ học và chân cắm. |
| 1432 | CPU AM4 ↔ Mainboard LGA1851 | AM4 | `NEQ` | LGA1851 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: CPU socket AM4 không thể lắp vào bo mạch chủ socket LGA1851 do khác biệt cơ học và chân cắm. |
| 1433 | CPU AM4 ↔ Mainboard LGA1700 | AM4 | `NEQ` | LGA1700 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: CPU socket AM4 không thể lắp vào bo mạch chủ socket LGA1700 do khác biệt cơ học và chân cắm. |
| 1434 | CPU AM4 ↔ Mainboard LGA1200 | AM4 | `NEQ` | LGA1200 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: CPU socket AM4 không thể lắp vào bo mạch chủ socket LGA1200 do khác biệt cơ học và chân cắm. |
| 1435 | CPU AM4 ↔ Mainboard AM5 | AM4 | `NEQ` | AM5 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: CPU socket AM4 không thể lắp vào bo mạch chủ socket AM5 do khác biệt cơ học và chân cắm. |
| 1436 | CPU AM4 ↔ Mainboard AM4 | AM4 | `EQ` | AM4 | ✅ Hợp lệ | TƯƠNG THÍCH: CPU AM4 (AMD Ryzen 1000/2000/3000/4000/5000 Series) tương thích hoàn hảo với Mainboard chuẩn socket AM4. |

### Nhóm Quy Tắc: SOCKET_SUPPORT ↔ SOCKET (25 quy tắc)

| ID | Tên Quy Tắc | Giá Trị Nguồn | Toán Tử | Giá Trị Đích | Tương Thích | Mô Tả Chi Tiết |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| 1739 | Ngàm tản (LGA1851, LGA1700, AM5, AM4) ↔ CPU LGA1851 | LGA1851, LGA1700, AM5, AM4 | `IN` | LGA1851 | ✅ Hợp lệ | TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket LGA1851 của CPU. |
| 1740 | Ngàm tản (LGA1851, LGA1700, AM5, AM4) ↔ CPU LGA1700 | LGA1851, LGA1700, AM5, AM4 | `IN` | LGA1700 | ✅ Hợp lệ | TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket LGA1700 của CPU. |
| 1741 | Ngàm tản (LGA1851, LGA1700, AM5, AM4) ↔ CPU LGA1200 | LGA1851, LGA1700, AM5, AM4 | `NOT_IN` | LGA1200 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket LGA1200. |
| 1742 | Ngàm tản (LGA1851, LGA1700, AM5, AM4) ↔ CPU AM5 | LGA1851, LGA1700, AM5, AM4 | `IN` | AM5 | ✅ Hợp lệ | TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket AM5 của CPU. |
| 1743 | Ngàm tản (LGA1851, LGA1700, AM5, AM4) ↔ CPU AM4 | LGA1851, LGA1700, AM5, AM4 | `IN` | AM4 | ✅ Hợp lệ | TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket AM4 của CPU. |
| 1744 | Ngàm tản (LGA1200, AM4) ↔ CPU LGA1851 | LGA1200, AM4 | `NOT_IN` | LGA1851 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket LGA1851. |
| 1745 | Ngàm tản (LGA1200, AM4) ↔ CPU LGA1700 | LGA1200, AM4 | `NOT_IN` | LGA1700 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket LGA1700. |
| 1746 | Ngàm tản (LGA1200, AM4) ↔ CPU LGA1200 | LGA1200, AM4 | `IN` | LGA1200 | ✅ Hợp lệ | TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket LGA1200 của CPU. |
| 1747 | Ngàm tản (LGA1200, AM4) ↔ CPU AM5 | LGA1200, AM4 | `NOT_IN` | AM5 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket AM5. |
| 1748 | Ngàm tản (LGA1200, AM4) ↔ CPU AM4 | LGA1200, AM4 | `IN` | AM4 | ✅ Hợp lệ | TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket AM4 của CPU. |
| 1749 | Ngàm tản (LGA1700) ↔ CPU LGA1851 | LGA1700 | `NOT_IN` | LGA1851 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket LGA1851. |
| 1750 | Ngàm tản (LGA1700) ↔ CPU LGA1700 | LGA1700 | `IN` | LGA1700 | ✅ Hợp lệ | TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket LGA1700 của CPU. |
| 1751 | Ngàm tản (LGA1700) ↔ CPU LGA1200 | LGA1700 | `NOT_IN` | LGA1200 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket LGA1200. |
| 1752 | Ngàm tản (LGA1700) ↔ CPU AM5 | LGA1700 | `NOT_IN` | AM5 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket AM5. |
| 1753 | Ngàm tản (LGA1700) ↔ CPU AM4 | LGA1700 | `NOT_IN` | AM4 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket AM4. |
| 1754 | Ngàm tản (AM5) ↔ CPU LGA1851 | AM5 | `NOT_IN` | LGA1851 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket LGA1851. |
| 1755 | Ngàm tản (AM5) ↔ CPU LGA1700 | AM5 | `NOT_IN` | LGA1700 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket LGA1700. |
| 1756 | Ngàm tản (AM5) ↔ CPU LGA1200 | AM5 | `NOT_IN` | LGA1200 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket LGA1200. |
| 1757 | Ngàm tản (AM5) ↔ CPU AM5 | AM5 | `IN` | AM5 | ✅ Hợp lệ | TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket AM5 của CPU. |
| 1758 | Ngàm tản (AM5) ↔ CPU AM4 | AM5 | `NOT_IN` | AM4 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket AM4. |
| 1759 | Ngàm tản (LGA1700, AM5) ↔ CPU LGA1851 | LGA1700, AM5 | `NOT_IN` | LGA1851 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket LGA1851. |
| 1760 | Ngàm tản (LGA1700, AM5) ↔ CPU LGA1700 | LGA1700, AM5 | `IN` | LGA1700 | ✅ Hợp lệ | TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket LGA1700 của CPU. |
| 1761 | Ngàm tản (LGA1700, AM5) ↔ CPU LGA1200 | LGA1700, AM5 | `NOT_IN` | LGA1200 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket LGA1200. |
| 1762 | Ngàm tản (LGA1700, AM5) ↔ CPU AM5 | LGA1700, AM5 | `IN` | AM5 | ✅ Hợp lệ | TƯƠNG THÍCH: Phụ kiện ngàm tản nhiệt hỗ trợ chuẩn socket AM5 của CPU. |
| 1763 | Ngàm tản (LGA1700, AM5) ↔ CPU AM4 | LGA1700, AM5 | `NOT_IN` | AM4 | ❌ Xung đột | KHÔNG TƯƠNG THÍCH: Tản nhiệt không đi kèm ngàm khóa cho socket AM4. |

### Nhóm Quy Tắc: STOCK_COOLER ↔ TDP (12 quy tắc)

| ID | Tên Quy Tắc | Giá Trị Nguồn | Toán Tử | Giá Trị Đích | Tương Thích | Mô Tả Chi Tiết |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| 1836 | Tản hộp [Yes] ↔ CPU TDP 65W | Yes | `LTE` | 65W | ✅ Hợp lệ | TƯƠNG THÍCH: Tản nhiệt kèm hộp đáp ứng vừa vặn cho CPU tiết kiệm điện TDP 65W. |
| 1837 | Tản hộp [Yes] ↔ CPU TDP 105W | Yes | `GT` | 105W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt stock kèm hộp không đủ khả năng làm mát cho CPU hiệu năng cao tỏa nhiệt 105W. Bắt buộc trang bị tản nhiệt khí lớn hoặc tản nước AIO. |
| 1838 | Tản hộp [Yes] ↔ CPU TDP 125W | Yes | `GT` | 125W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt stock kèm hộp không đủ khả năng làm mát cho CPU hiệu năng cao tỏa nhiệt 125W. Bắt buộc trang bị tản nhiệt khí lớn hoặc tản nước AIO. |
| 1839 | Tản hộp [Yes] ↔ CPU TDP 170W | Yes | `GT` | 170W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt stock kèm hộp không đủ khả năng làm mát cho CPU hiệu năng cao tỏa nhiệt 170W. Bắt buộc trang bị tản nhiệt khí lớn hoặc tản nước AIO. |
| 1840 | Tản hộp [Yes] ↔ CPU TDP 200W | Yes | `GT` | 200W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt stock kèm hộp không đủ khả năng làm mát cho CPU hiệu năng cao tỏa nhiệt 200W. Bắt buộc trang bị tản nhiệt khí lớn hoặc tản nước AIO. |
| 1841 | Tản hộp [Yes] ↔ CPU TDP 250W | Yes | `GT` | 250W | ❌ Xung đột | CẢNH BÁO QUÁ NHIỆT: Tản nhiệt stock kèm hộp không đủ khả năng làm mát cho CPU hiệu năng cao tỏa nhiệt 250W. Bắt buộc trang bị tản nhiệt khí lớn hoặc tản nước AIO. |
| 1842 | Tản hộp [No] ↔ CPU TDP 65W | No | `LTE` | 65W | ✅ Hợp lệ | KHUYẾN CÁO: CPU không kèm tản hộp, người dùng chủ động chọn tản nhiệt rời theo nhu cầu. |
| 1843 | Tản hộp [No] ↔ CPU TDP 105W | No | `LTE` | 105W | ✅ Hợp lệ | KHUYẾN CÁO: CPU không kèm tản hộp, người dùng chủ động chọn tản nhiệt rời theo nhu cầu. |
| 1844 | Tản hộp [No] ↔ CPU TDP 125W | No | `LTE` | 125W | ✅ Hợp lệ | KHUYẾN CÁO: CPU không kèm tản hộp, người dùng chủ động chọn tản nhiệt rời theo nhu cầu. |
| 1845 | Tản hộp [No] ↔ CPU TDP 170W | No | `LTE` | 170W | ✅ Hợp lệ | KHUYẾN CÁO: CPU không kèm tản hộp, người dùng chủ động chọn tản nhiệt rời theo nhu cầu. |
| 1846 | Tản hộp [No] ↔ CPU TDP 200W | No | `LTE` | 200W | ✅ Hợp lệ | KHUYẾN CÁO: CPU không kèm tản hộp, người dùng chủ động chọn tản nhiệt rời theo nhu cầu. |
| 1847 | Tản hộp [No] ↔ CPU TDP 250W | No | `LTE` | 250W | ✅ Hợp lệ | KHUYẾN CÁO: CPU không kèm tản hộp, người dùng chủ động chọn tản nhiệt rời theo nhu cầu. |

### Nhóm Quy Tắc: STORAGE_TYPE ↔ FORM_FACTOR (12 quy tắc)

| ID | Tên Quy Tắc | Giá Trị Nguồn | Toán Tử | Giá Trị Đích | Tương Thích | Mô Tả Chi Tiết |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| 1824 | Ổ cứng NVMe ↔ Mainboard E-ATX | NVMe | `EQ` | E-ATX | ✅ Hợp lệ | TƯƠNG THÍCH: Bo mạch chủ chuẩn E-ATX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với SSD chuẩn M.2 PCIe NVMe. |
| 1825 | Ổ cứng NVMe ↔ Mainboard ATX | NVMe | `EQ` | ATX | ✅ Hợp lệ | TƯƠNG THÍCH: Bo mạch chủ chuẩn ATX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với SSD chuẩn M.2 PCIe NVMe. |
| 1826 | Ổ cứng NVMe ↔ Mainboard mATX | NVMe | `EQ` | mATX | ✅ Hợp lệ | TƯƠNG THÍCH: Bo mạch chủ chuẩn mATX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với SSD chuẩn M.2 PCIe NVMe. |
| 1827 | Ổ cứng NVMe ↔ Mainboard ITX | NVMe | `EQ` | ITX | ✅ Hợp lệ | TƯƠNG THÍCH: Bo mạch chủ chuẩn ITX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với SSD chuẩn M.2 PCIe NVMe. |
| 1828 | Ổ cứng SATA SSD ↔ Mainboard E-ATX | SATA SSD | `EQ` | E-ATX | ✅ Hợp lệ | TƯƠNG THÍCH: Bo mạch chủ chuẩn E-ATX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với SSD chuẩn SATA 2.5 inch. |
| 1829 | Ổ cứng SATA SSD ↔ Mainboard ATX | SATA SSD | `EQ` | ATX | ✅ Hợp lệ | TƯƠNG THÍCH: Bo mạch chủ chuẩn ATX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với SSD chuẩn SATA 2.5 inch. |
| 1830 | Ổ cứng SATA SSD ↔ Mainboard mATX | SATA SSD | `EQ` | mATX | ✅ Hợp lệ | TƯƠNG THÍCH: Bo mạch chủ chuẩn mATX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với SSD chuẩn SATA 2.5 inch. |
| 1831 | Ổ cứng SATA SSD ↔ Mainboard ITX | SATA SSD | `EQ` | ITX | ✅ Hợp lệ | TƯƠNG THÍCH: Bo mạch chủ chuẩn ITX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với SSD chuẩn SATA 2.5 inch. |
| 1832 | Ổ cứng HDD ↔ Mainboard E-ATX | HDD | `EQ` | E-ATX | ✅ Hợp lệ | TƯƠNG THÍCH: Bo mạch chủ chuẩn E-ATX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với Ổ cứng HDD cơ 3.5 inch. |
| 1833 | Ổ cứng HDD ↔ Mainboard ATX | HDD | `EQ` | ATX | ✅ Hợp lệ | TƯƠNG THÍCH: Bo mạch chủ chuẩn ATX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với Ổ cứng HDD cơ 3.5 inch. |
| 1834 | Ổ cứng HDD ↔ Mainboard mATX | HDD | `EQ` | mATX | ✅ Hợp lệ | TƯƠNG THÍCH: Bo mạch chủ chuẩn mATX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với Ổ cứng HDD cơ 3.5 inch. |
| 1835 | Ổ cứng HDD ↔ Mainboard ITX | HDD | `EQ` | ITX | ✅ Hợp lệ | TƯƠNG THÍCH: Bo mạch chủ chuẩn ITX có đầy đủ khe M.2 và cổng SATA 6Gb/s kết nối tốt với Ổ cứng HDD cơ 3.5 inch. |

### Nhóm Quy Tắc: TDP_RATING ↔ VRM_TIER (1 quy tắc)

| ID | Tên Quy Tắc | Giá Trị Nguồn | Toán Tử | Giá Trị Đích | Tương Thích | Mô Tả Chi Tiết |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| 1848 | RULE-MULTI-001: CPU High-Power ↔ Mainboard Entry-Level VRM Throttling | tdp_rating | `NEQ` | vrm_tier | ❌ Xung đột | CẢNH BÁO VRM THROTTLING: CPU công suất cao (TDP > 125W như i7/i9 hoặc Ryzen 9) đi cùng Mainboard phân khúc phổ thông (H610/A620) không tản nhiệt VRM sẽ gây quá nhiệt mạch cấp nguồn, ép CPU tụt xung nghiêm trọng. Bắt buộc dùng Mainboard chipset B/Z series có VRM tối thiểu 10+2 phase. |

