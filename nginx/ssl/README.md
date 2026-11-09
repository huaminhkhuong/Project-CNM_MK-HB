# Thư mục chứa chứng chỉ SSL cho Nginx Production

Thư mục này được mount vào container `cnm_nginx_prod` tại đường dẫn `/etc/nginx/ssl`.

### 1. Yêu cầu file chứng chỉ
Nginx trong `nginx.conf` sử dụng 2 file:
- `fullchain.pem`: Chứng chỉ SSL công khai (Public Certificate & Intermediate Chain)
- `privkey.pem`: Khóa bảo mật riêng tư (Private Key)

*(Hệ thống cũng hỗ trợ alias `cert.pem` và `key.pem` tương đương)*

### 2. Cách 1: Sinh chứng chỉ SSL tự ký dùng tạm khi chưa có Domain
Chạy script tự động có sẵn trong dự án:
- Trên Linux / VPS:
  ```bash
  chmod +x scripts/generate-ssl.sh
  ./scripts/generate-ssl.sh your-domain-or-ip
  ```
- Trên Windows PowerShell:
  ```powershell
  .\scripts\generate-ssl.ps1 -Domain localhost
  ```

### 3. Cách 2: Sử dụng Let's Encrypt (Certbot) trên VPS có tên miền thật
Sau khi Certbot cấp chứng chỉ tại `/etc/letsencrypt/live/yourdomain.com/`:
```bash
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/fullchain.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/privkey.pem
sudo chmod 644 nginx/ssl/*.pem
```

