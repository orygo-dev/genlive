import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { AppBrand } from "@/components/app-brand";
import { getPlatformBranding } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const branding = await getPlatformBranding();

  return (
    <main className="auth-page auth-page-simple">
      <section className="auth-panel auth-panel-full">
        <div className="auth-box">
          <AppBrand branding={branding} className="brand auth-brand" />
          <div className="auth-heading">
            <span className="auth-lock"><LockKeyhole size={20} /></span>
            <h2>Lupa password?</h2>
            <p>Masukkan email akun Anda. Kami akan mengirim tautan reset jika email terdaftar.</p>
          </div>
          <ForgotPasswordForm />
          <p className="auth-legal-links">
            <Link href="/terms">Syarat</Link>
            <Link href="/privacy">Privasi</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
