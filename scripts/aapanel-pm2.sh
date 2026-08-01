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
if [[ -z "$(read_env LIVEKIT_URL)" || "$(read_env LIVEKIT_URL)" != wss://* ]]; then
  echo "WARNING: LIVEKIT_URL belum diisi di .env.production."
  echo "         Isi lewat Super Admin → Integrasi setelah app jalan, atau set LIVEKIT_URL=wss://..."
fi

ENC_KEY="$(read_env APP_ENCRYPTION_KEY)"
if [[ -z "$ENC_KEY" || ${#ENC_KEY} -lt 32 ]]; then
  NEW_KEY="$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p | head -c 64)"
  if [[ -z "$NEW_KEY" || ${#NEW_KEY} -lt 32 ]]; then
    echo "ERROR: Gagal membuat APP_ENCRYPTION_KEY otomatis."
    exit 1
  fi
  {
    echo ""
    echo "# Auto-generated $(date -Is) — untuk menyimpan secret Integrasi di database"
    echo "APP_ENCRYPTION_KEY=$NEW_KEY"
  } >> "$ROOT/.env.production"
  echo "==> APP_ENCRYPTION_KEY dibuat otomatis dan ditambahkan ke .env.production"
fi

ensure_deps() {
  if [[ ! -x "$ROOT/node_modules/.bin/prisma" || ! -d "$ROOT/node_modules/next" ]]; then
    echo "==> node_modules tidak lengkap — menjalankan npm ci"
    npm ci
  fi
}

if [[ "$MODE" == "--full" ]]; then
  npm ci
  npm run db:deploy
  npm run build
elif [[ "$MODE" == "--build" ]]; then
  ensure_deps
  npm run build
else
  # start saja: tetap pastikan binary prisma/next ada bila perlu rebuild lokal
  if [[ ! -f "$SERVER_JS" ]]; then
    ensure_deps
  fi
fi

if [[ ! -f "$SERVER_JS" ]]; then
  echo "ERROR: $SERVER_JS tidak ditemukan. Jalankan: bash scripts/aapanel-pm2.sh --build"
  exit 1
fi

echo "==> Sync public/static/env ke standalone"
mkdir -p "$STANDALONE/.next"
mkdir -p "$ROOT/data/uploads/brand"
mkdir -p "$ROOT/public/uploads/brand"

# Jangan hilangkan upload brand saat sync public
UPLOAD_BACKUP=""
if [[ -d "$STANDALONE/public/uploads" ]]; then
  UPLOAD_BACKUP="$(mktemp -d /tmp/genmeet-uploads.XXXXXX)"
  cp -a "$STANDALONE/public/uploads/." "$UPLOAD_BACKUP/" 2>/dev/null || true
fi

rm -rf "$STANDALONE/public"
cp -a "$ROOT/public" "$STANDALONE/public"
mkdir -p "$STANDALONE/public/uploads/brand"
mkdir -p "$STANDALONE/data/uploads/brand"

# Mirror persistent data uploads into standalone public for static fallback
if [[ -d "$ROOT/data/uploads/brand" ]]; then
  cp -a "$ROOT/data/uploads/brand/." "$STANDALONE/public/uploads/brand/" 2>/dev/null || true
  cp -a "$ROOT/data/uploads/brand/." "$STANDALONE/data/uploads/brand/" 2>/dev/null || true
fi
if [[ -n "$UPLOAD_BACKUP" && -d "$UPLOAD_BACKUP" ]]; then
  cp -a "$UPLOAD_BACKUP/." "$STANDALONE/public/uploads/" 2>/dev/null || true
  rm -rf "$UPLOAD_BACKUP"
fi

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
const path = require("path");
const standalone = process.env.GENMEET_STANDALONE;
const logsDir = path.join(standalone, "logs");
fs.mkdirSync(logsDir, { recursive: true });

const cfg = {
  apps: [
    {
      name: process.env.GENMEET_APP_NAME,
      script: process.env.GENMEET_SERVER_JS,
      cwd: standalone,
      node_args: `--env-file=${process.env.GENMEET_ENV_FILE}`,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      // Hindari status "errored" cepat: restart dengan backoff, reset counter setelah stabil.
      max_restarts: 80,
      min_uptime: "10s",
      exp_backoff_restart_delay: 200,
      restart_delay: 3000,
      max_memory_restart: "1024M",
      kill_timeout: 8000,
      listen_timeout: 12000,
      time: true,
      merge_logs: true,
      error_file: path.join(logsDir, "genmeet-error.log"),
      out_file: path.join(logsDir, "genmeet-out.log"),
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
  `${standalone}/ecosystem.config.cjs`,
  `module.exports = ${JSON.stringify(cfg, null, 2)};\n`,
);
NODE

echo "==> PM2 start $APP_NAME on port $PORT"
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
pm2 start "$ECOSYSTEM"
pm2 save

# Pastikan PM2 hidup lagi setelah reboot (aman dipanggil berulang)
if command -v systemctl >/dev/null 2>&1; then
  pm2 startup systemd -u root --hp /root >/tmp/genmeet-pm2-startup.txt 2>&1 || true
fi

echo "==> Menunggu health check..."
ok=0
for _ in $(seq 1 20); do
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
  echo "Tip: aktifkan keepalive cron: bash scripts/pm2-keepalive.sh (lihat AAPANEL.md)"
  exit 0
fi

echo "GAGAL health check. Log:"
pm2 logs "$APP_NAME" --lines 60 --nostream || true
exit 1
