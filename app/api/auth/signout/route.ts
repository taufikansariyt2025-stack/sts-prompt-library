import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { sameOrigin } from "@/lib/api/respond";
import { revokeSession, SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/signout
 *
 * Driven by a plain <form> in the header so signing out works without
 * JavaScript. Revokes refresh tokens as well as clearing the cookie, so the
 * session dies on every device rather than just this browser.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Bad origin." }, { status: 400 });
  }

  await revokeSession();
  const store = await cookies();
  store.delete(SESSION_COOKIE);

  // 303 so the browser follows with GET rather than repeating the POST.
  return NextResponse.redirect(new URL("/", request.url), 303);
}
