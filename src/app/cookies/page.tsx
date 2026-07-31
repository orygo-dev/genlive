import { LegalPage } from "@/components/legal-page";
import { getPlatformBranding } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

export default async function CookiesPage() {
  const branding = await getPlatformBranding();

  return (
    <LegalPage branding={branding} title="Kebijakan Cookie">
      <p>
        {branding.appName} menggunakan cookie dan teknologi serupa untuk menjaga
        sesi login Anda dan menjalankan fitur inti platform.
      </p>

      <h2>Cookie esensial</h2>
      <p>
        Cookie session (mis. <code>genmeet_session</code>) diperlukan agar Anda
        tetap masuk ke dashboard dan workspace. Cookie ini bersifat httpOnly dan
        tidak dibagikan ke pihak ketiga untuk iklan.
      </p>

      <h2>Cookie fungsional</h2>
      <p>
        Preferensi antarmuka dan konteks organisasi aktif dapat disimpan sementara
        untuk pengalaman yang lebih konsisten saat Anda kembali ke aplikasi.
      </p>

      <h2>Pengelolaan cookie</h2>
      <p>
        Anda dapat menghapus cookie melalui pengaturan browser. Menonaktifkan
        cookie esensial dapat membuat login dan akses dashboard tidak berfungsi
        normal.
      </p>

      <p>
        Kami tidak menggunakan cookie pelacakan iklan pihak ketiga pada versi
        platform ini.
      </p>
    </LegalPage>
  );
}
