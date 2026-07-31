# Staging — GenMeet

Checklist singkat sebelum uji fitur di environment staging (bukan production).

## Environment

- [ ] Clone `.env.example` ke `.env.staging` (atau `.env` di server staging)
- [ ] `NODE_ENV=production` (untuk meniru cookie secure & build production)
- [ ] `APP_URL=https://staging.domainanda.com` — URL staging terpisah dari production
- [ ] `DATABASE_URL` mengarah ke **database staging terpisah** (jangan pakai DB production)
- [ ] `APP_ENCRYPTION_KEY` unik untuk staging (minimal 32 karakter)

## Integrasi

- [ ] LiveKit: project **sandbox/staging** (bukan production)
- [ ] Email Resend: domain staging atau `onboarding@resend.dev` untuk uji
- [ ] Payment gateway: **sandbox keys only** — `MIDTRANS_IS_PRODUCTION=false`, `IPAYMU_IS_PRODUCTION=false`, `FLIP_IS_PRODUCTION=false`
- [ ] Jangan memasukkan Server Key / Secret Key production ke staging

## Deploy & migrate

```bash
npm run db:deploy
npm run build
npm run smoke -- https://staging.domainanda.com
```

## Uji Phase 1

1. Daftar akun → cek email verifikasi (jika Resend aktif)
2. Lupa password → reset via email
3. Upgrade Pro (sandbox) → webhook PAID → invoice email + halaman invoice
4. Admin → batalkan order PENDING / refund order PAID
5. Meeting dengan jadwal → unduh ICS + Google Calendar
6. Waiting room → host terima semua

## Uji Phase 2 (Growth)

1. Billing → banner perpanjang jika Pro ≤7 hari
2. Perpanjang Pro → `planExpiresAt` ditumpuk (stack), bukan reset dari sekarang
3. Cron plan-reminders → email Owner T-7/T-3/T-1/expired (Resend)
4. `/dashboard/analytics` → tren 6 bulan + unduh CSV
5. Mulai recording → modal konfirmasi persetujuan peserta
6. Pengaturan → retensi recording (7/30/90/365 hari)
7. Cron recording-retention → rekaman lama di-soft-delete (status ABORTED)

## Phase 3 (rencana)

- Google / Microsoft OAuth sign-in — **belum diimplementasi** (Phase 3)

## Catatan

- Refund admin hanya mengubah status di sistem; refund gateway diproses manual di provider.
- Verifikasi email bersifat opsional (login tidak diblokir jika belum verifikasi).
