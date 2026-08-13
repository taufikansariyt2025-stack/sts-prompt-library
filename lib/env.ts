import { z } from "zod";

/**
 * Environment validation, split by concern.
 *
 * Client vars are validated eagerly — they're inlined at build time, so a
 * missing one should fail the build loudly.
 *
 * Server vars are validated LAZILY AND PER FEATURE. That split matters: a
 * single monolithic server schema meant that asking "who are the admins?"
 * also demanded the Cloudflare R2 credentials, so signing in returned a 500 on
 * any deploy where image storage wasn't configured yet. Each feature should
 * only be able to break itself.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_CDN_URL: z.url(),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
});

function format(error: z.ZodError, scope: string): never {
  const lines = error.issues.map((i) => `  · ${i.path.join(".")}: ${i.message}`);
  throw new Error(
    `Invalid ${scope} environment variables:\n${lines.join("\n")}\n\n` +
      `Copy .env.example to .env.local and fill in the missing values.`,
  );
}

// Referenced explicitly (not via a loop) so Next.js can inline them at build time.
const rawClient = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const parsedClient = clientSchema.safeParse(rawClient);
if (!parsedClient.success) format(parsedClient.error, "client");

export const clientEnv = parsedClient.data;

function assertServer(): void {
  if (typeof window !== "undefined") {
    throw new Error("Server environment must never be read from the browser.");
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Emails permitted to hold the owner role.
 *
 * Deliberately tolerant: an empty or missing value yields an empty list rather
 * than throwing. Nobody gets auto-promoted, existing approved accounts keep
 * working, and — critically — sign-in still functions so an owner can be
 * granted access with `pnpm set:admin`.
 */
export function adminEmails(): string[] {
  assertServer();
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// ── Cloudflare R2 ────────────────────────────────────────────────────────────

const r2Schema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_PUBLIC_URL: z.url(),
});

let cachedR2: z.infer<typeof r2Schema> | null = null;

/** Throws only when something actually tries to use storage. */
export function r2Env() {
  assertServer();
  if (cachedR2) return cachedR2;

  const parsed = r2Schema.safeParse(process.env);
  if (!parsed.success) format(parsed.error, "Cloudflare R2");

  cachedR2 = parsed.data;
  return cachedR2;
}

/** Lets callers show "storage isn't set up" instead of a 500. */
export function isR2Configured(): boolean {
  if (typeof window !== "undefined") return false;
  return r2Schema.safeParse(process.env).success;
}

// ── Optional extras ──────────────────────────────────────────────────────────

export function optionalEnv() {
  assertServer();
  return {
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || undefined,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || undefined,
    REVALIDATE_SECRET: process.env.REVALIDATE_SECRET || undefined,
  };
}
