import { HomeExperience } from "@/components/home-experience";
import { getMaintenanceMode } from "@/lib/maintenance";
import { getPlatformBranding } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ maintenance?: string }>;
}) {
  const [branding, maintenanceMode, params] = await Promise.all([
    getPlatformBranding(),
    getMaintenanceMode(),
    searchParams,
  ]);

  return (
    <HomeExperience
      branding={branding}
      maintenanceMode={maintenanceMode || params.maintenance === "1"}
    />
  );
}
