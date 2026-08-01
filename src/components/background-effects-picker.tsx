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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [customPreview, setCustomPreview] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readCustomBackgroundImage(),
  );
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  if (unsupported) {
    return (
      <p className="bg-effects-unsupported">
        Browser ini belum mendukung efek background. Gunakan Chrome atau Edge terbaru.
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
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Gambar belum dapat dipakai.",
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

  return (
    <div className={`bg-effects-picker${compact ? " is-compact" : ""}`}>
      <p className="bg-effects-label">Background</p>
      <div className="bg-effects-options" role="listbox" aria-label="Pilih background">
        <button
          type="button"
          className={value === "none" ? "is-active" : undefined}
          aria-selected={value === "none"}
          disabled={disabled || uploading}
          onClick={() => onChange("none")}
        >
          <span className="bg-effects-swatch bg-effects-swatch-none">Off</span>
          <span>None</span>
        </button>
        <button
          type="button"
          className={value === "blur" ? "is-active" : undefined}
          aria-selected={value === "blur"}
          disabled={disabled || uploading}
          onClick={() => onChange("blur")}
        >
          <span className="bg-effects-swatch bg-effects-swatch-blur">Blur</span>
          <span>Blur</span>
        </button>
        <button
          type="button"
          className={value === "blur-strong" ? "is-active" : undefined}
          aria-selected={value === "blur-strong"}
          disabled={disabled || uploading}
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
              disabled={disabled || uploading}
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
            aria-selected={value === "custom"}
            disabled={disabled || uploading}
            onClick={() => onChange("custom")}
          >
            <span
              className="bg-effects-swatch bg-effects-swatch-custom"
              style={{ backgroundImage: `url(${customPreview})` }}
              aria-hidden="true"
            />
            <span>Gambar saya</span>
          </button>
        ) : null}

        <button
          type="button"
          className="bg-effects-upload"
          disabled={disabled || uploading}
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
        disabled={disabled || uploading}
        onChange={(event) => {
          void onFileSelected(event.target.files?.[0] ?? null);
        }}
      />

      {customPreview ? (
        <button
          type="button"
          className="bg-effects-remove-custom"
          disabled={disabled || uploading}
          onClick={removeCustom}
        >
          <Trash2 size={14} /> Hapus gambar sendiri
        </button>
      ) : null}

      {uploadError ? (
        <p className="bg-effects-upload-error" role="alert">
          {uploadError}
        </p>
      ) : (
        <p className="bg-effects-hint">
          Unggah JPG/PNG/WebP maksimal 4 MB untuk background sendiri.
        </p>
      )}
    </div>
  );
}
