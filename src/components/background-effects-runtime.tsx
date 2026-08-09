"use client";

import { useEffect, useState } from "react";
import {
  ConnectionState,
  Track,
  type LocalVideoTrack,
} from "livekit-client";
import {
  useConnectionState,
  useLocalParticipant,
} from "@livekit/components-react";
import { ImageIcon, X } from "lucide-react";
import { BackgroundEffectsPicker } from "@/components/background-effects-picker";
import { useBackgroundEffects } from "@/components/background-effects-context";
import { useVirtualBackground } from "@/hooks/useVirtualBackground";
import type { BackgroundEffectId } from "@/lib/background-effects";

type BackgroundEffectsRuntimeProps = {
  effectId: BackgroundEffectId;
  onEffectChange: (value: BackgroundEffectId) => void;
};

export function BackgroundEffectsRuntime({
  effectId,
  onEffectChange,
}: BackgroundEffectsRuntimeProps) {
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const [open, setOpen] = useState(false);
  const [track, setTrack] = useState<LocalVideoTrack | null>(null);
  const [effectsReady, setEffectsReady] = useState(false);
  const {
    qualityMode,
    setQualityMode,
    autoDowngradeWarning,
    clearAutoDowngradeWarning,
    noteAutoDowngrade,
  } = useBackgroundEffects();

  useEffect(() => {
    function refreshTrack() {
      const publication = localParticipant.getTrackPublication(
        Track.Source.Camera,
      );
      const next = (publication?.track as LocalVideoTrack | undefined) ?? null;
      setTrack(next);
    }

    refreshTrack();
    localParticipant.on("localTrackPublished", refreshTrack);
    localParticipant.on("localTrackUnpublished", refreshTrack);

    return () => {
      localParticipant.off("localTrackPublished", refreshTrack);
      localParticipant.off("localTrackUnpublished", refreshTrack);
    };
  }, [localParticipant]);

  // Let LiveKit finish connect + camera publish before MediaPipe attaches,
  // otherwise join freezes the main thread (WASM reload + device contention).
  useEffect(() => {
    if (!track || connectionState !== ConnectionState.Connected) {
      setEffectsReady(false);
      return;
    }
    const timer = window.setTimeout(() => setEffectsReady(true), 400);
    return () => window.clearTimeout(timer);
  }, [track, connectionState]);

  const vb = useVirtualBackground({
    effectId,
    qualityMode,
    track: effectsReady ? track : null,
    enabled: effectsReady,
    onAutoDowngrade: () => noteAutoDowngrade(),
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const roomEl = document.querySelector(".live-room");
    if (!(roomEl instanceof HTMLElement)) return;
    roomEl.dataset.bgEffect =
      effectId === "none"
        ? "off"
        : effectId.startsWith("blur")
          ? "blur"
          : "virtual";
  }, [effectId]);

  return (
    <div className="bg-effects-runtime">
      <button
        type="button"
        className="bg-effects-runtime-toggle"
        aria-expanded={open}
        aria-controls="bg-effects-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <ImageIcon size={16} />
        Background
      </button>
      {open ? (
        <div id="bg-effects-panel" className="bg-effects-runtime-panel">
          <div className="bg-effects-runtime-panel-head">
            <strong>Virtual background</strong>
            <button
              type="button"
              aria-label="Tutup"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <BackgroundEffectsPicker
            value={effectId}
            onChange={onEffectChange}
            qualityMode={qualityMode}
            onQualityChange={setQualityMode}
            unsupported={!vb.supported}
            loading={vb.loading || (Boolean(track) && !effectsReady)}
            error={vb.error}
            autoDowngraded={autoDowngradeWarning || vb.autoDowngraded}
            activeQuality={vb.activeQuality}
            onDismissDowngradeWarning={clearAutoDowngradeWarning}
            compact
          />
        </div>
      ) : null}
    </div>
  );
}

export function BackgroundEffectsSettings({
  effectId,
  onEffectChange,
}: BackgroundEffectsRuntimeProps) {
  const {
    qualityMode,
    setQualityMode,
    autoDowngradeWarning,
    clearAutoDowngradeWarning,
  } = useBackgroundEffects();

  return (
    <div className="bg-effects-settings lk-settings-menu-modal">
      <h3>Background effects</h3>
      <BackgroundEffectsPicker
        value={effectId}
        onChange={onEffectChange}
        qualityMode={qualityMode}
        onQualityChange={setQualityMode}
        autoDowngraded={autoDowngradeWarning}
        onDismissDowngradeWarning={clearAutoDowngradeWarning}
      />
    </div>
  );
}
