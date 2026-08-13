"use client";

import {
  BadgeCheck,
  Check,
  Clock,
  Loader2,
  MailWarning,
  ShieldCheck,
  ShieldX,
  UserRound,
  X,
} from "lucide-react";
import NextImage from "next/image";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  DEFAULT_APPROVED_ROLE,
  ROLE_COPY,
  type AccessStatus,
  type AppUser,
  type UserRole,
} from "@/lib/schemas/user";
import { cn } from "@/lib/utils/cn";

const STATUS_STYLE: Record<AccessStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-warning/12 text-warning" },
  approved: { label: "Approved", className: "bg-success/12 text-success" },
  rejected: { label: "Rejected", className: "bg-danger/12 text-danger" },
  suspended: { label: "Suspended", className: "bg-danger/12 text-danger" },
};

export function UsersClient({ initialUsers }: { initialUsers: AppUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  async function decide(uid: string, status: AccessStatus, role?: UserRole) {
    setBusyUid(uid);
    try {
      const response = await fetch(`/api/admin/users/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, role }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        toast.error(payload.error ?? "Couldn't update that account.");
        return;
      }

      setUsers((current) =>
        current.map((u) => (u.uid === uid ? { ...u, status, role: role ?? u.role } : u)),
      );

      toast.success(
        status === "approved"
          ? "Access granted"
          : status === "rejected"
            ? "Request rejected"
            : "Access suspended",
      );
    } catch {
      toast.error("Network error.");
    } finally {
      setBusyUid(null);
    }
  }

  const pending = users.filter((u) => u.status === "pending");
  const decided = users.filter((u) => u.status !== "pending");

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Clock className="size-4 text-warning" />
          Pending requests
          {pending.length > 0 ? (
            <span className="grid size-5 place-items-center rounded-full bg-warning/15 font-mono text-[0.6875rem] tabular-nums text-warning">
              {pending.length}
            </span>
          ) : null}
        </h2>

        {pending.length === 0 ? (
          <Card>
            <CardBody className="py-10 text-center">
              <BadgeCheck className="mx-auto size-6 text-fg-subtle" />
              <p className="mt-3 text-sm text-fg-muted">
                No one is waiting for access right now.
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-border">
              {pending.map((user) => (
                <li key={user.uid} className="p-3.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar user={user} />
                    <Identity user={user} />
                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger"
                        disabled={busyUid === user.uid}
                        onClick={() => decide(user.uid, "rejected")}
                      >
                        <X /> Reject
                      </Button>
                      <Button
                        size="sm"
                        title="Grants library access. Promote to Editor or Admin afterwards if they also need the panel."
                        disabled={busyUid === user.uid}
                        onClick={() => decide(user.uid, "approved", DEFAULT_APPROVED_ROLE)}
                      >
                        {busyUid === user.uid ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Check />
                        )}
                        Approve
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4 text-fg-subtle" />
          All accounts
          <span className="font-mono text-xs tabular-nums text-fg-subtle">
            {users.length}
          </span>
        </h2>

        <Card>
          <ul className="divide-y divide-border">
            {decided.map((user) => (
              <li key={user.uid} className="p-3.5">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar user={user} />
                  <Identity user={user} />

                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium",
                        STATUS_STYLE[user.status].className,
                      )}
                    >
                      {STATUS_STYLE[user.status].label}
                    </span>

                    {user.role === "owner" ? (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-medium text-accent">
                        Owner
                      </span>
                    ) : (
                      <>
                        <Select
                          aria-label={`Role for ${user.email}`}
                          title={ROLE_COPY[user.role]}
                          value={user.role}
                          disabled={busyUid === user.uid || user.status !== "approved"}
                          onChange={(e) =>
                            decide(user.uid, "approved", e.target.value as UserRole)
                          }
                          className="h-8 w-32 text-xs"
                        >
                          <option value="member">Member</option>
                          <option value="editor">Editor</option>
                          <option value="admin">Admin</option>
                        </Select>

                        {user.status === "approved" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-danger"
                            disabled={busyUid === user.uid}
                            onClick={() => decide(user.uid, "suspended")}
                          >
                            <ShieldX /> Suspend
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyUid === user.uid}
                            onClick={() => decide(user.uid, "approved", user.role)}
                          >
                            <Check /> Restore
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}

function Avatar({ user }: { user: AppUser }) {
  if (user.photoURL) {
    return (
      <NextImage
        src={user.photoURL}
        alt=""
        width={36}
        height={36}
        unoptimized
        className="size-9 shrink-0 rounded-full border border-border object-cover"
      />
    );
  }
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-surface-2">
      <UserRound className="size-4 text-fg-subtle" />
    </span>
  );
}

function Identity({ user }: { user: AppUser }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-fg">
        {user.displayName || user.email.split("@")[0]}
        {!user.emailVerified && user.provider === "password" ? (
          <span
            title="Email not verified"
            className="inline-flex items-center gap-1 rounded bg-warning/12 px-1.5 py-0.5 text-[0.625rem] font-medium text-warning"
          >
            <MailWarning className="size-3" /> Unverified
          </span>
        ) : null}
      </p>
      <p className="truncate text-xs text-fg-muted">{user.email}</p>
      <p className="mt-0.5 font-mono text-[0.625rem] text-fg-subtle">
        {user.provider === "google.com" ? "Google" : "Password"} ·{" "}
        {new Date(user.requestedAt).toLocaleDateString()}
      </p>
    </div>
  );
}
