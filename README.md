# GenMeet

MVP aplikasi video conference berbasis Next.js, LiveKit, MySQL, dan Prisma. Aplikasi sudah
memiliki landing page, pembuatan kode meeting, alur pre-join, penerbitan token
di server, video conference, autentikasi session, workspace organisasi,
screen sharing, chat, dan kontrol perangkat.

## Menjalankan secara lokal

1. Buat project di [LiveKit Cloud](https://cloud.livekit.io).
2. Salin `.env.example` menjadi `.env.local`.
3. Isi URL, API key, dan API secret LiveKit.
4. Isi `DATABASE_URL` dengan koneksi **MySQL** lokal atau managed.
5. Terapkan migration dan jalankan aplikasi:

```bash
npm install
npm run db:generate
npm run db:deploy
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

API secret hanya dibaca oleh route server dan tidak pernah dikirim ke browser.
Jangan menambahkan `.env.local` ke source control.

Jika menggunakan Docker Desktop, MySQL lokal dapat dijalankan dengan:

```bash
docker compose up -d mysql
npm run db:deploy
```

Autentikasi menggunakan session token acak yang disimpan sebagai hash di
database dan dikirim melalui cookie `httpOnly`, `sameSite=lax`, serta `secure`
di production.

## Webhook LiveKit

Setelah aplikasi memiliki domain publik, tambahkan webhook berikut di dashboard
LiveKit Cloud:

```text
https://domain-anda.com/api/livekit/webhook
```

Aktifkan event room dan participant. Endpoint memverifikasi signature LiveKit,
menolak request yang tidak sah, dan memproses event secara idempotent. Webhook
memperbarui status meeting, waktu selesai, waktu peserta keluar, dan durasi.
Saat development lokal, gunakan tunnel HTTPS jika ingin menerima webhook dari
LiveKit Cloud.

## Kontrol akses meeting

- Meeting dapat dibuat instan atau dijadwalkan dari dashboard.
- Password meeting disimpan sebagai hash bcrypt, bukan teks asli.
- Waiting room aktif secara default untuk meeting organisasi.
- Host dan moderator dapat menerima atau menolak peserta dari dalam room.
- Token admission acak hanya disimpan dalam bentuk hash di database dan dikirim
  melalui request body agar tidak masuk URL atau access log.
- Host dan moderator memperoleh grant `roomAdmin` LiveKit untuk kontrol peserta.

## Manajemen anggota

- Owner dan Admin dapat mengundang anggota baru dari `/dashboard/members`.
- Undangan memakai token acak (disimpan sebagai hash) dan tautan `/invite/[token]`.
- Peran workspace: `OWNER`, `ADMIN`, `MEMBER` dengan proteksi Owner terakhir.
- Session menyimpan workspace aktif; pengguna dapat beralih organisasi dari sidebar.
- Perubahan undangan dan peran dicatat di `audit_logs`.

## Manajemen meeting

- Riwayat meeting di dashboard mendukung filter status dan menu aksi.
- Detail meeting di `/dashboard/meetings/[id]` untuk melihat peserta dan mengedit
  judul, jadwal, waiting room, serta password.
- Host/Owner/Admin dapat memulai meeting terjadwal, membatalkan meeting aktif
  atau terjadwal, dan menyalin tautan undangan `/meeting/[roomName]`.
- Perubahan meeting dicatat di audit log organisasi.

## Email undangan

Pengiriman email bersifat opsional dan memakai [Resend](https://resend.com).
Isi variabel berikut di `.env.local`:

```bash
APP_URL=http://localhost:3000
RESEND_API_KEY=re_...
EMAIL_FROM="GenMeet <noreply@domain-anda.com>"
```

- Undangan anggota dikirim otomatis saat Owner/Admin mengundang dari
  `/dashboard/members`.
- Undangan meeting dapat dikirim saat menjadwalkan meeting atau dari halaman
  detail meeting.
- Jika email belum dikonfigurasi atau pengiriman gagal, API tetap berhasil dan
  menampilkan tautan cadangan untuk dibagikan manual.

## WhatsApp (Fonnte) — undangan & reminder

GenMeet dapat mengirim undangan meeting dan pengingat jadwal via WhatsApp
menggunakan gateway [Fonnte](https://fonnte.com).

1. Buat device di dashboard Fonnte, hubungkan WhatsApp, salin token.
2. Isi di `.env.local` / production:

```bash
FONNTE_TOKEN=token_fonnte_anda
FONNTE_COUNTRY_CODE=62
CRON_SECRET=string-acak-panjang
APP_URL=https://domain-anda.com
```

3. Saat menjadwalkan meeting atau dari detail meeting, isi field
   **Undang via WhatsApp** (contoh: `081234567890, 62812xxxxxxx`).
4. Reminder otomatis dikirim untuk meeting `SCHEDULED`:
   - ~24 jam sebelum mulai
   - ~1 jam sebelum mulai
5. Cron Vercel memanggil `/api/cron/meeting-reminders` setiap 15 menit
   (`vercel.json`). Proteksi dengan header:
   `Authorization: Bearer $CRON_SECRET`.

Tanpa `FONNTE_TOKEN`, undangan WhatsApp bersifat fail-soft (tautan manual tetap
tersedia). Email Resend tetap opsional secara paralel.

## Recording meeting

Host/Owner/Admin dapat merekam room composite LiveKit saat meeting aktif.

- Tombol rekam muncul di dalam room dan di halaman detail meeting.
- Status recording diperbarui lewat webhook `egress_*`.
- Tanpa S3, LiveKit Cloud dapat menyimpan file sementara dan mengisi
  `downloadUrl` saat recording selesai.
- Untuk retensi jangka panjang, isi kredensial S3 di `.env.local`:

```bash
LIVEKIT_API_URL=https://your-project.livekit.cloud
LIVEKIT_EGRESS_S3_ACCESS_KEY=...
LIVEKIT_EGRESS_S3_SECRET=...
LIVEKIT_EGRESS_S3_BUCKET=...
LIVEKIT_EGRESS_S3_REGION=...
```

Aktifkan juga event egress pada webhook LiveKit yang sama
(`https://domain-anda.com/api/livekit/webhook`).

## Kalender meeting

Halaman `/dashboard/calendar` menampilkan jadwal meeting organisasi dalam
tampilan bulan atau minggu.

- Navigasi periode sebelumnya/berikutnya dan lompat ke hari ini.
- Klik meeting untuk membuka detail; klik tanggal kosong untuk menjadwalkan.
- API `GET /api/meetings` mendukung filter `from`, `to`, dan `take` (maks. 200).

## Pengaturan akun & workspace

Halaman `/dashboard/settings` mengelola profil, password, dan workspace.

- Ubah nama profil dan password akun.
- Owner/Admin dapat mengganti nama workspace.
- Buat workspace baru, keluar dari workspace, atau hapus workspace (Owner).
- Jika akun tidak punya workspace, pengguna diarahkan ke
  `/dashboard/workspaces/new`.

## Billing & payment gateway Indonesia

GenMeet mendukung checkout plan **Pro** melalui abstraksi gateway:

- **Midtrans** (Snap)
- **iPaymu** (Redirect Payment)
- **Flip Business** (Accept Payment / Create Bill)

Pilih default di `.env.local`:

```bash
PAYMENT_PROVIDER=MIDTRANS
APP_URL=https://domain-anda.com
```

Isi kredensial salah satu (atau beberapa) gateway:

```bash
# Midtrans
MIDTRANS_SERVER_KEY=...
MIDTRANS_CLIENT_KEY=...
MIDTRANS_IS_PRODUCTION=false

# iPaymu
IPAYMU_VA=...
IPAYMU_API_KEY=...
IPAYMU_IS_PRODUCTION=false

# Flip Business
FLIP_SECRET_KEY=...
FLIP_VALIDATION_TOKEN=...
FLIP_IS_PRODUCTION=false
```

Webhook per provider:

```text
https://domain-anda.com/api/payments/webhook/midtrans
https://domain-anda.com/api/payments/webhook/ipaymu
https://domain-anda.com/api/payments/webhook/flip
```

Halaman billing ada di `/dashboard/billing`. Setelah pembayaran sukses,
workspace naik ke plan Pro selama 30 hari dan kuota anggota/meeting/recording
diberlakukan di API.

## Pemeriksaan kualitas

```bash
npm run ci
npm run check:env
```

`npm run ci` menjalankan typecheck, test, lint, dan build (sama seperti GitHub Actions).

## Production / go-live

Ikuti checklist lengkap di [PRODUCTION.md](./PRODUCTION.md).

Untuk server **aaPanel** (Apache + MySQL + PM2), ikuti panduan
langkah demi langkah: [AAPANEL.md](./AAPANEL.md).

Ringkasannya:

1. Set `APP_URL` HTTPS + `DATABASE_URL` (MySQL) + kredensial LiveKit production.
2. Deploy (Vercel atau Docker `standalone` / aaPanel PM2).
3. Jalankan `npm run db:deploy`.
4. Pasang webhook LiveKit & payment gateway.
5. Verifikasi health: `npm run smoke -- https://domain-anda.com`
