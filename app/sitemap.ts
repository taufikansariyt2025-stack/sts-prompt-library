import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

export const revalidate = 3600;

/**
 * Only the two public pages.
 *
 * The library is gated, so listing prompt URLs here would advertise pages that
 * every crawler and visitor gets redirected away from — and would leak the full
 * catalogue of slugs to anyone who fetched the sitemap.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/login`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
