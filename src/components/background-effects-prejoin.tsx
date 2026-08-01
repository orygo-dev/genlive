"use client";

import { useEffect, useRef, useState } from "react";
import { createLocalVideoTrack, type LocalVideoTrack } from "livekit-client";
import {
  supportsBackgroundProcessors,
  type BackgroundProcessorWrapper,
} from "@livekit/track-processors";
import { BackgroundEffectsPicker } from "@/components/background-effects-picker";
import {
  readStoredBackgroundEffect,
  storeBackgroundEffect,
  type BackgroundEffectId,
} from "@/lib/background-effects";
import {
  applyBackgroundEffect,
  createDisabledBackgroundProcessor,
} from "@/lib/background-processor";

type BackgroundEffectsPrejoinProps = {
  effectId: BackgroundEffectId;
  onEffectChange: (value: BackgroundEffectId) => void;
};

export function BackgroundEffectsPrejoin({
  effectId,
  onEffectChange,
}: BackgroundEffectsPrejoinProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<LocalVideoTrack | null>(null);
  const processorRef = useRef<BackgroundProcessorWrapper | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [supported] = useState(() =>
    typeof window !== "undefined" ? supportsBackgroundProcessors() : false,
  );
  const [busy, setBusy] = useState(false);
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function startPreview() {
      try {
        const track = await createLocalVideoTrack({
          facingMode: "user",
          resolution: { width: 1280, height: 720, frameRate: 24 },
        });
        if (cancelled) {
          track.stop();
          return;
        }

        trackRef.current = track;
        if (videoRef.current) {
          track.attach(videoRef.current);
        }

        if (supportsBackgroundProcessors()) {
          const processor = createDisabledBackgroundProcessor();
          processorRef.current = processor;
          await track.setProcessor(processor);
          // Re-attach after processor wraps the track stream.
          if (videoRef.current) {
            track.attach(videoRef.current);
          }
        }

        if (!cancelled) {
          const initial =
            effectId === "none" ? readStoredBackgroundEffect() : effectId;
          if (initial !== effectId) {
            onEffectChange(initial);
          }
          setPreviewReady(true);
        }
      } catch {
        if (!cancelled) {
          setPreviewError("Kamera belum dapat dibuka untuk pratinjau.");
        }
      }
    }

    void startPreview();

    return () => {
      cancelled = true;
      setPreviewReady(false);
      const track = trackRef.current;
      trackRef.current = null;
      processorRef.current = null;
      if (track) {
        void track.stopProcessor().catch(() => undefined);
        track.stop();
        track.detach();
      }
    };
    // Mount once for preview lifecycle; effect changes handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const processor = processorRef.current;
    const track = trackRef.current;
    if (!previewReady || !processor || !supported) {
      return;
    }

    let cancelled = false;
    setBusy(true);
    setPreviewError("");

    void applyBackgroundEffect(processor, effectId, track)
      .then(() => {
        if (cancelled) return;
        storeBackgroundEffect(effectId);
        // Keep preview attached to the processed track after mode switches.
        if (videoRef.current && track) {
          track.attach(videoRef.current);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewError(
            "Efek background belum dapat diterapkan. Coba gambar JPG/PNG.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [effectId, previewReady, supported]);

  return (
    <div className="bg-effects-prejoin">
      <div className="bg-effects-preview">
        <video ref={videoRef} autoPlay playsInline muted />
        {previewError ? <p>{previewError}</p> : null}
      </div>
      <BackgroundEffectsPicker
        value={effectId}
        onChange={onEffectChange}
        disabled={busy}
        unsupported={!supported}
        compact
      />
    </div>
  );
}
