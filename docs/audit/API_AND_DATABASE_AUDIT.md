# BÁO CÁO RÀ SOÁT API VÀ CƠ SỞ DỮ LIỆU (API & DATABASE AUDIT)
**Dự án**: PC Mall / Project CNM_MK-HB  
**Đối tượng rà soát**: Toàn bộ 20 nhóm Route API Backend, Middleware, Cơ sở dữ liệu MySQL 8.0, Prisma ORM Schema & Tính toàn vẹn dữ liệu (Referential Integrity).

---

## 1. BẢN ĐỒ API ENDPOINTS VÀ ĐÁNH GIÁ CHUỖI XỬ LÝ (API MAP)

Tất cả các route được gắn kết tập trung tại [services/api/src/routes/index.ts](file:///d:/Project%20CNM_MK-HB/services/api/src/routes/index.ts) dưới tiền tố chung `/api`.

| Nhóm Route | Endpoint tiền tố | Phương thức & Chức năng | Yêu cầu Auth | Phân quyền (RBAC) | Tầng DB xử lý | Test hiện có | Kết quả kiểm tra | Đánh giá & Vấn đề |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **1. Health** | `GET /api/health` | Kiểm tra tình trạng server & probe MySQL | Public | Không | Prisma Raw Query | `health.test.ts` | 🟢 **PASS** (200 OK) | Ổn định, phản hồi thời gian mili-giây. |
| **2. Auth** | `POST /api/auth/register` | Đăng ký tài khoản khách hàng | Public | Không | Prisma User Model | `auth.smoke.test.ts` | 🟢 **PASS** | Hash bcrypt salt 10 vòng, kiểm tra email trùng. |
| | `POST /api/auth/login` | Đăng nhập cấp Access & Refresh Token | Public | Không | Prisma User Model | `auth.smoke.test.ts` | 🟢 **PASS** | Áp dụng `authRateLimiter` chống brute force. |
| | `POST /api/auth/refresh` | Cấp mới Access Token từ Refresh Token | Public | Bearer Token | Prisma User Model | `auth.smoke.test.ts` | 🟢 **PASS** | Đã xác minh cấp mới thành công. |
| | `PATCH /api/auth/me` | Cập nhật thông tin cá nhân | Bearer | Customer/All | Prisma User Model | `route-smoke.test.ts` | 🟢 **PASS** (401 check) | Chặn truy cập khi thiếu token. |
| **3. Users** | `/api/users` | Quản lý người dùng, địa chỉ giao hàng | Bearer | User / Admin | Prisma User Model | `route-smoke.test.ts` | 🟢 **PASS** | Kiểm tra quyền sở hữu IDOR chuẩn. |
| **4. Products** | `GET /api/products` | Danh sách sản phẩm, phân trang, tìm kiếm | Public | Không | Raw MySQL Pool | `route-smoke.test.ts` | 🟢 **PASS** | Hỗ trợ full-text search và category filtering. |
| | `GET /api/products/filter-options`| Lấy bộ lọc động đa chiều (Faceted) | Public | Không | Raw MySQL Pool | `faceted-search.test.ts` | 🟡 **ISSUES** | CSDL thiếu bản ghi `attributes`, trả về mảng rỗng. |
| | `GET /api/products/:id` | Chi tiết sản phẩm, biến thể SKUs | Public | Không | Raw MySQL Pool | `route-smoke.test.ts` | 🟢 **PASS** | Nạp kèm danh sách hình ảnh và thông số. |
| **5. Catalog** | `/api/categories`, `/api/brands`| Lấy cây danh mục và thương hiệu | Public | Không | Prisma Models | `route-smoke.test.ts` | 🟢 **PASS** | Cache dữ liệu tĩnh tốt. |
| **6. Cart** | `GET /api/cart` | Xem giỏ hàng người dùng | Bearer | Customer | Raw MySQL Pool | `cart-merge.test.ts` | 🟢 **PASS** | Nạp danh sách item kèm giá và tồn kho. |
| | `POST /api/cart/items` | Thêm SKU vào giỏ | Bearer | Customer | Raw MySQL Pool | `cart-merge.test.ts` | 🟢 **PASS** | Kiểm tra giới hạn tồn kho trước khi thêm. |
| | `POST /api/cart/merge` | Gộp giỏ hàng Guest vào tài khoản | Bearer | Customer | Raw MySQL Pool | `cart-merge.test.ts` | 🟢 **PASS** (100%) | Đã xác minh xử lý duplicate và tồn kho trơn tru. |
| **7. Orders** | `POST /api/orders` | Tạo đơn hàng mới từ giỏ hàng | Bearer | Customer | Raw MySQL Pool (Tx) | `order-cancellation.test.ts` | 🟢 **PASS** | Trừ tồn kho nguyên tử trong SQL Transaction. |
| | `GET /api/orders` | Lịch sử đơn hàng của tôi | Bearer | Customer | Raw MySQL Pool | `orders.spec.ts` | 🟢 **PASS** | Phân trang và sắp xếp theo ngày tạo. |
| | `PATCH /api/orders/:id/cancel` | Khách hủy đơn hàng khi còn PENDING | Bearer | Customer / Admin | Raw MySQL Pool (Tx) | `order-cancellation.test.ts` | 🟢 **PASS** (100%) | Tự động hoàn tồn kho cho SKU ngay lập tức. |
| | `POST /api/orders/sweep-expired`| Quét đơn quá 30 phút chưa thanh toán | Internal / Cron | Admin / System | Raw MySQL Pool (Tx) | `order-cancellation.test.ts` | 🟢 **PASS** (100%) | Chuyển sang CANCELED/EXPIRED, hoàn kho an toàn. |
| **8. Shipments** | `/api/shipments` | Tạo vận đơn, mock shipping provider | Bearer | Sales Staff / Admin | Prisma / Service | `shipping-provider.test.ts` | 🟢 **PASS** | Tạo mã tracking mock chuẩn định dạng. |
| **9. Payments** | `POST /api/payments/vnpay/create-url` | Tạo URL thanh toán VNPay Sandbox | Bearer | Customer | Service Helper | `vnpay.test.ts` | 🟢 **PASS** | Tạo URL ký HMAC-SHA512 chuẩn spec VNPay. |
| | `GET /api/payments/vnpay/callback` | Xử lý redirect/IPN từ VNPay | Public | Không | Service Helper | `vnpay.test.ts` | 🟢 **PASS** | Xác thực chữ ký an toàn, không làm biến đổi object. |
| **10. PC Builder** | `POST /api/pc-builder/check-compatibility` | Kiểm tra tương thích danh sách linh kiện | Public | Không | Service Heuristics | `route-smoke.test.ts` | 🟢 **PASS** | Kiểm tra socket CPU-Mainboard, RAM, PSU. |
| | `GET /api/pc-builder/active` | Lấy cấu hình PC đang dựng | Bearer | Customer | Raw MySQL Pool | `pc-builder.spec.ts` | 🟢 **PASS** | Hỗ trợ lưu cấu hình theo tài khoản người dùng. |
| | `POST /api/pc-builder/share` | Tạo liên kết chia sẻ cấu hình | Public / User | Không | Raw MySQL Pool | Code inspection | 🔵 **IMPLEMENTED** | Sử dụng token ngẫu nhiên `share_token`. |
| **11. AI Advisor**| `POST /api/ai-advisor/recommend` | Gợi ý cấu hình PC theo ngân sách | Public | Rate Limited | AI Orchestrator | `unified-ai-orchestration.test.ts`| 🟢 **PASS** (100%) | Grounding danh mục thực, fallback rule khi thiếu key. |
| | `POST /api/ai-advisor/consult` | Tư vấn linh kiện bằng ngôn ngữ tự nhiên | Public | Rate Limited | AI Orchestrator | `unified-ai-orchestration.test.ts`| 🟢 **PASS** (100%) | Sliding window memory, token truncation an toàn. |
| **12. Warranties**| `GET /api/warranties/lookup/:serial` | Tra cứu bảo hành công khai bằng Serial | Public | Không (Exempted) | Raw MySQL Pool | `serial-numbers-warranty.test.ts`| 🟢 **PASS** (100%) | Trả về thời hạn, ngày kích hoạt, thông tin linh kiện. |
| | `POST /api/warranties/assign-serials`| Gán S/N cho đơn hàng đã xuất kho | Bearer | Sales / Tech Staff | Raw MySQL Pool | `serial-numbers-warranty.test.ts`| 🟢 **PASS** (100%) | Chống trùng S/N, bắt buộc đủ số lượng sản phẩm. |
| **13. Tickets** | `/api/tickets` | Quản lý ticket khiếu nại kỹ thuật (RMA)| Bearer | Customer / Tech | Prisma Models | `route-smoke.test.ts` | 🔵 **IMPLEMENTED** | Phân quyền xem ticket theo owner hoặc kỹ thuật viên. |
| **14. Coupons** | `POST /api/coupons/validate` | Kiểm tra và tính số tiền giảm giá | Public / User | Không | Coupons Service | `promotions-coupons.test.ts` | 🟡 **ISSUES** | CSDL thiếu bản ghi voucher seed mẫu. |
| **15. Admin** | `/api/admin/*` | Trung tâm điều hành: Quản lý SKU, duyệt thanh toán, người dùng | Bearer | Admin only | Raw MySQL Pool | Admin suite | 🔵 **IMPLEMENTED** | Kiểm tra quyền `role === 'ADMIN'` nghiêm ngặt. |

---

## 2. ĐÁNH GIÁ CƠ SỞ DỮ LIỆU & SCHEMA PRISMA

### 2.1. Danh mục bảng và Thực thể (Database Entities)
CSDL `cnm_mk_hb` trên MySQL 8.0 bao gồm **28 bảng chính**:
- **Nhóm Tài khoản & Phân quyền**: `users`, `roles`, `addresses`, `audit_logs`.
- **Nhóm Sản phẩm & Danh mục**: `products`, `product_skus`, `categories`, `brands`, `attributes`, `attribute_values`, `sku_attributes`.
- **Nhóm Giỏ hàng & Đơn hàng**: `carts`, `cart_items`, `orders`, `order_items`, `shipments`, `payments`.
- **Nhóm PC Builder & Tương thích**: `pc_builds`, `pc_build_items`, `compatibility_rules`.
- **Nhóm Bảo hành & Serial**: `warranties`, `order_item_serials`, `warranty_requests`, `warranty_request_events`, `warranty_request_attachments`, `warranty_notifications`.
- **Nhóm Khuyến mãi & Tiện ích**: `coupons`, `coupon_usages`, `notifications`, `system_settings`, `ai_chats`, `ai_messages`, `chat_sessions`, `chat_messages`, `tickets`, `ticket_messages`.

### 2.2. Tính toàn vẹn và độ chính xác dữ liệu (Data Integrity)
- **Kiểu dữ liệu tiền tệ**: Sử dụng `DECIMAL(12, 2)` cho toàn bộ các trường giá tiền (`total_price`, `unit_price`, `line_total`, `discount_amount`, `shipping_fee`, `final_amount`), ngăn chặn triệt để lỗi làm tròn dấu phẩy động (Floating Point Imprecision).
- **Ràng buộc khóa ngoại (Foreign Keys)**: Tất cả bảng quan trọng đều có foreign key ràng buộc với `ON DELETE RESTRICT` hoặc `ON DELETE CASCADE` hợp lý (ví dụ: xóa giỏ hàng xóa `cart_items`, xóa đơn hàng chặn nếu đã có `warranties` liên kết).
- **Snapshot giá & tên sản phẩm**: Bảng `order_items` lưu trữ trường `sku_snapshot` và `name_snapshot` cùng `unit_price` tại thời điểm đặt hàng. Nếu admin thay đổi giá hoặc tên sản phẩm trong tương lai, lịch sử đơn hàng cũ hoàn toàn không bị ảnh hưởng.
- **Ràng buộc duy nhất (Unique Constraints)**:
  - `warranty_code` trên bảng `warranties`.
  - `serial_number` trên bảng `order_item_serials`.
  - `code` trên bảng `coupons`.
  - `share_token` trên bảng `pc_builds`.

### 2.3. Khoảng trống dữ liệu thực tế trong CSDL hiện tại (Data Voids)
Qua kiểm tra trực tiếp trên container MySQL `cnm_mysql`, phát hiện 2 khoảng trống dữ liệu cần nạp:
1. **Bảng thuộc tính kỹ thuật**: `attributes` (0 hàng), `attribute_values` (0 hàng), `sku_attributes` (0 hàng).
2. **Bảng mã giảm giá**: `coupons` (0 hàng), `coupon_usages` (0 hàng).
