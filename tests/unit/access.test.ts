import { describe, expect, it } from "vitest";

import {
  ACCESS_STATUSES,
  accessDecisionSchema,
  canAccessPanel,
  canEditSettings,
  canActOnUser,
  canManageUsers,
  canViewLibrary,
  grantableRoles,
  DEFAULT_APPROVED_ROLE,
  USER_ROLES,
  type UserRole,
} from "@/lib/schemas/user";

/**
 * Authorisation rules for admin-panel access.
 *
 * The threat these guard against is privilege escalation: an approved admin
 * granting themselves owner rights, or approving further accounts.
 */

describe("grantableRoles", () => {
  it("lets an owner grant any non-owner role", () => {
    expect(grantableRoles("owner")).toEqual(["member", "editor", "admin"]);
  });

  it("stops an admin minting another admin", () => {
    expect(grantableRoles("admin")).not.toContain("admin");
    expect(grantableRoles("admin")).toEqual(["member", "editor"]);
  });

  it("never lets anyone grant owner — that comes from ADMIN_EMAILS alone", () => {
    for (const role of USER_ROLES) expect(grantableRoles(role)).not.toContain("owner");
  });

  it("gives editors and members nothing to grant", () => {
    expect(grantableRoles("editor")).toEqual([]);
    expect(grantableRoles("member")).toEqual([]);
  });
});

describe("canActOnUser", () => {
  it("never allows acting on an owner, not even by an owner", () => {
    for (const actor of USER_ROLES) expect(canActOnUser(actor, "owner")).toBe(false);
  });

  it("lets an owner act on every other role", () => {
    expect(canActOnUser("owner", "admin")).toBe(true);
    expect(canActOnUser("owner", "editor")).toBe(true);
    expect(canActOnUser("owner", "member")).toBe(true);
  });

  it("stops an admin acting on another admin — no sideways escalation", () => {
    expect(canActOnUser("admin", "admin")).toBe(false);
    expect(canActOnUser("admin", "editor")).toBe(true);
    expect(canActOnUser("admin", "member")).toBe(true);
  });

  it("gives editors and members no authority at all", () => {
    for (const target of USER_ROLES) {
      expect(canActOnUser("editor", target)).toBe(false);
      expect(canActOnUser("member", target)).toBe(false);
    }
  });
});

describe("canManageUsers", () => {
  it("lets owners and admins review access requests", () => {
    expect(canManageUsers("owner")).toBe(true);
    expect(canManageUsers("admin")).toBe(true);
  });

  it("keeps editors and members out of the queue", () => {
    expect(canManageUsers("editor")).toBe(false);
    expect(canManageUsers("member")).toBe(false);
  });
});

describe("canViewLibrary", () => {
  it("allows every approved role — the library is the baseline grant", () => {
    for (const role of USER_ROLES) expect(canViewLibrary(role)).toBe(true);
  });
});

describe("canAccessPanel", () => {
  it("keeps members out of /admin while still letting them browse", () => {
    expect(canAccessPanel("member")).toBe(false);
    expect(canViewLibrary("member")).toBe(true);
  });

  it("allows the three staff roles", () => {
    expect(canAccessPanel("owner")).toBe(true);
    expect(canAccessPanel("admin")).toBe(true);
    expect(canAccessPanel("editor")).toBe(true);
  });

  it("is strictly narrower than library access", () => {
    const panel = USER_ROLES.filter(canAccessPanel);
    const library = USER_ROLES.filter(canViewLibrary);
    expect(panel.length).toBeLessThan(library.length);
    for (const role of panel) expect(canViewLibrary(role)).toBe(true);
  });
});

describe("DEFAULT_APPROVED_ROLE", () => {
  it("grants library access only — approving someone must not hand them the panel", () => {
    expect(DEFAULT_APPROVED_ROLE).toBe("member");
    expect(canViewLibrary(DEFAULT_APPROVED_ROLE)).toBe(true);
    expect(canAccessPanel(DEFAULT_APPROVED_ROLE)).toBe(false);
    expect(canManageUsers(DEFAULT_APPROVED_ROLE)).toBe(false);
  });
});

describe("canEditSettings", () => {
  it("allows owner and admin but not editor or member", () => {
    expect(canEditSettings("owner")).toBe(true);
    expect(canEditSettings("admin")).toBe(true);
    expect(canEditSettings("editor")).toBe(false);
    expect(canEditSettings("member")).toBe(false);
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
    const grantable: UserRole[] = ["admin", "editor", "member"];
    for (const role of grantable) {
      expect(accessDecisionSchema.safeParse({ status: "approved", role }).success).toBe(
        true,
      );
    }
  });
});
