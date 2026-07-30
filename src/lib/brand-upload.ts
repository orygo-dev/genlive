import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/svg+xml", "svg"],
]);

const MAX_BYTES = 2 * 1024 * 1024;

export type BrandAssetKind =
  | "logo"
  | "loginBackground"
  | "splashBackground"
  | "splashLogo";

export async function saveBrandAsset(file: File, kind: BrandAssetKind) {
  const extension = ALLOWED_TYPES.get(file.type);
  if (!extension) {
    throw new Error(
      "Format gambar tidak didukung. Gunakan JPG, PNG, WEBP, GIF, atau SVG.",
    );
  }

  if (file.size > MAX_BYTES) {
    throw new Error("Ukuran file maksimal 2 MB.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${kind}-${randomUUID()}.${extension}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "brand");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), bytes);

  return `/uploads/brand/${filename}`;
}
