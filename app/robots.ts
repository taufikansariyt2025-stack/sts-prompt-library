import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /saved is per-device and has nothing to index.
        disallow: ["/admin", "/api", "/saved"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
