import { existsSync, readFileSync } from "node:fs";

/**
 * Resolves Firebase Admin credentials from the environment.
 *
 * Accepts, in order of preference:
 *   1. FIREBASE_SERVICE_ACCOUNT_KEY — the full service-account JSON,
 *      either raw or base64-encoded.
 *   2. FIREBASE_SERVICE_ACCOUNT_KEY — a path to that JSON file on disk.
 *   3. FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
 *      as three separate variables (private key may be raw PEM or base64).
 *
 * Several formats are supported because the Firebase console hands you a JSON
 * file, most hosting UIs mangle multi-line pasting, and a lot of guides tell
 * you to split it into three variables. Any of those should just work.
 */

export type ServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

export class CredentialError extends Error {}

/** dotenv keeps stray wrapping quotes; PEM parsing needs real newlines. */
function normalisePrivateKey(raw: string): string {
  let key = raw.trim().replace(/^["']|["']$/g, "");

  if (!key.includes("BEGIN") && /^[A-Za-z0-9+/=\s]+$/.test(key) && key.length > 100) {
    key = Buffer.from(key, "base64").toString("utf8");
  }

  return key.replace(/\\n/g, "\n").trim();
}

function looksLikePem(value: string): boolean {
  return value.includes("-----BEGIN") && value.includes("PRIVATE KEY");
}

function fromJson(json: string): ServiceAccount {
  const parsed = JSON.parse(json) as Record<string, unknown>;

  const projectId = String(parsed.project_id ?? parsed.projectId ?? "");
  const clientEmail = String(parsed.client_email ?? parsed.clientEmail ?? "");
  const privateKey = String(parsed.private_key ?? parsed.privateKey ?? "");

  if (!projectId || !clientEmail || !privateKey) {
    throw new CredentialError(
      "The service-account JSON is missing project_id, client_email or private_key.",
    );
  }

  return { projectId, clientEmail, privateKey: normalisePrivateKey(privateKey) };
}

export function resolveServiceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();

  if (raw) {
    // 1. Raw JSON
    if (raw.startsWith("{")) return fromJson(raw);

    // 2. A path to the JSON file
    if (!looksLikePem(raw) && raw.length < 500 && existsSync(raw)) {
      return fromJson(readFileSync(raw, "utf8"));
    }

    // 3. base64-encoded JSON
    if (!looksLikePem(raw)) {
      try {
        const decoded = Buffer.from(raw, "base64").toString("utf8").trim();
        if (decoded.startsWith("{")) return fromJson(decoded);
      } catch {
        // fall through to the split-variable path
      }
    }
  }

  // 4. Three separate variables. The private key may live in either
  //    FIREBASE_PRIVATE_KEY or (a common mistake) FIREBASE_SERVICE_ACCOUNT_KEY.
  const projectId =
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim() ?? "";
  const privateKeySource =
    process.env.FIREBASE_PRIVATE_KEY?.trim() || (raw && looksLikePem(raw) ? raw : "");

  const missing: string[] = [];
  if (!projectId) missing.push("FIREBASE_PROJECT_ID");
  if (!clientEmail) missing.push("FIREBASE_CLIENT_EMAIL");
  if (!privateKeySource) missing.push("FIREBASE_PRIVATE_KEY");

  if (missing.length > 0) {
    throw new CredentialError(
      [
        `Firebase Admin credentials are incomplete. Missing: ${missing.join(", ")}.`,
        "",
        "Easiest fix — use the whole service-account file:",
        "  Firebase console → Project settings → Service accounts",
        "  → Generate new private key (downloads a .json)",
        "",
        "Then set ONE of these in .env.local:",
        "  FIREBASE_SERVICE_ACCOUNT_KEY=/absolute/path/to/service-account.json",
        "  FIREBASE_SERVICE_ACCOUNT_KEY=<the whole JSON on one line>",
        "  FIREBASE_SERVICE_ACCOUNT_KEY=<base64 of that JSON>",
        "",
        "Or set the three values separately:",
        "  FIREBASE_PROJECT_ID=...",
        "  FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@<project>.iam.gserviceaccount.com",
        '  FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"',
      ].join("\n"),
    );
  }

  return { projectId, clientEmail, privateKey: normalisePrivateKey(privateKeySource) };
}
