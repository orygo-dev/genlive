"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { MobilePopupAd } from "@/lib/platform-branding";

const POPUP_SESSION_KEY = "genmeet_popup_ad_seen";

type BrandPopupAdProps = {
  popupAd: MobilePopupAd | null | undefined;
};

/**
 * Full-bleed image popup once per browser tab session (survives refresh,
 * resets when the tab/session ends) — mirrors mobile cold-start behavior.
 */
export function BrandPopupAd({ popupAd }: BrandPopupAdProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!popupAd?.enabled || !popupAd.imageUrl?.trim()) {
      return;
    }

    try {
      if (sessionStorage.getItem(POPUP_SESSION_KEY) === "1") {
        return;
      }
      sessionStorage.setItem(POPUP_SESSION_KEY, "1");
    } catch {
      // If storage is blocked, still show once for this mount.
    }

    const timer = window.setTimeout(() => setOpen(true), 120);
    return () => window.clearTimeout(timer);
  }, [popupAd?.enabled, popupAd?.imageUrl]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!open || !popupAd?.imageUrl) {
    return null;
  }

  const linkUrl = popupAd.linkUrl?.trim() || null;

  function close() {
    setOpen(false);
  }

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="brand-popup-ad-image"
      src={popupAd.imageUrl}
      alt="Pengumuman"
    />
  );

  return (
    <div className="brand-popup-ad" role="dialog" aria-modal="true" aria-label="Pengumuman">
      <button
        type="button"
        className="brand-popup-ad-backdrop"
        aria-label="Tutup popup"
        onClick={close}
      />
      <div className="brand-popup-ad-stage">
        {linkUrl ? (
          <a
            className="brand-popup-ad-link"
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {image}
          </a>
        ) : (
          image
        )}
        <button
          type="button"
          className="brand-popup-ad-close"
          aria-label="Tutup"
          onClick={close}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
