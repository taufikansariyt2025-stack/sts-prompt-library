"use client";

import { Heart, House, LayoutGrid, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

const TABS = [
  { href: "/", label: "Home", Icon: House, exact: true },
  { href: "/prompts", label: "Browse", Icon: LayoutGrid },
  { href: "/search", label: "Search", Icon: Search },
  { href: "/saved", label: "Saved", Icon: Heart },
] as const;

/**
 * Bottom tab bar — the correct pattern for a PWA that lives on a home screen,
 * and the primary persona is on a phone. Hidden from md up, where the header
 * nav takes over.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/90 backdrop-blur-lg md:hidden"
    >
      <ul className="flex items-stretch">
        {TABS.map(({ href, label, Icon, ...rest }) => {
          const exact = "exact" in rest ? rest.exact : false;
          const active = exact ? pathname === href : pathname.startsWith(href);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                // 44px minimum touch target.
                className={cn(
                  "flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 py-1.5 transition-colors",
                  active ? "text-accent" : "text-fg-subtle",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                <span className="text-[0.6875rem] font-medium">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
