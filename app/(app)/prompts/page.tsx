import type { Metadata } from "next";
import { Suspense } from "react";

import { BrowseClient } from "@/components/prompt/browse-client";
import { MasonryGrid } from "@/components/prompt/masonry-grid";
import { listCategories, listPrompts } from "@/lib/firebase/queries";
import { safeQuery } from "@/lib/firebase/safe";

export const metadata: Metadata = {
  title: "Browse prompts",
  description:
    "Every AI image and video prompt in the library, filterable by type, category, tool and aspect ratio.",
  alternates: { canonical: "/prompts" },
};

export default async function BrowsePage() {
  const [prompts, categories] = await Promise.all([
    safeQuery(() => listPrompts({ limit: 300 }), []),
    safeQuery(() => listCategories(), []),
  ]);

  return (
    <div className="container-page py-6 md:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          All prompts
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          Filter by type, category, tool or aspect ratio.
        </p>
      </header>

      {/*
        BrowseClient reads useSearchParams, so it needs a Suspense boundary to
        prerender. The fallback is the REAL grid rather than a skeleton — that
        way the static HTML ships every card (good for SEO and LCP) and the
        client component simply takes over filtering once hydrated.
      */}
      <Suspense fallback={<MasonryGrid prompts={prompts} />}>
        <BrowseClient prompts={prompts} categories={categories} />
      </Suspense>
    </div>
  );
}
