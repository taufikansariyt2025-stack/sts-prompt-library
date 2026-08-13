import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

import { clientEnv } from "@/lib/env";

/**
 * Browser Firebase app.
 *
 * Used for ONE thing: authentication. The browser signs in, gets an ID token,
 * and exchanges it for a server-set HttpOnly session cookie (see lib/auth/).
 *
 * It deliberately does NOT export a Firestore handle. `firestore.rules` denies
 * every client read and write, because the library is gated — all data access
 * runs server-side through the Admin SDK after the session has been verified.
 * Adding a client Firestore read here would silently bypass that gate.
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
