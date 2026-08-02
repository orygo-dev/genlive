import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getPlatformBranding,
  updatePlatformBranding,
} from "@/lib/platform-settings";
import { MOBILE_BANNER_RECOMMENDED } from "@/lib/platform-branding";
import { getSuperAdminContext } from "@/lib/super-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const slideSchema = z.object({
  id: z.string().trim().min(1).max(80),
  imageUrl: z.string().trim().min(1).max(1000),
  title: z.string().trim().max(80).default(""),
  body: z.string().trim().max(200).default(""),
  linkUrl: z.string().trim().max(1000).nullable().optional(),
  active: z.boolean().default(true),
});

const updateSchema = z.object({
  appName: z.string().trim().min(2).max(80).optional(),
  logoUrl: z.string().trim().max(1000).nullable().optional(),
  loginBackgroundUrl: z.string().trim().max(1000).nullable().optional(),
  splashBackgroundUrl: z.string().trim().max(1000).nullable().optional(),
  splashLogoUrl: z.string().trim().max(1000).nullable().optional(),
  mobileBannerSlides: z
    .array(slideSchema)
    .max(MOBILE_BANNER_RECOMMENDED.maxSlides)
    .optional(),
});

export async function GET() {
  const context = await getSuperAdminContext();
  if (!context) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const branding = await getPlatformBranding();
  return NextResponse.json({
    branding,
    admin: {
      id: context.user.id,
      name: context.user.name,
      email: context.user.email,
    },
  });
}

export async function PATCH(request: Request) {
  try {
    const context = await getSuperAdminContext();
    if (!context) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }

    const payload: unknown = await request.json();
    const parsed = updateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
        { status: 400 },
      );
    }

    const branding = await updatePlatformBranding({
      ...parsed.data,
      updatedById: context.user.id,
    });

    return NextResponse.json({ branding });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Format data tidak valid." },
        { status: 400 },
      );
    }
    console.error("Update platform branding failed", error);
    return NextResponse.json(
      { error: "Pengaturan brand belum dapat disimpan." },
      { status: 500 },
    );
  }
}
