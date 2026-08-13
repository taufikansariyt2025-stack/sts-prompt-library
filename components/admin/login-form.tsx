"use client";

import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type UserCredential,
} from "firebase/auth";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  LogIn,
  MailCheck,
  ShieldX,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/input";
import { firebaseAuth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils/cn";

type Href = Parameters<ReturnType<typeof useRouter>["replace"]>[0];

type Mode = "signin" | "signup" | "reset";
type Outcome =
  | { kind: "pending" | "rejected" | "suspended"; message: string }
  | { kind: "reset-sent"; message: string }
  | null;

/**
 * Admin sign-in and access request.
 *
 * The Firebase ID token never becomes the session. It is posted once to
 * /api/admin/session, which verifies it, records or reads the account's access
 * request, and issues an HttpOnly cookie only if the account is approved.
 *
 * We sign out of the client SDK immediately afterwards — the server cookie is
 * the only credential that matters from that point on.
 */
export function LoginForm({
  next,
  initialMode = "signin",
}: {
  next: string;
  initialMode?: "signin" | "signup";
}) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [pending, setPending] = useState<"google" | "form" | "boot" | null>("boot");

  /**
   * Completes a redirect-based Google sign-in.
   *
   * Popups are blocked often enough — and unavailable in some in-app browsers —
   * that redirect is a necessary fallback, and it has to be resumed on load.
   */
  useEffect(() => {
    let active = true;

    getRedirectResult(firebaseAuth())
      .then(async (credential) => {
        if (!active) return;
        if (credential) await establishSession(credential);
      })
      .catch((err) => {
        if (active) setError(toMessage(err));
      })
      .finally(() => {
        if (active) setPending(null);
      });

    return () => {
      active = false;
    };
    // Runs once on mount to resume a redirect that started on a previous page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function establishSession(credential: UserCredential) {
    const idToken = await credential.user.getIdToken(true);

    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    const payload = (await response.json()) as {
      ok: boolean;
      error?: string;
      status?: string;
    };

    // The client SDK has done its job either way.
    await signOut(firebaseAuth()).catch(() => {});

    if (response.ok && payload.ok) {
      router.replace(next as Href);
      router.refresh();
      return;
    }

    if (
      payload.status === "pending" ||
      payload.status === "rejected" ||
      payload.status === "suspended"
    ) {
      setOutcome({ kind: payload.status, message: payload.error ?? "" });
      return;
    }

    throw new Error(payload.error ?? "Sign-in failed.");
  }

  async function handleGoogle() {
    setError(null);
    setPending("google");
    try {
      const auth = firebaseAuth();
      await setPersistence(auth, browserLocalPersistence);
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      await establishSession(credential);
    } catch (err) {
      const code = codeOf(err);
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        try {
          await signInWithRedirect(firebaseAuth(), new GoogleAuthProvider());
          return; // Navigating away; the effect above resumes on return.
        } catch (redirectErr) {
          setError(toMessage(redirectErr));
        }
      } else if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError(toMessage(err));
      }
      setPending(null);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending("form");

    try {
      const auth = firebaseAuth();

      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email.trim());
        setOutcome({
          kind: "reset-sent",
          message: `If an account exists for ${email.trim()}, a reset link is on its way.`,
        });
        setPending(null);
        return;
      }

      await setPersistence(auth, browserLocalPersistence);

      if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );
        if (name.trim()) {
          await updateProfile(credential.user, { displayName: name.trim() });
        }
        // Best effort — the owner also sees an "unverified" flag in the queue.
        await sendEmailVerification(credential.user).catch(() => {});
        await establishSession(credential);
      } else {
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
        await establishSession(credential);
      }
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setPending(null);
    }
  }

  // ── Resuming a redirect ──────────────────────────────────────────────────
  if (pending === "boot") {
    return (
      <div className="grid place-items-center gap-3 py-10">
        <Loader2 className="size-5 animate-spin text-accent" />
        <p className="text-sm text-fg-muted">Checking your session…</p>
      </div>
    );
  }

  // ── Terminal states ──────────────────────────────────────────────────────
  if (outcome) {
    return <OutcomePanel outcome={outcome} onBack={() => setOutcome(null)} />;
  }

  const busy = pending !== null;
  const isReset = mode === "reset";

  return (
    <div className="space-y-5">
      {!isReset ? (
        <>
          <div
            role="tablist"
            aria-label="Account"
            className="grid grid-cols-2 gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5"
          >
            {(
              [
                { value: "signin", label: "Sign in" },
                { value: "signup", label: "Create account" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={mode === tab.value}
                onClick={() => {
                  setMode(tab.value);
                  setError(null);
                }}
                className={cn(
                  "rounded-md py-2 text-sm font-medium transition-colors duration-200",
                  mode === tab.value
                    ? "bg-surface text-fg shadow-e1"
                    : "text-fg-muted hover:text-fg",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Button
            onClick={handleGoogle}
            disabled={busy}
            variant="outline"
            size="lg"
            full
            className="gap-3"
          >
            {pending === "google" ? <Loader2 className="animate-spin" /> : <GoogleMark />}
            Continue with Google
          </Button>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="eyebrow">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        {isReset ? (
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            className="flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
          >
            <ArrowLeft className="size-3.5" /> Back to sign in
          </button>
        ) : null}

        {mode === "signup" ? (
          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              placeholder="Anushka Roy"
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            placeholder="you@example.com"
          />
        </div>

        {!isReset ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {mode === "signin" ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode("reset");
                    setError(null);
                  }}
                  className="text-xs font-medium text-accent transition-opacity hover:opacity-80"
                >
                  Forgot password?
                </button>
              ) : null}
            </div>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={mode === "signup" ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              placeholder="••••••••••"
            />
            {mode === "signup" ? (
              <FieldHint>At least 8 characters.</FieldHint>
            ) : null}
          </div>
        ) : (
          <FieldHint>
            We&rsquo;ll email you a link to choose a new password.
          </FieldHint>
        )}

        <Button type="submit" disabled={busy} size="lg" full>
          {pending === "form" ? (
            <Loader2 className="animate-spin" />
          ) : isReset ? (
            <MailCheck />
          ) : mode === "signup" ? (
            <UserPlus />
          ) : (
            <LogIn />
          )}
          {isReset
            ? "Send reset link"
            : mode === "signup"
              ? "Create account & request access"
              : "Sign in"}
        </Button>
      </form>

      {mode === "signup" ? (
        <p className="text-center text-xs text-fg-subtle">
          New accounts need admin approval before the library unlocks.
        </p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/8 p-3"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
          <FieldError>{error}</FieldError>
        </div>
      ) : null}
    </div>
  );
}

// ── Terminal state panels ──────────────────────────────────────────────────

function OutcomePanel({
  outcome,
  onBack,
}: {
  outcome: NonNullable<Outcome>;
  onBack: () => void;
}) {
  const config = {
    pending: {
      Icon: Clock,
      tone: "text-warning",
      ring: "border-warning/30 bg-warning/8",
      title: "Access request sent to admin",
      body: "Your account has been created and the admin has been notified. Once they approve you, sign in again and the library unlocks.",
    },
    rejected: {
      Icon: ShieldX,
      tone: "text-danger",
      ring: "border-danger/30 bg-danger/8",
      title: "Access not approved",
      body: "The admin hasn't approved this account. If you think that's a mistake, get in touch with them directly.",
    },
    suspended: {
      Icon: ShieldX,
      tone: "text-danger",
      ring: "border-danger/30 bg-danger/8",
      title: "Access suspended",
      body: "This account's access has been suspended. Contact the admin if you need it restored.",
    },
    "reset-sent": {
      Icon: CheckCircle2,
      tone: "text-success",
      ring: "border-success/30 bg-success/8",
      title: "Check your email",
      body: outcome.message,
    },
  }[outcome.kind];

  const { Icon } = config;

  return (
    <div className="space-y-5 text-center">
      <div className={cn("mx-auto grid size-12 place-items-center rounded-full border", config.ring)}>
        <Icon className={cn("size-5", config.tone)} />
      </div>

      <div>
        <h2 className="text-base font-semibold tracking-tight">{config.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{config.body}</p>
      </div>

      <Button variant="outline" full onClick={onBack}>
        Back to sign in
      </Button>
    </div>
  );
}

// ── Error mapping ──────────────────────────────────────────────────────────

function codeOf(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}

/** Firebase error codes are useless to a human; map the ones that matter. */
function toMessage(error: unknown): string {
  switch (codeOf(error)) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password don't match an account.";
    case "auth/email-already-in-use":
      return "An account already exists for that email. Try signing in instead.";
    case "auth/weak-password":
      return "That password is too short — use at least 8 characters.";
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/popup-blocked":
      return "Your browser blocked the popup. Allow popups, or try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/unauthorized-domain":
      return "This domain isn't authorised in Firebase Auth → Settings → Authorized domains.";
    case "auth/operation-not-allowed":
      return "That sign-in method isn't enabled in the Firebase console.";
    case "auth/invalid-api-key":
    case "auth/configuration-not-found":
      return "Firebase isn't configured yet. Check your .env.local values.";
    default:
      return error instanceof Error ? error.message : "Something went wrong.";
  }
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.86-.08-1.68-.22-2.47H12v4.67h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.86c2.26-2.08 3.56-5.15 3.56-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
