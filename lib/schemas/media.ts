import { z } from "zod";

/**
 * Preview media — the single most important field on a prompt.
 *
 * A discriminated union rather than a bag of optional fields, so it is
 * impossible to represent "a YouTube preview that also has an R2 key", and the
 * renderer can switch exhaustively on `kind`.
 */

export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export const imageMediaSchema = z.strictObject({
  kind: z.literal("image"),
  url: z.url(),
  /** Present only when we own the object, which is what makes deletion possible. */
  r2Key: z.string().min(1).optional(),
  source: z.enum(["upload", "url"]),
  width: z.number().int().positive().max(20000),
  height: z.number().int().positive().max(20000),
  /** Base64 LQIP; removes layout jank on the masonry grid. */
  blurDataURL: z.string().max(4000).default(""),
  /** Required — publishing is blocked without it. Accessibility is not optional. */
  alt: z.string().min(1).max(200),
  bytes: z.number().int().nonnegative().optional(),
  mime: z.string().max(100).optional(),
});

export const youtubeMediaSchema = z.strictObject({
  kind: z.literal("youtube"),
  youtubeId: z.string().regex(YOUTUBE_ID, "Must be an 11-character YouTube ID"),
  /**
   * Stored, never inferred at render time: a Short is also reachable via a
   * `watch?v=` URL, so detection alone is unreliable. The admin can override.
   */
  format: z.enum(["short", "video"]),
  originalUrl: z.url(),
  title: z.string().max(200).optional(),
  thumbnailUrl: z.url(),
  startSeconds: z.number().int().nonnegative().max(86400).optional(),
});

export const previewMediaSchema = z.discriminatedUnion("kind", [
  imageMediaSchema,
  youtubeMediaSchema,
]);

export type ImageMedia = z.infer<typeof imageMediaSchema>;
export type YouTubeMedia = z.infer<typeof youtubeMediaSchema>;
export type PreviewMedia = z.infer<typeof previewMediaSchema>;

/** R2 asset registry entry. Server-managed; never client-writable. */
export const mediaAssetSchema = z.strictObject({
  id: z.string().min(1),
  r2Key: z.string().min(1),
  url: z.url(),
  mime: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  blurDataURL: z.string().default(""),
  originalName: z.string().max(255).default(""),
  /** Prompt IDs referencing this asset — blocks deleting something still in use. */
  usedBy: z.array(z.string()).default([]),
  uploadedAt: z.string(),
});

export type MediaAsset = z.infer<typeof mediaAssetSchema>;

// ── Upload constraints (mirrored client and server) ──────────────────────────

export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

/** SVG is an executable document format — allowed for logos only, and sanitised. */
export const ALLOWED_LOGO_MIME = [...ALLOWED_IMAGE_MIME, "image/svg+xml"] as const;

export const MAX_PREVIEW_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_LOGO_BYTES = 1 * 1024 * 1024; // 1 MB
export const MAX_IMAGE_DIMENSION = 2400;

export const uploadRequestSchema = z.strictObject({
  mime: z.string().min(1).max(100),
  bytes: z.number().int().positive(),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
  scope: z.enum(["prompts", "categories", "branding"]).default("prompts"),
});

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

export const uploadCompleteSchema = z.strictObject({
  r2Key: z.string().min(1).max(300),
  width: z.number().int().positive().max(20000),
  height: z.number().int().positive().max(20000),
  blurDataURL: z.string().max(4000).default(""),
  originalName: z.string().max(255).default(""),
});

export type UploadComplete = z.infer<typeof uploadCompleteSchema>;
