import "server-only";

/**
 * Wraps a Firestore read so an unconfigured or unreachable database renders an
 * empty state instead of a 500.
 *
 * Public pages are statically generated, so this also means the very first
 * build succeeds before any data exists — which is what lets the site deploy
 * before the library is populated.
 */
export async function safeQuery<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[firestore] read failed, using fallback:", (error as Error).message);
    }
    return fallback;
  }
}
