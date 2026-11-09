#!/usr/bin/env node
/**
 * PC Mall - Production Environment Generator (.env)
 * Sinh tự động file .env hoàn chỉnh với các khóa bí mật JWT 64 ký tự và mật khẩu CSDL bảo mật cao.
 * Hoạt động độc lập đa nền tảng (Windows, Linux, macOS).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = path.resolve(__dirname, "..");
const envFile = path.join(rootDir, ".env");
const exampleFile = path.join(rootDir, ".env.production.example");

// Nhận tham số domain nếu có từ CLI: node setup-env.js [domain] [gemini_api_key]
const args = process.argv.slice(2);
const domain = args[0] || process.env.DOMAIN || "yourdomain.com";
const apiKey = args[1] || process.env.LLM_API_KEY || "";

function generateSecureHex(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function generateSecurePassword(length = 24) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~";
  const bytes = crypto.randomBytes(length);
  let pass = "";
  for (let i = 0; i < length; i++) {
    pass += chars[bytes[i] % chars.length];
  }
  return pass;
}

console.log("==============================================================================");
console.log("🚀 PC MALL - PRODUCTION ENVIRONMENT GENERATOR (.env)");
console.log("==============================================================================");

// 1. Tạo các giá trị ngẫu nhiên an toàn tuyệt đối
const jwtAccessSecret = generateSecureHex(32); // 64 ký tự hex
const jwtRefreshSecret = generateSecureHex(32); // 64 ký tự hex
const dbPassword = generateSecurePassword(20);

console.log("🔑 [1/3] Đã sinh JWT_ACCESS_SECRET ngẫu nhiên (64 hex characters)");
console.log("🔑 [2/3] Đã sinh JWT_REFRESH_SECRET ngẫu nhiên (64 hex characters)");
console.log("🛡️ [3/3] Đã sinh DB_PASSWORD ngẫu nhiên mạnh");

// 2. Chuẩn bị nội dung file .env
const protocol = domain.includes("localhost") || domain.match(/^\d+\.\d+\.\d+\.\d+$/) ? "http" : "https";
const frontendUrl = domain.includes("localhost") ? `http://localhost:5173` : `${protocol}://${domain}`;
const apiUrl = `${frontendUrl}/api`;
const allowedOrigins = domain.includes("localhost")
  ? `http://localhost:5173,http://localhost:4000`
  : `${protocol}://${domain},${protocol}://www.${domain}`;

const envContent = `# ==============================================================================
# PC MALL - CẤU HÌNH MÔI TRƯỜNG PRODUCTION (TỰ ĐỘNG SINH BỞI SETUP-ENV)
# Ngày tạo: ${new Date().toISOString()}
# ==============================================================================

NODE_ENV=production
PORT=4000

# 1. URL & DOMAIN
FRONTEND_URL=${frontendUrl}
API_BASE_URL=${apiUrl}
ALLOWED_ORIGINS=${allowedOrigins}

# 2. BẢO MẬT XÁC THỰC (JWT SECRETS 64 KÝ TỰ BẢO MẬT TUYỆT ĐỐI)
JWT_ACCESS_SECRET=${jwtAccessSecret}
JWT_REFRESH_SECRET=${jwtRefreshSecret}
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# 3. CƠ SỞ DỮ LIỆU MYSQL (DOCKER)
DB_HOST=mysql
DB_PORT=3306
DB_NAME=cnm_mk_hb
DB_USER=root
DB_PASSWORD=${dbPassword}
DATABASE_URL=mysql://root:${dbPassword}@mysql:3306/cnm_mk_hb

# 4. HỆ SINH THÁI AI
LLM_PROVIDER=gemini
LLM_MODEL=gemini-1.5-flash
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=2048
LLM_API_KEY=${apiKey || "AIzaSy_YOUR_GEMINI_API_KEY_HERE"}
GEMINI_API_KEY=${apiKey || "AIzaSy_YOUR_GEMINI_API_KEY_HERE"}

# 5. CỔNG THANH TOÁN VNPAY (CHẾ ĐỘ LIVE / SANDBOX)
PAYMENT_MOCK_MODE=false
VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=${frontendUrl}/payment-result

# 6. EMAIL TỰ ĐỘNG (GMAIL APP PASSWORD ĐỂ GỬI HÓA ĐƠN)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=
MAIL_PASS=
MAIL_FROM="PC Mall" <no-reply@${domain}>

# 7. VẬN CHUYỂN
SHIPPING_PROVIDER=ghtk
SHIPPING_MOCK_MODE=false
`;

// Sao lưu file .env cũ nếu đã có
if (fs.existsSync(envFile)) {
  const backupFile = `${envFile}.bak.${Date.now()}`;
  fs.copyFileSync(envFile, backupFile);
  console.log(`⚠️ Đã phát hiện file .env cũ. Đã tạo bản sao lưu tại: ${path.basename(backupFile)}`);
}

fs.writeFileSync(envFile, envContent, "utf8");

console.log("------------------------------------------------------------------------------");
console.log(`✅ File .env đã được tạo thành công tại: ${envFile}`);
console.log(`🌐 Frontend URL: ${frontendUrl}`);
console.log(`🌐 API Base URL: ${apiUrl}`);
console.log(`🔐 JWT Secrets: Đạt chuẩn 64 ký tự (Đảm bảo backend không bao giờ bị từ chối)`);
console.log(`💾 DB Password: ${dbPassword}`);
if (!apiKey) {
  console.log(`ℹ️ Lưu ý: Hãy mở file .env và điền LLM_API_KEY (khóa Gemini) để kích hoạt AI.`);
}
console.log("==============================================================================");

