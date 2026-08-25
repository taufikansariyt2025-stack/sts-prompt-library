import { ArrowUpRight, Play, Wrench } from "lucide-react";
import Link from "next/link";
import NextImage from "next/image";

import { CopyButton } from "@/components/prompt/copy-button";
import { TypeBadge } from "@/components/prompt/type-badge";
import type { Prompt } from "@/lib/schemas/prompt";
import { cn } from "@/lib/utils/cn";
import { shouldSkipOptimizer } from "@/lib/utils/media";

/**
 * Masonry tile.
 *
 * Two shapes, chosen by whether the prompt actually has preview media:
 *
 *  · WITH media  — media panel leads, spec block beneath. The output sells the
 *                  prompt, so it gets the space.
 *  · WITHOUT     — a compact, text-forward card. Reserving a large empty panel
 *                  for media that doesn't exist makes a grid look broken; a
 *                  denser card looks deliberate and scans better.
 *
 * Dimensions come from the stored document so a tile reserves its space before
 * the image loads, which keeps CLS ~0.
 */
export function PromptCard({
  prompt,
  index,
  priority = false,
  className,
}: {
  prompt: Prompt;
  /** 1-based grid position, shown as the card's index chip. */
  index?: number;
  priority?: boolean;
  className?: string;
}) {
  // Narrow on `preview` itself, not on a derived `src`, so TypeScript can
  // prove the media branch below is safe.
  const preview = prompt.preview ?? null;

  const shell = cn(
    "group relative isolate overflow-hidden rounded-xl border border-border bg-surface",
    "transition-[transform,border-color,box-shadow] duration-300 ease-[var(--ease-out-quint)]",
    "hover:-translate-y-1 hover:border-accent/45 hover:shadow-e3",
    className,
  );

  const indexChip =
    index === undefined ? null : (
      <span className="grid h-6 min-w-6 place-items-center rounded-md border border-border bg-surface-2 px-1.5 font-mono text-[0.6875rem] font-medium tabular-nums text-fg-subtle">
        {String(index).padStart(2, "0")}
      </span>
    );

  const footer = (
    <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5">
      <span className="flex min-w-0 items-center gap-1.5 text-[0.75rem] text-fg-subtle">
        <Wrench className="size-3 shrink-0" />
        <span className="truncate">{prompt.aiTool || "Any tool"}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-[0.75rem] font-medium text-fg-subtle transition-colors duration-200 group-hover:text-accent">
        {prompt.aspectRatio ? (
          <span className="font-mono tabular-nums">{prompt.aspectRatio}</span>
        ) : null}
        {prompt.durationSeconds ? (
          <span className="font-mono tabular-nums">{prompt.durationSeconds}s</span>
        ) : null}
        <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
    </div>
  );

  // ── Compact, no-media variant ────────────────────────────────────────────
  if (!preview) {
    return (
      <article className={shell}>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(80% 60% at 0% 0%, var(--accent-soft), transparent 62%)",
          }}
        />
        <Link
          href={{ pathname: `/prompts/${prompt.slug}` }}
          className="relative block space-y-3 p-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            {indexChip}
            <TypeBadge type={prompt.type} size="sm" />
          </div>

          <h3 className="line-clamp-3 text-[0.9375rem] font-semibold leading-snug tracking-tight text-fg transition-colors duration-200 group-hover:text-accent">
            {prompt.title}
          </h3>

          <p className="line-clamp-3 font-mono text-[0.6875rem] leading-relaxed text-fg-subtle">
            {prompt.description || prompt.promptText.slice(0, 150)}
          </p>

          {footer}
        </Link>
      </article>
    );
  }

  // ── Media-led variant ────────────────────────────────────────────────────
  const isYouTube = preview.kind === "youtube";
  const src = isYouTube ? preview.thumbnailUrl : preview.url;

  const ratio = isYouTube
    ? preview.format === "short"
      ? 9 / 16
      : 16 / 9
    : preview.kind === "image"
      ? preview.width / preview.height
      : 4 / 3;

  return (
    <article className={shell}>
      <Link href={{ pathname: `/prompts/${prompt.slug}` }} className="block">
        <div className="media-frame w-full" style={{ aspectRatio: ratio }}>
          <NextImage
            src={src}
            alt={preview.kind === "image" ? preview.alt : ""}
            fill
            priority={priority}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            placeholder={
              preview.kind === "image" && preview.blurDataURL ? "blur" : "empty"
            }
            blurDataURL={
              preview.kind === "image" ? preview.blurDataURL || undefined : undefined
            }
            unoptimized={
              preview.kind === "image"
                ? shouldSkipOptimizer(preview.url, preview.source)
                : false
            }
            className="object-cover transition-transform duration-500 ease-[var(--ease-out-quint)] group-hover:scale-[1.04]"
          />

          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/20 opacity-80" />

          {index !== undefined ? (
            <span className="pointer-events-none absolute left-3 top-3 grid h-7 min-w-7 place-items-center rounded-md border border-white/20 bg-black/55 px-1.5 font-mono text-xs font-medium tabular-nums text-white backdrop-blur-sm">
              {String(index).padStart(2, "0")}
            </span>
          ) : null}

          <TypeBadge
            type={prompt.type}
            size="sm"
            className="pointer-events-none absolute right-3 top-3 border border-white/20 !bg-black/55 !text-white backdrop-blur-sm"
          />

          {isYouTube ? (
            <span className="pointer-events-none absolute inset-0 grid place-items-center">
              <span className="grid size-12 place-items-center rounded-full border border-white/25 bg-black/45 backdrop-blur-sm transition-transform duration-300 ease-[var(--ease-out-quint)] group-hover:scale-110">
                <Play className="size-4 translate-x-px fill-white text-white" />
              </span>
            </span>
          ) : null}
        </div>

        <div className="space-y-2.5 p-3.5">
          <h3 className="line-clamp-2 text-[0.9375rem] font-semibold leading-snug tracking-tight text-fg transition-colors duration-200 group-hover:text-accent">
            {prompt.title}
          </h3>
          {prompt.description ? (
            <p className="line-clamp-2 text-[0.8125rem] leading-relaxed text-fg-muted">
              {prompt.description}
            </p>
          ) : null}
          {footer}
        </div>
      </Link>

      <div className="absolute right-3 top-3 translate-y-1 opacity-0 transition-[opacity,transform] duration-200 focus-within:translate-y-0 focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100">
        <CopyButton
          text={prompt.promptText}
          promptId={prompt.id}
          label={`Copy ${prompt.title}`}
          iconOnly
          variant="secondary"
          className="border border-white/20 !bg-black/60 !text-white backdrop-blur-sm hover:!bg-accent hover:!text-accent-fg"
        />
      </div>
    </article>
  );
}
