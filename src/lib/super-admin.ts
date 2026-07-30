import "server-only";

import { redirect } from "next/navigation";
import { getCurrentSessionContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getConfiguredSuperAdminEmails } from "@/lib/super-admin-emails";

export { getConfiguredSuperAdminEmails } from "@/lib/super-admin-emails";

export async function syncSuperAdminFlag(userId: string, email: string) {
  const configured = getConfiguredSuperAdminEmails();
  if (configured.length === 0) {
    return false;
  }

  const shouldBeSuperAdmin = configured.includes(email.trim().toLowerCase());
  await prisma.user.update({
    where: { id: userId },
    data: { isSuperAdmin: shouldBeSuperAdmin },
  });
  return shouldBeSuperAdmin;
}

async function loadSuperAdminUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, isSuperAdmin: true },
  });
  if (!user) return null;

  const configured = getConfiguredSuperAdminEmails();
  if (!user.isSuperAdmin && configured.includes(user.email.toLowerCase())) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isSuperAdmin: true },
    });
    return { ...user, isSuperAdmin: true };
  }

  return user;
}

export async function getSuperAdminContext() {
  const context = await getCurrentSessionContext();
  if (!context) return null;

  const user = await loadSuperAdminUser(context.user.id);
  if (!user?.isSuperAdmin) return null;

  return { ...context, user };
}

export async function requireSuperAdmin() {
  const context = await getCurrentSessionContext();
  if (!context) {
    redirect("/auth?next=/admin");
  }

  const user = await loadSuperAdminUser(context.user.id);
  if (!user) {
    redirect("/auth?next=/admin");
  }
  if (!user.isSuperAdmin) {
    redirect("/dashboard");
  }

  return { ...context, user };
}
