/**
 * Seeds Firestore with the default taxonomy, site settings, and the prompts
 * extracted from the source document.
 *
 *   pnpm extract:docx     # first — produces scripts/data/extracted-prompts.json
 *   pnpm seed             # then — writes to Firestore
 *   pnpm seed -- --publish   # publish immediately instead of importing as drafts
 *
 * Everything is imported as a DRAFT by default. The source document has no
 * category or tool metadata and no usable preview images, so nothing should
 * reach the public site before a human has reviewed it (PRD §2.2).
 *
 * Safe to re-run: existing slugs are skipped, not duplicated.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "dotenv";
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { nanoid } from "nanoid";

import { DEFAULT_CATEGORIES, SITE } from "../lib/constants/site";
import { resolveServiceAccount } from "../lib/firebase/credentials";
import { buildSearchTokens } from "../lib/schemas/prompt";
import type { ExtractedPrompt } from "./extract-docx";

config({ path: ".env.local", quiet: true });

const PUBLISH = process.argv.includes("--publish");
const EXTRACTED = "scripts/data/extracted-prompts.json";

function initFirebase() {
  let sa;
  try {
    sa = resolveServiceAccount();
  } catch (error) {
    console.error(`\n${(error as Error).message}\n`);
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId: sa.projectId,
      clientEmail: sa.clientEmail,
      privateKey: sa.privateKey,
    }),
    projectId: sa.projectId,
  });

  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });
  return { db, projectId: sa.projectId };
}

async function seedCategories(db: FirebaseFirestore.Firestore) {
  const existing = await db.collection("categories").get();
  const bySlug = new Map(existing.docs.map((doc) => [doc.get("slug") as string, doc.id]));

  let created = 0;
  const ids = new Map<string, string>();

  for (const [index, category] of DEFAULT_CATEGORIES.entries()) {
    const found = bySlug.get(category.slug);
    if (found) {
      ids.set(category.slug, found);
      continue;
    }

    const id = nanoid(12);
    await db
      .collection("categories")
      .doc(id)
      .set({
        ...category,
        order: index,
        isVisible: true,
        promptCount: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    ids.set(category.slug, id);
    created += 1;
  }

  console.log(`Categories: ${created} created, ${DEFAULT_CATEGORIES.length - created} already present`);
  return ids;
}

async function seedSettings(db: FirebaseFirestore.Firestore) {
  const ref = db.collection("settings").doc("site");
  if ((await ref.get()).exists) {
    console.log("Settings: already present, left untouched");
    return;
  }

  await ref.set({
    siteName: SITE.name,
    tagline: SITE.tagline,
    description: SITE.description,
    branding: { accentColor: "oklch(0.548 0.216 286)" },
    seo: { titleTemplate: `%s · ${SITE.name}`, canonicalHost: "" },
    ui: {
      defaultTheme: "system",
      showAnnouncement: false,
      homeHeroHeadline: "AI prompts that actually work.",
      homeHeroSubline:
        "Copy-ready image and video prompts, each one shown with its real output.",
    },
    social: { website: SITE.parentUrl },
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log("Settings: created");
}

async function seedPrompts(
  db: FirebaseFirestore.Firestore,
  categoryIds: Map<string, string>,
) {
  let extracted: ExtractedPrompt[];
  try {
    extracted = JSON.parse(readFileSync(resolve(EXTRACTED), "utf8")) as ExtractedPrompt[];
  } catch {
    console.error(`Couldn't read ${EXTRACTED}. Run "pnpm extract:docx" first.`);
    process.exit(1);
  }

  const existing = await db.collection("prompts").select("slug").get();
  const taken = new Set(existing.docs.map((doc) => doc.get("slug") as string));

  // Everything lands in one holding category until a human classifies it —
  // guessing a category from the text would produce confident-looking noise.
  const fallbackSlug = "product-ads";
  const fallbackId = categoryIds.get(fallbackSlug);
  if (!fallbackId) {
    console.error("Category seeding failed — aborting.");
    process.exit(1);
  }

  let written = 0;
  let skipped = 0;
  let batch = db.batch();
  let batched = 0;

  for (const prompt of extracted) {
    if (taken.has(prompt.slug)) {
      skipped += 1;
      continue;
    }

    const id = nanoid(12);
    const now = FieldValue.serverTimestamp();

    const notes = [
      prompt.likelyTruncated
        ? "⚠ The source document truncated this prompt — paste the full text before publishing."
        : null,
      prompt.hasPlaceholders
        ? `Template placeholders: ${prompt.placeholders.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    batch.set(db.collection("prompts").doc(id), {
      title: prompt.title,
      slug: prompt.slug,
      description: "",
      promptText: prompt.promptText,
      negativePrompt: prompt.negativePrompt,
      usageNotes: notes,
      type: prompt.suggestedType,
      categoryId: fallbackId,
      categorySlug: fallbackSlug,
      tags: [],
      aiTool: "",
      model: "",
      aspectRatio: prompt.suggestedAspectRatio ?? undefined,
      durationSeconds: prompt.suggestedDurationSeconds ?? undefined,
      requiresReferenceImage: prompt.requiresReferenceImage,
      hasPlaceholders: prompt.hasPlaceholders,
      preview: undefined,
      gallery: [],
      attribution: undefined,
      // Drafts unless explicitly overridden: there is no preview media yet, and
      // a prompt without its output is exactly what this product is not.
      status: PUBLISH ? "published" : "draft",
      featured: false,
      searchTokens: buildSearchTokens({
        title: prompt.title,
        description: "",
        tags: [],
        aiTool: "",
        categorySlug: fallbackSlug,
      }),
      stats: { views: 0, copies: 0, saves: 0 },
      createdAt: now,
      updatedAt: now,
      publishedAt: PUBLISH ? now : null,
      sourceNumber: prompt.sourceNumber,
    });

    taken.add(prompt.slug);
    written += 1;
    batched += 1;

    // Firestore caps a batch at 500 writes.
    if (batched >= 400) {
      await batch.commit();
      batch = db.batch();
      batched = 0;
    }
  }

  if (batched > 0) await batch.commit();

  console.log(
    `Prompts: ${written} imported as ${PUBLISH ? "PUBLISHED" : "drafts"}, ${skipped} skipped (slug already exists)`,
  );

  const truncated = extracted.filter((p) => p.likelyTruncated).length;
  if (truncated > 0) {
    console.log(
      `\n⚠ ${truncated} prompts were truncated in the source document.\n` +
        `  They are flagged in "How to use" — paste the full text before publishing.`,
    );
  }
}

async function main() {
  const { db, projectId } = initFirebase();
  console.log(`Seeding Firestore project: ${projectId}\n`);

  const categoryIds = await seedCategories(db);
  await seedSettings(db);
  await seedPrompts(db, categoryIds);

  console.log(`
✓ Seed complete.

Next:
  1. pnpm set:admin <your-email>
  2. pnpm dev  →  http://localhost:3000/admin
  3. Review each draft: set the category, AI tool and preview media, then publish.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
