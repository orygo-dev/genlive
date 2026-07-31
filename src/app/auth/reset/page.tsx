import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { AppBrand } from "@/components/app-brand";
import { getPlatformBranding } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

type ResetPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPageProps) {
  const { token = "" } = await searchParams;
  const branding = await getPlatformBranding();

  return (
    <main className="auth-page auth-page-simple">
      <section className="auth-panel auth-panel-full">
        <div className="auth-box">
          <AppBrand branding={branding} className="brand auth-brand" />
          <div className="auth-heading">
            <span className="auth-lock"><LockKeyhole size={20} /></span>
            <h2>Atur password baru</h2>
            <p>Pilih password baru untuk akun Anda.</p>
          </div>
          <ResetPasswordForm token={token} />
          <p className="auth-legal-links">
            <Link href="/terms">Syarat</Link>
            <Link href="/privacy">Privasi</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
