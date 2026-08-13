import { z } from "zod";

/**
 * Admin-panel access control.
 *
 * The public library needs no account at all. This collection governs who may
 * reach `/admin` — anyone can request, only an owner can grant.
 *
 * Roles:
 *   owner  — listed in ADMIN_EMAILS. Can approve, reject and change roles.
 *            Cannot be demoted through the UI, which is what stops an approved
 *            admin from locking the real owner out.
 *   admin  — full access to manage prompts, categories, media and settings.
 *   editor — everything except site settings and the user queue.
 */

export const ACCESS_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export const USER_ROLES = ["owner", "admin", "editor"] as const;

export const accessStatusSchema = z.enum(ACCESS_STATUSES);
export const userRoleSchema = z.enum(USER_ROLES);

export type AccessStatus = z.infer<typeof accessStatusSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;

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

/** Which roles may reach the user queue and site settings. */
export function canManageUsers(role: UserRole): boolean {
  return role === "owner";
}

export function canEditSettings(role: UserRole): boolean {
  return role === "owner" || role === "admin";
}

export const STATUS_COPY: Record<AccessStatus, { label: string; message: string }> = {
  pending: {
    label: "Pending",
    message:
      "Access request sent to the admin. You'll be able to sign in as soon as they approve you.",
  },
  approved: { label: "Approved", message: "Access granted." },
  rejected: {
    label: "Rejected",
    message: "This account wasn't approved for admin access.",
  },
  suspended: {
    label: "Suspended",
    message: "This account's access has been suspended.",
  },
};
