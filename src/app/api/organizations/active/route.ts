import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionContext, setActiveOrganization } from "@/lib/auth";
import { getMembership } from "@/lib/organization";

export const runtime = "nodejs";

const switchSchema = z.object({
  organizationId: z.uuid(),
});

export async function POST(request: Request) {
  try {
    const context = await getCurrentSessionContext();
    if (!context) {
      return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    const payload: unknown = await request.json();
    const result = switchSchema.safeParse(payload);
    if (!result.success) {
      return NextResponse.json({ error: "Organisasi tidak valid." }, { status: 400 });
    }

    const membership = getMembership(context.user, result.data.organizationId);
    if (!membership) {
      return NextResponse.json(
        { error: "Anda tidak tergabung dalam organisasi tersebut." },
        { status: 403 },
      );
    }

    await setActiveOrganization(context.sessionId, membership.organization.id);

    return NextResponse.json({
      organization: membership.organization,
      role: membership.role,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400 });
    }

    console.error("Switch organization failed", error);
    return NextResponse.json(
      { error: "Workspace belum dapat diganti." },
      { status: 500 },
    );
  }
}
