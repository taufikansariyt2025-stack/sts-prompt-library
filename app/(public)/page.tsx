import { ArrowRight, Clapperboard, ImageIcon, Layers, Sparkles, Zap } from "lucide-react";
import Link from "next/link";

import { MasonryGrid } from "@/components/prompt/masonry-grid";
import { PromptCard } from "@/components/prompt/prompt-card";
import { Button } from "@/components/ui/button";
import { getSiteSettings, listCategories, listPrompts } from "@/lib/firebase/queries";
import { safeQuery } from "@/lib/firebase/safe";
import { DEFAULT_SETTINGS } from "@/lib/schemas/settings";

// ISR: rebuilt hourly, and immediately on publish via revalidateTag.
export const revalidate = 3600;

export default async function HomePage() {
  const [settings, featured, latest, categories] = await Promise.all([
    safeQuery(() => getSiteSettings(), DEFAULT_SETTINGS),
    safeQuery(() => listPrompts({ featured: true, sort: "featured", limit: 8 }), []),
    safeQuery(() => listPrompts({ limit: 24 }), []),
    safeQuery(() => listCategories(), []),
  ]);

  const videoCount = latest.filter((p) => p.type === "video").length;
  const imageCount = latest.length - videoCount;
  const isEmpty = latest.length === 0 && featured.length === 0;

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="grid-bg relative overflow-hidden border-b border-border">
        <div className="container-page relative pb-14 pt-14 md:pb-20 md:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="fade-up inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft/60 px-3.5 py-1.5 backdrop-blur-sm">
              <Sparkles className="size-3.5 text-accent" />
              <span className="eyebrow !text-accent">The AI prompt operating system</span>
            </span>

            <h1
              className="fade-up mt-6 text-[clamp(2.5rem,7vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.04em]"
              style={{ animationDelay: "60ms" }}
            >
              <span className="block">{settings.ui.homeHeroHeadline}</span>
              <span className="mt-1 block bg-gradient-to-r from-accent via-accent to-image bg-clip-text text-transparent">
                Copy. Paste. Ship.
              </span>
            </h1>

            <p
              className="fade-up mx-auto mt-5 max-w-xl text-base leading-relaxed text-fg-muted md:text-lg"
              style={{ animationDelay: "120ms" }}
            >
              {settings.ui.homeHeroSubline}
            </p>

            <div
              className="fade-up mt-8 flex flex-wrap justify-center gap-3"
              style={{ animationDelay: "180ms" }}
            >
              <Button size="lg" className="glow-accent" asChild>
                <Link href="/prompts">
                  Browse the library <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/search">Search prompts</Link>
              </Button>
            </div>

            {/* ── Stat tiles ────────────────────────────────────────────── */}
            <div
              className="fade-up mx-auto mt-12 grid max-w-lg grid-cols-3 gap-2.5"
              style={{ animationDelay: "240ms" }}
            >
              <Stat icon={Layers} value={latest.length || "—"} label="Prompts" />
              <Stat icon={Clapperboard} value={videoCount || "—"} label="Video" />
              <Stat icon={ImageIcon} value={imageCount || "—"} label="Image" />
            </div>
          </div>
        </div>
      </section>

      {isEmpty ? (
        <EmptyLibrary />
      ) : (
        <>
          {/* ── Category rail ─────────────────────────────────────────── */}
          {categories.length > 0 ? (
            <section className="border-b border-border bg-surface/40 backdrop-blur-sm">
              <div className="container-page py-3.5">
                <div className="rail-mask scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
                  <Link
                    href="/prompts"
                    className="shrink-0 rounded-full border border-accent bg-accent px-3.5 py-1.5 text-[0.8125rem] font-medium text-accent-fg"
                  >
                    All prompts
                  </Link>
                  {categories.map((category) => (
                    <Link
                      key={category.id}
                      href={{ pathname: `/categories/${category.slug}` }}
                      className="shrink-0 rounded-full border border-border bg-surface px-3.5 py-1.5 text-[0.8125rem] font-medium text-fg-muted transition-colors duration-200 hover:border-accent/50 hover:text-fg"
                    >
                      {category.name}
                      <span className="ml-1.5 font-mono text-[0.6875rem] tabular-nums text-fg-subtle">
                        {category.promptCount}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {featured.length > 0 ? (
            <section className="container-page py-10">
              <SectionHeading
                eyebrow="Hand-picked"
                title="Featured"
                href="/prompts"
                Icon={Zap}
              />
              <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0">
                {featured.map((prompt, index) => (
                  <div
                    key={prompt.id}
                    className="w-[62vw] shrink-0 snap-start sm:w-[42vw] lg:w-auto"
                  >
                    <PromptCard prompt={prompt} index={index + 1} priority={index < 2} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="container-page pb-20 pt-4">
            <SectionHeading
              eyebrow="Fresh from the vault"
              title="Latest prompts"
              href="/prompts"
              Icon={Layers}
            />
            <MasonryGrid prompts={latest} />
          </section>
        </>
      )}
    </>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Layers;
  value: string | number;
  label: string;
}) {
  return (
    <div className="edge-top rounded-xl border border-border bg-surface/70 px-3 py-4 backdrop-blur-sm">
      <Icon className="mx-auto size-4 text-accent" />
      <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-fg">
        {value}
      </p>
      <p className="eyebrow mt-0.5">{label}</p>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  href,
  Icon,
}: {
  eyebrow: string;
  title: string;
  href: "/prompts" | "/categories";
  Icon: typeof Layers;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <span className="eyebrow flex items-center gap-1.5">
          <Icon className="size-3 text-accent" />
          {eyebrow}
        </span>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight md:text-2xl">
          {title}
        </h2>
      </div>
      <Link
        href={href}
        className="group flex shrink-0 items-center gap-1 text-sm font-medium text-fg-muted transition-colors hover:text-accent"
      >
        See all
        <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

function EmptyLibrary() {
  return (
    <section className="container-page py-20">
      <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border bg-surface/60 px-6 py-16 text-center backdrop-blur-sm">
        <h2 className="text-lg font-semibold tracking-tight">
          The library is being set up
        </h2>
        <p className="mt-2 text-sm text-fg-muted">
          Prompts appear here as soon as they&rsquo;re published. If you&rsquo;re the
          admin, sign in to publish the first one.
        </p>
        <Button className="mt-6" variant="outline" asChild>
          <Link href="/admin">Go to admin</Link>
        </Button>
      </div>
    </section>
  );
}
