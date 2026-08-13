"use client";

import MiniSearch from "minisearch";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { MasonryGrid } from "@/components/prompt/masonry-grid";
import { Input } from "@/components/ui/input";
import type { Prompt } from "@/lib/schemas/prompt";

/**
 * Client-side search over the delivered prompt list.
 *
 * Zero Firestore reads per search, results in well under a frame, and it keeps
 * working offline once the page is cached. Field weights favour the title, then
 * tags, then the tool name — matching how people actually look for a prompt.
 */
export function SearchClient({ prompts }: { prompts: Prompt[] }) {
  const [query, setQuery] = useState("");

  const index = useMemo(() => {
    const search = new MiniSearch<Prompt>({
      fields: ["title", "description", "tags", "aiTool", "categorySlug", "promptText"],
      storeFields: ["id"],
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
        boost: {
          title: 4,
          tags: 3,
          aiTool: 2,
          description: 1.5,
          categorySlug: 1.5,
          promptText: 1,
        },
      },
    });
    search.addAll(prompts);
    return search;
  }, [prompts]);

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const ids = new Set(index.search(trimmed).map((hit) => hit.id as string));
    return prompts.filter((prompt) => ids.has(prompt.id));
  }, [query, index, prompts]);

  return (
    <div>
      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search prompts, tools, tags…"
          className="h-12 pl-10 pr-10 text-base"
          autoFocus
          aria-label="Search prompts"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-fg-subtle transition-colors hover:text-fg"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {!query.trim() ? (
        <div className="py-16 text-center">
          <Search className="mx-auto size-7 text-fg-subtle" />
          <p className="mt-3 text-sm text-fg-muted">
            Start typing to search {prompts.length} prompts.
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-2 px-6 py-16 text-center">
          <p className="font-medium">
            Nothing found for &ldquo;{query.trim()}&rdquo;
          </p>
          <p className="mt-1.5 text-sm text-fg-muted">
            Try a shorter or more general term.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-fg-muted">
            {results.length} {results.length === 1 ? "result" : "results"}
          </p>
          <MasonryGrid prompts={results} />
        </>
      )}
    </div>
  );
}
