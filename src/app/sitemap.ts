import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const lastModified = new Date();

  return [
    {
      url: `${appUrl}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${appUrl}/auth`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
