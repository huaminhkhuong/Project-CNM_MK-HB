# 🎓 CẨM NANG BẢO VỆ KHÓA LUẬN – KỊCH BẢN DEMO 5 ACTOR & PHẢN BIỆN
> **Dự án:** PC Mall – Hệ thống E-commerce Linh kiện Máy tính & Tư vấn Cấu hình
> **Tài liệu phục vụ:** Buổi báo cáo trước Hội đồng chấm Khóa luận / Đồ án tốt nghiệp

---

## 📋 MỤC LỤC
1. [Chuẩn bị môi trường trước giờ G (Pre-flight Checklist)](#1-chuẩn-bị-môi-trường-trước-giờ-g)
2. [Bảng thông tin tài khoản demo 5 Actor](#2-bảng-thông-tin-tài-khoản-demo)
3. [Kịch bản Demo trực tiếp 5 Actor (Live Demo Script)](#3-kịch-bản-demo-trực-tiếp-5-actor)
4. [Bộ 5 câu hỏi phản biện kinh điển & Cách trả lời "ăn điểm"](#4-bộ-câu-hỏi-phản-biện-kinh-điển)

---

## 1. CHUẨN BỊ MÔI TRƯỜNG TRƯỚC GIỜ G

Trước khi bước vào phòng bảo vệ 15 phút, hãy mở sẵn terminal và chạy các bước sau:

### Bước 1: Khởi động Database Docker
```bash
docker compose -f infra/docker/docker-compose.yml up -d
```
*Kiểm tra:* Truy cập `http://localhost:8080` (Adminer) xem database `cnm_mk_hb` đã online.

### Bước 2: Seed dữ liệu demo sạch & chuẩn
```bash
npm run seed:production -w services/api
```
*(Lệnh này idempotent – an toàn chạy nhiều lần, đảm bảo 4 tài khoản demo luôn có mật khẩu chuẩn).*

### Bước 3: Chạy Backend & Frontend
Mở 2 tab terminal riêng biệt:
```bash
# Tab 1 - Backend API (Port 4000)
npm run dev:api

# Tab 2 - Frontend Web (Port 5173)
npm run dev:web
```

### Bước 4: Kiểm tra nhanh trước giờ diễn
* Mở trình duyệt ẩn danh: `http://localhost:5173`
* Kiểm tra Health check API: `http://localhost:4000/api/health` -> Trả về `{"status":"ok", "database":{"connected":true}}`.

---

## 2. BẢNG THÔNG TIN TÀI KHOẢN DEMO

| STT | Nhóm người dùng (Actor) | Email đăng nhập | Mật khẩu | URL mặc định sau đăng nhập |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Guest** (Khách vãng lai) | *(Không cần đăng nhập)* | *(Trống)* | `/` |
| **2** | **Customer** (Khách mua hàng) | `customer@cnm.local` | `Customer@123` | `/` hoặc `/profile` |
| **3** | **Sales Staff** (Nhân viên bán hàng) | `sales@cnm.local` | `Sales@123` | `/staff/orders` |
| **4** | **Tech Staff** (Kỹ thuật viên) | `tech1@cnm.local` | `Tech@123` | `/tech/tickets` |
| **5** | **Admin** (Quản trị viên) | `admin@cnm.local` | `Admin@123` | `/admin/dashboard` |

---

## 3. KỊCH BẢN DEMO TRỰC TIẾP 5 ACTOR

### 🎭 ACTOR 1: GUEST (KHÁCH VÃNG LAI) – 3 PHÚT
* **Mục tiêu thuyết trình:** Cho Hội đồng thấy tính năng độc đáo nhất của đề tài mà không cần đăng nhập: PC Builder, kiểm tra xung đột phần cứng tự động và giải thích luật XAI.
* **Các bước thao tác:**
  1. Từ trang chủ, bấm vào **"Xây dựng cấu hình PC"** (`/pc-builder`).
  2. **Trình diễn kiểm tra xung đột phần cứng (Conflict Detection):**
     * Chọn **CPU:** Chọn một chip socket **AM5** (ví dụ: *AMD Ryzen 7 7700X*).
     * Chọn **Mainboard:** Cố ý chọn một mainboard socket **AM4** (ví dụ: *B550M AORUS*).
     * 👉 **Điểm nhấn:** Chỉ vào màn hình: Hệ thống ngay lập tức hiện cảnh báo đỏ **`BLOCKER: Socket CPU ↔ Mainboard [COMP-001]`**.
  3. **Trình diễn XAI (Explainable AI):**
     * Bấm vào nút **"Chi tiết xung đột (XAI Explanation)"**.
     * Giới thiệu với Hội đồng: *"Hệ thống không chỉ báo lỗi mà còn giải thích chi tiết nguyên nhân kỹ thuật (AM5 sử dụng socket LGA1718, không tương thích vật lý với AM4 PGA1331) và đưa ra gợi ý bo mạch chủ thay thế phù hợp."*
  4. **Trình diễn AI Advisor Heuristic Suggestion:**
     * Bấm vào nút **"Gợi ý cấu hình tự động"**.
     * Nhập ngân sách: `25.000.000 đ`, mục đích: `Gaming`.
     * Bấm **"Gợi ý ngay"** -> Hệ thống tự động phân bổ tỷ lệ ngân sách chuẩn (GPU chiếm ~30%, CPU ~22%), tự động điền đủ 8 linh kiện đồng bộ và hiển thị mức FPS ước tính cho game Esports/AAA.
  5. **Trình diễn Tra cứu bảo hành công khai:**
     * Bấm menu **"Tra cứu bảo hành"** (`/warranties`), nhập mã serial hoặc tra cứu nhanh không cần tài khoản.

---

### 🎭 ACTOR 2: CUSTOMER (KHÁCH THÀNH VIÊN) – 3 PHÚT
* **Mục tiêu thuyết trình:** Chứng minh quy trình mua sắm trọn vẹn: giỏ hàng, áp mã giảm giá, thanh toán, theo dõi đơn hàng và yêu cầu hỗ trợ kỹ thuật.
* **Các bước thao tác:**
  1. Bấm **"Đăng nhập"** -> Nhập `customer@cnm.local` / `Customer@123`.
  2. Bấm **"Thêm cấu hình vào giỏ hàng"** từ PC Builder hoặc chọn 1 sản phẩm bất kỳ ngoài Catalog.
  3. Mở **Giỏ hàng** (`/cart`):
     * Nhập mã voucher: **`PCMALL50K`** -> Bấm "Áp dụng".
     * 👉 **Điểm nhấn:** Tổng tiền được giảm trực tiếp 50.000đ, hiển thị rõ ràng trên hóa đơn.
  4. Bấm **"Thanh toán"** (`/checkout`):
     * Chọn địa chỉ giao hàng mẫu.
     * Chọn phương thức: **Thanh toán khi nhận hàng (COD)** hoặc **Cổng thanh toán điện tử (VNPay/Mock)**.
     * Bấm **"Đặt hàng"** -> Đơn hàng tạo thành công với mã đơn `ORD-...`.
  5. Mở **"Đơn hàng của tôi"** (`/orders`):
     * Xem trạng thái đơn `PENDING` (Chờ xử lý).
  6. Mở **"Gửi yêu cầu bảo hành / Hỗ trợ"** (`/tickets`):
     * Tạo 1 phiếu hỗ trợ: *"Cần tư vấn nâng cấp thêm RAM 16GB"* -> Phiếu gửi thành công.

---

### 🎭 ACTOR 3: SALES STAFF (NHÂN VIÊN KINH DOANH) – 2 PHÚT
* **Mục tiêu thuyết trình:** Cho thấy nghiệp vụ xử lý đơn hàng nội bộ và hệ thống Chat trực tuyến realtime với khách hàng qua Socket.io.
* **Các bước thao tác:**
  1. Đăng xuất hoặc mở tab ẩn danh khác, đăng nhập: `sales@cnm.local` / `Sales@123`.
  2. Trình duyệt tự động chuyển đến `/staff/orders`:
     * Nhìn thấy ngay đơn hàng mà Customer vừa đặt ở trên.
     * Thao tác: Bấm **"Xác nhận đơn"** -> Trạng thái đổi sang `PROCESSING`.
     * Bấm **"Giao hàng"** -> Hệ thống tự động gán mã vận đơn giao hàng (`TRACK-...`).
  3. Mở **Tư vấn trực tuyến** (`/staff/chat`):
     * Xem hàng chờ khách hàng.
     * Bấm **"Tiếp nhận tư vấn"** -> Khung chat realtime hiển thị.
     * Thao tác gửi tin nhắn và gửi cấu hình PC đề xuất cho khách.

---

### 🎭 ACTOR 4: TECH STAFF (KỸ THUẬT VIÊN) – 2 PHÚT
* **Mục tiêu thuyết trình:** Chứng minh module quản lý bảo hành điện tử và tiếp nhận ticket hỗ trợ kỹ thuật của riêng phòng kỹ thuật.
* **Các bước thao tác:**
  1. Đăng nhập: `tech1@cnm.local` / `Tech@123`.
  2. Màn hình điều hướng đến `/tech/tickets`:
     * Thấy ngay Ticket hỗ trợ *"Cần tư vấn nâng cấp thêm RAM 16GB"* mà Customer vừa tạo.
     * Bấm tiếp nhận ticket, đổi trạng thái sang `IN_PROGRESS` và nhập phản hồi kỹ thuật.
  3. Mở tab **"Quy tắc tương thích"** (`/tech/compatibility`):
     * Tra cứu danh sách các luật kiểm tra phần cứng (Socket compatibility, RAM type DDR4/DDR5, GPU length clearance).

---

### 🎭 ACTOR 5: ADMIN (QUẢN TRỊ VIÊN TỔNG HỆ THỐNG) – 2 PHÚT
* **Mục tiêu thuyết trình:** Bảng điều khiển trung tâm (Dashboard), quản trị Catalog sản phẩm, thống kê doanh thu và phân quyền người dùng (RBAC).
* **Các bước thao tác:**
  1. Đăng nhập: `admin@cnm.local` / `Admin@123`.
  2. Màn hình `/admin/dashboard`:
     * Trình bày các thẻ số liệu: Tổng doanh thu, Tổng đơn hàng, Số lượng sản phẩm, Khách hàng mới.
  3. Vào **"Quản lý sản phẩm"** (`/admin/products`):
     * Trình bày danh sách linh kiện, thông số kỹ thuật (Specs Bag), quản lý SKU và tồn kho.
  4. Vào **"Quản trị người dùng & Phân quyền"** (`/admin/users`):
     * Trình bày cơ chế phân quyền RBAC: Có thể nâng cấp tài khoản từ Customer thành Sales Staff hoặc Tech Staff.

---

## 4. BỘ CÂU HỎI PHẢN BIỆN KINH ĐIỂN & CÁCH TRẢ LỜI "ĂN ĐIỂM"

### ❓ Câu hỏi 1: "Hệ thống AI Advisor của nhóm dùng Machine Learning hay chỉ là If-Else?"
* **💡 Cách trả lời chuẩn:**
  > *"Thưa Thầy/Cô, hệ thống tư vấn cấu hình của nhóm được thiết kế theo mô hình **Hệ chuyên gia dựa trên tri thức (Knowledge-Based Expert System)** kết hợp **Thuật toán tối ưu hóa Heuristic** và **Mô hình ngôn ngữ lớn (LLM)**:*
  > 1. *Đối với việc chọn linh kiện:* Nhóm không dùng Machine Learning dạng hộp đen (Black-box) vì phần cứng máy tính đòi hỏi tính **chính xác tuyệt đối về vật lý** (ví dụ CPU AM5 tuyệt đối không được cắm vào Mainboard AM4). Do đó, nhóm xây dựng **Knowledge Engine với 10 tập luật COMP-001 đến COMP-010** kết hợp thuật toán Heuristic phân bổ trọng số ngân sách theo từng Use-case (Gaming, Render, Office).
  > 2. *Đối với việc đàm thoại tư vấn:* Nhóm tích hợp API **OpenAI GPT-4o-mini / Gemini 1.5 Flash** để hỗ trợ hội thoại tự nhiên, đồng thời có cơ chế Fallback tự động về Rule Engine nội bộ khi không có kết nối Internet hoặc thiếu API Key."

---

### ❓ Câu hỏi 2: "Tại sao nhóm gọi tính năng giải thích luật là XAI (Explainable AI)?"
* **💡 Cách trả lời chuẩn:**
  > *"Thưa Thầy/Cô, trong lĩnh vực AI truyền thống, XAI (Explainable AI) bao gồm cả hướng tiếp cận **Symbolic AI (Trí tuệ nhân tạo biểu tượng)**. Khi một cấu hình không hợp lệ, hệ thống không chỉ trả về mã lỗi vô nghĩa, mà thông qua **XaiExplanationService** để xây dựng cây quyết định giải trình:*
  > * Phân loại mức độ nghiêm trọng thành 4 cấp: **BLOCKER** (ngăn chặn lắp ráp), **WARNING** (cảnh báo nghẽn cổ chai), **ADVISORY** (khuyến nghị), **INFO** (thông số đạt chuẩn).
  > * Tự động tạo câu giải thích ngôn ngữ tự nhiên nêu rõ thông số hai linh kiện xung đột và đề xuất linh kiện thay thế tương thích."

---

### ❓ Câu hỏi 3: "Khi 2 khách hàng cùng đặt 1 món hàng chỉ còn 1 cái trong kho thì hệ thống xử lý như thế nào để tránh tồn kho âm (Overselling)?"
* **💡 Cách trả lời chuẩn:**
  > *"Thưa Thầy/Cô, nếu chỉ dùng `SELECT` kiểm tra stock rồi sau đó mới `UPDATE` thì sẽ gặp lỗi Race Condition (vấn đề tranh chấp đồng thời).*
  > *Nhóm đã xử lý triệt để vấn đề này tại tầng Database bằng **câu lệnh cập nhật điều kiện nguyên tử (Atomic Conditional Update)**:*
  > ```sql
  > UPDATE product_skus SET stock = stock - 1 WHERE id = ? AND stock >= 1
  > ```
  > *Trong Prisma, nhóm sử dụng `updateMany` với điều kiện `stock: { gte: quantity }`. Nếu 2 giao dịch đến cùng lúc, hàng đợi của MySQL InnoDB sẽ khóa dòng (row-level lock). Giao dịch đầu tiên trừ thành công (`affectedRows = 1`), giao dịch thứ hai nhận kết quả `affectedRows = 0` và hệ thống lập tức rollback, thông báo sản phẩm vừa hết hàng."*

---

### ❓ Câu hỏi 4: "Nhóm đã làm gì để tối ưu hiệu năng Frontend khi trang PC Builder và Admin rất nặng?"
* **💡 Cách trả lời chuẩn:**
  > *"Thưa Thầy/Cô, ban đầu ứng dụng bị đóng gói thành một file bundle monolithic nặng hơn 1 MB, khiến trình duyệt tải rất chậm. Nhóm đã áp dụng kỹ thuật **Route-based Code Splitting** kết hợp `React.lazy()` và `Suspense`:*
  > * *Tách toàn bộ các phân hệ Admin, Staff, Tech và PC Builder thành các chunk riêng biệt.*
  > * *Kết quả đo lường: File bundle chính tải ban đầu giảm từ **1.022 kB xuống chỉ còn 81.47 kB (giảm hơn 92%)**, giúp thời gian FCP (First Contentful Paint) cải thiện rõ rệt."*

---

### ❓ Câu hỏi 5: "Dự án đảm bảo an toàn thông tin và phân quyền như thế nào?"
* **💡 Cách trả lời chuẩn:**
  > *"Thưa Thầy/Cô, hệ thống áp dụng mô hình bảo mật nhiều lớp (Defense in Depth):*
  > 1. ***Xác thực (Authentication):** Dùng JWT (JSON Web Token) với cơ chế cặp mã: Access Token ngắn hạn (15 phút) và Refresh Token dài hạn (7 ngày).*
  > 2. ***Phân quyền (RBAC - Role-Based Access Control):** Được kiểm soát nghiêm ngặt tại middleware Express thông qua 2 tầng: tầng vai trò (`requireRole`) và tầng quyền hạn chi tiết (`requirePermission`). Các route của Admin, Staff và Tech được cô lập hoàn toàn.*
  > 3. ***Bảo vệ chống tấn công phổ biến:** Tích hợp `helmet` chống clickjacking/MIME sniffing, `express-rate-limit` chống Brute-force đăng nhập và spam gọi API AI Advisor."*
