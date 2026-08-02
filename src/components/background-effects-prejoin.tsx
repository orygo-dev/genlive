"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createLocalVideoTrack,
  type LocalVideoTrack,
} from "livekit-client";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { BackgroundEffectsPicker } from "@/components/background-effects-picker";
import { useBackgroundEffects } from "@/components/background-effects-context";
import { MediaDevicePickers } from "@/components/media-device-pickers";
import { useVirtualBackground } from "@/hooks/useVirtualBackground";
import type { BackgroundEffectId } from "@/lib/background-effects";
import {
  idealDeviceId,
  listMediaDevices,
  pickPreferredDeviceId,
  readStoredMediaDevices,
  storeMediaDevice,
} from "@/lib/media-devices";

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
  const trackRef = useRef<LocalVideoTrack | null>(null);
  const [track, setTrack] = useState<LocalVideoTrack | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [cameraDeviceId, setCameraDeviceId] = useState(
    () => readStoredMediaDevices().videoinput ?? "",
  );
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

  const attachPreview = useCallback((nextTrack: LocalVideoTrack | null) => {
    const el = videoRef.current;
    if (!el || !nextTrack) return;
    nextTrack.attach(el);
    void el.play().catch(() => undefined);
  }, []);

  const setVideoNode = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (node && trackRef.current) {
        trackRef.current.attach(node);
        void node.play().catch(() => undefined);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    let localTrack: LocalVideoTrack | null = null;

    async function startPreview() {
      setPreviewError("");
      try {
        const cams = await listMediaDevices("videoinput");
        const preferred = pickPreferredDeviceId(
          cams,
          cameraDeviceId || readStoredMediaDevices().videoinput,
        );
        if (preferred) {
          storeMediaDevice("videoinput", preferred);
        }

        const deviceConstraint = idealDeviceId(preferred || cameraDeviceId);
        try {
          localTrack = await createLocalVideoTrack({
            ...(deviceConstraint
              ? { deviceId: deviceConstraint }
              : { facingMode: "user" }),
            resolution: { width: 1280, height: 720, frameRate: 24 },
          });
        } catch {
          // Stale deviceId / overconstrained — fall back to any camera.
          localTrack = await createLocalVideoTrack({
            facingMode: "user",
            resolution: { width: 1280, height: 720, frameRate: 24 },
          });
        }

        if (cancelled) {
          localTrack.stop();
          return;
        }
        trackRef.current = localTrack;
        setTrack(localTrack);
        attachPreview(localTrack);
      } catch (error) {
        if (!cancelled) {
          setPreviewError(
            error instanceof Error
              ? `Kamera belum dapat dibuka: ${error.message}`
              : "Kamera belum dapat dibuka untuk pratinjau.",
          );
          setTrack(null);
          trackRef.current = null;
        }
      }
    }

    void startPreview();

    return () => {
      cancelled = true;
      trackRef.current = null;
      setTrack(null);
      if (localTrack) {
        localTrack.stop();
        localTrack.detach();
      }
    };
  }, [attachPreview, cameraDeviceId]);

  useEffect(() => {
    if (!track) return;
    if (cameraEnabled) {
      void track.unmute();
      attachPreview(track);
    } else {
      void track.mute();
    }
  }, [track, cameraEnabled, effectId, vb.busy, attachPreview]);

  return (
    <div className="bg-effects-prejoin prejoin-media">
      <div className={`bg-effects-preview${cameraEnabled ? "" : " is-cam-off"}`}>
        {cameraEnabled ? (
          <video ref={setVideoNode} autoPlay playsInline muted />
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
      <MediaDevicePickers
        showSpeaker={false}
        requestVideoPermission={false}
        className="prejoin-device-pickers"
        onDeviceChange={(kind, deviceId) => {
          if (kind === "videoinput") {
            setCameraDeviceId(deviceId);
          }
        }}
      />
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
