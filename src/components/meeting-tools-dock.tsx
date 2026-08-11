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
  Chat,
  TrackToggle,
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
  Captions,
  Ellipsis,
  Hand,
  LayoutGrid,
  LogOut,
  Maximize2,
  MessageSquare,
  Mic,
  MonitorUp,
  Palette,
  PanelRight,
  PhoneOff,
  Sparkles,
  Users,
  Video,
  VideoOff,
  Vote,
  Wand2,
  X,
} from "lucide-react";
import { MediaDevicePickers } from "@/components/media-device-pickers";
import {
  decodeMeetingMessage,
  encodeMeetingMessage,
  type MeetingRealtimeMessage,
} from "@/lib/meeting-realtime";
import { resolveLocalVideoCapture } from "@/lib/livekit-room-options";
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
  | "ai"
  | "participants"
  | "chat"
  | "more"
  | "leave";

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

type CaptionLine = {
  id: string;
  from: string;
  text: string;
  final: boolean;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type MeetingToolsDockProps = {
  roomName: string;
  isHost: boolean;
  mainRoomName: string;
  meetingId: string | null;
  meetingTitle: string;
  layoutMode: MeetingLayoutMode;
  onLayoutChange: (mode: MeetingLayoutMode) => void;
  /** Call before intentional room.disconnect() so leave screen can show. */
  onLeaveIntent?: () => void;
};

const REACTION_EMOJIS = ["👍", "👏", "❤️", "😂", "🎉", "🤔"];
const BEAUTY_STORAGE_KEY = "genmeet-beauty";
const AUDIO_STORAGE_KEY = "genmeet-audio-mode";
const DISPLAY_NAME_STORAGE_KEY = "genmeet_display_name";

function readStoredDisplayName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(DISPLAY_NAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeDisplayName(name: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DISPLAY_NAME_STORAGE_KEY, name);
  } catch {
    // ignore quota / private mode
  }
}

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

  // "standard" uses browser defaults from the first mic enable — never restart
  // the mic here or join freezes (stop/start getUserMedia right after connect).
  if (mode === "standard") {
    return;
  }

  if (mode === "original") {
    const wasEnabled = !track.isMuted;
    if (wasEnabled) {
      await setMicEnabled(false);
      await setMicEnabled(true, {
        noiseSuppression: false,
        echoCancellation: false,
      });
    }
  }
}

export function MeetingToolsDock({
  roomName,
  isHost,
  mainRoomName,
  meetingId,
  meetingTitle,
  layoutMode,
  onLayoutChange,
  onLeaveIntent,
}: MeetingToolsDockProps) {
  const router = useRouter();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [ending, setEnding] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const reactionSeqRef = useRef(0);

  const [activePanel, setActivePanel] = useState<DockPanel>("none");
  const [beautyMode, setBeautyMode] = useState<BeautyMode>(() =>
    readStoredBeauty(),
  );
  const [audioMode, setAudioMode] = useState<AudioMode>(() =>
    readStoredAudioMode(),
  );
  const [handRaised, setHandRaised] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>(
    [],
  );
  const [polls, setPolls] = useState<PollState[]>([]);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState("Ya\nTidak");
  const [breakoutCount, setBreakoutCount] = useState(2);
  const [breakoutRooms, setBreakoutRooms] = useState<BreakoutRoom[]>([]);
  const [breakoutAssignments, setBreakoutAssignments] = useState<
    Record<string, string>
  >({});
  const [breakoutDurationMin, setBreakoutDurationMin] = useState(5);
  const [breakoutSecondsLeft, setBreakoutSecondsLeft] = useState<number | null>(
    null,
  );
  const [activeBreakout, setActiveBreakout] = useState<BreakoutRoom | null>(
    null,
  );
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captionLines, setCaptionLines] = useState<CaptionLine[]>([]);
  const [captionSupported, setCaptionSupported] = useState(true);
  const captionsEnabledRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const captionSeqRef = useRef(0);
  const autoJoinRef = useRef(false);
  const [aiInput, setAiInput] = useState("");
  const [aiReply, setAiReply] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [displayName, setDisplayName] = useState(() => {
    const stored = readStoredDisplayName();
    return stored || localParticipant.name || localParticipant.identity || "";
  });
  const [nameBusy, setNameBusy] = useState(false);
  const [nameStatus, setNameStatus] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [roomLocked, setRoomLocked] = useState(false);
  const [hostBusy, setHostBusy] = useState(false);
  const [hostError, setHostError] = useState("");

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
          if (message.action === "start") {
            const rooms = message.rooms ?? [];
            setBreakoutRooms(rooms);
            if (typeof message.secondsLeft === "number") {
              setBreakoutSecondsLeft(message.secondsLeft);
            }
            const mine = message.assignments?.find(
              (entry) => entry.identity === localParticipant.identity,
            );
            if (mine) {
              const entry = {
                roomName: mine.roomName,
                label: mine.label,
              };
              setActiveBreakout(entry);
              if (
                roomName === mainRoomName &&
                !autoJoinRef.current
              ) {
                autoJoinRef.current = true;
                window.setTimeout(() => {
                  router.push(
                    `/meeting/${encodeURIComponent(entry.roomName)}`,
                  );
                }, 800);
              }
            } else if (rooms[0]) {
              setActiveBreakout(rooms[0]);
            }
          } else if (message.action === "timer") {
            if (typeof message.secondsLeft === "number") {
              setBreakoutSecondsLeft(message.secondsLeft);
            }
          } else if (message.action === "join") {
            const entry = {
              roomName: message.roomName ?? "",
              label: message.label ?? message.roomName ?? "",
            };
            if (!entry.roomName) break;
            setBreakoutRooms((current) => {
              if (current.some((roomItem) => roomItem.roomName === entry.roomName)) {
                return current;
              }
              return [...current, entry];
            });
            setActiveBreakout(entry);
          } else if (message.action === "return") {
            setActiveBreakout(null);
            setBreakoutRooms([]);
            setBreakoutSecondsLeft(null);
            autoJoinRef.current = false;
            if (roomName !== mainRoomName) {
              router.push(`/meeting/${encodeURIComponent(mainRoomName)}`);
            }
          }
          break;
        case "caption":
          if (!captionsEnabledRef.current) break;
          setCaptionLines((current) => {
            const withoutSame = current.filter((line) => line.id !== message.id);
            const next = [
              ...withoutSame,
              {
                id: message.id,
                from: message.from,
                text: message.text,
                final: message.final,
              },
            ];
            return next.slice(-6);
          });
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
    [localParticipant.identity, mainRoomName, roomName, router],
  );

  useEffect(() => {
    if (!isHost || !meetingId) return;
    let cancelled = false;
    void fetch(`/api/meetings/${encodeURIComponent(roomName)}/host`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { locked?: boolean };
        if (!cancelled) {
          setRoomLocked(Boolean(payload.locked));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isHost, meetingId, roomName]);

  useEffect(() => {
    applyBeautyMode(beautyMode);
    window.localStorage.setItem(BEAUTY_STORAGE_KEY, beautyMode);
  }, [beautyMode]);

  useEffect(() => {
    window.localStorage.setItem(AUDIO_STORAGE_KEY, audioMode);
    // Skip default "standard" on mount — mic is already correct after connect.
    if (audioMode === "standard") {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
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
    }, audioMode === "noise" ? 900 : 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
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
    reactionSeqRef.current += 1;
    const id = `rx-${reactionSeqRef.current}`;
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

    const pollId = `poll-${++reactionSeqRef.current}`;
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
      created.push({
        roomName: `${mainRoomName}-bo-${index}`,
        label: `Grup ${index}`,
      });
    }

    const remoteParticipants = participants.filter(
      (participant) => !participant.isLocal,
    );
    const assignments = remoteParticipants.map((participant, index) => {
      const preferredRoom =
        breakoutAssignments[participant.identity] ||
        created[index % created.length]?.roomName ||
        created[0].roomName;
      const roomEntry =
        created.find((entry) => entry.roomName === preferredRoom) ?? created[0];
      return {
        identity: participant.identity,
        roomName: roomEntry.roomName,
        label: roomEntry.label,
      };
    });

    const secondsLeft = Math.max(1, breakoutDurationMin) * 60;
    const endsAt = Date.now() + secondsLeft * 1000;
    setBreakoutRooms(created);
    setBreakoutSecondsLeft(secondsLeft);
    try {
      window.sessionStorage.setItem(
        "genmeet_breakout",
        JSON.stringify({
          mainRoomName,
          endsAt,
          active: true,
        }),
      );
    } catch {
      // ignore
    }
    if (meetingId) {
      void hostAction({
        action: "breakout",
        active: true,
        endsAt,
      }).catch(() => undefined);
    }
    await publishMessage({
      type: "breakout",
      action: "start",
      rooms: created,
      assignments,
      secondsLeft,
    });
  }

  async function endBreakout() {
    try {
      window.sessionStorage.removeItem("genmeet_breakout");
    } catch {
      // ignore
    }
    if (meetingId) {
      void hostAction({
        action: "breakout",
        active: false,
      }).catch(() => undefined);
    }
    await publishMessage({
      type: "breakout",
      action: "return",
      roomName: mainRoomName,
    });
    setBreakoutRooms([]);
    setActiveBreakout(null);
    setBreakoutSecondsLeft(null);
    autoJoinRef.current = false;
  }

  useEffect(() => {
    if (breakoutSecondsLeft === null) return;
    if (breakoutSecondsLeft <= 0) {
      if (isHost && breakoutRooms.length > 0) {
        void endBreakout();
      }
      return;
    }
    const timer = window.setTimeout(() => {
      setBreakoutSecondsLeft((current) =>
        current === null ? null : Math.max(0, current - 1),
      );
    }, 1000);
    return () => window.clearTimeout(timer);
    // endBreakout intentionally omitted — host close on zero only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakoutSecondsLeft, breakoutRooms.length, isHost]);

  useEffect(() => {
    if (
      !isHost ||
      breakoutSecondsLeft === null ||
      breakoutRooms.length === 0
    ) {
      return;
    }
    if (breakoutSecondsLeft % 5 !== 0 && breakoutSecondsLeft !== 1) {
      return;
    }
    void publishMessage({
      type: "breakout",
      action: "timer",
      secondsLeft: breakoutSecondsLeft,
    });
  }, [breakoutSecondsLeft, breakoutRooms.length, isHost, publishMessage]);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("genmeet_breakout");
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        mainRoomName?: string;
        endsAt?: number;
        active?: boolean;
      };
      if (!parsed.active || parsed.mainRoomName !== mainRoomName) return;
      if (typeof parsed.endsAt === "number") {
        const left = Math.max(
          0,
          Math.ceil((parsed.endsAt - Date.now()) / 1000),
        );
        setBreakoutSecondsLeft(left);
      }
    } catch {
      // ignore
    }
  }, [mainRoomName]);

  useEffect(() => {
    if (roomName === mainRoomName) return;
    let cancelled = false;

    async function pollBreakoutStatus() {
      try {
        const response = await fetch(
          `/api/meetings/${encodeURIComponent(mainRoomName)}/breakout-status`,
          { cache: "no-store" },
        );
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as {
          active?: boolean;
          endsAt?: number | null;
        };
        if (payload.active === false) {
          try {
            window.sessionStorage.removeItem("genmeet_breakout");
          } catch {
            // ignore
          }
          router.push(`/meeting/${encodeURIComponent(mainRoomName)}`);
          return;
        }
        if (typeof payload.endsAt === "number") {
          const left = Math.max(
            0,
            Math.ceil((payload.endsAt - Date.now()) / 1000),
          );
          setBreakoutSecondsLeft(left);
          if (left <= 0) {
            try {
              window.sessionStorage.removeItem("genmeet_breakout");
            } catch {
              // ignore
            }
            router.push(`/meeting/${encodeURIComponent(mainRoomName)}`);
          }
        }
      } catch {
        // ignore transient errors
      }
    }

    void pollBreakoutStatus();
    const timer = window.setInterval(() => {
      void pollBreakoutStatus();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [mainRoomName, roomName, router]);

  useEffect(() => {
    type SpeechWindow = Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const speechWindow = window as SpeechWindow;
    const Recognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setCaptionSupported(false);
      return;
    }

    if (!captionsEnabled) {
      captionsEnabledRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setCaptionLines([]);
      return;
    }

    captionsEnabledRef.current = true;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "id-ID";
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript?.trim();
        if (!text) continue;
        captionSeqRef.current += 1;
        const message: MeetingRealtimeMessage = {
          type: "caption",
          text,
          from: localParticipant.name || localParticipant.identity,
          final: result.isFinal,
          id: result.isFinal
            ? `${localParticipant.identity}-f-${captionSeqRef.current}`
            : `${localParticipant.identity}-interim`,
        };
        void publishMessage(message);
        handleIncomingMessage(encodeMeetingMessage(message));
      }
    };
    recognition.onerror = () => {
      // Keep CC toggle on; browser may recover on next utterance.
    };
    recognition.onend = () => {
      if (captionsEnabled && recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          // Already started.
        }
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      try {
        recognition.lang = "en-US";
        recognition.start();
      } catch {
        setCaptionSupported(false);
        captionsEnabledRef.current = false;
        setCaptionsEnabled(false);
      }
    }

    return () => {
      recognition.onend = null;
      recognition.stop();
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
    };
  }, [
    captionsEnabled,
    handleIncomingMessage,
    localParticipant.identity,
    localParticipant.name,
    publishMessage,
  ]);

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

  async function saveDisplayName(event: FormEvent) {
    event.preventDefault();
    const next = displayName.trim();
    if (next.length < 2) {
      setNameStatus({
        type: "error",
        text: "Nama minimal 2 karakter.",
      });
      return;
    }
    if (next.length > 50) {
      setNameStatus({
        type: "error",
        text: "Nama maksimal 50 karakter.",
      });
      return;
    }

    setNameBusy(true);
    setNameStatus(null);
    try {
      await localParticipant.setName(next);
      storeDisplayName(next);
      setNameStatus({ type: "ok", text: "Nama tampilan diperbarui." });
    } catch (error) {
      setNameStatus({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Nama belum dapat diubah.",
      });
    } finally {
      setNameBusy(false);
    }
  }

  async function endMeetingForAll() {
    if (!meetingId || ending) return;
    setEnding(true);
    try {
      await fetch(
        `/api/meetings/manage/${encodeURIComponent(meetingId)}/end`,
        { method: "POST" },
      );
    } catch {
      // Still leave locally even if end fails.
    } finally {
      onLeaveIntent?.();
      room.disconnect();
      setEnding(false);
    }
  }

  async function hostAction(body: Record<string, unknown>) {
    const response = await fetch(
      `/api/meetings/${encodeURIComponent(roomName)}/host`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const payload = (await response.json()) as { error?: string; locked?: boolean };
    if (!response.ok) {
      throw new Error(payload.error ?? "Aksi host gagal.");
    }
    return payload;
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

      {captionsEnabled ? (
        <div className="meeting-caption-overlay" aria-live="polite">
          {captionLines.length === 0 ? (
            <p className="meeting-caption-empty">
              {captionsEnabled
                ? "Captions aktif — bicara untuk menampilkan teks."
                : null}
            </p>
          ) : (
            captionLines.map((line) => (
              <p
                key={line.id}
                className={line.final ? undefined : "is-interim"}
              >
                <strong>{line.from}:</strong> {line.text}
              </p>
            ))
          )}
        </div>
      ) : null}

      {activeBreakout && roomName === mainRoomName ? (
        <div className="meeting-breakout-banner">
          <p>
            Breakout tersedia: <strong>{activeBreakout.label}</strong>
            {breakoutSecondsLeft !== null ? (
              <>
                {" "}
                ·{" "}
                {String(Math.floor(breakoutSecondsLeft / 60)).padStart(2, "0")}:
                {String(breakoutSecondsLeft % 60).padStart(2, "0")}
              </>
            ) : null}
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
          <p>
            Anda berada di breakout room.
            {breakoutSecondsLeft !== null ? (
              <>
                {" "}
                Sisa{" "}
                {String(Math.floor(breakoutSecondsLeft / 60)).padStart(2, "0")}:
                {String(breakoutSecondsLeft % 60).padStart(2, "0")}
              </>
            ) : null}
          </p>
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

      <nav className="meeting-tools-dock meeting-control-bar" aria-label="Kontrol meeting">
        <div className="meeting-tools-dock-row meeting-control-bar-row">
          <TrackToggle
            source={Track.Source.Microphone}
            showIcon
            className="meeting-control-toggle"
          >
            Mic
          </TrackToggle>
          <button
            type="button"
            className={`meeting-control-toggle lk-button${
              localParticipant.isCameraEnabled ? "" : " lk-button-disabled"
            }`}
            disabled={cameraBusy}
            aria-pressed={localParticipant.isCameraEnabled}
            title={
              localParticipant.isCameraEnabled ? "Matikan kamera" : "Nyalakan kamera"
            }
            onClick={() => {
              void (async () => {
                if (cameraBusy) return;
                setCameraBusy(true);
                const turningOn = !localParticipant.isCameraEnabled;
                try {
                  if (!turningOn) {
                    await localParticipant.setCameraEnabled(false);
                  } else {
                    const capture = await resolveLocalVideoCapture();
                    await localParticipant.setCameraEnabled(true, capture);
                  }
                } catch {
                  // Camera toggle failed; UI stays on previous state.
                } finally {
                  setCameraBusy(false);
                }
              })();
            }}
          >
            {localParticipant.isCameraEnabled ? (
              <Video size={18} />
            ) : (
              <VideoOff size={18} />
            )}
            Video
          </button>

          <button
            type="button"
            className={activePanel === "participants" ? "active" : ""}
            onClick={() => togglePanel("participants")}
            title="Peserta"
          >
            <Users size={18} />
            <span>Peserta</span>
            <em className="meeting-control-count">{participants.length}</em>
          </button>

          <button
            type="button"
            className={activePanel === "chat" ? "active" : ""}
            onClick={() => togglePanel("chat")}
            title="Chat"
          >
            <MessageSquare size={18} />
            <span>Chat</span>
          </button>

          <TrackToggle
            source={Track.Source.ScreenShare}
            captureOptions={{ audio: true, selfBrowserSurface: "include" }}
            showIcon
            className="meeting-control-toggle"
          >
            <MonitorUp size={18} />
            Share
          </TrackToggle>

          <button
            type="button"
            className={captionsEnabled ? "active" : ""}
            onClick={() => {
              if (!captionSupported) return;
              setCaptionsEnabled((current) => {
                const next = !current;
                captionsEnabledRef.current = next;
                if (!next) {
                  setCaptionLines([]);
                }
                return next;
              });
            }}
            title={
              captionSupported
                ? "Teks berjalan (CC)"
                : "Captions tidak didukung di browser ini"
            }
            disabled={!captionSupported}
          >
            <Captions size={18} />
            <span>CC</span>
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
            className={
              activePanel === "more" ||
              activePanel === "settings" ||
              activePanel === "polls" ||
              activePanel === "whiteboard" ||
              activePanel === "ai" ||
              activePanel === "breakout"
                ? "active"
                : ""
            }
            onClick={() => togglePanel("more")}
            title="Lainnya"
          >
            <Ellipsis size={18} />
            <span>Lainnya</span>
          </button>

          <button
            type="button"
            className="meeting-control-leave"
            onClick={() => togglePanel("leave")}
            title="Keluar"
          >
            <PhoneOff size={18} />
            <span>Keluar</span>
          </button>
        </div>

        {activePanel === "leave" ? (
          <section className="meeting-tools-panel meeting-leave-sheet">
            <header>
              <strong>Keluar dari meeting?</strong>
              <button type="button" onClick={() => setActivePanel("none")}>
                <X size={16} />
              </button>
            </header>
            <p className="meeting-leave-copy">
              Anda akan meninggalkan “{meetingTitle}”.
            </p>
            <div className="meeting-leave-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => {
                  setActivePanel("none");
                  onLeaveIntent?.();
                  room.disconnect();
                }}
              >
                <LogOut size={16} /> Keluar
              </button>
              {isHost && meetingId ? (
                <button
                  type="button"
                  className="button button-primary meeting-leave-end"
                  disabled={ending}
                  onClick={() => void endMeetingForAll()}
                >
                  <PhoneOff size={16} />
                  {ending ? "Mengakhiri..." : "Akhiri untuk semua"}
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {activePanel === "participants" ? (
          <section className="meeting-tools-panel meeting-tools-panel-wide">
            <header>
              <strong>Peserta ({participants.length})</strong>
              <button type="button" onClick={() => setActivePanel("none")}>
                <X size={16} />
              </button>
            </header>
            {isHost && meetingId ? (
              <div className="meeting-host-actions">
                <button
                  type="button"
                  className="button button-ghost"
                  disabled={hostBusy}
                  onClick={() => {
                    setHostBusy(true);
                    setHostError("");
                    void hostAction({
                      action: "mute_all",
                      exceptIdentity: localParticipant.identity,
                    })
                      .catch((error: unknown) => {
                        setHostError(
                          error instanceof Error
                            ? error.message
                            : "Mute semua gagal.",
                        );
                      })
                      .finally(() => setHostBusy(false));
                  }}
                >
                  Mute semua
                </button>
                <button
                  type="button"
                  className={`button button-ghost${roomLocked ? " is-locked" : ""}`}
                  disabled={hostBusy}
                  onClick={() => {
                    setHostBusy(true);
                    setHostError("");
                    void hostAction({ action: "lock", locked: !roomLocked })
                      .then((payload) => {
                        setRoomLocked(Boolean(payload.locked));
                      })
                      .catch((error: unknown) => {
                        setHostError(
                          error instanceof Error
                            ? error.message
                            : "Kunci meeting gagal.",
                        );
                      })
                      .finally(() => setHostBusy(false));
                  }}
                >
                  {roomLocked ? "Buka kunci" : "Kunci meeting"}
                </button>
              </div>
            ) : null}
            {hostError ? (
              <p className="meeting-display-name-status is-error" role="alert">
                {hostError}
              </p>
            ) : null}
            <ul className="meeting-participants-list">
              {participants.map((participant) => (
                <li key={participant.identity}>
                  <span>{participant.name || participant.identity}</span>
                  <div className="meeting-participant-actions">
                    {participant.isLocal ? <small>Anda</small> : null}
                    {isHost && meetingId && !participant.isLocal ? (
                      <>
                        <button
                          type="button"
                          disabled={hostBusy}
                          onClick={() => {
                            setHostBusy(true);
                            setHostError("");
                            void hostAction({
                              action: "mute",
                              identity: participant.identity,
                              trackKind: "audio",
                              muted: true,
                            })
                              .catch((error: unknown) => {
                                setHostError(
                                  error instanceof Error
                                    ? error.message
                                    : "Mute gagal.",
                                );
                              })
                              .finally(() => setHostBusy(false));
                          }}
                        >
                          Mute mic
                        </button>
                        <button
                          type="button"
                          disabled={hostBusy}
                          onClick={() => {
                            setHostBusy(true);
                            setHostError("");
                            void hostAction({
                              action: "mute",
                              identity: participant.identity,
                              trackKind: "video",
                              muted: true,
                            })
                              .catch((error: unknown) => {
                                setHostError(
                                  error instanceof Error
                                    ? error.message
                                    : "Matikan kamera gagal.",
                                );
                              })
                              .finally(() => setHostBusy(false));
                          }}
                        >
                          Mute cam
                        </button>
                        <button
                          type="button"
                          className="is-danger"
                          disabled={hostBusy}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Keluarkan ${participant.name || participant.identity}?`,
                              )
                            ) {
                              return;
                            }
                            setHostBusy(true);
                            setHostError("");
                            void hostAction({
                              action: "kick",
                              identity: participant.identity,
                            })
                              .catch((error: unknown) => {
                                setHostError(
                                  error instanceof Error
                                    ? error.message
                                    : "Kick gagal.",
                                );
                              })
                              .finally(() => setHostBusy(false));
                          }}
                        >
                          Kick
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="button button-ghost button-full"
              onClick={() => setActivePanel("settings")}
            >
              Ubah nama tampilan
            </button>
            <p className="meeting-panel-hint">
              Host: gunakan tombol <strong>Menunggu</strong> di pojok untuk
              menyetujui waiting room.
            </p>
          </section>
        ) : null}

        <section
          className="meeting-tools-panel meeting-tools-panel-wide meeting-chat-panel"
          hidden={activePanel !== "chat"}
          aria-hidden={activePanel !== "chat"}
        >
          <header>
            <strong>Chat</strong>
            <button type="button" onClick={() => setActivePanel("none")}>
              <X size={16} />
            </button>
          </header>
          <Chat />
        </section>

        {activePanel === "more" ? (
          <section className="meeting-tools-panel meeting-more-menu">
            <header>
              <strong>Lainnya</strong>
              <button type="button" onClick={() => setActivePanel("none")}>
                <X size={16} />
              </button>
            </header>
            <div className="meeting-more-grid">
              <button
                type="button"
                className={handRaised ? "active" : ""}
                onClick={() => void toggleHandRaised()}
              >
                <Hand size={18} /> Angkat tangan
              </button>
              <button
                type="button"
                className={layoutMode === "gallery" ? "active" : ""}
                onClick={() => onLayoutChange("gallery")}
              >
                <LayoutGrid size={18} /> Galeri
              </button>
              <button
                type="button"
                className={layoutMode === "focus" ? "active" : ""}
                onClick={() => onLayoutChange("focus")}
              >
                <PanelRight size={18} /> Fokus
              </button>
              <button
                type="button"
                className={layoutMode === "immersive" ? "active" : ""}
                onClick={() => onLayoutChange("immersive")}
              >
                <Maximize2 size={18} /> Imersif
              </button>
              <button type="button" onClick={() => setActivePanel("polls")}>
                <Vote size={18} /> Polling
              </button>
              <button type="button" onClick={() => setActivePanel("whiteboard")}>
                <Palette size={18} /> Papan tulis
              </button>
              <button type="button" onClick={() => setActivePanel("ai")}>
                <MessageSquare size={18} /> AI
              </button>
              {isHost ? (
                <button type="button" onClick={() => setActivePanel("breakout")}>
                  <Users size={18} /> Breakout
                </button>
              ) : null}
              <button type="button" onClick={() => setActivePanel("settings")}>
                <Mic size={18} /> Pengaturan
              </button>
            </div>
          </section>
        ) : null}

        {activePanel === "settings" ? (
          <section className="meeting-tools-panel">
            <header>
              <strong>Pengaturan</strong>
              <button type="button" onClick={() => setActivePanel("none")}>
                <X size={16} />
              </button>
            </header>

            <form
              className="meeting-display-name-form"
              onSubmit={(event) => void saveDisplayName(event)}
            >
              <div className="meeting-tools-field">
                <label htmlFor="display-name">Nama tampilan</label>
                <input
                  id="display-name"
                  type="text"
                  value={displayName}
                  maxLength={50}
                  autoComplete="nickname"
                  placeholder="Nama yang terlihat di meeting"
                  onChange={(event) => {
                    setDisplayName(event.target.value);
                    setNameStatus(null);
                  }}
                />
              </div>
              <div className="meeting-name-actions">
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={nameBusy}
                >
                  {nameBusy ? "Menyimpan..." : "Simpan nama"}
                </button>
              </div>
              {nameStatus ? (
                <p
                  className={`meeting-display-name-status${
                    nameStatus.type === "error" ? " is-error" : ""
                  }`}
                  role="status"
                >
                  {nameStatus.text}
                </p>
              ) : (
                <p className="meeting-panel-hint">
                  Nama ini muncul di tile video dan daftar peserta.
                </p>
              )}
            </form>

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

            <h4 className="meeting-settings-subtitle">Perangkat</h4>
            <MediaDevicePickers
              onDeviceChange={async (kind, deviceId) => {
                try {
                  await room.switchActiveDevice(kind, deviceId);
                } catch {
                  // Browser may block speaker switch without gesture.
                }
              }}
            />
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
          <section className="meeting-tools-panel meeting-tools-panel-wide">
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
            <div className="meeting-tools-field">
              <label htmlFor="breakout-duration">Timer (menit)</label>
              <input
                id="breakout-duration"
                type="number"
                min={1}
                max={60}
                value={breakoutDurationMin}
                onChange={(event) =>
                  setBreakoutDurationMin(Number(event.target.value) || 1)
                }
              />
            </div>
            <div className="meeting-breakout-assign">
              <strong>Assign peserta</strong>
              {participants.filter((participant) => !participant.isLocal)
                .length === 0 ? (
                <p className="meeting-panel-empty">
                  Belum ada peserta lain untuk di-assign.
                </p>
              ) : (
                <ul className="meeting-breakout-assign-list">
                  {participants
                    .filter((participant) => !participant.isLocal)
                    .map((participant) => {
                      const rooms = Array.from(
                        { length: Math.max(1, Math.min(8, breakoutCount)) },
                        (_, index) => ({
                          roomName: `${mainRoomName}-bo-${index + 1}`,
                          label: `Grup ${index + 1}`,
                        }),
                      );
                      const value =
                        breakoutAssignments[participant.identity] ||
                        rooms[0]?.roomName ||
                        "";
                      return (
                        <li key={participant.identity}>
                          <span>
                            {participant.name || participant.identity}
                          </span>
                          <select
                            value={value}
                            onChange={(event) =>
                              setBreakoutAssignments((current) => ({
                                ...current,
                                [participant.identity]: event.target.value,
                              }))
                            }
                          >
                            {rooms.map((roomEntry) => (
                              <option
                                key={roomEntry.roomName}
                                value={roomEntry.roomName}
                              >
                                {roomEntry.label}
                              </option>
                            ))}
                          </select>
                        </li>
                      );
                    })}
                </ul>
              )}
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
                  <li key={entry.roomName}>
                    {entry.label}
                    {breakoutSecondsLeft !== null
                      ? ` · ${String(Math.floor(breakoutSecondsLeft / 60)).padStart(2, "0")}:${String(breakoutSecondsLeft % 60).padStart(2, "0")}`
                      : ""}
                  </li>
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
