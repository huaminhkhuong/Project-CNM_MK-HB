#!/bin/sh
# ==============================================================================
# PC Mall API Production Container Entrypoint
# Chạy migration database và khởi động tiến trình Node với exec để bắt đúng SIGTERM
# ==============================================================================
set -e

echo "🚀 [API Entrypoint] Running canonical database migrations..."
node scripts/migrate.js

echo "⚡ [API Entrypoint] Starting API server on port ${PORT:-4000}..."
exec npx tsx src/server.ts

