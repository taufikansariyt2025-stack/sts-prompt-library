import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Container liveness probe.
 *
 * Deliberately does NOT touch Firestore or R2. A health check that depends on
 * a third party turns their outage into a restart loop — this only answers
 * "is the Node process serving HTTP?", which is the question an orchestrator
 * is actually asking.
 */
export async function GET() {
  return NextResponse.json(
    { ok: true, service: "sts-prompt-library", uptime: Math.round(process.uptime()) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
