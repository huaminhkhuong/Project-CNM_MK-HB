# 🚀 HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG PC MALL LÊN MÁY CHỦ VPS / CLOUD
## (DOCKER COMPOSE PRODUCTION DEPLOYMENT GUIDE)

---

### 🖥️ 1. YÊU CẦU MÁY CHỦ (MINIMUM REQUIREMENTS)
- **Hệ điều hành khuyên dùng:** Ubuntu 22.04 LTS hoặc Ubuntu 24.04 LTS (hoặc Debian 12).
- **Phần cứng tối thiểu:** 2 vCPU, 2GB RAM (khuyến nghị 4GB RAM nếu chạy nhiều truy vấn AI cùng lúc), 25GB SSD trống.
- **Tên miền (Domain):** Đã trỏ bản ghi `A` (hoặc CNAME) về địa chỉ IP công khai của máy chủ VPS (ví dụ: `pcmall.vn` và `www.pcmall.vn`).

---

### 📦 2. CÀI ĐẶT DOCKER & DOCKER COMPOSE (NẾU MÁY MỚI TINH)
Chạy các lệnh sau trên terminal của VPS (với quyền `root` hoặc `sudo`):

```bash
# 1. Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# 2. Cài đặt Docker engine chính thức
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 3. Kích hoạt Docker tự khởi động cùng hệ thống
sudo systemctl enable docker
sudo systemctl start docker

# 4. Kiểm tra phiên bản Docker & Docker Compose
docker --version
docker compose version
```

---

### 📂 3. TẢI SOURCE CODE & CẤU HÌNH MÔI TRƯỜNG (.ENV)

```bash
# 1. Clone mã nguồn vào máy chủ
git clone <URL_REPO_CUA_BAN> /opt/pcmall
cd /opt/pcmall

# 2. Khởi tạo file .env bảo mật cao tự động bằng 1 lệnh duy nhất (Khuyên dùng):
# Cú pháp: node scripts/setup-env.js <domain_hoac_ip> [gemini_api_key]
node scripts/setup-env.js pcmall.vn AIzaSy...

# (Script sẽ tự động sinh JWT_ACCESS_SECRET 64 ký tự, JWT_REFRESH_SECRET 64 ký tự và DB_PASSWORD ngẫu nhiên mạnh)
```

Hoặc nếu muốn cấu hình thủ công:
```bash
cp .env.production.example .env
nano .env
```

**Các thông số quan trọng trong file `.env`:**
1. `FRONTEND_URL`: Tên miền thật của bạn (ví dụ: `https://pcmall.vn`).
2. `API_BASE_URL`: URL API công khai (ví dụ: `https://pcmall.vn/api`).
3. `JWT_ACCESS_SECRET` & `JWT_REFRESH_SECRET`: Phải dài từ 32-64 ký tự (script `setup-env.js` đã sinh sẵn chuẩn).
4. `DB_PASSWORD`: Mật khẩu CSDL mạnh.
5. `LLM_API_KEY`: Dán khóa API Google Gemini của bạn.
6. `MAIL_USER` & `MAIL_PASS`: Điền email và mật khẩu ứng dụng Gmail (App password) để tự động gửi hóa đơn cho khách.

---

### 🌐 4. KHỞI CHẠY HỆ THỐNG LẦN ĐẦU (CHẾ ĐỘ HTTP HOẶC SSL TỰ KÝ)

Khi vừa dựng máy chủ, bạn chưa có chứng chỉ SSL Let's Encrypt. Bạn có thể chọn 1 trong 2 cách sau:

#### Cách 4.1: Khởi chạy chế độ HTTP cổng 80 (Khuyên dùng trước khi cấu hình Certbot)
```bash
# Khởi chạy hệ thống bằng cấu hình HTTP (chỉ lắng nghe cổng 80, không yêu cầu SSL):
docker compose -f docker-compose.prod.yml -f docker-compose.prod.http.yml up -d --build
```

#### Cách 4.2: Hoặc sinh chứng chỉ SSL tự ký dùng tạm (Tránh crash nếu chạy compose tiêu chuẩn)
```bash
# Cấp quyền và chạy script sinh chứng chỉ SSL tự ký trong 1 giây:
chmod +x scripts/generate-ssl.sh
./scripts/generate-ssl.sh pcmall.vn

# Sau đó khởi chạy thẳng bằng compose tiêu chuẩn:
docker compose -f docker-compose.prod.yml up -d --build
```

**Kiểm tra trạng thái các container:**
```bash
docker compose ps
```
Bạn sẽ thấy 5 container đang chạy:
- `cnm_mysql_prod` (Khỏe mạnh - Port 3306 nội bộ)
- `cnm_api_prod` (Khỏe mạnh - Port 4000)
- `cnm_web_prod` (Khỏe mạnh - Port 5173 nội bộ)
- `cnm_nginx_prod` (Khỏe mạnh - Port 80 và 443)
- `cnm_phpmyadmin_prod` (Port 8080 nếu cần quản lý CSDL)

Kiểm tra API Healthcheck trên trình duyệt:  
👉 `http://<IP_VPS>/api/health` hoặc `http://yourdomain.com/api/health`

---

### 🔒 5. CÀI ĐẶT CHỨNG CHỈ SSL MIỄN PHÍ CHÍNH THỨC (CERTBOT / LET'S ENCRYPT)

Sau khi tên miền đã trỏ về IP và web đã truy cập được qua HTTP:

```bash
# 1. Cài đặt Certbot trên máy chủ
sudo apt install certbot -y

# 2. Tạm dừng Nginx để Certbot cấp chứng chỉ
docker compose stop nginx

# 3. Yêu cầu cấp chứng chỉ SSL (thay pcmall.vn bằng domain của bạn)
sudo certbot certonly --standalone -d pcmall.vn -d www.pcmall.vn

# 4. Sao chép chứng chỉ vào thư mục nginx/ssl của dự án (khớp 100% với nginx.conf)
mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/pcmall.vn/fullchain.pem nginx/ssl/fullchain.pem
sudo cp /etc/letsencrypt/live/pcmall.vn/privkey.pem nginx/ssl/privkey.pem
# Tạo thêm bản sao dự phòng
sudo cp -f nginx/ssl/fullchain.pem nginx/ssl/cert.pem
sudo cp -f nginx/ssl/privkey.pem nginx/ssl/key.pem
sudo chmod 644 nginx/ssl/*

# 5. Khởi động lại hệ thống ở chế độ HTTPS đầy đủ
docker compose -f docker-compose.prod.yml up -d
```

---

### 💾 6. SAO LƯU CƠ SỞ DỮ LIỆU TỰ ĐỘNG HÀNG NGÀY

Hệ thống đã có sẵn script sao lưu nén Gzip và tự động xóa bản sao lưu cũ quá 7 ngày:

```bash
# Cấp quyền thực thi cho script:
chmod +x scripts/backup-db.sh

# Cài đặt lịch sao lưu tự động lúc 02:00 sáng mỗi ngày qua Crontab:
crontab -e
# Thêm dòng sau vào cuối:
0 2 * * * /opt/pcmall/scripts/backup-db.sh >> /var/log/pcmall-backup.log 2>&1
```

---

### 🛠️ 7. MỘT SỐ LỆNH TIỆN ÍCH KHI VẬN HÀNH

- **Xem log hệ thống theo thời gian thực:**
  ```bash
  docker compose logs -f api
  docker compose logs -f nginx
  ```
- **Khởi động lại toàn bộ hệ thống:**
  ```bash
  docker compose restart
  ```
- **Cập nhật mã nguồn phiên bản mới:**
  ```bash
  git pull origin main
  docker compose -f docker-compose.prod.yml up -d --build
  ```

