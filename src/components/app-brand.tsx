import Link from "next/link";
import { Video } from "lucide-react";
import type { PlatformBranding } from "@/lib/platform-branding";

type AppBrandProps = {
  branding: PlatformBranding;
  href?: string;
  className?: string;
  markSize?: number;
};

export function AppBrand({
  branding,
  href = "/",
  className = "brand",
  markSize = 20,
}: AppBrandProps) {
  return (
    <Link className={className} href={href} aria-label={`${branding.appName} beranda`}>
      <span className="brand-mark">
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt="" width={markSize} height={markSize} />
        ) : (
          <Video size={markSize} />
        )}
      </span>
      <span>{branding.appName}</span>
    </Link>
  );
}
