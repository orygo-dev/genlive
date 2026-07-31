"use client";

import { useEffect, useState } from "react";
import type { PlatformBranding } from "@/lib/platform-branding";

const SPLASH_KEY = "genmeet_splash_seen";

export function SplashScreen({ branding }: { branding: PlatformBranding }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SPLASH_KEY) === "1") {
        return;
      }
    } catch {
      // ignore storage errors
    }

    const showTimer = window.setTimeout(() => setVisible(true), 0);
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
      try {
        sessionStorage.setItem(SPLASH_KEY, "1");
      } catch {
        // ignore
      }
    }, 1800);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) {
    return null;
  }

  const logo = branding.splashLogoUrl || branding.logoUrl;

  return (
    <div
      className="splash-screen"
      style={
        branding.splashBackgroundUrl
          ? { backgroundImage: `url(${branding.splashBackgroundUrl})` }
          : undefined
      }
      role="status"
      aria-live="polite"
      aria-label={`Memuat ${branding.appName}`}
    >
      <div className="splash-screen-inner">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="splash-logo" src={logo} alt="" />
        ) : (
          <div className="splash-fallback" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M15 10l4.55-2.27A1 1 0 0121 8.64v6.72a1 1 0 01-1.45.89L15 14" />
              <rect x="3" y="6" width="12" height="12" rx="2" />
            </svg>
          </div>
        )}
        <p>Menyiapkan pengalaman meeting Anda...</p>
      </div>
    </div>
  );
}
