# Enterprise — GenMeet Phase 3

Panduan fondasi enterprise: SSO Google, kepatuhan data, white-label, PWA, dan checklist operasional HA/backup.

Lihat juga: [`PRODUCTION.md`](./PRODUCTION.md), [`AAPANEL.md`](./AAPANEL.md), [`STAGING.md`](./STAGING.md).

---

## 1. Google OAuth & SSO

### Konfigurasi

1. Buat OAuth Client di [Google Cloud Console](https://console.cloud.google.com/) (Web application).
2. Authorized redirect URI: `https://domain-anda.com/api/auth/google/callback`
3. Set credential via **env** atau **Super Admin → Integrasi**:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
4. Opsional — batasi domain Google Workspace global:
   - `GOOGLE_HOSTED_DOMAIN=perusahaan.com`

### Workspace SSO (domain hint)

Di **Dashboard → Pengaturan → Branding & SSO**:

- Aktifkan SSO Google Workspace
- Isi **Hosted domain hint** (mis. `perusahaan.com`)
- Saat login Google, email harus cocok dengan hint org yang SSO-aktif

### Roadmap SSO

| Fase | Fitur | Status |
|------|--------|--------|
| 3 | Google OAuth + domain hint | ✅ |
| 4+ | SAML 2.0 / OIDC penuh | 🔜 placeholder UI |
| 4+ | SCIM provisioning | 🔜 belum |
| 4+ | Per-org OAuth client | 🔜 field `ssoClientId` disiapkan |

---

## 2. White-label workspace

Field organisasi (PATCH `/api/organizations`):

- `brandName`, `logoUrl`, `primaryColor`
- `customDomain` — informasi DNS (CNAME ke host GenMeet); reverse proxy otomatis menyusul
- `ssoEnabled`, `ssoTenantHint`

Branding org belum mengganti platform global (`platform_settings`); integrasi dashboard shell per-org dapat ditambahkan di fase berikutnya.

---

## 3. Kepatuhan & data

| Fitur | Endpoint / halaman |
|--------|-------------------|
| DPA komersial | `/dpa` |
| Ekspor audit log CSV | `GET /api/organizations/audit-export` (Owner/Admin) |
| Ekspor metadata workspace | `GET /api/organizations/data-export` (Owner) |
| Hapus akun self-serve | `DELETE /api/account` `{ confirmEmail }` |

### Penghapusan akun

- Blok jika user **Owner satu-satunya** di workspace yang masih punya anggota lain
- Workspace **kosong** (hanya user tersebut) dihapus otomatis
- Session & user dihapus (membership cascade)

---

## 4. PWA (Progressive Web App)

- Manifest: `src/app/manifest.ts` (theme `#1f6feb`)
- Ikon: `public/icons/icon.svg`
- Service worker: `public/sw.js` (cache shell, network-first navigasi, skip `/api/` & `/auth`)
- Registrasi SW: `PwaRegister` di `layout.tsx` (production only)

### Instalasi

1. Deploy production HTTPS
2. Buka situs di Chrome/Edge → menu **Install app** / **Add to Home Screen**
3. Verifikasi offline fallback: putus jaringan → halaman cached masih terbuka (bukan API)

---

## 5. HA, backup & multi-region (checklist)

GenMeet Phase 3 **tidak** menyertakan kode multi-region HA. Gunakan checklist operasional:

### MySQL backup

```bash
# Cron harian (contoh 02:00)
0 2 * * * mysqldump -u genmeet -p'SENHA' genmeet | gzip > /backup/genmeet-$(date +\%F).sql.gz
```

- Retensi 7–30 hari off-site (S3/Backblaze)
- Uji restore bulanan ke DB staging

### PM2 cluster (VPS)

```bash
pm2 start ecosystem.config.cjs -i max
pm2 save
```

- Satu instance MySQL; app stateless (session di DB)
- Rate limit in-memory: **single-node only** — untuk cluster gunakan Redis (fase berikutnya)

### Cloudflare (disarankan)

- Proxy orange-cloud + SSL Full (strict)
- WAF rate limiting pada `/api/auth/*`
- Page Rules / Cache Rules: jangan cache `/api/*`, `/dashboard/*`

### LiveKit multi-region

- Default: satu project LiveKit + region terdekat peserta
- Enterprise: LiveKit Cloud multi-region atau self-host regional SFU
- Webhook & egress S3: arahkan bucket region sama dengan recording retention policy

---

## 6. Env tambahan Phase 3

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# Opsional — batas domain Google Workspace global
# GOOGLE_HOSTED_DOMAIN=perusahaan.com
```

---

## 7. Migrate Phase 3

```bash
npm run db:deploy
# atau
npx prisma migrate deploy
```

Migration: `20260731180000_phase3_enterprise` — kolom OAuth user, white-label & SSO org.

---

## Gaps / tidak termasuk Phase 3

- Native iOS/Android apps
- SAML/SCIM protocol penuh
- Multi-region HA di kode aplikasi
- AI transcription
- Custom domain reverse proxy otomatis
- Redis-backed rate limit untuk PM2 cluster
