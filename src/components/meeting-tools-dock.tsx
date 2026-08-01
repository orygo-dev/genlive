"use client";

import {
  FormEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from "@livekit/components-react";
import {
  DataPacket_Kind,
  RoomEvent,
  Track,
  type LocalAudioTrack,
} from "livekit-client";
import {
  Hand,
  LayoutGrid,
  Maximize2,
  MessageSquare,
  Mic,
  Palette,
  PanelRight,
  Sparkles,
  Users,
  Vote,
  Wand2,
  X,
} from "lucide-react";
import {
  decodeMeetingMessage,
  encodeMeetingMessage,
  type MeetingRealtimeMessage,
} from "@/lib/meeting-realtime";
import type { MeetingLayoutMode } from "@/components/meeting-stage";

type BeautyMode = "off" | "soft" | "strong";
type AudioMode = "noise" | "standard" | "original";
type DockPanel =
  | "none"
  | "settings"
  | "reactions"
  | "polls"
  | "breakout"
  | "whiteboard"
  | "ai";

type PollState = {
  pollId: string;
  question: string;
  options: string[];
  from: string;
  votes: Record<number, string[]>;
};

type FloatingReaction = {
  id: string;
  emoji: string;
  from: string;
};

type BreakoutRoom = {
  roomName: string;
  label: string;
};

type MeetingToolsDockProps = {
  roomName: string;
  isHost: boolean;
  mainRoomName: string;
  layoutMode: MeetingLayoutMode;
  onLayoutChange: (mode: MeetingLayoutMode) => void;
};

const REACTION_EMOJIS = ["👍", "👏", "❤️", "😂", "🎉", "🤔"];
const BEAUTY_STORAGE_KEY = "genmeet-beauty";
const AUDIO_STORAGE_KEY = "genmeet-audio-mode";

function readStoredBeauty(): BeautyMode {
  if (typeof window === "undefined") return "off";
  const value = window.localStorage.getItem(BEAUTY_STORAGE_KEY);
  return value === "soft" || value === "strong" ? value : "off";
}

function readStoredAudioMode(): AudioMode {
  if (typeof window === "undefined") return "standard";
  const value = window.localStorage.getItem(AUDIO_STORAGE_KEY);
  return value === "noise" || value === "original" ? value : "standard";
}

function applyBeautyMode(mode: BeautyMode) {
  const roomEl = document.querySelector(".live-room");
  if (roomEl instanceof HTMLElement) {
    roomEl.dataset.beauty = mode === "off" ? "off" : mode;
  }
}

async function applyAudioMode(
  mode: AudioMode,
  getMicTrack: () => LocalAudioTrack | undefined,
  setMicEnabled: (
    enabled: boolean,
    options?: { noiseSuppression?: boolean; echoCancellation?: boolean },
  ) => Promise<unknown>,
) {
  const track = getMicTrack();
  if (!track) return;

  if (mode === "noise") {
    try {
      const krisp = await import("@livekit/krisp-noise-filter");
      if (krisp.isKrispNoiseFilterSupported()) {
        await track.setProcessor(krisp.KrispNoiseFilter());
        return;
      }
    } catch {
      // Krisp unavailable — fall through to standard.
    }
  }

  await track.stopProcessor().catch(() => undefined);

  const wasEnabled = !track.isMuted;
  if (mode === "original") {
    if (wasEnabled) {
      await setMicEnabled(false);
      await setMicEnabled(true, {
        noiseSuppression: false,
        echoCancellation: false,
      });
    }
    return;
  }

  if (wasEnabled) {
    await setMicEnabled(false);
    await setMicEnabled(true);
  }
}

export function MeetingToolsDock({
  roomName,
  isHost,
  mainRoomName,
  layoutMode,
  onLayoutChange,
}: MeetingToolsDockProps) {
  const router = useRouter();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  const [activePanel, setActivePanel] = useState<DockPanel>("none");
  const [beautyMode, setBeautyMode] = useState<BeautyMode>("off");
  const [audioMode, setAudioMode] = useState<AudioMode>("standard");
  const [handRaised, setHandRaised] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>(
    [],
  );
  const [polls, setPolls] = useState<PollState[]>([]);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState("Ya\nTidak");
  const [breakoutCount, setBreakoutCount] = useState(2);
  const [breakoutRooms, setBreakoutRooms] = useState<BreakoutRoom[]>([]);
  const [activeBreakout, setActiveBreakout] = useState<BreakoutRoom | null>(
    null,
  );
  const [aiInput, setAiInput] = useState("");
  const [aiReply, setAiReply] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const strokePointsRef = useRef<number[]>([]);
  const strokeColorRef = useRef("#ffffff");
  const strokeWidthRef = useRef(3);

  function getCanvasContext() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }

  function clearWhiteboardCanvas() {
    const canvas = canvasRef.current;
    const ctx = getCanvasContext();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawRemoteStroke(points: number[], color: string, width: number) {
    const ctx = getCanvasContext();
    if (!ctx || points.length < 4) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let index = 2; index < points.length; index += 2) {
      ctx.lineTo(points[index], points[index + 1]);
    }
    ctx.stroke();
  }

  const raisedParticipants = useMemo(
    () =>
      participants.filter(
        (participant) => participant.attributes.handRaised === "1",
      ),
    [participants],
  );

  const publishMessage = useCallback(
    async (message: MeetingRealtimeMessage) => {
      const payload = encodeMeetingMessage(message);
      await room.localParticipant.publishData(payload, {
        reliable: true,
      });
    },
    [room.localParticipant],
  );

  const handleIncomingMessage = useCallback(
    (payload: Uint8Array) => {
      const message = decodeMeetingMessage(payload);
      if (!message) return;

      switch (message.type) {
        case "reaction":
          setFloatingReactions((current) => [
            ...current,
            { id: message.id, emoji: message.emoji, from: message.from },
          ]);
          window.setTimeout(() => {
            setFloatingReactions((current) =>
              current.filter((item) => item.id !== message.id),
            );
          }, 2500);
          break;
        case "poll_create":
          setPolls((current) => {
            if (current.some((poll) => poll.pollId === message.pollId)) {
              return current;
            }
            return [
              ...current,
              {
                pollId: message.pollId,
                question: message.question,
                options: message.options,
                from: message.from,
                votes: {},
              },
            ];
          });
          break;
        case "poll_vote":
          setPolls((current) =>
            current.map((poll) => {
              if (poll.pollId !== message.pollId) return poll;
              const votes = { ...poll.votes };
              for (const key of Object.keys(votes)) {
                votes[Number(key)] = votes[Number(key)].filter(
                  (voter) => voter !== message.from,
                );
              }
              const bucket = votes[message.optionIndex] ?? [];
              votes[message.optionIndex] = [...bucket, message.from];
              return { ...poll, votes };
            }),
          );
          break;
        case "breakout":
          if (message.action === "join") {
            const entry = {
              roomName: message.roomName,
              label: message.label ?? message.roomName,
            };
            setBreakoutRooms((current) => {
              if (current.some((roomItem) => roomItem.roomName === entry.roomName)) {
                return current;
              }
              return [...current, entry];
            });
            setActiveBreakout(entry);
          } else if (message.action === "return") {
            setActiveBreakout(null);
            if (roomName !== mainRoomName) {
              router.push(`/meeting/${encodeURIComponent(mainRoomName)}`);
            }
          }
          break;
        case "wb_stroke":
          drawRemoteStroke(message.points, message.color, message.width);
          break;
        case "wb_clear":
          clearWhiteboardCanvas();
          break;
        default:
          break;
      }
    },
    [mainRoomName, roomName, router],
  );

  useEffect(() => {
    setBeautyMode(readStoredBeauty());
    setAudioMode(readStoredAudioMode());
  }, []);

  useEffect(() => {
    applyBeautyMode(beautyMode);
    window.localStorage.setItem(BEAUTY_STORAGE_KEY, beautyMode);
  }, [beautyMode]);

  useEffect(() => {
    window.localStorage.setItem(AUDIO_STORAGE_KEY, audioMode);
    void applyAudioMode(
      audioMode,
      () => {
        const publication = localParticipant.getTrackPublication(
          Track.Source.Microphone,
        );
        return publication?.track as LocalAudioTrack | undefined;
      },
      (enabled, options) =>
        localParticipant.setMicrophoneEnabled(enabled, options),
    );
  }, [audioMode, localParticipant]);

  useEffect(() => {
    function onDataReceived(
      payload: Uint8Array,
      _participant?: unknown,
      _kind?: DataPacket_Kind,
      _topic?: string,
    ) {
      handleIncomingMessage(payload);
    }

    room.on(RoomEvent.DataReceived, onDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, onDataReceived);
    };
  }, [room, handleIncomingMessage]);

  function togglePanel(panel: DockPanel) {
    setActivePanel((current) => (current === panel ? "none" : panel));
  }

  async function sendReaction(emoji: string) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const message: MeetingRealtimeMessage = {
      type: "reaction",
      emoji,
      from: localParticipant.name || localParticipant.identity,
      id,
    };
    await publishMessage(message);
    handleIncomingMessage(encodeMeetingMessage(message));
  }

  async function toggleHandRaised() {
    const next = !handRaised;
    setHandRaised(next);
    await localParticipant.setAttributes({
      handRaised: next ? "1" : "0",
    });
  }

  async function createPoll(event: FormEvent) {
    event.preventDefault();
    const question = pollQuestion.trim();
    const options = pollOptions
      .split("\n")
      .map((option) => option.trim())
      .filter(Boolean);
    if (!question || options.length < 2) return;

    const pollId = `poll-${Date.now()}`;
    await publishMessage({
      type: "poll_create",
      pollId,
      question,
      options,
      from: localParticipant.name || localParticipant.identity,
    });
    setPollQuestion("");
    setPollOptions("Ya\nTidak");
  }

  async function votePoll(pollId: string, optionIndex: number) {
    await publishMessage({
      type: "poll_vote",
      pollId,
      optionIndex,
      from: localParticipant.name || localParticipant.identity,
    });
  }

  async function startBreakoutRooms() {
    const count = Math.max(1, Math.min(8, breakoutCount));
    const created: BreakoutRoom[] = [];
    for (let index = 1; index <= count; index += 1) {
      const entry = {
        roomName: `${mainRoomName}-bo-${index}`,
        label: `Grup ${index}`,
      };
      created.push(entry);
      await publishMessage({
        type: "breakout",
        action: "join",
        roomName: entry.roomName,
        label: entry.label,
      });
    }
    setBreakoutRooms(created);
  }

  async function endBreakout() {
    await publishMessage({
      type: "breakout",
      action: "return",
      roomName: mainRoomName,
    });
    setBreakoutRooms([]);
    setActiveBreakout(null);
  }

  function canvasPoint(event: MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function onCanvasPointerDown(event: MouseEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    const point = canvasPoint(event);
    strokePointsRef.current = [point.x, point.y];
  }

  function onCanvasPointerMove(event: MouseEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const point = canvasPoint(event);
    const points = strokePointsRef.current;
    points.push(point.x, point.y);
    const ctx = getCanvasContext();
    if (!ctx || points.length < 4) return;
    const len = points.length;
    ctx.strokeStyle = strokeColorRef.current;
    ctx.lineWidth = strokeWidthRef.current;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(points[len - 4], points[len - 3]);
    ctx.lineTo(points[len - 2], points[len - 1]);
    ctx.stroke();
  }

  async function onCanvasPointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const points = [...strokePointsRef.current];
    strokePointsRef.current = [];
    if (points.length < 4) return;
    const message: MeetingRealtimeMessage = {
      type: "wb_stroke",
      points,
      color: strokeColorRef.current,
      width: strokeWidthRef.current,
      from: localParticipant.name || localParticipant.identity,
    };
    await publishMessage(message);
  }

  async function clearWhiteboard() {
    clearWhiteboardCanvas();
    await publishMessage({
      type: "wb_clear",
      from: localParticipant.name || localParticipant.identity,
    });
  }

  async function askAi(event: FormEvent) {
    event.preventDefault();
    const message = aiInput.trim();
    if (!message) return;
    setAiBusy(true);
    setAiReply("");
    try {
      const response = await fetch("/api/meeting-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, roomName }),
      });
      const payload = (await response.json()) as {
        reply?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Asisten AI tidak tersedia.");
      }
      setAiReply(payload.reply ?? "");
      setAiInput("");
    } catch (error) {
      setAiReply(
        error instanceof Error ? error.message : "Gagal menghubungi asisten AI.",
      );
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <>
      <div className="meeting-reaction-layer" aria-hidden="true">
        {floatingReactions.map((reaction) => (
          <span key={reaction.id} className="meeting-reaction-float">
            {reaction.emoji}
            <small>{reaction.from}</small>
          </span>
        ))}
      </div>

      {activeBreakout && roomName === mainRoomName ? (
        <div className="meeting-breakout-banner">
          <p>
            Breakout tersedia: <strong>{activeBreakout.label}</strong>
          </p>
          <button
            type="button"
            className="button button-primary"
            onClick={() =>
              router.push(
                `/meeting/${encodeURIComponent(activeBreakout.roomName)}`,
              )
            }
          >
            Masuk breakout
          </button>
        </div>
      ) : null}

      {roomName !== mainRoomName ? (
        <div className="meeting-breakout-banner">
          <p>Anda berada di breakout room.</p>
          <button
            type="button"
            className="button button-ghost"
            onClick={() =>
              router.push(`/meeting/${encodeURIComponent(mainRoomName)}`)
            }
          >
            Kembali ke ruang utama
          </button>
        </div>
      ) : null}

      {raisedParticipants.length > 0 ? (
        <aside className="meeting-hand-list">
          <strong>
            <Hand size={14} /> Tangan diangkat
          </strong>
          <ul>
            {raisedParticipants.map((participant) => (
              <li key={participant.identity}>
                {participant.name || participant.identity}
              </li>
            ))}
          </ul>
        </aside>
      ) : null}

      <nav className="meeting-tools-dock" aria-label="Alat meeting">
        <div className="meeting-tools-dock-row">
          <button
            type="button"
            className={handRaised ? "active" : ""}
            onClick={() => void toggleHandRaised()}
            title="Angkat tangan"
          >
            <Hand size={18} />
            <span>Tangan</span>
          </button>

          <button
            type="button"
            className={activePanel === "reactions" ? "active" : ""}
            onClick={() => togglePanel("reactions")}
            title="Reaksi"
          >
            <Sparkles size={18} />
            <span>Reaksi</span>
          </button>

          <button
            type="button"
            className={layoutMode === "gallery" ? "active" : ""}
            onClick={() => onLayoutChange("gallery")}
            title="Layout galeri"
          >
            <LayoutGrid size={18} />
            <span>Galeri</span>
          </button>

          <button
            type="button"
            className={layoutMode === "focus" ? "active" : ""}
            onClick={() => onLayoutChange("focus")}
            title="Layout fokus"
          >
            <PanelRight size={18} />
            <span>Fokus</span>
          </button>

          <button
            type="button"
            className={layoutMode === "immersive" ? "active" : ""}
            onClick={() => onLayoutChange("immersive")}
            title="Layout imersif"
          >
            <Maximize2 size={18} />
            <span>Imersif</span>
          </button>

          <button
            type="button"
            className={activePanel === "polls" ? "active" : ""}
            onClick={() => togglePanel("polls")}
            title="Polling"
          >
            <Vote size={18} />
            <span>Polling</span>
          </button>

          <button
            type="button"
            className={activePanel === "whiteboard" ? "active" : ""}
            onClick={() => togglePanel("whiteboard")}
            title="Papan tulis"
          >
            <Palette size={18} />
            <span>Papan</span>
          </button>

          <button
            type="button"
            className={activePanel === "ai" ? "active" : ""}
            onClick={() => togglePanel("ai")}
            title="Asisten AI"
          >
            <MessageSquare size={18} />
            <span>AI</span>
          </button>

          {isHost ? (
            <button
              type="button"
              className={activePanel === "breakout" ? "active" : ""}
              onClick={() => togglePanel("breakout")}
              title="Breakout room"
            >
              <Users size={18} />
              <span>Breakout</span>
            </button>
          ) : null}

          <button
            type="button"
            className={activePanel === "settings" ? "active" : ""}
            onClick={() => togglePanel("settings")}
            title="Pengaturan audio & kecantikan"
          >
            <Mic size={18} />
            <span>Atur</span>
          </button>
        </div>

        {activePanel === "settings" ? (
          <section className="meeting-tools-panel">
            <header>
              <strong>Pengaturan meeting</strong>
              <button type="button" onClick={() => setActivePanel("none")}>
                <X size={16} />
              </button>
            </header>
            <div className="meeting-tools-field">
              <label htmlFor="beauty-mode">Filter kecantikan</label>
              <select
                id="beauty-mode"
                value={beautyMode}
                onChange={(event) =>
                  setBeautyMode(event.target.value as BeautyMode)
                }
              >
                <option value="off">Mati</option>
                <option value="soft">Lembut</option>
                <option value="strong">Kuat</option>
              </select>
            </div>
            <div className="meeting-tools-field">
              <label htmlFor="audio-mode">Mode audio</label>
              <select
                id="audio-mode"
                value={audioMode}
                onChange={(event) =>
                  setAudioMode(event.target.value as AudioMode)
                }
              >
                <option value="noise">Reduksi noise (Krisp)</option>
                <option value="standard">Standar browser</option>
                <option value="original">Asli (tanpa filter)</option>
              </select>
            </div>
          </section>
        ) : null}

        {activePanel === "reactions" ? (
          <section className="meeting-tools-panel">
            <header>
              <strong>Kirim reaksi</strong>
              <button type="button" onClick={() => setActivePanel("none")}>
                <X size={16} />
              </button>
            </header>
            <div className="meeting-reaction-picker">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => void sendReaction(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {activePanel === "polls" ? (
          <section className="meeting-tools-panel meeting-tools-panel-wide">
            <header>
              <strong>Polling</strong>
              <button type="button" onClick={() => setActivePanel("none")}>
                <X size={16} />
              </button>
            </header>

            {isHost ? (
              <form onSubmit={createPoll} className="meeting-poll-form">
                <label htmlFor="poll-question">Pertanyaan</label>
                <input
                  id="poll-question"
                  value={pollQuestion}
                  onChange={(event) => setPollQuestion(event.target.value)}
                  placeholder="Contoh: Setuju lanjut ke agenda berikutnya?"
                />
                <label htmlFor="poll-options">Opsi (satu per baris)</label>
                <textarea
                  id="poll-options"
                  value={pollOptions}
                  onChange={(event) => setPollOptions(event.target.value)}
                  rows={3}
                />
                <button type="submit" className="button button-primary">
                  <Wand2 size={14} /> Buat polling
                </button>
              </form>
            ) : null}

            <div className="meeting-poll-list">
              {polls.length === 0 ? (
                <p className="meeting-panel-empty">Belum ada polling aktif.</p>
              ) : (
                polls.map((poll) => (
                  <article key={poll.pollId} className="meeting-poll-item">
                    <h4>{poll.question}</h4>
                    <ul>
                      {poll.options.map((option, index) => {
                        const voters = poll.votes[index] ?? [];
                        return (
                          <li key={option}>
                            <button
                              type="button"
                              onClick={() => void votePoll(poll.pollId, index)}
                            >
                              {option}
                            </button>
                            <small>{voters.length} suara</small>
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                ))
              )}
            </div>
          </section>
        ) : null}

        {activePanel === "breakout" && isHost ? (
          <section className="meeting-tools-panel">
            <header>
              <strong>Breakout room</strong>
              <button type="button" onClick={() => setActivePanel("none")}>
                <X size={16} />
              </button>
            </header>
            <div className="meeting-tools-field">
              <label htmlFor="breakout-count">Jumlah ruang</label>
              <input
                id="breakout-count"
                type="number"
                min={1}
                max={8}
                value={breakoutCount}
                onChange={(event) =>
                  setBreakoutCount(Number(event.target.value) || 1)
                }
              />
            </div>
            <div className="meeting-breakout-actions">
              <button
                type="button"
                className="button button-primary"
                onClick={() => void startBreakoutRooms()}
              >
                Mulai breakout
              </button>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => void endBreakout()}
              >
                Akhiri & kumpulkan
              </button>
            </div>
            {breakoutRooms.length > 0 ? (
              <ul className="meeting-breakout-list">
                {breakoutRooms.map((entry) => (
                  <li key={entry.roomName}>{entry.label}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {activePanel === "whiteboard" ? (
          <section className="meeting-tools-panel meeting-tools-panel-wide">
            <header>
              <strong>Papan tulis bersama</strong>
              <button type="button" onClick={() => setActivePanel("none")}>
                <X size={16} />
              </button>
            </header>
            <div className="meeting-whiteboard-toolbar">
              <label htmlFor="wb-color">Warna</label>
              <input
                id="wb-color"
                type="color"
                defaultValue="#ffffff"
                onChange={(event) => {
                  strokeColorRef.current = event.target.value;
                }}
              />
              <label htmlFor="wb-width">Ketebalan</label>
              <input
                id="wb-width"
                type="range"
                min={1}
                max={12}
                defaultValue={3}
                onChange={(event) => {
                  strokeWidthRef.current = Number(event.target.value);
                }}
              />
              <button type="button" onClick={() => void clearWhiteboard()}>
                Hapus papan
              </button>
            </div>
            <canvas
              ref={canvasRef}
              className="meeting-whiteboard-canvas"
              width={960}
              height={480}
              onMouseDown={onCanvasPointerDown}
              onMouseMove={onCanvasPointerMove}
              onMouseUp={() => void onCanvasPointerUp()}
              onMouseLeave={() => void onCanvasPointerUp()}
            />
          </section>
        ) : null}

        {activePanel === "ai" ? (
          <section className="meeting-tools-panel meeting-tools-panel-wide">
            <header>
              <strong>Asisten AI meeting</strong>
              <button type="button" onClick={() => setActivePanel("none")}>
                <X size={16} />
              </button>
            </header>
            <form onSubmit={askAi} className="meeting-ai-form">
              <input
                value={aiInput}
                onChange={(event) => setAiInput(event.target.value)}
                placeholder="Minta ringkasan, ide, atau agenda..."
                disabled={aiBusy}
              />
              <button
                type="submit"
                className="button button-primary"
                disabled={aiBusy}
              >
                {aiBusy ? "Memproses..." : "Tanya AI"}
              </button>
            </form>
            {aiReply ? <p className="meeting-ai-reply">{aiReply}</p> : null}
          </section>
        ) : null}
      </nav>
    </>
  );
}
