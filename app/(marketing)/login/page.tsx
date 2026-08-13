import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/admin/login-form";
import { requireSession } from "@/lib/auth/session";
import { SITE } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in or request access to the STS Prompt Library.",
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;

  // Only allow internal paths — an open redirect here would be a phishing gift.
  const raw = typeof params.next === "string" ? params.next : "/prompts";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/prompts";

  const initialMode = params.mode === "signup" ? "signup" : "signin";

  // Already signed in — nothing to do here.
  if (await requireSession()) redirect(next as "/prompts");

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            {initialMode === "signup" ? "Request access" : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-sm text-fg-muted">
            {initialMode === "signup"
              ? `Create an account and the admin will review your request.`
              : `Sign in to ${SITE.name}.`}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-e2">
          <LoginForm next={next} initialMode={initialMode} />
        </div>

        <p className="mt-6 text-center text-xs text-fg-subtle">
          The library is available to approved members only.
        </p>
      </div>
    </div>
  );
}
