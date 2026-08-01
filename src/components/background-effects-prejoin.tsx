"use client";

import { useEffect, useRef, useState } from "react";
import {
  createLocalVideoTrack,
  type LocalVideoTrack,
} from "livekit-client";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { BackgroundEffectsPicker } from "@/components/background-effects-picker";
import { useBackgroundEffects } from "@/components/background-effects-context";
import { useVirtualBackground } from "@/hooks/useVirtualBackground";
import type { BackgroundEffectId } from "@/lib/background-effects";

type BackgroundEffectsPrejoinProps = {
  effectId: BackgroundEffectId;
  onEffectChange: (value: BackgroundEffectId) => void;
  micEnabled: boolean;
  cameraEnabled: boolean;
  onMicChange: (enabled: boolean) => void;
  onCameraChange: (enabled: boolean) => void;
};

export function BackgroundEffectsPrejoin({
  effectId,
  onEffectChange,
  micEnabled,
  cameraEnabled,
  onMicChange,
  onCameraChange,
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
    track: cameraEnabled ? track : null,
    enabled: cameraEnabled,
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
    if (!track) return;
    if (cameraEnabled) {
      void track.unmute();
      if (videoRef.current) {
        track.attach(videoRef.current);
      }
    } else {
      void track.mute();
    }
  }, [track, cameraEnabled, effectId, vb.busy]);

  return (
    <div className="bg-effects-prejoin prejoin-media">
      <div className={`bg-effects-preview${cameraEnabled ? "" : " is-cam-off"}`}>
        {cameraEnabled ? (
          <video ref={videoRef} autoPlay playsInline muted />
        ) : (
          <div className="prejoin-cam-off" aria-hidden="true">
            <VideoOff size={40} />
            <span>Kamera mati</span>
          </div>
        )}
        {previewError ? <p>{previewError}</p> : null}
        <div className="prejoin-av-toggles">
          <button
            type="button"
            className={micEnabled ? undefined : "is-off"}
            aria-pressed={micEnabled}
            aria-label={micEnabled ? "Matikan mikrofon" : "Nyalakan mikrofon"}
            onClick={() => onMicChange(!micEnabled)}
          >
            {micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button
            type="button"
            className={cameraEnabled ? undefined : "is-off"}
            aria-pressed={cameraEnabled}
            aria-label={cameraEnabled ? "Matikan kamera" : "Nyalakan kamera"}
            onClick={() => onCameraChange(!cameraEnabled)}
          >
            {cameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
        </div>
      </div>
      <BackgroundEffectsPicker
        value={effectId}
        onChange={onEffectChange}
        qualityMode={qualityMode}
        onQualityChange={setQualityMode}
        disabled={vb.busy || !cameraEnabled}
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
