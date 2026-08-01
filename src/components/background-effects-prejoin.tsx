"use client";

import { useEffect, useRef, useState } from "react";
import { createLocalVideoTrack, type LocalVideoTrack } from "livekit-client";
import { BackgroundEffectsPicker } from "@/components/background-effects-picker";
import { useBackgroundEffects } from "@/components/background-effects-context";
import { useVirtualBackground } from "@/hooks/useVirtualBackground";
import type { BackgroundEffectId } from "@/lib/background-effects";

type BackgroundEffectsPrejoinProps = {
  effectId: BackgroundEffectId;
  onEffectChange: (value: BackgroundEffectId) => void;
};

export function BackgroundEffectsPrejoin({
  effectId,
  onEffectChange,
}: BackgroundEffectsPrejoinProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [track, setTrack] = useState<LocalVideoTrack | null>(null);
  const [previewError, setPreviewError] = useState("");
  const {
    qualityMode,
    setQualityMode,
    autoDowngradeWarning,
    clearAutoDowngradeWarning,
    noteAutoDowngrade,
  } = useBackgroundEffects();

  const vb = useVirtualBackground({
    effectId,
    qualityMode,
    track,
    onAutoDowngrade: () => noteAutoDowngrade(),
  });

  useEffect(() => {
    let cancelled = false;
    let localTrack: LocalVideoTrack | null = null;

    async function startPreview() {
      try {
        localTrack = await createLocalVideoTrack({
          facingMode: "user",
          resolution: { width: 1280, height: 720, frameRate: 24 },
        });
        if (cancelled) {
          localTrack.stop();
          return;
        }
        setTrack(localTrack);
        if (videoRef.current) {
          localTrack.attach(videoRef.current);
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
      setTrack(null);
      if (localTrack) {
        localTrack.stop();
        localTrack.detach();
      }
    };
  }, []);

  useEffect(() => {
    if (track && videoRef.current) {
      track.attach(videoRef.current);
    }
  }, [track, effectId, vb.busy]);

  return (
    <div className="bg-effects-prejoin">
      <div className="bg-effects-preview">
        <video ref={videoRef} autoPlay playsInline muted />
        {previewError ? <p>{previewError}</p> : null}
      </div>
      <BackgroundEffectsPicker
        value={effectId}
        onChange={onEffectChange}
        qualityMode={qualityMode}
        onQualityChange={setQualityMode}
        disabled={vb.busy}
        unsupported={!vb.supported}
        loading={vb.loading}
        error={vb.error}
        autoDowngraded={autoDowngradeWarning || vb.autoDowngraded}
        activeQuality={vb.activeQuality}
        onDismissDowngradeWarning={clearAutoDowngradeWarning}
        compact
      />
    </div>
  );
}
