import { guardAdmin } from "@/lib/api/guard";
import { badRequest, forbidden, ok, parseBody, serverError } from "@/lib/api/respond";
import { decideAccess } from "@/lib/auth/access";
import { audit } from "@/lib/firebase/mutations";
import { accessDecisionSchema, canManageUsers } from "@/lib/schemas/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/admin/users/[uid] — approve, reject, suspend or change role. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/users/[uid]">) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  if (!canManageUsers(guard.session.role)) {
    return forbidden("Only an owner can manage access.");
  }

  const { uid } = await ctx.params;

  // Approving yourself would be a no-op at best and a footgun at worst.
  if (uid === guard.session.uid) {
    return badRequest("You can't change your own access.");
  }

  const parsed = await parseBody(request, accessDecisionSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const user = await decideAccess({
      uid,
      status: parsed.data.status,
      role: parsed.data.role,
      note: parsed.data.note,
      actorEmail: guard.session.email,
      actorRole: guard.session.role,
    });

    await audit(guard.session, "access.decide", uid, {
      status: parsed.data.status,
      role: user.role,
      email: user.email,
    });

    return ok(user);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("Owner accounts") ||
        error.message.includes("Only an owner"))
    ) {
      return forbidden(error.message);
    }
    return serverError("admin/users PATCH", error);
  }
}
