"use client";

import { useEffect, useRef, useState } from "react";
import { Track, type LocalVideoTrack } from "livekit-client";
import { useLocalParticipant } from "@livekit/components-react";
import {
  supportsBackgroundProcessors,
  type BackgroundProcessorWrapper,
} from "@livekit/track-processors";
import { ImageIcon, X } from "lucide-react";
import { BackgroundEffectsPicker } from "@/components/background-effects-picker";
import {
  storeBackgroundEffect,
  type BackgroundEffectId,
} from "@/lib/background-effects";
import {
  applyBackgroundEffect,
  createDisabledBackgroundProcessor,
} from "@/lib/background-processor";

type BackgroundEffectsRuntimeProps = {
  effectId: BackgroundEffectId;
  onEffectChange: (value: BackgroundEffectId) => void;
};

export function BackgroundEffectsRuntime({
  effectId,
  onEffectChange,
}: BackgroundEffectsRuntimeProps) {
  const { localParticipant } = useLocalParticipant();
  const processorRef = useRef<BackgroundProcessorWrapper | null>(null);
  const trackRef = useRef<LocalVideoTrack | null>(null);
  const [supported] = useState(() => supportsBackgroundProcessors());
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) {
      return;
    }

    let cancelled = false;

    async function ensureProcessor() {
      const publication = localParticipant.getTrackPublication(Track.Source.Camera);
      const track = publication?.track as LocalVideoTrack | undefined;
      if (!track) {
        return;
      }

      if (trackRef.current !== track) {
        trackRef.current = track;
        const processor = createDisabledBackgroundProcessor();
        processorRef.current = processor;
        await track.setProcessor(processor);
      }

      if (!processorRef.current || cancelled) {
        return;
      }

      setBusy(true);
      try {
        await applyBackgroundEffect(processorRef.current, effectId, track);
        storeBackgroundEffect(effectId);
        if (typeof document !== "undefined") {
          const room = document.querySelector(".live-room");
          if (room instanceof HTMLElement) {
            room.dataset.bgEffect =
              effectId === "none"
                ? "off"
                : effectId.startsWith("blur")
                  ? "blur"
                  : "virtual";
          }
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    }

    void ensureProcessor();

    const onLocalTrackPublished = () => {
      void ensureProcessor();
    };
    localParticipant.on("localTrackPublished", onLocalTrackPublished);

    return () => {
      cancelled = true;
      localParticipant.off("localTrackPublished", onLocalTrackPublished);
    };
  }, [effectId, localParticipant, supported]);

  useEffect(() => {
    return () => {
      const track = trackRef.current;
      if (track) {
        void track.stopProcessor().catch(() => undefined);
      }
      processorRef.current = null;
      trackRef.current = null;
    };
  }, []);

  if (!supported) {
    return null;
  }

  return (
    <div className="bg-effects-runtime">
      <button
        type="button"
        className="bg-effects-runtime-toggle"
        aria-expanded={open}
        aria-controls="bg-effects-panel"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={16} /> : <ImageIcon size={16} />}
        Background
      </button>

      {open ? (
        <div id="bg-effects-panel" className="bg-effects-runtime-panel">
          <BackgroundEffectsPicker
            value={effectId}
            onChange={onEffectChange}
            disabled={busy}
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
  const supported = supportsBackgroundProcessors();

  return (
    <div className="bg-effects-settings lk-settings-menu-modal">
      <h3>Efek video</h3>
      <BackgroundEffectsPicker
        value={effectId}
        onChange={onEffectChange}
        unsupported={!supported}
      />
    </div>
  );
}
