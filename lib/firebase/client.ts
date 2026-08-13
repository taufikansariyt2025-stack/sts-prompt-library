import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

import { clientEnv } from "@/lib/env";

/**
 * Browser Firebase app.
 *
 * Used for two things only:
 *  1. Admin sign-in (Firebase Auth), which then exchanges an ID token for a
 *     server-set session cookie — see lib/auth/.
 *  2. Read-only Firestore access, guarded by security rules.
 *
 * Client writes are denied by the rules for every collection. All mutations go
 * through server route handlers using the Admin SDK. See CLAUDE.md rule #1.
 */

const config = {
  apiKey: clientEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: clientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: clientEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: clientEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: clientEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: clientEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(config);
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp());
}

export function firebaseDb(): Firestore {
  return getFirestore(firebaseApp());
}
