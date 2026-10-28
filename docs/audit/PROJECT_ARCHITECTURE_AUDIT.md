# BÁO CÁO RÀ SOÁT KIẾN TRÚC VÀ CẤU TRÚC MÃ NGUỒN (PROJECT ARCHITECTURE AUDIT)
**Dự án**: PC Mall / Project CNM_MK-HB  
**Đối tượng rà soát**: Cấu trúc Monorepo, Phân lớp Backend/Frontend, Ranh giới Module, Mức độ ghép nối (Coupling) & Khả năng bảo trì (Maintainability)

---

## 1. CẤU TRÚC MONOREPO TỔNG THỂ

Dự án sử dụng cơ chế **npm workspaces** nguyên bản của Node.js, khai báo trong [package.json](file:///d:/Project%20CNM_MK-HB/package.json):

```json
{
  "name": "cnm-mk-hb",
  "workspaces": [
    "apps/*",
    "services/*",
    "packages/*"
  ]
}
```

### 1.1. Bố cục không gian làm việc (Workspaces Layout)

```
Project-CNM_MK-HB/
├── apps/
│   └── web/                     # Frontend Client: React 19, Vite 6, React Router v7
├── services/
│   └── api/                     # Backend Server: Node.js 20+, Express 4.x, TypeScript/TSX, Prisma 6.6
├── packages/
│   └── shared/                  # Thư viện chia sẻ hằng số (constants) và enum (ROLES, STATUSES)
├── infra/
│   └── docker/                  # Docker compose & cấu hình phụ trợ
├── nginx/                       # Cấu hình reverse proxy HTTP & HTTPS (SSL)
├── scripts/                     # Kịch bản bootstrap, migration, seeding & smoke tests
└── docs/                        # Tài liệu đặc tả kỹ thuật, hướng dẫn & audit
```

### 1.2. Đánh giá ưu điểm kiến trúc monorepo
- **Tập trung hóa quản lý**: Tất cả mã nguồn từ Frontend, Backend đến Database Schema và DevOps config được lưu trữ thống nhất trong 1 repository, giúp kiểm soát phiên bản đồng bộ.
- **Tận dụng workspace dependency**: Sử dụng `packages/shared` để chia sẻ các hằng số dùng chung giữa Frontend và Backend (như danh sách Role `ROLES`, trạng thái đơn hàng `ORDER_STATUS`).

---

## 2. PHÂN TÍCH KIẾN TRÚC FRONTEND (APPS/WEB)

### 2.1. Cấu trúc thư mục nguồn `apps/web/src`
- `components/`: Chứa các component UI dùng chung (`common/`, `marketplace/`, `pc-builder/`, `notifications/`).
- `layouts/`: Chứa 4 Shell Layout phân quyền: `PublicLayout.jsx`, `AdminLayout.jsx`, `StaffLayout.jsx`, `TechLayout.jsx`.
- `pages/`: Phân nhóm theo 4 phân hệ Actor:
  - `public/`: 19 màn hình (Home, Catalog, Detail, Compare, Builder, Cart, Checkout, Profile, Orders, v.v.).
  - `admin/`: 9 màn hình quản trị (Dashboard, System, Products, SKUs, Attributes, Users, PaymentApproval, CompatibilityRules).
  - `staff/`: 2 màn hình tác nghiệp (StaffOrdersPage, StaffChatPage).
  - `tech/`: 3 màn hình kỹ thuật (TechTicketsPage, TechCompatibilityPage, TechWarrantiesPage).
- `services/`: Lớp tương tác HTTP API (Axios wrapper: `auth.service.js`, `cart.service.js`, `catalog.service.js`, `order.service.js`, `pc-builder.service.js`, `chat.service.js`, `coupon.service.js`, `notification.service.js`).
- `hooks/`: `useAuth.js`, custom hooks.
- `store/`: Quản lý Auth State bằng mô hình Custom Event Listener (Vanilla JS Store) trong `auth.store.js`.

### 2.2. Điểm yếu kiến trúc Frontend
1. **Hiện tượng Component nguyên khối (Monolithic Giant Components)**:
   - Các trang nghiệp vụ trọng điểm gánh vác quá nhiều trách nhiệm (vừa quản lý local state, vừa fetch API, vừa xử lý logic tính toán, vừa render hàng nghìn dòng JSX):
     - [PcBuilderPage.jsx](file:///d:/Project%20CNM_MK-HB/apps/web/src/pages/public/PcBuilderPage.jsx): **2.919 dòng** code.
     - [CheckoutPage.jsx](file:///d:/Project%20CNM_MK-HB/apps/web/src/pages/public/CheckoutPage.jsx): **2.029 dòng** code.
     - [AdminDashboardPage.jsx](file:///d:/Project%20CNM_MK-HB/apps/web/src/pages/admin/AdminDashboardPage.jsx): **1.729 dòng** code.
     - [AiChatPage.jsx](file:///d:/Project%20CNM_MK-HB/apps/web/src/pages/public/AiChatPage.jsx): **1.552 dòng** code.
   - **Tác động**: Gây khó khăn lớn cho việc bảo trì, debug và tăng nguy cơ re-render không cần thiết.
2. **Quản lý trạng thái phân tán**:
   - Auth state được quản lý qua `auth.store.js` (custom event listener).
   - Cart state được quản lý qua storage helpers (`guestStorage.js`) và local state trong `CartPage.jsx` / `CheckoutPage.jsx`.
   - Thiếu một State Management chuẩn mực (như Zustand hoặc Redux Toolkit) để đồng bộ trạng thái giỏ hàng realtime trên thanh Header khi thêm sản phẩm ở trang danh mục hoặc PC Builder.

---

## 3. PHÂN TÍCH KIẾN TRÚC BACKEND (SERVICES/API)

### 3.1. Cấu trúc phân tầng
Backend được tổ chức theo mô hình **Modular Architecture**:
- `src/config/`: Nạp cấu hình môi trường ([env.ts](file:///d:/Project%20CNM_MK-HB/services/api/src/config/env.ts)), cơ sở dữ liệu ([database.js](file:///d:/Project%20CNM_MK-HB/services/api/src/config/database.js)), Prisma Client ([prisma.ts](file:///d:/Project%20CNM_MK-HB/services/api/src/config/prisma.ts)).
- `src/middlewares/`: Xác thực JWT ([auth.middleware.ts](file:///d:/Project%20CNM_MK-HB/services/api/src/middlewares/auth.middleware.ts)), xử lý lỗi tập trung ([error.middleware.ts](file:///d:/Project%20CNM_MK-HB/services/api/src/middlewares/error.middleware.ts)), giới hạn tần suất ([rate-limiter.middleware.ts](file:///d:/Project%20CNM_MK-HB/services/api/src/middlewares/rate-limiter.middleware.ts)).
- `src/modules/`: Phân chia theo 18 domain nghiệp vụ (auth, catalog, products, cart, orders, pc-builder, compatibility, ai, ai-advisor, chat, warranties, serials, coupons, notifications, shipments, payments, tickets, admin, staff).
- `src/routes/`: Router tổng hợp điều hướng tại [index.ts](file:///d:/Project%20CNM_MK-HB/services/api/src/routes/index.ts).

### 3.2. Vấn đề kiến trúc cốt lõi: Phân mảnh tầng dữ liệu (Dual Data Access Layer)
Đây là **vấn đề kiến trúc nổi cộm nhất** của Backend:
- **Tầng Prisma ORM (TypeScript)**: Được áp dụng cho các module mới như `ai-orchestrator.service.ts`, `catalog.repository.ts`, `cart.repository.ts`, `orders.repository.ts`.
- **Tầng Raw MySQL Pool (JavaScript / TypeScript)**: Được áp dụng cho hầu hết logic nghiệp vụ chính trong `orders.service.js`, `cart.service.js`, `pc-builder.service.ts`, `admin.service.js`, `serials.service.js` thông qua `getDbPool().execute(...)`.

#### Hậu quả kiến trúc:
1. **Thiếu tính cô lập giao dịch (Transaction Isolation Breakdown)**: Nếu một luồng nghiệp vụ vừa gọi hàm dùng Prisma, vừa gọi hàm dùng `mysql2 pool`, transaction không thể rollback đồng nhất khi xảy ra lỗi giữa chừng.
2. **Schema Drift rủi ro cao**: Khi chỉnh sửa cột trong [schema.prisma](file:///d:/Project%20CNM_MK-HB/services/api/prisma/schema.prisma), TypeScript compiler chỉ kiểm tra được các file dùng Prisma Client, hoàn toàn không phát hiện được các câu lệnh SQL viết tay trong các file `.js` cũ.

---

## 4. MA TRẬN FILE NGUYÊN KHỐI CẦN TÁCH NHỎ (CODE SMELL INVENTORY)

| Đường dẫn tệp | Số dòng | Trách nhiệm hiện tại | Đề xuất phân rã |
| :--- | :---: | :--- | :--- |
| `apps/web/src/pages/public/PcBuilderPage.jsx` | **2.919** | Chọn linh kiện, modal danh mục, tính giá, kiểm tra tương thích, gọi AI advisor, chia sẻ cấu hình, in báo giá | Tách thành: `BuilderSlotsList.jsx`, `CompatibilityBadge.jsx`, `AiAdviceModal.jsx`, `PrintQuoteModal.jsx` |
| `services/api/src/modules/pc-builder/pc-builder.service.ts` | **2.146** | Heuristic rules, socket matching, wattage calculation, database rules evaluation, xAI generation | Tách thành: `socket-rule.evaluator.ts`, `power-rule.evaluator.ts`, `heuristic-specs.parser.ts` |
| `apps/web/src/pages/public/CheckoutPage.jsx` | **2.029** | Quản lý địa chỉ giao hàng, áp mã giảm giá, tính phí vận chuyển, chọn phương thức VNPay/COD/QR, modal xác nhận | Tách thành: `AddressSelector.jsx`, `CouponApplier.jsx`, `PaymentMethodSelector.jsx`, `OrderSummaryBox.jsx` |
| `services/api/src/modules/ai/ai.service.js` | **1.941** | Logic chat, context building, fallback heuristics, OpenAI integration | Tích hợp vào `ai-orchestrator.service.ts` và loại bỏ code trùng lặp |
| `services/api/src/modules/orders/orders.service.js` | **1.824** | Tạo đơn từ giỏ, xử lý mã giảm giá, gán serial, trừ kho, hủy đơn, hoàn kho, webhook thanh toán | Tách thành: `order-creation.service.ts`, `order-inventory.service.ts`, `order-cancellation.service.ts` |
| `apps/web/src/pages/admin/AdminDashboardPage.jsx` | **1.729** | Thống kê doanh thu, biểu đồ, danh sách đơn mới, cảnh báo tồn kho, thao tác nhanh | Tách thành: `RevenueStatCards.jsx`, `OrderTrendChart.jsx`, `LowStockWidget.jsx` |

---

## 5. ĐÁNH GIÁ MỨC ĐỘ TÁI SỬ DỤNG VÀ DEPENDENCY GRAPH

- **Circular Dependencies**: Không phát hiện vòng lặp phụ thuộc trực tiếp giữa các module lớn (nhờ kiến trúc router trung tâm `routes/index.ts`).
- **Imports không sử dụng & Mã thừa**:
  - Tệp `apps/web/src/lib/api.ts` đã bị xóa trong working tree; các service đã chuyển sang sử dụng axios client chuẩn trong từng service file.
  - Tồn tại các file script cũ trong `services/api/prisma/` (như `seed.js`, `seed-rich.js`, `seed-hardware-specs.js`, `seed-comprehensive-rules.js`) có sự chồng chéo về logic nạp dữ liệu. Cần quy hoạch thành 1 script master duy nhất (`seed-production.js` hoặc `bootstrap-master.js`).
