import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/admin/login-form";
import { requireAdmin } from "@/lib/auth/session";
import { SITE } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "Admin sign-in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  // A valid cookie means there is nothing to do here. proxy.ts also redirects
  // on cookie presence, but that check is optimistic — this one is real.
  if (await requireAdmin()) redirect("/admin");

  const params = await searchParams;
  const raw = typeof params.next === "string" ? params.next : "/admin";
  // Only allow internal paths — an open redirect here would be a phishing gift.
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/admin";

  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-accent text-lg font-semibold text-accent-fg">
            STS
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Admin access</h1>
          <p className="mt-1.5 text-sm text-fg-muted">
            Sign in to manage {SITE.name}.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-e2">
          <LoginForm next={next} />
        </div>

        <p className="mt-6 text-center text-xs text-fg-subtle">
          Only approved accounts can sign in.
        </p>
      </div>
    </main>
  );
}
