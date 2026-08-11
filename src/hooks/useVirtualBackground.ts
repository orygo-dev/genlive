"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalVideoTrack } from "livekit-client";
import {
  BackgroundProcessor,
  supportsBackgroundProcessors,
  type BackgroundProcessorWrapper,
} from "@livekit/track-processors";
import {
  getBackgroundImagePath,
  storeBackgroundEffect,
  type BackgroundEffectId,
} from "@/lib/background-effects";
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
  dispose: () => Promise<void>;
};

function blurRadiusFor(effectId: BackgroundEffectId): number {
  return effectId === "blur-strong" ? 20 : 12;
}

function isBlur(effectId: BackgroundEffectId) {
  return effectId === "blur" || effectId === "blur-strong";
}

/**
 * Official LiveKit BackgroundProcessor with switchTo() — one attach per track.
 * Custom MediaPipe pipeline is no longer used on the hot path.
 */
export function useVirtualBackground({
  effectId,
  qualityMode: _qualityMode,
  track,
  enabled = true,
}: UseVirtualBackgroundOptions): UseVirtualBackgroundResult {
  const processorRef = useRef<BackgroundProcessorWrapper | null>(null);
  const attachedTrackRef = useRef<LocalVideoTrack | null>(null);
  const operationIdRef = useRef(0);
  const operationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [supported] = useState(() => supportsBackgroundProcessors());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

    async function sync() {
      try {
        if (operationId !== operationIdRef.current) return;

        if (!enabled || !supported || !activeTrack) {
          if (processorRef.current) {
            setBusy(true);
            await detachProcessor();
          }
          if (operationId !== operationIdRef.current) return;
          if (effectId === "none") {
            storeBackgroundEffect("none");
          }
          setLoading((value) => (value ? false : value));
          setBusy((value) => (value ? false : value));
          setError((value) => (value ? "" : value));
          return;
        }

        setBusy(true);
        setLoading(true);
        setError("");

        if (attachedTrackRef.current && attachedTrackRef.current !== activeTrack) {
          await detachProcessor();
        }
        if (operationId !== operationIdRef.current) return;

        if (!processorRef.current) {
          const processor = BackgroundProcessor({ mode: "disabled" });
          try {
            await activeTrack.setProcessor(processor);
          } catch (attachError) {
            await processor.destroy().catch(() => undefined);
            throw attachError;
          }
          processorRef.current = processor;
          attachedTrackRef.current = activeTrack;
        }

        if (operationId !== operationIdRef.current) return;
        const processor = processorRef.current;
        if (!processor) return;

        if (effectId === "none") {
          await processor.switchTo({ mode: "disabled" });
          storeBackgroundEffect("none");
        } else if (isBlur(effectId)) {
          await processor.switchTo({
            mode: "background-blur",
            blurRadius: blurRadiusFor(effectId),
          });
          storeBackgroundEffect(effectId);
        } else {
          const imagePath = getBackgroundImagePath(effectId);
          if (!imagePath) {
            throw new Error("Gambar background tidak ditemukan.");
          }
          await processor.switchTo({
            mode: "virtual-background",
            imagePath,
          });
          storeBackgroundEffect(effectId);
        }
      } catch (err) {
        if (operationId === operationIdRef.current) {
          await detachProcessor().catch(() => undefined);
          setError(
            err instanceof Error
              ? err.message
              : "Virtual background tidak didukung pada browser/perangkat ini.",
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
  }, [detachProcessor, effectId, enabled, supported, track]);

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
    activeQuality: null,
    autoDowngraded: false,
    stats: null,
    busy,
    dispose,
  };
}
