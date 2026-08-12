"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  CarouselLayout,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  LayoutContextProvider,
  ParticipantTile,
  RoomAudioRenderer,
  StartAudio,
  useCreateLayoutContext,
  useLayoutContext,
  usePinnedTracks,
  useSpeakingParticipants,
  useTracks,
} from "@livekit/components-react";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { Track } from "livekit-client";

export type MeetingLayoutMode = "gallery" | "focus" | "immersive";

type MeetingStageProps = {
  layoutMode: MeetingLayoutMode;
};

type StageTrack = ReturnType<typeof useTracks>[number];

function sameTrackRef(
  a: TrackReferenceOrPlaceholder | undefined,
  b: TrackReferenceOrPlaceholder | undefined,
): boolean {
  if (!a || !b) return false;
  return (
    a.participant.identity === b.participant.identity && a.source === b.source
  );
}

function pickScreenShare(tracks: StageTrack[]): StageTrack | undefined {
  return tracks.find(
    (track) =>
      track.source === Track.Source.ScreenShare &&
      track.publication &&
      !track.publication.isMuted,
  );
}

function pickCameraForIdentity(
  tracks: StageTrack[],
  identity: string,
): StageTrack | undefined {
  return tracks.find(
    (track) =>
      track.source === Track.Source.Camera &&
      track.participant?.identity === identity &&
      track.publication,
  );
}

function pickDefaultFocusTrack(
  tracks: StageTrack[],
  speakerIdentities: string[],
): StageTrack | undefined {
  const screenShare = pickScreenShare(tracks);
  if (screenShare) return screenShare;

  for (const identity of speakerIdentities) {
    const speakingCam = pickCameraForIdentity(tracks, identity);
    if (speakingCam) return speakingCam;
  }

  const remoteCamera = tracks.find(
    (track) =>
      track.source === Track.Source.Camera &&
      track.participant &&
      !track.participant.isLocal &&
      track.publication,
  );
  if (remoteCamera) return remoteCamera;

  return tracks.find((track) => track.source === Track.Source.Camera);
}

function MeetingStageInner({ layoutMode }: MeetingStageProps) {
  const { pin } = useLayoutContext();
  const lastAutoFocusedScreenShareTrack =
    useRef<TrackReferenceOrPlaceholder | null>(null);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.ScreenShareAudio, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const speakingParticipants = useSpeakingParticipants();
  const speakerIdentities = useMemo(
    () => speakingParticipants.map((participant) => participant.identity),
    [speakingParticipants],
  );

  const pinnedTrack = usePinnedTracks()[0];

  const screenShareTracks = useMemo(
    () =>
      tracks.filter(
        (track) =>
          track.source === Track.Source.ScreenShare &&
          track.publication &&
          !track.publication.isMuted,
      ),
    [tracks],
  );
  const hasScreenShare = screenShareTracks.length > 0;

  useEffect(() => {
    const subscribedShare = screenShareTracks.find(
      (track) => track.publication?.isSubscribed || track.participant.isLocal,
    );
    const pinDispatch = pin.dispatch;

    if (subscribedShare && lastAutoFocusedScreenShareTrack.current === null) {
      pinDispatch?.({
        msg: "set_pin",
        trackReference: subscribedShare,
      });
      lastAutoFocusedScreenShareTrack.current = subscribedShare;
      return;
    }

    if (
      lastAutoFocusedScreenShareTrack.current &&
      !screenShareTracks.some(
        (track) =>
          track.publication?.trackSid ===
          lastAutoFocusedScreenShareTrack.current?.publication?.trackSid,
      )
    ) {
      pinDispatch?.({ msg: "clear_pin" });
      lastAutoFocusedScreenShareTrack.current = null;
    }

    if (pinnedTrack && !pinnedTrack.publication) {
      const updated = tracks.find(
        (track) =>
          track.participant.identity === pinnedTrack.participant.identity &&
          track.source === pinnedTrack.source &&
          track.publication,
      );
      if (updated && !sameTrackRef(updated, pinnedTrack)) {
        pinDispatch?.({
          msg: "set_pin",
          trackReference: updated,
        });
      }
    }
  }, [
    pin.dispatch,
    pinnedTrack,
    screenShareTracks,
    tracks,
  ]);

  const autoFocusTrack = useMemo(
    () => pickDefaultFocusTrack(tracks, speakerIdentities),
    [speakerIdentities, tracks],
  );

  const wantsFocusShell =
    layoutMode !== "gallery" || hasScreenShare || Boolean(pinnedTrack);

  const focusTrack =
    pinnedTrack ?? (wantsFocusShell ? autoFocusTrack : undefined);

  const sideTracks = focusTrack
    ? tracks.filter((track) => !sameTrackRef(track, focusTrack))
    : tracks;

  const stageVisualMode: MeetingLayoutMode =
    layoutMode === "immersive" && wantsFocusShell
      ? "immersive"
      : wantsFocusShell
        ? "focus"
        : "gallery";

  const audioLayer = (
    <>
      <RoomAudioRenderer />
      <StartAudio
        label="Klik untuk mengaktifkan audio"
        className="meeting-start-audio"
      />
    </>
  );

  return (
    <div className={`meeting-stage meeting-stage-${stageVisualMode}`}>
      <div className="meeting-stage-main">
        {!focusTrack ? (
          <GridLayout tracks={tracks}>
            <ParticipantTile />
          </GridLayout>
        ) : (
          <FocusLayoutContainer>
            <CarouselLayout tracks={sideTracks}>
              <ParticipantTile />
            </CarouselLayout>
            <FocusLayout trackRef={focusTrack} />
          </FocusLayoutContainer>
        )}
      </div>
      {audioLayer}
    </div>
  );
}

/**
 * Owns LayoutContext so tile FocusToggle and Peserta Pin/Unpin share one pin store.
 */
export function MeetingLayoutShell({
  layoutMode,
  onPinned,
  children,
}: {
  layoutMode: MeetingLayoutMode;
  /** Called when a track is pinned (e.g. switch Galeri → Fokus). */
  onPinned?: () => void;
  children: ReactNode;
}) {
  const layoutContext = useCreateLayoutContext();

  return (
    <LayoutContextProvider
      value={layoutContext}
      onPinChange={(state) => {
        if (state.length > 0) onPinned?.();
      }}
    >
      <MeetingStageInner layoutMode={layoutMode} />
      {children}
    </LayoutContextProvider>
  );
}

/** Standalone stage (tests / fallback) — creates its own layout context. */
export function MeetingStage({ layoutMode }: MeetingStageProps) {
  return (
    <MeetingLayoutShell layoutMode={layoutMode}>{null}</MeetingLayoutShell>
  );
}
