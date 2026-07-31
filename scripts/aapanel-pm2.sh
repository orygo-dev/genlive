#!/usr/bin/env bash
# Deploy / start GenMeet on aaPanel with PM2 (absolute paths only).
# Usage:
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
  exit 1
fi

ln -sfn .env.production .env
ln -sfn .env.production .env.local

read_env() {
  local key="$1"
  grep -E "^${key}=" .env.production | tail -n1 | cut -d= -f2- | tr -d '\r' | tr -d '"' | tr -d "'" || true
}

PORT="$(read_env PORT)"
PORT="${PORT:-3010}"
APP_URL="$(read_env APP_URL)"

if [[ -z "$(read_env DATABASE_URL)" ]]; then
  echo "ERROR: DATABASE_URL kosong di .env.production"
  exit 1
fi
if [[ -z "$APP_URL" ]]; then
  echo "ERROR: APP_URL kosong. Contoh: APP_URL=https://genlive.guruspaceai.cloud"
  exit 1
fi
if [[ "$APP_URL" != https://* ]]; then
  echo "ERROR: APP_URL harus HTTPS (sekarang: $APP_URL)"
  echo "Perbaiki: nano .env.production  →  APP_URL=https://domain-anda.com"
  exit 1
fi
if [[ "$(read_env LIVEKIT_URL)" != wss://* ]]; then
  echo "ERROR: LIVEKIT_URL harus diawali wss://"
  exit 1
fi

if [[ "$MODE" == "--full" ]]; then
  npm ci
  npm run db:deploy
  npm run build
elif [[ "$MODE" == "--build" ]]; then
  npm run build
fi

if [[ ! -f "$SERVER_JS" ]]; then
  echo "ERROR: $SERVER_JS tidak ditemukan. Jalankan: bash scripts/aapanel-pm2.sh --build"
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

# Paksa nilai runtime yang benar di file env standalone
grep -qE '^PORT=' "$ENV_FILE" && sed -i "s/^PORT=.*/PORT=$PORT/" "$ENV_FILE" || echo "PORT=$PORT" >> "$ENV_FILE"
grep -qE '^HOSTNAME=' "$ENV_FILE" && sed -i "s/^HOSTNAME=.*/HOSTNAME=0.0.0.0/" "$ENV_FILE" || echo "HOSTNAME=0.0.0.0" >> "$ENV_FILE"
grep -qE '^NODE_ENV=' "$ENV_FILE" && sed -i "s/^NODE_ENV=.*/NODE_ENV=production/" "$ENV_FILE" || echo "NODE_ENV=production" >> "$ENV_FILE"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "ERROR: pm2 tidak ditemukan"
  exit 1
fi

ECOSYSTEM="$STANDALONE/ecosystem.config.cjs"
export GENMEET_APP_NAME="$APP_NAME"
export GENMEET_SERVER_JS="$SERVER_JS"
export GENMEET_STANDALONE="$STANDALONE"
export GENMEET_ENV_FILE="$ENV_FILE"
export GENMEET_PORT="$PORT"
export GENMEET_APP_URL="$APP_URL"

node <<'NODE'
const fs = require("fs");
const cfg = {
  apps: [
    {
      name: process.env.GENMEET_APP_NAME,
      script: process.env.GENMEET_SERVER_JS,
      cwd: process.env.GENMEET_STANDALONE,
      node_args: `--env-file=${process.env.GENMEET_ENV_FILE}`,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: process.env.GENMEET_PORT,
        HOSTNAME: "0.0.0.0",
        APP_URL: process.env.GENMEET_APP_URL,
      },
    },
  ],
};
fs.writeFileSync(
  `${process.env.GENMEET_STANDALONE}/ecosystem.config.cjs`,
  `module.exports = ${JSON.stringify(cfg, null, 2)};\n`,
);
NODE

echo "==> PM2 start $APP_NAME on port $PORT"
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
pm2 start "$ECOSYSTEM"
pm2 save

echo "==> Menunggu health check..."
ok=0
for _ in $(seq 1 12); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/tmp/genmeet-health.json 2>/dev/null; then
    ok=1
    break
  fi
  sleep 1
done

if [[ "$ok" -eq 1 ]]; then
  echo "==> Health OK:"
  cat /tmp/genmeet-health.json
  echo
  echo "OK: GenMeet di port $PORT — proxy Apache/Nginx ke http://127.0.0.1:${PORT}"
  exit 0
fi

echo "GAGAL health check. Log:"
pm2 logs "$APP_NAME" --lines 60 --nostream || true
exit 1
