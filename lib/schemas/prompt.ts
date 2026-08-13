import { z } from "zod";

import { ASPECT_RATIOS, PROMPT_TYPES } from "@/lib/constants/site";
import { previewMediaSchema } from "@/lib/schemas/media";

/**
 * The prompt document.
 *
 * Shared verbatim between the admin editor (inline validation) and the route
 * handlers (enforcement), so the two can never drift. See CLAUDE.md rule #4.
 */

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Optional credit for where a prompt came from. */
export const attributionSchema = z.strictObject({
  /** Display name, e.g. "actionables.ai" */
  source: z.string().max(120).nullish(),
  /** Social handle including the @, e.g. "@actionables.ai" */
  handle: z.string().max(80).nullish(),
  /** Empty string is allowed so clearing the field doesn't fail URL parsing. */
  url: z.union([z.url(), z.literal("")]).nullish(),
});

export type Attribution = z.infer<typeof attributionSchema>;

export const promptStatusSchema = z.enum(["draft", "published"]);
export type PromptStatus = z.infer<typeof promptStatusSchema>;

/** Fields the admin actually edits. Server-owned fields are added on write. */
export const promptInputSchema = z.strictObject({
  title: z.string().trim().min(3, "Title is too short").max(90),
  slug: z.string().regex(SLUG, "Lowercase letters, numbers and hyphens only").max(70),
  description: z.string().trim().max(280).default(""),

  /**
   * Newlines are meaningful — the source prompts carry timestamps, shot lists
   * and section headers. Never trim internal whitespace. See CLAUDE.md.
   */
  promptText: z.string().min(1, "Prompt text is required").max(20000),
  negativePrompt: z.string().max(2000).default(""),
  usageNotes: z.string().max(1000).default(""),

  type: z.enum(PROMPT_TYPES),
  categoryId: z.string().min(1, "Pick a category"),
  categorySlug: z.string().regex(SLUG),
  tags: z.array(z.string().regex(SLUG).max(40)).max(8).default([]),

  /*
   * Generation metadata is entirely optional — the source document carries none
   * of it, so requiring it would block editing every imported prompt.
   *
   * `.nullish()` rather than `.optional()` throughout: Firestore stores absent
   * values as `null`, and Zod's `.optional()` accepts only `undefined`. Using
   * `.optional()` here made saved documents fail validation on reload, with the
   * error landing on fields that have no visible input to highlight.
   */
  aiTool: z.string().trim().max(60).nullish(),
  model: z.string().trim().max(60).nullish(),
  aspectRatio: z.enum(ASPECT_RATIOS).nullish(),
  durationSeconds: z.number().int().positive().max(600).nullish(),

  requiresReferenceImage: z.boolean().default(false),
  hasPlaceholders: z.boolean().default(false),

  /* Preview media is strongly encouraged but not required — a prompt can be
     published while its media is still being produced. The card falls back to
     its compact layout. */
  preview: previewMediaSchema.nullish(),
  gallery: z.array(previewMediaSchema).max(6).default([]),

  attribution: attributionSchema.nullish(),

  status: promptStatusSchema.default("draft"),
  featured: z.boolean().default(false),
  featuredOrder: z.number().int().nonnegative().optional(),

  seo: z
    .strictObject({
      title: z.string().max(70).nullish(),
      description: z.string().max(180).nullish(),
      ogImageUrl: z.url().nullish(),
    })
    .nullish(),
});

export type PromptInput = z.infer<typeof promptInputSchema>;

/** Create accepts the input as-is; the server owns ids, timestamps and stats. */
export const promptCreateSchema = promptInputSchema;

/** Update is a partial — the editor autosaves one section at a time. */
export const promptUpdateSchema = promptInputSchema.partial();
export type PromptUpdate = z.infer<typeof promptUpdateSchema>;

export const promptStatsSchema = z.strictObject({
  views: z.number().int().nonnegative().default(0),
  copies: z.number().int().nonnegative().default(0),
  saves: z.number().int().nonnegative().default(0),
});

/** The full stored document, as read back from Firestore. */
export type Prompt = PromptInput & {
  id: string;
  searchTokens: string[];
  stats: z.infer<typeof promptStatsSchema>;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

/** Every key the editor is allowed to send. Derived from the schema itself. */
export const PROMPT_INPUT_KEYS = Object.keys(
  promptInputSchema.shape,
) as (keyof PromptInput)[];

/**
 * Projects a stored Firestore document down to editable input.
 *
 * Picks only schema keys rather than spreading the document — a stored doc also
 * carries server-owned fields (`stats`, `searchTokens`, `sourceNumber`, …) and
 * `promptInputSchema` is strict, so spreading would fail validation on a key
 * the admin can't even see. Picking makes that impossible by construction.
 *
 * Also maps Firestore's `null` to `undefined`, which is what form controls expect.
 */
export function toPromptInput(doc: Record<string, unknown>): Partial<PromptInput> {
  const input: Record<string, unknown> = {};

  for (const key of PROMPT_INPUT_KEYS) {
    const value = doc[key];
    if (value !== null && value !== undefined) input[key] = value;
  }

  // Nested optional strings can be null too.
  const attribution = doc.attribution as Record<string, unknown> | null | undefined;
  if (attribution) {
    input.attribution = {
      source: attribution.source ?? undefined,
      handle: attribution.handle ?? undefined,
      url: attribution.url ?? undefined,
    };
  }

  return input as Partial<PromptInput>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detects `[Product Name]`, `{product type}`, `@Image1`, `[@0]` style tokens.
 * Drives the "Template" badge so users know values must be substituted.
 */
export function detectPlaceholders(text: string): string[] {
  const patterns = [/\[[^\]\n]{2,60}\]/g, /\{[^}\n]{2,60}\}/g, /@Image\d+/gi, /@\d+/g];
  const found = new Set<string>();

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const token = match[0];
      // Shot labels and timestamps look like placeholders but aren't.
      if (/^\[\d|^\[(?:medium|wide|close|extreme|slow|low|high|dynamic|tracking)/i.test(token))
        continue;
      found.add(token);
    }
  }
  return [...found].slice(0, 20);
}

/** Lowercased keyword tokens, capped so the document stays small. */
export function buildSearchTokens(input: {
  title: string;
  description: string;
  tags: string[];
  aiTool: string;
  categorySlug: string;
}): string[] {
  const raw = [
    input.title,
    input.description,
    input.aiTool,
    input.categorySlug,
    ...input.tags,
  ].join(" ");

  const tokens = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 1);

  return [...new Set(tokens)].slice(0, 120);
}
