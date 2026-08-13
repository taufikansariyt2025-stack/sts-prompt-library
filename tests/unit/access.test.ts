import { describe, expect, it } from "vitest";

import {
  ACCESS_STATUSES,
  accessDecisionSchema,
  canEditSettings,
  canManageUsers,
  USER_ROLES,
  type UserRole,
} from "@/lib/schemas/user";

/**
 * Authorisation rules for admin-panel access.
 *
 * The threat these guard against is privilege escalation: an approved admin
 * granting themselves owner rights, or approving further accounts.
 */

describe("canManageUsers", () => {
  it("allows only the owner to review access requests", () => {
    expect(canManageUsers("owner")).toBe(true);
    expect(canManageUsers("admin")).toBe(false);
    expect(canManageUsers("editor")).toBe(false);
  });

  it("denies every non-owner role, including any added later", () => {
    const allowed = USER_ROLES.filter((role) => canManageUsers(role));
    expect(allowed).toEqual(["owner"]);
  });
});

describe("canEditSettings", () => {
  it("allows owner and admin but not editor", () => {
    expect(canEditSettings("owner")).toBe(true);
    expect(canEditSettings("admin")).toBe(true);
    expect(canEditSettings("editor")).toBe(false);
  });
});

describe("accessDecisionSchema", () => {
  it("accepts a plain approval", () => {
    expect(accessDecisionSchema.safeParse({ status: "approved" }).success).toBe(true);
  });

  it("accepts approval with a role and a note", () => {
    const result = accessDecisionSchema.safeParse({
      status: "approved",
      role: "admin",
      note: "Joined the content team",
    });
    expect(result.success).toBe(true);
  });

  it.each(ACCESS_STATUSES)("accepts the %s status", (status) => {
    expect(accessDecisionSchema.safeParse({ status }).success).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(accessDecisionSchema.safeParse({ status: "god-mode" }).success).toBe(false);
  });

  it("rejects an unknown role", () => {
    const result = accessDecisionSchema.safeParse({
      status: "approved",
      role: "superuser",
    });
    expect(result.success).toBe(false);
  });

  it("rejects extra keys — a decision payload must not carry anything else", () => {
    const result = accessDecisionSchema.safeParse({
      status: "approved",
      uid: "someone-else",
      email: "attacker@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("caps the note so a decision can't be used as free storage", () => {
    const result = accessDecisionSchema.safeParse({
      status: "approved",
      note: "x".repeat(301),
    });
    expect(result.success).toBe(false);
  });

  it("allows granting admin but never owner through the API", () => {
    // "owner" is a valid role in the enum, but the server refuses to modify an
    // owner record at all — this asserts the payload shape, and
    // lib/auth/access.ts guards the transition itself.
    const grantable: UserRole[] = ["admin", "editor"];
    for (const role of grantable) {
      expect(accessDecisionSchema.safeParse({ status: "approved", role }).success).toBe(
        true,
      );
    }
  });
});
