import { InviteExperience } from "@/components/invite-experience";
import { getCurrentSessionContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashInviteToken } from "@/lib/organization-helpers";

export const dynamic = "force-dynamic";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const context = await getCurrentSessionContext();

  const invitation = await prisma.organizationInvitation.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      organization: { select: { name: true } },
      invitedBy: { select: { name: true } },
    },
  });

  let previewError: string | null = null;
  let preview = null;

  if (!invitation) {
    previewError = "Undangan tidak ditemukan.";
  } else if (invitation.status === "PENDING" && invitation.expiresAt <= new Date()) {
    await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });
    previewError = "Undangan sudah kedaluwarsa.";
  } else if (invitation.status !== "PENDING") {
    previewError = "Undangan sudah tidak aktif.";
  } else {
    preview = {
      email: invitation.email,
      role: invitation.role,
      organizationName: invitation.organization.name,
      invitedByName: invitation.invitedBy.name,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  return (
    <InviteExperience
      token={token}
      preview={preview}
      previewError={previewError}
      isAuthenticated={Boolean(context)}
      currentEmail={context?.user.email ?? null}
    />
  );
}
