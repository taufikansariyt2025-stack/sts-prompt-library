import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MasonryGrid } from "@/components/prompt/masonry-grid";
import { getCategoryBySlug, listPrompts } from "@/lib/firebase/queries";
import { safeQuery } from "@/lib/firebase/safe";

export async function generateMetadata({
  params,
}: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await safeQuery(() => getCategoryBySlug(slug), null);

  if (!category) {
    return { title: "Category not found", robots: { index: false, follow: false } };
  }

  return {
    title: category.name,
    description: category.description || `AI prompts in ${category.name}.`,
    alternates: { canonical: `/categories/${category.slug}` },
  };
}

export default async function CategoryPage({ params }: PageProps<"/categories/[slug]">) {
  const { slug } = await params;
  const category = await safeQuery(() => getCategoryBySlug(slug), null);

  if (!category || !category.isVisible) notFound();

  const prompts = await safeQuery(
    () => listPrompts({ categorySlug: slug, limit: 200 }),
    [],
  );

  return (
    <div className="container-page py-6 md:py-10">
      <Link
        href="/categories"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        All categories
      </Link>

      <header className="relative mb-8 overflow-hidden rounded-2xl border border-border bg-surface p-6 md:p-8">
        <span
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{ background: category.accentColor }}
        />
        <div className="relative">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {category.name}
          </h1>
          {category.description ? (
            <p className="mt-2 max-w-xl text-sm text-fg-muted md:text-base">
              {category.description}
            </p>
          ) : null}
          <p className="mt-3 text-xs text-fg-subtle">
            {prompts.length} {prompts.length === 1 ? "prompt" : "prompts"}
          </p>
        </div>
      </header>

      {prompts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-2 px-6 py-16 text-center">
          <p className="font-medium">Nothing here yet</p>
          <p className="mt-1.5 text-sm text-fg-muted">
            Prompts in this category will appear as they&rsquo;re published.
          </p>
        </div>
      ) : (
        <MasonryGrid prompts={prompts} />
      )}
    </div>
  );
}
