import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import type { DecodedIdToken } from "firebase-admin/auth";

import { adminEmails } from "@/lib/env";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { AccessStatus, AppUser, UserRole } from "@/lib/schemas/user";

/**
 * Access requests for the admin panel.
 *
 * Anyone who signs in gets a `users/{uid}` record. Owners (ADMIN_EMAILS) are
 * approved automatically; everyone else lands in `pending` until an owner acts.
 */

export const USERS = "users";

function isOwnerEmail(email: string | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate(): Date }).toDate().toISOString();
  }
  return null;
}

function toAppUser(uid: string, data: FirebaseFirestore.DocumentData): AppUser {
  return {
    uid,
    email: (data.email as string) ?? "",
    displayName: (data.displayName as string) ?? "",
    photoURL: (data.photoURL as string) ?? "",
    emailVerified: Boolean(data.emailVerified),
    provider: (data.provider as string) ?? "password",
    status: (data.status as AccessStatus) ?? "pending",
    role: (data.role as UserRole) ?? "editor",
    requestedAt: toIso(data.requestedAt) ?? new Date(0).toISOString(),
    decidedAt: toIso(data.decidedAt),
    decidedByEmail: (data.decidedByEmail as string) ?? null,
    note: (data.note as string) ?? "",
    lastSignInAt: toIso(data.lastSignInAt),
  };
}

/**
 * Called on every sign-in attempt.
 *
 * Creates the access request on first contact, and returns the caller's current
 * standing so the session route can decide whether to issue a cookie.
 */
export async function resolveAccess(decoded: DecodedIdToken): Promise<AppUser> {
  const db = adminDb();
  const ref = db.collection(USERS).doc(decoded.uid);
  const snapshot = await ref.get();

  const owner = isOwnerEmail(decoded.email);
  const provider =
    (decoded.firebase?.sign_in_provider as string | undefined) ?? "password";

  // Identity fields always come from the verified token, never from the client.
  const identity = {
    email: decoded.email ?? "",
    displayName: (decoded.name as string) ?? "",
    photoURL: (decoded.picture as string) ?? "",
    emailVerified: Boolean(decoded.email_verified),
    provider,
    lastSignInAt: FieldValue.serverTimestamp(),
  };

  if (!snapshot.exists) {
    await ref.set({
      ...identity,
      // Owners bootstrap themselves; everyone else waits for a decision.
      status: owner ? "approved" : "pending",
      role: owner ? "owner" : "editor",
      requestedAt: FieldValue.serverTimestamp(),
      decidedAt: owner ? FieldValue.serverTimestamp() : null,
      decidedByEmail: owner ? "system (ADMIN_EMAILS)" : null,
      note: "",
    });

    if (owner) await syncClaims(decoded.uid, "owner");

    const created = await ref.get();
    return toAppUser(decoded.uid, created.data()!);
  }

  const existing = toAppUser(decoded.uid, snapshot.data()!);

  // Being added to ADMIN_EMAILS later should promote an existing account.
  const promote = owner && existing.role !== "owner";

  await ref.update({
    ...identity,
    ...(promote
      ? {
          status: "approved",
          role: "owner",
          decidedAt: FieldValue.serverTimestamp(),
          decidedByEmail: "system (ADMIN_EMAILS)",
        }
      : {}),
  });

  if (promote) {
    await syncClaims(decoded.uid, "owner");
    return { ...existing, status: "approved", role: "owner" };
  }

  return existing;
}

/** Mirrors the stored role onto the Firebase custom claims. */
async function syncClaims(uid: string, role: UserRole | null): Promise<void> {
  await adminAuth().setCustomUserClaims(
    uid,
    role ? { admin: true, role } : { admin: false, role: null },
  );
}

export async function getAppUser(uid: string): Promise<AppUser | null> {
  const snapshot = await adminDb().collection(USERS).doc(uid).get();
  return snapshot.exists ? toAppUser(uid, snapshot.data()!) : null;
}

export async function listAppUsers(): Promise<AppUser[]> {
  const snapshot = await adminDb().collection(USERS).get();
  const users = snapshot.docs.map((doc) => toAppUser(doc.id, doc.data()));

  // Pending first — that is the queue the owner actually works through.
  const weight: Record<AccessStatus, number> = {
    pending: 0,
    approved: 1,
    suspended: 2,
    rejected: 3,
  };

  return users.sort(
    (a, b) =>
      weight[a.status] - weight[b.status] ||
      b.requestedAt.localeCompare(a.requestedAt),
  );
}

/**
 * Applies an owner's decision.
 *
 * Revoking refresh tokens is what makes a rejection or suspension take effect
 * immediately — `verifySessionCookie(..., true)` then rejects the live cookie,
 * so the user is signed out everywhere rather than at their next login.
 */
export async function decideAccess(params: {
  uid: string;
  status: AccessStatus;
  role?: UserRole;
  note?: string;
  actorEmail: string;
}): Promise<AppUser> {
  const { uid, status, note, actorEmail } = params;
  const ref = adminDb().collection(USERS).doc(uid);

  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("That account no longer exists.");

  const current = toAppUser(uid, snapshot.data()!);

  // An owner is the root of trust; the UI must not be able to strip that.
  if (current.role === "owner") {
    throw new Error("Owner accounts can't be modified here.");
  }

  // `current.role` is already narrowed to a non-owner by the guard above.
  const role: UserRole = params.role ?? current.role;
  const approved = status === "approved";

  await ref.update({
    status,
    role,
    note: note ?? "",
    decidedAt: FieldValue.serverTimestamp(),
    decidedByEmail: actorEmail,
  });

  await syncClaims(uid, approved ? role : null);

  // Kill any live session for a revoked account.
  if (!approved) await adminAuth().revokeRefreshTokens(uid);

  return { ...current, status, role, decidedByEmail: actorEmail };
}

export async function countPendingRequests(): Promise<number> {
  try {
    const snapshot = await adminDb()
      .collection(USERS)
      .where("status", "==", "pending")
      .count()
      .get();
    return snapshot.data().count;
  } catch {
    return 0;
  }
}
