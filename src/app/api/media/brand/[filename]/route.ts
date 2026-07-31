import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { resolveBrandAssetPath } from "@/lib/brand-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE_NAME = /^[a-zA-Z0-9._-]+$/;

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

type RouteContext = { params: Promise<{ filename: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { filename } = await context.params;
  if (!SAFE_NAME.test(filename)) {
    return NextResponse.json({ error: "Nama file tidak valid." }, { status: 400 });
  }

  const filePath = await resolveBrandAssetPath(filename);
  if (!filePath) {
    return NextResponse.json({ error: "Aset tidak ditemukan." }, { status: 404 });
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  const bytes = await readFile(filePath);

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
