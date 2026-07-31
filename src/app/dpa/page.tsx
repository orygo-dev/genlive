import { LegalPage } from "@/components/legal-page";
import { prisma } from "@/lib/db";
import { getPlatformBranding } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

export default async function DpaPage() {
  const branding = await getPlatformBranding();
  const settings = await prisma.platformSettings.findUnique({
    where: { id: 1 },
    select: { supportEmail: true },
  });
  const supportEmail = settings?.supportEmail?.trim() || null;

  return (
    <LegalPage branding={branding} title="Perjanjian Pemrosesan Data (DPA)">
      <p>
        Dokumen ini merupakan Perjanjian Pemrosesan Data (<em>Data Processing
        Agreement</em>) antara pelanggan bisnis (&quot;Pengendali Data&quot;) dan{" "}
        {branding.appName} sebagai Penyedia Layanan (&quot;Prosesor Data&quot;) untuk
        layanan meeting video dan workspace kolaboratif.
      </p>

      <h2>1. Ruang lingkup</h2>
      <p>
        DPA ini berlaku saat Pengendali Data menggunakan {branding.appName} untuk
        memproses data pribadi anggota tim, peserta meeting, dan metadata operasional
        workspace. Pemrosesan dilakukan semata-mata untuk menyediakan fitur yang
        dikontrakkan.
      </p>

      <h2>2. Jenis data & subjek</h2>
      <p>
        Data dapat meliputi: identitas akun (nama, email), keanggotaan organisasi,
        metadata meeting (judul, jadwal, durasi), log audit, dan data billing plan
        Pro. Rekaman meeting disimpan terpisah sesuai kebijakan retensi workspace.
      </p>

      <h2>3. Instruksi pemrosesan</h2>
      <p>
        Prosesor hanya memproses data sesuai instruksi Pengendali Data melalui
        konfigurasi platform, kebijakan workspace, dan permintaan dukungan yang
        sah. Prosesor tidak menjual data pribadi pelanggan enterprise.
      </p>

      <h2>4. Keamanan</h2>
      <p>
        Prosesor menerapkan kontrol akses, enkripsi transport (HTTPS/WSS), hashing
        credential, session httpOnly, dan pemisahan workspace. Detail operasional
        HA/backup tercantum di dokumentasi enterprise.
      </p>

      <h2>5. Sub-prosesor</h2>
      <p>
        Layanan pihak ketiga yang dapat terlibat: LiveKit (media realtime), Resend
        (email), gateway pembayaran (Midtrans/iPaymu/Flip), Fonnte (WhatsApp opsional),
        dan penyedia cloud infrastruktur tempat instance {branding.appName} di-host.
      </p>

      <h2>6. Retensi & penghapusan</h2>
      <p>
        Pengendali Data dapat mengekspor metadata workspace, mengunduh audit log,
        mengatur retensi recording, dan meminta penghapusan akun melalui fitur
        self-serve di Pengaturan. Workspace kosong dapat dihapus otomatis saat
        pemilik akun dihapus.
      </p>

      <h2>7. Insiden & audit</h2>
      <p>
        Prosesor akan memberitahu Pengendali Data insiden keamanan material sesuai
        kewajiban hukum. Log audit workspace tersedia untuk Owner/Admin melalui
        ekspor CSV.
      </p>

      <h2>8. Transfer lintas negara</h2>
      <p>
        Data dapat diproses di wilayah tempat infrastruktur pelanggan atau sub-prosesor
        berada. Pengendali Data bertanggung jawab memastikan dasar transfer yang
        sesuai peraturan setempat (mis. UU PDP Indonesia).
      </p>

      <h2>9. Kontak</h2>
      <p>
        Pertanyaan DPA dan permintaan enterprise:{" "}
        {supportEmail ? (
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
        ) : (
          "hubungi tim dukungan melalui kanal resmi platform"
        )}
        .
      </p>

      <p>
        <em>
          Dokumen ini disediakan sebagai template komersial. Untuk kontrak enterprise
          binding, hubungi tim legal {branding.appName}.
        </em>
      </p>
    </LegalPage>
  );
}
