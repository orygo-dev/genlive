"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { LocalVideoTrack } from "livekit-client";
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

export type BackgroundEffectsPrejoinHandle = {
  disposePreview: () => Promise<void>;
};

/** Discard overlapping preview opens (Strict Mode / device switch). */
let previewOpenToken = 0;

/**
 * Open preview via raw getUserMedia.
 * Do NOT use createLocalVideoTrack here — LiveKit injects deviceId:"default"
 * which raises NotFoundError on many desktop browsers when no device has that id.
 */
async function openPreviewCamera(
  deviceConstraint: { ideal: string } | undefined,
): Promise<LocalVideoTrack | null> {
  const token = ++previewOpenToken;
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Browser tidak mendukung kamera.");
  }

  const attempts: MediaStreamConstraints[] = [
    {
      audio: false,
      video: deviceConstraint
        ? {
            deviceId: deviceConstraint,
            width: { ideal: 640 },
            height: { ideal: 360 },
            frameRate: { ideal: 15 },
          }
        : {
            width: { ideal: 640 },
            height: { ideal: 360 },
            frameRate: { ideal: 15 },
          },
    },
    { audio: false, video: true },
  ];

  let lastError: unknown;
  for (let index = 0; index < attempts.length; index += 1) {
    if (token !== previewOpenToken) return null;
    const constraints = attempts[index]!;
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const mediaTrack = stream.getVideoTracks()[0];
      if (!mediaTrack) {
        for (const track of stream.getTracks()) track.stop();
        throw new Error("Tidak ada video track.");
      }
      if (token !== previewOpenToken) {
        for (const track of stream.getTracks()) track.stop();
        return null;
      }
      // #region agent log
      void import("@/lib/dbg-camera").then(({ dbgCamera }) => {
        dbgCamera("G", "background-effects-prejoin.tsx:openPreviewCamera", "gum-ok", {
          attempt: index,
          label: mediaTrack.label || null,
          readyState: mediaTrack.readyState,
          usedDeviceIdeal: Boolean(deviceConstraint),
        });
      });
      // #endregion
      // userProvidedTrack=false so LocalVideoTrack.stop() releases the device.
      return new LocalVideoTrack(mediaTrack, mediaTrack.getConstraints(), false);
    } catch (error) {
      lastError = error;
      // #region agent log
      void import("@/lib/dbg-camera").then(({ dbgCamera }) => {
        dbgCamera("G", "background-effects-prejoin.tsx:openPreviewCamera", "gum-attempt-fail", {
          attempt: index,
          name: error instanceof Error ? error.name : "unknown",
          message: error instanceof Error ? error.message : String(error),
        });
      });
      // #endregion
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Kamera tidak dapat dibuka.");
}

/** One-shot mic permission so enumerateDevices returns mic ids/labels. */
async function unlockMicrophoneLabels() {
  if (!navigator.mediaDevices?.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    for (const mediaTrack of stream.getTracks()) {
      mediaTrack.stop();
    }
  } catch {
    // User may deny mic; camera preview can still work.
  }
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
  const [devicesRevision, setDevicesRevision] = useState(0);
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
    previewOpenToken += 1;

    try {
      await disposeRef.current();
    } catch {
      // ignore
    }

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
  }, []);

  useImperativeHandle(ref, () => ({ disposePreview }), [disposePreview]);

  useEffect(() => {
    disposingRef.current = false;
    let cancelled = false;
    let localTrack: LocalVideoTrack | null = null;

    async function startPreview() {
      setPreviewError("");
      // #region agent log
      void import("@/lib/dbg-camera").then(({ dbgCamera }) => {
        dbgCamera("G", "background-effects-prejoin.tsx:startPreview", "preview-start", {
          cameraDeviceId,
          cameraEnabled,
        });
      });
      // #endregion
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

        if (cancelled || disposingRef.current || !localTrack) {
          localTrack?.stop();
          // #region agent log
          void import("@/lib/dbg-camera").then(({ dbgCamera }) => {
            dbgCamera("G", "background-effects-prejoin.tsx:startPreview", "preview-aborted", {
              cancelled,
              disposing: disposingRef.current,
              hadTrack: Boolean(localTrack),
            });
          });
          // #endregion
          return;
        }

        trackRef.current = localTrack;
        setTrack(localTrack);
        attachPreview(localTrack);

        // #region agent log
        void import("@/lib/dbg-camera").then(({ dbgCamera }) => {
          dbgCamera("G", "background-effects-prejoin.tsx:startPreview", "preview-ok", {
            mediaReadyState: localTrack?.mediaStreamTrack?.readyState ?? null,
            hasVideoEl: Boolean(videoRef.current),
            videoSrcObject: Boolean(videoRef.current?.srcObject),
          });
        });
        // #endregion

        // Unlock mic device ids/labels without touching the live video track.
        await unlockMicrophoneLabels();
        if (!cancelled) {
          setDevicesRevision((value) => value + 1);
        }
      } catch (error) {
        if (!cancelled) {
          // #region agent log
          void import("@/lib/dbg-camera").then(({ dbgCamera }) => {
            dbgCamera("G", "background-effects-prejoin.tsx:startPreview", "preview-fail", {
              name: error instanceof Error ? error.name : "unknown",
              message: error instanceof Error ? error.message : String(error),
            });
          });
          // #endregion
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
      previewOpenToken += 1;
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
      // #region agent log
      void import("@/lib/dbg-camera").then(({ dbgCamera }) => {
        dbgCamera("F", "background-effects-prejoin.tsx:camEffect", "prejoin-cam-on", {
          hasTrack: Boolean(track),
          mediaReadyState: track.mediaStreamTrack?.readyState ?? null,
          mediaEnabled: track.mediaStreamTrack?.enabled ?? null,
          hasVideoEl: Boolean(videoRef.current),
          videoSrcObject: Boolean(videoRef.current?.srcObject),
        });
      });
      // #endregion
      void track.unmute();
      attachPreview(track);
    } else {
      // #region agent log
      void import("@/lib/dbg-camera").then(({ dbgCamera }) => {
        dbgCamera("F", "background-effects-prejoin.tsx:camEffect", "prejoin-cam-off", {
          hasTrack: Boolean(track),
          mediaReadyState: track.mediaStreamTrack?.readyState ?? null,
        });
      });
      // #endregion
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
        {/* Keep <video> mounted so off→on does not lose the MediaStream attach. */}
        <video
          ref={setVideoNode}
          autoPlay
          playsInline
          muted
          style={cameraEnabled ? undefined : { display: "none" }}
        />
        {!cameraEnabled ? (
          <div className="prejoin-cam-off" aria-hidden="true">
            <VideoOff size={40} />
            <span>Kamera mati</span>
          </div>
        ) : null}
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
            onClick={() => {
              // #region agent log
              void import("@/lib/dbg-camera").then(({ dbgCamera }) => {
                dbgCamera("F", "background-effects-prejoin.tsx:button", "prejoin-cam-click", {
                  nextEnabled: !cameraEnabled,
                  hasTrack: Boolean(trackRef.current),
                  hasVideoEl: Boolean(videoRef.current),
                  videoSrcObject: Boolean(videoRef.current?.srcObject),
                });
              });
              // #endregion
              onCameraChange(!cameraEnabled);
            }}
          >
            {cameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
        </div>
      </div>
      <MediaDevicePickers
        showSpeaker={false}
        requestVideoPermission={false}
        enumerateOnly
        refreshRevision={devicesRevision}
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
