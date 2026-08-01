"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LiveKitRoom } from "@livekit/components-react";
import { VideoPresets, type RoomOptions } from "livekit-client";
import { ArrowLeft, Clock3, LoaderCircle, LockKeyhole, Video } from "lucide-react";
import { HostWaitingRoom } from "@/components/host-waiting-room";
import { RecordingControls } from "@/components/recording-controls";
import {
  BackgroundEffectsProvider,
  useBackgroundEffects,
} from "@/components/background-effects-context";
import { BackgroundEffectsPrejoin } from "@/components/background-effects-prejoin";
import { BackgroundEffectsRuntime } from "@/components/background-effects-runtime";
import {
  MeetingStage,
  type MeetingLayoutMode,
} from "@/components/meeting-stage";
import { MeetingToolsDock } from "@/components/meeting-tools-dock";

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
  meetingConfig: {
    title: string;
    passwordRequired: boolean;
    waitingRoom: boolean;
    startsAt: string | null;
    status: "SCHEDULED" | "ACTIVE" | "ENDED" | "CANCELLED";
  } | null;
};

function MeetingRoom({
  connection,
  roomName,
  onError,
}: {
  connection: ConnectionDetails;
  roomName: string;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const { effectId, setEffectId } = useBackgroundEffects();
  const [layoutMode, setLayoutMode] = useState<MeetingLayoutMode>("gallery");
  const isHost =
    connection.role === "HOST" || connection.role === "MODERATOR";
  const mainRoomName = roomName.replace(/-bo-\d+$/, "") || roomName;

  const roomOptions = useMemo<RoomOptions>(
    () => ({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
      publishDefaults: {
        simulcast: true,
        videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
      },
    }),
    [],
  );

  return (
    <div className="live-room" data-lk-theme="default">
      <LiveKitRoom
        token={connection.token}
        serverUrl={connection.serverUrl}
        connect
        video
        audio
        options={roomOptions}
        onDisconnected={() =>
          router.push(connection.role === "PARTICIPANT" ? "/" : "/dashboard")
        }
        onError={(roomError) => onError(roomError.message)}
      >
        <div className="room-brand">
          <Video size={16} />
          <span>{roomName}</span>
        </div>
        {isHost && (
          <>
            <HostWaitingRoom roomName={roomName} />
            <RecordingControls roomName={roomName} />
          </>
        )}
        <BackgroundEffectsRuntime
          effectId={effectId}
          onEffectChange={setEffectId}
        />
        <MeetingStage layoutMode={layoutMode} />
        <MeetingToolsDock
          roomName={roomName}
          mainRoomName={mainRoomName}
          isHost={isHost}
          layoutMode={layoutMode}
          onLayoutChange={setLayoutMode}
        />
      </LiveKitRoom>
    </div>
  );
}

function MeetingExperienceInner({
  roomName,
  meetingConfig,
}: MeetingExperienceProps) {
  const router = useRouter();
  const { effectId, setEffectId } = useBackgroundEffects();
  const [participantName, setParticipantName] = useState("");
  const [password, setPassword] = useState("");
  const [connection, setConnection] = useState<ConnectionDetails | null>(null);
  const [admission, setAdmission] = useState<AdmissionRequest | null>(null);
  const [error, setError] = useState("");
  const [isJoining, setIsJoining] = useState(false);

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
            setError(payload.error ?? "Permintaan waiting room sudah berakhir.");
            return;
          }
          throw new Error(payload.error ?? "Status waiting room tidak tersedia.");
        }
        retryCount = 0;
        if (payload.status === "REJECTED") {
          setAdmission(null);
          setError("Host menolak permintaan bergabung.");
          return;
        }
        if (payload.status === "ADMITTED" && payload.token) {
          setAdmission(null);
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
      setError("Koneksi terputus. Permintaan masih aktif dan akan dicoba kembali.");
    }
  }

  async function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        setAdmission({
          requestId: payload.requestId,
          admissionToken: payload.admissionToken,
        });
      } else {
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
        onError={setError}
      />
    );
  }

  if (admission) {
    return (
      <main className="prejoin-page">
        <section className="prejoin-card waiting-card">
          <div className="prejoin-brand">
            <span className="brand-mark"><Video size={20} /></span>
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
            Halaman ini akan masuk otomatis setelah host menyetujui.
            Biarkan tab ini terbuka.
          </p>
          <ul className="waiting-tips">
            <li>Matikan mic sampai Anda diizinkan masuk.</li>
            <li>Pastikan kamera dan mic sudah diizinkan browser.</li>
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
      <button className="back-link" type="button" onClick={() => router.push("/")}>
        <ArrowLeft size={18} /> Kembali
      </button>

      <section className="prejoin-card prejoin-card-wide">
        <div className="prejoin-brand">
          <span className="brand-mark"><Video size={20} /></span>
          <span>Meeting</span>
        </div>
        <div className="prejoin-icon"><Video size={26} /></div>
        <p className="prejoin-kicker">Anda akan bergabung ke</p>
        <h1>{meetingConfig?.title ?? roomName}</h1>
        {meetingConfig?.startsAt && meetingConfig.status === "SCHEDULED" && (
          <p className="meeting-schedule">
            <Clock3 size={14} />
            {new Intl.DateTimeFormat("id-ID", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(meetingConfig.startsAt))}
          </p>
        )}
        <p className="prejoin-description">
          {meetingConfig?.waitingRoom
            ? "Atur nama dan background. Host akan menyetujui sebelum Anda masuk."
            : "Atur nama dan background yang akan dilihat peserta lain."}
        </p>

        <BackgroundEffectsPrejoin
          effectId={effectId}
          onEffectChange={setEffectId}
        />

        <form onSubmit={joinRoom} className="prejoin-form" noValidate>
          <label htmlFor="participant-name">Nama Anda</label>
          <input
            id="participant-name"
            value={participantName}
            onChange={(event) => {
              setParticipantName(event.target.value);
              setError("");
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
            disabled={isJoining}
          >
            {isJoining ? (
              <><LoaderCircle className="spinner" size={18} /> Menghubungkan...</>
            ) : (
              <><Video size={18} /> Gabung sekarang</>
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
