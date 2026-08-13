/**
 * Static brand + taxonomy constants.
 *
 * Anything the admin can change at runtime lives in Firestore (`settings/site`)
 * instead. These are the compile-time fallbacks used before settings load, and
 * the seed values for admin pickers.
 */

export const SITE = {
  name: "STS Prompt Library",
  shortName: "STS Prompts",
  tagline: "AI prompts that actually work",
  description:
    "A curated library of AI image and video prompts — each one shown with the real output it produces. Copy-ready, free, no sign-up.",
  parentBrand: "Skills To Salary",
  parentUrl: "https://skillstosalary.com",
} as const;

/** Seed list for the admin AI-tool picker. Free text is also allowed. */
export const AI_TOOLS = [
  "Veo 3.1",
  "Veo 3",
  "Sora 2",
  "Kling 2.5",
  "Runway Gen-4",
  "Hailuo / MiniMax",
  "Seedance 2.5",
  "Grok Imagine",
  "Higgsfield",
  "Midjourney v7",
  "Nano Banana (Gemini)",
  "Flux 1.1",
] as const;

export const ASPECT_RATIOS = ["9:16", "16:9", "1:1", "4:5", "21:9", "3:2"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

/** Numeric ratio for each aspect, used to size media frames. */
export const ASPECT_VALUE: Record<AspectRatio, number> = {
  "9:16": 9 / 16,
  "16:9": 16 / 9,
  "1:1": 1,
  "4:5": 4 / 5,
  "21:9": 21 / 9,
  "3:2": 3 / 2,
};

export const PROMPT_TYPES = ["image", "video"] as const;
export type PromptType = (typeof PROMPT_TYPES)[number];

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "copies", label: "Most copied" },
  { value: "views", label: "Most viewed" },
  { value: "featured", label: "Featured" },
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

/**
 * Default taxonomy, derived from the source document (PRD §2.3).
 * Seeded once; the admin owns them from then on.
 */
export const DEFAULT_CATEGORIES = [
  {
    slug: "product-ads",
    name: "Product Ads & Commercials",
    description: "Hero product films, splash shots and macro commercial prompts.",
    icon: "package",
    accentColor: "oklch(0.62 0.19 25)",
  },
  {
    slug: "cinematic",
    name: "Cinematic Film",
    description: "Narrative, camera-led scenes with film-grade lighting and motion.",
    icon: "clapperboard",
    accentColor: "oklch(0.58 0.2 286)",
  },
  {
    slug: "ugc-vlog",
    name: "UGC & Vlog Style",
    description: "Handheld, imperfect, authentic footage that reads as real.",
    icon: "smartphone",
    accentColor: "oklch(0.64 0.16 155)",
  },
  {
    slug: "food-beverage",
    name: "Food & Beverage",
    description: "Macro food cinematography, steam, sauces and satisfying prep.",
    icon: "utensils-crossed",
    accentColor: "oklch(0.68 0.17 65)",
  },
  {
    slug: "fashion-beauty",
    name: "Fashion & Beauty",
    description: "Editorial fashion films, skincare and cosmetic product stories.",
    icon: "sparkles",
    accentColor: "oklch(0.64 0.19 340)",
  },
  {
    slug: "character-consistency",
    name: "Character & Consistency",
    description: "Prompts that lock a face, outfit or identity across every shot.",
    icon: "user-round",
    accentColor: "oklch(0.6 0.16 240)",
  },
  {
    slug: "animation",
    name: "Animation & Anime",
    description: "2D, chibi, Pixar-style and stylised animated sequences.",
    icon: "wand-sparkles",
    accentColor: "oklch(0.66 0.17 195)",
  },
  {
    slug: "vfx-hypermotion",
    name: "VFX & Hypermotion",
    description: "Time-freeze, orbital rigs, hypermotion vortexes and slow-motion physics.",
    icon: "zap",
    accentColor: "oklch(0.7 0.18 95)",
  },
  {
    slug: "storyboards",
    name: "Storyboards",
    description: "Multi-frame boards and grid layouts for pitching a full sequence.",
    icon: "layout-grid",
    accentColor: "oklch(0.6 0.13 210)",
  },
  {
    slug: "lifestyle-travel",
    name: "Lifestyle & Travel",
    description: "Golden-hour days out, city walks and seaside travel memories.",
    icon: "plane",
    accentColor: "oklch(0.66 0.15 175)",
  },
  {
    slug: "interior-architecture",
    name: "Interior & Architecture",
    description: "Room assembly animations, build timelapses and space reveals.",
    icon: "house",
    accentColor: "oklch(0.58 0.1 265)",
  },
] as const;
