#!/bin/bash
# ==============================================================================
# Script sinh chứng chỉ SSL tự ký (Self-Signed SSL) phục vụ chạy thử nghiệm HTTPS
# Sử dụng khi deploy lên VPS mà chưa có Domain hoặc chưa cấu hình Let's Encrypt
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSL_DIR="$DIR/nginx/ssl"
mkdir -p "$SSL_DIR"

DOMAIN="${1:-localhost}"

echo "🔐 [SSL Generator] Dang sinh chung chi SSL tu ky cho: $DOMAIN ..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$SSL_DIR/privkey.pem" \
  -out "$SSL_DIR/fullchain.pem" \
  -subj "/C=VN/ST=HoChiMinh/L=HoChiMinh/O=PCMall/OU=DevOps/CN=$DOMAIN"

# Tao ban sao tuong thich ca 2 kieu dat ten cert.pem / fullchain.pem
cp -f "$SSL_DIR/fullchain.pem" "$SSL_DIR/cert.pem"
cp -f "$SSL_DIR/privkey.pem" "$SSL_DIR/key.pem"
chmod 644 "$SSL_DIR"/*.pem 2>/dev/null || true

echo "✅ [SSL Generator] Da sinh chung chi SSL thanh cong tai: $SSL_DIR"
ls -la "$SSL_DIR"

