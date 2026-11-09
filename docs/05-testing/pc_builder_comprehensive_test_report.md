# BÁO CÁO KIỂM THỬ TOÀN DIỆN LUỒNG PC BUILDER & AI DECISION SUPPORT

## 1. Mục Tiêu Kiểm Thử
Đóng vai người dùng thực tế kiểm thử từ giao diện (Frontend) đến API Backend, tương tác với từng nút bấm, dropdown, modal, drawer, thanh trượt ngân sách, các chức năng AI và kiểm tra toàn bộ 436 luật tương thích phần cứng trong cơ sở dữ liệu.

---

## 2. Các Vấn Đề Đã Phát Hiện & Khắc Phục Triệt Để

| # | Vấn Đề Phát Hiện | Nguyên Nhân Kỹ Thuật | Giải Pháp Đã Thực Hiện | Trạng Thái |
|---|---|---|---|---|
| **1** | Bấm Preset 25Tr nhưng tổng giá nhảy vọt thành 58.874.000đ | Mainboard B550M-A có chữ "RAM" trong tên nên `getPool` gom nhầm Mainboard vào danh mục RAM; đồng thời candidate chọn kit RAM DDR5 32Tr | Sửa `getPool` trong [`pc-builder.service.ts`](file:///t:/Khoa_luan/services/api/src/modules/pc-builder/pc-builder.service.ts#L694-L705) lọc chuẩn xác theo `categoryId = 3` và `categoryName = 'RAM'`, không match nhầm tên Mainboard. | ✅ **ĐÃ KHẮC PHỤC** |
| **2** | Tổng giá các phương án đề xuất vượt quá ngân sách mục tiêu | Sau khi chọn linh kiện đơn lẻ chưa có bước tối ưu hóa ngân sách tổng thể | Bổ sung **Post-selection Budget Optimization Pass** trong [`pc-builder.service.ts`](file:///t:/Khoa_luan/services/api/src/modules/pc-builder/pc-builder.service.ts#L845-L895) tự động hạ cấp linh kiện phụ nếu tổng giá vượt ngân sách, đảm bảo `bestValue` luôn bám sát 100% ngân sách. | ✅ **ĐÃ KHẮC PHỤC** |
| **3** | Hiển thị `NaN%` tại dòng Tỷ lệ sử dụng ngân sách trên Bảng So Sánh Side-by-Side | Giá trị `budgetUtilization` trả về từ API là chuỗi `"110%"` thay vì số nguyên thuần | Bổ sung hàm parse regex an toàn trong [`CandidateBuildsPanel.jsx`](file:///t:/Khoa_luan/apps/web/src/components/pc-builder/CandidateBuildsPanel.jsx#L126-L135). | ✅ **ĐÃ KHẮC PHỤC** |
| **4** | Nút "Chọn Build Này" trên Bảng So Sánh không nạp đủ 8 linh kiện | Hàm `handleApplyCandidateBuild` trích xuất `item.id` trong khi candidate item sử dụng `item.variantId` hoặc `item.productId` | Cập nhật hàm trích xuất `pId = Number(item.productId || item.product_id || item.id || item.variantId)` và fallback object linh kiện trong [`PcBuilderPage.jsx`](file:///t:/Khoa_luan/apps/web/src/pages/public/PcBuilderPage.jsx#L1995-L2045). | ✅ **ĐÃ KHẮC PHỤC** |
| **5** | What-If Simulation hiển thị "Chưa chọn" ở cột Build Hiện Tại | Trong [`WhatIfComparisonPanel.jsx`](file:///t:/Khoa_luan/apps/web/src/components/pc-builder/WhatIfComparisonPanel.jsx#L46-L58), việc trích xuất tên linh kiện hiện tại bị lỗi do cấu trúc lồng `{ product, variant }` | Cập nhật bộ bóc tách linh kiện: lấy đúng `curProduct.name || curProduct.product_name` và `curPrice`. | ✅ **ĐÃ KHẮC PHỤC** |
| **6** | Lỗi thiếu hàm helper trong `pcBuilderUtils.js` | Hàm `getProductSocket`, `getProductRamType`, `getPsuWattageValue` chưa được export | Đã bổ sung và export đầy đủ vào [`pcBuilderUtils.js`](file:///t:/Khoa_luan/apps/web/src/components/pc-builder/pcBuilderUtils.js) và import vào trang chính. | ✅ **ĐÃ KHẮC PHỤC** |

---

## 3. Nhật Ký Kiểm Thử Chi Tiết Qua Trình Duyệt Thực Tế (Browser Test Log)

1. **Preset Click Test (`🎮 Gaming AAA 25.000.000đ`)**:
   - Hệ thống tự động gọi API `/api/pc-builder/suggest`, sinh 3 phương án: Best Value, Best Performance, Budget Safe.
   - Nạp thành công trọn vẹn **8/8 linh kiện** vào Workspace.
   - Điểm tương thích XAI: **100/100 (BUILD READY)**.
   - Socket: CPU LGA1700 (i5-14400F) ↔ Mainboard LGA1700 (ASUS B760M-K D4) chuẩn xác.
   - RAM: DDR4 8GB 3200MHz khớp chuẩn khe RAM DDR4 bo mạch chủ.

2. **Side-by-Side Comparison Table Test**:
   - Click nút **"📊 Bảng So Sánh Side-by-Side"**: Chuyển đổi mượt mà giữa chế độ Thẻ (Card) và Bảng So Sánh trực quan.
   - Hiển thị đầy đủ các tiêu chí: Tổng giá trị, Hiệu năng FPS ước tính, Điểm tương thích XAI, Tỷ lệ sử dụng ngân sách (không còn bị NaN).
   - Click nút **"Chọn Build Này"** tại cột *Budget Safe*: Hệ thống nạp tức thì cấu hình tiết kiệm (21.674.000đ - còn dư 3.326.000đ), nút **"🚀 Đặt Mua Nguyên Bộ"** sáng xanh khả dụng.

3. **Requirement Wizard Test (`⚙️ Nhu Cầu Chi Tiết`)**:
   - Modal mở ra mượt mà, chọn mục đích: *🎬 Dựng phim / Đồ họa 4K*, kéo ngân sách *35.000.000đ*, độ phân giải *4K Ultra HD*.
   - Bấm **"⚡ Phân Tích & AI Build 3 Candidates"**:
   - Cấu hình đề xuất tự động chọn CPU khủng AMD Ryzen 7 7800X3D + Mainboard ASUS TUF B650M-E WIFI + RAM DDR5 5600MHz + Card đồ họa RTX 3060 12GB VRAM.
   - Tương thích tuyệt đối socket AM5 và chuẩn DDR5.

4. **XAI Explanation Drawer Test (`🧠 XAI`)**:
   - Drawer mở từ bên phải, hiển thị danh sách **14 luật tương thích kỹ thuật** với độ chi tiết cao:
     - `COMP-001`: Socket CPU & Mainboard hoàn toàn tương thích (AM5 / AM5).
     - `COMP-002`: Đã khớp chuẩn RAM và Mainboard (DDR5 / DDR5).
     - `COMP-007`: Công suất nguồn (PSU) đáp ứng tốt (500W / need 475W).
     - `COMP-005`: Tản nhiệt hỗ trợ đúng chân cắm CPU (LGA1851, LGA1700, AM5, AM4).
     - `COMP-008`: Đầu nguồn cấp điện PCIe 8-pin đầy đủ.
     - `COMP-009`: Khe cắm M.2 NVMe & SATA trên Mainboard đáp ứng đủ.
     - `COMP-010`: Kích thước Mainboard hoàn toàn vừa vặn với Vỏ Case (mATX / mATX).

5. **What-If Simulation Modal Test (`🔮 WHAT-IF SIMULATION`)**:
   - Click **"🚀 Mô phỏng +5Tr (+25 FPS)"**: Modal mở ra với bảng so sánh Component Delta Diff.
   - Cột *Build Hiện Tại* và *Build Mô Phỏng* hiển thị đầy đủ tên từng linh kiện kèm giá tiền.
   - Phân loại rõ ràng linh kiện nâng cấp `⬆️ Upgraded`, hạ cấp `⬇️ Downgraded`, và giữ nguyên `✨ Giữ nguyên`.
   - Click **"🚀 Áp Dụng Cấu Hình Mô Phỏng Này"**: Toàn bộ linh kiện mô phỏng nạp ngay lập tức vào Workspace.

6. **Giỏ Hàng & Đặt Mua Nguyên Bộ Test**:
   - Click nút **"🛒 Giỏ hàng"**: Banner thông báo `✅ Đã thêm toàn bộ linh kiện vào giỏ hàng.` xuất hiện.
   - Click nút **"🚀 Đặt Mua Nguyên Bộ"**:
     - Modal **FinalReviewModal** mở ra tóm tắt toàn bộ linh kiện, xác nhận dịch vụ miễn phí (Lắp ráp, cài Windows 11 bản quyền).
     - Bấm **"🚀 XÁC NHẬN ĐẶT MUA NGUYÊN BỘ"**:
     - Ứng dụng điều hướng trơn tru sang trang `/checkout` với danh sách đầy đủ 8 linh kiện, tổng tiền và quy trình 4 bước thanh toán bảo mật.

7. **Production Build Validation**:
   - Chạy `npm run build` trong `apps/web`: Hoàn thành xuất sắc không có bất kỳ lỗi biên dịch hay cảnh báo nào (`built in 18.11s`).
