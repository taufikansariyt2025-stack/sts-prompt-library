import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { nanoid } from "nanoid";
import { revalidateTag } from "next/cache";

import type { AdminSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/queries";
import type { CategoryInput } from "@/lib/schemas/category";
import {
  buildSearchTokens,
  detectPlaceholders,
  type PromptInput,
  type PromptUpdate,
} from "@/lib/schemas/prompt";
import type { SiteSettings } from "@/lib/schemas/settings";

/**
 * All writes live here.
 *
 * Callers must already have authorised the request — nothing in this file
 * checks permissions. Centralising writes is what guarantees that validation,
 * derived fields, the audit log and cache revalidation happen every time.
 */

// ── Cache tags ───────────────────────────────────────────────────────────────

export const TAGS = {
  prompts: "prompts",
  prompt: (slug: string) => `prompt:${slug}`,
  category: (slug: string) => `category:${slug}`,
  categories: "categories",
  settings: "settings",
  searchIndex: "search-index",
} as const;

/**
 * Next 16 requires a cacheLife profile as the second argument. "max" gives
 * stale-while-revalidate semantics: readers get the cached page instantly while
 * it refreshes behind them.
 */
function invalidate(tags: string[]) {
  for (const tag of tags) revalidateTag(tag, "max");
}

// ── Audit ────────────────────────────────────────────────────────────────────

type AuditAction =
  | "prompt.create"
  | "prompt.update"
  | "prompt.delete"
  | "prompt.publish"
  | "prompt.unpublish"
  | "category.create"
  | "category.update"
  | "category.delete"
  | "settings.update"
  | "media.delete"
  | "access.decide"
  | "tag.rename";

export async function audit(
  session: AdminSession,
  action: AuditAction,
  target: string,
  meta?: Record<string, unknown>,
) {
  try {
    await adminDb().collection(COLLECTIONS.auditLog).add({
      action,
      target,
      actorUid: session.uid,
      actorEmail: session.email,
      meta: meta ?? {},
      at: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    // An audit failure must never block the actual operation.
    console.error("[audit] failed to record", action, error);
  }
}

// ── Prompts ──────────────────────────────────────────────────────────────────

/** Fields derived from the input rather than trusted from the client. */
function derive(input: PromptInput | PromptUpdate) {
  const derived: Record<string, unknown> = {};

  if (input.promptText !== undefined) {
    derived.hasPlaceholders = detectPlaceholders(input.promptText).length > 0;
  }

  if (
    input.title !== undefined ||
    input.description !== undefined ||
    input.tags !== undefined ||
    input.aiTool !== undefined ||
    input.categorySlug !== undefined
  ) {
    derived.searchTokens = buildSearchTokens({
      title: input.title ?? "",
      description: input.description ?? "",
      tags: input.tags ?? [],
      aiTool: input.aiTool ?? "",
      categorySlug: input.categorySlug ?? "",
    });
  }

  return derived;
}

export async function createPrompt(
  session: AdminSession,
  input: PromptInput,
): Promise<string> {
  const id = nanoid(12);
  const now = FieldValue.serverTimestamp();

  await adminDb()
    .collection(COLLECTIONS.prompts)
    .doc(id)
    .set({
      ...input,
      ...derive(input),
      stats: { views: 0, copies: 0, saves: 0 },
      createdAt: now,
      updatedAt: now,
      publishedAt: input.status === "published" ? now : null,
    });

  await audit(session, "prompt.create", id, { slug: input.slug });
  await recountCategory(input.categoryId);

  invalidate([
    TAGS.prompts,
    TAGS.prompt(input.slug),
    TAGS.category(input.categorySlug),
    TAGS.searchIndex,
  ]);

  return id;
}

export async function updatePrompt(
  session: AdminSession,
  id: string,
  patch: PromptUpdate,
  previous: { slug: string; categorySlug: string; categoryId: string; status: string },
): Promise<void> {
  const doc = adminDb().collection(COLLECTIONS.prompts).doc(id);

  const update: Record<string, unknown> = {
    ...patch,
    ...derive(patch),
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Stamp publishedAt the first time a prompt goes live, and clear it if it is
  // pulled back to draft.
  if (patch.status === "published" && previous.status !== "published") {
    update.publishedAt = FieldValue.serverTimestamp();
  } else if (patch.status === "draft" && previous.status === "published") {
    update.publishedAt = null;
  }

  await doc.update(update);

  const action =
    patch.status === "published" && previous.status !== "published"
      ? "prompt.publish"
      : patch.status === "draft" && previous.status === "published"
        ? "prompt.unpublish"
        : "prompt.update";

  await audit(session, action, id, { slug: patch.slug ?? previous.slug });

  if (patch.categoryId && patch.categoryId !== previous.categoryId) {
    await recountCategory(previous.categoryId);
    await recountCategory(patch.categoryId);
  } else if (patch.status) {
    await recountCategory(previous.categoryId);
  }

  // Invalidate both the old and new slug/category so an unpublished or renamed
  // prompt can't survive at the edge.
  invalidate([
    TAGS.prompts,
    TAGS.prompt(previous.slug),
    TAGS.category(previous.categorySlug),
    TAGS.searchIndex,
    ...(patch.slug && patch.slug !== previous.slug ? [TAGS.prompt(patch.slug)] : []),
    ...(patch.categorySlug && patch.categorySlug !== previous.categorySlug
      ? [TAGS.category(patch.categorySlug)]
      : []),
  ]);
}

export async function deletePrompt(
  session: AdminSession,
  id: string,
  previous: { slug: string; categorySlug: string; categoryId: string },
): Promise<void> {
  await adminDb().collection(COLLECTIONS.prompts).doc(id).delete();
  await audit(session, "prompt.delete", id, { slug: previous.slug });
  await recountCategory(previous.categoryId);

  invalidate([
    TAGS.prompts,
    TAGS.prompt(previous.slug),
    TAGS.category(previous.categorySlug),
    TAGS.searchIndex,
  ]);
}

// ── Categories ───────────────────────────────────────────────────────────────

export async function createCategory(
  session: AdminSession,
  input: CategoryInput,
): Promise<string> {
  const id = nanoid(12);
  const now = FieldValue.serverTimestamp();

  await adminDb()
    .collection(COLLECTIONS.categories)
    .doc(id)
    .set({ ...input, promptCount: 0, createdAt: now, updatedAt: now });

  await audit(session, "category.create", id, { slug: input.slug });
  invalidate([TAGS.categories, TAGS.category(input.slug)]);
  return id;
}

export async function updateCategory(
  session: AdminSession,
  id: string,
  patch: Partial<CategoryInput>,
  previousSlug: string,
): Promise<void> {
  await adminDb()
    .collection(COLLECTIONS.categories)
    .doc(id)
    .update({ ...patch, updatedAt: FieldValue.serverTimestamp() });

  await audit(session, "category.update", id, { slug: patch.slug ?? previousSlug });
  invalidate([
    TAGS.categories,
    TAGS.category(previousSlug),
    ...(patch.slug && patch.slug !== previousSlug ? [TAGS.category(patch.slug)] : []),
  ]);
}

/** Recomputes the denormalised published count for a category. */
export async function recountCategory(categoryId: string): Promise<void> {
  if (!categoryId) return;
  try {
    const snapshot = await adminDb()
      .collection(COLLECTIONS.prompts)
      .where("categoryId", "==", categoryId)
      .where("status", "==", "published")
      .count()
      .get();

    await adminDb()
      .collection(COLLECTIONS.categories)
      .doc(categoryId)
      .update({ promptCount: snapshot.data().count });
  } catch (error) {
    console.error("[recountCategory] failed", categoryId, error);
  }
}

export async function deleteCategory(
  session: AdminSession,
  id: string,
  slug: string,
): Promise<void> {
  await adminDb().collection(COLLECTIONS.categories).doc(id).delete();
  await audit(session, "category.delete", id, { slug });
  invalidate([TAGS.categories, TAGS.category(slug), TAGS.prompts]);
}

/**
 * Renames a tag on every prompt that carries it. An empty `to` removes it.
 *
 * Tags live on the prompt documents, so this rewrites each one. Renaming onto
 * an existing tag merges them, and the Set keeps that from producing a
 * duplicate on prompts that already had both.
 */
export async function renameTagAcrossPrompts(
  session: AdminSession,
  from: string,
  to: string,
): Promise<number> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.prompts)
    .where("tags", "array-contains", from)
    .get();

  let batch = adminDb().batch();
  let queued = 0;

  for (const doc of snapshot.docs) {
    const current = ((doc.get("tags") as string[] | undefined) ?? []).filter(
      (t) => t !== from,
    );
    const next = to ? [...new Set([...current, to])] : current;

    batch.update(doc.ref, { tags: next, updatedAt: FieldValue.serverTimestamp() });

    if (++queued % 400 === 0) {
      await batch.commit();
      batch = adminDb().batch();
    }
  }

  if (queued % 400 !== 0) await batch.commit();

  await audit(session, "tag.rename", from, { to: to || "(removed)", prompts: queued });
  invalidate([TAGS.prompts, TAGS.searchIndex]);

  return queued;
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function updateSiteSettings(
  session: AdminSession,
  patch: Partial<SiteSettings>,
): Promise<void> {
  await adminDb()
    .collection(COLLECTIONS.settings)
    .doc("site")
    .set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  await audit(session, "settings.update", "site");
  // Branding appears in every layout, so everything is stale.
  invalidate([TAGS.settings, TAGS.prompts, TAGS.categories]);
}
