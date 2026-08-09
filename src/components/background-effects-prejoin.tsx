"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
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
import { dbgJoin } from "@/lib/dbg-join";

type BackgroundEffectsPrejoinProps = {
  effectId: BackgroundEffectId;
  onEffectChange: (value: BackgroundEffectId) => void;
  micEnabled: boolean;
  cameraEnabled: boolean;
  onMicChange: (enabled: boolean) => void;
  onCameraChange: (enabled: boolean) => void;
};

export type BackgroundEffectsPrejoinHandle = {
  disposePreview: () => Promise<void>;
};

/** Prevent overlapping getUserMedia from Strict Mode remounts. */
let previewOpenToken = 0;

async function openPreviewCamera(
  deviceConstraint: { ideal: string } | undefined,
): Promise<LocalVideoTrack> {
  const token = ++previewOpenToken;
  let track: LocalVideoTrack;
  try {
    track = await createLocalVideoTrack({
      ...(deviceConstraint
        ? { deviceId: deviceConstraint }
        : { facingMode: "user" as const }),
      resolution: { width: 640, height: 360, frameRate: 15 },
    });
  } catch {
    track = await createLocalVideoTrack({ facingMode: "user" });
  }
  if (token !== previewOpenToken) {
    track.stop();
    throw new Error("Preview kamera diganti sesi baru.");
  }
  return track;
}

export const BackgroundEffectsPrejoin = forwardRef<
  BackgroundEffectsPrejoinHandle,
  BackgroundEffectsPrejoinProps
>(function BackgroundEffectsPrejoin(
  {
    effectId: _storedEffectId,
    onEffectChange,
    micEnabled,
    cameraEnabled,
    onMicChange,
    onCameraChange,
  },
  ref,
) {
  void _storedEffectId;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<LocalVideoTrack | null>(null);
  const disposingRef = useRef(false);
  const [track, setTrack] = useState<LocalVideoTrack | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [cameraDeviceId, setCameraDeviceId] = useState(
    () => readStoredMediaDevices().videoinput ?? "",
  );
  // Never auto-attach MediaPipe from a previous session on the lobby —
  // that freezes Firefox before the user even clicks Join.
  const [appliedEffectId, setAppliedEffectId] =
    useState<BackgroundEffectId>("none");
  const {
    qualityMode,
    setQualityMode,
    autoDowngradeWarning,
    clearAutoDowngradeWarning,
    noteAutoDowngrade,
  } = useBackgroundEffects();

  const vb = useVirtualBackground({
    effectId: appliedEffectId,
    qualityMode,
    track: cameraEnabled && appliedEffectId !== "none" ? track : null,
    enabled: cameraEnabled && appliedEffectId !== "none",
    onAutoDowngrade: () => noteAutoDowngrade(),
  });

  const disposeRef = useRef(vb.dispose);
  disposeRef.current = vb.dispose;

  const attachPreview = useCallback((nextTrack: LocalVideoTrack | null) => {
    const el = videoRef.current;
    if (!el || !nextTrack) return;
    nextTrack.attach(el);
    void el.play().catch(() => undefined);
  }, []);

  const setVideoNode = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && trackRef.current) {
      trackRef.current.attach(node);
      void node.play().catch(() => undefined);
    }
  }, []);

  const disposePreview = useCallback(async () => {
    if (disposingRef.current) return;
    disposingRef.current = true;

    // #region agent log
    const t0 = Date.now();
    dbgJoin(
      "background-effects-prejoin.tsx:disposePreview:start",
      "disposePreview start",
      { appliedEffectId, hasTrack: Boolean(trackRef.current) },
      "A",
    );
    // #endregion

    try {
      await disposeRef.current();
    } catch {
      // ignore
    }

    // #region agent log
    dbgJoin(
      "background-effects-prejoin.tsx:disposePreview:vbDone",
      "VB dispose finished",
      { ms: Date.now() - t0 },
      "A",
    );
    // #endregion

    const current = trackRef.current;
    trackRef.current = null;
    setTrack(null);
    if (current) {
      try {
        current.detach();
      } catch {
        // ignore
      }
      try {
        current.stop();
      } catch {
        // ignore
      }
    }
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    // #region agent log
    dbgJoin(
      "background-effects-prejoin.tsx:disposePreview:end",
      "disposePreview complete",
      { ms: Date.now() - t0 },
      "A",
    );
    // #endregion
  }, [appliedEffectId]);

  useImperativeHandle(ref, () => ({ disposePreview }), [disposePreview]);

  useEffect(() => {
    disposingRef.current = false;
    let cancelled = false;
    let localTrack: LocalVideoTrack | null = null;

    async function startPreview() {
      setPreviewError("");
      try {
        const cams = await listMediaDevices("videoinput");
        if (cancelled) return;

        const preferred = pickPreferredDeviceId(
          cams,
          cameraDeviceId || readStoredMediaDevices().videoinput,
        );
        if (preferred) {
          storeMediaDevice("videoinput", preferred);
        }

        const deviceConstraint = idealDeviceId(preferred || cameraDeviceId);
        localTrack = await openPreviewCamera(deviceConstraint);

        if (cancelled || disposingRef.current) {
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
      const current = localTrack ?? trackRef.current;
      trackRef.current = null;
      setTrack(null);
      if (current) {
        try {
          current.detach();
        } catch {
          // ignore
        }
        try {
          current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [attachPreview, cameraDeviceId]);

  useEffect(() => {
    if (!track || disposingRef.current) return;
    if (cameraEnabled) {
      void track.unmute();
      attachPreview(track);
    } else {
      void track.mute();
    }
  }, [track, cameraEnabled, attachPreview]);

  function handleEffectChange(next: BackgroundEffectId) {
    setAppliedEffectId(next);
    onEffectChange(next);
  }

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
        enumerateOnly
        className="prejoin-device-pickers"
        onDeviceChange={(kind, deviceId) => {
          if (kind === "videoinput" && deviceId && deviceId !== cameraDeviceId) {
            setCameraDeviceId(deviceId);
          }
        }}
      />
      <BackgroundEffectsPicker
        value={appliedEffectId}
        onChange={handleEffectChange}
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
});
