"use client";

import { ImageOff, Monitor, Smartphone } from "lucide-react";
import { useState } from "react";

import { PreviewMedia } from "@/components/media/preview-media";
import { PromptTextBlock } from "@/components/prompt/prompt-text-block";
import { MetaChip, TypeBadge } from "@/components/prompt/type-badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import type { PreviewMedia as PreviewMediaValue } from "@/lib/schemas/media";
import type { PromptInput } from "@/lib/schemas/prompt";
import { cn } from "@/lib/utils/cn";

type Draft = Omit<PromptInput, "preview"> & { preview?: PreviewMediaValue };

/**
 * Live preview of the public prompt page, rendered from the in-progress draft.
 *
 * Deliberately reuses the real public components, so what the admin sees is
 * what visitors get. The width and theme toggles let both layouts and both
 * colour schemes be checked before publishing.
 */
export function PromptPreview({
  draft,
  categoryName,
}: {
  draft: Draft;
  categoryName: string;
}) {
  const [width, setWidth] = useState<"mobile" | "desktop">("mobile");
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  const meta = [
    draft.aiTool,
    draft.aspectRatio,
    draft.durationSeconds ? `${draft.durationSeconds}s` : null,
  ].filter(Boolean) as string[];

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Live preview</CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant={width === "mobile" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setWidth("mobile")}
            aria-label="Mobile width"
          >
            <Smartphone />
          </Button>
          <Button
            variant={width === "desktop" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setWidth("desktop")}
            aria-label="Desktop width"
          >
            <Monitor />
          </Button>
          <span className="mx-1 h-5 w-px bg-border" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "Dark" : "Light"}
          </Button>
        </div>
      </CardHeader>

      <CardBody className="bg-surface-2">
        {/*
          `theme` here is scoped to this subtree, so the admin can inspect the
          public dark rendering without leaving their own light workspace.
        */}
        <div
          className={cn(
            "mx-auto overflow-hidden rounded-xl border border-border bg-bg transition-[max-width] duration-200",
            theme === "dark" ? "dark" : "",
            width === "mobile" ? "max-w-[22rem]" : "max-w-full",
          )}
        >
          <div className="space-y-4 p-4">
            {draft.preview ? (
              <PreviewMedia media={draft.preview} sizes="352px" />
            ) : (
              <div className="grid aspect-[9/16] max-h-72 place-items-center rounded-xl border border-dashed border-border bg-surface-2">
                <div className="text-center">
                  <ImageOff className="mx-auto size-6 text-fg-subtle" />
                  <p className="mt-2 text-xs text-fg-subtle">No preview yet</p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <TypeBadge type={draft.type} size="sm" />
              <MetaChip className="text-[0.6875rem]">{categoryName}</MetaChip>
              {draft.requiresReferenceImage ? (
                <MetaChip className="bg-warning/12 text-[0.6875rem] text-warning">
                  Needs reference
                </MetaChip>
              ) : null}
            </div>

            <div>
              <h3 className="text-lg font-semibold leading-tight tracking-tight text-fg">
                {draft.title || "Untitled prompt"}
              </h3>
              {draft.description ? (
                <p className="mt-1.5 text-sm text-fg-muted">{draft.description}</p>
              ) : null}
            </div>

            {meta.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {meta.map((item) => (
                  <MetaChip key={item} className="text-[0.6875rem]">
                    {item}
                  </MetaChip>
                ))}
              </div>
            ) : null}

            {draft.promptText ? (
              <PromptTextBlock text={draft.promptText} maxHeight={260} />
            ) : (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-fg-subtle">
                The prompt text will appear here.
              </p>
            )}

            {draft.negativePrompt ? (
              <PromptTextBlock
                text={draft.negativePrompt}
                title="Negative prompt"
                collapsible={false}
              />
            ) : null}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
