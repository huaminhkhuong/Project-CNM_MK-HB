#!/bin/bash
# ==============================================================================
# PC MALL - AUTOMATED DATABASE BACKUP SCRIPT (PRODUCTION LINUX / DOCKER)
# ==============================================================================
# Performs full mysqldump, compresses with gzip, and enforces 7-day retention.
#
# Usage:
#   bash scripts/backup-db.sh
#   Or via crontab (e.g. at 02:00 AM daily):
#   0 2 * * * /bin/bash /app/scripts/backup-db.sh >> /app/logs/backup.log 2>&1
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups"

# Load environment variables from .env if present
if [ -f "${PROJECT_ROOT}/.env" ]; then
  # shellcheck disable=SC1091
  source "${PROJECT_ROOT}/.env"
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-password}"
DB_NAME="${DB_NAME:-cnm_mk_hb}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

mkdir -p "${BACKUP_DIR}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "=========================================================="
echo "📦 [PC Mall DB Backup] Starting backup for: ${DB_NAME}"
echo "📅 Timestamp: $(date)"
echo "🖥️ Host: ${DB_HOST}:${DB_PORT} | User: ${DB_USER}"
echo "=========================================================="

# Check if mysqldump is installed
if ! command -v mysqldump &> /dev/null; then
  # Fallback for docker environment: check if cnm_mysql container is running
  if command -v docker &> /dev/null && docker ps | grep -q "cnm_mysql"; then
    echo "🐳 Using docker exec to dump from cnm_mysql container..."
    docker exec cnm_mysql mysqldump \
      -u"${DB_USER}" -p"${DB_PASSWORD}" \
      --default-character-set=utf8mb4 \
      --single-transaction \
      --quick \
      --routines \
      --triggers \
      "${DB_NAME}" | gzip -9 > "${BACKUP_FILE}"
  elif command -v docker &> /dev/null && docker ps | grep -q "cnm_mysql_prod"; then
    echo "🐳 Using docker exec to dump from cnm_mysql_prod container..."
    docker exec cnm_mysql_prod mysqldump \
      -u"${DB_USER}" -p"${DB_PASSWORD}" \
      --default-character-set=utf8mb4 \
      --single-transaction \
      --quick \
      --routines \
      --triggers \
      "${DB_NAME}" | gzip -9 > "${BACKUP_FILE}"
  else
    echo "❌ Error: mysqldump command not found and no active MySQL container detected."
    exit 1
  fi
else
  mysqldump \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --user="${DB_USER}" \
    --password="${DB_PASSWORD}" \
    --default-character-set=utf8mb4 \
    --single-transaction \
    --quick \
    --routines \
    --triggers \
    "${DB_NAME}" | gzip -9 > "${BACKUP_FILE}"
fi

# Verify backup file was created and is non-empty
if [ -s "${BACKUP_FILE}" ]; then
  FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo "✅ Backup successfully created!"
  echo "📁 Location: ${BACKUP_FILE} (${FILE_SIZE})"
else
  echo "❌ Error: Backup file is empty or failed to generate."
  exit 1
fi

# Enforce retention policy: delete backups older than RETENTION_DAYS
echo "🧹 Purging backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "backup_${DB_NAME}_*.sql.gz" -mtime +"${RETENTION_DAYS}" -exec rm -f {} \; -print
echo "🎉 [PC Mall DB Backup] Completed successfully."
echo "=========================================================="

