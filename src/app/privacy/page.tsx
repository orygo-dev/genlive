import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { getPlatformBranding } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const branding = await getPlatformBranding();

  return (
    <LegalPage branding={branding} title="Kebijakan Privasi">
      <p>
        {branding.appName} menghormati privasi Anda. Kebijakan ini menjelaskan
        data yang kami kumpulkan dan bagaimana data tersebut digunakan untuk
        menyediakan layanan meeting video.
      </p>

      <h2>Data yang dikumpulkan</h2>
      <p>
        Kami memproses data akun (nama, email), data organisasi, metadata meeting,
        log teknis, dan informasi billing yang diperlukan untuk operasional
        platform.
      </p>

      <h2>Penggunaan data</h2>
      <p>
        Data digunakan untuk autentikasi, pengelolaan workspace, penyelenggaraan
        meeting, pengiriman notifikasi (email/WhatsApp jika diaktifkan), dan
        pemrosesan pembayaran plan Pro.
      </p>

      <h2>Penyimpanan & keamanan</h2>
      <p>
        Data disimpan di infrastruktur yang kami kelola dengan kontrol akses
        terbatas. Session dan token sensitif di-hash. Kami menerapkan praktik
        keamanan wajar sesuai skala layanan.
      </p>

      <h2>Retensi & hak Anda</h2>
      <p>
        Anda dapat memperbarui profil, mengubah password, mengekspor data workspace,
        mengunduh audit log, atau menghapus akun melalui Pengaturan. Lihat juga{" "}
        <Link href="/dpa">Perjanjian Pemrosesan Data (DPA)</Link> untuk pelanggan
        bisnis.
      </p>

      <h2>Pihak ketiga</h2>
      <p>
        Layanan pihak ketiga (LiveKit, gateway pembayaran, email, WhatsApp)
        memproses data sesuai kebijakan masing-masing saat fitur terkait
        diaktifkan.
      </p>
    </LegalPage>
  );
}
