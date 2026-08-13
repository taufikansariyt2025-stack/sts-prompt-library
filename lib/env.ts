import { z } from "zod";

/**
 * Environment validation.
 *
 * Split in two because the client bundle can only ever see `NEXT_PUBLIC_*`.
 * Server variables are validated lazily so importing this module from a Client
 * Component can never throw — and can never leak a secret into the bundle.
 *
 * Both schemas fail fast with a readable message, which beats a 500 three
 * screens deep in a request.
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

const serverSchema = z.object({
  // Credentials are resolved by lib/firebase/credentials.ts, which accepts
  // several formats and raises a far more actionable error than a Zod issue.
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_PUBLIC_URL: z.url(),
  /** Comma-separated emails allowed to hold the admin claim. */
  ADMIN_EMAILS: z.string().min(3),
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  REVALIDATE_SECRET: z.string().min(16).optional(),
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
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const parsedClient = clientSchema.safeParse(rawClient);
if (!parsedClient.success) format(parsedClient.error, "client");

export const clientEnv = parsedClient.data;

let cachedServerEnv: z.infer<typeof serverSchema> | null = null;

/** Server-only. Throws if called from the browser. */
export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must never be called from the browser.");
  }
  if (cachedServerEnv) return cachedServerEnv;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) format(parsed.error, "server");

  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

/** Emails permitted to hold the admin custom claim. */
export function adminEmails(): string[] {
  return serverEnv()
    .ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
