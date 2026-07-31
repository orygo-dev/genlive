import Link from "next/link";
import { MailCheck } from "lucide-react";
import { VerifyEmailClient } from "@/components/verify-email-client";
import { AppBrand } from "@/components/app-brand";
import { getPlatformBranding } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

type VerifyPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyPageProps) {
  const { token = "" } = await searchParams;
  const branding = await getPlatformBranding();

  return (
    <main className="auth-page auth-page-simple">
      <section className="auth-panel auth-panel-full">
        <div className="auth-box">
          <AppBrand branding={branding} className="brand auth-brand" />
          <div className="auth-heading">
            <span className="auth-lock"><MailCheck size={20} /></span>
            <h2>Verifikasi email</h2>
            <p>Konfirmasi alamat email akun Anda.</p>
          </div>
          <VerifyEmailClient token={token} />
          <p className="auth-legal-links">
            <Link href="/terms">Syarat</Link>
            <Link href="/privacy">Privasi</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
