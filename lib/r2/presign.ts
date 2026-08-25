import "server-only";

import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { nanoid } from "nanoid";

import { r2, r2Bucket } from "@/lib/r2/client";

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

/**
 * Builds an object key.
 *
 * NEVER derived from the uploaded filename. A random nanoid removes path
 * traversal, collisions and content-sniffing tricks in one move, and makes
 * every object immutable so it can be cached forever.
 */
export function buildObjectKey(scope: string, mime: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const ext = EXTENSION[mime] ?? "bin";
  return `${scope}/${year}/${month}/${nanoid(12)}.${ext}`;
}

/**
 * App-relative URL for a stored object.
 *
 * Relative, not absolute, and deliberately so: the bucket is private and has no
 * public origin, so media is served by /api/media behind a session check. It
 * also means no CDN hostname to configure and nothing to change if the site
 * moves domain.
 */
export function mediaUrlForKey(key: string): string {
  return `/api/media/${key}`;
}

/** Confirms an object really landed and matches what was promised. */
export async function verifyUploaded(
  key: string,
  expected: { mime?: string; maxBytes: number },
): Promise<{ ok: true; bytes: number; mime: string } | { ok: false; reason: string }> {
  try {
    const head = await r2().send(
      new HeadObjectCommand({ Bucket: r2Bucket(), Key: key }),
    );

    const bytes = head.ContentLength ?? 0;
    const mime = head.ContentType ?? "";

    if (bytes <= 0) return { ok: false, reason: "The uploaded file is empty." };
    if (bytes > expected.maxBytes) {
      return { ok: false, reason: "The uploaded file is larger than allowed." };
    }
    if (expected.mime && mime !== expected.mime) {
      return { ok: false, reason: "The uploaded file type doesn't match." };
    }

    return { ok: true, bytes, mime };
  } catch {
    return { ok: false, reason: "Upload not found in storage." };
  }
}
