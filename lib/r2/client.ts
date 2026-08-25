import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

import { r2Env } from "@/lib/env";

/**
 * Cloudflare R2 is S3-compatible, so the AWS SDK talks to it directly.
 * Region is always "auto" for R2.
 */

let cached: S3Client | null = null;

export function r2(): S3Client {
  if (cached) return cached;

  const env = r2Env();
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
  return r2Env().R2_BUCKET_NAME;
}

