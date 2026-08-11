"use client";

import { useMemo } from "react";
import {
  CarouselLayout,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  StartAudio,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";

export type MeetingLayoutMode = "gallery" | "focus" | "immersive";

type MeetingStageProps = {
  layoutMode: MeetingLayoutMode;
};

type StageTrack = ReturnType<typeof useTracks>[number];

function pickFocusTrack(tracks: StageTrack[]): StageTrack | undefined {
  const screenShare = tracks.find(
    (track) =>
      track.source === Track.Source.ScreenShare &&
      track.publication &&
      !track.publication.isMuted,
  );
  if (screenShare) {
    return screenShare;
  }

  const remoteCamera = tracks.find(
    (track) =>
      track.source === Track.Source.Camera &&
      track.participant &&
      !track.participant.isLocal &&
      track.publication,
  );
  if (remoteCamera) {
    return remoteCamera;
  }

  return tracks.find((track) => track.source === Track.Source.Camera);
}

export function MeetingStage({ layoutMode }: MeetingStageProps) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.ScreenShareAudio, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const focusTrack = useMemo(() => pickFocusTrack(tracks), [tracks]);
  const hasScreenShare = Boolean(
    tracks.find(
      (track) =>
        track.source === Track.Source.ScreenShare &&
        track.publication &&
        !track.publication.isMuted,
    ),
  );
  // Gallery + screen share on a phone crops the document; prefer focus layout.
  const effectiveMode =
    layoutMode === "gallery" && hasScreenShare ? "focus" : layoutMode;
  const stageClass = `meeting-stage meeting-stage-${effectiveMode}`;

  const audioLayer = (
    <>
      <RoomAudioRenderer />
      <StartAudio
        label="Klik untuk mengaktifkan audio"
        className="meeting-start-audio"
      />
    </>
  );

  if (effectiveMode === "gallery") {
    return (
      <div className={stageClass}>
        <div className="meeting-stage-main">
          <GridLayout tracks={tracks}>
            <ParticipantTile />
          </GridLayout>
        </div>
        {audioLayer}
      </div>
    );
  }

  const sideTracks = focusTrack
    ? tracks.filter((track) => track !== focusTrack)
    : tracks;

  return (
    <div className={stageClass}>
      <div className="meeting-stage-main">
        <FocusLayoutContainer>
          <CarouselLayout tracks={sideTracks}>
            <ParticipantTile />
          </CarouselLayout>
          {focusTrack ? (
            <FocusLayout trackRef={focusTrack} />
          ) : (
            <GridLayout tracks={tracks}>
              <ParticipantTile />
            </GridLayout>
          )}
        </FocusLayoutContainer>
      </div>
      {audioLayer}
    </div>
  );
}
