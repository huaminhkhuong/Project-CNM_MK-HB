# TỔNG HỢP TRI THỨC KỸ THUẬT PHẦN CỨNG & QUY TẮC TƯƠNG THÍCH PC MALL

## 1. Tương thích CPU và Bo mạch chủ (Mainboard)
### Quy tắc Socket & Chipset
- **Intel LGA1700:**
  - Hỗ trợ các dòng vi xử lý Intel Core thế hệ 12 (Alder Lake), thế hệ 13 (Raptor Lake) và thế hệ 14 (Raptor Lake Refresh).
  - Chipset tương thích: H610, B660, B760, Z690, Z790.
  - Lưu ý: Dòng CPU có hậu tố "K" (như 13600K, 14700K) nên đi với mainboard dòng Z để mở khóa ép xung (Overclock) và có dàn phase VRM đủ khỏe. Dòng "non-K" hoặc "F" (12400F, 13400F, 14400F) ghép tối ưu nhất với B660 hoặc B760.
- **AMD Socket AM5:**
  - Hỗ trợ vi xử lý AMD Ryzen 7000 Series, 8000 Series và 9000 Series.
  - Chipset tương thích: A620, B650, B650E, X670, X670E, X870.
  - ĐẶC BIỆT: Nền tảng AM5 CHỈ hỗ trợ RAM DDR5, hoàn toàn KHÔNG hỗ trợ RAM DDR4.
- **AMD Socket AM4 (Nền tảng phổ thông / Budget):**
  - Hỗ trợ AMD Ryzen 1000 đến 5000 Series (như Ryzen 5 5600, Ryzen 7 5700X3D).
  - Chipset tương thích: A320, B450, B550, X570.
  - Nền tảng AM4 CHỈ hỗ trợ RAM DDR4.

---

## 2. Quy tắc RAM & Cơ chế Hạ Xung (Downclocking)
### Khác biệt chuẩn RAM
- RAM DDR4 và RAM DDR5 có cấu trúc chân cắm (notch/rãnh khóa) khác nhau hoàn toàn. Không thể cắm thanh DDR4 vào khe DDR5 và ngược lại.
- Các Mainboard LGA1700 có phiên bản chạy DDR4 (thường có ký hiệu "D4" ở tên model) và phiên bản chạy DDR5 riêng biệt.

### Cơ chế Hạ Xung RAM Tự Động (Downclocking)
- **Hiện tượng:** Khách hàng sở hữu thanh RAM có tốc độ Bus cao (ví dụ: DDR4 3200MHz hoặc 3600MHz) nhưng cắm vào Mainboard hoặc CPU chỉ hỗ trợ tối đa 2666MHz / 2933MHz (ví dụ bo mạch H410, H510 hoặc H610 với CPU i3).
- **Nguyên lý hoạt động:** Chuẩn SPD của JEDEC và hệ thống BIOS/UEFI sẽ tự động bắt tay (handshake) và hạ mức xung nhịp hoạt động của thanh RAM về mức trần cao nhất mà Mainboard/CPU đó hỗ trợ (ví dụ hạ về 2666MHz).
- **Độ an toàn:** AN TOÀN 100%. Quá trình này không gây cháy nổ, không làm hỏng RAM, không làm giảm tuổi thọ Mainboard hay CPU.
- **Tác động hiệu năng:** Hệ thống vẫn hoạt động ổn định tuyệt đối, chỉ không tận dụng được hết khoảng 10-15% băng thông tối đa của thanh RAM.

### Lắp đặt Kênh Đôi (Dual Channel)
- Chạy 2 thanh RAM (ví dụ: 2x8GB hoặc 2x16GB) kích hoạt băng thông Dual Channel (128-bit), tăng hiệu năng chơi game từ 15% - 25% và giảm hiện tượng giật khung hình (1% low FPS) so với việc chỉ cắm 1 thanh đơn (Single Channel 64-bit).

---

## 3. Công thức Tính Công suất Bộ Nguồn (PSU) & Dự Phòng
### Công thức vàng tính công suất nguồn thực tế
$$\text{Công suất khuyến nghị (Watt)} = (\text{TDP CPU} + \text{TDP GPU} + 100\text{W}) \times 1.25 \dots 1.30$$
- Trong đó:
  - $100\text{W}$: Mức tiêu thụ điện dự phòng cho Mainboard, RAM, quạt tản nhiệt, LED RGB và ổ cứng SSD/HDD.
  - Hệ số $1.25 - 1.30$: Dự phòng 25% - 30% công suất để bộ nguồn hoạt động ở dải tải lý tưởng nhất (50% - 70% tải - mức hiệu suất chuyển đổi cao nhất, quạt êm nhất) và chịu được xung tải đột ngột (transient power spikes của GPU thế hệ mới như RTX 3000/4000).

### Bảng công suất PSU tham khảo nhanh
- **450W - 550W (80 Plus Bronze):** Dành cho cấu hình i3/i5 non-K + GTX 1650, RTX 3050, RX 6600.
- **650W (80 Plus Bronze/Gold):** Dành cho cấu hình i5 12400F/13400F/14400F + RTX 4060, RTX 4060 Ti, RX 6700XT.
- **750W (80 Plus Gold):** Dành cho i5 13600K, i7 13700F + RTX 4070, RTX 4070 Super, RX 7800XT.
- **850W - 1000W (80 Plus Gold/Platinum):** Dành cho i7/i9 hoặc Ryzen 9 + RTX 4070 Ti Super, RTX 4080 Super, RTX 4090.

---

## 4. Tương thích Kích thước & Tản nhiệt (Clearance)
### Card màn hình (VGA) và Vỏ Case
- Chiều dài GPU (GPU Length) thường dao động từ 200mm (2 quạt) đến 340mm (3 quạt to nạc). Vỏ case phải có thông số "Hỗ trợ VGA tối đa" lớn hơn chiều dài GPU ít nhất 15mm - 20mm để dễ luồn dây nguồn.
### Tản nhiệt khí và Chiều cao Case
- Tản khí tháp đôi (như Thermalright Peerless Assassin 120, Noctua D15) thường cao 155mm - 165mm. Vỏ case phải hỗ trợ chiều cao tản CPU (Max CPU Cooler Height) $\ge 160\text{mm}$.
### Tản nhiệt nước AIO (All-in-One Liquid Cooler)
- CPU TDP $\le 65\text{W}$ (i3, i5-12400F, Ryzen 5 5600): Tản khí stock hoặc tản tháp đơn 300.000đ - 500.000đ là đủ mát.
- CPU TDP $65\text{W} - 125\text{W}$ (i5-13400F, i5-14400F): Khuyên dùng tản tháp 4-6 ống đồng (Thermalright Assassin X / Burst Assassin).
- CPU TDP $\ge 150\text{W} - 250\text{W}$ (i5-13600K, i7-13700K, i7-14700K, i9): Bắt buộc dùng tản nhiệt nước AIO 240mm hoặc 360mm.

---

## 5. Nguyên lý Cân bằng Hiệu năng & Tránh Nghẽn Cổ Chai (Bottleneck)
- **Nghẽn cổ chai (Bottleneck):** Xảy ra khi một linh kiện quá yếu so với linh kiện còn lại, khiến linh kiện mạnh hơn không thể phát huy hết 100% công suất.
- **Nguyên tắc phối ghép cho Gaming:**
  - Độ phân giải Full HD (1080p): Chơi game eSports cần CPU có IPC đơn nhân cao (như i5-12400F, i5-13400F, Ryzen 5 5600X/7500F) đi cùng GPU tầm trung (RTX 3060, RTX 4060, RX 6600).
  - Độ phân giải 2K (1440p) / 4K (2160p): Tải game dồn phần lớn lên GPU. Cần ưu tiên ngân sách cho GPU có VRAM $\ge 12\text{GB}$ (RTX 4070 Super, RX 7800XT) trước khi đầu tư CPU quá đắt tiền.
