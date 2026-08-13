import { Search } from "lucide-react";
import Link from "next/link";
import NextImage from "next/image";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { SiteSettings } from "@/lib/schemas/settings";
import { cn } from "@/lib/utils/cn";

const NAV = [
  { href: "/prompts", label: "Browse" },
  { href: "/categories", label: "Categories" },
  { href: "/saved", label: "Saved" },
] as const;

export function SiteHeader({ settings }: { settings: SiteSettings }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/70 backdrop-blur-xl">
      <div className="container-page flex h-14 items-center gap-2 md:h-16 md:gap-6">
        <Logo settings={settings} />

        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-fg-muted transition-colors duration-200 hover:bg-surface-2 hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/search"
            aria-label="Search prompts"
            className={cn(
              "group hidden items-center gap-2 rounded-lg border border-border bg-surface-2 py-2 pl-3 pr-2.5 sm:flex",
              "text-sm text-fg-subtle transition-colors duration-200 hover:border-accent/45 hover:text-fg-muted",
            )}
          >
            <Search className="size-3.5" />
            <span className="pr-6">Search prompts…</span>
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[0.625rem] text-fg-subtle">
              /
            </kbd>
          </Link>

          <Link
            href="/search"
            aria-label="Search"
            className="grid size-9 place-items-center rounded-lg border border-border bg-surface-2 text-fg-muted transition-colors hover:text-fg sm:hidden"
          >
            <Search className="size-4" />
          </Link>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

/**
 * Two logo files, not one.
 *
 * A single mark cannot read correctly on both a near-white and a near-black
 * background, so the admin uploads both and CSS swaps them. Falls back to a
 * wordmark until they're uploaded.
 */
function Logo({ settings }: { settings: SiteSettings }) {
  const { logoLight, logoDark } = settings.branding;

  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-2.5"
      aria-label={settings.siteName}
    >
      {logoLight || logoDark ? (
        <>
          {logoLight?.kind === "image" ? (
            <NextImage
              src={logoLight.url}
              alt={settings.siteName}
              width={logoLight.width}
              height={logoLight.height}
              priority
              className={cn("h-8 w-auto", logoDark ? "dark:hidden" : "")}
              unoptimized={logoLight.source === "url"}
            />
          ) : null}
          {logoDark?.kind === "image" ? (
            <NextImage
              src={logoDark.url}
              alt={settings.siteName}
              width={logoDark.width}
              height={logoDark.height}
              priority
              className={cn("h-8 w-auto", logoLight ? "hidden dark:block" : "")}
              unoptimized={logoDark.source === "url"}
            />
          ) : null}
        </>
      ) : (
        <>
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent font-mono text-[0.625rem] font-bold tracking-tight text-accent-fg">
            STS
          </span>
          <span className="hidden leading-none sm:block">
            <span className="block text-sm font-semibold tracking-tight">
              Prompt Library
            </span>
            <span className="eyebrow !text-[0.5625rem]">Skills To Salary</span>
          </span>
        </>
      )}
    </Link>
  );
}
