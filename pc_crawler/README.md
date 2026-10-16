# PC Hardware Components Crawler (Thư mục cào dữ liệu độc lập)

Hệ thống cào dữ liệu linh kiện máy tính tự động từ **An Phát PC** (`anphatpc.com.vn`) và **HACOM** (`hacom.vn`), hỗ trợ bóc tách đầy đủ toàn bộ bảng thông số kỹ thuật (specs table), lấy album ảnh mô tả chất lượng cao, xuất đồng thời ra cả **JSON** và **CSV** (hỗ trợ Excel với UTF-8-BOM).

---

## 1. Cấu trúc thư mục

```
pc_crawler/
├── config.py               # Cấu hình danh mục (CPU, VGA, Main, RAM, SSD, PSU, Case, Cooling), Headers, Timeout
├── requirements.txt        # Các thư viện phụ thuộc (requests, beautifulsoup4, lxml, pillow, tqdm)
├── run.py                  # Điểm khởi chạy CLI cào dữ liệu
├── sanitize_dataset.py     # Script chuẩn hóa dữ liệu nội bộ
├── crawler/
│   ├── __init__.py
│   ├── base.py             # Lớp cơ sở: Session, retry, parse giá, tải ảnh song song, xuất file JSON/CSV
│   ├── anphat.py           # Bộ cào An Phát PC
│   └── hacom.py            # Bộ cào HACOM
└── data/
    ├── json/               # Dữ liệu JSON chuẩn (cpu.json, vga.json... pc_components_all.json)
    ├── csv/                # Dữ liệu CSV chuẩn (cpu.csv, vga.csv... pc_components_all.csv)
    └── images/products/    # Toàn bộ 1,441 ảnh sản phẩm phân chia theo 8 nhóm linh kiện

```

---

## 2. Cài đặt môi trường

Mở terminal tại thư mục `pc_crawler`:

```bash
pip install -r requirements.txt
```

---

## 3. Hướng dẫn sử dụng CLI (`run.py`)

### 3.1. Các tham số dòng lệnh:
- `--site`: Chọn trang nguồn: `anphat`, `hacom`, hoặc `all` (Mặc định: `all`).
- `--category`: Danh mục linh kiện: `cpu`, `mainboard`, `ram`, `vga`, `ssd`, `psu`, `case`, `cooling` hoặc `all` (Mặc định: `cpu`).
- `--limit`: Giới hạn số lượng sản phẩm mỗi danh mục (Mặc định: `5`). Đặt `0` để cào không giới hạn.
- `--pages`: Số trang phân trang muốn quét (Mặc định: `1`).
- `--no-images`: Bỏ qua việc tải ảnh về máy (Mặc định: hệ thống **tự động tải toàn bộ ảnh** về thư mục `data/images/` và gán thẳng đường dẫn file ảnh cục bộ vào JSON).
- `--delay`: Thời gian nghỉ giữa các request (giây), mặc định `1.0`s để bảo vệ IP và tránh bị rate limit.

### 3.2. Ví dụ câu lệnh thông dụng:

**1. Cào 5 CPU từ cả An Phát và HACOM (Mặc định tải toàn bộ ảnh và trỏ JSON vào ảnh cục bộ):**
```bash
python run.py --site all --category cpu --limit 5
```

**2. Cào Card màn hình (VGA) nhưng KHÔNG tải ảnh (chỉ lấy link online):**
```bash
python run.py --site anphat --category vga --limit 10 --no-images
```

**3. Cào toàn bộ 8 danh mục và tải toàn bộ ảnh:**
```bash
python run.py --site all --category all --limit 20
```


**4. Cào toàn bộ 8 danh mục linh kiện từ cả 2 trang web (Chạy hàng loạt):**
```bash
python run.py --site all --category all --limit 20
```

---

## 4. Định dạng dữ liệu đầu ra

Mỗi lần cào, hệ thống sẽ tự động xuất ra:
1. File theo từng danh mục: `data/json/<site>_<category>.json` và `data/csv/<site>_<category>.csv`.
2. File tổng hợp: `data/json/all_pc_components.json` và `data/csv/all_pc_components.csv`.

### Cấu trúc JSON mẫu:
```json
{
  "id": "anphat_47505",
  "site": "anphat",
  "category": "cpu",
  "product_id": "47505",
  "name": "CPU Intel Core i5 14400 (Intel LGA1700 - 10 Core - 16 Thread - Base 2.5Ghz - Turbo 4.7Ghz - Cache 20MB)",
  "slug": "cpu-intel-core-i5-14400-intel-lga1700-10-core-16-thread-base-2.5ghz-turbo-4.7ghz-cache-20mb",
  "brand": "Intel",
  "price": 4399000,
  "price_formatted": "4.399.000 đ",
  "original_price": 7999000,
  "url": "https://www.anphatpc.com.vn/cpu-intel-core-i5-14400...",
  "thumbnail": "https://anphat.com.vn/media/product/47505_cpu_intel_core_i5_14400.jpg",
  "images": [
    "https://anphat.com.vn/media/product/47505_cpu_intel_core_i5_14400.jpg",
    "https://anphat.com.vn/media/lib/27-03-2025/cpu-intel-core-i5-14400-0.jpg"
  ],
  "local_images": [
    "images/anphat/cpu/cpu-intel-core-i5-14400.../image_01.jpg"
  ],
  "specifications": {
    "Sản phẩm": "Bộ vi xử lý CPU",
    "Hãng sản xuất": "Intel",
    "Model": "Core i5 14400",
    "Socket": "FCLGA1700",
    "Tốc độ cơ bản": "2.5 GHz",
    "Cache": "20 MB",
    "Nhân CPU": "10",
    "Luồng CPU": "16",
    "Bộ nhớ hỗ trợ": "Up to DDR5 4800 MT/sUp to DDR4 3200 MT/s",
    "Điện áp tiêu thụ tối đa": "148 W",
    "Công suất Cơ bản của Bộ xử lý": "65 W"
  },
  "specifications_count": 14,
  "crawled_at": "2026-09-28T14:49:18.629779"
}
```

### Cấu trúc CSV:
- Bao gồm các cột cố định: `id`, `site`, `category`, `name`, `slug`, `brand`, `price`, `price_formatted`, `original_price`, `url`, `thumbnail`, `images_count`, `images`, `local_images`.
- Tách các thông số quan trọng thành cột độc lập: `spec_Socket`, `spec_Hãng sản xuất`, `spec_Thương hiệu`, `spec_Model`, `spec_Dung lượng`, `spec_Chuẩn kết nối`, `spec_Bảo hành`, `spec_Bộ nhớ`, `spec_Tốc độ`, `spec_Công suất`, `spec_Kích thước`.
- Cột `all_specifications_json`: Chứa trọn vẹn toàn bộ 100% thuộc tính kỹ thuật dạng JSON string.
- Mã hóa `utf-8-sig` đảm bảo khi mở bằng Microsoft Excel tiếng Việt không bị lỗi font.
