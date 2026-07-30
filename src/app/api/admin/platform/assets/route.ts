import { NextResponse } from "next/server";
import { saveBrandAsset, type BrandAssetKind } from "@/lib/brand-upload";
import { getSuperAdminContext } from "@/lib/super-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KIND_VALUES = new Set<BrandAssetKind>([
  "logo",
  "loginBackground",
  "splashBackground",
  "splashLogo",
]);

export async function POST(request: Request) {
  try {
    const context = await getSuperAdminContext();
    if (!context) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }

    const formData = await request.formData();
    const kindRaw = String(formData.get("kind") ?? "");
    const file = formData.get("file");

    if (!KIND_VALUES.has(kindRaw as BrandAssetKind)) {
      return NextResponse.json({ error: "Jenis aset tidak valid." }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "File gambar wajib diunggah." }, { status: 400 });
    }

    const url = await saveBrandAsset(file, kindRaw as BrandAssetKind);
    return NextResponse.json({ url, kind: kindRaw });
  } catch (error) {
    console.error("Brand asset upload failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Aset brand belum dapat diunggah.",
      },
      { status: 400 },
    );
  }
}
