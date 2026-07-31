import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppBrand } from "@/components/app-brand";
import type { PlatformBranding } from "@/lib/platform-branding";

export function LegalPage({
  branding,
  title,
  children,
}: {
  branding: PlatformBranding;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="legal-page">
      <header className="legal-page-header">
        <AppBrand branding={branding} className="legal-page-brand" markSize={18} />
        <Link className="legal-page-back" href="/">
          <ArrowLeft size={16} /> Beranda
        </Link>
      </header>

      <main className="legal-page-main">
        <h1>{title}</h1>
        <div className="legal-page-content">{children}</div>
      </main>

      <footer className="legal-page-footer">
        <nav aria-label="Dokumen legal">
          <Link href="/terms">Syarat & Ketentuan</Link>
          <Link href="/privacy">Kebijakan Privasi</Link>
          <Link href="/cookies">Kebijakan Cookie</Link>
        </nav>
        <p>© {new Date().getFullYear()} {branding.appName}</p>
      </footer>
    </div>
  );
}
