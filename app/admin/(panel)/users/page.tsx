import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";

import { UsersClient } from "@/components/admin/users-client";
import { Card, CardBody } from "@/components/ui/card";
import { listAppUsers } from "@/lib/auth/access";
import { requireAdmin } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/schemas/user";

export const metadata: Metadata = { title: "Access" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  // The layout already proved there is a session; this checks the role.
  const session = await requireAdmin();

  if (!session || !canManageUsers(session.role)) {
    return (
      <Card className="mx-auto max-w-lg border-warning/40 bg-warning/5">
        <CardBody className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium text-fg">Owners only</p>
            <p className="mt-1 text-sm text-fg-muted">
              Only an owner account can review access requests.
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  let users;
  try {
    users = await listAppUsers();
  } catch {
    users = null;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Access</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Approve who can sign in to the admin panel. The public library stays open
          to everyone.
        </p>
      </header>

      {users === null ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardBody className="text-sm text-fg-muted">
            Firestore isn&rsquo;t reachable yet.
          </CardBody>
        </Card>
      ) : (
        <UsersClient initialUsers={users} />
      )}
    </div>
  );
}
