"use client";

import { X } from "lucide-react";

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
  if (!open) {
    return null;
  }

  return (
    <div className="schedule-backdrop" role="presentation">
      <section
        className="schedule-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recording-consent-title"
      >
        <header>
          <div>
            <div>
              <h2 id="recording-consent-title">Konfirmasi recording</h2>
              <p>Pastikan semua peserta mengetahui meeting direkam.</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} aria-label="Tutup">
            <X size={18} />
          </button>
        </header>

        <p className="meeting-invite-hint">
          Saya mengonfirmasi peserta telah diberi tahu bahwa meeting direkam.
        </p>

        <div className="schedule-modal-actions">
          <button
            type="button"
            className="button button-ghost"
            onClick={onCancel}
            disabled={busy}
          >
            Batal
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Memulai..." : "Mulai recording"}
          </button>
        </div>
      </section>
    </div>
  );
}
