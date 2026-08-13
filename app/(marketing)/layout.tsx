import Link from "next/link";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/constants/site";

/**
 * Public shell — landing page and sign-in only.
 *
 * Deliberately does NOT read the session, so these pages stay statically
 * renderable and indexable. Everything with actual prompt content lives under
 * app/(app)/, which is gated.
 */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-bg/70 backdrop-blur-xl">
        <div className="container-page flex h-14 items-center gap-4 md:h-16">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-accent font-mono text-[0.625rem] font-bold text-accent-fg">
              STS
            </span>
            <span className="hidden leading-none sm:block">
              <span className="block text-sm font-semibold tracking-tight">
                Prompt Library
              </span>
              <span className="eyebrow !text-[0.5625rem]">{SITE.parentBrand}</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle className="hidden sm:inline-flex" />
            <Button size="sm" variant="outline" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/login?mode=signup">Request access</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border py-8">
        <div className="container-page flex flex-col gap-2 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.name}
          </p>
          <p>
            A project by{" "}
            <a
              href={SITE.parentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-fg-muted transition-colors hover:text-fg"
            >
              {SITE.parentBrand}
            </a>
          </p>
        </div>
      </footer>
    </>
  );
}
