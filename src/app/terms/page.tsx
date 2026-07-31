import { LegalPage } from "@/components/legal-page";
import { getPlatformBranding } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const branding = await getPlatformBranding();

  return (
    <LegalPage branding={branding} title="Syarat & Ketentuan">
      <p>
        Dengan menggunakan {branding.appName}, Anda setuju dengan syarat berikut.
        Platform ini disediakan untuk kebutuhan meeting video bisnis dan kolaborasi
        tim dalam organisasi Anda.
      </p>

      <h2>Akun & workspace</h2>
      <p>
        Anda bertanggung jawab atas keamanan kredensial akun dan aktivitas yang
        dilakukan di workspace organisasi. Informasi yang Anda berikan harus akurat
        dan dapat dipertanggungjawabkan.
      </p>

      <h2>Penggunaan layanan</h2>
      <p>
        Dilarang menggunakan layanan untuk konten ilegal, spam, atau aktivitas yang
        melanggar hukum. Kami dapat menangguhkan atau menonaktifkan akun yang
        melanggar kebijakan atau membahayakan platform.
      </p>

      <h2>Plan & billing</h2>
      <p>
        Fitur dan kuota mengikuti plan yang aktif (Free atau Pro). Pembayaran
        diproses melalui gateway pihak ketiga. Refund mengikuti kebijakan operasional
        dan ketentuan provider pembayaran.
      </p>

      <h2>Perubahan</h2>
      <p>
        Kami dapat memperbarui syarat ini sewaktu-waktu. Versi terbaru akan
        dipublikasikan di halaman ini. Penggunaan berkelanjutan setelah perubahan
        berarti Anda menerima syarat yang diperbarui.
      </p>

      <p>
        Pertanyaan? Hubungi tim dukungan melalui alamat email yang tercantum di
        platform atau halaman bantuan.
      </p>
    </LegalPage>
  );
}
