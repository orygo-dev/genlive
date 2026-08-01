"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  readStoredBackgroundEffect,
  storeBackgroundEffect,
  type BackgroundEffectId,
} from "@/lib/background-effects";
import type { QualityMode } from "@/features/video-effects";

const QUALITY_STORAGE_KEY = "genmeet_bg_quality";

function readStoredQuality(): QualityMode {
  if (typeof window === "undefined") return "auto";
  try {
    const raw = window.sessionStorage.getItem(QUALITY_STORAGE_KEY);
    if (
      raw === "auto" ||
      raw === "low" ||
      raw === "balanced" ||
      raw === "high"
    ) {
      return raw;
    }
  } catch {
    // ignore
  }
  return "auto";
}

function storeQuality(mode: QualityMode) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(QUALITY_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

type BackgroundEffectsContextValue = {
  effectId: BackgroundEffectId;
  setEffectId: (value: BackgroundEffectId) => void;
  qualityMode: QualityMode;
  setQualityMode: (value: QualityMode) => void;
  autoDowngradeWarning: boolean;
  clearAutoDowngradeWarning: () => void;
  noteAutoDowngrade: () => void;
};

const BackgroundEffectsContext =
  createContext<BackgroundEffectsContextValue | null>(null);

export function BackgroundEffectsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [effectId, setEffectIdState] = useState<BackgroundEffectId>(() =>
    typeof window === "undefined" ? "none" : readStoredBackgroundEffect(),
  );
  const [qualityMode, setQualityModeState] = useState<QualityMode>(() =>
    typeof window === "undefined" ? "auto" : readStoredQuality(),
  );
  const [autoDowngradeWarning, setAutoDowngradeWarning] = useState(false);

  const setEffectId = useCallback((value: BackgroundEffectId) => {
    setEffectIdState(value);
    storeBackgroundEffect(value);
  }, []);

  const setQualityMode = useCallback((value: QualityMode) => {
    setQualityModeState(value);
    storeQuality(value);
    if (value !== "auto") {
      setAutoDowngradeWarning(false);
    }
  }, []);

  const clearAutoDowngradeWarning = useCallback(() => {
    setAutoDowngradeWarning(false);
  }, []);

  const noteAutoDowngrade = useCallback(() => {
    setAutoDowngradeWarning(true);
  }, []);

  const value = useMemo(
    () => ({
      effectId,
      setEffectId,
      qualityMode,
      setQualityMode,
      autoDowngradeWarning,
      clearAutoDowngradeWarning,
      noteAutoDowngrade,
    }),
    [
      effectId,
      setEffectId,
      qualityMode,
      setQualityMode,
      autoDowngradeWarning,
      clearAutoDowngradeWarning,
      noteAutoDowngrade,
    ],
  );

  return (
    <BackgroundEffectsContext.Provider value={value}>
      {children}
    </BackgroundEffectsContext.Provider>
  );
}

export function useBackgroundEffects() {
  const context = useContext(BackgroundEffectsContext);
  if (!context) {
    throw new Error(
      "useBackgroundEffects must be used within BackgroundEffectsProvider",
    );
  }
  return context;
}
