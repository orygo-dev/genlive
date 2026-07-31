import "server-only";

import { access, constants, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const MAX_BYTES = 2 * 1024 * 1024;

export type BrandAssetKind =
  | "logo"
  | "loginBackground"
  | "splashBackground"
  | "splashLogo";

/** Project root even when PM2 cwd is `.next/standalone`. */
export function resolveProjectRoot() {
  const cwd = process.cwd().replace(/\\/g, "/");
  if (cwd.endsWith(".next/standalone")) {
    return path.resolve(process.cwd(), "..", "..");
  }
  return process.cwd();
}

export function getBrandStorageDirs() {
  const root = resolveProjectRoot();
  const dirs = [path.join(root, "data", "uploads", "brand")];
  const publicDir = path.join(root, "public", "uploads", "brand");
  dirs.push(publicDir);

  const cwdPublic = path.join(process.cwd(), "public", "uploads", "brand");
  if (path.resolve(cwdPublic) !== path.resolve(publicDir)) {
    dirs.push(cwdPublic);
  }

  return [...new Set(dirs.map((dir) => path.resolve(dir)))];
}

export async function resolveBrandAssetPath(filename: string) {
  for (const dir of getBrandStorageDirs()) {
    const full = path.join(dir, filename);
    try {
      await access(full, constants.R_OK);
      const info = await stat(full);
      if (info.isFile()) return full;
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function saveBrandAsset(file: File, kind: BrandAssetKind) {
  const extension = ALLOWED_TYPES.get(file.type);
  if (!extension) {
    throw new Error(
      "Format gambar tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF (SVG tidak diizinkan).",
    );
  }

  if (file.size > MAX_BYTES) {
    throw new Error("Ukuran file maksimal 2 MB.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${kind}-${randomUUID()}.${extension}`;

  for (const dir of getBrandStorageDirs()) {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), bytes);
  }

  // Served by App Router (works under standalone; survives public sync).
  return `/api/media/brand/${filename}`;
}
