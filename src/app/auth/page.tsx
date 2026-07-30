import { redirect } from "next/navigation";
import { AuthExperience } from "@/components/auth-experience";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type AuthPageProps = {
  searchParams: Promise<{ next?: string }>;
};

function safeNextPath(nextPath?: string) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/dashboard";
  }

  return nextPath;
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const { next } = await searchParams;
  const destination = safeNextPath(next);
  const user = await getCurrentUser();

  if (user) {
    if (user.memberships.length === 0) {
      redirect("/dashboard/workspaces/new");
    }
    redirect(destination);
  }

  return <AuthExperience nextPath={destination} />;
}
