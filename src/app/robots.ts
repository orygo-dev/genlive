import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/auth"],
        disallow: ["/dashboard/", "/api/", "/invite/", "/meeting/"],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
