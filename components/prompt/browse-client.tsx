"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { MasonryGrid } from "@/components/prompt/masonry-grid";
import { Button } from "@/components/ui/button";
import { SORT_OPTIONS, type SortOption } from "@/lib/constants/site";
import type { Category } from "@/lib/schemas/category";
import type { Prompt } from "@/lib/schemas/prompt";
import { cn } from "@/lib/utils/cn";

type Href = Parameters<ReturnType<typeof useRouter>["replace"]>[0];

/**
 * Filtering runs in the browser over the already-delivered list.
 *
 * That keeps /prompts statically rendered — filtering server-side from
 * searchParams would force dynamic rendering on the highest-traffic route and
 * cost a Firestore read per visitor.
 */
export function BrowseClient({
  prompts,
  categories,
}: {
  prompts: Prompt[];
  categories: Category[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);

  const type = params.get("type") ?? "";
  const category = params.get("category") ?? "";
  const tool = params.get("tool") ?? "";
  const ratio = params.get("ratio") ?? "";
  const sort = (params.get("sort") ?? "newest") as SortOption;

  /** Every filter is a URL param, so any view is shareable and back works. */
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    // typedRoutes can't verify a query string assembled at runtime. The
    // pathname is a literal we control, so the cast is safe.
    const href = `/prompts${next.toString() ? `?${next}` : ""}`;
    router.replace(href as Href, { scroll: false });
  }

  function clearAll() {
    router.replace("/prompts", { scroll: false });
  }

  // flatMap rather than filter+predicate: these fields are nullable unions, so
  // a type predicate to `string` isn't assignable to the parameter type.
  const tools = useMemo(
    () => [...new Set(prompts.flatMap((p) => (p.aiTool ? [p.aiTool] : [])))].sort(),
    [prompts],
  );
  const ratios = useMemo(
    () =>
      [...new Set(prompts.flatMap((p) => (p.aspectRatio ? [p.aspectRatio] : [])))].sort(),
    [prompts],
  );

  const filtered = useMemo(() => {
    const result = prompts.filter(
      (prompt) =>
        (!type || prompt.type === type) &&
        (!category || prompt.categorySlug === category) &&
        (!tool || prompt.aiTool === tool) &&
        (!ratio || prompt.aspectRatio === ratio),
    );

    switch (sort) {
      case "copies":
        return [...result].sort((a, b) => b.stats.copies - a.stats.copies);
      case "views":
        return [...result].sort((a, b) => b.stats.views - a.stats.views);
      case "featured":
        return [...result].sort((a, b) => Number(b.featured) - Number(a.featured));
      default:
        return result;
    }
  }, [prompts, type, category, tool, ratio, sort]);

  const active = [
    type && { key: "type", label: type === "video" ? "Video" : "Image" },
    category && {
      key: "category",
      label: categories.find((c) => c.slug === category)?.name ?? category,
    },
    tool && { key: "tool", label: tool },
    ratio && { key: "ratio", label: ratio },
  ].filter(Boolean) as { key: string; label: string }[];

  const filters = (
    <>
      <FilterGroup
        label="Type"
        options={[
          { value: "", label: "All" },
          { value: "video", label: "Video" },
          { value: "image", label: "Image" },
        ]}
        value={type}
        onChange={(value) => setParam("type", value)}
      />
      {categories.length > 0 ? (
        <FilterGroup
          label="Category"
          options={[
            { value: "", label: "All" },
            ...categories.map((c) => ({ value: c.slug, label: c.name })),
          ]}
          value={category}
          onChange={(value) => setParam("category", value)}
        />
      ) : null}
      {tools.length > 0 ? (
        <FilterGroup
          label="AI tool"
          options={[
            { value: "", label: "All" },
            ...tools.map((t) => ({ value: t, label: t })),
          ]}
          value={tool}
          onChange={(value) => setParam("tool", value)}
        />
      ) : null}
      {ratios.length > 0 ? (
        <FilterGroup
          label="Aspect ratio"
          options={[
            { value: "", label: "All" },
            ...ratios.map((r) => ({ value: r, label: r })),
          ]}
          value={ratio}
          onChange={(value) => setParam("ratio", value)}
        />
      ) : null}
    </>
  );

  return (
    <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Filters</h2>
            {active.length > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-fg-muted transition-colors hover:text-accent"
              >
                Clear all
              </button>
            ) : null}
          </div>
          {filters}
        </div>
      </aside>

      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setSheetOpen(true)}
          >
            <SlidersHorizontal />
            Filters
            {active.length > 0 ? (
              <span className="ml-0.5 grid size-5 place-items-center rounded-full bg-accent text-[0.6875rem] text-accent-fg">
                {active.length}
              </span>
            ) : null}
          </Button>

          <p className="text-sm text-fg-muted">
            {filtered.length} {filtered.length === 1 ? "prompt" : "prompts"}
          </p>

          <div className="ml-auto">
            <select
              aria-label="Sort by"
              value={sort}
              onChange={(event) => setParam("sort", event.target.value)}
              className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg focus-visible:border-accent focus-visible:outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {active.length > 0 ? (
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            {active.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setParam(chip.key, "")}
                className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 pl-3 pr-1.5 text-xs font-medium text-accent transition-opacity hover:opacity-80"
              >
                {chip.label}
                <X className="size-3" />
              </button>
            ))}
            <button
              type="button"
              onClick={clearAll}
              className="ml-1 text-xs text-fg-muted transition-colors hover:text-accent"
            >
              Clear all
            </button>
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface-2 px-6 py-16 text-center">
            <p className="font-medium">No prompts match these filters</p>
            <p className="mt-1.5 text-sm text-fg-muted">
              Try removing one, or clear them all.
            </p>
            <Button variant="outline" className="mt-5" onClick={clearAll}>
              Clear filters
            </Button>
          </div>
        ) : (
          <MasonryGrid prompts={filtered} />
        )}
      </div>

      {/* Mobile filter sheet */}
      {sheetOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-overlay"
            onClick={() => setSheetOpen(false)}
          />
          <div className="safe-bottom absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[1.75rem] border-t border-border bg-surface p-5">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong" />
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold">Filters</h2>
              {active.length > 0 ? (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-sm text-fg-muted transition-colors hover:text-accent"
                >
                  Clear all
                </button>
              ) : null}
            </div>
            <div className="space-y-6 pb-4">{filters}</div>
            <Button full size="lg" onClick={() => setSheetOpen(false)}>
              Show {filtered.length} {filtered.length === 1 ? "result" : "results"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
        {label}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
              value === option.value
                ? "border-accent bg-accent-soft text-accent"
                : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
