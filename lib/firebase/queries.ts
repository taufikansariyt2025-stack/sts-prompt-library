import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import type { Category } from "@/lib/schemas/category";
import type { Prompt, PromptStatus } from "@/lib/schemas/prompt";
import { DEFAULT_SETTINGS, type SiteSettings } from "@/lib/schemas/settings";
import type { SortOption, PromptType } from "@/lib/constants/site";

/**
 * Server-side reads via the Admin SDK.
 *
 * These run at build time and during ISR revalidation — NOT per visitor
 * request. Public pages are statically generated, so Firestore read volume
 * tracks admin edits rather than traffic. See PRD §17.
 */

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

export async function listPrompts(options: PromptQuery = {}): Promise<Prompt[]> {
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

export async function getPromptBySlug(slug: string): Promise<Prompt | null> {
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
export async function listRelatedPrompts(
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

export async function listCategories(
  options: { visibleOnly?: boolean } = {},
): Promise<Category[]> {
  const { visibleOnly = true } = options;

  let query: FirebaseFirestore.Query = adminDb().collection(COLLECTIONS.categories);
  if (visibleOnly) query = query.where("isVisible", "==", true);

  const snapshot = await query.orderBy("order", "asc").get();
  return snapshot.docs.map((doc) => toCategory(doc.id, doc.data()));
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.categories)
    .where("slug", "==", slug)
    .limit(1)
    .get();

  const doc = snapshot.docs[0];
  return doc ? toCategory(doc.id, doc.data()) : null;
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const doc = await adminDb().collection(COLLECTIONS.settings).doc("site").get();
    if (!doc.exists) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(doc.data() as Partial<SiteSettings>) };
  } catch {
    // Never let a settings read break the page — fall back to compile-time brand.
    return DEFAULT_SETTINGS;
  }
}
