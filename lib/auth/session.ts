import "server-only";

import { cookies } from "next/headers";

import { resolveAccess } from "@/lib/auth/access";
import { adminAuth } from "@/lib/firebase/admin";
import type { AccessStatus, UserRole } from "@/lib/schemas/user";

/**
 * Admin authentication — Firebase Auth session cookies.
 *
 * Flow:
 *   1. Browser signs in with Firebase Auth and receives an ID token.
 *   2. POST /api/admin/session — the server verifies the token, resolves the
 *      account's access standing, and (if approved) exchanges it for a cookie.
 *   3. Every admin page and mutating route calls `requireAdmin()`, which
 *      verifies the cookie against Firebase on each request.
 *
 * The session cookie is HttpOnly, so it is unreadable from JavaScript — which
 * an ID token held in browser storage is not. `checkRevoked` means rejecting or
 * suspending an account kills its live sessions immediately.
 */

export const SESSION_COOKIE = "sts_session";

/** Firebase caps session cookies at 14 days; 5 is a reasonable admin window. */
const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export type AdminSession = {
  uid: string;
  email: string;
  role: UserRole;
  name?: string;
  picture?: string;
};

export type SignInResult =
  | { ok: true; cookie: string; maxAgeMs: number; role: UserRole }
  | { ok: false; status: AccessStatus | "invalid"; reason: string };

/**
 * Exchanges a freshly-minted Firebase ID token for a session cookie.
 *
 * Returns the caller's access status on refusal so the UI can show the right
 * screen — "request sent" reads very differently from "wrong password".
 */
export async function createSessionFromIdToken(idToken: string): Promise<SignInResult> {
  const auth = adminAuth();

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    return { ok: false, status: "invalid", reason: "Invalid or expired sign-in token." };
  }

  // Require a recent sign-in so a stolen long-lived token can't mint a session.
  const fiveMinutesAgo = Date.now() / 1000 - 5 * 60;
  if (decoded.auth_time < fiveMinutesAgo) {
    return { ok: false, status: "invalid", reason: "Please sign in again." };
  }

  // Creates the access request on first contact.
  const user = await resolveAccess(decoded);

  if (user.status !== "approved") {
    return {
      ok: false,
      status: user.status,
      reason:
        user.status === "pending"
          ? "Access request sent to the admin."
          : user.status === "suspended"
            ? "This account's access has been suspended."
            : "This account wasn't approved for admin access.",
    };
  }

  const cookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });

  return { ok: true, cookie, maxAgeMs: SESSION_MAX_AGE_MS, role: user.role };
}

/**
 * Verifies the session cookie. Returns null when absent, invalid, revoked, or
 * held by an account that is no longer approved.
 *
 * This is the real security boundary. proxy.ts only checks whether a cookie
 * exists, which is a redirect convenience — never rely on it. CLAUDE.md rule #5.
 */
export async function requireAdmin(): Promise<AdminSession | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(value, true);

    // The claim is written only on approval and cleared on revocation, and
    // revoking refresh tokens invalidates this cookie, so the claim is
    // authoritative without a Firestore read on every admin request.
    if (decoded.admin !== true) return null;

    const role = (decoded.role as UserRole | undefined) ?? "editor";

    return {
      uid: decoded.uid,
      email: decoded.email ?? "",
      role,
      name: typeof decoded.name === "string" ? decoded.name : undefined,
      picture: typeof decoded.picture === "string" ? decoded.picture : undefined,
    };
  } catch {
    // Expired, revoked, tampered, or signed by a different project.
    return null;
  }
}

export function sessionCookieOptions(maxAgeMs: number) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Strict is viable because the admin panel is never linked to externally.
    sameSite: "strict" as const,
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

/** Revokes refresh tokens so the session dies everywhere, not just this browser. */
export async function revokeSession(): Promise<void> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) return;

  try {
    const decoded = await adminAuth().verifySessionCookie(value);
    await adminAuth().revokeRefreshTokens(decoded.sub);
  } catch {
    // Already invalid — clearing the cookie is enough.
  }
}
