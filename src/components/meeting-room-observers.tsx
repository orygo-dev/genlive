"use client";

import { useEffect, useRef } from "react";
import {
  useConnectionState,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import {
  ConnectionState,
  RoomEvent,
  Track,
  type DisconnectReason,
  type Participant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type TrackPublication,
} from "livekit-client";
import {
  formatDisconnectReason,
  meetingLogger,
  setMeetingDebugConnectionState,
} from "@/lib/meeting-logger";

/**
 * Attaches high-signal LiveKit room observers. Must render inside LiveKitRoom.
 * Does not change meeting behavior — observability only.
 */
export function MeetingRoomObservers() {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const prevStateRef = useRef<ConnectionState | null>(null);
  const observersBoundRef = useRef(false);

  useEffect(() => {
    setMeetingDebugConnectionState(connectionState);
    const prev = prevStateRef.current;
    prevStateRef.current = connectionState;

    if (connectionState === ConnectionState.Connecting) {
      meetingLogger("ROOM_CONNECTING");
    } else if (connectionState === ConnectionState.Connected) {
      if (prev === ConnectionState.Reconnecting) {
        meetingLogger("ROOM_RECONNECTED", {
          participantCount: room.remoteParticipants.size + 1,
        });
      } else {
        meetingLogger("ROOM_CONNECTED", {
          participantCount: room.remoteParticipants.size + 1,
        });
      }
    } else if (connectionState === ConnectionState.Reconnecting) {
      meetingLogger("ROOM_RECONNECTING");
    } else if (connectionState === ConnectionState.Disconnected) {
      meetingLogger("ROOM_DISCONNECTED", {
        canPlaybackAudio: room.canPlaybackAudio,
        reason: "UNKNOWN",
        note: "connectionState",
      });
    }
  }, [connectionState, room]);

  useEffect(() => {
    if (observersBoundRef.current) {
      meetingLogger("INVARIANT_WARN", {
        message: "MeetingRoomObservers effect re-entered while bound",
      });
    }
    observersBoundRef.current = true;

    const onDisconnected = (reason?: DisconnectReason) => {
      meetingLogger("ROOM_DISCONNECTED", {
        reason: formatDisconnectReason(reason),
        reasonCode: reason != null ? Number(reason) : undefined,
        canPlaybackAudio: room.canPlaybackAudio,
        note: "RoomEvent.Disconnected",
      });
    };

    const onParticipantConnected = (participant: Participant) => {
      meetingLogger("PARTICIPANT_CONNECTED", {
        identityPrefix: participant.identity.slice(0, 12),
        sid: participant.sid,
      });
    };

    const onParticipantDisconnected = (participant: Participant) => {
      meetingLogger("PARTICIPANT_DISCONNECTED", {
        identityPrefix: participant.identity.slice(0, 12),
        sid: participant.sid,
      });
    };

    const onLocalTrackPublished = (publication: TrackPublication) => {
      meetingLogger("TRACK_PUBLISHED", {
        source: String(publication.source),
        kind: String(publication.kind),
        local: true,
      });
      if (publication.source === Track.Source.Microphone) {
        meetingLogger(publication.isMuted ? "MIC_DISABLED" : "MIC_ENABLED");
      }
      if (publication.source === Track.Source.Camera) {
        meetingLogger(
          publication.isMuted ? "CAMERA_DISABLED" : "CAMERA_ENABLED",
        );
      }
    };

    const onLocalTrackUnpublished = (publication: TrackPublication) => {
      meetingLogger("TRACK_UNPUBLISHED", {
        source: String(publication.source),
        kind: String(publication.kind),
        local: true,
      });
    };

    const onTrackSubscribed = (
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: Participant,
    ) => {
      meetingLogger("TRACK_SUBSCRIBED", {
        source: String(publication.source),
        kind: String(track.kind),
        identityPrefix: participant.identity.slice(0, 12),
      });
    };

    const onTrackUnsubscribed = (
      track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: Participant,
    ) => {
      meetingLogger("TRACK_UNSUBSCRIBED", {
        source: String(publication.source),
        kind: String(track.kind),
        identityPrefix: participant.identity.slice(0, 12),
      });
    };

    const onTrackMuted = (
      publication: TrackPublication,
      participant: Participant,
    ) => {
      meetingLogger("TRACK_MUTED", {
        source: String(publication.source),
        local: participant.isLocal,
      });
      if (participant.isLocal && publication.source === Track.Source.Microphone) {
        meetingLogger("MIC_DISABLED");
      }
      if (participant.isLocal && publication.source === Track.Source.Camera) {
        meetingLogger("CAMERA_DISABLED");
      }
    };

    const onTrackUnmuted = (
      publication: TrackPublication,
      participant: Participant,
    ) => {
      meetingLogger("TRACK_UNMUTED", {
        source: String(publication.source),
        local: participant.isLocal,
      });
      if (participant.isLocal && publication.source === Track.Source.Microphone) {
        meetingLogger("MIC_ENABLED");
      }
      if (participant.isLocal && publication.source === Track.Source.Camera) {
        meetingLogger("CAMERA_ENABLED");
      }
    };

    const onAudioPlaybackChanged = (playing: boolean) => {
      meetingLogger(
        playing ? "AUDIO_PLAYBACK_STARTED" : "AUDIO_PLAYBACK_BLOCKED",
        { canPlaybackAudio: room.canPlaybackAudio },
      );
    };

    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.TrackMuted, onTrackMuted);
    room.on(RoomEvent.TrackUnmuted, onTrackUnmuted);
    room.on(RoomEvent.AudioPlaybackStatusChanged, onAudioPlaybackChanged);

    if (!room.canPlaybackAudio) {
      meetingLogger("AUDIO_PLAYBACK_BLOCKED", {
        canPlaybackAudio: false,
      });
    }

    return () => {
      observersBoundRef.current = false;
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.off(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
      room.off(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.off(RoomEvent.TrackMuted, onTrackMuted);
      room.off(RoomEvent.TrackUnmuted, onTrackUnmuted);
      room.off(RoomEvent.AudioPlaybackStatusChanged, onAudioPlaybackChanged);
    };
  }, [room]);

  // DEV-ONLY invariant checks (no production UI).
  useEffect(() => {
    const id = window.setInterval(() => {
      const pubs = localParticipant.getTrackPublications();
      const micPubs = pubs.filter((p) => p.source === Track.Source.Microphone);
      const camPubs = pubs.filter((p) => p.source === Track.Source.Camera);
      if (micPubs.length > 1) {
        meetingLogger("INVARIANT_WARN", {
          message: "local microphone publication > 1",
          count: micPubs.length,
        });
      }
      if (camPubs.length > 1) {
        meetingLogger("INVARIANT_WARN", {
          message: "local camera publication > 1",
          count: camPubs.length,
        });
      }
      const audioRenderers = document.querySelectorAll(".lk-audio-renderer, [data-lk-audio-renderer]");
      // RoomAudioRenderer may not expose a stable class — also count audio elements in stage.
      const stageAudios = document.querySelectorAll(
        ".meeting-stage audio, .lk-room-container audio",
      );
      if (stageAudios.length > 12) {
        meetingLogger("INVARIANT_WARN", {
          message: "unusually many audio elements in meeting stage",
          count: stageAudios.length,
          audioRendererNodes: audioRenderers.length,
        });
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, [localParticipant]);

  return null;
}
