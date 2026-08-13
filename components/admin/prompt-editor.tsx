"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { MediaPicker } from "@/components/admin/media-picker";
import { PromptPreview } from "@/components/admin/prompt-preview";
import { TagInput } from "@/components/admin/tag-input";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, FieldHint, Input, Label, Textarea } from "@/components/ui/input";
import { Select, Switch } from "@/components/ui/select";
import { AI_TOOLS, ASPECT_RATIOS } from "@/lib/constants/site";
import type { Category } from "@/lib/schemas/category";
import type { PreviewMedia } from "@/lib/schemas/media";
import {
  detectPlaceholders,
  promptInputSchema,
  toPromptInput,
  type Prompt,
  type PromptInput,
} from "@/lib/schemas/prompt";
import { cleanPromptText, wordCount } from "@/lib/utils/clean-text";
import { slugify } from "@/lib/utils/slug";

/**
 * The editor works entirely in `undefined` space for absent values. Firestore
 * hands back `null`, so `toDraft` normalises on the way in — otherwise controls
 * like MediaPicker receive a `null` they aren't typed for.
 */
type Draft = Omit<PromptInput, "preview" | "attribution"> & {
  preview?: PreviewMedia;
  attribution?: { source?: string; handle?: string; url?: string };
};

const AUTOSAVE_DELAY_MS = 20_000;

function emptyDraft(categories: Category[]): Draft {
  const first = categories[0];
  return {
    title: "",
    slug: "",
    description: "",
    promptText: "",
    negativePrompt: "",
    usageNotes: "",
    type: "video",
    categoryId: first?.id ?? "",
    categorySlug: first?.slug ?? "",
    tags: [],
    aiTool: "",
    model: "",
    aspectRatio: "9:16",
    durationSeconds: undefined,
    requiresReferenceImage: false,
    hasPlaceholders: false,
    preview: undefined,
    gallery: [],
    attribution: undefined,
    status: "draft",
    featured: false,
  };
}

function toDraft(prompt: Prompt): Draft {
  // Picks only schema keys and normalises null → undefined, so server-owned
  // fields on the stored document can never reach the strict input schema.
  return {
    ...emptyDraft([]),
    ...toPromptInput(prompt as unknown as Record<string, unknown>),
  } as Draft;
}

export function PromptEditor({
  categories,
  prompt,
}: {
  categories: Category[];
  prompt?: Prompt;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() =>
    prompt ? toDraft(prompt) : emptyDraft(categories),
  );
  const [id, setId] = useState<string | undefined>(prompt?.id);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [issues, setIssues] = useState<string[]>([]);
  const [slugTouched, setSlugTouched] = useState(Boolean(prompt));

  const dirtyRef = useRef(false);

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    dirtyRef.current = true;
    setDraft((current) => ({ ...current, [key]: value }));
  }, []);

  /**
   * The slug follows the title until the admin edits it by hand. Derived
   * during render rather than synced in an effect — storing it would mean a
   * cascading re-render on every keystroke in the title field.
   */
  const slug = slugTouched ? draft.slug : slugify(draft.title);

  const placeholders = useMemo(
    () => detectPlaceholders(draft.promptText),
    [draft.promptText],
  );

  const save = useCallback(
    async (options: { publish?: boolean; silent?: boolean } = {}) => {
      const next: Draft = {
        ...draft,
        slug,
        hasPlaceholders: placeholders.length > 0,
        ...(options.publish ? { status: "published" as const } : {}),
      };

      // Drafts may be incomplete; publishing must pass the full schema.
      if (options.publish || next.status === "published") {
        const parsed = promptInputSchema.safeParse(next);
        if (!parsed.success) {
          const fieldErrors: Record<string, string> = {};
          const summary: string[] = [];
          for (const issue of parsed.error.issues) {
            const key = String(issue.path[0] ?? "form");
            fieldErrors[key] ??= issue.message;
            // Some fields have no visible input (derived or nested values).
            // Listing every issue means a failure can never be invisible.
            summary.push(`${issue.path.join(".") || "form"}: ${issue.message}`);
          }
          setErrors(fieldErrors);
          setIssues(summary);
          toast.error(
            summary.length === 1 ? summary[0]! : `${summary.length} fields need attention`,
          );
          return false;
        }
        setIssues([]);
      }

      if (!next.title.trim()) {
        if (!options.silent) toast.error("Give the prompt a title first.");
        return false;
      }

      setErrors({});
      setIssues([]);
      setSaving(true);

      try {
        const response = await fetch(
          id ? `/api/admin/prompts/${id}` : "/api/admin/prompts",
          {
            method: id ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(next),
          },
        );

        const payload = (await response.json()) as {
          ok: boolean;
          error?: string;
          data?: { id: string; slug: string };
        };

        if (!response.ok || !payload.ok || !payload.data) {
          toast.error(payload.error ?? "Couldn't save.");
          return false;
        }

        dirtyRef.current = false;
        setLastSaved(new Date());
        // The server may have deduplicated the slug; adopt whatever it stored
        // and stop deriving from the title.
        setSlugTouched(true);
        setDraft((current) => ({
          ...current,
          slug: payload.data!.slug,
          ...(options.publish ? { status: "published" as const } : {}),
        }));

        if (!id) {
          setId(payload.data.id);
          // Move to the edit URL so a refresh doesn't create a duplicate.
          window.history.replaceState(null, "", `/admin/prompts/${payload.data.id}`);
        }

        if (!options.silent) {
          toast.success(options.publish ? "Published" : "Saved");
        }
        router.refresh();
        return true;
      } catch {
        toast.error("Network error while saving.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [draft, slug, id, placeholders.length, router],
  );

  // Autosave existing prompts only — a new prompt shouldn't create a row until
  // the admin has actually committed to it.
  useEffect(() => {
    if (!id) return;
    const timer = setInterval(() => {
      if (dirtyRef.current && !saving) void save({ silent: true });
    }, AUTOSAVE_DELAY_MS);
    return () => clearInterval(timer);
  }, [id, save, saving]);

  // Guard against losing work on a stray tab close.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  async function handleDelete() {
    if (!id) return;
    if (!window.confirm("Delete this prompt? This can't be undone.")) return;

    const response = await fetch(`/api/admin/prompts/${id}`, { method: "DELETE" });
    if (response.ok) {
      dirtyRef.current = false;
      toast.success("Prompt deleted");
      router.push("/admin/prompts");
    } else {
      toast.error("Couldn't delete that prompt.");
    }
  }

  function applyCleanup() {
    const result = cleanPromptText(draft.promptText);
    if (!result.changed) {
      toast.info("Nothing to clean up — the text already looks good.");
      return;
    }
    set("promptText", result.text);
    toast.success(
      `Cleaned up: ${result.fixes.map((f) => f.label.toLowerCase()).join(", ")}`,
    );
  }

  const isPublished = draft.status === "published";

  return (
    <div className="mx-auto max-w-[100rem]">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/admin/prompts" aria-label="Back to prompts">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {id ? "Edit prompt" : "New prompt"}
            </h1>
            <p className="text-xs text-fg-muted">
              <span
                className={
                  isPublished ? "font-medium text-success" : "font-medium text-warning"
                }
              >
                {isPublished ? "Published" : "Draft"}
              </span>
              {lastSaved ? ` · saved ${lastSaved.toLocaleTimeString()}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {id && isPublished ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href={{ pathname: `/prompts/${slug}` }} target="_blank">
                <Eye /> View
              </Link>
            </Button>
          ) : null}
          {id ? (
            <Button variant="ghost" size="sm" className="text-danger" onClick={handleDelete}>
              <Trash2 />
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => save()} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Save draft
          </Button>
          <Button size="sm" onClick={() => save({ publish: true })} disabled={saving}>
            <Sparkles />
            {isPublished ? "Update" : "Publish"}
          </Button>
        </div>
      </header>

      {issues.length > 0 ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-danger/40 bg-danger/8 p-4"
        >
          <p className="flex items-center gap-2 text-sm font-medium text-danger">
            <AlertTriangle className="size-4" />
            Can&rsquo;t publish yet
          </p>
          <ul className="mt-2 space-y-1">
            {issues.map((issue) => (
              <li key={issue} className="font-mono text-xs text-fg-muted">
                {issue}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        {/* ── Form ─────────────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Basics</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">
                  Title <span className="text-danger">*</span>
                </Label>
                <Input
                  id="title"
                  value={draft.title}
                  onChange={(event) => set("title", event.target.value)}
                  aria-invalid={Boolean(errors.title)}
                  placeholder="Cinematic Desert SUV Jump"
                  maxLength={90}
                />
                <FieldError>{errors.title}</FieldError>
                <FieldHint>
                  URL: <span className="font-mono">/prompts/{slug || "…"}</span>
                </FieldHint>
              </div>


              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={2}
                  value={draft.description}
                  onChange={(event) => set("description", event.target.value)}
                  placeholder="A wide cinematic shot of a man calmly seated as an SUV soars overhead."
                  maxLength={280}
                />
                <FieldHint>{draft.description.length}/280 · shown on cards and in search results</FieldHint>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="type">
                    Type <span className="text-danger">*</span>
                  </Label>
                  <Select
                    id="type"
                    value={draft.type}
                    onChange={(event) =>
                      set("type", event.target.value as Draft["type"])
                    }
                  >
                    <option value="video">Video</option>
                    <option value="image">Image</option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="category">
                    Category <span className="text-danger">*</span>
                  </Label>
                  <Select
                    id="category"
                    value={draft.categoryId}
                    onChange={(event) => {
                      const category = categories.find((c) => c.id === event.target.value);
                      if (!category) return;
                      dirtyRef.current = true;
                      setDraft((current) => ({
                        ...current,
                        categoryId: category.id,
                        categorySlug: category.slug,
                      }));
                    }}
                    aria-invalid={Boolean(errors.categoryId)}
                  >
                    {categories.length === 0 ? (
                      <option value="">No categories yet</option>
                    ) : null}
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                  <FieldError>{errors.categoryId}</FieldError>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Tags</Label>
                <TagInput value={draft.tags} onChange={(tags) => set("tags", tags)} />
                <FieldHint>Up to 8. Used for filtering and search.</FieldHint>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between gap-3">
              <CardTitle>Prompt</CardTitle>
              <Button variant="ghost" size="sm" onClick={applyCleanup}>
                <Wand2 /> Clean up text
              </Button>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="promptText">
                  Prompt text <span className="text-danger">*</span>
                </Label>
                <Textarea
                  id="promptText"
                  rows={14}
                  value={draft.promptText}
                  onChange={(event) => set("promptText", event.target.value)}
                  aria-invalid={Boolean(errors.promptText)}
                  className="prompt-text"
                  placeholder="A cinematic wide shot of…"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <FieldHint>
                    {draft.promptText.length.toLocaleString()} characters ·{" "}
                    {wordCount(draft.promptText).toLocaleString()} words
                  </FieldHint>
                  <FieldError>{errors.promptText}</FieldError>
                </div>

                {placeholders.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/8 p-2.5">
                    <AlertTriangle className="size-4 shrink-0 text-warning" />
                    <span className="text-xs text-fg-muted">
                      Template placeholders found:
                    </span>
                    {placeholders.slice(0, 6).map((token) => (
                      <code
                        key={token}
                        className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.6875rem] text-fg"
                      >
                        {token}
                      </code>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="negativePrompt">Negative prompt</Label>
                <Textarea
                  id="negativePrompt"
                  rows={3}
                  value={draft.negativePrompt}
                  onChange={(event) => set("negativePrompt", event.target.value)}
                  className="prompt-text"
                  placeholder="No jitter, no anime, no deformation, no blur…"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="usageNotes">How to use</Label>
                <Textarea
                  id="usageNotes"
                  rows={2}
                  value={draft.usageNotes}
                  onChange={(event) => set("usageNotes", event.target.value)}
                  placeholder="Upload your product photo as the first reference image."
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview media</CardTitle>
            </CardHeader>
            <CardBody>
              <MediaPicker
                value={draft.preview}
                onChange={(media) => set("preview", media)}
                alt={draft.preview?.kind === "image" ? draft.preview.alt : ""}
                onAltChange={(alt) => {
                  if (draft.preview?.kind !== "image") return;
                  set("preview", { ...draft.preview, alt });
                }}
              />
              <FieldError>{errors.preview}</FieldError>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Generation metadata <span className="font-normal text-fg-subtle">· optional</span></CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="aiTool">AI tool</Label>
                  <Input
                    id="aiTool"
                    list="ai-tools"
                    value={draft.aiTool ?? ""}
                    onChange={(event) => set("aiTool", event.target.value)}
                    aria-invalid={Boolean(errors.aiTool)}
                    placeholder="Veo 3.1"
                  />
                  <datalist id="ai-tools">
                    {AI_TOOLS.map((tool) => (
                      <option key={tool} value={tool} />
                    ))}
                  </datalist>
                  <FieldError>{errors.aiTool}</FieldError>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={draft.model ?? ""}
                    onChange={(event) => set("model", event.target.value)}
                    placeholder="veo-3.1-fast"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="aspectRatio">Aspect ratio</Label>
                  <Select
                    id="aspectRatio"
                    value={draft.aspectRatio ?? ""}
                    onChange={(event) =>
                      set(
                        "aspectRatio",
                        (event.target.value || undefined) as Draft["aspectRatio"],
                      )
                    }
                  >
                    <option value="">Not specified</option>
                    {ASPECT_RATIOS.map((ratio) => (
                      <option key={ratio} value={ratio}>
                        {ratio}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="duration">Duration (seconds)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={1}
                    max={600}
                    value={draft.durationSeconds ?? ""}
                    onChange={(event) =>
                      set(
                        "durationSeconds",
                        event.target.value ? Number(event.target.value) : undefined,
                      )
                    }
                    placeholder="10"
                  />
                </div>
              </div>

              <Switch
                id="requiresReferenceImage"
                checked={draft.requiresReferenceImage}
                onCheckedChange={(checked) => set("requiresReferenceImage", checked)}
                label="Requires a reference image"
                description="Shows a badge so users know they need to upload something first."
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attribution &amp; publishing</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="attributionSource">Credit (optional)</Label>
                  <Input
                    id="attributionSource"
                    value={draft.attribution?.source ?? ""}
                    onChange={(event) =>
                      set("attribution", {
                        ...draft.attribution,
                        source: event.target.value || undefined,
                      })
                    }
                    placeholder="actionables.ai"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="attributionUrl">Credit link (optional)</Label>
                  <Input
                    id="attributionUrl"
                    type="url"
                    value={draft.attribution?.url ?? ""}
                    onChange={(event) =>
                      set("attribution", {
                        ...draft.attribution,
                        url: event.target.value || undefined,
                      })
                    }
                    placeholder="https://instagram.com/…"
                  />
                </div>
              </div>

              <Switch
                id="featured"
                checked={draft.featured}
                onCheckedChange={(checked) => set("featured", checked)}
                label="Feature on the home page"
                description="Appears in the featured rail above the latest grid."
              />
            </CardBody>
          </Card>
        </div>

        {/* ── Live preview ─────────────────────────────────────────────── */}
        <div className="xl:sticky xl:top-6 xl:self-start">
          <PromptPreview
            draft={draft}
            categoryName={
              categories.find((c) => c.id === draft.categoryId)?.name ?? "Uncategorised"
            }
          />
        </div>
      </div>
    </div>
  );
}
