import "server-only";

import { NextResponse } from "next/server";
import type { z } from "zod";

/**
 * Shared helpers for route handlers, so every endpoint answers consistently and
 * nothing leaks an internal error message to a client.
 */

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, { status: 200, ...init });
}

export function badRequest(error: string, issues?: unknown) {
  return NextResponse.json({ ok: false, error, issues }, { status: 400 });
}

export function unauthorized(error = "Unauthorized") {
  return NextResponse.json({ ok: false, error }, { status: 401 });
}

export function forbidden(error = "Forbidden") {
  return NextResponse.json({ ok: false, error }, { status: 403 });
}

export function notFound(error = "Not found") {
  return NextResponse.json({ ok: false, error }, { status: 404 });
}

export function tooManyRequests(resetMs: number) {
  return NextResponse.json(
    { ok: false, error: "Too many requests. Try again shortly." },
    { status: 429, headers: { "Retry-After": String(Math.ceil(resetMs / 1000)) } },
  );
}

/**
 * Logs the real error server-side and returns an opaque message.
 * Never surface internal details — they map the system for an attacker.
 */
export function serverError(context: string, error: unknown) {
  console.error(`[${context}]`, error);
  return NextResponse.json(
    { ok: false, error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}

/** Parses a JSON body against a schema, returning a typed result. */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: badRequest("Request body must be valid JSON.") };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: badRequest("Invalid input.", parsed.error.issues),
    };
  }

  return { ok: true, data: parsed.data };
}

/**
 * CSRF defence for mutating routes.
 *
 * SameSite=Strict already blocks cross-site cookie sending; this is the second
 * layer, rejecting requests whose Origin isn't ours.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches may omit it

  const allowed = new Set<string>();
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      allowed.add(new URL(configured).origin);
    } catch {
      /* ignore malformed config */
    }
  }
  const host = request.headers.get("host");
  if (host) {
    allowed.add(`https://${host}`);
    if (process.env.NODE_ENV !== "production") allowed.add(`http://${host}`);
  }

  return allowed.has(origin);
}
