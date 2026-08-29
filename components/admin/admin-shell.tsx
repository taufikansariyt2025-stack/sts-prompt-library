"use client";

import {
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  SquareStack,
  Tags,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import type { AdminSession } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/schemas/user";
import { cn } from "@/lib/utils/cn";

type NavItem = {
  href: string;
  label: string;
  Icon: typeof LayoutDashboard;
  /** Dashboard would otherwise match every nested admin route. */
  exact?: boolean;
  /** Hidden from roles that can't manage access (editors). */
  managesUsers?: boolean;
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard, exact: true },
  { href: "/admin/prompts", label: "Prompts", Icon: SquareStack },
  { href: "/admin/categories", label: "Categories", Icon: FolderTree },
  { href: "/admin/tags", label: "Tags", Icon: Tags },
  { href: "/admin/media", label: "Media", Icon: ImageIcon },
  { href: "/admin/users", label: "Access", Icon: ShieldCheck, managesUsers: true },
  { href: "/admin/settings", label: "Settings", Icon: Settings },
];

export function AdminShell({
  session,
  pendingRequests = 0,
  children,
}: {
  session: AdminSession;
  pendingRequests?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  async function signOut() {
    const response = await fetch("/api/admin/session", { method: "DELETE" });
    if (response.ok) {
      router.replace("/admin/login");
      router.refresh();
    } else {
      toast.error("Couldn't sign out. Try again.");
    }
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex min-h-dvh bg-bg">
      {/* Mobile scrim */}
      {navOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-overlay lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface transition-transform duration-200 lg:static lg:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-xs font-bold text-accent-fg">
              STS
            </span>
            <span className="text-sm font-semibold">Admin</span>
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </Button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV.filter(
            (item) => !item.managesUsers || canManageUsers(session.role),
          ).map(({ href, label, Icon, exact }) => {
            const active = isActive(href, exact);
            const badge = href === "/admin/users" ? pendingRequests : 0;
            return (
              <Link
                key={href}
                href={{ pathname: href }}
                onClick={() => setNavOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
                {badge > 0 ? (
                  <span className="ml-auto grid size-5 place-items-center rounded-full bg-warning/15 font-mono text-[0.6875rem] tabular-nums text-warning">
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-border p-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-xs text-fg-subtle">Theme</span>
            <ThemeToggle />
          </div>
          <div className="rounded-lg bg-surface-2 p-3">
            <p className="truncate text-xs font-medium text-fg">{session.email}</p>
            <p className="mt-0.5 text-[0.625rem] uppercase tracking-wider text-fg-subtle">
              {session.role}
            </p>
            <button
              type="button"
              onClick={signOut}
              className="mt-2 flex items-center gap-1.5 text-xs text-fg-muted transition-colors hover:text-danger"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
          <span className="text-sm font-semibold">Admin</span>
        </header>

        <main id="main" className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
