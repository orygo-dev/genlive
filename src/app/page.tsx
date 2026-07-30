import { HomeExperience } from "@/components/home-experience";
import { getPlatformBranding } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const branding = await getPlatformBranding();
  return <HomeExperience branding={branding} />;
}
