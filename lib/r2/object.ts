import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import { r2, r2Bucket } from "@/lib/r2/client";
import { OBJECT_KEY } from "@/lib/schemas/media";

export { OBJECT_KEY };

/**
 * Direct object access.
 *
 * The bucket is entirely private — no public URL, no custom domain. Media is
 * read back through /api/media, which requires a session, so previews are
 * gated exactly like the pages that embed them. A public bucket URL would have
 * left every preview world-readable while the pages around it were locked.
 */

export type StoredObject = {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  contentLength?: number;
  etag?: string;
};

export async function getObject(key: string): Promise<StoredObject | null> {
  try {
    const result = await r2().send(
      new GetObjectCommand({ Bucket: r2Bucket(), Key: key }),
    );
    if (!result.Body) return null;

    return {
      // Node SDK returns a web stream here, which Response accepts directly —
      // so bytes are piped, never buffered into memory.
      body: result.Body.transformToWebStream(),
      contentType: result.ContentType ?? "application/octet-stream",
      contentLength: result.ContentLength,
      etag: result.ETag,
    };
  } catch {
    return null;
  }
}

export async function putObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  await r2().send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  await r2().send(new DeleteObjectCommand({ Bucket: r2Bucket(), Key: key }));
}
