"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { LiveKitRoom, useConnectionState, useRoomContext } from "@livekit/components-react";
import {
  ConnectionState,
  DisconnectReason,
  RoomEvent,
  Track,
  type RoomConnectOptions,
  type RoomOptions,
} from "livekit-client";
import {
  ArrowLeft,
  Clock3,
  LoaderCircle,
  LockKeyhole,
  Video,
} from "lucide-react";
import { HostWaitingRoom } from "@/components/host-waiting-room";
import { RecordingControls } from "@/components/recording-controls";
import {
  BackgroundEffectsProvider,
  useBackgroundEffects,
} from "@/components/background-effects-context";
import {
  BackgroundEffectsPrejoin,
  type BackgroundEffectsPrejoinHandle,
} from "@/components/background-effects-prejoin";
import { BackgroundEffectsRuntime } from "@/components/background-effects-runtime";
import { MeetingConnectionBanner } from "@/components/meeting-connection-banner";
import {
  MeetingStage,
  type MeetingLayoutMode,
} from "@/components/meeting-stage";
import { MeetingToolsDock } from "@/components/meeting-tools-dock";
import type { BackgroundEffectId } from "@/lib/background-effects";
import { meetingStatusLabel } from "@/lib/meeting-access";
import {
  buildLocalAudioCapture,
  buildLocalVideoCapture,
  buildMeetingConnectOptions,
  buildMeetingRoomOptions,
} from "@/lib/livekit-room-options";

type ConnectionDetails = {
  identity: string;
  role: "HOST" | "MODERATOR" | "PARTICIPANT";
  serverUrl: string;
  token: string;
};

type AdmissionRequest = {
  requestId: string;
  admissionToken: string;
};

type MeetingExperienceProps = {
  roomName: string;
  defaultDisplayName?: string;
  meetingConfig: {
    id: string | null;
    title: string;
    passwordRequired: boolean;
    waitingRoom: boolean;
    startsAt: string | null;
    status: "SCHEDULED" | "ACTIVE" | "ENDED" | "CANCELLED";
  } | null;
};

const PERMANENT_DISCONNECT = new Set<DisconnectReason>([
  DisconnectReason.PARTICIPANT_REMOVED,
  DisconnectReason.ROOM_DELETED,
  DisconnectReason.DUPLICATE_IDENTITY,
  DisconnectReason.SERVER_SHUTDOWN,
]);

/**
 * Connect signaling first, then open mic/camera after Connected.
 * Opening A/V during Room.connect (old behavior) freezes many browsers.
 */
function RoomMediaBootstrap({
  micEnabled,
  cameraEnabled,
  onMediaError,
  onReady,
}: {
  micEnabled: boolean;
  cameraEnabled: boolean;
  onMediaError: (message: string) => void;
  onReady: () => void;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const startedRef = useRef(false);

  useEffect(() => {
    if (connectionState !== ConnectionState.Connected || startedRef.current) {
      return;
    }
    startedRef.current = true;
    let cancelled = false;

    async function enableMedia() {
      const openMic = async () => {
        if (!micEnabled || cancelled) return;
        await room.localParticipant.setMicrophoneEnabled(
          true,
          buildLocalAudioCapture(true) || undefined,
        );
      };
      const openCam = async () => {
        if (!cameraEnabled || cancelled) return;
        await room.localParticipant.setCameraEnabled(
          true,
          buildLocalVideoCapture(true) || undefined,
        );
      };

      try {
        await Promise.race([
          (async () => {
            await openMic();
            await new Promise((resolve) => window.setTimeout(resolve, 120));
            await openCam();
          })(),
          new Promise<never>((_, reject) => {
            window.setTimeout(
              () => reject(new Error("Timeout membuka kamera/mikrofon")),
              10_000,
            );
          }),
        ]);
      } catch (error) {
        if (!cancelled) {
          onMediaError(
            error instanceof Error
              ? `Perangkat media gagal: ${error.message}`
              : "Perangkat media gagal dibuka.",
          );
        }
      } finally {
        if (!cancelled) {
          onReady();
        }
      }
    }

    void enableMedia();
    return () => {
      cancelled = true;
    };
  }, [cameraEnabled, connectionState, micEnabled, onMediaError, onReady, room]);

  return null;
}

function CameraToggleProbe({ effectId }: { effectId: BackgroundEffectId }) {
  const room = useRoomContext();
  const connectionState = useConnectionState();

  useEffect(() => {
    const lp = room.localParticipant;
    const snapshot = (reason: string) => {
      const pub = lp.getTrackPublication(Track.Source.Camera);
      const media = pub?.track?.mediaStreamTrack;
      // #region agent log
      void import("@/lib/dbg-camera").then(({ dbgCamera }) => {
        dbgCamera("B", "meeting-experience.tsx:CameraToggleProbe", reason, {
          connectionState,
          isCameraEnabled: lp.isCameraEnabled,
          hasPub: Boolean(pub),
          pubMuted: pub?.isMuted ?? null,
          pubSubscribed: pub?.isSubscribed ?? null,
          trackSid: pub?.trackSid ?? null,
          trackKind: pub?.track?.kind ?? null,
          mediaReadyState: media?.readyState ?? null,
          mediaEnabled: media?.enabled ?? null,
          mediaMuted: media?.muted ?? null,
          effectId,
        });
      });
      // #endregion
    };

    snapshot("probe-mount");
    const onPub = () => snapshot("localTrackPublished");
    const onUnpub = () => snapshot("localTrackUnpublished");
    const onMuted = () => snapshot("trackMuted");
    const onUnmuted = () => snapshot("trackUnmuted");
    room.on(RoomEvent.LocalTrackPublished, onPub);
    room.on(RoomEvent.LocalTrackUnpublished, onUnpub);
    room.on(RoomEvent.TrackMuted, onMuted);
    room.on(RoomEvent.TrackUnmuted, onUnmuted);
    return () => {
      room.off(RoomEvent.LocalTrackPublished, onPub);
      room.off(RoomEvent.LocalTrackUnpublished, onUnpub);
      room.off(RoomEvent.TrackMuted, onMuted);
      room.off(RoomEvent.TrackUnmuted, onUnmuted);
    };
  }, [connectionState, effectId, room]);

  return null;
}

function RoomSessionBody({
  roomName,
  meetingTitle,
  meetingId,
  isHost,
  mainRoomName,
  layoutMode,
  setLayoutMode,
  effectId,
  setEffectId,
  elapsedLabel,
  micEnabled,
  cameraEnabled,
  onLeaveIntent,
  onMediaError,
}: {
  roomName: string;
  meetingTitle: string;
  meetingId: string | null;
  isHost: boolean;
  mainRoomName: string;
  layoutMode: MeetingLayoutMode;
  setLayoutMode: (mode: MeetingLayoutMode) => void;
  effectId: BackgroundEffectId;
  setEffectId: (value: BackgroundEffectId) => void;
  elapsedLabel: string;
  micEnabled: boolean;
  cameraEnabled: boolean;
  onLeaveIntent: () => void;
  onMediaError: (message: string) => void;
}) {
  const connectionState = useConnectionState();
  const connected = connectionState === ConnectionState.Connected;
  const [sessionReady, setSessionReady] = useState(false);
  const handleReady = useCallback(() => setSessionReady(true), []);

  useEffect(() => {
    if (!connected) {
      setSessionReady(false);
    }
  }, [connected]);

  // If connect succeeds but user disabled both mic and cam, still enter room.
  useEffect(() => {
    if (!connected || micEnabled || cameraEnabled) return;
    setSessionReady(true);
  }, [cameraEnabled, connected, micEnabled]);

  return (
    <>
      <MeetingConnectionBanner />
      {connected ? (
        <RoomMediaBootstrap
          micEnabled={micEnabled}
          cameraEnabled={cameraEnabled}
          onMediaError={onMediaError}
          onReady={handleReady}
        />
      ) : null}
      <div className="room-chrome">
        <div className="room-brand">
          <Video size={16} />
          <div>
            <strong>{meetingTitle}</strong>
            <small>{roomName}</small>
          </div>
        </div>
        <div className="room-elapsed" aria-live="polite">
          {elapsedLabel}
        </div>
      </div>

      {!sessionReady ? (
        <div className="meeting-join-pending" role="status">
          <LoaderCircle className="spin" size={28} />
          <p>
            {connected
              ? "Menyiapkan kamera dan mikrofon..."
              : "Menghubungkan ke meeting..."}
          </p>
        </div>
      ) : (
        <>
          {isHost ? (
            <>
              <HostWaitingRoom roomName={roomName} />
              <RecordingControls roomName={roomName} />
            </>
          ) : null}
          <CameraToggleProbe effectId={effectId} />
          <BackgroundEffectsRuntime
            effectId={effectId}
            onEffectChange={setEffectId}
          />
          <MeetingStage layoutMode={layoutMode} />
          <MeetingToolsDock
            roomName={roomName}
            mainRoomName={mainRoomName}
            meetingId={meetingId}
            meetingTitle={meetingTitle}
            isHost={isHost}
            layoutMode={layoutMode}
            onLayoutChange={setLayoutMode}
            onLeaveIntent={onLeaveIntent}
          />
        </>
      )}
    </>
  );
}

function MeetingRoom({
  connection,
  roomName,
  meetingTitle,
  meetingId,
  micEnabled,
  cameraEnabled,
  onError,
  onUnexpectedDisconnect,
}: {
  connection: ConnectionDetails;
  roomName: string;
  meetingTitle: string;
  meetingId: string | null;
  micEnabled: boolean;
  cameraEnabled: boolean;
  onError: (message: string) => void;
  onUnexpectedDisconnect: (message: string) => void;
}) {
  const router = useRouter();
  const { effectId, setEffectId } = useBackgroundEffects();
  const [layoutMode, setLayoutMode] = useState<MeetingLayoutMode>("gallery");
  const [joinedAt] = useState(() => Date.now());
  const [elapsedLabel, setElapsedLabel] = useState("00:00");
  const leaveIntentRef = useRef(false);
  const suppressLeaveNavRef = useRef(false);
  const isHost = connection.role === "HOST" || connection.role === "MODERATOR";
  const mainRoomName = roomName.replace(/-bo-\d+$/, "") || roomName;

  const roomOptions = useMemo<RoomOptions>(() => buildMeetingRoomOptions(), []);
  const connectOptions = useMemo<RoomConnectOptions>(
    () => buildMeetingConnectOptions(),
    [],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      const total = Math.floor((Date.now() - joinedAt) / 1000);
      const minutes = String(Math.floor(total / 60)).padStart(2, "0");
      const seconds = String(total % 60).padStart(2, "0");
      setElapsedLabel(`${minutes}:${seconds}`);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [joinedAt]);

  useEffect(() => {
    return () => {
      // LiveKitRoom disconnects on unmount (Strict Mode / remount) — don't treat as leave.
      suppressLeaveNavRef.current = true;
    };
  }, []);

  const markLeaveIntent = useCallback(() => {
    leaveIntentRef.current = true;
  }, []);

  const goToLeftScreen = useCallback(() => {
    const params = new URLSearchParams({
      room: roomName,
      title: meetingTitle,
      role: connection.role,
    });
    router.push(`/meeting/left?${params.toString()}`);
  }, [connection.role, meetingTitle, roomName, router]);

  const handleDisconnected = useCallback(
    (reason?: DisconnectReason) => {
      if (suppressLeaveNavRef.current) {
        return;
      }

      if (
        leaveIntentRef.current ||
        (reason != null && PERMANENT_DISCONNECT.has(reason))
      ) {
        goToLeftScreen();
        return;
      }

      // Prevent the LiveKitRoom unmount disconnect from navigating to left screen.
      suppressLeaveNavRef.current = true;
      const message =
        reason === DisconnectReason.JOIN_FAILURE
          ? "Gagal bergabung ke meeting. Periksa kamera/mikrofon lalu coba lagi."
          : "Koneksi terputus. Silakan gabung ulang.";
      onUnexpectedDisconnect(message);
    },
    [goToLeftScreen, onUnexpectedDisconnect],
  );

  const handleRoomError = useCallback(
    (roomError: Error) => {
      const raw = roomError.message || "";
      const lower = raw.toLowerCase();
      if (lower.includes("invalid token") || lower.includes("unauthorized")) {
        onError(
          "Token LiveKit ditolak server. Di Super Admin → Integrasi, pastikan LIVEKIT_URL + API Key + API Secret berasal dari server aktif yang sama (Cloud atau self-hosted), lalu Simpan & terapkan dan Tes koneksi.",
        );
        return;
      }
      onError(raw);
    },
    [onError],
  );

  const handleMediaFailure = useCallback(
    (failure?: unknown, kind?: MediaDeviceKind) => {
      onError(
        failure
          ? `Perangkat ${kind ?? "media"} gagal: ${String(failure)}`
          : "Perangkat media gagal dibuka.",
      );
    },
    [onError],
  );

  return (
    <div className="live-room" data-lk-theme="default">
      <LiveKitRoom
        token={connection.token}
        serverUrl={connection.serverUrl}
        connect
        video={false}
        audio={false}
        options={roomOptions}
        connectOptions={connectOptions}
        onDisconnected={handleDisconnected}
        onError={handleRoomError}
        onMediaDeviceFailure={handleMediaFailure}
      >
        <RoomSessionBody
          roomName={roomName}
          meetingTitle={meetingTitle}
          meetingId={meetingId}
          isHost={isHost}
          mainRoomName={mainRoomName}
          layoutMode={layoutMode}
          setLayoutMode={setLayoutMode}
          effectId={effectId}
          setEffectId={setEffectId}
          elapsedLabel={elapsedLabel}
          micEnabled={micEnabled}
          cameraEnabled={cameraEnabled}
          onLeaveIntent={markLeaveIntent}
          onMediaError={onError}
        />
      </LiveKitRoom>
    </div>
  );
}

function MeetingExperienceInner({
  roomName,
  meetingConfig,
  defaultDisplayName = "",
}: MeetingExperienceProps) {
  const router = useRouter();
  const { effectId, setEffectId } = useBackgroundEffects();
  const previewRef = useRef<BackgroundEffectsPrejoinHandle | null>(null);
  const [participantName, setParticipantName] = useState(() => {
    if (typeof window === "undefined") return defaultDisplayName;
    try {
      return (
        window.sessionStorage.getItem("genmeet_display_name") ||
        defaultDisplayName ||
        ""
      );
    } catch {
      return defaultDisplayName || "";
    }
  });
  const [password, setPassword] = useState("");
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [connection, setConnection] = useState<ConnectionDetails | null>(null);
  const [admission, setAdmission] = useState<AdmissionRequest | null>(null);
  const [error, setError] = useState("");
  const meetingClosed =
    meetingConfig?.status === "ENDED" || meetingConfig?.status === "CANCELLED";
  const [isJoining, setIsJoining] = useState(false);

  const meetingTitle = meetingConfig?.title ?? roomName;
  const backHref = meetingConfig?.id
    ? `/dashboard/meetings/${meetingConfig.id}`
    : "/dashboard";

  const handleUnexpectedDisconnect = useCallback((message: string) => {
    setConnection(null);
    setError(message);
  }, []);

  useEffect(() => {
    if (!admission) return;

    let active = true;
    let timer: number | undefined;
    let retryCount = 0;

    async function pollAdmission() {
      try {
        const response = await fetch("/api/meetings/admission", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: admission!.requestId,
            token: admission!.admissionToken,
          }),
          cache: "no-store",
        });
        const payload = (await response.json()) as ConnectionDetails & {
          status?: "WAITING" | "ADMITTED" | "REJECTED";
          error?: string;
        };

        if (!active) return;
        if (!response.ok) {
          if (response.status === 404 || response.status === 410) {
            setAdmission(null);
            setError(
              payload.error ?? "Permintaan waiting room sudah berakhir.",
            );
            return;
          }
          throw new Error(
            payload.error ?? "Status waiting room tidak tersedia.",
          );
        }
        retryCount = 0;
        if (payload.status === "REJECTED") {
          setAdmission(null);
          setError("Host menolak permintaan bergabung.");
          return;
        }
        if (payload.status === "ADMITTED" && payload.token) {
          setAdmission(null);
          await previewRef.current?.disposePreview();
          setConnection(payload);
          return;
        }
        timer = window.setTimeout(pollAdmission, 2000);
      } catch {
        if (!active) return;
        retryCount += 1;
        const retryDelay = Math.min(10_000, 1000 * 2 ** retryCount);
        timer = window.setTimeout(pollAdmission, retryDelay);
      }
    }

    void pollAdmission();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [admission]);

  async function cancelAdmission() {
    if (!admission) return;
    const currentAdmission = admission;
    try {
      const response = await fetch("/api/meetings/admission", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: currentAdmission.requestId,
          token: currentAdmission.admissionToken,
        }),
      });
      const payload = (await response.json()) as {
        status?: "ADMITTED" | "REJECTED" | "NOT_FOUND";
        error?: string;
      };

      if (response.ok) {
        setAdmission(null);
        return;
      }
      if (response.status === 409 && payload.status === "ADMITTED") {
        return;
      }
      setAdmission(null);
      setError(payload.error ?? "Permintaan tidak dapat dibatalkan.");
    } catch {
      setError(
        "Koneksi terputus. Permintaan masih aktif dan akan dicoba kembali.",
      );
    }
  }

  async function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (meetingClosed) {
      setError("Meeting ini sudah tidak menerima peserta.");
      return;
    }
    const name = participantName.trim();

    if (name.length < 2) {
      setError("Nama minimal 2 karakter.");
      return;
    }

    setError("");
    setIsJoining(true);

    try {
      const response = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantName: name, roomName, password }),
      });
      const payload = (await response.json()) as ConnectionDetails &
        AdmissionRequest & { error?: string; waiting?: boolean };

      if (!response.ok) {
        throw new Error(payload.error ?? "Tidak dapat bergabung ke meeting.");
      }

      if (payload.waiting) {
        await previewRef.current?.disposePreview().catch(() => undefined);
        setAdmission({
          requestId: payload.requestId,
          admissionToken: payload.admissionToken,
        });
      } else {
        await previewRef.current?.disposePreview().catch(() => undefined);
        setConnection(payload);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Terjadi kesalahan. Silakan coba lagi.",
      );
    } finally {
      setIsJoining(false);
    }
  }

  if (connection) {
    return (
      <MeetingRoom
        connection={connection}
        roomName={roomName}
        meetingTitle={meetingTitle}
        meetingId={meetingConfig?.id ?? null}
        micEnabled={micEnabled}
        cameraEnabled={cameraEnabled}
        onError={setError}
        onUnexpectedDisconnect={handleUnexpectedDisconnect}
      />
    );
  }

  if (admission) {
    return (
      <main className="prejoin-page">
        <section className="prejoin-card waiting-card">
          <div className="prejoin-brand">
            <span className="brand-mark">
              <Video size={20} />
            </span>
            <span>Meeting</span>
          </div>
          <div className="waiting-loader">
            <LoaderCircle className="spinner" size={28} />
          </div>
          <p className="prejoin-kicker">Waiting room</p>
          <h1>Menunggu persetujuan host</h1>
          {participantName.trim() ? (
            <p className="waiting-display-name">
              Anda masuk sebagai <strong>{participantName.trim()}</strong>
            </p>
          ) : null}
          <ol className="waiting-steps" aria-label="Langkah waiting room">
            <li className="waiting-step done">Permintaan terkirim</li>
            <li className="waiting-step active">Menunggu host menyetujui</li>
            <li className="waiting-step">Masuk ke meeting</li>
          </ol>
          <p className="prejoin-description">
            Halaman ini akan masuk otomatis setelah host menyetujui. Biarkan tab
            ini terbuka. Kamera/mikrofon baru aktif setelah Anda diizinkan.
          </p>
          <ul className="waiting-tips">
            <li>
              Preferensi mic/kamera Anda:{" "}
              {micEnabled ? "mic nyala" : "mic mati"},{" "}
              {cameraEnabled ? "kamera nyala" : "kamera mati"}.
            </li>
            <li>
              Pastikan izin browser untuk kamera dan mikrofon sudah diberikan.
            </li>
            <li>Siapkan nama tampilan yang mudah dikenali host.</li>
          </ul>
          <button
            className="button button-ghost button-full"
            onClick={() => void cancelAdmission()}
          >
            Batalkan permintaan
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="prejoin-page">
      <button
        className="back-link"
        type="button"
        onClick={() => router.push(backHref)}
      >
        <ArrowLeft size={18} /> Kembali
      </button>

      <section className="prejoin-card prejoin-card-wide prejoin-zoom">
        <div className="prejoin-brand">
          <span className="brand-mark">
            <Video size={20} />
          </span>
          <span>Meeting</span>
        </div>
        <p className="prejoin-kicker">Anda akan bergabung ke</p>
        <h1>{meetingTitle}</h1>
        {meetingConfig ? (
          <p className="meeting-status-chip">
            {meetingStatusLabel(meetingConfig.status)}
          </p>
        ) : null}
        {meetingConfig?.startsAt ? (
          <p className="meeting-schedule">
            <Clock3 size={14} />
            {new Intl.DateTimeFormat("id-ID", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(meetingConfig.startsAt))}
          </p>
        ) : null}
        <p className="prejoin-description">
          {meetingClosed
            ? "Meeting ini sudah selesai dan tidak lagi menerima peserta."
            : meetingConfig?.waitingRoom
              ? "Atur kamera, mikrofon, dan nama. Host akan menyetujui sebelum Anda masuk."
              : "Atur kamera, mikrofon, dan nama yang akan dilihat peserta lain."}
        </p>

        <BackgroundEffectsPrejoin
          ref={previewRef}
          effectId={effectId}
          onEffectChange={setEffectId}
          micEnabled={micEnabled}
          cameraEnabled={cameraEnabled}
          onMicChange={setMicEnabled}
          onCameraChange={setCameraEnabled}
        />

        <form onSubmit={joinRoom} className="prejoin-form" noValidate>
          <label htmlFor="participant-name">Nama Anda</label>
          <input
            id="participant-name"
            value={participantName}
            onChange={(event) => {
              setParticipantName(event.target.value);
              setError("");
              try {
                window.sessionStorage.setItem(
                  "genmeet_display_name",
                  event.target.value.trim(),
                );
              } catch {
                // ignore
              }
            }}
            placeholder="Contoh: Anisa Putri"
            maxLength={50}
            autoComplete="name"
            autoFocus
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "prejoin-error" : undefined}
          />
          {meetingConfig?.passwordRequired && (
            <label htmlFor="meeting-password">
              Password meeting
              <input
                id="meeting-password"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                placeholder="Masukkan password"
                maxLength={72}
                autoComplete="off"
              />
            </label>
          )}
          {error && (
            <p className="form-error" id="prejoin-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button button-primary button-full"
            type="submit"
            disabled={isJoining || meetingClosed}
          >
            {meetingClosed ? (
              <>Meeting sudah selesai</>
            ) : isJoining ? (
              <>
                <LoaderCircle className="spinner" size={18} /> Menghubungkan...
              </>
            ) : (
              <>
                <Video size={18} /> Masuk ke meeting
              </>
            )}
          </button>
        </form>

        <p className="security-note">
          <LockKeyhole size={14} />
          Akses meeting dilindungi token yang aman.
        </p>
      </section>
    </main>
  );
}

export function MeetingExperience(props: MeetingExperienceProps) {
  return (
    <BackgroundEffectsProvider>
      <MeetingExperienceInner {...props} />
    </BackgroundEffectsProvider>
  );
}
