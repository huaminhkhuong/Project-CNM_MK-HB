# 📚 CẨM NANG DỮ LIỆU SEED DATABASE (PC MALL)

Tài liệu này hướng dẫn chi tiết về cấu trúc, mục đích và cách sử dụng các file nạp dữ liệu mẫu (Seed Data) trong thư mục `services/api/prisma/`.

---

## 🌟 1. Lệnh Khuyến Nghị Sử Dụng (Canonical Master Seed)

Để khởi tạo toàn bộ dữ liệu sạch, chuẩn xác 100% về khóa ngoại và tương thích linh kiện, **chỉ cần chạy một lệnh duy nhất**:

```bash
# Từ thư mục gốc (root)
npm run seed:production

# Hoặc từ thư mục services/api
npm run seed -w services/api
```

### File điều phối: `seed-canonical.js`
File này tự động thực thi 6 bước theo thứ tự phụ thuộc khóa ngoại nghiêm ngặt:

| Thứ tự | File thực thi | Nội dung dữ liệu được nạp |
|---|---|---|
| **1** | `seed-production.js` | Tạo 4 vai trò (Role: ADMIN, SALES_STAFF, TECH_STAFF, CUSTOMER) và các tài khoản demo mặc định (`admin@cnm.local`, `sales@cnm.local`, `tech1@cnm.local`, `customer@cnm.local`). |
| **2** | `import-all-catalog-sources.js` | Nạp danh mục (Categories), thương hiệu (Brands) và 300 sản phẩm chuẩn qua 8 nhóm linh kiện máy tính. |
| **3** | `seed-hardware-specs.js` | Nạp 45 thuộc tính kỹ thuật (Socket, RAM type, TDP, kích thước Case/PSU/Cooler) và gán hơn 2.500 liên kết `sku_attributes`. |
| **4** | `seed-comprehensive-rules.js` | Nạp 44 luật tương thích cho PC Builder Engine (Socket CPU ↔ Mainboard, RAM DDR4/DDR5, Công suất PSU, Kích thước tản nhiệt). |
| **5** | `seed-coupons.js` | Nạp 5 mã giảm giá khuyến mãi mẫu (WELCOME10, TECHSALE50, PCBUILD200, FREESHIP, VIPMALL). |
| **6** | `seed-reviews.js` | Nạp các đánh giá, bình luận và số sao thực tế từ khách hàng cho các sản phẩm linh kiện hot. |

---

## 🎯 2. Dữ Liệu Demo Cho Khách & Tính Năng Đặc Biệt

### A. Demo Khách vãng lai & Bộ lọc (Guest Demo 100%)
```bash
npm run seed:guest-demo -w services/api
```
- **File:** `seed-guest-demo.js`
- **Mục đích:** Bổ sung nhóm sản phẩm Tản nhiệt (`COOLING`), gắn thuộc tính kỹ thuật chuẩn utf8mb4 cho SKU và cấu hình ảnh minh họa cho bộ lọc danh mục của khách vãng lai.

### B. Cấu hình mẫu PC Builder
```bash
npm run seed:demo-build -w services/api
```
- **File:** `seed-demo-pc-build.js`
- **Mục đích:** Tạo sẵn các cấu hình mẫu hoàn chỉnh (Bộ PC Gaming 4K, Render đồ họa chuyên nghiệp, PC Văn phòng tối ưu chi phí) để người dùng có thể nạp nhanh trong giao diện PC Builder.

### C. Nạp kho dữ liệu siêu lớn 1.200 linh kiện
```bash
node prisma/import-full-1200-components.js
```
- **File:** `import-full-1200-components.js`
- **Nguồn:** `data/json/pc_components_all.json`
- **Mục đích:** Nạp dữ liệu sản phẩm quy mô lớn (100 CPU, 100 Mainboard, 100 RAM, 100 GPU, 100 SSD, 100 HDD, 100 PSU, 100 Case, 100 Tản nhiệt, 100 Màn hình, 100 Bàn phím/Chuột, 100 Tai nghe).

---

## ⚙️ 3. Công Cụ Sinh Quy Tắc Tương Thích Kỹ Thuật (Rules Engine)

- **`export-and-seed-compatibility-rules.js`**:
  - Tự động tạo ma trận 420+ luật tương thích phần cứng chi tiết.
  - Đồng thời nạp vào database và xuất bản sao lưu SQL tại `docs/03-database/phase11_compatibility_rules_seed.sql`.
- **`check-compat.js`**:
  - Script kiểm tra nhanh tính tương thích của một tổ hợp linh kiện mà không cần mở trình duyệt.
- **`update-product-images.js`**:
  - Script đồng bộ và sửa lại đường dẫn ảnh tĩnh khi chuyển đổi môi trường hoặc CDN.

---

## 📦 4. Các File Cũ / Lưu Trữ Lịch Sử (Legacy / Archived)

> ⚠️ **Lưu ý:** Các file dưới đây là phiên bản tiền thân trong quá trình phát triển (đã được tổng hợp và thay thế hoàn toàn bởi `seed-canonical.js`). Không cần chạy đơn lẻ:

- `seed.js`: Seed thử nghiệm giai đoạn đầu.
- `seed-full.js`: Seed gộp phiên bản cũ.
- `seed-rich.js`: Seed dữ liệu mẫu mở rộng cũ.
- `seed-products.js`: Seed sản phẩm đơn giản cũ.
- `seed-complete-system.js`: Script monolithic cũ trước khi tách thành các module riêng biệt.
- `import-hacom-data.js`: Dữ liệu import thô từ nguồn Hacom cũ.

