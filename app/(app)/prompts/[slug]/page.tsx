import { ArrowLeft, ImagePlus, SquareDashed } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PreviewMedia } from "@/components/media/preview-media";
import { CopyButton } from "@/components/prompt/copy-button";
import { PromptCard } from "@/components/prompt/prompt-card";
import { PromptTextBlock } from "@/components/prompt/prompt-text-block";
import { MetaChip, TypeBadge } from "@/components/prompt/type-badge";
import {
  getPromptBySlug,
  listRelatedPrompts,
} from "@/lib/firebase/queries";
import { safeQuery } from "@/lib/firebase/safe";
import type { Prompt } from "@/lib/schemas/prompt";

export async function generateMetadata({
  params,
}: PageProps<"/prompts/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const prompt = await safeQuery(() => getPromptBySlug(slug), null);

  if (!prompt || prompt.status !== "published") {
    return { title: "Prompt not found", robots: { index: false, follow: false } };
  }

  const title = prompt.seo?.title ?? prompt.title;
  const description =
    prompt.seo?.description ||
    prompt.description ||
    `A ${prompt.type} prompt for ${prompt.aiTool}, shown with its real output.`;

  const image =
    prompt.seo?.ogImageUrl ??
    (prompt.preview?.kind === "youtube"
      ? prompt.preview.thumbnailUrl
      : prompt.preview?.kind === "image"
        ? prompt.preview.url
        : undefined);

  return {
    title,
    description,
    alternates: { canonical: `/prompts/${prompt.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/prompts/${prompt.slug}`,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function PromptDetailPage({ params }: PageProps<"/prompts/[slug]">) {
  const { slug } = await params;
  const prompt = await safeQuery(() => getPromptBySlug(slug), null);

  // Drafts must never be reachable by URL.
  if (!prompt || prompt.status !== "published") notFound();

  const related = await safeQuery(() => listRelatedPrompts(prompt, 8), []);

  const meta = [
    { label: "AI tool", value: prompt.aiTool },
    { label: "Model", value: prompt.model },
    { label: "Aspect", value: prompt.aspectRatio },
    {
      label: "Duration",
      value: prompt.durationSeconds ? `${prompt.durationSeconds}s` : "",
    },
  ].filter((item) => Boolean(item.value));

  return (
    <>
      <JsonLd prompt={prompt} />

      <div className="container-page py-4 md:py-8">
        <Link
          href="/prompts"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-4" />
          All prompts
        </Link>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
          {/* ── Media ─────────────────────────────────────────────────── */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            {prompt.preview ? (
              <PreviewMedia
                media={prompt.preview}
                priority
                sizes="(max-width: 1024px) 100vw, 640px"
              />
            ) : (
              <div className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-border bg-surface-2">
                <p className="text-sm text-fg-subtle">No preview available</p>
              </div>
            )}

            {meta.length > 0 ? (
              <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
                {meta.map((item) => (
                  <div key={item.label} className="bg-surface px-3 py-3.5">
                    <dt className="eyebrow">{item.label}</dt>
                    <dd className="mt-1 truncate font-mono text-[0.8125rem] font-medium tabular-nums text-fg">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          {/* ── Content ───────────────────────────────────────────────── */}
          <div className="min-w-0 space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <TypeBadge type={prompt.type} />
                <Link href={{ pathname: `/categories/${prompt.categorySlug}` }}>
                  <MetaChip className="transition-colors hover:bg-surface-3">
                    {prompt.categorySlug.replace(/-/g, " ")}
                  </MetaChip>
                </Link>
              </div>

              <h1 className="mt-3 text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-[1.15] tracking-tight">
                {prompt.title}
              </h1>

              {prompt.description ? (
                <p className="mt-3 text-base text-fg-muted">{prompt.description}</p>
              ) : null}
            </div>

            {(prompt.requiresReferenceImage || prompt.hasPlaceholders) && (
              <div className="space-y-2">
                {prompt.requiresReferenceImage ? (
                  <Callout Icon={ImagePlus} tone="warning">
                    Upload a reference image in your AI tool before running this prompt.
                  </Callout>
                ) : null}
                {prompt.hasPlaceholders ? (
                  <Callout Icon={SquareDashed} tone="accent">
                    This is a template — replace the bracketed placeholders with your own
                    details.
                  </Callout>
                ) : null}
              </div>
            )}

            <PromptTextBlock text={prompt.promptText} promptId={prompt.id} />

            {prompt.negativePrompt ? (
              <PromptTextBlock
                text={prompt.negativePrompt}
                title="Negative prompt"
                promptId={prompt.id}
                collapsible={false}
              />
            ) : null}

            {prompt.usageNotes ? (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                  How to use
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-fg-muted">
                  {prompt.usageNotes}
                </p>
              </section>
            ) : null}

            {prompt.tags.length > 0 ? (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                  Tags
                </h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {prompt.tags.map((tag) => (
                    <MetaChip key={tag}>{tag}</MetaChip>
                  ))}
                </div>
              </section>
            ) : null}

            {prompt.attribution?.source ? (
              <p className="text-xs text-fg-subtle">
                Source:{" "}
                {prompt.attribution.url ? (
                  <a
                    href={prompt.attribution.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-fg-muted underline underline-offset-4 transition-colors hover:text-fg"
                  >
                    {prompt.attribution.source}
                  </a>
                ) : (
                  <span className="text-fg-muted">{prompt.attribution.source}</span>
                )}
              </p>
            ) : null}
          </div>
        </div>

        {related.length > 0 ? (
          <section className="mt-14">
            <h2 className="mb-4 text-lg font-semibold tracking-tight">
              More like this
            </h2>
            <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0">
              {related.map((item) => (
                <div
                  key={item.id}
                  className="w-[58vw] shrink-0 snap-start sm:w-[40vw] lg:w-auto"
                >
                  <PromptCard prompt={item} />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {/* Sticky copy bar — always reachable with a thumb on mobile. */}
      <div className="safe-bottom fixed inset-x-0 bottom-[3.25rem] z-30 border-t border-border bg-bg/90 p-3 backdrop-blur-lg md:hidden">
        <CopyButton text={prompt.promptText} promptId={prompt.id} size="lg" full />
      </div>
      <div className="h-24 md:hidden" aria-hidden />
    </>
  );
}

function Callout({
  Icon,
  tone,
  children,
}: {
  Icon: typeof ImagePlus;
  tone: "warning" | "accent";
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        tone === "warning"
          ? "flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/8 p-3"
          : "flex items-start gap-2.5 rounded-lg border border-accent/30 bg-accent-soft p-3"
      }
    >
      <Icon
        className={
          tone === "warning"
            ? "mt-0.5 size-4 shrink-0 text-warning"
            : "mt-0.5 size-4 shrink-0 text-accent"
        }
      />
      <p className="text-sm text-fg-muted">{children}</p>
    </div>
  );
}

/** Structured data so the prompt can surface as a rich result. */
function JsonLd({ prompt }: { prompt: Prompt }) {
  const image =
    prompt.preview?.kind === "youtube"
      ? prompt.preview.thumbnailUrl
      : prompt.preview?.kind === "image"
        ? prompt.preview.url
        : undefined;

  const data = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: prompt.title,
    description: prompt.description || undefined,
    thumbnailUrl: image,
    keywords: [prompt.aiTool, prompt.type, ...prompt.tags].filter(Boolean).join(", "),
    datePublished: prompt.publishedAt ?? undefined,
    dateModified: prompt.updatedAt,
    isAccessibleForFree: true,
  };

  return (
    <script
      type="application/ld+json"
      // Serialised from our own typed object, never from user HTML. `<` is
      // escaped so a title can't break out of the script element.
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
