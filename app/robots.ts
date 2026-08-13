import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login"],
        // The library requires an account, so there is nothing here for a
        // crawler to index — and crawling it would just generate redirects.
        disallow: ["/prompts", "/categories", "/search", "/saved", "/admin", "/api"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
