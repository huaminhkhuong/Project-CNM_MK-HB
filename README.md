# 🖥️ PC Mall – Hệ thống E-commerce Linh kiện Máy tính

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-green?logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19-blue?logo=react" />
  <img src="https://img.shields.io/badge/MySQL-8.0-orange?logo=mysql&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-4.x-black?logo=express" />
  <img src="https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma" />
  <img src="https://img.shields.io/badge/JWT-Auth-purple" />
  <img src="https://img.shields.io/badge/AI_Engine-Expert_System_%2B_LLM-412991" />
</p>

---

## 📖 Giới thiệu

**PC Mall** là hệ thống thương mại điện tử chuyên biệt cho **linh kiện máy tính**, được xây dựng theo kiến trúc monorepo gồm:

- **Frontend** – React 19 + Vite, giao diện premium "Clean Tech", tối ưu tải trang bằng Route-based Code Splitting (React.lazy)
- **Backend API** – Node.js + Express, Prisma ORM singleton pool, module RESTful API & Socket.io
- **Cơ sở dữ liệu** – MySQL 8, quản lý schema tập trung qua Prisma
- **Hệ thống tư vấn & kiểm tra tương thích** – Hệ chuyên gia dựa trên tri thức (Knowledge-Based Expert System) kết hợp thuật toán tối ưu Heuristic và mô hình ngôn ngữ lớn (OpenAI GPT / Google Gemini)

Hệ thống hỗ trợ **5 nhóm người dùng** (Actor) với vai trò và quyền hạn riêng biệt.

---

## 🏗️ Kiến trúc hệ thống

```
Project-CNM_MK-HB/
├── apps/
│   └── web/                  # Frontend – React + Vite
│       └── src/
│           ├── pages/        # Trang theo actor (public, admin, staff, tech)
│           ├── components/   # UI components dùng chung
│           ├── services/     # HTTP client, catalog, cart, pc-builder...
│           ├── hooks/        # useAuth, custom hooks
│           └── store/        # Auth state (Vanilla JS store)
│
├── services/
│   └── api/                  # Backend – Express.js
│       └── src/
│           ├── modules/      # Feature modules: auth, catalog, cart, orders...
│           ├── middlewares/  # auth, error handler
│           ├── config/       # env, database, prisma
│           ├── routes/       # Tổng hợp routes
│           └── utils/        # helpers, service-helpers...
│
├── packages/
│   └── shared/              # Constants & types dùng chung
│
├── infra/
│   └── docker/              # docker-compose, nginx config
│
└── docs/                    # Tài liệu: ERD, API spec, use-case
```

---

## 👥 Actors & Phân quyền

| Actor | Role trong DB | URL mặc định sau login | Mô tả |
|---|---|---|---|
| **Guest** | — (chưa login) | `/` | Xem sản phẩm, so sánh, tra bảo hành, Build PC thử |
| **Customer** | `CUSTOMER` | `/` | Mua hàng, quản lý đơn, tạo ticket, lưu Build PC |
| **Sales Staff** | `SALES_STAFF` | `/staff/orders` | Xử lý đơn, vận đơn mock, tư vấn chat + gửi cấu hình PC |
| **Tech Staff** | `TECH_STAFF` | `/tech/tickets` | Ticket hỗ trợ, luật tương thích PC Builder, tra bảo hành |
| **Admin** | `ADMIN` | `/admin/dashboard` | Trung tâm điều hành: catalog, users, hệ thống, giám sát staff/tech |

---

## ✨ Tính năng chính

### 🛍️ Catalog & Sản phẩm
- Danh sách sản phẩm với lọc theo danh mục, giá, thương hiệu, tìm kiếm toàn văn
- Trang chi tiết sản phẩm: thông số kỹ thuật, biến thể (SKU), tồn kho
- **So sánh sản phẩm** (tối đa 4): tìm kiếm trực quan, bảng so sánh thông số chi tiết

### ⚙️ PC Builder
- Chọn 7 loại linh kiện (CPU, Mainboard, RAM, GPU, Storage, PSU, Case)
- Kiểm tra tương thích tự động dựa trên luật cấu hình
- **AI Advisor**: nhập ngân sách + nhu cầu → AI gợi ý cấu hình hoàn chỉnh
- "Áp dụng toàn bộ" – tự động điền linh kiện AI đề xuất vào Builder
- Lưu cấu hình vào tài khoản (cho Customer đã đăng nhập)
- Hỗ trợ Guest mode: lưu tạm thời vào LocalStorage

### 🤖 AI Advisor & Hệ chuyên gia kiểm tra tương thích
- **Heuristic Engine**: Thuật toán phân bổ ngân sách tối ưu theo use-case (Gaming, Render, Office, Dev) và lọc linh kiện tự động
- **XAI Explanation Engine**: Bộ giải thích luật phần cứng (COMP-001 -> COMP-010) với 4 cấp độ nghiêm trọng (Blocker, Warning, Advisory, Info)
- **LLM Integration**: Hỗ trợ kết nối OpenAI GPT-4o-mini hoặc Google Gemini 1.5 Flash để đàm thoại tư vấn chuyên sâu
- **Demo Mode**: Tự động fallback sang hệ luật Heuristic nội bộ khi không cấu hình API Key

### 🛒 Giỏ hàng & Thanh toán
- Thêm/xóa/cập nhật số lượng sản phẩm trong giỏ
- Thanh toán: COD hoặc VNPay (Sandbox)
- Quản lý đơn hàng: xem lịch sử, theo dõi trạng thái

### 🔧 Bảo hành & Hỗ trợ kỹ thuật
- Tra cứu bảo hành theo số serial
- Hệ thống ticket: khách tạo → kỹ thuật viên xử lý → phản hồi
- Quản lý warranty điện tử

### 👨‍💼 Admin Panel
- Dashboard thống kê tổng quan
- CRUD sản phẩm, SKU, thuộc tính linh kiện
- Quản lý người dùng, đổi role
- Quản lý luật tương thích linh kiện
- Cài đặt hệ thống

---

## 🚀 Cài đặt & Chạy dự án

### Yêu cầu
- Node.js 20+
- Docker Desktop (hoặc MySQL 8)
- npm 9+

### Bước 1 – Clone & Cài dependencies

```bash
git clone https://github.com/HuaMinhKhuong-22700971/Project-CNM_MK-HB.git
cd Project-CNM_MK-HB
npm install --cache .npm-cache --ignore-scripts
```

### Bước 2 – Khởi động Database

```bash
# Dùng Docker (khuyến nghị)
docker compose -f infra/docker/docker-compose.yml up -d

# Hoặc dùng MySQL local: tạo database cnm_mk_hb và import file cnm_ecommerce_new.sql
```

### Bước 3 – Cấu hình môi trường

```bash
# Tại root
Copy-Item .env.example .env

# Tại services/api
Copy-Item services/api/.env.example services/api/.env
```

Chỉnh sửa `services/api/.env`:

```env
PORT=4000
DATABASE_URL=mysql://root:root@127.0.0.1:3307/cnm_mk_hb
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=root
DB_PASSWORD=root
DB_NAME=cnm_mk_hb
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
OPENAI_API_KEY=sk-...       # Tùy chọn – nếu không có, AI chạy Demo Mode
FRONTEND_URL=http://localhost:5173
```

### Bước 4 – Khởi tạo dữ liệu (Prisma)

```bash
npm run prisma:generate -w services/api
npm run prisma:migrate:dev -w services/api -- --name init
npm run seed:production -w services/api
npm run seed:guest-demo -w services/api
```

> **Tài khoản demo:** `seed:production` tạo admin/sales/tech/customer theo bảng bên dưới (idempotent).

> **Demo khách vãng lai 100%:** lệnh `seed:guest-demo` gắn thuộc tính kỹ thuật (socket, RAM…), ảnh sản phẩm và dữ liệu lọc. Xem checklist: [docs/GUEST_DEMO_100.md](docs/GUEST_DEMO_100.md)

> **Demo khách thành viên 100%:** hủy đơn PENDING, thanh toán VNPay mock/sandbox, đồng bộ build PC sau login. Checklist: [docs/CUSTOMER_DEMO_100.md](docs/CUSTOMER_DEMO_100.md). Đặt `PAYMENT_MOCK_MODE=true` trong `services/api/.env` để dùng cổng thanh toán demo.

> **Hoặc** import SQL: `cnm_ecommerce (1).sql` rồi `npm run seed:production` — xem [database/README.md](database/README.md)

### Bước 5 – Chạy dự án

```bash
# Chạy đồng thời API + Frontend
npm run dev

# Hoặc chạy riêng lẻ (khuyến nghị trên Windows)
npm run dev:api      # Backend: http://localhost:4000
npm run dev:web      # Frontend: http://localhost:5173
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:4000/api |
| Health Check | http://localhost:4000/api/health (kèm ping DB) |
| Adminer (DB) | http://localhost:8080 |

### Kiểm tra API (P0)

```bash
npm run test:api
# Smoke login + products (cần DB đã import + seed:production):
# PowerShell: $env:RUN_API_INTEGRATION="1"; npm run test:api
```

---

## 🔑 Tài khoản Demo

| Role | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@cnm.local` | `Admin@123` |
| Sales Staff | `sales@cnm.local` | `Sales@123` |
| Tech Staff | `tech1@cnm.local` | `Tech@123` |
| Customer | `customer@cnm.local` | `Customer@123` (hoặc đăng ký tại `/register`) |

> Có thể đổi role người dùng qua **Admin Panel → /admin/users**

---

## 📡 API Endpoints chính

### Auth
| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/auth/register` | Đăng ký tài khoản |
| POST | `/api/auth/login` | Đăng nhập, nhận JWT |
| GET | `/api/auth/me` | Thông tin người dùng hiện tại |

### Catalog
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/products` | Danh sách sản phẩm (filter, search, paginate) |
| GET | `/api/products/:id` | Chi tiết sản phẩm + variants |
| GET | `/api/products/compare?ids=1,2,3` | So sánh sản phẩm |
| GET | `/api/categories` | Danh sách danh mục |

### PC Builder
| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/pc-builder` | Tạo build mới |
| GET | `/api/pc-builder/current` | Lấy build hiện tại của user |
| POST | `/api/pc-builder/:id/items` | Thêm/cập nhật linh kiện |
| DELETE | `/api/pc-builder/:id/items/:type` | Xóa linh kiện |
| PATCH | `/api/pc-builder/:id/save` | Lưu build |
| POST | `/api/pc-builder/check-compatibility` | Kiểm tra tương thích |

### AI Advisor
| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/ai-advisor/suggest-build` | Gợi ý cấu hình PC bằng AI |

### Orders & Cart
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/cart` | Xem giỏ hàng |
| POST | `/api/cart/items` | Thêm vào giỏ |
| POST | `/api/orders` | Đặt hàng từ giỏ |
| GET | `/api/orders` | Lịch sử đơn hàng |

---

## 🗂️ Cấu trúc Database (Bảng chính)

```
users          – tài khoản người dùng, role
roles          – ADMIN, SALES_STAFF, TECH_STAFF, CUSTOMER
products       – sản phẩm linh kiện
product_skus   – biến thể sản phẩm (giá, tồn kho, thuộc tính)
categories     – danh mục (CPU, GPU, RAM, ...)
brands         – thương hiệu
cart           – giỏ hàng
cart_items     – chi tiết giỏ
orders         – đơn hàng
order_items    – chi tiết đơn
pc_builds      – cấu hình PC đã lưu
pc_build_items – linh kiện trong cấu hình
compatibility_rules – luật tương thích giữa linh kiện
tickets        – yêu cầu hỗ trợ kỹ thuật
warranties     – thông tin bảo hành
addresses      – địa chỉ giao hàng
```

---

## 🛠️ Tech Stack & Công cụ

| Tầng | Công nghệ |
|---|---|
| Frontend | React 18, Vite, React Router v6, Axios |
| Backend | Node.js 20, Express 4, JavaScript + TypeScript |
| ORM | Prisma (TypeScript) + raw MySQL2 pool (JavaScript) |
| Database | MySQL 8 |
| Auth | JWT (Access Token 15m, Refresh Token 7d) |
| AI | OpenAI GPT API (với Demo Mode fallback) |
| Payment | VNPay Sandbox |
| DevOps | Docker, Docker Compose |
| Package manager | npm workspaces (monorepo) |

---

## 🧪 Kiểm thử

### Kiểm thử thủ công theo Actor

**Guest:** `/` → `/products` → `/pc-builder` → `/compare` → `/warranties`

**Customer:** `/register` → `/login` → thêm giỏ hàng → `/checkout` → `/orders`

**Sales Staff:** `sales@cnm.local` → `/staff/orders` + `/staff/chat` — xem `docs/STAFF_DEMO_100.md`

**Tech Staff:** `tech1@cnm.local` / `Tech@123` → `/tech/tickets` + `/tech/compatibility` — xem `docs/TECH_DEMO_100.md`

**Admin:** `admin@cnm.local` / `Admin@123` → `/admin/dashboard` — xem `docs/ADMIN_DEMO_100.md`

**Lộ trình production:** xem [`docs/PRODUCTION_ROADMAP.md`](docs/PRODUCTION_ROADMAP.md)

### Kiểm thử API

```bash
# Health check
curl http://localhost:4000/api/health

# Đăng nhập
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cnm.local","password":"Admin@123"}'

# Danh sách sản phẩm
curl http://localhost:4000/api/products?limit=10

# AI Advisor
curl -X POST http://localhost:4000/api/ai-advisor/suggest-build \
  -H "Content-Type: application/json" \
  -d '{"requirements":"gaming","budget":25000000}'
```

---

## ⚠️ Xử lý lỗi thường gặp

### EPERM spawn (Windows)
Nếu `npm run dev` báo lỗi `spawn EPERM` do esbuild bị lock:

```bash
# Chạy riêng lẻ thay vì dùng concurrent watcher
npm run dev:api
# Mở terminal mới
npm run dev:web
```

### Token hết hạn ngay lập tức
Hệ thống sử dụng 2 middleware auth (JS cũ và TS mới). Cả hai đã được đồng bộ để chấp nhận cả trường `sub` và `userId` trong JWT payload. Nếu vẫn gặp lỗi, kiểm tra `JWT_ACCESS_SECRET` trong `.env` có khớp không.

### AI Advisor không trả kết quả
Nếu không có `OPENAI_API_KEY`, hệ thống tự động chuyển sang **Demo Mode** (lấy linh kiện từ database). Đây là hành vi bình thường.

---

## 👨‍💻 Tác giả

| Họ tên | MSSV | GitHub |
|---|---|---|
| Hòa Minh Khương | 22700971 | [@HuaMinhKhuong-22700971](https://github.com/HuaMinhKhuong-22700971) |

---

## 📄 Giấy phép

Dự án được phát triển cho mục đích học thuật – môn **Công nghệ Mạng Máy tính (CNM)**, Trường Đại học Công nghiệp TP.HCM (IUH).