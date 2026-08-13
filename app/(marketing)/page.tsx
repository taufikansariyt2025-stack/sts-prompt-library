import {
  ArrowRight,
  Clapperboard,
  Copy,
  ImageIcon,
  Layers,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/constants/site";
import { countPrompts, listCategories } from "@/lib/firebase/queries";
import { safeQuery } from "@/lib/firebase/safe";

/**
 * Public landing page.
 *
 * Static and indexable. Shows what the library IS — category names, counts,
 * how access works — but never a single prompt body. That content lives behind
 * the gate in app/(app)/.
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
  alternates: { canonical: "/" },
};

export default async function LandingPage() {
  const [categories, total] = await Promise.all([
    safeQuery(() => listCategories(), []),
    safeQuery(() => countPrompts("published"), 0),
  ]);

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="grid-bg relative overflow-hidden border-b border-border">
        <div className="container-page relative pb-16 pt-16 md:pb-24 md:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="fade-up inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft/60 px-3.5 py-1.5 backdrop-blur-sm">
              <Sparkles className="size-3.5 text-accent" />
              <span className="eyebrow !text-accent">Members-only prompt vault</span>
            </span>

            <h1
              className="fade-up mt-6 text-[clamp(2.5rem,7vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.04em]"
              style={{ animationDelay: "60ms" }}
            >
              <span className="block">AI prompts that actually work.</span>
              <span className="mt-1 block bg-gradient-to-r from-accent via-accent to-image bg-clip-text text-transparent">
                Copy. Paste. Ship.
              </span>
            </h1>

            <p
              className="fade-up mx-auto mt-5 max-w-xl text-base leading-relaxed text-fg-muted md:text-lg"
              style={{ animationDelay: "120ms" }}
            >
              A curated vault of {total > 0 ? `${total} ` : ""}battle-tested image and
              video prompts — each one paired with the output it produces. Request
              access and start shipping.
            </p>

            <div
              className="fade-up mt-8 flex flex-wrap justify-center gap-3"
              style={{ animationDelay: "180ms" }}
            >
              <Button size="lg" className="glow-accent" asChild>
                <Link href="/login?mode=signup">
                  Request access <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">I already have an account</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── What's inside ─────────────────────────────────────────────── */}
      <section className="container-page py-14">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">What&rsquo;s inside</span>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
            Every prompt, shown with its result
          </h2>
        </div>

        <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-3">
          <Feature
            Icon={Clapperboard}
            title="Video prompts"
            body="Cinematic shots, product commercials, UGC and vlog styles — with timing and camera direction built in."
          />
          <Feature
            Icon={ImageIcon}
            title="Image & storyboards"
            body="Hero product frames, multi-image ad sets and full storyboard grids."
          />
          <Feature
            Icon={Copy}
            title="Copy-ready"
            body="No reformatting. Every prompt is a single tap away from your clipboard."
          />
        </div>
      </section>

      {/* ── Categories (names only — no prompt content) ───────────────── */}
      {categories.length > 0 ? (
        <section className="container-page pb-14">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">Categories</span>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {categories.length} ways to search
            </h2>
          </div>

          <div className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-2">
            {categories.map((category) => (
              <span
                key={category.id}
                className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-fg-muted"
              >
                {category.name}
                <span className="ml-1.5 font-mono text-[0.6875rem] tabular-nums text-fg-subtle">
                  {category.promptCount}
                </span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── How access works ──────────────────────────────────────────── */}
      <section className="border-t border-border bg-surface/40">
        <div className="container-page py-14">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow flex items-center justify-center gap-1.5">
              <Lock className="size-3 text-accent" />
              How access works
            </span>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Approved members only
            </h2>
            <p className="mt-3 text-sm text-fg-muted">
              The library isn&rsquo;t public. Create an account, and the admin reviews
              your request — usually quickly.
            </p>
          </div>

          <ol className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
            <Step n={1} title="Create an account" body="Google, or email and password." />
            <Step
              n={2}
              title="Request goes to the admin"
              body="You'll see a confirmation as soon as it's sent."
            />
            <Step
              n={3}
              title="Approved — you're in"
              body="Sign in again and the full library unlocks."
            />
          </ol>

          <div className="mt-9 text-center">
            <Button size="lg" asChild>
              <Link href="/login?mode=signup">
                Request access <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

function Feature({
  Icon,
  title,
  body,
}: {
  Icon: typeof Layers;
  title: string;
  body: string;
}) {
  return (
    <div className="edge-top rounded-xl border border-border bg-surface p-5">
      <Icon className="size-4 text-accent" />
      <h3 className="mt-3 text-sm font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-fg-muted">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="rounded-xl border border-border bg-surface p-5">
      <span className="grid size-7 place-items-center rounded-lg bg-accent-soft font-mono text-xs font-semibold text-accent">
        {n}
      </span>
      <h3 className="mt-3 flex items-center gap-1.5 text-sm font-semibold tracking-tight">
        {n === 3 ? <ShieldCheck className="size-3.5 text-success" /> : null}
        {title}
      </h3>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-fg-muted">{body}</p>
    </li>
  );
}
