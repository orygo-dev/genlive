"use client";

import { BACKGROUND_PRESETS, type BackgroundEffectId } from "@/lib/background-effects";

type BackgroundEffectsPickerProps = {
  value: BackgroundEffectId;
  onChange: (value: BackgroundEffectId) => void;
  disabled?: boolean;
  unsupported?: boolean;
  compact?: boolean;
};

export function BackgroundEffectsPicker({
  value,
  onChange,
  disabled = false,
  unsupported = false,
  compact = false,
}: BackgroundEffectsPickerProps) {
  if (unsupported) {
    return (
      <p className="bg-effects-unsupported">
        Browser ini belum mendukung efek background. Gunakan Chrome atau Edge terbaru.
      </p>
    );
  }

  return (
    <div className={`bg-effects-picker${compact ? " is-compact" : ""}`}>
      <p className="bg-effects-label">Background</p>
      <div className="bg-effects-options" role="listbox" aria-label="Pilih background">
        <button
          type="button"
          className={value === "none" ? "is-active" : undefined}
          aria-selected={value === "none"}
          disabled={disabled}
          onClick={() => onChange("none")}
        >
          <span className="bg-effects-swatch bg-effects-swatch-none">Off</span>
          <span>None</span>
        </button>
        <button
          type="button"
          className={value === "blur" ? "is-active" : undefined}
          aria-selected={value === "blur"}
          disabled={disabled}
          onClick={() => onChange("blur")}
        >
          <span className="bg-effects-swatch bg-effects-swatch-blur">Blur</span>
          <span>Blur</span>
        </button>
        <button
          type="button"
          className={value === "blur-strong" ? "is-active" : undefined}
          aria-selected={value === "blur-strong"}
          disabled={disabled}
          onClick={() => onChange("blur-strong")}
        >
          <span className="bg-effects-swatch bg-effects-swatch-blur-strong">Blur+</span>
          <span>Blur kuat</span>
        </button>
        {BACKGROUND_PRESETS.map((preset) => {
          const id = `preset:${preset.id}` as BackgroundEffectId;
          return (
            <button
              key={preset.id}
              type="button"
              className={value === id ? "is-active" : undefined}
              aria-selected={value === id}
              disabled={disabled}
              onClick={() => onChange(id)}
            >
              <span
                className="bg-effects-swatch"
                style={{ background: preset.swatch }}
                aria-hidden="true"
              />
              <span>{preset.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
