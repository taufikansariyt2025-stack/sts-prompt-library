import { describe, expect, it } from "vitest";

import {
  PROMPT_INPUT_KEYS,
  promptInputSchema,
  toPromptInput,
} from "@/lib/schemas/prompt";

/**
 * Regression tests for the editor's load → publish round trip.
 *
 * Two bugs shipped here and both were invisible in the UI:
 *   1. Firestore stores absent optional values as `null`, which Zod's
 *      `.optional()` rejects.
 *   2. Stored documents carry server-owned fields (`stats`, `sourceNumber`, …)
 *      which a strict schema rejects as unrecognised keys.
 *
 * Both surfaced as "fix the highlighted fields" on fields that have no visible
 * input. These tests assert the real projection the editor uses.
 */

/** Mirrors exactly what `pnpm seed` writes, including the awkward parts. */
function storedDocument(overrides: Record<string, unknown> = {}) {
  return {
    title: "Photorealistic cinematic daytime amusement park roller coaster",
    slug: "photorealistic-cinematic-daytime-amusement-park-roller-coast",
    description: "",
    promptText: "Photorealistic cinematic daytime amusement park roller coaster…",
    negativePrompt: "",
    usageNotes: "",
    type: "video",
    categoryId: "abc123def456",
    categorySlug: "product-ads",
    tags: [],
    requiresReferenceImage: false,
    hasPlaceholders: false,
    gallery: [],
    status: "published",
    featured: false,

    // Absent optionals, as Firestore returns them.
    aiTool: null,
    model: null,
    aspectRatio: null,
    durationSeconds: null,
    preview: null,
    attribution: null,

    // Server-owned fields the admin never edits.
    searchTokens: ["photorealistic", "cinematic"],
    stats: { views: 0, copies: 0, saves: 0 },
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
    publishedAt: "2026-08-12T00:00:00.000Z",
    sourceNumber: 11,

    ...overrides,
  };
}

describe("toPromptInput", () => {
  it("produces a document that passes the publish schema", () => {
    const result = promptInputSchema.safeParse(toPromptInput(storedDocument()));

    // Surface the real reason if this ever regresses.
    const reason = result.success
      ? ""
      : result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | ");

    expect(reason).toBe("");
    expect(result.success).toBe(true);
  });

  it("strips server-owned fields that the strict schema would reject", () => {
    const input = toPromptInput(storedDocument()) as Record<string, unknown>;

    for (const key of ["sourceNumber", "stats", "searchTokens", "createdAt", "publishedAt"]) {
      expect(input).not.toHaveProperty(key);
    }
  });

  it("drops nulls rather than passing them through", () => {
    const input = toPromptInput(storedDocument()) as Record<string, unknown>;

    for (const key of ["aiTool", "aspectRatio", "durationSeconds", "preview"]) {
      expect(input[key]).toBeUndefined();
    }
  });

  it("keeps every field the admin actually edits", () => {
    const input = toPromptInput(storedDocument()) as Record<string, unknown>;

    expect(input.title).toContain("roller coaster");
    expect(input.categorySlug).toBe("product-ads");
    expect(input.type).toBe("video");
    expect(input.status).toBe("published");
  });

  it("survives an unknown field added to the document later", () => {
    const doc = storedDocument({ somethingNewFromAFutureMigration: { a: 1 } });
    expect(promptInputSchema.safeParse(toPromptInput(doc)).success).toBe(true);
  });

  it("normalises a nested attribution object with null members", () => {
    const doc = storedDocument({
      attribution: { source: "actionables.ai", handle: null, url: null },
    });
    const result = promptInputSchema.safeParse(toPromptInput(doc));
    expect(result.success).toBe(true);
  });

  it("accepts a YouTube preview exactly as the resolver returns it", () => {
    const doc = storedDocument({
      preview: {
        kind: "youtube",
        youtubeId: "dQw4w9WgXcQ",
        format: "short",
        originalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "Some clip",
        thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
      },
      aiTool: "Veo 3.1",
      aspectRatio: "9:16",
    });

    const result = promptInputSchema.safeParse(toPromptInput(doc));
    const reason = result.success
      ? ""
      : result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | ");

    expect(reason).toBe("");
  });

  it("exposes the schema's own keys, so the projection can't drift", () => {
    expect(PROMPT_INPUT_KEYS).toContain("title");
    expect(PROMPT_INPUT_KEYS).toContain("promptText");
    expect(PROMPT_INPUT_KEYS).not.toContain("stats");
    expect(PROMPT_INPUT_KEYS).not.toContain("sourceNumber");
  });
});
