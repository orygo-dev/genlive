# Production Go-Live — GenMeet

Checklist untuk merilis GenMeet ke production dengan aman.

Deploy di **aaPanel** (Apache/Nginx + MySQL + PM2): lihat
[`AAPANEL.md`](./AAPANEL.md).

Enterprise (Google OAuth, DPA, white-label, PWA, backup/HA): [`ENTERPRISE.md`](./ENTERPRISE.md).

## 0. Verifikasi lokal sebelum deploy

```bash
npm run ci
npm run check:env -- --strict   # memakai nilai production di env
```

CI GitHub Actions (`.github/workflows/ci.yml`) menjalankan typecheck, test, lint,
dan build pada setiap push/PR ke `main`/`master`.

## 1. Infrastruktur

- [ ] Domain HTTPS siap (`APP_URL=https://...`)
- [ ] MySQL 8+ (aaPanel / managed) + connection string `mysql://...`
- [ ] Deploy app (Vercel **atau** Docker/VPS **atau** aaPanel PM2)
- [ ] `npm run db:deploy` berhasil di environment production

### Vercel

1. Import repo ke Vercel.
2. Set Environment Variables dari `.env.example` (nilai production).
3. Build command memakai `vercel.json` (`prisma generate && next build`).
4. Setelah deploy pertama, jalankan migrate:

```bash
DATABASE_URL="mysql://..." npx prisma migrate deploy
```

Atau tambahkan Vercel build step / one-off job yang menjalankan `prisma migrate deploy`.

### Docker

```bash
docker build -t genmeet .
docker run --env-file .env.production -p 3000:3000 genmeet
```

Container menjalankan `prisma migrate deploy` lalu `node server.js`.

Postgres lokal untuk development:

```bash
docker compose up -d postgres
```

## 2. LiveKit

- [ ] Project LiveKit Cloud production
- [ ] `LIVEKIT_URL` = `wss://...`
- [ ] `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` production
- [ ] Webhook URL: `https://domain-anda.com/api/livekit/webhook`
- [ ] Event aktif: room, participant, **egress** (jika recording dipakai)
- [ ] Egress enabled di project (untuk recording)

## 3. Email & WhatsApp (opsional tapi disarankan)

### Email (Resend)
- [ ] Akun Resend + domain terverifikasi
- [ ] `RESEND_API_KEY`, `EMAIL_FROM`
- [ ] Uji undang anggota dari `/dashboard/members`

### WhatsApp (Fonnte)
- [ ] Device Fonnte terhubung
- [ ] `FONNTE_TOKEN`, `FONNTE_COUNTRY_CODE=62`
- [ ] `CRON_SECRET` untuk proteksi cron reminder
- [ ] Uji undangan WhatsApp dari detail meeting
- [ ] Pastikan cron `/api/cron/meeting-reminders` aktif (Vercel Cron / eksternal)
- [ ] Pastikan cron `/api/cron/plan-reminders` aktif (reminder perpanjang Pro)
- [ ] Pastikan cron `/api/cron/recording-retention` aktif (harian, retensi recording)

## 4. Billing Indonesia

Pilih minimal satu gateway dan set `PAYMENT_PROVIDER`.

### Midtrans
- [ ] Server Key + Client Key production
- [ ] `MIDTRANS_IS_PRODUCTION=true`
- [ ] Notification URL: `https://domain-anda.com/api/payments/webhook/midtrans`

### iPaymu
- [ ] VA + API Key production
- [ ] `IPAYMU_IS_PRODUCTION=true`
- [ ] Notify URL diarahkan ke `/api/payments/webhook/ipaymu`

### Flip Business
- [ ] Accept Payment diaktifkan
- [ ] `FLIP_SECRET_KEY`, `FLIP_VALIDATION_TOKEN`
- [ ] `FLIP_IS_PRODUCTION=true`
- [ ] Callback: `/api/payments/webhook/flip`

## 5. Keamanan

- [ ] Cookie session otomatis `secure` di `NODE_ENV=production`
- [ ] Secret LiveKit / gateway / DB tidak masuk git
- [ ] `npm run check:env -- --strict` lulus sebelum go-live
- [ ] `GET /api/health` mengembalikan `status: "ok"` (tanpa detail error internal)
- [ ] Proxy `/dashboard` mengalihkan user tanpa session ke `/auth`
- [ ] `robots.txt` memblokir `/dashboard`, `/api`, `/meeting`

Boot production menjalankan `assertProductionEnv()` via `src/instrumentation.ts`
(credential billing tetap opsional sampai gateway dipakai).

## 6. Uji smoke production

Otomatis (health):

```bash
npm run smoke -- https://domain-anda.com
```

Manual:

1. Buka landing → daftar akun baru
2. Verifikasi email (opsional) & uji lupa/reset password
3. Buat meeting instan + gabung 2 browser
4. Jadwalkan meeting → undangan email/WhatsApp (jika Resend/Fonnte aktif)
5. Unduh ICS / tambahkan ke Google Calendar dari detail meeting
6. Pastikan reminder cron berjalan (`/api/cron/meeting-reminders`)
7. Pastikan cron plan-reminders & recording-retention aktif (Phase 2)
8. Mulai recording (jika egress aktif) — wajib konfirmasi persetujuan peserta
9. Upgrade plan Pro lewat `/dashboard/billing` → cek invoice email & halaman invoice
10. Pastikan webhook LiveKit & payment tercatat (audit / status order)
11. Uji `/dashboard/settings` (profil, password, workspace, retensi recording)
12. Uji `/dashboard/analytics` + export CSV
13. Review halaman legal: `/terms`, `/privacy`, `/cookies`, `/dpa`
14. Uji Google login (jika OAuth dikonfigurasi) + `/api/auth/google/status`
15. Cek PWA manifest (`/manifest.webmanifest`) di HTTPS

### Phase 1 commercial MVP

- [ ] Email verifikasi & reset password (Resend + `APP_URL` benar)
- [ ] Invoice HTML tersedia untuk order PAID/REFUNDED
- [ ] Admin dapat cancel (PENDING) / refund (PAID) order
- [ ] Waiting room: host admit all + UI peserta lebih jelas
- [ ] Staging checklist: lihat [`STAGING.md`](./STAGING.md)

### Phase 2 Growth

- [ ] Reminder email perpanjang Pro (T-7/T-3/T-1/expired) via cron plan-reminders
- [ ] Perpanjang Pro menumpuk masa aktif (`activatePaidPlan` stack)
- [ ] Analytics workspace + export CSV di `/dashboard/analytics`
- [ ] Konfirmasi consent sebelum recording + retensi otomatis (cron recording-retention)

### Phase 3 Enterprise foundation

- [ ] Migration `phase3_enterprise` ter-deploy (`npm run db:deploy`)
- [ ] Google OAuth: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (env atau `/admin` Integrasi)
- [ ] Redirect URI Google: `https://domain-anda.com/api/auth/google/callback`
- [ ] `GET /api/auth/google/status` → `{ "configured": true }` setelah credential diisi
- [ ] Uji login/register Google dari `/auth`
- [ ] Halaman `/dpa` + legal (`/terms`, `/privacy`, `/cookies`)
- [ ] Owner: audit CSV + data-export workspace dari Pengaturan
- [ ] PWA: `/manifest.webmanifest` + install di Chrome (HTTPS)
- [ ] Panduan: [`ENTERPRISE.md`](./ENTERPRISE.md)

Microsoft OAuth / SAML / SCIM: **belum** (roadmap Fase 4+).

## 7. Monitoring ringan

- Pantau `/api/health` dari uptime monitor (Better Stack, UptimeRobot, dll)
- Alert jika status bukan `ok` / HTTP 503
- Cron VPS: `GET /api/cron/meeting-reminders` tiap 15 menit + header `Authorization: Bearer $CRON_SECRET`
- Cron VPS: `GET /api/cron/plan-reminders` tiap 15 menit (email perpanjang Pro)
- Cron VPS: `GET /api/cron/recording-retention` sekali sehari (03:00 UTC) — retensi recording
- Persist folder `data/uploads` (brand assets); recording sebaiknya ke S3
- Payment: Midtrans signature + amount check; iPaymu signature VA; Flip wajib `FLIP_VALIDATION_TOKEN`
- Pantau error log hosting (Vercel Logs / Docker logs)
- Halaman error aplikasi: `error.tsx` / `global-error.tsx`
- Rotasi secret jika pernah bocor di `.env.example` atau chat

## Perintah berguna

```bash
npm run ci
npm run check:env
npm run check:env -- --strict
npm run build
npm run db:deploy
npm run smoke -- https://domain-anda.com
curl -s https://domain-anda.com/api/health
```
