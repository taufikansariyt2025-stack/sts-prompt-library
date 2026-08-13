import Link from "next/link";

import { SITE } from "@/lib/constants/site";
import type { SiteSettings } from "@/lib/schemas/settings";

const SOCIAL_LABELS: Record<string, string> = {
  website: "Website",
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
};

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const socials = Object.entries(settings.social).filter(
    ([key, value]) => value && key !== "email",
  ) as [string, string][];

  return (
    // Extra bottom padding clears the mobile tab bar.
    <footer className="mt-auto border-t border-border pb-24 pt-10 md:pb-10">
      <div className="container-page">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <p className="text-sm font-semibold">{settings.siteName}</p>
            <p className="mt-2 text-sm text-fg-muted">{settings.description}</p>
          </div>

          <div className="flex gap-12">
            <nav className="space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                Library
              </p>
              {(
                [
                  { href: "/prompts", label: "All prompts" },
                  { href: "/categories", label: "Categories" },
                  { href: "/saved", label: "Saved" },
                ] as const
              ).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block text-sm text-fg-muted transition-colors hover:text-fg"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {socials.length > 0 ? (
              <nav className="space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                  Follow
                </p>
                {socials.map(([key, url]) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-fg-muted transition-colors hover:text-fg"
                  >
                    {SOCIAL_LABELS[key] ?? key}
                  </a>
                ))}
              </nav>
            ) : null}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {settings.siteName}
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
      </div>
    </footer>
  );
}
