/**
 * Media served by our own gated route.
 *
 * Matters for next/image: the optimiser fetches the source server-side and
 * does NOT carry the viewer's session cookie, so /api/media would answer 401
 * and the image would break. These are already downscaled to 2400px and
 * re-encoded to WebP at upload time, so skipping the optimiser costs little.
 */
export function isAppMedia(url: string): boolean {
  return url.startsWith("/api/media/");
}

/** True when next/image must not run this source through the optimiser. */
export function shouldSkipOptimizer(url: string, source?: "upload" | "url"): boolean {
  return isAppMedia(url) || source === "url";
}
