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
  const hasLogo = Boolean(branding.logoUrl);

  return (
    <Link className={className} href={href} aria-label={`${branding.appName} beranda`}>
      {hasLogo ? (
        <span className="brand-mark brand-mark-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={branding.logoUrl!}
            alt=""
            style={{ height: markSize + 8, width: "auto" }}
          />
        </span>
      ) : (
        <span className="brand-mark">
          <Video size={markSize} />
        </span>
      )}
      <span>{branding.appName}</span>
    </Link>
  );
}
