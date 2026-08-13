import { z } from "zod";

import { guardAdmin } from "@/lib/api/guard";
import { badRequest, ok, parseBody, serverError } from "@/lib/api/respond";
import {
  parseYouTube,
  youtubeThumbnails,
  youtubeWatchUrl,
  type YouTubeFormat,
} from "@/lib/youtube/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.strictObject({
  url: z.string().min(1).max(2048),
  /** Lets the admin override auto-detection — a Short is reachable via watch?v=. */
  formatOverride: z.enum(["auto", "short", "video"]).default("auto"),
});

const FETCH_TIMEOUT_MS = 6000;

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Not every video has a maxres thumbnail, so probe for the best that exists. */
async function bestThumbnail(id: string): Promise<string> {
  const candidates = youtubeThumbnails(id);

  for (const url of candidates) {
    const found = await withTimeout(async (signal) => {
      const response = await fetch(url, { method: "HEAD", signal });
      // YouTube serves a 120x90 placeholder rather than a 404 for missing sizes.
      const length = Number(response.headers.get("content-length") ?? 0);
      return response.ok && length > 2000;
    });
    if (found) return url;
  }

  return candidates[candidates.length - 1]!;
}

async function fetchTitle(id: string): Promise<string | undefined> {
  const result = await withTimeout(async (signal) => {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      youtubeWatchUrl(id),
    )}&format=json`;
    const response = await fetch(endpoint, { signal });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { title?: string };
    return typeof data.title === "string" ? data.title.slice(0, 200) : undefined;
  });
  return result ?? undefined;
}

/** POST /api/admin/youtube — resolve any YouTube URL into stored preview media. */
export async function POST(request: Request) {
  const guard = await guardAdmin(request, "uploadUrl");
  if (!guard.ok) return guard.response;

  const parsed = await parseBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const result = parseYouTube(parsed.data.url);
  if (!result.ok) return badRequest(result.reason);

  const { id, startSeconds } = result.data;
  const format: YouTubeFormat =
    parsed.data.formatOverride === "auto" ? result.data.format : parsed.data.formatOverride;

  try {
    const [thumbnailUrl, title] = await Promise.all([bestThumbnail(id), fetchTitle(id)]);

    return ok({
      kind: "youtube" as const,
      youtubeId: id,
      format,
      originalUrl: youtubeWatchUrl(id),
      title,
      thumbnailUrl,
      startSeconds,
      /** True when detection and the stored value disagree — the UI flags it. */
      autoDetected: result.data.format,
    });
  } catch (error) {
    return serverError("admin/youtube", error);
  }
}
