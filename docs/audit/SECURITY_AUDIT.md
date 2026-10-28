# BÁO CÁO RÀ SOÁT BẢO MẬT ỨNG DỤNG (APPLICATION SECURITY AUDIT)
**Dự án**: PC Mall / Project CNM_MK-HB  
**Phạm vi rà soát**: Quản lý bí mật (Secrets), Xác thực & Phân quyền (Auth & RBAC), Chống tấn công tiêm nhiễm (SQLi/XSS), Kiểm soát truy cập đối tượng (IDOR/BOLA), Giới hạn tần suất (Rate Limiting) & Cấu hình Header an toàn.  
**Phương pháp**: Phân tích tĩnh (Static Code Analysis), Rà soát cấu hình phòng thủ, Không thực hiện tấn công phá hoại.

---

## 1. QUẢN LÝ BÍ MẬT & BIẾN MÔI TRƯỜNG (SECRETS MANAGEMENT)

### 🔴 Phát hiện AUD-SEC-02: Tồn tại Mật khẩu ứng dụng thực tế trong local .env
- **Vị trí**: [services/api/.env](file:///d:/Project%20CNM_MK-HB/services/api/.env), dòng 22–23.
- **Hiện trạng**: Tệp chứa cấu hình tài khoản Gmail và Mật khẩu ứng dụng SMTP (App Password) thực tế dạng plaintext (`MAIL_PASS=giqhiefrbnqafoul`).
- **Đánh giá rủi ro**:
  - Tệp `.env` đã được cấu hình trong [.gitignore](file:///d:/Project%20CNM_MK-HB/.gitignore) và lệnh `git ls-files services/api/.env` xác nhận tệp **CHƯA BỊ TRACK TRÊN GIT REPOSITORY**.
  - Tuy nhiên, việc lưu trữ mật khẩu ứng dụng thực tế trên máy trạm cục bộ trong mã nguồn dự án vi phạm nguyên tắc bảo mật. Nếu developer vô tình dùng lệnh `git add -f` hoặc chia sẻ thư mục dự án qua zip, credential sẽ bị lộ ra ngoài.
- **Biện pháp khắc phục**: Thu hồi (revoke) App Password ngay trên Google Account; thay thế bằng chuỗi giả định hoặc dùng dịch vụ gửi mail mock (Ethereal Email / Mailtrap) trong môi trường phát triển.

### 🟢 Bảo vệ khóa bí mật JWT
- Tại [services/api/src/config/env.js](file:///d:/Project%20CNM_MK-HB/services/api/src/config/env.js), hàm `getProductionSecret()` áp dụng cơ chế kiểm tra nghiêm ngặt khi `NODE_ENV === "production"`:
  - Bắt buộc độ dài bí mật tối thiểu **24 ký tự**.
  - Chặn các chuỗi mặc định không an toàn (`change_me_access`, `your_*`, `replace_*`).
  - Ném ngoại lệ và dừng server ngay lập tức nếu phát hiện secret yếu.

---

## 2. XÁC THỰC VÀ PHÂN QUYỀN (AUTHENTICATION & RBAC)

### 2.1. Quản lý Mật khẩu & Token
- **Băm mật khẩu (Password Hashing)**: Sử dụng thư viện `bcryptjs` với độ muối (salt rounds) chuẩn công nghiệp là **10**, đảm bảo an toàn chống Rainbow Table và Brute Force.
- **Cơ chế Token kép (Dual Token System)**:
  - `Access Token`: Thời hạn ngắn (15 phút ở production / 7 ngày ở dev) dùng để xác thực nhanh trên từng request.
  - `Refresh Token`: Thời hạn dài (7 ngày ở production / 30 ngày ở dev) dùng để cấp mới Access Token tại endpoint `/api/auth/refresh`.

### 2.2. Kiểm tra Rủi ro Phân quyền (RBAC & Broken Access Control)

#### 🟡 Phát hiện AUD-SEC-01: Cơ chế miễn trừ xác thực bằng Path Includes trong Middleware
- **Vị trí**: [services/api/src/middlewares/auth.middleware.ts](file:///d:/Project%20CNM_MK-HB/services/api/src/middlewares/auth.middleware.ts), dòng 13–15:
  ```typescript
  // Public route exemptions
  if (req.path.includes("/warranties/lookup/") || req.path.includes("/ai-advisor/")) {
    return next();
  }
  ```
- **Rủi ro**: Sử dụng phương thức `.includes()` trên chuỗi đường dẫn `req.path` để bỏ qua kiểm tra đăng nhập là một anti-pattern. Kẻ tấn công có thể cố tình tạo ra các URL chứa đoạn chuỗi này (ví dụ `/api/orders/ai-advisor/test` hoặc lợi dụng proxy rewrite) để né tránh middleware xác thực.
- **Khuyến nghị**: Loại bỏ kiểm tra `.includes()` trong middleware chung. Chỉ áp dụng middleware `authenticate` trực tiếp lên các route cần bảo vệ trong định nghĩa Router.

#### 🟢 Kiểm soát IDOR / BOLA (Insecure Direct Object Reference)
- Đã kiểm tra các endpoint thao tác dữ liệu nhạy cảm:
  - `GET /api/orders/:id`: Kiểm tra `order.user_id === req.user.id` hoặc `req.user.role === 'ADMIN'`. Khách hàng không thể xem đơn của người khác bằng cách đổi ID trên URL.
  - `PATCH /api/auth/me/addresses/:id`: Kiểm tra quyền sở hữu địa chỉ trước khi sửa hoặc xóa.
  - `GET /api/cart`: Lấy trực tiếp `cart` liên kết với `req.user.id` từ token, hoàn toàn không nhận `cart_id` do client gửi lên.

---

## 3. RÀ SOÁT TIÊM NHIỄM (INJECTION & INPUT VALIDATION)

### 🟢 SQL Injection
- Rà soát toàn bộ các câu lệnh SQL viết tay trong các module `orders.service.js`, `cart.service.js`, `pc-builder.service.ts`, `admin.service.js`:
  - 100% các câu lệnh đều sử dụng **Prepared Statements với Parameterized Queries** (`pool.execute(sql, [param1, param2])` hoặc `?` placeholders).
  - Không tìm thấy bất kỳ hành vi nối chuỗi trực tiếp dữ liệu đầu vào từ người dùng vào câu lệnh SQL (`sql + req.body.input`).

### 🟢 Cross-Site Scripting (XSS)
- Frontend được xây dựng hoàn toàn bằng React 19 với JSX data-binding tự động encode ký tự HTML.
- Không phát hiện việc sử dụng không an toàn hàm `dangerouslySetInnerHTML` đối với dữ liệu người dùng nhập.

---

## 4. GIỚI HẠN TẦN SUẤT & BẢO VỆ DỊCH VỤ (RATE LIMITING & SECURITY HEADERS)

- **Helmet Security Headers**: Được kích hoạt tại [services/api/src/app.ts](file:///d:/Project%20CNM_MK-HB/services/api/src/app.ts), tự động bổ sung các HTTP headers phòng thủ: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, chặn clickjacking.
- **CORS (Cross-Origin Resource Sharing)**: Cấu hình giới hạn chỉ cho phép origin từ `env.frontendUrl` và `http://localhost:5173`.
- **Bộ lọc giới hạn tần suất (Rate Limiter Middleware)**:
  - `generalApiLimiter`: 300 requests / 15 phút cho toàn bộ API.
  - `authRateLimiter`: 10 requests / 15 phút cho `/api/auth/login` và `/api/auth/register`, chống brute-force mật khẩu.
  - `aiRateLimiter`: 30 requests / 15 phút cho `/api/ai-advisor`, `/api/ai`, `/api/chat`, bảo vệ tài nguyên tính toán và hạn ngạch LLM.

---

## 5. TỔNG KẾT ĐÁNH GIÁ BẢO MẬT

| Tiêu chuẩn an toàn | Trạng thái | Đánh giá |
| :--- | :---: | :--- |
| **SQL Injection Defense** | 🟢 **AN TOÀN** | 100% Parameterized queries & Prisma ORM. |
| **XSS & Content Security** | 🟢 **AN TOÀN** | React auto-escaping, Helmet headers. |
| **Password Hashing** | 🟢 **AN TOÀN** | Bcrypt 10 rounds salt. |
| **Rate Limiting / DoS** | 🟢 **AN TOÀN** | Express-rate-limit 3 cấp độ. |
| **IDOR / Access Control** | 🟢 **AN TOÀN** | Ownership check nghiêm ngặt trên Order/Cart/Profile. |
| **Secrets & Keys Hygiene** | 🔴 **CẦN XỬ LÝ** | Thu hồi và xóa Gmail app password trong local `.env`. |
| **Route Bypass Resilience**| 🟡 **CẦN TỐI ƯU** | Bỏ `req.path.includes()` trong `auth.middleware.ts`. |
