import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/session";
import { isR2Configured } from "@/lib/env";
import { getObject } from "@/lib/r2/object";
import { OBJECT_KEY } from "@/lib/schemas/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/media/<key> — serves a private R2 object.
 *
 * Requires a session, so previews are gated like the pages that embed them.
 * Keys are content-unique, so the response is immutable and cached in the
 * browser for a year; `private` keeps it out of any shared cache, which
 * matters because the bytes are access-controlled.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/media/[...key]">) {
  if (!(await requireSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isR2Configured()) {
    return NextResponse.json({ ok: false, error: "Storage not configured" }, { status: 404 });
  }

  const { key: segments } = await ctx.params;
  const key = segments.join("/");

  // Never pass an unvalidated key to the storage client.
  if (!OBJECT_KEY.test(key)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const object = await getObject(key);
  if (!object) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  // Let the browser skip the transfer when it already has the bytes.
  if (object.etag && request.headers.get("if-none-match") === object.etag) {
    return new NextResponse(null, { status: 304 });
  }

  return new NextResponse(object.body, {
    headers: {
      "Content-Type": object.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
      ...(object.contentLength ? { "Content-Length": String(object.contentLength) } : {}),
      ...(object.etag ? { ETag: object.etag } : {}),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
