#!/usr/bin/env sh
set -eu

COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.prod.yml}"

echo "🚀 [1/4] Pulling latest code from main branch..."
git pull origin main

echo "📁 [2/4] Ensuring data directories exist..."
mkdir -p data/images services/api/uploads services/api/src/data logs/nginx nginx/ssl

echo "🐳 [3/4] Building and updating Docker containers..."
docker compose $COMPOSE_FILES up -d --build
docker compose $COMPOSE_FILES ps

echo "🧹 [4/4] Pruning dangling images to save disk space..."
docker image prune -f

if [ "${SKIP_SMOKE:-0}" != "1" ]; then
  echo "🔍 Running smoke tests..."
  npm run prod:smoke || true
fi

echo "✅ Deployment finished successfully!"
