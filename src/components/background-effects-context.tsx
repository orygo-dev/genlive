"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  readStoredBackgroundEffect,
  type BackgroundEffectId,
} from "@/lib/background-effects";

type BackgroundEffectsContextValue = {
  effectId: BackgroundEffectId;
  setEffectId: (value: BackgroundEffectId) => void;
};

const BackgroundEffectsContext = createContext<BackgroundEffectsContextValue | null>(
  null,
);

export function BackgroundEffectsProvider({ children }: { children: ReactNode }) {
  const [effectId, setEffectId] = useState<BackgroundEffectId>(() =>
    typeof window === "undefined" ? "none" : readStoredBackgroundEffect(),
  );

  const value = useMemo(
    () => ({
      effectId,
      setEffectId,
    }),
    [effectId],
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
    throw new Error("useBackgroundEffects must be used within BackgroundEffectsProvider");
  }
  return context;
}
