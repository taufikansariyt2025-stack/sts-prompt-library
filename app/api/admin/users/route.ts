import { guardAdmin } from "@/lib/api/guard";
import { forbidden, ok, serverError } from "@/lib/api/respond";
import { listAppUsers } from "@/lib/auth/access";
import { canManageUsers } from "@/lib/schemas/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/users — the access queue. Owners only. */
export async function GET(request: Request) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  if (!canManageUsers(guard.session.role)) {
    return forbidden("Only an owner can manage access.");
  }

  try {
    return ok(await listAppUsers());
  } catch (error) {
    return serverError("admin/users GET", error);
  }
}
