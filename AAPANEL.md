# Panduan Install GenMeet di aaPanel (Apache + MySQL)

Panduan ini untuk memasang GenMeet di **VPS/server dengan aaPanel**, memakai:

- **Apache** (atau Nginx) sebagai reverse proxy + SSL
- **MySQL** sebagai database GenMeet (bawaan aaPanel)
- **Node.js 22** + **PM2** untuk menjalankan aplikasi

> GenMeet **bukan** aplikasi PHP. Jangan dijalankan lewat Document Root PHP biasa.

Checklist go-live umum: [`PRODUCTION.md`](./PRODUCTION.md).  
Enterprise (OAuth, DPA, PWA, HA): [`ENTERPRISE.md`](./ENTERPRISE.md).

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
| GenMeet (Node) | `3010` (localhost saja; ubah jika bentrok) |
| MySQL | `3306` |
| Apache | `80` / `443` |

> Port `3000` sering sudah dipakai app lain di aaPanel. Panduan ini memakai
> **`3010`**. Kalau diganti, samakan di `.env.production` (`PORT=...`) dan
> reverse proxy Apache/Nginx.

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

Wajib di file env (tidak diganti dari UI):

```bash
NODE_ENV=production
PORT=3010
HOSTNAME=0.0.0.0

DATABASE_URL=mysql://genmeet:PASSWORD@127.0.0.1:3306/genmeet
# openssl rand -base64 32
APP_ENCRYPTION_KEY=ganti-dengan-kunci-rahasia-minimal-32-karakter

SESSION_COOKIE_NAME=genmeet_session
APP_URL=https://meet.domainanda.com
```

Opsional di `.env` **atau** isi nanti dari `/admin` → **Integrasi**:

```bash
LIVEKIT_URL=wss://xxxx.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...

SUPER_ADMIN_EMAIL=anda@perusahaan.com
RESEND_API_KEY=...
EMAIL_FROM="GenMeet <noreply@domainanda.com>"
```

Prisma & Next membaca `.env.local` / `.env` / `.env.production`. Buat symlink
**sebelum** `npm ci` (karena `postinstall` menjalankan `prisma generate`):

```bash
chmod 600 .env.production
ln -sf .env.production .env
ln -sf .env.production .env.local
# pastikan DATABASE_URL terbaca:
grep ^DATABASE_URL .env.local
npm run check:env -- --strict
```

> Error `Cannot resolve environment variable: DATABASE_URL` artinya file env
> belum ada / belum di-symlink. Jangan jalankan `npm ci` sebelum langkah ini.
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

Dari root proyek (path absolut otomatis — tidak perlu `$APP_DIR`):

```bash
cd /www/wwwroot/genlive.guruspaceai.cloud
chmod +x scripts/aapanel-pm2.sh

# Jika sudah build:
bash scripts/aapanel-pm2.sh

# Install + migrasi + build + start:
bash scripts/aapanel-pm2.sh --full
```

Skrip ini akan:
1. Memakai path proyek saat ini (bukan `/www/wwwroot/genmeet` contoh)
2. Menyalin `public`, `.next/static`, dan `.env` ke standalone
3. Menjalankan PM2 dengan path absolut `server.js`
4. Mengecek `http://127.0.0.1:$PORT/api/health` (`PORT` dari `.env.production`, default `3010`)

Lihat log jika gagal:

```bash
pm2 logs genmeet --lines 80
```

Pastikan reverse proxy Apache/Nginx mengarah ke **port yang sama** dengan `PORT`
di `.env.production`.
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

ProxyPass / http://127.0.0.1:3010/
ProxyPassReverse / http://127.0.0.1:3010/

RewriteEngine On
RewriteCond %{HTTP:Upgrade} =websocket [NC]
RewriteRule /(.*) ws://127.0.0.1:3010/$1 [P,L]
```

### Nginx (jika dipakai)

```nginx
location / {
  proxy_pass http://127.0.0.1:3010;
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

## 9. Cron reminder WhatsApp / email / billing / retensi

**Wajib di VPS/aaPanel** (tanpa ini reminder T-24h / T-1h tidak jalan).

aaPanel → **Cron** → tiap **15 menit** → Script:

```bash
curl -fsS -X GET "https://genlive.guruspaceai.cloud/api/cron/meeting-reminders" \
  -H "Authorization: Bearer CRON_SECRET_ANDA"
```

**Plan Pro expiry (Phase 2)** — tiap **15 menit**:

```bash
curl -fsS -X GET "https://genlive.guruspaceai.cloud/api/cron/plan-reminders" \
  -H "Authorization: Bearer CRON_SECRET_ANDA"
```

**Retensi recording (Phase 2)** — sekali sehari (03:00):

```bash
curl -fsS -X GET "https://genlive.guruspaceai.cloud/api/cron/recording-retention" \
  -H "Authorization: Bearer CRON_SECRET_ANDA"
```

Pastikan `CRON_SECRET` di `.env.production` (atau `/admin` → Integrasi) sama dengan bearer di atas.

Cek log cron aaPanel bila gagal (401 = secret salah; 503 = app down).

Uptime: pantau `GET /api/health` (harus HTTP 200). Alert jika 503.

---

## 9b. Persistensi upload brand & recording

Folder penting di server (jangan dihapus saat deploy):

```text
/www/wwwroot/.../data/uploads/brand
/www/wwwroot/.../public/uploads/brand
```

Script `aapanel-pm2.sh` sudah mirror `data/uploads` → standalone. Untuk production serius, mount volume disk terpisah ke `data/uploads` atau arahkan egress recording ke S3 (`LIVEKIT_EGRESS_S3_*`).

SVG **tidak** diizinkan untuk logo (cegah XSS); gunakan PNG/WebP/JPG.
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
cd /www/wwwroot/genlive.guruspaceai.cloud
git pull
# pastikan APP_ENCRYPTION_KEY ada di .env.production (≥32 karakter)
grep ^APP_ENCRYPTION_KEY .env.production || echo "TAMBAHKAN APP_ENCRYPTION_KEY dulu"
npm run db:deploy
bash scripts/aapanel-pm2.sh --full
```

Setelah PM2 hidup:

1. Login Super Admin → `/admin` → **Integrasi** → isi LiveKit → **Tes koneksi**.
2. Buat org/user, atur katalog plan, uji force end meeting jika perlu.

---

## 13. Troubleshooting

| Gejala | Periksa |
|--------|---------|
| 502 | `pm2 status`, `curl 127.0.0.1:3010/api/health`, cek port proxy = `PORT` |
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
Internet → Apache/Nginx (:443) → PM2 GenMeet (:3010) → MySQL (:3306)
Browser  ←──WebRTC──→ LiveKit Cloud
```
