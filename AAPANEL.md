# Panduan Install GenMeet di aaPanel (Apache + MySQL)

Panduan ini untuk memasang GenMeet di **VPS/server dengan aaPanel**, memakai:

- **Apache** (atau Nginx) sebagai reverse proxy + SSL
- **MySQL** sebagai database GenMeet (bawaan aaPanel)
- **Node.js 22** + **PM2** untuk menjalankan aplikasi

> GenMeet **bukan** aplikasi PHP. Jangan dijalankan lewat Document Root PHP biasa.

Checklist go-live umum: [`PRODUCTION.md`](./PRODUCTION.md).

---

## 0. Persyaratan

| Item | Keterangan |
|------|------------|
| Server | VPS Linux + aaPanel |
| Domain | A record mengarah ke IP server |
| RAM | Minimal **2 GB** (disarankan 4 GB) |
| Database | **MySQL 8.x** (aaPanel) |
| Akun | LiveKit Cloud (wajib untuk video) |
| Opsional | Resend, Fonnte, Midtrans/iPaymu/Flip |

Port lokal:

| Layanan | Port |
|---------|------|
| GenMeet (Node) | `3000` (localhost saja) |
| MySQL | `3306` |
| Apache | `80` / `443` |

---

## 1. Domain & situs di aaPanel

1. **Website** → **Add site** → domain misalnya `meet.domainanda.com`.
2. PHP: *Static* / tidak wajib (GenMeet tidak pakai PHP).
3. Saat membuat situs, **buat database MySQL** (catat nama DB, user, password) **atau** buat manual di langkah 3.
4. Aktifkan **SSL** Let's Encrypt.
5. Pastikan `https://meet.domainanda.com` aktif.

---

## 2. Install Node.js + PM2

1. aaPanel → **App Store** → **Node.js Version Manager** → Install.
2. Pasang **Node.js 22.x**.
3. SSH:

```bash
node -v   # v22.x
npm -v
npm install -g pm2
pm2 -v
```

---

## 3. Database MySQL

### Via aaPanel (disarankan)

1. **Database** → **Add** (atau dari wizard situs).
2. Contoh:
   - Database: `genmeet`
   - User: `genmeet`
   - Password: password kuat
   - Access: `localhost`
3. Charset: **utf8mb4** / collation `utf8mb4_unicode_ci`.

### Uji koneksi

```bash
mysql -ugenmeet -p -h127.0.0.1 genmeet -e "SELECT 1;"
```

> Jangan buka port `3306` ke internet.

---

## 4. Upload kode GenMeet

```bash
sudo mkdir -p /www/wwwroot/genmeet
sudo chown -R $USER:$USER /www/wwwroot/genmeet
cd /www/wwwroot/genmeet
git clone URL_REPO_ANDA .
# atau extract ZIP ke folder ini
```

---

## 5. Environment production

```bash
cd /www/wwwroot/genmeet
cp .env.example .env.production
nano .env.production
```

Wajib:

```bash
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

APP_URL=https://meet.domainanda.com
DATABASE_URL=mysql://genmeet:PASSWORD@127.0.0.1:3306/genmeet

LIVEKIT_URL=wss://xxxx.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...

SESSION_COOKIE_NAME=genmeet_session
```

Opsional:

```bash
# Super Admin brand dashboard
SUPER_ADMIN_EMAIL=anda@perusahaan.com

# Email
RESEND_API_KEY=...
EMAIL_FROM="GenMeet <noreply@domainanda.com>"

```bash
chmod 600 .env.production
ln -sf .env.production .env
npm run check:env -- --strict
```

---

## 6. Install, migrasi, build

```bash
cd /www/wwwroot/genmeet
npm ci
npm run db:deploy
npm run build
```

`db:deploy` menerapkan migrasi MySQL (`prisma/migrations/..._mysql_init`).

---

## 7. Jalankan dengan PM2

```bash
cd /www/wwwroot/genmeet

cp -r public .next/standalone/public 2>/dev/null || true
cp -r .next/static .next/standalone/.next/static
cp .env.production .next/standalone/.env.production
cp .env.production .next/standalone/.env

pm2 start .next/standalone/server.js \
  --name genmeet \
  --cwd /www/wwwroot/genmeet/.next/standalone \
  --env production

pm2 save
pm2 startup
```

Alternatif:

```bash
pm2 start npm --name genmeet -- start
```

Uji lokal:

```bash
curl -s http://127.0.0.1:3000/api/health
```

---

## 8. Apache reverse proxy

Aktifkan modul:

```bash
sudo a2enmod proxy proxy_http proxy_wstunnel headers rewrite ssl
sudo systemctl restart httpd || sudo systemctl restart apache2
```

Di konfigurasi vhost HTTPS situs GenMeet:

```apache
ProxyPreserveHost On
RequestHeader set X-Forwarded-Proto "https"
RequestHeader set X-Forwarded-For "%{REMOTE_ADDR}s"

ProxyPass / http://127.0.0.1:3000/
ProxyPassReverse / http://127.0.0.1:3000/

RewriteEngine On
RewriteCond %{HTTP:Upgrade} =websocket [NC]
RewriteRule /(.*) ws://127.0.0.1:3000/$1 [P,L]
```

### Nginx (jika dipakai)

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_read_timeout 120s;
}
```

---

## 9. Cron reminder WhatsApp

aaPanel → **Cron** → tiap 15 menit:

```bash
curl -fsS -X GET "https://meet.domainanda.com/api/cron/meeting-reminders" \
  -H "Authorization: Bearer CRON_SECRET_ANDA"
```

---

## 10. Webhook

```text
https://meet.domainanda.com/api/livekit/webhook
https://meet.domainanda.com/api/payments/webhook/midtrans
https://meet.domainanda.com/api/payments/webhook/ipaymu
https://meet.domainanda.com/api/payments/webhook/flip
```

---

## 11. Uji

1. Landing + daftar akun
2. Meeting instan 2 browser
3. Jadwal + undangan WA (jika Fonnte)
4. `curl -s https://meet.domainanda.com/api/health`
5. `npm run smoke -- https://meet.domainanda.com`

---

## 12. Update aplikasi

```bash
cd /www/wwwroot/genmeet
git pull
npm ci
npm run db:deploy
npm run build
cp -r public .next/standalone/public 2>/dev/null || true
cp -r .next/static .next/standalone/.next/static
cp .env.production .next/standalone/.env
pm2 restart genmeet
```

---

## 13. Troubleshooting

| Gejala | Periksa |
|--------|---------|
| 502 | `pm2 status`, `curl 127.0.0.1:3000/api/health` |
| DB error | `DATABASE_URL` mysql://..., user, host `127.0.0.1` |
| Access denied MySQL | Hak user hanya `localhost`; password benar |
| Cookie / redirect | `APP_URL` HTTPS + `X-Forwarded-Proto` |
| Migrasi gagal | MySQL 8+, charset utf8mb4 |

Backup:

```bash
mysqldump -ugenmeet -p genmeet > /www/backup/genmeet-$(date +%F).sql
```

---

## Arsitektur

```text
Internet → Apache/Nginx (:443) → PM2 GenMeet (:3000) → MySQL (:3306)
Browser  ←──WebRTC──→ LiveKit Cloud
```
