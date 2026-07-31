import type { MetadataRoute } from "next";
import { getPlatformBranding } from "@/lib/platform-settings";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const branding = await getPlatformBranding();

  return {
    name: `${branding.appName} — Meeting video`,
    short_name: branding.appName.slice(0, 12),
    description:
      "Platform meeting video: workspace, undangan, recording, dan billing.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f1419",
    theme_color: "#1f6feb",
    lang: "id",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
