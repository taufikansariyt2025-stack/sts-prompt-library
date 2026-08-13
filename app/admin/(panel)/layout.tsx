import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { countPendingRequests } from "@/lib/auth/access";
import { requireAdmin } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/schemas/user";

/**
 * The real admin guard.
 *
 * proxy.ts only checks whether a session cookie exists, which is an optimistic
 * redirect. This verifies it against Firebase on every request — and every
 * mutating route handler verifies it again independently.
 *
 * `/admin/login` sits outside this route group, so it renders unguarded.
 */
export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireAdmin();
  if (!session) redirect("/admin/login");

  // Only owners see the queue, so only they need the count.
  const pendingRequests = canManageUsers(session.role) ? await countPendingRequests() : 0;

  return (
    <AdminShell session={session} pendingRequests={pendingRequests}>
      {children}
    </AdminShell>
  );
}
