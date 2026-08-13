import type { MetadataRoute } from "next";

import { listCategories, listPrompts } from "@/lib/firebase/queries";
import { safeQuery } from "@/lib/firebase/safe";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [prompts, categories] = await Promise.all([
    safeQuery(() => listPrompts({ limit: 1000 }), []),
    safeQuery(() => listCategories(), []),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/prompts`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/categories`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/search`, changeFrequency: "monthly", priority: 0.3 },
  ];

  return [
    ...staticRoutes,
    ...categories.map((category) => ({
      url: `${siteUrl}/categories/${category.slug}`,
      lastModified: new Date(category.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...prompts.map((prompt) => ({
      url: `${siteUrl}/prompts/${prompt.slug}`,
      lastModified: new Date(prompt.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
