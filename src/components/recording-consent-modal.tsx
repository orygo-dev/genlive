"use client";

import { useEffect, useId, useState } from "react";
import { Disc, LoaderCircle, ShieldCheck, Users, X } from "lucide-react";

type RecordingConsentModalProps = {
  open: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function RecordingConsentModal({
  open,
  busy = false,
  onConfirm,
  onCancel,
}: RecordingConsentModalProps) {
  const checkboxId = useId();
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!open) {
      setAcknowledged(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onCancel();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="recording-consent-backdrop"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <section
        className="recording-consent-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recording-consent-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="recording-consent-close"
          onClick={onCancel}
          disabled={busy}
          aria-label="Tutup"
        >
          <X size={18} />
        </button>

        <div className="recording-consent-hero">
          <span className="recording-consent-icon" aria-hidden="true">
            <span className="recording-consent-icon-pulse" />
            <Disc size={28} strokeWidth={2.25} />
          </span>
          <p className="recording-consent-eyebrow">Live recording</p>
          <h2 id="recording-consent-title">Mulai merekam meeting?</h2>
          <p className="recording-consent-lead">
            Semua peserta akan melihat indikator rekaman. Pastikan mereka sudah
            diberi tahu sebelum Anda melanjutkan.
          </p>
        </div>

        <ul className="recording-consent-points">
          <li>
            <Users size={16} aria-hidden="true" />
            <span>Audio dan video seluruh peserta masuk ke file MP4.</span>
          </li>
          <li>
            <ShieldCheck size={16} aria-hidden="true" />
            <span>
              Host dapat menghentikan rekaman kapan saja dari bilah kontrol.
            </span>
          </li>
        </ul>

        <label className="recording-consent-check" htmlFor={checkboxId}>
          <input
            id={checkboxId}
            type="checkbox"
            checked={acknowledged}
            disabled={busy}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>
            Saya mengonfirmasi peserta telah diberi tahu bahwa meeting ini
            direkam.
          </span>
        </label>

        <div className="recording-consent-actions">
          <button
            type="button"
            className="recording-consent-btn recording-consent-btn-ghost"
            onClick={onCancel}
            disabled={busy}
          >
            Batal
          </button>
          <button
            type="button"
            className="recording-consent-btn recording-consent-btn-record"
            onClick={onConfirm}
            disabled={busy || !acknowledged}
          >
            {busy ? (
              <>
                <LoaderCircle className="spin" size={16} />
                Memulai...
              </>
            ) : (
              <>
                <span className="recording-consent-dot" aria-hidden="true" />
                Mulai recording
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
