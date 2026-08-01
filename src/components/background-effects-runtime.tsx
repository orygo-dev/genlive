"use client";

import { useEffect, useState } from "react";
import { Track, type LocalVideoTrack } from "livekit-client";
import { useLocalParticipant } from "@livekit/components-react";
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
  const { localParticipant } = useLocalParticipant();
  const [open, setOpen] = useState(false);
  const [track, setTrack] = useState<LocalVideoTrack | null>(null);
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

  const vb = useVirtualBackground({
    effectId,
    qualityMode,
    track,
    onAutoDowngrade: () => noteAutoDowngrade(),
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const room = document.querySelector(".live-room");
    if (!(room instanceof HTMLElement)) return;
    room.dataset.bgEffect =
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
            disabled={vb.busy}
            unsupported={!vb.supported}
            loading={vb.loading}
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
