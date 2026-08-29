import "server-only";

import { unstable_cache } from "next/cache";

import { adminDb } from "@/lib/firebase/admin";
import type { Category } from "@/lib/schemas/category";
import type { Prompt, PromptStatus } from "@/lib/schemas/prompt";
import { DEFAULT_SETTINGS, type SiteSettings } from "@/lib/schemas/settings";
import type { SortOption, PromptType } from "@/lib/constants/site";

/**
 * Server-side reads via the Admin SDK.
 *
 * The library is gated, so its pages read the session cookie and are therefore
 * DYNAMIC — they can't be statically prerendered any more. Without care that
 * would mean a Firestore round trip on every page view.
 *
 * So the data layer is cached instead of the page: `unstable_cache` keeps
 * results in Next's data cache, keyed by arguments and tagged with the same
 * tags `revalidateTag` already uses on publish. Net effect is unchanged from
 * the static design — Firestore read volume tracks admin edits, not traffic —
 * while every request still passes through the auth check.
 *
 * (`unstable_cache` is deprecated in favour of `use cache`, which requires
 * Cache Components. We deliberately don't enable those — see CLAUDE.md.)
 */

const CACHE_TTL_SECONDS = 3600;

export const COLLECTIONS = {
  prompts: "prompts",
  categories: "categories",
  tags: "tags",
  settings: "settings",
  media: "media",
  auditLog: "auditLog",
} as const;

/** Firestore Timestamps aren't serialisable across the RSC boundary. */
function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate(): Date }).toDate().toISOString();
  }
  return null;
}

function toPrompt(id: string, data: FirebaseFirestore.DocumentData): Prompt {
  return {
    ...(data as Omit<Prompt, "id" | "createdAt" | "updatedAt" | "publishedAt">),
    id,
    createdAt: toIso(data.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(data.updatedAt) ?? new Date(0).toISOString(),
    publishedAt: toIso(data.publishedAt),
  };
}

function toCategory(id: string, data: FirebaseFirestore.DocumentData): Category {
  return {
    ...(data as Omit<Category, "id" | "createdAt" | "updatedAt">),
    id,
    createdAt: toIso(data.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(data.updatedAt) ?? new Date(0).toISOString(),
  };
}

// ── Prompts ──────────────────────────────────────────────────────────────────

export type PromptQuery = {
  status?: PromptStatus;
  type?: PromptType;
  categorySlug?: string;
  aiTool?: string;
  featured?: boolean;
  sort?: SortOption;
  limit?: number;
};

async function listPromptsUncached(options: PromptQuery = {}): Promise<Prompt[]> {
  const {
    status = "published",
    type,
    categorySlug,
    aiTool,
    featured,
    sort = "newest",
    limit = 60,
  } = options;

  let query: FirebaseFirestore.Query = adminDb()
    .collection(COLLECTIONS.prompts)
    .where("status", "==", status);

  if (type) query = query.where("type", "==", type);
  if (categorySlug) query = query.where("categorySlug", "==", categorySlug);
  if (aiTool) query = query.where("aiTool", "==", aiTool);
  if (featured !== undefined) query = query.where("featured", "==", featured);

  switch (sort) {
    case "copies":
      query = query.orderBy("stats.copies", "desc");
      break;
    case "views":
      query = query.orderBy("stats.views", "desc");
      break;
    case "featured":
      query = query.orderBy("featuredOrder", "asc");
      break;
    default:
      query = query.orderBy("publishedAt", "desc");
  }

  const snapshot = await query.limit(limit).get();
  return snapshot.docs.map((doc) => toPrompt(doc.id, doc.data()));
}

async function getPromptBySlugUncached(slug: string): Promise<Prompt | null> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.prompts)
    .where("slug", "==", slug)
    .limit(1)
    .get();

  const doc = snapshot.docs[0];
  return doc ? toPrompt(doc.id, doc.data()) : null;
}

export async function getPromptById(id: string): Promise<Prompt | null> {
  const doc = await adminDb().collection(COLLECTIONS.prompts).doc(id).get();
  return doc.exists ? toPrompt(doc.id, doc.data()!) : null;
}

/** Every published slug — drives generateStaticParams. */
export async function listPublishedSlugs(): Promise<string[]> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.prompts)
    .where("status", "==", "published")
    .select("slug")
    .get();

  return snapshot.docs.map((doc) => doc.get("slug") as string).filter(Boolean);
}

export async function listAllSlugs(): Promise<Set<string>> {
  const snapshot = await adminDb().collection(COLLECTIONS.prompts).select("slug").get();
  return new Set(snapshot.docs.map((doc) => doc.get("slug") as string).filter(Boolean));
}

export async function countPrompts(status?: PromptStatus): Promise<number> {
  let query: FirebaseFirestore.Query = adminDb().collection(COLLECTIONS.prompts);
  if (status) query = query.where("status", "==", status);
  const snapshot = await query.count().get();
  return snapshot.data().count;
}

/** Same category, excluding self, ranked by copies. */
async function listRelatedPromptsUncached(
  prompt: Prompt,
  max = 8,
): Promise<Prompt[]> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.prompts)
    .where("status", "==", "published")
    .where("categorySlug", "==", prompt.categorySlug)
    .orderBy("stats.copies", "desc")
    .limit(max + 1)
    .get();

  return snapshot.docs
    .map((doc) => toPrompt(doc.id, doc.data()))
    .filter((p) => p.id !== prompt.id)
    .slice(0, max);
}

// ── Categories ───────────────────────────────────────────────────────────────

async function listCategoriesUncached(
  options: { visibleOnly?: boolean } = {},
): Promise<Category[]> {
  const { visibleOnly = true } = options;

  let query: FirebaseFirestore.Query = adminDb().collection(COLLECTIONS.categories);
  if (visibleOnly) query = query.where("isVisible", "==", true);

  const snapshot = await query.orderBy("order", "asc").get();
  return snapshot.docs.map((doc) => toCategory(doc.id, doc.data()));
}

async function getCategoryBySlugUncached(slug: string): Promise<Category | null> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.categories)
    .where("slug", "==", slug)
    .limit(1)
    .get();

  const doc = snapshot.docs[0];
  return doc ? toCategory(doc.id, doc.data()) : null;
}

// ── Admin-only reads ─────────────────────────────────────────────────────────
// Uncached: the admin panel is dynamic and must never show stale state right
// after an edit.

export async function listCategoriesForAdmin(): Promise<Category[]> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.categories)
    .orderBy("order", "asc")
    .get();
  return snapshot.docs.map((doc) => toCategory(doc.id, doc.data()));
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const doc = await adminDb().collection(COLLECTIONS.categories).doc(id).get();
  return doc.exists ? toCategory(doc.id, doc.data()!) : null;
}

export async function countPromptsInCategory(categoryId: string): Promise<number> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.prompts)
    .where("categoryId", "==", categoryId)
    .count()
    .get();
  return snapshot.data().count;
}

export type MediaAssetRow = {
  id: string;
  r2Key: string;
  url: string;
  mime: string;
  bytes: number;
  width: number;
  height: number;
  originalName: string;
  uploadedAt: string | null;
};

function toMediaAsset(id: string, data: FirebaseFirestore.DocumentData): MediaAssetRow {
  return {
    id,
    r2Key: (data.r2Key as string) ?? "",
    url: (data.url as string) ?? "",
    mime: (data.mime as string) ?? "",
    bytes: (data.bytes as number) ?? 0,
    width: (data.width as number) ?? 0,
    height: (data.height as number) ?? 0,
    originalName: (data.originalName as string) ?? "",
    uploadedAt: toIso(data.uploadedAt),
  };
}

export async function listMediaAssets(): Promise<MediaAssetRow[]> {
  const snapshot = await adminDb().collection(COLLECTIONS.media).get();
  return snapshot.docs
    .map((doc) => toMediaAsset(doc.id, doc.data()))
    .sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? ""));
}

export async function getMediaAsset(id: string): Promise<MediaAssetRow | null> {
  const doc = await adminDb().collection(COLLECTIONS.media).doc(id).get();
  return doc.exists ? toMediaAsset(doc.id, doc.data()!) : null;
}

/** How many prompts point at this image, so deletion can't orphan one. */
export async function countPromptsUsingMedia(url: string): Promise<number> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.prompts)
    .where("preview.url", "==", url)
    .count()
    .get();
  return snapshot.data().count;
}

export type TagRow = { slug: string; count: number };

/**
 * Tags aggregated from the prompts that carry them.
 *
 * There is no tags collection: a tag only exists because a prompt uses it, so
 * deriving the list keeps it honest — a tag can never linger after its last
 * prompt drops it.
 */
export async function listTagsWithCounts(): Promise<TagRow[]> {
  const snapshot = await adminDb().collection(COLLECTIONS.prompts).select("tags").get();

  const counts = new Map<string, number>();
  for (const doc of snapshot.docs) {
    for (const tag of (doc.get("tags") as string[] | undefined) ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
}

// ── Settings ─────────────────────────────────────────────────────────────────

async function getSiteSettingsUncached(): Promise<SiteSettings> {
  try {
    const doc = await adminDb().collection(COLLECTIONS.settings).doc("site").get();
    if (!doc.exists) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(doc.data() as Partial<SiteSettings>) };
  } catch {
    // Never let a settings read break the page — fall back to compile-time brand.
    return DEFAULT_SETTINGS;
  }
}


// ── Cached public readers ────────────────────────────────────────────────────
// Arguments form part of the cache key automatically. Tags mirror
// lib/firebase/mutations.ts so publishing invalidates exactly what changed.

export const listPrompts = unstable_cache(listPromptsUncached, ["prompts:list"], {
  tags: ["prompts"],
  revalidate: CACHE_TTL_SECONDS,
});

export const getPromptBySlug = unstable_cache(
  getPromptBySlugUncached,
  ["prompts:by-slug"],
  { tags: ["prompts"], revalidate: CACHE_TTL_SECONDS },
);

export const listRelatedPrompts = unstable_cache(
  listRelatedPromptsUncached,
  ["prompts:related"],
  { tags: ["prompts"], revalidate: CACHE_TTL_SECONDS },
);

export const listCategories = unstable_cache(
  listCategoriesUncached,
  ["categories:list"],
  { tags: ["categories"], revalidate: CACHE_TTL_SECONDS },
);

export const getCategoryBySlug = unstable_cache(
  getCategoryBySlugUncached,
  ["categories:by-slug"],
  { tags: ["categories"], revalidate: CACHE_TTL_SECONDS },
);

export const getSiteSettings = unstable_cache(getSiteSettingsUncached, ["settings"], {
  tags: ["settings"],
  revalidate: CACHE_TTL_SECONDS,
});
