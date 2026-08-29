"use client";

import { Check, Loader2, Pencil, Tags as TagsIcon, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { FieldHint, Input } from "@/components/ui/input";
import { slugify } from "@/lib/utils/slug";

type TagRow = { slug: string; count: number };

export function TagsClient({ initial }: { initial: TagRow[] }) {
  const [tags, setTags] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function apply(from: string, to: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/tags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: { updated: number };
      };

      if (!response.ok || !payload.ok) {
        toast.error(payload.error ?? "Couldn't update that tag.");
        return;
      }

      setTags((current) => {
        const removed = current.filter((t) => t.slug !== from);
        if (!to) return removed;

        // Renaming onto an existing tag merges the counts.
        const existing = removed.find((t) => t.slug === to);
        const moved = current.find((t) => t.slug === from)?.count ?? 0;

        return existing
          ? removed.map((t) => (t.slug === to ? { ...t, count: t.count + moved } : t))
          : [...removed, { slug: to, count: moved }].sort(
              (a, b) => b.count - a.count || a.slug.localeCompare(b.slug),
            );
      });

      toast.success(
        to
          ? `Renamed on ${payload.data?.updated ?? 0} prompts`
          : `Removed from ${payload.data?.updated ?? 0} prompts`,
      );
      setEditing(null);
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (tags.length === 0) {
    return (
      <Card>
        <CardBody className="py-12 text-center">
          <TagsIcon className="mx-auto size-6 text-fg-subtle" />
          <p className="mt-3 text-sm text-fg-muted">
            No tags yet. Add them on a prompt and they&rsquo;ll appear here.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <ul className="divide-y divide-border">
        {tags.map((tag) => (
          <li key={tag.slug} className="flex flex-wrap items-center gap-3 p-3.5">
            {editing === tag.slug ? (
              <>
                <Input
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(slugify(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") apply(tag.slug, value);
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="max-w-56"
                />
                <Button
                  size="sm"
                  disabled={busy || !value || value === tag.slug}
                  onClick={() => apply(tag.slug, value)}
                >
                  {busy ? <Loader2 className="animate-spin" /> : <Check />} Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                  <X />
                </Button>
                <FieldHint>
                  Renaming onto an existing tag merges them.
                </FieldHint>
              </>
            ) : (
              <>
                <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                  {tag.slug}
                </span>
                <span className="font-mono text-xs tabular-nums text-fg-subtle">
                  {tag.count} prompt{tag.count === 1 ? "" : "s"}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setEditing(tag.slug);
                      setValue(tag.slug);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-danger"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove "${tag.slug}" from ${tag.count} prompt${tag.count === 1 ? "" : "s"}?`,
                        )
                      ) {
                        apply(tag.slug, "");
                      }
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
