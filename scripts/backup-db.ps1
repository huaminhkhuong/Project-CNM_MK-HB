<#
.SYNOPSIS
    Automated Database Backup Script for PC Mall (Windows / PowerShell)
.DESCRIPTION
    Dumps MySQL database, compresses to .gz, and maintains a 7-day retention policy.
#>

param(
    [string]$DbHost = $env:DB_HOST,
    [string]$DbPort = $env:DB_PORT,
    [string]$DbUser = $env:DB_USER,
    [string]$DbPassword = $env:DB_PASSWORD,
    [string]$DbName = $env:DB_NAME,
    [int]$RetentionDays = 7
)

$ErrorActionPreference = "Stop"

if (-not $DbHost) { $DbHost = "127.0.0.1" }
if (-not $DbPort) { $DbPort = "3307" }
if (-not $DbUser) { $DbUser = "root" }
if (-not $DbPassword) { $DbPassword = "password" }
if (-not $DbName) { $DbName = "cnm_mk_hb" }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackupDir = Join-Path $ProjectRoot "backups"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$DumpSql = Join-Path $BackupDir "backup_${DbName}_${Timestamp}.sql"
$ArchiveGz = Join-Path $BackupDir "backup_${DbName}_${Timestamp}.sql.gz"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "📦 [PC Mall DB Backup] Starting backup for: $DbName" -ForegroundColor Green
Write-Host "📅 Timestamp: $(Get-Date)"
Write-Host "🖥️ Host: ${DbHost}:${DbPort} | User: $DbUser"
Write-Host "==========================================================" -ForegroundColor Cyan

# Check for mysqldump executable or docker container
$hasMysqldump = Get-Command mysqldump -ErrorAction SilentlyContinue
$dockerRunning = Get-Command docker -ErrorAction SilentlyContinue

if ($hasMysqldump) {
    Write-Host "Running native mysqldump..." -ForegroundColor Yellow
    & mysqldump --host=$DbHost --port=$DbPort --user=$DbUser --password=$DbPassword --default-character-set=utf8mb4 --single-transaction --quick --routines --triggers $DbName > $DumpSql
} elseif ($dockerRunning) {
    Write-Host "🐳 Running mysqldump via Docker container..." -ForegroundColor Yellow
    $container = (docker ps --format "{{.Names}}" | Select-String -Pattern "mysql" | Select-Object -First 1)
    if ($container) {
        docker exec $container.ToString().Trim() mysqldump -u"$DbUser" -p"$DbPassword" --default-character-set=utf8mb4 --single-transaction --quick --routines --triggers $DbName > $DumpSql
    } else {
        Write-Error "No MySQL container running and native mysqldump not found."
    }
} else {
    Write-Error "Neither mysqldump nor docker is installed on this system."
}

if ((Test-Path $DumpSql) -and ((Get-Item $DumpSql).Length -gt 0)) {
    Write-Host "Compressing backup file..." -ForegroundColor Yellow
    # Compress using .NET GZipStream
    $inputFile = [System.IO.File]::OpenRead($DumpSql)
    $outputFile = [System.IO.File]::Create($ArchiveGz)
    $gzipStream = New-Object System.IO.Compression.GZipStream($outputFile, [System.IO.Compression.CompressionMode]::Compress)
    $inputFile.CopyTo($gzipStream)
    $gzipStream.Close()
    $outputFile.Close()
    $inputFile.Close()
    Remove-Item $DumpSql -Force

    $sizeKb = [Math]::Round((Get-Item $ArchiveGz).Length / 1KB, 2)
    Write-Host "✅ Backup created successfully: $ArchiveGz ($sizeKb KB)" -ForegroundColor Green
} else {
    Write-Error "Backup file failed to generate or is empty."
}

# Purge files older than RetentionDays
Write-Host "🧹 Purging backups older than $RetentionDays days..." -ForegroundColor Gray
$cutoffDate = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter "backup_${DbName}_*.sql.gz" | Where-Object { $_.LastWriteTime -lt $cutoffDate } | ForEach-Object {
    Write-Host "Deleting old backup: $($_.Name)" -ForegroundColor DarkGray
    Remove-Item $_.FullName -Force
}

Write-Host "🎉 [PC Mall DB Backup] Completed successfully." -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

