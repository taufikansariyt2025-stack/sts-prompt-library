import { z } from "zod";

import { SITE } from "@/lib/constants/site";
import { previewMediaSchema } from "@/lib/schemas/media";

/**
 * `settings/site` — a singleton document holding everything the admin can
 * rebrand without a deploy.
 */

export const siteSettingsSchema = z.strictObject({
  siteName: z.string().trim().min(2).max(60).default(SITE.name),
  tagline: z.string().trim().max(120).default(SITE.tagline),
  description: z.string().trim().max(300).default(SITE.description),

  branding: z
    .strictObject({
      /** Shown ON light backgrounds — dark ink. */
      logoLight: previewMediaSchema.optional(),
      /** Shown ON dark backgrounds — light ink. */
      logoDark: previewMediaSchema.optional(),
      /** Square mark; also the source for the PWA icon set. */
      logoMark: previewMediaSchema.optional(),
      favicon: previewMediaSchema.optional(),
      ogImage: previewMediaSchema.optional(),
      /** Overrides --accent at runtime. OKLCH keeps derived shades coherent. */
      accentColor: z.string().trim().max(60).default("oklch(0.548 0.216 286)"),
    })
    .default({ accentColor: "oklch(0.548 0.216 286)" }),

  seo: z
    .strictObject({
      titleTemplate: z.string().max(80).default(`%s · ${SITE.name}`),
      defaultOgImageUrl: z.url().optional(),
      twitterHandle: z.string().max(40).optional(),
      canonicalHost: z.string().max(120).default(""),
    })
    .default({ titleTemplate: `%s · ${SITE.name}`, canonicalHost: "" }),

  ui: z
    .strictObject({
      defaultTheme: z.enum(["system", "light", "dark"]).default("system"),
      showAnnouncement: z.boolean().default(false),
      announcementText: z.string().max(160).optional(),
      announcementHref: z.url().optional(),
      homeHeroHeadline: z.string().max(120).default("AI prompts that actually work."),
      homeHeroSubline: z
        .string()
        .max(220)
        .default(
          "Copy-ready image and video prompts, each one shown with its real output.",
        ),
    })
    .default({
      defaultTheme: "system",
      showAnnouncement: false,
      homeHeroHeadline: "AI prompts that actually work.",
      homeHeroSubline:
        "Copy-ready image and video prompts, each one shown with its real output.",
    }),

  social: z
    .strictObject({
      website: z.url().optional(),
      instagram: z.url().optional(),
      youtube: z.url().optional(),
      x: z.url().optional(),
      linkedin: z.url().optional(),
      facebook: z.url().optional(),
      whatsapp: z.url().optional(),
      email: z.email().optional(),
    })
    .default({}),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;
export const siteSettingsUpdateSchema = siteSettingsSchema.partial();

/** Used before settings load, and as the seed document. */
export const DEFAULT_SETTINGS: SiteSettings = siteSettingsSchema.parse({
  social: { website: SITE.parentUrl },
});
