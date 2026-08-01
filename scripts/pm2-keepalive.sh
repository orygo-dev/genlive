#!/usr/bin/env bash
# Pastikan proses GenMeet di PM2 tetap online.
# Cocok untuk cron aaPanel tiap 1–2 menit.
#
#   * * * * * bash /www/wwwroot/genlive.guruspaceai.cloud/scripts/pm2-keepalive.sh >> /var/log/genmeet-keepalive.log 2>&1
#
set -euo pipefail

APP_NAME="${PM2_APP_NAME:-genmeet}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STANDALONE="$ROOT/.next/standalone"
ECOSYSTEM="$STANDALONE/ecosystem.config.cjs"
PORT="$(
  grep -E '^PORT=' "$ROOT/.env.production" 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '\r"' || true
)"
PORT="${PORT:-3010}"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "$(date -Is) ERROR: pm2 tidak ditemukan"
  exit 1
fi

status="$(pm2 jlist 2>/dev/null | node -e "
let raw='';
process.stdin.on('data', d => raw += d);
process.stdin.on('end', () => {
  try {
    const apps = JSON.parse(raw || '[]');
    const app = apps.find((item) => item.name === process.env.APP_NAME);
    if (!app) {
      process.stdout.write('missing');
      return;
    }
    process.stdout.write(String(app.pm2_env?.status || 'unknown'));
  } catch {
    process.stdout.write('unknown');
  }
});
" APP_NAME="$APP_NAME")" || status="unknown"

healthy=0
if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
  healthy=1
fi

if [[ "$status" == "online" && "$healthy" -eq 1 ]]; then
  exit 0
fi

echo "$(date -Is) WARN: genmeet status=$status healthy=$healthy — restart"

if [[ -f "$ECOSYSTEM" ]]; then
  pm2 describe "$APP_NAME" >/dev/null 2>&1 && pm2 restart "$APP_NAME" --update-env || pm2 start "$ECOSYSTEM"
else
  bash "$ROOT/scripts/aapanel-pm2.sh"
fi

pm2 save >/dev/null 2>&1 || true

# beri waktu boot singkat
sleep 3
if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
  echo "$(date -Is) OK: genmeet pulih"
  exit 0
fi

echo "$(date -Is) ERROR: genmeet masih down setelah restart"
pm2 logs "$APP_NAME" --lines 30 --nostream || true
exit 1
