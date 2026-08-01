"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalVideoTrack } from "livekit-client";
import {
  getBackgroundImagePath,
  storeBackgroundEffect,
  type BackgroundEffectId,
} from "@/lib/background-effects";
import {
  supportsVideoEffects,
  VirtualBackgroundProcessor,
  type ProcessorStats,
  type QualityMode,
  type QualityTier,
} from "@/features/video-effects";
import { effectIdToMode } from "@/features/video-effects/VirtualBackgroundProcessor";

export type UseVirtualBackgroundOptions = {
  effectId: BackgroundEffectId;
  qualityMode: QualityMode;
  track: LocalVideoTrack | null;
  enabled?: boolean;
  onAutoDowngrade?: (quality: QualityTier) => void;
};

export type UseVirtualBackgroundResult = {
  supported: boolean;
  loading: boolean;
  error: string;
  activeQuality: QualityTier | null;
  autoDowngraded: boolean;
  stats: ProcessorStats | null;
  busy: boolean;
};

export function useVirtualBackground({
  effectId,
  qualityMode,
  track,
  enabled = true,
  onAutoDowngrade,
}: UseVirtualBackgroundOptions): UseVirtualBackgroundResult {
  const processorRef = useRef<VirtualBackgroundProcessor | null>(null);
  const attachedTrackRef = useRef<LocalVideoTrack | null>(null);
  const [supported] = useState(() => supportsVideoEffects());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeQuality, setActiveQuality] = useState<QualityTier | null>(null);
  const [autoDowngraded, setAutoDowngraded] = useState(false);
  const [stats, setStats] = useState<ProcessorStats | null>(null);

  const handleAutoDowngrade = useCallback(
    (quality: QualityTier) => {
      setAutoDowngraded(true);
      setActiveQuality(quality);
      onAutoDowngrade?.(quality);
    },
    [onAutoDowngrade],
  );

  const detachProcessor = useCallback(async () => {
    const currentTrack = attachedTrackRef.current;
    const processor = processorRef.current;
    attachedTrackRef.current = null;
    processorRef.current = null;
    if (currentTrack) {
      await currentTrack.stopProcessor().catch(() => undefined);
    }
    if (processor) {
      await processor.destroy().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !supported || !track) {
      return;
    }

    let cancelled = false;
    const activeTrack = track;

    async function sync() {
      setBusy(true);
      setError("");

      try {
        if (effectId === "none") {
          setLoading(false);
          await detachProcessor();
          storeBackgroundEffect("none");
          setAutoDowngraded(false);
          setActiveQuality(null);
          setStats(null);
          return;
        }

        setLoading(true);

        if (attachedTrackRef.current && attachedTrackRef.current !== activeTrack) {
          await detachProcessor();
        }

        if (!processorRef.current) {
          const processor = new VirtualBackgroundProcessor({
            onStats: (next) => {
              setStats(next);
              setActiveQuality(next.activeQuality);
              if (next.autoDowngraded) {
                setAutoDowngraded(true);
              }
            },
            onAutoDowngrade: handleAutoDowngrade,
          });
          processorRef.current = processor;
          attachedTrackRef.current = activeTrack;
          await activeTrack.setProcessor(processor);
        }

        if (cancelled) return;

        const processor = processorRef.current;
        if (!processor) return;

        const mapped = effectIdToMode(effectId);
        const imagePath =
          mapped.mode === "image" ? getBackgroundImagePath(effectId) : null;

        await processor.setEffect({
          mode: mapped.mode,
          imagePath,
          qualityMode,
        });
        storeBackgroundEffect(effectId);
        setActiveQuality(processor.getStats().activeQuality);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Efek background belum dapat diterapkan.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setBusy(false);
        }
      }
    }

    void sync();

    return () => {
      cancelled = true;
    };
  }, [
    effectId,
    qualityMode,
    track,
    enabled,
    supported,
    detachProcessor,
    handleAutoDowngrade,
  ]);

  useEffect(() => {
    return () => {
      void detachProcessor();
    };
  }, [detachProcessor]);

  return {
    supported,
    loading,
    error,
    activeQuality,
    autoDowngraded,
    stats,
    busy,
  };
}
