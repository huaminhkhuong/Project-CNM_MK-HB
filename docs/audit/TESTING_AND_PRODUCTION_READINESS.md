# BÁO CÁO KIỂM THỬ VÀ ĐÁNH GIÁ SẴN SÀNG TRIỂN KHAI PRODUCTION (TESTING & PRODUCTION READINESS)
**Dự án**: PC Mall / Project CNM_MK-HB  
**Đối tượng rà soát**: Toàn bộ Test Suite Tự động (Unit, Integration, E2E), Cấu hình Docker, CI/CD Pipeline & Khả năng vận hành Production.

---

## 1. KẾT QUẢ KIỂM THỬ THỰC TẾ (AUTOMATED TEST SUITE REPORT)

Hệ thống sở hữu bộ test tích hợp toàn diện gồm **17 tệp kiểm thử** trong thư mục [services/api/tests/](file:///d:/Project%20CNM_MK-HB/services/api/tests/) chạy qua Node.js Native Test Runner (`tsx --test`).

### 1.1. Bảng tổng hợp kết quả chạy kiểm thử thực tế

| Tệp kiểm thử (Test Suite) | Số lượng Subtests | Trạng thái thực tế | Thời gian chạy | Kết luận & Ghi nhận kỹ thuật |
| :--- | :---: | :---: | :---: | :--- |
| `auth.smoke.test.ts` | 2 subtests | 🟢 **PASS** | 71ms | Cấp mới token từ refresh token hợp lệ thành công. |
| `cart-merge.test.ts` | 1 subtest | 🟢 **PASS** | 812ms | Gộp giỏ hàng khách vãng lai, giới hạn tồn kho chuẩn. |
| `chat-config.test.ts` | 2 subtests | 🟢 **PASS** | 6ms | Nạp cấu hình storage đường dẫn chat chính xác. |
| `chat-handoff-routing.test.ts` | 3 subtests | 🟢 **PASS** | 121ms | Chuyển giao AI sang nhân viên, tóm tắt ngữ cảnh chuẩn. |
| `health.test.ts` | 1 subtest | 🟢 **PASS** | 141ms | Endpoint `/api/health` trả về 200 OK và probe MySQL. |
| `route-smoke.test.ts` | 4 subtests | 🟢 **PASS** | 96ms | Kiểm tra 401 unauthorized trên các route nhạy cảm. |
| `shipping-provider.test.ts` | 2 subtests | 🟢 **PASS** | 2ms | Tạo mã vận đơn mock tự động thành công. |
| `vnpay.test.ts` | 2 subtests | 🟢 **PASS** | 5ms | Kiểm tra xác thực chữ ký HMAC-SHA512 an toàn. |
| `order-cancellation-inventory.test.ts` | 3 subtests | 🟢 **PASS** | 306ms | **Khắc phục triệt để rò rỉ tồn kho**: Hoàn kho nguyên tử khi hủy đơn hoặc timeout 30 phút. |
| `unified-ai-orchestration.test.ts` | 11 subtests | 🟢 **PASS** | 228ms | **11/11 subtests PASS**: Quản lý prompts, token truncation, memory sliding-window, fallback heuristics. |
| `serial-numbers-warranty.test.ts` | 5 subtests | 🟢 **PASS** | 301ms | **5/5 subtests PASS**: Gán S/N, kích hoạt bảo hành khi giao hàng, tra cứu S/N công khai. |
| `warranty-master-data.test.ts` | 4 subtests | 🟢 **PASS** | 240ms | Phân giải thời hạn bảo hành theo thứ cấp ưu tiên. |
| `compatibility-rules-engine.test.ts` | 4 subtests | 🟢 **PASS** | 180ms | Đánh giá luật tương thích phần cứng chi tiết. |
| `faceted-search.test.ts` | 3 subtests | 🔴 **FAIL** | 362ms | Thất bại do bảng `attributes` trong CSDL hiện tại có 0 hàng. |
| `promotions-coupons.test.ts` | 4 subtests | 🔴 **FAIL** | 132ms | Thất bại do bảng `coupons` trong CSDL chưa có dữ liệu seed. |
| `product-variants-skus-unification.test.ts` | 2 subtests | 🟢 **PASS** | 190ms | Đồng nhất quan hệ 1-N giữa Product và ProductSku. |
| `payment-timeout.test.ts` | 2 subtests | 🟢 **PASS** | 150ms | Quét đơn hàng quá hạn thanh toán tự động. |

### 1.2. Phân tích nguyên nhân sự cố Test Runner bị treo (Hanging Test Suite)
- **Hiện tượng**: Khi chạy toàn bộ test bằng lệnh `npm test -w services/api`, quá trình chạy bị dừng vô hạn sau một số test case dù các bài test đã pass.
- **Bằng chứng xác minh**:
  - Khi mở kết nối MySQL thông qua `getDbPool()` trong các file test tích hợp (như `order-cancellation-inventory.test.ts`, `serial-numbers-warranty.test.ts`), thư viện `mysql2` duy trì active socket connections trong connection pool.
  - Các file test này **thiếu hook dọn dẹp (Teardown hook)**:
    ```typescript
    after(async () => {
      await getDbPool().end();
    });
    ```
  - Hậu quả: Node.js Event Loop không thể kết thúc tiến trình vì vẫn còn active socket handles đang lắng nghe.

---

## 2. KIỂM THỬ ĐẦU-CUỐI (E2E PLAYWRIGHT TESTS)

Dự án trang bị 5 kịch bản kiểm thử E2E trong thư mục [e2e/](file:///d:/Project%20CNM_MK-HB/e2e/):
1. `auth.spec.ts`: Đăng nhập, đăng ký, validate form.
2. `checkout.spec.ts`: Đặt hàng từ giỏ, chọn phương thức thanh toán.
3. `pc-builder-qa-checklist.spec.ts`: Toàn bộ checklist kiểm tra PC Builder theo đặc tả QA.
4. `pc-builder-user-journey.spec.ts`: Hành trình người dùng chọn linh kiện và áp dụng cấu hình AI.
5. `products.spec.ts`: Tìm kiếm sản phẩm, xem chi tiết, thêm giỏ.

- Cấu hình Playwright tại [playwright.config.ts](file:///d:/Project%20CNM_MK-HB/playwright.config.ts) trỏ về `http://localhost:5173`.
- Yêu cầu môi trường: Cần khởi động cả Backend (cổng 4000) và Frontend (cổng 5173) trước khi chạy lệnh `npm run test:e2e`.

---

## 3. RÀ SOÁT DOCKER VÀ SẴN SÀNG TRIỂN KHAI (DEVOPS AUDIT)

### 3.1. Rà soát Dockerfiles
- **Backend ([services/api/Dockerfile](file:///d:/Project%20CNM_MK-HB/services/api/Dockerfile))**:
  - Base image: `node:20-alpine`.
  - Quy trình build: `npm ci --workspace services/api`, chạy `prisma:generate`, export cổng 4000.
  - Đánh giá: Gọn nhẹ, hỗ trợ multi-stage build hợp lệ.
- **Frontend ([apps/web/Dockerfile](file:///d:/Project%20CNM_MK-HB/apps/web/Dockerfile))**:
  - ⚠️ **Vấn đề AUD-OPS-02**: Sử dụng lệnh chạy `CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]`.
  - Khuyến nghị: Trong môi trường production thực sự, mã nguồn frontend sau khi build (`apps/web/dist`) phải được phục vụ qua **Nginx** tĩnh để tối ưu hóa caching, nén gzip/brotli và giảm tải CPU.

### 3.2. Rà soát Docker Compose & Xung đột CSDL nghiêm trọng
- **Môi trường Local ([docker-compose.yml](file:///d:/Project%20CNM_MK-HB/docker-compose.yml))**:
  - Sử dụng MySQL 8.0 (`image: mysql:8.0`), mở cổng host `3308:3306`, container `cnm_mysql`.
  - Đã kiểm tra thực tế: Container đang chạy khỏe mạnh (Healthy).
- **Môi trường Production ([docker-compose.prod.yml](file:///d:/Project%20CNM_MK-HB/docker-compose.prod.yml)) — PHÁT HIỆN LỖI P0 (CRITICAL)**:
  - Khai báo: `postgres:16-alpine`, biến môi trường `DATABASE_URL: postgresql://...`.
  - Toàn bộ backend được viết dựa trên Prisma provider `mysql` và thư viện `mysql2`.
  - Bằng chứng thực tế: Container `cnm_api_prod` trong Docker hiện tại bị **Unhealthy** với thông báo lỗi:
    `Can't reach database server at mysql:3306 ... status: 503`.
  - **Khắc phục bắt buộc**: Đồng bộ lại `docker-compose.prod.yml` sang MySQL 8.0.

### 3.3. Rà soát Quy trình CI/CD (.github/workflows/ci.yml)
- Tệp CI [.github/workflows/ci.yml](file:///d:/Project%20CNM_MK-HB/.github/workflows/ci.yml) được cấu hình rất chỉn chu:
  - Kích hoạt trên nhánh `main`, `develop` và các Pull Requests.
  - Chạy service container `mysql:8.0` trên cổng 3306 kèm healthcheck `mysqladmin ping`.
  - Các bước tự động: `npm install` -> `prisma:generate` -> `prisma:push` -> `seed:production` -> `npm run build` -> `npm test -w services/api`.
  - Có cơ chế dump log lỗi test ra `GITHUB_STEP_SUMMARY` khi test thất bại để dễ dàng gỡ lỗi.
