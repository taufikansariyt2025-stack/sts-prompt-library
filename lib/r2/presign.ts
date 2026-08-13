import "server-only";

import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";

import { r2, r2Bucket, r2PublicUrl } from "@/lib/r2/client";

/** Presigned URLs are short-lived; an upload should start immediately. */
const PRESIGN_TTL_SECONDS = 300;

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
 * The key is NEVER derived from the uploaded filename. A random nanoid removes
 * path traversal, collisions and content-sniffing tricks in one move, and makes
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
 * Signs a PUT that only accepts the exact content type and length the client
 * declared. A signature for a 200 KB WebP cannot be replayed to upload a 2 GB
 * archive.
 */
export async function presignUpload(params: {
  key: string;
  mime: string;
  bytes: number;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: r2Bucket(),
    Key: params.key,
    ContentType: params.mime,
    ContentLength: params.bytes,
    CacheControl: "public, max-age=31536000, immutable",
  });

  return getSignedUrl(r2(), command, {
    expiresIn: PRESIGN_TTL_SECONDS,
    signableHeaders: new Set(["content-type", "content-length"]),
  });
}

/**
 * Confirms the object really landed, and that what landed matches what was
 * promised. Without this the client could call upload-complete without ever
 * uploading, leaving a database row pointing at nothing.
 */
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

export { r2PublicUrl };
