import { YOUTUBE_ID } from "@/lib/schemas/media";

export type YouTubeFormat = "short" | "video";

export type ParsedYouTube = {
  id: string;
  format: YouTubeFormat;
  startSeconds?: number;
};

export type ParseResult =
  | { ok: true; data: ParsedYouTube }
  | { ok: false; reason: string };

const ALLOWED_HOSTS = new Set(["youtube.com", "youtu.be", "youtube-nocookie.com"]);

/**
 * Normalises any YouTube URL to an 11-character video ID.
 *
 * Handles: /shorts/, watch?v=, youtu.be/, /embed/, /live/, /v/, m.youtube.com,
 * youtube-nocookie.com, extra query params, and a bare ID.
 *
 * `format` is a best-effort detection only — a Short is also reachable through
 * a `watch?v=` URL, so the admin gets an explicit override and the chosen value
 * is persisted on the document. See PRD §12.3.
 */
export function parseYouTube(input: string): ParseResult {
  const raw = input.trim();
  if (!raw) return { ok: false, reason: "Paste a YouTube URL" };

  // Bare ID
  if (YOUTUBE_ID.test(raw)) return { ok: true, data: { id: raw, format: "video" } };

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return { ok: false, reason: "That isn't a valid URL" };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "Only http(s) URLs are supported" };
  }

  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (!ALLOWED_HOSTS.has(host)) {
    return { ok: false, reason: "That isn't a YouTube URL" };
  }

  const segments = url.pathname.split("/").filter(Boolean);
  let id: string | undefined;
  let format: YouTubeFormat = "video";

  if (host === "youtu.be") {
    id = segments[0];
  } else if (segments[0] === "shorts") {
    id = segments[1];
    format = "short";
  } else if (segments[0] === "embed" || segments[0] === "live" || segments[0] === "v") {
    id = segments[1];
  } else if (url.pathname === "/watch") {
    id = url.searchParams.get("v") ?? undefined;
  }

  if (!id || !YOUTUBE_ID.test(id)) {
    return { ok: false, reason: "Couldn't find a video ID in that URL" };
  }

  return { ok: true, data: { id, format, startSeconds: parseStart(url) } };
}

/** Supports `t=90`, `t=90s`, `t=1m30s` and `start=90`. */
function parseStart(url: URL): number | undefined {
  const value = url.searchParams.get("t") ?? url.searchParams.get("start");
  if (!value) return undefined;

  const hms = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i);
  if (hms && (hms[1] || hms[2] || hms[3])) {
    const seconds =
      Number(hms[1] ?? 0) * 3600 + Number(hms[2] ?? 0) * 60 + Number(hms[3] ?? 0);
    return seconds > 0 ? seconds : undefined;
  }

  const plain = parseInt(value, 10);
  return Number.isFinite(plain) && plain > 0 ? plain : undefined;
}

/** Privacy-enhanced embed URL. Always youtube-nocookie. */
export function youtubeEmbedUrl(
  id: string,
  options: { startSeconds?: number; autoplay?: boolean } = {},
): string {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });
  if (options.startSeconds) params.set("start", String(options.startSeconds));
  if (options.autoplay) params.set("autoplay", "1");
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/**
 * Thumbnail candidates, best first. Not every video has a maxres, so callers
 * verify with a HEAD request at save time and store the one that resolved.
 */
export function youtubeThumbnails(id: string): string[] {
  return [
    `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${id}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  ];
}

/** Aspect ratio for the player container. */
export function youtubeAspect(format: YouTubeFormat): number {
  return format === "short" ? 9 / 16 : 16 / 9;
}
