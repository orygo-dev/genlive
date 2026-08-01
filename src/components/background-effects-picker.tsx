"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import {
  BACKGROUND_PRESETS,
  clearCustomBackgroundImage,
  fileToCustomBackgroundDataUrl,
  readCustomBackgroundImage,
  storeCustomBackgroundImage,
  type BackgroundEffectId,
} from "@/lib/background-effects";
import type { QualityMode, QualityTier } from "@/features/video-effects";

type BackgroundEffectsPickerProps = {
  value: BackgroundEffectId;
  onChange: (value: BackgroundEffectId) => void;
  qualityMode: QualityMode;
  onQualityChange: (value: QualityMode) => void;
  disabled?: boolean;
  unsupported?: boolean;
  compact?: boolean;
  loading?: boolean;
  error?: string;
  autoDowngraded?: boolean;
  activeQuality?: QualityTier | null;
  onDismissDowngradeWarning?: () => void;
};

const QUALITY_OPTIONS: { id: QualityMode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "low", label: "Low" },
  { id: "balanced", label: "Balanced" },
  { id: "high", label: "High" },
];

export function BackgroundEffectsPicker({
  value,
  onChange,
  qualityMode,
  onQualityChange,
  disabled = false,
  unsupported = false,
  compact = false,
  loading = false,
  error = "",
  autoDowngraded = false,
  activeQuality = null,
  onDismissDowngradeWarning,
}: BackgroundEffectsPickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [customPreview, setCustomPreview] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readCustomBackgroundImage(),
  );
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  if (unsupported) {
    return (
      <p className="bg-effects-unsupported">
        Browser ini belum mendukung efek background. Gunakan Chrome atau Edge
        terbaru.
      </p>
    );
  }

  async function onFileSelected(file: File | null) {
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const dataUrl = await fileToCustomBackgroundDataUrl(file);
      storeCustomBackgroundImage(dataUrl);
      setCustomPreview(dataUrl);
      onChange("custom");
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Gambar belum dapat dipakai.",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function removeCustom() {
    clearCustomBackgroundImage();
    setCustomPreview(null);
    setUploadError("");
    if (value === "custom") {
      onChange("none");
    }
  }

  const locked = disabled || uploading || loading;

  return (
    <div className={`bg-effects-picker${compact ? " is-compact" : ""}`}>
      <p className="bg-effects-label">Background</p>
      <div
        className="bg-effects-options"
        role="listbox"
        aria-label="Pilih background"
      >
        <button
          type="button"
          className={value === "none" ? "is-active" : undefined}
          aria-pressed={value === "none"}
          disabled={locked}
          onClick={() => onChange("none")}
        >
          <span className="bg-effects-swatch bg-effects-swatch-none">Off</span>
          <span>None</span>
        </button>
        <button
          type="button"
          className={value === "blur" ? "is-active" : undefined}
          aria-pressed={value === "blur"}
          disabled={locked}
          onClick={() => onChange("blur")}
        >
          <span className="bg-effects-swatch bg-effects-swatch-blur">Blur</span>
          <span>Blur Light</span>
        </button>
        <button
          type="button"
          className={value === "blur-strong" ? "is-active" : undefined}
          aria-pressed={value === "blur-strong"}
          disabled={locked}
          onClick={() => onChange("blur-strong")}
        >
          <span className="bg-effects-swatch bg-effects-swatch-blur-strong">
            Blur+
          </span>
          <span>Blur Strong</span>
        </button>
        {BACKGROUND_PRESETS.map((preset) => {
          const id = `preset:${preset.id}` as BackgroundEffectId;
          return (
            <button
              key={preset.id}
              type="button"
              className={value === id ? "is-active" : undefined}
              aria-pressed={value === id}
              disabled={locked}
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

        {customPreview ? (
          <button
            type="button"
            className={value === "custom" ? "is-active" : undefined}
            aria-pressed={value === "custom"}
            disabled={locked}
            onClick={() => onChange("custom")}
          >
            <span
              className="bg-effects-swatch bg-effects-swatch-custom"
              style={{ backgroundImage: `url(${customPreview})` }}
              aria-hidden="true"
            />
            <span>Background Image</span>
          </button>
        ) : null}

        <button
          type="button"
          className="bg-effects-upload"
          disabled={locked}
          onClick={() => inputRef.current?.click()}
        >
          <span className="bg-effects-swatch bg-effects-swatch-upload">
            <ImagePlus size={18} />
          </span>
          <span>{customPreview ? "Ganti gambar" : "Unggah gambar"}</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={locked}
        onChange={(event) => {
          void onFileSelected(event.target.files?.[0] ?? null);
        }}
      />

      <p className="bg-effects-label">Quality</p>
      <div
        className="bg-effects-quality"
        role="listbox"
        aria-label="Kualitas segmentasi"
      >
        {QUALITY_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={qualityMode === option.id ? "is-active" : undefined}
            aria-pressed={qualityMode === option.id}
            disabled={locked}
            onClick={() => onQualityChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="bg-effects-status" role="status">
          Memuat model background…
        </p>
      ) : null}

      {autoDowngraded ? (
        <p className="bg-effects-warning" role="status">
          Kualitas otomatis diturunkan
          {activeQuality ? ` ke ${activeQuality}` : ""} agar tetap lancar.
          {onDismissDowngradeWarning ? (
            <>
              {" "}
              <button
                type="button"
                className="bg-effects-warning-dismiss"
                onClick={onDismissDowngradeWarning}
              >
                Tutup
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      {customPreview ? (
        <button
          type="button"
          className="bg-effects-remove-custom"
          disabled={locked}
          onClick={removeCustom}
        >
          <Trash2 size={14} /> Hapus gambar sendiri
        </button>
      ) : null}

      {uploadError || error ? (
        <p className="bg-effects-upload-error" role="alert">
          {uploadError || error}
        </p>
      ) : (
        <p className="bg-effects-hint">
          Unggah JPG/PNG/WebP maks. 4 MB. Untuk tepi lebih halus: pencahayaan
          merata, background polos, dan hindari gerakan cepat.
        </p>
      )}
    </div>
  );
}
