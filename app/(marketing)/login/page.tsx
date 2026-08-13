import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/admin/login-form";
import {
  AccessStatusPanel,
  isAccessOutcome,
} from "@/components/auth/access-status-panel";
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

  /*
   * The outcome of a sign-in attempt is carried in the URL, not client state.
   * The Google redirect flow navigates the page away and back, which used to
   * throw away the "request pending" message and drop the user on a blank
   * login form with no explanation.
   */
  const status = isAccessOutcome(params.status) ? params.status : null;

  // Already signed in — nothing to do here.
  if (!status && (await requireSession())) redirect(next as "/prompts");

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {!status ? (
          <div className="mb-8 text-center">
            <h1 className="text-xl font-semibold tracking-tight">
              {initialMode === "signup" ? "Request access" : "Welcome back"}
            </h1>
            <p className="mt-1.5 text-sm text-fg-muted">
              {initialMode === "signup"
                ? "Create an account and the admin will review your request."
                : `Sign in to ${SITE.name}.`}
            </p>
          </div>
        ) : null}

        <div className="rounded-xl border border-border bg-surface p-6 shadow-e2">
          {status ? (
            <AccessStatusPanel status={status} />
          ) : (
            <LoginForm next={next} initialMode={initialMode} />
          )}
        </div>

        {!status ? (
          <p className="mt-6 text-center text-xs text-fg-subtle">
            The library is available to approved members only.
          </p>
        ) : null}
      </div>
    </div>
  );
}
