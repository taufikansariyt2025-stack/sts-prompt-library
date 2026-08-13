import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

import { serverEnv } from "@/lib/env";

/**
 * Cloudflare R2 is S3-compatible, so the AWS SDK talks to it directly.
 * Region is always "auto" for R2.
 */

let cached: S3Client | null = null;

export function r2(): S3Client {
  if (cached) return cached;

  const env = serverEnv();
  cached = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return cached;
}

export function r2Bucket(): string {
  return serverEnv().R2_BUCKET_NAME;
}

/** Public CDN URL for an object key. The bucket itself is never public. */
export function r2PublicUrl(key: string): string {
  return `${serverEnv().R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
}
