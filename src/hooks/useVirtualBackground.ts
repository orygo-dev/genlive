"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalVideoTrack } from "livekit-client";
import {
  getBackgroundImagePath,
  storeBackgroundEffect,
  type BackgroundEffectId,
} from "@/lib/background-effects";
import { supportsVideoEffects } from "@/features/video-effects/deviceCapability";
import type {
  ProcessorStats,
  QualityMode,
  QualityTier,
} from "@/features/video-effects/types";

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
  /** Flush queued work and detach/destroy the processor. Safe to call before join. */
  dispose: () => Promise<void>;
};

type ProcessorModule = typeof import("@/features/video-effects/VirtualBackgroundProcessor");

export function useVirtualBackground({
  effectId,
  qualityMode,
  track,
  enabled = true,
  onAutoDowngrade,
}: UseVirtualBackgroundOptions): UseVirtualBackgroundResult {
  const processorRef = useRef<InstanceType<
    ProcessorModule["VirtualBackgroundProcessor"]
  > | null>(null);
  const attachedTrackRef = useRef<LocalVideoTrack | null>(null);
  const operationIdRef = useRef(0);
  const operationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const onAutoDowngradeRef = useRef(onAutoDowngrade);
  onAutoDowngradeRef.current = onAutoDowngrade;
  const [supported] = useState(() => supportsVideoEffects());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeQuality, setActiveQuality] = useState<QualityTier | null>(null);
  const [autoDowngraded, setAutoDowngraded] = useState(false);
  const [stats, setStats] = useState<ProcessorStats | null>(null);

  // Stable forever — parent often passes an inline callback; never put that in
  // effect deps or we infinite-loop setState → render → new callback → effect.
  const handleAutoDowngrade = useCallback((quality: QualityTier) => {
    setAutoDowngraded(true);
    setActiveQuality(quality);
    onAutoDowngradeRef.current?.(quality);
  }, []);

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

  const dispose = useCallback(async () => {
    operationIdRef.current += 1;
    setLoading(false);
    setBusy(false);
    const next = operationQueueRef.current.then(detachProcessor, detachProcessor);
    operationQueueRef.current = next;
    await next;
  }, [detachProcessor]);

  useEffect(() => {
    const operationId = ++operationIdRef.current;
    const activeTrack = track;
    const wantsEffect = Boolean(
      enabled && supported && activeTrack && effectId !== "none",
    );

    async function sync() {
      try {
        if (operationId !== operationIdRef.current) return;

        if (!wantsEffect) {
          const hadProcessor = Boolean(processorRef.current);
          if (hadProcessor) {
            setBusy(true);
            await detachProcessor();
          }
          if (operationId !== operationIdRef.current) return;
          if (effectId === "none") {
            storeBackgroundEffect("none");
          }
          // Avoid setState spam when already idle — that re-rendered forever
          // when an unstable callback was in the effect dependency list.
          setLoading((value) => (value ? false : value));
          setBusy((value) => (value ? false : value));
          setError((value) => (value ? "" : value));
          setAutoDowngraded((value) => (value ? false : value));
          setActiveQuality((value) => (value != null ? null : value));
          setStats((value) => (value != null ? null : value));
          return;
        }

        setBusy(true);
        setLoading(true);
        setError("");

        // Lazy-load MediaPipe only when an effect is actually selected.
        const mod = await import(
          "@/features/video-effects/VirtualBackgroundProcessor"
        );
        if (operationId !== operationIdRef.current) return;

        if (attachedTrackRef.current && attachedTrackRef.current !== activeTrack) {
          await detachProcessor();
        }

        if (operationId !== operationIdRef.current) return;

        if (!processorRef.current) {
          let lastStatsAt = 0;
          const processor = new mod.VirtualBackgroundProcessor({
            onStats: (next) => {
              // Do not setState every frame — that freezes Firefox with MediaPipe.
              const now = performance.now();
              if (now - lastStatsAt < 2000 && !next.autoDowngraded) return;
              lastStatsAt = now;
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
          try {
            await activeTrack!.setProcessor(processor);
          } catch (error) {
            if (processorRef.current === processor) {
              processorRef.current = null;
              attachedTrackRef.current = null;
            }
            await processor.destroy().catch(() => undefined);
            throw error;
          }
        }

        if (operationId !== operationIdRef.current) return;

        const processor = processorRef.current;
        if (!processor) return;

        const mapped = mod.effectIdToMode(effectId);
        const imagePath =
          mapped.mode === "image" ? getBackgroundImagePath(effectId) : null;

        await processor.setEffect({
          mode: mapped.mode,
          imagePath,
          qualityMode,
        });
        if (operationId !== operationIdRef.current) return;
        storeBackgroundEffect(effectId);
        setActiveQuality(processor.getStats().activeQuality);
      } catch (err) {
        if (operationId === operationIdRef.current) {
          setError(
            err instanceof Error
              ? err.message
              : "Efek background belum dapat diterapkan.",
          );
        }
      } finally {
        if (operationId === operationIdRef.current) {
          setLoading(false);
          setBusy(false);
        }
      }
    }

    operationQueueRef.current = operationQueueRef.current.then(sync, sync);
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
      operationIdRef.current += 1;
      operationQueueRef.current = operationQueueRef.current.then(
        detachProcessor,
        detachProcessor,
      );
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
    dispose,
  };
}
