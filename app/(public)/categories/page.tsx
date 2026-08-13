import type { Metadata } from "next";
import Link from "next/link";

import { listCategories } from "@/lib/firebase/queries";
import { safeQuery } from "@/lib/firebase/safe";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Categories",
  description:
    "Browse AI prompts by category — product commercials, cinematic film, UGC, food, fashion and more.",
  alternates: { canonical: "/categories" },
};

export default async function CategoriesPage() {
  const categories = await safeQuery(() => listCategories(), []);

  return (
    <div className="container-page py-6 md:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Categories</h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          {categories.length > 0
            ? `${categories.length} ways to explore the library.`
            : "Categories will appear here once the library is set up."}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={{ pathname: `/categories/${category.slug}` }}
            className="group relative overflow-hidden rounded-xl border border-border bg-surface p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-e2"
          >
            {/* The category's own accent, used as a subtle wash. */}
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-1 opacity-70"
              style={{ background: category.accentColor }}
            />
            <h2 className="text-base font-semibold tracking-tight">{category.name}</h2>
            {category.description ? (
              <p className="mt-1.5 line-clamp-2 text-sm text-fg-muted">
                {category.description}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-fg-subtle">
              {category.promptCount} {category.promptCount === 1 ? "prompt" : "prompts"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
