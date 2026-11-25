# ==============================================================================
# Script sinh chứng chỉ SSL tự ký (Self-Signed SSL) trên Windows PowerShell
# ==============================================================================
param(
  [string]$Domain = "localhost"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$sslDir = Join-Path $projectRoot "nginx\ssl"

if (!(Test-Path $sslDir)) {
  New-Item -ItemType Directory -Path $sslDir -Force | Out-Null
}

$opensslPath = "openssl"
if (!(Get-Command openssl -ErrorAction SilentlyContinue)) {
  $gitOpenssl = "C:\Program Files\Git\usr\bin\openssl.exe"
  if (Test-Path $gitOpenssl) {
    $opensslPath = $gitOpenssl
  } else {
    Write-Error "OpenSSL is not installed or not in PATH."
    exit 1
  }
}

Write-Host "🔐 [SSL Generator] Đang sinh chứng chỉ SSL tự ký cho: $Domain ..." -ForegroundColor Cyan
& $opensslPath req -x509 -nodes -days 365 -newkey rsa:2048 `
  -keyout "$sslDir\privkey.pem" `
  -out "$sslDir\fullchain.pem" `
  -subj "/C=VN/ST=HoChiMinh/L=HoChiMinh/O=PCMall/OU=DevOps/CN=$Domain"

Copy-Item "$sslDir\fullchain.pem" "$sslDir\cert.pem" -Force
Copy-Item "$sslDir\privkey.pem" "$sslDir\key.pem" -Force

Write-Host "✅ [SSL Generator] Đã sinh chứng chỉ SSL thành công tại: $sslDir" -ForegroundColor Green
Get-ChildItem $sslDir

