"use client";

import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { FieldHint, Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/select";
import type { Category } from "@/lib/schemas/category";
import { slugify } from "@/lib/utils/slug";

type Draft = {
  name: string;
  slug: string;
  description: string;
  icon: string;
  accentColor: string;
  order: number;
  isVisible: boolean;
};

const BLANK: Draft = {
  name: "",
  slug: "",
  description: "",
  icon: "folder",
  accentColor: "oklch(0.523 0.222 258)",
  order: 99,
  isVisible: true,
};

export function CategoriesClient({ initial }: { initial: Category[] }) {
  const [categories, setCategories] = useState(initial);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [busy, setBusy] = useState(false);

  function startEdit(category: Category) {
    setEditing(category.id);
    setDraft({
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      icon: category.icon ?? "folder",
      accentColor: category.accentColor ?? BLANK.accentColor,
      order: category.order ?? 0,
      isVisible: category.isVisible ?? true,
    });
  }

  async function save() {
    if (!draft.name.trim()) {
      toast.error("Give the category a name.");
      return;
    }

    const body = { ...draft, slug: draft.slug || slugify(draft.name) };
    setBusy(true);

    try {
      const isNew = editing === "new";
      const response = await fetch(
        isNew ? "/api/admin/categories" : `/api/admin/categories/${editing}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: { id: string };
      };

      if (!response.ok || !payload.ok) {
        toast.error(payload.error ?? "Couldn't save.");
        return;
      }

      if (isNew && payload.data) {
        setCategories((c) => [
          ...c,
          {
            ...body,
            id: payload.data!.id,
            promptCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as Category,
        ]);
      } else {
        setCategories((c) =>
          c.map((x) => (x.id === editing ? ({ ...x, ...body } as Category) : x)),
        );
      }

      toast.success(isNew ? "Category created" : "Category updated");
      setEditing(null);
      setDraft(BLANK);
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(category: Category) {
    if (!window.confirm(`Delete "${category.name}"?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        // The server refuses while prompts still point at it.
        toast.error(payload.error ?? "Couldn't delete.");
        return;
      }

      setCategories((c) => c.filter((x) => x.id !== category.id));
      toast.success("Category deleted");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {editing === null ? (
        <Button
          size="sm"
          onClick={() => {
            setEditing("new");
            setDraft({ ...BLANK, order: categories.length });
          }}
        >
          <Plus /> New category
        </Button>
      ) : (
        <Card>
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cat-name">Name</Label>
                <Input
                  id="cat-name"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      name: e.target.value,
                      slug: editing === "new" ? slugify(e.target.value) : d.slug,
                    }))
                  }
                  placeholder="Product Ads & Commercials"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-slug">Slug</Label>
                <Input
                  id="cat-slug"
                  value={draft.slug}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, slug: slugify(e.target.value) }))
                  }
                />
                <FieldHint>/categories/{draft.slug || "…"}</FieldHint>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea
                id="cat-desc"
                rows={2}
                value={draft.description}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, description: e.target.value }))
                }
                maxLength={200}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="cat-icon">Icon</Label>
                <Input
                  id="cat-icon"
                  value={draft.icon}
                  onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}
                  placeholder="package"
                />
                <FieldHint>A lucide icon name.</FieldHint>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-color">Accent</Label>
                <div className="flex items-center gap-2">
                  <span
                    className="size-9 shrink-0 rounded-lg border border-border"
                    style={{ background: draft.accentColor }}
                  />
                  <Input
                    id="cat-color"
                    value={draft.accentColor}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, accentColor: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-order">Order</Label>
                <Input
                  id="cat-order"
                  type="number"
                  value={draft.order}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, order: Number(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>

            <Switch
              id="cat-visible"
              checked={draft.isVisible}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, isVisible: v }))}
              label="Visible to members"
              description="Hidden categories keep their prompts but disappear from browsing."
            />

            <div className="flex gap-2">
              <Button onClick={save} disabled={busy} size="sm">
                {busy ? <Loader2 className="animate-spin" /> : <Check />} Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setDraft(BLANK);
                }}
              >
                <X /> Cancel
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <ul className="divide-y divide-border">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex flex-wrap items-center gap-3 p-3.5"
            >
              <span
                className="size-8 shrink-0 rounded-lg border border-border"
                style={{ background: category.accentColor }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">
                  {category.name}
                  {!category.isVisible ? (
                    <span className="ml-2 rounded bg-surface-3 px-1.5 py-0.5 text-[0.625rem] text-fg-subtle">
                      hidden
                    </span>
                  ) : null}
                </p>
                <p className="truncate font-mono text-xs text-fg-subtle">
                  {category.slug}
                </p>
              </div>
              <span className="shrink-0 font-mono text-xs tabular-nums text-fg-subtle">
                {category.promptCount} prompts
              </span>
              <Button variant="ghost" size="icon-sm" onClick={() => startEdit(category)}>
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-danger"
                disabled={busy}
                onClick={() => remove(category)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
