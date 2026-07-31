"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, LoaderCircle, UserRound, Users, X } from "lucide-react";

type WaitingParticipant = {
  id: string;
  displayName: string;
  requestedAt: string;
};

function formatRelativeWait(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "Baru saja";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  return `${hours} jam`;
}

export function HostWaitingRoom({ roomName }: { roomName: string }) {
  const [participants, setParticipants] = useState<WaitingParticipant[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmittingAll, setIsAdmittingAll] = useState(false);

  const loadWaitingParticipants = useCallback(async () => {
    const response = await fetch(
      `/api/meetings/${encodeURIComponent(roomName)}/waiting`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as {
      participants: WaitingParticipant[];
    };
    setParticipants(payload.participants);
  }, [roomName]);

  useEffect(() => {
    let active = true;

    async function poll() {
      if (!active) return;
      try {
        await loadWaitingParticipants();
      } catch {
        // A transient failure should not stop subsequent refreshes.
      } finally {
        if (active) window.setTimeout(poll, 3000);
      }
    }

    void poll();
    return () => {
      active = false;
    };
  }, [loadWaitingParticipants]);

  useEffect(() => {
    if (participants.length > 0) {
      setIsOpen(true);
    }
  }, [participants.length]);

  async function decide(participantId: string, decision: "ADMITTED" | "REJECTED") {
    setProcessingId(participantId);
    try {
      const response = await fetch(
        `/api/meetings/${encodeURIComponent(roomName)}/waiting`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantId, decision }),
        },
      );
      if (response.ok) {
        setParticipants((current) =>
          current.filter((participant) => participant.id !== participantId),
        );
      }
    } finally {
      setProcessingId(null);
    }
  }

  async function admitAll() {
    if (participants.length === 0 || isAdmittingAll) return;
    setIsAdmittingAll(true);
    try {
      for (const participant of participants) {
        await decide(participant.id, "ADMITTED");
      }
      await loadWaitingParticipants();
    } finally {
      setIsAdmittingAll(false);
    }
  }

  return (
    <div className="host-waiting">
      <button
        className="host-waiting-trigger"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <Users size={17} />
        Menunggu
        {participants.length > 0 && <span>{participants.length}</span>}
      </button>

      {isOpen && (
        <section className="host-waiting-panel">
          <header>
            <div>
              <strong>Waiting room</strong>
              <p>Setujui peserta sebelum masuk ke meeting.</p>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Tutup">
              <X size={16} />
            </button>
          </header>

          {participants.length > 0 ? (
            <div className="host-waiting-actions">
              <button
                type="button"
                className="host-waiting-admit-all"
                onClick={() => void admitAll()}
                disabled={isAdmittingAll}
              >
                {isAdmittingAll ? (
                  <LoaderCircle className="spinner" size={14} />
                ) : (
                  <Check size={14} />
                )}
                Terima semua ({participants.length})
              </button>
            </div>
          ) : null}

          {participants.length === 0 ? (
            <div className="host-waiting-empty">
              <Users size={22} />
              <p>Tidak ada peserta yang menunggu.</p>
            </div>
          ) : (
            <div className="host-waiting-list">
              {participants.map((participant) => (
                <article key={participant.id}>
                  <span><UserRound size={16} /></span>
                  <div className="host-waiting-meta">
                    <strong>{participant.displayName}</strong>
                    <small>Menunggu {formatRelativeWait(participant.requestedAt)}</small>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => decide(participant.id, "REJECTED")}
                      disabled={processingId === participant.id || isAdmittingAll}
                      aria-label={`Tolak ${participant.displayName}`}
                    >
                      <X size={15} />
                    </button>
                    <button
                      className="admit"
                      type="button"
                      onClick={() => decide(participant.id, "ADMITTED")}
                      disabled={processingId === participant.id || isAdmittingAll}
                      aria-label={`Terima ${participant.displayName}`}
                    >
                      {processingId === participant.id ? (
                        <LoaderCircle className="spinner" size={15} />
                      ) : (
                        <Check size={15} />
                      )}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
