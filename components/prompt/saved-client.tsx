"use client";

import { Heart } from "lucide-react";
import Link from "next/link";

import { MasonryGrid } from "@/components/prompt/masonry-grid";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { useSaved } from "@/hooks/use-saved";
import type { Prompt } from "@/lib/schemas/prompt";

export function SavedClient({ prompts }: { prompts: Prompt[] }) {
  const { saved } = useSaved();
  const hydrated = useHydrated();

  // The saved list lives in localStorage, so it is unknowable on the server.
  if (!hydrated) {
    return (
      <div className="columns-2 gap-3 lg:columns-3 lg:gap-5 xl:columns-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="mb-3 h-64 animate-pulse rounded-xl bg-surface-2 lg:mb-5"
          />
        ))}
      </div>
    );
  }

  const savedPrompts = prompts.filter((prompt) => saved.includes(prompt.id));

  if (savedPrompts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface-2 px-6 py-16 text-center">
        <Heart className="mx-auto size-7 text-fg-subtle" />
        <p className="mt-3 font-medium">Nothing saved yet</p>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-fg-muted">
          Tap the heart on any prompt to keep it here for later.
        </p>
        <Button variant="outline" className="mt-5" asChild>
          <Link href="/prompts">Browse prompts</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 text-sm text-fg-muted">
        {savedPrompts.length} {savedPrompts.length === 1 ? "prompt" : "prompts"}
      </p>
      <MasonryGrid prompts={savedPrompts} />
    </>
  );
}
