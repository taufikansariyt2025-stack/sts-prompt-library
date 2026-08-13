import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  badRequest,
  ok,
  parseBody,
  sameOrigin,
  serverError,
  tooManyRequests,
} from "@/lib/api/respond";
import {
  createSessionFromIdToken,
  requireAdmin,
  revokeSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.strictObject({
  idToken: z.string().min(20).max(4096),
});

/** POST — exchange a Firebase ID token for an HttpOnly session cookie. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return badRequest("Bad origin.");

  const limit = await rateLimit("login", clientIp(request));
  if (!limit.success) return tooManyRequests(limit.resetMs);

  const parsed = await parseBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await createSessionFromIdToken(parsed.data.idToken);

    if (!result.ok) {
      /*
       * The access status is returned deliberately. Normally you would keep an
       * auth failure opaque, but here the caller has already proved who they
       * are with a verified ID token — they are asking about their OWN account,
       * so telling them "your request is pending" leaks nothing and is the
       * entire point of the flow.
       */
      return NextResponse.json(
        { ok: false, error: result.reason, status: result.status },
        { status: result.status === "invalid" ? 401 : 403 },
      );
    }

    const store = await cookies();
    store.set({ ...sessionCookieOptions(result.maxAgeMs), value: result.cookie });

    return ok({ signedIn: true, role: result.role });
  } catch (error) {
    return serverError("admin/session POST", error);
  }
}

/** DELETE — sign out and revoke refresh tokens everywhere. */
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return badRequest("Bad origin.");

  try {
    await revokeSession();
    const store = await cookies();
    store.delete(SESSION_COOKIE);
    return ok({ signedIn: false });
  } catch (error) {
    return serverError("admin/session DELETE", error);
  }
}

/** GET — who am I? Used by the admin shell to render the account menu. */
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ ok: true, data: null }, { status: 200 });
  return ok(session);
}
