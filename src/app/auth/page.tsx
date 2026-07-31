import { redirect } from "next/navigation";
import { AuthExperience } from "@/components/auth-experience";
import { getCurrentUser } from "@/lib/auth";
import { getPlatformBranding } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

type AuthPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

function safeNextPath(nextPath?: string) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/dashboard";
  }

  return nextPath;
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const { next, error: oauthError } = await searchParams;
  const destination = safeNextPath(next);
  const user = await getCurrentUser();
  const branding = await getPlatformBranding();

  if (user) {
    if (user.isSuperAdmin && (destination.startsWith("/admin") || user.memberships.length === 0)) {
      redirect(destination.startsWith("/admin") ? destination : "/admin");
    }
    if (user.memberships.length === 0) {
      redirect("/dashboard/workspaces/new");
    }
    redirect(destination);
  }

  return (
    <AuthExperience
      nextPath={destination}
      branding={branding}
      oauthError={oauthError}
    />
  );
}
