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
          const initial = effectId === "none" ? readStoredBackgroundEffect() : effectId;
          await applyBackgroundEffect(processor, initial);
          if (!cancelled && initial !== effectId) {
            onEffectChange(initial);
          }
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
    if (!processor || !supported) {
      return;
    }

    let cancelled = false;
    setBusy(true);
    void applyBackgroundEffect(processor, effectId)
      .then(() => {
        if (!cancelled) {
          storeBackgroundEffect(effectId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewError("Efek background belum dapat diterapkan.");
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
  }, [effectId, supported]);

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
