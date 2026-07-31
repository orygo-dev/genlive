#!/usr/bin/env bash
# Deploy / start GenMeet on aaPanel with PM2 (absolute paths only).
# Usage (from project root):
#   bash scripts/aapanel-pm2.sh
#   bash scripts/aapanel-pm2.sh --build   # pull not included; run build then start
#   bash scripts/aapanel-pm2.sh --full   # npm ci + migrate + build + start

set -euo pipefail

APP_NAME="${PM2_APP_NAME:-genmeet}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STANDALONE="$ROOT/.next/standalone"
SERVER_JS="$STANDALONE/server.js"
MODE="${1:-start}"

cd "$ROOT"

echo "==> Project root: $ROOT"

if [[ ! -f "$ROOT/.env.production" ]]; then
  echo "ERROR: $ROOT/.env.production tidak ada."
  echo "Buat dulu: cp .env.example .env.production && nano .env.production"
  exit 1
fi

# Keep local symlinks for Prisma / Next
ln -sfn .env.production .env
ln -sfn .env.production .env.local

# Read PORT (default 3010)
PORT="$(grep -E '^PORT=' .env.production | tail -n1 | cut -d= -f2- | tr -d '\r' | tr -d '"' | tr -d "'")"
PORT="${PORT:-3010}"

if ! grep -qE '^DATABASE_URL=.+' .env.production; then
  echo "ERROR: DATABASE_URL kosong di .env.production"
  exit 1
fi

if [[ "$MODE" == "--full" ]]; then
  echo "==> npm ci"
  npm ci
  echo "==> db:deploy"
  npm run db:deploy
  echo "==> build"
  npm run build
elif [[ "$MODE" == "--build" ]]; then
  echo "==> build"
  npm run build
fi

if [[ ! -f "$SERVER_JS" ]]; then
  echo "ERROR: $SERVER_JS tidak ditemukan."
  echo "Jalankan: npm run build"
  echo "Atau: bash scripts/aapanel-pm2.sh --build"
  exit 1
fi

echo "==> Sync public/static/env ke standalone"
mkdir -p "$STANDALONE/.next"
rm -rf "$STANDALONE/public"
cp -a "$ROOT/public" "$STANDALONE/public"
rm -rf "$STANDALONE/.next/static"
cp -a "$ROOT/.next/static" "$STANDALONE/.next/static"
cp -f "$ROOT/.env.production" "$STANDALONE/.env.production"
cp -f "$ROOT/.env.production" "$STANDALONE/.env"

# Ensure PORT / HOSTNAME present in standalone env
if ! grep -qE '^PORT=' "$STANDALONE/.env"; then
  echo "PORT=$PORT" >> "$STANDALONE/.env"
fi
if ! grep -qE '^HOSTNAME=' "$STANDALONE/.env"; then
  echo "HOSTNAME=0.0.0.0" >> "$STANDALONE/.env"
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "ERROR: pm2 tidak ditemukan. Install: npm install -g pm2"
  exit 1
fi

echo "==> PM2 start $APP_NAME on port $PORT"
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
pm2 start "$SERVER_JS" \
  --name "$APP_NAME" \
  --cwd "$STANDALONE" \
  --update-env \
  --env production

pm2 save

echo "==> Status"
pm2 show "$APP_NAME" | sed -n '1,25p' || pm2 status

echo "==> Health check http://127.0.0.1:${PORT}/api/health"
sleep 2
if curl -fsS "http://127.0.0.1:${PORT}/api/health"; then
  echo
  echo "OK: GenMeet berjalan di port $PORT"
  echo "Pastikan Apache/Nginx mem-proxy ke http://127.0.0.1:${PORT}"
else
  echo
  echo "GAGAL health check. Lihat log:"
  echo "  pm2 logs $APP_NAME --lines 80"
  exit 1
fi
