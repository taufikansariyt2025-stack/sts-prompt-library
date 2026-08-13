import "server-only";

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { resolveServiceAccount } from "@/lib/firebase/credentials";

/**
 * Firebase Admin SDK — server only.
 *
 * The Admin SDK bypasses Firestore security rules entirely. That is deliberate:
 * the rules deny every client write, so this is the ONLY path that can mutate
 * data. Every caller must therefore authorise the request itself first
 * (see lib/auth/session.ts → requireAdmin).
 */

const APP_NAME = "sts-admin";

function adminApp(): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;

  // Accepts full JSON, base64 JSON, a file path, or three separate variables.
  const sa = resolveServiceAccount();

  return initializeApp(
    {
      credential: cert({
        projectId: sa.projectId,
        clientEmail: sa.clientEmail,
        privateKey: sa.privateKey,
      }),
      projectId: sa.projectId,
    },
    APP_NAME,
  );
}

let cachedDb: Firestore | null = null;

export function adminDb(): Firestore {
  if (cachedDb) return cachedDb;
  const db = getFirestore(adminApp());
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // settings() throws if called twice — harmless across hot reloads.
  }
  cachedDb = db;
  return cachedDb;
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}

export { getApp as getAdminApp };
