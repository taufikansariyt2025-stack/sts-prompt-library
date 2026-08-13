import { z } from "zod";

/**
 * Access control.
 *
 * The whole library is gated: an approved account is required to browse
 * prompts at all. Only the landing page and the sign-in page are public.
 *
 * Roles, least to most privileged:
 *   member — the library only. Cannot reach /admin. This is what most
 *            approved accounts get.
 *   editor — library + admin panel content (prompts, categories, media).
 *   admin  — the above + site settings.
 *   owner  — listed in ADMIN_EMAILS. The only role that can approve requests
 *            or change roles, and it cannot be modified through the UI —
 *            which is what stops an approved admin locking the owner out.
 */

export const ACCESS_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export const USER_ROLES = ["owner", "admin", "editor", "member"] as const;

export const accessStatusSchema = z.enum(ACCESS_STATUSES);
export const userRoleSchema = z.enum(USER_ROLES);

export type AccessStatus = z.infer<typeof accessStatusSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;

/** New approvals default to library-only access. */
export const DEFAULT_APPROVED_ROLE: UserRole = "member";

export type AppUser = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  /** Google accounts arrive verified; password sign-ups may not be. */
  emailVerified: boolean;
  provider: string;
  status: AccessStatus;
  role: UserRole;
  requestedAt: string;
  decidedAt: string | null;
  decidedByEmail: string | null;
  note: string;
  lastSignInAt: string | null;
};

/** Payload for approve / reject / suspend / role change. */
export const accessDecisionSchema = z.strictObject({
  status: accessStatusSchema,
  role: userRoleSchema.optional(),
  note: z.string().max(300).optional(),
});

export type AccessDecision = z.infer<typeof accessDecisionSchema>;

// ── Capability checks ────────────────────────────────────────────────────────
// Expressed as functions rather than role comparisons scattered through the
// codebase, so adding a role means editing this file and nothing else.

/** Can browse the library. Every approved role can. */
export function canViewLibrary(role: UserRole): boolean {
  return USER_ROLES.includes(role);
}

/** Can reach /admin at all. Members cannot. */
export function canAccessPanel(role: UserRole): boolean {
  return role === "owner" || role === "admin" || role === "editor";
}

/** Can approve access requests and change roles. */
export function canManageUsers(role: UserRole): boolean {
  return role === "owner";
}

/** Can edit site-wide settings and branding. */
export function canEditSettings(role: UserRole): boolean {
  return role === "owner" || role === "admin";
}

export const ROLE_COPY: Record<UserRole, string> = {
  owner: "Full control, including access approvals",
  admin: "Manage content and site settings",
  editor: "Manage content only",
  member: "Browse the library — no admin panel",
};

export const STATUS_COPY: Record<AccessStatus, { label: string; message: string }> = {
  pending: {
    label: "Pending",
    message:
      "Access request sent to the admin. You'll be able to sign in as soon as they approve you.",
  },
  approved: { label: "Approved", message: "Access granted." },
  rejected: {
    label: "Rejected",
    message: "This account wasn't approved for access.",
  },
  suspended: {
    label: "Suspended",
    message: "This account's access has been suspended.",
  },
};
