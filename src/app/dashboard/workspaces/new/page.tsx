import { redirect } from "next/navigation";
import { NewWorkspaceForm } from "@/components/new-workspace-form";
import { getCurrentSessionContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewWorkspacePage() {
  const context = await getCurrentSessionContext();
  if (!context) {
    redirect("/auth");
  }

  if (context.activeMembership) {
    redirect("/dashboard");
  }

  return <NewWorkspaceForm userName={context.user.name} />;
}
