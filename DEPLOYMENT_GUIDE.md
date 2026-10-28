# HƯỚNG DẪN TRIỂN KHAI VÀ KHỞI CHẠY HỆ THỐNG PC MALL

## 1. Khởi Chạy Nhanh Cho Lập Trình Viên (1-Click Bootstrap PowerShell)
Dự án được trang bị sẵn kịch bản khởi chạy tự động `scripts/bootstrap.ps1`. Chỉ cần chạy 1 câu lệnh duy nhất từ thư mục gốc:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1
```

Script sẽ tự động:
- Kiểm tra & tạo file môi trường `.env` nếu chưa có.
- Cài đặt đầy đủ các gói thư viện Node.js (`npm install`).
- Khởi tạo Prisma Client cho Backend API (`prisma generate`).
- Cập nhật số lượng tồn kho linh kiện thực tế (`stock:ensure`).
- Khởi động cả Server Backend (Port 4000) và Web Frontend (Port 5173).

---

## 2. Khởi Chạy Bằng Docker Compose (Production / Staging Server)
Dự án được đóng gói hoàn chỉnh bằng Docker với 4 dịch vụ container:
- `cnm_mysql`: Database MySQL 8.0 (Port 3308).
- `cnm_phpmyadmin`: Trình quản lý DB phpMyAdmin (Port 8080).
- `cnm_api`: Backend Server Node.js Express (Port 4000).
- `cnm_web`: Frontend App React Vite (Port 5173).

Khởi chạy toàn bộ hệ thống bằng Docker Compose:
```bash
docker-compose up -d --build
```

Kiểm tra trạng thái các container:
```bash
docker-compose ps
```

Tắt hệ thống container:
```bash
docker-compose down
```

---

## 3. Cấu Hình Biến Môi Trường (.env)

| Biến Môi Trường | Mô Tả | Ví Dụ |
|------------------|-------|-------|
| `PORT` | Cổng dịch vụ API | `4000` |
| `DATABASE_URL` | Chuỗi kết nối MySQL Database | `mysql://root:password@127.0.0.1:3308/cnm_mk_hb` |
| `JWT_SECRET` | Khóa bí mật mã hóa Token đăng nhập | `your-secret-jwt-key` |
| `GEMINI_API_KEY` | Key AI Google Gemini cho AI Advisor | `AIzaSy...` |
| `SENTRY_DSN` | URL Sentry Error Tracking (Tùy chọn) | `https://xxxx@sentry.io/12345` |
| `VITE_API_BASE_URL` | Đường dẫn API cho Frontend Web | `http://localhost:4000/api` |

---

## 4. Các Lệnh Kiểm Thử Hệ Thống (QA & Tests)

- **Kiểm tra kiểu dữ liệu TypeScript Backend**:
  ```bash
  cd services/api && npx tsc --noEmit
  ```

- **Kiểm tra đóng gói Frontend (Code-Splitting)**:
  ```bash
  cd apps/web && npx vite build
  ```

- **Chạy kịch bản kiểm thử tự động Playwright E2E**:
  ```bash
  npx playwright test e2e/pc-builder-qa-checklist.spec.ts
  ```
