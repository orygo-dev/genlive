#!/usr/bin/env bash
# Deploy / start GenMeet on aaPanel with PM2 (absolute paths only).
# Usage (from project root):
#   bash scripts/aapanel-pm2.sh
#   bash scripts/aapanel-pm2.sh --build
#   bash scripts/aapanel-pm2.sh --full

set -euo pipefail

APP_NAME="${PM2_APP_NAME:-genmeet}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STANDALONE="$ROOT/.next/standalone"
SERVER_JS="$STANDALONE/server.js"
ENV_FILE="$STANDALONE/.env"
MODE="${1:-start}"

cd "$ROOT"

echo "==> Project root: $ROOT"

if [[ ! -f "$ROOT/.env.production" ]]; then
  echo "ERROR: $ROOT/.env.production tidak ada."
  echo "Buat dulu: cp .env.example .env.production && nano .env.production"
  exit 1
fi

ln -sfn .env.production .env
ln -sfn .env.production .env.local

PORT="$(grep -E '^PORT=' .env.production | tail -n1 | cut -d= -f2- | tr -d '\r' | tr -d '"' | tr -d "'" || true)"
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
  echo "Jalankan: bash scripts/aapanel-pm2.sh --build"
  exit 1
fi

echo "==> Sync public/static/env ke standalone"
mkdir -p "$STANDALONE/.next"
rm -rf "$STANDALONE/public"
cp -a "$ROOT/public" "$STANDALONE/public"
rm -rf "$STANDALONE/.next/static"
cp -a "$ROOT/.next/static" "$STANDALONE/.next/static"
cp -f "$ROOT/.env.production" "$STANDALONE/.env.production"
cp -f "$ROOT/.env.production" "$ENV_FILE"

grep -qE '^PORT=' "$ENV_FILE" || echo "PORT=$PORT" >> "$ENV_FILE"
grep -qE '^HOSTNAME=' "$ENV_FILE" || echo "HOSTNAME=0.0.0.0" >> "$ENV_FILE"
grep -qE '^NODE_ENV=' "$ENV_FILE" || echo "NODE_ENV=production" >> "$ENV_FILE"

# Normalize PORT in file to the value we health-check
if grep -qE '^PORT=' "$ENV_FILE"; then
  sed -i "s/^PORT=.*/PORT=$PORT/" "$ENV_FILE"
else
  echo "PORT=$PORT" >> "$ENV_FILE"
fi
sed -i "s/^HOSTNAME=.*/HOSTNAME=0.0.0.0/" "$ENV_FILE" 2>/dev/null || echo "HOSTNAME=0.0.0.0" >> "$ENV_FILE"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "ERROR: pm2 tidak ditemukan. Install: npm install -g pm2"
  exit 1
fi

echo "==> PM2 start $APP_NAME on port $PORT (Node --env-file)"
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true

# Next standalone TIDAK memuat .env sendiri. Node 20+ --env-file wajib.
pm2 start "$SERVER_JS" \
  --name "$APP_NAME" \
  --cwd "$STANDALONE" \
  --update-env \
  --node-args="--env-file=$ENV_FILE"

pm2 save

echo "==> Status"
pm2 show "$APP_NAME" | sed -n '1,30p' || pm2 status

echo "==> Menunggu server siap..."
ok=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/tmp/genmeet-health.json 2>/dev/null; then
    ok=1
    break
  fi
  # Deteksi jika salah listen di 3000
  if curl -fsS "http://127.0.0.1:3000/api/health" >/dev/null 2>&1; then
    echo "WARN: ada response di :3000 — cek apakah PORT terbaca."
  fi
  sleep 1
done

if [[ "$ok" -eq 1 ]]; then
  echo "==> Health OK:"
  cat /tmp/genmeet-health.json
  echo
  echo "OK: GenMeet berjalan di port $PORT"
  echo "Pastikan Apache/Nginx mem-proxy ke http://127.0.0.1:${PORT}"
  exit 0
fi

echo
echo "GAGAL health check di http://127.0.0.1:${PORT}/api/health"
echo "==> pm2 logs (80 baris terakhir):"
pm2 logs "$APP_NAME" --lines 80 --nostream || true
echo
echo "==> Port listen (node):"
ss -lptn 'sport = :'"$PORT" || netstat -lptn 2>/dev/null | grep ".$PORT" || true
exit 1
