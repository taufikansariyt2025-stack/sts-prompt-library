/**
 * Grants the `admin: true` custom claim to a Firebase Auth account.
 *
 *   pnpm set:admin you@example.com
 *
 * The account must already exist in Firebase Auth (sign in once, or create it
 * in the console). The claim is what `requireAdmin()` checks first; the
 * ADMIN_EMAILS allowlist exists so the very first sign-in can succeed before
 * any claim has been set.
 */

import { config } from "dotenv";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

import { resolveServiceAccount } from "../lib/firebase/credentials";

config({ path: ".env.local", quiet: true });


async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: pnpm set:admin <email>");
    process.exit(1);
  }

  let sa;
  try {
    sa = resolveServiceAccount();
  } catch (error) {
    console.error(`\n${(error as Error).message}\n`);
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId: sa.projectId,
      clientEmail: sa.clientEmail,
      privateKey: sa.privateKey,
    }),
    projectId: sa.projectId,
  });

  const auth = getAuth();

  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    console.error(
      `No Firebase Auth account for ${email}.\n` +
        `Create it in the Firebase console (Authentication → Users), or sign in once, then re-run.`,
    );
    process.exit(1);
  }

  await auth.setCustomUserClaims(user.uid, { admin: true, role: "owner" });

  // Mirror it into the access record so the admin queue agrees with the claim.
  const db = getFirestore();
  await db
    .collection("users")
    .doc(user.uid)
    .set(
      {
        email,
        displayName: user.displayName ?? "",
        photoURL: user.photoURL ?? "",
        emailVerified: user.emailVerified,
        provider: user.providerData[0]?.providerId ?? "password",
        status: "approved",
        role: "owner",
        requestedAt: FieldValue.serverTimestamp(),
        decidedAt: FieldValue.serverTimestamp(),
        decidedByEmail: "system (pnpm set:admin)",
        note: "",
      },
      { merge: true },
    );

  // Existing sessions still carry the old claims until they refresh.
  await auth.revokeRefreshTokens(user.uid);

  console.log(`✓ ${email} (${user.uid}) is now an owner.`);
  console.log("  Sign out and back in for the claim to take effect.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
