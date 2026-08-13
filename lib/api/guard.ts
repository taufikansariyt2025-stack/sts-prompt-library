import "server-only";

import type { NextResponse } from "next/server";

import { badRequest, tooManyRequests, unauthorized } from "@/lib/api/respond";
import { sameOrigin } from "@/lib/api/respond";
import { requireAdmin, type AdminSession } from "@/lib/auth/session";
import { clientIp, rateLimit, type LimitName } from "@/lib/security/rate-limit";

/**
 * The single entry check for every admin API route.
 *
 * Runs origin, session and rate-limit checks in the order that fails cheapest
 * first. Returning a discriminated union forces callers to handle the failure
 * branch — you cannot accidentally proceed unauthenticated.
 */
export async function guardAdmin(
  request: Request,
  limit: LimitName = "adminWrite",
): Promise<
  { ok: true; session: AdminSession } | { ok: false; response: NextResponse }
> {
  // CSRF: SameSite=Strict is the first layer, this is the second.
  if (!sameOrigin(request)) {
    return { ok: false, response: badRequest("Bad origin.") };
  }

  const session = await requireAdmin();
  if (!session) {
    return { ok: false, response: unauthorized() };
  }

  // Keyed on uid so one admin can't exhaust another's budget, and so a
  // rotating IP doesn't reset the window.
  const result = await rateLimit(limit, `${session.uid}:${clientIp(request)}`);
  if (!result.success) {
    return { ok: false, response: tooManyRequests(result.resetMs) };
  }

  return { ok: true, session };
}
