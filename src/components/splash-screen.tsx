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
          <img className="splash-logo" src={logo} alt={branding.appName} />
        ) : (
          <div className="splash-fallback">{branding.appName.slice(0, 1)}</div>
        )}
        <strong>{branding.appName}</strong>
        <p>Menyiapkan pengalaman meeting Anda...</p>
      </div>
    </div>
  );
}
