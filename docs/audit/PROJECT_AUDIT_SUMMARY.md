# BÁO CÁO TỔNG QUAN RÀ SOÁT DỰ ÁN (EXECUTIVE SUMMARY)
**Dự án**: PC Mall / Project CNM_MK-HB  
**Thời điểm thực hiện**: 23/10/2026  
**Nhóm đánh giá**: Senior Software Architecture, Full-stack, Database, Security, QA & DevOps Team  
**Tiêu chuẩn đánh giá**: Toàn diện, khách quan, dựa trên 100% bằng chứng thực nghiệm từ mã nguồn và runtime, tuân thủ nguyên tắc không sửa code trong giai đoạn audit.

---

## 1. TỔNG QUAN TÌNH TRẠNG HỆ THỐNG

| Chỉ số | Trạng thái | Đánh giá tóm tắt |
| :--- | :---: | :--- |
| **Kiến trúc & Mã nguồn** | 🟡 **CẦN TỐI ƯU** | Monorepo npm workspaces chuẩn; phân tách tầng rõ nhưng tồn tại nhiều file quá lớn (> 1.500 - 2.900 dòng) và sự phân mảnh giữa Prisma ORM và Raw MySQL Pool. |
| **Biên dịch Frontend** | 🟢 **PASS** | `apps/web` (React 19 + Vite 6) build thành công 100% trong 6.69s, 12 chunks tách biệt. |
| **Kiểm tra Kiểu Backend** | 🟢 **PASS** | `services/api` (TypeScript + Express) đạt 0 lỗi typecheck (`tsc --noEmit`). |
| **Cơ sở dữ liệu** | 🟡 **THIẾU SEED ATTRIBUTES** | MySQL 8.0 container (`cnm_mysql`) hoạt động tốt trên cổng `3308`. Schema Prisma đồng bộ 100%. Tuy nhiên các bảng `attributes`, `attribute_values`, `sku_attributes` đang có 0 records, làm tê liệt tính năng lọc động đa chiều (Faceted Search). |
| **Kiểm thử tự động** | 🟡 **PASS 13 / 17 SUITES** | Các core flow (AI Orchestration, Cart Merge, Serial Numbers, Inventory Restore, VNPay, Health) PASS 100%. Test suite bị nghẽn (hang) do thiếu teardown đóng connection pool. |
| **Bảo mật ứng dụng** | 🔴 **CẢNH BÁO** | Tồn tại credential thực (App Password Gmail) trong local `.env`; cơ chế bypass auth bằng chuỗi `.includes()` trong middleware tiềm ẩn rủi ro. |
| **Sẵn sàng Production (Docker/CI)** | 🔴 **CHƯA ĐẠT (P0)** | Tệp `docker-compose.prod.yml` bị cấu hình sai nghiêm trọng khi dùng PostgreSQL trong khi toàn bộ dự án viết cho MySQL 8.0, dẫn đến container `cnm_api_prod` bị crash loop (Unhealthy). |

---

## 2. NHỮNG PHÁT HIỆN QUAN TRỌNG NHẤT (KEY FINDINGS)

### 🔴 Khối Lỗi Nghiêm Trọng (P0 - Critical)
1. **[AUD-001] Mâu thuẫn hệ quản trị CSDL trong Docker Production**:
   - `docker-compose.prod.yml` khai báo service `postgres:16-alpine` và chuỗi kết nối `postgresql://...`.
   - Toàn bộ backend (`schema.prisma` và `src/config/database.js`) chỉ chạy trên MySQL (`provider = "mysql"`, driver `mysql2`).
   - Hậu quả: Container production `cnm_api_prod` hiện đang ở trạng thái `unhealthy` và crash liên tục.

### 🟠 Khối Lỗi Mức Độ Cao (P1 - High)
2. **[AUD-002] Lộ thông tin nhạy cảm trong cấu hình môi trường**:
   - Tệp `services/api/.env` chứa mật khẩu ứng dụng Gmail thực tế (`MAIL_PASS=giqhiefrbnqafoul`).
   - Cần thu hồi (revoke) ngay lập tức và chuyển sang cơ chế quản lý secret an toàn.
3. **[AUD-003] Thiếu dữ liệu đặc tính kỹ thuật linh kiện (Attributes Data Void)**:
   - Các bảng `attributes`, `attribute_values`, `sku_attributes` trong CSDL hiện tại có 0 bản ghi.
   - Hậu quả: Bộ lọc tìm kiếm đa chiều (Faceted Search) trên trang danh mục trả về rỗng; luật tương thích chi tiết không có dữ liệu đối chiếu.

### 🟡 Khối Vấn Đề Trung Bình & Kiến Trúc (P2 - Medium)
4. **[AUD-004] Sự phân mảnh giữa Prisma ORM và Raw MySQL2 Connection Pool**:
   - Dự án dùng song song 2 cơ chế truy vấn DB: Một số module dùng Prisma Client, trong khi các module lõi (`orders.service.js`, `cart.service.js`, `pc-builder.service.ts`) dùng raw SQL pool.
   - Hậu quả: Không thể wrap transaction xuyên suốt giữa 2 cơ chế; schema thay đổi không được typecheck tự động ở các file JS raw SQL.
5. **[AUD-005] Test Runner bị treo do rò rỉ Connection Pool**:
   - Các file test tích hợp CSDL thiếu hook `after(async () => await pool.end())`, giữ active handle socket khiến lệnh `npm test` không thể tự thoát.
6. **[AUD-006] Các Component Frontend và Service quá khổ (Monolithic Source Files)**:
   - `PcBuilderPage.jsx`: 2.919 dòng; `pc-builder.service.ts`: 2.146 dòng; `CheckoutPage.jsx`: 2.029 dòng; `ai.service.js`: 1.941 dòng; `orders.service.js`: 1.824 dòng.
7. **[AUD-007] Cơ chế miễn trừ xác thực bằng Path Includes trong Auth Middleware**:
   - Dòng 13 tệp `auth.middleware.ts` dùng `req.path.includes("/warranties/lookup/") || req.path.includes("/ai-advisor/")` để bỏ qua JWT check, tiềm ẩn nguy cơ path manipulation.
8. **[AUD-008] Frontend Dockerfile dùng `vite preview`**:
   - `apps/web/Dockerfile` dùng lệnh `vite preview` thay vì web server công nghiệp (Nginx tĩnh), không đảm bảo hiệu năng và bảo mật khi scale.

---

## 3. GIẢI MÃ NGUYÊN NHÂN LỖI NODE.JS / PRISMA TRONG PHIÊN LÀM VIỆC (GIAI ĐOẠN 10)

Trong phiên làm việc, lệnh kiểm tra Prisma qua CLI:
```bash
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(...); prisma.$connect().then(...)"
```
bị báo lỗi `SyntaxError: Unexpected token '('` và `Expected ident`.

**Kết luận điều tra độc lập**:
- **Nguyên nhân**: **Lỗi Shell Quoting / Variable Interpolation trong PowerShell (Loại B)**.
- **Bằng chứng thực nghiệm**: Khi chuỗi lệnh được bọc trong dấu nháy kép `""`, PowerShell đã tự động nhận diện `$connect` là một biến môi trường / biến PowerShell. Do biến này chưa được gán giá trị, PowerShell đã thay thế nó bằng chuỗi rỗng `""`. Kết quả là Node.js nhận được đoạn code: `prisma.().then(...)` dẫn đến lỗi cú pháp ngay lập tức.
- Khi kiểm tra bằng lệnh không chứa ký hiệu `$`:
  `prisma.user.count().then(c => console.log('USER COUNT:', c))`
  -> Kết quả trả về ngay lập tức: `PRISMA CONNECTED, USER COUNT: 4` (Exit code: 0).
- Khẳng định: **Prisma Client, schema và database hoàn toàn tương thích và kết nối trơn tru.**

---

## 4. ĐÁNH GIÁ MỨC ĐỘ SẴN SÀNG (READINESS SCORECARD)

| Mục tiêu | Mức độ | Đánh giá chi tiết |
| :--- | :---: | :--- |
| **Demo Giảng viên / Đồ án** | 🟢 **SẴN SÀNG (90%)** | Toàn bộ luồng nghiệp vụ khách hàng (Xem sản phẩm, Build PC tương thích, Giỏ hàng, Đặt hàng VNPay Sandbox/COD, Tra cứu Serial & Bảo hành, Chat AI tư vấn có fallback) hoạt động mượt mà trên môi trường Local. |
| **UAT (Kiểm thử người dùng)** | 🟡 **ĐIỀU KIỆN (75%)** | Cần chạy seed nạp bảng `attributes` để bộ lọc danh mục và gợi ý tương thích hiển thị đầy đủ thông số; bổ sung voucher mẫu. |
| **Production Launch** | 🔴 **CHƯA ĐỦ ĐIỀU KIỆN (45%)** | Bắt buộc phải sửa `docker-compose.prod.yml` về MySQL 8.0, cấu hình Nginx phục vụ web tĩnh, và chuyển đổi credentials sang biến môi trường bí mật của server. |

---

## 5. DANH SÁCH BÁO CÁO CHI TIẾT TRONG BỘ AUDIT

Để nắm bắt toàn bộ chi tiết kỹ thuật, vui lòng tham khảo các báo cáo chuyên đề đính kèm trong thư mục `docs/audit/`:
1. [PROJECT_ARCHITECTURE_AUDIT.md](file:///d:/Project%20CNM_MK-HB/docs/audit/PROJECT_ARCHITECTURE_AUDIT.md) — Phân tích kiến trúc hệ thống, ranh giới module, coupling và code smell.
2. [MODULE_COMPLETION_MATRIX.md](file:///d:/Project%20CNM_MK-HB/docs/audit/MODULE_COMPLETION_MATRIX.md) — Ma trận đo lường chi tiết mức độ hoàn thiện của từng chức năng trên 7 khía cạnh (Code, UI, API, DB, Validation, Auth, Test).
3. [API_AND_DATABASE_AUDIT.md](file:///d:/Project%20CNM_MK-HB/docs/audit/API_AND_DATABASE_AUDIT.md) — Bản đồ 20 nhóm API endpoint, đánh giá schema Prisma, khóa ngoại, chỉ mục và rủi ro truy vấn.
4. [SECURITY_AUDIT.md](file:///d:/Project%20CNM_MK-HB/docs/audit/SECURITY_AUDIT.md) — Báo cáo rà soát an toàn thông tin, RBAC, IDOR, SQL injection, secrets và rate limiting.
5. [TESTING_AND_PRODUCTION_READINESS.md](file:///d:/Project%20CNM_MK-HB/docs/audit/TESTING_AND_PRODUCTION_READINESS.md) — Báo cáo kết quả kiểm thử thực tế, phân tích Docker, CI/CD và checklist triển khai.
6. [ISSUES_AND_REMEDIATION_PLAN.md](file:///d:/Project%20CNM_MK-HB/docs/audit/ISSUES_AND_REMEDIATION_PLAN.md) — Sổ đăng ký sự cố (Issue Register từ AUD-001 đến AUD-012) kèm lộ trình khắc phục 4 giai đoạn ưu tiên.
